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

    const { gameId, download } = req.query;

    if (!gameId) {
      return res.status(400).json({
        success: false,
        message: "Game ID is required"
      });
    }

    const client = await clientPromise;
    const db = client.db("chess-club");
    const games = db.collection("games");
    const users = db.collection("users");

    // Get game details
    const game = await games.findOne({ _id: new ObjectId(gameId) });

    if (!game) {
      return res.status(404).json({
        success: false,
        message: "Game not found"
      });
    }

    // Check if user has access to this game (player or admin)
    const currentUser = await users.findOne({ _id: new ObjectId(decoded.userId) });
    const isPlayer = game.whitePlayerId.toString() === decoded.userId || 
                    game.blackPlayerId.toString() === decoded.userId;
    const isAdmin = currentUser && currentUser.role === "admin";

    if (!isPlayer && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    if (download === "true") {
      // Return PGN as downloadable file
      const [whitePlayer, blackPlayer] = await Promise.all([
        users.findOne({ _id: game.whitePlayerId }, { projection: { username: 1 } }),
        users.findOne({ _id: game.blackPlayerId }, { projection: { username: 1 } })
      ]);

      const filename = `${whitePlayer.username}_vs_${blackPlayer.username}_${game.createdAt.toISOString().split('T')[0]}.pgn`;
      
      res.setHeader('Content-Type', 'application/x-chess-pgn');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(game.pgn);
    } else {
      // Return PGN data as JSON
      return res.json({
        success: true,
        pgn: game.pgn,
        gameInfo: {
          id: game._id.toString(),
          result: game.result,
          timeControl: game.timeControl,
          duration: game.duration,
          moves: game.moveCount || 0,
          createdAt: game.createdAt
        }
      });
    }

  } catch (error) {
    console.error("PGN error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}