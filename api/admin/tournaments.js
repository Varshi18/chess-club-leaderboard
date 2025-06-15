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

    if (req.method === "GET") {
      // Get all tournaments
      const allTournaments = await tournaments
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      const formattedTournaments = allTournaments.map((tournament) => ({
        id: tournament._id.toString(),
        name: tournament.name,
        format: tournament.format,
        timeControl: tournament.timeControl,
        maxParticipants: tournament.maxParticipants,
        prizePool: tournament.prizePool,
        startTime: tournament.startTime,
        endTime: tournament.endTime,
        status: tournament.status,
        participants: tournament.participants || [],
        createdAt: tournament.createdAt,
      }));

      return res.json({ success: true, tournaments: formattedTournaments });
    }

    if (req.method === "POST") {
      // Create new tournament
      const {
        name,
        format,
        timeControl,
        maxParticipants,
        prizePool,
        startTime,
        endTime,
      } = req.body;

      if (
        !name ||
        !format ||
        !timeControl ||
        !maxParticipants ||
        !startTime ||
        !endTime
      ) {
        return res.status(400).json({
          success: false,
          message: "All tournament fields are required",
        });
      }

      const newTournament = {
        name,
        format,
        timeControl,
        maxParticipants: parseInt(maxParticipants),
        prizePool: parseInt(prizePool) || 0,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        status: "upcoming",
        participants: [],
        bracket: null,
        createdAt: new Date(),
        createdBy: new ObjectId(decoded.userId),
      };

      const result = await tournaments.insertOne(newTournament);

      return res.json({
        success: true,
        message: "Tournament created successfully",
        tournamentId: result.insertedId.toString(),
      });
    }

    if (req.method === "PUT") {
      // Update tournament
      const { tournamentId, updates } = req.body;

      if (!tournamentId || !updates) {
        return res.status(400).json({
          success: false,
          message: "Tournament ID and updates are required",
        });
      }

      const allowedUpdates = [
        "name",
        "format",
        "timeControl",
        "maxParticipants",
        "prizePool",
        "startTime",
        "endTime",
        "status",
      ];
      const filteredUpdates = {};

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          if (key === "startTime" || key === "endTime") {
            filteredUpdates[key] = new Date(updates[key]);
          } else if (key === "maxParticipants" || key === "prizePool") {
            filteredUpdates[key] = parseInt(updates[key]);
          } else {
            filteredUpdates[key] = updates[key];
          }
        }
      });

      const result = await tournaments.updateOne(
        { _id: new ObjectId(tournamentId) },
        { $set: { ...filteredUpdates, updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Tournament not found or no changes made",
        });
      }

      return res.json({
        success: true,
        message: "Tournament updated successfully",
      });
    }

    if (req.method === "DELETE") {
      // Delete tournament
      const { tournamentId } = req.body;

      if (!tournamentId) {
        return res
          .status(400)
          .json({ success: false, message: "Tournament ID is required" });
      }

      const result = await tournaments.deleteOne({
        _id: new ObjectId(tournamentId),
      });

      if (result.deletedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Tournament not found" });
      }

      return res.json({
        success: true,
        message: "Tournament deleted successfully",
      });
    }

    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Admin tournaments error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
