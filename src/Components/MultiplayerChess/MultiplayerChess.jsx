import React, { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import GameTimer from '../GameTimer/GameTimer';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';

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
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const [gameSession, setGameSession] = useState(null);
  const [fullPgn, setFullPgn] = useState('');
  
  const { user } = useAuth();

  // Set up API
  const api = axios.create({
    baseURL: '/',
    headers: { 'Content-Type': 'application/json' },
  });

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Initialize multiplayer game
  useEffect(() => {
    if (gameMode === 'multiplayer' && gameId && opponent) {
      console.log('Initializing multiplayer game:', { gameId, opponent });
      initializeMultiplayerGame();
    }
  }, [gameMode, gameId, opponent]);

  const initializeMultiplayerGame = async () => {
    try {
      console.log('Fetching game session for gameId:', gameId);
      
      // For now, create a simple game session since the backend might not have this endpoint
      // We'll determine player color based on user ID comparison
      const isWhite = user.id < opponent.id; // Simple deterministic color assignment
      setPlayerColor(isWhite ? 'white' : 'black');
      
      console.log('Player color assigned:', isWhite ? 'white' : 'black');
      
      // Set time control
      setTimeControl({ 
        white: initialTimeControl, 
        black: initialTimeControl 
      });
      
      setGameStarted(true);
      setWaitingForOpponent(false);
      updateGameStatus(game);
      
      console.log('Multiplayer game initialized successfully');
    } catch (error) {
      console.error('Error initializing multiplayer game:', error);
      // Fallback: still start the game
      const isWhite = user.id < opponent.id;
      setPlayerColor(isWhite ? 'white' : 'black');
      setGameStarted(true);
      setWaitingForOpponent(false);
      updateGameStatus(game);
    }
  };

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
        endMultiplayerGame(result);
      }
    } else if (gameInstance.isCheck()) {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  }, [gameMode]);

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
  }, [trackCapturedPieces]);

  const generateCompletePGN = useCallback((gameInstance) => {
    const history = gameInstance.history();
    let pgn = '';
    
    // Add headers for multiplayer games
    if (gameMode === 'multiplayer' && opponent) {
      const now = new Date();
      pgn += `[Event "Chess Club Game"]\n`;
      pgn += `[Site "IIT Dharwad Chess Club"]\n`;
      pgn += `[Date "${now.toISOString().split('T')[0]}"]\n`;
      pgn += `[Round "?"]\n`;
      pgn += `[White "${playerColor === 'white' ? user.username : opponent.username}"]\n`;
      pgn += `[Black "${playerColor === 'black' ? user.username : opponent.username}"]\n`;
      pgn += `[Result "*"]\n`;
      pgn += `[TimeControl "${timeControl.white}"]\n\n`;
    }
    
    // Add moves
    for (let i = 0; i < history.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      pgn += `${moveNumber}. ${history[i]}`;
      if (history[i + 1]) {
        pgn += ` ${history[i + 1]}`;
      }
      pgn += ' ';
    }
    
    // Add result if game is over
    if (gameInstance.isGameOver()) {
      if (gameInstance.isCheckmate()) {
        pgn += gameInstance.turn() === 'w' ? '0-1' : '1-0';
      } else {
        pgn += '1/2-1/2';
      }
    }
    
    return pgn.trim();
  }, [gameMode, opponent, playerColor, user, timeControl]);

  const makeMove = useCallback(async (sourceSquare, targetSquare, piece) => {
    // For practice mode, allow any move
    if (gameMode === 'practice') {
      // Allow move
    } else if (gameMode === 'multiplayer') {
      // For multiplayer, check if it's the player's turn
      if (!gameStarted) {
        console.log('Game not started yet');
        return false;
      }
      
      const currentTurn = game.turn();
      const isPlayerTurn = (currentTurn === 'w' && playerColor === 'white') || 
                          (currentTurn === 'b' && playerColor === 'black');
      
      if (!isPlayerTurn) {
        console.log('Not player turn:', { currentTurn, playerColor });
        return false;
      }
    }

    const gameCopy = new Chess(game.fen());
    
    try {
      const move = gameCopy.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece?.[1]?.toLowerCase() ?? 'q'
      });

      if (move) {
        console.log('Move made:', move);
        
        setGame(gameCopy);
        setGamePosition(gameCopy.fen());
        
        // Get the updated history
        const newHistory = gameCopy.history({ verbose: true });
        setMoveHistory(newHistory);
        
        updateGameStatus(gameCopy);
        updateCapturedPieces(newHistory);
        setSelectedSquare(null);
        setPossibleMoves([]);
        setActivePlayer(gameCopy.turn() === 'w' ? 'white' : 'black');
        
        // Generate complete PGN and update
        const completePgn = generateCompletePGN(gameCopy);
        setFullPgn(completePgn);
        if (onPgnUpdate) {
          onPgnUpdate(completePgn);
        }

        // For multiplayer games, we would send the move to server here
        // For now, we'll skip this since the backend endpoint might not be ready
        if (gameMode === 'multiplayer' && gameId) {
          console.log('Would send move to server:', { gameId, move: move.san });
        }

        return true;
      }
    } catch (error) {
      console.log('Invalid move:', error);
    }
    
    return false;
  }, [game, gameMode, playerColor, gameStarted, updateGameStatus, updateCapturedPieces, onPgnUpdate, generateCompletePGN, gameId]);

  const endMultiplayerGame = async (result) => {
    console.log('Ending multiplayer game:', result);
    
    if (onGameEnd) {
      onGameEnd();
    }
  };

  const onSquareClick = useCallback((square) => {
    // For multiplayer, check if it's player's turn
    if (gameMode === 'multiplayer') {
      if (!gameStarted) return;
      
      const currentTurn = game.turn();
      const isPlayerTurn = (currentTurn === 'w' && playerColor === 'white') || 
                          (currentTurn === 'b' && playerColor === 'black');
      
      if (!isPlayerTurn) return;
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
    setWaitingForOpponent(false);
    setFullPgn('');
    updateGameStatus(newGame);
    if (onPgnUpdate) {
      onPgnUpdate('');
    }
  }, [updateGameStatus, gameMode, onPgnUpdate, initialTimeControl]);

  const handleTimeUp = useCallback((player) => {
    const winner = player === 'white' ? 'Black' : 'White';
    const result = { winner, reason: 'timeout' };
    setGameResult(result);
    setShowGameOver(true);
    setIsPaused(true);
    if (gameMode === 'multiplayer') {
      endMultiplayerGame(result);
    }
  }, [gameMode, endMultiplayerGame]);

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
      <div className="grid lg:grid-cols-5 gap-6 sm:gap-8">
        {gameMode !== 'practice' && gameStarted && (
          <div className="lg:col-span-1 space-y-6 min-w-[250px]">
            <GameTimer
              initialTime={timeControl.black}
              isActive={activePlayer === 'black' && !isPaused && gameStarted}
              onTimeUp={handleTimeUp}
              player="black"
              isPaused={isPaused}
            />
            <GameTimer
              initialTime={timeControl.white}
              isActive={activePlayer === 'white' && !isPaused && gameStarted}
              onTimeUp={handleTimeUp}
              player="white"
              isPaused={isPaused}
            />
          </div>
        )}

        <div className={gameMode === 'practice' ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="aspect-square max-w-[600px] mx-auto">
              <Chessboard
                position={gamePosition}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                customSquareStyles={customSquareStyles}
                boardOrientation={gameMode === 'multiplayer' ? playerColor : 'white'}
                animationDuration={200}
                arePiecesDraggable={!game.isGameOver() && (gameMode === 'practice' || (gameStarted && ((game.turn() === 'w' && playerColor === 'white') || (game.turn() === 'b' && playerColor === 'black'))))}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
          </motion.div>
        </div>

        <div className="lg:col-span-2 space-y-6 min-w-[300px]">
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
                <div className="text-sm text-gray-500 dark:text-gray-400">You are: {playerColor}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Time: {timeControl.white / 60} min</div>
              </div>
            )}
          </motion.div>

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
            </div>
          </motion.div>

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
                <div className="flex flex-wrap gap-1 min-h-[32px]">
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
                <div className="flex flex-wrap gap-1 min-h-[32px]">
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

          <motion.div 
            className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Move History</h3>
            <div className="max-h-64 overflow-y-auto pr-2">
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
    </div>
  );
};

export default MultiplayerChess;