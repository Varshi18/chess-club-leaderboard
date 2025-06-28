import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  const [syncStatus, setSyncStatus] = useState('disconnected');
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [isMyTurn, setIsMyTurn] = useState(true);
  
  const { user } = useAuth();
  const syncIntervalRef = useRef(null);
  const gameStateKeyRef = useRef(null);

  // Initialize game state key
  useEffect(() => {
    if (gameMode === 'multiplayer' && gameId) {
      gameStateKeyRef.current = `chess_realtime_${gameId}`;
      console.log('🎮 Game state key:', gameStateKeyRef.current);
    }
  }, [gameMode, gameId]);

  // Initialize multiplayer game
  useEffect(() => {
    if (gameMode === 'multiplayer' && gameId && opponent && user) {
      console.log('🎮 Initializing multiplayer game:', { gameId, opponent: opponent.username, user: user.username });
      initializeMultiplayerGame();
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [gameMode, gameId, opponent, user]);

  const initializeMultiplayerGame = () => {
    try {
      // Determine player colors deterministically
      const isWhite = user.id.localeCompare(opponent.id) < 0;
      const assignedColor = isWhite ? 'white' : 'black';
      
      console.log('🎯 Player color assignment:', {
        userId: user.id,
        opponentId: opponent.id,
        assignedColor,
        isWhite
      });
      
      setPlayerColor(assignedColor);
      setTimeControl({ 
        white: initialTimeControl, 
        black: initialTimeControl 
      });
      
      // Initialize game state
      const gameStateKey = gameStateKeyRef.current;
      const existingState = localStorage.getItem(gameStateKey);
      
      if (existingState) {
        console.log('📂 Loading existing game state');
        try {
          const parsedState = JSON.parse(existingState);
          loadGameFromState(parsedState);
        } catch (error) {
          console.error('❌ Error parsing existing state:', error);
          createNewGameState();
        }
      } else {
        console.log('🆕 Creating new game state');
        createNewGameState();
      }
      
      setGameStarted(true);
      setSyncStatus('connected');
      
      // Start real-time sync
      startRealTimeSync();
      
    } catch (error) {
      console.error('❌ Error initializing multiplayer game:', error);
      setPlayerColor('white');
      setGameStarted(true);
    }
  };

  const createNewGameState = () => {
    const isWhite = user.id.localeCompare(opponent.id) < 0;
    const initialState = {
      moves: [],
      fen: new Chess().fen(),
      turn: 'w',
      lastUpdate: Date.now(),
      gameId,
      players: {
        white: isWhite ? user.id : opponent.id,
        black: isWhite ? opponent.id : user.id
      },
      whiteUsername: isWhite ? user.username : opponent.username,
      blackUsername: isWhite ? opponent.username : user.username
    };
    
    localStorage.setItem(gameStateKeyRef.current, JSON.stringify(initialState));
    setLastSyncTime(initialState.lastUpdate);
  };

  const startRealTimeSync = () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    
    syncIntervalRef.current = setInterval(() => {
      syncGameState();
    }, 1000); // Sync every second for real-time feel
    
    console.log('🔄 Started real-time sync');
  };

  const syncGameState = () => {
    if (!gameStateKeyRef.current || gameMode !== 'multiplayer') return;
    
    try {
      const currentState = localStorage.getItem(gameStateKeyRef.current);
      
      if (currentState) {
        const parsedState = JSON.parse(currentState);
        
        // Check if there are new moves since our last sync
        if (parsedState.lastUpdate > lastSyncTime) {
          console.log('🔄 New moves detected, syncing...', {
            serverMoves: parsedState.moves.length,
            localMoves: moveHistory.length,
            lastUpdate: new Date(parsedState.lastUpdate).toLocaleTimeString()
          });
          
          loadGameFromState(parsedState);
          setLastSyncTime(parsedState.lastUpdate);
          setSyncStatus('synced');
          
          // Flash sync indicator
          setTimeout(() => setSyncStatus('connected'), 1000);
        }
      }
    } catch (error) {
      console.error('❌ Error syncing game state:', error);
      setSyncStatus('error');
    }
  };

  const loadGameFromState = (state) => {
    try {
      const newGame = new Chess();
      
      // Apply all moves from the state
      state.moves.forEach((move, index) => {
        try {
          const result = newGame.move(move);
          if (!result) {
            console.warn(`⚠️ Invalid move at index ${index}:`, move);
          }
        } catch (error) {
          console.error(`❌ Error applying move ${index}:`, move, error);
        }
      });
      
      setGame(newGame);
      setGamePosition(newGame.fen());
      setMoveHistory(newGame.history({ verbose: true }));
      setActivePlayer(newGame.turn() === 'w' ? 'white' : 'black');
      
      // Update turn indicator
      const currentTurn = newGame.turn();
      const isPlayerTurn = (currentTurn === 'w' && playerColor === 'white') || 
                          (currentTurn === 'b' && playerColor === 'black');
      setIsMyTurn(isPlayerTurn);
      
      updateCapturedPieces(newGame.history({ verbose: true }));
      
      // Update PGN
      const pgn = generatePGN(newGame, state);
      if (onPgnUpdate) {
        onPgnUpdate(pgn);
      }
      
      updateGameStatus(newGame);
      
    } catch (error) {
      console.error('❌ Error loading game from state:', error);
    }
  };

  const saveGameState = (newMove, newGame) => {
    if (gameMode !== 'multiplayer' || !gameStateKeyRef.current) return;
    
    try {
      const currentState = JSON.parse(localStorage.getItem(gameStateKeyRef.current) || '{}');
      
      const updatedState = {
        ...currentState,
        moves: [...(currentState.moves || []), newMove.san],
        fen: newGame.fen(),
        turn: newGame.turn(),
        lastUpdate: Date.now(),
        gameId,
        lastMoveBy: user.id
      };
      
      localStorage.setItem(gameStateKeyRef.current, JSON.stringify(updatedState));
      setLastSyncTime(updatedState.lastUpdate);
      
      console.log('💾 Game state saved:', {
        move: newMove.san,
        totalMoves: updatedState.moves.length,
        turn: updatedState.turn,
        by: user.username
      });
      
    } catch (error) {
      console.error('❌ Error saving game state:', error);
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
        // Stop syncing when game ends
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
          syncIntervalRef.current = null;
        }
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

  const generatePGN = useCallback((gameInstance, state = null) => {
    const history = gameInstance.history();
    let pgn = '';
    
    // Add headers for multiplayer games
    if (gameMode === 'multiplayer' && opponent) {
      const now = new Date();
      pgn += `[Event "Chess Club Game"]\n`;
      pgn += `[Site "IIT Dharwad Chess Club"]\n`;
      pgn += `[Date "${now.toISOString().split('T')[0]}"]\n`;
      pgn += `[Round "?"]\n`;
      pgn += `[White "${state?.whiteUsername || (playerColor === 'white' ? user.username : opponent.username)}"]\n`;
      pgn += `[Black "${state?.blackUsername || (playerColor === 'black' ? user.username : opponent.username)}"]\n`;
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

  const makeMove = useCallback((sourceSquare, targetSquare, piece) => {
    // Check if move is allowed
    if (gameMode === 'multiplayer') {
      if (!gameStarted) {
        console.log('⏸️ Game not started yet');
        return false;
      }
      
      const currentTurn = game.turn();
      const isPlayerTurn = (currentTurn === 'w' && playerColor === 'white') || 
                          (currentTurn === 'b' && playerColor === 'black');
      
      if (!isPlayerTurn) {
        console.log('⏸️ Not player turn:', { currentTurn, playerColor });
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
        console.log('✅ Move made:', move.san, 'by', user.username);
        
        setGame(gameCopy);
        setGamePosition(gameCopy.fen());
        
        const newHistory = gameCopy.history({ verbose: true });
        setMoveHistory(newHistory);
        
        updateGameStatus(gameCopy);
        updateCapturedPieces(newHistory);
        setSelectedSquare(null);
        setPossibleMoves([]);
        setActivePlayer(gameCopy.turn() === 'w' ? 'white' : 'black');
        
        // Update turn indicator
        const nextTurn = gameCopy.turn();
        const isNextPlayerTurn = (nextTurn === 'w' && playerColor === 'white') || 
                               (nextTurn === 'b' && playerColor === 'black');
        setIsMyTurn(isNextPlayerTurn);
        
        // Generate and update PGN
        const pgn = generatePGN(gameCopy);
        if (onPgnUpdate) {
          onPgnUpdate(pgn);
        }

        // Save game state for real-time sync in multiplayer
        if (gameMode === 'multiplayer') {
          saveGameState(move, gameCopy);
          setSyncStatus('synced');
        }

        return true;
      }
    } catch (error) {
      console.log('❌ Invalid move:', error);
    }
    
    return false;
  }, [game, gameMode, playerColor, gameStarted, updateGameStatus, updateCapturedPieces, onPgnUpdate, generatePGN, user]);

  const onSquareClick = useCallback((square) => {
    // For multiplayer, check if it's player's turn
    if (gameMode === 'multiplayer') {
      if (!gameStarted || !isMyTurn) {
        console.log('⏸️ Not your turn or game not started');
        return;
      }
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
  }, [game, selectedSquare, makeMove, gameMode, gameStarted, isMyTurn]);

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
    setIsMyTurn(true);
    
    // Clear localStorage for multiplayer games
    if (gameMode === 'multiplayer' && gameStateKeyRef.current) {
      localStorage.removeItem(gameStateKeyRef.current);
    }
    
    // Stop sync
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    
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
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, []);

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

  const getSyncStatusColor = () => {
    switch (syncStatus) {
      case 'connected': return 'text-blue-500';
      case 'synced': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'connected': return 'Connected';
      case 'synced': return 'Synced ✓';
      case 'error': return 'Sync Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="w-full">
      {/* Mobile Layout */}
      <div className="block xl:hidden">
        <div className="space-y-4">
          {/* Mobile Timers */}
          {gameMode !== 'practice' && gameStarted && (
            <div className="flex gap-3">
              <div className="flex-1">
                <GameTimer
                  initialTime={timeControl.black}
                  isActive={activePlayer === 'black' && !isPaused && gameStarted}
                  onTimeUp={handleTimeUp}
                  player="black"
                  isPaused={isPaused}
                />
              </div>
              <div className="flex-1">
                <GameTimer
                  initialTime={timeControl.white}
                  isActive={activePlayer === 'white' && !isPaused && gameStarted}
                  onTimeUp={handleTimeUp}
                  player="white"
                  isPaused={isPaused}
                />
              </div>
            </div>
          )}

          {/* Mobile Chess Board */}
          <motion.div 
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-3 shadow-xl border border-gray-200 dark:border-gray-700"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="aspect-square w-full">
              <Chessboard
                position={gamePosition}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                customSquareStyles={customSquareStyles}
                boardOrientation={gameMode === 'multiplayer' ? playerColor : 'white'}
                animationDuration={200}
                arePiecesDraggable={!game.isGameOver() && (gameMode === 'practice' || isMyTurn)}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
          </motion.div>

          {/* Mobile Game Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Game Status */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold mb-2 text-gray-900 dark:text-white">Status</h3>
              <div className={`p-2 rounded-lg text-center font-medium text-xs ${
                gameStatus.includes('Checkmate') || gameStatus.includes('wins') 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                  : gameStatus.includes('Draw') 
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  : gameStatus.includes('check')
                  ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              }`}>
                {gameStatus}
              </div>
              
              {gameMode === 'multiplayer' && (
                <div className="mt-2 space-y-1 text-xs">
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">You:</span> {playerColor}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    <span className="font-medium">Turn:</span> {isMyTurn ? 'Your turn' : 'Opponent\'s turn'}
                  </div>
                  <div className={`${getSyncStatusColor()}`}>
                    ● {getSyncStatusText()}
                  </div>
                </div>
              )}
            </div>

            {/* Move History */}
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-bold mb-2 text-gray-900 dark:text-white">Moves</h3>
              <div className="max-h-32 overflow-y-auto">
                {moveHistory.length > 0 ? (
                  <div className="space-y-1">
                    {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                      <div key={i} className="flex items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-400 w-6">
                          {i + 1}.
                        </span>
                        <span className="font-mono text-gray-900 dark:text-white flex-1">
                          {moveHistory[i * 2]?.san || ''}
                        </span>
                        <span className="font-mono text-gray-900 dark:text-white flex-1">
                          {moveHistory[i * 2 + 1]?.san || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 text-xs text-center">No moves yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden xl:block">
        <div className="grid grid-cols-12 gap-6">
          {/* Desktop Timers */}
          {gameMode !== 'practice' && gameStarted && (
            <div className="col-span-2 space-y-4">
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

          {/* Desktop Chess Board */}
          <div className={`${gameMode === 'practice' ? 'col-span-8' : 'col-span-6'}`}>
            <motion.div 
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-2xl p-6 shadow-2xl border border-gray-200 dark:border-gray-700"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="aspect-square w-full max-w-[600px] mx-auto">
                <Chessboard
                  position={gamePosition}
                  onPieceDrop={onPieceDrop}
                  onSquareClick={onSquareClick}
                  customSquareStyles={customSquareStyles}
                  boardOrientation={gameMode === 'multiplayer' ? playerColor : 'white'}
                  animationDuration={200}
                  arePiecesDraggable={!game.isGameOver() && (gameMode === 'practice' || isMyTurn)}
                  customBoardStyle={{
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </div>
            </motion.div>
          </div>

          {/* Desktop Game Info Panel */}
          <div className={`${gameMode === 'practice' ? 'col-span-4' : 'col-span-4'} space-y-4`}>
            
            {/* Game Status */}
            <motion.div 
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Game Status</h3>
              <motion.div 
                className={`p-4 rounded-lg text-center font-medium ${
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
                  <div className="text-sm text-gray-500 dark:text-gray-400">Rating: {opponent.chessRating}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">You are: {playerColor}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Time: {timeControl.white / 60} min</div>
                  <div className={`text-sm mt-1 ${isMyTurn ? 'text-green-600' : 'text-orange-600'}`}>
                    {isMyTurn ? '● Your turn' : '● Opponent\'s turn'}
                  </div>
                  <div className={`text-xs mt-1 ${getSyncStatusColor()}`}>
                    ● {getSyncStatusText()}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Controls */}
            <motion.div 
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Controls</h3>
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

            {/* Captured Pieces */}
            <motion.div 
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Captured Pieces</h3>
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

            {/* Move History */}
            <motion.div 
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <h3 className="text-lg font-bold mb-3 text-gray-900 dark:text-white">Move History</h3>
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
      </div>

      {/* Game Over Modal */}
      <AnimatePresence>
        {showGameOver && gameResult && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
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