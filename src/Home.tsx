/**
 * @module Home
 *
 * Landing page listing all available games.
 */
import { Link } from "react-router-dom";

/**
 * Home page with links to each game.
 */
export default function Home() {
  return (
    <div style={containerStyle}>
      <div style={scanlinesStyle} />
      <div style={innerStyle}>
        <h1 style={titleStyle}>GRAYSON GAMES</h1>
        <div style={gamesListStyle}>
          <Link to="/grayson-games/space-battle" style={gameLinkStyle}>
            <div style={gameCardStyle}>
              <div style={gameEmojiStyle}>🚀</div>
              <div style={gameTitleStyle}>SPACE BATTLE</div>
              <div style={gameDescStyle}>
                Defend the galaxy from alien invaders
              </div>
            </div>
          </Link>
        </div>
        <div style={footerStyle}>MORE GAMES COMING SOON...</div>
      </div>
    </div>
  );
}

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

const innerStyle: React.CSSProperties = {
  textAlign: "center",
  padding: 32,
  maxWidth: 520,
  width: "100%",
};

const titleStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: "clamp(28px, 7vw, 48px)",
  color: "#00ff00",
  textShadow: "0 0 20px #00ff00, 0 0 40px #00aa00",
  margin: "0 0 40px 0",
  letterSpacing: 6,
};

const gamesListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16,
  alignItems: "center",
};

const gameLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  width: "100%",
  maxWidth: 360,
};

const gameCardStyle: React.CSSProperties = {
  border: "2px solid #00ff00",
  borderRadius: 6,
  padding: "20px 24px",
  cursor: "pointer",
  transition: "box-shadow 0.2s",
  boxShadow: "0 0 12px rgba(0, 255, 0, 0.2)",
};

const gameEmojiStyle: React.CSSProperties = {
  fontSize: 36,
  marginBottom: 8,
};

const gameTitleStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 22,
  color: "#00ff00",
  textShadow: "0 0 8px #00ff00",
  letterSpacing: 4,
};

const gameDescStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 12,
  color: "#00aa00",
  marginTop: 6,
};

const footerStyle: React.CSSProperties = {
  fontFamily: '"Courier New", monospace',
  fontSize: 12,
  color: "#444",
  marginTop: 40,
  letterSpacing: 3,
};
