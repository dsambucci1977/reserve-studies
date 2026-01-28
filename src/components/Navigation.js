'use client';

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const SUPER_ADMINS = [
  'donato@pronoia.com',
  'donato@pronoia.solutions'
];

export default function Navigation() {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  
  if (loading) return null;
  if (!user) return null;
  
  const isSuperAdmin = SUPER_ADMINS.includes(user.email);
  
  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link href="/" className="flex items-center px-3 text-xl font-bold text-blue-600">
              Reserve Studies
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
              <Link
                href="/sites"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                  pathname === '/sites'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Sites
              </Link>
              <Link
                href="/notes"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                  pathname === '/notes'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Notes
              </Link>
              <Link
                href="/profile"
                className={`inline-flex items-center px-3 py-2 text-sm font-medium ${
                  pathname === '/profile'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                Profile
              </Link>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">{user.email}</span>
            
            {isSuperAdmin && (
              <Link
                href="/super-admin"
                className="px-3 py-1 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700"
              >
                ⚡ Super Admin
              </Link>
            )}
            
            <button
              onClick={signOut}
              className="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}


