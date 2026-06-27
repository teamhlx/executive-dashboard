# Weekly Velocity Scorer

Scores merged GitHub PRs for the Skematic executive dashboard using Claude AI via Bedrock.

## Usage

```bash
# Score the last 7 days (default)
node scripts/weekly-velocity-score.js

# Score a specific week
node scripts/weekly-velocity-score.js --week 2026-W26

# Score a custom date range
node scripts/weekly-velocity-score.js --since 2026-06-22 --until 2026-06-28

# Dry run (fetch PRs only, no AI scoring)
node scripts/weekly-velocity-score.js --dry-run

# Dry run for a specific week
node scripts/weekly-velocity-score.js --week 2026-W26 --dry-run

# Full historical backfill (all PRs ever merged)
node scripts/weekly-velocity-score.js --all
```

## Requirements

- `SKIPPY_GITHUB_TOKEN` or `GITHUB_TOKEN` env var set (or in `~/.openclaw/openclaw-env.sh`)
- AWS instance role with Bedrock access (us-west-2)
- `lambda/node_modules/@aws-sdk/client-bedrock-runtime` installed

## Output Files

| File | Contents |
|------|----------|
| `data/velocity/YYYY-WXX.json` | Individual week data |
| `data/velocity/latest.json` | Most recently scored week |
| `data/velocity/historical.json` | All weeks combined |

## Scoring

- **Fibonacci scale**: 1, 2, 3, 5, 8, 13, 21 points per PR
- **Vendored detection**: PRs with >50% auto-gen additions (node_modules, migrations, lock files, etc.) are flagged; only custom lines count toward scoring
- **Story grouping**: After individual scoring, Claude clusters PRs into business-facing stories
- **FTE equiv**: Based on 18.75 pts/month/FTE calibration (≈4.33 pts/week/FTE)

## Categories

- Core Platform
- Infrastructure  
- AI/Agents
- UI/UX
- DevOps
- Data/Schema
- Admin/Tools
- Integrations
- Analytics
