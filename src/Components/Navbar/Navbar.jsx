import { Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

const Navbar = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();

  const isActive = (path) => location.pathname === path;

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleLogout = () => {
    logout();
    setIsMenuOpen(false);
  };

  return (
    <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md fixed top-0 left-0 w-full flex justify-between items-center py-4 px-4 sm:px-8 shadow-lg border-b border-gray-200 dark:border-gray-700 z-50 transition-all duration-300">
      <div className="text-gray-900 dark:text-white text-lg sm:text-xl font-bold tracking-wide hover:scale-105 transform transition-all duration-300 cursor-pointer">
        <Link to="/">
          <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            IIT Dharwad
          </span>
          <span className="ml-2 hidden sm:inline">Chess Club</span>
          <span className="ml-2 sm:hidden">Chess</span>
        </Link>
      </div>
      
      {/* Desktop Menu */}
      <div className="hidden md:flex items-center space-x-6">
        <ul className="flex space-x-6">
          {[
            { path: '/', label: 'Home' },
            { path: '/about', label: 'About Us' },
            { path: '/leaderboard', label: 'Leaderboard' },
            { path: '/tournaments', label: 'Tournaments' },
            ...(isAuthenticated ? [{ path: '/play', label: 'Play Chess' }] : []),
            ...(user?.role === 'admin' ? [{ path: '/admin', label: 'Admin' }] : [])
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
        
        {/* User Menu */}
        <div className="flex items-center space-x-4">
          {isAuthenticated ? (
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Welcome, <span className="font-semibold text-yellow-600 dark:text-yellow-400">{user?.username}</span>
                {user?.role === 'admin' && (
                  <span className="ml-2 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                    Admin
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/login"
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105"
              >
                Sign Up
              </Link>
            </div>
          )}
          <ThemeToggle />
        </div>
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
              ...(isAuthenticated ? [{ path: '/play', label: 'Play Chess' }] : []),
              ...(user?.role === 'admin' ? [{ path: '/admin', label: 'Admin' }] : [])
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
            
            {/* Mobile Auth Menu */}
            <div className="border-t border-gray-200 dark:border-gray-700 mt-4 pt-4 px-6">
              {isAuthenticated ? (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Welcome, <span className="font-semibold text-yellow-600 dark:text-yellow-400">{user?.username}</span>
                    {user?.role === 'admin' && (
                      <span className="ml-2 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/login"
                    onClick={() => setIsMenuOpen(false)}
                    className="block w-full px-4 py-2 text-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setIsMenuOpen(false)}
                    className="block w-full px-4 py-2 text-center bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-300"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </ul>
        </div>
      )}
    </nav>
  );
};

export default Navbar;