'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, Area, ReferenceLine
} from 'recharts';

// Format currency for tooltips and labels
const formatCurrency = (value) => {
  if (value === 0) return '$0';
  if (Math.abs(value) >= 1000000) {
    return '$' + (value / 1000000).toFixed(1) + 'M';
  }
  if (Math.abs(value) >= 1000) {
    return '$' + (value / 1000).toFixed(0) + 'K';
  }
  return '$' + value.toFixed(0);
};

// Format full currency for tooltips
const formatFullCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
};

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-800 mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {formatFullCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Colors
const COLORS = {
  reserve: '#1e3a5f',
  reserveLight: '#3b82f6',
  pm: '#166534',
  pmLight: '#22c55e',
  danger: '#dc2626',
  warning: '#f59e0b',
  full: '#8b5cf6',
  threshold10: '#f59e0b',
  threshold5: '#eab308',
  baseline: '#22c55e'
};

const PIE_COLORS = ['#1e3a5f', '#3b82f6', '#60a5fa', '#93c5fd', '#166534', '#22c55e', '#4ade80', '#86efac', '#f59e0b', '#fbbf24'];

export default function ChartsPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;

  const [site, setSite] = useState(null);
  const [results, setResults] = useState(null);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState('cashflow');
  const [pmRequired, setPmRequired] = useState(true);

  useEffect(() => {
    if (user && siteId) loadData();
  }, [user, siteId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load site
      const siteDoc = await getDoc(doc(db, 'sites', siteId));
      let siteData = null;
      if (siteDoc.exists()) {
        siteData = { id: siteDoc.id, ...siteDoc.data() };
        setSite(siteData);
      }

      // Load projections/results
      const projectionsDoc = await getDoc(doc(db, 'sites', siteId, 'projections', 'latest'));
      let resultsData = null;
      if (projectionsDoc.exists()) {
        resultsData = projectionsDoc.data();
        setResults(resultsData);
      }

      // Load components
      const { getDocs, collection } = await import('firebase/firestore');
      const componentsSnap = await getDocs(collection(db, 'sites', siteId, 'components'));
      const comps = componentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComponents(comps);

      // ========================================
      // CHECK PM REQUIREMENT
      // ========================================
      // First check saved results flag (set by calculate page)
      if (resultsData?.pmRequired !== undefined) {
        setPmRequired(resultsData.pmRequired);
        console.log('📊 Charts PM from results:', resultsData.pmRequired);
      } else {
        // Fall back to org stateCompliance lookup
        try {
          let orgId = siteData?.organizationId;
          if (!orgId && user) {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
              orgId = userDoc.data()?.organizationId;
            }
          }
          
          if (orgId) {
            const orgDoc = await getDoc(doc(db, 'organizations', orgId));
            if (orgDoc.exists()) {
              const stateCompliance = orgDoc.data()?.settings?.stateCompliance || [];
              const siteState = siteData?.companyState || '';
              
              const stateConfig = stateCompliance.find(
                s => s.code === siteState || s.name === siteState || 
                     s.abbreviation === siteState || s.code === siteState.toUpperCase()
              );
              
              if (stateConfig) {
                setPmRequired(stateConfig.pmRequired === true);
                console.log('📊 Charts PM from org settings:', stateConfig.pmRequired);
              }
            }
          }
        } catch (err) {
          console.warn('Charts: Could not check PM requirement:', err);
        }
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading charts...</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">No Data Available</h1>
          <p className="text-gray-600 mb-6">Please run calculations first to generate charts.</p>
          <Link 
            href={`/sites/${siteId}`}
            className="inline-block px-6 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
          >
            ← Back to Project
          </Link>
        </div>
      </div>
    );
  }

  // Prepare data for charts
  const reserveCashFlow = results.reserveCashFlow || [];
  const pmCashFlow = results.pmCashFlow || [];
  const reserveFund = results.reserveFund || {};
  const pmFund = results.pmFund || {};
  const thresholds = results.thresholds || {};
  
  // Check PM component classification
  const isPMComponent = (c) => c.isPreventiveMaintenance || c.isPM || c.type === 'pm' || c.fundType === 'pm';
  
  // When PM not required, ALL components are reserve
  const reserveComponents = pmRequired 
    ? components.filter(c => !isPMComponent(c))
    : components;
  const pmComponents = pmRequired 
    ? components.filter(c => isPMComponent(c))
    : [];

  // Cash Flow Chart Data
  const cashFlowData = reserveCashFlow.map((row, index) => {
    const fullFundingBalance = (reserveFund.currentBalance || 0) + 
      ((reserveFund.recommendedContribution || 0) * (index + 1)) - 
      reserveCashFlow.slice(0, index + 1).reduce((sum, r) => sum + (r.expenditures || 0), 0);
    
    return {
      year: row.year,
      currentBalance: row.endingBalance || 0,
      fullFundingBalance: fullFundingBalance,
      expenditures: row.expenditures || 0
    };
  });

  // Expenditure Chart Data - only years with expenditures
  const expenditureData = reserveCashFlow
    .filter(row => (row.expenditures || 0) > 0)
    .map(row => ({
      year: row.year,
      amount: row.expenditures
    }));

  // Group by category for pie chart - use reserveComponents (which includes all when PM not required)
  const categoryTotals = {};
  reserveComponents.forEach(comp => {
    const cat = comp.category || 'Other';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + (parseFloat(comp.totalCost) || 0);
  });
  
  const componentPieData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Funding Scenarios Comparison Data
  const currentContribution = reserveFund.currentContribution || site?.currentAnnualContribution || 0;
  
  const scenarioData = [
    {
      name: 'Full Funding',
      contribution: reserveFund.recommendedContribution || 0,
      color: COLORS.full
    },
    {
      name: '10% Threshold',
      contribution: thresholds.multiplier10 ? Math.round(currentContribution * thresholds.multiplier10) : 0,
      color: COLORS.threshold10
    },
    {
      name: '5% Threshold',
      contribution: thresholds.multiplier5 ? Math.round(currentContribution * thresholds.multiplier5) : 0,
      color: COLORS.threshold5
    },
    {
      name: 'Baseline (0%)',
      contribution: thresholds.multiplierBaseline ? Math.round(currentContribution * thresholds.multiplierBaseline) : 0,
      color: COLORS.baseline
    }
  ];

  // Percent Funded Gauge Data
  const percentFunded = reserveFund.percentFunded || 0;
  const gaugeData = [
    { name: 'Funded', value: Math.min(percentFunded, 100) },
    { name: 'Unfunded', value: Math.max(100 - percentFunded, 0) }
  ];

  // Reserve vs PM Comparison (only used when pmRequired)
  const fundComparisonData = [
    {
      name: 'Current Balance',
      reserve: reserveFund.currentBalance || 0,
      pm: pmFund.currentBalance || 0
    },
    {
      name: 'Annual Contribution',
      reserve: reserveFund.currentContribution || 0,
      pm: pmFund.currentContribution || 0
    },
    {
      name: 'Recommended',
      reserve: reserveFund.recommendedContribution || 0,
      pm: pmFund.recommendedContribution || 0
    }
  ];

  // Build tabs - conditionally include PM comparison tab
  const chartTabs = [
    { id: 'cashflow', label: '30-Year Cash Flow', icon: '📈' },
    { id: 'expenditures', label: 'Expenditures', icon: '📊' },
    { id: 'funded', label: 'Percent Funded', icon: '🎯' },
    { id: 'scenarios', label: 'Funding Scenarios', icon: '⚖️' },
    { id: 'components', label: 'Component Costs', icon: '🥧' },
    ...(pmRequired ? [{ id: 'comparison', label: 'Reserve vs PM', icon: '🔄' }] : [])
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link 
                href={`/sites/${siteId}`}
                className="text-teal-600 hover:text-teal-700 text-sm mb-1 inline-block"
              >
                ← Back to {site?.siteName || 'Site'}
              </Link>
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                📊 Charts & Visualizations
              </h1>
              <p className="text-gray-500 text-sm">Visual analysis of reserve study data</p>
            </div>
            
            {/* Quick Stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{percentFunded.toFixed(1)}%</p>
                <p className="text-xs text-gray-500">Percent Funded</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{formatCurrency(reserveFund.recommendedContribution || 0)}</p>
                <p className="text-xs text-gray-500">Recommended</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-700">{reserveComponents.length}</p>
                <p className="text-xs text-gray-500">Components</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chart Navigation Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="w-full px-6">
          <div className="flex gap-1 overflow-x-auto py-2">
            {chartTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveChart(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeChart === tab.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart Content */}
      <div className="w-full px-6 py-6">
        
        {/* 30-Year Cash Flow Chart */}
        {activeChart === 'cashflow' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">30-Year Reserve Fund Cash Flow</h2>
            <p className="text-gray-500 text-sm mb-6">Comparison of Current Funding vs Full Funding projected balances</p>
            
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={cashFlowData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.toString().slice(-2)}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <ReferenceLine y={0} stroke="#dc2626" strokeDasharray="5 5" label={{ value: 'Zero Balance', fill: '#dc2626', fontSize: 10 }} />
                  <Area
                    type="monotone"
                    dataKey="currentBalance"
                    name="Current Funding"
                    fill="#3b82f6"
                    fillOpacity={0.1}
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="fullFundingBalance"
                    name="Full Funding"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            
            <div className="mt-4 flex gap-6 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Current Funding Path</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1 bg-purple-500 rounded" style={{ borderStyle: 'dashed' }}></div>
                <span className="text-gray-600">Full Funding Path</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500 rounded"></div>
                <span className="text-gray-600">Danger Zone (Below $0)</span>
              </div>
            </div>
          </div>
        )}

        {/* Expenditures Chart */}
        {activeChart === 'expenditures' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Projected Expenditures by Year</h2>
            <p className="text-gray-500 text-sm mb-6">Years with scheduled component replacements</p>
            
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenditureData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="year" 
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="amount" 
                    name="Expenditure"
                    fill="#1e3a5f"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-800">{expenditureData.length}</p>
                <p className="text-xs text-gray-500">Years with Expenses</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-800">
                  {formatCurrency(Math.max(...expenditureData.map(d => d.amount)))}
                </p>
                <p className="text-xs text-gray-500">Largest Single Year</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-2xl font-bold text-gray-800">
                  {formatCurrency(expenditureData.reduce((sum, d) => sum + d.amount, 0))}
                </p>
                <p className="text-xs text-gray-500">Total 30-Year</p>
              </div>
            </div>
          </div>
        )}

        {/* Percent Funded Gauge */}
        {activeChart === 'funded' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Reserve Fund Health</h2>
            <p className="text-gray-500 text-sm mb-6">Current percent funded status</p>
            
            <div className={`grid ${pmRequired ? 'grid-cols-2' : 'grid-cols-1 max-w-md mx-auto'} gap-8`}>
              {/* Reserve Fund Gauge */}
              <div className="text-center">
                <h3 className="font-semibold text-gray-700 mb-4">Reserve Fund</h3>
                <div className="h-64 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gaugeData}
                        cx="50%"
                        cy="50%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={80}
                        outerRadius={110}
                        paddingAngle={0}
                        dataKey="value"
                      >
                        <Cell fill={percentFunded >= 70 ? '#22c55e' : percentFunded >= 30 ? '#f59e0b' : '#dc2626'} />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: '-20px' }}>
                    <div className="text-center">
                      <p className={`text-4xl font-bold ${
                        percentFunded >= 70 ? 'text-green-600' : 
                        percentFunded >= 30 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {percentFunded.toFixed(1)}%
                      </p>
                      <p className="text-sm text-gray-500">Funded</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    percentFunded >= 70 ? 'bg-green-100 text-green-700' : 
                    percentFunded >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {percentFunded >= 70 ? '✓ Good Standing' : 
                     percentFunded >= 30 ? '⚠ Fair' : '⚠ Underfunded'}
                  </span>
                </div>
              </div>

              {/* PM Fund Gauge - only show when PM is required */}
              {pmRequired && (
                <div className="text-center">
                  <h3 className="font-semibold text-gray-700 mb-4">PM Fund</h3>
                  <div className="h-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Funded', value: Math.min(pmFund.percentFunded || 0, 100) },
                            { name: 'Unfunded', value: Math.max(100 - (pmFund.percentFunded || 0), 0) }
                          ]}
                          cx="50%"
                          cy="50%"
                          startAngle={180}
                          endAngle={0}
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={0}
                          dataKey="value"
                        >
                          <Cell fill={(pmFund.percentFunded || 0) >= 70 ? '#22c55e' : (pmFund.percentFunded || 0) >= 30 ? '#f59e0b' : '#dc2626'} />
                          <Cell fill="#e5e7eb" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: '-20px' }}>
                      <div className="text-center">
                        <p className={`text-4xl font-bold ${
                          (pmFund.percentFunded || 0) >= 70 ? 'text-green-600' : 
                          (pmFund.percentFunded || 0) >= 30 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {(pmFund.percentFunded || 0).toFixed(1)}%
                        </p>
                        <p className="text-sm text-gray-500">Funded</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      (pmFund.percentFunded || 0) >= 70 ? 'bg-green-100 text-green-700' : 
                      (pmFund.percentFunded || 0) >= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {(pmFund.percentFunded || 0) >= 70 ? '✓ Good Standing' : 
                       (pmFund.percentFunded || 0) >= 30 ? '⚠ Fair' : '⚠ Underfunded'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Funding Level Guide */}
            <div className="mt-8 flex justify-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500"></div>
                <span>70%+ Good</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-500"></div>
                <span>30-70% Fair</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-500"></div>
                <span>&lt;30% Poor</span>
              </div>
            </div>
          </div>
        )}

        {/* Funding Scenarios Comparison */}
        {activeChart === 'scenarios' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Funding Scenario Comparison</h2>
            <p className="text-gray-500 text-sm mb-6">Annual contribution amounts under different funding strategies</p>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scenarioData} layout="vertical" margin={{ top: 20, right: 30, left: 100, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickFormatter={formatCurrency}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={90}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="contribution" 
                    name="Annual Contribution"
                    radius={[0, 4, 4, 0]}
                  >
                    {scenarioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-4">
              {scenarioData.map((scenario, index) => (
                <div 
                  key={index}
                  className="text-center p-4 rounded-lg border-2"
                  style={{ borderColor: scenario.color }}
                >
                  <p className="text-lg font-bold" style={{ color: scenario.color }}>
                    {formatFullCurrency(scenario.contribution)}
                  </p>
                  <p className="text-xs text-gray-500">{scenario.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Component Costs Pie Chart */}
        {activeChart === 'components' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Component Cost Breakdown</h2>
            <p className="text-gray-500 text-sm mb-6">Total replacement costs by category</p>
            
            <div className="grid grid-cols-2 gap-8">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={componentPieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {componentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatFullCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-700 mb-3">By Category</h3>
                {componentPieData.map((cat, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      ></div>
                      <span className="text-sm text-gray-700">{cat.name}</span>
                    </div>
                    <span className="text-sm font-semibold">{formatFullCurrency(cat.value)}</span>
                  </div>
                ))}
                <div className="border-t pt-2 mt-2 flex items-center justify-between font-bold">
                  <span>Total</span>
                  <span>{formatFullCurrency(componentPieData.reduce((sum, c) => sum + c.value, 0))}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reserve vs PM Comparison - only show when PM is required */}
        {activeChart === 'comparison' && pmRequired && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Reserve Fund vs PM Fund</h2>
            <p className="text-gray-500 text-sm mb-6">Side-by-side comparison of both funds</p>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fundComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="reserve" name="Reserve Fund" fill={COLORS.reserve} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pm" name="PM Fund" fill={COLORS.pm} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  💰 Reserve Fund
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Components:</span>
                    <span className="font-medium text-gray-900">{reserveFund.componentCount || reserveComponents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Cost:</span>
                    <span className="font-medium text-gray-900">{formatFullCurrency(reserveFund.totalReplacementCost || reserveComponents.reduce((sum, c) => sum + (parseFloat(c.totalCost) || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Percent Funded:</span>
                    <span className="font-medium text-gray-900">{(reserveFund.percentFunded || 0).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                  🟢 PM Fund
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Components:</span>
                    <span className="font-medium text-gray-900">{pmFund.componentCount || pmComponents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Cost:</span>
                    <span className="font-medium text-gray-900">{formatFullCurrency(pmFund.totalReplacementCost || pmComponents.reduce((sum, c) => sum + (parseFloat(c.totalCost) || 0), 0))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Percent Funded:</span>
                    <span className="font-medium text-gray-900">{(pmFund.percentFunded || 0).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
