/**
 * @module NumberMunchers
 *
 * Page component for the Number Munchers game.
 *
 * Manages navigation between the shared loading screen and the game board.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "../../components/LoadingScreen";
import Game from "./Game";
import { CHARACTER_INFO, type Character } from "./types";

type Screen = "loading" | "game";

/** Rotating status messages themed for Number Munchers. */
const MESSAGES = [
  { at: 0, text: "SHARPENING PENCILS..." },
  { at: 18, text: "COUNTING TO A MILLION..." },
  { at: 36, text: "STACKING NUMBER BLOCKS..." },
  { at: 55, text: "FEEDING THE MUNCHER..." },
  { at: 72, text: "HIDING SNEAKY MONSTERS..." },
  { at: 90, text: "GET READY TO MUNCH!" },
];

/** Selectable players. */
const CHARACTERS = [
  {
    id: "grayson",
    label: CHARACTER_INFO.grayson.label,
    color: CHARACTER_INFO.grayson.color,
    image: CHARACTER_INFO.grayson.image,
  },
  {
    id: "quinn",
    label: CHARACTER_INFO.quinn.label,
    color: CHARACTER_INFO.quinn.color,
    image: CHARACTER_INFO.quinn.image,
  },
];

/** Green retro theme matching the home-screen card. */
const THEME = {
  background: "#04140a",
  accent: "#7cff4d",
  accentDim: "#3fbf2f",
  barGradient: "linear-gradient(90deg, #0a5a00, #7cff4d)",
  glow: "#7cff4d",
};

/**
 * Number Munchers page — wraps the loading screen and game component.
 */
export default function NumberMunchers() {
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
    <div style={{ width: "100%", height: "100%", background: "#04140a" }}>
      {screen === "loading" && (
        <LoadingScreen
          title="NUMBER MUNCHERS"
          selectLabel="PICK YOUR MUNCHER"
          characters={CHARACTERS}
          messages={MESSAGES}
          theme={THEME}
          onComplete={handleLoadingComplete}
        />
      )}
      {screen === "game" && (
        <Game onRestart={handleRestart} onHome={handleHome} character={character} />
      )}
    </div>
  );
}
