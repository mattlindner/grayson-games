/**
 * @module Game
 *
 * Core gameplay for **Number Munchers** — a kid-friendly recreation of the
 * classic edutainment game for ages 4–7.
 *
 * The player moves a character around a 5×6 grid of numbers and "munches"
 * the ones that match the current level's rule (even, odd, multiples,
 * simple addition/subtraction). Eating a wrong number costs one of three
 * hearts; roaming enemies also cost a heart on contact. Clearing every
 * correct number advances to the next of 15 increasingly hard levels.
 *
 * Controls:
 * - Desktop: Arrow keys / WASD to move, Space or Enter to eat.
 * - Mobile: on-screen joystick (bottom-left) + EAT button (bottom-right).
 *
 * The player is drawn with a {@link CharacterFace} whose jaw flaps like
 * "Terrance and Phillip" while chewing. The face is built from swappable
 * halves so real character photos can replace the emoji placeholders later.
 */
import { useEffect, useLayoutEffect, useRef, useReducer, useState, useCallback } from "react";
import {
  ROWS,
  COLS,
  CELL_COUNT,
  LEVELS,
  LEVEL_COUNT,
  CHARACTER_INFO,
  type Cell,
  type Character,
} from "./types";
import {
  initAudio,
  playMunch,
  playError,
  playBonk,
  playLevelUp,
  playGameOver,
  playWin,
} from "./sounds";

/** Props for the {@link Game} component. */
interface GameProps {
  /** Chosen player character. */
  character: Character;
  /** Return to the loading / character-select screen. */
  onRestart: () => void;
  /** Navigate back to the home page. */
  onHome: () => void;
}

/** Image used for roaming enemies. */
const ENEMY_IMAGE = `${import.meta.env.BASE_URL}enemy.png`;

/** High-level game phase. */
type Phase = "playing" | "levelclear" | "gameover" | "win";

/** A grid position. */
interface Pos {
  r: number;
  c: number;
}

/** A roaming enemy. */
interface Enemy {
  r: number;
  c: number;
}

/** Starting number of hearts. */
const START_HEARTS = 3;

/** Clamps `v` into the inclusive range [min, max]. */
const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

/** Number of enemies for a given 0-based level index. */
function enemyCount(levelIdx: number): number {
  return Math.min(1, Math.floor(levelIdx / 3));
}

/** Milliseconds between enemy steps (faster on later levels). */
function enemySpeedMs(levelIdx: number): number {
  return Math.max(3040, 7200 - levelIdx * 280);
}

/** How many cells should be correct answers for a given level index. */
function correctCountFor(levelIdx: number): number {
  return Math.max(7, 12 - Math.floor(levelIdx / 2));
}

/** Fisher–Yates shuffle (in place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Builds a shuffled board of {@link Cell}s for the given level index. */
function buildBoard(levelIdx: number): Cell[] {
  const spec = LEVELS[levelIdx];
  const correctCount = correctCountFor(levelIdx);
  const cells: Cell[] = [];
  for (let i = 0; i < correctCount; i++) {
    cells.push({ text: spec.makeCorrect(), correct: true, eaten: false });
  }
  for (let i = correctCount; i < CELL_COUNT; i++) {
    cells.push({ text: spec.makeWrong(), correct: false, eaten: false });
  }
  return shuffle(cells);
}

/** Picks a starting corner for an enemy, away from the player. */
function spawnEnemies(levelIdx: number, player: Pos): Enemy[] {
  const corners: Pos[] = [
    { r: 0, c: 0 },
    { r: ROWS - 1, c: COLS - 1 },
    { r: 0, c: COLS - 1 },
    { r: ROWS - 1, c: 0 },
  ];
  const count = enemyCount(levelIdx);
  const shuffledCorners = shuffle([...corners]);
  const enemies: Enemy[] = [];
  for (let i = 0; i < count; i++) {
    const corner = shuffledCorners[i % shuffledCorners.length];
    // Nudge off the player's cell if they happen to share it.
    if (corner.r === player.r && corner.c === player.c) {
      enemies.push({ r: (corner.r + 2) % ROWS, c: (corner.c + 2) % COLS });
    } else {
      enemies.push({ r: corner.r, c: corner.c });
    }
  }
  return enemies;
}

