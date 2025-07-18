import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import Navbar from './Components/Navbar/Navbar';
import ProtectedRoute from './Components/ProtectedRoute/ProtectedRoute';
import Home from './Pages/Home/Home';
import AboutUs from './Pages/AboutUs/AboutUs';
import Leaderboard from './Pages/Leaderboard/Leaderboard';
import TournamentPage from './Pages/Tournaments/Tournament';
import PlayChess from './Pages/PlayChess/PlayChess';
import GamesPage from './Pages/Games/GamesPage';
import Login from './Pages/Auth/Login';
import Register from './Pages/Auth/Register';
import AdminDashboard from './Pages/Admin/AdminDashboard';
import { Analytics } from "@vercel/analytics/react"
import './App.css';

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <Analytics/>
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/about" element={<AboutUs />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/tournaments" element={<TournamentPage />} />
              <Route path="/games" element={<GamesPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route 
                path="/play" 
                element={
                  <ProtectedRoute>
                    <PlayChess />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute adminOnly={true}>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;