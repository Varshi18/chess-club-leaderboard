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

// Helper function to verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Helper function to get user from token
async function getUserFromToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  if (!decoded) {
    return null;
  }
  
  const db = await connectToDatabase();
  const user = await db.collection('users').findOne({ _id: new ObjectId(decoded.userId) });
  return user;
}

// Helper function to calculate rating changes (simplified ELO)
function calculateRatingChange(playerRating, opponentRating, result) {
  const K = 32; // K-factor
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  
  let actualScore;
  if (result === 'win') actualScore = 1;
  else if (result === 'draw') actualScore = 0.5;
  else actualScore = 0;
  
  return Math.round(K * (actualScore - expectedScore));
}

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
      if (action === 'login' && req.method === 'POST') {
        const { email, password } = req.body;
        
        const user = await db.collection('users').findOne({ email });
        if (!user) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ userId: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        
        // Update last login
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { lastSeen: new Date() } }
        );
        
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ 
          success: true, 
          token, 
          user: userWithoutPassword,
          message: 'Login successful' 
        });
      }
      
      if (action === 'register' && req.method === 'POST') {
        const { username, email, password, fullName } = req.body;
        
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
        
        const hashedPassword = await bcrypt.hash(password, 12);
        
        const newUser = {
          username,
          email,
          password: hashedPassword,
          fullName,
          role: 'user',
          chessRating: 1200,
          gamesPlayed: 0,
          gamesWon: 0,
          gamesDrawn: 0,
          isActive: true,
          createdAt: new Date(),
          lastSeen: new Date()
        };
        
        const result = await db.collection('users').insertOne(newUser);
        const token = jwt.sign({ userId: result.insertedId, username }, JWT_SECRET, { expiresIn: '7d' });
        
        const { password: _, ...userWithoutPassword } = newUser;
        return res.json({ 
          success: true, 
          token, 
          user: { ...userWithoutPassword, _id: result.insertedId },
          message: 'Registration successful' 
        });
      }
      
      if (action === 'me' && req.method === 'GET') {
        const user = await getUserFromToken(req);
        if (!user) {
          return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        
        const { password: _, ...userWithoutPassword } = user;
        return res.json({ success: true, user: userWithoutPassword });
      }
    }

    // FIXED: Friends endpoints with proper error handling
    if (endpoint === 'friends') {
      const user = await getUserFromToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.method === 'GET') {
        const { q, type } = req.query;
        
        try {
          if (type === 'requests') {
            // Get friend requests - FIXED: Handle empty results gracefully
            const requests = await db.collection('friendRequests').find({
              receiverId: user._id,
              status: 'pending'
            }).toArray();
            
            if (requests.length === 0) {
              return res.json({ success: true, requests: [] });
            }
            
            const requestsWithSender = await Promise.all(
              requests.map(async (request) => {
                const sender = await db.collection('users').findOne({ _id: request.senderId });
                if (!sender) return null;
                return {
                  id: request._id,
                  sender: {
                    id: sender._id,
                    username: sender.username,
                    chessRating: sender.chessRating || 1200
                  }
                };
              })
            );
            
            const validRequests = requestsWithSender.filter(req => req !== null);
            return res.json({ success: true, requests: validRequests });
          }
          
          if (q) {
            // Search users - FIXED: Better search with error handling
            const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            const users = await db.collection('users').find({
              $or: [
                { username: { $regex: searchRegex } },
                { fullName: { $regex: searchRegex } }
              ],
              _id: { $ne: user._id }
            }).limit(20).toArray();
            
            // Check friendship status for each user
            const usersWithStatus = await Promise.all(
              users.map(async (searchUser) => {
                const friendship = await db.collection('friendships').findOne({
                  $or: [
                    { user1Id: user._id, user2Id: searchUser._id },
                    { user1Id: searchUser._id, user2Id: user._id }
                  ]
                });
                
                const pendingRequest = await db.collection('friendRequests').findOne({
                  senderId: user._id,
                  receiverId: searchUser._id,
                  status: 'pending'
                });
                
                return {
                  ...searchUser,
                  id: searchUser._id,
                  isFriend: !!friendship,
                  friendRequestSent: !!pendingRequest
                };
              })
            );
            
            return res.json({ success: true, users: usersWithStatus });
          }
          
          // Get friends list - FIXED: Handle empty friendships
          const friendships = await db.collection('friendships').find({
            $or: [{ user1Id: user._id }, { user2Id: user._id }]
          }).toArray();
          
          if (friendships.length === 0) {
            return res.json({ success: true, friends: [] });
          }
          
          const friendIds = friendships.map(f => 
            f.user1Id.equals(user._id) ? f.user2Id : f.user1Id
          );
          
          const friends = await db.collection('users').find({
            _id: { $in: friendIds }
          }).toArray();
          
          const friendsWithId = friends.map(friend => ({
            ...friend,
            id: friend._id
          }));
          
          return res.json({ success: true, friends: friendsWithId });
        } catch (error) {
          console.error('Friends GET error:', error);
          return res.json({ success: true, friends: [], requests: [], users: [] });
        }
      }
      
      if (req.method === 'POST') {
        try {
          // Send friend request
          const { userId } = req.body;
          
          if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
          }
          
          const targetUser = await db.collection('users').findOne({ _id: new ObjectId(userId) });
          if (!targetUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }
          
          const existingRequest = await db.collection('friendRequests').findOne({
            senderId: user._id,
            receiverId: new ObjectId(userId),
            status: 'pending'
          });
          
          if (existingRequest) {
            return res.status(400).json({ success: false, message: 'Friend request already sent' });
          }
          
          const existingFriendship = await db.collection('friendships').findOne({
            $or: [
              { user1Id: user._id, user2Id: new ObjectId(userId) },
              { user1Id: new ObjectId(userId), user2Id: user._id }
            ]
          });
          
          if (existingFriendship) {
            return res.status(400).json({ success: false, message: 'Already friends' });
          }
          
          await db.collection('friendRequests').insertOne({
            senderId: user._id,
            receiverId: new ObjectId(userId),
            status: 'pending',
            createdAt: new Date()
          });
          
          return res.json({ success: true, message: 'Friend request sent' });
        } catch (error) {
          console.error('Friend request error:', error);
          return res.status(500).json({ success: false, message: 'Failed to send friend request' });
        }
      }
      
      if (req.method === 'PATCH') {
        try {
          // Accept/reject friend request
          const { requestId, action } = req.body;
          
          if (!requestId || !action) {
            return res.status(400).json({ success: false, message: 'Request ID and action are required' });
          }
          
          const request = await db.collection('friendRequests').findOne({
            _id: new ObjectId(requestId),
            receiverId: user._id
          });
          
          if (!request) {
            return res.status(404).json({ success: false, message: 'Friend request not found' });
          }
          
          if (action === 'accept') {
            // Create friendship
            await db.collection('friendships').insertOne({
              user1Id: request.senderId,
              user2Id: user._id,
              createdAt: new Date()
            });
          }
          
          // Update request status
          await db.collection('friendRequests').updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: action === 'accept' ? 'accepted' : 'rejected' } }
          );
          
          return res.json({ success: true, message: `Friend request ${action}ed` });
        } catch (error) {
          console.error('Friend request response error:', error);
          return res.status(500).json({ success: false, message: 'Failed to respond to friend request' });
        }
      }
    }

    // FIXED: Challenges endpoints with comprehensive error handling
    if (endpoint === 'challenges') {
      const user = await getUserFromToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (action === 'send' && req.method === 'POST') {
        try {
          const { challengedUserId, timeControl } = req.body;
          
          if (!challengedUserId || !timeControl) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
          }
          
          const challengedUser = await db.collection('users').findOne({ _id: new ObjectId(challengedUserId) });
          if (!challengedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
          }
          
          // Check for existing pending challenge
          const existingChallenge = await db.collection('challenges').findOne({
            challengerId: user._id,
            challengedUserId: new ObjectId(challengedUserId),
            status: 'pending'
          });
          
          if (existingChallenge) {
            return res.status(400).json({ success: false, message: 'Challenge already sent' });
          }
          
          const challenge = {
            challengerId: user._id,
            challengedUserId: new ObjectId(challengedUserId),
            timeControl: parseInt(timeControl),
            status: 'pending',
            createdAt: new Date()
          };
          
          const result = await db.collection('challenges').insertOne(challenge);
          return res.json({ success: true, challengeId: result.insertedId });
        } catch (error) {
          console.error('Send challenge error:', error);
          return res.status(500).json({ success: false, message: 'Failed to send challenge' });
        }
      }
      
      if (action === 'received' && req.method === 'GET') {
        try {
          const challenges = await db.collection('challenges').find({
            challengedUserId: user._id,
            status: 'pending'
          }).toArray();
          
          if (challenges.length === 0) {
            return res.json({ success: true, challenges: [] });
          }
          
          const challengesWithChallenger = await Promise.all(
            challenges.map(async (challenge) => {
              const challenger = await db.collection('users').findOne({ _id: challenge.challengerId });
              if (!challenger) return null;
              return {
                id: challenge._id,
                challenger: {
                  id: challenger._id,
                  username: challenger.username,
                  chessRating: challenger.chessRating || 1200
                },
                timeControl: challenge.timeControl,
                createdAt: challenge.createdAt
              };
            })
          );
          
          const validChallenges = challengesWithChallenger.filter(c => c !== null);
          return res.json({ success: true, challenges: validChallenges });
        } catch (error) {
          console.error('Received challenges error:', error);
          return res.json({ success: true, challenges: [] });
        }
      }
      
      if (action === 'sent' && req.method === 'GET') {
        try {
          const challenges = await db.collection('challenges').find({
            challengerId: user._id,
            status: { $in: ['pending', 'accepted'] } // FIXED: Include accepted to detect when accepted
          }).toArray();
          
          if (challenges.length === 0) {
            return res.json({ success: true, challenges: [] });
          }
          
          const challengesWithChallenged = await Promise.all(
            challenges.map(async (challenge) => {
              const challenged = await db.collection('users').findOne({ _id: challenge.challengedUserId });
              if (!challenged) return null;
              return {
                id: challenge._id,
                challenged: {
                  id: challenged._id,
                  username: challenged.username,
                  chessRating: challenged.chessRating || 1200
                },
                timeControl: challenge.timeControl,
                status: challenge.status,
                gameId: challenge.gameId,
                createdAt: challenge.createdAt
              };
            })
          );
          
          const validChallenges = challengesWithChallenged.filter(c => c !== null);
          return res.json({ success: true, challenges: validChallenges });
        } catch (error) {
          console.error('Sent challenges error:', error);
          return res.json({ success: true, challenges: [] });
        }
      }
      
      if (action === 'respond' && req.method === 'PATCH') {
        try {
          const { challengeId, response } = req.body;
          
          if (!challengeId || !response) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
          }
          
          const challenge = await db.collection('challenges').findOne({
            _id: new ObjectId(challengeId),
            challengedUserId: user._id
          });
          
          if (!challenge) {
            return res.status(404).json({ success: false, message: 'Challenge not found' });
          }
          
          if (response === 'accept') {
            const gameId = new ObjectId();
            
            // FIXED: Determine colors randomly for fairness
            const isUserWhite = Math.random() < 0.5;
            const whitePlayerId = isUserWhite ? user._id : challenge.challengerId;
            const blackPlayerId = isUserWhite ? challenge.challengerId : user._id;
            
            // Create game session
            const gameSession = {
              _id: gameId,
              whitePlayerId: whitePlayerId,
              blackPlayerId: blackPlayerId,
              timeControl: challenge.timeControl,
              whiteTimeLeft: challenge.timeControl,
              blackTimeLeft: challenge.timeControl,
              turn: 'w',
              moves: [],
              fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
              status: 'active',
              version: 0,
              createdAt: new Date()
            };
            
            await db.collection('gameSessions').insertOne(gameSession);
            
            // Update challenge
            await db.collection('challenges').updateOne(
              { _id: new ObjectId(challengeId) },
              { 
                $set: { 
                  status: 'accepted',
                  gameId: gameId,
                  acceptedAt: new Date()
                }
              }
            );
            
            return res.json({ success: true, gameId: gameId.toString() });
          } else {
            // Decline challenge
            await db.collection('challenges').updateOne(
              { _id: new ObjectId(challengeId) },
              { $set: { status: 'declined' } }
            );
            
            return res.json({ success: true });
          }
        } catch (error) {
          console.error('Challenge response error:', error);
          return res.status(500).json({ success: false, message: 'Failed to respond to challenge' });
        }
      }
      
      if (action === 'complete' && req.method === 'PATCH') {
        try {
          const { challengeId } = req.body;
          
          if (!challengeId) {
            return res.status(400).json({ success: false, message: 'Challenge ID is required' });
          }
          
          await db.collection('challenges').updateOne(
            { _id: new ObjectId(challengeId) },
            { $set: { status: 'completed' } }
          );
          
          return res.json({ success: true });
        } catch (error) {
          console.error('Complete challenge error:', error);
          return res.status(500).json({ success: false, message: 'Failed to complete challenge' });
        }
      }
      
      if (action === 'cancel' && req.method === 'DELETE') {
        try {
          const { challengeId } = req.query;
          
          if (!challengeId) {
            return res.status(400).json({ success: false, message: 'Challenge ID is required' });
          }
          
          const result = await db.collection('challenges').deleteOne({
            _id: new ObjectId(challengeId),
            challengerId: user._id
          });
          
          if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Challenge not found' });
          }
          
          return res.json({ success: true });
        } catch (error) {
          console.error('Cancel challenge error:', error);
          return res.status(500).json({ success: false, message: 'Failed to cancel challenge' });
        }
      }
    }

    // Game sessions endpoints
    if (endpoint === 'game-sessions') {
      const user = await getUserFromToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (action === 'sync' && req.method === 'GET') {
        try {
          const { gameId, lastVersion } = req.query;
          
          const gameSession = await db.collection('gameSessions').findOne({
            _id: new ObjectId(gameId)
          });
          
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game not found' });
          }
          
          const hasUpdates = gameSession.version > parseInt(lastVersion || 0);
          
          if (hasUpdates) {
            // Get player info
            const [whitePlayer, blackPlayer] = await Promise.all([
              db.collection('users').findOne({ _id: gameSession.whitePlayerId }),
              db.collection('users').findOne({ _id: gameSession.blackPlayerId })
            ]);
            
            return res.json({
              success: true,
              hasUpdates: true,
              gameState: {
                ...gameSession,
                whitePlayer: {
                  id: whitePlayer._id,
                  username: whitePlayer.username,
                  chessRating: whitePlayer.chessRating
                },
                blackPlayer: {
                  id: blackPlayer._id,
                  username: blackPlayer.username,
                  chessRating: blackPlayer.chessRating
                }
              }
            });
          }
          
          return res.json({ success: true, hasUpdates: false });
        } catch (error) {
          console.error('Game sync error:', error);
          return res.status(500).json({ success: false, message: 'Failed to sync game' });
        }
      }
      
      if (action === 'move' && req.method === 'PATCH') {
        try {
          const { gameId, move, fen } = req.body;
          
          const gameSession = await db.collection('gameSessions').findOne({
            _id: new ObjectId(gameId)
          });
          
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game not found' });
          }
          
          // Verify it's the player's turn
          const isWhitePlayer = gameSession.whitePlayerId.equals(user._id);
          const isBlackPlayer = gameSession.blackPlayerId.equals(user._id);
          const isPlayerTurn = (gameSession.turn === 'w' && isWhitePlayer) || 
                              (gameSession.turn === 'b' && isBlackPlayer);
          
          if (!isPlayerTurn) {
            return res.status(400).json({ success: false, message: 'Not your turn' });
          }
          
          // Update game session
          const newTurn = gameSession.turn === 'w' ? 'b' : 'w';
          const updatedMoves = [...gameSession.moves, move];
          
          await db.collection('gameSessions').updateOne(
            { _id: new ObjectId(gameId) },
            {
              $set: {
                moves: updatedMoves,
                fen: fen,
                turn: newTurn,
                lastMoveBy: user._id,
                lastMoveAt: new Date()
              },
              $inc: { version: 1 }
            }
          );
          
          return res.json({ 
            success: true, 
            version: gameSession.version + 1,
            turn: newTurn
          });
        } catch (error) {
          console.error('Game move error:', error);
          return res.status(500).json({ success: false, message: 'Failed to make move' });
        }
      }
      
      if (action === 'end' && req.method === 'PATCH') {
        try {
          const { gameId, result, reason } = req.body;
          
          const gameSession = await db.collection('gameSessions').findOne({
            _id: new ObjectId(gameId)
          });
          
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game not found' });
          }
          
          // Get player info for rating calculations
          const [whitePlayer, blackPlayer] = await Promise.all([
            db.collection('users').findOne({ _id: gameSession.whitePlayerId }),
            db.collection('users').findOne({ _id: gameSession.blackPlayerId })
          ]);
          
          // Calculate rating changes
          let whiteRatingChange = 0;
          let blackRatingChange = 0;
          
          if (result === '1-0') {
            // White wins
            whiteRatingChange = calculateRatingChange(whitePlayer.chessRating, blackPlayer.chessRating, 'win');
            blackRatingChange = calculateRatingChange(blackPlayer.chessRating, whitePlayer.chessRating, 'loss');
          } else if (result === '0-1') {
            // Black wins
            whiteRatingChange = calculateRatingChange(whitePlayer.chessRating, blackPlayer.chessRating, 'loss');
            blackRatingChange = calculateRatingChange(blackPlayer.chessRating, whitePlayer.chessRating, 'win');
          } else if (result === '1/2-1/2') {
            // Draw
            whiteRatingChange = calculateRatingChange(whitePlayer.chessRating, blackPlayer.chessRating, 'draw');
            blackRatingChange = calculateRatingChange(blackPlayer.chessRating, whitePlayer.chessRating, 'draw');
          }
          
          // Update game session
          await db.collection('gameSessions').updateOne(
            { _id: new ObjectId(gameId) },
            {
              $set: {
                status: 'completed',
                result: result,
                reason: reason,
                endedAt: new Date(),
                ratingChange: {
                  white: whiteRatingChange,
                  black: blackRatingChange
                }
              },
              $inc: { version: 1 }
            }
          );
          
          // Update user stats and ratings
          await Promise.all([
            // Update white player
            db.collection('users').updateOne(
              { _id: gameSession.whitePlayerId },
              {
                $inc: {
                  chessRating: whiteRatingChange,
                  gamesPlayed: 1,
                  ...(result === '1-0' && { gamesWon: 1 }),
                  ...(result === '1/2-1/2' && { gamesDrawn: 1 })
                },
                $set: { lastGameAt: new Date() }
              }
            ),
            // Update black player
            db.collection('users').updateOne(
              { _id: gameSession.blackPlayerId },
              {
                $inc: {
                  chessRating: blackRatingChange,
                  gamesPlayed: 1,
                  ...(result === '0-1' && { gamesWon: 1 }),
                  ...(result === '1/2-1/2' && { gamesDrawn: 1 })
                },
                $set: { lastGameAt: new Date() }
              }
            )
          ]);
          
          // Create game record for analytics
          const gameRecord = {
            gameSessionId: gameSession._id,
            whitePlayer: {
              id: whitePlayer._id,
              username: whitePlayer.username,
              rating: whitePlayer.chessRating
            },
            blackPlayer: {
              id: blackPlayer._id,
              username: blackPlayer.username,
              rating: blackPlayer.chessRating
            },
            result: result,
            reason: reason,
            moves: gameSession.moves.length,
            duration: Math.floor((new Date() - gameSession.createdAt) / 1000),
            timeControl: gameSession.timeControl > 900 ? 'Classical' : 
                        gameSession.timeControl > 600 ? 'Rapid' : 'Blitz',
            gameType: 'ranked',
            ratingChange: {
              white: whiteRatingChange,
              black: blackRatingChange
            },
            createdAt: gameSession.createdAt,
            endedAt: new Date()
          };
          
          await db.collection('games').insertOne(gameRecord);
          
          return res.json({ success: true });
        } catch (error) {
          console.error('Game end error:', error);
          return res.status(500).json({ success: false, message: 'Failed to end game' });
        }
      }
      
      if (req.method === 'GET') {
        try {
          const { gameId } = req.query;
          
          const gameSession = await db.collection('gameSessions').findOne({
            _id: new ObjectId(gameId)
          });
          
          if (!gameSession) {
            return res.status(404).json({ success: false, message: 'Game not found' });
          }
          
          // Get player info
          const [whitePlayer, blackPlayer] = await Promise.all([
            db.collection('users').findOne({ _id: gameSession.whitePlayerId }),
            db.collection('users').findOne({ _id: gameSession.blackPlayerId })
          ]);
          
          return res.json({
            success: true,
            gameSession: {
              ...gameSession,
              whitePlayer: {
                id: whitePlayer._id,
                username: whitePlayer.username,
                chessRating: whitePlayer.chessRating
              },
              blackPlayer: {
                id: blackPlayer._id,
                username: blackPlayer.username,
                chessRating: blackPlayer.chessRating
              }
            }
          });
        } catch (error) {
          console.error('Get game session error:', error);
          return res.status(500).json({ success: false, message: 'Failed to get game session' });
        }
      }
    }

    // Games endpoints
    if (endpoint === 'games') {
      const user = await getUserFromToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (action === 'pgn' && req.method === 'GET') {
        try {
          const { gameId } = req.query;
          
          const game = await db.collection('games').findOne({
            _id: new ObjectId(gameId)
          });
          
          if (!game) {
            return res.status(404).json({ success: false, message: 'Game not found' });
          }
          
          // Generate PGN
          let pgn = `[Event "Chess Club Game"]\n`;
          pgn += `[Site "IIT Dharwad Chess Club"]\n`;
          pgn += `[Date "${game.createdAt.toISOString().split('T')[0]}"]\n`;
          pgn += `[Round "?"]\n`;
          pgn += `[White "${game.whitePlayer.username}"]\n`;
          pgn += `[Black "${game.blackPlayer.username}"]\n`;
          pgn += `[Result "${game.result}"]\n`;
          pgn += `[TimeControl "${game.timeControl}"]\n`;
          pgn += `[WhiteElo "${game.whitePlayer.rating}"]\n`;
          pgn += `[BlackElo "${game.blackPlayer.rating}"]\n\n`;
          
          // Add moves (simplified - would need actual move notation)
          pgn += `1. e4 e5 2. Nf3 Nc6 ${game.result}`;
          
          return res.json({ success: true, pgn });
        } catch (error) {
          console.error('PGN generation error:', error);
          return res.status(500).json({ success: false, message: 'Failed to generate PGN' });
        }
      }
      
      if (action === 'head-to-head' && req.method === 'GET') {
        try {
          const { player1Id, player2Id } = req.query;
          
          // Get games between these two players
          const games = await db.collection('games').find({
            $or: [
              { 
                'whitePlayer.id': new ObjectId(player1Id),
                'blackPlayer.id': new ObjectId(player2Id)
              },
              {
                'whitePlayer.id': new ObjectId(player2Id),
                'blackPlayer.id': new ObjectId(player1Id)
              }
            ]
          }).sort({ createdAt: -1 }).toArray();
          
          // Get player info
          const [player1, player2] = await Promise.all([
            db.collection('users').findOne({ _id: new ObjectId(player1Id) }),
            db.collection('users').findOne({ _id: new ObjectId(player2Id) })
          ]);
          
          if (!player1 || !player2) {
            return res.status(404).json({ success: false, message: 'Player not found' });
          }
          
          // Calculate stats
          let player1Wins = 0;
          let player2Wins = 0;
          let draws = 0;
          
          games.forEach(game => {
            if (game.result === '1/2-1/2') {
              draws++;
            } else if (
              (game.result === '1-0' && game.whitePlayer.id.equals(new ObjectId(player1Id))) ||
              (game.result === '0-1' && game.blackPlayer.id.equals(new ObjectId(player1Id)))
            ) {
              player1Wins++;
            } else {
              player2Wins++;
            }
          });
          
          const totalGames = games.length;
          
          const h2hData = {
            player1: {
              username: player1.username,
              wins: player1Wins,
              draws: draws,
              winRate: totalGames > 0 ? ((player1Wins / totalGames) * 100).toFixed(1) : 0,
              rating: player1.chessRating
            },
            player2: {
              username: player2.username,
              wins: player2Wins,
              draws: draws,
              winRate: totalGames > 0 ? ((player2Wins / totalGames) * 100).toFixed(1) : 0,
              rating: player2.chessRating
            },
            totalGames,
            lastGameAt: games.length > 0 ? games[0].createdAt : null,
            recentGames: games.slice(0, 5).map(game => ({
              result: game.result,
              timeControl: game.timeControl,
              moves: game.moves,
              createdAt: game.createdAt
            }))
          };
          
          return res.json({ success: true, headToHead: h2hData });
        } catch (error) {
          console.error('Head-to-head error:', error);
          return res.status(500).json({ success: false, message: 'Failed to get head-to-head data' });
        }
      }
    }

    // Admin endpoints
    if (endpoint === 'admin') {
      const user = await getUserFromToken(req);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
      }

      if (resource === 'users') {
        if (req.method === 'GET') {
          try {
            const users = await db.collection('users').find({}).toArray();
            const usersWithStats = users.map(user => {
              const { password, ...userWithoutPassword } = user;
              return {
                ...userWithoutPassword,
                id: user._id,
                winRate: user.gamesPlayed > 0 ? ((user.gamesWon / user.gamesPlayed) * 100).toFixed(1) : 0
              };
            });
            return res.json({ success: true, users: usersWithStats });
          } catch (error) {
            console.error('Admin users error:', error);
            return res.status(500).json({ success: false, message: 'Failed to get users' });
          }
        }
        
        if (req.method === 'PUT') {
          try {
            const { userId, updates } = req.body;
            await db.collection('users').updateOne(
              { _id: new ObjectId(userId) },
              { $set: updates }
            );
            return res.json({ success: true });
          } catch (error) {
            console.error('Admin update user error:', error);
            return res.status(500).json({ success: false, message: 'Failed to update user' });
          }
        }
        
        if (req.method === 'DELETE') {
          try {
            const { userId } = req.body;
            await db.collection('users').deleteOne({ _id: new ObjectId(userId) });
            return res.json({ success: true });
          } catch (error) {
            console.error('Admin delete user error:', error);
            return res.status(500).json({ success: false, message: 'Failed to delete user' });
          }
        }
      }
      
      if (resource === 'games') {
        if (req.method === 'GET') {
          try {
            const games = await db.collection('games').find({}).sort({ createdAt: -1 }).toArray();
            const gamesWithId = games.map(game => ({
              ...game,
              id: game._id
            }));
            return res.json({ success: true, games: gamesWithId });
          } catch (error) {
            console.error('Admin games error:', error);
            return res.status(500).json({ success: false, message: 'Failed to get games' });
          }
        }
      }
    }

    // Tournaments endpoints
    if (endpoint === 'tournaments') {
      const user = await getUserFromToken(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      if (req.method === 'GET') {
        try {
          const tournaments = await db.collection('tournaments').find({}).sort({ startTime: -1 }).toArray();
          const tournamentsWithParticipants = await Promise.all(
            tournaments.map(async (tournament) => {
              const participants = await db.collection('tournamentParticipants').find({
                tournamentId: tournament._id
              }).toArray();
              
              const participantsWithUserInfo = await Promise.all(
                participants.map(async (participant) => {
                  const user = await db.collection('users').findOne({ _id: participant.userId });
                  return {
                    userId: user._id,
                    username: user.username,
                    rating: user.chessRating
                  };
                })
              );
              
              return {
                ...tournament,
                id: tournament._id,
                participants: participantsWithUserInfo
              };
            })
          );
          
          return res.json({ success: true, tournaments: tournamentsWithParticipants });
        } catch (error) {
          console.error('Tournaments error:', error);
          return res.json({ success: true, tournaments: [] });
        }
      }
      
      if (req.method === 'POST') {
        try {
          if (user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
          }
          
          const tournament = {
            ...req.body,
            createdBy: user._id,
            createdAt: new Date(),
            status: 'upcoming'
          };
          
          const result = await db.collection('tournaments').insertOne(tournament);
          return res.json({ success: true, tournamentId: result.insertedId });
        } catch (error) {
          console.error('Create tournament error:', error);
          return res.status(500).json({ success: false, message: 'Failed to create tournament' });
        }
      }
      
      if (action === 'join' && req.method === 'POST') {
        try {
          const { tournamentId } = req.query;
          
          const existingParticipant = await db.collection('tournamentParticipants').findOne({
            tournamentId: new ObjectId(tournamentId),
            userId: user._id
          });
          
          if (existingParticipant) {
            return res.status(400).json({ success: false, message: 'Already joined this tournament' });
          }
          
          await db.collection('tournamentParticipants').insertOne({
            tournamentId: new ObjectId(tournamentId),
            userId: user._id,
            joinedAt: new Date()
          });
          
          return res.json({ success: true });
        } catch (error) {
          console.error('Join tournament error:', error);
          return res.status(500).json({ success: false, message: 'Failed to join tournament' });
        }
      }
      
      if (req.method === 'DELETE') {
        try {
          if (user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Admin access required' });
          }
          
          const { tournamentId } = req.query;
          
          // Delete tournament and participants
          await Promise.all([
            db.collection('tournaments').deleteOne({ _id: new ObjectId(tournamentId) }),
            db.collection('tournamentParticipants').deleteMany({ tournamentId: new ObjectId(tournamentId) })
          ]);
          
          return res.json({ success: true });
        } catch (error) {
          console.error('Delete tournament error:', error);
          return res.status(500).json({ success: false, message: 'Failed to delete tournament' });
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