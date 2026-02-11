// src/app/sites/page.js
// MARKETPLACE-STYLE DASHBOARD
// Left sidebar filters + project card grid
// Each card = project (grouped by siteName), click to see studies

'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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

const STUDY_TYPES = {
  'level1': 'Level 1 Full',
  'level2': 'Level 2 Update'
};

const STATE_ABBREVIATIONS = {
  'New Jersey': 'NJ', 'Pennsylvania': 'PA', 'California': 'CA', 'New York': 'NY',
  'Florida': 'FL', 'Texas': 'TX', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Maryland': 'MD', 'Virginia': 'VA',
};

const getStateAbbreviation = (state) => {
  if (!state) return '';
  const trimmed = state.trim();
  if (trimmed.length <= 3) return trimmed.toUpperCase();
  return STATE_ABBREVIATIONS[trimmed] || trimmed;
};

export default function SitesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState(null);
  const [stateCompliance, setStateCompliance] = useState([]);
  const [users, setUsers] = useState({});

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  
  // Expanded project (for viewing studies within a project card)
  const [expandedProject, setExpandedProject] = useState(null);
  
  // Action states
  const [deleting, setDeleting] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  // Sidebar collapse
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState({});

  useEffect(() => {
    if (!user) { router.push('/auth/signin'); return; }
    loadSites();
  }, [user]);

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
            const sc = orgData.settings?.stateCompliance || orgData.stateCompliance || orgData.settings?.states || [];
            setStateCompliance(Array.isArray(sc) ? sc : Object.values(sc));
          }
        }
      }
      const sitesSnapshot = await getDocs(collection(db, 'sites'));
      const sitesList = sitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSites(sitesList);

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersMap = {};
      usersSnapshot.docs.forEach(d => { usersMap[d.id] = d.data(); });
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
      return scAbbrev === abbrev.toUpperCase() || scName === fullName.toLowerCase();
    });
    if (!match) return null;
    return match.pmRequired === true || match.pmFundRequired === true;
  };

  // Build grouped projects with memoization
  const { projects, allStates, statusCounts, totalStudies } = useMemo(() => {
    const grouped = {};
    const statesSet = new Set();
    const sCounts = { all: 0, draft: 0, pending: 0, calculated: 0, completed: 0, sent: 0 };

    sites.forEach(site => {
      const groupName = site.siteName || 'Ungrouped';
      if (!grouped[groupName]) {
        grouped[groupName] = {
          name: groupName,
          studies: [],
          states: new Set(),
          statuses: new Set(),
          latestUpdate: 0,
        };
      }
      grouped[groupName].studies.push(site);
      const st = getStateAbbreviation(site.companyState || site.state || '');
      if (st) { grouped[groupName].states.add(st); statesSet.add(st); }
      const status = site.status?.toLowerCase() || 'draft';
      grouped[groupName].statuses.add(status);
      sCounts[status] = (sCounts[status] || 0) + 1;
      sCounts.all++;
      const ts = site.updatedAt?.seconds || 0;
      if (ts > grouped[groupName].latestUpdate) grouped[groupName].latestUpdate = ts;
    });

    // Convert to array
    const projectArray = Object.values(grouped).map(p => ({
      ...p,
      states: Array.from(p.states),
      statuses: Array.from(p.statuses),
      city: p.studies[0]?.city || '',
    }));

    return {
      projects: projectArray,
      allStates: Array.from(statesSet).sort(),
      statusCounts: sCounts,
      totalStudies: sites.length,
    };
  }, [sites]);

  // Apply filters + sort
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.studies.some(s => s.projectNumber?.toLowerCase().includes(term))
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(p =>
        p.studies.some(s => (s.status?.toLowerCase() || 'draft') === statusFilter)
      );
    }

    if (stateFilter !== 'all') {
      result = result.filter(p => p.states.includes(stateFilter));
    }

    // Sort
    if (sortBy === 'recent') {
      result.sort((a, b) => b.latestUpdate - a.latestUpdate);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'studies') {
      result.sort((a, b) => b.studies.length - a.studies.length);
    }

    return result;
  }, [projects, searchTerm, statusFilter, stateFilter, sortBy]);

  // Handlers
  const handleStatusChange = async (siteId, newStatus, e) => {
    e.preventDefault(); e.stopPropagation();
    try {
      setUpdatingStatus(siteId);
      await updateDoc(doc(db, 'sites', siteId), { status: newStatus, updatedAt: new Date() });
      setSites(prev => prev.map(s => s.id === siteId ? { ...s, status: newStatus, updatedAt: { seconds: Date.now() / 1000 } } : s));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteSite = async (siteId, siteName, projectNumber, e) => {
    e.preventDefault(); e.stopPropagation();
    const displayName = projectNumber ? `${siteName} (${projectNumber})` : siteName;
    if (!confirm(`Delete "${displayName}"? This will also delete all components and cannot be undone.`)) return;
    try {
      setDeleting(siteId);
      const componentsSnapshot = await getDocs(collection(db, `sites/${siteId}/components`));
      await Promise.all(componentsSnapshot.docs.map(d => deleteDoc(d.ref)));
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

  const getStatusInfo = (status) => STATUSES[status?.toLowerCase() || 'draft'] || STATUSES.draft;
  const getStudyTypeLabel = (t) => STUDY_TYPES[t] || t || 'Not specified';
  const formatDate = (ts) => {
    if (!ts) return 'N/A';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    return d.toLocaleDateString();
  };

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Header Bar */}
      <div style={{ backgroundColor: '#1d398f' }} className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>
        <div className="relative max-w-full mx-auto px-6 py-5">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Reserve Study Projects</h1>
              {organization && (
                <p className="text-blue-200 mt-0.5 text-sm font-medium">{organization.name}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Quick Stats */}
              <div className="hidden md:flex items-center gap-4 mr-4">
                {[
                  { v: projects.length, l: 'Projects' },
                  { v: totalStudies, l: 'Studies' },
                  { v: statusCounts.completed + (statusCounts.sent || 0), l: 'Completed' },
                ].map(s => (
                  <div key={s.l} className="text-center">
                    <div className="text-lg font-bold text-white leading-tight">{s.v}</div>
                    <div className="text-[10px] text-blue-200 uppercase tracking-wider font-medium">{s.l}</div>
                  </div>
                ))}
              </div>
              <Link
                href="/sites/new"
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
                style={{ color: '#1d398f' }}
              >
                <span className="text-lg leading-none">+</span> New Study
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        
        {/* ============================================ */}
        {/* LEFT SIDEBAR - FILTERS                       */}
        {/* ============================================ */}
        <aside className={`${sidebarOpen ? 'w-56' : 'w-0'} flex-shrink-0 transition-all duration-200 overflow-hidden`}>
          <div className="w-56 bg-white border-r border-gray-200 min-h-[calc(100vh-80px)] py-4 px-4">
            
            {/* Collapse all */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium mb-4"
            >
              Collapse all
            </button>

            {/* Status Filter */}
            <div className="mb-5">
              <button
                onClick={() => toggleSection('status')}
                className="flex items-center justify-between w-full text-left mb-2"
              >
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Status</span>
                <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.status ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {!collapsedSections.status && (
                <div className="space-y-0.5">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                      statusFilter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    All Statuses <span className="text-gray-400 text-xs ml-1">({statusCounts.all})</span>
                  </button>
                  {Object.entries(STATUSES).map(([key, { label, icon }]) => (
                    <button
                      key={key}
                      onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                        statusFilter === key ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {icon} {label} <span className="text-gray-400 text-xs ml-1">({statusCounts[key] || 0})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* State Filter */}
            {allStates.length > 0 && (
              <div className="mb-5">
                <button
                  onClick={() => toggleSection('state')}
                  className="flex items-center justify-between w-full text-left mb-2"
                >
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">State</span>
                  <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${collapsedSections.state ? '-rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!collapsedSections.state && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => setStateFilter('all')}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                        stateFilter === 'all' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      All States
                    </button>
                    {allStates.map(st => {
                      const count = projects.filter(p => p.states.includes(st)).length;
                      return (
                        <button
                          key={st}
                          onClick={() => setStateFilter(stateFilter === st ? 'all' : st)}
                          className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors ${
                            stateFilter === st ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {st} <span className="text-gray-400 text-xs ml-1">({count})</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PM Filter section could go here */}

            {/* Active filters summary */}
            {(statusFilter !== 'all' || stateFilter !== 'all') && (
              <div className="pt-3 border-t border-gray-200">
                <button
                  onClick={() => { setStatusFilter('all'); setStateFilter('all'); setSearchTerm(''); }}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  ✕ Clear all filters
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ============================================ */}
        {/* MAIN CONTENT AREA                            */}
        {/* ============================================ */}
        <main className="flex-1 min-w-0 py-5 px-6">

          {/* Toolbar: search + sort + view toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
            {/* Show sidebar button when collapsed */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Filters
              </button>
            )}

            {/* Search */}
            <div className="flex-1 relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search projects..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Right side: Sort + View toggle + Count */}
            <div className="flex items-center gap-3 ml-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-700 bg-white"
              >
                <option value="recent">Sort: Most Recent</option>
                <option value="name">Sort: Name A–Z</option>
                <option value="studies">Sort: Most Studies</option>
              </select>

              {/* Grid / List toggle */}
              <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3a1.5 1.5 0 011.5 1.5v3a1.5 1.5 0 01-1.5 1.5h-3A1.5 1.5 0 019 13.5v-3z"/>
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M2.5 12a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5zm0-4a.5.5 0 01.5-.5h10a.5.5 0 010 1H3a.5.5 0 01-.5-.5z"/>
                  </svg>
                </button>
              </div>

              <span className="text-xs text-gray-500 whitespace-nowrap">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Empty State */}
          {filteredProjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#dbebff' }}>
                <span className="text-3xl">📊</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">No projects found</h3>
              <p className="text-sm text-gray-500 mb-6">
                {searchTerm || statusFilter !== 'all' || stateFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Get started by creating your first reserve study'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Link href="/sites/new" className="inline-flex items-center gap-2 px-5 py-2.5 text-white rounded-lg font-medium text-sm" style={{ backgroundColor: '#1d398f' }}>
                  + Create Your First Study
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* ======== GRID VIEW ======== */}
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredProjects.map(project => {
                    const isExpanded = expandedProject === project.name;
                    const studyCount = project.studies.length;
                    const completedCount = project.studies.filter(s => s.status === 'completed' || s.status === 'sent').length;
                    const latestStatus = project.studies.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))[0]?.status || 'draft';
                    const statusInfo = getStatusInfo(latestStatus);
                    const pmActive = project.studies.some(s => isPMRequired(s.companyState || s.state));

                    return (
                      <div key={project.name} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col">
                        
                        {/* Status accent bar */}
                        <div className="h-1.5 flex">
                          {project.studies.map((s, i) => {
                            const si = getStatusInfo(s.status);
                            return <div key={i} className="flex-1" style={{ backgroundColor: si.dot }}></div>;
                          })}
                        </div>

                        {/* Card Header - clickable */}
                        <div
                          className="p-4 cursor-pointer flex-1 flex flex-col"
                          onClick={() => {
                            if (studyCount === 1) {
                              router.push(`/sites/${project.studies[0].id}`);
                            } else {
                              setExpandedProject(isExpanded ? null : project.name);
                            }
                          }}
                        >
                          {/* Project Name + Badge */}
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-sm font-bold text-gray-900 leading-tight pr-2">{project.name}</h3>
                            {studyCount > 1 && (
                              <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                                {studyCount}
                              </span>
                            )}
                          </div>

                          {/* Meta info */}
                          <div className="text-xs text-gray-500 space-y-1 mb-3">
                            {project.states.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span>📍</span>
                                <span>{project.city ? `${project.city}, ` : ''}{project.states.join(', ')}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-3">
                              <span>{studyCount} {studyCount === 1 ? 'study' : 'studies'}</span>
                              {completedCount > 0 && <span className="text-green-600 font-medium">{completedCount} done</span>}
                            </div>
                          </div>

                          {/* Status dots row */}
                          <div className="flex items-center gap-1.5 mb-3">
                            {project.studies.map((s, i) => {
                              const si = getStatusInfo(s.status);
                              return (
                                <div key={i} className="group relative">
                                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: si.dot }}></div>
                                </div>
                              );
                            })}
                            {pmActive && (
                              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">PM</span>
                            )}
                          </div>

                          <div className="flex-1"></div>

                          {/* Footer */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-400">
                            <span>Updated {formatDate({ seconds: project.latestUpdate })}</span>
                            {studyCount > 1 && (
                              <span className="text-blue-500 font-medium">
                                {isExpanded ? 'Hide ▲' : 'View ▼'}
                              </span>
                            )}
                            {studyCount === 1 && (
                              <span className="text-blue-500 font-medium">Open →</span>
                            )}
                          </div>
                        </div>

                        {/* Expanded Studies List */}
                        {isExpanded && studyCount > 1 && (
                          <div className="border-t border-gray-200 bg-gray-50 divide-y divide-gray-200 max-h-72 overflow-y-auto">
                            {project.studies.map(site => {
                              const si = getStatusInfo(site.status);
                              return (
                                <div
                                  key={site.id}
                                  className="px-4 py-3 hover:bg-white cursor-pointer transition-colors"
                                  onClick={(e) => { e.stopPropagation(); router.push(`/sites/${site.id}`); }}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-gray-900">{site.projectNumber || 'No #'}</span>
                                    <select
                                      value={site.status || 'draft'}
                                      onChange={(e) => handleStatusChange(site.id, e.target.value, e)}
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={updatingStatus === site.id}
                                      className={`text-[10px] px-2 py-0.5 border-0 rounded-full font-medium cursor-pointer ${si.color}`}
                                    >
                                      <option value="draft">📝 Draft</option>
                                      <option value="pending">⏳ Pending</option>
                                      <option value="calculated">🔢 Calculated</option>
                                      <option value="completed">✅ Completed</option>
                                      <option value="sent">📤 Sent</option>
                                    </select>
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-gray-500">
                                    <span>{getStudyTypeLabel(site.studyType)}</span>
                                    <div className="flex items-center gap-1.5">
                                      <Link href={`/sites/${site.id}/calculate`} onClick={e => e.stopPropagation()} className="px-2 py-0.5 rounded font-medium" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>Calc</Link>
                                      <Link href={`/sites/${site.id}/reports`} onClick={e => e.stopPropagation()} className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-medium">Report</Link>
                                      <button onClick={e => handleDeleteSite(site.id, site.siteName, site.projectNumber, e)} disabled={deleting === site.id} className="px-1 text-gray-400 hover:text-red-500">🗑️</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ======== LIST VIEW ======== */
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Studies</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredProjects.map(project => {
                        const isExpanded = expandedProject === project.name;
                        return (
                          <Fragment key={project.name}>
                            <tr
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => {
                                if (project.studies.length === 1) router.push(`/sites/${project.studies[0].id}`);
                                else setExpandedProject(isExpanded ? null : project.name);
                              }}
                            >
                              <td className="px-4 py-3">
                                <div className="text-sm font-semibold text-gray-900">{project.name}</div>
                                {project.city && <div className="text-xs text-gray-400">📍 {project.city}</div>}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                                  {project.studies.length}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{project.states.join(', ') || '—'}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-1">
                                  {project.studies.map((s, i) => (
                                    <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getStatusInfo(s.status).dot }}></div>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">{formatDate({ seconds: project.latestUpdate })}</td>
                              <td className="px-4 py-3 text-right text-xs text-blue-500 font-medium">
                                {project.studies.length === 1 ? 'Open →' : (isExpanded ? 'Hide ▲' : 'Expand ▼')}
                              </td>
                            </tr>
                            {/* Expanded rows */}
                            {isExpanded && project.studies.map(site => {
                              const si = getStatusInfo(site.status);
                              return (
                                <tr key={site.id} className="bg-blue-50/40 hover:bg-blue-50 cursor-pointer" onClick={() => router.push(`/sites/${site.id}`)}>
                                  <td className="px-4 py-2 pl-10 text-xs font-medium text-gray-700">↳ {site.projectNumber || 'No #'} <span className="text-gray-400 font-normal ml-1">{getStudyTypeLabel(site.studyType)}</span></td>
                                  <td></td>
                                  <td className="px-4 py-2 text-xs text-gray-500">{getStateAbbreviation(site.companyState || site.state || '')}</td>
                                  <td className="px-4 py-2">
                                    <select value={site.status || 'draft'} onChange={e => handleStatusChange(site.id, e.target.value, e)} onClick={e => e.stopPropagation()} className={`text-[10px] px-2 py-0.5 border-0 rounded-full font-medium cursor-pointer ${si.color}`}>
                                      <option value="draft">📝 Draft</option>
                                      <option value="pending">⏳ Pending</option>
                                      <option value="calculated">🔢 Calculated</option>
                                      <option value="completed">✅ Completed</option>
                                      <option value="sent">📤 Sent</option>
                                    </select>
                                  </td>
                                  <td className="px-4 py-2 text-xs text-gray-500">{formatDate(site.updatedAt)}</td>
                                  <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1.5">
                                      <Link href={`/sites/${site.id}/calculate`} className="text-[10px] px-2 py-1 rounded font-medium" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>Calculate</Link>
                                      <Link href={`/sites/${site.id}/reports`} className="text-[10px] px-2 py-1 rounded bg-green-50 text-green-700 font-medium">Reports</Link>
                                      <button onClick={e => handleDeleteSite(site.id, site.siteName, site.projectNumber, e)} disabled={deleting === site.id} className="text-[10px] px-1 text-gray-400 hover:text-red-500">🗑️</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Status Legend */}
          <div className="mt-6 mb-4 flex flex-wrap items-center gap-4 text-xs text-gray-400">
            {Object.entries(STATUSES).map(([key, { label, dot }]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: dot }}></span>
                {label}
              </span>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}