/** Returns the grid corner farthest from `p` (for enemy respawns). */
function farCorner(p: Pos): Pos {
  const r = p.r < ROWS / 2 ? ROWS - 1 : 0;
  const c = p.c < COLS / 2 ? COLS - 1 : 0;
  return { r, c };
}

// ─── CharacterFace ───────────────────────────────────────────

/** Props for {@link CharacterFace}. */
interface CharacterFaceProps {
  /** Emoji placeholder for the character's face (fallback when no image). */
  emoji: string;
  /** Optional URL of a real face photo. Takes priority over the emoji. */
  image?: string;
  /** Accent color used for the glow. */
  color: string;
  /** Whether the jaw should be flapping (chewing). */
  chewing: boolean;
  /** Overall size in pixels. */
  size: number;
  /**
   * Vertical position of the jaw hinge as a fraction of the height
   * (0 = top, 1 = bottom). The mouth typically sits ~60% down a face.
   */
  mouthRatio?: number;
}

/**
 * Renders a character face split into a fixed top portion and a hinged
 * bottom "jaw" that flaps open/closed while {@link CharacterFaceProps.chewing}
 * is true — the "Terrance and Phillip" chewing effect.
 *
 * Uses the real photo when {@link CharacterFaceProps.image} is provided,
 * otherwise falls back to the emoji. Both are split into overflow-clipped
 * halves so the flap animation is identical either way.
 */
function CharacterFace({
  emoji,
  image,
  color,
  chewing,
  size,
  mouthRatio = 0.25,
}: CharacterFaceProps) {
  const topH = size * mouthRatio;
  const botH = size - topH;

  /** Renders the full-size face (photo or emoji) offset by `top`. */
  const faceLayer = (top: number) => {
    const common: React.CSSProperties = {
      position: "absolute",
      left: 0,
      top,
      width: size,
      height: size,
      filter: `drop-shadow(0 0 6px ${color})`,
      userSelect: "none",
    };
    if (image) {
      return (
        <img
          src={image}
          alt=""
          draggable={false}
          style={{ ...common, objectFit: "contain" }}
        />
      );
    }
    return (
      <span
        style={{
          ...common,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.86,
          lineHeight: 1,
        }}
      >
        {emoji}
      </span>
    );
  };

  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      {/* Top (fixed) portion */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: topH,
          overflow: "hidden",
        }}
      >
        {faceLayer(0)}
      </div>
      {/* Bottom (hinged) jaw */}
      <div
        style={{
          position: "absolute",
          top: topH,
          left: 0,
          width: size,
          height: botH,
          overflow: "hidden",
          transformOrigin: "top center",
          animation: chewing ? "mm-chew 0.16s ease-in-out infinite" : "none",
        }}
      >
        {faceLayer(-topH)}
      </div>
    </div>
  );
}

// ─── Game ────────────────────────────────────────────────────

/**
 * The Number Munchers game board and logic.
 *
 * State is held in refs (the authoritative source of truth) and rendered
 * via a forced re-render, which keeps the many event- and timer-driven
 * updates free of stale-closure bugs.
 *
 * @param props - {@link GameProps}
 */
