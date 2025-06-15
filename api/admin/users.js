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
      // Get all users
      const allUsers = await users.find({}).project({ password: 0 }).toArray();

      const formattedUsers = allUsers.map((user) => ({
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        chessRating: user.chessRating || 1200,
        role: user.role || "user",
        isActive: user.isActive !== false,
        gamesPlayed: user.gamesPlayed || 0,
        gamesWon: user.gamesWon || 0,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      }));

      return res.json({ success: true, users: formattedUsers });
    }

    if (req.method === "PUT") {
      // Update user
      const { userId, updates } = req.body;

      if (!userId || !updates) {
        return res.status(400).json({
          success: false,
          message: "User ID and updates are required",
        });
      }

      const allowedUpdates = ["role", "isActive", "chessRating", "fullName"];
      const filteredUpdates = {};

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      const result = await users.updateOne(
        { _id: new ObjectId(userId) },
        { $set: { ...filteredUpdates, updatedAt: new Date() } }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found or no changes made",
        });
      }

      return res.json({ success: true, message: "User updated successfully" });
    }

    if (req.method === "DELETE") {
      // Delete user
      const { userId } = req.body;

      if (!userId) {
        return res
          .status(400)
          .json({ success: false, message: "User ID is required" });
      }

      // Don't allow deleting yourself
      if (userId === decoded.userId) {
        return res
          .status(400)
          .json({ success: false, message: "Cannot delete your own account" });
      }

      const result = await users.deleteOne({ _id: new ObjectId(userId) });

      if (result.deletedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Also clean up friendships
      const friendships = db.collection("friendships");
      await friendships.deleteMany({
        $or: [
          { userId: new ObjectId(userId) },
          { friendId: new ObjectId(userId) },
        ],
      });

      return res.json({ success: true, message: "User deleted successfully" });
    }

    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}
