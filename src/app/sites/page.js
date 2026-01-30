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

// Study type labels
const STUDY_TYPES = {
  'level1': 'Level 1 Full',
  'level2': 'Level 2 Update'
};

export default function SitesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState([]);
  const [filteredSites, setFilteredSites] = useState([]);
  const [groupedSites, setGroupedSites] = useState({});
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState({});
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  
  // Expanded groups state
  const [expandedGroups, setExpandedGroups] = useState({});

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
      
      // Expand all groups by default
      const groups = {};
      sitesList.forEach(site => {
        const groupName = site.siteName || 'Ungrouped';
        groups[groupName] = true;
      });
      setExpandedGroups(groups);
      
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
    
    // Group sites by siteName (Project Name)
    const grouped = {};
    filtered.forEach(site => {
      const groupName = site.siteName || 'Ungrouped';
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(site);
    });
    
    // Sort sites within each group by projectNumber or updatedAt
    Object.keys(grouped).forEach(groupName => {
      grouped[groupName].sort((a, b) => {
        // Sort by project number if available, otherwise by updated date
        if (a.projectNumber && b.projectNumber) {
          return a.projectNumber.localeCompare(b.projectNumber);
        }
        const dateA = a.updatedAt?.seconds || 0;
        const dateB = b.updatedAt?.seconds || 0;
        return dateB - dateA;
      });
    });
    
    setGroupedSites(grouped);
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
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

  const handleDeleteSite = async (siteId, siteName, projectNumber, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const displayName = projectNumber ? `${siteName} (${projectNumber})` : siteName;
    if (!confirm(`Delete "${displayName}"? This will also delete all components and cannot be undone.`)) {
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
    const userData = users[createdBy];
    return userData?.displayName || userData?.email || 'Unknown';
  };

  const getStatusInfo = (status) => {
    const normalizedStatus = status?.toLowerCase() || 'draft';
    return STATUSES[normalizedStatus] || STATUSES.draft;
  };

  const getStudyTypeLabel = (studyType) => {
    return STUDY_TYPES[studyType] || studyType || 'Not specified';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const sortedGroupNames = Object.keys(groupedSites).sort((a, b) => {
    if (a === 'Ungrouped') return 1;
    if (b === 'Ungrouped') return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reserve Study Projects</h1>
            {organization && (
              <p className="text-gray-600 mt-1">{organization.name}</p>
            )}
          </div>
          <Link
            href="/sites/new"
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
          >
            + New Study
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Projects
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by project name or project number..."
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
                <option value="all">All Studies</option>
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
            Showing {filteredSites.length} studies across {sortedGroupNames.length} projects
          </div>
        </div>

        {/* Grouped Sites */}
        {sortedGroupNames.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No projects found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Get started by creating your first reserve study'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Link
                href="/sites/new"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Create Your First Study
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {sortedGroupNames.map(groupName => {
              const groupSites = groupedSites[groupName];
              const isExpanded = expandedGroups[groupName] !== false;
              const completedCount = groupSites.filter(s => s.status === 'completed' || s.status === 'sent').length;
              
              return (
                <div key={groupName} className="bg-white shadow rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-white hover:from-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900">{groupName}</h2>
                        <p className="text-sm text-gray-600">
                          {groupSites.length} {groupSites.length === 1 ? 'study' : 'studies'}
                          {completedCount > 0 && (
                            <span className="ml-2 text-green-600">• {completedCount} completed</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Show location if all sites have the same location */}
                      {groupSites[0]?.city && groupSites[0]?.state && (
                        <span className="text-sm text-gray-500 hidden sm:inline">
                          📍 {groupSites[0].city}, {groupSites[0].state}
                        </span>
                      )}
                    </div>
                  </button>
                  
                  {/* Group Content - Study List */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Project Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Study Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Last Updated
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {groupSites.map(site => {
                            const statusInfo = getStatusInfo(site.status);
                            return (
                              <tr 
                                key={site.id} 
                                className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => router.push(`/sites/${site.id}`)}
                              >
                                <td className="px-6 py-4">
                                  <div className="flex items-center">
                                    <span className="font-medium text-blue-600 hover:text-blue-800">
                                      {site.projectNumber || 'No Project #'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-700">
                                  {getStudyTypeLabel(site.studyType)}
                                </td>
                                <td className="px-6 py-4">
                                  <select
                                    value={site.status || 'draft'}
                                    onChange={(e) => handleStatusChange(site.id, e.target.value, e)}
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={updatingStatus === site.id}
                                    className={`text-xs px-2 py-1 border-0 rounded-full font-medium cursor-pointer ${statusInfo.color}`}
                                  >
                                    <option value="draft">📝 Draft</option>
                                    <option value="pending">⏳ Pending</option>
                                    <option value="calculated">🔢 Calculated</option>
                                    <option value="completed">✅ Completed</option>
                                    <option value="sent">📤 Sent to Client</option>
                                  </select>
                                </td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                  {formatDate(site.updatedAt)}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <Link
                                      href={`/sites/${site.id}/calculate`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md transition-colors"
                                    >
                                      Calculate
                                    </Link>
                                    <Link
                                      href={`/sites/${site.id}/reports`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="text-xs px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-md transition-colors"
                                    >
                                      Reports
                                    </Link>
                                    <button
                                      onClick={(e) => handleDeleteSite(site.id, site.siteName, site.projectNumber, e)}
                                      disabled={deleting === site.id}
                                      className="text-xs px-2 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                                    >
                                      {deleting === site.id ? '...' : '🗑️'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
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
