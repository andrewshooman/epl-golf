# EPL Prediction Standings App

This app reads prediction data from your Excel export and calculates each player's score based on current EPL standings.

## Scoring (matches the app)

- **Lower total is better** (golf-style).
- **Per club:** spot-on predicted place → **−2**; otherwise the base is **how many places off** you were.
- **Some rows** (from the workbook export) also apply **−1** when the club really finishes in a zone: **1–5**, **exactly 6th**, **exactly 7th**, or **18th–20th**.
- Leaderboard **Perfect** / **1 Away** columns are stats only; totals use the rules above.

## Run Locally

Use the included server (required for **Refresh Standings**). football-data.org’s CORS allows `http://localhost` **without a port**, so calling their API from `http://localhost:5500` in the browser is blocked. This app uses a **same-origin proxy** (`/api/pl/*`) so refresh works on any port.

```powershell
cd "C:\Users\sushi\OneDrive\Desktop\epl-prediction-standings-app"
python serve.py
```

Then open:

[http://127.0.0.1:5500/](http://127.0.0.1:5500/)

Optional: `set PORT=8080` then `python serve.py` for another port.

Do **not** use `python -m http.server` for this project if you need live refresh — the proxy routes will not exist.

## football-data.org API Key (.env)

**This repo ignores `config.js`** (so keys are not pushed). For local dev, copy `config.example.js` to `config.js` and add your token, or use `.env` as below.

1. Create `.env` in this folder (or copy from `.env.example`).
2. Add:

```env
FOOTBALL_DATA_API_KEY=your_key_here
```

3. Sync it into the frontend config:

```powershell
python "C:\Users\sushi\OneDrive\Desktop\epl-prediction-standings-app\sync-env-to-config.py"
```

4. Run `python serve.py` and use **Refresh Standings** (the server reads `config.js` from disk; it is not exposed as a static file).

## Data Files

- `data/predictions.json`: extracted from `table_golf_25_26_official.xlsx` (`Predictions` sheet)
- `data/fallback-standings.json`: extracted from `Live Standings` sheet
- `data/latest-standings.json`: manual latest standings snapshot you provided

## Standings Source

- Default load: `data/latest-standings.json` (or fallback file)
- Live refresh: `football-data.org` when API key is configured

## Deploy to a live URL

The browser must talk to **this same server** for `/api/pl/*` (proxy + API key). Static-only hosts (e.g. GitHub Pages) will **not** run live refresh unless you add a separate backend.

### Render (recommended)

1. Push this folder to a GitHub repo.
2. In [Render](https://render.com), **New → Blueprint**, connect the repo, select `render.yaml`.
3. Add environment variable **`FOOTBALL_DATA_API_KEY`** (your football-data.org token). Do not commit it.
4. Deploy. Open the `https://…onrender.com` URL Render gives you.

Render sets **`PORT`** automatically; `serve.py` already reads it.

### Docker (any host)

```bash
docker build -t epl-standings .
docker run --rm -p 8080:8080 -e FOOTBALL_DATA_API_KEY=your_key -e PORT=8080 epl-standings
```

Then open `http://localhost:8080/`.
