import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './Components/Navbar/Navbar';
import Home from './Pages/Home/Home';
import AboutUs from './Pages/AboutUs/AboutUs';
import Leaderboard from './Pages/Leaderboard/Leaderboard';
import TournamentPage from './Pages/Tournaments/Tournament';
import PlayChess from './Pages/PlayChess/PlayChess';
import './App.css';

const App = () => {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
          <Navbar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<AboutUs />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/tournaments" element={<TournamentPage />} />
            <Route path="/play" element={<PlayChess />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
};

export default App;