// Double-elimination bracket — 8 or 16 players
//
// Data model
// ----------
// Each match has:
//   slots:    [player | null, player | null]  — the two competitors
//   winner:   player | null                   — set when a result is picked
//   winnerTo: { id, slot } | null             — where the winner advances to
//   loserTo:  { id, slot } | null             — where the loser drops to (null = eliminated)
//
// Routing is fully hardcoded per player count. When pickWinner() runs it reads
// winnerTo and loserTo off the match and writes the player into the correct
// slot of the destination match. No dynamic graph traversal needed.

import { useState, useEffect, useRef } from "react";

const STORAGE_KEY_PREFIX = "de_tournament_";
const DEFAULT_TOURNAMENT_ID = "default";
const STORAGE_KEY = "de_bracket_v2";

const DEFAULT_NAMES_8 = [
  "Player 1", "Player 2", "Player 3", "Player 4",
  "Player 5", "Player 6", "Player 7", "Player 8",
];

const DEFAULT_NAMES_16 = [
  "Player 1",  "Player 2",  "Player 3",  "Player 4",
  "Player 5",  "Player 6",  "Player 7",  "Player 8",
  "Player 9",  "Player 10", "Player 11", "Player 12",
  "Player 13", "Player 14", "Player 15", "Player 16",
];

const DEFAULT_NAMES_32 = [
  "Player 1",  "Player 2",  "Player 3",  "Player 4",
  "Player 5",  "Player 6",  "Player 7",  "Player 8",
  "Player 9",  "Player 10", "Player 11", "Player 12",
  "Player 13", "Player 14", "Player 15", "Player 16",
  "Player 17", "Player 18", "Player 19", "Player 20",
  "Player 21", "Player 22", "Player 23", "Player 24",
  "Player 25", "Player 26", "Player 27", "Player 28",
  "Player 29", "Player 30", "Player 31", "Player 32",
];

// ---------------------------------------------------------------------------
// Match graph — 8 players
// ---------------------------------------------------------------------------
//
// Structure:
//   WB: R1 (4 matches) → R2 (2 matches) → WB Final (1 match)
//   LB: R1 (2 matches) → R2 (2 matches) → R3 (1 match) → LB Final (1 match)
//   Finals: GF-1, GF-2

function buildMatches8(players) {
  const [p1, p2, p3, p4, p5, p6, p7, p8] = players;

  const m = (id, bracket, round, label, slots, winnerTo, loserTo) => ({
    id, bracket, round, label, slots, winner: null, winnerTo, loserTo,
  });
  const TBD = [null, null];

  return {
    // WB Round 1 — losers drop into LB Round 1
    "W1-1": m("W1-1", "W", 1, "W1-1", [p1, p8], { id: "W2-1", slot: 0 }, { id: "L1-1", slot: 0 }),
    "W1-2": m("W1-2", "W", 1, "W1-2", [p4, p5], { id: "W2-1", slot: 1 }, { id: "L1-1", slot: 1 }),
    "W1-3": m("W1-3", "W", 1, "W1-3", [p2, p7], { id: "W2-2", slot: 0 }, { id: "L1-2", slot: 0 }),
    "W1-4": m("W1-4", "W", 1, "W1-4", [p3, p6], { id: "W2-2", slot: 1 }, { id: "L1-2", slot: 1 }),

    // WB Round 2 — losers drop into LB Round 2 slot 1 (slot 0 = LB R1 winner)
    "W2-1": m("W2-1", "W", 2, "W2-1", TBD, { id: "W3-1", slot: 0 }, { id: "L2-1", slot: 1 }),
    "W2-2": m("W2-2", "W", 2, "W2-2", TBD, { id: "W3-1", slot: 1 }, { id: "L2-2", slot: 1 }),

    // WB Final — loser drops into LB Final slot 1 (slot 0 = LB R3 winner)
    "W3-1": m("W3-1", "W", 3, "W3-1", TBD, { id: "GF-1", slot: 0 }, { id: "L4-1", slot: 1 }),

    // LB Round 1 — WB R1 losers meet; loser = eliminated (2nd loss)
    "L1-1": m("L1-1", "L", 1, "L1-1", TBD, { id: "L2-1", slot: 0 }, null),
    "L1-2": m("L1-2", "L", 1, "L1-2", TBD, { id: "L2-2", slot: 0 }, null),

    // LB Round 2 — L1 winner (slot 0) vs WB R2 loser (slot 1)
    "L2-1": m("L2-1", "L", 2, "L2-1", TBD, { id: "L3-1", slot: 0 }, null),
    "L2-2": m("L2-2", "L", 2, "L2-2", TBD, { id: "L3-1", slot: 1 }, null),

    // LB Round 3
    "L3-1": m("L3-1", "L", 3, "L3-1", TBD, { id: "L4-1", slot: 0 }, null),

    // LB Final — winner goes to Grand Final slot 1
    "L4-1": m("L4-1", "L", 4, "L4-1", TBD, { id: "GF-1", slot: 1 }, null),

    // Grand Final — GF-2 only appears if LB finalist wins GF-1 (see pickWinner)
    "GF-1": m("GF-1", "GF", 1, "Grand Final", TBD, null, null),
    "GF-2": m("GF-2", "GF", 2, "Reset Final", TBD, null, null),
  };
}

// ---------------------------------------------------------------------------
// Match graph — 16 players
// ---------------------------------------------------------------------------
//
// Structure:
//   WB: R1 (8) → R2 (4) → R3 (2) → WB Final (1)
//   LB: R1 (4) → R2 (4) → R3 (2) → R4 (2) → R5 (1) → LB Final (1)
//   Finals: GF-1, GF-2
//
// WB drop-in rounds:
//   WB R1 losers → LB R1 (pairs of adjacent WB R1 matches share an LB R1 match)
//   WB R2 losers → LB R2 slot 1 (slot 0 = LB R1 winner)
//   WB R3 losers → LB R4 slot 1 (slot 0 = LB R3 winner)
//   WB Final loser → LB Final slot 1 (slot 0 = LB R5 winner)

function buildMatches16(players) {
  const [
    p1,  p2,  p3,  p4,  p5,  p6,  p7,  p8,
    p9,  p10, p11, p12, p13, p14, p15, p16,
  ] = players;

  const m = (id, bracket, round, label, slots, winnerTo, loserTo) => ({
    id, bracket, round, label, slots, winner: null, winnerTo, loserTo,
  });
  const TBD = [null, null];

  return {
    // WB Round 1 (8 matches)
    // Adjacent pairs share an LB R1 match: W1-1/W1-2 → L1-1, W1-3/W1-4 → L1-2, etc.
    "W1-1": m("W1-1", "W", 1, "W1-1", [p1,  p16], { id: "W2-1", slot: 0 }, { id: "L1-1", slot: 0 }),
    "W1-2": m("W1-2", "W", 1, "W1-2", [p8,  p9 ], { id: "W2-1", slot: 1 }, { id: "L1-1", slot: 1 }),
    "W1-3": m("W1-3", "W", 1, "W1-3", [p4,  p13], { id: "W2-2", slot: 0 }, { id: "L1-2", slot: 0 }),
    "W1-4": m("W1-4", "W", 1, "W1-4", [p5,  p12], { id: "W2-2", slot: 1 }, { id: "L1-2", slot: 1 }),
    "W1-5": m("W1-5", "W", 1, "W1-5", [p2,  p15], { id: "W2-3", slot: 0 }, { id: "L1-3", slot: 0 }),
    "W1-6": m("W1-6", "W", 1, "W1-6", [p7,  p10], { id: "W2-3", slot: 1 }, { id: "L1-3", slot: 1 }),
    "W1-7": m("W1-7", "W", 1, "W1-7", [p3,  p14], { id: "W2-4", slot: 0 }, { id: "L1-4", slot: 0 }),
    "W1-8": m("W1-8", "W", 1, "W1-8", [p6,  p11], { id: "W2-4", slot: 1 }, { id: "L1-4", slot: 1 }),

    // WB Round 2 (4 matches)
    // Losers drop into LB R2 slot 1; slot 0 is reserved for the LB R1 winner.
    "W2-1": m("W2-1", "W", 2, "W2-1", TBD, { id: "W3-1", slot: 0 }, { id: "L2-1", slot: 1 }),
    "W2-2": m("W2-2", "W", 2, "W2-2", TBD, { id: "W3-1", slot: 1 }, { id: "L2-2", slot: 1 }),
    "W2-3": m("W2-3", "W", 2, "W2-3", TBD, { id: "W3-2", slot: 0 }, { id: "L2-3", slot: 1 }),
    "W2-4": m("W2-4", "W", 2, "W2-4", TBD, { id: "W3-2", slot: 1 }, { id: "L2-4", slot: 1 }),

    // WB Round 3 (2 matches)
    // Losers drop into LB R4 slot 1; slot 0 is reserved for the LB R3 winner.
    "W3-1": m("W3-1", "W", 3, "W3-1", TBD, { id: "W4-1", slot: 0 }, { id: "L4-1", slot: 1 }),
    "W3-2": m("W3-2", "W", 3, "W3-2", TBD, { id: "W4-1", slot: 1 }, { id: "L4-2", slot: 1 }),

    // WB Final (1 match)
    // Loser drops into LB Final slot 1; slot 0 = LB R5 winner.
    "W4-1": m("W4-1", "W", 4, "W4-1", TBD, { id: "GF-1", slot: 0 }, { id: "L6-1", slot: 1 }),

    // LB Round 1 (4 matches) — WB R1 losers meet; loser = eliminated
    "L1-1": m("L1-1", "L", 1, "L1-1", TBD, { id: "L2-1", slot: 0 }, null),
    "L1-2": m("L1-2", "L", 1, "L1-2", TBD, { id: "L2-2", slot: 0 }, null),
    "L1-3": m("L1-3", "L", 1, "L1-3", TBD, { id: "L2-3", slot: 0 }, null),
    "L1-4": m("L1-4", "L", 1, "L1-4", TBD, { id: "L2-4", slot: 0 }, null),

    // LB Round 2 (4 matches) — L1 winner (slot 0) vs WB R2 loser (slot 1)
    "L2-1": m("L2-1", "L", 2, "L2-1", TBD, { id: "L3-1", slot: 0 }, null),
    "L2-2": m("L2-2", "L", 2, "L2-2", TBD, { id: "L3-1", slot: 1 }, null),
    "L2-3": m("L2-3", "L", 2, "L2-3", TBD, { id: "L3-2", slot: 0 }, null),
    "L2-4": m("L2-4", "L", 2, "L2-4", TBD, { id: "L3-2", slot: 1 }, null),

    // LB Round 3 (2 matches) — LB R2 winners pair off
    "L3-1": m("L3-1", "L", 3, "L3-1", TBD, { id: "L4-1", slot: 0 }, null),
    "L3-2": m("L3-2", "L", 3, "L3-2", TBD, { id: "L4-2", slot: 0 }, null),

    // LB Round 4 (2 matches) — L3 winner (slot 0) vs WB R3 loser (slot 1)
    "L4-1": m("L4-1", "L", 4, "L4-1", TBD, { id: "L5-1", slot: 0 }, null),
    "L4-2": m("L4-2", "L", 4, "L4-2", TBD, { id: "L5-1", slot: 1 }, null),

    // LB Round 5 (1 match) — LB R4 winners
    "L5-1": m("L5-1", "L", 5, "L5-1", TBD, { id: "L6-1", slot: 0 }, null),

    // LB Final (1 match) — winner goes to Grand Final slot 1
    "L6-1": m("L6-1", "L", 6, "L6-1", TBD, { id: "GF-1", slot: 1 }, null),

    // Grand Final — GF-2 only appears if LB finalist wins GF-1 (see pickWinner)
    "GF-1": m("GF-1", "GF", 1, "Grand Final", TBD, null, null),
    "GF-2": m("GF-2", "GF", 2, "Reset Final", TBD, null, null),
  };
}

// ---------------------------------------------------------------------------
// Match graph — 32 players
// ---------------------------------------------------------------------------
//
// Structure:
//   WB: R1 (16) → R2 (8) → R3 (4) → R4 (2) → WB Final (1)
//   LB: R1 (8) → R2 (8) → R3 (4) → R4 (4) → R5 (2) → R6 (2) → R7 (1) → LB Final (1)
//   Finals: GF-1, GF-2
//
// WB drop-in rounds:
//   WB R1 losers  → LB R1 slot 0+1  (pairs: W1-1/W1-2 → L1-1, …, W1-15/W1-16 → L1-8)
//   WB R2 losers  → LB R2 slot 1    (slot 0 = LB R1 winner)
//   WB R3 losers  → LB R4 slot 1    (slot 0 = LB R3 winner)
//   WB R4 losers  → LB R6 slot 1    (slot 0 = LB R5 winner)
//   WB Final loser→ LB Final slot 1 (slot 0 = LB R7 winner)

