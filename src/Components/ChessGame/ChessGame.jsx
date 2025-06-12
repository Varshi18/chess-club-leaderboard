import React, { useState, useCallback, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';

const ChessGame = () => {
  const [game, setGame] = useState(new Chess());
  const [gamePosition, setGamePosition] = useState(game.fen());
  const [moveHistory, setMoveHistory] = useState([]);
  const [gameStatus, setGameStatus] = useState('');
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [possibleMoves, setPossibleMoves] = useState([]);
  const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });

  const updateGameStatus = useCallback((gameInstance) => {
    if (gameInstance.isCheckmate()) {
      setGameStatus(`Checkmate! ${gameInstance.turn() === 'w' ? 'Black' : 'White'} wins!`);
    } else if (gameInstance.isDraw()) {
      if (gameInstance.isStalemate()) {
        setGameStatus('Draw by stalemate');
      } else if (gameInstance.isThreefoldRepetition()) {
        setGameStatus('Draw by threefold repetition');
      } else if (gameInstance.isInsufficientMaterial()) {
        setGameStatus('Draw by insufficient material');
      } else {
        setGameStatus('Draw by 50-move rule');
      }
    } else if (gameInstance.isCheck()) {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} is in check`);
    } else {
      setGameStatus(`${gameInstance.turn() === 'w' ? 'White' : 'Black'} to move`);
    }
  }, []);

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

  const makeMove = useCallback((sourceSquare, targetSquare, piece) => {
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
        setMoveHistory(gameCopy.history({ verbose: true }));
        updateGameStatus(gameCopy);
        updateCapturedPieces(gameCopy.history({ verbose: true }));
        setSelectedSquare(null);
        setPossibleMoves([]);
        return true;
      }
    } catch (error) {
      console.log('Invalid move:', error);
    }
    
    return false;
  }, [game, updateGameStatus, updateCapturedPieces]);

  const onSquareClick = useCallback((square) => {
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
  }, [game, selectedSquare, makeMove]);

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
    updateGameStatus(newGame);
  }, [updateGameStatus]);

  const undoMove = useCallback(() => {
    const gameCopy = new Chess();
    const history = game.history();
    
    if (history.length > 0) {
      history.pop();
      
      history.forEach(move => {
        gameCopy.move(move);
      });
      
      setGame(gameCopy);
      setGamePosition(gameCopy.fen());
      setMoveHistory(gameCopy.history({ verbose: true }));
      updateGameStatus(gameCopy);
      updateCapturedPieces(gameCopy.history({ verbose: true }));
      setSelectedSquare(null);
      setPossibleMoves([]);
    }
  }, [game, updateGameStatus, updateCapturedPieces]);

  useEffect(() => {
    updateGameStatus(game);
  }, [game, updateGameStatus]);

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
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Chess Board */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <div className="aspect-square max-w-full mx-auto">
              <Chessboard
                position={gamePosition}
                onPieceDrop={onPieceDrop}
                onSquareClick={onSquareClick}
                customSquareStyles={customSquareStyles}
                boardOrientation="white"
                animationDuration={200}
                arePiecesDraggable={!game.isGameOver()}
                customBoardStyle={{
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
            </div>
          </div>
        </div>

        {/* Game Info Panel */}
        <div className="space-y-4 sm:space-y-6">
          {/* Game Status */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Game Status</h3>
            <div className={`p-3 sm:p-4 rounded-lg text-center font-medium ${
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
          </div>

          {/* Game Controls */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Controls</h3>
            <div className="space-y-3">
              <button
                onClick={resetGame}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105"
              >
                New Game
              </button>
              <button
                onClick={undoMove}
                disabled={moveHistory.length === 0}
                className="w-full px-4 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white font-medium rounded-lg hover:from-gray-600 hover:to-gray-700 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Undo Move
              </button>
            </div>
          </div>

          {/* Captured Pieces */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Captured Pieces</h3>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">White Captured:</h4>
                <div className="flex flex-wrap gap-1">
                  {capturedPieces.white.map((piece, index) => (
                    <span key={index} className="text-2xl">
                      {getPieceSymbol(piece.toUpperCase())}
                    </span>
                  ))}
                  {capturedPieces.white.length === 0 && (
                    <span className="text-gray-400 dark:text-gray-500 text-sm">None</span>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Black Captured:</h4>
                <div className="flex flex-wrap gap-1">
                  {capturedPieces.black.map((piece, index) => (
                    <span key={index} className="text-2xl">
                      {getPieceSymbol(piece.toLowerCase())}
                    </span>
                  ))}
                  {capturedPieces.black.length === 0 && (
                    <span className="text-gray-400 dark:text-gray-500 text-sm">None</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Move History */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-2xl border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg sm:text-xl font-bold mb-4 text-gray-900 dark:text-white">Move History</h3>
            <div className="max-h-48 overflow-y-auto">
              {moveHistory.length > 0 ? (
                <div className="space-y-1">
                  {moveHistory.map((move, index) => (
                    <div key={index} className="flex justify-between items-center py-1 px-2 rounded text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {Math.floor(index / 2) + 1}.{index % 2 === 0 ? '' : '..'}
                      </span>
                      <span className="font-mono text-gray-900 dark:text-white">
                        {move.san}
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
    </div>
  );
};

export default ChessGame;