// bracketTest.js — structural validator for the double-elimination bracket engine
//
// !! WARNING: This file contains a verbatim copy of the bracket logic from
// !! Bracket.jsx. If the engine changes (buildMatches*, pickWinner,
// !! autoAdvanceByes, bracketSizeFor, padWithByes, BYE), this file must be
// !! updated to match or test results will not reflect production behavior.
//
// Run with:  node bracket-app/src/bracketTest.js
// (Requires Node.js 18+; no additional dependencies.)
//
// ─────────────────────────────────────────────────────────────────────────────
// COPIED ENGINE — keep in sync with Bracket.jsx
// ─────────────────────────────────────────────────────────────────────────────

function buildMatches8(players) {
  const [p1, p2, p3, p4, p5, p6, p7, p8] = players;
  const m = (id, bracket, round, label, slots, winnerTo, loserTo) => ({
    id, bracket, round, label, slots, winner: null, winnerTo, loserTo,
  });
  const TBD = [null, null];
  return {
    "W1-1": m("W1-1","W",1,"W1-1",[p1,p8],{id:"W2-1",slot:0},{id:"L1-1",slot:0}),
    "W1-2": m("W1-2","W",1,"W1-2",[p4,p5],{id:"W2-1",slot:1},{id:"L1-1",slot:1}),
    "W1-3": m("W1-3","W",1,"W1-3",[p2,p7],{id:"W2-2",slot:0},{id:"L1-2",slot:0}),
    "W1-4": m("W1-4","W",1,"W1-4",[p3,p6],{id:"W2-2",slot:1},{id:"L1-2",slot:1}),
    "W2-1": m("W2-1","W",2,"W2-1",TBD,{id:"W3-1",slot:0},{id:"L2-1",slot:1}),
    "W2-2": m("W2-2","W",2,"W2-2",TBD,{id:"W3-1",slot:1},{id:"L2-2",slot:1}),
    "W3-1": m("W3-1","W",3,"W3-1",TBD,{id:"GF-1",slot:0},{id:"L4-1",slot:1}),
    "L1-1": m("L1-1","L",1,"L1-1",TBD,{id:"L2-1",slot:0},null),
    "L1-2": m("L1-2","L",1,"L1-2",TBD,{id:"L2-2",slot:0},null),
    "L2-1": m("L2-1","L",2,"L2-1",TBD,{id:"L3-1",slot:0},null),
    "L2-2": m("L2-2","L",2,"L2-2",TBD,{id:"L3-1",slot:1},null),
    "L3-1": m("L3-1","L",3,"L3-1",TBD,{id:"L4-1",slot:0},null),
    "L4-1": m("L4-1","L",4,"L4-1",TBD,{id:"GF-1",slot:1},null),
    "GF-1": m("GF-1","GF",1,"Grand Final",TBD,null,null),
    "GF-2": m("GF-2","GF",2,"Reset Final",TBD,null,null),
  };
}

