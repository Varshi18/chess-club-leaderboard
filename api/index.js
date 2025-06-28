// Consolidated API endpoint for Vercel
import clientPromise from './lib/mongodb.js';
import { verifyToken, hashPassword, comparePassword, generateToken, getUserStats } from './lib/auth.js';
import { ObjectId } from 'mongodb';

// Helper function to validate ObjectId
const isValidObjectId = (id) => {
  try {
    return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
  } catch {
    return false;
  }
};

// Helper function to generate PGN from moves array
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
  
  if (moves && Array.isArray(moves) && moves.length > 0) {
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle OPTIONS preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { endpoint, resource, action } = req.query;

    // Health check
    if (endpoint === 'health') {
      return res.json({ 
        message: 'Server is running!',
        timestamp: new Date().toISOString()
      });
    }

    // Auth endpoints
    if (endpoint === 'auth') {
      if (action === 'login') {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, message: 'Method not allowed' });
        }

        const { email, password } = req.body;
        if (!email || !password) {
          return res.status(400).json({ success: false, message: 'Email and password are required' });
        }

        const client = await clientPromise;
        const db = client.db('chess-club');
        const users = db.collection('users');

        const user = await users.findOne({ email: email.toLowerCase() });
        if (!user) {
          return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        await users.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
        const token = generateToken(user._id.toString(), user.username);

        const userResponse = {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          chessRating: user.chessRating,
          role: user.role || 'user',
          stats: getUserStats(user)
        };

        return res.json({ success: true, message: 'Login successful', token, user: userResponse });
      }

      if (action === 'register') {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, message: 'Method not allowed' });
        }

        const { username, email, password, fullName } = req.body;
        if (!username || !email || !password || !fullName) {
          return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        if (username.length < 3) {
          return res.status(400).json({ success: false, message: 'Username must be at least 3 characters long' });
        }

        if (password.length < 6) {
          return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long' });
        }

        if (!/\S+@\S+\.\S+/.test(email)) {
          return res.status(400).json({ success: false, message: 'Please enter a valid email' });
        }

        const client = await clientPromise;
        const db = client.db('chess-club');
        const users = db.collection('users');

        const existingUser = await users.findOne({
          $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
        });

        if (existingUser) {
          return res.status(400).json({
            success: false,
            message: existingUser.email === email.toLowerCase() ? 'Email already registered' : 'Username already taken'
          });
        }

        const hashedPassword = await hashPassword(password);
        const newUser = {
          username,
          email: email.toLowerCase(),
          password: hashedPassword,
          fullName,
          chessRating: 1200,
          gamesPlayed: 0,
          gamesWon: 0,
          isActive: true,
          createdAt: new Date(),
          lastLogin: new Date(),
          role: email === "your-admin-email@example.com" ? "admin" : "user"
        };

        const result = await users.insertOne(newUser);
        const userId = result.insertedId.toString();
        const token = generateToken(userId, username);

        const userResponse = {
          id: userId,
          username: newUser.username,
          email: newUser.email,
          fullName: newUser.fullName,
          chessRating: newUser.chessRating,
          role: newUser.role,
          stats: getUserStats(newUser)
        };

        return res.status(201).json({ success: true, message: 'Registration successful', token, user: userResponse });
      }

      if (action === 'me') {
        if (req.method !== 'GET') {
          return res.status(405).json({ success: false, message: 'Method not allowed' });
        }

        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
          return res.status(401).json({ success: false, message: 'Access token required' });
        }

        const decoded = verifyToken(token);
        if (!decoded) {
          return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }

        const client = await clientPromise;
        const db = client.db('chess-club');
        const users = db.collection('users');

        const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userResponse = {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          fullName: user.fullName,
          chessRating: user.chessRating,
          role: user.role || 'user',
          stats: getUserStats(user)
        };

        return res.json({ success: true, user: userResponse });
      }
    }

    // Friends endpoints
    if (endpoint === 'friends') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }

      const client = await clientPromise;
      const db = client.db('chess-club');
      const users = db.collection('users');
      const friendships = db.collection('friendships');
      const userId = new ObjectId(decoded.userId);

      if (req.method === 'GET') {
        const { q, type } = req.query;

        if (type === 'requests') {
          // Get pending friend requests sent TO this user
          const pendingRequests = await friendships.find({
            friendId: userId,
            status: 'pending',
          }).toArray();

          const senderIds = pendingRequests.map(r => r.userId);
          const senders = await users.find({ _id: { $in: senderIds } })
            .project({ password: 0 })
            .toArray();

          const sendersMap = Object.fromEntries(senders.map(u => [u._id.toString(), u]));
          const formatted = pendingRequests.map(req => ({
            id: req._id.toString(),
            sender: {
              id: req.userId.toString(),
              username: sendersMap[req.userId.toString()]?.username || 'Unknown',
              chessRating: sendersMap[req.userId.toString()]?.chessRating || 1200,
            },
            createdAt: req.createdAt,
          }));

          return res.json({ success: true, requests: formatted });
        }

        if (q && q.length >= 2) {
          // Search for users
          const results = await users.find({
            username: { $regex: q.trim(), $options: 'i' },
            _id: { $ne: userId },
          }).project({ password: 0 }).limit(10).toArray();

          const ids = results.map(u => u._id);

          // Check existing friendships/requests
          const existing = await friendships.find({
            $or: [
              { userId, friendId: { $in: ids } },
              { userId: { $in: ids }, friendId: userId },
            ],
          }).toArray();

          const sent = new Set();
          const accepted = new Set();
          
          existing.forEach(f => {
            const otherId = f.userId.toString() === decoded.userId ? f.friendId.toString() : f.userId.toString();
            if (f.status === 'pending' && f.userId.toString() === decoded.userId) {
              sent.add(otherId);
            }
            if (f.status === 'accepted') {
              accepted.add(otherId);
            }
          });

          const resultData = results.map(user => ({
            id: user._id.toString(),
            username: user.username,
            chessRating: user.chessRating || 1200,
            friendRequestSent: sent.has(user._id.toString()),
            isFriend: accepted.has(user._id.toString()),
          }));

          return res.json({ success: true, users: resultData });
        }

        // Get friends list
        const friendsList = await friendships.find({
          $or: [
            { userId, status: 'accepted' },
            { friendId: userId, status: 'accepted' },
          ]
        }).toArray();

        const friendIds = friendsList.map(f =>
          f.userId.toString() === decoded.userId ? f.friendId : f.userId
        );

        const friends = await users.find({ _id: { $in: friendIds } })
          .project({ password: 0 }).toArray();

        const formattedFriends = friends.map(f => ({
          id: f._id.toString(),
          username: f.username,
          chessRating: f.chessRating || 1200,
          lastSeen: f.lastLogin || f.createdAt,
        }));

        return res.json({ success: true, friends: formattedFriends });
      }

      if (req.method === 'POST') {
        // Send friend request
        const { userId: targetId } = req.body;
        
        if (!targetId || targetId === decoded.userId) {
          return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        // Check if target user exists
        const targetUser = await users.findOne({ _id: new ObjectId(targetId) });
        if (!targetUser) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if friendship already exists
        const existing = await friendships.findOne({
          $or: [
            { userId, friendId: new ObjectId(targetId) },
            { userId: new ObjectId(targetId), friendId: userId },
          ]
        });

        if (existing) {
          if (existing.status === 'accepted') {
            return res.status(400).json({ success: false, message: 'Already friends' });
          } else {
            return res.status(400).json({ success: false, message: 'Friend request already sent' });
          }
        }

        // Create friend request
        await friendships.insertOne({
          userId,
          friendId: new ObjectId(targetId),
          status: 'pending',
          createdAt: new Date(),
        });

        return res.json({ success: true, message: 'Friend request sent' });
      }

      if (req.method === 'PATCH') {
        // Accept or reject friend request
        const { requestId, action } = req.body;
        
        if (!requestId || !['accept', 'reject'].includes(action)) {
          return res.status(400).json({ success: false, message: 'Invalid request' });
        }

        if (action === 'accept') {
          const result = await friendships.updateOne(
            { 
              _id: new ObjectId(requestId), 
              friendId: userId, 
              status: 'pending' 
            },
            { $set: { status: 'accepted', updatedAt: new Date() } }
          );
          
          if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Request not found or already processed' });
          }
          
          return res.json({ success: true, message: 'Friend request accepted' });
        }

        if (action === 'reject') {
          const result = await friendships.deleteOne({
            _id: new ObjectId(requestId),
            friendId: userId,
            status: 'pending',
          });
          
          if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Request not found' });
          }
          
          return res.json({ success: true, message: 'Friend request rejected' });
        }
      }

      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    // Game challenges and multiplayer
    if (endpoint === 'challenges') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }

      const client = await clientPromise;
      const db = client.db('chess-club');
      const challenges = db.collection('challenges');
      const users = db.collection('users');

      if (req.method === 'POST' && action === 'send') {
        const { challengedUserId, timeControl } = req.body;
        
        if (!challengedUserId || !timeControl) {
          return res.status(400).json({ success: false, message: 'Challenged user ID and time control are required' });
        }

        if (challengedUserId === decoded.userId) {
          return res.status(400).json({ success: false, message: 'Cannot challenge yourself' });
        }

        // Check if challenged user exists
        const challengedUser = await users.findOne({ _id: new ObjectId(challengedUserId) });
        if (!challengedUser) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check for existing pending challenge
        const existingChallenge = await challenges.findOne({
          $or: [
            { challengerId: new ObjectId(decoded.userId), challengedId: new ObjectId(challengedUserId), status: 'pending' },
            { challengerId: new ObjectId(challengedUserId), challengedId: new ObjectId(decoded.userId), status: 'pending' }
          ]
        });

        if (existingChallenge) {
          return res.status(400).json({ success: false, message: 'Challenge already pending' });
        }

        const challengeId = new ObjectId();
        await challenges.insertOne({
          _id: challengeId,
          challengerId: new ObjectId(decoded.userId),
          challengedId: new ObjectId(challengedUserId),
          timeControl: parseInt(timeControl),
          status: 'pending',
          createdAt: new Date(),
        });

        return res.json({ 
          success: true, 
          message: 'Challenge sent',
          challengeId: challengeId.toString()
        });
      }

      if (req.method === 'GET' && action === 'received') {
        // Get challenges received by this user
        const receivedChallenges = await challenges.find({
          challengedId: new ObjectId(decoded.userId),
          status: 'pending'
        }).toArray();

        const challengerIds = receivedChallenges.map(c => c.challengerId);
        const challengers = await users.find({ _id: { $in: challengerIds } })
          .project({ password: 0 })
          .toArray();

        const challengersMap = Object.fromEntries(challengers.map(u => [u._id.toString(), u]));
        
        const formattedChallenges = receivedChallenges.map(challenge => ({
          id: challenge._id.toString(),
          challenger: {
            id: challenge.challengerId.toString(),
            username: challengersMap[challenge.challengerId.toString()]?.username || 'Unknown',
            chessRating: challengersMap[challenge.challengerId.toString()]?.chessRating || 1200,
          },
          timeControl: challenge.timeControl,
          createdAt: challenge.createdAt,
        }));

        return res.json({ success: true, challenges: formattedChallenges });
      }

      if (req.method === 'GET' && action === 'sent') {
        // Get challenges sent by this user
        const sentChallenges = await challenges.find({
          challengerId: new ObjectId(decoded.userId),
          status: { $in: ['pending', 'accepted'] }
        }).toArray();

        const challengedIds = sentChallenges.map(c => c.challengedId);
        const challengedUsers = await users.find({ _id: { $in: challengedIds } })
          .project({ password: 0 })
          .toArray();

        const challengedMap = Object.fromEntries(challengedUsers.map(u => [u._id.toString(), u]));
        
        const formattedChallenges = sentChallenges.map(challenge => ({
          id: challenge._id.toString(),
          challenged: {
            id: challenge.challengedId.toString(),
            username: challengedMap[challenge.challengedId.toString()]?.username || 'Unknown',
            chessRating: challengedMap[challenge.challengedId.toString()]?.chessRating || 1200,
          },
          timeControl: challenge.timeControl,
          status: challenge.status,
          gameId: challenge.gameId ? challenge.gameId.toString() : null,
          createdAt: challenge.createdAt,
        }));

        return res.json({ success: true, challenges: formattedChallenges });
      }

      if (req.method === 'DELETE' && action === 'cancel') {
        const { challengeId } = req.query;
        
        if (!challengeId) {
          return res.status(400).json({ success: false, message: 'Challenge ID is required' });
        }

        const result = await challenges.deleteOne({
          _id: new ObjectId(challengeId),
          challengerId: new ObjectId(decoded.userId),
          status: 'pending'
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ success: false, message: 'Challenge not found or cannot be cancelled' });
        }

        return res.json({ success: true, message: 'Challenge cancelled' });
      }

      if (req.method === 'PATCH' && action === 'respond') {
        const { challengeId, response } = req.body;
        
        if (!challengeId || !['accept', 'decline'].includes(response)) {
          return res.status(400).json({ success: false, message: 'Invalid challenge response' });
        }

        const challenge = await challenges.findOne({
          _id: new ObjectId(challengeId),
          challengedId: new ObjectId(decoded.userId),
          status: 'pending'
        });

        if (!challenge) {
          return res.status(404).json({ success: false, message: 'Challenge not found' });
        }

        if (response === 'accept') {
          // Create game session in database with proper server-side state
          const gameId = new ObjectId();
          
          // Randomly assign colors (50/50 chance)
          const challengerIsWhite = Math.random() < 0.5;
          const whitePlayerId = challengerIsWhite ? challenge.challengerId : challenge.challengedId;
          const blackPlayerId = challengerIsWhite ? challenge.challengedId : challenge.challengerId;
          
          const gameSession = {
            _id: gameId,
            whitePlayerId: whitePlayerId,
            blackPlayerId: blackPlayerId,
            timeControl: challenge.timeControl,
            status: 'active',
            moves: [],
            pgn: '',
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            turn: 'w', // Always starts with white
            version: 1,
            whiteTimeLeft: challenge.timeControl,
            blackTimeLeft: challenge.timeControl,
            lastMoveTime: new Date(),
            gameStartTime: new Date(),
            createdAt: new Date(),
            challengeId: challenge._id,
            lastUpdate: new Date(),
            lastMoveBy: null
          };

          await db.collection('gameSessions').insertOne(gameSession);
          await challenges.updateOne(
            { _id: challenge._id },
            { $set: { status: 'accepted', gameId: gameId, updatedAt: new Date() } }
          );

          return res.json({ 
            success: true, 
            message: 'Challenge accepted',
            gameId: gameId.toString(),
            whitePlayerId: whitePlayerId.toString(),
            blackPlayerId: blackPlayerId.toString()
          });
        } else {
          await challenges.updateOne(
            { _id: challenge._id },
            { $set: { status: 'declined', updatedAt: new Date() } }
          );

          return res.json({ success: true, message: 'Challenge declined' });
        }
      }

      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    // Game sessions for multiplayer - COMPLETE SERVER-SIDE MANAGEMENT
    if (endpoint === 'game-sessions') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }

      const client = await clientPromise;
      const db = client.db('chess-club');
      const gameSessions = db.collection('gameSessions');
      const users = db.collection('users');

      if (req.method === 'GET' && !action) {
        const { gameId } = req.query;
        
        if (!gameId) {
          return res.status(400).json({ success: false, message: 'Game ID required' });
        }

        const gameSession = await gameSessions.findOne({ _id: new ObjectId(gameId) });
        if (!gameSession) {
          return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        // Check if user is part of this game
        const isPlayer = gameSession.whitePlayerId.toString() === decoded.userId || 
                        gameSession.blackPlayerId.toString() === decoded.userId;
        
        if (!isPlayer) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Get player information
        const [whitePlayer, blackPlayer] = await Promise.all([
          users.findOne({ _id: gameSession.whitePlayerId }, { projection: { username: 1, chessRating: 1 } }),
          users.findOne({ _id: gameSession.blackPlayerId }, { projection: { username: 1, chessRating: 1 } })
        ]);

        // Update timers based on elapsed time
        const now = new Date();
        let updatedWhiteTime = gameSession.whiteTimeLeft;
        let updatedBlackTime = gameSession.blackTimeLeft;
        
        if (gameSession.status === 'active' && gameSession.lastMoveTime) {
          const elapsedSeconds = Math.floor((now - new Date(gameSession.lastMoveTime)) / 1000);
          
          if (gameSession.turn === 'w') {
            updatedWhiteTime = Math.max(0, gameSession.whiteTimeLeft - elapsedSeconds);
          } else {
            updatedBlackTime = Math.max(0, gameSession.blackTimeLeft - elapsedSeconds);
          }
          
          // Check for timeout
          if (updatedWhiteTime <= 0 || updatedBlackTime <= 0) {
            const winner = updatedWhiteTime <= 0 ? 'black' : 'white';
            const result = winner === 'white' ? '1-0' : '0-1';
            
            await gameSessions.updateOne(
              { _id: new ObjectId(gameId) },
              { 
                $set: { 
                  status: 'completed',
                  result: result,
                  reason: 'timeout',
                  endedAt: now,
                  whiteTimeLeft: updatedWhiteTime,
                  blackTimeLeft: updatedBlackTime,
                  lastUpdate: now
                }
              }
            );
            
            gameSession.status = 'completed';
            gameSession.result = result;
            gameSession.reason = 'timeout';
          } else {
            // Update timers in database
            await gameSessions.updateOne(
              { _id: new ObjectId(gameId) },
              { 
                $set: { 
                  whiteTimeLeft: updatedWhiteTime,
                  blackTimeLeft: updatedBlackTime,
                  lastUpdate: now
                }
              }
            );
          }
        }

        const gameData = {
          ...gameSession,
          id: gameSession._id.toString(),
          whiteTimeLeft: updatedWhiteTime,
          blackTimeLeft: updatedBlackTime,
          whitePlayer: {
            id: gameSession.whitePlayerId.toString(),
            username: whitePlayer?.username || 'Unknown',
            chessRating: whitePlayer?.chessRating || 1200
          },
          blackPlayer: {
            id: gameSession.blackPlayerId.toString(),
            username: blackPlayer?.username || 'Unknown',
            chessRating: blackPlayer?.chessRating || 1200
          }
        };

        return res.json({ success: true, gameSession: gameData });
      }

      if (req.method === 'PATCH' && action === 'move') {
        const { gameId, move, fen } = req.body;
        
        if (!gameId || !move || !fen) {
          return res.status(400).json({ success: false, message: 'Game ID, move, and FEN are required' });
        }

        const gameSession = await gameSessions.findOne({ _id: new ObjectId(gameId) });
        if (!gameSession) {
          return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        // Check if user is part of this game
        const isPlayer = gameSession.whitePlayerId.toString() === decoded.userId || 
                        gameSession.blackPlayerId.toString() === decoded.userId;
        
        if (!isPlayer) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Check if it's the player's turn
        const currentTurn = gameSession.turn;
        const isWhitePlayer = gameSession.whitePlayerId.toString() === decoded.userId;
        const isPlayerTurn = (currentTurn === 'w' && isWhitePlayer) || (currentTurn === 'b' && !isWhitePlayer);
        
        if (!isPlayerTurn) {
          return res.status(400).json({ success: false, message: 'Not your turn' });
        }

        // Check game is still active
        if (gameSession.status !== 'active') {
          return res.status(400).json({ success: false, message: 'Game is not active' });
        }

        // Update timers before processing move
        const now = new Date();
        const elapsedSeconds = Math.floor((now - new Date(gameSession.lastMoveTime || gameSession.gameStartTime)) / 1000);
        
        let updatedWhiteTime = gameSession.whiteTimeLeft;
        let updatedBlackTime = gameSession.blackTimeLeft;
        
        if (currentTurn === 'w') {
          updatedWhiteTime = Math.max(0, gameSession.whiteTimeLeft - elapsedSeconds);
        } else {
          updatedBlackTime = Math.max(0, gameSession.blackTimeLeft - elapsedSeconds);
        }
        
        // Check for timeout
        if (updatedWhiteTime <= 0 || updatedBlackTime <= 0) {
          const winner = updatedWhiteTime <= 0 ? 'black' : 'white';
          const result = winner === 'white' ? '1-0' : '0-1';
          
          await gameSessions.updateOne(
            { _id: new ObjectId(gameId) },
            { 
              $set: { 
                status: 'completed',
                result: result,
                reason: 'timeout',
                endedAt: now,
                whiteTimeLeft: updatedWhiteTime,
                blackTimeLeft: updatedBlackTime,
                lastUpdate: now
              }
            }
          );
          
          return res.status(400).json({ success: false, message: 'Time expired' });
        }

        // Process the move
        const updatedMoves = [...(gameSession.moves || []), move];
        const nextTurn = currentTurn === 'w' ? 'b' : 'w';
        const newVersion = (gameSession.version || 0) + 1;
        
        // Generate PGN
        let pgn = '';
        for (let i = 0; i < updatedMoves.length; i += 2) {
          const moveNumber = Math.floor(i / 2) + 1;
          pgn += `${moveNumber}. ${updatedMoves[i]}`;
          if (updatedMoves[i + 1]) {
            pgn += ` ${updatedMoves[i + 1]}`;
          }
          pgn += ' ';
        }
        
        // Update game state with atomic operation
        const updateResult = await gameSessions.updateOne(
          { 
            _id: new ObjectId(gameId),
            version: gameSession.version, // Optimistic locking
            status: 'active' // Ensure game is still active
          },
          { 
            $set: { 
              moves: updatedMoves,
              fen: fen,
              turn: nextTurn,
              pgn: pgn.trim(),
              version: newVersion,
              whiteTimeLeft: updatedWhiteTime,
              blackTimeLeft: updatedBlackTime,
              lastMoveTime: now,
              lastUpdate: now,
              lastMoveBy: decoded.userId
            }
          }
        );

        if (updateResult.modifiedCount === 0) {
          return res.status(409).json({ success: false, message: 'Game state conflict, please refresh' });
        }

        return res.json({ 
          success: true, 
          message: 'Move recorded',
          version: newVersion,
          moves: updatedMoves.length,
          turn: nextTurn,
          whiteTimeLeft: updatedWhiteTime,
          blackTimeLeft: updatedBlackTime
        });
      }

      if (req.method === 'PATCH' && action === 'end') {
        const { gameId, result, reason } = req.body;
        
        if (!gameId || !result) {
          return res.status(400).json({ success: false, message: 'Game ID and result are required' });
        }

        const gameSession = await gameSessions.findOne({ _id: new ObjectId(gameId) });
        if (!gameSession) {
          return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        // Check if user is part of this game
        const isPlayer = gameSession.whitePlayerId.toString() === decoded.userId || 
                        gameSession.blackPlayerId.toString() === decoded.userId;
        
        if (!isPlayer) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // End the game session
        await gameSessions.updateOne(
          { _id: new ObjectId(gameId) },
          { 
            $set: { 
              status: 'completed',
              result,
              reason: reason || 'game_end',
              endedAt: new Date(),
              lastUpdate: new Date()
            }
          }
        );

        return res.json({ success: true, message: 'Game ended' });
      }

      // Real-time sync endpoint with server-side timer management
      if (req.method === 'GET' && action === 'sync') {
        const { gameId, lastVersion } = req.query;
        
        if (!gameId) {
          return res.status(400).json({ success: false, message: 'Game ID required' });
        }

        const gameSession = await gameSessions.findOne({ _id: new ObjectId(gameId) });
        if (!gameSession) {
          return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        // Check if user is part of this game
        const isPlayer = gameSession.whitePlayerId.toString() === decoded.userId || 
                        gameSession.blackPlayerId.toString() === decoded.userId;
        
        if (!isPlayer) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        // Update timers based on elapsed time
        const now = new Date();
        let updatedWhiteTime = gameSession.whiteTimeLeft;
        let updatedBlackTime = gameSession.blackTimeLeft;
        let gameStatus = gameSession.status;
        let gameResult = gameSession.result;
        
        if (gameSession.status === 'active' && gameSession.lastMoveTime) {
          const elapsedSeconds = Math.floor((now - new Date(gameSession.lastMoveTime)) / 1000);
          
          if (gameSession.turn === 'w') {
            updatedWhiteTime = Math.max(0, gameSession.whiteTimeLeft - elapsedSeconds);
          } else {
            updatedBlackTime = Math.max(0, gameSession.blackTimeLeft - elapsedSeconds);
          }
          
          // Check for timeout
          if (updatedWhiteTime <= 0 || updatedBlackTime <= 0) {
            const winner = updatedWhiteTime <= 0 ? 'black' : 'white';
            gameResult = winner === 'white' ? '1-0' : '0-1';
            gameStatus = 'completed';
            
            await gameSessions.updateOne(
              { _id: new ObjectId(gameId) },
              { 
                $set: { 
                  status: 'completed',
                  result: gameResult,
                  reason: 'timeout',
                  endedAt: now,
                  whiteTimeLeft: updatedWhiteTime,
                  blackTimeLeft: updatedBlackTime,
                  lastUpdate: now
                }
              }
            );
          } else {
            // Update timers in database
            await gameSessions.updateOne(
              { _id: new ObjectId(gameId) },
              { 
                $set: { 
                  whiteTimeLeft: updatedWhiteTime,
                  blackTimeLeft: updatedBlackTime,
                  lastUpdate: now
                }
              }
            );
          }
        }

        const clientVersion = parseInt(lastVersion) || 0;
        const serverVersion = gameSession.version || 0;

        // Always return current state for real-time updates
        return res.json({
          success: true,
          hasUpdates: true, // Always send updates for real-time sync
          gameState: {
            moves: gameSession.moves || [],
            fen: gameSession.fen,
            turn: gameSession.turn,
            version: serverVersion,
            lastUpdate: now,
            lastMoveBy: gameSession.lastMoveBy,
            status: gameStatus,
            result: gameResult,
            reason: gameSession.reason,
            pgn: gameSession.pgn || '',
            whiteTimeLeft: updatedWhiteTime,
            blackTimeLeft: updatedBlackTime,
            whitePlayerId: gameSession.whitePlayerId.toString(),
            blackPlayerId: gameSession.blackPlayerId.toString()
          }
        });
      }

      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    // Games and PGN endpoints
    if (endpoint === 'games') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }

      const client = await clientPromise;
      const db = client.db('chess-club');
      const users = db.collection('users');
      const games = db.collection('games');

      if (resource === 'pgn') {
        if (req.method !== 'GET') {
          return res.status(405).json({ success: false, message: 'Method not allowed' });
        }

        const { gameId, download } = req.query;
        if (!gameId || !isValidObjectId(gameId)) {
          return res.status(400).json({ success: false, message: 'Valid game ID is required' });
        }

        const game = await games.findOne({ _id: new ObjectId(gameId) });
        if (!game) {
          return res.status(404).json({ success: false, message: 'Game not found' });
        }

        const currentUser = await users.findOne({ _id: new ObjectId(decoded.userId) });
        const isPlayer = game.whitePlayerId.toString() === decoded.userId ||
                        game.blackPlayerId.toString() === decoded.userId;
        const isAdmin = currentUser && currentUser.role === 'admin';

        if (!isPlayer && !isAdmin) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        if (download === 'true') {
          const [whitePlayer, blackPlayer] = await Promise.all([
            users.findOne({ _id: game.whitePlayerId }, { projection: { username: 1 } }),
            users.findOne({ _id: game.blackPlayerId }, { projection: { username: 1 } }),
          ]);

          const filename = `${whitePlayer?.username || "Unknown"}_vs_${blackPlayer?.username || "Unknown"}_${game.createdAt.toISOString().split("T")[0]}.pgn`;

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

      if (resource === 'record') {
        if (req.method !== 'POST') {
          return res.status(405).json({ success: false, message: 'Method not allowed' });
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
            whiteRatingChange = calculateRatingChange(whitePlayer.chessRating || 1200, blackPlayer.chessRating || 1200, "win");
            blackRatingChange = calculateRatingChange(blackPlayer.chessRating || 1200, whitePlayer.chessRating || 1200, "loss");
          } else if (result === "0-1") {
            whiteRatingChange = calculateRatingChange(whitePlayer.chessRating || 1200, blackPlayer.chessRating || 1200, "loss");
            blackRatingChange = calculateRatingChange(blackPlayer.chessRating || 1200, whitePlayer.chessRating || 1200, "win");
          } else if (result === "1/2-1/2") {
            whiteRatingChange = calculateRatingChange(whitePlayer.chessRating || 1200, blackPlayer.chessRating || 1200, "draw");
            blackRatingChange = calculateRatingChange(blackPlayer.chessRating || 1200, whitePlayer.chessRating || 1200, "draw");
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

        // Update player stats
        const whiteUpdates = {
          $inc: { gamesPlayed: 1, totalPlayTime: duration || 0 },
          $set: { lastGameAt: new Date() },
        };

        const blackUpdates = {
          $inc: { gamesPlayed: 1, totalPlayTime: duration || 0 },
          $set: { lastGameAt: new Date() },
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
        }

        await Promise.all([
          users.updateOne({ _id: new ObjectId(whitePlayerId) }, whiteUpdates),
          users.updateOne({ _id: new ObjectId(blackPlayerId) }, blackUpdates),
        ]);

        return res.json({
          success: true,
          message: "Game recorded successfully",
          gameId: gameResult.insertedId.toString(),
          pgn,
          ratingChanges: { white: whiteRatingChange, black: blackRatingChange },
        });
      }

      return res.status(400).json({ success: false, message: "Invalid resource" });
    }

    // Admin endpoints
    if (endpoint === 'admin') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required' });
      }

      const decoded = verifyToken(token);
      if (!decoded || !decoded.userId) {
        return res.status(403).json({ success: false, message: 'Invalid or expired token' });
      }

      const client = await clientPromise;
      const db = client.db('chess-club');
      const users = db.collection('users');

      // Check if user is admin
      const currentUser = await users.findOne({ _id: new ObjectId(decoded.userId) });
      if (!currentUser || currentUser.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      if (resource === 'users') {
        if (req.method === 'GET') {
          const { page = 1, limit = 20 } = req.query;
          const skip = (parseInt(page) - 1) * parseInt(limit);

          const [allUsers, totalCount] = await Promise.all([
            users.find({}).project({ password: 0 }).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).toArray(),
            users.countDocuments({}),
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
            winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin,
          }));

          return res.json({
            success: true,
            users: formattedUsers,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(totalCount / parseInt(limit)),
              totalUsers: totalCount,
            },
          });
        }

        if (req.method === 'PUT') {
          const { userId, updates } = req.body;
          if (!userId || !updates || !isValidObjectId(userId)) {
            return res.status(400).json({ success: false, message: 'Valid user ID and updates are required' });
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
            return res.status(404).json({ success: false, message: 'User not found or no changes made' });
          }

          return res.json({ success: true, message: 'User updated successfully' });
        }

        if (req.method === 'DELETE') {
          const { userId } = req.body;
          if (!userId || !isValidObjectId(userId)) {
            return res.status(400).json({ success: false, message: 'Valid user ID is required' });
          }

          if (userId === decoded.userId) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
          }

          const result = await users.deleteOne({ _id: new ObjectId(userId) });
          if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }

          return res.json({ success: true, message: 'User deleted successfully' });
        }
      }

      if (resource === 'games') {
        if (req.method === 'GET') {
          const games = db.collection('games');
          const { page = 1, limit = 20 } = req.query;
          const skip = (parseInt(page) - 1) * parseInt(limit);

          const [allGames, totalCount] = await Promise.all([
            games.find({}).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).toArray(),
            games.countDocuments({}),
          ]);

          const playerIds = [...new Set([...allGames.map((g) => g.whitePlayerId), ...allGames.map((g) => g.blackPlayerId)])];
          const players = await users.find({ _id: { $in: playerIds } }).project({ username: 1, chessRating: 1 }).toArray();
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
            moves: game.moveCount || 0,
            pgn: game.pgn,
            createdAt: game.createdAt,
            gameType: game.gameType || "casual",
            ratingChange: {
              white: game.whiteRatingChange || 0,
              black: game.blackRatingChange || 0,
            },
          }));

          return res.json({
            success: true,
            games: formattedGames,
            pagination: {
              currentPage: parseInt(page),
              totalPages: Math.ceil(totalCount / parseInt(limit)),
              totalGames: totalCount,
            },
          });
        }
      }

      return res.status(400).json({ success: false, message: 'Invalid admin resource' });
    }

    // Tournaments endpoint
    if (endpoint === 'tournaments') {
      if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
      }

      const client = await clientPromise;
      const db = client.db('chess-club');
      const tournaments = db.collection('tournaments');

      const tournamentList = await tournaments.find({}).sort({ createdAt: -1 }).toArray();
      const tournamentsWithParticipants = tournamentList.map(tournament => ({
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
        createdAt: tournament.createdAt
      }));

      return res.json({ success: true, tournaments: tournamentsWithParticipants });
    }

    return res.status(404).json({ success: false, message: 'Endpoint not found' });

  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}