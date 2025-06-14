import clientPromise from '../../lib/mongodb.js';
import { verifyToken } from '../../lib/auth.js';
import { ObjectId } from 'mongodb';

export default async function handler(req, res) {
  // CORS headers
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
    // Token extraction and validation
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    console.log('[REQUESTS] Token present:', !!token);

    if (!token) {
      return res.status(401).json({ success: false, message: 'Access token required' });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
      console.log('[REQUESTS] Token decoded successfully:', !!decoded);
    } catch (tokenError) {
      console.error('[REQUESTS] Token verification failed:', tokenError.message);
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }

    if (!decoded || !decoded.userId) {
      return res.status(403).json({ success: false, message: 'Invalid token payload' });
    }

    // Validate ObjectId
    if (!ObjectId.isValid(decoded.userId)) {
      console.error('[REQUESTS] Invalid userId in token:', decoded.userId);
      return res.status(403).json({ success: false, message: 'Invalid user ID format' });
    }

    const userObjectId = new ObjectId(decoded.userId);

    // Database connection
    let client;
    try {
      client = await clientPromise;
      console.log('[REQUESTS] Database connected successfully');
    } catch (dbError) {
      console.error('[REQUESTS] Database connection failed:', dbError.message);
      return res.status(500).json({ success: false, message: 'Database connection failed' });
    }

    const db = client.db('chess-club');
    const friendships = db.collection('friendships');
    const users = db.collection('users');

    // Fetch pending friend requests
    console.log('[REQUESTS] Fetching pending requests for user:', userObjectId.toString());
    let pendingRequests;
    try {
      pendingRequests = await friendships.find({
        friendId: userObjectId,
        status: 'pending',
      }).toArray();
      console.log('[REQUESTS] Found pending requests count:', pendingRequests.length);
    } catch (queryError) {
      console.error('[REQUESTS] Error fetching pending requests:', queryError.message);
      return res.status(500).json({ success: false, message: 'Failed to fetch pending requests' });
    }

    // If no pending requests, return early
    if (pendingRequests.length === 0) {
      return res.json({ success: true, requests: [] });
    }

    // Get sender IDs
    const senderIds = pendingRequests.map((r) => r.userId);
    console.log('[REQUESTS] Sender IDs:', senderIds.map(id => id.toString()));

    // Fetch sender information
    let senders;
    try {
      senders = await users
        .find({ _id: { $in: senderIds } })
        .project({ password: 0, email: 0 }) // Exclude sensitive fields
        .toArray();
      console.log('[REQUESTS] Found senders count:', senders.length);
    } catch (userQueryError) {
      console.error('[REQUESTS] Error fetching senders:', userQueryError.message);
      return res.status(500).json({ success: false, message: 'Failed to fetch sender information' });
    }

    // Create senders map
    const sendersMap = {};
    senders.forEach(user => {
      sendersMap[user._id.toString()] = user;
    });

    // Format the response
    const formattedRequests = pendingRequests.map((request) => {
      const senderId = request.userId.toString();
      const sender = sendersMap[senderId];
      
      return {
        _id: request._id.toString(),
        sender: {
          id: senderId,
          username: sender?.username || 'Unknown User',
          chessRating: sender?.chessRating ?? 'Unrated',
        },
        createdAt: request.createdAt || new Date().toISOString(),
      };
    });

    console.log('[REQUESTS] Returning formatted requests:', formattedRequests.length);
    return res.status(200).json({ 
      success: true, 
      requests: formattedRequests,
      count: formattedRequests.length 
    });

  } catch (error) {
    console.error('[REQUESTS] Fatal error:', error);
    console.error('[REQUESTS] Error stack:', error.stack);
    
    // Don't expose internal error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      ...(isDevelopment && { error: error.message, stack: error.stack })
    });
  }
}