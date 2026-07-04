/**
 * @module Game
 *
 * Core game engine and React component for **Grayson Space Battle**.
 *
 * The game runs a `requestAnimationFrame` loop that updates and renders
 * all entities on an HTML `<canvas>`.  Input is handled via keyboard
 * events (desktop) and virtual touch controls (mobile).
 */
import { useRef, useEffect, useCallback, useState } from "react";
import {
  playShoot,
  playEnemyShoot,
  playExplosion,
  playHit,
  playLevelUp,
  playGameOver,
  initAudio,
} from "./sounds";
import type { Character } from "./types";

// ─── Constants ───────────────────────────────────────────────

/** Logical canvas width in pixels (the game world is always this wide). */
const CANVAS_W = 480;
/** Logical canvas height in pixels. */
const CANVAS_H = 640;
/** Player ship sprite width in pixels. */
const PLAYER_W = 40;
/** Player ship sprite height in pixels. */
const PLAYER_H = 32;
/** Player horizontal movement speed in pixels per frame. */
const PLAYER_SPEED = 5;
/** Laser beam width in pixels. */
const LASER_W = 4;
/** Laser beam height in pixels. */
const LASER_H = 14;
/** Laser vertical speed in pixels per frame. */
const LASER_SPEED = 8;
/** Minimum time between player shots in milliseconds. */
const LASER_COOLDOWN = 200;
/** Enemy sprite width in pixels. */
const ENEMY_W = 36;
/** Enemy sprite height in pixels. */
const ENEMY_H = 28;
/** Initial number of enemy rows per wave. */
const ENEMY_ROWS = 2;
/** Initial number of enemy columns per wave. */
const ENEMY_COLS = 5;
/** Base enemy horizontal movement speed (unused directly — wave motion is sinusoidal). */
const ENEMY_BASE_SPEED = 1.0;
/** Enemy missile width in pixels. */
const MISSILE_W = 4;
/** Enemy missile height in pixels. */
const MISSILE_H = 10;
/** Base missile vertical speed in pixels per frame before level scaling. */
const MISSILE_BASE_SPEED = 2.5;
/** Per-enemy per-frame probability of firing a missile. */
const MISSILE_CHANCE = 0.0015;
/** Number of enemy kills required to advance to the next level. */
const KILLS_PER_LEVEL = 10;
/** Multiplicative speed increase per level (5 %). */
const SPEED_INCREASE = 0.05;
/** Maximum (and starting) player health in hearts. */
const MAX_HEARTS = 3;
/** Number of background parallax stars. */
const STAR_COUNT = 80;

// ─── Types ───────────────────────────────────────────────────

/** A simple 2-D position vector. */
interface Vec2 {
  /** Horizontal coordinate (pixels from the left edge of the canvas). */
  x: number;
  /** Vertical coordinate (pixels from the top edge of the canvas). */
  y: number;
}

/** An enemy alien entity. */
interface Enemy extends Vec2 {
  /** Whether this enemy is still alive and should be rendered / collided. */
  alive: boolean;
  /** Animation frame counter — incremented every tick for sprite animation. */
  frame: number;
  /** The Y coordinate this enemy descends to during its entry phase. */
  targetY: number;
}

/** A visual particle emitted during explosions. */
interface Particle extends Vec2 {
  /** Horizontal velocity in pixels per frame. */
  vx: number;
  /** Vertical velocity in pixels per frame. */
  vy: number;
  /** Remaining lifetime in frames. */
  life: number;
  /** Initial lifetime in frames (used to compute fade-out alpha). */
  maxLife: number;
  /** CSS color string for this particle. */
  color: string;
}

/** A background parallax star. */
interface Star {
  /** Horizontal position in pixels. */
  x: number;
  /** Vertical position in pixels. */
  y: number;
  /** Downward scroll speed in pixels per frame. */
  speed: number;
  /** Opacity multiplier (0–1). */
  brightness: number;
}

/**
 * Complete mutable state for a single game session.
 *
 * Stored in a React ref so the `requestAnimationFrame` loop can mutate
 * it without triggering re-renders.
 */
