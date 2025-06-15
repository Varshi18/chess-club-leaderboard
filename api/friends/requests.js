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
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired token" });
    }

    const client = await clientPromise;
    const db = client.db("chess-club");
    const friendships = db.collection("friendships");
    const users = db.collection("users");

    // Find pending friend requests where the current user is the recipient
    const pendingRequests = await friendships
      .find({
        friendId: new ObjectId(decoded.userId),
        status: "pending",
      })
      .toArray();

    if (pendingRequests.length === 0) {
      return res.json({ success: true, requests: [] });
    }

    // Get sender information
    const senderIds = pendingRequests.map((request) => request.userId);
    const senders = await users
      .find({
        _id: { $in: senderIds },
      })
      .project({
        password: 0,
      })
      .toArray();

    // Create a map for quick lookup
    const sendersMap = {};
    senders.forEach((sender) => {
      sendersMap[sender._id.toString()] = sender;
    });

    // Format the response
    const formattedRequests = pendingRequests.map((request) => ({
      id: request._id.toString(),
      sender: {
        id: request.userId.toString(),
        username: sendersMap[request.userId.toString()]?.username || "Unknown",
        chessRating: sendersMap[request.userId.toString()]?.chessRating || 1200,
      },
      createdAt: request.createdAt,
    }));

    return res.json({ success: true, requests: formattedRequests });
  } catch (error) {
    console.error("Friend requests error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch friend requests",
    });
  }
}
