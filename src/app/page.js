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
          
          try {
            const allSitesSnapshot = await getDocs(collection(db, 'sites'));
            let studiesList = allSitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            const uniqueSiteNames = new Set(
              studiesList.map(s => s.siteName || 'Unknown').filter(name => name !== 'Unknown')
            );
            
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const firstName = (userProfile?.displayName || user?.email?.split('@')[0] || 'there').split(' ')[0];
  const initials = (userProfile?.displayName || user?.email || '?')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Hero Header */}
      <div style={{ backgroundColor: '#1d398f' }} className="relative overflow-hidden">
        {/* Subtle pattern */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
          {/* Top bar: logo + welcome */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <img 
                src="/pronoia.png" 
                alt="Pronoia Solutions" 
                className="h-10 w-auto rounded-lg bg-white/10 p-1"
              />
              {organization && (
                <div className="border-l border-white/20 pl-4">
                  <p className="text-[10px] text-blue-200 uppercase tracking-wider font-medium">Organization</p>
                  <p className="text-sm font-semibold text-white">{organization.name}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] text-blue-200 uppercase tracking-wider font-medium">Welcome back</p>
                <p className="text-sm font-semibold text-white">{userProfile?.displayName || user?.email?.split('@')[0]}</p>
              </div>
              <div className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                {initials}
              </div>
            </div>
          </div>

          {/* Greeting */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {firstName}
            </h1>
            <p className="text-blue-200 mt-1 text-sm">Here's an overview of your reserve studies</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">

        {/* Stats Cards - overlapping hero */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Total Projects', value: stats.sites, icon: '🏢', accent: '#1d398f' },
            { label: 'Total Studies', value: stats.studies, icon: '📊', accent: '#3b82f6' },
            { label: 'Calculated', value: stats.calculated, icon: '✅', accent: '#22c55e' },
            { label: 'Pending', value: stats.pending, icon: '⏳', accent: '#f59e0b' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: stat.accent }}>{stat.value}</p>
                </div>
                <div className="h-10 w-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: stat.accent + '15' }}>
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          
          {/* Manage Sites */}
          <Link href="/sites" className="group">
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-blue-300 transition-all h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#1d398f' }}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <span className="text-gray-300 group-hover:text-blue-500 transition-colors text-lg">→</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">Manage Sites</h3>
              <p className="text-xs text-gray-500 leading-relaxed flex-1">
                Create, edit, and manage reserve study sites. Add components, run calculations, and generate reports.
              </p>
              <p className="mt-3 text-xs font-semibold" style={{ color: '#1d398f' }}>View All Sites →</p>
            </div>
          </Link>

          {/* Component Notes */}
          <Link href="/notes" className="group">
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-green-300 transition-all h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-xl bg-green-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-gray-300 group-hover:text-green-500 transition-colors text-lg">→</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">Component Notes</h3>
              <p className="text-xs text-gray-500 leading-relaxed flex-1">
                Manage your organization's library of component descriptions and notes for consistent reporting.
              </p>
              <p className="mt-3 text-xs text-green-600 font-semibold">Manage Notes →</p>
            </div>
          </Link>

          {/* Your Profile */}
          <Link href="/profile" className="group">
            <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-purple-300 transition-all h-full flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="h-11 w-11 rounded-xl bg-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="text-gray-300 group-hover:text-purple-500 transition-colors text-lg">→</span>
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">Your Profile</h3>
              <p className="text-xs text-gray-500 leading-relaxed flex-1">
                Update your personal information, change password, and manage account settings.
              </p>
              <p className="mt-3 text-xs text-purple-600 font-semibold">View Profile →</p>
            </div>
          </Link>
        </div>

        {/* Bottom Row: Organization + Quick Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          
          {/* Organization Card */}
          {organization && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3" style={{ backgroundColor: '#1d398f' }}>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Organization
                </h3>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <img 
                    src="/pronoia.png" 
                    alt={organization.name} 
                    className="h-10 w-10 rounded-lg object-contain bg-gray-50 p-1 border border-gray-100"
                  />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{organization.name}</p>
                    <p className="text-xs text-gray-500">Reserve Study Organization</p>
                  </div>
                </div>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ backgroundColor: '#dbebff', color: '#1d398f' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Settings →
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Quick Tips */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-purple-700 to-indigo-700">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Quick Tips
              </h3>
            </div>
            <div className="p-5 space-y-3">
              {[
                'Create a new site and fill in the project information form with financial parameters.',
                'Add components manually or import from CSV. Assign notes from your library.',
                'Run calculations to generate 30-year projections and funding recommendations.',
                'Generate professional reports for your clients.',
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                    {i + 1}
                  </span>
                  <p className="text-xs text-gray-600 leading-relaxed">{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Admin Tools */}
        {isAdmin && (
          <div className="mb-8">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-1">Admin Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Link href="/admin" className="group">
                <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#dbebff' }}>
                      <svg className="w-4.5 h-4.5" style={{ color: '#1d398f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-gray-900">Organization Admin</h3>
                      <p className="text-xs text-gray-500">Manage users, invitations, and branding</p>
                    </div>
                    <span className="text-gray-300 group-hover:text-blue-500 transition-colors">→</span>
                  </div>
                </div>
              </Link>
              {isSuperAdmin && (
                <Link href="/super-admin" className="group">
                  <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-red-300 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                        <svg className="w-4.5 h-4.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-gray-900">Super Admin</h3>
                        <p className="text-xs text-gray-500">Manage all organizations and system settings</p>
                      </div>
                      <span className="text-gray-300 group-hover:text-red-500 transition-colors">→</span>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="py-8 text-center">
          <p className="text-[11px] text-gray-400">Reserve Study Management Platform</p>
          <p className="text-[11px] text-gray-400 mt-0.5">© 2026 Pronoia Solutions. All rights reserved.</p>
        </div>

      </div>
    </div>
  );
}
