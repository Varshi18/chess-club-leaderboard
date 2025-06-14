import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThreeBackground from "../../Components/ThreeBackground/ThreeBackground";

export const tournamentsData = [
  { name: "Blitz Battles-2", link: "https://www.chess.com/play/tournament/5519883", date: "2025-03-09" },
  { name: "Rapid Showdown-3", link: "https://www.chess.com/play/tournament/5518983", date: "2025-03-09" },
  { name: "Blitz Battles-1", link: "https://www.chess.com/tournament/live/blitz-battles-1-5417455", date: "2025-01-25" },
  { name: "Rapid Showdown-2", link: "https://www.chess.com/tournament/live/rapid-showdown-2-5398853", date: "2025-01-19" },
  { name: "Rapid Showdown-1", link: "https://www.chess.com/tournament/live/rapid-showdown-1-5398853", date: "2025-01-12" },
];

const TournamentPage = () => {
  const [tournaments, setTournaments] = useState({ upcoming: [], current: [], past: [] });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  useEffect(() => {
    const updateTournaments = () => {
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();

      const updatedTournaments = { upcoming: [], current: [], past: [] };

      tournamentsData.forEach((tournament) => {
        if (tournament.date > today) {
          updatedTournaments.upcoming.push(tournament);
        } else if (tournament.date === today) {
          if (currentHour === 21 || (currentHour === 22 && currentMinutes === 0)) {
            updatedTournaments.current.push(tournament);
          } else if (currentHour >= 22) {
            updatedTournaments.past.push(tournament);
          } else {
            updatedTournaments.upcoming.push(tournament);
          }
        } else {
          updatedTournaments.past.push(tournament);
        }
      });

      setTournaments(updatedTournaments);
    };

    updateTournaments();
    const interval = setInterval(updateTournaments, 60000);

    return () => clearInterval(interval);
  }, []);

  const getSectionIcon = (title) => {
    if (title.includes('Upcoming')) return '🚀';
    if (title.includes('Current')) return '⚡';
    if (title.includes('Past')) return '🏆';
    return '📅';
  };

  const getSectionColor = (title) => {
    if (title.includes('Upcoming')) return 'from-blue-500 to-purple-600';
    if (title.includes('Current')) return 'from-green-500 to-emerald-600';
    if (title.includes('Past')) return 'from-gray-500 to-gray-600';
    return 'from-yellow-500 to-orange-600';
  };

  return (
    <div className="min-h-screen relative overflow-hidden pt-20">
      <div className="fixed inset-0 z-0">
        <ThreeBackground />
      </div>
      <div className="relative z-10 min-h-screen bg-white/20 dark:bg-black/20 backdrop-blur-[2px] transition-all duration-500">
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
            Tournaments
          </motion.h1>
          <motion.div 
            className="w-16 sm:w-24 h-1 bg-gradient-to-r from-yellow-400 to-orange-500 mx-auto rounded-full mb-4 sm:mb-6"
            initial={{ width: 0 }}
            animate={{ width: isVisible ? '6rem' : 0 }}
            transition={{ duration: 1, delay: 0.5 }}
          />
          <motion.p 
            className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            Compete in exciting chess tournaments and showcase your skills against fellow players
          </motion.p>
        </motion.div>

        <div className="space-y-8 sm:space-y-12">
          <Section 
            title="Upcoming Tournaments" 
            data={tournaments.upcoming} 
            icon={getSectionIcon('Upcoming')}
            colorClass={getSectionColor('Upcoming')}
            isVisible={isVisible}
            delay={200}
          />
          <Section 
            title="Current Tournaments" 
            data={tournaments.current} 
            icon={getSectionIcon('Current')}
            colorClass={getSectionColor('Current')}
            isVisible={isVisible}
            delay={400}
          />
          <Section 
            title="Past Tournaments" 
            data={tournaments.past} 
            icon={getSectionIcon('Past')}
            colorClass={getSectionColor('Past')}
            isVisible={isVisible}
            delay={600}
          />
        </div>
      </div>
    </div>
    </div>
  );
};

const Section = ({ title, data, icon, colorClass, isVisible, delay }) => (
  <motion.div 
    initial={{ opacity: 0, y: 50 }}
    animate={{ opacity: isVisible ? 1 : 0, y: isVisible ? 0 : 50 }}
    transition={{ duration: 1, delay: delay / 1000 }}
  >
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
      <motion.div 
        className={`bg-gradient-to-r ${colorClass} p-4 sm:p-6`}
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.8, delay: delay / 1000 + 0.2 }}
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center">
          <motion.span 
            className="text-3xl sm:text-4xl mr-3 sm:mr-4"
            animate={{ 
              rotate: [0, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 3, 
              repeat: Infinity, 
              delay: delay / 1000 
            }}
          >
            {icon}
          </motion.span>
          <span className="truncate">{title}</span>
        </h2>
      </motion.div>
      
      <div className="p-4 sm:p-6">
        {data.length > 0 ? (
          <div className="grid gap-4 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {data.map((tournament, index) => (
                <motion.div
                  key={index}
                  className="group bg-gray-50/80 dark:bg-gray-700/80 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 hover:shadow-xl transition-all duration-500 border border-gray-200 dark:border-gray-600"
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ duration: 0.5, delay: delay / 1000 + index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                  layout
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white group-hover:text-yellow-500 transition-colors duration-300 mb-2 truncate">
                        {tournament.name}
                      </h3>
                      <div className="flex items-center text-gray-600 dark:text-gray-400">
                        <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm sm:text-base">{tournament.date}</span>
                      </div>
                    </div>
                    <motion.div 
                      className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center flex-shrink-0 ml-3"
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 4, repeat: Infinity, delay: index * 0.5 }}
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </motion.div>
                  </div>
                  
                  <motion.a
                    href={tournament.link}
                    className="inline-flex items-center justify-center w-full px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 text-sm sm:text-base"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span>View Tournament</span>
                    <motion.svg 
                      className="w-4 h-4 ml-2 flex-shrink-0" 
                      fill="currentColor" 
                      viewBox="0 0 20 20"
                      animate={{ x: [0, 3, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </motion.svg>
                  </motion.a>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div 
            className="text-center py-8 sm:py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: delay / 1000 + 0.3 }}
          >
            <motion.div 
              className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200/50 dark:bg-gray-600/50 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-6"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            </motion.div>
            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">No tournaments available.</p>
          </motion.div>
        )}
      </div>
    </div>
  </motion.div>
);

export default TournamentPage;