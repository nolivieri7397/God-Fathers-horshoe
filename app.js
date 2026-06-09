const els = {
  entryScreen: document.querySelector("#entryScreen"),
  setupScreen: document.querySelector("#setupScreen"),
  bracketScreen: document.querySelector("#bracketScreen"),
  playersInput: document.querySelector("#playersInput"),
  playerCount: document.querySelector("#playerCount"),
  teamCount: document.querySelector("#teamCount"),
  teamList: document.querySelector("#teamList"),
  toSetupBtn: document.querySelector("#toSetupBtn"),
  backToEntryBtn: document.querySelector("#backToEntryBtn"),
  backToSetupBtn: document.querySelector("#backToSetupBtn"),
  pairBtn: document.querySelector("#pairBtn"),
  clearBtn: document.querySelector("#clearBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  generateBtn: document.querySelector("#generateBtn"),
  printBtn: document.querySelector("#printBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  courtCount: document.querySelector("#courtCount"),
  poolCount: document.querySelector("#poolCount"),
  poolAdvancers: document.querySelector("#poolAdvancers"),
  poolOptions: document.querySelectorAll(".pool-option"),
  formatInputs: document.querySelectorAll("input[name='format']"),
  tournamentTitle: document.querySelector("#tournamentTitle"),
  statTeams: document.querySelector("#statTeams"),
  statMatches: document.querySelector("#statMatches"),
  statCourts: document.querySelector("#statCourts"),
  emptyState: document.querySelector("#emptyState"),
  bracketBoard: document.querySelector("#bracketBoard"),
  scheduleBoard: document.querySelector("#scheduleBoard"),
  standingsBoard: document.querySelector("#standingsBoard"),
  tabs: document.querySelectorAll(".tab"),
  views: document.querySelectorAll(".view"),
};

const samplePlayers = [
  "Tony Mancini",
  "Sal Russo",
  "Frankie Bell",
  "Vinny Cruz",
  "Joey Romano",
  "Nico Greco",
  "Paulie Stone",
  "Marco King",
  "Gino West",
  "Benny Lake",
  "Carlo Reyes",
  "Mikey Ford",
  "Dom Carter",
  "Angelo Pierce",
  "Sammy Brooks",
  "Rocco Lane",
];

let state = {
  players: [],
  teams: [],
  alternate: null,
  format: "single",
  courts: 2,
  matches: [],
  pools: [],
  bracketStarted: false,
};

function getPlayers() {
  return els.playersInput.value
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function currentFormat() {
  return document.querySelector("input[name='format']:checked").value;
}

function showScreen(screen) {
  els.entryScreen.classList.toggle("active", screen === "entry");
  els.setupScreen.classList.toggle("active", screen === "setup");
  els.bracketScreen.classList.toggle("active", screen === "bracket");
  document.body.classList.toggle("bracket-mode", screen === "bracket");
}

function updateFormatOptions() {
  const isPool = currentFormat() === "pool";
  els.poolOptions.forEach((option) => option.classList.toggle("hidden", !isPool));
}

function continueToSetup() {
  const players = getPlayers();
  if (players.length < 2) {
    window.alert("Add at least two players to build teams.");
    return;
  }
  createTeams();
  showScreen("setup");
}

function teamName(team) {
  return team ? team.name : "TBD";
}

function getTeam(id) {
  return state.teams.find((team) => team.id === id) || null;
}

function scoreValue(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function createTeams() {
  const players = getPlayers();
  const mixed = shuffle(players);
  const teams = [];

  for (let index = 0; index + 1 < mixed.length; index += 2) {
    const playersForTeam = [mixed[index], mixed[index + 1]];
    teams.push({
      id: `team-${teams.length + 1}`,
      name: `Team ${teams.length + 1}`,
      players: playersForTeam,
      losses: 0,
      pool: null,
    });
  }

  state = {
    ...state,
    players,
    teams,
    alternate: mixed.length % 2 ? mixed[mixed.length - 1] : null,
    matches: [],
    pools: [],
    bracketStarted: false,
  };

  renderAll();
}

function makeMatch({ round, label, a = null, b = null, type = "bracket", pool = null }) {
  return {
    id: `match-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    round,
    label,
    a,
    b,
    scoreA: "",
    scoreB: "",
    winner: null,
    loser: null,
    type,
    pool,
    court: ((state.matches.length % state.courts) + 1),
  };
}

function makePairMatches(teamIds, round, label, type = "bracket", pool = null) {
  const matches = [];
  const entrants = [...teamIds];
  if (entrants.length % 2) {
    entrants.push(null);
  }

  for (let index = 0; index < entrants.length; index += 2) {
    matches.push(makeMatch({
      round,
      label: `${label} ${matches.length + 1}`,
      a: entrants[index],
      b: entrants[index + 1],
      type,
      pool,
    }));
  }
  return matches;
}

function generateTournament() {
  if (state.teams.length < 2) {
    createTeams();
  }
  if (state.teams.length < 2) {
    window.alert("You need at least two players to generate a bracket.");
    return;
  }

  state.format = currentFormat();
  state.courts = Math.max(1, Number.parseInt(els.courtCount.value, 10) || 1);
  state.matches = [];
  state.pools = [];
  state.bracketStarted = false;
  state.teams = state.teams.map((team) => ({ ...team, losses: 0, pool: null }));

  const teamIds = state.teams.map((team) => team.id);

  if (state.format === "single") {
    state.matches = makePairMatches(teamIds, 1, "Round 1");
    advanceSingle();
  }

  if (state.format === "double") {
    state.matches = makePairMatches(teamIds, 1, "Round 1", "double");
  }

  if (state.format === "roundRobin") {
    state.matches = makeRoundRobinMatches(teamIds, null, "Round robin");
  }

  if (state.format === "pool") {
    buildPools();
  }

  renderAll();
  showScreen("bracket");
}

function makeRoundRobinMatches(teamIds, pool, label) {
  const matches = [];
  for (let outer = 0; outer < teamIds.length; outer += 1) {
    for (let inner = outer + 1; inner < teamIds.length; inner += 1) {
      matches.push(makeMatch({
        round: matches.length + 1,
        label: `${label} ${matches.length + 1}`,
        a: teamIds[outer],
        b: teamIds[inner],
        type: pool ? "pool" : "roundRobin",
        pool,
      }));
    }
  }
  return matches;
}

function buildPools() {
  const requestedPools = Number.parseInt(els.poolCount.value, 10) || 2;
  const poolTotal = Math.max(2, Math.min(requestedPools, state.teams.length));
  const pools = Array.from({ length: poolTotal }, (_, index) => ({
    id: `pool-${index + 1}`,
    name: `Pool ${String.fromCharCode(65 + index)}`,
    teams: [],
  }));

  shuffle(state.teams).forEach((team, index) => {
    const pool = pools[index % pools.length];
    pool.teams.push(team.id);
    team.pool = pool.id;
  });

  state.pools = pools;
  state.matches = pools.flatMap((pool) => makeRoundRobinMatches(pool.teams, pool.id, pool.name));
}

function completeMatch(match) {
  const scoreA = scoreValue(match.scoreA);
  const scoreB = scoreValue(match.scoreB);
  if (!match.a || !match.b || scoreA === null || scoreB === null || scoreA === scoreB) {
    match.winner = null;
    match.loser = null;
    return;
  }
  match.winner = scoreA > scoreB ? match.a : match.b;
  match.loser = scoreA > scoreB ? match.b : match.a;
}

function applyScore(matchId, side, value) {
  const match = state.matches.find((item) => item.id === matchId);
  if (!match) return;
  match[side === "a" ? "scoreA" : "scoreB"] = value;
  state.matches.forEach(completeMatch);

  if (state.format === "single") advanceSingle();
  if (state.format === "double") advanceDouble();
  if (state.format === "pool") {
    maybeStartPoolBracket();
    advancePoolBracket();
  }

  renderAll();
}

function roundComplete(round, type = null) {
  const matches = state.matches.filter((match) => match.round === round && (!type || match.type === type));
  return matches.length > 0 && matches.every((match) => match.winner || !match.b);
}

function advanceSingle() {
  let currentRound = 1;
  while (roundComplete(currentRound)) {
    const nextExists = state.matches.some((match) => match.round === currentRound + 1);
    const winners = state.matches
      .filter((match) => match.round === currentRound)
      .map((match) => match.winner || match.a)
      .filter(Boolean);

    if (winners.length <= 1 || nextExists) break;

    state.matches.push(...makePairMatches(winners, currentRound + 1, `Round ${currentRound + 1}`));
    currentRound += 1;
  }
}

function advanceDouble() {
  const active = new Set(state.teams.filter((team) => team.losses < 2).map((team) => team.id));
  state.teams.forEach((team) => {
    team.losses = state.matches.filter((match) => match.loser === team.id).length;
    if (team.losses >= 2) active.delete(team.id);
  });

  const maxRound = Math.max(...state.matches.map((match) => match.round), 1);
  if (!roundComplete(maxRound, "double")) return;

  const remaining = [...active];
  const nextRoundExists = state.matches.some((match) => match.round === maxRound + 1 && match.type === "double");
  if (remaining.length <= 1 || nextRoundExists) return;

  state.matches.push(...makePairMatches(shuffle(remaining), maxRound + 1, `Round ${maxRound + 1}`, "double"));
}

function maybeStartPoolBracket() {
  const poolMatches = state.matches.filter((match) => match.type === "pool");
  const allPoolDone = poolMatches.length > 0 && poolMatches.every((match) => match.winner);
  if (!allPoolDone || state.bracketStarted) return;

  const perPool = Math.max(1, Number.parseInt(els.poolAdvancers.value, 10) || 1);
  const advancers = state.pools.flatMap((pool) => standingsFor(pool.id).slice(0, perPool).map((row) => row.team.id));
  state.bracketStarted = true;
  state.matches.push(...makePairMatches(advancers, 100, "Bracket"));
}

function advancePoolBracket() {
  if (!state.bracketStarted) return;

  let currentRound = Math.min(...state.matches.filter((match) => match.type === "bracket").map((match) => match.round));
  if (!Number.isFinite(currentRound)) return;

  while (roundComplete(currentRound, "bracket")) {
    const nextExists = state.matches.some((match) => match.round === currentRound + 1 && match.type === "bracket");
    const winners = state.matches
      .filter((match) => match.round === currentRound && match.type === "bracket")
      .map((match) => match.winner || match.a)
      .filter(Boolean);

    if (winners.length <= 1 || nextExists) break;

    state.matches.push(...makePairMatches(winners, currentRound + 1, "Bracket"));
    currentRound += 1;
  }
}

function standingsFor(poolId = null) {
  const rows = state.teams
    .filter((team) => !poolId || team.pool === poolId)
    .map((team) => ({ team, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }));

  const byId = new Map(rows.map((row) => [row.team.id, row]));
  state.matches
    .filter((match) => match.winner && (!poolId || match.pool === poolId))
    .forEach((match) => {
      const a = byId.get(match.a);
      const b = byId.get(match.b);
      if (!a || !b) return;
      const scoreA = scoreValue(match.scoreA) || 0;
      const scoreB = scoreValue(match.scoreB) || 0;
      a.pointsFor += scoreA;
      a.pointsAgainst += scoreB;
      b.pointsFor += scoreB;
      b.pointsAgainst += scoreA;
      byId.get(match.winner).wins += 1;
      byId.get(match.loser).losses += 1;
    });

  return rows.sort((left, right) => {
    const winDiff = right.wins - left.wins;
    if (winDiff) return winDiff;
    return (right.pointsFor - right.pointsAgainst) - (left.pointsFor - left.pointsAgainst);
  });
}

function formatTitle() {
  const labels = {
    single: "Single Elimination Bracket",
    double: "Double Elimination Bracket",
    roundRobin: "Round Robin Schedule",
    pool: "Pool Play to Bracket",
  };
  return labels[state.format] || "Tournament";
}

function renderAll() {
  const players = getPlayers();
  els.playerCount.textContent = players.length;
  els.teamCount.textContent = state.teams.length;
  els.statTeams.textContent = state.teams.length;
  els.statMatches.textContent = state.matches.length;
  els.statCourts.textContent = state.courts;
  els.tournamentTitle.textContent = state.matches.length ? formatTitle() : "Build your bracket";
  els.emptyState.classList.toggle("hidden", state.matches.length > 0);
  renderTeams();
  renderBracket();
  renderSchedule();
  renderStandings();
}

function renderTeams() {
  els.teamList.innerHTML = "";
  state.teams.forEach((team) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${team.name}</strong><small>${team.players.join(" & ")}</small>`;
    els.teamList.append(li);
  });
  if (state.alternate) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>Alternate</strong><small>${state.alternate}</small>`;
    els.teamList.append(li);
  }
}

function renderBracket() {
  els.bracketBoard.innerHTML = "";
  if (!state.matches.length) return;

  if (state.format === "pool") {
    const poolWrap = document.createElement("div");
    poolWrap.className = "pool-grid";
    state.pools.forEach((pool) => poolWrap.append(renderStandingsTable(pool.name, standingsFor(pool.id))));
    els.bracketBoard.append(poolWrap);

    state.pools.forEach((pool) => {
      const column = document.createElement("div");
      column.className = "round-column";
      const title = document.createElement("h3");
      title.textContent = `${pool.name} Matches`;
      column.append(title);
      state.matches
        .filter((match) => match.type === "pool" && match.pool === pool.id)
        .forEach((match) => column.append(renderMatch(match)));
      els.bracketBoard.append(column);
    });
  }

  const bracketMatches = state.matches.filter((match) => match.type !== "pool" && match.type !== "roundRobin");
  const rounds = [...new Set(bracketMatches.map((match) => match.round))].sort((a, b) => a - b);
  rounds.forEach((round) => {
    const column = document.createElement("div");
    column.className = "round-column";
    const title = document.createElement("h3");
    title.textContent = round >= 100 ? "Final Bracket" : `Round ${round}`;
    column.append(title);
    bracketMatches.filter((match) => match.round === round).forEach((match) => column.append(renderMatch(match)));
    els.bracketBoard.append(column);
  });

  if (state.format === "roundRobin") {
    const column = document.createElement("div");
    column.className = "round-column";
    const title = document.createElement("h3");
    title.textContent = "Round Robin Matches";
    column.append(title);
    state.matches.filter((match) => match.type === "roundRobin").forEach((match) => column.append(renderMatch(match)));
    els.bracketBoard.append(column);
    els.bracketBoard.append(renderStandingsTable("Round Robin Standings", standingsFor()));
  }
}

function renderMatch(match) {
  const card = document.createElement("article");
  card.className = "match-card";
  const teamA = getTeam(match.a);
  const teamB = getTeam(match.b);
  card.innerHTML = `
    <div class="match-head">
      <span>${match.label}</span>
      <span>Court ${match.court}</span>
    </div>
  `;
  card.append(renderCompetitor(match, "a", teamA));
  card.append(renderCompetitor(match, "b", teamB));
  if (!teamB) {
    const bye = document.createElement("span");
    bye.className = "badge";
    bye.textContent = "Bye";
    card.append(bye);
  }
  return card;
}

function renderCompetitor(match, side, team) {
  const row = document.createElement("label");
  const isWinner = match.winner && match[side] === match.winner;
  row.className = `competitor ${isWinner ? "winner" : ""}`;
  row.innerHTML = `
    <span class="team-name">${teamName(team)}${team ? `<small>${team.players.join(" & ")}</small>` : ""}</span>
    <input class="score" aria-label="${teamName(team)} score" inputmode="numeric" value="${side === "a" ? match.scoreA : match.scoreB}" ${team ? "" : "disabled"} />
  `;
  row.querySelector("input").addEventListener("input", (event) => applyScore(match.id, side, event.target.value));
  return row;
}

function renderSchedule() {
  els.scheduleBoard.innerHTML = "";
  if (!state.matches.length) {
    els.scheduleBoard.innerHTML = `<div class="empty-state"><h2>No schedule yet.</h2><p>Generate the tournament to assign matches to courts.</p></div>`;
    return;
  }

  state.matches.forEach((match, index) => {
    const card = document.createElement("article");
    card.className = "schedule-card";
    card.innerHTML = `
      <span class="badge">Match ${index + 1}</span>
      <div>
        <strong>${teamName(getTeam(match.a))} vs ${teamName(getTeam(match.b))}</strong>
        <p>${match.label}${match.pool ? ` · ${state.pools.find((pool) => pool.id === match.pool)?.name || ""}` : ""}</p>
      </div>
      <span class="badge">Court ${match.court}</span>
    `;
    els.scheduleBoard.append(card);
  });
}

function renderStandings() {
  els.standingsBoard.innerHTML = "";
  if (!state.matches.length) {
    els.standingsBoard.innerHTML = `<div class="empty-state"><h2>No standings yet.</h2><p>Scores will fill this in automatically.</p></div>`;
    return;
  }
  if (state.format === "pool") {
    state.pools.forEach((pool) => els.standingsBoard.append(renderStandingsTable(pool.name, standingsFor(pool.id))));
  } else {
    els.standingsBoard.append(renderStandingsTable("Overall Standings", standingsFor()));
  }
}

function renderStandingsTable(title, rows) {
  const wrap = document.createElement("div");
  wrap.className = "standing-table";
  wrap.innerHTML = `
    <h3>${title}</h3>
    <table>
      <thead>
        <tr><th>Team</th><th>W</th><th>L</th><th>Diff</th></tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            <td><strong>${row.team.name}</strong><br><small>${row.team.players.join(" & ")}</small></td>
            <td>${row.wins}</td>
            <td>${row.losses}</td>
            <td>${row.pointsFor - row.pointsAgainst}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  return wrap;
}

function exportTournament() {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "horseshoe-tournament.json";
  link.click();
  URL.revokeObjectURL(url);
}

els.playersInput.addEventListener("input", renderAll);
els.toSetupBtn.addEventListener("click", continueToSetup);
els.backToEntryBtn.addEventListener("click", () => showScreen("entry"));
els.backToSetupBtn.addEventListener("click", () => showScreen("setup"));
els.pairBtn.addEventListener("click", createTeams);
els.generateBtn.addEventListener("click", generateTournament);
els.clearBtn.addEventListener("click", () => {
  els.playersInput.value = "";
  state = { ...state, players: [], teams: [], alternate: null, matches: [], pools: [] };
  renderAll();
});
els.sampleBtn.addEventListener("click", () => {
  els.playersInput.value = samplePlayers.join("\n");
  renderAll();
});
els.printBtn.addEventListener("click", () => window.print());
els.exportBtn.addEventListener("click", exportTournament);
els.formatInputs.forEach((input) => input.addEventListener("change", updateFormatOptions));
els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((item) => item.classList.toggle("active", item === tab));
    els.views.forEach((view) => view.classList.toggle("active", view.id === `${tab.dataset.view}View`));
  });
});

showScreen("entry");
updateFormatOptions();
renderAll();
