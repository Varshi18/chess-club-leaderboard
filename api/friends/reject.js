import clientPromise from "../lib/mongodb.js";
import { verifyToken } from "../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
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
      return res.status(403).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    const client = await clientPromise;
    const db = client.db("chess-club");
    const users = db.collection("users");
    const friendships = db.collection("friendships");

    // Search for users excluding the current user
    const searchResults = await users
      .find({
        username: { $regex: q.trim(), $options: "i" },
        _id: { $ne: new ObjectId(decoded.userId) },
      })
      .project({ password: 0 })
      .limit(10)
      .toArray();

    if (searchResults.length === 0) {
      return res.json({ success: true, users: [] });
    }

    const userId = new ObjectId(decoded.userId);
    const userIds = searchResults.map((u) => u._id);

    // Check existing friendships and requests
    const existingFriendships = await friendships
      .find({
        $or: [
          { userId: userId, friendId: { $in: userIds } },
          { userId: { $in: userIds }, friendId: userId },
        ],
      })
      .toArray();

    // Create maps for quick lookup
    const sentRequests = new Set();
    const acceptedFriends = new Set();

    existingFriendships.forEach((friendship) => {
      const otherUserId =
        friendship.userId.toString() === decoded.userId
          ? friendship.friendId.toString()
          : friendship.userId.toString();

      if (friendship.status === "pending") {
        if (friendship.userId.toString() === decoded.userId) {
          sentRequests.add(otherUserId);
        }
      } else if (friendship.status === "accepted") {
        acceptedFriends.add(otherUserId);
      }
    });

    const usersWithData = searchResults.map((user) => ({
      id: user._id.toString(),
      username: user.username,
      chessRating: user.chessRating || 1200,
      friendRequestSent: sentRequests.has(user._id.toString()),
      isFriend: acceptedFriends.has(user._id.toString()),
    }));

    res.json({ success: true, users: usersWithData });
  } catch (error) {
    console.error("User search error:", error);
    res.status(500).json({ success: false, message: "Search failed" });
  }
}
