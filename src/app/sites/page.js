// src/app/sites/page.js
// TILE-BASED DASHBOARD - Reserve Study Projects
// Modern card layout with search & filter

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Status configuration
const STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', dot: '#9ca3af', icon: '📝' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', dot: '#f59e0b', icon: '⏳' },
  calculated: { label: 'Calculated', color: 'bg-blue-100 text-blue-800', dot: '#3b82f6', icon: '🔢' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', dot: '#22c55e', icon: '✅' },
  sent: { label: 'Sent to Client', color: 'bg-purple-100 text-purple-800', dot: '#a855f7', icon: '📤' }
};

// Study type labels
const STUDY_TYPES = {
  'level1': 'Level 1 Full',
  'level2': 'Level 2 Update'
};

// State abbreviation mapping
const STATE_ABBREVIATIONS = {
  'New Jersey': 'NJ',
  'Pennsylvania': 'PA',
  'California': 'CA',
  'New York': 'NY',
  'Florida': 'FL',
  'Texas': 'TX',
  'Connecticut': 'CT',
  'Delaware': 'DE',
  'Maryland': 'MD',
  'Virginia': 'VA',
};

const getStateAbbreviation = (state) => {
  if (!state) return '—';
  const trimmed = state.trim();
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return STATE_ABBREVIATIONS[trimmed] || trimmed;
};

