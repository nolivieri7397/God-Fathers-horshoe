import { useState } from "react";

const INDEX_KEY      = "de_tournaments";
const LEGACY_KEY     = "de_bracket_v2";
const KEY_PREFIX     = "de_tournament_";

function storageKeyFor(id) {
  return id === "default" ? LEGACY_KEY : `${KEY_PREFIX}${id}`;
}

function loadIndex() {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // First visit or existing user — seed index from legacy key if it exists.
  const seed = [];
  const legacy = localStorage.getItem(LEGACY_KEY);
  let defaultName = "Tournament";
  if (legacy) {
    try { defaultName = JSON.parse(legacy).tournamentName || "Tournament"; } catch (e) {}
  }
  seed.push({ id: "default", name: defaultName, createdAt: Date.now() });
  saveIndex(seed);
  return seed;
}

function saveIndex(index) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch (e) {}
}

export { storageKeyFor, loadIndex, saveIndex };

export default function TournamentManager({ onOpen, onSetup }) {
  const [index, setIndex] = useState(() => loadIndex());
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const handleCreate = () => {
    const id   = `t_${Date.now()}`;
    const name = "New Tournament";
    const entry = { id, name, createdAt: Date.now() };
    const next = [...index, entry];
    setIndex(next);
    saveIndex(next);
    // Go to setup screen for new tournaments; fall back to direct open if no setup handler.
    if (onSetup) onSetup(id, storageKeyFor(id), name);
    else onOpen(id, storageKeyFor(id));
  };

  const handleOpen = (entry) => {
    onOpen(entry.id, storageKeyFor(entry.id));
  };

  const startRename = (entry) => {
    setEditingId(entry.id);
    setEditingName(entry.name);
  };

  const commitRename = (id) => {
    const trimmed = editingName.trim() || "Untitled";
    const next = index.map(t => t.id === id ? { ...t, name: trimmed } : t);
    setIndex(next);
    saveIndex(next);
    // Also update the name stored inside the bracket data itself.
    const key = storageKeyFor(id);
    try {
      const raw = localStorage.getItem(key);
      const base = raw ? JSON.parse(raw) : {};
      localStorage.setItem(key, JSON.stringify({ ...base, tournamentName: trimmed }));
    } catch (e) {}
    setEditingId(null);
  };

  const handleDelete = (entry) => {
    if (!window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
    localStorage.removeItem(storageKeyFor(entry.id));
    const next = index.filter(t => t.id !== entry.id);
    setIndex(next);
    saveIndex(next);
  };

  return (
    <div style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1rem" }}>
      <img src="/godfathers-logo.png" alt="Godfathers Horseshoe Tournament"
        style={{ display: "block", margin: "0 auto 28px", width: "90%", maxWidth: 720, height: "auto" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "1px solid #2a1c0c", paddingBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#3a2810", fontSize: 12 }}>◆</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#c9954a", fontFamily: "Georgia, serif" }}>
            Tournaments
          </span>
        </div>
        <button onClick={handleCreate} style={{
          fontSize: 12, padding: "5px 14px", borderRadius: 2, cursor: "pointer",
          border: "1px solid #c9954a", background: "#120d08", color: "#c9954a",
          fontFamily: "ui-monospace, Consolas, monospace", letterSpacing: "0.06em",
        }}>+ NEW TOURNAMENT</button>
      </div>

      {index.length === 0 && (
        <p style={{ color: "#3a2810", fontSize: 13, fontFamily: "ui-monospace, Consolas, monospace" }}>
          No tournaments yet. Create one above.
        </p>
      )}

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {index.map(entry => (
          <li key={entry.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "#18110b", border: "1px solid #3a2810",
            borderRadius: 2, padding: "10px 14px",
          }}>
            {editingId === entry.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={() => commitRename(entry.id)}
                onKeyDown={e => { if (e.key === "Enter") commitRename(entry.id); if (e.key === "Escape") setEditingId(null); }}
                style={{
                  flex: 1, fontSize: 14, background: "transparent",
                  border: "none", borderBottom: "1px solid #c9954a",
                  color: "#e0b96f", outline: "none",
                  fontFamily: "Georgia, serif", padding: "0 0 2px 0",
                }}
              />
            ) : (
              <span
                onClick={() => handleOpen(entry)}
                style={{ flex: 1, fontSize: 14, cursor: "pointer", color: "#e0b96f", fontFamily: "Georgia, serif" }}
              >
                {entry.name}
              </span>
            )}
            <button onClick={() => startRename(entry)} title="Rename" style={ghostBtn}>✎</button>
            <button onClick={() => handleOpen(entry)} title="Open" style={{ ...ghostBtn, color: "#c9954a", border: "1px solid #3a2810" }}>Open</button>
            <button onClick={() => handleDelete(entry)} title="Delete" style={{ ...ghostBtn, color: "#6b3020" }}>✕</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const ghostBtn = {
  background: "none", border: "none", cursor: "pointer",
  color: "#5a4030", fontSize: 13,
  padding: "2px 6px", fontFamily: "ui-monospace, Consolas, monospace",
};
