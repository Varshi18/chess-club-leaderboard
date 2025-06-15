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

    const { player1Id, player2Id } = req.query;

    if (!player1Id || !player2Id) {
      return res.status(400).json({
        success: false,
        message: "Both player IDs are required"
      });
    }

    const client = await clientPromise;
    const db = client.db("chess-club");
    const users = db.collection("users");
    const headToHead = db.collection("headToHead");
    const games = db.collection("games");

    // Get player details
    const [player1, player2] = await Promise.all([
      users.findOne({ _id: new ObjectId(player1Id) }, { projection: { password: 0 } }),
      users.findOne({ _id: new ObjectId(player2Id) }, { projection: { password: 0 } })
    ]);

    if (!player1 || !player2) {
      return res.status(404).json({
        success: false,
        message: "One or both players not found"
      });
    }

    // Get head-to-head record
    const h2hRecord = await headToHead.findOne({
      $or: [
        { player1Id: new ObjectId(player1Id), player2Id: new ObjectId(player2Id) },
        { player1Id: new ObjectId(player2Id), player2Id: new ObjectId(player1Id) }
      ]
    });

    let stats = {
      player1: {
        id: player1._id.toString(),
        username: player1.username,
        rating: player1.chessRating || 1200,
        wins: 0,
        losses: 0,
        draws: 0
      },
      player2: {
        id: player2._id.toString(),
        username: player2.username,
        rating: player2.chessRating || 1200,
        wins: 0,
        losses: 0,
        draws: 0
      },
      totalGames: 0,
      lastGameAt: null,
      recentGames: []
    };

    if (h2hRecord) {
      const isPlayer1First = h2hRecord.player1Id.toString() === player1Id;
      
      if (isPlayer1First) {
        stats.player1.wins = h2hRecord.player1Wins || 0;
        stats.player1.losses = h2hRecord.player2Wins || 0;
        stats.player2.wins = h2hRecord.player2Wins || 0;
        stats.player2.losses = h2hRecord.player1Wins || 0;
      } else {
        stats.player1.wins = h2hRecord.player2Wins || 0;
        stats.player1.losses = h2hRecord.player1Wins || 0;
        stats.player2.wins = h2hRecord.player1Wins || 0;
        stats.player2.losses = h2hRecord.player2Wins || 0;
      }
      
      stats.player1.draws = h2hRecord.draws || 0;
      stats.player2.draws = h2hRecord.draws || 0;
      stats.totalGames = h2hRecord.totalGames || 0;
      stats.lastGameAt = h2hRecord.lastGameAt;
      
      // Get recent games with full details
      if (h2hRecord.recentGames && h2hRecord.recentGames.length > 0) {
        const gameIds = h2hRecord.recentGames.map(g => g.gameId);
        const recentGameDetails = await games.find({
          _id: { $in: gameIds }
        }).sort({ createdAt: -1 }).limit(10).toArray();

        stats.recentGames = recentGameDetails.map(game => ({
          id: game._id.toString(),
          result: game.result,
          timeControl: game.timeControl,
          duration: game.duration,
          moves: game.moveCount || 0,
          createdAt: game.createdAt,
          pgn: game.pgn,
          whitePlayer: game.whitePlayerId.toString() === player1Id ? 'player1' : 'player2'
        }));
      }
    }

    // Get additional statistics
    const [player1AllGames, player2AllGames] = await Promise.all([
      games.find({
        $or: [
          { whitePlayerId: new ObjectId(player1Id) },
          { blackPlayerId: new ObjectId(player1Id) }
        ]
      }).count(),
      games.find({
        $or: [
          { whitePlayerId: new ObjectId(player2Id) },
          { blackPlayerId: new ObjectId(player2Id) }
        ]
      }).count()
    ]);

    // Calculate win rates
    stats.player1.winRate = stats.totalGames > 0 ? 
      ((stats.player1.wins / stats.totalGames) * 100).toFixed(1) : 0;
    stats.player2.winRate = stats.totalGames > 0 ? 
      ((stats.player2.wins / stats.totalGames) * 100).toFixed(1) : 0;

    // Add overall game counts
    stats.player1.totalGamesOverall = player1AllGames;
    stats.player2.totalGamesOverall = player2AllGames;

    return res.json({
      success: true,
      headToHead: stats
    });

  } catch (error) {
    console.error("Head-to-head error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}