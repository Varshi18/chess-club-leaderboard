import { Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
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

  const closeMenu = () => setIsMenuOpen(false);

  // Close menu when clicking outside or on escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isMenuOpen && !event.target.closest('.mobile-menu-container')) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape' && isMenuOpen) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const navigationItems = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About Us' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/tournaments', label: 'Tournaments' },
    { path: '/games', label: 'Games' },
    ...(isAuthenticated ? [{ path: '/play', label: 'Play Chess' }] : []),
    ...(user?.role === 'admin' ? [{ path: '/admin', label: 'Admin' }] : [])
  ];

  // FIXED: Truncate username to prevent overflow
  const truncateUsername = (username) => {
    if (!username) return '';
    return username.length > 12 ? username.substring(0, 12) + '...' : username;
  };

  return (
    <>
      <nav className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md fixed top-0 left-0 w-full flex justify-between items-center py-3 px-4 lg:px-8 shadow-lg border-b border-gray-200 dark:border-gray-700 z-50 transition-all duration-300">
        {/* Logo */}
        <div className="text-gray-900 dark:text-white text-lg lg:text-xl font-bold tracking-wide hover:scale-105 transform transition-all duration-300 cursor-pointer flex-shrink-0">
          <Link to="/" onClick={closeMenu} className="flex items-center">
            <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              IIT Dharwad
            </span>
            <span className="ml-2 text-gray-900 dark:text-white hidden sm:inline">Chess Club</span>
            <span className="ml-2 text-gray-900 dark:text-white sm:hidden">Chess</span>
          </Link>
        </div>
        
        {/* Desktop Menu */}
        <div className="hidden lg:flex items-center space-x-4 xl:space-x-6">
          <ul className="flex space-x-3 xl:space-x-4">
            {navigationItems.map(({ path, label }) => (
              <li key={path}>
                <Link
                  to={path}
                  className={`relative px-3 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 text-sm ${
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
          
          {/* Desktop User Menu - FIXED: Better layout for long usernames */}
          <div className="flex items-center space-x-3">
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                <div className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px]">
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">Welcome,</span>
                    <span className="font-semibold text-yellow-600 dark:text-yellow-400 truncate" title={user?.username}>
                      {truncateUsername(user?.username)}
                    </span>
                  </div>
                  {user?.role === 'admin' && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300 transform hover:scale-105 text-sm whitespace-nowrap"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  to="/login"
                  className="px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 text-sm"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-3 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-300 transform hover:scale-105 text-sm"
                >
                  Sign Up
                </Link>
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile Menu Button and Theme Toggle */}
        <div className="lg:hidden flex items-center space-x-3">
          <ThemeToggle />
          <button
            onClick={toggleMenu}
            className="text-gray-700 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400 transition-colors duration-300 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
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
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 lg:hidden z-40" onClick={closeMenu} />
      )}
      
      {/* Mobile Menu */}
      <div className={`mobile-menu-container fixed top-0 right-0 h-full w-80 max-w-[85vw] bg-white dark:bg-gray-900 lg:hidden z-50 transform transition-transform duration-300 ease-in-out ${
        isMenuOpen ? 'translate-x-0' : 'translate-x-full'
      } shadow-2xl`}>
        <div className="flex flex-col h-full">
          {/* Mobile Menu Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                IIT Dharwad
              </span>
              <span className="ml-2">Chess</span>
            </div>
            <button
              onClick={closeMenu}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Mobile Menu Content */}
          <div className="flex-1 overflow-y-auto py-4">
            {/* Navigation Links */}
            <div className="px-4 space-y-2">
              {navigationItems.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={closeMenu}
                  className={`block px-4 py-3 font-medium transition-all duration-300 rounded-lg ${
                    isActive(path)
                      ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-500'
                      : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
            
            {/* Mobile Auth Section - FIXED: Better username display */}
            <div className="border-t border-gray-200 dark:border-gray-700 mt-6 pt-6 px-4">
              {isAuthenticated ? (
                <div className="space-y-4">
                  <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400">Welcome back!</div>
                    <div className="font-semibold text-yellow-600 dark:text-yellow-400 break-words" title={user?.username}>
                      {user?.username}
                    </div>
                    {user?.role === 'admin' && (
                      <span className="inline-block mt-2 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                        Admin
                      </span>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white font-medium rounded-lg hover:from-red-600 hover:to-red-700 transition-all duration-300"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    to="/login"
                    onClick={closeMenu}
                    className="block w-full px-4 py-3 text-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300 border border-gray-300 dark:border-gray-600"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={closeMenu}
                    className="block w-full px-4 py-3 text-center bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all duration-300"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Navbar;