function buildMatches32(players) {
  const [
    p1,  p2,  p3,  p4,  p5,  p6,  p7,  p8,
    p9,  p10, p11, p12, p13, p14, p15, p16,
    p17, p18, p19, p20, p21, p22, p23, p24,
    p25, p26, p27, p28, p29, p30, p31, p32,
  ] = players;

  const m = (id, bracket, round, label, slots, winnerTo, loserTo) => ({
    id, bracket, round, label, slots, winner: null, winnerTo, loserTo,
  });
  const T = [null, null];

  return {
    // ── WB Round 1 (16 matches) ─────────────────────────────────────────────
    // Each adjacent pair of WB R1 matches shares one LB R1 match.
    // W1-1/W1-2 losers → L1-1, W1-3/W1-4 → L1-2, …, W1-15/W1-16 → L1-8
    "W1-1":  m("W1-1",  "W", 1, "W1-1",  [p1,  p32], {id:"W2-1",  slot:0}, {id:"L1-1", slot:0}),
    "W1-2":  m("W1-2",  "W", 1, "W1-2",  [p16, p17], {id:"W2-1",  slot:1}, {id:"L1-1", slot:1}),
    "W1-3":  m("W1-3",  "W", 1, "W1-3",  [p8,  p25], {id:"W2-2",  slot:0}, {id:"L1-2", slot:0}),
    "W1-4":  m("W1-4",  "W", 1, "W1-4",  [p9,  p24], {id:"W2-2",  slot:1}, {id:"L1-2", slot:1}),
    "W1-5":  m("W1-5",  "W", 1, "W1-5",  [p4,  p29], {id:"W2-3",  slot:0}, {id:"L1-3", slot:0}),
    "W1-6":  m("W1-6",  "W", 1, "W1-6",  [p13, p20], {id:"W2-3",  slot:1}, {id:"L1-3", slot:1}),
    "W1-7":  m("W1-7",  "W", 1, "W1-7",  [p5,  p28], {id:"W2-4",  slot:0}, {id:"L1-4", slot:0}),
    "W1-8":  m("W1-8",  "W", 1, "W1-8",  [p12, p21], {id:"W2-4",  slot:1}, {id:"L1-4", slot:1}),
    "W1-9":  m("W1-9",  "W", 1, "W1-9",  [p2,  p31], {id:"W2-5",  slot:0}, {id:"L1-5", slot:0}),
    "W1-10": m("W1-10", "W", 1, "W1-10", [p15, p18], {id:"W2-5",  slot:1}, {id:"L1-5", slot:1}),
    "W1-11": m("W1-11", "W", 1, "W1-11", [p7,  p26], {id:"W2-6",  slot:0}, {id:"L1-6", slot:0}),
    "W1-12": m("W1-12", "W", 1, "W1-12", [p10, p23], {id:"W2-6",  slot:1}, {id:"L1-6", slot:1}),
    "W1-13": m("W1-13", "W", 1, "W1-13", [p3,  p30], {id:"W2-7",  slot:0}, {id:"L1-7", slot:0}),
    "W1-14": m("W1-14", "W", 1, "W1-14", [p14, p19], {id:"W2-7",  slot:1}, {id:"L1-7", slot:1}),
    "W1-15": m("W1-15", "W", 1, "W1-15", [p6,  p27], {id:"W2-8",  slot:0}, {id:"L1-8", slot:0}),
    "W1-16": m("W1-16", "W", 1, "W1-16", [p11, p22], {id:"W2-8",  slot:1}, {id:"L1-8", slot:1}),

    // ── WB Round 2 (8 matches) ──────────────────────────────────────────────
    // Losers drop to LB R2 slot 1; slot 0 is reserved for the LB R1 winner.
    "W2-1":  m("W2-1",  "W", 2, "W2-1",  T, {id:"W3-1", slot:0}, {id:"L2-1", slot:1}),
    "W2-2":  m("W2-2",  "W", 2, "W2-2",  T, {id:"W3-1", slot:1}, {id:"L2-2", slot:1}),
    "W2-3":  m("W2-3",  "W", 2, "W2-3",  T, {id:"W3-2", slot:0}, {id:"L2-3", slot:1}),
    "W2-4":  m("W2-4",  "W", 2, "W2-4",  T, {id:"W3-2", slot:1}, {id:"L2-4", slot:1}),
    "W2-5":  m("W2-5",  "W", 2, "W2-5",  T, {id:"W3-3", slot:0}, {id:"L2-5", slot:1}),
    "W2-6":  m("W2-6",  "W", 2, "W2-6",  T, {id:"W3-3", slot:1}, {id:"L2-6", slot:1}),
    "W2-7":  m("W2-7",  "W", 2, "W2-7",  T, {id:"W3-4", slot:0}, {id:"L2-7", slot:1}),
    "W2-8":  m("W2-8",  "W", 2, "W2-8",  T, {id:"W3-4", slot:1}, {id:"L2-8", slot:1}),

    // ── WB Round 3 (4 matches) ──────────────────────────────────────────────
    // Losers drop to LB R4 slot 1; slot 0 is reserved for the LB R3 winner.
    "W3-1":  m("W3-1",  "W", 3, "W3-1",  T, {id:"W4-1", slot:0}, {id:"L4-1", slot:1}),
    "W3-2":  m("W3-2",  "W", 3, "W3-2",  T, {id:"W4-1", slot:1}, {id:"L4-2", slot:1}),
    "W3-3":  m("W3-3",  "W", 3, "W3-3",  T, {id:"W4-2", slot:0}, {id:"L4-3", slot:1}),
    "W3-4":  m("W3-4",  "W", 3, "W3-4",  T, {id:"W4-2", slot:1}, {id:"L4-4", slot:1}),

    // ── WB Round 4 (2 matches) ──────────────────────────────────────────────
    // Losers drop to LB R6 slot 1; slot 0 is reserved for the LB R5 winner.
    "W4-1":  m("W4-1",  "W", 4, "W4-1",  T, {id:"W5-1", slot:0}, {id:"L6-1", slot:1}),
    "W4-2":  m("W4-2",  "W", 4, "W4-2",  T, {id:"W5-1", slot:1}, {id:"L6-2", slot:1}),

    // ── WB Final (1 match) ──────────────────────────────────────────────────
    // Loser drops to LB Final slot 1; slot 0 = LB R7 winner.
    "W5-1":  m("W5-1",  "W", 5, "WB Final", T, {id:"GF-1", slot:0}, {id:"L8-1", slot:1}),

    // ── LB Round 1 (8 matches) ──────────────────────────────────────────────
    // WB R1 losers meet — loser is eliminated (second loss).
    "L1-1":  m("L1-1",  "L", 1, "L1-1",  T, {id:"L2-1", slot:0}, null),
    "L1-2":  m("L1-2",  "L", 1, "L1-2",  T, {id:"L2-2", slot:0}, null),
    "L1-3":  m("L1-3",  "L", 1, "L1-3",  T, {id:"L2-3", slot:0}, null),
    "L1-4":  m("L1-4",  "L", 1, "L1-4",  T, {id:"L2-4", slot:0}, null),
    "L1-5":  m("L1-5",  "L", 1, "L1-5",  T, {id:"L2-5", slot:0}, null),
    "L1-6":  m("L1-6",  "L", 1, "L1-6",  T, {id:"L2-6", slot:0}, null),
    "L1-7":  m("L1-7",  "L", 1, "L1-7",  T, {id:"L2-7", slot:0}, null),
    "L1-8":  m("L1-8",  "L", 1, "L1-8",  T, {id:"L2-8", slot:0}, null),

    // ── LB Round 2 (8 matches) ──────────────────────────────────────────────
    // L1 winner (slot 0) vs WB R2 loser (slot 1).
    // L2-1/L2-2 winners → L3-1 slots 0+1, L2-3/L2-4 → L3-2, L2-5/L2-6 → L3-3, L2-7/L2-8 → L3-4
    "L2-1":  m("L2-1",  "L", 2, "L2-1",  T, {id:"L3-1", slot:0}, null),
    "L2-2":  m("L2-2",  "L", 2, "L2-2",  T, {id:"L3-1", slot:1}, null),
    "L2-3":  m("L2-3",  "L", 2, "L2-3",  T, {id:"L3-2", slot:0}, null),
    "L2-4":  m("L2-4",  "L", 2, "L2-4",  T, {id:"L3-2", slot:1}, null),
    "L2-5":  m("L2-5",  "L", 2, "L2-5",  T, {id:"L3-3", slot:0}, null),
    "L2-6":  m("L2-6",  "L", 2, "L2-6",  T, {id:"L3-3", slot:1}, null),
    "L2-7":  m("L2-7",  "L", 2, "L2-7",  T, {id:"L3-4", slot:0}, null),
    "L2-8":  m("L2-8",  "L", 2, "L2-8",  T, {id:"L3-4", slot:1}, null),

    // ── LB Round 3 (4 matches) ──────────────────────────────────────────────
    // Each L3 match receives two L2 winners. Each L3 winner goes to their own L4 match.
    "L3-1":  m("L3-1",  "L", 3, "L3-1",  T, {id:"L4-1", slot:0}, null),
    "L3-2":  m("L3-2",  "L", 3, "L3-2",  T, {id:"L4-2", slot:0}, null),
    "L3-3":  m("L3-3",  "L", 3, "L3-3",  T, {id:"L4-3", slot:0}, null),
    "L3-4":  m("L3-4",  "L", 3, "L3-4",  T, {id:"L4-4", slot:0}, null),

    // ── LB Round 4 (4 matches) ──────────────────────────────────────────────
    // L3 winner (slot 0) vs WB R3 loser (slot 1).
    "L4-1":  m("L4-1",  "L", 4, "L4-1",  T, {id:"L5-1", slot:0}, null),
    "L4-2":  m("L4-2",  "L", 4, "L4-2",  T, {id:"L5-1", slot:1}, null),
    "L4-3":  m("L4-3",  "L", 4, "L4-3",  T, {id:"L5-2", slot:0}, null),
    "L4-4":  m("L4-4",  "L", 4, "L4-4",  T, {id:"L5-2", slot:1}, null),

    // ── LB Round 5 (2 matches) ──────────────────────────────────────────────
    // LB R4 winners pair off.
    "L5-1":  m("L5-1",  "L", 5, "L5-1",  T, {id:"L6-1", slot:0}, null),
    "L5-2":  m("L5-2",  "L", 5, "L5-2",  T, {id:"L6-2", slot:0}, null),

    // ── LB Round 6 (2 matches) ──────────────────────────────────────────────
    // L5 winner (slot 0) vs WB R4 loser (slot 1).
    "L6-1":  m("L6-1",  "L", 6, "L6-1",  T, {id:"L7-1", slot:0}, null),
    "L6-2":  m("L6-2",  "L", 6, "L6-2",  T, {id:"L7-1", slot:1}, null),

    // ── LB Round 7 (1 match) ────────────────────────────────────────────────
    // LB R6 winners.
    "L7-1":  m("L7-1",  "L", 7, "L7-1",  T, {id:"L8-1", slot:0}, null),

    // ── LB Final (1 match) ──────────────────────────────────────────────────
    // L7-1 winner (slot 0) vs WB Final loser (slot 1) → Grand Final slot 1.
    "L8-1":  m("L8-1",  "L", 8, "LB Final", T, {id:"GF-1", slot:1}, null),

    // ── Grand Final ─────────────────────────────────────────────────────────
    // GF-2 only appears if the LB finalist (slot 1) wins GF-1 (see pickWinner).
    "GF-1":  m("GF-1",  "GF", 1, "Grand Final", T, null, null),
    "GF-2":  m("GF-2",  "GF", 2, "Reset Final", T, null, null),
  };
}

// Selects the right builder based on player count.
function buildMatches(players) {
  if (players.length === 32) return buildMatches32(players);
  if (players.length === 16) return buildMatches16(players);
  return buildMatches8(players);
}

// ---------------------------------------------------------------------------
// Custom player count helpers
// ---------------------------------------------------------------------------

// Returns the smallest bracket template that fits n players.
//   3-4  -> 4-player bracket
//   5-8  -> 8-player bracket
//   9-16 -> 16-player bracket
//   17-32 -> 32-player bracket
function bracketSizeFor(n) {
  if (n <= 8)  return 8;
  if (n <= 16) return 16;
  return 32;
}

// A BYE fills an unused seed. isBye:true lets MatchCard style it distinctly
// and getStats exclude it from player counts.
const BYE = { id: "bye", name: "BYE", isBye: true };

// Pads a player array up to targetSize with BYE entries.
function padWithByes(players, targetSize) {
  const padded = [...players];
  while (padded.length < targetSize) padded.push(BYE);
  return padded;
}

// Scans all matches and auto-advances any that have one real player and one BYE.
// Loops until stable so that cascades are handled correctly — a BYE advancing
// through WB R1 writes a BYE into LB R1, which then needs its own advance, etc.
// This must also be called after every human pick so that newly-filled matches
// containing a BYE are resolved immediately.
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
      if (!s0bye && !s1bye) continue; // no explicit BYE present — wait
      if (s0bye && s1bye) {
        result = pickWinner(result, m.id, 0); // propagate BYE forward to unblock downstream
        changed = true;
        break;
      }
      const winnerSlot = !s0bye ? 0 : 1;
      if (!m.slots[winnerSlot] || m.slots[winnerSlot].isBye) continue;
      result = pickWinner(result, m.id, winnerSlot);
      changed = true; // a new match may now be ready — restart scan
      break;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// State transitions (shared by both bracket sizes)
