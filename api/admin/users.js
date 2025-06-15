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
      const { page = 1, limit = 20, search = "", sortBy = "createdAt", sortOrder = "desc" } = req.query;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
      
      let query = {};
      if (search) {
        query = {
          $or: [
            { username: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { fullName: { $regex: search, $options: "i" } }
          ]
        };
      }

      const [allUsers, totalCount] = await Promise.all([
        users.find(query)
          .project({ password: 0 })
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .toArray(),
        users.countDocuments(query)
      ]);

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
        gamesLost: user.gamesLost || 0,
        gamesDrawn: user.gamesDrawn || 0,
        winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        totalPlayTime: user.totalPlayTime || 0,
        averageGameTime: user.averageGameTime || 0,
        favoriteTimeControl: user.favoriteTimeControl || "Unknown",
        highestRating: user.highestRating || user.chessRating || 1200,
        lowestRating: user.lowestRating || user.chessRating || 1200
      }));

      return res.json({ 
        success: true, 
        users: formattedUsers,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalUsers: totalCount,
          hasNext: skip + parseInt(limit) < totalCount,
          hasPrev: parseInt(page) > 1
        }
      });
    }

    if (req.method === "PUT") {
      const { userId, updates } = req.body;

      if (!userId || !updates) {
        return res.status(400).json({
          success: false,
          message: "User ID and updates are required",
        });
      }

      const allowedUpdates = [
        "role", "isActive", "chessRating", "fullName", "email", "username"
      ];
      const filteredUpdates = {};

      Object.keys(updates).forEach((key) => {
        if (allowedUpdates.includes(key)) {
          if (key === "chessRating") {
            filteredUpdates[key] = parseInt(updates[key]);
          } else {
            filteredUpdates[key] = updates[key];
          }
        }
      });

      // Don't allow changing your own role
      if (userId === decoded.userId && filteredUpdates.role) {
        delete filteredUpdates.role;
      }

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

      // Clean up related data
      const friendships = db.collection("friendships");
      const games = db.collection("games");
      
      await Promise.all([
        friendships.deleteMany({
          $or: [
            { userId: new ObjectId(userId) },
            { friendId: new ObjectId(userId) },
          ],
        }),
        games.updateMany(
          {
            $or: [
              { whitePlayerId: new ObjectId(userId) },
              { blackPlayerId: new ObjectId(userId) }
            ]
          },
          { $set: { deletedUser: true } }
        )
      ]);

      return res.json({ success: true, message: "User deleted successfully" });
    }

    if (req.method === "POST") {
      const { action, userIds } = req.body;

      if (!action || !userIds || !Array.isArray(userIds)) {
        return res.status(400).json({
          success: false,
          message: "Action and user IDs array are required"
        });
      }

      const objectIds = userIds.map(id => new ObjectId(id));

      switch (action) {
        case "bulk_activate":
          await users.updateMany(
            { _id: { $in: objectIds } },
            { $set: { isActive: true, updatedAt: new Date() } }
          );
          return res.json({ success: true, message: "Users activated successfully" });

        case "bulk_deactivate":
          await users.updateMany(
            { _id: { $in: objectIds } },
            { $set: { isActive: false, updatedAt: new Date() } }
          );
          return res.json({ success: true, message: "Users deactivated successfully" });

        case "bulk_delete":
          // Don't allow deleting yourself
          const filteredIds = objectIds.filter(id => id.toString() !== decoded.userId);
          
          await users.deleteMany({ _id: { $in: filteredIds } });
          
          // Clean up related data
          const friendships = db.collection("friendships");
          const games = db.collection("games");
          
          await Promise.all([
            friendships.deleteMany({
              $or: [
                { userId: { $in: filteredIds } },
                { friendId: { $in: filteredIds } },
              ],
            }),
            games.updateMany(
              {
                $or: [
                  { whitePlayerId: { $in: filteredIds } },
                  { blackPlayerId: { $in: filteredIds } }
                ]
              },
              { $set: { deletedUser: true } }
            )
          ]);
          
          return res.json({ success: true, message: "Users deleted successfully" });

        default:
          return res.status(400).json({
            success: false,
            message: "Invalid action"
          });
      }
    }

    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}