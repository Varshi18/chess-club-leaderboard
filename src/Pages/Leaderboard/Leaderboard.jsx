import React, { useEffect, useState } from "react";

const BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vToXWpg2qUdUakPDKHg_AbDWsQDX1mwlS7t9XyHSu7bypLd53yU8TKkfOwAGgCR7lUZNZAgs5tccU5_/pub?gid=";

const TOURNAMENTS = [
  { name: "Rapid Showdowns-1", gid: "0" },
  { name: "Rapid Showdowns-2", gid: "1936002396" },
  { name: "Blitz Battles-1", gid: "1427167243" },
];

const Leaderboard = () => {
  const [selectedGid, setSelectedGid] = useState(TOURNAMENTS[0].gid);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${BASE_URL}${selectedGid}&output=csv`);
        const csvText = await response.text();
        const rows = csvText.split("\n").map((row) => row.split(",").map(cell => cell.trim().replace(/"/g, "")));

        if (rows.length < 2) {
          setLeaderboard([]);
          return;
        }

        const headers = rows[0].map((h) => h.toLowerCase());
        const requiredFields = ["number", "username", "name", "rating", "score", "aroc 1"];

        const indices = requiredFields.map((field) => headers.indexOf(field));

        if (indices.includes(-1)) {
          console.error("Some required columns are missing.");
          setLeaderboard([]);
          return;
        }

        const filteredData = rows.slice(1)
          .map((row) => ({
            rank: parseInt(row[indices[0]]) || Infinity,
            username: row[indices[1]]?.trim() || "-",
            name: row[indices[2]]?.trim() || "N/A",
            rating: row[indices[3]]?.trim() || "-",
            score: row[indices[4]]?.trim() || "-",
            avgRating: row[indices[5]]?.trim() || "-",
          }))
          .filter((entry) => !isNaN(entry.rank))
          .sort((a, b) => a.rank - b.rank);

        setLeaderboard(filteredData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [selectedGid]);

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return "🏅";
    }
  };

  const getRankColor = (rank) => {
    switch (rank) {
      case 1: return "from-yellow-400 to-yellow-600";
      case 2: return "from-gray-400 to-gray-600";
      case 3: return "from-orange-400 to-orange-600";
      default: return "from-blue-400 to-blue-600";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 transition-all duration-500">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className={`text-center mb-12 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            Leaderboard
          </h1>
          <div className="w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mb-8"></div>
          
          <div className="max-w-md mx-auto">
            <select
              className="w-full p-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl border-2 border-gray-200 dark:border-gray-600 focus:border-yellow-400 dark:focus:border-yellow-400 focus:outline-none transition-all duration-300 font-medium shadow-lg hover:shadow-xl"
              onChange={(e) => setSelectedGid(e.target.value)}
              value={selectedGid}
            >
              {TOURNAMENTS.map((tournament, index) => (
                <option key={index} value={tournament.gid}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-yellow-200 dark:border-yellow-800 rounded-full animate-spin"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          <div className={`transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600">
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Rank</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Username</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Score</th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Avg Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {leaderboard.map((row, index) => (
                      <tr
                        key={index}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 animate-fade-in-up ${
                          row.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10' : ''
                        }`}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-2xl mr-2">{getRankIcon(row.rank)}</span>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold text-white bg-gradient-to-r ${getRankColor(row.rank)}`}>
                              #{row.rank}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{row.username}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{row.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {row.rating}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            {row.score}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                            {row.avgRating}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;