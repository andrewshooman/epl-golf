const TEAM_ALIASES = {
  "manchester city": "Man City",
  "manchester united": "Man U",
  "manchester united fc": "Man U",
  "man united": "Man U",
  "man utd": "Man U",
  "man. united": "Man U",
  "newcastle united": "Newcastle",
  "tottenham hotspur": "Tottenham",
  "nottingham forest": "Forest",
  "nottingham": "Forest",
  "nott'm forest": "Forest",
  "nottm forest": "Forest",
  "wolverhampton wanderers": "Wolves",
  "wolverhampton": "Wolves",
  "wolverhampton wanderers fc": "Wolves",
  "afc bournemouth": "Bournemouth",
  "brighton and hove albion": "Brighton",
  "brighton and hove albion fc": "Brighton",
  "brighton & hove albion": "Brighton",
  "brighton & hove albion fc": "Brighton",
  "brighton and hove": "Brighton",
  "brighton & hove": "Brighton",
  "west ham united": "West Ham",
  "leeds united": "Leeds",
  "crystal palace": "Crystal Palace",
  "aston villa": "Aston Villa"
};
const DEFAULT_LOGO = "https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg";
/** Same-origin proxy (see serve.py) — avoids CORS: api allows http://localhost but not :5500 */
const FOOTBALL_DATA_PROXY = {
  "/competitions/PL/standings": "/api/pl/standings",
  "/competitions/PL/teams": "/api/pl/teams"
};

const refreshBtn = document.getElementById("refreshBtn");
const premTableBody = document.querySelector("#premTable tbody");
const leaderboardBody = document.querySelector("#leaderboardTable tbody");
const playerDetailBody = document.querySelector("#playerDetailTable tbody");
const playerDetailTitle = document.getElementById("playerDetailTitle");
const playerSummary = document.getElementById("playerSummary");
const onlyDiffToggle = document.getElementById("onlyDiffToggle");
const playerModal = document.getElementById("playerModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const sourceLabel = document.getElementById("sourceLabel");
const updatedLabel = document.getElementById("updatedLabel");

let predictions = [];
let standings = [];
let selectedPlayer = null;
let logoByTeam = {};

function normalizeTeamName(name) {
  const clean = String(name || "")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!clean) return "";
  return TEAM_ALIASES[clean.toLowerCase()] || clean;
}

function logoUrlForTeam(team) {
  const normalized = normalizeTeamName(team);
  return logoByTeam[normalized] || DEFAULT_LOGO;
}

function registerCrestForTeamLabels(teamObj) {
  if (!teamObj) return;
  const crest = teamObj.crest || "";
  if (!crest) return;
  for (const raw of [teamObj.shortName, teamObj.name, teamObj.tla].filter(Boolean)) {
    const k = normalizeTeamName(raw);
    if (k) logoByTeam[k] = crest;
  }
}

function createTeamLogoImg(teamName) {
  const img = document.createElement("img");
  img.className = "team-logo";
  img.alt = "";
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.src = logoUrlForTeam(teamName);
  img.addEventListener("error", () => {
    img.src = DEFAULT_LOGO;
  }, { once: true });
  return img;
}

async function footballDataFetch(path) {
  const proxyUrl = FOOTBALL_DATA_PROXY[path];
  if (!proxyUrl) throw new Error(`Unknown API path: ${path}`);
  const res = await fetch(proxyUrl, { cache: "no-store" });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error ? String(j.error) : "";
    } catch {
      detail = await res.text().catch(() => "");
    }
    throw new Error(detail || `API proxy HTTP ${res.status}`);
  }
  return res.json();
}

/** Crests for every PL club (shortName, name, tla) — same API as standings. */
async function hydrateLogosFromTeamsEndpoint() {
  const data = await footballDataFetch("/competitions/PL/teams");
  const list = data?.teams || [];
  for (const t of list) {
    registerCrestForTeamLabels(t);
  }
}

function bonusForRule(rule, actualPos) {
  if (rule === "top5" && actualPos < 6) return -1;
  if (rule === "sixth" && actualPos === 6) return -1;
  if (rule === "seventh" && actualPos === 7) return -1;
  if (rule === "bottom3" && actualPos > 17) return -1;
  return 0;
}

function scoreForPick(distance, actualPos, bonusRule = "none") {
  const base = distance === 0 ? -2 : distance;
  return base + bonusForRule(bonusRule, actualPos);
}

