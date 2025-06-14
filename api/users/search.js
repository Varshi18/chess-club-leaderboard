export default function handler(req, res) {
  const { q } = req.query;
  console.log("🔍 Search query:", q);
  res.status(200).json({
    success: true,
    users: [
      { id: '1', username: 'Varshith', chessRating: 1800 },
      { id: '2', username: 'ChessMaster', chessRating: 2100 }
    ]
  });
}