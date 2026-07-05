/**
 * Generates apple-touch-icon.png (180x180) with pixel-art "GG"
 * in Super Mario World style. Zero external dependencies — uses
 * only Node built-in zlib for PNG deflate.
 *
 * Usage: node scripts/generate-icon.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 180;
const CELL = 10; // each pixel-art cell = 10×10 real pixels
const GRID = SIZE / CELL; // 18×18 grid

// ── Colors (Super Mario World palette) ──────────────────────
const BG      = [0x30, 0x80, 0xF0]; // sky blue
const FILL    = [0xFF, 0xE0, 0x40]; // coin yellow
const OUTLINE = [0xB0, 0x30, 0x00]; // dark red
const SHADOW  = [0x80, 0x20, 0x00]; // deeper shadow
const HILITE  = [0xFF, 0xF0, 0x90]; // highlight

// ── Letter "G" bitmap (7 wide × 9 tall) ─────────────────────
// 0=empty, 1=fill, 2=outline
const G = [
  [0,2,2,2,2,2,0],
  [2,1,1,1,1,2,0],
  [2,1,2,2,2,0,0],
  [2,1,2,0,0,0,0],
  [2,1,2,1,1,2,0],
  [2,1,2,2,1,1,2],
  [2,1,2,2,2,1,2],
  [2,1,1,1,1,1,2],
  [0,2,2,2,2,2,0],
];

const LETTER_W = G[0].length; // 7
const LETTER_H = G.length;    // 9
const GAP = 1;
const TOTAL_W = LETTER_W * 2 + GAP; // 15
const TOTAL_H = LETTER_H;           // 9

// Center in the 18×18 grid
const OFF_X = Math.floor((GRID - TOTAL_W) / 2); // 1
const OFF_Y = Math.floor((GRID - TOTAL_H) / 2); // 4

// ── Build pixel-art grid ────────────────────────────────────
const grid = Array.from({ length: GRID }, () =>
  Array.from({ length: GRID }, () => [...BG])
);

function stamp(letter, gx, gy) {
  for (let r = 0; r < letter.length; r++) {
    for (let c = 0; c < letter[r].length; c++) {
      const val = letter[r][c];
      const x = gx + c;
      const y = gy + r;
      if (x < 0 || x >= GRID || y < 0 || y >= GRID) continue;
      if (val === 1) grid[y][x] = [...FILL];
      else if (val === 2) grid[y][x] = [...OUTLINE];
    }
  }
}

// Stamp both G's
stamp(G, OFF_X, OFF_Y);
stamp(G, OFF_X + LETTER_W + GAP, OFF_Y);

// Add highlight on fill pixels (top-left inner shine)
for (let gy = 0; gy < GRID; gy++) {
  for (let gx = 0; gx < GRID; gx++) {
    const [r, g, b] = grid[gy][gx];
    if (r === FILL[0] && g === FILL[1] && b === FILL[2]) {
      // Check if pixel above or to the left is outline (edge)
      const above = gy > 0 ? grid[gy - 1][gx] : null;
      const left = gx > 0 ? grid[gy][gx - 1] : null;
      const isEdge =
        (above && above[0] === OUTLINE[0] && above[1] === OUTLINE[1]) ||
        (left && left[0] === OUTLINE[0] && left[1] === OUTLINE[1]);
      if (isEdge) {
        grid[gy][gx] = [...HILITE];
      }
    }
  }
}

// Add drop-shadow: for outline pixels, put shadow 1 cell down-right if empty
for (let gy = GRID - 2; gy >= 0; gy--) {
  for (let gx = 0; gx < GRID - 1; gx++) {
    const [r, g, b] = grid[gy][gx];
    if (r === OUTLINE[0] && g === OUTLINE[1] && b === OUTLINE[2]) {
      const sy = gy + 1;
      const sx = gx + 1;
      if (sy < GRID && sx < GRID) {
        const t = grid[sy][sx];
        if (t[0] === BG[0] && t[1] === BG[1] && t[2] === BG[2]) {
          grid[sy][sx] = [...SHADOW];
        }
      }
    }
  }
}

// ── Expand grid to full 180×180 pixel buffer ────────────────
// Raw scanline data: each row has 1 filter byte + 3 bytes per pixel
const raw = Buffer.alloc(SIZE * (1 + SIZE * 3));
let offset = 0;
for (let y = 0; y < SIZE; y++) {
  raw[offset++] = 0; // filter: none
  const gy = Math.floor(y / CELL);
  for (let x = 0; x < SIZE; x++) {
    const gx = Math.floor(x / CELL);
    const color = grid[gy][gx];
    raw[offset++] = color[0];
    raw[offset++] = color[1];
    raw[offset++] = color[2];
  }
}

// ── PNG encoding ────────────────────────────────────────────

// CRC32 lookup table
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
}

// IHDR
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);   // width
ihdr.writeUInt32BE(SIZE, 4);   // height
ihdr[8] = 8;  // bit depth
ihdr[9] = 2;  // color type: RGB
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// IDAT
const compressed = deflateSync(raw, { level: 9 });

// Assemble PNG
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const png = Buffer.concat([
  signature,
  makeChunk("IHDR", ihdr),
  makeChunk("IDAT", compressed),
  makeChunk("IEND", Buffer.alloc(0)),
]);

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "public");
const outPath = resolve(outDir, "apple-touch-icon.png");
writeFileSync(outPath, png);
console.log(`✔ Wrote ${outPath} (${png.length} bytes)`);
