import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const TournamentSystem = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    format: 'single-elimination',
    timeControl: '600',
    maxParticipants: '16',
    startTime: '',
    endTime: '',
    prizePool: '0'
  });
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const api = axios.create({
    baseURL: '/api',
    headers: { 'Content-Type': 'application/json' },
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/?endpoint=tournaments');
      if (response.data.success) {
        setTournaments(response.data.tournaments);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      setError('Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  };

  const joinTournament = async (tournamentId) => {
    try {
      const response = await api.post(`/?endpoint=tournaments&action=join&tournamentId=${tournamentId}`);
      if (response.data.success) {
        fetchTournaments();
        setError(null);
        alert('Successfully joined tournament!');
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error('Error joining tournament:', error);
      setError('Failed to join tournament');
    }
  };

  const createTournament = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/?endpoint=tournaments', {
        ...createForm,
        timeControl: parseInt(createForm.timeControl),
        maxParticipants: parseInt(createForm.maxParticipants),
        prizePool: parseInt(createForm.prizePool)
      });
      
      if (response.data.success) {
        setShowCreateModal(false);
        setCreateForm({
          name: '',
          description: '',
          format: 'single-elimination',
          timeControl: '600',
          maxParticipants: '16',
          startTime: '',
          endTime: '',
          prizePool: '0'
        });
        fetchTournaments();
        setError(null);
        alert('Tournament created successfully!');
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
      setError('Failed to create tournament');
    }
  };

  const deleteTournament = async (tournamentId) => {
    if (!confirm('Are you sure you want to delete this tournament?')) return;
    
    try {
      const response = await api.delete(`/?endpoint=tournaments&tournamentId=${tournamentId}`);
      if (response.data.success) {
        fetchTournaments();
        setError(null);
        alert('Tournament deleted successfully!');
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error('Error deleting tournament:', error);
      setError('Failed to delete tournament');
    }
  };

  const getTournamentStatus = (tournament) => {
    const now = new Date();
    const startTime = new Date(tournament.startTime);
    const endTime = tournament.endTime ? new Date(tournament.endTime) : null;

    if (now < startTime) return 'upcoming';
    if (endTime && now > endTime) return 'completed';
    if (now >= startTime) return 'active';
    return 'upcoming';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'from-blue-500 to-blue-600';
      case 'active': return 'from-green-500 to-green-600';
      case 'completed': return 'from-gray-500 to-gray-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'upcoming': return '🚀';
      case 'active': return '⚡';
      case 'completed': return '🏆';
      default: return '📅';
    }
  };

  const formatTimeRemaining = (startTime) => {
    const now = new Date();
    const start = new Date(startTime);
    const diff = start - now;

    if (diff <= 0) return 'Started';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-yellow-200 dark:border-yellow-800 rounded-full animate-spin"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-4 mb-4">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            Tournament System
          </h2>
          {user?.role === 'admin' && (
            <motion.button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Create Tournament
            </motion.button>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Join tournaments and compete for glory!
        </p>
      </div>

      {error && (
        <motion.div
          className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-center"
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {tournaments.map((tournament) => {
            const status = getTournamentStatus(tournament);
            const isParticipant = tournament.participants.some(p => p.userId === user?.id);
            
            return (
              <motion.div
                key={tournament.id}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700 hover:shadow-3xl transition-all duration-300"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ scale: 1.02, y: -5 }}
                layout
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${getStatusColor(status)}`}>
                    <span className="mr-1">{getStatusIcon(status)}</span>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </div>
                  <div className="flex items-center gap-2">
                    {isParticipant && (
                      <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                        Joined
                      </div>
                    )}
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => deleteTournament(tournament.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Delete Tournament"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {tournament.name}
                </h3>
                
                {tournament.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {tournament.description}
                  </p>
                )}
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    {status === 'upcoming' ? `Starts in ${formatTimeRemaining(tournament.startTime)}` : 
                     status === 'active' ? 'In Progress' : 'Completed'}
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                    </svg>
                    {tournament.participants.length} / {tournament.maxParticipants} players
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Prize: {tournament.prizePool} points
                  </div>

                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    {Math.floor(tournament.timeControl / 60)} min games
                  </div>
                </div>

                <div className="flex space-x-2">
                  {!isParticipant && status === 'upcoming' && tournament.participants.length < tournament.maxParticipants && (
                    <motion.button
                      onClick={() => joinTournament(tournament.id)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Join Tournament
                    </motion.button>
                  )}
                  
                  <motion.button
                    onClick={() => setSelectedTournament(tournament)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    View Details
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {tournaments.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No tournaments available
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {user?.role === 'admin' ? 'Create the first tournament!' : 'Check back soon for new tournaments!'}
          </p>
        </div>
      )}

      {/* Create Tournament Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Create Tournament
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={createTournament} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tournament Name *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Format *
                    </label>
                    <select
                      value={createForm.format}
                      onChange={(e) => setCreateForm({ ...createForm, format: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="single-elimination">Single Elimination</option>
                      <option value="double-elimination">Double Elimination</option>
                      <option value="round-robin">Round Robin</option>
                      <option value="swiss">Swiss System</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Time Control *
                    </label>
                    <select
                      value={createForm.timeControl}
                      onChange={(e) => setCreateForm({ ...createForm, timeControl: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    >
                      <option value="300">5 minutes</option>
                      <option value="600">10 minutes</option>
                      <option value="900">15 minutes</option>
                      <option value="1800">30 minutes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Participants *
                    </label>
                    <input
                      type="number"
                      value={createForm.maxParticipants}
                      onChange={(e) => setCreateForm({ ...createForm, maxParticipants: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="4"
                      max="64"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Prize Pool (points)
                    </label>
                    <input
                      type="number"
                      value={createForm.prizePool}
                      onChange={(e) => setCreateForm({ ...createForm, prizePool: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      min="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Start Time *
                    </label>
                    <input
                      type="datetime-local"
                      value={createForm.startTime}
                      onChange={(e) => setCreateForm({ ...createForm, startTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      End Time (optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={createForm.endTime}
                      onChange={(e) => setCreateForm({ ...createForm, endTime: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700"
                  >
                    Create Tournament
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tournament Details Modal */}
      <AnimatePresence>
        {selectedTournament && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedTournament(null)}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedTournament.name}
                </h2>
                <button
                  onClick={() => setSelectedTournament(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Tournament Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <span className="ml-2 font-medium">{getTournamentStatus(selectedTournament)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Format:</span>
                      <span className="ml-2 font-medium">{selectedTournament.format}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Time Control:</span>
                      <span className="ml-2 font-medium">{Math.floor(selectedTournament.timeControl / 60)} min</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Prize Pool:</span>
                      <span className="ml-2 font-medium">{selectedTournament.prizePool} points</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Start Time:</span>
                      <span className="ml-2 font-medium">{new Date(selectedTournament.startTime).toLocaleString()}</span>
                    </div>
                    {selectedTournament.endTime && (
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">End Time:</span>
                        <span className="ml-2 font-medium">{new Date(selectedTournament.endTime).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Participants ({selectedTournament.participants.length}/{selectedTournament.maxParticipants})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedTournament.participants.map((participant, index) => (
                      <div key={participant.userId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {participant.username[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              {participant.username}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Rating: {participant.rating}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          #{index + 1}
                        </div>
                      </div>
                    ))}
                    {selectedTournament.participants.length === 0 && (
                      <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                        No participants yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TournamentSystem;