function buildMatches16(players) {
  const [p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12,p13,p14,p15,p16] = players;
  const m = (id, bracket, round, label, slots, winnerTo, loserTo) => ({
    id, bracket, round, label, slots, winner: null, winnerTo, loserTo,
  });
  const TBD = [null, null];
  return {
    "W1-1": m("W1-1","W",1,"W1-1",[p1, p16],{id:"W2-1",slot:0},{id:"L1-1",slot:0}),
    "W1-2": m("W1-2","W",1,"W1-2",[p8, p9 ],{id:"W2-1",slot:1},{id:"L1-1",slot:1}),
    "W1-3": m("W1-3","W",1,"W1-3",[p4, p13],{id:"W2-2",slot:0},{id:"L1-2",slot:0}),
    "W1-4": m("W1-4","W",1,"W1-4",[p5, p12],{id:"W2-2",slot:1},{id:"L1-2",slot:1}),
    "W1-5": m("W1-5","W",1,"W1-5",[p2, p15],{id:"W2-3",slot:0},{id:"L1-3",slot:0}),
    "W1-6": m("W1-6","W",1,"W1-6",[p7, p10],{id:"W2-3",slot:1},{id:"L1-3",slot:1}),
    "W1-7": m("W1-7","W",1,"W1-7",[p3, p14],{id:"W2-4",slot:0},{id:"L1-4",slot:0}),
    "W1-8": m("W1-8","W",1,"W1-8",[p6, p11],{id:"W2-4",slot:1},{id:"L1-4",slot:1}),
    "W2-1": m("W2-1","W",2,"W2-1",TBD,{id:"W3-1",slot:0},{id:"L2-1",slot:1}),
    "W2-2": m("W2-2","W",2,"W2-2",TBD,{id:"W3-1",slot:1},{id:"L2-2",slot:1}),
    "W2-3": m("W2-3","W",2,"W2-3",TBD,{id:"W3-2",slot:0},{id:"L2-3",slot:1}),
    "W2-4": m("W2-4","W",2,"W2-4",TBD,{id:"W3-2",slot:1},{id:"L2-4",slot:1}),
    "W3-1": m("W3-1","W",3,"W3-1",TBD,{id:"W4-1",slot:0},{id:"L4-1",slot:1}),
    "W3-2": m("W3-2","W",3,"W3-2",TBD,{id:"W4-1",slot:1},{id:"L4-2",slot:1}),
    "W4-1": m("W4-1","W",4,"W4-1",TBD,{id:"GF-1",slot:0},{id:"L6-1",slot:1}),
    "L1-1": m("L1-1","L",1,"L1-1",TBD,{id:"L2-1",slot:0},null),
    "L1-2": m("L1-2","L",1,"L1-2",TBD,{id:"L2-2",slot:0},null),
    "L1-3": m("L1-3","L",1,"L1-3",TBD,{id:"L2-3",slot:0},null),
    "L1-4": m("L1-4","L",1,"L1-4",TBD,{id:"L2-4",slot:0},null),
    "L2-1": m("L2-1","L",2,"L2-1",TBD,{id:"L3-1",slot:0},null),
    "L2-2": m("L2-2","L",2,"L2-2",TBD,{id:"L3-1",slot:1},null),
    "L2-3": m("L2-3","L",2,"L2-3",TBD,{id:"L3-2",slot:0},null),
    "L2-4": m("L2-4","L",2,"L2-4",TBD,{id:"L3-2",slot:1},null),
    "L3-1": m("L3-1","L",3,"L3-1",TBD,{id:"L4-1",slot:0},null),
    "L3-2": m("L3-2","L",3,"L3-2",TBD,{id:"L4-2",slot:0},null),
    "L4-1": m("L4-1","L",4,"L4-1",TBD,{id:"L5-1",slot:0},null),
    "L4-2": m("L4-2","L",4,"L4-2",TBD,{id:"L5-1",slot:1},null),
    "L5-1": m("L5-1","L",5,"L5-1",TBD,{id:"L6-1",slot:0},null),
    "L6-1": m("L6-1","L",6,"L6-1",TBD,{id:"GF-1",slot:1},null),
    "GF-1": m("GF-1","GF",1,"Grand Final",TBD,null,null),
    "GF-2": m("GF-2","GF",2,"Reset Final",TBD,null,null),
  };
}

