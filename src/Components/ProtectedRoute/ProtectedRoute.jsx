import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-yellow-200 dark:border-yellow-800 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-16 h-16 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-8">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly) {
    console.log('Admin check - User:', user); // Debug log
    console.log('User role:', user?.role); // Debug log
    
    if (!user || user.role !== 'admin') {
      console.log('Access denied - not admin'); // Debug log
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400">You need admin privileges to access this page.</p>
            <button 
              onClick={() => window.history.back()} 
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;