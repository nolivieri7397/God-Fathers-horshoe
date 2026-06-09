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

let matchCounter = 0;

function makeMatch({
  round,
  label,
  a = null,
  b = null,
  type = "bracket",
  pool = null,
  side = "winners",
  matchNum = null,
}) {
  matchCounter += 1;
  const num = matchNum ?? matchCounter;
  return {
    id: `match-${num}`,
    matchNum: num,
    round,
    label,
    a,
    b,
    scoreA: "",
    scoreB: "",
    winner: null,
    loser: null,
    type,
    side,
    pool,
    court: ((state.matches.length % state.courts) + 1),
    winnerTo: null,
    loserTo: null,
  };
}

function nextPow2(count) {
  if (count <= 1) return 2;
  return 2 ** Math.ceil(Math.log2(count));
}

function paddedSeeds(teamIds) {
  const size = nextPow2(teamIds.length);
  const seeds = teamIds.slice();
  while (seeds.length < size) seeds.push(null);
  return seeds;
}

function buildSingleElimBracket(teamIds) {
  const seeds = paddedSeeds(teamIds);
  const matches = [];
  let prevRound = [];

  for (let index = 0; index < seeds.length; index += 2) {
    const match = makeMatch({
      round: 1,
      label: "Round 1",
      a: seeds[index],
      b: seeds[index + 1],
      side: "winners",
    });
    if (seeds[index] && !seeds[index + 1]) {
      match.winner = seeds[index];
      match.scoreA = "1";
      match.scoreB = "0";
    }
    prevRound.push(match);
    matches.push(match);
  }

  let round = 2;
  while (prevRound.length > 1) {
    const nextRound = [];
    for (let index = 0; index < prevRound.length; index += 2) {
      const match = makeMatch({
        round,
        label: prevRound.length === 2 ? "Semifinals" : `Round ${round}`,
        side: "winners",
      });
      prevRound[index].winnerTo = { matchId: match.id, slot: "a" };
      prevRound[index + 1].winnerTo = { matchId: match.id, slot: "b" };
      nextRound.push(match);
      matches.push(match);
    }
    prevRound = nextRound;
    round += 1;
  }

  const finalMatch = prevRound[0];
  if (finalMatch) finalMatch.label = "Championship";

  refreshBracketProgression(matches);
  return matches;
}

function buildDoubleElimBracket(teamIds) {
  const size = nextPow2(teamIds.length);
  const seeds = paddedSeeds(teamIds);
  const matches = [];
  const wbRounds = [];

  const wb1 = [];
  for (let index = 0; index < size; index += 2) {
    const match = makeMatch({
      round: 1,
      label: "Winners R1",
      a: seeds[index],
      b: seeds[index + 1],
      side: "winners",
    });
    if (seeds[index] && !seeds[index + 1]) {
      match.winner = seeds[index];
      match.scoreA = "1";
      match.scoreB = "0";
    }
    wb1.push(match);
    matches.push(match);
  }
  wbRounds.push(wb1);

  let prevRound = wb1;
  let wbRound = 2;
  while (prevRound.length > 1) {
    const round = [];
    for (let index = 0; index < prevRound.length; index += 2) {
      const match = makeMatch({
        round: wbRound,
        label: prevRound.length === 2 ? "Winners Final" : `Winners R${wbRound}`,
        side: "winners",
      });
      prevRound[index].winnerTo = { matchId: match.id, slot: "a" };
      prevRound[index + 1].winnerTo = { matchId: match.id, slot: "b" };
      round.push(match);
      matches.push(match);
    }
    wbRounds.push(round);
    prevRound = round;
    wbRound += 1;
  }
  const winnersFinal = prevRound[0];

  const lbRounds = [];
  let lbRound = 1;
  const lb1 = [];
  for (let index = 0; index < wb1.length; index += 2) {
    const match = makeMatch({
      round: lbRound,
      label: `Losers R${lbRound}`,
      side: "losers",
    });
    wb1[index].loserTo = { matchId: match.id, slot: "a" };
    wb1[index + 1].loserTo = { matchId: match.id, slot: "b" };
    lb1.push(match);
    matches.push(match);
  }
  lbRounds.push(lb1);
  lbRound += 1;

  let currentLb = lb1;
  for (let wbIndex = 1; wbIndex < wbRounds.length; wbIndex += 1) {
    const wbRoundMatches = wbRounds[wbIndex];
    const dropRound = [];
    wbRoundMatches.forEach((wbMatch, index) => {
      const match = makeMatch({
        round: lbRound,
        label: `Losers R${lbRound}`,
        side: "losers",
      });
      if (currentLb[index]) {
        currentLb[index].winnerTo = { matchId: match.id, slot: "a" };
      }
      wbMatch.loserTo = { matchId: match.id, slot: "b" };
      dropRound.push(match);
      matches.push(match);
    });
    lbRounds.push(dropRound);
    lbRound += 1;

    if (dropRound.length > 1) {
      const mergeRound = [];
      for (let index = 0; index < dropRound.length; index += 2) {
        const match = makeMatch({
          round: lbRound,
          label: `Losers R${lbRound}`,
          side: "losers",
        });
        dropRound[index].winnerTo = { matchId: match.id, slot: "a" };
        dropRound[index + 1].winnerTo = { matchId: match.id, slot: "b" };
        mergeRound.push(match);
        matches.push(match);
      }
      lbRounds.push(mergeRound);
      lbRound += 1;
      currentLb = mergeRound;
    } else {
      currentLb = dropRound;
    }
  }

  const losersFinal = makeMatch({
    round: lbRound,
    label: "Losers Final",
    side: "losers",
  });
  currentLb[0].winnerTo = { matchId: losersFinal.id, slot: "a" };
  winnersFinal.loserTo = { matchId: losersFinal.id, slot: "b" };
  matches.push(losersFinal);

  const grandFinal = makeMatch({
    round: 1,
    label: "Grand Final",
    side: "grand",
  });
  winnersFinal.winnerTo = { matchId: grandFinal.id, slot: "a" };
  losersFinal.winnerTo = { matchId: grandFinal.id, slot: "b" };
  matches.push(grandFinal);

  matches.push(makeMatch({
    round: 1,
    label: "Grand Final (if necessary)",
    side: "reset",
  }));

  refreshBracketProgression(matches);
  return matches;
}

