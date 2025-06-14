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
    if (!decoded) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Search query must be at least 2 characters",
        });
    }

    const client = await clientPromise;
    const db = client.db("chess-club");

    const users = db.collection("users");
    const friendships = db.collection("friendships");

    const userId = new ObjectId(decoded.id);
const userIds = searchResults.map(u => u._id);

console.log("Searched user IDs:", userIds.map(id => id.toString()));

const existingFriendships = await db.collection('friendships').find({
  from: userId,
  to: { $in: userIds }
}).toArray();

console.log("Matching friendships:", existingFriendships);

const sentRequests = new Set(
  existingFriendships
    .filter(f => f.status === 'pending')
    .map(f => f.to.toString())
);

console.log("Pending request targets:", [...sentRequests]);

const usersWithData = searchResults.map(user => ({
  id: user._id.toString(),
  username: user.username,
  chessRating: user.chessRating,
  friendRequestSent: sentRequests.has(user._id.toString())
}));

console.log("Final users response:", usersWithData);

res.json({ success: true, users: usersWithData });

  } catch (error) {
    console.error("User search error:", error);
    res.status(500).json({ success: false, message: "Search failed" });
  }
}
