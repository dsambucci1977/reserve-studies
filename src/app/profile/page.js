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
      admin: 'bg-purple-100 text-purple-800 border-purple-300',
      specialist: 'bg-blue-100 text-blue-800 border-blue-300'
    };
    return badges[role] || badges.specialist;
  };

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800 border-green-300',
      invited: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      suspended: 'bg-red-100 text-red-800 border-red-300'
    };
    return badges[status] || badges.active;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
          <p className="text-gray-600 mt-2">Manage your personal information and settings</p>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-white">{profile.displayName || 'User'}</h2>
              <p className="text-blue-100 text-sm">{profile.email}</p>
            </div>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-medium"
              >
                Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-400"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-medium disabled:opacity-50"
                >
                  💾 Save
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            
            {/* Display Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
              {editing ? (
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => setProfile({...profile, displayName: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Enter your name"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{profile.displayName || 'Not set'}</div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-500 flex justify-between items-center">
                <span>{profile.email}</span>
                <span className="text-xs text-gray-400">Read-only</span>
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              {editing ? (
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  placeholder="Enter your phone number"
                />
              ) : (
                <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">{profile.phone || 'Not set'}</div>
              )}
            </div>

            {/* Organization */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Organization</label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-500 flex justify-between items-center">
                <span>{profile.organizationName || 'No organization'}</span>
                <span className="text-xs text-gray-400">Managed by admin</span>
              </div>
            </div>

            {/* Role & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <div className={`px-4 py-2 rounded-lg border-2 font-medium text-center uppercase text-sm ${getRoleBadge(profile.role)}`}>
                  {profile.role}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <div className={`px-4 py-2 rounded-lg border-2 font-medium text-center uppercase text-sm ${getStatusBadge(profile.status)}`}>
                  {profile.status}
                </div>
              </div>
            </div>

          </div>

          {/* Admin Panel Link */}
          {profile.role === 'admin' && (
            <div className="border-t border-gray-200 px-6 py-4 bg-purple-50">
              <h3 className="font-bold text-purple-900 mb-2">Organization Administration</h3>
              <p className="text-sm text-purple-700 mb-3">Manage users, settings, and organization details</p>
              <Link 
                href="/admin"
                className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
              >
                Admin Panel →
              </Link>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}


