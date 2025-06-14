import clientPromise from '../lib/mongodb.js';
import { verifyToken } from '../lib/auth.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
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

    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    const client = await clientPromise;
    const db = client.db('chess-club');
    const users = db.collection('users');

    const searchResults = await users.find({
      username: { $regex: q.trim(), $options: 'i' }
    }).project({
      password: 0
    }).limit(10).toArray();

    const usersWithData = searchResults.map(user => ({
      id: user._id.toString(),
      username: user.username,
      chessRating: user.chessRating,
      friendRequestSent: false // This would need to be checked against friendships collection
    }));

    res.json({
      success: true,
      users: usersWithData
    });

  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed'
    });
  }
}