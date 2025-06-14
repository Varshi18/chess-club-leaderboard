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

  if (req.method !== 'POST') {
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

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (userId === decoded.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot send friend request to yourself'
      });
    }

    const client = await clientPromise;
    const db = client.db('chess-club');
    const friendships = db.collection('friendships');

    // Check if friendship already exists
    const existingFriendship = await friendships.findOne({
      $or: [
        { userId: new ObjectId(decoded.userId), friendId: new ObjectId(userId) },
        { userId: new ObjectId(userId), friendId: new ObjectId(decoded.userId) }
      ]
    });

    if (existingFriendship) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already exists or you are already friends'
      });
    }

    // Create friend request
    await friendships.insertOne({
      userId: new ObjectId(decoded.userId),
      friendId: new ObjectId(userId),
      status: 'pending',
      createdAt: new Date()
    });

    res.json({
      success: true,
      message: 'Friend request sent successfully'
    });

  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send friend request'
    });
  }
}