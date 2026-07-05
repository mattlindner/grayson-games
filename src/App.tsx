/**
 * @module App
 *
 * Root component for **Grayson Games**.
 *
 * Sets up client-side routing with React Router using `HashRouter`
 * so GitHub Pages works without a 404.html redirect hack.
 * Routes use hash-based URLs (e.g. `/#/space-battle`).
 */
import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import SpaceBattle from "./games/space-battle";
import NumberMunchers from "./games/number-munchers";

/**
 * Root application component with hash-based client-side routing.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/space-battle" element={<SpaceBattle />} />
        <Route path="/number-munchers" element={<NumberMunchers />} />
      </Routes>
    </HashRouter>
  );
}
