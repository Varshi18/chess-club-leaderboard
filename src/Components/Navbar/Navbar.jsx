import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

const Navbar = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md fixed top-0 left-0 w-full flex justify-between items-center py-4 px-4 sm:px-8 shadow-lg border-b border-gray-200 dark:border-gray-700 z-50 transition-all duration-300">
      <div className="text-gray-900 dark:text-white text-lg sm:text-xl font-bold tracking-wide hover:scale-105 transform transition-all duration-300 cursor-pointer">
        <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          IIT Dharwad
        </span>
        <span className="ml-2 hidden sm:inline">Chess Club</span>
        <span className="ml-2 sm:hidden">Chess</span>
      </div>
      
      {/* Desktop Menu */}
      <div className="hidden md:flex items-center space-x-6">
        <ul className="flex space-x-6">
          {[
            { path: '/', label: 'Home' },
            { path: '/about', label: 'About Us' },
            { path: '/leaderboard', label: 'Leaderboard' },
            { path: '/tournaments', label: 'Tournaments' },
            { path: '/play', label: 'Play Chess' }
          ].map(({ path, label }) => (
            <li key={path}>
              <Link
                to={path}
                className={`relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${
                  isActive(path)
                    ? 'text-gray-900 dark:text-white bg-yellow-100 dark:bg-yellow-900/30'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                }`}
              >
                {label}
                {isActive(path) && (
                  <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        <ThemeToggle />
      </div>

      {/* Mobile Menu Button */}
      <div className="md:hidden flex items-center space-x-4">
        <ThemeToggle />
        <button
          onClick={toggleMenu}
          className="text-gray-700 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors duration-300 p-2"
          aria-label="Toggle menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 md:hidden">
          <ul className="flex flex-col py-4">
            {[
              { path: '/', label: 'Home' },
              { path: '/about', label: 'About Us' },
              { path: '/leaderboard', label: 'Leaderboard' },
              { path: '/tournaments', label: 'Tournaments' },
              { path: '/play', label: 'Play Chess' }
            ].map(({ path, label }) => (
              <li key={path}>
                <Link
                  to={path}
                  onClick={() => setIsMenuOpen(false)}
                  className={`block px-6 py-3 font-medium transition-all duration-300 ${
                    isActive(path)
                      ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;