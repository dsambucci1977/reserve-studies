'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [organization, setOrganization] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sites: 0, studies: 0, calculated: 0, pending: 0 });

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
          
          // Load study stats
          try {
            // Try organization-filtered query first
            let studiesList = [];
            try {
              const sitesQuery = query(
                collection(db, 'sites'),
                where('organizationId', '==', userData.organizationId)
              );
              const sitesSnapshot = await getDocs(sitesQuery);
              studiesList = sitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            } catch (queryError) {
              // Fallback: load all sites if org query fails (e.g., missing index or field)
              console.log('Org query failed, loading all sites:', queryError);
              const allSitesSnapshot = await getDocs(collection(db, 'sites'));
              studiesList = allSitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            }
            
            // Count unique site names (actual properties/communities)
            const uniqueSiteNames = new Set(
              studiesList.map(s => s.siteName || 'Unknown').filter(name => name !== 'Unknown')
            );
            
            // Count studies by status (case-insensitive)
            const calculatedCount = studiesList.filter(s => {
              const status = (s.status || '').toLowerCase();
              return status === 'calculated' || status === 'completed' || status === 'sent' || status === 'sent to client';
            }).length;
            
            const pendingCount = studiesList.filter(s => {
              const status = (s.status || '').toLowerCase();
              return status === 'draft' || status === 'pending' || status === '';
            }).length;
            
            setStats({
              sites: uniqueSiteNames.size,
              studies: studiesList.length,
              calculated: calculatedCount,
              pending: pendingCount
            });
          } catch (e) {
            console.log('Could not load site stats:', e);
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
                  <p className="text-xs text-gray-500">Organization</p>
                  <p className="font-semibold text-gray-900">{organization.name}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs text-gray-500">Welcome back</p>
                <p className="font-medium text-gray-900">{userProfile?.displayName || user?.email?.split('@')[0]}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {(userProfile?.displayName || user?.email || '?')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold">Reserve Study Management</h1>
          <p className="mt-2 text-blue-100">Professional reserve study tools for community associations</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          
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
                <p className="text-sm font-medium text-gray-500">Total Studies</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{stats.studies}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Calculated</p>
                <p className="text-3xl font-bold text-green-500 mt-1">{stats.calculated}</p>
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
              <p className="mt-4 text-blue-600 text-sm font-medium">View All Sites →</p>
            </div>
          </Link>

          {/* Notes Card */}
          <Link href="/notes" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-green-200 transition-all h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-lg shadow-green-200">
                  <span className="text-3xl">📋</span>
                </div>
                <span className="text-gray-400 group-hover:text-green-500 transition-colors text-2xl">→</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Component Notes</h3>
              <p className="text-gray-600 text-sm">
                Manage your organization's library of component descriptions and notes for consistent reporting.
              </p>
              <p className="mt-4 text-green-600 text-sm font-medium">Manage Notes →</p>
            </div>
          </Link>

          {/* Profile Card */}
          <Link href="/profile" className="group">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-purple-200 transition-all h-full">
              <div className="flex items-start justify-between mb-4">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200">
                  <span className="text-3xl">👤</span>
                </div>
                <span className="text-gray-400 group-hover:text-purple-500 transition-colors text-2xl">→</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Your Profile</h3>
              <p className="text-gray-600 text-sm">
                Update your personal information, change password, and manage account settings.
              </p>
              <p className="mt-4 text-purple-600 text-sm font-medium">View Profile →</p>
            </div>
          </Link>
        </div>

        {/* Bottom Row: Organization + Quick Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          
          {/* Organization Card */}
          {organization && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  🏛️ Organization
                </h3>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <img 
                    src="/pronoia.png" 
                    alt={organization.name} 
                    className="h-12 w-12 rounded-lg object-contain bg-gray-50 p-1"
                  />
                  <div>
                    <p className="font-bold text-gray-900">{organization.name}</p>
                    <p className="text-sm text-gray-500">Reserve Study Organization</p>
                  </div>
                </div>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="mt-4 inline-block px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                  >
                    Admin Settings →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Quick Tips */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                💡 Quick Tips
              </h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-gray-700">Create a new site and fill in the project information form with financial parameters.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-gray-700">Add components manually or import from CSV. Assign notes from your library.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-sm text-gray-700">Run calculations to generate 30-year projections and funding recommendations.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                  <p className="text-sm text-gray-700">Generate professional reports for your clients.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Tools (if admin) */}
        {isAdmin && (
          <div className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Admin Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/admin" className="group">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-blue-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <span className="text-xl">⚙️</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">Organization Admin</h3>
                      <p className="text-sm text-gray-600">Manage users, invitations, and branding</p>
                    </div>
                  </div>
                </div>
              </Link>
              {isSuperAdmin && (
                <Link href="/super-admin" className="group">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-red-200 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                        <span className="text-xl">🛡️</span>
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">Super Admin</h3>
                        <p className="text-sm text-gray-600">Manage all organizations and system settings</p>
                      </div>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>Reserve Study Management Platform</p>
          <p className="mt-1">© 2026 Pronoia Solutions. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}
