import React, { useState, useEffect } from "react";

export const tournamentsData = [
  { name: "Blitz Battles-2", link: "https://www.chess.com/play/tournament/5519883", date: "2025-03-09" },
  { name: "Rapid Showdown-3", link: "https://www.chess.com/play/tournament/5518983", date: "2025-03-09" },
  { name: "Blitz Battles-1", link: "https://www.chess.com/tournament/live/blitz-battles-1-5417455", date: "2025-01-25" },
  { name: "Rapid Showdown-2", link: "https://www.chess.com/tournament/live/rapid-showdown-2-5398853", date: "2025-01-19" },
  { name: "Rapid Showdown-1", link: "https://www.chess.com/tournament/live/rapid-showdown-1-5398853", date: "2025-01-12" },
];

const TournamentPage = () => {
  const [tournaments, setTournaments] = useState({ upcoming: [], current: [], past: [] });

  useEffect(() => {
    const updateTournaments = () => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();

      const updatedTournaments = { upcoming: [], current: [], past: [] };

      tournamentsData.forEach((tournament) => {
        if (tournament.date > today) {
          updatedTournaments.upcoming.push(tournament);
        } else if (tournament.date === today) {
          if (currentHour === 21 || (currentHour === 22 && currentMinutes === 0)) {
            updatedTournaments.current.push(tournament);
          } else if (currentHour >= 22) {
            updatedTournaments.past.push(tournament);
          } else {
            updatedTournaments.upcoming.push(tournament);
          }
        } else {
          updatedTournaments.past.push(tournament);
        }
      });

      setTournaments(updatedTournaments);
    };

    updateTournaments();
    const interval = setInterval(updateTournaments, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center mt-10 py-10 px-6 bg-gray-900 min-h-screen text-white">
      <h2 className="text-4xl font-bold mb-8">Tournaments</h2>

      <Section title="Upcoming Tournaments" data={tournaments.upcoming} />
      <Section title="Current Tournaments" data={tournaments.current} />
      <Section title="Past Tournaments" data={tournaments.past} />
    </div>
  );
};

const Section = ({ title, data }) => (
  <div className="w-full max-w-3xl mb-8">
    <h3 className="text-2xl font-semibold mb-4 border-b border-gray-700 pb-2">
      {title}
    </h3>
    {data.length > 0 ? (
      <ul className="space-y-3">
        {data.map((tournament, index) => (
          <li key={index}>
            <a href={tournament.link} className="block bg-gray-800 p-3 rounded-lg hover:bg-gray-700 transition">
              {tournament.name} - {tournament.date}
            </a>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-gray-400">No tournaments available.</p>
    )}
  </div>
);

export default TournamentPage;
