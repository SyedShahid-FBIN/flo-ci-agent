[README.md](https://github.com/user-attachments/files/25693446/README.md)
# FLO Competitive Intelligence Agent
### 100% Free · GitHub Actions · Supabase · GitHub Pages

Autonomous competitive intelligence agent for FLO Technologies. Researches 13 competitors across B2B and B2C smart water management every Monday, generates executive reports, and serves them via a shareable dashboard — all for free, forever.

---

## Cost Breakdown

| Service | What it does | Cost |
|---|---|---|
| GitHub (free account) | Hosts code + runs the cron via Actions | **Free** |
| GitHub Pages | Hosts the dashboard UI | **Free** (public repo only on free plan) |
| Supabase (free tier) | Stores reports (500MB, plenty) | **Free** |
| Anthropic API | AI research (~13 competitors/week) | **~$0.20/week** |

---

## Setup (15 minutes total)

### Step 1 — Create a GitHub account
Go to https://github.com/signup and create a free account.

### Step 2 — Create the repository
1. Go to https://github.com/new
2. Name it: `flo-ci-agent`
3. Set to **Public** (required for GitHub Pages on a free GitHub account)
   - ⚠️ **GitHub Pages for private repositories requires a paid GitHub plan** (GitHub Pro, Team, or Enterprise Cloud). If you are on a free account, you must use a public repository for the dashboard to be hosted. If you need the repo private, upgrade your plan or use an alternative hosting method.
4. Click **Create repository**

### Step 3 — Upload the code
Option A (easiest — GitHub web UI):
1. Unzip this package
2. Go to your new repo on GitHub
3. Click **Add file → Upload files**
4. Drag all files/folders in and click **Commit changes**

Option B (git CLI):
```bash
cd flo-ci-github
git init
git remote add origin https://github.com/YOUR_USERNAME/flo-ci-agent.git
git add .
git commit -m "Initial deploy: FLO CI Agent"
git push -u origin main
```

### Step 4 — Enable GitHub Pages
1. Go to your repo → **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main`, Folder: `/docs`
4. Click Save
5. Your dashboard will be live at: `https://YOUR_USERNAME.github.io/flo-ci-agent`

> **⚠️ Note:** GitHub Pages is available for free on **public** repositories. For **private** repositories, GitHub Pages requires a paid GitHub plan (GitHub Pro, Team, or Enterprise Cloud). If you are on a free GitHub account, ensure the repository is set to **Public** in Step 2.

### Step 5 — Create a Supabase project
1. Go to https://supabase.com and sign up (free)
2. Click **New project**, give it a name, set a password, pick a region
3. Wait ~2 minutes for it to provision
4. Go to **SQL Editor → New Query**
5. Paste the contents of `supabase-setup.sql` and click **Run**
6. Go to **Project Settings → API** and copy:
   - `Project URL` (looks like: `https://xxxx.supabase.co`)
   - `anon public` key (long string starting with `eyJ...`)

### Step 6 — Add GitHub Secrets
1. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
2. Click **New repository secret** for each:

| Secret name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | From https://console.anthropic.com |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_KEY` | Your Supabase `anon public` key |

### Step 7 — Update the dashboard repo link
1. Open `docs/index.html`
2. Find line: `const GITHUB_REPO = "YOUR_USERNAME/flo-ci-agent";`
3. Replace `YOUR_USERNAME` with your actual GitHub username
4. Commit and push

### Step 8 — Run it!
1. Go to your repo → **Actions → FLO Competitive Intelligence Agent**
2. Click **Run workflow → Run workflow**
3. Watch it run (takes 5-10 minutes)
4. Visit your GitHub Pages URL to see the results

---

## How it works

```
Every Monday 9am UTC (or manual trigger)
         │
         ▼
GitHub Actions (free runner)
  └── For each of 13 competitors:
        └── Calls Anthropic API with web_search tool
        └── Agent searches web autonomously (up to 8 iterations)
        └── Returns structured JSON analysis
  └── Synthesizes executive report
  └── Saves everything to Supabase
  └── Writes data.json to docs/ and commits it
         │
         ▼
GitHub Pages serves docs/index.html + data.json
         │
         ▼
Your team visits: https://YOUR_USERNAME.github.io/flo-ci-agent
```

## Changing the Schedule
Edit `.github/workflows/research.yml`:
```yaml
- cron: "0 9 * * 1"      # Every Monday 9am UTC  (current)
- cron: "0 9 * * 1,4"    # Monday + Thursday
- cron: "0 14 * * 1"     # Monday 2pm UTC = 9am EST
- cron: "0 9 1 * *"      # First of every month
```

## Adding Competitors
Edit `scripts/competitors.js`, commit, and push. Done.

## Sharing the Dashboard
Share this URL with your team: `https://YOUR_USERNAME.github.io/flo-ci-agent`
No login required — it's a static page anyone with the link can view.
