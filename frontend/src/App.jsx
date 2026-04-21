import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CitizenPage from './pages/CitizenPage';
import OfficialPage from './pages/OfficialPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<CitizenPage />} />
          <Route path="/report" element={<CitizenPage />} />
          <Route path="/admin" element={<OfficialPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;