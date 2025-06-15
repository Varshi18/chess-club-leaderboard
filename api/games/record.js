import clientPromise from "../lib/mongodb.js";
import { verifyToken } from "../lib/auth.js";
import { ObjectId } from "mongodb";

// Helper function to generate PGN from moves
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
  
  // Add moves if available
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
  const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  return Math.round(kFactor * (actualScore - expectedScore));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
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

    const {
      whitePlayerId,
      blackPlayerId,
      result, // "1-0", "0-1", "1/2-1/2"
      moves,
      timeControl,
      duration,
      gameType = "casual", // casual, ranked, tournament
      tournamentId = null
    } = req.body;

    if (!whitePlayerId || !blackPlayerId || !result) {
      return res.status(400).json({
        success: false,
        message: "White player, black player, and result are required"
      });
    }

    const client = await clientPromise;
    const db = client.db("chess-club");
    const users = db.collection("users");
    const games = db.collection("games");
    const headToHead = db.collection("headToHead");

    // Get player details
    const [whitePlayer, blackPlayer] = await Promise.all([
      users.findOne({ _id: new ObjectId(whitePlayerId) }),
      users.findOne({ _id: new ObjectId(blackPlayerId) })
    ]);

    if (!whitePlayer || !blackPlayer) {
      return res.status(404).json({
        success: false,
        message: "One or both players not found"
      });
    }

    const gameData = {
      whitePlayer: {
        username: whitePlayer.username,
        rating: whitePlayer.chessRating || 1200
      },
      blackPlayer: {
        username: blackPlayer.username,
        rating: blackPlayer.chessRating || 1200
      },
      result,
      moves: moves || [],
      timeControl: timeControl || "Unknown",
      createdAt: new Date(),
      endedAt: new Date()
    };

    // Generate PGN
    const pgn = generatePGN(gameData);

    // Calculate rating changes for ranked games
    let whiteRatingChange = 0;
    let blackRatingChange = 0;
    
    if (gameType === "ranked") {
      if (result === "1-0") {
        whiteRatingChange = calculateRatingChange(whitePlayer.chessRating, blackPlayer.chessRating, "win");
        blackRatingChange = calculateRatingChange(blackPlayer.chessRating, whitePlayer.chessRating, "loss");
      } else if (result === "0-1") {
        whiteRatingChange = calculateRatingChange(whitePlayer.chessRating, blackPlayer.chessRating, "loss");
        blackRatingChange = calculateRatingChange(blackPlayer.chessRating, whitePlayer.chessRating, "win");
      } else if (result === "1/2-1/2") {
        whiteRatingChange = calculateRatingChange(whitePlayer.chessRating, blackPlayer.chessRating, "draw");
        blackRatingChange = calculateRatingChange(blackPlayer.chessRating, whitePlayer.chessRating, "draw");
      }
    }

    // Create game record
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
      endedAt: new Date()
    };

    const gameResult = await games.insertOne(gameRecord);

    // Update player statistics
    const whiteUpdates = {
      $inc: {
        gamesPlayed: 1,
        totalPlayTime: duration || 0
      },
      $set: {
        lastGameAt: new Date()
      }
    };

    const blackUpdates = {
      $inc: {
        gamesPlayed: 1,
        totalPlayTime: duration || 0
      },
      $set: {
        lastGameAt: new Date()
      }
    };

    // Update win/loss/draw counts and ratings
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

    // Update ratings for ranked games
    if (gameType === "ranked") {
      const newWhiteRating = (whitePlayer.chessRating || 1200) + whiteRatingChange;
      const newBlackRating = (blackPlayer.chessRating || 1200) + blackRatingChange;
      
      whiteUpdates.$set.chessRating = Math.max(100, newWhiteRating);
      blackUpdates.$set.chessRating = Math.max(100, newBlackRating);
      
      // Update highest/lowest ratings
      whiteUpdates.$max = { highestRating: newWhiteRating };
      whiteUpdates.$min = { lowestRating: newWhiteRating };
      blackUpdates.$max = { highestRating: newBlackRating };
      blackUpdates.$min = { lowestRating: newBlackRating };
    }

    await Promise.all([
      users.updateOne({ _id: new ObjectId(whitePlayerId) }, whiteUpdates),
      users.updateOne({ _id: new ObjectId(blackPlayerId) }, blackUpdates)
    ]);

    // Update head-to-head record
    const h2hQuery = {
      $or: [
        { player1Id: new ObjectId(whitePlayerId), player2Id: new ObjectId(blackPlayerId) },
        { player1Id: new ObjectId(blackPlayerId), player2Id: new ObjectId(whitePlayerId) }
      ]
    };

    const existingH2H = await headToHead.findOne(h2hQuery);

    if (existingH2H) {
      // Update existing head-to-head record
      const isPlayer1White = existingH2H.player1Id.toString() === whitePlayerId;
      const updateH2H = {
        $inc: {
          totalGames: 1
        },
        $set: {
          lastGameAt: new Date()
        },
        $push: {
          recentGames: {
            gameId: gameResult.insertedId,
            result,
            date: new Date(),
            whitePlayer: isPlayer1White ? "player1" : "player2"
          }
        }
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
      // Create new head-to-head record
      const newH2H = {
        player1Id: new ObjectId(whitePlayerId),
        player2Id: new ObjectId(blackPlayerId),
        player1Wins: result === "1-0" ? 1 : 0,
        player2Wins: result === "0-1" ? 1 : 0,
        draws: result === "1/2-1/2" ? 1 : 0,
        totalGames: 1,
        createdAt: new Date(),
        lastGameAt: new Date(),
        recentGames: [{
          gameId: gameResult.insertedId,
          result,
          date: new Date(),
          whitePlayer: "player1"
        }]
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
        black: blackRatingChange
      }
    });

  } catch (error) {
    console.error("Record game error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}