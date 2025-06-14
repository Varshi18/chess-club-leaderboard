import clientPromise from '../../lib/mongodb.js';
import { verifyToken } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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
    if (!decoded || !ObjectId.isValid(decoded.userId)) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }

    const userObjectId = new ObjectId(decoded.userId);

    const client = await clientPromise;
    const db = client.db('chess-club');
    const friendships = db.collection('friendships');
    const users = db.collection('users');

    // Find all pending requests *received* by the user
    const pendingRequests = await friendships.find({
      friendId: userObjectId,
      status: 'pending',
    }).toArray();

    const senderIds = pendingRequests.map((r) => r.userId);
    const senders = await users
      .find({ _id: { $in: senderIds } })
      .project({ password: 0 })
      .toArray();

    // Map senderId to user data
    const sendersMap = Object.fromEntries(
      senders.map((u) => [u._id.toString(), u])
    );

    const formattedRequests = pendingRequests.map((r) => ({
      _id: r._id.toString(),
      sender: {
        id: r.userId.toString(),
        username: sendersMap[r.userId.toString()]?.username || 'Unknown',
        chessRating: sendersMap[r.userId.toString()]?.chessRating ?? 'N/A',
      },
      createdAt: r.createdAt,
    }));

    return res.json({ success: true, requests: formattedRequests });

  } catch (error) {
    console.error('Error fetching friend requests:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch friend requests',
    });
  }
}
