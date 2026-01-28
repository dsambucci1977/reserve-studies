'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [organization, setOrganization] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sites: 0, calculated: 0, pending: 0 });

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    loadUserData();
  }, [user]);

  const loadUserData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserProfile(userData);
        
        if (userData.organizationId) {
          const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
          if (orgDoc.exists()) {
            setOrganization(orgDoc.data());
          }
          
          // Load site stats
          try {
            const sitesQuery = query(
              collection(db, 'sites'),
              where('organizationId', '==', userData.organizationId)
            );
            const sitesSnapshot = await getDocs(sitesQuery);
            const sites = sitesSnapshot.docs.map(d => d.data());
            setStats({
              sites: sites.length,
              calculated: sites.filter(s => s.status === 'calculated').length,
              pending: sites.filter(s => s.status !== 'calculated').length
            });
          } catch (e) {
            console.log('Could not load site stats');
          }
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      
      {/* Header with Logo */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/pronoia.png" 
                alt="Pronoia Solutions" 
                className="h-14 w-auto"
              />
              {organization && (
                <div className="hidden md:block border-l border-gray-300 pl-4">
                  <p className="text-sm text-gray-500">Organization</p>
                  <p className="font-semibold text-gray-900">{organization.name}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm text-gray-500">Welcome back</p>
                <p className="font-medium text-gray-900">{user?.displayName || user?.email?.split('@')[0]}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold">
                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800"></div>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.4"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}></div>
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                Reserve Study Management
              </h1>
              <p className="text-blue-100 text-lg">
                Professional reserve study tools for community associations
              </p>
            </div>
            {isSuperAdmin && (
              <Link
                href="/super-admin"
                className="mt-4 md:mt-0 inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all"
              >
                <span className="text-yellow-300">⚡</span>
                Super Admin Panel
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-6">
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Sites</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.sites}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <span className="text-2xl">🏢</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Calculated</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.calculated}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-3xl font-bold text-orange-500 mt-1">{stats.pending}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">⏳</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Sites Card */}
          <Link href="/sites" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-200 transition-all h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
                  <span className="text-3xl">📊</span>
                </div>
                <span className="text-gray-400 group-hover:text-blue-500 transition-colors text-2xl">→</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Manage Sites</h3>
              <p className="text-gray-600 text-sm">
                Create, edit, and manage reserve study sites. Add components, run calculations, and generate reports.
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-blue-600 font-medium text-sm group-hover:underline">View All Sites →</span>
              </div>
            </div>
          </Link>

          {/* Notes Card */}
          <Link href="/notes" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-purple-200 transition-all h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                  <span className="text-3xl">📝</span>
                </div>
                <span className="text-gray-400 group-hover:text-purple-500 transition-colors text-2xl">→</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Component Notes</h3>
              <p className="text-gray-600 text-sm">
                Manage your organization's library of component descriptions and notes for consistent reporting.
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-purple-600 font-medium text-sm group-hover:underline">Manage Notes →</span>
              </div>
            </div>
          </Link>

          {/* Profile Card */}
          <Link href="/profile" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-gray-300 transition-all h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-gray-600 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-200">
                  <span className="text-3xl">👤</span>
                </div>
                <span className="text-gray-400 group-hover:text-gray-600 transition-colors text-2xl">→</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Your Profile</h3>
              <p className="text-gray-600 text-sm">
                Update your personal information, change password, and manage account settings.
              </p>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <span className="text-gray-600 font-medium text-sm group-hover:underline">View Profile →</span>
              </div>
            </div>
          </Link>

        </div>

        {/* Organization & Role Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Organization Card */}
          {organization && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🏛️</span> Organization
                </h3>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                    <span className="text-3xl">🏢</span>
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900">{organization.name}</h4>
                    <p className="text-gray-500 text-sm">Reserve Study Organization</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Your Role</p>
                    <p className="font-semibold text-gray-900 capitalize mt-1">
                      {userProfile?.role === 'super_admin' ? 'Super Admin' : 
                       userProfile?.role === 'admin' ? 'Administrator' : 
                       userProfile?.role || 'Specialist'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                    <p className="font-semibold text-green-600 mt-1 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500"></span>
                      Active
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Tips / Getting Started */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>💡</span> Quick Tips
              </h3>
            </div>
            <div className="p-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">1</span>
                  <p className="text-gray-700 text-sm">Create a new site and fill in the project information form with financial parameters.</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">2</span>
                  <p className="text-gray-700 text-sm">Add components manually or import from CSV. Assign notes from your library.</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">3</span>
                  <p className="text-gray-700 text-sm">Run calculations to generate 30-year projections with threshold analysis.</p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">4</span>
                  <p className="text-gray-700 text-sm">Generate professional PDF reports for your clients.</p>
                </li>
              </ul>
            </div>
          </div>

        </div>

        {/* Admin Section */}
        {isAdmin && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <span className="text-xl">⚙️</span>
              </div>
              <div>
                <h3 className="font-bold text-amber-900">Admin Tools</h3>
                <p className="text-amber-700 text-sm">Manage users and organization settings</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {isSuperAdmin && (
                <Link
                  href="/super-admin"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm"
                >
                  <span>⚡</span> Super Admin Panel
                </Link>
              )}
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 transition-colors font-medium text-sm"
              >
                <span>👥</span> Manage Users
              </Link>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img 
              src="/pronoia.png" 
              alt="Pronoia Solutions" 
              className="h-8 w-auto opacity-60"
            />
          </div>
          <p className="text-sm text-gray-500">
            Reserve Study Management Platform
          </p>
          <p className="text-xs text-gray-400 mt-1">
            © 2026 Pronoia Solutions. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
