import clientPromise from "../../lib/mongodb.js";
import { verifyToken } from "../../lib/auth.js";
import { ObjectId } from "mongodb";

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  try {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
  } catch {
    return false;
  }
};

// Helper function to generate PGN from game data
function generatePGN(gameData) {
  const { whitePlayer, blackPlayer, result, moves, timeControl, createdAt, endedAt } = gameData;
  let pgn = `[Event "Chess Club Game"]\n`;
  pgn += `[Site "IIT Dharwad Chess Club"]\n`;
  pgn += `[Date "${createdAt.toISOString().split('T')[0]}"]\n`;
  pgn += `[Round "?"]\n`;
  pgn += `[White "${whitePlayer.username}"]\n`;
  pgn += `[Black "${blackPlayer.username}"]\n`;
  pgn += `[Result "${result}"]\n`;
  pgn += `[WhiteElo "${whitePlayer.rating}"]\n`;
  pgn += `[BlackElo "${blackPlayer.rating}"]\n`;
  pgn += `[TimeControl "${timeControl}"]\n`;
  pgn += `[UTCDate "${createdAt.toISOString().split('T')[0]}"]\n`;
  pgn += `[UTCTime "${createdAt.toISOString().split('T')[1].split('.')[0]}"]\n`;
  if (endedAt) {
    const duration = Math.floor((endedAt - createdAt) / 1000);
    pgn += `[Duration "${duration}"]\n`;
  }
  pgn += `\n`;
  if (moves && Array.isArray(moves)) {
    let moveNumber = 1;
    for (let i = 0; i < moves.length; i += 2) {
      pgn += `${moveNumber}. ${moves[i]}`;
      if (moves[i + 1]) {
        pgn += ` ${moves[i + 1]}`;
      }
      pgn += ` `;
      moveNumber++;
    }
  }
  pgn += ` ${result}`;
  return pgn;
}