function buildMatches32(players) {
  const [
    p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12,p13,p14,p15,p16,
    p17,p18,p19,p20,p21,p22,p23,p24,p25,p26,p27,p28,p29,p30,p31,p32,
  ] = players;
  const m = (id, bracket, round, label, slots, winnerTo, loserTo) => ({
    id, bracket, round, label, slots, winner: null, winnerTo, loserTo,
  });
  const T = [null, null];
  return {
    "W1-1": m("W1-1","W",1,"W1-1",[p1,p32],{id:"W2-1",slot:0},{id:"L1-1",slot:0}),
    "W1-2": m("W1-2","W",1,"W1-2",[p16,p17],{id:"W2-1",slot:1},{id:"L1-1",slot:1}),
    "W1-3": m("W1-3","W",1,"W1-3",[p8,p25],{id:"W2-2",slot:0},{id:"L1-2",slot:0}),
    "W1-4": m("W1-4","W",1,"W1-4",[p9,p24],{id:"W2-2",slot:1},{id:"L1-2",slot:1}),
    "W1-5": m("W1-5","W",1,"W1-5",[p4,p29],{id:"W2-3",slot:0},{id:"L1-3",slot:0}),
    "W1-6": m("W1-6","W",1,"W1-6",[p13,p20],{id:"W2-3",slot:1},{id:"L1-3",slot:1}),
    "W1-7": m("W1-7","W",1,"W1-7",[p5,p28],{id:"W2-4",slot:0},{id:"L1-4",slot:0}),
    "W1-8": m("W1-8","W",1,"W1-8",[p12,p21],{id:"W2-4",slot:1},{id:"L1-4",slot:1}),
    "W1-9": m("W1-9","W",1,"W1-9",[p2,p31],{id:"W2-5",slot:0},{id:"L1-5",slot:0}),
    "W1-10":m("W1-10","W",1,"W1-10",[p15,p18],{id:"W2-5",slot:1},{id:"L1-5",slot:1}),
    "W1-11":m("W1-11","W",1,"W1-11",[p7,p26],{id:"W2-6",slot:0},{id:"L1-6",slot:0}),
    "W1-12":m("W1-12","W",1,"W1-12",[p10,p23],{id:"W2-6",slot:1},{id:"L1-6",slot:1}),
    "W1-13":m("W1-13","W",1,"W1-13",[p3,p30],{id:"W2-7",slot:0},{id:"L1-7",slot:0}),
    "W1-14":m("W1-14","W",1,"W1-14",[p14,p19],{id:"W2-7",slot:1},{id:"L1-7",slot:1}),
    "W1-15":m("W1-15","W",1,"W1-15",[p6,p27],{id:"W2-8",slot:0},{id:"L1-8",slot:0}),
    "W1-16":m("W1-16","W",1,"W1-16",[p11,p22],{id:"W2-8",slot:1},{id:"L1-8",slot:1}),
    "W2-1": m("W2-1","W",2,"W2-1",T,{id:"W3-1",slot:0},{id:"L2-1",slot:1}),
    "W2-2": m("W2-2","W",2,"W2-2",T,{id:"W3-1",slot:1},{id:"L2-2",slot:1}),
    "W2-3": m("W2-3","W",2,"W2-3",T,{id:"W3-2",slot:0},{id:"L2-3",slot:1}),
    "W2-4": m("W2-4","W",2,"W2-4",T,{id:"W3-2",slot:1},{id:"L2-4",slot:1}),
    "W2-5": m("W2-5","W",2,"W2-5",T,{id:"W3-3",slot:0},{id:"L2-5",slot:1}),
    "W2-6": m("W2-6","W",2,"W2-6",T,{id:"W3-3",slot:1},{id:"L2-6",slot:1}),
    "W2-7": m("W2-7","W",2,"W2-7",T,{id:"W3-4",slot:0},{id:"L2-7",slot:1}),
    "W2-8": m("W2-8","W",2,"W2-8",T,{id:"W3-4",slot:1},{id:"L2-8",slot:1}),
    "W3-1": m("W3-1","W",3,"W3-1",T,{id:"W4-1",slot:0},{id:"L4-1",slot:1}),
    "W3-2": m("W3-2","W",3,"W3-2",T,{id:"W4-1",slot:1},{id:"L4-2",slot:1}),
    "W3-3": m("W3-3","W",3,"W3-3",T,{id:"W4-2",slot:0},{id:"L4-3",slot:1}),
    "W3-4": m("W3-4","W",3,"W3-4",T,{id:"W4-2",slot:1},{id:"L4-4",slot:1}),
    "W4-1": m("W4-1","W",4,"W4-1",T,{id:"W5-1",slot:0},{id:"L6-1",slot:1}),
    "W4-2": m("W4-2","W",4,"W4-2",T,{id:"W5-1",slot:1},{id:"L6-2",slot:1}),
    "W5-1": m("W5-1","W",5,"WB Final",T,{id:"GF-1",slot:0},{id:"L8-1",slot:1}),
    "L1-1": m("L1-1","L",1,"L1-1",T,{id:"L2-1",slot:0},null),
    "L1-2": m("L1-2","L",1,"L1-2",T,{id:"L2-2",slot:0},null),
    "L1-3": m("L1-3","L",1,"L1-3",T,{id:"L2-3",slot:0},null),
    "L1-4": m("L1-4","L",1,"L1-4",T,{id:"L2-4",slot:0},null),
    "L1-5": m("L1-5","L",1,"L1-5",T,{id:"L2-5",slot:0},null),
    "L1-6": m("L1-6","L",1,"L1-6",T,{id:"L2-6",slot:0},null),
    "L1-7": m("L1-7","L",1,"L1-7",T,{id:"L2-7",slot:0},null),
    "L1-8": m("L1-8","L",1,"L1-8",T,{id:"L2-8",slot:0},null),
    "L2-1": m("L2-1","L",2,"L2-1",T,{id:"L3-1",slot:0},null),
    "L2-2": m("L2-2","L",2,"L2-2",T,{id:"L3-1",slot:1},null),
    "L2-3": m("L2-3","L",2,"L2-3",T,{id:"L3-2",slot:0},null),
    "L2-4": m("L2-4","L",2,"L2-4",T,{id:"L3-2",slot:1},null),
    "L2-5": m("L2-5","L",2,"L2-5",T,{id:"L3-3",slot:0},null),
    "L2-6": m("L2-6","L",2,"L2-6",T,{id:"L3-3",slot:1},null),
    "L2-7": m("L2-7","L",2,"L2-7",T,{id:"L3-4",slot:0},null),
    "L2-8": m("L2-8","L",2,"L2-8",T,{id:"L3-4",slot:1},null),
    "L3-1": m("L3-1","L",3,"L3-1",T,{id:"L4-1",slot:0},null),
    "L3-2": m("L3-2","L",3,"L3-2",T,{id:"L4-2",slot:0},null),
    "L3-3": m("L3-3","L",3,"L3-3",T,{id:"L4-3",slot:0},null),
    "L3-4": m("L3-4","L",3,"L3-4",T,{id:"L4-4",slot:0},null),
    "L4-1": m("L4-1","L",4,"L4-1",T,{id:"L5-1",slot:0},null),
    "L4-2": m("L4-2","L",4,"L4-2",T,{id:"L5-1",slot:1},null),
    "L4-3": m("L4-3","L",4,"L4-3",T,{id:"L5-2",slot:0},null),
    "L4-4": m("L4-4","L",4,"L4-4",T,{id:"L5-2",slot:1},null),
    "L5-1": m("L5-1","L",5,"L5-1",T,{id:"L6-1",slot:0},null),
    "L5-2": m("L5-2","L",5,"L5-2",T,{id:"L6-2",slot:0},null),
    "L6-1": m("L6-1","L",6,"L6-1",T,{id:"L7-1",slot:0},null),
    "L6-2": m("L6-2","L",6,"L6-2",T,{id:"L7-1",slot:1},null),
    "L7-1": m("L7-1","L",7,"L7-1",T,{id:"L8-1",slot:0},null),
    "L8-1": m("L8-1","L",8,"LB Final",T,{id:"GF-1",slot:1},null),
    "GF-1": m("GF-1","GF",1,"Grand Final",T,null,null),
    "GF-2": m("GF-2","GF",2,"Reset Final",T,null,null),
  };
}

