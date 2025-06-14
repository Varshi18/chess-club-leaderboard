import clientPromise from '../../../lib/mongodb'; // adjust path as needed
import { verifyToken } from '../../../utils/auth'; // adjust path as needed

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    console.log('🔐 Token:', token);
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
      console.log('✅ Token verified:', decoded);
    } catch (err) {
      console.error('❌ Token verification failed:', err.message);
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }

    const { q } = req.query;
    console.log('🔍 Search query:', q);

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

    console.log('🔎 Found users:', searchResults.length);

    const usersWithData = searchResults.map(user => ({
      id: user._id.toString(),
      username: user.username,
      chessRating: user.chessRating,
      friendRequestSent: false
    }));

    res.json({
      success: true,
      users: usersWithData
    });

  } catch (error) {
    console.error('🔥 User search error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message || 'Search failed'
    });
  }
}
