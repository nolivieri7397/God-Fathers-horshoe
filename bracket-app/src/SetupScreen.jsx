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

export default function SetupScreen({ tournamentName, onGenerate, onBack }) {
  const [playerInput, setPlayerInput] = useState("");
  const [teamSize,    setTeamSize]    = useState(1);
  const [teams,       setTeams]       = useState([]);
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

  return (
    <div style={{ maxWidth: 560, margin: "3rem auto", padding: "0 1rem", fontFamily: "var(--font-mono, monospace)" }}>
      <img src="/godfathers-logo.png" alt="Godfathers Horseshoe Tournament"
        style={{ display: "block", margin: "0 auto 24px", width: "90%", maxWidth: 720, height: "auto" }} />
      {/* Back */}
      <button onClick={onBack} style={{
        background: "none", border: "none", color: "var(--color-text-tertiary, #888)",
        cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 20,
      }}>← Back to tournaments</button>

      <h2 style={{ margin: "0 0 4px 0", fontSize: 22, fontWeight: 600 }}>
        {tournamentName || "New Tournament"}
      </h2>
      <p style={{ margin: "0 0 24px 0", fontSize: 13, color: "var(--color-text-tertiary, #888)" }}>
        Enter players, choose a team size, then randomize.
      </p>

      {/* Player input */}
      <label style={{ fontSize: 11, color: "var(--color-text-tertiary, #888)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
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
          fontSize: 13, fontFamily: "var(--font-mono, monospace)",
          background: "var(--color-background-secondary, #1e1e1e)",
          border: "0.5px solid var(--color-border-secondary, #444)",
          borderRadius: 6, color: "var(--color-text-primary, #fff)",
          padding: "8px 10px", resize: "vertical",
        }}
      />

      {/* Team size */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--color-text-tertiary, #888)", letterSpacing: "0.07em", textTransform: "uppercase" }}>
          Team size
        </span>
        {[1, 2, 3, 4].map(sz => (
          <button key={sz} onClick={() => { setTeamSize(sz); setTeams([]); setWarning(""); }} style={{
            fontSize: 12, padding: "3px 12px",
            borderRadius: 6,
            border: teamSize === sz ? "1.5px solid #7F77DD" : "0.5px solid var(--color-border-secondary, #444)",
            background: teamSize === sz ? "#EEEDF9" : "var(--color-background-secondary, #1e1e1e)",
            color: teamSize === sz ? "#3B3796" : "var(--color-text-primary, #fff)",
            fontWeight: teamSize === sz ? 600 : 400,
            cursor: "pointer",
          }}>{sz === 1 ? "1 (individual)" : sz}</button>
        ))}
      </div>

      {/* Randomize */}
      <button
        onClick={handleRandomize}
        disabled={!canRandomize}
        style={{
          fontSize: 13, padding: "7px 18px", borderRadius: 6, border: "none",
          background: canRandomize ? "#7F77DD" : "var(--color-border-secondary, #444)",
          color: "#fff", cursor: canRandomize ? "pointer" : "not-allowed",
          fontFamily: "inherit", marginBottom: 20,
          opacity: canRandomize ? 1 : 0.5,
        }}
      >Randomize teams</button>

      {/* Warning */}
      {warning && (
        <p style={{ fontSize: 12, color: "#D85A30", margin: "-12px 0 16px 0" }}>{warning}</p>
      )}

      {/* Team preview */}
      {teams.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, color: "var(--color-text-tertiary, #888)",
            letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8,
          }}>
            {teams.length > 32 ? "Teams (first 32 will be used)" : `Teams — ${Math.min(teams.length, 32)} bracket participants`}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {teams.slice(0, 32).map((name, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 11, color: "var(--color-text-tertiary, #888)",
                  fontFamily: "var(--font-mono, monospace)", minWidth: 22, textAlign: "right",
                }}>{i + 1}</span>
                <input
                  value={name}
                  onChange={e => handleTeamNameChange(i, e.target.value)}
                  style={{
                    flex: 1, fontSize: 13, fontFamily: "var(--font-mono, monospace)",
                    background: "var(--color-background-secondary, #1e1e1e)",
                    border: "0.5px solid var(--color-border-secondary, #444)",
                    borderRadius: 4, color: "var(--color-text-primary, #fff)",
                    padding: "4px 8px",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Generate bracket */}
          <button
            onClick={handleGenerate}
            style={{
              marginTop: 18, fontSize: 14, padding: "9px 24px",
              borderRadius: 6, border: "none",
              background: "#1D9E75", color: "#fff",
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }}
          >Generate bracket →</button>
        </div>
      )}
    </div>
  );
}
