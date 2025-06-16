import clientPromise from '../lib/mongodb.js';
import { hashPassword, generateToken, getUserStats } from '../lib/auth.js';

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
    const { username, email, password, fullName } = req.body;

    // Validation
    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Additional validation
    if (username.length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters long'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email'
      });
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db('chess-club');
    const users = db.collection('users');

    // Check if user already exists
    const existingUser = await users.findOne({
      $or: [
        { email: email.toLowerCase() }, 
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase() 
          ? 'Email already registered' 
          : 'Username already taken'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new user
    const newUser = {
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName,
      chessRating: 1200,
      gamesPlayed: 0,
      gamesWon: 0,
      isActive: true,
      createdAt: new Date(),
      lastLogin: new Date(),
      role: email === "your-admin-email@example.com" ? "admin" : "user"
    };

    const result = await users.insertOne(newUser);
    const userId = result.insertedId.toString();

    // Generate JWT token
    const token = generateToken(userId, username);

    // Return user data (without password)
    const userResponse = {
      id: userId,
      username: newUser.username,
      email: newUser.email,
      fullName: newUser.fullName,
      chessRating: newUser.chessRating,
      stats: getUserStats(newUser)
    };

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: userResponse
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
}