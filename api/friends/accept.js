import clientPromise from '../../lib/mongodb.js';
import { verifyToken } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
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

    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Request ID is required' });
    }

    const client = await clientPromise;
    const db = client.db('chess-club');
    const friendships = db.collection('friendships');

    // Update the friendship status to 'accepted'
    const result = await friendships.updateOne(
      { _id: new ObjectId(requestId), friendId: new ObjectId(decoded.userId), status: 'pending' },
      { $set: { status: 'accepted', updatedAt: new Date() } }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ success: false, message: 'Friend request not found or already accepted' });
    }

    return res.json({ success: true, message: 'Friend request accepted' });
  } catch (error) {
    console.error('Accept friend error:', error);
    return res.status(500).json({ success: false, message: 'Failed to accept friend request' });
  }
}
