import clientPromise from '../lib/mongodb.js';
import { verifyToken } from '../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const client = await clientPromise;
    const db = client.db('chess-club');
    const users = db.collection('users');
    const friendships = db.collection('friendships');

    if (req.method === 'GET') {
      // Get user's friends
      const userFriendships = await friendships.find({
        $or: [
          { userId: new ObjectId(decoded.userId), status: 'accepted' },
          { friendId: new ObjectId(decoded.userId), status: 'accepted' }
        ]
      }).toArray();

      const friendIds = userFriendships.map(friendship => 
        friendship.userId.toString() === decoded.userId 
          ? friendship.friendId 
          : friendship.userId
      );

      const friends = await users.find({
        _id: { $in: friendIds }
      }).project({
        password: 0
      }).toArray();

      const friendsWithData = friends.map(friend => ({
        id: friend._id.toString(),
        username: friend.username,
        chessRating: friend.chessRating,
        lastSeen: friend.lastLogin || friend.createdAt
      }));

      res.json({
        success: true,
        friends: friendsWithData
      });

    } else {
      res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Friends API error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}