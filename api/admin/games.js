import clientPromise from "../lib/mongodb.js";
import { verifyToken } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
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

    // Check if user is admin
    const currentUser = await users.findOne({
      _id: new ObjectId(decoded.userId),
    });
    if (!currentUser || currentUser.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Admin access required" });
    }

    if (req.method === "GET") {
      const { 
        page = 1, 
        limit = 20, 
        search = "", 
        result = "", 
        timeControl = "",
        dateFrom = "",
        dateTo = "",
        sortBy = "createdAt", 
        sortOrder = "desc" 
      } = req.query;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
      
      let query = {};
      
      // Search by player names
      if (search) {
        const searchUsers = await users.find({
          username: { $regex: search, $options: "i" }
        }).project({ _id: 1 }).toArray();
        
        const userIds = searchUsers.map(u => u._id);
        query.$or = [
          { whitePlayerId: { $in: userIds } },
          { blackPlayerId: { $in: userIds } }
        ];
      }
      
      // Filter by result
      if (result) {
        query.result = result;
      }
      
      // Filter by time control
      if (timeControl) {
        query.timeControl = timeControl;
      }
      
      // Filter by date range
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      const [allGames, totalCount] = await Promise.all([
        games.find(query)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray(),
        games.countDocuments(query)
      ]);

      // Get player details for each game
      const playerIds = [...new Set([
        ...allGames.map(g => g.whitePlayerId),
        ...allGames.map(g => g.blackPlayerId)
      ])];

      const players = await users.find({
        _id: { $in: playerIds }
      }).project({ username: 1, chessRating: 1 }).toArray();

      const playersMap = Object.fromEntries(
        players.map(p => [p._id.toString(), p])
      );

      const formattedGames = allGames.map((game) => ({
        id: game._id.toString(),
        whitePlayer: {
          id: game.whitePlayerId.toString(),
          username: playersMap[game.whitePlayerId.toString()]?.username || "Unknown",
          rating: game.whitePlayerRating || playersMap[game.whitePlayerId.toString()]?.chessRating || 1200
        },
        blackPlayer: {
          id: game.blackPlayerId.toString(),
          username: playersMap[game.blackPlayerId.toString()]?.username || "Unknown",
          rating: game.blackPlayerRating || playersMap[game.blackPlayerId.toString()]?.chessRating || 1200
        },
        result: game.result,
        timeControl: game.timeControl,
        duration: game.duration,
        moves: game.moves || 0,
        pgn: game.pgn,
        createdAt: game.createdAt,
        endedAt: game.endedAt,
        gameType: game.gameType || "casual",
        tournamentId: game.tournamentId,
        ratingChange: {
          white: game.whiteRatingChange || 0,
          black: game.blackRatingChange || 0
        }
      }));

      // Get statistics
      const stats = await games.aggregate([
        {
          $group: {
            _id: null,
            totalGames: { $sum: 1 },
            whiteWins: { $sum: { $cond: [{ $eq: ["$result", "1-0"] }, 1, 0] } },
            blackWins: { $sum: { $cond: [{ $eq: ["$result", "0-1"] }, 1, 0] } },
            draws: { $sum: { $cond: [{ $eq: ["$result", "1/2-1/2"] }, 1, 0] } },
            avgDuration: { $avg: "$duration" },
            avgMoves: { $avg: "$moves" }
          }
        }
      ]).toArray();

      return res.json({ 
        success: true, 
        games: formattedGames,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalGames: totalCount,
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        },
        statistics: stats[0] || {
          totalGames: 0,
          whiteWins: 0,
          blackWins: 0,
          draws: 0,
          avgDuration: 0,
          avgMoves: 0
        }
      });
    }

    if (req.method === "DELETE") {
      const { gameId } = req.body;

      if (!gameId) {
        return res
          .status(400)
          .json({ success: false, message: "Game ID is required" });
      }

      const result = await games.deleteOne({
        _id: new ObjectId(gameId),
      });

      if (result.deletedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Game not found" });
      }

      return res.json({
        success: true,
        message: "Game deleted successfully",
      });
    }

    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Admin games error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}