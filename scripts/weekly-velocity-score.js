#!/usr/bin/env node
/**
 * weekly-velocity-score.js
 * Skematic Executive Dashboard — Weekly PR Velocity Scoring
 *
 * Usage:
 *   node scripts/weekly-velocity-score.js                      # last 7 days
 *   node scripts/weekly-velocity-score.js --since 2026-06-22 --until 2026-06-28
 *   node scripts/weekly-velocity-score.js --all                # backfill all history
 *   node scripts/weekly-velocity-score.js --dry-run            # fetch PRs, no AI calls
 *   node scripts/weekly-velocity-score.js --week 2026-W26      # specific ISO week
 *   node scripts/weekly-velocity-score.js --no-db              # skip DB writes (JSON only)
 *   node scripts/weekly-velocity-score.js --db-only            # skip JSON output (DB only)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const REPO = 'skematic-ai/skematic-next';
const BEDROCK_REGION = 'us-west-2';
const BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-6';
const GITHUB_API_BASE = 'https://api.github.com';

// FTE calibration
const PTS_PER_MONTH_PER_FTE = 18.75;
const WEEKS_PER_MONTH = 4.33;
const PTS_PER_WEEK_PER_FTE = PTS_PER_MONTH_PER_FTE / WEEKS_PER_MONTH; // ~4.33

// Team composition (adjust as needed)
const TEAM_META = {
  teamSize: 1.8,
  codingAllocation: 0.8,
};

// GitHub username → display name mapping
const AUTHOR_MAP = {
  'jasongphillips': 'Jason',
  'jpv-codes': 'Jason',
  'jason_bldg': 'Jason',
  'cheike569': 'Chris',
  'chris-bldg': 'Chris',
  'mauriziokraus': 'Mauro',
  'mauro': 'Mauro',
  'chadgrant': 'Chad',
  'chad': 'Chad',
  'skippymagnificent': 'Jason',
  'dependabot[bot]': 'dependabot',
  'dependabot': 'dependabot',
  'copilot': 'Copilot',
  'github-actions[bot]': 'bot',
  'web-flow': 'web-flow',
};

// PRs to skip entirely (release merges, staging→main, etc.)
const SKIP_PATTERNS = [
  /^release:\s*staging\s*→\s*main/i,
  /^release:\s*staging\s*to\s*main/i,
  /^merge\s+(branch\s+)?['"]?staging['"]?\s*(into|→|to)\s*['"]?main/i,
  /^staging\s*→\s*main/i,
  /^staging\s*to\s*main/i,
];

// Detect "revert of revert" / re-apply PRs that reference an original PR
// Returns the original PR number if detected, null otherwise
function detectReapplySource(title, body) {
  // Patterns: "Re-apply ... (formerly #475)", "Revert of revert ... #475", "Re-land #475"
  const patterns = [
    /formerly\s*#(\d+)/i,
    /re-?apply(?:ing)?\s+.*#(\d+)/i,
    /re-?land(?:ing)?\s+.*#(\d+)/i,
    /revert\s+.*revert\s+.*#(\d+)/i,
  ];
  const text = `${title} ${body || ''}`;
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

// Vendored/auto-gen directory patterns (regex tested against file paths)
const VENDORED_PATTERNS = [
  /^aws-sdk-/,
  /\/vendor\//,
  /^vendor\//,
  /\/node_modules\//,
  /^node_modules\//,
  /\.generated\//,
  /\/\.generated\//,
  /\/prisma\/migrations\//,
  /^prisma\/migrations\//,
  /\/dist\//,
  /\/build\//,
  /^\.next\//,
  /\/\.next\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];

// Fibonacci scale
const FIBONACCI = [1, 2, 3, 5, 8, 13, 21];

// Data output paths
const DATA_DIR = path.join(__dirname, '..', 'data', 'velocity');

// ─────────────────────────────────────────────────────────────────────────────
// CLI Argument Parsing
// ─────────────────────────────────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    since: null,
    until: null,
    all: false,
    dryRun: false,
    week: null,
    verbose: false,
    noDB: false,
    dbOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--since': opts.since = args[++i]; break;
      case '--until': opts.until = args[++i]; break;
      case '--all': opts.all = true; break;
      case '--dry-run': opts.dryRun = true; break;
      case '--week': opts.week = args[++i]; break;
      case '--verbose': case '-v': opts.verbose = true; break;
      case '--no-db': opts.noDB = true; break;
      case '--db-only': opts.dbOnly = true; break;
    }
  }

  // Resolve dates from --week (ISO week format: 2026-W26)
  if (opts.week && !opts.since && !opts.until) {
    const { start, end } = isoWeekToDates(opts.week);
    opts.since = start;
    opts.until = end;
  }

  // Default: last 7 days
  if (!opts.since && !opts.all) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    opts.until = toDateStr(now);
    opts.since = toDateStr(weekAgo);
  }

  return opts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────────────────────
function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function getISOWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function isoWeekToDates(isoWeek) {
  // Format: YYYY-WXX
  const [yearStr, weekStr] = isoWeek.split('-W');
  const year = parseInt(yearStr);
  const week = parseInt(weekStr);

  // Jan 4th is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7; // Monday=0
  const startOfWeek1 = new Date(jan4.getTime() - dayOfWeek * 86400000);
  const start = new Date(startOfWeek1.getTime() + (week - 1) * 7 * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);

  return {
    start: toDateStr(start),
    end: toDateStr(end),
  };
}

// Group PRs by ISO week
function groupByWeek(prs) {
  const weeks = {};
  for (const pr of prs) {
    const week = getISOWeek(new Date(pr.mergedAt));
    if (!weeks[week]) weeks[week] = [];
    weeks[week].push(pr);
  }
  return weeks;
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Utilities
// ─────────────────────────────────────────────────────────────────────────────
function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'skematic-velocity-scorer/1.0',
        ...headers,
      },
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}\nBody: ${data.slice(0, 200)}`));
          }
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// GitHub API
// ─────────────────────────────────────────────────────────────────────────────
class GitHubClient {
  constructor(token) {
    this.token = token;
    this.headers = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    };
  }

  async fetchMergedPRs(repo, since, until) {
    const prs = [];
    let page = 1;

    const sinceDate = since ? new Date(since) : null;
    const untilDate = until ? new Date(until + 'T23:59:59Z') : null;

    console.log(`Fetching merged PRs for ${repo}${since ? ` since ${since}` : ''} ${until ? `until ${until}` : ''}...`);

    while (true) {
      const url = `${GITHUB_API_BASE}/repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`;
      const batch = await httpGet(url, this.headers);

      if (!Array.isArray(batch) || batch.length === 0) break;

      let hitOldPRs = false;
      for (const pr of batch) {
        if (!pr.merged_at) continue;

        const mergedAt = new Date(pr.merged_at);

        // If looking at a date range and this PR is before our window, we can stop
        if (sinceDate && mergedAt < sinceDate) {
          hitOldPRs = true;
          continue;
        }

        // Skip PRs merged after our until date
        if (untilDate && mergedAt > untilDate) continue;

        prs.push(pr);
      }

      // If we hit PRs older than our since date, stop paginating
      if (hitOldPRs && sinceDate) break;

      // If the oldest PR in this batch is before sinceDate, stop
      const oldest = batch[batch.length - 1];
      if (oldest && sinceDate) {
        const oldestUpdated = new Date(oldest.updated_at);
        if (oldestUpdated < sinceDate) break;
      }

      if (batch.length < 100) break;
      page++;
      await sleep(200); // Rate limit courtesy
    }

    console.log(`  Found ${prs.length} merged PRs`);
    return prs;
  }

  async fetchAllMergedPRs(repo) {
    return this.fetchMergedPRs(repo, null, null);
  }

  async fetchPRFiles(repo, prNumber) {
    const allFiles = [];
    let page = 1;
    while (true) {
      const url = `${GITHUB_API_BASE}/repos/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`;
      const files = await httpGet(url, this.headers);
      if (!Array.isArray(files) || files.length === 0) break;
      allFiles.push(...files);
      if (files.length < 100) break;
      page++;
      await sleep(100);
    }
    return allFiles;
  }

  async fetchPRCommits(repo, prNumber) {
    const allCommits = [];
    let page = 1;
    while (true) {
      const url = `${GITHUB_API_BASE}/repos/${repo}/pulls/${prNumber}/commits?per_page=100&page=${page}`;
      const commits = await httpGet(url, this.headers);
      if (!Array.isArray(commits) || commits.length === 0) break;
      allCommits.push(...commits);
      if (commits.length < 100) break;
      page++;
      await sleep(100);
    }
    return allCommits;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendored/Auto-gen Detection
// ─────────────────────────────────────────────────────────────────────────────
function classifyFiles(files) {
  let customAdditions = 0;
  let vendoredAdditions = 0;
  const customFiles = [];
  const vendoredFiles = [];

  for (const file of files) {
    const isVendored = VENDORED_PATTERNS.some(pat => pat.test(file.filename));
    if (isVendored) {
      vendoredAdditions += file.additions || 0;
      vendoredFiles.push(file.filename);
    } else {
      customAdditions += file.additions || 0;
      customFiles.push(file.filename);
    }
  }

  const totalAdditions = customAdditions + vendoredAdditions;
  const vendoredRatio = totalAdditions > 0 ? vendoredAdditions / totalAdditions : 0;
  const isVendored = vendoredRatio > 0.5;

  return {
    customAdditions,
    vendoredAdditions,
    vendoredRatio,
    isVendored,
    customFiles,
    vendoredFiles,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Author Mapping
// ─────────────────────────────────────────────────────────────────────────────
function mapAuthor(login) {
  const normalized = login.toLowerCase();
  // Direct match
  if (AUTHOR_MAP[normalized]) return AUTHOR_MAP[normalized];
  // Prefix matches
  if (normalized.startsWith('mauro')) return 'Mauro';
  if (normalized.startsWith('chad')) return 'Chad';
  if (normalized.startsWith('chris')) return 'Chris';
  if (normalized.startsWith('jason')) return 'Jason';
  if (normalized.startsWith('skippy')) return 'Jason';
  if (normalized.includes('dependabot')) return 'dependabot';
  return login; // Fallback: original login
}

// ─────────────────────────────────────────────────────────────────────────────
// Bedrock / Claude Integration
// ─────────────────────────────────────────────────────────────────────────────
async function loadBedrockClient() {
  // Use lambda's node_modules for AWS SDK
  const lambdaNodeModules = path.join(__dirname, '..', 'lambda', 'node_modules');
  const { BedrockRuntimeClient, InvokeModelCommand } = require(
    path.join(lambdaNodeModules, '@aws-sdk', 'client-bedrock-runtime')
  );
  return { BedrockRuntimeClient, InvokeModelCommand };
}

async function callClaude(client, InvokeModelCommand, prompt, maxTokens = 2048) {
  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    body,
    contentType: 'application/json',
    accept: 'application/json',
  });

  const response = await client.send(command);
  const result = JSON.parse(Buffer.from(response.body).toString('utf8'));
  return result.content[0].text;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Scoring: Individual PRs
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = ['Core Platform', 'Infrastructure', 'AI/Agents', 'UI/UX', 'DevOps', 'Data/Schema', 'Admin/Tools', 'Integrations', 'Analytics'];

async function scorePRsBatch(client, InvokeModelCommand, prs) {
  const prDescriptions = prs.map((pr, idx) => {
    const fileList = pr.customFiles.slice(0, 20).join('\n    ');
    const moreFiles = pr.customFiles.length > 20 ? `\n    ... and ${pr.customFiles.length - 20} more` : '';

    // Multi-author commit details
    let authorDetails = '';
    if (pr.isMultiAuthor) {
      authorDetails = `\n  [MULTI-AUTHOR PR — ${pr.totalCommits} commits across ${Object.keys(pr.commitsByAuthor).length} contributors]`;
      for (const [author, data] of Object.entries(pr.commitsByAuthor)) {
        const msgs = data.messages.slice(0, 5).map(m => `"${m.slice(0, 80)}"`).join(', ');
        authorDetails += `\n    ${author}: ${data.commits} commits, +${data.additions}/-${data.deletions} lines — ${msgs}`;
      }
    }

    return `
PR ${idx + 1}: #${pr.pr} — "${pr.title}"
  PR opened by: ${pr.author}
  Custom additions: ${pr.customAdditions} lines | Deletions: ${pr.deletions} | Files changed: ${pr.files}
  ${pr.isVendored ? `[VENDORED: ${Math.round(pr.vendoredRatio * 100)}% auto-gen, actual custom work: ${pr.customAdditions} lines]` : ''}${authorDetails}
  Changed files (custom):
    ${fileList}${moreFiles}`;
  }).join('\n');

  const hasMultiAuthor = prs.some(pr => pr.isMultiAuthor);

  const prompt = `You are a software engineering effort estimator for Skematic, an AI-powered business readiness platform.

Score each PR below on the Fibonacci scale: 1, 2, 3, 5, 8, 13, 21 points.
- 1 pt: trivial (typo, config tweak, single-line fix)
- 2 pts: small (minor feature, simple bug fix)
- 3 pts: small-medium (modest feature, modest refactor)
- 5 pts: medium (solid feature, meaningful refactor)
- 8 pts: medium-large (significant feature, major refactor)
- 13 pts: large (major feature, architectural change)
- 21 pts: epic (transformative, weeks of work)

Categories: ${CATEGORIES.join(', ')}

Use ONLY custom lines (not vendored/auto-gen) when estimating effort. If a PR is flagged as VENDORED, ignore the auto-gen lines entirely and score based only on the custom additions.

${hasMultiAuthor ? `ATTRIBUTION: For PRs marked [MULTI-AUTHOR PR], analyze the commits from each contributor and provide an effort attribution split as a decimal (must sum to 1.0). Consider:
- Architectural/core work vs. fixups/tests
- Novel logic vs. boilerplate/config
- Whether commits represent the "spine" of the feature or supporting contributions
- Quality of contribution matters more than raw line count
For single-author PRs, omit the attribution field.
` : ''}
PRs to score:
${prDescriptions}

Respond with a JSON array with one entry per PR (in the same order):
[
  {
    "prIndex": 1,
    "points": <fibonacci number>,
    "rationale": "<one sentence explaining the score>",
    "category": "<one of the valid categories>"${hasMultiAuthor ? `,
    "attribution": { "AuthorName": 0.6, "OtherAuthor": 0.4 }  // ONLY for multi-author PRs, omit for single-author` : ''}
  },
  ...
]

Respond with ONLY the JSON array, no other text.`;

  const response = await callClaude(client, InvokeModelCommand, prompt, 4096);

  // Extract JSON from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Claude returned unexpected format:\n${response.slice(0, 500)}`);
  }

  return JSON.parse(jsonMatch[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Scoring: Group PRs into Stories
// ─────────────────────────────────────────────────────────────────────────────
async function groupIntoStories(client, InvokeModelCommand, prs) {
  const prList = prs.map(pr =>
    `#${pr.pr} (${pr.points}pts, ${pr.category}): "${pr.title}" by ${pr.author}`
  ).join('\n');

  const prompt = `You are analyzing a week of merged PRs for Skematic, an AI-powered business readiness platform.

Cluster these PRs into logical "stories" or initiatives — groups of PRs that together accomplish a coherent business objective.

PRs:
${prList}

Rules:
- Each PR belongs to exactly one story
- Use Fibonacci for story points: 1, 2, 3, 5, 8, 13, 21 (but story points can exceed individual PR points when PRs combine into something bigger)
- Story points should be the combined weight of the PRs, but capped at 21 per story
- If a PR stands alone, it's its own story
- Give each story a clear business-facing name (not technical jargon)
- Ignore "dependabot" PRs entirely (skip them, don't include in stories)

Categories: Core Platform, Infrastructure, AI/Agents, UI/UX, DevOps, Data/Schema, Admin/Tools, Integrations, Analytics

Respond with a JSON array:
[
  {
    "id": 1,
    "name": "<business-facing story name>",
    "points": <fibonacci number>,
    "category": "<category>",
    "prs": [<pr numbers>],
    "rationale": "<one sentence describing what this story accomplished>"
  },
  ...
]

Respond with ONLY the JSON array, no other text.`;

  const response = await callClaude(client, InvokeModelCommand, prompt, 2048);

  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Claude returned unexpected format for stories:\n${response.slice(0, 500)}`);
  }

  return JSON.parse(jsonMatch[0]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation Helpers
// ─────────────────────────────────────────────────────────────────────────────
function sumByAuthor(prs) {
  const byAuthor = {};
  for (const pr of prs) {
    if (pr.author === 'dependabot') continue;
    const points = pr.points || 0;
    if (pr.attribution) {
      // Split points by attribution
      for (const [author, fraction] of Object.entries(pr.attribution)) {
        byAuthor[author] = Math.round(((byAuthor[author] || 0) + points * fraction) * 10) / 10;
      }
    } else {
      // Fallback: full credit to PR author
      byAuthor[pr.author] = (byAuthor[pr.author] || 0) + points;
    }
  }
  return byAuthor;
}

function sumByCategory(prs) {
  const byCategory = {};
  for (const pr of prs) {
    if (pr.author === 'dependabot') continue;
    const cat = pr.category || 'Unknown';
    byCategory[cat] = (byCategory[cat] || 0) + (pr.points || 0);
  }
  return byCategory;
}

function storyPointsByAuthor(stories, prs) {
  // Distribute story points proportionally by individual PR points
  const byAuthor = {};
  for (const story of stories) {
    const storyPrs = prs.filter(pr => story.prs.includes(pr.pr));
    const totalIndividualPts = storyPrs.reduce((sum, pr) => sum + (pr.points || 0), 0);

    for (const pr of storyPrs) {
      if (pr.author === 'dependabot') continue;
      const share = totalIndividualPts > 0 ? (pr.points || 0) / totalIndividualPts : 1 / storyPrs.length;
      byAuthor[pr.author] = (byAuthor[pr.author] || 0) + story.points * share;
    }
  }

  // Round to 1 decimal
  for (const author in byAuthor) {
    byAuthor[author] = Math.round(byAuthor[author] * 10) / 10;
  }
  return byAuthor;
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Integration
// ─────────────────────────────────────────────────────────────────────────────
const DB_CONFIG = {
  host: 'hlx-knest-db.cbe80i6qe6j9.us-west-2.rds.amazonaws.com',
  port: 5432,
  database: 'executive_dashboard',
  user: 'postgres',
  password: 'sVl9nHTj&%4Pl$5&',
  ssl: { rejectUnauthorized: false },
};

async function loadPgClient() {
  const lambdaNodeModules = path.join(__dirname, '..', 'lambda', 'node_modules');
  const { Client } = require(path.join(lambdaNodeModules, 'pg'));
  return Client;
}

async function writeWeekToDB(weekData, project = 'skematic') {
  const PgClient = await loadPgClient();
  const db = new PgClient(DB_CONFIG);
  await db.connect();

  try {
    await db.query('BEGIN');

    const prs = weekData.prLevel?.prs || [];
    const stories = weekData.grouped?.stories || [];
    const totalPRs = prs.length;
    const skippedPRs = 0; // Already filtered before this point

    // Upsert velocity_run
    const runRes = await db.query(
      `INSERT INTO velocity_runs
         (project, week, start_date, end_date, total_prs, scored_prs, skipped_prs,
          pr_level_points, grouped_points, fte_equiv_pr, fte_equiv_grouped,
          team_size, coding_allocation, generated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (project, week) DO UPDATE SET
         start_date = EXCLUDED.start_date,
         end_date = EXCLUDED.end_date,
         total_prs = EXCLUDED.total_prs,
         scored_prs = EXCLUDED.scored_prs,
         skipped_prs = EXCLUDED.skipped_prs,
         pr_level_points = EXCLUDED.pr_level_points,
         grouped_points = EXCLUDED.grouped_points,
         fte_equiv_pr = EXCLUDED.fte_equiv_pr,
         fte_equiv_grouped = EXCLUDED.fte_equiv_grouped,
         team_size = EXCLUDED.team_size,
         coding_allocation = EXCLUDED.coding_allocation,
         generated_at = EXCLUDED.generated_at
       RETURNING id`,
      [
        project,
        weekData.week,
        weekData.startDate,
        weekData.endDate,
        totalPRs,
        totalPRs,
        skippedPRs,
        weekData.prLevel?.totalPoints || 0,
        weekData.grouped?.totalPoints || 0,
        weekData.meta?.fteEquiv?.prLevel ?? null,
        weekData.meta?.fteEquiv?.grouped ?? null,
        weekData.meta?.teamSize ?? 1.8,
        weekData.meta?.codingAllocation ?? 0.8,
        weekData.generatedAt || new Date().toISOString(),
      ]
    );
    const runId = runRes.rows[0].id;

    // Delete existing PRs and stories for this run (full replace)
    await db.query('DELETE FROM velocity_prs WHERE run_id = $1', [runId]);
    await db.query('DELETE FROM velocity_stories WHERE run_id = $1', [runId]);

    // Insert PRs
    for (const pr of prs) {
      await db.query(
        `INSERT INTO velocity_prs
           (run_id, project, pr_number, title, author, merged_at, additions, custom_additions,
            deletions, files_changed, points, rationale, category, is_vendored, vendored_ratio,
            attribution, is_multi_author)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         ON CONFLICT (project, pr_number) DO UPDATE SET
           run_id = EXCLUDED.run_id,
           title = EXCLUDED.title,
           author = EXCLUDED.author,
           merged_at = EXCLUDED.merged_at,
           additions = EXCLUDED.additions,
           custom_additions = EXCLUDED.custom_additions,
           deletions = EXCLUDED.deletions,
           files_changed = EXCLUDED.files_changed,
           points = EXCLUDED.points,
           rationale = EXCLUDED.rationale,
           category = EXCLUDED.category,
           is_vendored = EXCLUDED.is_vendored,
           vendored_ratio = EXCLUDED.vendored_ratio,
           attribution = EXCLUDED.attribution,
           is_multi_author = EXCLUDED.is_multi_author`,
        [
          runId,
          project,
          pr.pr,
          pr.title,
          pr.author,
          pr.mergedAt,
          pr.additions || 0,
          pr.customAdditions || 0,
          pr.deletions || 0,
          pr.files || 0,
          pr.points || 0,
          pr.rationale || null,
          pr.category || null,
          pr.vendored || false,
          (pr.vendoredRatio || 0) / 100, // store as ratio 0–1
          pr.attribution ? JSON.stringify(pr.attribution) : null,
          pr.isMultiAuthor || false,
        ]
      );
    }

    // Insert stories
    for (const story of stories) {
      await db.query(
        `INSERT INTO velocity_stories
           (run_id, project, story_name, points, category, pr_numbers, week)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          runId,
          project,
          story.name,
          story.points || 0,
          story.category || null,
          story.prs || [],
          weekData.week,
        ]
      );
    }

    await db.query('COMMIT');
    console.log(`  ✅ DB: upserted run ${runId} for ${project}/${weekData.week} (${prs.length} PRs, ${stories.length} stories)`);
    return runId;
  } catch (err) {
    await db.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await db.end().catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Week File Management
// ─────────────────────────────────────────────────────────────────────────────
function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadHistorical() {
  const histPath = path.join(DATA_DIR, 'historical.json');
  if (fs.existsSync(histPath)) {
    return JSON.parse(fs.readFileSync(histPath, 'utf8'));
  }
  return { weeks: [] };
}

function saveWeekData(weekKey, weekData, opts = {}) {
  if (!opts.dbOnly) {
    ensureDataDir();

    // Save week file
    const weekFile = path.join(DATA_DIR, `${weekKey}.json`);
    fs.writeFileSync(weekFile, JSON.stringify(weekData, null, 2));
    console.log(`  Wrote: ${weekFile}`);

    // Update latest.json
    const latestFile = path.join(DATA_DIR, 'latest.json');
    fs.writeFileSync(latestFile, JSON.stringify(weekData, null, 2));
    console.log(`  Wrote: ${latestFile}`);

    // Update historical.json
    const historical = loadHistorical();
    const existingIdx = historical.weeks.findIndex(w => w.week === weekKey);
    if (existingIdx >= 0) {
      historical.weeks[existingIdx] = weekData;
    } else {
      historical.weeks.push(weekData);
    }
    // Sort by week descending
    historical.weeks.sort((a, b) => b.week.localeCompare(a.week));
    historical.updatedAt = new Date().toISOString();

    const histFile = path.join(DATA_DIR, 'historical.json');
    fs.writeFileSync(histFile, JSON.stringify(historical, null, 2));
    console.log(`  Wrote: ${histFile}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Process a Single Week
// ─────────────────────────────────────────────────────────────────────────────
async function processWeek(weekKey, prs, opts, bedrockClient, InvokeModelCommand) {
  const { start, end } = isoWeekToDates(weekKey);
  console.log(`\n📅 Processing week ${weekKey} (${start} → ${end}): ${prs.length} PRs`);

  // Skip dependabot PRs and release merge PRs from scoring
  const scorablePRs = prs.filter(pr => {
    if (pr.author === 'dependabot') return false;
    // Skip staging→main release merges (double-counting)
    if (SKIP_PATTERNS.some(pat => pat.test(pr.title))) return false;
    return true;
  });
  const depbotCount = prs.filter(pr => pr.author === 'dependabot').length;
  const releaseCount = prs.length - scorablePRs.length - depbotCount;
  if (depbotCount > 0) {
    console.log(`  Skipping ${depbotCount} dependabot PRs`);
  }
  if (releaseCount > 0) {
    console.log(`  Skipping ${releaseCount} release/merge PRs (staging→main)`);
  }

  if (opts.dryRun) {
    console.log('\n  [DRY RUN] Would score these PRs:');
    for (const pr of scorablePRs) {
      console.log(`    #${pr.pr} (${pr.customAdditions} custom lines, ${pr.isVendored ? 'VENDORED' : 'clean'}) — ${pr.title.slice(0, 60)}`);
    }
    return null;
  }

  // Batch PRs for scoring (max 15 per Claude call to stay within context)
  const BATCH_SIZE = 15;
  const scoredPRs = [];

  for (let i = 0; i < scorablePRs.length; i += BATCH_SIZE) {
    const batch = scorablePRs.slice(i, i + BATCH_SIZE);
    console.log(`  Scoring PRs ${i + 1}–${Math.min(i + BATCH_SIZE, scorablePRs.length)} of ${scorablePRs.length}...`);

    const scores = await scorePRsBatch(bedrockClient, InvokeModelCommand, batch);

    for (let j = 0; j < batch.length; j++) {
      const pr = batch[j];
      const score = scores[j] || { points: 3, rationale: 'Scoring unavailable', category: 'Core Platform' };

      // Determine attribution
      let attribution;
      if (pr.reapplySource) {
        // Re-apply/revert-of-revert: inherit attribution from original PR author
        // The original PR author did the work; this PR is just git plumbing
        const originalAuthor = pr.reapplyOriginalAuthor || pr.author;
        attribution = { [originalAuthor]: 1.0 };
        console.log(`    #${pr.pr} is re-apply of #${pr.reapplySource} → attributing to ${originalAuthor}`);
      } else if (pr.isMultiAuthor && score.attribution) {
        // AI-assigned attribution for multi-author PRs
        attribution = score.attribution;
      } else if (pr.isMultiAuthor && !score.attribution) {
        // Fallback: lines-based split for multi-author PRs if AI didn't provide
        const totalLines = Object.values(pr.commitsByAuthor).reduce((s, d) => s + d.additions, 0) || 1;
        attribution = {};
        for (const [author, data] of Object.entries(pr.commitsByAuthor)) {
          if (author !== 'dependabot' && author !== 'unknown') {
            attribution[author] = Math.round((data.additions / totalLines) * 100) / 100;
          }
        }
      } else {
        // Single author — 100%
        attribution = { [pr.author]: 1.0 };
      }

      scoredPRs.push({
        pr: pr.pr,
        title: pr.title,
        author: pr.author,
        mergedAt: pr.mergedAt,
        additions: pr.additions,
        customAdditions: pr.customAdditions,
        deletions: pr.deletions,
        files: pr.files,
        points: score.points,
        rationale: score.rationale,
        category: score.category,
        vendored: pr.isVendored,
        vendoredRatio: Math.round((pr.vendoredRatio || 0) * 100),
        isMultiAuthor: pr.isMultiAuthor,
        attribution,
      });
    }

    if (i + BATCH_SIZE < scorablePRs.length) {
      await sleep(1000); // Courtesy delay between batches
    }
  }

  // Group into stories
  let stories = [];
  if (scoredPRs.length > 0) {
    console.log(`  Grouping ${scoredPRs.length} PRs into stories...`);
    stories = await groupIntoStories(bedrockClient, InvokeModelCommand, scoredPRs);
  }

  // Calculate totals
  const totalPRPoints = scoredPRs.reduce((sum, pr) => sum + (pr.points || 0), 0);
  const totalStoryPoints = stories.reduce((sum, s) => sum + (s.points || 0), 0);

  const fteEquiv = {
    prLevel: Math.round((totalPRPoints / PTS_PER_WEEK_PER_FTE) * 100) / 100,
    grouped: Math.round((totalStoryPoints / PTS_PER_WEEK_PER_FTE) * 100) / 100,
  };

  const weekData = {
    week: weekKey,
    startDate: start,
    endDate: end,
    generatedAt: new Date().toISOString(),
    prLevel: {
      prs: scoredPRs,
      totalPoints: totalPRPoints,
      byAuthor: sumByAuthor(scoredPRs),
      byCategory: sumByCategory(scoredPRs),
    },
    grouped: {
      stories,
      totalPoints: totalStoryPoints,
      byAuthor: storyPointsByAuthor(stories, scoredPRs),
    },
    meta: {
      ...TEAM_META,
      fteEquiv,
      ptsPerWeekPerFTE: Math.round(PTS_PER_WEEK_PER_FTE * 100) / 100,
    },
  };

  // Print summary
  console.log(`\n  ✅ Week ${weekKey} Summary:`);
  console.log(`     PR-level points: ${totalPRPoints}`);
  console.log(`     Story points:    ${totalStoryPoints}`);
  console.log(`     FTE equiv (PR):  ${fteEquiv.prLevel}`);
  console.log(`     FTE equiv (stories): ${fteEquiv.grouped}`);
  if (stories.length > 0) {
    console.log(`     Stories (${stories.length}):`);
    for (const s of stories) {
      console.log(`       [${s.points}pts] ${s.name} (${s.category})`);
    }
  }

  saveWeekData(weekKey, weekData, opts);
  return weekData;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enrich PRs with File Details
// ─────────────────────────────────────────────────────────────────────────────
async function enrichPR(ghClient, rawPR) {
  const prAuthor = mapAuthor(rawPR.user.login);

  // Detect re-apply/revert-of-revert referencing original PR
  const reapplySource = detectReapplySource(rawPR.title, rawPR.body);
  let reapplyOriginalAuthor = null;
  if (reapplySource) {
    try {
      const origUrl = `${GITHUB_API_BASE}/repos/${REPO}/pulls/${reapplySource}`;
      const origPR = await httpGet(origUrl, ghClient.headers);
      reapplyOriginalAuthor = mapAuthor(origPR.user?.login || 'unknown');
      console.log(`    → Re-apply of #${reapplySource} (original author: ${reapplyOriginalAuthor})`);
    } catch (err) {
      console.warn(`  Warning: Could not fetch original PR #${reapplySource}: ${err.message}`);
    }
  }

  // Fetch files
  let files = [];
  try {
    files = await ghClient.fetchPRFiles(REPO, rawPR.number);
  } catch (err) {
    console.warn(`  Warning: Could not fetch files for PR #${rawPR.number}: ${err.message}`);
  }

  // Fetch commits for multi-author detection
  let commits = [];
  try {
    commits = await ghClient.fetchPRCommits(REPO, rawPR.number);
  } catch (err) {
    console.warn(`  Warning: Could not fetch commits for PR #${rawPR.number}: ${err.message}`);
  }

  // Analyze commit authors
  const commitsByAuthor = {};
  const IGNORE_AUTHORS = new Set(['dependabot', 'unknown', 'copilot', 'ubuntu', 'web-flow', 'bot']);
  for (const commit of commits) {
    // Skip merge commits (2+ parents = git merge, not real work)
    if (commit.parents && commit.parents.length >= 2) continue;
    // Skip merge-from-branch commits by message pattern
    const msg = commit.commit?.message || '';
    if (/^Merge (branch|remote-tracking|pull request)/i.test(msg)) continue;

    const login = commit.author?.login || commit.commit?.author?.name || 'unknown';
    const authorName = mapAuthor(login);
    if (IGNORE_AUTHORS.has(authorName.toLowerCase())) continue;
    if (!commitsByAuthor[authorName]) {
      commitsByAuthor[authorName] = { commits: 0, additions: 0, deletions: 0, messages: [] };
    }
    commitsByAuthor[authorName].commits++;
    commitsByAuthor[authorName].additions += (commit.stats?.additions || 0);
    commitsByAuthor[authorName].deletions += (commit.stats?.deletions || 0);
    commitsByAuthor[authorName].messages.push(msg.split('\n')[0] || '');
  }

  const authors = Object.keys(commitsByAuthor);
  const isMultiAuthor = authors.length > 1;

  const classification = classifyFiles(files);

  return {
    pr: rawPR.number,
    title: rawPR.title,
    author: prAuthor,
    authorLogin: rawPR.user.login,
    mergedAt: rawPR.merged_at,
    additions: rawPR.additions || 0,
    deletions: rawPR.deletions || 0,
    files: rawPR.changed_files || files.length,
    customAdditions: classification.customAdditions,
    vendoredAdditions: classification.vendoredAdditions,
    vendoredRatio: classification.vendoredRatio,
    isVendored: classification.isVendored,
    customFiles: classification.customFiles,
    vendoredFiles: classification.vendoredFiles,
    // Multi-author attribution data
    isMultiAuthor,
    commitsByAuthor,
    totalCommits: commits.length,
    // Re-apply detection
    reapplySource,
    reapplyOriginalAuthor,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();

  console.log('🚀 Skematic Weekly Velocity Scorer');
  if (opts.dryRun) console.log('   [DRY RUN MODE — no AI calls]');
  if (opts.all) console.log('   Mode: Full historical backfill');
  else console.log(`   Date range: ${opts.since} → ${opts.until}`);
  if (opts.noDB) console.log('   DB writes: DISABLED (--no-db)');
  else if (opts.dbOnly) console.log('   Output mode: DB ONLY (--db-only, skipping JSON files)');
  else console.log('   Output mode: JSON + DB');

  // Load GitHub token
  let githubToken = process.env.SKIPPY_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (!githubToken) {
    // Try loading from openclaw-env.sh
    try {
      const envContent = fs.readFileSync(path.join(process.env.HOME, '.openclaw', 'openclaw-env.sh'), 'utf8');
      const match = envContent.match(/export\s+SKIPPY_GITHUB_TOKEN=["']?([^"'\s]+)/);
      if (match) githubToken = match[1];
    } catch (e) {
      // Ignore
    }
  }

  if (!githubToken) {
    console.error('❌ No GitHub token found. Set SKIPPY_GITHUB_TOKEN or GITHUB_TOKEN env var.');
    process.exit(1);
  }

  const ghClient = new GitHubClient(githubToken);

  // Load Bedrock client (unless dry run)
  let bedrockClient = null;
  let InvokeModelCommand = null;
  if (!opts.dryRun) {
    try {
      const { BedrockRuntimeClient, InvokeModelCommand: IMC } = await loadBedrockClient();
      bedrockClient = new BedrockRuntimeClient({ region: BEDROCK_REGION });
      InvokeModelCommand = IMC;
      console.log('✅ Bedrock client loaded');
    } catch (err) {
      console.error(`❌ Failed to load Bedrock client: ${err.message}`);
      console.error('   Is @aws-sdk/client-bedrock-runtime installed in lambda/node_modules?');
      process.exit(1);
    }
  }

  // Fetch PRs
  let rawPRs;
  if (opts.all) {
    rawPRs = await ghClient.fetchAllMergedPRs(REPO);
  } else {
    rawPRs = await ghClient.fetchMergedPRs(REPO, opts.since, opts.until);
  }

  if (rawPRs.length === 0) {
    console.log('ℹ️  No merged PRs found in the specified date range.');
    return;
  }

  console.log(`\n📦 Enriching ${rawPRs.length} PRs with file details...`);
  const enrichedPRs = [];
  for (let i = 0; i < rawPRs.length; i++) {
    process.stdout.write(`  [${i + 1}/${rawPRs.length}] PR #${rawPRs[i].number}\r`);
    const enriched = await enrichPR(ghClient, rawPRs[i]);
    enrichedPRs.push(enriched);
    if (i < rawPRs.length - 1) await sleep(150); // Rate limit
  }
  console.log(`\n  Done enriching ${enrichedPRs.length} PRs`);

  if (opts.dryRun) {
    console.log('\n📊 DRY RUN — PR Summary:');
    console.log('-'.repeat(80));
    let skipCount = 0;
    let multiAuthorCount = 0;
    for (const pr of enrichedPRs) {
      const vendorTag = pr.isVendored ? ` [VENDORED ${Math.round(pr.vendoredRatio * 100)}%]` : '';
      const releaseTag = SKIP_PATTERNS.some(p => p.test(pr.title)) ? ' [RELEASE SKIP]' : '';
      const depTag = pr.author === 'dependabot' ? ' [DEPENDABOT SKIP]' : '';
      const multiTag = pr.isMultiAuthor ? ` [MULTI-AUTHOR: ${Object.keys(pr.commitsByAuthor).join(', ')}]` : '';
      const reapplyTag = pr.reapplySource ? ` [RE-APPLY #${pr.reapplySource} → ${pr.reapplyOriginalAuthor || '?'}]` : '';
      if (releaseTag || depTag) skipCount++;
      if (pr.isMultiAuthor) multiAuthorCount++;
      console.log(`  #${pr.pr} | ${pr.author.padEnd(8)} | +${String(pr.customAdditions).padStart(5)} custom${vendorTag}${releaseTag}${depTag}${multiTag}${reapplyTag}`);
      console.log(`        ${pr.title.slice(0, 70)}`);
    }
    console.log('-'.repeat(80));
    console.log(`\nTotal PRs: ${enrichedPRs.length} (${skipCount} will be skipped, ${enrichedPRs.length - skipCount} will be scored)`);
    if (multiAuthorCount > 0) {
      console.log(`Multi-author PRs: ${multiAuthorCount} (will get AI-weighted attribution)`);
    }
    console.log(`(Use without --dry-run to score with AI)`);
    return;
  }

  // Group by week and process each
  if (opts.all) {
    const byWeek = groupByWeek(enrichedPRs);
    const weekKeys = Object.keys(byWeek).sort();
    console.log(`\n📅 Processing ${weekKeys.length} weeks...`);
    for (const weekKey of weekKeys) {
      await processWeekWithDB(weekKey, byWeek[weekKey], opts, bedrockClient, InvokeModelCommand);
      await sleep(2000); // Courtesy between weeks
    }
  } else {
    // Single week (or partial)
    const weekKey = opts.week || getISOWeek(new Date(opts.until || new Date()));
    await processWeekWithDB(weekKey, enrichedPRs, opts, bedrockClient, InvokeModelCommand);
  }

  console.log('\n✅ Done!');
}

// ─────────────────────────────────────────────────────────────────────────────
// DB Write Hook — called after processWeek if !opts.noDB
// ─────────────────────────────────────────────────────────────────────────────
// Patch processWeek to call DB write after JSON save
const _origProcessWeek = processWeek;
async function processWeekWithDB(weekKey, prs, opts, bedrockClient, InvokeModelCommand) {
  const weekData = await _origProcessWeek(weekKey, prs, opts, bedrockClient, InvokeModelCommand);
  if (weekData && !opts.noDB && !opts.dryRun) {
    try {
      await writeWeekToDB(weekData);
    } catch (err) {
      console.error(`  ⚠️  DB write failed for ${weekKey}: ${err.message}`);
      // Don't fail the whole run — JSON was already written
    }
  }
  return weekData;
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
