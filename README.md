# Executive Dashboard

Engineering velocity and epic tracking dashboard for executive visibility into development progress.

**Live:** https://main.d27fj5orvibcxj.amplifyapp.com/

## What It Does

Two tabs:

### Epics Tab
- Pulls epics from Jira (SM and OUT projects) via Lambda proxy
- Groups by **Readiness** field: Initial PRD Review → Engineering Scoping → Ready to Work → Done
- Metric cards (counts per readiness state, % done, total stories, open bugs)
- Gantt timeline with due-date bars and toggle filters
- Epic cards with descriptions, priority, Jira links, and story-point progress (completed of total)

### Velocity Tab
- AI-scored PR velocity from `skematic-ai/skematic-next`
- Weekly points chart with split trend lines (pre/post hire regression)
- Per-FTE normalized chart with team milestone markers
- Author breakdown bar chart
- Story grouping (PRs clustered into business initiatives)
- Contributor deep-dive charts
- Effective FTE chart
- Scoring methodology modal

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (static export) + Tailwind + Recharts |
| Hosting | AWS Amplify (`d27fj5orvibcxj`) |
| API | Lambda + API Gateway (`5j0ivfhs38.execute-api.us-west-2.amazonaws.com/prod`) |
| Database | PostgreSQL on RDS (`executive_dashboard` database on `hlx-knest-db`) |
| Auth | Bearer token, session-based via Lambda |
| CI/CD | GitHub Actions OIDC → Amplify deploy on push to `main` (~60s) |

## Project Structure

```
app/
  page.tsx              # Main page — epic/velocity tabs, readiness grouping
  layout.tsx            # Root layout
components/
  MetricCards.tsx       # Epic readiness count cards
  EpicList.tsx          # Epic card grid with readiness sections
  EpicTimeline.tsx      # Gantt timeline with toggle filters
  VelocityDashboard.tsx # Velocity tab container
  VelocityChart.tsx     # Weekly points + split trend lines
  VelocityFTEChart.tsx  # Per-FTE normalized chart + milestones
  VelocityEffectiveFTEChart.tsx  # Effective FTE output chart
  VelocityMetrics.tsx   # Velocity metric cards
  VelocityAuthorBreakdown.tsx    # Author bar chart
  VelocityContributorChart.tsx   # Contributor deep-dive
  VelocityStoryList.tsx # Story list per selected week
  ScoringMethodologyModal.tsx    # Methodology explainer
  ProjectSwitcher.tsx   # Multi-project selector
  AdminPanel.tsx        # Superadmin panel
  LoginPage.tsx         # Auth UI
  ThemeToggle.tsx       # Dark/light mode
  FeedbackButton.tsx    # Feedback UI
  FeedbackModal.tsx     # Feedback form
  FeedbackHistory.tsx   # Past feedback
  ChartInfoButton.tsx   # Chart info tooltips
  weekUtils.ts          # ISO week helpers
lib/
  auth.ts              # Token storage + authFetch wrapper
lambda/
  index.js             # API — Jira proxy, velocity endpoints, auth, admin
scripts/
  weekly-velocity-score.js  # PR scoring + DB ingestion (see scripts/README.md)
data/
  velocity/            # JSON output from scoring runs (per-week + historical)
projects.config.js     # Project definitions (Jira project keys, API URLs)
```

## API Endpoints (Lambda)

| Endpoint | Purpose |
|----------|---------|
| `/api/jira/epics` | Fetch epics from Jira with readiness field |
| `/api/jira/metrics` | Story/bug counts |
| `/api/velocity` | Weekly velocity data from DB |
| `/api/velocity/authors` | Author breakdowns |
| `/api/velocity/trends` | Chart trend data |
| `/api/auth/login` | Session login |
| `/api/auth/me` | Current user |
| `/api/admin/*` | User management (superadmin) |

## Velocity Scoring

PRs from `skematic-ai/skematic-next` are scored by Claude Sonnet on Bedrock using a modified Fibonacci scale (1, 2, 3, 5, 8, 13, 21 points).

**Automated:** Daily cron at 12:00 UTC (5am Pacific) with 3-day lookback.

**Manual:**
```bash
# Score last 7 days
node scripts/weekly-velocity-score.js

# Specific week
node scripts/weekly-velocity-score.js --week 2026-W26

# Date range, DB-only (no JSON files)
node scripts/weekly-velocity-score.js --db-only --since 2026-08-01 --until 2026-08-12

# Full backfill
node scripts/weekly-velocity-score.js --all

# Dry run (no AI calls)
node scripts/weekly-velocity-score.js --dry-run
```

See `scripts/README.md` for full details.

## Epic Readiness Categories

Epics are grouped by their Jira **Readiness** custom field (`customfield_10235`):

| Readiness Value | Dashboard Group | Meaning |
|-----------------|-----------------|---------|
| Initial PRD Review | PRD Review | Submitted for review, not yet being worked on |
| Engineering Scoping | Scoping | Actively being scoped, could start soon |
| Ready to Work | Ready | Ready to be picked up |
| Done | Done | Completed |
| _(anything else)_ | Backlog | Catch-all |

## Development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # Static export to ./out
```

`next dev` proxies `/api/*` to API Gateway so the browser stays same-origin. Production builds still call the API directly (static export to Amplify). Restart the dev server after changing `next.config.ts`.

## Environment

The scoring script needs:
- `SKIPPY_GITHUB_TOKEN` or `GITHUB_TOKEN` — GitHub PAT with repo read access
- AWS instance role with Bedrock access (us-west-2)
- PostgreSQL connection to `executive_dashboard` DB

Lambda needs:
- Jira API token in SSM (`/executive-dashboard/jira-api-token`)
- PostgreSQL connection string in Lambda env vars
- CORS origins: Amplify URL + localhost:3000 (API Gateway currently omits localhost, so local dev uses the Next.js proxy instead)

## Team Roster (FTE)

| Person | FTE | Since |
|--------|-----|-------|
| Jason | 1.0 | W32 (Aug 2025) |
| Chris | 0.8 (32h/week) | W32 (Aug 2025) |
| Mauro | 1.0 | W24 (Jun 2026) |
| Chad | 1.0 | W24 (Jun 2026) |
