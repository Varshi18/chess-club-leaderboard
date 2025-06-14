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

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const client = await clientPromise;
    const db = client.db('chess-club');
    const tournaments = db.collection('tournaments');
    const users = db.collection('users');

    // Get all tournaments with participant details
    const tournamentList = await tournaments.find({}).sort({ createdAt: -1 }).toArray();

    const tournamentsWithParticipants = await Promise.all(
      tournamentList.map(async (tournament) => {
        const participantIds = tournament.participants.map(p => new ObjectId(p.userId));
        const participantUsers = await users.find({
          _id: { $in: participantIds }
        }).project({
          password: 0
        }).toArray();

        const participants = tournament.participants.map(participant => {
          const user = participantUsers.find(u => u._id.toString() === participant.userId);
          return {
            userId: participant.userId,
            username: user?.username || 'Unknown',
            rating: user?.chessRating || 1200,
            joinedAt: participant.joinedAt
          };
        });

        return {
          id: tournament._id.toString(),
          name: tournament.name,
          format: tournament.format,
          timeControl: tournament.timeControl,
          maxParticipants: tournament.maxParticipants,
          prizePool: tournament.prizePool,
          startTime: tournament.startTime,
          endTime: tournament.endTime,
          status: tournament.status,
          participants,
          bracket: tournament.bracket || null,
          createdAt: tournament.createdAt
        };
      })
    );

    res.json({
      success: true,
      tournaments: tournamentsWithParticipants
    });

  } catch (error) {
    console.error('Tournaments API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tournaments'
    });
  }
}