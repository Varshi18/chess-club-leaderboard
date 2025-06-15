import clientPromise from "../lib/mongodb.js";
import { verifyToken } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Access token required" });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const client = await clientPromise;
    const db = client.db("chess-club");
    const users = db.collection("users");
    const games = db.collection("games");
    const tournaments = db.collection("tournaments");

    // Check if user is admin
    const currentUser = await users.findOne({
      _id: new ObjectId(decoded.userId),
    });
    if (!currentUser || currentUser.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    const { period = "30" } = req.query;
    const daysAgo = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // User Analytics
    const userStats = await users.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
          adminUsers: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } },
          avgRating: { $avg: "$chessRating" },
          newUsers: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", startDate] },
                1,
                0
              ]
            }
          }
        }
      }
    ]).toArray();

    // Game Analytics
    const gameStats = await games.aggregate([
      {
        $group: {
          _id: null,
          totalGames: { $sum: 1 },
          recentGames: {
            $sum: {
              $cond: [
                { $gte: ["$createdAt", startDate] },
                1,
                0
              ]
            }
          },
          whiteWins: { $sum: { $cond: [{ $eq: ["$result", "1-0"] }, 1, 0] } },
          blackWins: { $sum: { $cond: [{ $eq: ["$result", "0-1"] }, 1, 0] } },
          draws: { $sum: { $cond: [{ $eq: ["$result", "1/2-1/2"] }, 1, 0] } },
          avgDuration: { $avg: "$duration" },
          avgMoves: { $avg: "$moves" }
        }
      }
    ]).toArray();

    // Daily game activity
    const dailyActivity = await games.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          games: { $sum: 1 },
          uniquePlayers: {
            $addToSet: {
              $setUnion: ["$whitePlayerId", "$blackPlayerId"]
            }
          }
        }
      },
      {
        $project: {
          date: "$_id",
          games: 1,
          uniquePlayers: { $size: { $reduce: {
            input: "$uniquePlayers",
            initialValue: [],
            in: { $setUnion: ["$$value", "$$this"] }
          }}}
        }
      },
      { $sort: { date: 1 } }
    ]).toArray();

    // Top players by rating
    const topPlayers = await users.find({
      isActive: true
    })
    .sort({ chessRating: -1 })
    .limit(10)
    .project({ username: 1, chessRating: 1, gamesPlayed: 1, gamesWon: 1 })
    .toArray();

    // Most active players
    const activePlayers = await users.find({
      isActive: true,
      gamesPlayed: { $gt: 0 }
    })
    .sort({ gamesPlayed: -1 })
    .limit(10)
    .project({ username: 1, gamesPlayed: 1, gamesWon: 1, chessRating: 1 })
    .toArray();

    // Time control distribution
    const timeControlStats = await games.aggregate([
      {
        $group: {
          _id: "$timeControl",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    // Rating distribution
    const ratingDistribution = await users.aggregate([
      {
        $bucket: {
          groupBy: "$chessRating",
          boundaries: [0, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 3000],
          default: "Other",
          output: {
            count: { $sum: 1 }
          }
        }
      }
    ]).toArray();

    // Tournament stats
    const tournamentStats = await tournaments.aggregate([
      {
        $group: {
          _id: null,
          totalTournaments: { $sum: 1 },
          activeTournaments: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          upcomingTournaments: { $sum: { $cond: [{ $eq: ["$status", "upcoming"] }, 1, 0] } },
          completedTournaments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          totalParticipants: { $sum: { $size: "$participants" } }
        }
      }
    ]).toArray();

    return res.json({
      success: true,
      analytics: {
        users: userStats[0] || {
          totalUsers: 0,
          activeUsers: 0,
          adminUsers: 0,
          avgRating: 1200,
          newUsers: 0
        },
        games: gameStats[0] || {
          totalGames: 0,
          recentGames: 0,
          whiteWins: 0,
          blackWins: 0,
          draws: 0,
          avgDuration: 0,
          avgMoves: 0
        },
        tournaments: tournamentStats[0] || {
          totalTournaments: 0,
          activeTournaments: 0,
          upcomingTournaments: 0,
          completedTournaments: 0,
          totalParticipants: 0
        },
        dailyActivity,
        topPlayers: topPlayers.map(p => ({
          id: p._id.toString(),
          username: p.username,
          rating: p.chessRating,
          gamesPlayed: p.gamesPlayed || 0,
          winRate: p.gamesPlayed > 0 ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(1) : 0
        })),
        activePlayers: activePlayers.map(p => ({
          id: p._id.toString(),
          username: p.username,
          gamesPlayed: p.gamesPlayed,
          winRate: p.gamesPlayed > 0 ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(1) : 0,
          rating: p.chessRating
        })),
        timeControlStats,
        ratingDistribution
      }
    });

  } catch (error) {
    console.error("Admin analytics error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}