import React, { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import GameTimer from '../GameTimer/GameTimer';
import { useAuth } from '../../context/AuthContext';

const MultiplayerChess = ({
  gameMode = 'practice',
  gameId = null,
  opponent = null,
  onPgnUpdate,
  trackCapturedPieces,
  onGameEnd,
  initialTimeControl = 600,
}) => {
  const [game, setGame] = useState(new Chess());
  const [gamePosition, setGamePosition] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameStatus, setGameStatus] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
  const [playerColor, setPlayerColor] = useState('white');
  const [gameResult, setGameResult] = useState(null);
  const [showGameOver, setShowGameOver] = useState(false);
  const [timeControl, setTimeControl] = useState({ white: initialTimeControl, black: initialTimeControl });
  const [activePlayer, setActivePlayer] = useState('white');
  const [isPaused, setIsPaused] = useState(false);
  const [gameStarted, setGameStarted] = useState(gameMode === 'practice');
  const [waitingForOpponent, setWaitingForOpponent] = useState(gameMode === 'multiplayer' && opponent != null);
  
  const { user } = useAuth();

  useEffect(() => {
    console.log('MultiplayerChess mounted:', { gameMode, gameId, opponent, gameStarted, waitingForOpponent, initialTimeControl }); // Debug log
    if (onPgnUpdate) {
      onPgnUpdate(game.pgn());
    }
  }, [game, onPgnUpdate, gameMode, gameId, opponent, gameStarted, waitingForOpponent, initialTimeControl]);

  const updateGameStatus = useCallback((gameInstance) => {
    if (gameInstance.isGameOver()) {
      let status, result;
      if (gameInstance.isCheckmate()) {
        const winner = gameInstance.turn() === 'w' ? 'Black' : 'White';
        status = `Checkmate! ${winner} wins!`;
        result = { winner, reason: 'checkmate' };
      } else if (gameInstance.isDraw()) {
        let reason = 'draw';
        if (gameInstance.isStalemate()) {
          status = 'Draw by stalemate';
          reason = 'stalemate';
        } else if (gameInstance.isThreefoldRepetition()) {
          status = 'Draw by threefold repetition';
          reason = 'repetition';
        } else if (gameInstance.isInsufficientMaterial()) {
          status = 'Draw by insufficient material';
          reason = 'insufficient_material';
        } else {
          status = 'Draw by 50-move rule';
          reason = 'fifty_move';
        }
        result = { winner: null, reason };
      }
      setGameStatus(status);
      if (gameMode === 'multiplayer') {
        setGameResult(result);
        setShowGameOver(true);
        if (onGameEnd) {
          onGameEnd();
        }
      }
    } else if (gameInstance.isCheck()) {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  }, [gameMode, onGameEnd]);

  const updateCapturedPieces = useCallback((history) => {
    if (!trackCapturedPieces) return;
    
    const captured = { white: [], black: [] };
    history.forEach(move => {
      if (move.captured) {
        const piece = move.captured;
        const color = move.color === 'w' ? 'black' : 'white';
        captured[color].push(piece.toLowerCase());
      }
    });
    
    setCapturedPieces(captured);
    console.log('Captured pieces updated:', captured); // Debug log
  }, [trackCapturedPieces]);

  const makeMove = useCallback((sourceSquare, targetSquare, piece) => {
    if (gameMode === 'multiplayer' && (!gameStarted || game.turn() !== playerColor[0])) {
      console.log('Move blocked:', { gameStarted, turn: game.turn(), playerColor }); // Debug log
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
        setActivePlayer(game.turn() === 'w' ? 'white' : 'black');
        console.log('Move made:', move); // Debug log
        return true;
      }
    } catch (error) {
      console.log('Invalid move:', error);
    }
    
    return false;
  }, [game, gameMode, playerColor, gameStarted, updateGameStatus, updateCapturedPieces]);

  const onSquareClick = useCallback((square) => {
    if (gameMode === 'multiplayer' && (!gameStarted || game.turn() !== playerColor[0])) {
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
  }, [game, selectedSquare, makeMove, gameMode, playerColor, gameStarted]);

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
    setTimeControl({ white: initialTimeControl, black: initialTimeControl });
    setActivePlayer('white');
    setIsPaused(false);
    setGameStarted(gameMode === 'practice');
    setWaitingForOpponent(gameMode === 'multiplayer' && opponent != null);
    updateGameStatus(newGame);
    if (onPgnUpdate) {
      onPgnUpdate(newGame.pgn());
    }
    console.log('Game reset:', { gameMode, gameStarted, waitingForOpponent, initialTimeControl }); // Debug log
  }, [updateGameStatus, gameMode, onPgnUpdate, opponent, initialTimeControl]);

  const handleTimeUp = useCallback((player) => {
    const winner = player === 'white' ? 'Black' : 'White';
    setGameResult({ winner, reason: 'timeout' });
    setShowGameOver(true);
    setIsPaused(true);
    if (onGameEnd) {
      onGameEnd();
    }
    console.log('Time up:', { player, winner }); // Debug log
  }, [onGameEnd]);

  const acceptGame = useCallback(() => {
    setGameStarted(true);
    setWaitingForOpponent(false);
    setIsPaused(false);
    console.log('Game accepted:', { gameId, opponent, timeControl }); // Debug log
  }, [gameId, opponent, timeControl]);

  const declineGame = useCallback(() => {
    if (onGameEnd) {
      onGameEnd();
    }
    console.log('Game declined:', { gameId, opponent }); // Debug log
  }, [onGameEnd, gameId, opponent]);

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
      p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
      P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔'
    };
    return symbols[piece] || piece;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="grid lg:grid-cols-4 gap-6 sm:gap-8">
        {/* Timers */}
        {gameMode !== 'practice' && gameStarted && (
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
            <div className="aspect-square max-w-[500px] mx-auto">
              <Chessboard
                position={gamePosition}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                customSquareStyles={customSquareStyles}
                boardOrientation={gameMode === 'multiplayer' ? playerColor : 'white'}
                animationDuration={200}
                arePiecesDraggable={!game.isGameOver() && (gameMode === 'practice' || (gameStarted && game.turn() === playerColor[0]))}
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
              {waitingForOpponent ? 'Waiting for opponent...' : gameStatus}
            </motion.div>
            
            {gameMode === 'multiplayer' && opponent && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Playing against:</div>
                <div className="font-semibold text-gray-900 dark:text-white">{opponent.username}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Rating: {opponent.chessRating}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Time: {timeControl.white / 60} min</div>
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
              
              {gameMode === 'multiplayer' && gameStarted && (
                <motion.button
                  onClick={() => setIsPaused(!isPaused)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </motion.button>
              )}

              {gameMode === 'multiplayer' && !gameStarted && (
                <div className="space-y-2">
                  <motion.button
                    onClick={acceptGame}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Accept Game
                  </motion.button>
                  <motion.button
                    onClick={declineGame}
                    className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Decline Game
                  </motion.button>
                </div>
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
                        key={`white-${piece}-${index}`} 
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
                        key={`black-${piece}-${index}`} 
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
            <div className="max-h-48 overflow-y-auto pr-2">
              {moveHistory.length > 0 ? (
                <div className="space-y-1">
                  <AnimatePresence>
                    {moveHistory.map((move, index) => (
                      <motion.div 
                        key={`move-${index}-${move.san}`} 
                        className="flex justify-between items-center py-1 px-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
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
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {move.color === 'w' ? '♔' : '♚'}
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
                    onClick={() => {
                      setShowGameOver(false);
                      if (onGameEnd) onGameEnd();
                    }}
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

      {/* Game Invitation Modal */}
      <AnimatePresence>
        {gameMode === 'multiplayer' && waitingForOpponent && opponent && (
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
                <div className="text-6xl mb-4">⚔️</div>
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  Game Invitation
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {opponent.username} has challenged you to a chess game! ({timeControl.white / 60} min)
                </p>
                <div className="flex gap-4">
                  <motion.button
                    onClick={declineGame}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Decline
                  </motion.button>
                  <motion.button
                    onClick={acceptGame}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Accept
                  </motion.button>
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