import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import ThreeBackground from "../../Components/ThreeBackground/ThreeBackground";

const AboutUs = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const features = [
    {
      icon: "🏆",
      title: "Tournaments",
      description: "Regular tournaments for players of all skill levels"
    },
    {
      icon: "📚",
      title: "Training",
      description: "Comprehensive training sessions and workshops"
    },
    {
      icon: "🤝",
      title: "Community",
      description: "Connect with fellow chess enthusiasts"
    },
    {
      icon: "🎯",
      title: "Improvement",
      description: "Track your progress and improve your game"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 transition-all duration-500 relative overflow-hidden">
      <ThreeBackground />
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <motion.div 
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          <motion.h1 
            className="text-3xl sm:text-5xl md:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent"
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            About Us
          </motion.h1>
          <motion.div 
            className="w-16 sm:w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full"
            initial={{ width: 0 }}
            animate={{ width: isVisible ? '6rem' : 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8 sm:gap-12 items-center mb-12 sm:mb-16">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.2 }}
          >
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white">Our Mission</h2>
              <div className="space-y-4 sm:space-y-6 text-base sm:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                >
                  Welcome to the <span className="font-semibold text-yellow-600 dark:text-yellow-400">IIT Dharwad Chess Club</span>! 
                  We are a vibrant community of chess enthusiasts who share a passion for the royal game.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.6 }}
                >
                  Our club serves as a hub for players of all skill levels, from curious beginners taking their first steps 
                  into the world of chess to seasoned players seeking challenging competition.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.8 }}
                >
                  Through regular tournaments, training sessions, and friendly matches, we foster an environment where 
                  strategic thinking flourishes and lasting friendships are forged over the chessboard.
                </motion.p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <div className="relative">
              <motion.div 
                className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl sm:rounded-3xl opacity-20"
                animate={{ rotate: [0, 3, -3, 0] }}
                transition={{ duration: 6, repeat: Infinity }}
              />
              <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl border border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <motion.div 
                    className="text-4xl sm:text-6xl mb-4"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    ♔
                  </motion.div>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4">Join Our Community</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm sm:text-base">
                    Be part of something bigger. Connect, compete, and grow with us.
                  </p>
                  <motion.a
                    href="https://chat.whatsapp.com/HP1pRgxIyIfIlwsoN7iMO3"
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <button className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl">
                      Get Started
                    </button>
                  </motion.a>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.6 }}
        >
          <h2 className="text-2xl sm:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900 dark:text-white">
            What We <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">Offer</span>
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                className="group bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-200 dark:border-gray-700"
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -10 }}
              >
                <div className="text-center">
                  <motion.div 
                    className="text-3xl sm:text-4xl mb-3 sm:mb-4"
                    animate={{ 
                      rotate: [0, 10, -10, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ 
                      duration: 3, 
                      repeat: Infinity, 
                      delay: index * 0.5 
                    }}
                  >
                    {feature.icon}
                  </motion.div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 text-gray-900 dark:text-white group-hover:text-yellow-500 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div 
          className="text-center mt-12 sm:mt-16"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1 }}
        >
          <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-white shadow-2xl">
            <motion.h3 
              className="text-2xl sm:text-3xl font-bold mb-4"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              Ready to Make Your Move?
            </motion.h3>
            <p className="text-lg sm:text-xl mb-6 opacity-90">
              Whether you're a beginner or a grandmaster, there's a place for you in our chess family.
            </p>
            <motion.a 
              href="https://www.chess.com/club/iit-dharwad-chess"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <button className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white text-gray-900 font-bold rounded-xl hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl">
                Join Us Today
              </button>
            </motion.a>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AboutUs;