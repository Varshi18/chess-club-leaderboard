import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './Components/Navbar/Navbar';
import Home from './Pages/Home/Home';
import AboutUs from './Pages/AboutUs/AboutUs';
import Leaderboard from './Pages/Leaderboard/Leaderboard';
import TournamentPage from './Pages/Tournaments/Tournament';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="bg-gray-900 min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/tournaments" element={<TournamentPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;