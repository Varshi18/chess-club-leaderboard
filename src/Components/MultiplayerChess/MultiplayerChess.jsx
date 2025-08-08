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
  const [isMyTurn, setIsMyTurn] = useState(gameMode === 'practice' ? true : false);
  const [gameStateVersion, setGameStateVersion] = useState(0);
  const [gameSession, setGameSession] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [whiteTime, setWhiteTime] = useState(600);
  const [blackTime, setBlackTime] = useState(600);

  const { user } = useAuth();
  const syncIntervalRef = useRef(null);
  const isInitializedRef = useRef(false);
  const playerColorRef = useRef('white'); // FIXED: Use ref to persist player color
  const handleMove = async (sourceSquare, targetSquare) => {
  const newGame = new Chess(game.fen());
  const move = newGame.move({
    from: sourceSquare,
    to: targetSquare,
    promotion: 'q',
  });

  if (!move) return false;

  setGame(newGame);
  setFen(newGame.fen());
  setTurn(newGame.turn());
  setMoveHistory(newGame.history()); // ✅ This line is crucial!

  await axios.post(`/api/chess/${gameId}/move`, {
    move,
    player: playerName,
  });

  return true;
};

  const fetchGameState = async () => {
  try {
    const res = await axios.get(`/api/chess/${gameId}`);
    const data = res.data;

    const updatedGame = new Chess();
    data.gameState.moves.forEach((move) => updatedGame.move(move));

    setGame(updatedGame);
    setFen(updatedGame.fen());
    setMoveHistory(data.gameState.moves || []);
    setTurn(updatedGame.turn());
    setWhiteTime(data.gameState.whiteTimeLeft);
    setBlackTime(data.gameState.blackTimeLeft);

    if (updatedGame.isGameOver()) {
      setIsGameOver(true);
      setStatus(updatedGame.isCheckmate()
        ? `Checkmate! ${updatedGame.turn() === 'w' ? 'Black' : 'White'} wins!`
        : 'Draw!');
    } else {
      setStatus(`${updatedGame.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  } catch (err) {
    console.error('Error syncing game:', err);
  }
};
useEffect(() => {
  fetchGameState();
  const interval = setInterval(fetchGameState, 2000);
  return () => clearInterval(interval);
}, []);

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
      console.log('🎮 Initializing multiplayer game:', { 
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
    };
  }, [gameMode, gameId, opponent, user]);

  const initializeMultiplayerGame = async () => {
    try {
      setSyncStatus('connecting');
      
      // Fetch game session from server
      const response = await api.get(`/?endpoint=game-sessions&gameId=${gameId}`);
      
      if (response.data.success) {
        const session = response.data.gameSession;
        setGameSession(session);
        
        console.log('🎯 Game session loaded:', session);
        
        // FIXED: Determine player color ONCE and persist it
        const userId = user.id || user._id;
        const whitePlayerId = session.whitePlayerId;
        const blackPlayerId = session.blackPlayerId;
        
        // Convert to strings for comparison
        const userIdStr = String(userId);
        const whitePlayerIdStr = String(whitePlayerId);
        const blackPlayerIdStr = String(blackPlayerId);
        
        console.log('🔍 Player ID comparison:', {
          userId: userIdStr,
          whitePlayerId: whitePlayerIdStr,
          blackPlayerId: blackPlayerIdStr,
          userUsername: user.username,
          whitePlayerUsername: session.whitePlayer?.username,
          blackPlayerUsername: session.blackPlayer?.username
        });
        
        let assignedColor;
        
        // First try ID comparison
        if (userIdStr === whitePlayerIdStr) {
          assignedColor = 'white';
          console.log('✅ Assigned WHITE by ID match');
        } else if (userIdStr === blackPlayerIdStr) {
          assignedColor = 'black';
          console.log('✅ Assigned BLACK by ID match');
        } else {
          // Fallback to username comparison
          if (user.username === session.whitePlayer?.username) {
            assignedColor = 'white';
            console.log('✅ Assigned WHITE by username match');
          } else if (user.username === session.blackPlayer?.username) {
            assignedColor = 'black';
            console.log('✅ Assigned BLACK by username match');
          } else {
            // Last resort: assign based on who joined first
            assignedColor = 'white';
            console.warn('⚠️ Could not determine color, defaulting to WHITE');
          }
        }
        
        // FIXED: Set player color ONCE and store in ref to prevent changes
        setPlayerColor(assignedColor);
        playerColorRef.current = assignedColor;
        
        console.log('🎨 Final color assignment (PERMANENT):', {
          assignedColor,
          isWhite: assignedColor === 'white'
        });
        
        // Load game state from server
        loadServerGameState(session, assignedColor);
        
        setGameStarted(true);
        setSyncStatus('connected');
        
        // Start real-time sync
        startServerSync();
        
      } else {
        console.error('❌ Failed to load game session:', response.data.message);
        setSyncStatus('error');
      }
    } catch (error) {
      console.error('❌ Error initializing multiplayer game:', error);
      setSyncStatus('error');
    }
  };

  const loadServerGameState = (session, playerColorOverride = null) => {
    try {
      const newGame = new Chess();
      
      // Apply moves from server
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
      
      // Use server FEN if available
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
      
      // FIXED: Set turn state from server
      const serverTurn = session.turn || 'w';
      const currentPlayer = serverTurn === 'w' ? 'white' : 'black';
      setActivePlayer(currentPlayer);
      setGameStateVersion(session.version || 0);
      
      // FIXED: Set timer values from server - no local timer updates
      const whiteTime = session.whiteTimeLeft !== undefined ? session.whiteTimeLeft : (session.timeControl || initialTimeControl);
      const blackTime = session.blackTimeLeft !== undefined ? session.blackTimeLeft : (session.timeControl || initialTimeControl);
      
      setTimeControl({
        white: whiteTime,
        black: blackTime
      });
      
      // FIXED: Use persistent player color from ref
      const currentPlayerColor = playerColorOverride || playerColorRef.current;
      const isPlayerTurn = (serverTurn === 'w' && currentPlayerColor === 'white') || 
                          (serverTurn === 'b' && currentPlayerColor === 'black');
      setIsMyTurn(isPlayerTurn);
      
      // FIXED: Set pause state from server
      setIsPaused(session.isPaused || false);
      
      // FIXED: Load pending requests
      setPendingRequests(session.pendingRequests || []);
      
      updateCapturedPieces(newGame.history({ verbose: true }));
      
      // Generate PGN with correct player names from server
      const pgn = generatePGNFromServer(newGame, session);
      if (onPgnUpdate) {
        onPgnUpdate(pgn);
      }
      
      updateGameStatus(newGame);
      
      // Check for game end
      if (session.status === 'completed' && session.result) {
        handleServerGameEnd(session.result, session.reason);
      }
      
      console.log('✅ Game state loaded:', {
        moves: session.moves?.length || 0,
        turn: serverTurn,
        currentPlayer,
        playerColor: currentPlayerColor,
        isMyTurn: isPlayerTurn,
        version: session.version,
        whiteTime,
        blackTime,
        status: session.status,
        gameStarted: session.status === 'active',
        isPaused: session.isPaused,
        pendingRequests: session.pendingRequests?.length || 0
      });
      
      // FIXED: Set game started based on server status
      setGameStarted(session.status === 'active');
      
    } catch (error) {
      console.error('❌ Error loading server game state:', error);
    }
  };

  const startServerSync = () => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    
    // Sync every 2 seconds for real-time updates
    syncIntervalRef.current = setInterval(() => {
      syncWithServer();
    }, 2000);
    
    console.log('🔄 Started server sync (2s interval)');
  };

  const syncWithServer = async () => {
    if (!gameId || gameMode !== 'multiplayer') return;
    
    try {
      const response = await api.get(`/?endpoint=game-sessions&action=sync&gameId=${gameId}&lastVersion=${gameStateVersion}`);
      
      if (response.data.success && response.data.hasUpdates) {
        const serverState = response.data.gameState;
        
        console.log('🔄 Server sync update:', {
          serverMoves: serverState.moves.length,
          localMoves: moveHistory.length,
          serverVersion: serverState.version,
          localVersion: gameStateVersion,
          serverTurn: serverState.turn,
          whiteTime: serverState.whiteTimeLeft,
          blackTime: serverState.blackTimeLeft,
          playerColor: playerColorRef.current, // Use persistent color
          gameStatus: serverState.status
        });
        
        // FIXED: Don't change player color during sync - use persistent ref
        loadServerGameState(serverState, playerColorRef.current);
        setSyncStatus('synced');
        
        // Update version
        setGameStateVersion(serverState.version);
        
        // Check for game end
        if (serverState.status === 'completed' && serverState.result) {
          handleServerGameEnd(serverState.result, serverState.reason);
        }
        
        // Flash sync indicator
        setTimeout(() => setSyncStatus('connected'), 500);
      }
      
    } catch (error) {
      console.error('❌ Error syncing with server:', error);
      setSyncStatus('error');
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
    
    // Stop syncing when game ends
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    
    console.log('🏁 Game ended by server:', gameResult);
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
        endGameOnServer(result);
      } else {
        setGameResult(result);
        setShowGameOver(true);
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

  // Generate PGN from server data to ensure consistency
  const generatePGNFromServer = useCallback((gameInstance, session) => {
    const history = gameInstance.history();
    let pgn = '';
    
    if (gameMode === 'multiplayer' && session) {
      const now = new Date();
      const whiteUsername = session.whitePlayer?.username || 'White Player';
      const blackUsername = session.blackPlayer?.username || 'Black Player';
      
      pgn += `[Event "Chess Club Game"]\n`;
      pgn += `[Site "IIT Dharwad Chess Club"]\n`;
      pgn += `[Date "${now.toISOString().split('T')[0]}"]\n`;
      pgn += `[Round "?"]\n`;
      pgn += `[White "${whiteUsername}"]\n`;
      pgn += `[Black "${blackUsername}"]\n`;
      pgn += `[Result "*"]\n`;
      pgn += `[TimeControl "${session.timeControl || timeControl.white}"]\n\n`;
    }
    
    // Add moves
    for (let i = 0; i < history.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      pgn += `${moveNumber}. ${history[i]}`;
      if (history[i + 1]) {
        pgn += ` ${history[i + 1]}`;
      }
      if ((i + 2) % 10 === 0) {
        pgn += '\n';
      } else {
        pgn += ' ';
      }
    }
    
    // Add result if game is over
    if (gameInstance.isGameOver()) {
      if (gameInstance.isCheckmate()) {
        pgn += gameInstance.turn() === 'w' ? ' 0-1' : ' 1-0';
      } else {
        pgn += ' 1/2-1/2';
      }
    }
    
    return pgn.trim();
  }, [gameMode, timeControl]);

  const generatePGN = useCallback((gameInstance, session = null) => {
    const history = gameInstance.history();
    let pgn = '';
    
    // Add headers for multiplayer games
    if (gameMode === 'multiplayer' && (opponent || session)) {
      const now = new Date();
      const whiteUsername = session?.whitePlayer?.username || 
                           (playerColorRef.current === 'white' ? user.username : opponent?.username);
      const blackUsername = session?.blackPlayer?.username || 
                           (playerColorRef.current === 'black' ? user.username : opponent?.username);
      
      pgn += `[Event "Chess Club Game"]\n`;
      pgn += `[Site "IIT Dharwad Chess Club"]\n`;
      pgn += `[Date "${now.toISOString().split('T')[0]}"]\n`;
      pgn += `[Round "?"]\n`;
      pgn += `[White "${whiteUsername}"]\n`;
      pgn += `[Black "${blackUsername}"]\n`;
      pgn += `[Result "*"]\n`;
      pgn += `[TimeControl "${timeControl.white}"]\n\n`;
    } else if (gameMode === 'practice') {
      const now = new Date();
      pgn += `[Event "Practice Game"]\n`;
      pgn += `[Site "IIT Dharwad Chess Club"]\n`;
      pgn += `[Date "${now.toISOString().split('T')[0]}"]\n`;
      pgn += `[Round "?"]\n`;
      pgn += `[White "Player"]\n`;
      pgn += `[Black "Player"]\n`;
      pgn += `[Result "*"]\n\n`;
    }
    
    // Add moves
    for (let i = 0; i < history.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      pgn += `${moveNumber}. ${history[i]}`;
      if (history[i + 1]) {
        pgn += ` ${history[i + 1]}`;
      }
      if ((i + 2) % 10 === 0) {
        pgn += '\n';
      } else {
        pgn += ' ';
      }
    }
    
    // Add result if game is over
    if (gameInstance.isGameOver()) {
      if (gameInstance.isCheckmate()) {
        pgn += gameInstance.turn() === 'w' ? ' 0-1' : ' 1-0';
      } else {
        pgn += ' 1/2-1/2';
      }
    }
    
    return pgn.trim();
  }, [gameMode, opponent, user, timeControl]);

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
          playerColor: playerColorRef.current, // Use persistent color
          isMyTurn,
          activePlayer
        });
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
          
          const pgn = generatePGN(gameCopy);
          if (onPgnUpdate) {
            onPgnUpdate(pgn);
          }
          
          return true;
        }

        // For multiplayer, send to server
        if (gameMode === 'multiplayer' && gameId) {
          try {
            setSyncStatus('syncing');
            
            const response = await api.patch('/?endpoint=game-sessions&action=move', {
              gameId,
              move: move.san,
              fen: gameCopy.fen()
            });
            
            if (response.data.success) {
              console.log('📡 Move sent to server:', {
                move: move.san,
                version: response.data.version,
                turn: response.data.turn
              });
              
              setSyncStatus('synced');
              
              // Clear selection immediately
              setSelectedSquare(null);
              setPossibleMoves([]);
              
              // Force immediate sync to get updated game state
              setTimeout(() => syncWithServer(), 100);
              
              setTimeout(() => setSyncStatus('connected'), 1000);
            } else {
              console.error('❌ Server rejected move:', response.data.message);
              setSyncStatus('error');
              return false;
            }
          } catch (error) {
            console.error('❌ Error sending move to server:', error);
            setSyncStatus('error');
            return false;
          }
        }

        return true;
      }
    } catch (error) {
      console.log('❌ Invalid move:', error);
    }
    
    return false;
  }, [game, gameMode, gameStarted, isMyTurn, updateGameStatus, updateCapturedPieces, onPgnUpdate, generatePGN, user, gameId, activePlayer]);

  const onSquareClick = useCallback((square) => {
    // For multiplayer, check if it's player's turn
    if (gameMode === 'multiplayer') {
      if (!gameStarted || !isMyTurn) {
        console.log('⏸️ Not your turn or game not started:', { 
          gameStarted, 
          isMyTurn, 
          playerColor: playerColorRef.current, 
          activePlayer 
        });
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
  }, [game, selectedSquare, makeMove, gameMode, gameStarted, isMyTurn, activePlayer]);

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
    setIsMyTurn(gameMode === 'practice' ? true : playerColorRef.current === 'white');
    setGameStateVersion(0);
    setPendingRequests([]);
    isInitializedRef.current = false;
    
    // Reset player color ref for new games
    if (gameMode === 'practice') {
      playerColorRef.current = 'white';
      setPlayerColor('white');
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
    
    if (gameMode === 'multiplayer') {
      endGameOnServer(result);
    }
  }, [gameMode]);

  const handleResign = useCallback(() => {
    if (gameMode === 'multiplayer') {
      const winner = playerColorRef.current === 'white' ? 'Black' : 'White';
      const result = { winner, reason: 'resignation' };
      endGameOnServer(result);
    }
    
    if (onGameEnd) {
      onGameEnd();
    }
  }, [gameMode, onGameEnd]);

  // FIXED: Send draw offer request to server
  const offerDraw = useCallback(async () => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const response = await api.post('/?endpoint=game-sessions&action=request', {
          gameId,
          requestType: 'draw'
        });
        
        if (response.data.success) {
          alert('Draw offer sent to opponent');
        } else {
          alert('Failed to send draw offer: ' + response.data.message);
        }
      } catch (error) {
        console.error('Error sending draw offer:', error);
        alert('Failed to send draw offer');
      }
    }
  }, [gameMode, gameId]);

  // FIXED: Send pause request to server
  const requestPause = useCallback(async () => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const response = await api.post('/?endpoint=game-sessions&action=request', {
          gameId,
          requestType: 'pause'
        });
        
        if (response.data.success) {
          alert('Pause request sent to opponent');
        } else {
          alert('Failed to send pause request: ' + response.data.message);
        }
      } catch (error) {
        console.error('Error sending pause request:', error);
        alert('Failed to send pause request');
      }
    } else {
      setIsPaused(!isPaused);
    }
  }, [gameMode, gameId, isPaused]);

  // FIXED: Respond to draw/pause requests
  const respondToRequest = useCallback(async (requestType, response) => {
    if (gameMode === 'multiplayer' && gameId) {
      try {
        const apiResponse = await api.patch('/?endpoint=game-sessions&action=respond-request', {
          gameId,
          requestType,
          response
        });
        
        if (apiResponse.data.success) {
          // Force sync to get updated game state
          setTimeout(() => syncWithServer(), 100);
        } else {
          alert('Failed to respond to request: ' + apiResponse.data.message);
        }
      } catch (error) {
        console.error('Error responding to request:', error);
        alert('Failed to respond to request');
      }
    }
  }, [gameMode, gameId]);

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

  // FIXED: Get pending requests for current user
  const myPendingRequests = pendingRequests.filter(req => 
    !req.fromPlayer.equals ? req.fromPlayer !== user._id : String(req.fromPlayer) !== String(user._id)
  );

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
        
        {/* Timers - Mobile: Top, Desktop: Left */}
        {gameMode !== 'practice' && gameStarted && (
          <div className="lg:col-span-2 order-1 lg:order-1">
            <div className="flex lg:flex-col gap-3 lg:gap-4">
              {/* FIXED: Show opponent's timer on top */}
              <div className="flex-1 lg:flex-none">
                <GameTimer
                  initialTime={timeControl[playerColorRef.current === 'white' ? 'black' : 'white']}
                  isActive={activePlayer !== playerColorRef.current && !isPaused && gameStarted}
                  onTimeUp={handleTimeUp}
                  player={playerColorRef.current === 'white' ? 'black' : 'white'}
                  isPaused={isPaused}
                  serverControlled={gameMode === 'multiplayer'}
                  currentTime={timeControl[playerColorRef.current === 'white' ? 'black' : 'white']}
                />
              </div>
              {/* FIXED: Show player's timer on bottom */}
              <div className="flex-1 lg:flex-none">
                <GameTimer
                  initialTime={timeControl[playerColorRef.current]}
                  isActive={activePlayer === playerColorRef.current && !isPaused && gameStarted}
                  onTimeUp={handleTimeUp}
                  player={playerColorRef.current}
                  isPaused={isPaused}
                  serverControlled={gameMode === 'multiplayer'}
                  currentTime={timeControl[playerColorRef.current]}
                />
              </div>
            </div>
          </div>
        )}

        {/* Chess Board - Center */}
        <div className={`${gameMode === 'practice' ? 'lg:col-span-8' : 'lg:col-span-6'} order-2 lg:order-2`}>
          <motion.div 
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl lg:rounded-2xl p-3 lg:p-6 shadow-xl border border-gray-200 dark:border-gray-700"
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
                boardOrientation={gameMode === 'multiplayer' ? playerColorRef.current : 'white'}
                animationDuration={200}
                arePiecesDraggable={!game.isGameOver() && (gameMode === 'practice' || (gameStarted && isMyTurn))}
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
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
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
                {gameStatus}
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
                  <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">You are: {playerColorRef.current}</div>
                  <div className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">Time: {Math.floor(initialTimeControl / 60)} min</div>
                  <div className={`text-xs lg:text-sm mt-1 font-medium ${isMyTurn ? 'text-green-600' : 'text-orange-600'}`}>
                    {isMyTurn ? '● Your turn' : '● Opponent\'s turn'}
                  </div>
                  <div className={`text-xs mt-1 ${getSyncStatusColor()}`}>
                    ● {getSyncStatusText()} (v{gameStateVersion})
                  </div>
                  {!gameStarted && gameSession?.status === 'waiting' && (
                    <div className="text-xs mt-1 text-blue-600">
                      ⏳ Waiting for both players to connect...
                    </div>
                  )}
                </div>
              )}
            </motion.div>

            {/* FIXED: Pending Requests */}
            {myPendingRequests.length > 0 && (
              <motion.div 
                className="bg-yellow-50/90 dark:bg-yellow-900/20 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-yellow-200 dark:border-yellow-800"
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                <h3 className="text-base lg:text-lg font-bold mb-3 text-gray-900 dark:text-white">Pending Requests</h3>
                {myPendingRequests.map((request, index) => (
                  <div key={index} className="mb-3 p-3 bg-white/50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                      Opponent requests: <strong>{request.type}</strong>
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => respondToRequest(request.type, 'accept')}
                        className="flex-1 px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondToRequest(request.type, 'decline')}
                        className="flex-1 px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Controls */}
            <motion.div 
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <h3 className="text-base lg:text-lg font-bold mb-3 text-gray-900 dark:text-white">Controls</h3>
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
                      onClick={offerDraw}
                      className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300 text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Offer Draw
                    </motion.button>
                    
                    <motion.button
                      onClick={requestPause}
                      className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isPaused ? 'Resume' : 'Request Pause'}
                    </motion.button>
                  </>
                )}
                
                {gameMode === 'practice' && (
                  <>
                    <motion.button
                      onClick={requestPause}
                      className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-medium rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-300 text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isPaused ? 'Resume' : 'Pause'}
                    </motion.button>
                    
                    <motion.button
                      onClick={() => {
                        const result = { winner: null, reason: 'agreement' };
                        setGameResult(result);
                        setShowGameOver(true);
                      }}
                      className="w-full px-4 py-2 lg:py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-medium rounded-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300 text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Declare Draw
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>

            {/* Captured Pieces */}
            <motion.div 
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
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
              className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl p-4 lg:p-5 shadow-xl border border-gray-200 dark:border-gray-700"
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
                  {gameResult.reason === 'agreement' && 'By mutual agreement'}
                  {gameResult.reason === 'stalemate' && 'By stalemate'}
                  {gameResult.reason === 'repetition' && 'By threefold repetition'}
                  {gameResult.reason === 'insufficient_material' && 'By insufficient material'}
                  {gameResult.reason === 'fifty_move' && 'By 50-move rule'}
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