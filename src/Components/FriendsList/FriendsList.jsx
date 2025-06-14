import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

// Configure axios for Vercel API routes
const api = axios.create({
  baseURL: '', // Empty for same-origin requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const FriendsList = ({ onChallengePlayer }) => {
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('friends');
  const { user } = useAuth();

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const response = await api.get('/api/friends');
      if (response.data.success) {
        setFriends(response.data.friends);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
      // Add more specific error handling
      if (error.response) {
        console.error('Server error:', error.response.data);
      } else if (error.request) {
        console.error('Network error - no response received');
      }
    }
  };

  const searchUsers = async (query) => {
    console.log("🔍 Search query:", query);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);

    try {
      const searchUrl = `/api/users/search?q=${encodeURIComponent(query)}`;
      console.log("📡 Making request to:", searchUrl);
      
      const response = await api.get(searchUrl);
      
      console.log('✅ Search API Response:', response.data);

      if (response.data.success) {
        setSearchResults(response.data.users.filter(u => u._id !== user._id));
      } else {
        console.warn("⚠️ Search failed with message:", response.data.message || 'No message from server');
        setSearchResults([]);
      }

    } catch (error) {
      console.error('❌ Search error:', error);
      setSearchResults([]);
      
      if (error.response) {
        console.error('Server responded with error:', error.response.status, error.response.data);
        if (typeof error.response.data === 'string' && error.response.data.includes('<!DOCTYPE html>')) {
          console.error('🚨 You\'re getting HTML instead of JSON - make sure you\'re running "vercel dev" not "npm start"');
        }
      } else if (error.request) {
        console.error('No response received from server');
      } else {
        console.error('Request setup error:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      const response = await api.post('/api/friends/request', { userId });
      if (response.data.success) {
        // Update UI to show request sent
        setSearchResults(prev => 
          prev.map(user => 
            user._id === userId 
              ? { ...user, friendRequestSent: true }
              : user
          )
        );
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
    }
  };

  const acceptFriendRequest = async (requestId) => {
    try {
      const response = await api.post('/api/friends/accept', { requestId });
      if (response.data.success) {
        fetchFriends();
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
    }
  };

  const getOnlineStatus = (lastSeen) => {
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMinutes = (now - lastSeenDate) / (1000 * 60);
    
    if (diffMinutes < 5) return 'online';
    if (diffMinutes < 30) return 'away';
    return 'offline';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'friends'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Friends ({friends.length})
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'search'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          Add Friends
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'friends' ? (
          <motion.div
            key="friends"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Your Friends</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {friends.length > 0 ? (
                friends.map((friend) => (
                  <motion.div
                    key={friend._id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {friend.username[0].toUpperCase()}
                        </div>
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 ${getStatusColor(getOnlineStatus(friend.lastSeen))} rounded-full border-2 border-white dark:border-gray-700`}></div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{friend.username}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Rating: {friend.chessRating}</div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <motion.button
                        onClick={() => onChallengePlayer(friend)}
                        className="px-3 py-1 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={getOnlineStatus(friend.lastSeen) === 'offline'}
                      >
                        Challenge
                      </motion.button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">👥</div>
                  <p className="text-gray-500 dark:text-gray-400">No friends yet. Add some friends to start playing!</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="search"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <h3 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Find Players</h3>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchUsers(e.target.value);
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {loading ? (
                <div className="text-center py-4">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((user) => (
                  <motion.div
                    key={user._id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900 dark:text-white">{user.username}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Rating: {user.chessRating ?? "N/A"}</div>
                      </div>
                    </div>
                    <motion.button
                      onClick={() => sendFriendRequest(user._id)}
                      disabled={user.friendRequestSent}
                      className={`px-3 py-1 text-sm font-medium rounded-lg transition-all duration-300 ${
                        user.friendRequestSent
                          ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                      }`}
                      whileHover={!user.friendRequestSent ? { scale: 1.05 } : {}}
                      whileTap={!user.friendRequestSent ? { scale: 0.95 } : {}}
                    >
                      {user.friendRequestSent ? 'Sent' : 'Add Friend'}
                    </motion.button>
                  </motion.div>
                ))
              ) : searchQuery && !loading ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🔍</div>
                  <p className="text-gray-500 dark:text-gray-400">No users found</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎯</div>
                  <p className="text-gray-500 dark:text-gray-400">Search for players to add as friends</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FriendsList;