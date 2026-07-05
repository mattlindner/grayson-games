/**
 * @module SpaceBattle
 *
 * Page component for the Space Battle game.
 *
 * Manages navigation between the loading screen and the game canvas.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "../../components/LoadingScreen";
import Game from "./Game";
import type { Character } from "./types";

type Screen = "loading" | "game";

/** Rotating status messages themed for Space Battle. */
const MESSAGES = [
  { at: 0, text: "LOADING ASSETS..." },
  { at: 15, text: "CALIBRATING LASERS..." },
  { at: 30, text: "DEPLOYING ALIEN FLEET..." },
  { at: 50, text: "FUELING SPACESHIP..." },
  { at: 65, text: "SCANNING SECTORS..." },
  { at: 80, text: "ARMING WEAPONS..." },
  { at: 92, text: "ENGAGING HYPERDRIVE..." },
];

/** Selectable pilots. */
const CHARACTERS = [
  { id: "grayson", label: "GRAYSON", color: "#4488ff" },
  { id: "quinn", label: "QUINN", color: "#ff66aa" },
];

/**
 * Space Battle page — wraps the loading screen and game component.
 */
export default function SpaceBattle() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [character, setCharacter] = useState<Character>("grayson");
  const navigate = useNavigate();

  const handleLoadingComplete = useCallback((char: string) => {
    setCharacter(char as Character);
    setScreen("game");
  }, []);

  const handleRestart = useCallback(() => {
    setScreen("loading");
  }, []);

  const handleHome = useCallback(() => {
    navigate("/");
  }, [navigate]);

  return (
    <div style={{ width: "100%", height: "100%", background: "#000" }}>
      {screen === "loading" && (
        <LoadingScreen
          title="GRAYSON"
          subtitle="SPACE BATTLE"
          selectLabel="SELECT PILOT"
          characters={CHARACTERS}
          messages={MESSAGES}
          onComplete={handleLoadingComplete}
        />
      )}
      {screen === "game" && (
        <Game onRestart={handleRestart} onHome={handleHome} character={character} />
      )}
    </div>
  );
}