export default function Game({ character, onRestart, onHome }: GameProps) {
  const info = CHARACTER_INFO[character];

  // Authoritative game state (refs) + a forced re-render trigger.
  const [, rerender] = useReducer((c: number) => c + 1, 0);
  const levelRef = useRef(0);
  const heartsRef = useRef(START_HEARTS);
  const cellsRef = useRef<Cell[]>([]);
  const playerRef = useRef<Pos>({ r: 2, c: 2 });
  const enemiesRef = useRef<Enemy[]>([]);
  const phaseRef = useRef<Phase>("playing");
  const chewRef = useRef(false);
  const invulnRef = useRef(0);
  const chewTimer = useRef<number | null>(null);
  const lastEnemyMove = useRef(0);

  // Mobile / responsive.
  const isMobileRef = useRef(false);
  const cellSizeRef = useRef(64);

  // Joystick state.
  const joyActiveRef = useRef(false);
  const joyDirRef = useRef<{ dr: number; dc: number } | null>(null);
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Core actions (stable; read/write refs only) ──

  const loadLevel = useCallback((idx: number) => {
    levelRef.current = idx;
    cellsRef.current = buildBoard(idx);
    playerRef.current = { r: 2, c: 2 };
    enemiesRef.current = spawnEnemies(idx, playerRef.current);
    invulnRef.current = performance.now() + 1200;
    lastEnemyMove.current = performance.now();
    phaseRef.current = "playing";
    rerender();
  }, []);

  const startGame = useCallback(() => {
    heartsRef.current = START_HEARTS;
    loadLevel(0);
  }, [loadLevel]);

  const triggerChew = useCallback(() => {
    chewRef.current = true;
    if (chewTimer.current !== null) window.clearTimeout(chewTimer.current);
    chewTimer.current = window.setTimeout(() => {
      chewRef.current = false;
      rerender();
    }, 480);
  }, []);

  const gameOver = useCallback(() => {
    phaseRef.current = "gameover";
    playGameOver();
    rerender();
  }, []);

  const levelClear = useCallback(() => {
    phaseRef.current = "levelclear";
    playLevelUp();
    window.setTimeout(() => {
      const next = levelRef.current + 1;
      if (next >= LEVEL_COUNT) {
        phaseRef.current = "win";
        playWin();
        rerender();
      } else {
        loadLevel(next);
      }
    }, 1400);
    rerender();
  }, [loadLevel]);

  /**
   * Hidden cheat: three quick taps on the level badge skip to the next
   * level. Click timestamps within an 800 ms window are tallied.
   */
  const cheatClicks = useRef<number[]>([]);
  const onLevelBadgeClick = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const now = performance.now();
    cheatClicks.current = [...cheatClicks.current, now].filter(
      (t) => now - t < 800
    );
    if (cheatClicks.current.length >= 3) {
      cheatClicks.current = [];
      levelClear();
    }
  }, [levelClear]);

  /** Handles player/enemy overlap; returns true if the player was hit. */
  const checkEnemyCollision = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const now = performance.now();
    if (now < invulnRef.current) return;
    const p = playerRef.current;
    for (const e of enemiesRef.current) {
      if (e.r === p.r && e.c === p.c) {
        heartsRef.current -= 1;
        invulnRef.current = now + 1300;
        const corner = farCorner(p);
        e.r = corner.r;
        e.c = corner.c;
        if (heartsRef.current <= 0) {
          gameOver();
        } else {
          playBonk();
        }
        return;
      }
    }
  }, [gameOver]);

  const move = useCallback(
    (dr: number, dc: number) => {
      if (phaseRef.current !== "playing") return;
      const p = playerRef.current;
      playerRef.current = {
        r: clamp(p.r + dr, 0, ROWS - 1),
        c: clamp(p.c + dc, 0, COLS - 1),
      };
      checkEnemyCollision();
      rerender();
    },
    [checkEnemyCollision]
  );

  const eat = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const p = playerRef.current;
    const idx = p.r * COLS + p.c;
    const cell = cellsRef.current[idx];
    if (!cell || cell.eaten) return;

    cell.eaten = true;
    triggerChew();

    if (cell.correct) {
      playMunch();
      const anyLeft = cellsRef.current.some((c) => c.correct && !c.eaten);
      if (!anyLeft) {
        levelClear();
      }
    } else {
      playError();
      heartsRef.current -= 1;
      if (heartsRef.current <= 0) gameOver();
    }
    rerender();
  }, [triggerChew, levelClear, gameOver]);

  const moveEnemies = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    const p = playerRef.current;
    for (const e of enemiesRef.current) {
      const dr = p.r - e.r;
      const dc = p.c - e.c;
      // Mostly chase the player; occasionally wander for a gentler feel.
      const wander = Math.random() < 0.25;
      if (wander) {
        if (Math.random() < 0.5) e.r = clamp(e.r + (Math.random() < 0.5 ? -1 : 1), 0, ROWS - 1);
        else e.c = clamp(e.c + (Math.random() < 0.5 ? -1 : 1), 0, COLS - 1);
      } else if (Math.abs(dr) > Math.abs(dc)) {
        e.r += Math.sign(dr);
      } else if (dc !== 0) {
        e.c += Math.sign(dc);
      } else if (dr !== 0) {
        e.r += Math.sign(dr);
      }
    }
    checkEnemyCollision();
    rerender();
  }, [checkEnemyCollision]);

  // ── Mount: detect mobile, size the board, start the game ──
  useEffect(() => {
    const detectMobile = () =>
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      window.innerWidth < 820;

    const resize = () => {
      isMobileRef.current = detectMobile();
      const reserved = isMobileRef.current ? 200 : 130; // HUD + instruction + controls
      const availW = window.innerWidth - 16;
      const availH = window.innerHeight - reserved;
      const size = Math.floor(Math.min(availW / COLS, availH / ROWS));
      cellSizeRef.current = Math.max(40, size);
      rerender();
    };
    resize();
    window.addEventListener("resize", resize);
    startGame();
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard controls ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) {
        e.preventDefault();
      }
      initAudio();
      if (phaseRef.current !== "playing") return;
      switch (k) {
        case "ArrowUp":
        case "w":
        case "W":
          move(-1, 0);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          move(1, 0);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          move(0, -1);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          move(0, 1);
          break;
        case " ":
        case "Enter":
          eat();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, eat]);

  // ── Enemy movement loop ──
  useEffect(() => {
    const id = window.setInterval(() => {
      if (phaseRef.current !== "playing") return;
      const now = performance.now();
      if (now - lastEnemyMove.current < enemySpeedMs(levelRef.current)) return;
      lastEnemyMove.current = now;
      moveEnemies();
    }, 90);
    return () => window.clearInterval(id);
  }, [moveEnemies]);

  // ── Joystick repeat loop ──
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = joyDirRef.current;
      if (d && phaseRef.current === "playing") move(d.dr, d.dc);
    }, 180);
    return () => window.clearInterval(id);
  }, [move]);

  // ── Joystick pointer handling ──
  const updateJoy = (e: React.PointerEvent) => {
    const base = joyBaseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const radius = rect.width / 2 - 8;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, radius);
    const angle = Math.atan2(dy, dx);
    knobRef.current = {
      x: Math.cos(angle) * clamped,
      y: Math.sin(angle) * clamped,
    };
    if (dist > 14) {
      if (Math.abs(dx) > Math.abs(dy)) {
        joyDirRef.current = { dr: 0, dc: dx > 0 ? 1 : -1 };
      } else {
        joyDirRef.current = { dr: dy > 0 ? 1 : -1, dc: 0 };
      }
    } else {
      joyDirRef.current = null;
    }
    rerender();
  };

  const onJoyDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    initAudio();
    joyActiveRef.current = true;
    updateJoy(e);
  };
  const onJoyMove = (e: React.PointerEvent) => {
    if (!joyActiveRef.current) return;
    updateJoy(e);
  };
  const onJoyUp = () => {
    joyActiveRef.current = false;
    joyDirRef.current = null;
    knobRef.current = { x: 0, y: 0 };
    rerender();
  };

  const onEatDown = (e: React.PointerEvent) => {
    e.preventDefault();
    initAudio();
    eat();
  };

  // ── Render helpers ──
  const cellSize = cellSizeRef.current;
  const player = playerRef.current;
  const cells = cellsRef.current;
  const enemies = enemiesRef.current;
  const hearts = heartsRef.current;
  const phase = phaseRef.current;
  const levelIdx = levelRef.current;
  const instruction = LEVELS[levelIdx]?.instruction ?? "";
  const isMobile = isMobileRef.current;
  const invulnActive = performance.now() < invulnRef.current;

  // Shrink the instruction so it always fits on a single line.
  const instrRef = useRef<HTMLSpanElement>(null);
  const [instrScale, setInstrScale] = useState(1);
  useLayoutEffect(() => {
    const el = instrRef.current;
    if (!el) return;
    const containerW = cellSize * COLS - 8;
    // scrollWidth is the unscaled layout width (unaffected by transform).
    const textW = el.scrollWidth;
    setInstrScale(textW > containerW ? containerW / textW : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instruction, cellSize]);

  const restart = () => {
    startGame();
  };

  return (
    <div style={rootStyle}>
      {/* HUD */}
      <div style={{ ...hudStyle, width: cellSize * COLS }}>
        <div style={heartsStyle}>
          {Array.from({ length: START_HEARTS }).map((_, i) => (
            <span key={i} style={{ opacity: i < hearts ? 1 : 0.25 }}>
              {i < hearts ? "❤️" : "🤍"}
            </span>
          ))}
        </div>
        <div
          style={{ ...levelBadgeStyle, cursor: "pointer" }}
          onClick={onLevelBadgeClick}
        >
          LVL {levelIdx + 1}/{LEVEL_COUNT}
        </div>
      </div>

      <div style={{ ...instructionStyle, width: cellSize * COLS }}>
        <span
          ref={instrRef}
          style={{
            display: "inline-block",
            whiteSpace: "nowrap",
            transform: `scale(${instrScale})`,
            transformOrigin: "center",
          }}
        >
          {instruction}
        </span>
      </div>

      {/* Board */}
      <div
        style={{
          position: "relative",
          width: cellSize * COLS,
          height: cellSize * ROWS,
          border: "3px solid #2b6",
          borderRadius: 8,
          background: "#0b1020",
          boxShadow: "0 0 0 3px #123, 0 8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {/* Cells */}
        {cells.map((cell, i) => {
          const r = Math.floor(i / COLS);
          const c = i % COLS;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: r * cellSize,
                left: c * cellSize,
                width: cellSize,
                height: cellSize,
                boxSizing: "border-box",
                border: "1px solid #1b2540",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: '"Courier New", monospace',
                fontWeight: "bold",
                fontSize: Math.max(14, cellSize * 0.32),
                color: cell.eaten ? "transparent" : "#e8eeff",
                textShadow: cell.eaten ? "none" : "0 1px 2px #000",
                zIndex: 2,
                pointerEvents: "none",
              }}
            >
              {cell.eaten ? "" : cell.text}
            </div>
          );
        })}

        {/* Enemies */}
        {enemies.map((e, i) => (
          <div
            key={`e${i}`}
            style={{
              position: "absolute",
              top: e.r * cellSize,
              left: e.c * cellSize,
              width: cellSize,
              height: cellSize,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "top 0.15s linear, left 0.15s linear",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <img
              src={ENEMY_IMAGE}
              alt=""
              draggable={false}
              style={{
                width: cellSize * 0.9,
                height: cellSize * 0.9,
                objectFit: "contain",
                filter: "drop-shadow(0 0 6px #ff4d4d)",
              }}
            />
          </div>
        ))}

        {/* Player */}
        <div
          style={{
            position: "absolute",
            top: player.r * cellSize,
            left: player.c * cellSize,
            width: cellSize,
            height: cellSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "top 0.08s linear, left 0.08s linear",
            pointerEvents: "none",
            opacity: invulnActive ? 0.55 : 1,
            zIndex: 1,
          }}
        >
          <CharacterFace
            emoji={info.emoji}
            image={info.image}
            color={info.color}
            chewing={chewRef.current}
            size={cellSize * 0.9}
            mouthRatio={info.mouthRatio}
          />
        </div>

        {/* Overlays */}
        {phase === "levelclear" && (
          <div style={overlayStyle}>
            <div style={{ ...overlayTextStyle, color: "#7cff4d" }}>
              LEVEL {levelIdx + 1} COMPLETE!
            </div>
          </div>
        )}
        {phase === "gameover" && (
          <div style={overlayStyle}>
            <div style={{ ...overlayTextStyle, color: "#ff5252" }}>GAME OVER</div>
            <div style={overlayBtnRowStyle}>
              <button onClick={restart} style={btnStyle}>
                PLAY AGAIN
              </button>
              <button onClick={onRestart} style={btnStyle}>
                MENU
              </button>
              <button onClick={onHome} style={btnStyle}>
                HOME
              </button>
            </div>
          </div>
        )}
        {phase === "win" && (
          <div style={overlayStyle}>
            <div style={{ ...overlayTextStyle, color: "#ffe040" }}>YOU WIN! 🎉</div>
            <div style={{ ...overlaySubStyle }}>All 10 levels cleared!</div>
            <div style={overlayBtnRowStyle}>
              <button onClick={restart} style={btnStyle}>
                PLAY AGAIN
              </button>
              <button onClick={onHome} style={btnStyle}>
                HOME
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop hint */}
      {!isMobile && phase === "playing" && (
        <div style={hintStyle}>ARROWS / WASD TO MOVE · SPACE / ENTER TO EAT</div>
      )}

      {/* Mobile controls */}
      {isMobile && (
        <div style={{ ...mobileControlsStyle, width: cellSize * COLS }}>
          {/* Joystick */}
          <div
            ref={joyBaseRef}
            onPointerDown={onJoyDown}
            onPointerMove={onJoyMove}
            onPointerUp={onJoyUp}
            onPointerCancel={onJoyUp}
            style={joyBaseStyle}
          >
            <div
              style={{
                ...joyKnobStyle,
                transform: `translate(${knobRef.current.x}px, ${knobRef.current.y}px)`,
              }}
            />
          </div>

          {/* EAT button */}
          <button
            onPointerDown={onEatDown}
            style={eatBtnStyle}
          >
            EAT
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const rootStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "linear-gradient(180deg, #0a0f1e 0%, #12183a 100%)",
  userSelect: "none",
  WebkitUserSelect: "none",
  overflow: "hidden",
};

const hudStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const heartsStyle: React.CSSProperties = {
  display: "flex",
  gap: 4,
  fontSize: 24,
};

const levelBadgeStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontWeight: "bold",
  fontSize: 16,
  color: "#7cff4d",
  textShadow: "0 0 8px #2b6",
  letterSpacing: 2,
};

const instructionStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontWeight: "bold",
  fontSize: "clamp(22px, 6vw, 40px)",
  color: "#ffe040",
  textAlign: "center",
  textShadow: "0 2px 3px #000",
  letterSpacing: 1,
  lineHeight: 1.1,
  minHeight: 24,
  whiteSpace: "nowrap",
  overflow: "hidden",
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(3, 6, 18, 0.82)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 16,
  borderRadius: 8,
  zIndex: 5,
};

const overlayTextStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontWeight: "bold",
  fontSize: "clamp(28px, 8vw, 48px)",
  letterSpacing: 3,
  textShadow: "0 0 16px currentColor",
  textAlign: "center",
};

const overlaySubStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 16,
  color: "#cfe",
};

const overlayBtnRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  justifyContent: "center",
  padding: "0 10px",
};

