import React, { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import GameTimer from '../GameTimer/GameTimer';
import { useAuth } from '../../context/AuthContext';
import io from 'socket.io-client';

const MultiplayerChess = ({ gameMode = 'practice', gameId = null, opponent = null }) => {
  const [game, setGame] = useState(new Chess());
  const [gamePosition, setGamePosition] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameStatus, setGameStatus] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [playerColor, setPlayerColor] = useState('white');
  const [socket, setSocket] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [timeControl, setTimeControl] = useState({ white: 600, black: 600 });
  const [activePlayer, setActivePlayer] = useState('white');
  const [isPaused, setIsPaused] = useState(false);
  
  const { user } = useAuth();

  // Socket connection for multiplayer
  useEffect(() => {
    if (gameMode === 'multiplayer' && gameId) {
      const newSocket = io(process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');
      setSocket(newSocket);

      newSocket.emit('join-game', { gameId, userId: user.id });

      newSocket.on('game-state', (state) => {
        const gameInstance = new Chess(state.fen);
        setGame(gameInstance);
        setGamePosition(state.fen);
        setMoveHistory(state.moveHistory || []);
        setPlayerColor(state.playerColor);
        setTimeControl(state.timeControl || { white: 600, black: 600 });
        setActivePlayer(state.activePlayer || 'white');
        updateGameStatus(gameInstance);
      });

      newSocket.on('move-made', (moveData) => {
        const gameInstance = new Chess(moveData.fen);
        setGame(gameInstance);
        setGamePosition(moveData.fen);
        setMoveHistory(moveData.moveHistory);
        setTimeControl(moveData.timeControl);
        setActivePlayer(moveData.activePlayer);
        updateGameStatus(gameInstance);
        updateCapturedPieces(moveData.moveHistory);
      });

      newSocket.on('game-over', (result) => {
        setGameResult(result);
        setShowGameOver(true);
        setIsPaused(true);
      });

      return () => {
        newSocket.disconnect();
      };
    }
  }, [gameMode, gameId, user.id]);

  const updateGameStatus = useCallback((gameInstance) => {
    if (gameInstance.isCheckmate()) {
      const winner = gameInstance.turn() === 'w' ? 'Black' : 'White';
      setGameStatus(`Checkmate! ${winner} wins!`);
      if (gameMode === 'multiplayer') {
        setGameResult({ winner, reason: 'checkmate' });
        setShowGameOver(true);
      }
    } else if (gameInstance.isDraw()) {
      let reason = 'draw';
      if (gameInstance.isStalemate()) {
        setGameStatus('Draw by stalemate');
        reason = 'stalemate';
      } else if (gameInstance.isThreefoldRepetition()) {
        setGameStatus('Draw by threefold repetition');
        reason = 'repetition';
      } else if (gameInstance.isInsufficientMaterial()) {
        setGameStatus('Draw by insufficient material');
        reason = 'insufficient_material';
      } else {
        setGameStatus('Draw by 50-move rule');
        reason = 'fifty_move';
      }
      if (gameMode === 'multiplayer') {
        setGameResult({ winner: null, reason });
        setShowGameOver(true);
      }
    } else if (gameInstance.isCheck()) {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  }, [gameMode]);

  const updateCapturedPieces = useCallback((history) => {
    const captured = { white: [], black: [] };
    
    history.forEach(move => {
      if (move.captured) {
        const piece = move.captured;
        const color = move.color === 'w' ? 'black' : 'white';
        captured[color].push(piece);
      }
    });
    
    setCapturedPieces(captured);
  }, []);

  const calculateRatingChange = (playerRating, opponentRating, result) => {
    const K = 32; // K-factor
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    const actualScore = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
    return Math.round(K * (actualScore - expectedScore));
  };

  const makeMove = useCallback((sourceSquare, targetSquare, piece) => {
    // In multiplayer, only allow moves if it's the player's turn
    if (gameMode === 'multiplayer' && game.turn() !== playerColor[0]) {
      return false;
    }

    const gameCopy = new Chess(game.fen());
    
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece?.[1]?.toLowerCase() ?? 'q'
      });

      if (move) {
        setGame(gameCopy);
        setGamePosition(gameCopy.fen());
        const newHistory = gameCopy.history({ verbose: true });
        setMoveHistory(newHistory);
        updateGameStatus(gameCopy);
        updateCapturedPieces(newHistory);
        setSelectedSquare(null);
        setPossibleMoves([]);
        
        // Switch active player
        const newActivePlayer = game.turn() === 'w' ? 'black' : 'white';
        setActivePlayer(newActivePlayer);

        // Send move to server in multiplayer mode
        if (gameMode === 'multiplayer' && socket) {
          socket.emit('make-move', {
            gameId,
            move: {
              from: sourceSquare,
              to: targetSquare,
              promotion: piece?.[1]?.toLowerCase() ?? 'q'
            },
            fen: gameCopy.fen(),
            moveHistory: newHistory,
            timeControl,
            activePlayer: newActivePlayer
          });
        }
        
        return true;
      }
    } catch (error) {
      console.log('Invalid move:', error);
    }
    
    return false;
  }, [game, gameMode, playerColor, socket, gameId, timeControl, updateGameStatus, updateCapturedPieces]);

  const onSquareClick = useCallback((square) => {
    // In multiplayer, only allow interaction if it's the player's turn
    if (gameMode === 'multiplayer' && game.turn() !== playerColor[0]) {
      return;
    }

    const piece = game.get(square);
    
    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else {
        const moveAttempted = makeMove(selectedSquare, square);
        if (!moveAttempted) {
          if (piece && piece.color === game.turn()) {
            setSelectedSquare(square);
            const moves = game.moves({ square, verbose: true });
            setPossibleMoves(moves.map(move => move.to));
          } else {
            setSelectedSquare(null);
            setPossibleMoves([]);
          }
        }
      }
    } else {
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setPossibleMoves(moves.map(move => move.to));
      }
    }
  }, [game, selectedSquare, makeMove, gameMode, playerColor]);

  const onPieceDrop = useCallback((sourceSquare, targetSquare, piece) => {
    return makeMove(sourceSquare, targetSquare, piece);
  }, [makeMove]);

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setGamePosition(newGame.fen());
    setMoveHistory([]);
    setSelectedSquare(null);
    setPossibleMoves([]);
    setCapturedPieces({ white: [], black: [] });
    setGameResult(null);
    setShowGameOver(false);
    setTimeControl({ white: 600, black: 600 });
    setActivePlayer('white');
    setIsPaused(false);
    updateGameStatus(newGame);
  }, [updateGameStatus]);

  const handleTimeUp = useCallback((player) => {
    const winner = player === 'white' ? 'Black' : 'White';
    setGameResult({ winner, reason: 'timeout' });
    setShowGameOver(true);
    setIsPaused(true);
    
    if (gameMode === 'multiplayer' && socket) {
      socket.emit('time-up', { gameId, player });
    }
  }, [gameMode, socket, gameId]);

  const customSquareStyles = {};
  
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = {
      backgroundColor: 'rgba(255, 255, 0, 0.4)'
    };
  }
  
  possibleMoves.forEach(square => {
    customSquareStyles[square] = {
      background: 'radial-gradient(circle, rgba(0,0,0,.1) 25%, transparent 25%)',
      borderRadius: '50%'
    };
  });

  const getPieceSymbol = (piece) => {
    const symbols = {
      'p': '♟', 'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚',
      'P': '♙', 'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔'
    };
    return symbols[piece] || piece;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      <div className="grid lg:grid-cols-4 gap-6 sm:gap-8">
        {/* Timers */}
        {gameMode !== 'practice' && (
          <div className="lg:col-span-1 space-y-4">
            <GameTimer
              initialTime={timeControl.black}
              isActive={activePlayer === 'black' && !isPaused}
              onTimeUp={handleTimeUp}
              player="black"
              isPaused={isPaused}
            />
            <GameTimer
              initialTime={timeControl.white}
              isActive={activePlayer === 'white' && !isPaused}
              onTimeUp={handleTimeUp}
              player="white"
              isPaused={isPaused}
            />
          </div>
        )}

        {/* Chess Board */}
        <div className={gameMode === 'practice' ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="aspect-square max-w-full mx-auto">
              <Chessboard
                position={gamePosition}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                customSquareStyles={customSquareStyles}
                boardOrientation={gameMode === 'multiplayer' ? playerColor : 'white'}
                animationDuration={200}
                arePiecesDraggable={!game.isGameOver() && (gameMode === 'practice' || game.turn() === playerColor[0])}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* Game Info Panel */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          {/* Game Status */}
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Game Status</h3>
            <motion.div 
              className={`p-3 sm:p-4 rounded-lg text-center font-medium ${
                gameStatus.includes('Checkmate') || gameStatus.includes('wins') 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                  : gameStatus.includes('Draw') 
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  : gameStatus.includes('check')
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              }`}
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {gameStatus}
            </motion.div>
            
            {gameMode === 'multiplayer' && opponent && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Playing against:</div>
                <div className="font-semibold text-gray-900 dark:text-white">{opponent.username}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Rating: {opponent.rating}</div>
              </div>
            )}
          </motion.div>

          {/* Game Controls */}
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Controls</h3>
            <div className="space-y-3">
              {gameMode === 'practice' && (
                <motion.button
                  onClick={resetGame}
                  className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  New Game
                </motion.button>
              )}
              
              {gameMode === 'multiplayer' && (
                <motion.button
                  onClick={() => setIsPaused(!isPaused)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Captured Pieces */}
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Captured Pieces</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">White Captured:</h4>
                <div className="flex flex-wrap gap-1">
                  <AnimatePresence>
                    {capturedPieces.white.map((piece, index) => (
                      <motion.span 
                        key={index} 
                        className="text-2xl"
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -180 }}
                        transition={{ duration: 0.3 }}
                      >
                        {getPieceSymbol(piece.toUpperCase())}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  {capturedPieces.white.length === 0 && (
                    <span className="text-gray-400 dark:text-gray-500 text-sm">None</span>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Black Captured:</h4>
                <div className="flex flex-wrap gap-1">
                  <AnimatePresence>
                    {capturedPieces.black.map((piece, index) => (
                      <motion.span 
                        key={index} 
                        className="text-2xl"
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -180 }}
                        transition={{ duration: 0.3 }}
                      >
                        {getPieceSymbol(piece.toLowerCase())}
                      </motion.span>
                    ))}
                  </AnimatePresence>
                  {capturedPieces.black.length === 0 && (
                    <span className="text-gray-400 dark:text-gray-500 text-sm">None</span>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Move History */}
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Move History</h3>
            <div className="max-h-48 overflow-y-auto">
              {moveHistory.length > 0 ? (
                <div className="space-y-1">
                  <AnimatePresence>
                    {moveHistory.map((move, index) => (
                      <motion.div 
                        key={index} 
                        className="flex justify-between items-center py-1 px-2 rounded text-sm"
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                      >
                        <span className="text-gray-600 dark:text-gray-400">
                          {Math.floor(index / 2) + 1}.{index % 2 === 0 ? '' : '..'}
                        </span>
                        <span className="font-mono text-gray-900 dark:text-white">
                          {move.san}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center">No moves yet</p>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Game Over Modal */}
      <AnimatePresence>
        {showGameOver && gameResult && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center">
                <div className="text-6xl mb-4">
                  {gameResult.winner ? '🏆' : '🤝'}
                </div>
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  {gameResult.winner ? `${gameResult.winner} Wins!` : "It's a Draw!"}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {gameResult.reason === 'checkmate' && 'By checkmate'}
                  {gameResult.reason === 'timeout' && 'By timeout'}
                  {gameResult.reason === 'stalemate' && 'By stalemate'}
                  {gameResult.reason === 'repetition' && 'By threefold repetition'}
                  {gameResult.reason === 'insufficient_material' && 'By insufficient material'}
                  {gameResult.reason === 'fifty_move' && 'By 50-move rule'}
                </p>
                <div className="flex gap-4">
                  <motion.button
                    onClick={() => setShowGameOver(false)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Close
                  </motion.button>
                  {gameMode === 'practice' && (
                    <motion.button
                      onClick={() => {
                        resetGame();
                        setShowGameOver(false);
                      }}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      New Game
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MultiplayerChess;