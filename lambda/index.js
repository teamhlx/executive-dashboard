const https = require('https');
const crypto = require('crypto');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const ssm = new SSMClient({ region: 'us-west-2' });
const bedrock = new BedrockRuntimeClient({ region: 'us-west-2' });
const s3 = new S3Client({ region: 'us-west-2' });

const FEEDBACK_BUCKET = 'executive-dashboard-feedback-uploads';

async function getJiraToken() {
  const cmd = new GetParameterCommand({
    Name: '/executive-dashboard/jira-api-token',
    WithDecryption: true
  });
  const res = await ssm.send(cmd);
  return res.Parameter.Value;
}

async function getDbUrl() {
  const cmd = new GetParameterCommand({
    Name: '/executive-dashboard/db-url',
    WithDecryption: true
  });
  const res = await ssm.send(cmd);
  return res.Parameter.Value;
}

async function getDbClient() {
  const dbUrl = await getDbUrl();
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

// Parse cookies from the Cookie header string
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((acc, part) => {
    const [key, ...val] = part.trim().split('=');
    if (key) acc[key.trim()] = val.join('=').trim();
    return acc;
  }, {});
}

// Get the session cookie value from an event
function getSessionId(event) {
  // API Gateway REST API: event.headers.Cookie or event.headers.cookie
  const cookieHeader = event.headers?.Cookie || event.headers?.cookie || '';
  // API Gateway HTTP API may also have event.cookies array
  if (!cookieHeader && event.cookies) {
    const arr = Array.isArray(event.cookies) ? event.cookies : [];
    for (const c of arr) {
      const [key, val] = c.split('=');
      if (key.trim() === 'session') return val?.trim() || null;
    }
    return null;
  }
  const cookies = parseCookies(cookieHeader);
  return cookies['session'] || null;
}

