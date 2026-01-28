'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Status configuration
const STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: '📝' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
  calculated: { label: 'Calculated', color: 'bg-blue-100 text-blue-800', icon: '🔢' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: '✅' },
  sent: { label: 'Sent to Client', color: 'bg-purple-100 text-purple-800', icon: '📤' }
};

export default function SitesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState([]);
  const [filteredSites, setFilteredSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState({});
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    loadSites();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [sites, searchTerm, statusFilter]);

  const loadSites = async () => {
    try {
      setLoading(true);
      
      // Get user's organization
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.organizationId) {
          const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
          if (orgDoc.exists()) {
            setOrganization(orgDoc.data());
          }
        }
      }
      
      // Get all sites
      const sitesSnapshot = await getDocs(collection(db, 'sites'));
      const sitesList = sitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSites(sitesList);
      setFilteredSites(sitesList);
      
      // Load all users to get creator names
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = {};
      usersSnapshot.docs.forEach(doc => {
        usersMap[doc.id] = doc.data();
      });
      setUsers(usersMap);
      
    } catch (error) {
      console.error('Error loading sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...sites];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(site => 
        site.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.projectNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(site => {
        const status = site.status?.toLowerCase() || 'draft';
        return status === statusFilter;
      });
    }
    
    setFilteredSites(filtered);
  };

  const handleStatusChange = async (siteId, newStatus, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setUpdatingStatus(siteId);
      
      await updateDoc(doc(db, 'sites', siteId), {
        status: newStatus,
        updatedAt: new Date()
      });
      
      // Update local state
      setSites(prev => prev.map(s => 
        s.id === siteId ? { ...s, status: newStatus, updatedAt: { seconds: Date.now() / 1000 } } : s
      ));
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteSite = async (siteId, siteName, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(`Delete site "${siteName}"? This will also delete all components and cannot be undone.`)) {
      return;
    }
    
    try {
      setDeleting(siteId);
      
      // Delete all components first
      const componentsSnapshot = await getDocs(collection(db, `sites/${siteId}/components`));
      const deletePromises = componentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Delete the site
      await deleteDoc(doc(db, 'sites', siteId));
      
      // Remove from local state
      setSites(prev => prev.filter(s => s.id !== siteId));
      
      alert('Site deleted successfully');
    } catch (error) {
      console.error('Error deleting site:', error);
      alert('Error deleting site');
    } finally {
      setDeleting(null);
    }
  };

  const getCreatorName = (createdBy) => {
    if (!createdBy) return 'Unknown';
    const user = users[createdBy];
    return user?.displayName || user?.email || 'Unknown';
  };

  const getStatusInfo = (status) => {
    const normalizedStatus = status?.toLowerCase() || 'draft';
    return STATUSES[normalizedStatus] || STATUSES.draft;
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reserve Study Sites</h1>
            {organization && (
              <p className="text-gray-600 mt-1">{organization.name}</p>
            )}
          </div>
          <Link
            href="/sites/new"
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            + New Site
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Sites
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by site name or project number..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              >
                <option value="all">All Sites</option>
                <option value="draft">📝 Draft</option>
                <option value="pending">⏳ Pending</option>
                <option value="calculated">🔢 Calculated</option>
                <option value="completed">✅ Completed</option>
                <option value="sent">📤 Sent to Client</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredSites.length} of {sites.length} sites
          </div>
        </div>

        {/* Sites Grid */}
        {filteredSites.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No sites found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Get started by creating your first reserve study site'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Link
                href="/sites/new"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Create Your First Site
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSites.map(site => {
              const statusInfo = getStatusInfo(site.status);
              return (
                <div key={site.id} className="bg-white shadow rounded-lg hover:shadow-lg transition-shadow overflow-hidden">
                  <Link href={`/sites/${site.id}`} className="block p-6">
                    {/* Status Badge */}
                    <div className="flex justify-between items-start mb-3">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${statusInfo.color}`}>
                        <span>{statusInfo.icon}</span>
                        {statusInfo.label}
                      </span>
                    </div>
                    
                    {/* Site Name */}
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{site.siteName || 'Untitled Site'}</h3>
                    
                    {/* Project Number */}
                    {site.projectNumber && (
                      <p className="text-sm text-gray-600 mb-3">{site.projectNumber}</p>
                    )}
                    
                    {/* Location */}
                    {site.city && site.state && (
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <span className="mr-2">📍</span>
                        <span>{site.city}, {site.state}</span>
                      </div>
                    )}
                    
                    {/* Units */}
                    {site.totalUnits && (
                      <div className="flex items-center text-sm text-gray-600 mb-2">
                        <span className="mr-2">🏠</span>
                        <span>{site.totalUnits} Units</span>
                      </div>
                    )}
                    
                    {/* Creator */}
                    <div className="flex items-center text-sm text-gray-500 mb-2">
                      <span className="mr-2">👤</span>
                      <span>Created by {getCreatorName(site.createdBy)}</span>
                    </div>
                    
                    {/* Last Updated */}
                    {site.updatedAt && (
                      <div className="flex items-center text-sm text-gray-500 pt-3 border-t border-gray-100">
                        <span className="mr-2">🕐</span>
                        <span>Updated {new Date(site.updatedAt.seconds * 1000).toLocaleDateString()}</span>
                      </div>
                    )}
                  </Link>
                  
                  {/* Action Buttons */}
                  <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                    <div className="flex items-center justify-between gap-2">
                      {/* Status Dropdown */}
                      <select
                        value={site.status || 'draft'}
                        onChange={(e) => handleStatusChange(site.id, e.target.value, e)}
                        onClick={(e) => e.stopPropagation()}
                        disabled={updatingStatus === site.id}
                        className="text-xs px-2 py-1.5 border border-gray-300 rounded-md bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="draft">📝 Draft</option>
                        <option value="pending">⏳ Pending</option>
                        <option value="calculated">🔢 Calculated</option>
                        <option value="completed">✅ Completed</option>
                        <option value="sent">📤 Sent to Client</option>
                      </select>
                      
                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDeleteSite(site.id, site.siteName, e)}
                        disabled={deleting === site.id}
                        className="text-xs px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors flex items-center gap-1"
                      >
                        {deleting === site.id ? (
                          <span>Deleting...</span>
                        ) : (
                          <>
                            <span>🗑️</span>
                            <span>Delete</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 bg-white shadow rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Status Legend</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATUSES).map(([key, { label, color, icon }]) => (
              <span key={key} className={`px-3 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${color}`}>
                <span>{icon}</span>
                {label}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
