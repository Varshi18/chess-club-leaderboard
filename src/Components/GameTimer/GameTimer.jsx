import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const GameTimer = ({ 
  initialTime = 600, // 10 minutes in seconds
  isActive = false, 
  onTimeUp, 
  player = 'white',
  isPaused = false 
}) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    setTimeLeft(initialTime);
  }, [initialTime]);

  useEffect(() => {
    let interval = null;
    
    if (isActive && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => {
          if (time <= 1) {
            onTimeUp && onTimeUp(player);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else if (!isActive || isPaused) {
      clearInterval(interval);
    }
    
    return () => clearInterval(interval);
  }, [isActive, isPaused, timeLeft, onTimeUp, player]);

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

  const progress = (timeLeft / initialTime) * 100;

  return (
    <motion.div 
      className={`relative p-4 rounded-xl shadow-lg ${
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
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            className={`h-full bg-gradient-to-r ${getTimerColor()}`}
            initial={{ width: '100%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        
        {/* Warning indicators */}
        {timeLeft <= 30 && (
          <motion.div
            className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </div>
    </motion.div>
  );
};

export default GameTimer;