interface GameState {
  /** Current player position (top-left corner of the sprite). */
  player: Vec2;
  /** Active player laser beams moving upward. */
  lasers: Vec2[];
  /** All enemies in the current wave (alive or dead). */
  enemies: Enemy[];
  /** Active enemy missiles moving downward. */
  missiles: Vec2[];
  /** Active explosion / hit particles. */
  particles: Particle[];
  /** Background star field. */
  stars: Star[];
  /** Remaining player health (0 = game over). */
  hearts: number;
  /** Cumulative score (100 points per kill). */
  score: number;
  /** Current difficulty level (starts at 1). */
  level: number;
  /** Kills accumulated toward the next level-up. */
  killsThisLevel: number;
  /** Whether the player has been eliminated. */
  gameOver: boolean;
  /**
   * Horizontal movement direction for legacy side-to-side logic.
   * `1` = rightward, `-1` = leftward.
   */
  enemyDir: number;
  /** Timestamp (`performance.now()`) of the last player shot. */
  lastShot: number;
  /** Sinusoidal phase angle used for Galaga-style wave motion. */
  wavePhase: number;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Axis-Aligned Bounding Box (AABB) overlap test.
 *
 * @param ax - Left edge of rectangle A.
 * @param ay - Top edge of rectangle A.
 * @param aw - Width of rectangle A.
 * @param ah - Height of rectangle A.
 * @param bx - Left edge of rectangle B.
 * @param by - Top edge of rectangle B.
 * @param bw - Width of rectangle B.
 * @param bh - Height of rectangle B.
 * @returns `true` if the two rectangles overlap.
 */
function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Creates a new wave of enemies arranged in a grid.
 *
 * The number of columns and rows increases with {@link level} to raise
 * difficulty.  Enemies are spawned above the visible canvas so they
 * smoothly descend into view.
 *
 * @param level - Current game level (1-based). Higher levels produce
 *                more columns (up to 8) and rows (up to 4).
 * @returns An array of freshly-spawned {@link Enemy} objects.
 */
function spawnWave(level: number): Enemy[] {
  const enemies: Enemy[] = [];
  const cols = Math.min(ENEMY_COLS + Math.floor(level / 3), 8);
  const rows = Math.min(ENEMY_ROWS + Math.floor(level / 4), 4);
  const totalW = cols * (ENEMY_W + 16) - 16;
  const startX = (CANVAS_W - totalW) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      enemies.push({
        x: startX + c * (ENEMY_W + 16),
        y: -50 - r * (ENEMY_H + 14), // start above screen
        targetY: 40 + r * (ENEMY_H + 14),
        alive: true,
        frame: 0,
      });
    }
  }
  return enemies;
}

/**
 * Generates the initial background star field.
 *
 * Each star has a random position, scroll speed, and brightness so the
 * parallax effect looks natural.
 *
 * @returns An array of {@link Star} objects spanning the full canvas.
 */
function spawnStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * CANVAS_W,
    y: Math.random() * CANVAS_H,
    speed: 0.3 + Math.random() * 1.2,
    brightness: 0.3 + Math.random() * 0.7,
  }));
}

/**
 * Creates a burst of {@link Particle}s at a given position.
 *
 * Used for both enemy-destroyed and player-hit visual effects.  Twelve
 * particles are emitted in random directions with warm colors.
 *
 * @param x - Center X coordinate of the explosion.
 * @param y - Center Y coordinate of the explosion.
 * @returns An array of new particles to merge into the game state.
 */
