import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const GameTimer = ({ 
  initialTime = 600, // 10 minutes in seconds
  isActive = false, 
  onTimeUp, 
  player = 'white',
  isPaused = false,
  serverControlled = false,
  currentTime = null // For server-controlled timers
}) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const intervalRef = useRef(null);
  const lastUpdateRef = useRef(Date.now());
  const startTimeRef = useRef(Date.now());

  // Update time when props change
  useEffect(() => {
    if (serverControlled && currentTime !== null) {
      // For server-controlled timers, use the exact server time
      const newTime = Math.max(0, Math.floor(currentTime));
      setTimeLeft(newTime);
      startTimeRef.current = Date.now();
    } else {
      // For practice mode, use initial time
      setTimeLeft(initialTime);
      startTimeRef.current = Date.now();
    }
  }, [initialTime, serverControlled, currentTime]);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    // FIXED: Only run local timer for practice mode OR when server-controlled timer is active
    if (isActive && !isPaused && timeLeft > 0) {
      lastUpdateRef.current = Date.now();
      
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - lastUpdateRef.current) / 1000);
        
        if (elapsed >= 1) {
          setTimeLeft(prevTime => {
            const newTime = Math.max(0, prevTime - elapsed);
            if (newTime <= 0 && onTimeUp) {
              onTimeUp(player);
            }
            return newTime;
          });
          lastUpdateRef.current = now;
        }
      }, 100); // Check every 100ms for smooth updates
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isPaused, timeLeft, onTimeUp, player, serverControlled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 30) return 'from-red-500 to-red-700';
    if (timeLeft <= 60) return 'from-orange-500 to-orange-700';
    if (timeLeft <= 120) return 'from-yellow-500 to-yellow-700';
    return 'from-green-500 to-green-700';
  };

  const progress = initialTime > 0 ? (timeLeft / initialTime) * 100 : 0;

  return (
    <motion.div 
      className={`relative p-4 rounded-xl shadow-lg bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 ${
        isActive ? 'ring-2 ring-blue-400 ring-opacity-75' : ''
      }`}
      animate={{ 
        scale: isActive ? 1.05 : 1,
        boxShadow: isActive ? '0 0 20px rgba(59, 130, 246, 0.5)' : '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-center">
        <div className={`text-2xl font-bold bg-gradient-to-r ${getTimerColor()} bg-clip-text text-transparent mb-2`}>
          {formatTime(timeLeft)}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 capitalize mb-2">
          {player} Player
          {isActive && !isPaused && (
            <span className="block text-xs text-green-500">● Active</span>
          )}
          {isPaused && (
            <span className="block text-xs text-yellow-500">⏸ Paused</span>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${getTimerColor()}`}
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        
        {/* Warning indicators */}
        {timeLeft <= 30 && timeLeft > 0 && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
        
        {/* Time up indicator */}
        {timeLeft <= 0 && (
          <motion.div
            className="absolute inset-0 bg-red-500/20 rounded-xl flex items-center justify-center"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1 }}
          >
            <span className="text-red-600 font-bold text-sm">TIME UP</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default GameTimer;