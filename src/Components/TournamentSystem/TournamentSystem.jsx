import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

const TournamentSystem = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await axios.get('/api/tournaments');
      if (response.data.success) {
        setTournaments(response.data.tournaments);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinTournament = async (tournamentId) => {
    try {
      const response = await axios.post(`/api/tournaments/${tournamentId}/join`);
      if (response.data.success) {
        fetchTournaments();
      }
    } catch (error) {
      console.error('Error joining tournament:', error);
    }
  };

  const getTournamentStatus = (tournament) => {
    const now = new Date();
    const startTime = new Date(tournament.startTime);
    const endTime = new Date(tournament.endTime);

    if (now < startTime) return 'upcoming';
    if (now >= startTime && now <= endTime) return 'active';
    return 'completed';
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
        <h2 className="text-3xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent mb-4">
          Tournament System
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Join weekly tournaments and compete for glory!
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {tournaments.map((tournament) => {
            const status = getTournamentStatus(tournament);
            const isParticipant = tournament.participants.some(p => p.userId === user.id);
            
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
                  {isParticipant && (
                    <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-xs font-medium">
                      Joined
                    </div>
                  )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {tournament.name}
                </h3>
                
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
            New tournaments are created automatically every week. Check back soon!
          </p>
        </div>
      )}

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
                      <span className="ml-2 font-medium">{selectedTournament.timeControl}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Prize Pool:</span>
                      <span className="ml-2 font-medium">{selectedTournament.prizePool} points</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Participants ({selectedTournament.participants.length})
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
                  </div>
                </div>

                {selectedTournament.bracket && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      Tournament Bracket
                    </h3>
                    {/* Tournament bracket visualization would go here */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
                      <p className="text-gray-600 dark:text-gray-400">
                        Bracket visualization coming soon...
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TournamentSystem;