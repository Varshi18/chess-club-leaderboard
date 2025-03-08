import React, { useState, useEffect } from "react";
import { tournamentsData } from "../Tournaments/Tournament";

const Home = () => {
  const [upcomingTournaments, setUpcomingTournaments] = useState([]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];

    const upcoming = tournamentsData.filter((tournament) => tournament.date >= today);
    setUpcomingTournaments(upcoming);
  }, []);

  return (
    <div className="flex flex-col items-center mt-10 py-10 px-6 bg-gray-900 min-h-screen text-white">
      <h1 className="text-4xl font-bold mb-6">Welcome to IIT Dharwad Chess Club</h1>
      <p className="text-lg text-gray-300 text-center max-w-3xl mb-8">
        Join a growing community of chess enthusiasts! Participate in tournaments, improve your skills, and compete with fellow students.
      </p>
      <a
        href="https://www.chess.com/club/iit-dharwad-chess"
        className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-lg text-lg transition"
      >
        Join the Club
      </a>
      <div className="w-full max-w-3xl mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">Upcoming Tournaments</h2>
        {upcomingTournaments.length > 0 ? (
          <ul className="space-y-3">
            {upcomingTournaments.map((tournament, index) => (
              <li key={index}>
                <a
                  href={tournament.link}
                  className="block bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition"
                >
                  {tournament.name} - {tournament.date}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-400">No upcoming tournaments at the moment.</p>
        )}
      </div>
    </div>
  );
};

export default Home;