function buildMatches(players) {
  if (players.length === 32) return buildMatches32(players);
  if (players.length === 16) return buildMatches16(players);
  return buildMatches8(players);
}

function bracketSizeFor(n) {
  if (n <= 4)  return 4;
  if (n <= 8)  return 8;
  if (n <= 16) return 16;
  return 32;
}

const BYE = { id: "bye", name: "BYE", isBye: true };

function padWithByes(players, targetSize) {
  const padded = [...players];
  while (padded.length < targetSize) padded.push(BYE);
  return padded;
}

function pickWinner(matches, matchId, slotIndex) {
  const m = matches[matchId];
  if (!m || m.winner !== null) return matches;
  const winner = m.slots[slotIndex];
  const loser  = m.slots[slotIndex === 0 ? 1 : 0];
  const next   = JSON.parse(JSON.stringify(matches));
  next[matchId].winner = winner;
  if (m.winnerTo) {
    if (next[m.winnerTo.id]) next[m.winnerTo.id].slots[m.winnerTo.slot] = winner;
  }
  if (m.loserTo && loser) {
    if (next[m.loserTo.id]) next[m.loserTo.id].slots[m.loserTo.slot] = loser;
  }
  if (matchId === "GF-1" && slotIndex === 1) {
    next["GF-2"].slots[0] = m.slots[0];
    next["GF-2"].slots[1] = winner;
  }
  return next;
}

