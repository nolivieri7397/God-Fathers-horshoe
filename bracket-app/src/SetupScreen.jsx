import { useState } from "react";

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunkIntoTeams(players, size) {
  const teams = [];
  for (let i = 0; i < players.length; i += size) {
    teams.push(players.slice(i, i + size).join(" / "));
  }
  return teams;
}

export default function SetupScreen({ tournamentName, onGenerate, onBack, initialTeams }) {
  const [playerInput, setPlayerInput] = useState("");
  const [teamSize,    setTeamSize]    = useState(1);
  const [teams,       setTeams]       = useState(initialTeams || []);
  const [warning,     setWarning]     = useState("");

  const individuals = playerInput.split("\n").map(s => s.trim()).filter(Boolean);
  const canRandomize = individuals.length >= 2;

  const handleRandomize = () => {
    const shuffled = shuffleArray(individuals);
    const generated = chunkIntoTeams(shuffled, teamSize);
    setWarning(generated.length > 32 ? `${generated.length} teams generated — only the first 32 will be used.` : "");
    setTeams(generated);
  };

  const handleGenerate = () => {
    if (teams.length < 2) return;
    const capped = teams.slice(0, 32);
    const count  = Math.max(3, capped.length);
    onGenerate(capped.slice(0, count), count);
  };

  const handleTeamNameChange = (i, value) => {
    const next = [...teams];
    next[i] = value;
    setTeams(next);
  };

  const mono = "ui-monospace, Consolas, monospace";

  return (
    <div style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1rem" }}>
      <img src="/godfathers-logo.png" alt="Godfathers Horseshoe Tournament"
        style={{ display: "block", margin: "0 auto 24px", width: "90%", maxWidth: 720, height: "auto" }} />

      <button onClick={onBack} style={{
        background: "none", border: "none", color: "#5a4030",
        cursor: "pointer", fontSize: 12, padding: 0, marginBottom: 20,
        fontFamily: mono, letterSpacing: "0.08em",
      }}>← ALL TOURNAMENTS</button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, borderBottom: "1px solid #2a1c0c", paddingBottom: 10 }}>
        <span style={{ color: "#3a2810", fontSize: 12 }}>◆</span>
        <span style={{ fontSize: 20, fontWeight: 600, color: "#e0b96f", fontFamily: "Georgia, serif" }}>
          {tournamentName || "New Tournament"}
        </span>
      </div>
      <p style={{ margin: "0 0 22px 0", fontSize: 11, color: "#5a4030", fontFamily: mono, letterSpacing: "0.06em" }}>
        ENTER PLAYERS — CHOOSE TEAM SIZE — RANDOMIZE
      </p>

      {/* Player input */}
      <label style={{ fontSize: 9, color: "#5a4030", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: mono }}>
        Players — one per line
      </label>
      <textarea
        value={playerInput}
        onChange={e => { setPlayerInput(e.target.value); setTeams([]); setWarning(""); }}
        placeholder={"Noah\nAlex\nSam\nJordan"}
        rows={8}
        style={{
          display: "block", width: "100%", boxSizing: "border-box",
          marginTop: 6, marginBottom: 14,
          fontSize: 13, fontFamily: mono,
          background: "#120d08", border: "1px solid #3a2810",
          borderRadius: 2, color: "#9b8461",
          padding: "8px 10px", resize: "vertical", outline: "none",
        }}
      />

      {/* Team size */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 9, color: "#5a4030", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: mono }}>
          Team size
        </span>
        {[1, 2, 3, 4].map(sz => (
          <button key={sz} onClick={() => { setTeamSize(sz); setTeams([]); setWarning(""); }} style={{
            fontSize: 12, padding: "3px 12px", borderRadius: 2, fontFamily: mono,
            border: teamSize === sz ? "1px solid #c9954a" : "1px solid #3a2810",
            background: teamSize === sz ? "#1e140a" : "#18110b",
            color: teamSize === sz ? "#c9954a" : "#9b8461",
            cursor: "pointer",
          }}>{sz === 1 ? "1 (individual)" : sz}</button>
        ))}
      </div>

      {/* Randomize */}
      <button
        onClick={handleRandomize}
        disabled={!canRandomize}
        style={{
          fontSize: 12, padding: "6px 18px", borderRadius: 2, fontFamily: mono,
          border: "1px solid #c9954a", background: "#120d08",
          color: canRandomize ? "#c9954a" : "#5a4030",
          cursor: canRandomize ? "pointer" : "not-allowed",
          marginBottom: 20, letterSpacing: "0.06em",
          opacity: canRandomize ? 1 : 0.45,
        }}
      >RANDOMIZE TEAMS</button>

      {/* Warning */}
      {warning && (
        <p style={{ fontSize: 12, color: "#9b2f1f", margin: "-12px 0 16px 0", fontFamily: mono }}>{warning}</p>
      )}

      {/* Team preview */}
      {teams.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 9, color: "#3a2810", fontFamily: mono,
            letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4,
          }}>
            {teams.length > 32 ? "Teams (first 32 will be used)" : `Teams — ${Math.min(teams.length, 32)} bracket participants`}
          </div>
          <div style={{
            fontSize: 11, color: "#9b8461", fontFamily: mono,
            marginBottom: 10, letterSpacing: "0.04em",
          }}>
            ✎ Edit team names below before generating the bracket
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {teams.slice(0, 32).map((name, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 10, color: "#3a2810", fontFamily: mono, minWidth: 22, textAlign: "right",
                }}>{i + 1}</span>
                <input
                  value={name}
                  onChange={e => handleTeamNameChange(i, e.target.value)}
                  title="Click to rename this team"
                  style={{
                    flex: 1, fontSize: 13, fontFamily: mono,
                    background: "#120d08", border: "1px solid #5a4030",
                    borderRadius: 2, color: "#e0b96f", padding: "4px 8px", outline: "none",
                  }}
                  onFocus={e => e.target.style.borderColor = "#c9954a"}
                  onBlur={e => e.target.style.borderColor = "#5a4030"}
                />
                <span style={{ fontSize: 11, color: "#5a4030", fontFamily: mono, flexShrink: 0 }}>✎</span>
              </div>
            ))}
          </div>

          {/* Generate bracket */}
          <button
            onClick={handleGenerate}
            style={{
              marginTop: 18, fontSize: 12, padding: "8px 24px",
              borderRadius: 2, border: "1px solid #c9954a",
              background: "#120d08", color: "#e0b96f",
              cursor: "pointer", fontFamily: mono, letterSpacing: "0.1em",
            }}
          >GENERATE BRACKET →</button>
        </div>
      )}
    </div>
  );
}
