/**
 * @module LoadingScreen
 *
 * A reusable, cosmetic "fake" loading screen shared across all games.
 *
 * Renders a CRT-style scanline overlay, a neon title/subtitle, a
 * progress bar that fills over a random duration, rotating retro status
 * messages, and a character-select prompt shown once loading finishes.
 *
 * Every visual aspect (colors, gradients, titles, status messages,
 * character buttons, and load duration) is configurable via props so
 * each game can theme it while sharing the same behavior.
 */
import { useState, useEffect, useRef } from "react";

/** A selectable character button shown after loading completes. */
export interface LoadingCharacter {
  /** Value passed to {@link LoadingScreenProps.onComplete} when chosen. */
  id: string;
  /** Text label rendered on the button. */
  label: string;
  /** Accent color for the button border / glow. */
  color: string;
  /** Optional face photo shown above the label. */
  image?: string;
}

/** A status message shown once the progress reaches `at` percent. */
export interface LoadingMessage {
  /** Progress threshold (0–100) at which this message appears. */
  at: number;
  /** Text to display. */
  text: string;
}

/** Themeable style information for the loading screen. */
export interface LoadingTheme {
  /** Full-screen background. */
  background?: string;
  /** Primary neon accent (title, bar border, percentage). */
  accent?: string;
  /** Dimmer accent (subtitle, status text). */
  accentDim?: string;
  /** CSS gradient used to fill the progress bar. */
  barGradient?: string;
  /** Glow color for text/bar shadows. */
  glow?: string;
}

/** Props accepted by the {@link LoadingScreen} component. */
export interface LoadingScreenProps {
  /** Large neon title (e.g. "GRAYSON"). */
  title: string;
  /** Smaller subtitle beneath the title (e.g. "SPACE BATTLE"). */
  subtitle: string;
  /** Characters offered in the post-load select prompt. */
  characters: LoadingCharacter[];
  /**
   * Fired when the player selects a character after loading finishes.
   * @param id - The chosen character's {@link LoadingCharacter.id}.
   */
  onComplete: (id: string) => void;
  /** Rotating status messages keyed by progress threshold. */
  messages?: LoadingMessage[];
  /** Label shown above the character buttons. Defaults to "SELECT PLAYER". */
  selectLabel?: string;
  /** Color / style overrides. Defaults to a green retro theme. */
  theme?: LoadingTheme;
  /** Minimum fake-load duration in ms. Defaults to 3000. */
  minDurationMs?: number;
  /** Maximum fake-load duration in ms. Defaults to 5000. */
  maxDurationMs?: number;
}

/** Default green retro theme (matches the original Space Battle look). */
const DEFAULT_THEME: Required<LoadingTheme> = {
  background: "#000",
  accent: "#00ff00",
  accentDim: "#00aa00",
  barGradient: "linear-gradient(90deg, #004400, #00ff00)",
  glow: "#00ff00",
};

/** Fallback status messages used when none are supplied. */
const DEFAULT_MESSAGES: LoadingMessage[] = [
  { at: 0, text: "LOADING ASSETS..." },
  { at: 20, text: "WARMING UP..." },
  { at: 45, text: "BUILDING WORLD..." },
  { at: 70, text: "ALMOST THERE..." },
  { at: 92, text: "FINISHING UP..." },
];

/**
 * Reusable fake retro loading screen with a CRT scanline effect.
 *
 * Uses `requestAnimationFrame` to smoothly animate a progress bar from
 * 0 – 100 % over a random duration chosen once on mount, then reveals a
 * character-select prompt.
 *
 * @param props - {@link LoadingScreenProps}
 * @returns A full-screen loading UI.
 */
