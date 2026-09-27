/**
 * @module OctopusCannon
 *
 * Page component for the Octopus Cannon game.
 *
 * Manages navigation between the shared loading screen and the game canvas.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import LoadingScreen from "../../components/LoadingScreen";
import Game from "./Game";
import { CHARACTER_INFO, type Character } from "./types";

type Screen = "loading" | "game";

/** Rotating status messages themed for Octopus Cannon. */
const MESSAGES = [
  { at: 0, text: "FILLING THE TANK..." },
  { at: 18, text: "INKING THE CANNON..." },
  { at: 36, text: "WAKING THE OCTOPUS..." },
  { at: 55, text: "RELEASING THE KRAKEN..." },
  { at: 72, text: "LOADING TORPEDOES..." },
  { at: 90, text: "DIVE! DIVE! DIVE!" },
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

/** Deep-sea theme for the loading screen. */
const THEME = {
  background: "#031428",
  accent: "#33d6ff",
  accentDim: "#1f8fbf",
  barGradient: "linear-gradient(90deg, #05314f, #33d6ff)",
  glow: "#33d6ff",
};

/**
 * Octopus Cannon page — wraps the loading screen and game component.
 */
export default function OctopusCannon() {
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
    <div style={{ width: "100%", height: "100%", background: "#031428" }}>
      {screen === "loading" && (
        <LoadingScreen
          title="OCTOPUS CANNON"
          selectLabel="PICK YOUR OCTOPUS"
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
