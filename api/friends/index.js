
import clientPromise from '../../lib/mongodb.js';
import { verifyToken } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

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

  try {
    const userId = new ObjectId(decoded.userId);

    if (req.method === 'GET') {
      const { q, type } = req.query;

      if (type === 'requests') {
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
        const results = await users.find({
          username: { $regex: q.trim(), $options: 'i' },
          _id: { $ne: userId },
        }).project({ password: 0 }).limit(10).toArray();

        const ids = results.map(u => u._id);
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
          if (f.status === 'pending' && f.userId.toString() === decoded.userId) sent.add(otherId);
          if (f.status === 'accepted') accepted.add(otherId);
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
        chessRating: f.chessRating,
        lastSeen: f.lastLogin || f.createdAt,
      }));

      return res.json({ success: true, friends: formattedFriends });
    }

    if (req.method === 'POST') {
      const { userId: targetId } = req.body;
      if (!targetId || targetId === decoded.userId) {
        return res.status(400).json({ success: false, message: 'Invalid user ID' });
      }

      const existing = await friendships.findOne({
        $or: [
          { userId, friendId: new ObjectId(targetId) },
          { userId: new ObjectId(targetId), friendId: userId },
        ]
      });

      if (existing) {
        return res.status(400).json({ success: false, message: 'Already friends or pending' });
      }

      await friendships.insertOne({
        userId,
        friendId: new ObjectId(targetId),
        status: 'pending',
        createdAt: new Date(),
      });

      return res.json({ success: true, message: 'Friend request sent' });
    }

    if (req.method === 'PATCH') {
      const { requestId, action } = req.body;
      if (!requestId || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, message: 'Invalid request' });
      }

      if (action === 'accept') {
        const result = await friendships.updateOne(
          { _id: new ObjectId(requestId), friendId: userId, status: 'pending' },
          { $set: { status: 'accepted', updatedAt: new Date() } }
        );
        if (result.modifiedCount === 0) {
          return res.status(404).json({ success: false, message: 'Request not found or already accepted' });
        }
        return res.json({ success: true, message: 'Request accepted' });
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
        return res.json({ success: true, message: 'Request rejected' });
      }
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Friends API error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}
