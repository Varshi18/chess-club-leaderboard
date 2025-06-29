import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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
  const [friendRequests, setFriendRequests] = useState([]);
  const [receivedChallenges, setReceivedChallenges] = useState([]);
  const [sentChallenges, setSentChallenges] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('friends');
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchFriends();
    fetchFriendRequests();
    fetchReceivedChallenges();
    fetchSentChallenges();
    
    // Poll for new challenges and accepted challenges every 2 seconds
    const interval = setInterval(() => {
      fetchReceivedChallenges();
      fetchSentChallenges();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchFriends = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/?endpoint=friends');
      if (response.data.success) {
        setFriends(response.data.friends || []);
      } else {
        setError('Failed to load friends.');
        setFriends([]);
      }
    } catch (error) {
      console.error('Error fetching friends:', error.message);
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    try {
      const response = await api.get('/?endpoint=friends&type=requests');
      if (response.data.success) {
        setFriendRequests(response.data.requests || []);
      }
    } catch (error) {
      console.error('Error fetching friend requests:', error.message);
      setFriendRequests([]);
    }
  };

  const fetchReceivedChallenges = async () => {
    try {
      const response = await api.get('/?endpoint=challenges&action=received');
      if (response.data.success) {
        setReceivedChallenges(response.data.challenges || []);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error.message);
      setReceivedChallenges([]);
    }
  };

  const fetchSentChallenges = async () => {
    try {
      const response = await api.get('/?endpoint=challenges&action=sent');
      if (response.data.success) {
        const challenges = response.data.challenges || [];
        
        // FIXED: Only show pending challenges to prevent confusion
        const pendingChallenges = challenges.filter(c => c.status === 'pending');
        setSentChallenges(pendingChallenges);
        
        // FIXED: Check for accepted challenges and redirect BOTH players
        const acceptedChallenge = challenges.find(c => c.status === 'accepted' && c.gameId);
        if (acceptedChallenge && onChallengePlayer) {
          console.log('🎯 Challenge accepted! Redirecting challenger to game:', acceptedChallenge);
          
          // Mark challenge as completed to prevent re-triggering
          try {
            await api.patch('/?endpoint=challenges&action=complete', {
              challengeId: acceptedChallenge.id
            });
          } catch (error) {
            console.error('Error marking challenge as completed:', error);
          }
          
          // Redirect challenger to game
          onChallengePlayer({
            id: acceptedChallenge.challenged.id,
            username: acceptedChallenge.challenged.username,
            chessRating: acceptedChallenge.challenged.chessRating,
            timeControl: acceptedChallenge.timeControl,
            gameId: acceptedChallenge.gameId
          });
          
          // Show notification
          setTimeout(() => {
            alert(`🎉 ${acceptedChallenge.challenged.username} accepted your challenge! Starting game...`);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Error fetching sent challenges:', error.message);
      setSentChallenges([]);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/?endpoint=friends&q=${encodeURIComponent(query)}`);
      if (response.data.success) {
        setSearchResults(response.data.users.filter((u) => u.id !== user?.id));
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error.message);
      setSearchResults([]);
      setError('Error searching users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      const response = await api.post('/?endpoint=friends', { userId });
      if (response.data.success) {
        setSearchResults((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, friendRequestSent: true } : user
          )
        );
        setError(null);
      } else {
        setError(response.data.message || 'Failed to send friend request.');
      }
    } catch (error) {
      console.error('Error sending friend request:', error.message);
      setError('Error sending friend request. Please try again.');
    }
  };

  const acceptFriendRequest = async (requestId) => {
    try {
      const response = await api.patch('/?endpoint=friends', { requestId, action: 'accept' });
      if (response.data.success) {
        fetchFriends();
        fetchFriendRequests();
        setError(null);
      } else {
        setError(response.data.message || 'Failed to accept friend request.');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error.message);
      setError('Error accepting friend request. Please try again.');
    }
  };

  const rejectFriendRequest = async (requestId) => {
    try {
      const response = await api.patch('/?endpoint=friends', { requestId, action: 'reject' });
      if (response.data.success) {
        fetchFriendRequests();
        setError(null);
      } else {
        setError(response.data.message || 'Failed to reject friend request.');
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error.message);
      setError('Error rejecting friend request. Please try again.');
    }
  };

  const sendChallenge = async (friendId, timeControl) => {
    try {
      const response = await api.post('/?endpoint=challenges&action=send', {
        challengedUserId: friendId,
        timeControl: timeControl
      });
      
      if (response.data.success) {
        setShowChallengeModal(false);
        setSelectedFriend(null);
        setError(null);
        
        // Add to sent challenges list
        fetchSentChallenges();
        
        alert('🚀 Challenge sent successfully! You will be notified when accepted.');
      } else {
        setError('Failed to send challenge: ' + (response.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending challenge:', error.message);
      setError('Error sending challenge. Please try again.');
    }
  };

  const respondToChallenge = async (challengeId, response) => {
    try {
      const apiResponse = await api.patch('/?endpoint=challenges&action=respond', {
        challengeId,
        response
      });
      
      if (apiResponse.data.success) {
        fetchReceivedChallenges();
        
        if (response === 'accept' && onChallengePlayer) {
          // Find the challenge to get challenger info
          const challenge = receivedChallenges.find(c => c.id === challengeId);
          if (challenge) {
            console.log('🎯 Accepting challenge and redirecting accepter to game:', challenge);
            
            // FIXED: Both players should be redirected to the same game
            onChallengePlayer({
              id: challenge.challenger.id,
              username: challenge.challenger.username,
              chessRating: challenge.challenger.chessRating,
              timeControl: challenge.timeControl,
              gameId: apiResponse.data.gameId
            });
            
            // Show notification that game is starting
            setTimeout(() => {
              alert(`🎉 Challenge accepted! Starting game against ${challenge.challenger.username}...`);
            }, 500);
          }
        }
        setError(null);
      } else {
        setError('Failed to respond to challenge: ' + (apiResponse.data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error responding to challenge:', error.message);
      setError('Error responding to challenge. Please try again.');
    }
  };

  const cancelChallenge = async (challengeId) => {
    try {
      const response = await api.delete(`/?endpoint=challenges&action=cancel&challengeId=${challengeId}`);
      if (response.data.success) {
        fetchSentChallenges();
        setError(null);
        alert('Challenge cancelled successfully.');
      } else {
        setError(response.data.message || 'Failed to cancel challenge.');
      }
    } catch (error) {
      console.error('Error canceling challenge:', error.message);
      setError('Error canceling challenge. Please try again.');
    }
  };

  const handleChallengeClick = (friend) => {
    if (friend.id === user?.id) {
      setError('Cannot challenge yourself.');
      return;
    }
    setSelectedFriend(friend);
    setShowChallengeModal(true);
  };

  const getOnlineStatus = (lastSeen) => {
    if (!lastSeen) return 'offline';
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    if (isNaN(lastSeenDate.getTime())) return 'offline';
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
    <>
      <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-6xl mx-auto">
        {error && (
          <motion.div
            className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </motion.div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 lg:gap-4 mb-4 lg:mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-3 lg:px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm lg:text-base whitespace-nowrap ${
              activeTab === 'friends'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Friends ({friends.length})
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 lg:px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm lg:text-base whitespace-nowrap ${
              activeTab === 'search'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Add Friends
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3 lg:px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm lg:text-base whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Requests ({friendRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('challenges')}
            className={`px-3 lg:px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm lg:text-base whitespace-nowrap ${
              activeTab === 'challenges'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Challenges ({receivedChallenges.length})
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-3 lg:px-4 py-2 rounded-lg font-medium transition-all duration-300 text-sm lg:text-base whitespace-nowrap ${
              activeTab === 'sent'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            Sent ({sentChallenges.length})
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg lg:text-xl font-bold mb-4 text-gray-900 dark:text-white">Your Friends</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                {loading ? (
                  <div className="col-span-full text-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                    <motion.div
                      key={friend.id}
                      className="flex flex-col p-3 bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-lg hover:bg-gray-100/80 dark:hover:bg-gray-600/80 transition-colors duration-200"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="relative">
                          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {friend.username[0].toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 w-3 h-3 ${getStatusColor(getOnlineStatus(friend.lastSeen))} rounded-full border-2 border-white dark:border-gray-700`}></div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{friend.username}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Rating: {friend.chessRating || 'N/A'}</div>
                        </div>
                      </div>
                      <motion.button
                        onClick={() => handleChallengeClick(friend)}
                        className="w-full px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={friend.id === user?.id}
                      >
                        Challenge
                      </motion.button>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <div className="text-4xl mb-4">👥</div>
                    <p className="text-gray-500 dark:text-gray-400">
                      No friends yet. Add some friends to start playing!
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg lg:text-xl font-bold mb-4 text-gray-900 dark:text-white">Find Players</h3>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    searchUsers(e.target.value);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white/80 dark:bg-gray-700/80 backdrop-blur-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="col-span-full text-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <motion.div
                      key={user.id}
                      className="flex flex-col p-3 bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-lg"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {user.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{user.username}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Rating: {user.chessRating ?? 'N/A'}</div>
                        </div>
                      </div>
                      <motion.button
                        onClick={() => sendFriendRequest(user.id)}
                        disabled={user.friendRequestSent || user.isFriend}
                        className={`w-full px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                          user.friendRequestSent
                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                            : user.isFriend
                            ? 'bg-green-300 dark:bg-green-600 text-green-800 dark:text-green-200 cursor-not-allowed'
                            : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                        }`}
                        whileHover={!user.friendRequestSent && !user.isFriend ? { scale: 1.05 } : {}}
                        whileTap={!user.friendRequestSent && !user.isFriend ? { scale: 0.95 } : {}}
                      >
                        {user.isFriend ? 'Friends' : user.friendRequestSent ? 'Sent' : 'Add Friend'}
                      </motion.button>
                    </motion.div>
                  ))
                ) : searchQuery && !loading ? (
                  <div className="col-span-full text-center py-8">
                    <div className="text-4xl mb-4">🔍</div>
                    <p className="text-gray-500 dark:text-gray-400">No users found</p>
                  </div>
                ) : (
                  <div className="col-span-full text-center py-8">
                    <div className="text-4xl mb-4">🎯</div>
                    <p className="text-gray-500 dark:text-gray-400">Search for players to add as friends</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg lg:text-xl font-bold mb-4 text-gray-900 dark:text-white">Friend Requests</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="col-span-full text-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  </div>
                ) : friendRequests.length > 0 ? (
                  friendRequests.map((request) => (
                    <motion.div
                      key={request.id}
                      className="flex flex-col p-3 bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-lg"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-yellow-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {request.sender.username[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{request.sender.username}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">Rating: {request.sender.chessRating ?? 'N/A'}</div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <motion.button
                          onClick={() => acceptFriendRequest(request.id)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Accept
                        </motion.button>
                        <motion.button
                          onClick={() => rejectFriendRequest(request.id)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Reject
                        </motion.button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <div className="text-4xl mb-4">📭</div>
                    <p className="text-gray-500 dark:text-gray-400">No incoming friend requests</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'challenges' && (
            <motion.div
              key="challenges"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg lg:text-xl font-bold mb-4 text-gray-900 dark:text-white">Game Challenges</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-80 overflow-y-auto">
                {receivedChallenges.length > 0 ? (
                  receivedChallenges.map((challenge) => (
                    <motion.div
                      key={challenge.id}
                      className="flex flex-col p-3 bg-yellow-50/80 dark:bg-yellow-900/20 backdrop-blur-sm rounded-lg border border-yellow-200 dark:border-yellow-800"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          ⚔️
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                            {challenge.challenger.username} challenges you!
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {challenge.timeControl / 60} min • Rating: {challenge.challenger.chessRating}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <motion.button
                          onClick={() => respondToChallenge(challenge.id, 'accept')}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white text-sm font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Accept
                        </motion.button>
                        <motion.button
                          onClick={() => respondToChallenge(challenge.id, 'decline')}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Decline
                        </motion.button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <div className="text-4xl mb-4">⚔️</div>
                    <p className="text-gray-500 dark:text-gray-400">No pending challenges</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'sent' && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-lg lg:text-xl font-bold mb-4 text-gray-900 dark:text-white">Sent Challenges</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-80 overflow-y-auto">
                {sentChallenges.length > 0 ? (
                  sentChallenges.map((challenge) => (
                    <motion.div
                      key={challenge.id}
                      className="flex flex-col p-3 bg-blue-50/80 dark:bg-blue-900/20 backdrop-blur-sm rounded-lg border border-blue-200 dark:border-blue-800"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          📤
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                            Challenge to {challenge.challenged.username}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {challenge.timeControl / 60} min • Status: {challenge.status}
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {challenge.status === 'pending' && (
                          <motion.button
                            onClick={() => cancelChallenge(challenge.id)}
                            className="flex-1 px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            Cancel
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                    <div className="text-4xl mb-4">📤</div>
                    <p className="text-gray-500 dark:text-gray-400">No sent challenges</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Challenge Modal */}
      <AnimatePresence>
        {showChallengeModal && selectedFriend && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
            >
              <div className="text-center mb-6">
                <div className="text-4xl mb-4">⚔️</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Challenge {selectedFriend.username}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Choose your time control for the game
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  { name: 'Blitz', time: '5+0', seconds: 300 },
                  { name: 'Rapid', time: '10+0', seconds: 600 },
                  { name: 'Classical', time: '30+0', seconds: 1800 },
                ].map((timeControl) => (
                  <motion.button
                    key={timeControl.name}
                    onClick={() => sendChallenge(selectedFriend.id, timeControl.seconds)}
                    className="w-full p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 text-left"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {timeControl.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {timeControl.time} minutes
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="flex space-x-3">
                <motion.button
                  onClick={() => {
                    setShowChallengeModal(false);
                    setSelectedFriend(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FriendsList;