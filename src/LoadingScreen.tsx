/**
 * @module LoadingScreen
 *
 * A cosmetic "fake" loading screen displayed before the game starts.
 * Renders a CRT-style scanline overlay, an ASCII-art spaceship, a
 * progress bar that fills over a random 3–5 second duration, and
 * rotating retro status messages.
 */
import { useState, useEffect, useRef } from "react";
import type { Character } from "./types";

/** Props accepted by the {@link LoadingScreen} component. */
interface LoadingScreenProps {
  /**
   * Callback fired when the player selects a character after loading.
   * @param character - The chosen player character.
   */
  onComplete: (character: Character) => void;
}

/**
 * Fake retro loading screen with CRT scanline effect.
 *
 * Internally uses `requestAnimationFrame` to smoothly animate a
 * progress bar from 0 – 100 % over a random duration between 3 and 5
 * seconds (chosen once on mount).  Humorous status messages are
 * displayed at fixed progress thresholds.
 *
 * @param props - {@link LoadingScreenProps}
 * @returns A full-screen loading UI.
 */
export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("INITIALIZING...");
  const [loaded, setLoaded] = useState(false);

  /**
   * Random loading duration in milliseconds (3 000 – 5 000).
   * Computed once and stored in a ref so it persists across re-renders.
   */
  const durationRef = useRef(3000 + Math.random() * 2000);

  useEffect(() => {
    const duration = durationRef.current;
    const startTime = performance.now();

    const messages = [
      { at: 0, text: "LOADING ASSETS..." },
      { at: 15, text: "CALIBRATING LASERS..." },
      { at: 30, text: "DEPLOYING ALIEN FLEET..." },
      { at: 50, text: "FUELING SPACESHIP..." },
      { at: 65, text: "SCANNING SECTORS..." },
      { at: 80, text: "ARMING WEAPONS..." },
      { at: 92, text: "ENGAGING HYPERDRIVE..." },
    ];

    let messageIdx = 0;
    let rafId: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);

      // Add a bit of jitter to make it feel realistic
      const jitter = Math.random() * 2 - 1;
      const displayPct = Math.min(pct + jitter, 100);
      setProgress(Math.max(0, displayPct));

      // Update status text
      while (
        messageIdx < messages.length &&
        pct >= messages[messageIdx].at
      ) {
        setStatusText(messages[messageIdx].text);
        messageIdx++;
      }

      if (pct >= 100) {
        setProgress(100);
        setStatusText("READY!");
        setLoaded(true);
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [onComplete]);

  return (
    <div style={containerStyle}>
      {/* Scanlines effect */}
      <div style={scanlinesStyle} />

      <div style={innerStyle}>
        {/* Title */}
        <h1 style={titleStyle}>GRAYSON</h1>
        <h2 style={subtitleStyle}>SPACE BATTLE</h2>

        {/* Loading percentage */}
        <div style={percentStyle}>{Math.floor(Math.max(0, progress))}%</div>

        {/* Loading bar */}
        <div style={barContainerStyle}>
          <div style={barBgStyle}>
            <div
              style={{
                ...barFillStyle,
                width: `${Math.max(0, progress)}%`,
              }}
            />
          </div>
        </div>

        {/* Status text */}
        <div style={statusStyle}>{statusText}</div>

        {/* Character select (shown after loading completes) */}
        {loaded && (
          <div>
            <div style={selectLabelStyle}>SELECT PILOT</div>
            <div style={charBtnRowStyle}>
              <button onClick={() => onComplete("grayson")} style={charBtnGraysonStyle}>
                GRAYSON
              </button>
              <button onClick={() => onComplete("quinn")} style={charBtnQuinnStyle}>
                QUINN
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Full-screen black container centered with flexbox. */
const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  overflow: "hidden",
};

/** CRT scanline overlay — repeating 1 px dark stripes every 3 px. */
const scanlinesStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background:
    "repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 3px)",
  pointerEvents: "none",
  zIndex: 10,
};

/** Centered inner content wrapper. */
const innerStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 32,
  maxWidth: 480,
  width: "100%",
};

/** "GRAYSON" title with green neon glow. */
const titleStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(36px, 8vw, 56px)",
  color: "#00ff00",
  textShadow: "0 0 20px #00ff00, 0 0 40px #00aa00",
  margin: 0,
  letterSpacing: 8,
};

/** "SPACE BATTLE" subtitle with softer glow. */
const subtitleStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(16px, 4vw, 24px)",
  color: "#00cc00",
  textShadow: "0 0 10px #00cc00",
  margin: "4px 0 24px 0",
  letterSpacing: 12,
};

/** Flex row containing the progress bar. */
const barContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  margin: "0 auto",
  maxWidth: 360,
};

/** Dark background track for the progress bar with a green border. */
const barBgStyle: React.CSSProperties = {
  flex: 1,
  height: 20,
  background: "#111",
  border: "2px solid #00ff00",
  borderRadius: 2,
  overflow: "hidden",
};

/** Filled portion of the progress bar with green gradient + glow. */
const barFillStyle: React.CSSProperties = {
  height: "100%",
  background: "linear-gradient(90deg, #004400, #00ff00)",
  boxShadow: "0 0 10px #00ff00",
  transition: "width 0.05s linear",
};

/** Numeric percentage label centered above the bar. */
const percentStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 20,
  color: "#00ff00",
  textAlign: "center",
  marginBottom: 8,
};

/** Rotating status message below the progress bar. */
const statusStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(11px, 2.5vw, 14px)",
  color: "#00aa00",
  marginTop: 16,
  height: 20,
};

/** Label above the character-select buttons. */
const selectLabelStyle: React.CSSProperties = {
  marginTop: 20,
  fontSize: 14,
  fontFamily: '"Courier New", monospace',
  color: "#00aa00",
  letterSpacing: 4,
};

/** Row container for the two character buttons. */
const charBtnRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 16,
  marginTop: 12,
};

/** Base style shared by both character buttons. */
const charBtnBase: React.CSSProperties = {
  padding: "14px 28px",
  fontSize: 18,
  fontFamily: '"Courier New", monospace',
  background: "transparent",
  borderRadius: 4,
  cursor: "pointer",
};

/** Grayson button — blue theme. */
const charBtnGraysonStyle: React.CSSProperties = {
  ...charBtnBase,
  color: "#4488ff",
  border: "2px solid #4488ff",
  textShadow: "0 0 8px #4488ff",
  boxShadow: "0 0 12px rgba(68, 136, 255, 0.3)",
};

/** Quinn button — pink theme. */
const charBtnQuinnStyle: React.CSSProperties = {
  ...charBtnBase,
  color: "#ff66aa",
  border: "2px solid #ff66aa",
  textShadow: "0 0 8px #ff66aa",
  boxShadow: "0 0 12px rgba(255, 102, 170, 0.3)",
};

/**
 * Injects the CSS `@keyframes blink` rule into `<head>` at module load
 * time so the cursor animation works without a CSS file.
 */
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`;
  document.head.appendChild(style);
}
