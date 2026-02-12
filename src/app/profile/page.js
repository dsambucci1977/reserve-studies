'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    displayName: '',
    email: '',
    phone: '',
    organizationId: '',
    organizationName: '',
    role: 'specialist',
    status: 'active'
  });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        let orgName = '';
        if (userData.organizationId) {
          const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
          if (orgDoc.exists()) {
            orgName = orgDoc.data().name;
          }
        }
        
        setProfile({
          displayName: userData.displayName || '',
          email: userData.email || user.email,
          phone: userData.phone || '',
          organizationId: userData.organizationId || '',
          organizationName: orgName,
          role: userData.role || 'specialist',
          status: userData.status || 'active'
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: profile.displayName,
        phone: profile.phone,
        updatedAt: new Date()
      });
      setEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-purple-50 text-purple-700 border border-purple-200',
      super_admin: 'bg-red-50 text-red-700 border border-red-200',
      specialist: 'bg-blue-50 text-blue-700 border border-blue-200'
    };
    return badges[role] || badges.specialist;
  };

  const getRoleLabel = (role) => {
    const labels = { admin: 'Admin', super_admin: 'Super Admin', specialist: 'Specialist' };
    return labels[role] || role;
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-50 text-green-700 border border-green-200',
      invited: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      suspended: 'bg-red-50 text-red-700 border border-red-200'
    };
    return badges[status] || badges.active;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#1d398f' }}></div>
      </div>
    );
  }

  const initials = (profile.displayName || profile.email || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero Header */}
      <div style={{ backgroundColor: '#1d398f' }} className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>
        <div className="relative w-full px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">{profile.displayName || 'User Profile'}</h1>
                <p className="text-blue-200 text-sm mt-0.5">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
                  style={{ color: '#1d398f' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 text-sm font-medium text-blue-200 hover:text-white border border-blue-300/30 rounded-lg hover:border-blue-200/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                    style={{ color: '#1d398f' }}
                  >
                    {saving ? (
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2" style={{ borderColor: '#1d398f' }}></div>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    Save Changes
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Main Info Card */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Personal Information
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Display Name</label>
                {editing ? (
                  <input
                    type="text"
                    value={profile.displayName}
                    onChange={(e) => setProfile({...profile, displayName: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your name"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">{profile.displayName || 'Not set'}</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Email Address</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-500 flex justify-between items-center border border-gray-100">
                  <span>{profile.email}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Read-only</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                {editing ? (
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({...profile, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your phone number"
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900">{profile.phone || 'Not set'}</div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Organization</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-500 flex justify-between items-center border border-gray-100">
                  <span>{profile.organizationName || 'No organization'}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Managed by admin</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Role & Status */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Account
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Role</label>
                  <div className={`px-3 py-2 rounded-lg text-sm font-semibold text-center capitalize ${getRoleBadge(profile.role)}`}>
                    {getRoleLabel(profile.role)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
                  <div className={`px-3 py-2 rounded-lg text-sm font-semibold text-center capitalize ${getStatusBadge(profile.status)}`}>
                    {profile.status}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Quick Links
                </h2>
              </div>
              <div className="p-2">
                <Link href="/sites" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#dbebff' }}>
                    <svg className="w-4 h-4" style={{ color: '#1d398f' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">Manage Sites</div>
                    <div className="text-xs text-gray-400">View all projects</div>
                  </div>
                  <span className="text-gray-300 group-hover:text-blue-500 transition-colors">→</span>
                </Link>
                <Link href="/notes" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                  <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">Component Notes</div>
                    <div className="text-xs text-gray-400">Note library</div>
                  </div>
                  <span className="text-gray-300 group-hover:text-green-500 transition-colors">→</span>
                </Link>
                {(profile.role === 'admin' || profile.role === 'super_admin') && (
                  <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className="h-8 w-8 rounded-lg bg-purple-100 flex items-center justify-center">
                      <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-gray-900">Admin Panel</div>
                      <div className="text-xs text-gray-400">Organization settings</div>
                    </div>
                    <span className="text-gray-300 group-hover:text-purple-500 transition-colors">→</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
