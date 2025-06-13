import clientPromise from '../lib/mongodb.js';
import { verifyToken, getUserStats } from '../lib/auth.js';
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

    // Verify JWT token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('chess-club');
    const users = db.collection('users');

    // Find user by ID
    const user = await users.findOne({ _id: new ObjectId(decoded.userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Return user data (without password)
    const userResponse = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      chessRating: user.chessRating,
      stats: getUserStats(user)
    };

    res.json({
      success: true,
      user: userResponse
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
}