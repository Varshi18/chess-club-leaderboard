export default function handler(req, res) {
  const { q } = req.query;

  res.status(200).json({
    success: true,
    users: [{ username: "Varshith", rating: 2000, query: q || "none" }],
  });
}
