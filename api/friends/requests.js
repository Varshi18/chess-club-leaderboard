import clientPromise from '../../lib/mongodb.js';
import { verifyToken } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
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
    const friendships = db.collection('friendships');
    const users = db.collection('users');

    // Fetch all friend requests received by the current user
    const pendingRequests = await friendships.find({
      friendId: new ObjectId(decoded.userId),
      status: 'pending'
    }).toArray();

    const senderIds = pendingRequests.map(req => req.userId);
    const senders = await users.find({
      _id: { $in: senderIds }
    }).project({ password: 0 }).toArray();

    const sendersMap = Object.fromEntries(
      senders.map(sender => [sender._id.toString(), sender])
    );

    const requests = pendingRequests.map(req => ({
      _id: req._id.toString(),
      sender: {
        id: req.userId.toString(),
        username: sendersMap[req.userId.toString()]?.username || 'Unknown',
        chessRating: sendersMap[req.userId.toString()]?.chessRating ?? 'N/A'
      },
      createdAt: req.createdAt
    }));

    return res.json({ success: true, requests });

  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friend requests'
    });
  }
}
