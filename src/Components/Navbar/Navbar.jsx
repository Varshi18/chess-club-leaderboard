import { Link, useLocation } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle/ThemeToggle';

const Navbar = () => {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md fixed top-0 left-0 w-full flex justify-between items-center py-4 px-8 shadow-lg border-b border-gray-200 dark:border-gray-700 z-50 transition-all duration-300">
      <div className="text-gray-900 dark:text-white text-xl font-bold tracking-wide hover:scale-105 transform transition-all duration-300 cursor-pointer">
        <span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          IIT Dharwad
        </span>
        <span className="ml-2">Chess Club</span>
      </div>
      
      <div className="flex items-center space-x-6">
        <ul className="flex space-x-6">
          {[
            { path: '/', label: 'Home' },
            { path: '/about', label: 'About Us' },
            { path: '/leaderboard', label: 'Leaderboard' },
            { path: '/tournaments', label: 'Tournaments' }
          ].map(({ path, label }) => (
            <li key={path}>
              <Link
                to={path}
                className={`relative px-4 py-2 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 ${
                  isActive(path)
                    ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    : 'text-gray-700 dark:text-gray-300 hover:text-yellow-500 dark:hover:text-yellow-400'
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
    </nav>
  );
};

export default Navbar;