const btnStyle: React.CSSProperties = {
  padding: "12px 18px",
  fontSize: 15,
  fontFamily: '"Courier New", monospace',
  fontWeight: "bold",
  color: "#0a0f1e",
  background: "#7cff4d",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  letterSpacing: 1,
  boxShadow: "0 3px 0 #2b6",
};

const hintStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 12,
  color: "#8aa",
  marginTop: 4,
  letterSpacing: 1,
  textAlign: "center",
};

const mobileControlsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "12px 8px 0",
  boxSizing: "border-box",
};

const joyBaseStyle: React.CSSProperties = {
  width: 120,
  height: 120,
  borderRadius: "50%",
  background: "radial-gradient(circle at 50% 40%, #263056, #121734)",
  border: "3px solid #2b6",
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  touchAction: "none",
};

const joyKnobStyle: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: "50%",
  background: "radial-gradient(circle at 40% 35%, #9fe, #4aa3ff)",
  boxShadow: "0 0 12px #4aa3ff",
  pointerEvents: "none",
};

const eatBtnStyle: React.CSSProperties = {
  width: 110,
  height: 110,
  borderRadius: "50%",
  fontFamily: '"Courier New", monospace',
  fontWeight: "bold",
  fontSize: 26,
  letterSpacing: 2,
  color: "#0a0f1e",
  background: "radial-gradient(circle at 40% 35%, #ffe36b, #ffb020)",
  border: "3px solid #a86b00",
  boxShadow: "0 4px 0 #a86b00",
  cursor: "pointer",
  touchAction: "none",
};

/**
 * Injects the CSS `@keyframes mm-chew` rule for the flapping-jaw effect
 * into `<head>` at module load time.
 */
if (typeof document !== "undefined" && !document.getElementById("mm-chew-style")) {
  const style = document.createElement("style");
  style.id = "mm-chew-style";
  style.textContent = `@keyframes mm-chew { 0%,100%{transform:translateY(0)} 50%{transform:translateY(55%)} }`;
  document.head.appendChild(style);
}
