/**
 * @module Game
 *
 * Core game engine and React component for **Grayson Octopus Cannon**.
 *
 * An octopus sits at the center of a full-screen arena holding a cannon
 * that the player rotates a full 360°. Enemies close in from every edge;
 * the player fires to destroy them. Enemies speed up the longer you
 * survive. Three hits ends the run. The game runs on a
 * `requestAnimationFrame` loop that updates and renders every entity to
 * an HTML `<canvas>` sized to fill the viewport.
 */
import { useRef, useEffect, useCallback, useState } from "react";
import { playShoot, playExplosion, playHit, playGameOver, initAudio } from "./sounds";
import { CHARACTER_INFO, type Character } from "./types";

// ─── Constants ───────────────────────────────────────────────

/** Octopus body radius in pixels. */
const OCTO_R = 40;
/** Collision radius around the octopus that costs a heart when touched. */
const OCTO_HIT_R = 34;
/** Length of the cannon barrel in pixels. */
const BARREL_LEN = 56;
/** Cannon barrel half-thickness in pixels. */
const BARREL_HALF = 8;
/** Projectile radius in pixels. */
const BULLET_R = 7;
/** Projectile speed in pixels per frame. */
const BULLET_SPEED = 10;
/** Minimum time between shots in milliseconds. */
const FIRE_COOLDOWN = 220;
/** Cannon rotation speed for keyboard aiming, in radians per frame. */
const ROT_SPEED = 0.06;
/** Enemy collision radius in pixels. */
const ENEMY_R = 30;
/** Base enemy movement speed in pixels per frame (before the survival ramp). */
const ENEMY_BASE_SPEED = 0.4;
/** How much the enemy speed multiplier grows per second survived. */
const SPEED_RAMP = 0.05;
/** Time between enemy spawns in milliseconds (constant difficulty). */
const SPAWN_INTERVAL = 850;
/** Height reserved for mobile touch controls in pixels. */
const MOBILE_CONTROLS_H = 140;
/** Maximum (and starting) player health in hearts. */
const MAX_HEARTS = 3;
/** Enemy sprite sources; each enemy is randomly assigned one. */
const ENEMY_SRCS = [
  `${import.meta.env.BASE_URL}enemy.png`,
  `${import.meta.env.BASE_URL}enemy2.png`,
];
/** Number of background bubbles. */
const BUBBLE_COUNT = 50;

// ─── Types ───────────────────────────────────────────────────

/** Canvas dimensions in pixels. */
interface Dims {
  w: number;
  h: number;
}

/** A simple 2-D position vector. */
interface Vec2 {
  x: number;
  y: number;
}

/** A projectile fired from the cannon. */
interface Bullet extends Vec2 {
  /** Horizontal velocity in pixels per frame. */
  vx: number;
  /** Vertical velocity in pixels per frame. */
  vy: number;
}

/** An enemy closing in on the octopus. */
interface Enemy extends Vec2 {
  /** Unit direction toward the center, sampled at spawn. */
  dirX: number;
  /** Unit direction toward the center, sampled at spawn. */
  dirY: number;
  /** Whether this enemy is still alive. */
  alive: boolean;
  /** Animation frame counter for a subtle bob. */
  frame: number;
  /** Index into {@link ENEMY_SRCS} for this enemy's sprite. */
  sprite: number;
}

/** A visual particle emitted during explosions. */
interface Particle extends Vec2 {
  vx: number;
  vy: number;
  /** Remaining lifetime in frames. */
  life: number;
  /** Initial lifetime in frames (used to fade out). */
  maxLife: number;
  /** CSS color string. */
  color: string;
}

/** A drifting background bubble. */
interface Bubble extends Vec2 {
  /** Radius in pixels. */
  r: number;
  /** Upward drift speed in pixels per frame. */
  speed: number;
}

/**
 * Complete mutable state for a single game session.
 *
 * Stored in a React ref so the animation loop can mutate it without
 * triggering re-renders.
 */
