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

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${BASE_URL}${selectedGid}&output=csv`);
        const csvText = await response.text();
        const rows = csvText.split("\n").map((row) => row.split(",").map(cell => cell.trim().replace(/"/g, "")));

        if (rows.length < 2) {
          setLeaderboard([]);
          return;
        }

        // Extract headers dynamically
        const headers = rows[0].map((h) => h.toLowerCase());
        const requiredFields = ["number", "username", "name", "rating", "score", "aroc 1"];
        const headerMap = {
          "number": "Rank",
          "username": "Username",
          "name": "Name",
          "rating": "Rating",
          "score": "Score",
          "aroc 1": "Avg Rating"
        };

        // Get column indexes
        const indices = requiredFields.map((field) => headers.indexOf(field));

        if (indices.includes(-1)) {
          console.error("Some required columns are missing.");
          setLeaderboard([]);
          return;
        }

        // Process leaderboard data
        const filteredData = rows.slice(1)
          .map((row) => ({
            rank: parseInt(row[indices[0]]) || Infinity, // Convert rank to number, default to Infinity for invalid values
            username: row[indices[1]]?.trim() || "-",
            name: row[indices[2]]?.trim() || "N/A",
            rating: row[indices[3]]?.trim() || "-",
            score: row[indices[4]]?.trim() || "-",
            avgRating: row[indices[5]]?.trim() || "-",
          }))
          .filter((entry) => !isNaN(entry.rank)) // Remove rows where rank is not a number
          .sort((a, b) => a.rank - b.rank); // Sort by rank in ascending order

        setLeaderboard(filteredData);
      } catch (error) {
        console.error("Error fetching leaderboard:", error);
      }
    };
    fetchLeaderboard();
  }, [selectedGid]);

  return (
    <div className="flex flex-col items-center mt-10 py-10 px-6 bg-gray-900 min-h-screen text-white">
      <h2 className="text-3xl font-semibold mb-6">Leaderboard</h2>
      <select
        className="mb-4 p-2 bg-gray-800 text-white rounded"
        onChange={(e) => setSelectedGid(e.target.value)}
        value={selectedGid}
      >
        {TOURNAMENTS.map((tournament, index) => (
          <option key={index} value={tournament.gid}>
            {tournament.name}
          </option>
        ))}
      </select>

      {/* Leaderboard Table */}
      <table className="w-full max-w-4xl text-white border-collapse">
        <thead>
          <tr className="bg-gray-700">
            <th className="p-2 border">Rank</th>
            <th className="p-2 border">Username</th>
            <th className="p-2 border">Name</th>
            <th className="p-2 border">Rating</th>
            <th className="p-2 border">Score</th>
            <th className="p-2 border">Avg Rating</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row, index) => (
            <tr key={index} className="bg-gray-800 text-center">
              <td className="p-2 border">{row.rank}</td>
              <td className="p-2 border">{row.username}</td>
              <td className="p-2 border">{row.name}</td>
              <td className="p-2 border">{row.rating}</td>
              <td className="p-2 border">{row.score}</td>
              <td className="p-2 border">{row.avgRating}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;
