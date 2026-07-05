/**
 * @module Home
 *
 * Landing page with a Super Mario World–inspired theme.
 * Bright blue sky, green hills, and game cards styled as world-map level nodes.
 */
import { useNavigate } from "react-router-dom";
import { useRef, useEffect } from "react";

interface GameEntry {
  label: string;
  icon: string;
  route: string;
  color: string;
}

const GAMES: GameEntry[] = [
  {
    label: "SPACE BATTLE",
    icon: "🚀",
    route: "/space-battle",
    color: "#e83020",
  },
  {
    label: "NUMBER MUNCHERS",
    icon: "🔢",
    route: "/number-munchers",
    color: "#2fbf2f",
  },
];

/** Draws the scrolling hill / sky background onto a canvas. */
function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number, frame: number) {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#3080f0");
  grad.addColorStop(0.55, "#60b8ff");
  grad.addColorStop(0.7, "#90d8ff");
  grad.addColorStop(1, "#60b8ff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Clouds (slow drift)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const clouds = [
    [0.12, 0.10, 70, 24],
    [0.38, 0.06, 50, 18],
    [0.62, 0.14, 60, 20],
    [0.85, 0.08, 55, 19],
    [0.25, 0.22, 45, 16],
    [0.72, 0.20, 65, 22],
  ];
  for (const [rx, ry, cw, ch] of clouds) {
    const cx = ((rx * w + frame * 0.15) % (w + cw * 2)) - cw;
    ctx.beginPath();
    ctx.ellipse(cx, ry * h, cw / 2, ch / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - cw * 0.25, ry * h + ch * 0.15, cw * 0.35, ch * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + cw * 0.28, ry * h + ch * 0.12, cw * 0.3, ch * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Far hills
  ctx.fillStyle = "#48a848";
  drawHillRow(ctx, w, h, 0.62, 80, 0.4, frame * 0.08);
  // Near hills
  ctx.fillStyle = "#30983a";
  drawHillRow(ctx, w, h, 0.72, 100, 0.55, frame * 0.15);
  // Ground
  ctx.fillStyle = "#28a028";
  ctx.fillRect(0, h * 0.82, w, h * 0.2);
  // Ground detail stripe
  ctx.fillStyle = "#1e8820";
  ctx.fillRect(0, h * 0.82, w, 4);
  ctx.fillStyle = "#34b838";
  ctx.fillRect(0, h * 0.84, w, 3);
}

function drawHillRow(ctx: CanvasRenderingContext2D, w: number, h: number, baseY: number, radius: number, spacing: number, offset: number) {
  const y = h * baseY;
  const step = w * spacing;
  for (let x = -radius + (offset % step); x < w + radius; x += step) {
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.4, radius, radius, 0, Math.PI, 0);
    ctx.fill();
  }
  ctx.fillRect(0, y, w, h - y);
}

export default function Home() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const loop = () => {
      frameRef.current++;
      drawBackground(ctx, canvas.width, canvas.height, frameRef.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={containerStyle}>
      <canvas ref={canvasRef} style={canvasBgStyle} />

      <div style={contentStyle}>
        <h1 style={titleStyle}>
          <span style={titleMainStyle}>GRAYSON</span>
          <span style={titleSubStyle}>GAMES</span>
        </h1>

        <div style={gridStyle}>
          {GAMES.map((game) => (
            <button
              key={game.route}
              onClick={() => navigate(game.route)}
              style={cardStyle}
            >
              <div style={nodeCircleStyle}>
                <div style={iconStyle}>{game.icon}</div>
              </div>
              <div style={cardLabelStyle}>{game.label}</div>
            </button>
          ))}
        </div>

        <div style={footerStyle}>★ MORE GAMES COMING SOON ★</div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  position: "relative",
  overflow: "hidden",
};

const canvasBgStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  zIndex: 0,
};

const contentStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "36px 16px",
  overflowY: "auto",
  boxSizing: "border-box",
};

const titleStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  margin: "0 0 36px 0",
};

const titleMainStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(48px, 12vw, 80px)",
  fontWeight: "bold",
  color: "#ffe040",
  textShadow:
    "3px 3px 0 #b03000, -1px -1px 0 #b03000, 1px -1px 0 #b03000, -1px 1px 0 #b03000, 0 4px 0 #802000",
  letterSpacing: 6,
  lineHeight: 1,
};

const titleSubStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(28px, 7vw, 48px)",
  fontWeight: "bold",
  color: "#fff",
  textShadow:
    "2px 2px 0 #b03000, -1px -1px 0 #b03000, 1px -1px 0 #b03000, -1px 1px 0 #b03000",
  letterSpacing: 10,
  lineHeight: 1.4,
};

const gridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 24,
  maxWidth: 560,
  width: "100%",
};

const cardStyle: React.CSSProperties = {
  width: 240,
  padding: "28px 20px 22px",
  background: "rgba(0, 0, 0, 0.25)",
  border: "3px solid #ffe040",
  borderRadius: 16,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  backdropFilter: "blur(2px)",
  boxShadow: "0 4px 0 #b08800, inset 0 1px 0 rgba(255,255,255,0.2)",
};

const nodeCircleStyle: React.CSSProperties = {
  width: 96,
  height: 96,
  borderRadius: "50%",
  background: "radial-gradient(circle at 35% 35%, #ffe870, #d0a000)",
  border: "3px solid #fff",
  boxShadow: "0 3px 0 #806000, inset 0 -4px 8px rgba(0,0,0,0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const iconStyle: React.CSSProperties = {
  fontSize: 48,
};

const cardLabelStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 16,
  fontWeight: "bold",
  color: "#fff",
  textShadow: "1px 1px 0 #000, 2px 2px 0 rgba(0,0,0,0.3)",
  letterSpacing: 2,
  textAlign: "center",
};

const footerStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 13,
  fontWeight: "bold",
  color: "#ffe040",
  textShadow: "1px 1px 0 #803000",
  marginTop: 40,
  letterSpacing: 3,
};
