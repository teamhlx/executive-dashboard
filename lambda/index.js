const https = require('https');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ region: 'us-west-2' });

async function getJiraToken() {
  const cmd = new GetParameterCommand({
    Name: '/executive-dashboard/jira-api-token',
    WithDecryption: true
  });
  const res = await ssm.send(cmd);
  return res.Parameter.Value;
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

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const token = await getJiraToken();
    const project = event.queryStringParameters?.project || 'SM';

    // Fetch epics
    const epicsBody = JSON.stringify({
      jql: `project=${project} AND issuetype=Epic AND status != Deferred ORDER BY created ASC`,
      maxResults: 100,
      fields: ['summary', 'status', 'duedate', 'description', 'startdate']
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
      startDate: i.fields.startdate || null,
      dueDate: i.fields.duedate || null,
      description: extractText(i.fields.description).slice(0, 300) || null
    }));

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
  }
};
