import React, { useState, useEffect } from "react";
import { tournamentsData } from "../Tournaments/Tournament";

const Home = () => {
  const [upcomingTournaments, setUpcomingTournaments] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    const upcoming = tournamentsData.filter((tournament) => tournament.date >= today);
    setUpcomingTournaments(upcoming);
    
    // Trigger animation
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-all duration-500">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/20 to-orange-500/20 dark:from-yellow-600/10 dark:to-orange-600/10"></div>
        <div className="relative flex flex-col items-center justify-center min-h-screen pt-20 px-4 sm:px-6">
          <div className={`text-center transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent animate-fade-in">
              Welcome to
            </h1>
            <h2 className="text-2xl sm:text-4xl md:text-6xl font-bold mb-6 sm:mb-8 bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent animate-bounce-slow">
              IIT Dharwad Chess Club
            </h2>
            <p className="text-lg sm:text-xl md:text-2xl text-gray-700 dark:text-gray-300 max-w-4xl mb-8 sm:mb-12 leading-relaxed px-4">
              Join a growing community of chess enthusiasts! Participate in tournaments, improve your skills, and compete with fellow students.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center px-4">
              <a
                href="https://www.chess.com/club/iit-dharwad-chess"
                className="group relative w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold rounded-xl text-base sm:text-lg transition-all duration-300 transform hover:scale-105 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800"
              >
                <span className="relative z-10 flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2 group-hover:animate-bounce" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 1.414L10.586 9.5H7a1 1 0 100 2h3.586l-1.293 1.293a1 1 0 101.414 1.414l3-3a1 1 0 000-1.414z" clipRule="evenodd" />
                  </svg>
                  Join the Club
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 rounded-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300"></div>
              </a>
              <a href="/src/Pages/AboutUs/AboutUs.jsx">
                <button className="group w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-bold rounded-xl text-base sm:text-lg border-2 border-gray-300 dark:border-gray-600 hover:border-yellow-400 dark:hover:border-yellow-400 transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2 group-hover:animate-spin" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    Learn More
                  </span>
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Upcoming Tournaments Section */}
      <div className="py-12 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className={`transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 text-gray-900 dark:text-white">
              <span className="bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                Upcoming Tournaments
              </span>
            </h2>
            
            {upcomingTournaments.length > 0 ? (
              <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
                {upcomingTournaments.map((tournament, index) => (
                  <div
                    key={index}
                    className={`group bg-white dark:bg-gray-800 rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 border border-gray-200 dark:border-gray-700 animate-fade-in-up`}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mr-3 sm:mr-4 group-hover:animate-pulse">
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white group-hover:text-yellow-500 transition-colors duration-300 truncate">
                          {tournament.name}
                        </h3>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">{tournament.date}</p>
                      </div>
                    </div>
                    <a
                      href={tournament.link}
                      className="inline-flex items-center justify-center w-full px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 text-sm sm:text-base"
                    >
                      Join Tournament
                      <svg className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform duration-300" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                  <svg className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-400">No upcoming tournaments at the moment.</p>
                <p className="text-gray-500 dark:text-gray-500 mt-2">Check back soon for new tournaments!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;