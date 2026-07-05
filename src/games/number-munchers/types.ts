/**
 * @module types
 *
 * Types and level definitions for the Number Munchers game.
 *
 * The game is aimed at ages 4–7, so every level uses simple concepts:
 * even/odd numbers, easy multiples, and single-digit addition/subtraction
 * expressions.  Difficulty ramps up across 10 levels via larger number
 * ranges, fewer correct answers, and (later) more/faster enemies.
 */

/** Board dimensions — classic Number Munchers is a 5×6 grid. */
export const ROWS = 5;
export const COLS = 6;
/** Total number of cells on the board. */
export const CELL_COUNT = ROWS * COLS;

/**
 * Selectable player character.
 *
 * - `"grayson"` — 🧒 blue theme.
 * - `"quinn"`   — 👧 purple/pink theme.
 */
export type Character = "grayson" | "quinn";

/** Visual + label metadata for each playable character. */
export const CHARACTER_INFO: Record<
  Character,
  {
    emoji: string;
    image: string;
    color: string;
    label: string;
    /**
     * Where the jaw splits, as a fraction of the face height (0 = top,
     * 1 = bottom). Tune per photo so the split lands on the mouth.
     */
    mouthRatio: number;
  }
> = {
  grayson: {
    emoji: "🧒",
    image: `${import.meta.env.BASE_URL}grayson.png`,
    color: "#4aa3ff",
    label: "GRAYSON",
    mouthRatio: 0.80,
  },
  quinn: {
    emoji: "👧",
    image: `${import.meta.env.BASE_URL}quinn.png`,
    color: "#c86bff",
    label: "QUINN",
    mouthRatio: 0.85,
  },
};

/** A single cell on the board. */
export interface Cell {
  /** Text shown in the cell (a number or a simple expression). */
  text: string;
  /** Whether eating this cell is the correct move for the level. */
  correct: boolean;
  /** Whether the cell has already been eaten (and is now empty). */
  eaten: boolean;
}

/** Definition of one level: an instruction plus value generators. */
export interface LevelSpec {
  /** Short instruction shown at the top (e.g. "EAT THE EVEN NUMBERS"). */
  instruction: string;
  /** Generates the display text for a correct cell. */
  makeCorrect: () => string;
  /** Generates the display text for an incorrect cell. */
  makeWrong: () => string;
}

/** Random integer in the inclusive range [min, max]. */
export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Builds an "even numbers up to `max`" level spec. */
function evenLevel(max: number): LevelSpec {
  return {
    instruction: `EAT THE EVEN NUMBERS`,
    makeCorrect: () => String(2 * randInt(1, Math.floor(max / 2))),
    makeWrong: () => String(2 * randInt(0, Math.floor((max - 1) / 2)) + 1),
  };
}

/** Builds an "odd numbers up to `max`" level spec. */
function oddLevel(max: number): LevelSpec {
  return {
    instruction: `EAT THE ODD NUMBERS`,
    makeCorrect: () => String(2 * randInt(0, Math.floor((max - 1) / 2)) + 1),
    makeWrong: () => String(2 * randInt(1, Math.floor(max / 2))),
  };
}

/** Builds a "multiples of `k`" level spec (correct values k..max). */
function multipleLevel(k: number, max: number): LevelSpec {
  return {
    instruction: `EAT THE MULTIPLES OF ${k} (${k}, ${k * 2}, ${k * 3} ...)`,
    makeCorrect: () => String(k * randInt(1, Math.floor(max / k))),
    makeWrong: () => {
      let x: number;
      do {
        x = randInt(1, max);
      } while (x % k === 0);
      return String(x);
    },
  };
}

/** Builds an "expressions that add up to `n`" level spec. */
function addLevel(n: number): LevelSpec {
  return {
    instruction: `EAT NUMBERS THAT ADD UP TO ${n}`,
    makeCorrect: () => {
      const a = randInt(0, n);
      return `${a}+${n - a}`;
    },
    makeWrong: () => {
      let a: number;
      let b: number;
      do {
        a = randInt(0, n);
        b = randInt(0, n);
      } while (a + b === n);
      return `${a}+${b}`;
    },
  };
}

/** Builds a "subtraction expressions that equal `n`" level spec. */
function subLevel(n: number): LevelSpec {
  return {
    instruction: `EAT NUMBERS THAT TAKE AWAY TO ${n}`,
    makeCorrect: () => {
      const b = randInt(0, 9);
      return `${n + b}-${b}`;
    },
    makeWrong: () => {
      let a: number;
      let b: number;
      do {
        a = randInt(n, n + 9);
        b = randInt(0, 9);
      } while (a - b === n || a - b < 0);
      return `${a}-${b}`;
    },
  };
}

/**
 * The 10 levels, ordered from easiest to hardest.
 *
 * Progression: small even/odd → simple multiples → addition → subtraction
 * → larger ranges. Enemy count/speed is scaled separately in the game.
 */
export const LEVELS: LevelSpec[] = [
  evenLevel(10), // 1
  oddLevel(10), // 2
  addLevel(randInt(0, 15)), // 3
  multipleLevel(5, 50), // 4
  evenLevel(20), // 5
  multipleLevel(10, 100), // 6
  subLevel(randInt(0, 15)), // 7
  addLevel(randInt(0, 15)), // 8
  subLevel(randInt(0, 15)), // 9
  multipleLevel(3, 30), // 10
];

/** Total number of levels. */
export const LEVEL_COUNT = LEVELS.length;
