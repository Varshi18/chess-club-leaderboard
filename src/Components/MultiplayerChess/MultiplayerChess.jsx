import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  const [syncStatus, setSyncStatus] = useState('disconnected');
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [gameStateVersion, setGameStateVersion] = useState(0);
  const [gameSession, setGameSession] = useState(null);
  const [serverTimeLeft, setServerTimeLeft] = useState({ white: initialTimeControl, black: initialTimeControl });
  const [connectionError, setConnectionError] = useState(null);
  
  // NEW: Game control states
  const [drawOffer, setDrawOffer] = useState(null);
  const [pauseRequest, setPauseRequest] = useState(null);
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  
  const { user } = useAuth();
  const syncIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);
  const lastSyncTimeRef = useRef(Date.now());
  const timerIntervalRef = useRef(null);

  // Set up API
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

  // Initialize multiplayer game
  useEffect(() => {
    if (gameMode === 'multiplayer' && gameId && opponent && user && !isInitializedRef.current) {
      console.log('🎮 Initializing server-controlled multiplayer game:', { 
        gameId, 
        opponent: opponent.username, 
        user: user.username 
      });
      
      isInitializedRef.current = true;
      initializeMultiplayerGame();
    }
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameMode, gameId, opponent, user]);

  // NEW: Real-time timer for multiplayer games
  useEffect(() => {
    if (gameMode === 'multiplayer' && gameStarted && !isPaused && gameSession?.status === 'active') {
      // Clear any existing timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Start real-time timer that updates every second
      timerIntervalRef.current = setInterval(() => {
        setServerTimeLeft(prevTime => {
          const newTime = { ...prevTime };
          
          // Only decrease time for the active player
          if (activePlayer === 'white' && newTime.white > 0) {
            newTime.white = Math.max(0, newTime.white - 1);
            if (newTime.white === 0) {
              handleTimeUp('white');
            }
          } else if (activePlayer === 'black' && newTime.black > 0) {
            newTime.black = Math.max(0, newTime.black - 1);
            if (newTime.black === 0) {
              handleTimeUp('black');
            }
          }
          
          return newTime;
        });
      }, 1000); // Update every second for real-time countdown
      
      console.log('⏰ Started real-time timer for', activePlayer);
    } else {
      // Clear timer when game is paused or not active
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [gameMode, gameStarted, isPaused, activePlayer, gameSession?.status]);

  const initializeMultiplayerGame = async () => {
    try {
      setSyncStatus('connecting');
      setConnectionError(null);
      
      // Fetch game session from server
      const response = await api.get(`/?endpoint=game-sessions&gameId=${gameId}`);
      
      if (response.data.success) {
        const session = response.data.gameSession;
        setGameSession(session);
        
        console.log('🎯 Server-controlled game session loaded:', session);
        
        // Server determines player colors - no client-side assignment
        const isWhite = session.whitePlayerId === user.id;
        const assignedColor = isWhite ? 'white' : 'black';
        setPlayerColor(assignedColor);
        
        console.log('🎨 Server assigned colors:', {
          userId: user.id,
          whitePlayerId: session.whitePlayerId,
          blackPlayerId: session.blackPlayerId,
          assignedColor,
          isWhite
        });
        
        // Load server-controlled game state
        loadServerGameState(session);
        
        setGameStarted(true);
        setSyncStatus('connected');
        
        // Start real-time sync with server (every 2 seconds for better performance)
        startServerSync();
        
      } else {
        console.error('❌ Failed to load game session:', response.data.message);
        setSyncStatus('error');
        setConnectionError('Failed to load game session');
      }
    } catch (error) {
      console.error('❌ Error initializing multiplayer game:', error);
      setSyncStatus('error');
      setConnectionError('Connection failed. Please check your internet connection.');
    }
  };

  const loadServerGameState = (session) => {
    try {
      const newGame = new Chess();
      
      // Apply all moves from the server
      if (session.moves && session.moves.length > 0) {
        session.moves.forEach((move, index) => {
          try {
            const result = newGame.move(move);
            if (!result) {
              console.warn(`⚠️ Invalid move at index ${index}:`, move);
            }
          } catch (error) {
            console.error(`❌ Error applying move ${index}:`, move, error);
          }
        });
      }
      
      // Use server FEN if available, otherwise use computed FEN
      if (session.fen) {
        try {
          newGame.load(session.fen);
        } catch (error) {
          console.warn('⚠️ Invalid FEN from server, using computed position');
        }
      }
      
      setGame(newGame);
      setGamePosition(newGame.fen());
      setMoveHistory(newGame.history({ verbose: true }));
      
      // Server controls turn state
      const serverTurn = session.turn || newGame.turn();
      setActivePlayer(serverTurn === 'w' ? 'white' : 'black');
      setGameStateVersion(session.version || 0);
      
      // Server controls timers - use server time values
      const whiteTime = session.whiteTimeLeft !== undefined ? session.whiteTimeLeft : session.timeControl;
      const blackTime = session.blackTimeLeft !== undefined ? session.blackTimeLeft : session.timeControl;
      
      setServerTimeLeft({
        white: whiteTime,
        black: blackTime
      });
      setTimeControl({
        white: whiteTime,
        black: blackTime
      });
      
      // CRITICAL FIX: Update turn indicator based on server state and player color
      const myColor = session.whitePlayerId === user.id ? 'white' : 'black';
      const isMyTurnNow = (serverTurn === 'w' && myColor === 'white') || 
                         (serverTurn === 'b' && myColor === 'black');
      
      setIsMyTurn(isMyTurnNow);
      
      // NEW: Load game control states
      setDrawOffer(session.drawOffer || null);
      setPauseRequest(session.pauseRequest || null);
      setIsPaused(session.status === 'paused');
      
      // Show modals for pending requests
      if (session.drawOffer?.status === 'pending' && session.drawOffer.offeredBy !== user.id) {
        setShowDrawModal(true);
      }
      if (session.pauseRequest?.status === 'pending' && session.pauseRequest.requestedBy !== user.id) {
        setShowPauseModal(true);
      }
      
      updateCapturedPieces(newGame.history({ verbose: true }));
      
      // Update PGN - FIXED: Generate complete PGN from all moves
      const pgn = generatePGN(newGame, session);
      if (onPgnUpdate) {
        onPgnUpdate(pgn);
      }
      
      updateGameStatus(newGame);
      
      // Check for game end
      if (session.status === 'completed') {
        handleServerGameEnd(session.result, session.reason);
      }
      
      console.log('✅ Server game state loaded:', {
        moves: session.moves?.length || 0,
        turn: serverTurn,
        isMyTurn: isMyTurnNow,
        myColor,
        version: session.version,
        whiteTime: whiteTime,
        blackTime: blackTime,
        status: session.status,
        playerColor: myColor,
        drawOffer: session.drawOffer,
        pauseRequest: session.pauseRequest
      });
      
    } catch (error) {
      console.error('❌ Error loading server game state:', error);
      setConnectionError('Failed to load game state');
    }
  };

  const startServerSync = () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    
    // Sync with server every 2 seconds for better performance
    syncIntervalRef.current = setInterval(() => {
      syncWithServer();
    }, 2000);
    
    console.log('🔄 Started server sync (2 second interval)');
  };

  const syncWithServer = async () => {
    if (!gameId || gameMode !== 'multiplayer') return;
    
    try {
      const response = await api.get(`/?endpoint=game-sessions&action=sync&gameId=${gameId}&lastVersion=${gameStateVersion}`);
      
      if (response.data.success && response.data.hasUpdates) {
        const serverState = response.data.gameState;
        
        console.log('🔄 Server sync update:', {
          serverMoves: serverState.moves?.length || 0,
          localMoves: moveHistory.length,
          serverVersion: serverState.version,
          localVersion: gameStateVersion,
          lastMoveBy: serverState.lastMoveBy,
          currentUser: user.id,
          serverTurn: serverState.turn,
          whiteTime: serverState.whiteTimeLeft,
          blackTime: serverState.blackTimeLeft
        });
        
        // Always update from server state (server is authoritative)
        loadServerGameState(serverState);
        setSyncStatus('synced');
        setConnectionError(null);
        
        // Update version
        setGameStateVersion(serverState.version);
        
        // Check for game end
        if (serverState.status === 'completed' && serverState.result) {
          handleServerGameEnd(serverState.result, serverState.reason);
        }
        
        // Flash sync indicator
        setTimeout(() => setSyncStatus('connected'), 1000);
      } else {
        // No updates, but connection is good
        setSyncStatus('connected');
        setConnectionError(null);
      }
      
      lastSyncTimeRef.current = Date.now();
    } catch (error) {
      console.error('❌ Error syncing with server:', error);
      setSyncStatus('error');
      
      // Check if we've been disconnected for too long
      const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
      if (timeSinceLastSync > 10000) { // 10 seconds
        setConnectionError('Connection lost. Attempting to reconnect...');
      }
    }
  };

  const handleServerGameEnd = (result, reason) => {
    let gameResult;
    if (result === '1-0') {
      gameResult = { winner: 'White', reason };
    } else if (result === '0-1') {
      gameResult = { winner: 'Black', reason };
    } else {
      gameResult = { winner: null, reason };
    }
    
    setGameResult(gameResult);
    setShowGameOver(true);
    
    // Stop syncing and timers when game ends
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    console.log('🏁 Game ended by server:', gameResult);
    
    // Notify both players that the game has ended
    if (onGameEnd) {
      setTimeout(() => {
        onGameEnd();
      }, 3000); // Give time to see the game over modal
    }
  };

  // NEW: Resign function
  const handleResign = async () => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const response = await api.patch('/?endpoint=game-sessions&action=resign', { gameId });
        if (response.data.success) {
          console.log('🏳️ Resignation processed');
          // Server will handle the game end and both players will be notified via sync
        }
      } catch (error) {
        console.error('❌ Error processing resignation:', error);
        setConnectionError('Failed to process resignation');
      }
    } else {
      // Practice mode - handle locally
      const winner = playerColor === 'white' ? 'Black' : 'White';
      setGameResult({ winner, reason: 'resignation' });
      setShowGameOver(true);
    }
  };

  // NEW: Draw offer functions
  const handleOfferDraw = async () => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const response = await api.patch('/?endpoint=game-sessions&action=offer-draw', { gameId });
        if (response.data.success) {
          console.log('🤝 Draw offer sent');
          // Server will update the game state and opponent will be notified via sync
        }
      } catch (error) {
        console.error('❌ Error offering draw:', error);
        setConnectionError('Failed to offer draw');
      }
    }
  };

  const handleRespondToDraw = async (response) => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const apiResponse = await api.patch('/?endpoint=game-sessions&action=respond-draw', { 
          gameId, 
          response 
        });
        if (apiResponse.data.success) {
          console.log('🤝 Draw response sent:', response);
          setShowDrawModal(false);
          // Server will handle the result and both players will be notified via sync
        }
      } catch (error) {
        console.error('❌ Error responding to draw:', error);
        setConnectionError('Failed to respond to draw');
      }
    }
  };

  // NEW: Pause functions
  const handleRequestPause = async () => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const response = await api.patch('/?endpoint=game-sessions&action=pause', { gameId });
        if (response.data.success) {
          console.log('⏸️ Pause request sent');
          // Server will update the game state and opponent will be notified via sync
        }
      } catch (error) {
        console.error('❌ Error requesting pause:', error);
        setConnectionError('Failed to request pause');
      }
    }
  };

  const handleRespondToPause = async (response) => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const apiResponse = await api.patch('/?endpoint=game-sessions&action=respond-pause', { 
          gameId, 
          response 
        });
        if (apiResponse.data.success) {
          console.log('⏸️ Pause response sent:', response);
          setShowPauseModal(false);
          // Server will handle the result and both players will be notified via sync
        }
      } catch (error) {
        console.error('❌ Error responding to pause:', error);
        setConnectionError('Failed to respond to pause');
      }
    }
  };

  const handleResume = async () => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const response = await api.patch('/?endpoint=game-sessions&action=resume', { gameId });
        if (response.data.success) {
          console.log('▶️ Game resumed');
          // Server will update the game state and both players will be notified via sync
        }
      } catch (error) {
        console.error('❌ Error resuming game:', error);
        setConnectionError('Failed to resume game');
      }
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
        // Server will handle game end
        endGameOnServer(result);
      }
    } else if (gameInstance.isCheck()) {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  }, [gameMode]);

  const endGameOnServer = async (result) => {
    try {
      const gameResult = result.winner === 'White' ? '1-0' : 
                        result.winner === 'Black' ? '0-1' : '1/2-1/2';
      
      await api.patch('/?endpoint=game-sessions&action=end', {
        gameId,
        result: gameResult,
        reason: result.reason
      });
      
      console.log('🏁 Game ended on server:', gameResult);
    } catch (error) {
      console.error('❌ Error ending game on server:', error);
    }
  };

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

  const generatePGN = useCallback((gameInstance, session = null) => {
    // FIXED: Generate complete PGN from all moves in the game
    const history = gameInstance.history();
    let pgn = '';
    
    // Add headers for multiplayer games
    if (gameMode === 'multiplayer' && (opponent || session)) {
      const now = new Date();
      const whiteUsername = session?.whitePlayer?.username || 
                           (playerColor === 'white' ? user.username : opponent?.username);
      const blackUsername = session?.blackPlayer?.username || 
                           (playerColor === 'black' ? user.username : opponent?.username);
      
      pgn += `[Event "Chess Club Game"]\n`;
      pgn += `[Site "IIT Dharwad Chess Club"]\n`;
      pgn += `[Date "${now.toISOString().split('T')[0]}"]\n`;
      pgn += `[Round "?"]\n`;
      pgn += `[White "${whiteUsername}"]\n`;
      pgn += `[Black "${blackUsername}"]\n`;
      pgn += `[Result "*"]\n`;
      pgn += `[TimeControl "${initialTimeControl}"]\n\n`;
    }
    
    // Add ALL moves (not just the last one)
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
  }, [gameMode, opponent, playerColor, user, initialTimeControl]);

  const makeMove = useCallback(async (sourceSquare, targetSquare, piece) => {
    // Check if move is allowed
    if (gameMode === 'multiplayer') {
      if (!gameStarted) {
        console.log('⏸️ Game not started yet');
        return false;
      }
      
      if (!isMyTurn) {
        console.log('⏸️ Not your turn:', { 
          currentTurn: game.turn(), 
          playerColor, 
          isMyTurn,
          activePlayer
        });
        return false;
      }

      if (syncStatus === 'error' || connectionError) {
        console.log('⏸️ Connection error, cannot make move');
        return false;
      }

      if (isPaused) {
        console.log('⏸️ Game is paused');
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
        console.log('✅ Move attempted:', move.san, 'by', user.username);
        
        // For practice mode, update immediately
        if (gameMode === 'practice') {
          setGame(gameCopy);
          setGamePosition(gameCopy.fen());
          
          const newHistory = gameCopy.history({ verbose: true });
          setMoveHistory(newHistory);
          
          updateGameStatus(gameCopy);
          updateCapturedPieces(newHistory);
          setSelectedSquare(null);
          setPossibleMoves([]);
          setActivePlayer(gameCopy.turn() === 'w' ? 'white' : 'black');
          
          // Generate and update PGN
          const pgn = generatePGN(gameCopy);
          if (onPgnUpdate) {
            onPgnUpdate(pgn);
          }
          
          return true;
        }

        // For multiplayer, send to server and let server update state
        if (gameMode === 'multiplayer' && gameId) {
          try {
            setSyncStatus('syncing');
            
            const response = await api.patch('/?endpoint=game-sessions&action=move', {
              gameId,
              move: move.san,
              fen: gameCopy.fen()
            });
            
            if (response.data.success) {
              console.log('📡 Move sent to server successfully:', {
                move: move.san,
                version: response.data.version,
                turn: response.data.turn
              });
              
              // Clear selection immediately for responsiveness
              setSelectedSquare(null);
              setPossibleMoves([]);
              
              // CRITICAL FIX: Don't set isMyTurn to false here - let server sync handle it
              // The server will update the turn state and we'll get it via sync
              
              // Server will update game state via sync
              setSyncStatus('connected');
              setConnectionError(null);
              
              // Force a sync after move to get updated state quickly
              setTimeout(() => {
                syncWithServer();
              }, 500);
              
            } else {
              console.error('❌ Server rejected move:', response.data.message);
              setSyncStatus('error');
              setConnectionError('Move rejected by server');
              return false;
            }
          } catch (error) {
            console.error('❌ Error sending move to server:', error);
            setSyncStatus('error');
            setConnectionError('Failed to send move. Check your connection.');
            return false;
          }
        }

        return true;
      }
    } catch (error) {
      console.log('❌ Invalid move:', error);
    }
    
    return false;
  }, [game, gameMode, playerColor, gameStarted, isMyTurn, syncStatus, connectionError, isPaused, updateGameStatus, updateCapturedPieces, onPgnUpdate, generatePGN, user, gameId]);

  const onSquareClick = useCallback((square) => {
    // For multiplayer, check if it's player's turn
    if (gameMode === 'multiplayer') {
      if (!gameStarted || !isMyTurn || syncStatus === 'error' || connectionError || isPaused) {
        console.log('⏸️ Cannot interact:', { gameStarted, isMyTurn, syncStatus, connectionError, isPaused });
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
  }, [game, selectedSquare, makeMove, gameMode, gameStarted, isMyTurn, syncStatus, connectionError, isPaused]);

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
    setServerTimeLeft({ white: initialTimeControl, black: initialTimeControl });
    setActivePlayer('white');
    setIsPaused(false);
    setGameStarted(gameMode === 'practice');
    setIsMyTurn(true);
    setGameStateVersion(0);
    setConnectionError(null);
    setDrawOffer(null);
    setPauseRequest(null);
    setShowDrawModal(false);
    setShowPauseModal(false);
    isInitializedRef.current = false;
    
    // Stop sync and timers
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
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
    
    if (gameMode === 'multiplayer') {
      endGameOnServer(result);
    }
  }, [gameMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
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
      case 'connecting': return 'text-yellow-500';
      case 'connected': return 'text-blue-500';
      case 'synced': return 'text-green-500';
      case 'syncing': return 'text-yellow-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getSyncStatusText = () => {
    switch (syncStatus) {
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'synced': return 'Synced ✓';
      case 'syncing': return 'Syncing...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Connection Error Banner */}
      {connectionError && (
        <motion.div
          className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-lg text-center"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>{connectionError}</span>
          </div>
        </motion.div>
      )}

      {/* Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* Timers - Mobile: Top, Desktop: Left */}
        {gameMode !== 'practice' && gameStarted && (
          <div className="lg:col-span-2 order-1 lg:order-1">
            <div className="flex lg:flex-col gap-3 lg:gap-4">
              <div className="flex-1 lg:flex-none">
                <GameTimer
                  initialTime={initialTimeControl}
                  isActive={activePlayer === 'black' && !isPaused && gameStarted}
                  onTimeUp={handleTimeUp}
                  player="black"
                  isPaused={isPaused}
                  serverControlled={gameMode === 'multiplayer'}
                  currentTime={serverTimeLeft.black}
                />
              </div>
              <div className="flex-1 lg:flex-none">
                <GameTimer
                  initialTime={initialTimeControl}
                  isActive={activePlayer === 'white' && !isPaused && gameStarted}
                  onTimeUp={handleTimeUp}
                  player="white"
                  isPaused={isPaused}
                  serverControlled={gameMode === 'multiplayer'}
                  currentTime={serverTimeLeft.white}
                />
              </div>
            </div>
          </div>
        )}

        {/* Chess Board - Center */}
        <div className={`${gameMode === 'practice' ? 'lg:col-span-8' : 'lg:col-span-6'} order-2 lg:order-2`}>
          <motion.div 
            className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl lg:rounded-2xl p-4 lg:p-6 shadow-xl border border-gray-200 dark:border-gray-700"
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
                arePiecesDraggable={!game.isGameOver() && (gameMode === 'practice' || (gameStarted && isMyTurn && syncStatus !== 'error' && !connectionError && !isPaused))}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
          </motion.div>
        </div>

        {/* Game Info Panel - Mobile: Bottom, Desktop: Right */}
        <div className={`${gameMode === 'practice' ? 'lg:col-span-4' : 'lg:col-span-4'} order-3 lg:order-3`}>
          <div className="space-y-4">
            
            {/* Game Status */}
            <motion.div 
              className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h3 className="text-base lg:text-lg font-bold mb-3 text-gray-900 dark:text-white">Game Status</h3>
              <motion.div 
                className={`p-3 lg:p-4 rounded-lg text-center font-medium text-sm lg:text-base ${
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
                {isPaused ? 'Game Paused' : gameStatus}
              </motion.div>
              
              {gameMode === 'multiplayer' && gameSession && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Playing against:</div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm lg:text-base">
                    {gameSession.whitePlayer?.username === user.username ? 
                      gameSession.blackPlayer?.username : 
                      gameSession.whitePlayer?.username}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                    Rating: {gameSession.whitePlayer?.username === user.username ? 
                      gameSession.blackPlayer?.chessRating : 
                      gameSession.whitePlayer?.chessRating}
                  </div>
                  <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">You are: {playerColor}</div>
                  <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">Time: {Math.floor(initialTimeControl / 60)} min</div>
                  <div className={`text-xs lg:text-sm mt-1 font-medium ${isMyTurn ? 'text-green-600' : 'text-orange-600'}`}>
                    {isMyTurn ? '● Your turn' : '● Opponent\'s turn'}
                  </div>
                  <div className={`text-xs mt-1 ${getSyncStatusColor()}`}>
                    ● {getSyncStatusText()} (v{gameStateVersion})
                  </div>
                </div>
              )}
            </motion.div>

            {/* NEW: Game Controls */}
            <motion.div 
              className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h3 className="text-base lg:text-lg font-bold mb-3 text-gray-900 dark:text-white">Game Controls</h3>
              <div className="space-y-3">
                {gameMode === 'practice' && (
                  <motion.button
                    onClick={resetGame}
                    className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 text-sm lg:text-base"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    New Game
                  </motion.button>
                )}
                
                {gameMode === 'multiplayer' && gameStarted && (
                  <>
                    <motion.button
                      onClick={handleResign}
                      className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Resign
                    </motion.button>
                    
                    <motion.button
                      onClick={handleOfferDraw}
                      disabled={drawOffer?.status === 'pending'}
                      className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {drawOffer?.status === 'pending' ? 'Draw Offered' : 'Offer Draw'}
                    </motion.button>
                    
                    {isPaused ? (
                      <motion.button
                        onClick={handleResume}
                        className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300 text-sm lg:text-base"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        Resume Game
                      </motion.button>
                    ) : (
                      <motion.button
                        onClick={handleRequestPause}
                        disabled={pauseRequest?.status === 'pending'}
                        className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {pauseRequest?.status === 'pending' ? 'Pause Requested' : 'Request Pause'}
                      </motion.button>
                    )}
                  </>
                )}
              </div>
            </motion.div>

            {/* Captured Pieces */}
            <motion.div 
              className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <h3 className="text-base lg:text-lg font-bold mb-3 text-gray-900 dark:text-white">Captured Pieces</h3>
              <div className="space-y-3 lg:space-y-4">
                <div>
                  <h4 className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">White Captured:</h4>
                  <div className="flex flex-wrap gap-1 min-h-[24px] lg:min-h-[32px]">
                    <AnimatePresence>
                      {capturedPieces.white.map((piece, index) => (
                        <motion.span 
                          key={`white-${piece}-${index}`} 
                          className="text-lg lg:text-2xl"
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
                      <span className="text-gray-400 dark:text-gray-500 text-xs lg:text-sm">None</span>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Black Captured:</h4>
                  <div className="flex flex-wrap gap-1 min-h-[24px] lg:min-h-[32px]">
                    <AnimatePresence>
                      {capturedPieces.black.map((piece, index) => (
                        <motion.span 
                          key={`black-${piece}-${index}`} 
                          className="text-lg lg:text-2xl"
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
                      <span className="text-gray-400 dark:text-gray-500 text-xs lg:text-sm">None</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Move History */}
            <motion.div 
              className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <h3 className="text-base lg:text-lg font-bold mb-3 text-gray-900 dark:text-white">Move History</h3>
              <div className="max-h-48 lg:max-h-64 overflow-y-auto pr-2">
                {moveHistory.length > 0 ? (
                  <div className="space-y-1">
                    <AnimatePresence>
                      {moveHistory.map((move, index) => (
                        <motion.div 
                          key={`move-${index}-${move.san}`} 
                          className="flex justify-between items-center py-1 px-2 rounded text-xs lg:text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  <p className="text-gray-400 dark:text-gray-500 text-xs lg:text-sm text-center">No moves yet</p>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* NEW: Draw Offer Modal */}
      <AnimatePresence>
        {showDrawModal && drawOffer && (
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
              <div className="text-center">
                <div className="text-4xl mb-4">🤝</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Draw Offer
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Your opponent has offered a draw. Do you accept?
                </p>
                <div className="flex space-x-3">
                  <motion.button
                    onClick={() => handleRespondToDraw('accept')}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Accept Draw
                  </motion.button>
                  <motion.button
                    onClick={() => handleRespondToDraw('decline')}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Decline
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW: Pause Request Modal */}
      <AnimatePresence>
        {showPauseModal && pauseRequest && (
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
              <div className="text-center">
                <div className="text-4xl mb-4">⏸️</div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Pause Request
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Your opponent wants to pause the game. Do you agree?
                </p>
                <div className="flex space-x-3">
                  <motion.button
                    onClick={() => handleRespondToPause('accept')}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-medium rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Accept Pause
                  </motion.button>
                  <motion.button
                    onClick={() => handleRespondToPause('decline')}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Decline
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 lg:p-8 max-w-md w-full mx-4 shadow-2xl"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center">
                <div className="text-4xl lg:text-6xl mb-4">
                  {gameResult.winner ? '🏆' : '🤝'}
                </div>
                <h2 className="text-xl lg:text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                  {gameResult.winner ? `${gameResult.winner} Wins!` : "It's a Draw!"}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm lg:text-base">
                  {gameResult.reason === 'checkmate' && 'By checkmate'}
                  {gameResult.reason === 'timeout' && 'By timeout'}
                  {gameResult.reason === 'resignation' && 'By resignation'}
                  {gameResult.reason === 'stalemate' && 'By stalemate'}
                  {gameResult.reason === 'repetition' && 'By threefold repetition'}
                  {gameResult.reason === 'insufficient_material' && 'By insufficient material'}
                  {gameResult.reason === 'fifty_move' && 'By 50-move rule'}
                  {gameResult.reason === 'draw_agreement' && 'By mutual agreement'}
                </p>
                <div className="flex gap-3 lg:gap-4">
                  <motion.button
                    onClick={() => {
                      setShowGameOver(false);
                      if (onGameEnd) onGameEnd();
                    }}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-300 text-sm lg:text-base"
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
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 text-sm lg:text-base"
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