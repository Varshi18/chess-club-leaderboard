import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const uri = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

let client;
let db;

async function connectToDatabase() {
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('chess-club');
  }
  return db;
}

// Middleware to verify JWT token
const verifyToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// Helper function to generate game session ID
const generateGameId = () => {
  return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Helper function to safely convert to ObjectId
const toObjectId = (id) => {
  try {
    if (ObjectId.isValid(id)) {
      return new ObjectId(id);
    }
    return null;
  } catch (error) {
    return null;
  }
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const db = await connectToDatabase();
    const { endpoint, action, resource } = req.query;

    // Authentication endpoints
    if (endpoint === 'auth') {
      if (action === 'register' && req.method === 'POST') {
        const { username, email, password, fullName } = req.body;

        // Validation
        if (!username || !email || !password || !fullName) {
          return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Check if user exists
        const existingUser = await db.collection('users').findOne({
          $or: [{ email }, { username }]
        });

        if (existingUser) {
          return res.status(400).json({ 
            success: false, 
            message: existingUser.email === email ? 'Email already exists' : 'Username already exists'
          });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Create user
        const newUser = {
          username,
          email,
          password: hashedPassword,
          fullName,
          chessRating: 1200,
          gamesPlayed: 0,
          gamesWon: 0,
          role: 'user',
          isActive: true,
          createdAt: new Date(),
          lastSeen: new Date()
        };

        const result = await db.collection('users').insertOne(newUser);
        
        // Generate token
        const token = jwt.sign(
          { userId: result.insertedId, username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        const userResponse = {
          id: result.insertedId,
          username,
          email,
          fullName,
          chessRating: 1200,
          role: 'user'
        };

        return res.status(201).json({
          success: true,
          message: 'User registered successfully',
          token,
          user: userResponse
        });
      }

      if (action === 'login' && req.method === 'POST') {
        const { email, password } = req.body;

        if (!email || !password) {
          return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        // Find user
        const user = await db.collection('users').findOne({ email });
        if (!user) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Update last seen
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { lastSeen: new Date() } }
        );

        // Generate token
        const token = jwt.sign(
          { userId: user._id, username: user.username },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        const userResponse = {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          chessRating: user.chessRating || 1200,
          role: user.role || 'user'
        };

        return res.status(200).json({
          success: true,
          message: 'Login successful',
          token,
          user: userResponse
        });
      }

      if (action === 'me' && req.method === 'GET') {
        const decoded = verifyToken(req);
        if (!decoded) {
          return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        const user = await db.collection('users').findOne({ _id: toObjectId(decoded.userId) });
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userResponse = {
          id: user._id,
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          chessRating: user.chessRating || 1200,
          role: user.role || 'user'
        };

        return res.status(200).json({ success: true, user: userResponse });
      }
    }

    // Game Sessions endpoints for server-side multiplayer
    if (endpoint === 'game-sessions') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.method === 'GET' && req.query.gameId && !action) {
        const { gameId } = req.query;
        
        try {
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Populate player data
          const whitePlayer = await db.collection('users').findOne({ _id: toObjectId(gameSession.whitePlayerId) });
          const blackPlayer = await db.collection('users').findOne({ _id: toObjectId(gameSession.blackPlayerId) });

          if (!whitePlayer || !blackPlayer) {
            return res.status(404).json({ success: false, message: 'Player data not found' });
          }

          const sessionWithPlayers = {
            ...gameSession,
            whitePlayer: {
              id: whitePlayer._id,
              username: whitePlayer.username,
              chessRating: whitePlayer.chessRating || 1200
            },
            blackPlayer: {
              id: blackPlayer._id,
              username: blackPlayer.username,
              chessRating: blackPlayer.chessRating || 1200
            }
          };

          return res.status(200).json({ success: true, gameSession: sessionWithPlayers });
        } catch (error) {
          console.error('Error fetching game session:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch game session' });
        }
      }

      if (req.method === 'GET' && action === 'sync') {
        const { gameId, lastVersion } = req.query;
        
        try {
          if (!gameId) {
            return res.status(400).json({ success: false, message: 'Game ID is required' });
          }

          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Verify user is part of this game
          const userIdStr = decoded.userId.toString();
          const whitePlayerIdStr = gameSession.whitePlayerId.toString();
          const blackPlayerIdStr = gameSession.blackPlayerId.toString();
          
          if (userIdStr !== whitePlayerIdStr && userIdStr !== blackPlayerIdStr) {
            return res.status(403).json({ success: false, message: 'Not authorized to access this game' });
          }

          const currentVersion = gameSession.version || 0;
          const clientVersion = parseInt(lastVersion || 0);
          const hasUpdates = currentVersion > clientVersion;
          
          if (hasUpdates) {
            // Populate player data for sync
            const whitePlayer = await db.collection('users').findOne({ _id: toObjectId(gameSession.whitePlayerId) });
            const blackPlayer = await db.collection('users').findOne({ _id: toObjectId(gameSession.blackPlayerId) });

            const sessionWithPlayers = {
              ...gameSession,
              whitePlayer: {
                id: whitePlayer._id,
                username: whitePlayer.username,
                chessRating: whitePlayer.chessRating || 1200
              },
              blackPlayer: {
                id: blackPlayer._id,
                username: blackPlayer.username,
                chessRating: blackPlayer.chessRating || 1200
              }
            };

            return res.status(200).json({ 
              success: true, 
              hasUpdates: true, 
              gameState: sessionWithPlayers 
            });
          }

          return res.status(200).json({ success: true, hasUpdates: false });
        } catch (error) {
          console.error('Error syncing game session:', error);
          return res.status(500).json({ success: false, message: 'Failed to sync game session' });
        }
      }

      if (req.method === 'PATCH' && action === 'move') {
        const { gameId, move, fen } = req.body;
        
        try {
          if (!gameId || !move) {
            return res.status(400).json({ success: false, message: 'Game ID and move are required' });
          }
          
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Check if game is paused or ended
          if (gameSession.status === 'paused') {
            return res.status(400).json({ success: false, message: 'Game is paused' });
          }

          if (gameSession.status === 'completed') {
            return res.status(400).json({ success: false, message: 'Game has ended' });
          }

          // Verify it's the player's turn
          const userIdStr = decoded.userId.toString();
          const isWhitePlayer = gameSession.whitePlayerId.toString() === userIdStr;
          const isBlackPlayer = gameSession.blackPlayerId.toString() === userIdStr;
          
          if (!isWhitePlayer && !isBlackPlayer) {
            return res.status(403).json({ success: false, message: 'Not a player in this game' });
          }

          const currentTurn = gameSession.turn || 'w';
          const playerCanMove = (currentTurn === 'w' && isWhitePlayer) || (currentTurn === 'b' && isBlackPlayer);
          
          if (!playerCanMove) {
            return res.status(400).json({ success: false, message: `Not your turn. Current turn: ${currentTurn === 'w' ? 'White' : 'Black'}` });
          }

          // Calculate time spent on this move (simple estimation)
          const now = new Date();
          const lastMoveTime = gameSession.lastMoveAt || gameSession.createdAt;
          const timeSpent = Math.min(30, Math.floor((now - new Date(lastMoveTime)) / 1000)); // Max 30 seconds per move

          // Update game state
          const newMoves = [...(gameSession.moves || []), move];
          const newTurn = currentTurn === 'w' ? 'b' : 'w'; // CRITICAL FIX: Switch turns properly
          const newVersion = (gameSession.version || 0) + 1;

          // Update timers (subtract time from current player)
          const updatedTimeLeft = {
            whiteTimeLeft: currentTurn === 'w' 
              ? Math.max(0, (gameSession.whiteTimeLeft || gameSession.timeControl) - timeSpent)
              : (gameSession.whiteTimeLeft || gameSession.timeControl),
            blackTimeLeft: currentTurn === 'b' 
              ? Math.max(0, (gameSession.blackTimeLeft || gameSession.timeControl) - timeSpent)
              : (gameSession.blackTimeLeft || gameSession.timeControl)
          };

          // CRITICAL FIX: Update the game session with proper turn switching
          const updateResult = await db.collection('game_sessions').updateOne(
            { gameId },
            {
              $set: {
                moves: newMoves,
                fen,
                turn: newTurn, // This switches the turn properly
                version: newVersion,
                lastMoveBy: decoded.userId,
                lastMoveAt: now,
                ...updatedTimeLeft
              }
            }
          );

          if (updateResult.modifiedCount === 0) {
            return res.status(500).json({ success: false, message: 'Failed to update game state' });
          }

          console.log('✅ Move processed on server:', {
            move,
            oldTurn: currentTurn,
            newTurn,
            version: newVersion,
            player: isWhitePlayer ? 'white' : 'black',
            timeLeft: updatedTimeLeft
          });

          return res.status(200).json({ 
            success: true, 
            version: newVersion,
            turn: newTurn,
            timeLeft: updatedTimeLeft,
            message: 'Move recorded successfully' 
          });
        } catch (error) {
          console.error('Error recording move:', error);
          return res.status(500).json({ success: false, message: 'Failed to record move' });
        }
      }

      // NEW: Resign endpoint
      if (req.method === 'PATCH' && action === 'resign') {
        const { gameId } = req.body;
        
        try {
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Verify user is part of this game
          const userIdStr = decoded.userId.toString();
          const isWhitePlayer = gameSession.whitePlayerId.toString() === userIdStr;
          const isBlackPlayer = gameSession.blackPlayerId.toString() === userIdStr;
          
          if (!isWhitePlayer && !isBlackPlayer) {
            return res.status(403).json({ success: false, message: 'Not a player in this game' });
          }

          // Determine winner (opponent of the player who resigned)
          const result = isWhitePlayer ? '0-1' : '1-0';
          const winner = isWhitePlayer ? 'Black' : 'White';

          await db.collection('game_sessions').updateOne(
            { gameId },
            {
              $set: {
                status: 'completed',
                result,
                reason: 'resignation',
                resignedBy: decoded.userId,
                endedAt: new Date(),
                version: (gameSession.version || 0) + 1
              }
            }
          );

          console.log('🏳️ Player resigned:', {
            gameId,
            resignedBy: decoded.userId,
            winner,
            result
          });

          return res.status(200).json({ 
            success: true, 
            message: 'Game ended by resignation',
            result,
            winner,
            reason: 'resignation'
          });
        } catch (error) {
          console.error('Error processing resignation:', error);
          return res.status(500).json({ success: false, message: 'Failed to process resignation' });
        }
      }

      // NEW: Draw offer endpoint
      if (req.method === 'PATCH' && action === 'offer-draw') {
        const { gameId } = req.body;
        
        try {
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Verify user is part of this game
          const userIdStr = decoded.userId.toString();
          const isWhitePlayer = gameSession.whitePlayerId.toString() === userIdStr;
          const isBlackPlayer = gameSession.blackPlayerId.toString() === userIdStr;
          
          if (!isWhitePlayer && !isBlackPlayer) {
            return res.status(403).json({ success: false, message: 'Not a player in this game' });
          }

          // Check if there's already a pending draw offer
          if (gameSession.drawOffer && gameSession.drawOffer.status === 'pending') {
            return res.status(400).json({ success: false, message: 'Draw offer already pending' });
          }

          await db.collection('game_sessions').updateOne(
            { gameId },
            {
              $set: {
                drawOffer: {
                  offeredBy: decoded.userId,
                  status: 'pending',
                  offeredAt: new Date()
                },
                version: (gameSession.version || 0) + 1
              }
            }
          );

          return res.status(200).json({ 
            success: true, 
            message: 'Draw offer sent'
          });
        } catch (error) {
          console.error('Error offering draw:', error);
          return res.status(500).json({ success: false, message: 'Failed to offer draw' });
        }
      }

      // NEW: Respond to draw offer endpoint
      if (req.method === 'PATCH' && action === 'respond-draw') {
        const { gameId, response } = req.body;
        
        try {
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Verify user is part of this game and not the one who offered the draw
          const userIdStr = decoded.userId.toString();
          const isWhitePlayer = gameSession.whitePlayerId.toString() === userIdStr;
          const isBlackPlayer = gameSession.blackPlayerId.toString() === userIdStr;
          
          if (!isWhitePlayer && !isBlackPlayer) {
            return res.status(403).json({ success: false, message: 'Not a player in this game' });
          }

          if (!gameSession.drawOffer || gameSession.drawOffer.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'No pending draw offer' });
          }

          if (gameSession.drawOffer.offeredBy === userIdStr) {
            return res.status(400).json({ success: false, message: 'Cannot respond to your own draw offer' });
          }

          if (response === 'accept') {
            // Accept draw
            await db.collection('game_sessions').updateOne(
              { gameId },
              {
                $set: {
                  status: 'completed',
                  result: '1/2-1/2',
                  reason: 'draw_agreement',
                  endedAt: new Date(),
                  drawOffer: {
                    ...gameSession.drawOffer,
                    status: 'accepted',
                    respondedAt: new Date()
                  },
                  version: (gameSession.version || 0) + 1
                }
              }
            );

            return res.status(200).json({ 
              success: true, 
              message: 'Draw accepted',
              result: '1/2-1/2',
              reason: 'draw_agreement'
            });
          } else {
            // Decline draw
            await db.collection('game_sessions').updateOne(
              { gameId },
              {
                $set: {
                  drawOffer: {
                    ...gameSession.drawOffer,
                    status: 'declined',
                    respondedAt: new Date()
                  },
                  version: (gameSession.version || 0) + 1
                }
              }
            );

            return res.status(200).json({ 
              success: true, 
              message: 'Draw declined'
            });
          }
        } catch (error) {
          console.error('Error responding to draw:', error);
          return res.status(500).json({ success: false, message: 'Failed to respond to draw' });
        }
      }

      // NEW: Pause game endpoint
      if (req.method === 'PATCH' && action === 'pause') {
        const { gameId } = req.body;
        
        try {
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Verify user is part of this game
          const userIdStr = decoded.userId.toString();
          const isWhitePlayer = gameSession.whitePlayerId.toString() === userIdStr;
          const isBlackPlayer = gameSession.blackPlayerId.toString() === userIdStr;
          
          if (!isWhitePlayer && !isBlackPlayer) {
            return res.status(403).json({ success: false, message: 'Not a player in this game' });
          }

          // Check if there's already a pending pause request
          if (gameSession.pauseRequest && gameSession.pauseRequest.status === 'pending') {
            return res.status(400).json({ success: false, message: 'Pause request already pending' });
          }

          await db.collection('game_sessions').updateOne(
            { gameId },
            {
              $set: {
                pauseRequest: {
                  requestedBy: decoded.userId,
                  status: 'pending',
                  requestedAt: new Date()
                },
                version: (gameSession.version || 0) + 1
              }
            }
          );

          return res.status(200).json({ 
            success: true, 
            message: 'Pause request sent'
          });
        } catch (error) {
          console.error('Error requesting pause:', error);
          return res.status(500).json({ success: false, message: 'Failed to request pause' });
        }
      }

      // NEW: Respond to pause request endpoint
      if (req.method === 'PATCH' && action === 'respond-pause') {
        const { gameId, response } = req.body;
        
        try {
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          // Verify user is part of this game and not the one who requested the pause
          const userIdStr = decoded.userId.toString();
          const isWhitePlayer = gameSession.whitePlayerId.toString() === userIdStr;
          const isBlackPlayer = gameSession.blackPlayerId.toString() === userIdStr;
          
          if (!isWhitePlayer && !isBlackPlayer) {
            return res.status(403).json({ success: false, message: 'Not a player in this game' });
          }

          if (!gameSession.pauseRequest || gameSession.pauseRequest.status !== 'pending') {
            return res.status(400).json({ success: false, message: 'No pending pause request' });
          }

          if (gameSession.pauseRequest.requestedBy === userIdStr) {
            return res.status(400).json({ success: false, message: 'Cannot respond to your own pause request' });
          }

          if (response === 'accept') {
            // Accept pause
            await db.collection('game_sessions').updateOne(
              { gameId },
              {
                $set: {
                  status: 'paused',
                  pausedAt: new Date(),
                  pauseRequest: {
                    ...gameSession.pauseRequest,
                    status: 'accepted',
                    respondedAt: new Date()
                  },
                  version: (gameSession.version || 0) + 1
                }
              }
            );

            return res.status(200).json({ 
              success: true, 
              message: 'Game paused'
            });
          } else {
            // Decline pause
            await db.collection('game_sessions').updateOne(
              { gameId },
              {
                $set: {
                  pauseRequest: {
                    ...gameSession.pauseRequest,
                    status: 'declined',
                    respondedAt: new Date()
                  },
                  version: (gameSession.version || 0) + 1
                }
              }
            );

            return res.status(200).json({ 
              success: true, 
              message: 'Pause request declined'
            });
          }
        } catch (error) {
          console.error('Error responding to pause:', error);
          return res.status(500).json({ success: false, message: 'Failed to respond to pause' });
        }
      }

      // NEW: Resume game endpoint
      if (req.method === 'PATCH' && action === 'resume') {
        const { gameId } = req.body;
        
        try {
          const gameSession = await db.collection('game_sessions').findOne({ gameId });
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game session not found' });
          }

          if (gameSession.status !== 'paused') {
            return res.status(400).json({ success: false, message: 'Game is not paused' });
          }

          // Verify user is part of this game
          const userIdStr = decoded.userId.toString();
          const isWhitePlayer = gameSession.whitePlayerId.toString() === userIdStr;
          const isBlackPlayer = gameSession.blackPlayerId.toString() === userIdStr;
          
          if (!isWhitePlayer && !isBlackPlayer) {
            return res.status(403).json({ success: false, message: 'Not a player in this game' });
          }

          await db.collection('game_sessions').updateOne(
            { gameId },
            {
              $set: {
                status: 'active',
                resumedAt: new Date(),
                version: (gameSession.version || 0) + 1
              },
              $unset: {
                pausedAt: 1,
                pauseRequest: 1
              }
            }
          );

          return res.status(200).json({ 
            success: true, 
            message: 'Game resumed'
          });
        } catch (error) {
          console.error('Error resuming game:', error);
          return res.status(500).json({ success: false, message: 'Failed to resume game' });
        }
      }

      if (req.method === 'PATCH' && action === 'end') {
        const { gameId, result, reason } = req.body;
        
        try {
          await db.collection('game_sessions').updateOne(
            { gameId },
            {
              $set: {
                status: 'completed',
                result,
                reason,
                endedAt: new Date(),
                version: (gameSession.version || 0) + 1
              }
            }
          );

          return res.status(200).json({ success: true, message: 'Game ended successfully' });
        } catch (error) {
          console.error('Error ending game:', error);
          return res.status(500).json({ success: false, message: 'Failed to end game' });
        }
      }
    }

    // Challenges endpoints
    if (endpoint === 'challenges') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.method === 'POST' && action === 'send') {
        const { challengedUserId, timeControl } = req.body;

        try {
          // Validate input
          if (!challengedUserId || !timeControl) {
            return res.status(400).json({ success: false, message: 'Challenged user ID and time control are required' });
          }

          if (challengedUserId === decoded.userId) {
            return res.status(400).json({ success: false, message: 'Cannot challenge yourself' });
          }

          // Check if challenged user exists
          const challengedUser = await db.collection('users').findOne({ _id: toObjectId(challengedUserId) });
          if (!challengedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }

          // Check for existing pending challenge between these users
          const existingChallenge = await db.collection('challenges').findOne({
            $or: [
              { challengerId: decoded.userId, challengedUserId: challengedUserId, status: 'pending' },
              { challengerId: challengedUserId, challengedUserId: decoded.userId, status: 'pending' }
            ]
          });

          if (existingChallenge) {
            return res.status(400).json({ success: false, message: 'A pending challenge already exists between you and this user' });
          }

          const challenge = {
            id: generateGameId(),
            challengerId: decoded.userId,
            challengedUserId: challengedUserId,
            timeControl: parseInt(timeControl),
            status: 'pending',
            createdAt: new Date()
          };

          const result = await db.collection('challenges').insertOne(challenge);
          
          if (!result.insertedId) {
            return res.status(500).json({ success: false, message: 'Failed to create challenge' });
          }

          console.log('✅ Challenge created:', {
            challengeId: challenge.id,
            challenger: decoded.userId,
            challenged: challengedUserId,
            timeControl: challenge.timeControl
          });

          return res.status(200).json({ 
            success: true, 
            message: 'Challenge sent successfully',
            challengeId: challenge.id
          });
        } catch (error) {
          console.error('Error sending challenge:', error);
          return res.status(500).json({ success: false, message: 'Failed to send challenge' });
        }
      }

      if (req.method === 'GET' && action === 'received') {
        try {
          const challenges = await db.collection('challenges').find({
            challengedUserId: decoded.userId,
            status: 'pending'
          }).toArray();

          // Populate challenger data safely
          const challengesWithUsers = [];
          for (const challenge of challenges) {
            try {
              const challenger = await db.collection('users').findOne({ _id: toObjectId(challenge.challengerId) });
              if (challenger) {
                challengesWithUsers.push({
                  id: challenge.id,
                  timeControl: challenge.timeControl,
                  status: challenge.status,
                  createdAt: challenge.createdAt,
                  challenger: {
                    id: challenger._id,
                    username: challenger.username,
                    chessRating: challenger.chessRating || 1200
                  }
                });
              }
            } catch (error) {
              console.error('Error populating challenger data:', error);
            }
          }

          return res.status(200).json({ success: true, challenges: challengesWithUsers });
        } catch (error) {
          console.error('Error fetching received challenges:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch challenges' });
        }
      }

      if (req.method === 'GET' && action === 'sent') {
        try {
          const challenges = await db.collection('challenges').find({
            challengerId: decoded.userId
          }).toArray();

          // Populate challenged user data safely
          const challengesWithUsers = [];
          for (const challenge of challenges) {
            try {
              const challenged = await db.collection('users').findOne({ _id: toObjectId(challenge.challengedUserId) });
              if (challenged) {
                challengesWithUsers.push({
                  id: challenge.id,
                  timeControl: challenge.timeControl,
                  status: challenge.status,
                  gameId: challenge.gameId,
                  createdAt: challenge.createdAt,
                  challenged: {
                    id: challenged._id,
                    username: challenged.username,
                    chessRating: challenged.chessRating || 1200
                  }
                });
              }
            } catch (error) {
              console.error('Error populating challenged user data:', error);
            }
          }

          return res.status(200).json({ success: true, challenges: challengesWithUsers });
        } catch (error) {
          console.error('Error fetching sent challenges:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch challenges' });
        }
      }

      if (req.method === 'PATCH' && action === 'respond') {
        const { challengeId, response } = req.body;

        try {
          if (!challengeId || !response) {
            return res.status(400).json({ success: false, message: 'Challenge ID and response are required' });
          }

          const challenge = await db.collection('challenges').findOne({ 
            id: challengeId,
            challengedUserId: decoded.userId,
            status: 'pending'
          });

          if (!challenge) {
            return res.status(404).json({ success: false, message: 'Challenge not found or already responded to' });
          }

          if (response === 'accept') {
            // Create game session
            const gameId = generateGameId();
            const gameSession = {
              gameId,
              whitePlayerId: challenge.challengerId,
              blackPlayerId: decoded.userId,
              timeControl: challenge.timeControl,
              whiteTimeLeft: challenge.timeControl,
              blackTimeLeft: challenge.timeControl,
              moves: [],
              turn: 'w', // White always starts
              status: 'active',
              version: 0,
              createdAt: new Date()
            };

            const gameResult = await db.collection('game_sessions').insertOne(gameSession);
            
            if (!gameResult.insertedId) {
              return res.status(500).json({ success: false, message: 'Failed to create game session' });
            }

            // Update challenge status
            await db.collection('challenges').updateOne(
              { id: challengeId },
              { 
                $set: { 
                  status: 'accepted', 
                  gameId,
                  respondedAt: new Date() 
                } 
              }
            );

            console.log('✅ Challenge accepted, game created:', {
              challengeId,
              gameId,
              whitePlayer: challenge.challengerId,
              blackPlayer: decoded.userId
            });

            return res.status(200).json({ 
              success: true, 
              message: 'Challenge accepted',
              gameId 
            });
          } else if (response === 'decline') {
            // Decline challenge
            await db.collection('challenges').updateOne(
              { id: challengeId },
              { 
                $set: { 
                  status: 'declined',
                  respondedAt: new Date() 
                } 
              }
            );

            return res.status(200).json({ success: true, message: 'Challenge declined' });
          } else {
            return res.status(400).json({ success: false, message: 'Invalid response. Must be "accept" or "decline"' });
          }
        } catch (error) {
          console.error('Error responding to challenge:', error);
          return res.status(500).json({ success: false, message: 'Failed to respond to challenge' });
        }
      }

      if (req.method === 'DELETE' && action === 'cancel') {
        const { challengeId } = req.query;

        try {
          if (!challengeId) {
            return res.status(400).json({ success: false, message: 'Challenge ID is required' });
          }

          const result = await db.collection('challenges').deleteOne({
            id: challengeId,
            challengerId: decoded.userId,
            status: 'pending'
          });

          if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Challenge not found or cannot be cancelled' });
          }

          return res.status(200).json({ success: true, message: 'Challenge cancelled' });
        } catch (error) {
          console.error('Error cancelling challenge:', error);
          return res.status(500).json({ success: false, message: 'Failed to cancel challenge' });
        }
      }
    }

    // Friends endpoints
    if (endpoint === 'friends') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.method === 'GET' && req.query.q) {
        // Search users
        const searchQuery = req.query.q;
        try {
          const users = await db.collection('users').find({
            $or: [
              { username: { $regex: searchQuery, $options: 'i' } },
              { fullName: { $regex: searchQuery, $options: 'i' } }
            ],
            _id: { $ne: toObjectId(decoded.userId) }
          }).limit(20).toArray();

          // Check friendship status for each user safely
          const userResults = [];
          for (const user of users) {
            try {
              // Check if already friends
              const friendship = await db.collection('friendships').findOne({
                $or: [
                  { user1Id: decoded.userId, user2Id: user._id.toString() },
                  { user1Id: user._id.toString(), user2Id: decoded.userId }
                ]
              });

              // Check if friend request already sent
              const friendRequest = await db.collection('friend_requests').findOne({
                $or: [
                  { senderId: decoded.userId, receiverId: user._id.toString(), status: 'pending' },
                  { senderId: user._id.toString(), receiverId: decoded.userId, status: 'pending' }
                ]
              });

              userResults.push({
                id: user._id.toString(),
                username: user.username,
                fullName: user.fullName,
                chessRating: user.chessRating || 1200,
                isFriend: !!friendship,
                friendRequestSent: !!friendRequest
              });
            } catch (error) {
              console.error('Error checking friendship status:', error);
            }
          }

          return res.status(200).json({ success: true, users: userResults });
        } catch (error) {
          console.error('Error searching users:', error);
          return res.status(500).json({ success: false, message: 'Failed to search users' });
        }
      }

      if (req.method === 'GET' && req.query.type === 'requests') {
        // Get friend requests
        try {
          const requests = await db.collection('friend_requests').find({
            receiverId: decoded.userId,
            status: 'pending'
          }).toArray();

          // Populate sender data safely
          const requestsWithUsers = [];
          for (const request of requests) {
            try {
              const sender = await db.collection('users').findOne({ _id: toObjectId(request.senderId) });
              if (sender) {
                requestsWithUsers.push({
                  id: request._id,
                  sender: {
                    id: sender._id,
                    username: sender.username,
                    chessRating: sender.chessRating || 1200
                  }
                });
              }
            } catch (error) {
              console.error('Error populating sender data:', error);
            }
          }

          return res.status(200).json({ success: true, requests: requestsWithUsers });
        } catch (error) {
          console.error('Error fetching friend requests:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch friend requests' });
        }
      }

      if (req.method === 'GET') {
        // Get friends list
        try {
          const friendships = await db.collection('friendships').find({
            $or: [
              { user1Id: decoded.userId },
              { user2Id: decoded.userId }
            ]
          }).toArray();

          // Populate friend data safely
          const friendsWithUsers = [];
          for (const friendship of friendships) {
            try {
              const friendId = friendship.user1Id === decoded.userId ? friendship.user2Id : friendship.user1Id;
              const friend = await db.collection('users').findOne({ _id: toObjectId(friendId) });
              if (friend) {
                friendsWithUsers.push({
                  id: friend._id.toString(),
                  username: friend.username,
                  chessRating: friend.chessRating || 1200,
                  lastSeen: friend.lastSeen
                });
              }
            } catch (error) {
              console.error('Error populating friend data:', error);
            }
          }

          return res.status(200).json({ success: true, friends: friendsWithUsers });
        } catch (error) {
          console.error('Error fetching friends:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch friends' });
        }
      }

      if (req.method === 'POST') {
        // Send friend request
        const { userId } = req.body;

        if (!userId) {
          return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        if (userId === decoded.userId) {
          return res.status(400).json({ success: false, message: 'Cannot add yourself as friend' });
        }

        try {
          // Check if user exists
          const targetUser = await db.collection('users').findOne({ _id: toObjectId(userId) });
          if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }

          // Check if already friends or request exists
          const existingFriendship = await db.collection('friendships').findOne({
            $or: [
              { user1Id: decoded.userId, user2Id: userId },
              { user1Id: userId, user2Id: decoded.userId }
            ]
          });

          if (existingFriendship) {
            return res.status(400).json({ success: false, message: 'Already friends' });
          }

          const existingRequest = await db.collection('friend_requests').findOne({
            $or: [
              { senderId: decoded.userId, receiverId: userId },
              { senderId: userId, receiverId: decoded.userId }
            ],
            status: 'pending'
          });

          if (existingRequest) {
            return res.status(400).json({ success: false, message: 'Friend request already sent' });
          }

          await db.collection('friend_requests').insertOne({
            senderId: decoded.userId,
            receiverId: userId,
            status: 'pending',
            createdAt: new Date()
          });

          return res.status(200).json({ success: true, message: 'Friend request sent' });
        } catch (error) {
          console.error('Error sending friend request:', error);
          return res.status(500).json({ success: false, message: 'Failed to send friend request' });
        }
      }

      if (req.method === 'PATCH') {
        // Accept/reject friend request
        const { requestId, action } = req.body;

        try {
          const request = await db.collection('friend_requests').findOne({
            _id: toObjectId(requestId),
            receiverId: decoded.userId,
            status: 'pending'
          });

          if (!request) {
            return res.status(404).json({ success: false, message: 'Friend request not found' });
          }

          if (action === 'accept') {
            // Create friendship
            await db.collection('friendships').insertOne({
              user1Id: request.senderId,
              user2Id: decoded.userId,
              createdAt: new Date()
            });

            // Update request status
            await db.collection('friend_requests').updateOne(
              { _id: toObjectId(requestId) },
              { $set: { status: 'accepted', respondedAt: new Date() } }
            );

            return res.status(200).json({ success: true, message: 'Friend request accepted' });
          } else {
            // Reject request
            await db.collection('friend_requests').updateOne(
              { _id: toObjectId(requestId) },
              { $set: { status: 'rejected', respondedAt: new Date() } }
            );

            return res.status(200).json({ success: true, message: 'Friend request rejected' });
          }
        } catch (error) {
          console.error('Error responding to friend request:', error);
          return res.status(500).json({ success: false, message: 'Failed to respond to friend request' });
        }
      }
    }

    // Tournaments endpoints
    if (endpoint === 'tournaments') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.method === 'GET') {
        // Get all tournaments
        try {
          const tournaments = await db.collection('tournaments').find({}).toArray();

          // Populate participant data safely
          const tournamentsWithParticipants = [];
          for (const tournament of tournaments) {
            try {
              const participants = [];
              for (const participantId of (tournament.participants || [])) {
                try {
                  const user = await db.collection('users').findOne({ _id: toObjectId(participantId) });
                  if (user) {
                    participants.push({
                      userId: user._id.toString(),
                      username: user.username,
                      rating: user.chessRating || 1200
                    });
                  }
                } catch (error) {
                  console.error('Error populating participant:', error);
                }
              }

              tournamentsWithParticipants.push({
                ...tournament,
                participants
              });
            } catch (error) {
              console.error('Error processing tournament:', error);
            }
          }

          return res.status(200).json({ success: true, tournaments: tournamentsWithParticipants });
        } catch (error) {
          console.error('Error fetching tournaments:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch tournaments' });
        }
      }

      if (req.method === 'POST') {
        // Create tournament (admin only)
        const user = await db.collection('users').findOne({ _id: toObjectId(decoded.userId) });
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const {
          name,
          description,
          format,
          timeControl,
          maxParticipants,
          startTime,
          endTime,
          prizePool
        } = req.body;

        if (!name || !format || !timeControl || !maxParticipants || !startTime) {
          return res.status(400).json({ success: false, message: 'Required fields missing' });
        }

        try {
          const tournament = {
            id: generateGameId(),
            name,
            description: description || '',
            format,
            timeControl: parseInt(timeControl),
            maxParticipants: parseInt(maxParticipants),
            startTime: new Date(startTime),
            endTime: endTime ? new Date(endTime) : null,
            prizePool: parseInt(prizePool) || 0,
            participants: [],
            status: 'upcoming',
            bracket: null,
            createdBy: decoded.userId,
            createdAt: new Date()
          };

          await db.collection('tournaments').insertOne(tournament);

          return res.status(201).json({ success: true, message: 'Tournament created successfully', tournament });
        } catch (error) {
          console.error('Error creating tournament:', error);
          return res.status(500).json({ success: false, message: 'Failed to create tournament' });
        }
      }

      if (req.method === 'POST' && action === 'join') {
        // Join tournament
        const { tournamentId } = req.query;

        try {
          const tournament = await db.collection('tournaments').findOne({ id: tournamentId });
          if (!tournament) {
            return res.status(404).json({ success: false, message: 'Tournament not found' });
          }

          if (tournament.participants.includes(decoded.userId)) {
            return res.status(400).json({ success: false, message: 'Already joined this tournament' });
          }

          if (tournament.participants.length >= tournament.maxParticipants) {
            return res.status(400).json({ success: false, message: 'Tournament is full' });
          }

          if (new Date() > tournament.startTime) {
            return res.status(400).json({ success: false, message: 'Tournament has already started' });
          }

          await db.collection('tournaments').updateOne(
            { id: tournamentId },
            { $push: { participants: decoded.userId } }
          );

          return res.status(200).json({ success: true, message: 'Successfully joined tournament' });
        } catch (error) {
          console.error('Error joining tournament:', error);
          return res.status(500).json({ success: false, message: 'Failed to join tournament' });
        }
      }

      if (req.method === 'PUT') {
        // Update tournament (admin only)
        const user = await db.collection('users').findOne({ _id: toObjectId(decoded.userId) });
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { tournamentId } = req.query;
        const updates = req.body;

        try {
          // Remove fields that shouldn't be updated directly
          delete updates._id;
          delete updates.id;
          delete updates.createdAt;
          delete updates.createdBy;

          await db.collection('tournaments').updateOne(
            { id: tournamentId },
            { $set: { ...updates, updatedAt: new Date() } }
          );

          return res.status(200).json({ success: true, message: 'Tournament updated successfully' });
        } catch (error) {
          console.error('Error updating tournament:', error);
          return res.status(500).json({ success: false, message: 'Failed to update tournament' });
        }
      }

      if (req.method === 'DELETE') {
        // Delete tournament (admin only)
        const user = await db.collection('users').findOne({ _id: toObjectId(decoded.userId) });
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { tournamentId } = req.query;

        try {
          await db.collection('tournaments').deleteOne({ id: tournamentId });

          return res.status(200).json({ success: true, message: 'Tournament deleted successfully' });
        } catch (error) {
          console.error('Error deleting tournament:', error);
          return res.status(500).json({ success: false, message: 'Failed to delete tournament' });
        }
      }
    }

    // Admin endpoints
    if (endpoint === 'admin') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const user = await db.collection('users').findOne({ _id: toObjectId(decoded.userId) });
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      if (resource === 'users' && req.method === 'GET') {
        try {
          const users = await db.collection('users').find({}).toArray();
          const userList = users.map(user => ({
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            chessRating: user.chessRating || 1200,
            gamesPlayed: user.gamesPlayed || 0,
            gamesWon: user.gamesWon || 0,
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0,
            role: user.role || 'user',
            isActive: user.isActive !== false,
            createdAt: user.createdAt
          }));

          return res.status(200).json({ success: true, users: userList });
        } catch (error) {
          console.error('Error fetching users:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch users' });
        }
      }

      if (resource === 'users' && req.method === 'PUT') {
        const { userId, updates } = req.body;
        
        try {
          // Remove sensitive fields
          delete updates.password;
          delete updates._id;
          
          await db.collection('users').updateOne(
            { _id: toObjectId(userId) },
            { $set: { ...updates, updatedAt: new Date() } }
          );

          return res.status(200).json({ success: true, message: 'User updated successfully' });
        } catch (error) {
          console.error('Error updating user:', error);
          return res.status(500).json({ success: false, message: 'Failed to update user' });
        }
      }

      if (resource === 'users' && req.method === 'DELETE') {
        const { userId } = req.body;
        
        if (userId === decoded.userId) {
          return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }

        try {
          await db.collection('users').deleteOne({ _id: toObjectId(userId) });

          return res.status(200).json({ success: true, message: 'User deleted successfully' });
        } catch (error) {
          console.error('Error deleting user:', error);
          return res.status(500).json({ success: false, message: 'Failed to delete user' });
        }
      }

      if (resource === 'games' && req.method === 'GET') {
        try {
          const games = await db.collection('game_sessions').find({
            status: 'completed'
          }).toArray();

          // Populate player data safely
          const gamesWithPlayers = [];
          for (const game of games) {
            try {
              const whitePlayer = await db.collection('users').findOne({ _id: toObjectId(game.whitePlayerId) });
              const blackPlayer = await db.collection('users').findOne({ _id: toObjectId(game.blackPlayerId) });

              if (whitePlayer && blackPlayer) {
                gamesWithPlayers.push({
                  id: game._id,
                  result: game.result || '1/2-1/2',
                  timeControl: `${Math.floor((game.timeControl || 600) / 60)} min`,
                  duration: game.endedAt && game.createdAt ? Math.floor((new Date(game.endedAt) - new Date(game.createdAt)) / 1000) : 0,
                  moves: (game.moves || []).length,
                  gameType: game.gameType || 'casual',
                  createdAt: game.createdAt,
                  endedAt: game.endedAt,
                  whitePlayer: {
                    id: whitePlayer._id,
                    username: whitePlayer.username,
                    rating: whitePlayer.chessRating || 1200
                  },
                  blackPlayer: {
                    id: blackPlayer._id,
                    username: blackPlayer.username,
                    rating: blackPlayer.chessRating || 1200
                  }
                });
              }
            } catch (error) {
              console.error('Error populating game data:', error);
            }
          }

          return res.status(200).json({ success: true, games: gamesWithPlayers });
        } catch (error) {
          console.error('Error fetching games:', error);
          return res.status(500).json({ success: false, message: 'Failed to fetch games' });
        }
      }
    }

    return res.status(404).json({ success: false, message: 'Endpoint not found' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}