interface GameState {
  /** Current cannon angle in radians (0 = pointing right). */
  angle: number;
  /** Active projectiles. */
  bullets: Bullet[];
  /** Active enemies. */
  enemies: Enemy[];
  /** Active explosion particles. */
  particles: Particle[];
  /** Background bubbles. */
  bubbles: Bubble[];
  /** Remaining player health (0 = game over). */
  hearts: number;
  /** Whether the player has been eliminated. */
  gameOver: boolean;
  /** Timestamp (`performance.now()`) when the run began. */
  startTime: number;
  /** Timestamp when the run ended (frozen survival time). */
  endTime: number;
  /** Timestamp of the last shot fired. */
  lastShot: number;
  /** Timestamp of the last enemy spawn. */
  lastSpawn: number;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Generates the initial background bubble field spanning the canvas. */
function spawnBubbles(dims: Dims): Bubble[] {
  return Array.from({ length: BUBBLE_COUNT }, () => ({
    x: Math.random() * dims.w,
    y: Math.random() * dims.h,
    r: 2 + Math.random() * 5,
    speed: 0.2 + Math.random() * 0.9,
  }));
}

/**
 * Creates a burst of {@link Particle}s at a given position.
 *
 * @param x - Center X coordinate of the explosion.
 * @param y - Center Y coordinate of the explosion.
 * @param colors - Palette to draw particle colors from.
 */
function createExplosion(x: number, y: number, colors: string[]): Particle[] {
  return Array.from({ length: 14 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.random() * 15,
      maxLife: 35,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
  });
}

/** Spawns a single enemy just off a random edge, aimed at the center. */
function spawnEnemy(dims: Dims): Enemy {
  const cx = dims.w / 2;
  const cy = dims.h / 2;
  // Spawn just outside a random edge so the enemy enters view immediately.
  const margin = ENEMY_R + 10;
  let x: number;
  let y: number;
  switch (Math.floor(Math.random() * 4)) {
    case 0: // top
      x = Math.random() * dims.w;
      y = -margin;
      break;
    case 1: // bottom
      x = Math.random() * dims.w;
      y = dims.h + margin;
      break;
    case 2: // left
      x = -margin;
      y = Math.random() * dims.h;
      break;
    default: // right
      x = dims.w + margin;
      y = Math.random() * dims.h;
      break;
  }
  const dx = cx - x;
  const dy = cy - y;
  const len = Math.hypot(dx, dy) || 1;
  return {
    x,
    y,
    dirX: dx / len,
    dirY: dy / len,
    alive: true,
    frame: Math.floor(Math.random() * 100),
    sprite: Math.floor(Math.random() * ENEMY_SRCS.length),
  };
}

/** Formats elapsed milliseconds as `M:SS`. */
function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── 16-bit style drawing helpers ────────────────────────────

/** Draws a small pixel-art heart icon for the health HUD. */
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ff2255";
  ctx.fillRect(x + 2, y, 4, 4);
  ctx.fillRect(x + 8, y, 4, 4);
  ctx.fillRect(x, y + 2, 14, 4);
  ctx.fillRect(x + 2, y + 6, 10, 4);
  ctx.fillRect(x + 4, y + 10, 6, 2);
  ctx.fillRect(x + 6, y + 12, 2, 2);
}

/**
 * Draws the octopus and its rotating cannon at the arena center.
 *
 * @param ctx   - The 2-D rendering context.
 * @param cx    - Center X of the arena.
 * @param cy    - Center Y of the arena.
 * @param angle - Cannon angle in radians.
 * @param frame - Global frame counter used to wiggle tentacles.
 * @param body  - Main body color.
 * @param shade - Darker shade for tentacles / outline.
 */
