import { Link } from 'react-router-dom';

const Navbar = () => {
  return (
    <nav className="bg-gray-800 fixed top-0 left-0 w-full flex justify-between items-center py-4 px-8 shadow-md">
      <div className="text-white text-xl font-semibold">IIT Dharwad Chess Club</div>
      <ul className="flex space-x-6">
        <li><Link to="/" className="text-gray-300 hover:text-yellow-400">Home</Link></li>
        <li><Link to="/about" className="text-gray-300 hover:text-yellow-400">About Us</Link></li>
        <li><Link to="/leaderboard" className="text-gray-300 hover:text-yellow-400">Leaderboard</Link></li>
        <li><Link to="/tournaments" className="text-gray-300 hover:text-yellow-400">Tournaments</Link></li>
      </ul>
    </nav>
  );
};

export default Navbar;