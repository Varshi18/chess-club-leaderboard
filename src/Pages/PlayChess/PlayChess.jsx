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
  const [gameInProgress, setGameInProgress] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleChallengePlayer = (friendData) => {
    const newGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setGameId(newGameId);
    setOpponent({
      id: friendData.id,
      username: friendData.username,
      chessRating: friendData.chessRating
    });
    setActiveMode('multiplayer');
    setGameInProgress(true);
  };

  const handleGameEnd = () => {
    setGameInProgress(false);
    setGameId(null);
    setOpponent(null);
    setActiveMode('friends');
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

  // Prevent navigation away during active game
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameInProgress) {
        e.preventDefault();
        e.returnValue = 'You have an active game. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    const handlePopState = (e) => {
      if (gameInProgress) {
        const confirmLeave = window.confirm('You have an active game. Are you sure you want to leave?');
        if (!confirmLeave) {
          window.history.pushState(null, '', window.location.pathname);
        } else {
          handleGameEnd();
        }
      }
    };

    if (gameInProgress) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      // Push current state to prevent back navigation
      window.history.pushState(null, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [gameInProgress]);

  return (
   <div className="min-h-screen relative overflow-hidden pt-20">
      <div className="fixed inset-0 z-0">
        <ThreeBackground />
      </div>
      <div className="relative z-10 min-h-screen bg-white/20 dark:bg-black/20 backdrop-blur-[2px] transition-all duration-500">
      
      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <motion.div 
            className={`text-center mb-8 sm:mb-12 transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.h1 
            className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4, repeat: Infinity }}>
              Play Chess
            </motion.h1>
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
                  <div className="flex space-x-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg">
                    {gameModes.map((mode) => (
                      <motion.button
                        key={mode.id}
                        onClick={() => !gameInProgress && setActiveMode(mode.id)}
                        disabled={gameInProgress && mode.id !== activeMode}
                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                          activeMode === mode.id
                            ? `bg-gradient-to-r ${mode.color} text-white shadow-lg`
                            : gameInProgress
                            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        whileHover={!gameInProgress ? { scale: 1.05 } : {}}
                        whileTap={!gameInProgress ? { scale: 0.95 } : {}}
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
                  <div className="flex space-x-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg">
                    {gameModes.map((mode) => (
                      <motion.button
                        key={mode.id}
                        onClick={() => !gameInProgress && setActiveMode(mode.id)}
                        disabled={gameInProgress && mode.id !== activeMode}
                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                          activeMode === mode.id
                            ? `bg-gradient-to-r ${mode.color} text-white shadow-lg`
                            : gameInProgress
                            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        whileHover={!gameInProgress ? { scale: 1.05 } : {}}
                        whileTap={!gameInProgress ? { scale: 0.95 } : {}}
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
                  <div className="flex space-x-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-2 shadow-lg">
                    {gameModes.map((mode) => (
                      <motion.button
                        key={mode.id}
                        onClick={() => !gameInProgress && setActiveMode(mode.id)}
                        disabled={gameInProgress && mode.id !== activeMode}
                        className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                          activeMode === mode.id
                            ? `bg-gradient-to-r ${mode.color} text-white shadow-lg`
                            : gameInProgress
                            ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        whileHover={!gameInProgress ? { scale: 1.05 } : {}}
                        whileTap={!gameInProgress ? { scale: 0.95 } : {}}
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
                    onClick={handleGameEnd}
                    className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    ← End Game & Return
                  </motion.button>
                </div>
                <MultiplayerChess 
                  gameMode="multiplayer" 
                  gameId={gameId} 
                  opponent={opponent}
                  onGameEnd={handleGameEnd}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game In Progress Warning */}
          {gameInProgress && (
            <motion.div
              className="fixed bottom-4 right-4 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
            >
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Game in progress</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default PlayChess;