function createExplosion(x: number, y: number): Particle[] {
  const colors = ["#ff4444", "#ff8800", "#ffcc00", "#ffffff"];
  return Array.from({ length: 12 }, () => {
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

// ─── 16-bit style drawing helpers ────────────────────────────

/**
 * Draws the player's spaceship sprite using filled rectangles.
 *
 * The sprite is drawn in a 16-bit pixel-art style with a blue body,
 * darker wings, a light-blue cockpit, orange engine glow with random
 * flicker, and red wing-tip lights.
 *
 * @param ctx - The 2-D rendering context of the game canvas.
 * @param x   - Left edge of the sprite.
 * @param y   - Top edge of the sprite.
 */
function drawPlayer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Ship body
  ctx.fillStyle = "#4488ff";
  ctx.fillRect(x + 12, y, 16, PLAYER_H);
  // Wings
  ctx.fillStyle = "#3366cc";
  ctx.fillRect(x, y + 16, 12, 16);
  ctx.fillRect(x + 28, y + 16, 12, 16);
  // Cockpit
  ctx.fillStyle = "#88ccff";
  ctx.fillRect(x + 16, y + 4, 8, 8);
  // Engine glow
  ctx.fillStyle = "#ff6600";
  ctx.fillRect(x + 16, y + PLAYER_H, 8, 4);
  ctx.fillStyle = "#ffcc00";
  ctx.fillRect(x + 18, y + PLAYER_H, 4, 2 + Math.random() * 3);
  // Wing tips
  ctx.fillStyle = "#ff4444";
  ctx.fillRect(x, y + 28, 4, 4);
  ctx.fillRect(x + 36, y + 28, 4, 4);
}

/**
 * Draws Quinn's pink unicorn spaceship sprite using filled rectangles.
 *
 * Features a pink body, a unicorn horn on top, a magenta mane flowing
 * from the cockpit, and sparkly wing-tip accents.
 *
 * @param ctx - The 2-D rendering context of the game canvas.
 * @param x   - Left edge of the sprite.
 * @param y   - Top edge of the sprite.
 */
function drawPlayerQuinn(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Unicorn horn
  ctx.fillStyle = "#ffdd44";
  ctx.fillRect(x + 18, y - 8, 4, 8);
  ctx.fillStyle = "#ffee88";
  ctx.fillRect(x + 19, y - 6, 2, 4);
  // Ship body (pink)
  ctx.fillStyle = "#ff66aa";
  ctx.fillRect(x + 12, y, 16, PLAYER_H);
  // Wings (darker pink)
  ctx.fillStyle = "#cc4488";
  ctx.fillRect(x, y + 16, 12, 16);
  ctx.fillRect(x + 28, y + 16, 12, 16);
  // Cockpit
  ctx.fillStyle = "#ffaadd";
  ctx.fillRect(x + 16, y + 4, 8, 8);
  // Mane (flowing magenta streaks)
  ctx.fillStyle = "#dd22aa";
  ctx.fillRect(x + 14, y + 2, 3, 6);
  ctx.fillRect(x + 23, y + 2, 3, 6);
  // Engine glow (purple/pink)
  ctx.fillStyle = "#cc44ff";
  ctx.fillRect(x + 16, y + PLAYER_H, 8, 4);
  ctx.fillStyle = "#ff88ff";
  ctx.fillRect(x + 18, y + PLAYER_H, 4, 2 + Math.random() * 3);
  // Wing-tip sparkles (alternating white/gold)
  ctx.fillStyle = Math.random() > 0.5 ? "#ffffff" : "#ffdd44";
  ctx.fillRect(x, y + 28, 4, 4);
  ctx.fillRect(x + 36, y + 28, 4, 4);
}

/**
 * Draws an enemy alien sprite using filled rectangles.
 *
 * Features animated eyes that shift horizontally and wiggling tentacles
 * driven by the {@link frame} counter.
 *
 * @param ctx   - The 2-D rendering context of the game canvas.
 * @param x     - Left edge of the sprite.
 * @param y     - Top edge of the sprite.
 * @param frame - Animation frame counter used to animate eyes and tentacles.
 */
function drawEnemy(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number
) {
  // Body
  ctx.fillStyle = "#44dd44";
  ctx.fillRect(x + 8, y + 4, 20, 20);
  // Head
  ctx.fillStyle = "#33bb33";
  ctx.fillRect(x + 12, y, 12, 8);
  // Eyes
  ctx.fillStyle = "#ff0000";
  const eyeOff = Math.floor(frame / 15) % 2 === 0 ? 0 : 2;
  ctx.fillRect(x + 14 + eyeOff, y + 8, 4, 4);
  ctx.fillRect(x + 22 - eyeOff, y + 8, 4, 4);
  // Tentacles
  ctx.fillStyle = "#22aa22";
  const wiggle = Math.sin(frame * 0.15) * 2;
  ctx.fillRect(x + 4 + wiggle, y + 20, 6, 8);
  ctx.fillRect(x + 26 - wiggle, y + 20, 6, 8);
  // Antennae
  ctx.fillStyle = "#66ff66";
  ctx.fillRect(x + 10, y - 4, 2, 6);
  ctx.fillRect(x + 24, y - 4, 2, 6);
}

/**
 * Draws a small pixel-art heart icon for the health HUD.
 *
 * @param ctx - The 2-D rendering context of the game canvas.
 * @param x   - Left edge of the heart.
 * @param y   - Top edge of the heart.
 */
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = "#ff2255";
  // Simple pixel heart
  ctx.fillRect(x + 2, y, 4, 4);
  ctx.fillRect(x + 8, y, 4, 4);
  ctx.fillRect(x, y + 2, 14, 4);
  ctx.fillRect(x + 2, y + 6, 10, 4);
  ctx.fillRect(x + 4, y + 10, 6, 2);
  ctx.fillRect(x + 6, y + 12, 2, 2);
}

// ─── Component ───────────────────────────────────────────────

/** Props accepted by the {@link Game} component. */
interface GameProps {
  /**
   * Callback invoked when the player chooses to return to the
   * loading / character-select screen after a game-over.
   */
  onRestart: () => void;
  /** Callback to navigate back to the home page (game list). */
  onHome: () => void;
  /** The selected player character, determines ship appearance. */
  character: Character;
}

/**
 * Main game component.
 *
 * Renders an HTML `<canvas>` element sized to fit the viewport and
 * drives the game loop via `requestAnimationFrame`.  On mobile devices
 * an additional row of virtual touch controls (D-pad + FIRE button) is
 * rendered below the canvas.
 *
 * @param props - {@link GameProps}
 * @returns The game canvas and (optionally) mobile controls / game-over buttons.
 */
export default function Game({ onRestart, onHome, character }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameState | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  const touchRef = useRef<{ left: boolean; right: boolean; fire: boolean }>({
    left: false,
    right: false,
    fire: false,
  });
  const [gameOver, setGameOver] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);

  // Detect mobile
  useEffect(() => {
    const check = () => {
      setIsMobile(
        "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth < 768
      );
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Compute canvas scale to fit the viewport
  useEffect(() => {
    const resize = () => {
      const controlsHeight = isMobile ? 140 : 0;
      const availH = window.innerHeight - controlsHeight;
      const availW = window.innerWidth;
      const scale = Math.min(availW / CANVAS_W, availH / CANVAS_H, 1.5);
      setCanvasScale(scale);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isMobile]);

  // Initialize game state
  const initState = useCallback((): GameState => {
    return {
      player: { x: CANVAS_W / 2 - PLAYER_W / 2, y: CANVAS_H - 60 },
      lasers: [],
      enemies: spawnWave(1),
      missiles: [],
      particles: [],
      stars: spawnStars(),
      hearts: MAX_HEARTS,
      score: 0,
      level: 1,
      killsThisLevel: 0,
      gameOver: false,
      enemyDir: 1,
      lastShot: 0,
      wavePhase: 0,
    };
  }, []);

  // Main game loop
  useEffect(() => {
    initAudio();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    stateRef.current = initState();

    const loop = () => {
      const s = stateRef.current!;
      if (!s.gameOver) {
        update(s);
      }
      draw(ctx, s);
      rafRef.current = requestAnimationFrame(loop);
    };

    function update(s: GameState) {
      const keys = keysRef.current;
      const touch = touchRef.current;
      const speedMul = 1 + (s.level - 1) * SPEED_INCREASE;

      // ─ Player movement ─
      if (keys.has("ArrowLeft") || touch.left) {
        s.player.x = Math.max(0, s.player.x - PLAYER_SPEED);
      }
      if (keys.has("ArrowRight") || touch.right) {
        s.player.x = Math.min(CANVAS_W - PLAYER_W, s.player.x + PLAYER_SPEED);
      }

      // ─ Shooting ─
      const now = performance.now();
      if ((keys.has(" ") || touch.fire) && now - s.lastShot > LASER_COOLDOWN) {
        s.lasers.push({ x: s.player.x + PLAYER_W / 2 - LASER_W / 2, y: s.player.y });
        s.lastShot = now;
        playShoot();
      }

      // ─ Lasers ─
      s.lasers = s.lasers.filter((l) => {
        l.y -= LASER_SPEED;
        return l.y > -LASER_H;
      });

      // ─ Stars ─
      for (const star of s.stars) {
        star.y += star.speed;
        if (star.y > CANVAS_H) {
          star.y = 0;
          star.x = Math.random() * CANVAS_W;
        }
      }

      // ─ Enemy wave movement (Galaga-style) ─
      // Find the leftmost and rightmost alive enemies to bounce off walls
      let minX = CANVAS_W;
      let maxX = 0;
      for (const e of s.enemies) {
        if (!e.alive) continue;
        if (e.x < minX) minX = e.x;
        if (e.x + ENEMY_W > maxX) maxX = e.x + ENEMY_W;
      }

      const moveSpeed = 1.5 * speedMul;

      // Reverse direction when the formation hits either edge
      if (maxX >= CANVAS_W - 4 && s.enemyDir > 0) {
        s.enemyDir = -1;
        // Drop down when reversing
        for (const e of s.enemies) {
          if (e.alive && e.y >= e.targetY) e.y += 8;
        }
      } else if (minX <= 4 && s.enemyDir < 0) {
        s.enemyDir = 1;
        for (const e of s.enemies) {
          if (e.alive && e.y >= e.targetY) e.y += 8;
        }
      }

      for (const e of s.enemies) {
        if (!e.alive) continue;
        e.frame++;
        // Descend into formation position
        if (e.y < e.targetY) {
          e.y += 2;
          if (e.y > e.targetY) e.y = e.targetY;
        } else {
          // Slow descent only once in formation
          e.y += 0.15 * speedMul;
        }
        // Side-to-side movement
        e.x += moveSpeed * s.enemyDir;
        // Clamp to screen bounds
        e.x = Math.max(0, Math.min(CANVAS_W - ENEMY_W, e.x));
      }

      // ─ Enemy shooting ─
      for (const e of s.enemies) {
        if (!e.alive || e.y < 0) continue;
        if (Math.random() < MISSILE_CHANCE * speedMul) {
          s.missiles.push({ x: e.x + ENEMY_W / 2 - MISSILE_W / 2, y: e.y + ENEMY_H });
          playEnemyShoot();
        }
      }

      // ─ Missiles ─
      s.missiles = s.missiles.filter((m) => {
        m.y += MISSILE_BASE_SPEED * speedMul;
        return m.y < CANVAS_H + MISSILE_H;
      });

      // ─ Collision: laser → enemy ─
      for (const l of s.lasers) {
        for (const e of s.enemies) {
          if (
            e.alive &&
            rectsOverlap(l.x, l.y, LASER_W, LASER_H, e.x, e.y, ENEMY_W, ENEMY_H)
          ) {
            e.alive = false;
            l.y = -999; // remove
            s.score += 100;
            s.killsThisLevel++;
            s.particles.push(...createExplosion(e.x + ENEMY_W / 2, e.y + ENEMY_H / 2));
            playExplosion();
          }
        }
      }

      // ─ Collision: missile → player ─
      for (const m of s.missiles) {
        if (
          rectsOverlap(
            m.x,
            m.y,
            MISSILE_W,
            MISSILE_H,
            s.player.x,
            s.player.y,
            PLAYER_W,
            PLAYER_H
          )
        ) {
          m.y = 9999;
          s.hearts--;
          s.particles.push(
            ...createExplosion(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2)
          );
          playHit();
          if (s.hearts <= 0) {
            s.gameOver = true;
            setGameOver(true);
            playGameOver();
          }
        }
      }

      // ─ Collision: enemy → player ─
      for (const e of s.enemies) {
        if (
          e.alive &&
          rectsOverlap(e.x, e.y, ENEMY_W, ENEMY_H, s.player.x, s.player.y, PLAYER_W, PLAYER_H)
        ) {
          e.alive = false;
          s.hearts--;
          s.particles.push(
            ...createExplosion(s.player.x + PLAYER_W / 2, s.player.y + PLAYER_H / 2)
          );
          playHit();
          if (s.hearts <= 0) {
            s.gameOver = true;
            setGameOver(true);
            playGameOver();
          }
        }
      }

      // ─ Particles ─
      s.particles = s.particles.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        return p.life > 0;
      });

      // ─ Level up ─
      if (s.enemies.every((e) => !e.alive)) {
        s.level++;
        s.killsThisLevel = 0;
        s.enemies = spawnWave(s.level);
        s.missiles = [];
        s.wavePhase = 0;
        playLevelUp();
      }

      // ─ Enemies reached bottom ─
      for (const e of s.enemies) {
        if (e.alive && e.y > CANVAS_H) {
          e.alive = false;
          s.hearts--;
          playHit();
          if (s.hearts <= 0) {
            s.gameOver = true;
            setGameOver(true);
            playGameOver();
          }
        }
      }
    }

    function draw(ctx: CanvasRenderingContext2D, s: GameState) {
      // Background
      ctx.fillStyle = "#0a0a1a";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Stars
      for (const star of s.stars) {
        ctx.globalAlpha = star.brightness;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(Math.round(star.x), Math.round(star.y), 2, 2);
      }
      ctx.globalAlpha = 1;

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        const size = 2 + (p.life / p.maxLife) * 4;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;

      // Lasers
      ctx.fillStyle = "#00ffff";
      for (const l of s.lasers) {
        ctx.fillRect(l.x, l.y, LASER_W, LASER_H);
        // Glow
        ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
        ctx.fillRect(l.x - 2, l.y - 2, LASER_W + 4, LASER_H + 4);
        ctx.fillStyle = "#00ffff";
      }

      // Missiles
      ctx.fillStyle = "#ff4444";
      for (const m of s.missiles) {
        ctx.fillRect(m.x, m.y, MISSILE_W, MISSILE_H);
        ctx.fillStyle = "#ff8844";
        ctx.fillRect(m.x - 1, m.y + MISSILE_H, MISSILE_W + 2, 4);
        ctx.fillStyle = "#ff4444";
      }

      // Enemies
      for (const e of s.enemies) {
        if (e.alive) {
          drawEnemy(ctx, e.x, e.y, e.frame);
        }
      }

      // Player
      if (!s.gameOver) {
        if (character === "quinn") {
          drawPlayerQuinn(ctx, s.player.x, s.player.y);
        } else {
          drawPlayer(ctx, s.player.x, s.player.y);
        }
      }

      // HUD
      // Hearts (below player ship, move with player)
      if (!s.gameOver) {
        const heartsW = (MAX_HEARTS - 1) * 22 + 14;
        const heartsX = s.player.x + PLAYER_W / 2 - heartsW / 2;
        const heartsY = s.player.y + PLAYER_H + 6;
        for (let i = 0; i < MAX_HEARTS; i++) {
          if (i < s.hearts) {
            drawHeart(ctx, heartsX + i * 22, heartsY);
          } else {
            ctx.fillStyle = "#333";
            ctx.fillRect(heartsX + i * 22 + 2, heartsY + 2, 12, 12);
          }
        }
      }

      // Level (top row, centered)
      ctx.fillStyle = "#ffffff";
      ctx.font = 'bold 26px "Courier New", monospace';
      ctx.textAlign = "center";
      ctx.fillText(`LEVEL ${s.level}`, CANVAS_W / 2, 26);

      // Enemies remaining (second row, left)
      const remaining = s.enemies.filter((e) => e.alive).length;
      ctx.font = 'bold 22px "Courier New", monospace';
      ctx.textAlign = "left";
      ctx.fillText(`${remaining} ENEMIES LEFT`, 10, 52);

      // Score (second row, right)
      ctx.textAlign = "right";
      ctx.fillText(`SCORE: ${s.score}`, CANVAS_W - 10, 52);

      // Game Over
      if (s.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, CANVAS_H / 2 - 80, CANVAS_W, 160);

        ctx.fillStyle = "#ff2222";
        ctx.font = 'bold 48px "Courier New", monospace';
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", CANVAS_W / 2, CANVAS_H / 2 - 10);

        ctx.fillStyle = "#ffffff";
        ctx.font = '20px "Courier New", monospace';
        ctx.fillText(`Final Score: ${s.score}`, CANVAS_W / 2, CANVAS_H / 2 + 30);
        ctx.fillText(`Level: ${s.level}`, CANVAS_W / 2, CANVAS_H / 2 + 58);
      }

      ctx.textAlign = "start";
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [initState]);

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
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

  // Touch helpers
  const onDirStart = (dir: "left" | "right") => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    initAudio();
    touchRef.current[dir] = true;
  };
  const onDirEnd = (dir: "left" | "right") => (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    touchRef.current[dir] = false;
  };
  const onFireStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    initAudio();
    touchRef.current.fire = true;
  };
  const onFireEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    touchRef.current.fire = false;
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        width: "100%",
        background: "#000",
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      <div style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            imageRendering: "pixelated",
            width: CANVAS_W * canvasScale,
            height: CANVAS_H * canvasScale,
            border: "2px solid #333",
            display: "block",
          }}
        />

        {/* Game Over overlay buttons */}
        {gameOver && (
          <div
            style={{
              position: "absolute",
              bottom: "15%",
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              gap: 12,
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
      </div>

      {/* Mobile controls */}
      {isMobile && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: Math.min(CANVAS_W * canvasScale, window.innerWidth - 20),
            padding: "10px 0",
            gap: 20,
          }}
        >
          {/* D-Pad */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onTouchStart={onDirStart("left")}
              onTouchEnd={onDirEnd("left")}
              onMouseDown={onDirStart("left")}
              onMouseUp={onDirEnd("left")}
              onMouseLeave={onDirEnd("left")}
              style={dpadStyle}
            >
              ◀
            </button>
            <button
              onTouchStart={onDirStart("right")}
              onTouchEnd={onDirEnd("right")}
              onMouseDown={onDirStart("right")}
              onMouseUp={onDirEnd("right")}
              onMouseLeave={onDirEnd("right")}
              style={dpadStyle}
            >
              ▶
            </button>
          </div>

          {/* Fire button */}
          <button
            onTouchStart={onFireStart}
            onTouchEnd={onFireEnd}
            onMouseDown={onFireStart}
            onMouseUp={onFireEnd}
            onMouseLeave={onFireEnd}
            style={{
              ...dpadStyle,
              width: 140,
              background: "#cc2200",
              color: "#fff",
              fontSize: 24,
              fontFamily: '"Courier New", monospace',
              borderColor: "#ff4422",
            }}
          >
            GRAY
          </button>
        </div>
      )}

    </div>
  );
}

const dpadStyle: React.CSSProperties = {
  width: 88,
  height: 88,
  fontSize: 36,
  background: "#222",
  color: "#888",
  border: "2px solid #444",
  borderRadius: 8,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  touchAction: "none",
  WebkitTapHighlightColor: "transparent",
};

const btnStyle: React.CSSProperties = {
  padding: "12px 24px",
  fontSize: 18,
  fontFamily: '"Courier New", monospace',
  background: "#222",
  color: "#0f0",
  border: "2px solid #0f0",
  borderRadius: 4,
  cursor: "pointer",
};