function getBracketTreeMatches() {
  return state.matches.filter((match) => match.type === "bracket" && match.side !== "reset");
}

function seedRoundFor(matches) {
  const winners = matches.filter((match) => match.side === "winners");
  if (!winners.length) return 1;
  return Math.min(...winners.map((match) => match.round));
}

function bracketSeed(teamId) {
  const seedRound = seedRoundFor(state.matches);
  const roundOne = state.matches
    .filter((match) => match.side === "winners" && match.round === seedRound)
    .sort((left, right) => left.matchNum - right.matchNum);
  let seed = 1;
  for (const match of roundOne) {
    if (match.a === teamId) return seed;
    seed += 1;
    if (match.b === teamId) return seed;
    seed += 1;
  }
  return null;
}

function refreshBracketProgression(matchList = state.matches) {
  const bracketMatches = matchList.filter((match) => match.type === "bracket" && match.side !== "reset");
  const seedRound = seedRoundFor(bracketMatches);

  bracketMatches.forEach((match) => {
    if (!(match.side === "winners" && match.round === seedRound)) {
      match.a = null;
      match.b = null;
    }
    match.winner = null;
    match.loser = null;
  });

  bracketMatches
    .filter((match) => match.side === "winners" && match.round === seedRound)
    .forEach((match) => {
      if (match.a && !match.b) {
        match.winner = match.a;
        match.loser = null;
      }
    });

  const sorted = [...bracketMatches].sort((left, right) => left.matchNum - right.matchNum);
  sorted.forEach((match) => {
    completeMatch(match);
    if (match.winner && match.winnerTo) {
      const child = matchList.find((item) => item.id === match.winnerTo.matchId);
      if (child) child[match.winnerTo.slot] = match.winner;
    }
    if (match.loser && match.loserTo) {
      const child = matchList.find((item) => item.id === match.loserTo.matchId);
      if (child) child[match.loserTo.slot] = match.loser;
    }
  });

  sorted.forEach((match) => completeMatch(match));
}