function drawOctopus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  frame: number,
  body: string,
  shade: string
) {
  // Tentacles — 8 wavy stubs around the body.
  ctx.fillStyle = shade;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const wiggle = Math.sin(frame * 0.12 + i) * 6;
    const tx = cx + Math.cos(a) * (OCTO_R + 8);
    const ty = cy + Math.sin(a) * (OCTO_R + 8) + wiggle;
    ctx.beginPath();
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cannon barrel (drawn under the body so it emerges from the center).
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = "#c0c8d0";
  ctx.fillRect(0, -BARREL_HALF, BARREL_LEN, BARREL_HALF * 2);
  ctx.fillStyle = "#8a929c";
  ctx.fillRect(0, -BARREL_HALF, BARREL_LEN, 3);
  // Muzzle tip.
  ctx.fillStyle = "#5a626c";
  ctx.fillRect(BARREL_LEN - 6, -BARREL_HALF - 2, 6, BARREL_HALF * 2 + 4);
  ctx.restore();

  // Body.
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, OCTO_R, 0, Math.PI * 2);
  ctx.fill();
  // Head highlight.
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.arc(cx - OCTO_R * 0.3, cy - OCTO_R * 0.35, OCTO_R * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Eyes (look in the cannon's direction).
  const ex = Math.cos(angle) * 6;
  const ey = Math.sin(angle) * 6;
  for (const side of [-1, 1]) {
    const bx = cx + Math.cos(angle + (side * Math.PI) / 2) * 14;
    const by = cy + Math.sin(angle + (side * Math.PI) / 2) * 14;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx, by - 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#101820";
    ctx.beginPath();
    ctx.arc(bx + ex * 0.4, by - 4 + ey * 0.4, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Component ───────────────────────────────────────────────

/** Props accepted by the {@link Game} component. */
interface GameProps {
  /** Return to the loading / character-select screen. */
  onRestart: () => void;
  /** Navigate back to the home page (game list). */
  onHome: () => void;
  /** The selected octopus, determines body color. */
  character: Character;
}

/** Computes the current canvas dimensions from the viewport. */
function computeDims(mobile: boolean): Dims {
  const controls = mobile ? MOBILE_CONTROLS_H : 0;
  return { w: window.innerWidth, h: Math.max(window.innerHeight - controls, 200) };
}

/**
 * Main game component.
 *
 * Renders a full-screen `<canvas>` and drives the game loop via
 * `requestAnimationFrame`. Desktop players aim with the mouse (or arrow
 * keys) and fire with click / space; mobile players aim by touching the
 * arena and fire with the on-screen FIRE button.
 *
 * @param props - {@link GameProps}
 */
export default function Game({ onRestart, onHome, character }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const fireRef = useRef(false);
  const frameRef = useRef(0);
  const rafRef = useRef<number>(0);
  const enemyImgsRef = useRef<(HTMLImageElement | null)[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const initialMobile =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768);
  const [dims, setDims] = useState<Dims>(() => computeDims(initialMobile));
  const dimsRef = useRef<Dims>(dims);
  dimsRef.current = dims;

  const info = CHARACTER_INFO[character];

  // Load the enemy sprites once.
  useEffect(() => {
    enemyImgsRef.current = ENEMY_SRCS.map((src, i) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        enemyImgsRef.current[i] = img;
      };
      return null;
    });
  }, []);

  // Detect mobile and keep the canvas sized to the viewport.
  useEffect(() => {
    const check = () => {
      const mobile =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.innerWidth < 768;
      setIsMobile(mobile);
      setDims(computeDims(mobile));
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // Initialize game state.
  const initState = useCallback((): GameState => {
    const now = performance.now();
    return {
      angle: -Math.PI / 2,
      bullets: [],
      enemies: [],
      particles: [],
      bubbles: spawnBubbles(dimsRef.current),
      hearts: MAX_HEARTS,
      gameOver: false,
      startTime: now,
      endTime: now,
      lastShot: 0,
      lastSpawn: 0,
    };
  }, []);

  // Aim the cannon at a client-space pointer position.
  const aimAt = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const s = stateRef.current;
    if (!canvas || !s) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    s.angle = Math.atan2(py - canvas.height / 2, px - canvas.width / 2);
  }, []);

  // Fire a projectile if the cooldown has elapsed.
  const tryFire = useCallback((s: GameState, now: number) => {
    if (now - s.lastShot < FIRE_COOLDOWN) return;
    s.lastShot = now;
    const d = dimsRef.current;
    const cx = d.w / 2;
    const cy = d.h / 2;
    const mx = cx + Math.cos(s.angle) * BARREL_LEN;
    const my = cy + Math.sin(s.angle) * BARREL_LEN;
    s.bullets.push({
      x: mx,
      y: my,
      vx: Math.cos(s.angle) * BULLET_SPEED,
      vy: Math.sin(s.angle) * BULLET_SPEED,
    });
    playShoot();
  }, []);

  // Main game loop.
  useEffect(() => {
    initAudio();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    stateRef.current = initState();

    const loop = () => {
      frameRef.current++;
      const s = stateRef.current!;
      if (!s.gameOver) {
        update(s);
      }
      draw(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    function update(s: GameState) {
      const keys = keysRef.current;
      const now = performance.now();
      const d = dimsRef.current;
      const cx = d.w / 2;
      const cy = d.h / 2;
      const elapsedSec = (now - s.startTime) / 1000;
      const speedMul = 1 + elapsedSec * SPEED_RAMP;

      // ─ Keyboard aiming ─
      if (keys.has("ArrowLeft")) s.angle -= ROT_SPEED;
      if (keys.has("ArrowRight")) s.angle += ROT_SPEED;

      // ─ Firing ─
      if (keys.has(" ") || fireRef.current) {
        tryFire(s, now);
      }

      // ─ Bubbles ─
      for (const b of s.bubbles) {
        b.y -= b.speed;
        if (b.y < -b.r) {
          b.y = d.h + b.r;
          b.x = Math.random() * d.w;
        }
      }

      // ─ Bullets ─
      s.bullets = s.bullets.filter((bl) => {
        bl.x += bl.vx;
        bl.y += bl.vy;
        return bl.x > -20 && bl.x < d.w + 20 && bl.y > -20 && bl.y < d.h + 20;
      });

      // ─ Spawn enemies ─
      if (now - s.lastSpawn > SPAWN_INTERVAL) {
        s.lastSpawn = now;
        s.enemies.push(spawnEnemy(d));
      }

      // ─ Move enemies toward the center ─
      const step = ENEMY_BASE_SPEED * speedMul;
      for (const e of s.enemies) {
        if (!e.alive) continue;
        e.frame++;
        e.x += e.dirX * step;
        e.y += e.dirY * step;
      }

      // ─ Collision: bullet → enemy ─
      for (const bl of s.bullets) {
        for (const e of s.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(bl.x - e.x, bl.y - e.y) < BULLET_R + ENEMY_R) {
            e.alive = false;
            bl.x = -9999; // remove on next filter pass
            s.particles.push(
              ...createExplosion(e.x, e.y, ["#ff66cc", "#ffcc00", "#ffffff", "#66ffff"])
            );
            playExplosion();
          }
        }
      }
      s.bullets = s.bullets.filter((bl) => bl.x !== -9999);

      // ─ Collision: enemy → octopus ─
      for (const e of s.enemies) {
        if (!e.alive) continue;
        if (Math.hypot(e.x - cx, e.y - cy) < OCTO_HIT_R + ENEMY_R) {
          e.alive = false;
          s.hearts--;
          s.particles.push(
            ...createExplosion(e.x, e.y, ["#ff4444", "#ff8800", "#ffffff"])
          );
          playHit();
          if (s.hearts <= 0) {
            s.hearts = 0;
            s.gameOver = true;
            s.endTime = now;
            setGameOver(true);
            playGameOver();
          }
        }
      }

      // ─ Cull dead enemies ─
      s.enemies = s.enemies.filter((e) => e.alive);

      // ─ Particles ─
      s.particles = s.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life > 0;
      });
    }

    function draw(ctx: CanvasRenderingContext2D, s: GameState) {
      const d = dimsRef.current;
      const cx = d.w / 2;
      const cy = d.h / 2;

      // Ocean background gradient.
      const grad = ctx.createRadialGradient(cx, cy, 40, cx, cy, Math.hypot(d.w, d.h) / 2);
      grad.addColorStop(0, "#0a3a5a");
      grad.addColorStop(1, "#031428");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, d.w, d.h);

      // Bubbles.
      ctx.fillStyle = "rgba(120,200,255,0.18)";
      for (const b of s.bubbles) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Particles.
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        const size = 2 + (p.life / p.maxLife) * 5;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      // Enemies.
      const enemyImgs = enemyImgsRef.current;
      const enemySize = ENEMY_R * 2 * 1.5;
      for (const e of s.enemies) {
        const bob = Math.sin(e.frame * 0.2) * 3;
        const enemyImg = enemyImgs[e.sprite];
        if (enemyImg) {
          // Fit within enemySize while preserving the sprite's aspect ratio.
          const aspect = enemyImg.naturalWidth / enemyImg.naturalHeight || 1;
          const drawW = aspect >= 1 ? enemySize : enemySize * aspect;
          const drawH = aspect >= 1 ? enemySize / aspect : enemySize;
          ctx.drawImage(
            enemyImg,
            e.x - drawW / 2,
            e.y - drawH / 2 + bob,
            drawW,
            drawH
          );
        } else {
          ctx.fillStyle = "#ff66cc";
          ctx.beginPath();
          ctx.arc(e.x, e.y + bob, ENEMY_R, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Bullets.
      ctx.fillStyle = "#ffe14d";
      for (const bl of s.bullets) {
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, BULLET_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,225,77,0.35)";
        ctx.beginPath();
        ctx.arc(bl.x, bl.y, BULLET_R + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffe14d";
      }

      // Octopus + cannon.
      if (!s.gameOver) {
        drawOctopus(ctx, cx, cy, s.angle, frameRef.current, info.bodyColor, info.bodyShade);
      }

      // ─ HUD ─
      // Hearts (centered directly below the octopus).
      const heartSpacing = 24;
      const heartsW = (MAX_HEARTS - 1) * heartSpacing + 14;
      const heartsX = cx - heartsW / 2;
      const heartsY = cy + OCTO_R + 24;
      for (let i = 0; i < MAX_HEARTS; i++) {
        if (i < s.hearts) {
          drawHeart(ctx, heartsX + i * heartSpacing, heartsY);
        } else {
          ctx.fillStyle = "#0a3048";
          ctx.fillRect(heartsX + i * heartSpacing + 2, heartsY + 2, 12, 12);
        }
      }

      // Survival time (top-center).
      const shownMs = (s.gameOver ? s.endTime : performance.now()) - s.startTime;
      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 28px "Courier New", monospace';
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(formatTime(shownMs), cx, 40);

      // Game Over.
      if (s.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, cy - 90, d.w, 180);

        ctx.fillStyle = "#ff2222";
        ctx.font = 'bold 52px "Courier New", monospace';
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", cx, cy - 20);

        ctx.fillStyle = "#ffffff";
        ctx.font = '24px "Courier New", monospace';
        ctx.fillText(`You survived ${formatTime(shownMs)}`, cx, cy + 22);
      }

      ctx.textAlign = "start";
      ctx.textBaseline = "alphabetic";
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initState, info, tryFire]);

  // Keyboard.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === " ") initAudio();
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const handleRestart = () => {
    setGameOver(false);
    stateRef.current = initState();
    initAudio();
  };

  // ─ Pointer aiming / firing on the canvas ─
  const onCanvasMouseMove = (e: React.MouseEvent) => {
    aimAt(e.clientX, e.clientY);
  };
  const onCanvasMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    initAudio();
    aimAt(e.clientX, e.clientY);
    fireRef.current = true;
  };
  const onCanvasMouseUp = () => {
    fireRef.current = false;
  };
  const onCanvasTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    initAudio();
    const t = e.touches[0];
    if (t) aimAt(t.clientX, t.clientY);
  };
  const onCanvasTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const t = e.touches[0];
    if (t) aimAt(t.clientX, t.clientY);
  };

  // ─ Mobile FIRE button ─
  const onFireStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    initAudio();
    fireRef.current = true;
  };
  const onFireEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    fireRef.current = false;
  };

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
        background: "#031428",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        width={dims.w}
        height={dims.h}
        onMouseMove={onCanvasMouseMove}
        onMouseDown={onCanvasMouseDown}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseUp}
        onTouchStart={onCanvasTouchStart}
        onTouchMove={onCanvasTouchMove}
        style={{
          display: "block",
          width: dims.w,
          height: dims.h,
          touchAction: "none",
          cursor: "crosshair",
        }}
      />

      {/* Game Over overlay buttons */}
      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: "60%",
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            padding: "0 12px",
          }}
        >
          <button onClick={handleRestart} style={btnStyle}>
            PLAY AGAIN
          </button>
          <button onClick={onRestart} style={btnStyle}>
            MAIN MENU
          </button>
          <button onClick={onHome} style={btnStyle}>
            HOME
          </button>
        </div>
      )}

      {/* Mobile FIRE control */}
      {isMobile && !gameOver && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <button
            onTouchStart={onFireStart}
            onTouchEnd={onFireEnd}
            onMouseDown={onFireStart}
            onMouseUp={onFireEnd}
            onMouseLeave={onFireEnd}
            style={fireBtnStyle}
          >
            FIRE
          </button>
        </div>
      )}
    </div>
  );
}

const fireBtnStyle: React.CSSProperties = {
  width: 200,
  height: 88,
  fontSize: 28,
  background: "#cc2200",
  color: "#fff",
  fontFamily: '"Courier New", monospace',
  border: "2px solid #ff4422",
  borderRadius: 8,
  cursor: "pointer",
  touchAction: "none",
  WebkitTapHighlightColor: "transparent",
};

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: 18,
  fontFamily: '"Courier New", monospace',
  background: "#031428",
  color: "#33d6ff",
  border: "2px solid #33d6ff",
  borderRadius: 4,
  cursor: "pointer",
};
