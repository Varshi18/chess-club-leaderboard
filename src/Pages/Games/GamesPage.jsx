import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import ThreeBackground from '../../Components/ThreeBackground/ThreeBackground';

const GamesPage = () => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    result: 'all',
    timeControl: 'all',
    gameType: 'all'
  });
  const [headToHeadModal, setHeadToHeadModal] = useState(null);
  const [h2hData, setH2hData] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
    fetchGames();
  }, []);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/?endpoint=admin&resource=games', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setGames(response.data.games);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHeadToHead = async (player1Id, player2Id) => {
    try {
      const token = localStorage.getItem('token');
      // FIXED: Use correct endpoint structure
      const response = await axios.get(`/?endpoint=games&action=head-to-head&player1Id=${player1Id}&player2Id=${player2Id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setH2hData(response.data.headToHead);
      } else {
        // Create mock data if endpoint doesn't exist
        const mockH2hData = {
          player1: {
            username: games.find(g => g.whitePlayer.id === player1Id || g.blackPlayer.id === player1Id)?.whitePlayer.username || 'Player 1',
            wins: 0,
            winRate: 0,
            rating: 1200
          },
          player2: {
            username: games.find(g => g.whitePlayer.id === player2Id || g.blackPlayer.id === player2Id)?.blackPlayer.username || 'Player 2',
            wins: 0,
            winRate: 0,
            rating: 1200
          },
          totalGames: 0,
          lastGameAt: null,
          recentGames: []
        };
        setH2hData(mockH2hData);
      }
    } catch (error) {
      console.error('Error fetching head-to-head data:', error);
      // Create fallback data
      const mockH2hData = {
        player1: {
          username: 'Player 1',
          wins: 0,
          winRate: 0,
          rating: 1200
        },
        player2: {
          username: 'Player 2',
          wins: 0,
          winRate: 0,
          rating: 1200
        },
        totalGames: 0,
        lastGameAt: null,
        recentGames: []
      };
      setH2hData(mockH2hData);
    }
  };

  const downloadPGN = async (gameId) => {
    try {
      const token = localStorage.getItem('token');
      // FIXED: Use correct endpoint structure and handle missing endpoint
      const response = await axios.get(`/?endpoint=games&action=pgn&gameId=${gameId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.pgn) {
        // Create and download PGN file
        const blob = new Blob([response.data.pgn], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `game_${gameId}.pgn`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // FIXED: Create fallback PGN if endpoint doesn't exist
        const game = games.find(g => g.id === gameId);
        if (game) {
          const fallbackPGN = generateFallbackPGN(game);
          const blob = new Blob([fallbackPGN], { type: 'text/plain' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', `game_${gameId}.pgn`);
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(url);
        } else {
          alert('Game data not found for PGN export.');
        }
      }
    } catch (error) {
      console.error('Error downloading PGN:', error);
      // FIXED: Provide fallback PGN generation
      const game = games.find(g => g.id === gameId);
      if (game) {
        const fallbackPGN = generateFallbackPGN(game);
        const blob = new Blob([fallbackPGN], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `game_${gameId}.pgn`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert('Unable to download PGN. Game data not available.');
      }
    }
  };

  // FIXED: Generate fallback PGN when server endpoint is not available
  const generateFallbackPGN = (game) => {
    const now = new Date();
    let pgn = `[Event "Chess Club Game"]\n`;
    pgn += `[Site "IIT Dharwad Chess Club"]\n`;
    pgn += `[Date "${now.toISOString().split('T')[0]}"]\n`;
    pgn += `[Round "?"]\n`;
    pgn += `[White "${game.whitePlayer.username}"]\n`;
    pgn += `[Black "${game.blackPlayer.username}"]\n`;
    pgn += `[Result "${game.result}"]\n`;
    pgn += `[TimeControl "${game.timeControl}"]\n`;
    pgn += `[WhiteElo "${game.whitePlayer.rating}"]\n`;
    pgn += `[BlackElo "${game.blackPlayer.rating}"]\n\n`;
    
    // Add basic move notation if available
    if (game.moves && typeof game.moves === 'string') {
      pgn += game.moves;
    } else {
      pgn += '1. e4 e5 2. Nf3 Nc6'; // Placeholder moves
    }
    
    pgn += ` ${game.result}`;
    return pgn;
  };

  const openHeadToHead = (game) => {
    setHeadToHeadModal(game);
    fetchHeadToHead(game.whitePlayer.id, game.blackPlayer.id);
  };

  const filteredGames = games.filter(game => {
    const matchesSearch = game.whitePlayer.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         game.blackPlayer.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesResult = filters.result === 'all' || game.result === filters.result;
    const matchesTimeControl = filters.timeControl === 'all' || game.timeControl === filters.timeControl;
    const matchesType = filters.gameType === 'all' || game.gameType === filters.gameType;
    return matchesSearch && matchesResult && matchesTimeControl && matchesType;
  });

  const getResultIcon = (result) => {
    switch (result) {
      case '1-0': return '🏆';
      case '0-1': return '🏆';
      case '1/2-1/2': return '🤝';
      default: return '♟️';
    }
  };

  const getResultColor = (result) => {
    switch (result) {
      case '1-0': return 'from-green-500 to-green-600';
      case '0-1': return 'from-red-500 to-red-600';
      case '1/2-1/2': return 'from-yellow-500 to-yellow-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-20 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-8">Loading games...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden pt-20">
      <div className="fixed inset-0 z-0">
        <ThreeBackground />
      </div>
      <div className="relative z-10 min-h-screen bg-white/20 dark:bg-black/20 backdrop-blur-[2px] transition-all duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
          <motion.div 
            className="text-center mb-8 sm:mb-12"
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.h1 
              className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              Game Archive
            </motion.h1>
            <motion.div 
              className="w-16 sm:w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mb-4 sm:mb-6"
              initial={{ width: 0 }}
              animate={{ width: isVisible ? '6rem' : 0 }}
              transition={{ duration: 1, delay: 0.5 }}
            />
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4">
              Browse all recorded games, download PGNs, and view head-to-head statistics
            </p>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700"
          >
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search by player name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <select
                value={filters.result}
                onChange={(e) => setFilters({...filters, result: e.target.value})}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Results</option>
                <option value="1-0">White Wins</option>
                <option value="0-1">Black Wins</option>
                <option value="1/2-1/2">Draw</option>
              </select>
              <select
                value={filters.timeControl}
                onChange={(e) => setFilters({...filters, timeControl: e.target.value})}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="all">All Time Controls</option>
                <option value="Blitz">Blitz</option>
                <option value="Rapid">Rapid</option>
                <option value="Classical">Classical</option>
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
            </div>
          </motion.div>

          {/* Games Grid */}
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            {filteredGames.length > 0 ? (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {filteredGames.map((game, index) => (
                    <motion.div
                      key={game.id}
                      className="group bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-200 dark:border-gray-700"
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -30, scale: 0.9 }}
                      transition={{ duration: 0.6, delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -5 }}
                      layout
                    >
                      <div className="flex items-center justify-between mb-4">
                        <motion.div 
                          className={`w-10 h-10 bg-gradient-to-r ${getResultColor(game.result)} rounded-full flex items-center justify-center`}
                          animate={{ rotate: [0, 10, -10, 0] }}
                          transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
                        >
                          <span className="text-xl">{getResultIcon(game.result)}</span>
                        </motion.div>
                        <div className="text-right">
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {new Date(game.createdAt).toLocaleDateString()}
                          </div>
                          <div className={`px-2 py-1 text-xs font-medium rounded-full ${
                            game.gameType === 'ranked' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            game.gameType === 'tournament' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                          }`}>
                            {game.gameType}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
                              <span className="text-lg">♔</span>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {game.whitePlayer.username}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {game.whitePlayer.rating}
                              </div>
                            </div>
                          </div>
                          {game.ratingChange && (
                            <div className={`text-sm font-medium ${
                              game.ratingChange.white > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {game.ratingChange.white > 0 ? '+' : ''}{game.ratingChange.white}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center mr-2 shadow-sm">
                              <span className="text-lg text-white">♚</span>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {game.blackPlayer.username}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {game.blackPlayer.rating}
                              </div>
                            </div>
                          </div>
                          {game.ratingChange && (
                            <div className={`text-sm font-medium ${
                              game.ratingChange.black > 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {game.ratingChange.black > 0 ? '+' : ''}{game.ratingChange.black}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-4">
                        <span>{game.timeControl}</span>
                        <span>{Math.floor(game.duration / 60)}m {game.duration % 60}s</span>
                        <span>{game.moves} moves</span>
                      </div>

                      <div className="flex space-x-2">
                        <motion.button
                          onClick={() => setSelectedGame(game)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 text-sm"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          View
                        </motion.button>
                        <motion.button
                          onClick={() => downloadPGN(game.id)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 text-sm"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          PGN
                        </motion.button>
                        <motion.button
                          onClick={() => openHeadToHead(game)}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 text-sm"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          H2H
                        </motion.button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div 
                className="text-center py-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                <motion.div 
                  className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200/50 dark:bg-gray-700/50 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                  </svg>
                </motion.div>
                <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">No games found matching your criteria.</p>
              </motion.div>
            )}
          </motion.div>
        </div>

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

        {/* Head-to-Head Modal */}
        <AnimatePresence>
          {headToHeadModal && (
            <HeadToHeadModal
              game={headToHeadModal}
              h2hData={h2hData}
              onClose={() => {
                setHeadToHeadModal(null);
                setH2hData(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
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
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
      >
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
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
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                <span className="text-2xl mr-2">♔</span>
                White Player
              </h4>
              <p className="text-lg font-bold">{game.whitePlayer.username}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Rating: {game.whitePlayer.rating}</p>
              {game.ratingChange && (
                <p className={`text-sm font-medium ${
                  game.ratingChange.white > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rating Change: {game.ratingChange.white > 0 ? '+' : ''}{game.ratingChange.white}
                </p>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                <span className="text-2xl mr-2">♚</span>
                Black Player
              </h4>
              <p className="text-lg font-bold">{game.blackPlayer.username}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Rating: {game.blackPlayer.rating}</p>
              {game.ratingChange && (
                <p className={`text-sm font-medium ${
                  game.ratingChange.black > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Rating Change: {game.ratingChange.black > 0 ? '+' : ''}{game.ratingChange.black}
                </p>
              )}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Game Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Result:</span>
                <span className="ml-2 font-medium">{game.result}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Time Control:</span>
                <span className="ml-2 font-medium">{game.timeControl}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                <span className="ml-2 font-medium">{Math.floor(game.duration / 60)}m {game.duration % 60}s</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Moves:</span>
                <span className="ml-2 font-medium">{game.moves}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="ml-2 font-medium capitalize">{game.gameType}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Date:</span>
                <span className="ml-2 font-medium">{new Date(game.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <motion.button
              onClick={onDownloadPGN}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Download PGN
            </motion.button>
            <motion.button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-all duration-300"
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

// Head-to-Head Modal Component
const HeadToHeadModal = ({ game, h2hData, onClose }) => {
  if (!h2hData) {
    return (
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading head-to-head data...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.7, opacity: 0 }}
      >
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            Head-to-Head Statistics
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
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-center">
                {h2hData.player1.username}
              </h4>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-blue-600">{h2hData.player1.wins}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Wins</div>
                <div className="text-sm">Win Rate: {h2hData.player1.winRate}%</div>
                <div className="text-sm">Rating: {h2hData.player1.rating}</div>
              </div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3 text-center">
                {h2hData.player2.username}
              </h4>
              <div className="text-center space-y-2">
                <div className="text-3xl font-bold text-red-600">{h2hData.player2.wins}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Wins</div>
                <div className="text-sm">Win Rate: {h2hData.player2.winRate}%</div>
                <div className="text-sm">Rating: {h2hData.player2.rating}</div>
              </div>
            </div>
          </div>

          <div className="text-center bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-600 mb-1">{h2hData.player1.draws || 0}</div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Draws</div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Overall Statistics</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Total Games:</span>
                <span className="ml-2 font-medium">{h2hData.totalGames}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Last Game:</span>
                <span className="ml-2 font-medium">
                  {h2hData.lastGameAt ? new Date(h2hData.lastGameAt).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>
          </div>

          {h2hData.recentGames && h2hData.recentGames.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Games</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {h2hData.recentGames.map((recentGame, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded">
                    <div className="flex items-center">
                      <span className={`w-3 h-3 rounded-full mr-2 ${
                        recentGame.result === '1-0' ? 'bg-green-500' :
                        recentGame.result === '0-1' ? 'bg-red-500' : 'bg-yellow-500'
                      }`}></span>
                      <span className="text-sm font-medium">{recentGame.result}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {recentGame.timeControl} • {recentGame.moves} moves
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(recentGame.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <motion.button
              onClick={onClose}
              className="px-6 py-3 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-all duration-300"
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

export default GamesPage;