// ---------------------------------------------------------------------------

// Records a result and propagates winner/loser to their next matches.
// Returns a new matches object (does not mutate).
function pickWinner(matches, matchId, slotIndex) {
  const m = matches[matchId];

  // Ignore clicks on incomplete or already-decided matches.
  if (!m || m.winner !== null) {
    return matches;
  }

  const winner = m.slots[slotIndex];
  const loser  = m.slots[slotIndex === 0 ? 1 : 0];
  const next   = JSON.parse(JSON.stringify(matches)); // deep clone for immutability

  next[matchId].winner = winner;

  // Advance winner to their next match.
  if (m.winnerTo) {
    if (!next[m.winnerTo.id]) {
      console.warn(`[bracket] ${matchId}: winnerTo references unknown match "${m.winnerTo.id}"`);
    } else {
      next[m.winnerTo.id].slots[m.winnerTo.slot] = winner;
    }
  }

  // Drop loser into losers bracket, or they're eliminated (loserTo === null).
  console.log("[pickWinner]", {
    matchId,
    winner: winner?.name,
    loser: loser?.name,
    loserIsNull: loser === null,
    loserIsBye: loser?.isBye ?? false,
    loserTo: m.loserTo,
  });
  if (m.loserTo && loser) {
    const destBefore = next[m.loserTo.id]?.slots[m.loserTo.slot];
    if (!next[m.loserTo.id]) {
      console.warn(`[bracket] ${matchId}: loserTo references unknown match "${m.loserTo.id}" — ${loser.name} lost but has nowhere to go`);
    } else if (m.loserTo.slot !== 0 && m.loserTo.slot !== 1) {
      console.warn(`[bracket] ${matchId}: loserTo.slot is "${m.loserTo.slot}" — must be 0 or 1`);
    } else {
      next[m.loserTo.id].slots[m.loserTo.slot] = loser;
      console.log("[pickWinner] loser routed →", m.loserTo.id, "slot", m.loserTo.slot, "| was:", destBefore?.name ?? destBefore, "| now:", loser.name);
    }
  } else if (m.bracket === "W" && !loser?.isBye) {
    // Every WB match except the WB Final must have a loserTo for real players.
    const isWBFinal = !m.winnerTo || m.winnerTo.id === "GF-1";
    if (!isWBFinal) {
      console.warn(`[bracket] ${matchId}: WB match has no loserTo — ${loser?.name} will not appear in losers bracket`);
    }
  }

  // Special case: if the LB finalist (slot 1) wins GF-1, trigger a reset final.
  // The WB finalist (slot 0) gets a second chance in GF-2.
  if (matchId === "GF-1" && slotIndex === 1) {
    next["GF-2"].slots[0] = m.slots[0]; // WB finalist
    next["GF-2"].slots[1] = winner;     // LB finalist who just won GF-1
  }

  return next;
}

// Returns the tournament champion, or null if not yet decided.
function getChampion(matches) {
  if (matches["GF-2"].winner) return matches["GF-2"].winner;
  const gf1 = matches["GF-1"];
  // WB finalist (slot 0) winning GF-1 straight — no reset needed.
  if (gf1.winner && gf1.winner.id === gf1.slots[0]?.id) return gf1.winner;
  return null;
}

// Derives player counts. A player is eliminated on their second loss —
// i.e. when they lose a match whose loserTo is null (no path left).
// WB losses always have a loserTo into the LB, so they don't count here.
function getStats(matches, total) {
  const eliminated = new Set();
  Object.values(matches).forEach(m => {
    if (!m.winner) return;
    if (m.loserTo !== null) return; // loser still has a path — not out yet
    const loser = m.slots.find(p => p && !p.isBye && p.id !== m.winner.id);
    if (loser) eliminated.add(loser.id);
  });
  return { total, eliminated: eliminated.size, active: total - eliminated.size };
}

// ---------------------------------------------------------------------------
// Debug helper — reverse-maps winnerTo/loserTo so TBD slots can say where
// their player is supposed to come from. Used only for display; no logic impact.
// ---------------------------------------------------------------------------

function buildSlotSources(matches) {
  const sources = {};
  Object.values(matches).forEach(m => {
    if (m.winnerTo) {
      if (!sources[m.winnerTo.id]) sources[m.winnerTo.id] = {};
      sources[m.winnerTo.id][m.winnerTo.slot] = `winner of ${m.id}`;
    }
    if (m.loserTo) {
      if (!sources[m.loserTo.id]) sources[m.loserTo.id] = {};
      sources[m.loserTo.id][m.loserTo.slot] = `loser of ${m.id}`;
    }
  });
  return sources;
}

// ---------------------------------------------------------------------------
// Layout constants — drives vertical centering and connector geometry
// ---------------------------------------------------------------------------

const CARD_H   = 44;              // match height px (2 rows ~22px each incl. padding + border)
const BASE_GAP =  8;              // gap between cards in a round-1 column
const SLOT_H   = CARD_H + BASE_GAP;  // 52 — vertical space each R1 match "owns"
const COL_W    = 128;             // match-card column width px
const CONN_W   = 32;              // pixel width of each connector SVG strip
const LABEL_H  = 20;              // pixel height of a round-column label row
const BAND_SPACER = 48;           // vertical gap between WB and LB bands on unified canvas

// Unified bracket canvas — live as of 2026-06-11 (legacy renderer kept as fallback)
const USE_UNIFIED_CANVAS = true;

// Gap between match cards in a WB column at round-index r (1-based).
// Doubles with each round so later rounds space out to stay centered on their feeders.
function wbGapFor(r) { return Math.pow(2, r - 1) * SLOT_H - CARD_H; }

// Padding-top for a WB column at round-index r so its first card centers on
// the midpoint between its two R1 feeder matches.
function wbPaddingFor(r) { return (Math.pow(2, r - 1) - 1) * SLOT_H / 2; }

// ---------------------------------------------------------------------------
// UI components
// ---------------------------------------------------------------------------

