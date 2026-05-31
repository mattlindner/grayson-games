/**
 * @module SpaceBattle
 *
 * Page component for the Space Battle game.
 *
 * Manages navigation between the loading screen and the game canvas.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "./LoadingScreen";
import Game from "./Game";
import type { Character } from "./types";

type Screen = "loading" | "game";

/**
 * Space Battle page — wraps the loading screen and game component.
 */
export default function SpaceBattle() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [character, setCharacter] = useState<Character>("grayson");
  const navigate = useNavigate();

  const handleLoadingComplete = useCallback((char: Character) => {
    setCharacter(char);
    setScreen("game");
  }, []);

  const handleRestart = useCallback(() => {
    setScreen("loading");
  }, []);

  const handleHome = useCallback(() => {
    navigate("/grayson-games/");
  }, [navigate]);

  return (
    <div style={{ width: "100%", height: "100%", background: "#000" }}>
      {screen === "loading" && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}
      {screen === "game" && (
        <Game onRestart={handleRestart} onHome={handleHome} character={character} />
      )}
    </div>
  );
}
