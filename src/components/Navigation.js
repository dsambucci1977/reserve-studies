'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Super Admin emails - only these can access super admin panel
const SUPER_ADMINS = [
  'donato@pronoia.com',
  'donato@pronoia.solutions'
];

export default function Navigation() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isSuperAdmin = SUPER_ADMINS.includes(user.email);

  const navLink = (href, label) => {
    const isActive = pathname === href || pathname?.startsWith(href + '/');
    return (
      <Link
        href={href}
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="bg-white shadow-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Logo/Brand */}
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-blue-600">
              Reserve Studies
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-1">
            
            {navLink('/sites', 'Sites')}
            {navLink('/notes', 'Notes')}
            {navLink('/profile', 'Profile')}

            {/* Admin Link - Only for admin/super_admin users */}
            {isAdmin && navLink('/admin', 'Admin')}

            {/* Super Admin Link - Only for Pronoia Solutions */}
            {isSuperAdmin && (
              <Link 
                href="/super-admin" 
                className={`px-3 py-2 rounded-md text-sm font-bold transition-colors ${
                  pathname === '/super-admin'
                    ? 'text-white bg-red-700'
                    : 'text-white bg-red-600 hover:bg-red-700'
                }`}
              >
                ⚡ Super Admin
              </Link>
            )}

            {/* User Info & Sign Out */}
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-300">
              <span className="text-sm text-gray-700">
                {user.displayName || user.email}
              </span>
              <button
                onClick={() => signOut()}
                className="px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