export default function LoadingScreen({
  title,
  subtitle,
  characters,
  onComplete,
  messages = DEFAULT_MESSAGES,
  selectLabel = "SELECT PLAYER",
  theme,
  minDurationMs = 3000,
  maxDurationMs = 5000,
}: LoadingScreenProps) {
  const t: Required<LoadingTheme> = { ...DEFAULT_THEME, ...theme };

  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState(messages[0]?.text ?? "LOADING...");
  const [loaded, setLoaded] = useState(false);

  /**
   * Random loading duration in milliseconds, computed once and stored in
   * a ref so it persists across re-renders.
   */
  const durationRef = useRef(
    minDurationMs + Math.random() * Math.max(0, maxDurationMs - minDurationMs)
  );

  useEffect(() => {
    const duration = durationRef.current;
    const startTime = performance.now();

    let messageIdx = 0;
    let rafId: number;

    const tick = () => {
      const elapsed = performance.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);

      // Add a bit of jitter to make it feel realistic.
      const jitter = Math.random() * 2 - 1;
      const displayPct = Math.min(pct + jitter, 100);
      setProgress(Math.max(0, displayPct));

      while (messageIdx < messages.length && pct >= messages[messageIdx].at) {
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
    // messages is intentionally read once; parent should pass a stable array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ ...containerStyle, background: t.background }}>
      {/* Scanlines effect */}
      <div style={scanlinesStyle} />

      <div style={innerStyle}>
        {/* Title */}
        <h1
          style={{
            ...titleStyle,
            color: t.accent,
            textShadow: `0 0 20px ${t.glow}, 0 0 40px ${t.accentDim}`,
          }}
        >
          {title}
        </h1>
        <h2
          style={{
            ...subtitleStyle,
            color: t.accentDim,
            textShadow: `0 0 10px ${t.accentDim}`,
          }}
        >
          {subtitle}
        </h2>

        {/* Loading percentage */}
        <div style={{ ...percentStyle, color: t.accent }}>
          {Math.floor(Math.max(0, progress))}%
        </div>

        {/* Loading bar */}
        <div style={barContainerStyle}>
          <div style={{ ...barBgStyle, border: `2px solid ${t.accent}` }}>
            <div
              style={{
                ...barFillStyle,
                width: `${Math.max(0, progress)}%`,
                background: t.barGradient,
                boxShadow: `0 0 10px ${t.glow}`,
              }}
            />
          </div>
        </div>

        {/* Status text */}
        <div style={{ ...statusStyle, color: t.accentDim }}>{statusText}</div>

        {/* Character select (shown after loading completes) */}
        {loaded && (
          <div>
            <div style={{ ...selectLabelStyle, color: t.accentDim }}>
              {selectLabel}
            </div>
            <div style={charBtnRowStyle}>
              {characters.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onComplete(c.id)}
                  style={{
                    ...charBtnBase,
                    color: c.color,
                    border: `2px solid ${c.color}`,
                    textShadow: `0 0 8px ${c.color}`,
                    boxShadow: `0 0 12px ${c.color}55`,
                  }}
                >
                  {c.image && (
                    <img
                      src={c.image}
                      alt=""
                      draggable={false}
                      style={{
                        width: 72,
                        height: 72,
                        objectFit: "contain",
                        marginBottom: 8,
                        filter: `drop-shadow(0 0 8px ${c.color})`,
                      }}
                    />
                  )}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

/** Full-screen container centered with flexbox. */
const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
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

/** Large neon title. */
const titleStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(36px, 8vw, 56px)",
  margin: 0,
  letterSpacing: 8,
};

/** Subtitle with softer glow. */
const subtitleStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(14px, 3.6vw, 22px)",
  margin: "4px 0 24px 0",
  letterSpacing: 10,
};

/** Flex row containing the progress bar. */
const barContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  margin: "0 auto",
  maxWidth: 360,
};

/** Dark background track for the progress bar. */
const barBgStyle: React.CSSProperties = {
  flex: 1,
  height: 20,
  background: "#111",
  borderRadius: 2,
  overflow: "hidden",
};

/** Filled portion of the progress bar. */
const barFillStyle: React.CSSProperties = {
  height: "100%",
  transition: "width 0.05s linear",
};

/** Numeric percentage label centered above the bar. */
const percentStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 20,
  textAlign: "center",
  marginBottom: 8,
};

/** Rotating status message below the progress bar. */
const statusStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(11px, 2.5vw, 14px)",
  marginTop: 16,
  height: 20,
};

/** Label above the character-select buttons. */
const selectLabelStyle: React.CSSProperties = {
  marginTop: 20,
  fontSize: 14,
  fontFamily: '"Courier New", monospace',
  letterSpacing: 4,
};

/** Row container for the character buttons. */
const charBtnRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  flexWrap: "wrap",
  gap: 16,
  marginTop: 12,
};

/** Base style shared by every character button. */
const charBtnBase: React.CSSProperties = {
  padding: "14px 28px",
  fontSize: 18,
  fontFamily: '"Courier New", monospace',
  background: "transparent",
  borderRadius: 4,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};