function feederLabel(matchId, slot) {
  const winnerFeeder = state.matches.find(
    (match) => match.winnerTo?.matchId === matchId && match.winnerTo?.slot === slot,
  );
  if (winnerFeeder) {
    return { text: `Winner of ${winnerFeeder.matchNum}`, placeholder: true };
  }
  const loserFeeder = state.matches.find(
    (match) => match.loserTo?.matchId === matchId && match.loserTo?.slot === slot,
  );
  if (loserFeeder) {
    return { text: `Loser of ${loserFeeder.matchNum}`, placeholder: true };
  }
  return { text: "TBD", placeholder: true };
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
  matchCounter = 0;

  const teamIds = state.teams.map((team) => team.id);

  if (state.format === "single") {
    state.matches = buildSingleElimBracket(teamIds);
  }

  if (state.format === "double") {
    state.matches = buildDoubleElimBracket(teamIds);
  }

  state.matches.forEach((match, index) => {
    match.court = (index % state.courts) + 1;
  });

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

  if (state.format === "single" || state.format === "double") {
    refreshBracketProgression();
  }
  if (state.format === "pool") {
    maybeStartPoolBracket();
    refreshBracketProgression();
  }

  renderAll();
}

function maybeStartPoolBracket() {
  const poolMatches = state.matches.filter((match) => match.type === "pool");
  const allPoolDone = poolMatches.length > 0 && poolMatches.every((match) => match.winner);
  if (!allPoolDone || state.bracketStarted) return;

  const perPool = Math.max(1, Number.parseInt(els.poolAdvancers.value, 10) || 1);
  const advancers = state.pools.flatMap((pool) => standingsFor(pool.id).slice(0, perPool).map((row) => row.team.id));
  state.bracketStarted = true;
  const bracketMatches = buildSingleElimBracket(advancers);
  bracketMatches.forEach((match) => {
    match.round += 100;
  });
  state.matches.push(...bracketMatches);
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

function groupMatchesIntoRounds(matches) {
  const rounds = new Map();
  matches.forEach((match) => {
    if (!rounds.has(match.round)) rounds.set(match.round, []);
    rounds.get(match.round).push(match);
  });
  return [...rounds.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, roundMatches]) => roundMatches.sort((left, right) => left.matchNum - right.matchNum));
}

function slotDisplay(match, side) {
  const teamId = match[side];
  if (teamId) {
    const team = getTeam(teamId);
    return {
      text: teamName(team),
      sub: team ? team.players.join(" & ") : "",
      placeholder: false,
      teamId,
      seed: match.side === "winners" && match.round === seedRoundFor(state.matches) ? bracketSeed(teamId) : null,
    };
  }
  return feederLabel(match.id, side);
}

function renderTreeTeam(match, side) {
  const slot = slotDisplay(match, side);
  const team = slot.teamId ? getTeam(slot.teamId) : null;
  const row = document.createElement("div");
  const isWinner = match.winner && match[side] === match.winner;
  row.className = `tree-team ${side === "a" ? "top" : "bottom"}${isWinner ? " winner" : ""}${slot.placeholder ? " placeholder" : ""}`;

  if (slot.seed) {
    const seed = document.createElement("span");
    seed.className = "tree-seed";
    seed.textContent = slot.seed;
    row.append(seed);
  }

  const info = document.createElement("div");
  info.className = "tree-team-info";
  const label = document.createElement("span");
  label.className = "tree-label";
  label.textContent = slot.text;
  info.append(label);
  if (slot.sub) {
    const sub = document.createElement("span");
    sub.className = "tree-sub";
    sub.textContent = slot.sub;
    info.append(sub);
  }
  row.append(info);

  const score = document.createElement("input");
  score.className = "tree-score";
  score.inputMode = "numeric";
  score.value = side === "a" ? match.scoreA : match.scoreB;
  score.disabled = !team;
  score.setAttribute("aria-label", `${slot.text} score`);
  score.addEventListener("input", (event) => applyScore(match.id, side, event.target.value));
  row.append(score);

  return row;
}

function renderTreeMatchup(match, isLastRound) {
  const wrap = document.createElement("div");
  wrap.className = `tree-matchup${isLastRound ? " final-round" : ""}`;
  wrap.dataset.matchId = match.id;
  wrap.append(renderTreeTeam(match, "a"));
  wrap.append(renderTreeTeam(match, "b"));

  const marker = document.createElement("span");
  marker.className = "tree-match-num";
  marker.textContent = match.matchNum;
  wrap.append(marker);

  return wrap;
}