// Helper function to calculate rating change
function calculateRatingChange(playerRating, opponentRating, result, kFactor = 32) {
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const actualScore = result === "win" ? 1 : result === "draw" ? 0.5 : 0;
  return Math.round(kFactor * (actualScore - expectedScore));
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
    const games = db.collection("games");
    const headToHead = db.collection("headToHead");

    const { resource } = req.query;
    if (!resource) {
      return res.status(400).json({ success: false, message: "Resource query parameter required" });
    }

    // PGN Resource
    if (resource === "pgn") {
      if (req.method !== "GET") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
      }

      const { gameId, download } = req.query;
      if (!gameId || !isValidObjectId(gameId)) {
        return res.status(400).json({ success: false, message: "Valid game ID is required" });
      }

      const game = await games.findOne({ _id: new ObjectId(gameId) });
      if (!game) {
        return res.status(404).json({ success: false, message: "Game not found" });
      }

      const currentUser = await users.findOne({ _id: new ObjectId(decoded.userId) });
      const isPlayer =
        game.whitePlayerId.toString() === decoded.userId ||
        game.blackPlayerId.toString() === decoded.userId;
      const isAdmin = currentUser && currentUser.role === "admin";

      if (!isPlayer && !isAdmin) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }

      if (download === "true") {
        const [whitePlayer, blackPlayer] = await Promise.all([
          users.findOne({ _id: game.whitePlayerId }, { projection: { username: 1 } }),
          users.findOne({ _id: game.blackPlayerId }, { projection: { username: 1 } }),
        ]);

        const filename = `${
          whitePlayer?.username || "Unknown"
        }_vs_${
          blackPlayer?.username || "Unknown"
        }_${game.createdAt.toISOString().split("T")[0]}.pgn`;

        res.setHeader("Content-Type", "application/x-chess-pgn");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.send(game.pgn);
      }

      return res.json({
        success: true,
        pgn: game.pgn,
        gameInfo: {
          id: game._id.toString(),
          result: game.result,
          timeControl: game.timeControl,
          duration: game.duration,
          moves: game.moveCount || 0,
          createdAt: game.createdAt,
        },
      });
    }

    // Record Resource
    if (resource === "record") {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
      }

      const {
        whitePlayerId,
        blackPlayerId,
        result,
        moves,
        timeControl,
        duration,
        gameType = "casual",
        tournamentId = null,
      } = req.body;

      if (!whitePlayerId || !blackPlayerId || !result || !isValidObjectId(whitePlayerId) || !isValidObjectId(blackPlayerId)) {
        return res.status(400).json({
          success: false,
          message: "Valid white player, black player, and result are required",
        });
      }

      if (tournamentId && !isValidObjectId(tournamentId)) {
        return res.status(400).json({ success: false, message: "Valid tournament ID is required" });
      }

      const [whitePlayer, blackPlayer] = await Promise.all([
        users.findOne({ _id: new ObjectId(whitePlayerId) }),
        users.findOne({ _id: new ObjectId(blackPlayerId) }),
      ]);

      if (!whitePlayer || !blackPlayer) {
        return res.status(404).json({ success: false, message: "One or both players not found" });
      }

      const gameData = {
        whitePlayer: {
          username: whitePlayer.username,
          rating: whitePlayer.chessRating || 1200,
        },
        blackPlayer: {
          username: blackPlayer.username,
          rating: blackPlayer.chessRating || 1200,
        },
        result,
        moves: moves || [],
        timeControl: timeControl || "Unknown",
        createdAt: new Date(),
        endedAt: new Date(),
      };

      const pgn = generatePGN(gameData);

      let whiteRatingChange = 0;
      let blackRatingChange = 0;
      if (gameType === "ranked") {
        if (result === "1-0") {
          whiteRatingChange = calculateRatingChange(
            whitePlayer.chessRating || 1200,
            blackPlayer.chessRating || 1200,
            "win"
          );
          blackRatingChange = calculateRatingChange(
            blackPlayer.chessRating || 1200,
            whitePlayer.chessRating || 1200,
            "loss"
          );
        } else if (result === "0-1") {
          whiteRatingChange = calculateRatingChange(
            whitePlayer.chessRating || 1200,
            blackPlayer.chessRating || 1200,
            "loss"
          );
          blackRatingChange = calculateRatingChange(
            blackPlayer.chessRating || 1200,
            whitePlayer.chessRating || 1200,
            "win"
          );
        } else if (result === "1/2-1/2") {
          whiteRatingChange = calculateRatingChange(
            whitePlayer.chessRating || 1200,
            blackPlayer.chessRating || 1200,
            "draw"
          );
          blackRatingChange = calculateRatingChange(
            blackPlayer.chessRating || 1200,
            whitePlayer.chessRating || 1200,
            "draw"
          );
        }
      }

      const gameRecord = {
        whitePlayerId: new ObjectId(whitePlayerId),
        blackPlayerId: new ObjectId(blackPlayerId),
        whitePlayerRating: whitePlayer.chessRating || 1200,
        blackPlayerRating: blackPlayer.chessRating || 1200,
        result,
        moves: moves || [],
        moveCount: moves ? moves.length : 0,
        timeControl: timeControl || "Unknown",
        duration: duration || 0,
        gameType,
        tournamentId: tournamentId ? new ObjectId(tournamentId) : null,
        pgn,
        whiteRatingChange,
        blackRatingChange,
        createdAt: new Date(),
        endedAt: new Date(),
      };

      const gameResult = await games.insertOne(gameRecord);

      const whiteUpdates = {
        $inc: {
          gamesPlayed: 1,
          totalPlayTime: duration || 0,
        },
        $set: {
          lastGameAt: new Date(),
        },
      };

      const blackUpdates = {
        $inc: {
          gamesPlayed: 1,
          totalPlayTime: duration || 0,
        },
        $set: {
          lastGameAt: new Date(),
        },
      };

      if (result === "1-0") {
        whiteUpdates.$inc.gamesWon = 1;
        blackUpdates.$inc.gamesLost = 1;
      } else if (result === "0-1") {
        whiteUpdates.$inc.gamesLost = 1;
        blackUpdates.$inc.gamesWon = 1;
      } else if (result === "1/2-1/2") {
        whiteUpdates.$inc.gamesDrawn = 1;
        blackUpdates.$inc.gamesDrawn = 1;
      }

      if (gameType === "ranked") {
        const newWhiteRating = (whitePlayer.chessRating || 1200) + whiteRatingChange;
        const newBlackRating = (blackPlayer.chessRating || 1200) + blackRatingChange;
        whiteUpdates.$set.chessRating = Math.max(100, newWhiteRating);
        blackUpdates.$set.chessRating = Math.max(100, newBlackRating);
        whiteUpdates.$max = { highestRating: newWhiteRating };
        whiteUpdates.$min = { lowestRating: newWhiteRating };
        blackUpdates.$max = { highestRating: newBlackRating };
        blackUpdates.$min = { lowestRating: newBlackRating };
      }

      await Promise.all([
        users.updateOne({ _id: new ObjectId(whitePlayerId) }, whiteUpdates),
        users.updateOne({ _id: new ObjectId(blackPlayerId) }, blackUpdates),
      ]);

      const h2hQuery = {
        $or: [
          { player1Id: new ObjectId(whitePlayerId), player2Id: new ObjectId(blackPlayerId) },
          { player1Id: new ObjectId(blackPlayerId), player2Id: new ObjectId(whitePlayerId) },
        ],
      };

      const existingH2H = await headToHead.findOne(h2hQuery);
      if (existingH2H) {
        const isPlayer1White = existingH2H.player1Id.toString() === whitePlayerId;
        const updateH2H = {
          $inc: { totalGames: 1 },
          $set: { lastGameAt: new Date() },
          $push: {
            recentGames: {
              gameId: gameResult.insertedId,
              result,
              date: new Date(),
              whitePlayer: isPlayer1White ? "player1" : "player2",
            },
          },
        };

        if (result === "1-0") {
          if (isPlayer1White) {
            updateH2H.$inc.player1Wins = 1;
          } else {
            updateH2H.$inc.player2Wins = 1;
          }
        } else if (result === "0-1") {
          if (isPlayer1White) {
            updateH2H.$inc.player2Wins = 1;
          } else {
            updateH2H.$inc.player1Wins = 1;
          }
        } else if (result === "1/2-1/2") {
          updateH2H.$inc.draws = 1;
        }

        await headToHead.updateOne({ _id: existingH2H._id }, updateH2H);
      } else {
        const newH2H = {
          player1Id: new ObjectId(whitePlayerId),
          player2Id: new ObjectId(blackPlayerId),
          player1Wins: result === "1-0" ? 1 : 0,
          player2Wins: result === "0-1" ? 1 : 0,
          draws: result === "1/2-1/2" ? 1 : 0,
          totalGames: 1,
          createdAt: new Date(),
          lastGameAt: new Date(),
          recentGames: [
            {
              gameId: gameResult.insertedId,
              result,
              date: new Date(),
              whitePlayer: "player1",
            },
          ],
        };
        await headToHead.insertOne(newH2H);
      }

      return res.json({
        success: true,
        message: "Game recorded successfully",
        gameId: gameResult.insertedId.toString(),
        pgn,
        ratingChanges: {
          white: whiteRatingChange,
          black: blackRatingChange,
        },
      });
    }

    // Head-to-Head Resource
    if (resource === "head-to-head") {
      if (req.method !== "GET") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
      }

      const { player1Id, player2Id } = req.query;
      if (!player1Id || !player2Id || !isValidObjectId(player1Id) || !isValidObjectId(player2Id)) {
        return res.status(400).json({ success: false, message: "Valid player IDs are required" });
      }

      const [player1, player2] = await Promise.all([
        users.findOne({ _id: new ObjectId(player1Id) }, { projection: { password: 0 } }),
        users.findOne({ _id: new ObjectId(player2Id) }, { projection: { password: 0 } }),
      ]);

      if (!player1 || !player2) {
        return res.status(404).json({ success: false, message: "One or both players not found" });
      }

      const h2hRecord = await headToHead.findOne({
        $or: [
          { player1Id: new ObjectId(player1Id), player2Id: new ObjectId(player2Id) },
          { player1Id: new ObjectId(player2Id), player2Id: new ObjectId(player1Id) },
        ],
      });

      const stats = {
        player1: {
          id: player1._id.toString(),
          username: player1.username,
          rating: player1.chessRating || 1200,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          totalGamesOverall: 0,
        },
        player2: {
          id: player2._id.toString(),
          username: player2.username,
          rating: player2.chessRating || 1200,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
          totalGamesOverall: 0,
        },
        totalGames: 0,
        lastGameAt: null,
        recentGames: [],
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

        if (h2hRecord.recentGames && h2hRecord.recentGames.length > 0) {
          const gameIds = h2hRecord.recentGames.map((g) => g.gameId);
          const recentGameDetails = await games
            .find({ _id: { $in: gameIds } })
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
          stats.recentGames = recentGameDetails.map((game) => ({
            id: game._id.toString(),
            result: game.result,
            timeControl: game.timeControl,
            duration: game.duration,
            moves: game.moveCount || 0,
            createdAt: game.createdAt,
            pgn: game.pgn,
            whitePlayer: game.whitePlayerId.toString() === player1Id ? "player1" : "player2",
          }));
        }
      }

      const [player1AllGames, player2AllGames] = await Promise.all([
        games
          .find({
            $or: [{ whitePlayerId: new ObjectId(player1Id) }, { blackPlayerId: new ObjectId(player1Id) }],
          })
          .count(),
        games
          .find({
            $or: [{ whitePlayerId: new ObjectId(player2Id) }, { blackPlayerId: new ObjectId(player2Id) }],
          })
          .count(),
      ]);

      stats.player1.winRate = stats.totalGames > 0 ? ((stats.player1.wins / stats.totalGames) * 100).toFixed(1) : 0;
      stats.player2.winRate = stats.totalGames > 0 ? ((stats.player2.wins / stats.totalGames) * 100).toFixed(1) : 0;
      stats.player1.totalGamesOverall = player1AllGames;
      stats.player2.totalGamesOverall = player2AllGames;

      return res.json({ success: true, headToHead: stats });
    }

    return res.status(400).json({ success: false, message: "Invalid resource" });
  } catch (error) {
    console.error(`Chess Club API error [${req.query.resource}]:`, error.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}