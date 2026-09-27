/**
 * @module types
 *
 * Shared type definitions for the Octopus Cannon game.
 */

/**
 * Selectable player character.
 *
 * - `"grayson"` — blue octopus.
 * - `"quinn"`   — pink octopus.
 */
export type Character = "grayson" | "quinn";

/** Visual + label metadata for each playable octopus. */
export const CHARACTER_INFO: Record<
  Character,
  {
    /** Fallback emoji (used on the loading card). */
    emoji: string;
    /** Face photo shown on the character-select button. */
    image: string;
    /** Accent color for the button border / glow. */
    color: string;
    /** Button label. */
    label: string;
    /** Main body color of the octopus. */
    bodyColor: string;
    /** Darker shade used for tentacles / outlines. */
    bodyShade: string;
  }
> = {
  grayson: {
    emoji: "🐙",
    image: `${import.meta.env.BASE_URL}grayson.png`,
    color: "#4aa3ff",
    label: "GRAYSON",
    bodyColor: "#5aa9ff",
    bodyShade: "#2f6fd0",
  },
  quinn: {
    emoji: "🐙",
    image: `${import.meta.env.BASE_URL}quinn.png`,
    color: "#c86bff",
    label: "QUINN",
    bodyColor: "#ff77c8",
    bodyShade: "#c8489a",
  },
};
