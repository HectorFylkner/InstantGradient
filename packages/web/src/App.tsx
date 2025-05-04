/**
 * Main application layout and routing setup.
 */
import { Routes, Route } from 'react-router-dom';
import GradientEditor from './GradientEditor'; // New component for the editor UI
import GradientLoader from './GradientLoader'; // New component for loading shared gradients

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GradientEditor />} />
      <Route path="/g/:slug" element={<GradientLoader />} />
      {/* TODO: Add a 404 Not Found route */}
    </Routes>
  );
} 