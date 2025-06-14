import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThreeBackground from "../../Components/ThreeBackground/ThreeBackground";

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 transition-all duration-500 relative overflow-hidden">
      <ThreeBackground />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <motion.div 
          className="text-center mb-8 sm:mb-12"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <motion.h1 
            className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            Leaderboard
          </motion.h1>
          <motion.div 
            className="w-16 sm:w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mb-6 sm:mb-8"
            initial={{ width: 0 }}
            animate={{ width: isVisible ? '6rem' : 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
          
          <motion.div 
            className="max-w-md mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <select
              className="w-full p-3 sm:p-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-gray-900 dark:text-white rounded-xl border-2 border-gray-200 dark:border-gray-600 focus:border-yellow-400 dark:focus:border-yellow-400 focus:outline-none transition-all duration-300 font-medium shadow-lg hover:shadow-xl text-sm sm:text-base"
              onChange={(e) => setSelectedGid(e.target.value)}
              value={selectedGid}
            >
              {TOURNAMENTS.map((tournament, index) => (
                <option key={index} value={tournament.gid}>
                  {tournament.name}
                </option>
              ))}
            </select>
          </motion.div>
        </motion.div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="relative">
              <motion.div 
                className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-yellow-200 dark:border-yellow-800 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <motion.div 
                className="absolute top-0 left-0 w-12 h-12 sm:w-16 sm:h-16 border-4 border-yellow-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            </div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100/80 to-gray-200/80 dark:from-gray-700/80 dark:to-gray-600/80 backdrop-blur-sm">
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Rank</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Username</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider hidden sm:table-cell">Name</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Rating</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Score</th>
                      <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider hidden md:table-cell">Avg Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/50 dark:divide-gray-600/50">
                    <AnimatePresence>
                      {leaderboard.map((row, index) => (
                        <motion.tr
                          key={index}
                          className={`hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-all duration-300 ${
                            row.rank <= 3 ? 'bg-gradient-to-r from-yellow-50/30 to-orange-50/30 dark:from-yellow-900/10 dark:to-orange-900/10' : ''
                          }`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                          whileHover={{ scale: 1.01, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                        >
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <motion.span 
                                className="text-lg sm:text-2xl mr-1 sm:mr-2"
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 3, repeat: Infinity, delay: index * 0.2 }}
                              >
                                {getRankIcon(row.rank)}
                              </motion.span>
                              <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold text-white bg-gradient-to-r ${getRankColor(row.rank)}`}>
                                #{row.rank}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate max-w-[100px] sm:max-w-none">{row.username}</div>
                          </td>
                          <t className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                            <div className="text-xs sm:text-sm text-gray-900 dark:text-white truncate max-w-[120px]">{row.name}</div>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <motion.span 
                              className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100/80 dark:bg-blue-900/80 text-blue-800 dark:text-blue-200 backdrop-blur-sm"
                              whileHover={{ scale: 1.05 }}
                            >
                              {row.rating}
                            </motion.span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <motion.span 
                              className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100/80 dark:bg-green-900/80 text-green-800 dark:text-green-200 backdrop-blur-sm"
                              whileHover={{ scale: 1.05 }}
                            >
                              {row.score}
                            </motion.span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell">
                            <motion.span 
                              className="inline-flex items-center px-2 sm:px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100/80 dark:bg-purple-900/80 text-purple-800 dark:text-purple-200 backdrop-blur-sm"
                              whileHover={{ scale: 1.05 }}
                            >
                              {row.avgRating}
                            </motion.span>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;