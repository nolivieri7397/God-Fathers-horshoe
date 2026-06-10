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
// UI components
// ---------------------------------------------------------------------------

function MatchCard({ match, onPick, slotSources }) {
  const { slots, winner, label } = match;
  const ready = slots[0] !== null && slots[1] !== null;
  const done  = winner !== null;

  const isFinals = match.bracket === "GF";
  return (
    <div style={{
      width: 128,
      flexShrink: 0,
      background: "#18110b",
      border: `1px solid ${isFinals ? "#c9954a" : done ? "#2fa66a" : "#2a1c0c"}`,
      borderRadius: 1,
      overflow: "hidden",
    }}>
      {[0, 1].map(i => {
        const p         = slots[i];
        const isWinner  = done && p?.id === winner?.id;
        const isLoser   = done && p?.id !== winner?.id;
        const clickable = !done && ready && p != null && !p?.isBye;
        const isBye     = p?.isBye;
        const isTbd     = !p;

        return (
          <div
            key={i}
            onClick={() => clickable && onPick(match.id, i)}
            title={clickable ? `Pick ${p.name} as winner` : undefined}
            style={{
              padding: "4px 7px",
              display: "flex",
              alignItems: "center",
              gap: 5,
              cursor: clickable ? "pointer" : "default",
              background: isWinner ? "#0a1810" : "transparent",
              borderLeft: isWinner ? "2px solid #2fa66a" : "2px solid transparent",
              borderBottom: i === 0 ? "1px solid #1e160a" : "none",
              opacity: isLoser ? 0.28 : 1,
              userSelect: "none",
              transition: "background 0.1s",
            }}
            onMouseEnter={e => { if (clickable) e.currentTarget.style.background = "#1e160a"; }}
            onMouseLeave={e => { if (clickable) e.currentTarget.style.background = isWinner ? "#0a1810" : "transparent"; }}
          >
            <span style={{
              fontSize: 11,
              fontFamily: isBye || isTbd ? "var(--font-mono)" : "Georgia, serif",
              fontStyle: isBye || isTbd ? "italic" : "normal",
              color: isWinner ? "#2fa66a" : isBye || isTbd ? "#2a1c0c" : "#e0b96f",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {p ? (p.isBye ? "BYE" : p.name) : (slotSources?.[match.id]?.[i] ? `← ${slotSources[match.id][i]}` : "TBD")}
            </span>
            {isWinner && <span style={{ fontSize: 9, color: "#2fa66a" }}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}

// A vertical stack of MatchCards under a round label.
function RoundCol({ label, matchIds, matches, onPick, slotSources }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{
        fontSize: 9,
        color: "#5a4030",
        textAlign: "center",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        fontFamily: "var(--font-mono)",
        borderBottom: "1px solid #1e160a",
        paddingBottom: 5,
        marginBottom: 2,
        width: 128,
      }}>{label}</div>
      {matchIds.map(id => (
        <MatchCard key={id} match={matches[id]} onPick={onPick} slotSources={slotSources} />
      ))}
    </div>
  );
}

// A bracket section (WB / LB / Finals) with an engraved gold header.
function Section({ title, accentColor, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, borderBottom: "1px solid #2a1c0c", paddingBottom: 8 }}>
        <span style={{ color: "#3a2810", fontSize: 12 }}>◆</span>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.2em",
          textTransform: "uppercase", color: accentColor,
          fontFamily: "Georgia, serif",
        }}>{title}</span>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", minWidth: "max-content" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export default function App({ storageKey = STORAGE_KEY, onBack, initialNames, initialPlayerCount }) {
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
        const { matches: m, names: n, playerCount: pc, tournamentName: tn = "", humanPickMade: hpm = false } = JSON.parse(saved);
        setMatches(m);
        setNames(n);
        setPlayerCount(pc);
        setCountInput(String(pc));
        setTournamentName(tn);
        setHumanPickMade(hpm);
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
    try { localStorage.setItem(storageKey, JSON.stringify({ matches: m, names: n, playerCount: pc, tournamentName, humanPickMade: hpm })); } catch (e) {}
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
    applyNames(names, playerCount, false);
  };

  // Resets everything to defaults for the current player count.
  const handleReset = () => {
    const defaultNames = Array.from({ length: playerCount }, (_, i) => `Player ${i + 1}`);
    localStorage.removeItem(storageKey);
    setHumanPickMade(false);
    setHistory([]);
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
        { label: "Round 1", ids: ["W1-1","W1-2","W1-3","W1-4","W1-5","W1-6","W1-7","W1-8","W1-9","W1-10","W1-11","W1-12","W1-13","W1-14","W1-15","W1-16"] },
        { label: "Round 2", ids: ["W2-1","W2-2","W2-3","W2-4","W2-5","W2-6","W2-7","W2-8"] },
        { label: "Round 3", ids: ["W3-1","W3-2","W3-3","W3-4"] },
        { label: "Round 4", ids: ["W4-1","W4-2"] },
        { label: "WB Final", ids: ["W5-1"] },
      ]
    : templateSize === 16
    ? [
        { label: "Round 1", ids: ["W1-1","W1-2","W1-3","W1-4","W1-5","W1-6","W1-7","W1-8"] },
        { label: "Round 2", ids: ["W2-1","W2-2","W2-3","W2-4"] },
        { label: "Round 3", ids: ["W3-1","W3-2"] },
        { label: "WB Final", ids: ["W4-1"] },
      ]
    : [
        { label: "Round 1", ids: ["W1-1","W1-2","W1-3","W1-4"] },
        { label: "Round 2", ids: ["W2-1","W2-2"] },
        { label: "WB Final", ids: ["W3-1"] },
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
      {/* Back to tournament list */}
      {onBack && (
        <button onClick={onBack} style={{
          marginBottom: 12, background: "none", border: "none",
          color: "#5a4030", cursor: "pointer", fontSize: 12, padding: 0,
          fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
        }}>← ALL TOURNAMENTS</button>
      )}
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

        <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 5 }}>
          {names.map((name, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
                  flex: 1, fontSize: 12, fontFamily: "var(--font-mono)",
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
      <Section title="Winners bracket" accentColor="#c9954a">
        {wbCols.map(({ label, ids }) => (
          <RoundCol key={label} label={label} matchIds={ids} matches={matches} onPick={handlePick} slotSources={slotSources} />
        ))}
      </Section>

      <Section title="Losers bracket" accentColor="#9b8461">
        {lbCols.map(({ label, ids }) => (
          <RoundCol key={label} label={label} matchIds={ids} matches={matches} onPick={handlePick} slotSources={slotSources} />
        ))}
      </Section>

      <Section title="Finals" accentColor="#e0b96f">
        <RoundCol label="Grand Final" matchIds={["GF-1"]} matches={matches} onPick={handlePick} slotSources={slotSources} />
        {showReset && (
          <RoundCol label="Reset Final" matchIds={["GF-2"]} matches={matches} onPick={handlePick} slotSources={slotSources} />
        )}
      </Section>

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
