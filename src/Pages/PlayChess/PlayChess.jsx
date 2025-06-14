import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MultiplayerChess from '../../Components/MultiplayerChess/MultiplayerChess';
import FriendsList from '../../Components/FriendsList/FriendsList';
import TournamentSystem from '../../Components/TournamentSystem/TournamentSystem';
import ThreeBackground from '../../Components/ThreeBackground/ThreeBackground';

const PlayChess = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeMode, setActiveMode] = useState('practice');
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState(null);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleChallengePlayer = (friend) => {
    setSelectedFriend(friend);
    setShowChallengeModal(true);
  };

  const startGame = (mode, options = {}) => {
    setActiveMode(mode);
    if (mode === 'multiplayer') {
      setGameId(options.gameId);
      setOpponent(options.opponent);
    }
    setShowChallengeModal(false);
  };

  const gameModes = [
    {
      id: 'practice',
      title: 'Practice Mode',
      description: 'Play against yourself or practice openings',
      icon: '🎯',
      color: 'from-blue-500 to-blue-600'
    },
    {
      id: 'friends',
      title: 'Play with Friends',
      description: 'Challenge your friends to a game',
      icon: '👥',
      color: 'from-green-500 to-green-600'
    },
    {
      id: 'tournaments',
      title: 'Tournaments',
      description: 'Join weekly tournaments and compete',
      icon: '🏆',
      color: 'from-yellow-500 to-yellow-600'
    }
  ];

  return (
   <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 z-0">
        <ThreeBackground />
      </div>
      <div className="relative z-10 min-h-screen bg-white/20 dark:bg-black/20 backdrop-blur-[2px] transition-all duration-500">
      
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <motion.div 
            className={`text-center mb-8 sm:mb-12 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
              Play Chess
            </h1>
            <div className="w-16 sm:w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mb-4 sm:mb-6"></div>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4">
              Choose your game mode and start playing
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {activeMode === 'practice' && (
              <motion.div
                key="practice"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8 flex justify-center">
                  <div className="flex space-x-4 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-lg">
                    {gameModes.map((mode) => (
                      <motion.button
                        key={mode.id}
                        onClick={() => setActiveMode(mode.id)}
                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                          activeMode === mode.id
                            ? `bg-gradient-to-r ${mode.color} text-white shadow-lg`
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="text-xl mr-2">{mode.icon}</span>
                        <span className="hidden sm:inline">{mode.title}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
                <MultiplayerChess gameMode="practice" />
              </motion.div>
            )}

            {activeMode === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8 flex justify-center">
                  <div className="flex space-x-4 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-lg">
                    {gameModes.map((mode) => (
                      <motion.button
                        key={mode.id}
                        onClick={() => setActiveMode(mode.id)}
                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                          activeMode === mode.id
                            ? `bg-gradient-to-r ${mode.color} text-white shadow-lg`
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="text-xl mr-2">{mode.icon}</span>
                        <span className="hidden sm:inline">{mode.title}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
                <FriendsList onChallengePlayer={handleChallengePlayer} />
              </motion.div>
            )}

            {activeMode === 'tournaments' && (
              <motion.div
                key="tournaments"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8 flex justify-center">
                  <div className="flex space-x-4 bg-white dark:bg-gray-800 rounded-2xl p-2 shadow-lg">
                    {gameModes.map((mode) => (
                      <motion.button
                        key={mode.id}
                        onClick={() => setActiveMode(mode.id)}
                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                          activeMode === mode.id
                            ? `bg-gradient-to-r ${mode.color} text-white shadow-lg`
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="text-xl mr-2">{mode.icon}</span>
                        <span className="hidden sm:inline">{mode.title}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
                <TournamentSystem />
              </motion.div>
            )}

            {activeMode === 'multiplayer' && (
              <motion.div
                key="multiplayer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-8 flex justify-center">
                  <motion.button
                    onClick={() => setActiveMode('friends')}
                    className="px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    ← Back to Friends
                  </motion.button>
                </div>
                <MultiplayerChess 
                  gameMode="multiplayer" 
                  gameId={gameId} 
                  opponent={opponent} 
                />
              </motion.div>
            )}
          </AnimatePresence>

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
                      { name: 'Blitz', time: '5+0', minutes: 5 },
                      { name: 'Rapid', time: '10+0', minutes: 10 },
                      { name: 'Classical', time: '30+0', minutes: 30 }
                    ].map((timeControl) => (
                      <motion.button
                        key={timeControl.name}
                        onClick={() => startGame('multiplayer', {
                          gameId: `game_${Date.now()}`,
                          opponent: selectedFriend,
                          timeControl: timeControl.minutes * 60
                        })}
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
                      onClick={() => setShowChallengeModal(false)}
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
        </div>
      </div>
    </div>
    </div>
  );
};

export default PlayChess;