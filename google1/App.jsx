// src/App.jsx
// Root component: sets up React Router + AuthContext.

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import CitizenReportPage from "./pages/CitizenReportPage";
import AdminDashboardPage from "./pages/AdminDashboardPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Citizen-facing: mobile-friendly report form */}
        <Route path="/report" element={<CitizenReportPage />} />

        {/* Admin: full dashboard */}
        <Route path="/admin" element={<AdminDashboardPage />} />

        {/* Default: redirect to report page */}
        <Route path="*" element={<Navigate to="/report" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
