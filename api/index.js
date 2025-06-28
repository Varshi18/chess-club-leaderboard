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

        const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
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

      if (req.method === 'GET' && req.query.gameId) {
        const { gameId } = req.query;
        
        const gameSession = await db.collection('game_sessions').findOne({ gameId });
        if (!gameSession) {
          return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        // Populate player data
        const whitePlayer = await db.collection('users').findOne({ _id: new ObjectId(gameSession.whitePlayerId) });
        const blackPlayer = await db.collection('users').findOne({ _id: new ObjectId(gameSession.blackPlayerId) });

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
      }

      if (req.method === 'GET' && action === 'sync') {
        const { gameId, lastVersion } = req.query;
        
        const gameSession = await db.collection('game_sessions').findOne({ gameId });
        if (!gameSession) {
          return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        const hasUpdates = gameSession.version > parseInt(lastVersion || 0);
        
        if (hasUpdates) {
          return res.status(200).json({ 
            success: true, 
            hasUpdates: true, 
            gameState: gameSession 
          });
        }

        return res.status(200).json({ success: true, hasUpdates: false });
      }

      if (req.method === 'PATCH' && action === 'move') {
        const { gameId, move, fen } = req.body;
        
        const gameSession = await db.collection('game_sessions').findOne({ gameId });
        if (!gameSession) {
          return res.status(404).json({ success: false, message: 'Game session not found' });
        }

        // Verify it's the player's turn
        const isWhitePlayer = gameSession.whitePlayerId === decoded.userId;
        const isBlackPlayer = gameSession.blackPlayerId === decoded.userId;
        
        if (!isWhitePlayer && !isBlackPlayer) {
          return res.status(403).json({ success: false, message: 'Not a player in this game' });
        }

        const currentTurn = gameSession.turn || 'w';
        const playerCanMove = (currentTurn === 'w' && isWhitePlayer) || (currentTurn === 'b' && isBlackPlayer);
        
        if (!playerCanMove) {
          return res.status(400).json({ success: false, message: 'Not your turn' });
        }

        // Update game state
        const newMoves = [...(gameSession.moves || []), move];
        const newTurn = currentTurn === 'w' ? 'b' : 'w';
        const newVersion = (gameSession.version || 0) + 1;

        // Update timers (subtract time from current player)
        const timeSpent = 5; // Assume 5 seconds per move for now
        const updatedTimeLeft = {
          whiteTimeLeft: currentTurn === 'w' 
            ? Math.max(0, (gameSession.whiteTimeLeft || gameSession.timeControl) - timeSpent)
            : (gameSession.whiteTimeLeft || gameSession.timeControl),
          blackTimeLeft: currentTurn === 'b' 
            ? Math.max(0, (gameSession.blackTimeLeft || gameSession.timeControl) - timeSpent)
            : (gameSession.blackTimeLeft || gameSession.timeControl)
        };

        await db.collection('game_sessions').updateOne(
          { gameId },
          {
            $set: {
              moves: newMoves,
              fen,
              turn: newTurn,
              version: newVersion,
              lastMoveBy: decoded.userId,
              lastMoveAt: new Date(),
              ...updatedTimeLeft
            }
          }
        );

        return res.status(200).json({ 
          success: true, 
          version: newVersion,
          turn: newTurn,
          message: 'Move recorded successfully' 
        });
      }

      if (req.method === 'PATCH' && action === 'end') {
        const { gameId, result, reason } = req.body;
        
        await db.collection('game_sessions').updateOne(
          { gameId },
          {
            $set: {
              status: 'completed',
              result,
              reason,
              endedAt: new Date()
            }
          }
        );

        return res.status(200).json({ success: true, message: 'Game ended successfully' });
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

        if (challengedUserId === decoded.userId) {
          return res.status(400).json({ success: false, message: 'Cannot challenge yourself' });
        }

        // Check if challenged user exists
        const challengedUser = await db.collection('users').findOne({ _id: new ObjectId(challengedUserId) });
        if (!challengedUser) {
          return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check for existing pending challenge
        const existingChallenge = await db.collection('challenges').findOne({
          challengerId: decoded.userId,
          challengedUserId,
          status: 'pending'
        });

        if (existingChallenge) {
          return res.status(400).json({ success: false, message: 'Challenge already sent' });
        }

        const challenge = {
          id: generateGameId(),
          challengerId: decoded.userId,
          challengedUserId,
          timeControl: parseInt(timeControl),
          status: 'pending',
          createdAt: new Date()
        };

        await db.collection('challenges').insertOne(challenge);

        return res.status(200).json({ success: true, message: 'Challenge sent successfully' });
      }

      if (req.method === 'GET' && action === 'received') {
        const challenges = await db.collection('challenges').aggregate([
          { $match: { challengedUserId: decoded.userId, status: 'pending' } },
          {
            $lookup: {
              from: 'users',
              let: { challengerId: { $toObjectId: '$challengerId' } },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$challengerId'] } } }
              ],
              as: 'challenger'
            }
          },
          { $unwind: '$challenger' },
          {
            $project: {
              id: '$id',
              timeControl: 1,
              status: 1,
              createdAt: 1,
              'challenger.id': '$challenger._id',
              'challenger.username': '$challenger.username',
              'challenger.chessRating': '$challenger.chessRating'
            }
          }
        ]).toArray();

        return res.status(200).json({ success: true, challenges });
      }

      if (req.method === 'GET' && action === 'sent') {
        const challenges = await db.collection('challenges').aggregate([
          { $match: { challengerId: decoded.userId } },
          {
            $lookup: {
              from: 'users',
              let: { challengedUserId: { $toObjectId: '$challengedUserId' } },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$challengedUserId'] } } }
              ],
              as: 'challenged'
            }
          },
          { $unwind: '$challenged' },
          {
            $project: {
              id: '$id',
              timeControl: 1,
              status: 1,
              gameId: 1,
              createdAt: 1,
              'challenged.id': '$challenged._id',
              'challenged.username': '$challenged.username',
              'challenged.chessRating': '$challenged.chessRating'
            }
          }
        ]).toArray();

        return res.status(200).json({ success: true, challenges });
      }

      if (req.method === 'PATCH' && action === 'respond') {
        const { challengeId, response } = req.body;

        const challenge = await db.collection('challenges').findOne({ 
          id: challengeId,
          challengedUserId: decoded.userId,
          status: 'pending'
        });

        if (!challenge) {
          return res.status(404).json({ success: false, message: 'Challenge not found' });
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
            turn: 'w',
            status: 'active',
            version: 0,
            createdAt: new Date()
          };

          await db.collection('game_sessions').insertOne(gameSession);

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

          return res.status(200).json({ 
            success: true, 
            message: 'Challenge accepted',
            gameId 
          });
        } else {
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
        }
      }

      if (req.method === 'DELETE' && action === 'cancel') {
        const { challengeId } = req.query;

        await db.collection('challenges').deleteOne({
          id: challengeId,
          challengerId: decoded.userId,
          status: 'pending'
        });

        return res.status(200).json({ success: true, message: 'Challenge cancelled' });
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
        const users = await db.collection('users').find({
          $or: [
            { username: { $regex: searchQuery, $options: 'i' } },
            { fullName: { $regex: searchQuery, $options: 'i' } }
          ],
          _id: { $ne: new ObjectId(decoded.userId) }
        }).limit(20).toArray();

        // Check friendship status for each user
        const userResults = await Promise.all(users.map(async (user) => {
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

          return {
            id: user._id.toString(),
            username: user.username,
            fullName: user.fullName,
            chessRating: user.chessRating || 1200,
            isFriend: !!friendship,
            friendRequestSent: !!friendRequest
          };
        }));

        return res.status(200).json({ success: true, users: userResults });
      }

      if (req.method === 'GET' && req.query.type === 'requests') {
        // Get friend requests
        const requests = await db.collection('friend_requests').aggregate([
          { $match: { receiverId: decoded.userId, status: 'pending' } },
          {
            $lookup: {
              from: 'users',
              let: { senderId: { $toObjectId: '$senderId' } },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$senderId'] } } }
              ],
              as: 'sender'
            }
          },
          { $unwind: '$sender' },
          {
            $project: {
              id: '$_id',
              'sender.id': '$sender._id',
              'sender.username': '$sender.username',
              'sender.chessRating': '$sender.chessRating'
            }
          }
        ]).toArray();

        return res.status(200).json({ success: true, requests });
      }

      if (req.method === 'GET') {
        // Get friends list
        const friendships = await db.collection('friendships').aggregate([
          { 
            $match: { 
              $or: [
                { user1Id: decoded.userId },
                { user2Id: decoded.userId }
              ]
            }
          },
          {
            $lookup: {
              from: 'users',
              let: { user1Id: { $toObjectId: '$user1Id' } },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$user1Id'] } } }
              ],
              as: 'user1'
            }
          },
          {
            $lookup: {
              from: 'users',
              let: { user2Id: { $toObjectId: '$user2Id' } },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$user2Id'] } } }
              ],
              as: 'user2'
            }
          },
          { $unwind: '$user1' },
          { $unwind: '$user2' }
        ]).toArray();

        const friends = friendships.map(friendship => {
          const friend = friendship.user1Id === decoded.userId ? friendship.user2 : friendship.user1;
          return {
            id: friend._id.toString(),
            username: friend.username,
            chessRating: friend.chessRating || 1200,
            lastSeen: friend.lastSeen
          };
        });

        return res.status(200).json({ success: true, friends });
      }

      if (req.method === 'POST') {
        // Send friend request
        const { userId } = req.body;

        if (userId === decoded.userId) {
          return res.status(400).json({ success: false, message: 'Cannot add yourself as friend' });
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
      }

      if (req.method === 'PATCH') {
        // Accept/reject friend request
        const { requestId, action } = req.body;

        const request = await db.collection('friend_requests').findOne({
          _id: new ObjectId(requestId),
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
            { _id: new ObjectId(requestId) },
            { $set: { status: 'accepted', respondedAt: new Date() } }
          );

          return res.status(200).json({ success: true, message: 'Friend request accepted' });
        } else {
          // Reject request
          await db.collection('friend_requests').updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: 'rejected', respondedAt: new Date() } }
          );

          return res.status(200).json({ success: true, message: 'Friend request rejected' });
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
        const tournaments = await db.collection('tournaments').aggregate([
          {
            $lookup: {
              from: 'users',
              let: { participantIds: '$participants' },
              pipeline: [
                { $match: { $expr: { $in: [{ $toString: '$_id' }, '$$participantIds'] } } }
              ],
              as: 'participantUsers'
            }
          },
          {
            $addFields: {
              participants: {
                $map: {
                  input: '$participantUsers',
                  as: 'user',
                  in: {
                    userId: { $toString: '$$user._id' },
                    username: '$$user.username',
                    rating: '$$user.chessRating'
                  }
                }
              }
            }
          },
          {
            $project: {
              participantUsers: 0
            }
          },
          { $sort: { startTime: 1 } }
        ]).toArray();

        return res.status(200).json({ success: true, tournaments });
      }

      if (req.method === 'POST') {
        // Create tournament (admin only)
        const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
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

        const tournament = {
          id: generateGameId(),
          name,
          description: description || '',
          format,
          timeControl,
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
      }

      if (req.method === 'POST' && action === 'join') {
        // Join tournament
        const { tournamentId } = req.query;

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
      }

      if (req.method === 'PUT') {
        // Update tournament (admin only)
        const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { tournamentId } = req.query;
        const updates = req.body;

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
      }

      if (req.method === 'DELETE') {
        // Delete tournament (admin only)
        const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
        if (!user || user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Admin access required' });
        }

        const { tournamentId } = req.query;

        await db.collection('tournaments').deleteOne({ id: tournamentId });

        return res.status(200).json({ success: true, message: 'Tournament deleted successfully' });
      }
    }

    // Admin endpoints
    if (endpoint === 'admin') {
      const decoded = verifyToken(req);
      if (!decoded) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      if (resource === 'users' && req.method === 'GET') {
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
      }

      if (resource === 'users' && req.method === 'PUT') {
        const { userId, updates } = req.body;
        
        // Remove sensitive fields
        delete updates.password;
        delete updates._id;
        
        await db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { ...updates, updatedAt: new Date() } }
        );

        return res.status(200).json({ success: true, message: 'User updated successfully' });
      }

      if (resource === 'users' && req.method === 'DELETE') {
        const { userId } = req.body;
        
        if (userId === decoded.userId) {
          return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }

        await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

        return res.status(200).json({ success: true, message: 'User deleted successfully' });
      }

      if (resource === 'games' && req.method === 'GET') {
        const games = await db.collection('game_sessions').aggregate([
          { $match: { status: 'completed' } },
          {
            $lookup: {
              from: 'users',
              localField: 'whitePlayerId',
              foreignField: '_id',
              as: 'whitePlayer'
            }
          },
          {
            $lookup: {
              from: 'users',
              localField: 'blackPlayerId',
              foreignField: '_id',
              as: 'blackPlayer'
            }
          },
          { $unwind: '$whitePlayer' },
          { $unwind: '$blackPlayer' },
          {
            $project: {
              id: '$_id',
              result: 1,
              timeControl: { $concat: [{ $toString: { $divide: ['$timeControl', 60] } }, ' min'] },
              duration: { $subtract: ['$endedAt', '$createdAt'] },
              moves: { $size: '$moves' },
              gameType: { $ifNull: ['$gameType', 'casual'] },
              createdAt: 1,
              endedAt: 1,
              'whitePlayer.id': '$whitePlayer._id',
              'whitePlayer.username': '$whitePlayer.username',
              'whitePlayer.rating': '$whitePlayer.chessRating',
              'blackPlayer.id': '$blackPlayer._id',
              'blackPlayer.username': '$blackPlayer.username',
              'blackPlayer.rating': '$blackPlayer.chessRating'
            }
          },
          { $sort: { createdAt: -1 } }
        ]).toArray();

        const gameList = games.map(game => ({
          ...game,
          duration: Math.floor((game.duration || 0) / 1000) // Convert to seconds
        }));

        return res.status(200).json({ success: true, games: gameList });
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