function autoAdvanceByes(matches) {
  let result = matches;
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of Object.values(result)) {
      if (m.winner !== null) continue;
      const [s0, s1] = m.slots;
      const s0bye = !!s0?.isBye;
      const s1bye = !!s1?.isBye;
      if (!s0bye && !s1bye) continue;
      if (s0bye && s1bye) {
        result = pickWinner(result, m.id, 0);
        changed = true;
        break;
      }
      const winnerSlot = !s0bye ? 0 : 1;
      if (!m.slots[winnerSlot] || m.slots[winnerSlot].isBye) continue;
      result = pickWinner(result, m.id, winnerSlot);
      changed = true;
      break;
    }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION CHECKS
// ─────────────────────────────────────────────────────────────────────────────

function validateBracket(n) {
  const errors = [];
  const warn   = (msg) => errors.push(msg);

  // Build the bracket.
  const templateSize = bracketSizeFor(n);
  const realPlayers  = Array.from({ length: n }, (_, i) => ({ id: `p${i+1}`, name: `P${i+1}` }));
  const padded       = padWithByes(realPlayers, templateSize);
  let   matches;

  try {
    matches = autoAdvanceByes(buildMatches(padded));
  } catch (e) {
    return [`THROW during build/autoAdvance: ${e.message}`];
  }

  const ids = new Set(Object.keys(matches));

  // 1. GF-1 and GF-2 must exist.
  if (!ids.has("GF-1")) warn("GF-1 missing");
  if (!ids.has("GF-2")) warn("GF-2 missing");

  // 2. Every match ID stored in the object must match the id field (no key/value mismatch).
  for (const [key, m] of Object.entries(matches)) {
    if (key !== m.id) warn(`key "${key}" has id field "${m.id}" — mismatch`);
  }

  // 3. No match references itself.
  for (const m of Object.values(matches)) {
    if (m.winnerTo?.id === m.id) warn(`${m.id}: winnerTo points to itself`);
    if (m.loserTo?.id  === m.id) warn(`${m.id}: loserTo points to itself`);
  }

  // 4. All winnerTo / loserTo targets exist and have valid slots.
  for (const m of Object.values(matches)) {
    if (m.winnerTo !== null) {
      if (!m.winnerTo.id)          warn(`${m.id}: winnerTo missing id`);
      else if (!ids.has(m.winnerTo.id)) warn(`${m.id}: winnerTo → unknown "${m.winnerTo.id}"`);
      else if (m.winnerTo.slot !== 0 && m.winnerTo.slot !== 1)
                                   warn(`${m.id}: winnerTo.slot "${m.winnerTo.slot}" invalid`);
    }
    if (m.loserTo !== null) {
      if (!m.loserTo.id)           warn(`${m.id}: loserTo missing id`);
      else if (!ids.has(m.loserTo.id)) warn(`${m.id}: loserTo → unknown "${m.loserTo.id}"`);
      else if (m.loserTo.slot !== 0 && m.loserTo.slot !== 1)
                                   warn(`${m.id}: loserTo.slot "${m.loserTo.slot}" invalid`);
    }
  }

  // 5. No two matches write to the same destination slot (slot collision).
  const written = {};
  for (const m of Object.values(matches)) {
    for (const dest of [m.winnerTo, m.loserTo]) {
      if (!dest) continue;
      const key = `${dest.id}[${dest.slot}]`;
      if (written[key]) warn(`slot collision: ${written[key]} and ${m.id} both write to ${key}`);
      else written[key] = m.id;
    }
  }

  // 6. Correct number of BYEs were inserted.
  const byeCount = padded.filter(p => p.isBye).length;
  const expected = templateSize - n;
  if (byeCount !== expected) warn(`expected ${expected} BYEs, got ${byeCount}`);

  // 7. No orphaned matches — every non-WB-R1 match must be reachable via at
  //    least one winnerTo or loserTo, OR have both slots seeded with players.
  //    GF-2 is exempt (only filled under reset condition).
  const reachable = new Set(["GF-2"]);
  for (const m of Object.values(matches)) {
    if (m.winnerTo) reachable.add(m.winnerTo.id);
    if (m.loserTo)  reachable.add(m.loserTo.id);
  }
  for (const m of Object.values(matches)) {
    const isSeeded = m.slots[0] !== null || m.slots[1] !== null;
    if (!reachable.has(m.id) && !isSeeded) {
      warn(`${m.id}: orphaned — no match routes to it and no initial seeding`);
    }
  }

  // 8. After autoAdvanceByes, no match has [BYE, BYE] with winner still null
  //    (would mean the both-BYE propagation didn't fire).
  for (const m of Object.values(matches)) {
    if (m.winner !== null) continue;
    const s0bye = !!m.slots[0]?.isBye;
    const s1bye = !!m.slots[1]?.isBye;
    if (s0bye && s1bye) warn(`${m.id}: [BYE,BYE] with winner=null after autoAdvanceByes`);
  }

  // 9. No real player appears in two different match slots simultaneously
  //    (duplicate seeding check on the final built state).
  const seen = {};
  for (const m of Object.values(matches)) {
    for (const p of m.slots) {
      if (!p || p.isBye) continue;
      const key = `${p.id}@${m.id}`;
      // Check if same player appears in BOTH slots of same match.
      if (m.slots[0] && m.slots[1] && m.slots[0].id === m.slots[1].id) {
        warn(`${m.id}: same player "${p.name}" in both slots`);
      }
      // Check cross-match: same player in WB R1 slot more than once.
      if (m.bracket === "W" && m.round === 1) {
        if (seen[p.id]) warn(`P${p.id} appears in multiple WB R1 matches`);
        seen[p.id] = true;
      }
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────────────────────────────────────

const RESET  = "\x1b[0m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";

console.log(`\n${BOLD}Double-elimination bracket engine — structural validator${RESET}`);
console.log(`${DIM}Checks player counts 3–32. Run: node bracket-app/src/bracketTest.js${RESET}\n`);

let passed = 0;
let failed = 0;

for (let n = 3; n <= 32; n++) {
  const templateSize = bracketSizeFor(n);
  const byes         = templateSize - n;
  const label        = `${String(n).padStart(2)}p  (${templateSize}p template, ${byes} BYE${byes !== 1 ? "s" : ""})`;
  const errors       = validateBracket(n);

  if (errors.length === 0) {
    console.log(`  ${GREEN}PASS${RESET}  ${label}`);
    passed++;
  } else {
    console.log(`  ${RED}FAIL${RESET}  ${label}`);
    errors.forEach(e => console.log(`        ${YELLOW}✗${RESET} ${e}`));
    failed++;
  }
}

console.log(`\n${BOLD}Results: ${GREEN}${passed} passed${RESET}${BOLD}, ${failed > 0 ? RED : GREEN}${failed} failed${RESET}${BOLD} / 30 total${RESET}\n`);
if (failed > 0) process.exit(1);