// Helper: authenticate from session
async function getAuthUser(event, client) {
  const sessionId = getSessionId(event);
  if (!sessionId) return null;
  try {
    const res = await client.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.project_ids
       FROM users u
       JOIN sessions s ON s.user_id = u.id
       WHERE s.id = $1 AND s.expires_at > NOW()`,
      [sessionId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      email: row.email,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      role: row.role,
      projectIds: row.project_ids || []
    };
  } catch (e) {
    console.error('getAuthUser error:', e);
    return null;
  }
}

function setCookieHeader(sessionId) {
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`;
}

function clearCookieHeader() {
  return `session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`;
}

function jiraRequest(path, token) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`skippy@jpv.dev:${token}`).toString('base64');
    const options = {
      hostname: 'bldglabs.atlassian.net',
      path,
      method: 'GET',
      headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchOpenBugsForChat(token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jql: `project=SM AND issuetype in (Bug, Epic) AND status != "Done" AND status != "Deployed to Production" ORDER BY created DESC`,
      maxResults: 50,
      fields: ['summary', 'status', 'issuetype', 'description']
    });
    const auth = Buffer.from(`skippy@jpv.dev:${token}`).toString('base64');
    const options = {
      hostname: 'bldglabs.atlassian.net',
      path: '/rest/api/3/search/jql',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  // Use event.path (REST API) - determine the path field
  const path = event.path || event.rawPath || '/';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // OPTIONS preflight for all routes
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  // ─── POST /api/auth/login ─────────────────────────────────────────────────
  if (method === 'POST' && path === '/api/auth/login') {
    let db;
    try {
      const body = JSON.parse(event.body || '{}');
      const { email, password } = body;
      if (!email || !password) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'email and password required' }) };
      }

      db = await getDbClient();
      const res = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (res.rows.length === 0) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }
      const user = res.rows[0];

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid credentials' }) };
      }

      const sessionId = crypto.randomUUID();
      await db.query('INSERT INTO sessions (id, user_id) VALUES ($1, $2)', [sessionId, user.id]);

      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Set-Cookie': setCookieHeader(sessionId)
        },
        body: JSON.stringify({
          user: {
            id: user.id,
            email: user.email,
            firstName: user.first_name || '',
            lastName: user.last_name || '',
            role: user.role,
            projectIds: user.project_ids || []
          },
          sessionId
        })
      };
    } catch (err) {
      console.error('login error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── POST /api/auth/logout ────────────────────────────────────────────────
  if (method === 'POST' && path === '/api/auth/logout') {
    let db;
    try {
      const sessionId = getSessionId(event);
      if (sessionId) {
        db = await getDbClient();
        await db.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
      }
      return {
        statusCode: 200,
        headers: {
          ...corsHeaders,
          'Set-Cookie': clearCookieHeader()
        },
        body: JSON.stringify({ success: true })
      };
    } catch (err) {
      console.error('logout error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── GET /api/auth/me ─────────────────────────────────────────────────────
  if (method === 'GET' && path === '/api/auth/me') {
    let db;
    try {
      db = await getDbClient();
      const user = await getAuthUser(event, db);
      if (!user) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ user })
      };
    } catch (err) {
      console.error('me error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── Admin routes ─────────────────────────────────────────────────────────

  // GET /api/admin/users
  if (method === 'GET' && path === '/api/admin/users') {
    let db;
    try {
      db = await getDbClient();
      const user = await getAuthUser(event, db);
      if (!user) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      if (user.role !== 'superadmin') return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden' }) };

      const res = await db.query('SELECT id, email, first_name, last_name, role, project_ids, created_at FROM users ORDER BY email');
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ users: res.rows.map(r => ({
          id: r.id,
          email: r.email,
          firstName: r.first_name || '',
          lastName: r.last_name || '',
          role: r.role,
          projectIds: r.project_ids || [],
          createdAt: r.created_at
        })) })
      };
    } catch (err) {
      console.error('GET admin/users error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // POST /api/admin/users
  if (method === 'POST' && path === '/api/admin/users') {
    let db;
    try {
      db = await getDbClient();
      const user = await getAuthUser(event, db);
      if (!user) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      if (user.role !== 'superadmin') return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden' }) };

      const body = JSON.parse(event.body || '{}');
      const { email, password, role, projectIds, firstName, lastName } = body;
      if (!email || !password) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'email and password required' }) };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const res = await db.query(
        'INSERT INTO users (email, password_hash, role, project_ids, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, email, first_name, last_name, role, project_ids, created_at',
        [email, hashedPassword, role || 'user', projectIds || [], firstName || '', lastName || '']
      );
      const newUser = res.rows[0];
      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name || '',
          lastName: newUser.last_name || '',
          role: newUser.role,
          projectIds: newUser.project_ids || [],
          createdAt: newUser.created_at
        } })
      };
    } catch (err) {
      console.error('POST admin/users error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // PATCH /api/admin/users/:id
  if (method === 'PATCH' && path && path.startsWith('/api/admin/users/')) {
    let db;
    try {
      db = await getDbClient();
      const user = await getAuthUser(event, db);
      if (!user) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      if (user.role !== 'superadmin') return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden' }) };

      const id = path.split('/')[4];
      if (!id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'id required' }) };

      const body = JSON.parse(event.body || '{}');
      const updates = [];
      const values = [];
      let idx = 1;

      if (body.password !== undefined) {
        const hash = await bcrypt.hash(body.password, 10);
        updates.push(`password_hash = $${idx++}`);
        values.push(hash);
      }
      if (body.role !== undefined) {
        updates.push(`role = $${idx++}`);
        values.push(body.role);
      }
      if (body.projectIds !== undefined) {
        updates.push(`project_ids = $${idx++}`);
        values.push(body.projectIds);
      }
      if (body.firstName !== undefined) {
        updates.push(`first_name = $${idx++}`);
        values.push(body.firstName);
      }
      if (body.lastName !== undefined) {
        updates.push(`last_name = $${idx++}`);
        values.push(body.lastName);
      }

      if (updates.length === 0) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No fields to update' }) };
      }

      values.push(id);
      await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    } catch (err) {
      console.error('PATCH admin/users/:id error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // DELETE /api/admin/users/:id
  if (method === 'DELETE' && path && path.startsWith('/api/admin/users/')) {
    let db;
    try {
      db = await getDbClient();
      const user = await getAuthUser(event, db);
      if (!user) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      if (user.role !== 'superadmin') return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Forbidden' }) };

      const id = path.split('/')[4];
      if (!id) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'id required' }) };

      await db.query('DELETE FROM sessions WHERE user_id = $1', [id]);
      await db.query('DELETE FROM users WHERE id = $1', [id]);

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    } catch (err) {
      console.error('DELETE admin/users/:id error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── POST /api/feedback/chat ───────────────────────────────────────────────
  if (method === 'POST' && path === '/api/feedback/chat') {
    let db;
    try {
      const body = JSON.parse(event.body || '{}');
      const { messages, feedbackId } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'messages array required' }) };
      }

      // Require auth
      db = await getDbClient();
      const authUser = await getAuthUser(event, db);
      if (!authUser) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }
      const submittedBy = authUser.email;

      // Fetch open Jira issues for context
      const token = await getJiraToken();
      const issuesData = await fetchOpenBugsForChat(token);
      const issues = (issuesData.issues || []).map(i => ({
        key: i.key,
        summary: i.fields.summary,
        status: i.fields.status.name,
        type: i.fields.issuetype.name
      }));

      const systemPrompt = `You are a helpful bug reporting assistant for the Skematic executive dashboard.
Help the executive describe their issue clearly, then match it against known bugs.

Be concise, warm, and professional. Keep responses short (2-3 sentences max).

After the user describes their issue, look through the open issues below and find the best match.
If you find a match, present it clearly: "I found something similar: [SM-XXX] — [summary]. Does this match what you're seeing?"
If no match, say you'll log it as a new issue.
Once resolved (linked or new), confirm and mention they can view it in 'My Reports'.

Open issues:
${JSON.stringify(issues, null, 2)}

IMPORTANT: End every response with a JSON action on its own line (no markdown, raw JSON only):
{"action":"continue"} — still gathering info
{"action":"link","jiraKey":"SM-XXX"} — user confirmed match to existing issue
{"action":"create"} — confirmed new issue, no existing match`;

      const cmd = new InvokeModelCommand({
        modelId: 'us.anthropic.claude-opus-4-6-v1:0',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages
        })
      });

      const bedrockRes = await bedrock.send(cmd);
      const bedrockBody = JSON.parse(Buffer.from(bedrockRes.body).toString());
      const fullText = bedrockBody.content[0].text;

      // Parse the last line for a JSON action block
      const lines = fullText.trim().split('\n');
      const lastLine = lines[lines.length - 1].trim();
      let action = null;
      let reply = fullText;

      try {
        const parsed = JSON.parse(lastLine);
        if (parsed.action) {
          action = parsed;
          reply = lines.slice(0, -1).join('\n').trim();
        }
      } catch (e) {
        // Last line wasn't JSON, just use the full text as reply
      }

      // Save to DB if action is link or create
      let savedFeedbackId = feedbackId || null;
      if (action && (action.action === 'link' || action.action === 'create')) {
        try {
          const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
          const description = lastUserMessage ? lastUserMessage.content : '';
          const status = action.action === 'link' ? 'linked' : 'not_reviewed';
          const jiraKey = action.jiraKey || null;

          if (!savedFeedbackId) {
            const result = await db.query(
              'INSERT INTO feedback (submitted_by, description, status, jira_ticket_key, chat_transcript) VALUES ($1, $2, $3, $4, $5) RETURNING id',
              [submittedBy, description, status, jiraKey, JSON.stringify(messages)]
            );
            savedFeedbackId = result.rows[0].id;
          } else {
            await db.query(
              'UPDATE feedback SET description = $1, status = $2, jira_ticket_key = $3, chat_transcript = $4, updated_at = NOW() WHERE id = $5',
              [description, status, jiraKey, JSON.stringify(messages), savedFeedbackId]
            );
          }
        } catch (dbErr) {
          console.error('DB error:', dbErr);
          // Don't fail the whole request on DB error
        }
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ reply, action, feedbackId: savedFeedbackId })
      };
    } catch (err) {
      console.error('feedback/chat error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── GET /api/feedback ────────────────────────────────────────────────────
  if (method === 'GET' && path === '/api/feedback') {
    let db;
    try {
      db = await getDbClient();
      const authUser = await getAuthUser(event, db);
      if (!authUser) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const result = await db.query(
        'SELECT id, submitted_by, description, status, jira_ticket_key, screenshot_url, created_at FROM feedback WHERE submitted_by = $1 ORDER BY created_at DESC',
        [authUser.email]
      );

      const feedback = result.rows.map(row => ({
        id: row.id,
        submittedBy: row.submitted_by,
        description: row.description,
        status: row.status,
        jiraTicketKey: row.jira_ticket_key,
        screenshotUrl: row.screenshot_url,
        createdAt: row.created_at
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ feedback })
      };
    } catch (err) {
      console.error('GET /api/feedback error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── POST /api/feedback/screenshot-url ───────────────────────────────────
  if (method === 'POST' && path === '/api/feedback/screenshot-url') {
    let db;
    try {
      db = await getDbClient();
      const authUser = await getAuthUser(event, db);
      if (!authUser) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const body = JSON.parse(event.body || '{}');
      const { feedbackId, filename, contentType } = body;

      if (!feedbackId || !filename || !contentType) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'feedbackId, filename, and contentType required' }) };
      }

      const key = `${feedbackId}/${filename}`;
      const cmd = new PutObjectCommand({
        Bucket: FEEDBACK_BUCKET,
        Key: key,
        ContentType: contentType
      });
      const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });
      const fileUrl = `https://${FEEDBACK_BUCKET}.s3.us-west-2.amazonaws.com/${key}`;

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ uploadUrl, fileUrl })
      };
    } catch (err) {
      console.error('screenshot-url error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── PATCH /api/feedback/:id/screenshot ──────────────────────────────────
  if (method === 'PATCH' && path && path.startsWith('/api/feedback/') && path.endsWith('/screenshot')) {
    let db;
    try {
      db = await getDbClient();
      const authUser = await getAuthUser(event, db);
      if (!authUser) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const parts = path.split('/');
      const id = parts[3];
      if (!id) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'id required in path' }) };
      }

      const body = JSON.parse(event.body || '{}');
      const { screenshotUrl } = body;
      if (!screenshotUrl) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'screenshotUrl required' }) };
      }

      await db.query(
        'UPDATE feedback SET screenshot_url = $1, updated_at = NOW() WHERE id = $2',
        [screenshotUrl, id]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true })
      };
    } catch (err) {
      console.error('PATCH screenshot error:', err);
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: err.message }) };
    } finally {
      if (db) await db.end().catch(() => {});
    }
  }

  // ─── Original Jira proxy ──────────────────────────────────────────────────
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };

  let db;
  try {
    db = await getDbClient();
    const authUser = await getAuthUser(event, db);
    if (!authUser) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const token = await getJiraToken();
    // If user has projectIds restrictions, use the first one; otherwise use default
    let project = event.queryStringParameters?.project || 'SM';
    // Filter: only allow project if user has access (superadmin bypasses)
    if (authUser.role !== 'superadmin' && authUser.projectIds && authUser.projectIds.length > 0) {
      const allowed = authUser.projectIds.map(p => p.toUpperCase());
      if (!allowed.includes(project.toUpperCase())) {
        project = authUser.projectIds[0]; // default to first allowed
      }
    }

    // Fetch epics
    const epicsBody = JSON.stringify({
      jql: `project=${project} AND issuetype=Epic AND status != Deferred ORDER BY created ASC`,
      maxResults: 100,
      fields: ['summary', 'status', 'duedate', 'description', 'startdate', 'created', 'priority', 'customfield_10019']
    });

    const epicsData = await new Promise((resolve, reject) => {
      const auth = Buffer.from(`skippy@jpv.dev:${token}`).toString('base64');
      const options = {
        hostname: 'bldglabs.atlassian.net',
        path: '/rest/api/3/search/jql',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(epicsBody)
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(epicsBody);
      req.end();
    });

    // Fetch story metrics
    const storiesData = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        jql: `project=${project} AND issuetype=Story`,
        maxResults: 0,
        fields: ['status']
      });
      const auth = Buffer.from(`skippy@jpv.dev:${token}`).toString('base64');
      const options = {
        hostname: 'bldglabs.atlassian.net',
        path: '/rest/api/3/search/jql',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    // Fetch bug metrics
    const bugsData = await new Promise((resolve, reject) => {
      const body = JSON.stringify({
        jql: `project=${project} AND issuetype=Bug AND status != Done`,
        maxResults: 0,
        fields: ['status']
      });
      const auth = Buffer.from(`skippy@jpv.dev:${token}`).toString('base64');
      const options = {
        hostname: 'bldglabs.atlassian.net',
        path: '/rest/api/3/search/jql',
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    function extractText(node) {
      if (!node) return '';
      if (node.type === 'text') return node.text || '';
      return (node.content || []).map(extractText).join('');
    }

    const epics = (epicsData.issues || []).map(i => ({
      key: i.key,
      summary: i.fields.summary,
      status: i.fields.status.name,
      startDate: i.fields.startdate || (i.fields.created ? i.fields.created.split('T')[0] : null),
      dueDate: i.fields.duedate || null,
      description: extractText(i.fields.description).slice(0, 300) || null,
      jiraRank: i.fields.customfield_10019 || '',
      priority: i.fields.priority?.name || 'Medium',
      priorityId: i.fields.priority?.id || '3',
    }));

    // Sort by Jira board rank (lexicographic — the native board order)
    epics.sort((a, b) => a.jiraRank.localeCompare(b.jiraRank));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        epics,
        metrics: {
          totalStories: storiesData.total || 0,
          openBugs: bugsData.total || 0
        }
      })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  } finally {
    if (db) await db.end().catch(() => {});
  }
};