function MatchCard({ match, onPick, slotSources, scores, onScoreChange, pitNumber, onPitChange }) {
  const { slots, winner, label } = match;
  const ready = slots[0] !== null && slots[1] !== null;
  const done  = winner !== null;
  const matchScores = scores?.[match.id] ?? {};
  const showPitInput  = ready && !done;
  const showPitBadge  = done && !!pitNumber;

  return (
    <div style={{ width: 128, flexShrink: 0, borderRight: "1px solid #5a4030", borderLeft: "1px solid #5a4030" }}>
      {(showPitBadge || showPitInput) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "2px 4px", borderBottom: "1px solid #2a1c0c",
          background: "#0e0904",
        }}>
          <span style={{ fontSize: 9, color: "#7a5840", fontFamily: "var(--font-mono)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Pit
          </span>
          {showPitBadge && (
            <span style={{ fontSize: 10, color: "#c9954a", fontFamily: "var(--font-mono)", fontWeight: 700 }}>
              {pitNumber}
            </span>
          )}
          {showPitInput && (
            <input
              type="text"
              inputMode="numeric"
              value={pitNumber ?? ""}
              placeholder="—"
              onClick={e => e.stopPropagation()}
              onChange={e => onPitChange?.(match.id, e.target.value)}
              style={{
                width: 28, fontSize: 10, textAlign: "center",
                background: "transparent", border: "none",
                borderBottom: "1px solid #3a2810", borderRadius: 0,
                color: "#c9954a", fontFamily: "var(--font-mono)",
                padding: "0 2px", outline: "none", flexShrink: 0,
              }}
            />
          )}
        </div>
      )}
      {[0, 1].map(i => {
        const p         = slots[i];
        const isWinner  = done && p?.id === winner?.id;
        const isLoser   = done && p?.id !== winner?.id;
        const clickable = !done && ready && p != null && !p?.isBye;
        const isBye     = p?.isBye;
        const isTbd     = !p;
        const showScore = !isBye && !isTbd && (ready || done);

        const nameColor = isWinner ? "#2fa66a"
                        : isLoser  ? "#5a4030"
                        : isBye    ? "#4a3420"
                        : isTbd    ? "#4a3420"
                        : clickable ? "#e0b96f"
                        : "#9b8461";

        const displayName = p
          ? (p.isBye ? "BYE" : p.name)
          : (slotSources?.[match.id]?.[i] ? `← ${slotSources[match.id][i]}` : "—");

        return (
          <div
            key={i}
            onClick={() => clickable && onPick(match.id, i)}
            title={clickable ? `Pick ${p.name} as winner` : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "3px 0",
              borderBottom: "1px solid #3a2810",
              cursor: clickable ? "pointer" : "default",
              userSelect: "none",
            }}
            onMouseEnter={e => { if (clickable) e.currentTarget.querySelector(".mcard-name").style.color = "#c9954a"; }}
            onMouseLeave={e => { if (clickable) e.currentTarget.querySelector(".mcard-name").style.color = nameColor; }}
          >
            <span className="mcard-name" style={{
              fontSize: 11,
              fontFamily: isBye || isTbd ? "var(--font-mono)" : "Georgia, serif",
              fontStyle: isBye || isTbd ? "italic" : "normal",
              color: nameColor,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              opacity: isLoser ? 0.5 : 1,
            }}>
              {displayName}
            </span>
            {showScore && (
              <input
                type="text"
                inputMode="numeric"
                value={matchScores[i] ?? ""}
                onClick={e => e.stopPropagation()}
                onChange={e => onScoreChange?.(match.id, i, e.target.value)}
                style={{
                  width: 28,
                  fontSize: 10,
                  textAlign: "center",
                  background: "transparent",
                  border: "none",
                  borderBottom: "1px solid #3a2810",
                  borderRadius: 0,
                  color: isWinner ? "#2fa66a" : isLoser ? "#5a4030" : "#9b8461",
                  fontFamily: "var(--font-mono)",
                  padding: "0 2px",
                  outline: "none",
                  flexShrink: 0,
                  opacity: isLoser ? 0.5 : 1,
                }}
              />
            )}
            {isWinner && <span style={{ fontSize: 9, color: "#2fa66a", flexShrink: 0 }}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}

// A vertical stack of MatchCards under a round label.
// roundIndex (1-based) drives WB centering math; omit for LB/Finals (flat layout).
function RoundCol({ label, matchIds, matches, onPick, slotSources, roundIndex, scores, onScoreChange, pits, onPitChange }) {
  const gap = roundIndex != null ? wbGapFor(roundIndex)    : BASE_GAP;
  const pt  = roundIndex != null ? wbPaddingFor(roundIndex) : 0;
  return (
    <div style={{ width: 128, flexShrink: 0 }}>
      <div style={{
        fontSize: 10, color: "#7a5840", textAlign: "center",
        letterSpacing: "0.15em", textTransform: "uppercase",
        fontFamily: "var(--font-mono)",
        borderBottom: "1px solid #3a2810",
        paddingBottom: 5, marginBottom: 2,
      }}>{label}</div>
      <div style={{ paddingTop: pt }}>
        {matchIds.map((id, i) => (
          <div key={id}>
            {i > 0 && <div style={{ height: gap }} />}
            <MatchCard match={matches[id]} onPick={onPick} slotSources={slotSources} scores={scores} onScoreChange={onScoreChange} pitNumber={pits?.[id]} onPitChange={onPitChange} />
          </div>
        ))}
      </div>
    </div>
  );
}

// SVG connector strip drawn between two consecutive WB columns.
// Renders one ⊢-shaped fork per match-pair: two horizontal stubs → vertical bar → one output stub.
function WbConnectors({ leftRoundIndex, numLeft }) {
  const leftPt   = wbPaddingFor(leftRoundIndex);
  const leftGap  = wbGapFor(leftRoundIndex);
  const rightPt  = wbPaddingFor(leftRoundIndex + 1);
  const rightGap = wbGapFor(leftRoundIndex + 1);
  const numPairs = Math.floor(numLeft / 2);
  const midX     = CONN_W / 2;
  const svgH     = LABEL_H + leftPt + numLeft * CARD_H + Math.max(0, numLeft - 1) * leftGap + 10;

  const lines = [];
  for (let j = 0; j < numPairs; j++) {
    const yTop = LABEL_H + leftPt  + (2 * j)     * (CARD_H + leftGap)  + CARD_H / 2;
    const yBot = LABEL_H + leftPt  + (2 * j + 1) * (CARD_H + leftGap)  + CARD_H / 2;
    const yMid = LABEL_H + rightPt + j            * (CARD_H + rightGap) + CARD_H / 2;
    lines.push(
      <line key={`h1-${j}`} x1={0}      y1={yTop} x2={midX}   y2={yTop} />,
      <line key={`h2-${j}`} x1={0}      y1={yBot} x2={midX}   y2={yBot} />,
      <line key={`vt-${j}`} x1={midX}   y1={yTop} x2={midX}   y2={yBot} />,
      <line key={`ho-${j}`} x1={midX}   y1={yMid} x2={CONN_W} y2={yMid} />,
    );
  }

  return (
    <svg width={CONN_W} height={svgH}
      style={{ flexShrink: 0, display: "block", overflow: "visible", alignSelf: "flex-start" }}
    >
      <g stroke="#8a6840" strokeWidth={1.5} fill="none">
        {lines}
      </g>
    </svg>
  );
}

// Straight connector strip for 1:1 LB transitions — one horizontal line per match pair.
function LbStraightConnectors({ roundIndex, numMatches }) {
  const pt  = wbPaddingFor(roundIndex);
  const gap = wbGapFor(roundIndex);
  const svgH = LABEL_H + pt + numMatches * CARD_H + Math.max(0, numMatches - 1) * gap + 10;
  const lines = [];
  for (let i = 0; i < numMatches; i++) {
    const y = LABEL_H + pt + i * (CARD_H + gap) + CARD_H / 2;
    lines.push(<line key={i} x1={0} y1={y} x2={CONN_W} y2={y} />);
  }
  return (
    <svg width={CONN_W} height={svgH}
      style={{ flexShrink: 0, display: "block", overflow: "visible", alignSelf: "flex-start" }}>
      <g stroke="#8a6840" strokeWidth={1.5} fill="none">{lines}</g>
    </svg>
  );
}

// A bracket section (WB / LB / Finals) with an engraved gold header.
function Section({ title, accentColor, children, colGap = 14 }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderBottom: "1px solid #2a1c0c", paddingBottom: 8 }}>
        <span style={{ color: "#5a4030", fontSize: 12 }}>◆</span>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.2em",
          textTransform: "uppercase", color: accentColor,
          fontFamily: "Georgia, serif",
        }}>{title}</span>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: colGap, alignItems: "flex-start", minWidth: "max-content" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// Unified-canvas-only spacing — printed-diagram proportions. The legacy
// renderer keeps COL_W / CONN_W / CARD_H / BASE_GAP untouched.
const U_COL_W       = 210;             // match width (longer team lines)
const U_CONN_W      = 46;              // gap between columns (shorter elbows)
const U_CARD_H      = 60;              // match height (slot rows 30px each)
const U_BASE_GAP    = 30;              // gap between matches in a round-1 column
const U_SLOT_H      = U_CARD_H + U_BASE_GAP;
const U_BAND_SPACER = 96;              // vertical gap between WB and LB bands
const U_GF_EXTRA    = 120;             // extra horizontal room before Grand Final

// Metric sets: live view uses U_METRICS (the constants above); the static
// Reference/Print view passes its own R_METRICS for print-style proportions.
// All geometry helpers default to U_METRICS, so existing calls are unchanged.
const U_METRICS = {
  colW: U_COL_W, connW: U_CONN_W, cardH: U_CARD_H,
  slotH: U_SLOT_H, bandSpacer: U_BAND_SPACER, gfExtra: U_GF_EXTRA,
};

// Unified-only versions of wbGapFor / wbPaddingFor (same formulas, metric-driven).
function uGapFor(r, M = U_METRICS)     { return Math.pow(2, r - 1) * M.slotH - M.cardH; }
function uPaddingFor(r, M = U_METRICS) { return (Math.pow(2, r - 1) - 1) * M.slotH / 2; }

// Shared X for a column index on the unified grid (WB and LB use the same column slots).
function unifiedColumnX(col, M = U_METRICS) { return col * (M.colW + M.connW); }

// Top Y for a match card inside a band (roundIndex 1-based, matchIndex 0-based).
function unifiedMatchY(bandTop, roundIndex, matchIndex, M = U_METRICS) {
  return bandTop + LABEL_H + uPaddingFor(roundIndex, M) + matchIndex * (M.cardH + uGapFor(roundIndex, M));
}

// Column stack height for connector / band sizing.
function unifiedColumnHeight(roundIndex, numMatches, M = U_METRICS) {
  return LABEL_H + uPaddingFor(roundIndex, M) + numMatches * M.cardH
    + Math.max(0, numMatches - 1) * uGapFor(roundIndex, M) + 10;
}

// Build positioned nodes + connector specs for the unified canvas (Phase 2A).
function buildUnifiedLayout(wbCols, lbCols, M = U_METRICS) {
  const numCols     = lbCols.length;
  const canvasWidth = numCols * M.colW + Math.max(0, numCols - 1) * M.connW;
  const wbBandTop   = 0;
  // Max over all WB columns — identical to col-0 height for full first
  // columns, but stays correct when play-in filtering shrinks column 0.
  const wbBandHeight = Math.max(...wbCols.map(col =>
    unifiedColumnHeight(col.roundIndex, col.ids.length, M)));

  let mergeLevel = 1;
  let lbBandHeight = 0;
  lbCols.forEach((col, i) => {
    const roundIndex = mergeLevel + 1;
    lbBandHeight = Math.max(lbBandHeight, unifiedColumnHeight(roundIndex, col.ids.length, M));
    if (i < lbCols.length - 1 && lbCols[i + 1].ids.length < col.ids.length) mergeLevel++;
  });

  const lbBandTop    = wbBandHeight + M.bandSpacer;
  const canvasHeight = lbBandTop + lbBandHeight;

  const nodes = [];

  wbCols.forEach((col, colIdx) => {
    col.ids.forEach((matchId, matchIndex) => {
      nodes.push({
        matchId,
        band: "wb",
        col: colIdx,
        x: unifiedColumnX(colIdx, M),
        y: unifiedMatchY(wbBandTop, col.roundIndex, matchIndex, M),
        roundIndex: col.roundIndex,
      });
    });
  });

  mergeLevel = 1;
  lbCols.forEach((col, colIdx) => {
    const roundIndex = mergeLevel + 1;
    col.ids.forEach((matchId, matchIndex) => {
      nodes.push({
        matchId,
        band: "lb",
        col: colIdx,
        x: unifiedColumnX(colIdx, M),
        y: unifiedMatchY(lbBandTop, roundIndex, matchIndex, M),
        roundIndex,
      });
    });
    if (colIdx < lbCols.length - 1 && lbCols[colIdx + 1].ids.length < col.ids.length) mergeLevel++;
  });

  // Finals convergence columns (display-only): GF-1 one stride right of the
  // last shared column, vertically centered between the WB and LB finals;
  // GF-2 (reset final) one further stride right.
  const wbFinalNode = nodes.find(n => n.band === "wb" && n.col === wbCols.length - 1);
  const lbFinalNode = nodes.find(n => n.band === "lb" && n.col === lbCols.length - 1);
  let gfNodes = null;
  if (wbFinalNode && lbFinalNode) {
    const wbFinalCenterY = wbFinalNode.y + M.cardH / 2;
    const lbFinalCenterY = lbFinalNode.y + M.cardH / 2;
    const gfY  = (wbFinalCenterY + lbFinalCenterY) / 2 - M.cardH / 2;
    const gf1  = { matchId: "GF-1", band: "finals", col: numCols,     x: unifiedColumnX(numCols, M)     + M.gfExtra,     y: gfY };
    const gf2  = { matchId: "GF-2", band: "finals", col: numCols + 1, x: unifiedColumnX(numCols + 1, M) + 2 * M.gfExtra, y: gfY };
    nodes.push(gf1, gf2);
    gfNodes = { gf1, gf2, wbFinalNode, lbFinalNode };
  }

  return {
    // +28 tail allowance keeps the last match-number span inside the canvas.
    canvasWidth: canvasWidth + (gfNodes ? 2 * (M.colW + M.connW) + 2 * M.gfExtra + 28 : 0),
    canvasHeight,
    wbBandTop,
    lbBandTop,
    nodes,
    gfNodes,
  };
}

// --- Phase 2A-slot: graph-driven, slot-accurate connector endpoints (display only) ---

function unifiedSlotCenterY(nodeY, slotIndex, M = U_METRICS) {
  const rowH = M.cardH / 2;
  return nodeY + slotIndex * rowH + rowH / 2;
}

function unifiedSourceOutPoint(node, M = U_METRICS) {
  return { x: node.x + M.colW, y: node.y + M.cardH / 2 };
}

function unifiedDestInPoint(node, slotIndex, M = U_METRICS) {
  return { x: node.x, y: unifiedSlotCenterY(node.y, slotIndex, M) };
}

// winnerTo edges only; skips missing nodes, non-adjacent columns, and Finals (GF-*).
function buildUnifiedDisplayEdges(matches, nodeById) {
  const edges = [];
  Object.values(matches).forEach(m => {
    if (!m.winnerTo) return;
    const src = nodeById[m.id];
    const dst = nodeById[m.winnerTo.id];
    if (!src || !dst) return;
    if (dst.col !== src.col + 1) return;
    edges.push({
      kind: "winner",
      sourceId: m.id,
      destId: m.winnerTo.id,
      destSlot: m.winnerTo.slot,
    });
  });
  return edges;
}

// 3-segment elbow: source out → gap midpoint → dest slot in.
function unifiedEdgePath(edge, nodeById, M = U_METRICS) {
  const src = nodeById[edge.sourceId];
  const dst = nodeById[edge.destId];
  const out = unifiedSourceOutPoint(src, M);
  const inn = unifiedDestInPoint(dst, edge.destSlot, M);
  const midX = src.x + M.colW + M.connW / 2;
  return [
    { x1: out.x, y1: out.y, x2: midX, y2: out.y },
    { x1: midX, y1: out.y, x2: midX, y2: inn.y },
    { x1: midX, y1: inn.y, x2: inn.x, y2: inn.y },
  ];
}

// Sequential display numbers for visible nodes, reference style: column-major
// (left to right), WB band before LB within a column, top to bottom. Pure
// display mapping — match ids and routing are untouched.
function buildUnifiedDisplayNumbers(nodes) {
  const bandOrder = { wb: 0, lb: 1, finals: 2 };
  const ordered = [...nodes].sort((a, b) =>
    a.x - b.x || bandOrder[a.band] - bandOrder[b.band] || a.y - b.y);
  const nums = {};
  ordered.forEach((n, i) => { nums[n.matchId] = i + 1; });
  return nums;
}

// Diamond-style feed label for a TBD slot. Loser feeds show "L7" (loser of
// display-match 7); winner feeds show nothing — the connector line already
// communicates the path. Display-only transform of slotSources text.
function compactFeedLabel(sourceText, displayNums) {
  if (!sourceText) return null;
  const m = /^(loser|winner) of (.+)$/.exec(sourceText);
  if (!m) return sourceText;
  if (m[1] === "winner") return null;
  const n = displayNums?.[m[2]];
  return n != null ? `L${n}` : `L ${m[2]}`;
}

// Plain Diamond Scheduler-style match node — unified canvas only.
// No box, no theme: each slot is black text sitting on a thin black rule.
// Row height is locked to U_CARD_H/2 so connector endpoint math holds.
function UnifiedMatchNode({ match, onPick, slotSources, scores, onScoreChange, pitNumber, onPitChange, displayNums }) {
  const { slots, winner } = match;
  const ready = slots[0] !== null && slots[1] !== null;
  const done  = winner !== null;
  const matchScores = scores?.[match.id] ?? {};
  const showPitInput = ready && !done;
  const showPitBadge = done && !!pitNumber;

  return (
    <div style={{ width: U_COL_W, flexShrink: 0, background: "transparent" }}>
      {[0, 1].map(i => {
        const p         = slots[i];
        const isWinner  = done && p?.id === winner?.id;
        const isLoser   = done && p?.id !== winner?.id;
        const clickable = !done && ready && p != null && !p?.isBye;
        const isBye     = p?.isBye;
        const isTbd     = !p;
        const showScore = !isBye && !isTbd && (ready || done);
        const feed      = isTbd ? compactFeedLabel(slotSources?.[match.id]?.[i], displayNums) : null;

        const displayName = p ? (p.isBye ? "BYE" : p.name) : (feed ?? "");

        return (
          <div
            key={i}
            className="uslot"
            onClick={() => clickable && onPick(match.id, i)}
            title={clickable ? `Pick ${p.name} as winner` : undefined}
            style={{
              boxSizing: "border-box",
              height: U_CARD_H / 2,
              display: "flex",
              alignItems: "flex-end",
              gap: 4,
              padding: "0 2px 1px 2px",
              borderBottom: "1px solid #000",
              cursor: clickable ? "pointer" : "default",
              userSelect: "none",
              background: "transparent",
            }}
          >
            <span style={{
              fontSize: isBye || isTbd ? 10 : 12,
              fontFamily: "Arial, Helvetica, sans-serif",
              fontStyle: isBye || isTbd ? "italic" : "normal",
              fontWeight: isWinner ? 700 : 400,
              color: isBye ? "#aaa" : isTbd ? "#999" : isLoser ? "#999" : "#000",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {displayName}
            </span>
            {showScore && (
              <input
                type="text"
                inputMode="numeric"
                className={(matchScores[i] ?? "") === "" ? "uempty" : undefined}
                value={matchScores[i] ?? ""}
                onClick={e => e.stopPropagation()}
                onChange={e => onScoreChange?.(match.id, i, e.target.value)}
                style={{
                  width: 24, fontSize: 10, textAlign: "center",
                  background: "transparent", border: "none", borderRadius: 0,
                  color: isLoser ? "#999" : "#000",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  padding: 0, outline: "none", flexShrink: 0,
                }}
              />
            )}
            {(showPitInput || showPitBadge) && i === 0 && (
              showPitInput ? (
                <input
                  type="text"
                  inputMode="numeric"
                  className={(pitNumber ?? "") === "" ? "uempty" : undefined}
                  value={pitNumber ?? ""}
                  placeholder="pit"
                  onClick={e => e.stopPropagation()}
                  onChange={e => onPitChange?.(match.id, e.target.value)}
                  style={{
                    width: 20, fontSize: 8, textAlign: "center",
                    background: "transparent", border: "none",
                    borderBottom: (pitNumber ?? "") === "" ? "1px dotted #bbb" : "none",
                    borderRadius: 0,
                    color: "#999", fontFamily: "Arial, Helvetica, sans-serif",
                    padding: 0, outline: "none", flexShrink: 0,
                  }}
                />
              ) : (
                <span style={{ fontSize: 8, color: "#aaa", fontFamily: "Arial, Helvetica, sans-serif", flexShrink: 0 }}>
                  P{pitNumber}
                </span>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

// Display-only play-in filter for the unified canvas (mirrors the legacy
// renderer's play-in logic). Drops BYE-containing R1 matches from the WB and
// LB first columns — those players already appear in the next round via the
// engine's existing auto-advance. No engine data is read beyond slot.isBye.
function filterUnifiedPlayInCols(matches, cols) {
  if (!cols.length) return cols;
  const realIds = cols[0].ids.filter(id => !matches[id]?.slots?.some(s => s?.isBye));
  if (realIds.length === cols[0].ids.length) return cols; // no BYEs — unchanged
  return [{ ...cols[0], label: "Play-In", ids: realIds }, ...cols.slice(1)];
}

// Phase 2A unified canvas — one positioned grid, WB upper band, LB lower band, SVG overlay.
function UnifiedBracketCanvas({ matches, onPick, slotSources, wbCols, lbCols, scores, onScoreChange, pits, onPitChange, playerCount }) {
  // All sizes use graph-driven slot edges, so play-in filtering is safe
  // everywhere: edges are computed from actual node coordinates, never from
  // first-column match counts.
  const wbDisplayCols = filterUnifiedPlayInCols(matches, wbCols);
  const lbDisplayCols = filterUnifiedPlayInCols(matches, lbCols);
  const layout = buildUnifiedLayout(wbDisplayCols, lbDisplayCols);
  const nodeById = Object.fromEntries(layout.nodes.map(n => [n.matchId, n]));
  const displayNums = buildUnifiedDisplayNumbers(layout.nodes);
  // Graph-driven slot edges for all template sizes (8/16/32).
  const allLines = buildUnifiedDisplayEdges(matches, nodeById).flatMap((edge, i) =>
    unifiedEdgePath(edge, nodeById).map((line, j) => ({ ...line, key: `e${i}-${j}` }))
  );

  // Finals convergence (display-only): WB final → GF-1 slot 0, LB final → GF-1 slot 1.
  if (layout.gfNodes) {
    const { gf1, wbFinalNode, lbFinalNode } = layout.gfNodes;
    [[wbFinalNode, 0], [lbFinalNode, 1]].forEach(([srcNode, slot], i) => {
      const out  = unifiedSourceOutPoint(srcNode);
      const inn  = unifiedDestInPoint(gf1, slot);
      const midX = gf1.x - U_CONN_W / 2;
      allLines.push(
        { key: `gf-${i}-a`, x1: out.x, y1: out.y, x2: midX, y2: out.y },
        { key: `gf-${i}-b`, x1: midX,  y1: out.y, x2: midX, y2: inn.y },
        { key: `gf-${i}-c`, x1: midX,  y1: inn.y, x2: inn.x, y2: inn.y },
      );
    });
  }

  // Dashed "if first loss" continuation: GF-1 → GF-2 slot rows.
  const dashedLines = [];
  if (layout.gfNodes) {
    const { gf1, gf2 } = layout.gfNodes;
    const out  = unifiedSourceOutPoint(gf1);
    const midX = gf2.x - U_CONN_W / 2;
    [0, 1].forEach(slot => {
      const inn = unifiedDestInPoint(gf2, slot);
      dashedLines.push(
        { key: `rst-${slot}-a`, x1: out.x, y1: out.y, x2: midX, y2: out.y },
        { key: `rst-${slot}-b`, x1: midX,  y1: out.y, x2: midX, y2: inn.y },
        { key: `rst-${slot}-c`, x1: midX,  y1: inn.y, x2: inn.x, y2: inn.y },
      );
    });
  }

  const sansFont = "Arial, Helvetica, sans-serif";

  // Fit-to-page scale: the bracket's internal coordinates are untouched; the
  // whole rendered canvas is scaled down with a CSS transform so the full
  // diagram fits the viewport without page scrolling.
  const TITLE_H = 76;
  const totalW  = layout.canvasWidth  + 24;            // + horizontal padding
  const totalH  = layout.canvasHeight + TITLE_H + 24;  // + title + vertical padding
  // Readability floor: never scale below this. Small brackets fit well above
  // it; large ones (32 players) hit the floor and scroll inside the bracket
  // viewport only — page-level scrolling is never caused by the bracket.
  const U_MIN_SCALE = 0.5;
  const viewportRef = useRef(null);
  const [view, setView] = useState({ scale: 1, maxH: null });
  useEffect(() => {
    const measure = () => {
      const el = viewportRef.current;
      if (!el) return;
      const availW = el.clientWidth;
      // Budget one full screen of height: the bracket always fits a single
      // viewport, regardless of how much header content sits above it.
      const availH = window.innerHeight - 32;
      // -6px guard absorbs subpixel rounding so a hairline overflow never
      // produces a spurious scrollbar.
      const fit = Math.min((availW - 6) / totalW, (availH - 6) / totalH, 1);
      setView({ scale: Math.max(fit, U_MIN_SCALE), maxH: availH });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [totalW, totalH]);
  const scale = view.scale;

  return (
    <div ref={viewportRef} style={{
      width: "100%",
      // Internal scroll only when the floored scale overflows the viewport.
      overflow: "auto",
      maxHeight: view.maxH ?? undefined,
    }}>
      <div style={{ width: totalW * scale, height: totalH * scale, margin: "0 auto" }}>
      <div style={{
        position: "relative",
        width: layout.canvasWidth,
        height: layout.canvasHeight + TITLE_H,
        background: "#fff",
        color: "#000",
        padding: "8px 12px 16px",
        borderRadius: 2,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
      }}>
        {/* Empty score/pit inputs stay invisible until the row is hovered or
            the input is focused — handlers and data untouched. */}
        <style>{`
          .uslot input.uempty { opacity: 0; }
          .uslot:hover input.uempty, .uslot input.uempty:focus { opacity: 1; }
        `}</style>
        {/* Centered title, reference style */}
        <div style={{
          position: "absolute", left: 0, top: 12, width: "100%",
          textAlign: "center", fontSize: 36, fontWeight: 700,
          fontFamily: sansFont, color: "#000", zIndex: 2,
          pointerEvents: "none",
        }}>{playerCount ? `${playerCount} Team Double Elimination` : "Double Elimination"}</div>
        {/* Band labels, Diamond Scheduler style */}
        <div style={{
          position: "absolute", left: 6, top: TITLE_H + layout.wbBandTop - 4,
          fontSize: 15, fontFamily: sansFont, color: "#000", zIndex: 2,
        }}>Winner's Bracket</div>
        <div style={{
          position: "absolute", left: 6, top: TITLE_H + layout.lbBandTop - 22,
          fontSize: 15, fontFamily: sansFont, color: "#000", zIndex: 2,
        }}>Loser's Bracket</div>

        <svg
          width={layout.canvasWidth}
          height={layout.canvasHeight}
          style={{ position: "absolute", top: 8 + TITLE_H, left: 12, pointerEvents: "none", overflow: "visible" }}
        >
          <g stroke="#000" strokeWidth={1} fill="none">
            {allLines.map(line => (
              <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
            ))}
          </g>
          <g stroke="#000" strokeWidth={1} fill="none" strokeDasharray="6 5">
            {dashedLines.map(line => (
              <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
            ))}
          </g>
        </svg>
        {layout.gfNodes && (
          <div style={{
            position: "absolute",
            left: layout.gfNodes.gf2.x - U_CONN_W + 12,
            top: TITLE_H + layout.gfNodes.gf2.y + 8 + U_CARD_H + 28,
            fontSize: 12, fontFamily: sansFont, color: "#000",
            whiteSpace: "nowrap", zIndex: 2,
          }}>If First Loss</div>
        )}
        {layout.nodes.map(node => (
          <div
            key={node.matchId}
            style={{ position: "absolute", left: node.x + 12, top: TITLE_H + node.y + 8, width: U_COL_W, zIndex: 1 }}
          >
            <UnifiedMatchNode match={matches[node.matchId]} onPick={onPick} slotSources={slotSources} scores={scores} onScoreChange={onScoreChange} pitNumber={pits?.[node.matchId]} onPitChange={onPitChange} displayNums={displayNums} />
            {/* Match number — tiny annotation, softened, clear of elbows */}
            <span style={{
              position: "absolute", left: U_COL_W + 6, top: U_CARD_H / 2 - 15,
              fontSize: 8, fontFamily: sansFont, color: "#555",
              whiteSpace: "nowrap", pointerEvents: "none",
            }}>({displayNums[node.matchId]}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}

// Print-style proportions for the Reference view — much airier than the live
// board, tuned against the Diamond Scheduler sheet. Display-only.
const R_METRICS = {
  colW: 210, connW: 30, cardH: 56,
  slotH: 56 + 36, bandSpacer: 72, gfExtra: 100,
};

// Reference / Print View — a static, display-only skin over the same layout
// data as UnifiedBracketCanvas. No inputs, no handlers, no pit UI: plain text
// on thin black rules, Diamond Scheduler style. Match data is read-only.
function ReferenceBracketView({ matches, slotSources, wbCols, lbCols, scores, playerCount }) {
  const M = R_METRICS;
  const wbDisplayCols = filterUnifiedPlayInCols(matches, wbCols);
  const lbDisplayCols = filterUnifiedPlayInCols(matches, lbCols);
  const layout = buildUnifiedLayout(wbDisplayCols, lbDisplayCols, M);
  const nodeById = Object.fromEntries(layout.nodes.map(n => [n.matchId, n]));

  // Pass A — play-in destination alignment (display-only, Reference View only).
  // When BYE filtering produced a play-in column, slide each surviving col-0
  // node so its output midline meets its winnerTo destination slot, like the
  // Diamond Scheduler sheet. winnerTo is read-only; edges follow node coords.
  // Reference-only pipe anchors: connectors attach to the VISIBLE rule lines
  // (each slot row's bottom border), not slot centers. Every match gets a
  // vertical merge segment closing the bracket "]"; the output leaves from
  // that segment's midpoint — classic printed-bracket pipes.
  const refRuleY = (node, slot) => node.y + (slot + 1) * (M.cardH / 2);
  const refOut   = (node) => ({ x: node.x + M.colW, y: node.y + 0.75 * M.cardH });
  const refIn    = (node, slot) => ({ x: node.x, y: refRuleY(node, slot) });
  const refEdgePath = (srcNode, destNode, destSlot) => {
    const out  = refOut(srcNode);
    const inn  = refIn(destNode, destSlot);
    const midX = destNode.x - M.connW / 2;
    return [
      { x1: out.x, y1: out.y, x2: midX, y2: out.y },
      { x1: midX,  y1: out.y, x2: midX, y2: inn.y },
      { x1: midX,  y1: inn.y, x2: inn.x, y2: inn.y },
    ];
  };

  const alignPlayIn = (cols, band) => {
    if (cols[0]?.label !== "Play-In") return;
    layout.nodes.forEach(n => {
      if (n.band !== band || n.col !== 0) return;
      const dest = matches[n.matchId]?.winnerTo;
      const dn = dest && nodeById[dest.id];
      if (!dn) return;
      // Output midpoint (0.75·cardH) flows straight into the destination rule.
      n.y = refRuleY(dn, dest.slot) - 0.75 * M.cardH;
    });
  };
  alignPlayIn(wbDisplayCols, "wb");
  alignPlayIn(lbDisplayCols, "lb");
  // Shifted nodes must not clip the canvas bottom.
  layout.canvasHeight = Math.max(layout.canvasHeight,
    ...layout.nodes.map(n => n.y + M.cardH + 10));

  const displayNums = buildUnifiedDisplayNumbers(layout.nodes);

  const allLines = buildUnifiedDisplayEdges(matches, nodeById).flatMap((edge, i) =>
    refEdgePath(nodeById[edge.sourceId], nodeById[edge.destId], edge.destSlot)
      .map((line, j) => ({ ...line, key: `e${i}-${j}` }))
  );
  // Vertical merge segment at the right edge of every match (GF-2's is dashed
  // to match the conditional reset styling).
  layout.nodes.forEach(n => {
    if (n.matchId === "GF-2") return;
    allLines.push({
      key: `mrg-${n.matchId}`,
      x1: n.x + M.colW, y1: refRuleY(n, 0),
      x2: n.x + M.colW, y2: refRuleY(n, 1),
    });
  });
  if (layout.gfNodes) {
    const { gf1, wbFinalNode, lbFinalNode } = layout.gfNodes;
    [[wbFinalNode, 0], [lbFinalNode, 1]].forEach(([srcNode, slot], i) => {
      refEdgePath(srcNode, gf1, slot).forEach((line, j) =>
        allLines.push({ ...line, key: `gf-${i}-${j}` }));
    });
  }
  const dashedLines = [];
  if (layout.gfNodes) {
    const { gf1, gf2 } = layout.gfNodes;
    [0, 1].forEach(slot => {
      refEdgePath(gf1, gf2, slot).forEach((line, j) =>
        dashedLines.push({ ...line, key: `rst-${slot}-${j}` }));
    });
    dashedLines.push({
      key: "mrg-GF-2",
      x1: gf2.x + M.colW, y1: refRuleY(gf2, 0),
      x2: gf2.x + M.colW, y2: refRuleY(gf2, 1),
    });
  }

  const sansFont = "Arial, Helvetica, sans-serif";
  const TITLE_H = 110;
  const totalW  = layout.canvasWidth  + 24;
  const totalH  = layout.canvasHeight + TITLE_H + 24;
  const viewportRef = useRef(null);
  const [view, setView] = useState({ scale: 1, maxH: null });
  useEffect(() => {
    const measure = () => {
      const el = viewportRef.current;
      if (!el) return;
      const availW = el.clientWidth;
      const availH = window.innerHeight - 32;
      const fit = Math.min((availW - 6) / totalW, (availH - 6) / totalH, 1);
      setView({ scale: fit, maxH: availH });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [totalW, totalH]);
  const scale = view.scale;

  return (
    <div ref={viewportRef} style={{ width: "100%", overflow: "auto", maxHeight: view.maxH ?? undefined }}>
      <div style={{ width: totalW * scale, height: totalH * scale, margin: "0 auto" }}>
        <div style={{
          position: "relative",
          width: layout.canvasWidth,
          height: layout.canvasHeight + TITLE_H,
          background: "#fff",
          color: "#000",
          padding: "8px 12px 16px",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          userSelect: "none",
        }}>
          <div style={{
            position: "absolute", left: 0, top: 12, width: "100%",
            textAlign: "center", fontSize: 58, fontWeight: 700,
            fontFamily: sansFont, color: "#000", lineHeight: 1.1,
          }}>{playerCount ? `${playerCount} Team Double Elimination` : "Double Elimination"}</div>
          <div style={{
            position: "absolute", left: 12, top: TITLE_H + layout.wbBandTop - 2,
            fontSize: 18, fontWeight: 700, fontFamily: sansFont, color: "#000",
          }}>Winner's Bracket</div>
          <div style={{
            position: "absolute", left: 12, top: TITLE_H + layout.lbBandTop - 24,
            fontSize: 18, fontWeight: 700, fontFamily: sansFont, color: "#000",
          }}>Loser's Bracket</div>

          <svg
            width={layout.canvasWidth}
            height={layout.canvasHeight}
            style={{ position: "absolute", top: 8 + TITLE_H, left: 12, pointerEvents: "none", overflow: "visible" }}
          >
            <g stroke="#000" strokeWidth={1} fill="none">
              {allLines.map(line => (
                <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              ))}
            </g>
            <g stroke="#000" strokeWidth={1} fill="none" strokeDasharray="6 5">
              {dashedLines.map(line => (
                <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
              ))}
            </g>
          </svg>
          {layout.gfNodes && (
            <div style={{
              position: "absolute",
              left: layout.gfNodes.gf2.x - M.connW + 12,
              top: TITLE_H + layout.gfNodes.gf2.y + 8 + M.cardH + 32,
              fontSize: 13, fontFamily: sansFont, color: "#000",
              whiteSpace: "nowrap",
            }}>If First Loss</div>
          )}
          {layout.nodes.map(node => {
            const m = matches[node.matchId];
            const matchScores = scores?.[node.matchId] ?? {};
            const done = m.winner !== null;
            return (
              <div
                key={node.matchId}
                style={{ position: "absolute", left: node.x + 12, top: TITLE_H + node.y + 8, width: M.colW }}
              >
                {[0, 1].map(i => {
                  const p = m.slots[i];
                  const isWinner = done && p?.id === m.winner?.id;
                  const isLoser  = done && p?.id !== m.winner?.id;
                  const isBye = p?.isBye;
                  const isTbd = !p;
                  const feed = isTbd ? compactFeedLabel(slotSources?.[node.matchId]?.[i], displayNums) : null;
                  const name = p ? (p.isBye ? "BYE" : p.name) : (feed ?? "");
                  const score = !isBye && !isTbd ? (matchScores[i] ?? "") : "";
                  return (
                    <div key={i} style={{
                      boxSizing: "border-box", height: M.cardH / 2,
                      display: "flex", alignItems: "flex-end", gap: 4,
                      padding: "0 18px 1px 2px", borderBottom: "1px solid #000",
                    }}>
                      <span style={{
                        fontSize: isBye || isTbd ? 8 : 10,
                        fontFamily: sansFont,
                        fontStyle: isBye || isTbd ? "italic" : "normal",
                        fontWeight: isWinner ? 700 : 400,
                        color: isBye || isTbd ? "#bbb" : isLoser ? "#aaa" : "#000",
                        flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{name}</span>
                      {score !== "" && (
                        <span style={{ fontSize: 8, color: "#666", fontFamily: sansFont, flexShrink: 0 }}>{score}</span>
                      )}
                    </div>
                  );
                })}
                {/* Match number — at rule boundary, right of the node, inside connector gap */}
                <span style={{
                  position: "absolute", right: -M.connW + 4, top: M.cardH / 2 - 8,
                  fontSize: 9, fontFamily: sansFont, color: "#000", whiteSpace: "nowrap",
                }}>({displayNums[node.matchId]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App({ storageKey = STORAGE_KEY, onBack, onBackToSetup, initialNames, initialPlayerCount }) {
  const [playerCount, setPlayerCount] = useState(8);
  const [names,       setNames]       = useState([...DEFAULT_NAMES_8]);
  const [matches,     setMatches]     = useState(null);
  const [history,     setHistory]     = useState([]);
  const [exporting,   setExporting]   = useState(false);
  const [tournamentName, setTournamentName] = useState("");
  const [showDebug,    setShowDebug]    = useState(false);
  const [countInput,   setCountInput]   = useState("8");
  const [validation,   setValidation]   = useState(null); // null = not run yet
  const [humanPickMade, setHumanPickMade] = useState(false);
  const [scores,       setScores]       = useState({});
  const [pits,         setPits]         = useState({});
  const [viewMode,     setViewMode]     = useState("live"); // "live" | "reference"

  // Mirrors for reading inside persist without stale closures.
  const scoresRef = useRef({});
  const pitsRef   = useRef({});

  // Ref attached to the bracket wrapper div — html2canvas uses it as the target.
  const bracketRef = useRef(null);

  // Walks every match in the current graph and checks all winnerTo / loserTo
  // references. For 32-player brackets, also runs a dedicated WB routing check
  // that instantiates a fresh 32p graph (independent of live state) so it can
  // catch broken routes even before any matches are played.
  // Returns { errors: string[], valid: bool }. Does not mutate any state.
  const validateBracket = () => {
    const errors = [];

    // ── Pass 1: validate the live match graph ────────────────────────────────
    const validateGraph = (graph, label) => {
      const ids = new Set(Object.keys(graph));

      Object.values(graph).forEach(m => {
        const pfx = label ? `[${label}] ${m.id}` : m.id;

        // winnerTo must be null or point to a known match with a valid slot.
        if (m.winnerTo !== null) {
          if (!m.winnerTo.id) {
            errors.push(`${pfx}: winnerTo is missing an id field`);
          } else if (!ids.has(m.winnerTo.id)) {
            errors.push(`${pfx}: winnerTo references unknown match "${m.winnerTo.id}"`);
          } else if (m.winnerTo.slot !== 0 && m.winnerTo.slot !== 1) {
            errors.push(`${pfx}: winnerTo.slot is "${m.winnerTo.slot}" — must be 0 or 1`);
          }
        }

        // loserTo must be null or point to a known match with a valid slot.
        if (m.loserTo !== null) {
          if (!m.loserTo.id) {
            errors.push(`${pfx}: loserTo is missing an id field`);
          } else if (!ids.has(m.loserTo.id)) {
            errors.push(`${pfx}: loserTo references unknown match "${m.loserTo.id}"`);
          } else if (m.loserTo.slot !== 0 && m.loserTo.slot !== 1) {
            errors.push(`${pfx}: loserTo.slot is "${m.loserTo.slot}" — must be 0 or 1`);
          }
        }

        // slots must be a two-element array.
        if (!Array.isArray(m.slots) || m.slots.length !== 2) {
          errors.push(`${pfx}: slots is not a 2-element array`);
        }

        // bracket must be a known value.
        if (!["W", "L", "GF"].includes(m.bracket)) {
          errors.push(`${pfx}: unknown bracket type "${m.bracket}"`);
        }
      });

      // GF-1 and GF-2 must always exist — the finals logic references them by name.
      ["GF-1", "GF-2"].forEach(required => {
        if (!ids.has(required)) {
          errors.push(`${label ? `[${label}] ` : ""}Required match "${required}" is missing`);
        }
      });
    };

    validateGraph(matches, "");

    // ── Pass 2: 32-player WB routing check (always runs when viewing 32p) ───
    // Builds a fresh, independent 32p graph from placeholder players so every
    // WB match's loserTo can be verified regardless of live tournament state.
    if (playerCount === 32) {
      const placeholders = Array.from({ length: 32 }, (_, i) => ({
        id: `v${i + 1}`, name: `Seat ${i + 1}`,
      }));
      const graph32 = buildMatches32(placeholders);
      const ids32   = new Set(Object.keys(graph32));

      // Every WB match except the WB Final must have a non-null loserTo.
      // The WB Final is the one whose winnerTo is GF-1.
      const wbFinalId = Object.values(graph32).find(
        m => m.bracket === "W" && m.winnerTo?.id === "GF-1"
      )?.id;

      Object.values(graph32)
        .filter(m => m.bracket === "W")
        .forEach(m => {
          const pfx = `[32p WB] ${m.id}`;
          const isWBFinal = m.id === wbFinalId;

          if (isWBFinal) {
            // WB Final: loserTo must point to the LB Final (L8-1).
            if (!m.loserTo) {
              errors.push(`${pfx}: WB Final has no loserTo — loser won't enter LB Final`);
            } else if (!ids32.has(m.loserTo.id)) {
              errors.push(`${pfx}: WB Final loserTo references unknown match "${m.loserTo.id}"`);
            }
          } else {
            // All other WB matches: loserTo must be non-null and valid.
            if (!m.loserTo) {
              errors.push(`${pfx}: missing loserTo — loser will not appear in losers bracket`);
            } else if (!ids32.has(m.loserTo.id)) {
              errors.push(`${pfx}: loserTo references unknown match "${m.loserTo.id}"`);
            } else if (m.loserTo.slot !== 0 && m.loserTo.slot !== 1) {
              errors.push(`${pfx}: loserTo.slot is "${m.loserTo.slot}" — must be 0 or 1`);
            } else {
              // Verify the destination match is in the losers bracket.
              const dest = graph32[m.loserTo.id];
              if (dest && dest.bracket !== "L") {
                errors.push(`${pfx}: loserTo points to a ${dest.bracket}-bracket match ("${m.loserTo.id}") — should be L`);
              }
            }
          }
        });

      // Check no two WB matches write to the same LB slot (slot collision).
      const written = {};
      Object.values(graph32)
        .filter(m => m.bracket === "W" && m.loserTo)
        .forEach(m => {
          const key = `${m.loserTo.id}[${m.loserTo.slot}]`;
          if (written[key]) {
            errors.push(`[32p WB] slot collision: both ${written[key]} and ${m.id} write to ${key}`);
          } else {
            written[key] = m.id;
          }
        });
    }

    return { errors, valid: errors.length === 0 };
  };

  // Captures the bracket div as a PNG and triggers a download.
  // html2canvas is loaded dynamically so it doesn't add to the initial bundle.
  const handleExport = async () => {
    if (!bracketRef.current || exporting) return;
    setExporting(true);
    try {
      const html2canvas = (await import("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.esm.min.js")).default;
      const canvas = await html2canvas(bracketRef.current, {
        backgroundColor: null, // preserve the page background
        scale: 2,              // 2× for sharper text on retina screens
        useCORS: true,
      });
      const link = document.createElement("a");
      const safeName = tournamentName.trim().replace(/[^a-z0-9\-_ ]/gi, "").replace(/\s+/g, "-") || `bracket-${playerCount}p`;
      link.download = `${safeName}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed. See console for details.");
    } finally {
      setExporting(false);
    }
  };

  // Restore saved bracket on first load, or initialise with defaults.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const { matches: m, names: n, playerCount: pc, tournamentName: tn = "", humanPickMade: hpm = false, scores: sc = {}, pits: pt = {} } = JSON.parse(saved);
        setMatches(m);
        setNames(n);
        setPlayerCount(pc);
        setCountInput(String(pc));
        setTournamentName(tn);
        setHumanPickMade(hpm);
        setScores(sc);
        scoresRef.current = sc;
        setPits(pt);
        pitsRef.current = pt;
        return;
      }
    } catch (e) {}
    // Nothing saved — build a fresh bracket from initialNames if provided, else defaults.
    if (initialNames && initialNames.length >= 2) {
      const count = Math.max(3, Math.min(32, initialPlayerCount ?? initialNames.length));
      const names = initialNames.slice(0, count);
      setPlayerCount(count);
      setCountInput(String(count));
      setNames(names);
      const templateSize  = bracketSizeFor(count);
      const realPlayers   = names.map((name, i) => ({ id: `p${i + 1}`, name }));
      const paddedPlayers = padWithByes(realPlayers, templateSize);
      const m = autoAdvanceByes(buildMatches(paddedPlayers));
      setMatches(m);
      persist(m, names, count, false);
      return;
    }
    const players = DEFAULT_NAMES_8.map((name, i) => ({ id: `p${i + 1}`, name }));
    setMatches(buildMatches(players));
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Saves the full bracket state to localStorage after every change.
  // tournamentName is read directly from state — no need to pass it as an arg
  // since it's only updated via its own handler which persists immediately.
  const persist = (m, n, pc, hpm = humanPickMade) => {
    try { localStorage.setItem(storageKey, JSON.stringify({ matches: m, names: n, playerCount: pc, tournamentName, humanPickMade: hpm, scores: scoresRef.current, pits: pitsRef.current })); } catch (e) {}
  };

  // Updates the tournament name and saves it to localStorage straight away.
  const handleTournamentNameChange = (value) => {
    setTournamentName(value);
    try {
      const saved = localStorage.getItem(storageKey);
      const base  = saved ? JSON.parse(saved) : {};
      localStorage.setItem(storageKey, JSON.stringify({ ...base, tournamentName: value }));
    } catch (e) {}
  };

  // True once a human has manually picked a winner in a real match.
  const anyResultPicked = humanPickMade;

  // Builds a fresh bracket from a name list and makes it current.
  // Pads to the template size with BYEs, then auto-advances BYE matches.
  const applyNames = (updatedNames, count = playerCount, hpm = humanPickMade) => {
    const templateSize  = bracketSizeFor(count);
    const realPlayers   = updatedNames.map((name, i) => ({
      id: `p${i + 1}`,
      name: name.trim() || `Player ${i + 1}`,
    }));
    const paddedPlayers = padWithByes(realPlayers, templateSize);
    const raw = buildMatches(paddedPlayers);
    const m   = autoAdvanceByes(raw);
    setMatches(m);
    persist(m, updatedNames, count, hpm);
  };

  // Switches player count (3-32). Generates default names and rebuilds bracket.
  const handleCountChange = (count) => {
    const clamped      = Math.max(3, Math.min(32, count));
    const defaultNames = Array.from({ length: clamped }, (_, i) => `Player ${i + 1}`);
    setPlayerCount(clamped);
    setCountInput(String(clamped));
    setNames(defaultNames);
    setHistory([]);
    applyNames(defaultNames, clamped);
  };

  // Called when a name input changes before play starts.
  // Rebuilds the bracket immediately so WB R1 cards update in real time.
  const handleNameChange = (i, value) => {
    if (anyResultPicked) return;
    const updated = [...names];
    updated[i] = value;
    setNames(updated);
    applyNames(updated);
  };

  const handleScoreChange = (matchId, slotIndex, value) => {
    setScores(prev => {
      const next = { ...prev, [matchId]: { ...prev[matchId], [slotIndex]: value } };
      scoresRef.current = next;
      try {
        const saved = localStorage.getItem(storageKey);
        const base  = saved ? JSON.parse(saved) : {};
        localStorage.setItem(storageKey, JSON.stringify({ ...base, scores: next }));
      } catch (e) {}
      return next;
    });
  };

  const handlePitChange = (matchId, value) => {
    setPits(prev => {
      const trimmed = value.trim();
      const next = trimmed ? { ...prev, [matchId]: trimmed } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== matchId));
      pitsRef.current = next;
      try {
        const saved = localStorage.getItem(storageKey);
        const base  = saved ? JSON.parse(saved) : {};
        localStorage.setItem(storageKey, JSON.stringify({ ...base, pits: next }));
      } catch (e) {}
      return next;
    });
  };

  const handlePick = (matchId, slotIndex) => {
    setHumanPickMade(true);
    setMatches(prev => {
      const afterPick = pickWinner(prev, matchId, slotIndex);
      if (afterPick === prev) return prev; // no-op — don't push history
      // Re-run BYE advances: the pick may have filled a slot next to a BYE,
      // creating a new walkover that needs to be resolved immediately.
      const next = autoAdvanceByes(afterPick);
      setHistory(h => [...h, prev]);
      persist(next, names, playerCount, true);
      return next;
    });
  };

  // Restores the most recent pre-pick snapshot.
  const handleUndo = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setMatches(snapshot);
      persist(snapshot, names, playerCount);
      return prev.slice(0, -1);
    });
  };

  // Wipes all results but keeps the same players and unlocks name editing.
  const handleRestartTournament = () => {
    setHumanPickMade(false);
    setHistory([]);
    setScores({});
    scoresRef.current = {};
    setPits({});
    pitsRef.current = {};
    applyNames(names, playerCount, false);
  };

  // Resets everything to defaults for the current player count.
  const handleReset = () => {
    const defaultNames = Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`);
    localStorage.removeItem(storageKey);
    setHumanPickMade(false);
    setHistory([]);
    setScores({});
    scoresRef.current = {};
    setPits({});
    pitsRef.current = {};
    setNames(defaultNames);
    applyNames(defaultNames, playerCount, false);
  };

  // Deletes the saved bracket from localStorage without changing the live state.
  // Useful when you want to start fresh on next page load without resetting now.
  const handleClearSaved = () => {
    localStorage.removeItem(storageKey);
  };

  if (!matches) return null;
  const templateSize = bracketSizeFor(playerCount);

  // -- Bracket screen --------------------------------------------------------

  const champion    = getChampion(matches);
  const stats       = getStats(matches, playerCount);
  const slotSources = buildSlotSources(matches);
  const gf1       = matches["GF-1"];
  const showReset = gf1.winner !== null && gf1.winner.id === gf1.slots[1]?.id;

  // Bracket layout definitions — each entry is one RoundCol.
  const wbCols = templateSize === 32
    ? [
        { label: "Round 1",  ids: ["W1-1","W1-2","W1-3","W1-4","W1-5","W1-6","W1-7","W1-8","W1-9","W1-10","W1-11","W1-12","W1-13","W1-14","W1-15","W1-16"], roundIndex: 1 },
        { label: "Round 2",  ids: ["W2-1","W2-2","W2-3","W2-4","W2-5","W2-6","W2-7","W2-8"], roundIndex: 2 },
        { label: "Round 3",  ids: ["W3-1","W3-2","W3-3","W3-4"], roundIndex: 3 },
        { label: "Round 4",  ids: ["W4-1","W4-2"], roundIndex: 4 },
        { label: "WB Final", ids: ["W5-1"], roundIndex: 5 },
      ]
    : templateSize === 16
    ? [
        { label: "Round 1",  ids: ["W1-1","W1-2","W1-3","W1-4","W1-5","W1-6","W1-7","W1-8"], roundIndex: 1 },
        { label: "Round 2",  ids: ["W2-1","W2-2","W2-3","W2-4"], roundIndex: 2 },
        { label: "Round 3",  ids: ["W3-1","W3-2"], roundIndex: 3 },
        { label: "WB Final", ids: ["W4-1"], roundIndex: 4 },
      ]
    : [
        { label: "Round 1",  ids: ["W1-1","W1-2","W1-3","W1-4"], roundIndex: 1 },
        { label: "Round 2",  ids: ["W2-1","W2-2"], roundIndex: 2 },
        { label: "WB Final", ids: ["W3-1"], roundIndex: 3 },
      ];

  const lbCols = templateSize === 32
    ? [
        { label: "Round 1", ids: ["L1-1","L1-2","L1-3","L1-4","L1-5","L1-6","L1-7","L1-8"] },
        { label: "Round 2", ids: ["L2-1","L2-2","L2-3","L2-4","L2-5","L2-6","L2-7","L2-8"] },
        { label: "Round 3", ids: ["L3-1","L3-2","L3-3","L3-4"] },
        { label: "Round 4", ids: ["L4-1","L4-2","L4-3","L4-4"] },
        { label: "Round 5", ids: ["L5-1","L5-2"] },
        { label: "Round 6", ids: ["L6-1","L6-2"] },
        { label: "Round 7", ids: ["L7-1"] },
        { label: "LB Final", ids: ["L8-1"] },
      ]
    : templateSize === 16
    ? [
        { label: "Round 1", ids: ["L1-1","L1-2","L1-3","L1-4"] },
        { label: "Round 2", ids: ["L2-1","L2-2","L2-3","L2-4"] },
        { label: "Round 3", ids: ["L3-1","L3-2"] },
        { label: "Round 4", ids: ["L4-1","L4-2"] },
        { label: "Round 5", ids: ["L5-1"] },
        { label: "LB Final", ids: ["L6-1"] },
      ]
    : [
        { label: "Round 1", ids: ["L1-1","L1-2"] },
        { label: "Round 2", ids: ["L2-1","L2-2"] },
        { label: "Round 3", ids: ["L3-1"] },
        { label: "LB Final", ids: ["L4-1"] },
      ];

  const gridCols = templateSize >= 16 ? "repeat(8, 1fr)" : "repeat(4, 1fr)";

  // Play-in display logic — purely visual, no bracket data is read or written.
  // Filters WB R1 to only real-vs-real matches. BYE matches are hidden; those
  // players already appear in Round 2 via the existing auto-advance logic.
  const wbR1Ids    = wbCols[0].ids;
  const playInIds  = wbR1Ids.filter(id => !matches[id]?.slots?.some(s => s?.isBye));
  const allR1Real  = playInIds.length === wbR1Ids.length; // perfect power-of-2 — no change
  const wbMainCols = allR1Real ? wbCols : wbCols.slice(1); // skip R1 col when BYEs present

  // LB play-in — same display-only filter applied to Losers Bracket Round 1.
  const lbR1Ids       = lbCols[0].ids;
  const lbPlayInIds   = lbR1Ids.filter(id => !matches[id]?.slots?.some(s => s?.isBye));
  const allLbR1Real   = lbPlayInIds.length === lbR1Ids.length;
  const lbMainCols    = allLbR1Real ? lbCols : lbCols.slice(1);

  const goldBtn = (disabled) => ({
    fontSize: 12, padding: "5px 11px", borderRadius: 2, cursor: disabled ? "not-allowed" : "pointer",
    border: "1px solid #c9954a", background: "#120d08",
    color: disabled ? "#5a4030" : "#c9954a",
    fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
    opacity: disabled ? 0.45 : 1,
  });
  const mutedBtn = {
    fontSize: 12, padding: "5px 11px", borderRadius: 2, cursor: "pointer",
    border: "1px solid #3a2810", background: "#120d08",
    color: "#5a4030", fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
  };

  return (
    <div ref={bracketRef} style={{ padding: "1.25rem 1rem", maxWidth: 1200, margin: "0 auto" }}>
      <img src="/godfathers-logo.png" alt="Godfathers Horseshoe Tournament"
        style={{ display: "block", margin: "0 auto 20px", width: "90%", maxWidth: 720, height: "auto" }} />
      {/* Back navigation */}
      <div style={{ display: "flex", gap: 20, marginBottom: 12 }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: "none", border: "none",
            color: "#5a4030", cursor: "pointer", fontSize: 12, padding: 0,
            fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
          }}>← ALL TOURNAMENTS</button>
        )}
        {onBackToSetup && !anyResultPicked && (
          <button onClick={() => onBackToSetup(names, playerCount)} style={{
            background: "none", border: "none",
            color: "#5a4030", cursor: "pointer", fontSize: 12, padding: 0,
            fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
          }}>← EDIT SETUP</button>
        )}
      </div>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 10, marginBottom: 20,
        borderBottom: "1px solid #2a1c0c", paddingBottom: 16,
      }}>
        <div>
          {/* Editable tournament name */}
          <input
            value={tournamentName}
            onChange={e => handleTournamentNameChange(e.target.value)}
            placeholder={`Double elimination — ${playerCount} player${playerCount !== 1 ? "s" : ""}`}
            style={{
              fontSize: 22, fontWeight: 600,
              background: "transparent",
              border: "none",
              borderBottom: "1.5px solid transparent",
              borderRadius: 0,
              color: "#e0b96f",
              fontFamily: "Georgia, serif",
              padding: "0 0 2px 0",
              width: "100%",
              maxWidth: 480,
              outline: "none",
              cursor: "text",
            }}
            onFocus={e => e.target.style.borderBottomColor = "#5a4030"}
            onBlur={e  => e.target.style.borderBottomColor = "transparent"}
          />
          {champion && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              marginTop: 6, padding: "5px 14px",
              border: "1px solid #c9954a", borderRadius: 2,
              background: "#120d08",
            }}>
              <span style={{ color: "#c9954a", fontSize: 14 }}>◆</span>
              <span style={{ color: "#e0b96f", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", letterSpacing: "0.06em" }}>
                {champion.name} — CHAMPION
              </span>
              <span style={{ color: "#c9954a", fontSize: 14 }}>◆</span>
            </div>
          )}
          <p style={{ color: "#5a4030", fontSize: 12, margin: "5px 0 0", fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
            {anyResultPicked
              ? "CLICK A PLAYER IN ANY READY MATCH TO MARK AS WINNER"
              : "EDIT PLAYER NAMES BELOW — THEN CLICK A MATCH TO START"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Stats block */}
          <div style={{
            display: "flex", alignItems: "stretch",
            border: "1px solid #3a2810", borderRadius: 2, overflow: "hidden",
          }}>
            {[
              { label: "Total",      value: stats.total,      color: "#9b8461" },
              { label: "Active",     value: stats.active,     color: "#2fa66a" },
              { label: "Eliminated", value: stats.eliminated, color: "#6b3020" },
            ].map(({ label, value, color }, i, arr) => (
              <div key={label} style={{
                padding: "4px 12px", background: "#120d08",
                borderRight: i < arr.length - 1 ? "1px solid #3a2810" : "none",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}>
                <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1, fontFamily: "Georgia, serif" }}>{value}</span>
                <span style={{ fontSize: 9, color: "#3a2810", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>{label}</span>
              </div>
            ))}
          </div>
          <button onClick={handleExport} disabled={exporting} style={goldBtn(exporting)}>
            {exporting ? "Exporting…" : "Export PNG"}
          </button>
          {USE_UNIFIED_CANVAS && (
            <button onClick={() => setViewMode(v => v === "live" ? "reference" : "live")} style={goldBtn(false)}>
              {viewMode === "live" ? "Print View" : "Live View"}
            </button>
          )}
          <button onClick={handleUndo} disabled={history.length === 0} style={goldBtn(history.length === 0)}>
            Undo
          </button>
          <button onClick={handleRestartTournament} style={goldBtn(false)}>Reset</button>
          <button onClick={handleReset} style={mutedBtn}>Clear all</button>
          <button onClick={handleClearSaved} style={mutedBtn}>Clear saved</button>
          <button onClick={() => setShowDebug(v => !v)} style={{
            ...mutedBtn,
            border: showDebug ? "1px solid #2fa66a" : "1px solid #3a2810",
            color: showDebug ? "#2fa66a" : "#5a4030",
            background: showDebug ? "#0a1810" : "#120d08",
          }}>{showDebug ? "Hide debug" : "Debug"}</button>
          <button onClick={() => setValidation(validateBracket())} style={{
            ...mutedBtn,
            border: validation === null ? "1px solid #3a2810" : validation.valid ? "1px solid #2fa66a" : "1px solid #9b2f1f",
            color: validation === null ? "#5a4030" : validation.valid ? "#2fa66a" : "#c0392b",
          }}>Validate</button>
        </div>
      </div>

      {/* Player count selector + name roster */}
      <div style={{
        background: "#120d08",
        borderRadius: 2,
        border: "1px solid #3a2810",
        padding: "12px 16px",
        marginBottom: 24,
      }}>
        {/* Count selector — only shown before play starts */}
        {!anyResultPicked && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, color: "#5a4030", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
              Players
            </span>
            {[4, 8, 16, 32].map(count => (
              <button
                key={count}
                onClick={() => handleCountChange(count)}
                style={{
                  fontSize: 12, padding: "3px 10px", borderRadius: 2,
                  border: playerCount === count ? "1px solid #c9954a" : "1px solid #3a2810",
                  background: playerCount === count ? "#1e140a" : "#18110b",
                  color: playerCount === count ? "#c9954a" : "#9b8461",
                  fontFamily: "var(--font-mono)",
                  cursor: "pointer",
                }}
              >{count}</button>
            ))}
            <span style={{ fontSize: 9, color: "#5a4030", marginLeft: 4, fontFamily: "var(--font-mono)" }}>or</span>
            <input
              type="text"
              value={countInput}
              onChange={e => {
                const raw = e.target.value;
                setCountInput(raw);
                const v = parseInt(raw, 10);
                if (!isNaN(v) && v >= 3 && v <= 32) handleCountChange(v);
              }}
              style={{
                width: 48, fontSize: 12, textAlign: "center", fontFamily: "var(--font-mono)",
                background: "#18110b", border: "1px solid #3a2810", borderRadius: 2,
                color: "#9b8461", padding: "2px 4px",
              }}
            />
            {countInput !== "" && (() => { const v = parseInt(countInput, 10); return (isNaN(v) || v < 3 || v > 32); })() && (
              <span style={{ fontSize: 10, color: "#9b2f1f", fontFamily: "var(--font-mono)" }}>3–32</span>
            )}
            {templateSize !== playerCount && (
              <span style={{ fontSize: 10, color: "#5a4030", fontFamily: "var(--font-mono)" }}>
                → {templateSize}-slot, {templateSize - playerCount} BYE{templateSize - playerCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}

        <div style={{
          fontSize: 9, color: "#3a2810",
          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10,
          fontFamily: "var(--font-mono)",
        }}>
          {anyResultPicked ? "PLAYERS — LOCKED DURING TOURNAMENT" : "NAMES — EDIT BEFORE PLAY STARTS"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 5, maxWidth: "100%" }}>
          {names.map((name, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
              <span style={{
                fontSize: 10, color: "#3a2810",
                fontFamily: "var(--font-mono)", minWidth: 18, textAlign: "right", flexShrink: 0,
              }}>{i + 1}</span>
              <input
                value={name}
                onChange={e => handleNameChange(i, e.target.value)}
                placeholder={`Player ${i + 1}`}
                disabled={anyResultPicked}
                style={{
                  flex: 1, minWidth: 0, boxSizing: "border-box",
                  fontSize: 12, fontFamily: "var(--font-mono)",
                  background: "transparent", border: "none", borderBottom: "1px solid #2a1c0c",
                  borderRadius: 0, color: "#9b8461", padding: "2px 0",
                  outline: "none",
                  opacity: anyResultPicked ? 0.45 : 1,
                  cursor: anyResultPicked ? "not-allowed" : "text",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bracket sections */}
      {USE_UNIFIED_CANVAS && viewMode === "reference" ? (
        <ReferenceBracketView
          matches={matches}
          slotSources={slotSources}
          wbCols={wbCols}
          lbCols={lbCols}
          scores={scores}
          playerCount={playerCount}
        />
      ) : USE_UNIFIED_CANVAS ? (
        <UnifiedBracketCanvas
          matches={matches}
          onPick={handlePick}
          slotSources={slotSources}
          wbCols={wbCols}
          lbCols={lbCols}
          playerCount={playerCount}
          scores={scores}
          onScoreChange={handleScoreChange}
          pits={pits}
          onPitChange={handlePitChange}
        />
      ) : (
        <>
          <Section title="Winners bracket" accentColor="#c9954a" colGap={0}>
            {!allR1Real && playInIds.length > 0 && (
              <div style={{ marginTop: wbPaddingFor(wbMainCols[0].roundIndex) }}>
                <RoundCol label="Play-In" matchIds={playInIds} matches={matches}
                  onPick={handlePick} slotSources={slotSources} scores={scores} onScoreChange={handleScoreChange} pits={pits} onPitChange={handlePitChange} />
              </div>
            )}
            {!allR1Real && playInIds.length > 0 && (
              <div style={{ width: 14, flexShrink: 0 }} />
            )}
            {wbMainCols.flatMap((col, i) => {
              const items = [
                <RoundCol key={col.label} label={col.label} matchIds={col.ids} matches={matches}
                  onPick={handlePick} slotSources={slotSources} roundIndex={col.roundIndex} scores={scores} onScoreChange={handleScoreChange} pits={pits} onPitChange={handlePitChange} />,
              ];
              if (i < wbMainCols.length - 1)
                items.push(<WbConnectors key={`conn-${i}`} leftRoundIndex={col.roundIndex} numLeft={col.ids.length} />);
              return items;
            })}
          </Section>

          <Section title="Losers bracket" accentColor="#9b8461" colGap={0}>
            {!allLbR1Real && lbPlayInIds.length > 0 && (
              <div style={{ marginTop: wbPaddingFor(2) }}>
                <RoundCol label="Play-In" matchIds={lbPlayInIds} matches={matches}
                  onPick={handlePick} slotSources={slotSources} scores={scores} onScoreChange={handleScoreChange} pits={pits} onPitChange={handlePitChange} />
              </div>
            )}
            {(() => {
              let mergeLevel = 1;
              return lbMainCols.flatMap((col, i) => {
                const roundIndex = mergeLevel + 1;
                const items = [
                  <RoundCol key={col.label} label={col.label} matchIds={col.ids}
                    matches={matches} onPick={handlePick} slotSources={slotSources}
                    roundIndex={roundIndex} scores={scores} onScoreChange={handleScoreChange} pits={pits} onPitChange={handlePitChange} />,
                ];
                if (i < lbMainCols.length - 1) {
                  const isMerge = lbMainCols[i + 1].ids.length < col.ids.length;
                  if (isMerge) {
                    items.push(<WbConnectors key={`lb-conn-${i}`} leftRoundIndex={roundIndex} numLeft={col.ids.length} />);
                    mergeLevel++;
                  } else {
                    items.push(<LbStraightConnectors key={`lb-conn-${i}`} roundIndex={roundIndex} numMatches={col.ids.length} />);
                  }
                }
                return items;
              });
            })()}
          </Section>

          <Section title="Finals" accentColor="#e0b96f">
            <RoundCol label="Grand Final" matchIds={["GF-1"]} matches={matches} onPick={handlePick} slotSources={slotSources} scores={scores} onScoreChange={handleScoreChange} pits={pits} onPitChange={handlePitChange} />
            {showReset && (
              <RoundCol label="Reset Final" matchIds={["GF-2"]} matches={matches} onPick={handlePick} slotSources={slotSources} scores={scores} onScoreChange={handleScoreChange} pits={pits} onPitChange={handlePitChange} />
            )}
          </Section>
        </>
      )}

      {/* Validation panel — shown after Validate Bracket is clicked */}
      {validation !== null && (
        <div style={{
          marginTop: 28,
          background: "var(--color-background-secondary)",
          border: `0.5px solid ${validation.valid ? "var(--color-border-success)" : "#D85A30"}`,
          borderRadius: "var(--border-radius-md)",
          overflow: "hidden",
        }}>
          <div style={{
            padding: "8px 16px",
            borderBottom: `0.5px solid ${validation.valid ? "var(--color-border-success)" : "#D85A30"}`,
            fontSize: 11,
            color: validation.valid ? "var(--color-text-success)" : "#D85A30",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: validation.valid ? "var(--color-background-success)" : "rgba(216,90,48,0.08)",
          }}>
            <span>{validation.valid ? "✓ Bracket valid" : `✗ ${validation.errors.length} error${validation.errors.length !== 1 ? "s" : ""} found`}</span>
            <span style={{ fontFamily: "var(--font-mono)" }}>
              {Object.keys(matches).length} matches checked{playerCount === 32 ? " + 32p WB routing" : ""}
            </span>
          </div>
          {validation.valid ? (
            <p style={{
              margin: 0, padding: "12px 16px",
              fontSize: 12, color: "var(--color-text-secondary)",
              fontFamily: "var(--font-mono)",
            }}>
              All winnerTo and loserTo references resolve to real matches.
              Slots are 0 or 1. GF-1 and GF-2 are present.
            </p>
          ) : (
            <ul style={{ margin: 0, padding: "12px 16px 12px 32px", display: "flex", flexDirection: "column", gap: 4 }}>
              {validation.errors.map((err, i) => (
                <li key={i} style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#D85A30", lineHeight: 1.5 }}>
                  {err}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Debug panel — toggle with Show Debug button */}
      {showDebug && (() => {
        // Derive winners, losers, and eliminated from live match state.
        const winners   = [];
        const losers    = [];
        const eliminated = [];
        Object.values(matches).forEach(m => {
          if (!m.winner) return;
          const loser = m.slots.find(p => p && p.id !== m.winner.id);
          winners.push({ match: m.id, player: m.winner.name });
          if (loser) {
            if (m.loserTo === null) {
              eliminated.push({ match: m.id, player: loser.name });
            } else {
              losers.push({ match: m.id, player: loser.name, dropsTo: m.loserTo.id });
            }
          }
        });

        const debugData = {
          bracketSize:  playerCount,
          tournamentName: tournamentName || "(unnamed)",
          stats,
          winners,
          losers,
          eliminated,
          matches,
        };

        return (
          <div style={{
            marginTop: 28,
            background: "var(--color-background-secondary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--border-radius-md)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "8px 16px",
              borderBottom: "0.5px solid var(--color-border-tertiary)",
              fontSize: 11,
              color: "var(--color-text-tertiary)",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <span>Debug — live bracket state</span>
              <span style={{ fontFamily: "var(--font-mono)" }}>
                {playerCount}p · {Object.keys(matches).length} matches · {winners.length} decided
              </span>
            </div>
            <pre style={{
              margin: 0,
              padding: "14px 16px",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-secondary)",
              overflowX: "auto",
              whiteSpace: "pre",
              lineHeight: 1.55,
            }}>
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        );
      })()}
    </div>
  );
}