function buildLeaderboard(predRows, currentStandings) {
  const actualPosByTeam = new Map(currentStandings.map((x) => [normalizeTeamName(x.team), Number(x.position)]));
  const perPlayer = new Map();

  for (const row of predRows) {
    const player = row.player;
    const team = normalizeTeamName(row.team);
    const predictedPos = Number(row.predictedPosition);
    const actualPos = actualPosByTeam.get(team);
    if (!perPlayer.has(player)) perPlayer.set(player, { player, totalScore: 0, perfectPicks: 0, oneAway: 0 });
    if (!Number.isFinite(actualPos) || actualPos < 1 || Number.isNaN(predictedPos)) continue;

    const distance = Math.abs(predictedPos - actualPos);
    const score = scoreForPick(distance, actualPos, row.bonusRule);
    const stats = perPlayer.get(player);
    stats.totalScore += score;
    if (distance === 0) stats.perfectPicks += 1;
    if (distance === 1) stats.oneAway += 1;
  }

  return [...perPlayer.values()]
    .sort((a, b) => a.totalScore - b.totalScore || b.perfectPicks - a.perfectPicks || a.player.localeCompare(b.player))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

function renderLeaderboard(rows) {
  leaderboardBody.innerHTML = "";
  const n = rows.length;
  for (const row of rows) {
    const tr = document.createElement("tr");
    if (row.rank <= 3) tr.classList.add("table-row-promo");
    if (n >= 3 && row.rank > n - 3) tr.classList.add("table-row-releg");
    tr.classList.add("clickable-row");
    if (row.player === selectedPlayer) tr.classList.add("selected");
    tr.innerHTML = `
      <td><span class="rank-badge">${row.rank}</span></td>
      <td>${row.player}</td>
      <td>${row.totalScore}</td>
      <td>${row.perfectPicks}</td>
      <td>${row.oneAway}</td>
    `;
    tr.addEventListener("click", () => {
      selectedPlayer = row.player;
      renderPlayerDetail(selectedPlayer);
      if (typeof playerModal.showModal === "function") playerModal.showModal();
    });
    leaderboardBody.appendChild(tr);
  }
}

function renderPlayerDetail(player) {
  if (!player) {
    playerDetailTitle.textContent = "Player Picks Detail";
    playerSummary.textContent = "Click a player in the leaderboard to inspect picks.";
    playerDetailBody.innerHTML = `<tr><td colspan="5">Click a player in the leaderboard to inspect picks.</td></tr>`;
    return;
  }
  playerDetailTitle.textContent = `${player} - Picks vs Standings`;

  const actualPosByTeam = new Map(standings.map((x) => [normalizeTeamName(x.team), Number(x.position)]));
  let rows = predictions
    .filter((x) => x.player === player)
    .map((x) => {
      const team = normalizeTeamName(x.team);
      const predicted = Number(x.predictedPosition);
      const rawLive = actualPosByTeam.get(team);
      const live = Number(rawLive);
      const distance = Number.isFinite(live) ? Math.abs(predicted - live) : null;
      const score = distance === null ? null : scoreForPick(distance, live, x.bonusRule);
      return { team, predicted, live: Number.isFinite(live) ? live : null, distance, score };
    })
    .sort((a, b) => a.predicted - b.predicted);

  if (onlyDiffToggle.checked) rows = rows.filter((x) => (x.distance ?? 0) > 0);

  const total = rows.reduce((sum, x) => sum + (Number.isFinite(x.score) ? x.score : 0), 0);
  const perfect = rows.filter((x) => x.distance === 0).length;
  const misses = rows.filter((x) => (x.distance ?? 0) > 0).length;
  playerSummary.textContent = `Showing ${rows.length} picks | subtotal ${total} | perfect ${perfect} | mismatches ${misses}`;

  playerDetailBody.innerHTML = "";
  if (rows.length === 0) {
    playerDetailBody.innerHTML = `<tr><td colspan="5">No rows match this filter.</td></tr>`;
    return;
  }
  for (const row of rows) {
    const deltaClass =
      row.distance === null || !Number.isFinite(row.distance)
        ? "delta-warn"
        : row.distance === 0
          ? "delta-good"
          : row.distance <= 2
            ? "delta-warn"
            : "delta-bad";
    const tr = document.createElement("tr");
    const tdPick = document.createElement("td");
    tdPick.textContent = String(row.predicted);
    const tdTeam = document.createElement("td");
    tdTeam.className = "team-cell";
    const wrap = document.createElement("span");
    wrap.className = "team-logo-wrap";
    wrap.appendChild(createTeamLogoImg(row.team));
    tdTeam.appendChild(wrap);
    tdTeam.appendChild(document.createTextNode(row.team));
    const tdPred = document.createElement("td");
    const liveLabel = row.live === null || row.live === undefined || !Number.isFinite(row.live) ? "-" : String(row.live);
    tdPred.textContent = `${row.predicted} -> ${liveLabel}`;
    const tdDelta = document.createElement("td");
    const chip = document.createElement("span");
    chip.className = `delta-chip ${deltaClass}`;
    chip.textContent =
      row.distance === null || row.distance === undefined || !Number.isFinite(row.distance)
        ? "-"
        : String(row.distance);
    tdDelta.appendChild(chip);
    const tdScore = document.createElement("td");
    tdScore.textContent =
      row.score === null || row.score === undefined || !Number.isFinite(row.score) ? "-" : String(row.score);
    tr.append(tdPick, tdTeam, tdPred, tdDelta, tdScore);
    playerDetailBody.appendChild(tr);
  }
}

function renderStandingsEditor() {
  premTableBody.innerHTML = "";
  const total = standings.length;
  standings.forEach((row, index) => {
    const tr = document.createElement("tr");
    const pos = index + 1;
    if (pos <= 3) tr.classList.add("table-row-promo");
    if (total >= 3 && pos > total - 3) tr.classList.add("table-row-releg");
    const safe = (v) => (v === undefined || v === null || v === "" ? "-" : String(v));
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td class="team-cell"></td>
      <td>${safe(row.played)}</td>
      <td>${safe(row.won)}</td>
      <td>${safe(row.draw)}</td>
      <td>${safe(row.lost)}</td>
      <td>${safe(row.gf)}</td>
      <td>${safe(row.ga)}</td>
      <td>${safe(row.gd)}</td>
      <td>${safe(row.points)}</td>
    `;
    const teamCell = tr.querySelector(".team-cell");
    const wrap = document.createElement("span");
    wrap.className = "team-logo-wrap team-logo-wrap--standings";
    wrap.appendChild(createTeamLogoImg(row.team));
    teamCell.appendChild(wrap);
    teamCell.appendChild(document.createTextNode(normalizeTeamName(row.team)));
    premTableBody.appendChild(tr);
  });
}

function recalcAndRender() {
  const leaderboard = buildLeaderboard(predictions, standings);
  if (!selectedPlayer && leaderboard.length) selectedPlayer = leaderboard[0].player;
  renderLeaderboard(leaderboard);
  renderPlayerDetail(selectedPlayer);
  renderStandingsEditor();
  updatedLabel.textContent = `Last Updated: ${new Date().toLocaleString()}`;
}

async function loadPredictions() {
  const res = await fetch("./data/predictions.json");
  if (!res.ok) throw new Error("Could not load predictions data.");
  predictions = await res.json();
}

async function pullFromFootballDataOrg() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";
  try {
    const [data] = await Promise.all([
      footballDataFetch("/competitions/PL/standings"),
      hydrateLogosFromTeamsEndpoint().catch(() => null)
    ]);

    const table = data?.standings?.find((s) => s.type === "TOTAL")?.table || [];
    if (!Array.isArray(table) || table.length < 20) throw new Error("football-data.org returned incomplete table.");

    standings = table.slice(0, 20).map((x, i) => {
      const normalized = normalizeTeamName(x.team?.shortName || x.team?.name);
      registerCrestForTeamLabels(x.team);
      return {
        team: normalized,
        position: i + 1,
        played: x.playedGames,
        won: x.won,
        draw: x.draw,
        lost: x.lost,
        gf: x.goalsFor,
        ga: x.goalsAgainst,
        gd: x.goalDifference,
        points: x.points
      };
    });

    sourceLabel.textContent = "Standings Source: football-data.org (standings + crests)";
    recalcAndRender();
  } catch (err) {
    sourceLabel.textContent = `Standings Source: football-data.org failed (${err.message || err})`;
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh Standings";
  }
}

async function loadInitialStandings() {
  const latestRes = await fetch("./data/latest-standings.json");
  if (latestRes.ok) {
    standings = await latestRes.json();
    sourceLabel.textContent = "Standings Source: Provided latest snapshot";
    return;
  }

  const fallbackRes = await fetch("./data/fallback-standings.json");
  if (!fallbackRes.ok) throw new Error("Could not load standings snapshot.");
  standings = await fallbackRes.json();
  sourceLabel.textContent = "Standings Source: Workbook fallback snapshot";
}
refreshBtn.addEventListener("click", pullFromFootballDataOrg);
onlyDiffToggle.addEventListener("change", () => renderPlayerDetail(selectedPlayer));
closeModalBtn.addEventListener("click", () => playerModal.close());

async function init() {
  try {
    await loadPredictions();
    await loadInitialStandings();
    standings = standings.map((x, i) => ({
      team: normalizeTeamName(x.team),
      position: i + 1,
      played: x.played ?? null,
      won: x.won ?? null,
      draw: x.draw ?? null,
      lost: x.lost ?? null,
      gf: x.gf ?? null,
      ga: x.ga ?? null,
      gd: x.gd ?? null,
      points: x.points ?? null
    }));
    await hydrateLogosFromTeamsEndpoint().catch(() => null);
    recalcAndRender();
  } catch (err) {
    sourceLabel.textContent = "Standings Source: Could not initialize app";
    updatedLabel.textContent = String(err.message || err);
  }
}

init();
