// api/admin/index.js
import clientPromise from "../../lib/mongodb.js";
import { verifyToken } from "../../lib/auth.js";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Authenticate and verify token
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Access token required" });
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(403).json({ success: false, message: "Invalid or expired token" });
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db("chess-club");
    const users = db.collection("users");
    const tournaments = db.collection("tournaments");
    const games = db.collection("games");
    const friendships = db.collection("friendships");

    // Check if user is admin
    const currentUser = await users.findOne({ _id: new ObjectId(decoded.userId) });
    if (!currentUser || currentUser.role !== "admin") {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { resource } = req.query;
    if (!resource) {
      return res.status(400).json({ success: false, message: "Resource query parameter required" });
    }

    // Helper function to validate ObjectId
    const isValidObjectId = (id) => {
      try {
        return ObjectId.prototype.isValid(id) && new ObjectId(id).toString() === id;
      } catch {
        return false;
      }
    };

    // Users Resource
    if (resource === "users") {
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
              { fullName: { $regex: search, $options: "i" } },
            ],
          };
        }

        const [allUsers, totalCount] = await Promise.all([
          users
            .find(query)
            .project({ password: 0 })
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .toArray(),
          users.countDocuments(query),
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
          lowestRating: user.lowestRating || user.chessRating || 1200,
        }));

        return res.json({
          success: true,
          users: formattedUsers,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalUsers: totalCount,
            hasNext: skip + parseInt(limit) < totalCount,
            hasPrev: parseInt(page) > 1,
          },
        });
      }

      if (req.method === "PUT") {
        const { userId, updates } = req.body;
        if (!userId || !updates || !isValidObjectId(userId)) {
          return res.status(400).json({ success: false, message: "Valid user ID and updates are required" });
        }

        const allowedUpdates = ["role", "isActive", "chessRating", "fullName", "email", "username"];
        const filteredUpdates = {};
        Object.keys(updates).forEach((key) => {
          if (allowedUpdates.includes(key)) {
            filteredUpdates[key] = key === "chessRating" ? parseInt(updates[key]) : updates[key];
          }
        });

        if (userId === decoded.userId && filteredUpdates.role) {
          delete filteredUpdates.role;
        }

        const result = await users.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { ...filteredUpdates, updatedAt: new Date() } }
        );

        if (result.modifiedCount === 0) {
          return res.status(404).json({ success: false, message: "User not found or no changes made" });
        }

        return res.json({ success: true, message: "User updated successfully" });
      }

      if (req.method === "DELETE") {
        const { userId } = req.body;
        if (!userId || !isValidObjectId(userId)) {
          return res.status(400).json({ success: false, message: "Valid user ID is required" });
        }

        if (userId === decoded.userId) {
          return res.status(400).json({ success: false, message: "Cannot delete your own account" });
        }

        const result = await users.deleteOne({ _id: new ObjectId(userId) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: "User not found" });
        }

        await Promise.all([
          friendships.deleteMany({
            $or: [{ userId: new ObjectId(userId) }, { friendId: new ObjectId(userId) }],
          }),
          games.updateMany(
            { $or: [{ whitePlayerId: new ObjectId(userId) }, { blackPlayerId: new ObjectId(userId) }] },
            { $set: { deletedUser: true } }
          ),
        ]);

        return res.json({ success: true, message: "User deleted successfully" });
      }

      if (req.method === "POST") {
        const { action, userIds } = req.body;
        if (!action || !userIds || !Array.isArray(userIds) || userIds.some((id) => !isValidObjectId(id))) {
          return res.status(400).json({ success: false, message: "Valid action and user IDs array are required" });
        }

        const objectIds = userIds.map((id) => new ObjectId(id));
        const filteredIds = objectIds.filter((id) => id.toString() !== decoded.userId);

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
            await users.deleteMany({ _id: { $in: filteredIds } });
            await Promise.all([
              friendships.deleteMany({
                $or: [{ userId: { $in: filteredIds } }, { friendId: { $in: filteredIds } }],
              }),
              games.updateMany(
                { $or: [{ whitePlayerId: { $in: filteredIds } }, { blackPlayerId: { $in: filteredIds } }] },
                { $set: { deletedUser: true } }
              ),
            ]);
            return res.json({ success: true, message: "Users deleted successfully" });

          default:
            return res.status(400).json({ success: false, message: "Invalid action" });
        }
      }

      return res.status(405).json({ success: false, message: "Method not allowed for users resource" });
    }

    // Tournaments Resource
    if (resource === "tournaments") {
      if (req.method === "GET") {
        const allTournaments = await tournaments.find({}).sort({ createdAt: -1 }).toArray();
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
        const { name, format, timeControl, maxParticipants, prizePool, startTime, endTime } = req.body;
        if (!name || !format || !timeControl || !maxParticipants || !startTime || !endTime) {
          return res.status(400).json({ success: false, message: "All tournament fields are required" });
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
        const { tournamentId, updates } = req.body;
        if (!tournamentId || !updates || !isValidObjectId(tournamentId)) {
          return res.status(400).json({ success: false, message: "Valid tournament ID and updates are required" });
        }

        const allowedUpdates = ["name", "format", "timeControl", "maxParticipants", "prizePool", "startTime", "endTime", "status"];
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
          return res.status(404).json({ success: false, message: "Tournament not found or no changes made" });
        }

        return res.json({ success: true, message: "Tournament updated successfully" });
      }

      if (req.method === "DELETE") {
        const { tournamentId } = req.body;
        if (!tournamentId || !isValidObjectId(tournamentId)) {
          return res.status(400).json({ success: false, message: "Valid tournament ID is required" });
        }

        const result = await tournaments.deleteOne({ _id: new ObjectId(tournamentId) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: "Tournament not found" });
        }

        return res.json({ success: true, message: "Tournament deleted successfully" });
      }

      return res.status(405).json({ success: false, message: "Method not allowed for tournaments resource" });
    }

    // Games Resource
    if (resource === "games") {
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
          sortOrder = "desc",
        } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };
        let query = {};

        if (search) {
          const searchUsers = await users
            .find({ username: { $regex: search, $options: "i" } })
            .project({ _id: 1 })
            .toArray();
          const userIds = searchUsers.map((u) => u._id);
          query.$or = [{ whitePlayerId: { $in: userIds } }, { blackPlayerId: { $in: userIds } }];
        }

        if (result) query.result = result;
        if (timeControl) query.timeControl = timeControl;
        if (dateFrom || dateTo) {
          query.createdAt = {};
          if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
          if (dateTo) query.createdAt.$lte = new Date(dateTo);
        }

        const [allGames, totalCount] = await Promise.all([
          games.find(query).sort(sort).skip(skip).limit(parseInt(limit)).toArray(),
          games.countDocuments(query),
        ]);

        const playerIds = [...new Set([...allGames.map((g) => g.whitePlayerId), ...allGames.map((g) => g.blackPlayerId)])];
        const players = await users
          .find({ _id: { $in: playerIds } })
          .project({ username: 1, chessRating: 1 })
          .toArray();
        const playersMap = Object.fromEntries(players.map((p) => [p._id.toString(), p]));

        const formattedGames = allGames.map((game) => ({
          id: game._id.toString(),
          whitePlayer: {
            id: game.whitePlayerId.toString(),
            username: playersMap[game.whitePlayerId.toString()]?.username || "Unknown",
            rating: game.whitePlayerRating || playersMap[game.whitePlayerId.toString()]?.chessRating || 1200,
          },
          blackPlayer: {
            id: game.blackPlayerId.toString(),
            username: playersMap[game.blackPlayerId.toString()]?.username || "Unknown",
            rating: game.blackPlayerRating || playersMap[game.blackPlayerId.toString()]?.chessRating || 1200,
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
            black: game.blackRatingChange || 0,
          },
        }));

        const stats = await games
          .aggregate([
            {
              $group: {
                _id: null,
                totalGames: { $sum: 1 },
                whiteWins: { $sum: { $cond: [{ $eq: ["$result", "1-0"] }, 1, 0] } },
                blackWins: { $sum: { $cond: [{ $eq: ["$result", "0-1"] }, 1, 0] } },
                draws: { $sum: { $cond: [{ $eq: ["$result", "1/2-1/2"] }, 1, 0] } },
                avgDuration: { $avg: "$duration" },
                avgMoves: { $avg: "$moves" },
              },
            },
          ])
          .toArray();

        return res.json({
          success: true,
          games: formattedGames,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / parseInt(limit)),
            totalGames: totalCount,
            hasNext: skip + parseInt(limit) < totalCount,
            hasPrev: parseInt(page) > 1,
          },
          statistics: stats[0] || {
            totalGames: 0,
            whiteWins: 0,
            blackWins: 0,
            draws: 0,
            avgDuration: 0,
            avgMoves: 0,
          },
        });
      }

      if (req.method === "DELETE") {
        const { gameId } = req.body;
        if (!gameId || !isValidObjectId(gameId)) {
          return res.status(400).json({ success: false, message: "Valid game ID is required" });
        }

        const result = await games.deleteOne({ _id: new ObjectId(gameId) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: "Game not found" });
        }

        return res.json({ success: true, message: "Game deleted successfully" });
      }

      return res.status(405).json({ success: false, message: "Method not allowed for games resource" });
    }

    // Analytics Resource
    if (resource === "analytics") {
      if (req.method === "GET") {
        const { period = "30" } = req.query;
        const daysAgo = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);

        const userStats = await users
          .aggregate([
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
                adminUsers: { $sum: { $cond: [{ $eq: ["$role", "admin"] }, 1, 0] } },
                avgRating: { $avg: "$chessRating" },
                newUsers: { $sum: { $cond: [{ $gte: ["$createdAt", startDate] }, 1, 0] } },
              },
            },
          ])
          .toArray();

        const gameStats = await games
          .aggregate([
            {
              $group: {
                _id: null,
                totalGames: { $sum: 1 },
                recentGames: { $sum: { $cond: [{ $gte: ["$createdAt", startDate] }, 1, 0] } },
                whiteWins: { $sum: { $cond: [{ $eq: ["$result", "1-0"] }, 1, 0] } },
                blackWins: { $sum: { $cond: [{ $eq: ["$result", "0-1"] }, 1, 0] } },
                draws: { $sum: { $cond: [{ $eq: ["$result", "1/2-1/2"] }, 1, 0] } },
                avgDuration: { $avg: "$duration" },
                avgMoves: { $avg: "$moves" },
              },
            },
          ])
          .toArray();

        const dailyActivity = await games
          .aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
              $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                games: { $sum: 1 },
                uniquePlayers: { $addToSet: { $setUnion: ["$whitePlayerId", "$blackPlayerId"] } },
              },
            },
            {
              $project: {
                date: "$_id",
                games: 1,
                uniquePlayers: {
                  $size: {
                    $reduce: {
                      input: "$uniquePlayers",
                      initialValue: [],
                      in: { $setUnion: ["$$value", "$$this"] },
                    },
                  },
                },
              },
            },
            { $sort: { date: 1 } },
          ])
          .toArray();

        const topPlayers = await users
          .find({ isActive: true })
          .sort({ chessRating: -1 })
          .limit(10)
          .project({ username: 1, chessRating: 1, gamesPlayed: 1, gamesWon: 1 })
          .toArray();

        const activePlayers = await users
          .find({ isActive: true, gamesPlayed: { $gt: 0 } })
          .sort({ gamesPlayed: -1 })
          .limit(10)
          .project({ username: 1, gamesPlayed: 1, gamesWon: 1, chessRating: 1 })
          .toArray();

        const timeControlStats = await games
          .aggregate([{ $group: { _id: "$timeControl", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
          .toArray();

        const ratingDistribution = await users
          .aggregate([
            {
              $bucket: {
                groupBy: "$chessRating",
                boundaries: [0, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 3000],
                default: "Other",
                output: { count: { $sum: 1 } },
              },
            },
          ])
          .toArray();

        const tournamentStats = await tournaments
          .aggregate([
            {
              $group: {
                _id: null,
                totalTournaments: { $sum: 1 },
                activeTournaments: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
                upcomingTournaments: { $sum: { $cond: [{ $eq: ["$status", "upcoming"] }, 1, 0] } },
                completedTournaments: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                totalParticipants: { $sum: { $size: "$participants" } },
              },
            },
          ])
          .toArray();

        return res.json({
          success: true,
          analytics: {
            users: userStats[0] || { totalUsers: 0, activeUsers: 0, adminUsers: 0, avgRating: 1200, newUsers: 0 },
            games: gameStats[0] || {
              totalGames: 0,
              recentGames: 0,
              whiteWins: 0,
              blackWins: 0,
              draws: 0,
              avgDuration: 0,
              avgMoves: 0,
            },
            tournaments: tournamentStats[0] || {
              totalTournaments: 0,
              activeTournaments: 0,
              upcomingTournaments: 0,
              completedTournaments: 0,
              totalParticipants: 0,
            },
            dailyActivity,
            topPlayers: topPlayers.map((p) => ({
              id: p._id.toString(),
              username: p.username,
              rating: p.chessRating,
              gamesPlayed: p.gamesPlayed || 0,
              winRate: p.gamesPlayed > 0 ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(1) : 0,
            })),
            activePlayers: activePlayers.map((p) => ({
              id: p._id.toString(),
              username: p.username,
              gamesPlayed: p.gamesPlayed,
              winRate: p.gamesPlayed > 0 ? ((p.gamesWon / p.gamesPlayed) * 100).toFixed(1) : 0,
              rating: p.chessRating,
            })),
            timeControlStats,
            ratingDistribution,
          },
        });
      }

      return res.status(405).json({ success: false, message: "Method not allowed for analytics resource" });
    }

    return res.status(400).json({ success: false, message: "Invalid resource" });
  } catch (error) {
    console.error(`Admin API error [${req.query.resource}]:`, error.message, error.stack);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
}