export default function SitesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState([]);
  const [filteredSites, setFilteredSites] = useState([]);
  const [groupedSites, setGroupedSites] = useState({});
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [stateCompliance, setStateCompliance] = useState([]);
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
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        if (userData.organizationId) {
          const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
          if (orgDoc.exists()) {
            const orgData = orgDoc.data();
            setOrganization(orgData);
            
            const sc = orgData.settings?.stateCompliance 
              || orgData.stateCompliance 
              || orgData.settings?.states
              || [];
            setStateCompliance(Array.isArray(sc) ? sc : Object.values(sc));
          }
        }
      }
      
      const sitesSnapshot = await getDocs(collection(db, 'sites'));
      const sitesList = sitesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSites(sitesList);
      setFilteredSites(sitesList);
      
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

  const isPMRequired = (siteState) => {
    if (!siteState || stateCompliance.length === 0) return null;
    
    const abbrev = getStateAbbreviation(siteState);
    const fullName = siteState.trim();
    
    const match = stateCompliance.find(sc => {
      const scAbbrev = (sc.abbreviation || sc.abbrev || sc.code || '').toUpperCase();
      const scName = (sc.name || sc.state || sc.stateName || '').toLowerCase();
      return (
        scAbbrev === abbrev.toUpperCase() ||
        scName === fullName.toLowerCase()
      );
    });
    
    if (!match) return null;
    
    return match.pmRequired === true 
      || match.pmFundRequired === true;
  };

  const applyFilters = () => {
    let filtered = [...sites];
    
    if (searchTerm) {
      filtered = filtered.filter(site => 
        site.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        site.projectNumber?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(site => {
        const status = site.status?.toLowerCase() || 'draft';
        return status === statusFilter;
      });
    }
    
    setFilteredSites(filtered);
    
    const grouped = {};
    filtered.forEach(site => {
      const groupName = site.siteName || 'Ungrouped';
      if (!grouped[groupName]) {
        grouped[groupName] = [];
      }
      grouped[groupName].push(site);
    });
    
    Object.keys(grouped).forEach(groupName => {
      grouped[groupName].sort((a, b) => {
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

  const handleStatusChange = async (siteId, newStatus, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      setUpdatingStatus(siteId);
      
      await updateDoc(doc(db, 'sites', siteId), {
        status: newStatus,
        updatedAt: new Date()
      });
      
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
      
      const componentsSnapshot = await getDocs(collection(db, `sites/${siteId}/components`));
      const deletePromises = componentsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      await deleteDoc(doc(db, 'sites', siteId));
      
      setSites(prev => prev.filter(s => s.id !== siteId));
      
      alert('Site deleted successfully');
    } catch (error) {
      console.error('Error deleting site:', error);
      alert('Error deleting site');
    } finally {
      setDeleting(null);
    }
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

  // Stats
  const totalStudies = filteredSites.length;
  const totalProjects = sortedGroupNames.length;
  const draftCount = filteredSites.filter(s => (s.status || 'draft') === 'draft').length;
  const calculatedCount = filteredSites.filter(s => s.status === 'calculated').length;
  const completedCount = filteredSites.filter(s => s.status === 'completed' || s.status === 'sent').length;

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Hero Header */}
      <div style={{ backgroundColor: '#1d398f' }} className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-12">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Reserve Study Projects</h1>
              {organization && (
                <p className="text-blue-200 mt-1 text-sm font-medium">{organization.name}</p>
              )}
            </div>
            <Link
              href="/sites/new"
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
              style={{ color: '#1d398f' }}
            >
              <span className="text-lg leading-none">+</span>
              New Study
            </Link>
          </div>

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { value: totalProjects, label: 'Projects' },
              { value: totalStudies, label: 'Studies' },
              { value: calculatedCount, label: 'Calculated' },
              { value: completedCount, label: 'Completed' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/15 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-xs text-blue-200 uppercase tracking-wide font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Search & Filter - overlapping the hero */}
        <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-4 mb-6 -mt-6 relative z-10">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by project name or number..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 bg-gray-50 placeholder-gray-400"
              />
            </div>
            <div className="sm:w-52">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 bg-gray-50"
              >
                <option value="all">All Statuses</option>
                <option value="draft">📝 Draft</option>
                <option value="pending">⏳ Pending</option>
                <option value="calculated">🔢 Calculated</option>
                <option value="completed">✅ Completed</option>
                <option value="sent">📤 Sent to Client</option>
              </select>
            </div>
          </div>

          {(searchTerm || statusFilter !== 'all') && (
            <div className="mt-2 text-xs text-gray-500">
              Showing {filteredSites.length} {filteredSites.length === 1 ? 'study' : 'studies'} across {totalProjects} {totalProjects === 1 ? 'project' : 'projects'}
              <button 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="ml-2 text-blue-600 hover:text-blue-800 font-medium"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {sortedGroupNames.length === 0 ? (
          <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dbebff' }}>
              <span className="text-3xl">📊</span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">No projects found</h3>
            <p className="text-sm text-gray-500 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters'
                : 'Get started by creating your first reserve study'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Link
                href="/sites/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-medium text-sm"
                style={{ backgroundColor: '#1d398f' }}
              >
                + Create Your First Study
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {sortedGroupNames.map(groupName => {
              const groupSites = groupedSites[groupName];
              const groupCompleted = groupSites.filter(s => s.status === 'completed' || s.status === 'sent').length;
              const firstSite = groupSites[0];
              const siteLocation = firstSite?.city && firstSite?.state 
                ? `${firstSite.city}, ${getStateAbbreviation(firstSite.companyState || firstSite.state)}`
                : firstSite?.companyState || firstSite?.state 
                  ? getStateAbbreviation(firstSite.companyState || firstSite.state)
                  : null;

              return (
                <div key={groupName}>
                  {/* Project Group Header */}
                  <div className="flex items-center gap-3 mb-3 px-1">
                    <div className="w-1 h-8 rounded-full" style={{ backgroundColor: '#1d398f' }}></div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900">{groupName}</h2>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span>{groupSites.length} {groupSites.length === 1 ? 'study' : 'studies'}</span>
                        {siteLocation && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>📍 {siteLocation}</span>
                          </>
                        )}
                        {groupCompleted > 0 && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span className="text-green-600 font-medium">{groupCompleted} completed</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Study Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupSites.map(site => {
                      const statusInfo = getStatusInfo(site.status);
                      const siteState = site.companyState || site.state || '';
                      const pmRequired = isPMRequired(siteState);
                      const isDeleting = deleting === site.id;
                      
                      return (
                        <div
                          key={site.id}
                          onClick={() => router.push(`/sites/${site.id}`)}
                          className="group bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col"
                        >
                          {/* Color accent bar at top */}
                          <div className="h-1.5" style={{ backgroundColor: statusInfo.dot }}></div>
                          
                          <div className="p-5 flex-1 flex flex-col">
                            {/* Top: Project # + Status */}
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <div className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                                  {site.projectNumber || 'No Project #'}
                                </div>
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {getStudyTypeLabel(site.studyType)}
                                </div>
                              </div>
                              <select
                                value={site.status || 'draft'}
                                onChange={(e) => handleStatusChange(site.id, e.target.value, e)}
                                onClick={(e) => e.stopPropagation()}
                                disabled={updatingStatus === site.id}
                                className={`text-xs px-2.5 py-1 border-0 rounded-full font-medium cursor-pointer ${statusInfo.color}`}
                                style={{ paddingRight: '1.5rem', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.4rem center', backgroundSize: '0.8rem' }}
                              >
                                <option value="draft">📝 Draft</option>
                                <option value="pending">⏳ Pending</option>
                                <option value="calculated">🔢 Calculated</option>
                                <option value="completed">✅ Completed</option>
                                <option value="sent">📤 Sent</option>
                              </select>
                            </div>

                            {/* Info chips */}
                            <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                              {siteState && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400">State:</span>
                                  <span className="font-medium text-gray-700">{getStateAbbreviation(siteState)}</span>
                                </div>
                              )}
                              {pmRequired !== null && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-400">PM:</span>
                                  {pmRequired ? (
                                    <span className="font-medium text-green-600">Active</span>
                                  ) : (
                                    <span className="text-gray-400">N/A</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex-1"></div>

                            {/* Bottom: Date + Actions */}
                            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                              <div className="text-xs text-gray-400">
                                Updated {formatDate(site.updatedAt)}
                              </div>
                              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                <Link
                                  href={`/sites/${site.id}/calculate`}
                                  className="text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors"
                                  style={{ backgroundColor: '#dbebff', color: '#1d398f' }}
                                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#bdd7ff'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#dbebff'; }}
                                >
                                  Calculate
                                </Link>
                                <Link
                                  href={`/sites/${site.id}/reports`}
                                  className="text-xs px-2.5 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-md font-medium transition-colors"
                                >
                                  Reports
                                </Link>
                                <button
                                  onClick={(e) => handleDeleteSite(site.id, site.siteName, site.projectNumber, e)}
                                  disabled={isDeleting}
                                  className="text-xs px-1.5 py-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Delete study"
                                >
                                  {isDeleting ? '...' : '🗑️'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Legend */}
        <div className="mt-8 mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-400 px-1">
          <span className="font-medium uppercase tracking-wide">Status:</span>
          {Object.entries(STATUSES).map(([key, { label, dot }]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }}></span>
              {label}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
