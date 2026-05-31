/**
 * @module App
 *
 * Root component for **Grayson Games**.
 *
 * Sets up client-side routing with React Router. Each game lives
 * under its own route (e.g. `/grayson-games/space-battle`).
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import SpaceBattle from "./games/space-battle";

/**
 * Root application component with client-side routing.
 */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/grayson-games/" element={<Home />} />
        <Route path="/grayson-games/space-battle" element={<SpaceBattle />} />
      </Routes>
    </BrowserRouter>
  );
}
