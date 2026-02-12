'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import Link from 'next/link';

export default function MonitoringPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [allComponents, setAllComponents] = useState([]);
  const [componentsLoading, setComponentsLoading] = useState(true);
  const [thresholds, setThresholds] = useState({ critical: 2, warning: 5 });
  const [siteFilter, setSiteFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [pmFilter, setPmFilter] = useState('all');
  const [healthView, setHealthView] = useState('urgency');
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [componentLimit, setComponentLimit] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(null);

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) { setLoading(false); setComponentsLoading(false); return; }

      const allSitesSnapshot = await getDocs(collection(db, 'sites'));
      const sites = allSitesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

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
      setAllComponents(results.flat());
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setComponentsLoading(false);
    }
  };

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

      return { ...comp, replacementYear, yearsRemaining, cost, isPM, usefulLifeNum: ul, tier };
    });

    // Apply filters
    let filtered = siteFilter === 'all' ? enriched : enriched.filter(c => c.siteId === siteFilter);
    if (categoryFilter !== 'all') filtered = filtered.filter(c => c.category === categoryFilter);
    if (tierFilter !== 'all') filtered = filtered.filter(c => c.tier === tierFilter);
    if (pmFilter === 'pm') filtered = filtered.filter(c => c.isPM);
    if (pmFilter === 'reserve') filtered = filtered.filter(c => !c.isPM);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        (c.description || '').toLowerCase().includes(term) ||
        (c.componentName || '').toLowerCase().includes(term) ||
        (c.category || '').toLowerCase().includes(term) ||
        (c.siteName || '').toLowerCase().includes(term)
      );
    }

    const critical = filtered.filter(c => c.tier === 'critical');
    const warning = filtered.filter(c => c.tier === 'warning');
    const healthy = filtered.filter(c => c.tier === 'healthy');

    const exposure1 = filtered.filter(c => c.yearsRemaining <= 1).reduce((s, c) => s + c.cost, 0);
    const exposure3 = filtered.filter(c => c.yearsRemaining <= 3).reduce((s, c) => s + c.cost, 0);
    const exposure5 = filtered.filter(c => c.yearsRemaining <= 5).reduce((s, c) => s + c.cost, 0);
    const exposure10 = filtered.filter(c => c.yearsRemaining <= 10).reduce((s, c) => s + c.cost, 0);

    // Per-site summary (use all enriched, not filtered)
    const siteMap = {};
    enriched.forEach(c => {
      if (!siteMap[c.siteId]) {
        siteMap[c.siteId] = { siteId: c.siteId, siteName: c.siteName, projectNumber: c.projectNumber, critical: 0, warning: 0, healthy: 0, totalCost: 0, criticalCost: 0, warningCost: 0 };
      }
      siteMap[c.siteId][c.tier]++;
      siteMap[c.siteId].totalCost += c.cost;
      if (c.tier === 'critical') siteMap[c.siteId].criticalCost += c.cost;
      if (c.tier === 'warning') siteMap[c.siteId].warningCost += c.cost;
    });
    const siteSummaries = Object.values(siteMap).sort((a, b) => b.critical - a.critical);

    const sorted = [...filtered].sort((a, b) => a.yearsRemaining - b.yearsRemaining);

    const uniqueSites = [...new Map(enriched.map(c => [c.siteId, { id: c.siteId, name: c.siteName, projectNumber: c.projectNumber }])).values()];
    const uniqueCategories = [...new Set(enriched.map(c => c.category).filter(Boolean))].sort();

    return { critical, warning, healthy, exposure1, exposure3, exposure5, exposure10, siteSummaries, sorted, uniqueSites, uniqueCategories, total: filtered.length, totalAll: enriched.length, allCritical: enriched.filter(c => c.tier === 'critical'), allWarning: enriched.filter(c => c.tier === 'warning'), allHealthy: enriched.filter(c => c.tier === 'healthy'), enriched };
  }, [allComponents, thresholds, siteFilter, categoryFilter, tierFilter, pmFilter, searchTerm]);

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-3" style={{ borderColor: '#1d398f' }}></div>
          <p className="text-sm text-gray-500">Loading component health data...</p>
        </div>
      </div>
    );
  }

  const hasFilters = siteFilter !== 'all' || categoryFilter !== 'all' || tierFilter !== 'all' || pmFilter !== 'all' || searchTerm;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero Header */}
      <div style={{ backgroundColor: '#1d398f' }} className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v22H20v-1.5z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
        }}></div>
        <div className="relative w-full px-6 py-8 pb-16">
          <div className="flex items-center justify-between mb-4">
            <Link href="/" className="text-blue-200 hover:text-white text-sm transition-colors">
              ← Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Component Health Monitor</h1>
                <p className="text-blue-200 text-sm mt-0.5">Track replacement timelines and financial exposure across all sites</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-red-300">{healthData.allCritical.length}</div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wide">Critical</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-300">{healthData.allWarning.length}</div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wide">Warning</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-300">{healthData.allHealthy.length}</div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wide">Healthy</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-white">{healthData.totalAll}</div>
                <div className="text-[10px] text-blue-200 uppercase tracking-wide">Total</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full px-6 -mt-8 relative z-10">

        {/* Filters Bar - only for Expiring Soonest */}
        {healthView === 'urgency' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search components..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {/* Site */}
            <select value={siteFilter} onChange={e => setSiteFilter(e.target.value)} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-700 bg-white">
              <option value="all">All Sites</option>
              {healthData.uniqueSites.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {/* Category */}
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-700 bg-white">
              <option value="all">All Categories</option>
              {healthData.uniqueCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {/* Tier */}
            <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-700 bg-white">
              <option value="all">All Status</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warning Only</option>
              <option value="healthy">Healthy Only</option>
            </select>
            {/* PM */}
            <select value={pmFilter} onChange={e => setPmFilter(e.target.value)} className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-700 bg-white">
              <option value="all">Reserve & PM</option>
              <option value="reserve">Reserve Only</option>
              <option value="pm">PM Only</option>
            </select>
            {/* Thresholds */}
            <button
              onClick={() => setShowThresholdEditor(!showThresholdEditor)}
              className="flex items-center gap-1 text-xs px-3 py-2 rounded-lg border transition-colors"
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
            {/* Clear */}
            {hasFilters && (
              <button
                onClick={() => { setSiteFilter('all'); setCategoryFilter('all'); setTierFilter('all'); setPmFilter('all'); setSearchTerm(''); }}
                className="text-xs text-red-600 hover:text-red-800 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Threshold Editor */}
          {showThresholdEditor && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                <span className="text-xs text-gray-600 font-medium">Critical: ≤</span>
                <input type="number" min="0" max={thresholds.warning - 1} value={thresholds.critical}
                  onChange={e => setThresholds(prev => ({ ...prev, critical: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-14 px-2 py-1 text-xs border border-gray-200 rounded-lg text-center text-gray-900 bg-white"
                />
                <span className="text-xs text-gray-500">years</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span className="text-xs text-gray-600 font-medium">Warning: ≤</span>
                <input type="number" min={thresholds.critical + 1} value={thresholds.warning}
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
        </div>
        )}

        {/* View Tabs */}
        <div className="flex gap-1 mb-5">
          {[
            { key: 'urgency', label: 'Expiring Soonest', icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )},
            { key: 'exposure', label: '$ Exposure', icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )},
            { key: 'sites', label: 'Per-Site Health', icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            )},
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setHealthView(tab.key);
                if (tab.key !== 'urgency') {
                  setSiteFilter('all'); setCategoryFilter('all'); setTierFilter('all'); setPmFilter('all'); setSearchTerm('');
                }
                if (tab.key !== 'sites') setSelectedSiteId(null);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border transition-all ${
                healthView === tab.key
                  ? 'text-white shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:text-gray-900'
              }`}
              style={healthView === tab.key ? { backgroundColor: '#1d398f', borderColor: '#1d398f' } : {}}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {componentsLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 mx-auto mb-3" style={{ borderColor: '#1d398f' }}></div>
            <p className="text-sm text-gray-500">Loading components across all sites...</p>
          </div>
        ) : allComponents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-gray-100">
              <span className="text-2xl">📦</span>
            </div>
            <p className="text-base font-medium text-gray-900">No components found</p>
            <p className="text-sm text-gray-500 mt-1">Add components to your sites to see health monitoring data</p>
            <Link href="/sites" className="inline-block mt-4 px-4 py-2 text-sm font-semibold rounded-lg text-white" style={{ backgroundColor: '#1d398f' }}>
              Go to Projects →
            </Link>
          </div>
        ) : (
          <>
            {/* === URGENCY VIEW === */}
            {healthView === 'urgency' && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-xs text-gray-500 font-medium">
                    Showing {Math.min(componentLimit, healthData.sorted.length)} of {healthData.sorted.length} components
                    {hasFilters && <span className="text-blue-600"> (filtered)</span>}
                  </p>
                </div>
                {healthData.sorted.length === 0 ? (
                  <div className="p-10 text-center text-sm text-gray-500">No components match your filters</div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide px-5 py-2.5">Status</th>
                            <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2.5">Component</th>
                            <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2.5">Site</th>
                            <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2.5">Category</th>
                            <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2.5">Useful Life</th>
                            <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2.5">Years Left</th>
                            <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2.5">Replace By</th>
                            <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wide px-5 py-2.5">Est. Cost</th>
                          </tr>
                        </thead>
                        <tbody>
                          {healthData.sorted.slice(0, componentLimit).map((comp, i) => {
                            const ts = getTierStyle(comp.tier);
                            return (
                              <tr key={comp.id + '-' + i} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                                <td className="px-5 py-2.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: ts.bg, color: ts.text, border: `1px solid ${ts.border}` }}>
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ts.dot }}></span>
                                    {ts.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="text-xs font-medium text-gray-900 max-w-[250px] truncate">{comp.description || comp.componentName || 'Unnamed'}</div>
                                  {comp.isPM && <span className="text-[9px] text-green-600 font-medium">PM</span>}
                                </td>
                                <td className="px-4 py-2.5">
                                  <Link href={`/sites/${comp.siteId}/components`} className="text-xs text-blue-600 hover:text-blue-800 font-medium">{comp.siteName}</Link>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-gray-500">{comp.category || '—'}</td>
                                <td className="px-4 py-2.5 text-center text-xs text-gray-500">{comp.usefulLifeNum}yr</td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className="text-xs font-bold" style={{ color: ts.text }}>
                                    {comp.yearsRemaining <= 0 ? 'Overdue' : `${comp.yearsRemaining}yr`}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center text-xs text-gray-600">{comp.replacementYear}</td>
                                <td className="px-5 py-2.5 text-right text-xs font-medium text-gray-900">${Math.round(comp.cost).toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {healthData.sorted.length > componentLimit && (
                      <div className="px-5 py-3 border-t border-gray-100 text-center">
                        <button
                          onClick={() => setComponentLimit(prev => prev + 25)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Load more ({healthData.sorted.length - componentLimit} remaining)
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* === EXPOSURE VIEW === */}
            {healthView === 'exposure' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { label: 'Within 1 Year', value: healthData.exposure1, color: '#dc2626', count: healthData.sorted.filter(c => c.yearsRemaining <= 1).length },
                    { label: 'Within 3 Years', value: healthData.exposure3, color: '#ea580c', count: healthData.sorted.filter(c => c.yearsRemaining <= 3).length },
                    { label: 'Within 5 Years', value: healthData.exposure5, color: '#d97706', count: healthData.sorted.filter(c => c.yearsRemaining <= 5).length },
                    { label: 'Within 10 Years', value: healthData.exposure10, color: '#1d398f', count: healthData.sorted.filter(c => c.yearsRemaining <= 10).length },
                  ].map(item => (
                    <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-5">
                      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
                      <p className="text-2xl font-bold mt-1" style={{ color: item.color }}>{formatCurrency(item.value)}</p>
                      <p className="text-xs text-gray-400 mt-1">{item.count} component{item.count !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
                {/* Bar chart */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-xs font-bold text-gray-900 mb-4">Replacement Cost Timeline</p>
                  {[
                    { label: '0-1yr', val: healthData.exposure1, color: '#dc2626' },
                    { label: '1-3yr', val: healthData.exposure3 - healthData.exposure1, color: '#ea580c' },
                    { label: '3-5yr', val: healthData.exposure5 - healthData.exposure3, color: '#d97706' },
                    { label: '5-10yr', val: healthData.exposure10 - healthData.exposure5, color: '#1d398f' },
                  ].map(bar => {
                    const maxVal = Math.max(healthData.exposure1, healthData.exposure3 - healthData.exposure1, healthData.exposure5 - healthData.exposure3, healthData.exposure10 - healthData.exposure5, 1);
                    const pct = (bar.val / maxVal) * 100;
                    return (
                      <div key={bar.label} className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-medium text-gray-500 w-12 text-right">{bar.label}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                          <div className="h-full rounded-full flex items-center pl-3 transition-all duration-500" style={{ width: `${Math.max(pct, bar.val > 0 ? 10 : 0)}%`, backgroundColor: bar.color }}>
                            {bar.val > 0 && <span className="text-[11px] font-bold text-white whitespace-nowrap">{formatCurrency(bar.val)}</span>}
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
                  <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-500">No sites with components</div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {healthData.siteSummaries.map(site => {
                        const total = site.critical + site.warning + site.healthy;
                        const critPct = total > 0 ? (site.critical / total) * 100 : 0;
                        const warnPct = total > 0 ? (site.warning / total) * 100 : 0;
                        const healthPct = total > 0 ? (site.healthy / total) * 100 : 0;
                        const isSelected = selectedSiteId === site.siteId;
                        return (
                          <button
                            key={site.siteId}
                            onClick={() => setSelectedSiteId(isSelected ? null : site.siteId)}
                            className="text-left w-full"
                          >
                            <div className={`bg-white rounded-xl border-2 p-5 hover:shadow-md transition-all ${isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'}`}>
                              <div className="flex items-start justify-between mb-1">
                                <div>
                                  <h4 className="text-sm font-bold text-gray-900">{site.siteName}</h4>
                                  {site.projectNumber && <p className="text-[10px] text-gray-400 mt-0.5">{site.projectNumber}</p>}
                                </div>
                                <span className={`text-xs transition-transform duration-200 ${isSelected ? 'text-blue-500 rotate-90' : 'text-gray-300'}`}>→</span>
                              </div>
                              <div className="flex rounded-full h-2.5 overflow-hidden my-3 bg-gray-100">
                                {critPct > 0 && <div style={{ width: `${critPct}%`, backgroundColor: '#ef4444' }}></div>}
                                {warnPct > 0 && <div style={{ width: `${warnPct}%`, backgroundColor: '#f59e0b' }}></div>}
                                {healthPct > 0 && <div style={{ width: `${healthPct}%`, backgroundColor: '#22c55e' }}></div>}
                              </div>
                              <div className="flex items-center justify-between text-[10px] mb-2">
                                <div className="flex gap-3">
                                  {site.critical > 0 && <span className="text-red-600 font-semibold">{site.critical} critical</span>}
                                  {site.warning > 0 && <span className="text-amber-600 font-semibold">{site.warning} warning</span>}
                                  <span className="text-green-600">{site.healthy} healthy</span>
                                </div>
                                <span className="font-medium text-gray-500">{total} total</span>
                              </div>
                              {(site.criticalCost > 0 || site.warningCost > 0) && (
                                <div className="flex gap-3 text-[10px] pt-2 border-t border-gray-100">
                                  {site.criticalCost > 0 && <span className="text-red-600 font-medium">{formatCurrency(site.criticalCost)} critical</span>}
                                  {site.warningCost > 0 && <span className="text-amber-600 font-medium">{formatCurrency(site.warningCost)} warning</span>}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* === SITE DRILL-DOWN DETAIL === */}
                    {selectedSiteId && (() => {
                      const siteComps = healthData.enriched
                        .filter(c => c.siteId === selectedSiteId)
                        .sort((a, b) => a.yearsRemaining - b.yearsRemaining);
                      const siteSummary = healthData.siteSummaries.find(s => s.siteId === selectedSiteId);
                      if (!siteSummary || siteComps.length === 0) return null;

                      const total = siteSummary.critical + siteSummary.warning + siteSummary.healthy;
                      const critPct = total > 0 ? Math.round((siteSummary.critical / total) * 100) : 0;
                      const warnPct = total > 0 ? Math.round((siteSummary.warning / total) * 100) : 0;
                      const healthPct = total > 0 ? Math.round((siteSummary.healthy / total) * 100) : 0;

                      // Build replacement year buckets for timeline chart
                      const currentYear = new Date().getFullYear();
                      const yearBuckets = {};
                      siteComps.forEach(c => {
                        const yr = c.replacementYear;
                        if (!yearBuckets[yr]) yearBuckets[yr] = { year: yr, cost: 0, count: 0, critical: 0, warning: 0, healthy: 0 };
                        yearBuckets[yr].cost += c.cost;
                        yearBuckets[yr].count++;
                        yearBuckets[yr][c.tier]++;
                      });
                      const yearData = Object.values(yearBuckets).sort((a, b) => a.year - b.year);
                      const maxYearCost = Math.max(...yearData.map(y => y.cost), 1);

                      // Category breakdown
                      const catBuckets = {};
                      siteComps.forEach(c => {
                        const cat = c.category || 'Uncategorized';
                        if (!catBuckets[cat]) catBuckets[cat] = { name: cat, cost: 0, count: 0, critical: 0, warning: 0, healthy: 0 };
                        catBuckets[cat].cost += c.cost;
                        catBuckets[cat].count++;
                        catBuckets[cat][c.tier]++;
                      });
                      const catData = Object.values(catBuckets).sort((a, b) => b.cost - a.cost);

                      return (
                        <div className="mt-5 bg-white rounded-xl border-2 border-blue-200 overflow-hidden">
                          {/* Detail Header */}
                          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: '#f8faff' }}>
                            <div>
                              <h3 className="text-base font-bold text-gray-900">{siteSummary.siteName}</h3>
                              <p className="text-xs text-gray-500 mt-0.5">{siteSummary.projectNumber || ''} — {total} components</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Link
                                href={`/sites/${selectedSiteId}/components`}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                                style={{ backgroundColor: '#dbebff', color: '#1d398f' }}
                              >
                                Manage Components →
                              </Link>
                              <button onClick={() => setSelectedSiteId(null)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Stats Row */}
                          <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 border-b border-gray-100">
                            <div className="p-4 border-r border-gray-100 text-center">
                              <div className="text-xl font-bold text-red-600">{siteSummary.critical}</div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Critical</div>
                            </div>
                            <div className="p-4 border-r border-gray-100 text-center">
                              <div className="text-xl font-bold text-amber-600">{siteSummary.warning}</div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Warning</div>
                            </div>
                            <div className="p-4 border-r border-gray-100 text-center">
                              <div className="text-xl font-bold text-green-600">{siteSummary.healthy}</div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Healthy</div>
                            </div>
                            <div className="p-4 border-r border-gray-100 text-center">
                              <div className="text-xl font-bold text-red-600">{formatCurrency(siteSummary.criticalCost)}</div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Critical $</div>
                            </div>
                            <div className="p-4 text-center">
                              <div className="text-xl font-bold" style={{ color: '#1d398f' }}>{formatCurrency(siteSummary.totalCost)}</div>
                              <div className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Total Cost</div>
                            </div>
                          </div>

                          {/* Charts Row */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-b border-gray-100">

                            {/* Replacement Timeline Chart */}
                            <div className="p-5 border-r border-gray-100">
                              <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Replacement Cost by Year
                              </h4>
                              <div className="space-y-1.5">
                                {yearData.slice(0, 12).map(yr => {
                                  const pct = (yr.cost / maxYearCost) * 100;
                                  const yearDiff = yr.year - currentYear;
                                  let barColor = '#22c55e';
                                  if (yearDiff <= thresholds.critical) barColor = '#ef4444';
                                  else if (yearDiff <= thresholds.warning) barColor = '#f59e0b';
                                  return (
                                    <div key={yr.year} className="flex items-center gap-2">
                                      <span className={`text-[10px] font-mono w-8 text-right ${yr.year <= currentYear ? 'text-red-600 font-bold' : 'text-gray-500'}`}>{yr.year}</span>
                                      <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
                                        <div
                                          className="h-full rounded flex items-center pl-2 transition-all duration-300"
                                          style={{ width: `${Math.max(pct, yr.cost > 0 ? 8 : 0)}%`, backgroundColor: barColor }}
                                        >
                                          {yr.cost > 500 && <span className="text-[9px] font-bold text-white whitespace-nowrap">{formatCurrency(yr.cost)}</span>}
                                        </div>
                                      </div>
                                      <span className="text-[10px] text-gray-400 w-16 text-right">{yr.count} item{yr.count > 1 ? 's' : ''}</span>
                                    </div>
                                  );
                                })}
                                {yearData.length > 12 && (
                                  <p className="text-[10px] text-gray-400 text-center pt-1">+ {yearData.length - 12} more years</p>
                                )}
                              </div>
                            </div>

                            {/* Health Distribution + Category Breakdown */}
                            <div className="p-5">
                              {/* Donut Chart */}
                              <h4 className="text-xs font-bold text-gray-900 mb-3 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                </svg>
                                Health Distribution
                              </h4>
                              <div className="flex items-center gap-6 mb-5">
                                {/* SVG Donut */}
                                <div className="relative w-24 h-24 flex-shrink-0">
                                  <svg viewBox="0 0 36 36" className="w-full h-full">
                                    {/* Background */}
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                                    {/* Healthy arc */}
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" strokeWidth="3"
                                      strokeDasharray={`${healthPct} ${100 - healthPct}`} strokeDashoffset="25" />
                                    {/* Warning arc */}
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f59e0b" strokeWidth="3"
                                      strokeDasharray={`${warnPct} ${100 - warnPct}`} strokeDashoffset={`${25 - healthPct}`} />
                                    {/* Critical arc */}
                                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" strokeWidth="3"
                                      strokeDasharray={`${critPct} ${100 - critPct}`} strokeDashoffset={`${25 - healthPct - warnPct}`} />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-sm font-bold text-gray-900">{total}</span>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-sm bg-red-500"></span>
                                    <span className="text-xs text-gray-600">Critical: <strong className="text-red-600">{siteSummary.critical}</strong> ({critPct}%)</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
                                    <span className="text-xs text-gray-600">Warning: <strong className="text-amber-600">{siteSummary.warning}</strong> ({warnPct}%)</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-sm bg-green-500"></span>
                                    <span className="text-xs text-gray-600">Healthy: <strong className="text-green-600">{siteSummary.healthy}</strong> ({healthPct}%)</span>
                                  </div>
                                </div>
                              </div>

                              {/* Category Breakdown */}
                              <h4 className="text-xs font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                By Category
                              </h4>
                              <div className="space-y-1.5 max-h-[140px] overflow-y-auto">
                                {catData.map(cat => (
                                  <div key={cat.name} className="flex items-center justify-between text-xs py-1 border-b border-gray-50">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-700 font-medium truncate max-w-[120px]">{cat.name}</span>
                                      <span className="text-gray-400">({cat.count})</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {cat.critical > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold">{cat.critical}</span>}
                                      {cat.warning > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-semibold">{cat.warning}</span>}
                                      <span className="text-gray-600 font-medium">{formatCurrency(cat.cost)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Component List */}
                          <div>
                            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
                              <h4 className="text-xs font-bold text-gray-900">All Components — sorted by urgency</h4>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide px-5 py-2">Status</th>
                                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2">Component</th>
                                    <th className="text-left text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2">Category</th>
                                    <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2">Useful Life</th>
                                    <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2">Years Left</th>
                                    <th className="text-center text-[10px] font-medium text-gray-500 uppercase tracking-wide px-4 py-2">Replace By</th>
                                    <th className="text-right text-[10px] font-medium text-gray-500 uppercase tracking-wide px-5 py-2">Est. Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {siteComps.map((comp, i) => {
                                    const ts = getTierStyle(comp.tier);
                                    return (
                                      <tr key={comp.id + '-' + i} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                                        <td className="px-5 py-2">
                                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: ts.bg, color: ts.text, border: `1px solid ${ts.border}` }}>
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ts.dot }}></span>
                                            {ts.label}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2">
                                          <div className="text-xs font-medium text-gray-900 max-w-[250px] truncate">{comp.description || comp.componentName || 'Unnamed'}</div>
                                          {comp.isPM && <span className="text-[9px] text-green-600 font-medium">PM</span>}
                                        </td>
                                        <td className="px-4 py-2 text-xs text-gray-500">{comp.category || '—'}</td>
                                        <td className="px-4 py-2 text-center text-xs text-gray-500">{comp.usefulLifeNum}yr</td>
                                        <td className="px-4 py-2 text-center">
                                          <span className="text-xs font-bold" style={{ color: ts.text }}>
                                            {comp.yearsRemaining <= 0 ? 'Overdue' : `${comp.yearsRemaining}yr`}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 text-center text-xs text-gray-600">{comp.replacementYear}</td>
                                        <td className="px-5 py-2 text-right text-xs font-medium text-gray-900">${Math.round(comp.cost).toLocaleString()}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            )}
          </>
        )}

        <div className="py-8 text-center">
          <p className="text-[11px] text-gray-400">Component Health Monitor — Pronoia Solutions</p>
        </div>
      </div>
    </div>
  );
}
