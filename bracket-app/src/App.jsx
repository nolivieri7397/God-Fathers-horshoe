import { useState, useEffect } from "react";
import Bracket from "./Bracket";
import TournamentManager, { storageKeyFor } from "./TournamentManager";
import SetupScreen from "./SetupScreen";

const SESSION_KEY = "de_active_tournament";

function App() {
  // activeTournament: { id, storageKey, name } | null
  const [activeTournament, setActiveTournament] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
  });
  // phase: "list" | "setup" | "bracket"
  const [phase, setPhase] = useState(() => activeTournament ? "bracket" : "list");

  useEffect(() => {
    try {
      if (activeTournament) sessionStorage.setItem(SESSION_KEY, JSON.stringify(activeTournament));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }, [activeTournament]);

  // Existing tournament opened directly from list → bracket.
  const handleOpen = (id, storageKey) => {
    setActiveTournament({ id, storageKey, name: "" });
    setPhase("bracket");
  };

  // New tournament created → setup screen.
  const handleSetup = (id, storageKey, name) => {
    setActiveTournament({ id, storageKey, name });
    setPhase("setup");
  };

  // Setup screen confirmed → bracket with generated names.
  const handleGenerate = (initialNames, initialPlayerCount) => {
    setPhase("bracket");
    // initialNames/initialPlayerCount are passed as props to Bracket below.
    setActiveTournament(prev => ({ ...prev, initialNames, initialPlayerCount }));
  };

  const handleBack = () => {
    setActiveTournament(null);
    setPhase("list");
  };

  if (phase === "setup" && activeTournament) {
    return (
      <SetupScreen
        tournamentName={activeTournament.name}
        onGenerate={handleGenerate}
        onBack={handleBack}
      />
    );
  }

  if (phase === "bracket" && activeTournament) {
    return (
      <Bracket
        storageKey={activeTournament.storageKey}
        initialNames={activeTournament.initialNames}
        initialPlayerCount={activeTournament.initialPlayerCount}
        onBack={handleBack}
      />
    );
  }

  return (
    <TournamentManager
      onOpen={handleOpen}
      onSetup={handleSetup}
    />
  );
}

export default App;
