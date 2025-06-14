export default async function handler(req, res) {
  const { q } = req.query;
  // Replace with actual DB query
  const users = [{ _id: '1', username: 'Varshith', chessRating: 2000 }];
  const filtered = users.filter(u => u.username.toLowerCase().includes(q.toLowerCase()));
  res.status(200).json({ success: true, users: filtered });
}
