'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [organization, setOrganization] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ sites: 0, studies: 0, calculated: 0, pending: 0 });

  // Component health monitoring
  const [allComponents, setAllComponents] = useState([]);
  const [componentsLoading, setComponentsLoading] = useState(true);
  const [thresholds, setThresholds] = useState({ critical: 2, warning: 5 });
  const [siteFilter, setSiteFilter] = useState('all');
  const [healthView, setHealthView] = useState('urgency'); // 'urgency' | 'exposure' | 'sites'
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [componentLimit, setComponentLimit] = useState(15);

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

            // Load components from all sites
            loadAllComponents(studiesList);
          } catch (e) {
            console.log('Could not load site stats:', e);
            setComponentsLoading(false);
          }
        } else {
          setComponentsLoading(false);
        }
      } else {
        setComponentsLoading(false);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setComponentsLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const loadAllComponents = async (sites) => {
    try {
      const componentPromises = sites.map(async (site) => {
        const compsSnapshot = await getDocs(collection(db, 'sites', site.id, 'components'));
        return compsSnapshot.docs.map(d => ({
          id: d.id,
          siteId: site.id,
          siteName: site.siteName || 'Unknown',
          projectNumber: site.projectNumber || '',
          beginningYear: site.beginningYear || new Date().getFullYear(),
          ...d.data()
        }));
      });
      const results = await Promise.all(componentPromises);
      const flat = results.flat();
      setAllComponents(flat);
    } catch (error) {
      console.error('Error loading components:', error);
    } finally {
      setComponentsLoading(false);
    }
  };

  // Component health calculations
  const healthData = useMemo(() => {
    const currentYear = new Date().getFullYear();
    
    const enriched = allComponents.map(comp => {
      const rul = parseFloat(comp.remainingUsefulLife) || 0;
      const ul = parseFloat(comp.usefulLife) || 20;
      const replacementYear = comp.beginningYear + rul;
      const yearsRemaining = replacementYear - currentYear;
      const cost = parseFloat(comp.totalCost) || 0;
      const isPM = comp.isPreventiveMaintenance || comp.pm || false;
      
      let tier = 'healthy';
      if (yearsRemaining <= thresholds.critical) tier = 'critical';
      else if (yearsRemaining <= thresholds.warning) tier = 'warning';

      return {
        ...comp,
        replacementYear,
        yearsRemaining,
        cost,
        isPM,
        usefulLifeNum: ul,
        tier,
      };
    });

    // Filter by site if selected
    const filtered = siteFilter === 'all' ? enriched : enriched.filter(c => c.siteId === siteFilter);

    // Counts
    const critical = filtered.filter(c => c.tier === 'critical');
    const warning = filtered.filter(c => c.tier === 'warning');
    const healthy = filtered.filter(c => c.tier === 'healthy');

    // $ Exposure by timeframe
    const exposure1 = filtered.filter(c => c.yearsRemaining <= 1).reduce((s, c) => s + c.cost, 0);
    const exposure3 = filtered.filter(c => c.yearsRemaining <= 3).reduce((s, c) => s + c.cost, 0);
    const exposure5 = filtered.filter(c => c.yearsRemaining <= 5).reduce((s, c) => s + c.cost, 0);
    const exposure10 = filtered.filter(c => c.yearsRemaining <= 10).reduce((s, c) => s + c.cost, 0);

    // Per-site summary
    const siteMap = {};
    enriched.forEach(c => {
      if (!siteMap[c.siteId]) {
        siteMap[c.siteId] = { siteId: c.siteId, siteName: c.siteName, projectNumber: c.projectNumber, critical: 0, warning: 0, healthy: 0, totalCost: 0, criticalCost: 0 };
      }
      siteMap[c.siteId][c.tier]++;
      siteMap[c.siteId].totalCost += c.cost;
      if (c.tier === 'critical') siteMap[c.siteId].criticalCost += c.cost;
    });
    const siteSummaries = Object.values(siteMap).sort((a, b) => b.critical - a.critical);

    // Sorted urgency list
    const sorted = [...filtered].sort((a, b) => a.yearsRemaining - b.yearsRemaining);

    // Unique sites for filter
    const uniqueSites = [...new Map(enriched.map(c => [c.siteId, { id: c.siteId, name: c.siteName, projectNumber: c.projectNumber }])).values()];

    return { critical, warning, healthy, exposure1, exposure3, exposure5, exposure10, siteSummaries, sorted, uniqueSites, total: filtered.length };
  }, [allComponents, thresholds, siteFilter]);

  const formatCurrency = (val) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${Math.round(val).toLocaleString()}`;
  };

  const getTierStyle = (tier) => {
    if (tier === 'critical') return { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', dot: '#ef4444', label: 'Critical' };
    if (tier === 'warning') return { bg: '#fffbeb', border: '#fde68a', text: '#d97706', dot: '#f59e0b', label: 'Warning' };
    return { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', dot: '#22c55e', label: 'Healthy' };
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
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>
        
        <div className="relative w-full px-6 py-8 pb-16">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <img src="/pronoia.png" alt="Pronoia Solutions" className="h-10 w-auto rounded-lg bg-white/10 p-1" />
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
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {firstName}
            </h1>
            <p className="text-blue-200 mt-1 text-sm">Here's an overview of your reserve studies</p>
          </div>
        </div>
      </div>

      <div className="w-full px-6 -mt-8 relative z-10">

        {/* Stats Cards */}
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
                <div className="h-10 w-10 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: stat.accent + '15' }}>{stat.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ============================================================ */}
        {/* COMPONENT HEALTH MONITORING                                   */}
        {/* ============================================================ */}
        <div className="mb-8">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            
            {/* Section Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#1d398f' }}>
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Component Health Monitor</h2>
                  <p className="text-xs text-gray-500">Track replacement timelines and financial exposure across all sites</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Site Filter */}
                <select
                  value={siteFilter}
                  onChange={e => setSiteFilter(e.target.value)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 bg-white"
                >
                  <option value="all">All Sites ({healthData.total})</option>
                  {healthData.uniqueSites.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.projectNumber ? `(${s.projectNumber})` : ''}</option>
                  ))}
                </select>
                {/* Threshold button */}
                <button
                  onClick={() => setShowThresholdEditor(!showThresholdEditor)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={showThresholdEditor 
                    ? { backgroundColor: '#1d398f', color: 'white', borderColor: '#1d398f' }
                    : { backgroundColor: 'white', color: '#6b7280', borderColor: '#e5e7eb' }
                  }
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Thresholds
                </button>
              </div>
            </div>

            {/* Threshold Editor */}
            {showThresholdEditor && (
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                  <span className="text-xs text-gray-600 font-medium">Critical: ≤</span>
                  <input
                    type="number"
                    min="0"
                    max={thresholds.warning - 1}
                    value={thresholds.critical}
                    onChange={e => setThresholds(prev => ({ ...prev, critical: Math.max(0, parseInt(e.target.value) || 0) }))}
                    className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center text-gray-900 bg-white"
                  />
                  <span className="text-xs text-gray-500">years</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-xs text-gray-600 font-medium">Warning: ≤</span>
                  <input
                    type="number"
                    min={thresholds.critical + 1}
                    value={thresholds.warning}
                    onChange={e => setThresholds(prev => ({ ...prev, warning: Math.max(prev.critical + 1, parseInt(e.target.value) || 0) }))}
                    className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center text-gray-900 bg-white"
                  />
                  <span className="text-xs text-gray-500">years</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  <span className="text-xs text-gray-600 font-medium">Healthy: &gt; {thresholds.warning} years</span>
                </div>
              </div>
            )}

            {componentsLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-3" style={{ borderColor: '#1d398f' }}></div>
                <p className="text-xs text-gray-500">Loading components across all sites...</p>
              </div>
            ) : allComponents.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-gray-100">
                  <span className="text-xl">📦</span>
                </div>
                <p className="text-sm font-medium text-gray-900">No components found</p>
                <p className="text-xs text-gray-500 mt-1">Add components to your sites to see health monitoring data</p>
              </div>
            ) : (
              <>
                {/* Summary Row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-0 border-b border-gray-200">
                  <div className="p-4 border-r border-gray-100 text-center">
                    <div className="text-2xl font-bold text-red-600">{healthData.critical.length}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">Critical (≤{thresholds.critical}yr)</div>
                  </div>
                  <div className="p-4 border-r border-gray-100 text-center">
                    <div className="text-2xl font-bold text-amber-600">{healthData.warning.length}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">Warning (≤{thresholds.warning}yr)</div>
                  </div>
                  <div className="p-4 border-r border-gray-100 text-center">
                    <div className="text-2xl font-bold text-green-600">{healthData.healthy.length}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">Healthy (&gt;{thresholds.warning}yr)</div>
                  </div>
                  <div className="p-4 text-center">
                    <div className="text-2xl font-bold" style={{ color: '#1d398f' }}>{healthData.total}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium mt-0.5">Total Components</div>
                  </div>
                </div>

                {/* View Tabs */}
                <div className="px-5 pt-3 flex gap-1 border-b border-gray-100">
                  {[
                    { key: 'urgency', label: 'Expiring Soonest', icon: '⚡' },
                    { key: 'exposure', label: '$ Exposure', icon: '💰' },
                    { key: 'sites', label: 'Per-Site Health', icon: '🏢' },
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setHealthView(tab.key)}
                      className={`px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                        healthView === tab.key
                          ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.icon} {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="p-5">

                  {/* === URGENCY VIEW === */}
                  {healthView === 'urgency' && (
                    <div>
                      {healthData.sorted.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">No components to display</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-gray-200">
                                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Status</th>
                                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Component</th>
                                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Site</th>
                                  <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Category</th>
                                  <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Years Left</th>
                                  <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wide pb-2 pr-4">Replace By</th>
                                  <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wide pb-2">Est. Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {healthData.sorted.slice(0, componentLimit).map((comp, i) => {
                                  const ts = getTierStyle(comp.tier);
                                  return (
                                    <tr key={comp.id + '-' + i} className="border-b border-gray-50 hover:bg-gray-50/50">
                                      <td className="py-2 pr-4">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: ts.bg, color: ts.text, border: `1px solid ${ts.border}` }}>
                                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ts.dot }}></span>
                                          {ts.label}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4">
                                        <div className="text-xs font-medium text-gray-900 max-w-[200px] truncate">{comp.description || comp.componentName || 'Unnamed'}</div>
                                        {comp.isPM && <span className="text-[9px] text-green-600 font-medium">PM</span>}
                                      </td>
                                      <td className="py-2 pr-4">
                                        <Link href={`/sites/${comp.siteId}/components`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">{comp.siteName}</Link>
                                      </td>
                                      <td className="py-2 pr-4 text-xs text-gray-500">{comp.category || '—'}</td>
                                      <td className="py-2 pr-4 text-right">
                                        <span className="text-xs font-bold" style={{ color: ts.text }}>
                                          {comp.yearsRemaining <= 0 ? 'Overdue' : `${comp.yearsRemaining}yr`}
                                        </span>
                                      </td>
                                      <td className="py-2 pr-4 text-right text-xs text-gray-600">{comp.replacementYear}</td>
                                      <td className="py-2 text-right text-xs font-medium text-gray-900">${Math.round(comp.cost).toLocaleString()}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {healthData.sorted.length > componentLimit && (
                            <button
                              onClick={() => setComponentLimit(prev => prev + 20)}
                              className="mt-3 w-full py-2 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50/50 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              Show more ({healthData.sorted.length - componentLimit} remaining)
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* === EXPOSURE VIEW === */}
                  {healthView === 'exposure' && (
                    <div>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                        {[
                          { label: 'Within 1 Year', value: healthData.exposure1, color: '#dc2626', count: healthData.sorted.filter(c => c.yearsRemaining <= 1).length },
                          { label: 'Within 3 Years', value: healthData.exposure3, color: '#ea580c', count: healthData.sorted.filter(c => c.yearsRemaining <= 3).length },
                          { label: 'Within 5 Years', value: healthData.exposure5, color: '#d97706', count: healthData.sorted.filter(c => c.yearsRemaining <= 5).length },
                          { label: 'Within 10 Years', value: healthData.exposure10, color: '#1d398f', count: healthData.sorted.filter(c => c.yearsRemaining <= 10).length },
                        ].map(item => (
                          <div key={item.label} className="rounded-xl border border-gray-200 p-4">
                            <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
                            <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{formatCurrency(item.value)}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{item.count} component{item.count !== 1 ? 's' : ''}</p>
                          </div>
                        ))}
                      </div>
                      {/* Visual bar */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-3">Replacement Cost Timeline</p>
                        {[
                          { label: '0-1yr', val: healthData.exposure1, color: '#dc2626' },
                          { label: '1-3yr', val: healthData.exposure3 - healthData.exposure1, color: '#ea580c' },
                          { label: '3-5yr', val: healthData.exposure5 - healthData.exposure3, color: '#d97706' },
                          { label: '5-10yr', val: healthData.exposure10 - healthData.exposure5, color: '#1d398f' },
                        ].map(bar => {
                          const maxVal = Math.max(healthData.exposure1, healthData.exposure3 - healthData.exposure1, healthData.exposure5 - healthData.exposure3, healthData.exposure10 - healthData.exposure5, 1);
                          const pct = (bar.val / maxVal) * 100;
                          return (
                            <div key={bar.label} className="flex items-center gap-3 mb-2">
                              <span className="text-[10px] font-medium text-gray-500 w-10 text-right">{bar.label}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-5 overflow-hidden">
                                <div className="h-full rounded-full flex items-center pl-2 transition-all duration-500" style={{ width: `${Math.max(pct, bar.val > 0 ? 8 : 0)}%`, backgroundColor: bar.color }}>
                                  {bar.val > 0 && <span className="text-[9px] font-bold text-white whitespace-nowrap">{formatCurrency(bar.val)}</span>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* === PER-SITE VIEW === */}
                  {healthView === 'sites' && (
                    <div>
                      {healthData.siteSummaries.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-6">No sites with components</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {healthData.siteSummaries.map(site => {
                            const total = site.critical + site.warning + site.healthy;
                            const critPct = total > 0 ? (site.critical / total) * 100 : 0;
                            const warnPct = total > 0 ? (site.warning / total) * 100 : 0;
                            const healthPct = total > 0 ? (site.healthy / total) * 100 : 0;
                            return (
                              <Link key={site.siteId} href={`/sites/${site.siteId}/components`} className="group">
                                <div className="rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all">
                                  <div className="flex items-start justify-between mb-3">
                                    <div>
                                      <h4 className="text-sm font-bold text-gray-900">{site.siteName}</h4>
                                      {site.projectNumber && <p className="text-[10px] text-gray-400">{site.projectNumber}</p>}
                                    </div>
                                    <span className="text-gray-300 group-hover:text-blue-500 transition-colors text-xs">→</span>
                                  </div>
                                  {/* Health bar */}
                                  <div className="flex rounded-full h-2 overflow-hidden mb-3 bg-gray-100">
                                    {critPct > 0 && <div style={{ width: `${critPct}%`, backgroundColor: '#ef4444' }}></div>}
                                    {warnPct > 0 && <div style={{ width: `${warnPct}%`, backgroundColor: '#f59e0b' }}></div>}
                                    {healthPct > 0 && <div style={{ width: `${healthPct}%`, backgroundColor: '#22c55e' }}></div>}
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex gap-3">
                                      {site.critical > 0 && <span className="text-red-600 font-semibold">{site.critical} critical</span>}
                                      {site.warning > 0 && <span className="text-amber-600 font-semibold">{site.warning} warning</span>}
                                      <span className="text-green-600">{site.healthy} healthy</span>
                                    </div>
                                    <span className="font-medium text-gray-500">{total} total</span>
                                  </div>
                                  {site.criticalCost > 0 && (
                                    <div className="mt-2 text-[10px] text-red-600 font-medium">
                                      {formatCurrency(site.criticalCost)} critical exposure
                                    </div>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
              <p className="text-xs text-gray-500 leading-relaxed flex-1">Create, edit, and manage reserve study sites. Add components, run calculations, and generate reports.</p>
              <p className="mt-3 text-xs font-semibold" style={{ color: '#1d398f' }}>View All Sites →</p>
            </div>
          </Link>
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
              <p className="text-xs text-gray-500 leading-relaxed flex-1">Manage your organization's library of component descriptions and notes for consistent reporting.</p>
              <p className="mt-3 text-xs text-green-600 font-semibold">Manage Notes →</p>
            </div>
          </Link>
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
              <p className="text-xs text-gray-500 leading-relaxed flex-1">Update your personal information, change password, and manage account settings.</p>
              <p className="mt-3 text-xs text-purple-600 font-semibold">View Profile →</p>
            </div>
          </Link>
        </div>

        {/* Bottom Row: Organization + Quick Tips */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
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
                  <img src="/pronoia.png" alt={organization.name} className="h-10 w-10 rounded-lg object-contain bg-gray-50 p-1 border border-gray-100" />
                  <div>
                    <p className="text-sm font-bold text-gray-900">{organization.name}</p>
                    <p className="text-xs text-gray-500">Reserve Study Organization</p>
                  </div>
                </div>
                {isAdmin && (
                  <Link href="/admin" className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
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
              {['Create a new site and fill in the project information form with financial parameters.','Add components manually or import from CSV. Assign notes from your library.','Run calculations to generate 30-year projections and funding recommendations.','Generate professional reports for your clients.'].map((tip, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>{i + 1}</span>
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

        <div className="py-8 text-center">
          <p className="text-[11px] text-gray-400">Reserve Study Management Platform</p>
          <p className="text-[11px] text-gray-400 mt-0.5">© 2026 Pronoia Solutions. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
