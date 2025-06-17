import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MultiplayerChess from '../../Components/MultiplayerChess/MultiplayerChess';
import FriendsList from '../../Components/FriendsList/FriendsList';
import TournamentSystem from '../../Components/TournamentSystem/TournamentSystem';
import ThreeBackground from '../../Components/ThreeBackground/ThreeBackground';
import { useAuth } from '../../context/AuthContext';

const PlayChess = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeMode, setActiveMode] = useState('practice');
  const [gameId, setGameId] = useState(null);
  const [opponent, setOpponent] = useState(null);
  const [gameInProgress, setGameInProgress] = useState(false);
  const [pgn, setPgn] = useState('');
  const [timeControl, setTimeControl] = useState(600);
  const [allMoves, setAllMoves] = useState([]); // Store all moves for export
  const { user } = useAuth();

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleChallengePlayer = (friendData) => {
    console.log('Challenging player:', friendData);
    if (!friendData?.id || !friendData?.username || friendData.id === user?.id) {
      console.error('Invalid friend data or attempting to challenge self:', friendData);
      return;
    }
    const newGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setGameId(newGameId);
    setOpponent({
      id: friendData.id,
      username: friendData.username,
      chessRating: friendData.chessRating || 0,
    });
    setTimeControl(friendData.timeControl || 600);
    setActiveMode('multiplayer');
    setGameInProgress(true);
    setAllMoves([]); // Reset moves for new game
    console.log('Challenge set up:', { gameId: newGameId, opponent: friendData, timeControl: friendData.timeControl });
  };

  const handleGameEnd = () => {
    console.log('Ending game');
    setGameInProgress(false);
    setGameId(null);
    setOpponent(null);
    setTimeControl(600);
    setActiveMode('friends');
    // Don't reset PGN and moves here - keep them for export
  };

  const handleResign = () => {
    if (window.confirm('Are you sure you want to resign? This will end the game.')) {
      console.log('Player resigned');
      handleGameEnd();
    }
  };

  const handlePgnUpdate = (newPgn) => {
    console.log('PGN updated:', newPgn);
    setPgn(newPgn);
    
    // Parse moves from PGN for the moves list
    if (newPgn) {
      const lines = newPgn.split('\n');
      const moveLines = lines.filter(line => !line.startsWith('[') && line.trim() !== '');
      const movesText = moveLines.join(' ');
      const moveMatches = movesText.match(/\d+\.\s*([^\s]+)(?:\s+([^\s]+))?/g);
      
      if (moveMatches) {
        const moves = [];
        moveMatches.forEach(match => {
          const parts = match.split(/\d+\.\s*/)[1];
          if (parts) {
            const [whiteMove, blackMove] = parts.split(/\s+/);
            if (whiteMove && whiteMove !== '1-0' && whiteMove !== '0-1' && whiteMove !== '1/2-1/2') {
              moves.push(whiteMove);
            }
            if (blackMove && blackMove !== '1-0' && blackMove !== '0-1' && blackMove !== '1/2-1/2') {
              moves.push(blackMove);
            }
          }
        });
        setAllMoves(moves);
      }
    }
  };

  const exportPgn = () => {
    if (!pgn) {
      alert('No game data available to export.');
      return;
    }
    const blob = new Blob([pgn], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chess_game_${Date.now()}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const gameModes = [
    { id: 'practice', title: 'Practice Mode', description: 'Play against yourself or practice openings', icon: '🎯', color: 'from-blue-500 to-blue-600' },
    { id: 'friends', title: 'Play with Friends', description: 'Challenge your friends to a game', icon: '👥', color: 'from-green-500 to-blue-600' },
    { id: 'tournaments', title: 'Tournaments', description: 'Join weekly tournaments and compete', icon: '🏆', color: 'from-yellow-500 to-yellow-600' },
  ];

  // Prevent navigation during multiplayer games
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameInProgress && activeMode === 'multiplayer') {
        e.preventDefault();
        e.returnValue = 'You are in a multiplayer game. Resign to leave the game.';
        return e.returnValue;
      }
    };

    const handlePopState = (e) => {
      if (gameInProgress && activeMode === 'multiplayer') {
        e.preventDefault();
        alert('You cannot leave a multiplayer game. Please resign to exit.');
        window.history.pushState(null, '', window.location.pathname);
      }
    };

    if (gameInProgress && activeMode === 'multiplayer') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      window.history.pushState(null, '', window.location.pathname);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [gameInProgress, activeMode]);

  return (
    <div className="min-h-screen relative overflow-hidden pt-20">
      <div className="fixed inset-0 z-0">
        <ThreeBackground />
      </div>
      <div className="relative z-10 min-h-screen bg-white/20 dark:bg-black/20 backdrop-blur-[2px] transition-all duration-500">
        <div className="relative z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
            <motion.div
              className={`text-center mb-8 sm:mb-12 transform transition-all duration-1000 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
              }`}
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              <motion.h1
                className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              >
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
                  <div className="flex flex-col xl:flex-row gap-6">
                    <div className="flex-1">
                      <MultiplayerChess
                        gameMode="practice"
                        onPgnUpdate={handlePgnUpdate}
                        trackCapturedPieces={true}
                        onGameEnd={handleGameEnd}
                        initialTimeControl={timeControl}
                      />
                    </div>
                    <div className="w-full xl:w-80 space-y-4">
                      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Game Controls</h3>
                        <motion.button
                          onClick={exportPgn}
                          className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 mb-4"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          Export PGN
                        </motion.button>
                      </div>
                      
                      {/* Move History */}
                      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Move List</h3>
                        <div className="max-h-64 overflow-y-auto">
                          {allMoves.length > 0 ? (
                            <div className="space-y-1">
                              {Array.from({ length: Math.ceil(allMoves.length / 2) }, (_, i) => (
                                <div key={i} className="flex items-center justify-between py-1 px-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                  <span className="text-gray-600 dark:text-gray-400 w-8">
                                    {i + 1}.
                                  </span>
                                  <span className="font-mono text-gray-900 dark:text-white flex-1 text-left">
                                    {allMoves[i * 2] || ''}
                                  </span>
                                  <span className="font-mono text-gray-900 dark:text-white flex-1 text-left">
                                    {allMoves[i * 2 + 1] || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 dark:text-gray-500 text-sm text-center">No moves yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
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
                  <div className="flex justify-center">
                    <FriendsList onChallengePlayer={handleChallengePlayer} />
                  </div>
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
                  <div className="mb-8 flex justify-center gap-4">
                    <motion.button
                      onClick={handleResign}
                      className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Resign
                    </motion.button>
                    <motion.button
                      onClick={exportPgn}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      Export PGN
                    </motion.button>
                  </div>
                  <div className="flex flex-col xl:flex-row gap-6">
                    <div className="flex-1">
                      <MultiplayerChess
                        gameMode="multiplayer"
                        gameId={gameId}
                        opponent={opponent}
                        onGameEnd={handleGameEnd}
                        onPgnUpdate={handlePgnUpdate}
                        trackCapturedPieces={true}
                        initialTimeControl={timeControl}
                      />
                    </div>
                    <div className="w-full xl:w-80 space-y-4">
                      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
                        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Game Info</h3>
                        {opponent && (
                          <div className="space-y-2 text-sm">
                            <p className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Opponent:</span> {opponent.username}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Rating:</span> {opponent.chessRating}
                            </p>
                            <p className="text-gray-600 dark:text-gray-400">
                              <span className="font-medium">Time Control:</span> {timeControl / 60} minutes
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Move History */}
                      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
                        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Move List</h3>
                        <div className="max-h-64 overflow-y-auto">
                          {allMoves.length > 0 ? (
                            <div className="space-y-1">
                              {Array.from({ length: Math.ceil(allMoves.length / 2) }, (_, i) => (
                                <div key={i} className="flex items-center justify-between py-1 px-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700">
                                  <span className="text-gray-600 dark:text-gray-400 w-8">
                                    {i + 1}.
                                  </span>
                                  <span className="font-mono text-gray-900 dark:text-white flex-1 text-left">
                                    {allMoves[i * 2] || ''}
                                  </span>
                                  <span className="font-mono text-gray-900 dark:text-white flex-1 text-left">
                                    {allMoves[i * 2 + 1] || ''}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 dark:text-gray-500 text-sm text-center">No moves yet</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {gameInProgress && (
              <motion.div
                className="fixed bottom-4 right-4 bg-orange-600 text-white px-4 py-2 rounded-lg shadow-lg z-50"
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