function renderBracketTree(matches, { title = null, teamCount = null } = {}) {
  const section = document.createElement("section");
  section.className = "bracket-section";

  if (title) {
    const heading = document.createElement("h2");
    heading.className = "bracket-section-title";
    heading.textContent = title;
    section.append(heading);
  }

  const tree = document.createElement("div");
  const size = teamCount || nextPow2(state.teams.length);
  tree.className = "bracket-tree";
  tree.style.setProperty("--team-count", String(size));

  const rounds = groupMatchesIntoRounds(matches);
  rounds.forEach((roundMatches, index) => {
    const roundEl = document.createElement("div");
    roundEl.className = `tree-round tree-round-${index + 1}`;
    roundEl.style.setProperty("--round-size", String(Math.max(roundMatches.length, 1)));
    const isLast = index === rounds.length - 1;
    roundMatches.forEach((match) => roundEl.append(renderTreeMatchup(match, isLast)));
    tree.append(roundEl);
  });

  section.append(tree);
  return section;
}

function renderFinalsColumn(matches) {
  const column = document.createElement("div");
  column.className = "bracket-finals";
  matches.forEach((match) => column.append(renderTreeMatchup(match, true)));
  return column;
}

function renderListBracket() {
  els.bracketBoard.className = "bracket-board full-board";

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
        .forEach((match) => column.append(renderListMatch(match)));
      els.bracketBoard.append(column);
    });
  }

  if (state.format === "roundRobin") {
    const column = document.createElement("div");
    column.className = "round-column";
    const title = document.createElement("h3");
    title.textContent = "Round Robin Matches";
    column.append(title);
    state.matches.filter((match) => match.type === "roundRobin").forEach((match) => column.append(renderListMatch(match)));
    els.bracketBoard.append(column);
    els.bracketBoard.append(renderStandingsTable("Round Robin Standings", standingsFor()));
  }
}

function renderListMatch(match) {
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
  card.append(renderListCompetitor(match, "a", teamA));
  card.append(renderListCompetitor(match, "b", teamB));
  return card;
}

function renderListCompetitor(match, side, team) {
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

function fitBracketToScreen() {
  const viewport = els.bracketBoard.querySelector(".bracket-viewport");
  const scaler = viewport?.querySelector(".bracket-scaler");
  if (!viewport || !scaler) return;

  scaler.style.transform = "none";
  const scale = Math.min(
    1,
    (viewport.clientWidth - 24) / scaler.scrollWidth,
    (viewport.clientHeight - 24) / scaler.scrollHeight,
  );
  scaler.style.transform = `scale(${scale})`;
}

function renderBracket() {
  els.bracketBoard.innerHTML = "";
  if (!state.matches.length) {
    els.bracketBoard.className = "bracket-board full-board";
    return;
  }

  const usesTree = state.format === "single"
    || state.format === "double"
    || (state.format === "pool" && state.bracketStarted);

  if (!usesTree) {
    renderListBracket();
    return;
  }

  els.bracketBoard.className = "bracket-board full-board bracket-tree-mode";
  const viewport = document.createElement("div");
  viewport.className = "bracket-viewport";
  const scaler = document.createElement("div");
  scaler.className = "bracket-scaler";

  if (state.format === "double") {
    const winners = state.matches.filter((match) => match.type === "bracket" && match.side === "winners");
    const losers = state.matches.filter((match) => match.type === "bracket" && match.side === "losers");
    const finals = state.matches.filter((match) => match.type === "bracket" && (match.side === "grand" || match.side === "reset"));

    const topRow = document.createElement("div");
    topRow.className = "bracket-row winners-row";
    topRow.append(renderBracketTree(winners, { title: "Winners Bracket" }));
    if (finals.length) topRow.append(renderFinalsColumn(finals));
    scaler.append(topRow);
    scaler.append(renderBracketTree(losers, { title: "Losers Bracket" }));
  } else if (state.format === "pool" && state.bracketStarted) {
    const bracketMatches = state.matches.filter((match) => match.type === "bracket" && match.round >= 100);
    scaler.append(renderBracketTree(bracketMatches, { title: "Championship Bracket" }));
  } else {
    const bracketMatches = state.matches.filter((match) => match.type === "bracket");
    scaler.append(renderBracketTree(bracketMatches));
  }

  viewport.append(scaler);
  els.bracketBoard.append(viewport);
  requestAnimationFrame(fitBracketToScreen);
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

window.addEventListener("resize", fitBracketToScreen);

showScreen("entry");
updateFormatOptions();
renderAll();
