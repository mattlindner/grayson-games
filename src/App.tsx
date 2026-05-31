/**
 * @module App
 *
 * Root component for **Grayson Space Battle**.
 *
 * Manages navigation between two screens:
 * 1. {@link LoadingScreen} — a fake retro loading bar.
 * 2. {@link Game} — the playable space shooter.
 */
import { useState, useCallback } from "react";
import LoadingScreen from "./LoadingScreen";
import Game from "./Game";
import type { Character } from "./types";

/**
 * Possible application screens.
 *
 * - `"loading"` — The fake loading bar is displayed.
 * - `"game"`    — The game canvas is active and playable.
 */
type Screen = "loading" | "game";

/**
 * Root application component.
 *
 * Renders either the {@link LoadingScreen} or the {@link Game} based on
 * the current {@link Screen} state.  When the loading animation
 * completes, the screen transitions to `"game"`.  Choosing "Main Menu"
 * after a game-over cycles back to `"loading"`.
 *
 * @returns The active screen wrapped in a full-size black container.
 */
export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [character, setCharacter] = useState<Character>("grayson");

  /**
   * Callback passed to {@link LoadingScreen}.
   * Stores the selected character and transitions to the game screen.
   */
  const handleLoadingComplete = useCallback((char: Character) => {
    setCharacter(char);
    setScreen("game");
  }, []);

  /**
   * Callback passed to {@link Game}.
   * Returns the player to the loading screen (acts as "Main Menu").
   */
  const handleRestart = useCallback(() => {
    setScreen("loading");
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", background: "#000" }}>
      {screen === "loading" && (
        <LoadingScreen onComplete={handleLoadingComplete} />
      )}
      {screen === "game" && <Game onRestart={handleRestart} character={character} />}
    </div>
  );
}
