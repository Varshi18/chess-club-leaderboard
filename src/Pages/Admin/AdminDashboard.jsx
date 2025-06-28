import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [games, setGames] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedGame, setSelectedGame] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    userRole: 'all',
    userStatus: 'all',
    gameResult: 'all',
    gameType: 'all'
  });
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchData();
  }, [user, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [usersRes, gamesRes] = await Promise.all([
        axios.get('/?endpoint=admin&resource=users', { headers }),
        axios.get('/?endpoint=admin&resource=games', { headers })
      ]);
      
      if (usersRes.data.success) setUsers(usersRes.data.users);
      if (gamesRes.data.success) setGames(gamesRes.data.games);
      
      // Create analytics from the data we have
      if (usersRes.data.success && gamesRes.data.success) {
        const analyticsData = {
          users: {
            totalUsers: usersRes.data.users.length,
            activeUsers: usersRes.data.users.filter(u => u.isActive).length,
            avgRating: usersRes.data.users.reduce((sum, u) => sum + (u.chessRating || 1200), 0) / usersRes.data.users.length
          },
          games: {
            totalGames: gamesRes.data.games.length,
            recentGames: gamesRes.data.games.filter(g => {
              const gameDate = new Date(g.createdAt);
              const monthAgo = new Date();
              monthAgo.setMonth(monthAgo.getMonth() - 1);
              return gameDate > monthAgo;
            }).length
          },
          tournaments: {
            activeTournaments: 0,
            totalTournaments: 0
          },
          topPlayers: usersRes.data.users
            .sort((a, b) => (b.chessRating || 1200) - (a.chessRating || 1200))
            .slice(0, 5)
            .map(u => ({
              username: u.username,
              rating: u.chessRating || 1200,
              gamesPlayed: u.gamesPlayed || 0,
              winRate: u.gamesPlayed > 0 ? ((u.gamesWon || 0) / u.gamesPlayed * 100).toFixed(1) : 0
            })),
          activePlayers: usersRes.data.users
            .sort((a, b) => (b.gamesPlayed || 0) - (a.gamesPlayed || 0))
            .slice(0, 5)
            .map(u => ({
              username: u.username,
              rating: u.chessRating || 1200,
              gamesPlayed: u.gamesPlayed || 0,
              winRate: u.gamesPlayed > 0 ? ((u.gamesWon || 0) / u.gamesPlayed * 100).toFixed(1) : 0
            })),
          timeControlStats: [
            { _id: 'Blitz', count: gamesRes.data.games.filter(g => g.timeControl === 'Blitz').length },
            { _id: 'Rapid', count: gamesRes.data.games.filter(g => g.timeControl === 'Rapid').length },
            { _id: 'Classical', count: gamesRes.data.games.filter(g => g.timeControl === 'Classical').length }
          ],
          ratingDistribution: [
            { _id: '1200', count: usersRes.data.users.filter(u => (u.chessRating || 1200) >= 1200 && (u.chessRating || 1200) < 1400).length },
            { _id: '1400', count: usersRes.data.users.filter(u => (u.chessRating || 1200) >= 1400 && (u.chessRating || 1200) < 1600).length },
            { _id: '1600', count: usersRes.data.users.filter(u => (u.chessRating || 1200) >= 1600 && (u.chessRating || 1200) < 1800).length },
            { _id: '1800', count: usersRes.data.users.filter(u => (u.chessRating || 1200) >= 1800).length }
          ]
        };
        setAnalytics(analyticsData);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userId, updates) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put('/?endpoint=admin&resource=users', 
        { userId, updates }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        fetchData();
        setEditingUser(null);
      }
    } catch (error) {
      console.error('Error updating user:', error);
    }
  };

  const deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete('/?endpoint=admin&resource=users', 
        { 
          data: { userId },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (response.data.success) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const downloadPGN = async (gameId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/?endpoint=games&resource=pgn&gameId=${gameId}&download=true`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `game_${gameId}.pgn`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading PGN:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filters.userRole === 'all' || user.role === filters.userRole;
    const matchesStatus = filters.userStatus === 'all' || 
                         (filters.userStatus === 'active' && user.isActive) ||
                         (filters.userStatus === 'inactive' && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredGames = games.filter(game => {
    const matchesSearch = game.whitePlayer.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.blackPlayer.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesResult = filters.gameResult === 'all' || game.result === filters.gameResult;
    const matchesType = filters.gameType === 'all' || game.gameType === filters.gameType;
    return matchesSearch && matchesResult && matchesType;
  });

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'games', label: 'Games', icon: '♟️' },
    { id: 'analytics', label: 'Analytics', icon: '📈' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-8">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage users, games, and system analytics
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="flex space-x-4 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-lg overflow-x-auto">
            {tabs.map((tab) => (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <span className="text-xl mr-2">{tab.icon}</span>
                {tab.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        {(activeTab === 'users' || activeTab === 'games') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder={`Search ${activeTab}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              {activeTab === 'users' && (
                <>
                  <select
                    value={filters.userRole}
                    onChange={(e) => setFilters({...filters, userRole: e.target.value})}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Roles</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <select
                    value={filters.userStatus}
                    onChange={(e) => setFilters({...filters, userStatus: e.target.value})}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </>
              )}
              {activeTab === 'games' && (
                <>
                  <select
                    value={filters.gameResult}
                    onChange={(e) => setFilters({...filters, gameResult: e.target.value})}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Results</option>
                    <option value="1-0">White Wins</option>
                    <option value="0-1">Black Wins</option>
                    <option value="1/2-1/2">Draw</option>
                  </select>
                  <select
                    value={filters.gameType}
                    onChange={(e) => setFilters({...filters, gameType: e.target.value})}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All Types</option>
                    <option value="casual">Casual</option>
                    <option value="ranked">Ranked</option>
                    <option value="tournament">Tournament</option>
                  </select>
                </>
              )}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && analytics && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <StatsCard
                title="Total Users"
                value={analytics.users.totalUsers}
                icon="👥"
                color="blue"
                subtitle={`${analytics.users.activeUsers} active`}
              />
              <StatsCard
                title="Total Games"
                value={analytics.games.totalGames}
                icon="♟️"
                color="green"
                subtitle={`${analytics.games.recentGames} this month`}
              />
              <StatsCard
                title="Average Rating"
                value={Math.round(analytics.users.avgRating)}
                icon="⭐"
                color="yellow"
                subtitle="Club average"
              />
              <StatsCard
                title="Active Tournaments"
                value={analytics.tournaments.activeTournaments}
                icon="🏆"
                color="purple"
                subtitle={`${analytics.tournaments.totalTournaments} total`}
              />
            </motion.div>
          )}

          {activeTab === 'users' && (
            <motion.div
              key="users"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  User Management ({filteredUsers.length} users)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rating</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Games</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {filteredUsers.map((userData) => (
                      <motion.tr 
                        key={userData.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                              {userData.username[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{userData.username}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{userData.fullName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{userData.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
                            {userData.chessRating}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {userData.gamesPlayed} ({userData.winRate}% win rate)
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            userData.role === 'admin' 
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {userData.role || 'user'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            userData.isActive 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {userData.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setEditingUser(userData)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Edit
                          </button>
                          {userData.id !== user.id && (
                            <button
                              onClick={() => deleteUser(userData.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'games' && (
            <motion.div
              key="games"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Game Management ({filteredGames.length} games)
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Players</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Result</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Time Control</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Duration</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                    {filteredGames.map((game) => (
                      <motion.tr 
                        key={game.id} 
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900 dark:text-white">
                              {game.whitePlayer.username} vs {game.blackPlayer.username}
                            </div>
                            <div className="text-gray-500 dark:text-gray-400">
                              {game.whitePlayer.rating} - {game.blackPlayer.rating}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            game.result === '1-0' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                            game.result === '0-1' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {game.result}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {game.timeControl}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {Math.floor(game.duration / 60)}m {game.duration % 60}s
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            game.gameType === 'ranked' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            game.gameType === 'tournament' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {game.gameType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {new Date(game.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => setSelectedGame(game)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            View
                          </button>
                          <button
                            onClick={() => downloadPGN(game.id)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          >
                            PGN
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && analytics && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnalyticsCard
                  title="Top Players"
                  data={analytics.topPlayers}
                  type="players"
                />
                <AnalyticsCard
                  title="Most Active Players"
                  data={analytics.activePlayers}
                  type="active"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AnalyticsCard
                  title="Time Control Distribution"
                  data={analytics.timeControlStats}
                  type="timeControl"
                />
                <AnalyticsCard
                  title="Rating Distribution"
                  data={analytics.ratingDistribution}
                  type="rating"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit User Modal */}
        <AnimatePresence>
          {editingUser && (
            <EditUserModal
              user={editingUser}
              onSave={updateUser}
              onClose={() => setEditingUser(null)}
            />
          )}
        </AnimatePresence>

        {/* Game Details Modal */}
        <AnimatePresence>
          {selectedGame && (
            <GameDetailsModal
              game={selectedGame}
              onClose={() => setSelectedGame(null)}
              onDownloadPGN={() => downloadPGN(selectedGame.id)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Stats Card Component
const StatsCard = ({ title, value, icon, color, subtitle }) => {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    purple: 'from-purple-500 to-purple-600'
  };

  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
      whileHover={{ scale: 1.02, y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center">
        <div className={`p-3 bg-gradient-to-r ${colorClasses[color]} rounded-full`}>
          <span className="text-2xl">{icon}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
};

// Analytics Card Component
const AnalyticsCard = ({ title, data, type }) => {
  return (
    <motion.div
      className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {data.map((item, index) => (
          <motion.div
            key={index}
            className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            {type === 'players' && (
              <>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.username}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {item.gamesPlayed} games, {item.winRate}% win rate
                    </div>
                  </div>
                </div>
                <span className="font-bold text-blue-600 dark:text-blue-400">{item.rating}</span>
              </>
            )}
            {type === 'active' && (
              <>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center text-white font-bold text-sm mr-3">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{item.username}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Rating: {item.rating}, {item.winRate}% win rate
                    </div>
                  </div>
                </div>
                <span className="font-bold text-green-600 dark:text-green-400">{item.gamesPlayed}</span>
              </>
            )}
            {type === 'timeControl' && (
              <>
                <span className="font-medium text-gray-900 dark:text-white">{item._id}</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{item.count}</span>
              </>
            )}
            {type === 'rating' && (
              <>
                <span className="font-medium text-gray-900 dark:text-white">
                  {item._id === 'Other' ? 'Other' : `${item._id}-${parseInt(item._id) + 199}`}
                </span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{item.count}</span>
              </>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

// Edit User Modal Component
const EditUserModal = ({ user, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    role: user.role || 'user',
    isActive: user.isActive,
    chessRating: user.chessRating,
    fullName: user.fullName
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(user.id, formData);
  };

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full"
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.7 }}
      >
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Edit User: {user.username}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Chess Rating
            </label>
            <input
              type="number"
              value={formData.chessRating}
              onChange={(e) => setFormData({ ...formData, chessRating: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="mr-2"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active User
            </label>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// Game Details Modal Component
const GameDetailsModal = ({ game, onClose, onDownloadPGN }) => {
  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.7 }}
      >
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Game Details
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">White Player</h4>
              <p className="text-lg font-bold">{game.whitePlayer.username}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Rating: {game.whitePlayer.rating}</p>
              {game.ratingChange && (
                <p className={`text-sm font-medium ${
                  game.ratingChange.white > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {game.ratingChange.white > 0 ? '+' : ''}{game.ratingChange.white}
                </p>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Black Player</h4>
              <p className="text-lg font-bold">{game.blackPlayer.username}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Rating: {game.blackPlayer.rating}</p>
              {game.ratingChange && (
                <p className={`text-sm font-medium ${
                  game.ratingChange.black > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {game.ratingChange.black > 0 ? '+' : ''}{game.ratingChange.black}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Game Info</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-600 dark:text-gray-400">Result:</span> {game.result}</p>
                <p><span className="text-gray-600 dark:text-gray-400">Time Control:</span> {game.timeControl}</p>
                <p><span className="text-gray-600 dark:text-gray-400">Duration:</span> {Math.floor(game.duration / 60)}m {game.duration % 60}s</p>
                <p><span className="text-gray-600 dark:text-gray-400">Moves:</span> {game.moves}</p>
                <p><span className="text-gray-600 dark:text-gray-400">Type:</span> {game.gameType}</p>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Date & Time</h4>
              <div className="space-y-1 text-sm">
                <p><span className="text-gray-600 dark:text-gray-400">Started:</span> {new Date(game.createdAt).toLocaleString()}</p>
                {game.endedAt && (
                  <p><span className="text-gray-600 dark:text-gray-400">Ended:</span> {new Date(game.endedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <motion.button
              onClick={onDownloadPGN}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Download PGN
            </motion.button>
            <motion.button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Close
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default AdminDashboard;