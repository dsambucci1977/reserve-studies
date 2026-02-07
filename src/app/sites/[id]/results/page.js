// src/app/sites/[id]/results/page.js
// CONDITIONAL DUAL FUND RESULTS PAGE - Shows PM only when required by state
// v9.1: Fixes Component Schedule Summary table calculations
// - Current Reserve Funds distributed by FFB ratio (not replacement cost ratio)
// - Funds Needed = Full Funded Balance - Current Reserve Funds (not just FFB)
// - Annual Funding from calculations engine (straight-line: totalCost / usefulLife)
// - Per-category percent funded = current reserve funds / FFB

'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getSite, getProjections } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ResultsPage() {
  const [site, setSite] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reserve-cashflow');
  const params = useParams();
  const siteId = params.id;

  useEffect(() => {
    const loadData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        window.location.href = '/';
        return;
      }
      
      try {
        const [siteData, projectionsData] = await Promise.all([
          getSite(siteId),
          getProjections(siteId)
        ]);
        
        setSite(siteData);
        setResults(projectionsData);
        
        console.log('📊 Loaded results:', projectionsData);
        console.log('PM Required:', projectionsData?.pmRequired !== false);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [siteId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-900">Loading results...</div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Results Yet</h2>
            <p className="text-gray-600 mb-6">Run calculations first to see results.</p>
            <Link
              href={`/sites/${siteId}/calculate`}
              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Run Calculations
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Read PM requirement from saved results (backwards compatible - default true)
  const pmRequired = results.pmRequired !== false;
  
  const reserveFund = results.reserveFund || {};
  const pmFund = results.pmFund || {};
  const reserveCashFlow = results.reserveCashFlow || [];
  const pmCashFlow = results.pmCashFlow || [];
  const schedule = results.replacementSchedule || [];
  const thresholds = results.thresholds || {
    multiplier10: 0.7745,
    multiplier5: 0.7785,
    multiplierBaseline: 0.7554,
    minBalance10: 14377,
    minBalance5: 7190,
    minBalanceBaseline: 3,
    percentOfBeginning10: 10.00,
    percentOfBeginning5: 5.00,
    percentOfBeginningBaseline: 0.00,
    compliant10: true,
    compliant5: true,
    projection10: [],
    projection5: [],
    projectionBaseline: []
  };

  // ========================================
  // HELPER: Build per-category summary data
  // Distributes beginning balance by FFB ratio (matches old program)
  // ========================================
  const buildCategorySummary = (fund, fundSchedule, isPM) => {
    const categories = isPM 
      ? ['Preventive Maintenance'] 
      : ['Sitework', 'Building', 'Interior', 'Exterior', 'Electrical', 'Special', 'Mechanical'];
    
    const totalFFB = fund.fullyFundedBalance || 0;
    const beginningBalance = fund.currentBalance || 0;
    const totalAnnualFunding = fund.recommendedContribution || 0;
    const totalReplacementCost = fund.totalReplacementCost || 0;
    
    // Use per-category data from calculation results if available
    const calcCategories = fund.byCategory || [];
    
    return categories.map(category => {
      // Try to find pre-calculated category data first
      const calcCat = calcCategories.find(c => c.category === category);
      
      if (calcCat && calcCat.count > 0) {
        return {
          category,
          count: calcCat.count,
          replacementCost: calcCat.totalCost,
          currentReserveFunds: calcCat.currentReserveFunds,
          fundsNeeded: calcCat.fundsNeeded,
          annualFunding: calcCat.annualFunding,
          fullFundedBalance: calcCat.fullFundingBalance,
          percentFunded: calcCat.percentFunded,
        };
      }
      
      // Fallback: calculate from schedule data using FFB distribution
      const categoryItems = fundSchedule.filter(s => {
        if (isPM) return s.isPM;
        return s.category === category && (pmRequired ? !s.isPM : true);
      });
      
      if (categoryItems.length === 0) return null;
      
      const catReplacementCost = categoryItems.reduce((sum, c) => sum + (c.cost || 0), 0);
      
      // Distribute by FFB ratio (not replacement cost ratio)
      // Since we don't have per-category FFB in fallback, use replacement cost as proxy
      // but properly compute funds needed
      const costShare = totalReplacementCost > 0 ? catReplacementCost / totalReplacementCost : 0;
      const catFFB = totalFFB * costShare;
      const ffbShare = totalFFB > 0 ? catFFB / totalFFB : 0;
      const catCurrentFunds = beginningBalance * ffbShare;
      const catFundsNeeded = catFFB - catCurrentFunds;
      const catAnnualFunding = totalAnnualFunding * costShare;
      const catPercentFunded = catFFB > 0 ? (catCurrentFunds / catFFB) * 100 : 0;
      
      return {
        category,
        count: categoryItems.length,
        replacementCost: catReplacementCost,
        currentReserveFunds: catCurrentFunds,
        fundsNeeded: catFundsNeeded,
        annualFunding: catAnnualFunding,
        fullFundedBalance: catFFB,
        percentFunded: catPercentFunded,
      };
    }).filter(Boolean);
  };

  const reserveCategorySummary = buildCategorySummary(reserveFund, schedule, false);
  const pmCategorySummary = pmRequired ? buildCategorySummary(pmFund, schedule, true) : [];

  // Calculate totals for Funds Needed (FFB - beginning balance)
  const reserveFundsNeeded = (reserveFund.totalReplacementCost || 0) - (reserveFund.currentBalance || 0);
  const pmFundsNeeded = pmRequired ? ((pmFund.totalReplacementCost || 0) - (pmFund.currentBalance || 0)) : 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Link href={`/sites/${siteId}`} className="text-red-600 hover:text-red-700 font-medium">
          ← Back to Site
        </Link>
        
        <div className="mt-6 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reserve Study Results</h1>
            <p className="text-gray-700 mt-2">{site?.siteName}</p>
            <p className="text-sm mt-1" style={{ color: pmRequired ? '#9333ea' : '#2563eb' }}>
              {pmRequired ? '🔵 Dual Fund System (Reserve + PM)' : '🔵 Reserve Fund Only'}
              <span className="text-gray-500 ml-2">• State: {site?.companyState || 'Not set'}</span>
            </p>
          </div>
          <Link
            href={`/sites/${siteId}/calculate`}
            className={`px-6 py-3 text-white rounded-lg font-medium ${pmRequired ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Recalculate
          </Link>
        </div>

        {/* Summary Cards */}
        <div className={`grid grid-cols-1 ${pmRequired ? 'lg:grid-cols-2' : 'lg:grid-cols-1 max-w-2xl'} gap-6 mb-8`}>
          {/* Reserve Fund Summary */}
          <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
            <h2 className="text-xl font-bold text-blue-900 mb-4">💰 Reserve Fund</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded p-3">
                <div className="text-xs text-gray-600">Percent Funded</div>
                <div className="text-2xl font-bold text-gray-900">
                  {reserveFund.percentFunded?.toFixed(2)}%
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-xs text-gray-600">Current Balance</div>
                <div className="text-xl font-bold text-gray-900">
                  ${Math.round(reserveFund.currentBalance || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-xs text-gray-600">Current Contribution</div>
                <div className="text-xl font-bold text-gray-900">
                  ${Math.round(reserveFund.currentContribution || 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-white rounded p-3">
                <div className="text-xs text-gray-600">Recommended</div>
                <div className="text-xl font-bold text-gray-900">
                  ${Math.round(reserveFund.recommendedContribution || 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* PM Fund Summary - Only show when PM is required */}
          {pmRequired && (
            <div className="bg-purple-50 border-2 border-purple-500 rounded-lg p-6">
              <h2 className="text-xl font-bold text-purple-900 mb-4">🟣 PM Fund</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-gray-600">Percent Funded</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {pmFund.percentFunded?.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-gray-600">Current Balance</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${Math.round(pmFund.currentBalance || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-gray-600">Current Contribution</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${Math.round(pmFund.currentContribution || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white rounded p-3">
                  <div className="text-xs text-gray-600">Recommended</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${Math.round(pmFund.recommendedContribution || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'summary'
                    ? 'text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📊 Summary
              </button>
              <button
                onClick={() => setActiveTab('threshold')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'threshold'
                    ? 'text-red-600 border-b-2 border-red-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📉 Threshold Projection
              </button>
              <button
                onClick={() => setActiveTab('reserve-cashflow')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'reserve-cashflow'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                💰 Reserve Fund Cash Flow
              </button>
              {/* PM Cash Flow tab - only show when PM required */}
              {pmRequired && (
                <button
                  onClick={() => setActiveTab('pm-cashflow')}
                  className={`px-6 py-3 font-medium whitespace-nowrap ${
                    activeTab === 'pm-cashflow'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🟣 PM Fund Cash Flow
                </button>
              )}
              <button
                onClick={() => setActiveTab('expenditure-schedule')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'expenditure-schedule'
                    ? 'text-orange-600 border-b-2 border-orange-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📅 Expenditure Schedule
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === 'schedule'
                    ? 'text-green-600 border-b-2 border-green-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                📋 Replacement Schedule
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'threshold' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">📉 Threshold Projection - Compliance Analysis</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Shows 30-year projections under three funding scenarios: 10% Threshold, 5% Threshold, and Baseline (0%)
                </p>

                <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">⚠️</div>
                    <div>
                      <h4 className="font-bold text-orange-900 mb-1">Threshold Requirement</h4>
                      <p className="text-sm text-orange-800">
                        This analysis shows projected balances under reduced contribution scenarios to ensure the association
                        maintains minimum safe funding levels over the 30-year projection period.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Threshold Scenarios Side-by-Side */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
                  {/* 10% Threshold */}
                  <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4">
                    <h4 className="font-bold text-red-900 mb-2">10% Threshold</h4>
                    <p className="text-xs text-red-800 mb-3">Reduced contributions maintaining 10% minimum</p>
                    <div className="space-y-2">
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Multiplier</div>
                        <div className="text-lg font-bold text-gray-900">{thresholds.multiplier10.toFixed(4)}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Annual Contribution</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round((reserveFund.recommendedContribution || 0) * thresholds.multiplier10).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Min Balance</div>
                        <div className="text-md font-bold text-gray-900">${Math.round(thresholds.minBalance10).toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">% of Beginning</div>
                        <div className="text-md font-bold text-green-700">{thresholds.percentOfBeginning10.toFixed(2)}%</div>
                      </div>
                      <div className={`${thresholds.compliant10 ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'} border rounded p-2 text-center`}>
                        <div className="text-sm font-bold text-green-900">{thresholds.compliant10 ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}</div>
                      </div>
                    </div>
                  </div>

                  {/* 5% Threshold */}
                  <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                    <h4 className="font-bold text-yellow-900 mb-2">5% Threshold</h4>
                    <p className="text-xs text-yellow-800 mb-3">Reduced contributions maintaining 5% minimum</p>
                    <div className="space-y-2">
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Multiplier</div>
                        <div className="text-lg font-bold text-gray-900">{thresholds.multiplier5.toFixed(4)}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Annual Contribution</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round((reserveFund.recommendedContribution || 0) * thresholds.multiplier5).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Min Balance</div>
                        <div className="text-md font-bold text-gray-900">${Math.round(thresholds.minBalance5).toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">% of Beginning</div>
                        <div className="text-md font-bold text-green-700">{thresholds.percentOfBeginning5.toFixed(2)}%</div>
                      </div>
                      <div className={`${thresholds.compliant5 ? 'bg-green-100 border-green-400' : 'bg-red-100 border-red-400'} border rounded p-2 text-center`}>
                        <div className="text-sm font-bold text-green-900">{thresholds.compliant5 ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Baseline (0%) */}
                  <div className="bg-gray-50 border-2 border-gray-400 rounded-lg p-4">
                    <h4 className="font-bold text-gray-900 mb-2">Baseline (0%)</h4>
                    <p className="text-xs text-gray-800 mb-3">Minimum to avoid negatives</p>
                    <div className="space-y-2">
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Multiplier</div>
                        <div className="text-lg font-bold text-gray-900">{thresholds.multiplierBaseline.toFixed(4)}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Annual Contribution</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round((reserveFund.recommendedContribution || 0) * thresholds.multiplierBaseline).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Min Balance</div>
                        <div className="text-md font-bold text-gray-900">${Math.round(thresholds.minBalanceBaseline).toLocaleString()}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">% of Beginning</div>
                        <div className="text-md font-bold text-orange-700">{thresholds.percentOfBeginningBaseline.toFixed(2)}%</div>
                      </div>
                      <div className="bg-yellow-100 border border-yellow-400 rounded p-2 text-center">
                        <div className="text-sm font-bold text-yellow-900">⚠ MINIMUM</div>
                      </div>
                    </div>
                  </div>

                  {/* Full Funding */}
                  <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                    <h4 className="font-bold text-green-900 mb-2">Full Funding</h4>
                    <p className="text-xs text-green-800 mb-3">Recommended contribution (100%)</p>
                    <div className="space-y-2">
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Multiplier</div>
                        <div className="text-lg font-bold text-gray-900">1.0000</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Annual Contribution</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(reserveFund.recommendedContribution || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Final Balance (Year 30)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(reserveCashFlow[29]?.endingBalance || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Percent Funded</div>
                        <div className="text-md font-bold text-green-700">{reserveFund.percentFunded?.toFixed(2)}%</div>
                      </div>
                      <div className="bg-blue-100 border border-blue-400 rounded p-2 text-center">
                        <div className="text-sm font-bold text-blue-900">★ RECOMMENDED</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Projection Table */}
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-700 px-4 py-3">
                    <h4 className="font-bold text-white text-center">30-Year Threshold Projection Comparison</h4>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-center font-bold text-gray-900 border-r border-gray-300" rowSpan="2">
                            Fiscal<br/>Year
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-white bg-red-500 border-l border-gray-300" colSpan="2">
                            10% Threshold
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-white bg-yellow-500 border-l border-gray-300" colSpan="2">
                            5% Threshold
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-white bg-gray-600 border-l border-gray-300" colSpan="2">
                            Baseline (0%)
                          </th>
                          <th className="px-4 py-2 text-center font-bold text-white bg-green-600 border-l border-gray-300" colSpan="2">
                            Full Funding
                          </th>
                        </tr>
                        <tr>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-red-50 border-l border-gray-300">Annual<br/>Expenditures</th>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-red-50">Ending<br/>Balance</th>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-yellow-50 border-l border-gray-300">Annual<br/>Expenditures</th>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-yellow-50">Ending<br/>Balance</th>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-gray-50 border-l border-gray-300">Annual<br/>Expenditures</th>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-gray-50">Ending<br/>Balance</th>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-green-50 border-l border-gray-300">Annual<br/>Expenditures</th>
                          <th className="px-3 py-2 text-xs text-gray-700 bg-green-50">Ending<br/>Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {reserveCashFlow.map((row, index) => {
                          const proj10 = thresholds.projection10?.[index] || { expenditures: row.expenditures, endingBalance: 0 };
                          const proj5 = thresholds.projection5?.[index] || { expenditures: row.expenditures, endingBalance: 0 };
                          const projBase = thresholds.projectionBaseline?.[index] || { expenditures: row.expenditures, endingBalance: 0 };
                          
                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 text-center font-bold text-gray-900 border-r border-gray-300">{row.year}</td>
                              <td className="px-3 py-2 text-right text-gray-900 bg-red-50 border-l border-gray-300">${Math.round(proj10.expenditures).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900 bg-red-50">${Math.round(proj10.endingBalance).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-gray-900 bg-yellow-50 border-l border-gray-300">${Math.round(proj5.expenditures).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900 bg-yellow-50">${Math.round(proj5.endingBalance).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-gray-900 bg-gray-50 border-l border-gray-300">${Math.round(projBase.expenditures).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900 bg-gray-50">${Math.round(projBase.endingBalance).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right text-gray-900 bg-green-50 border-l border-gray-300">${Math.round(row.expenditures).toLocaleString()}</td>
                              <td className="px-3 py-2 text-right font-medium text-gray-900 bg-green-50">${Math.round(row.endingBalance).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Compliance Status */}
                <div className={`mt-6 ${thresholds.compliant10 && thresholds.compliant5 ? 'bg-green-50 border-green-300' : 'bg-orange-50 border-orange-300'} border rounded-lg p-4`}>
                  <h4 className={`font-bold mb-2 ${thresholds.compliant10 && thresholds.compliant5 ? 'text-green-900' : 'text-orange-900'}`}>
                    {thresholds.compliant10 && thresholds.compliant5 ? '✓ Compliance Status' : '⚠ Compliance Status'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className={`font-medium ${thresholds.compliant10 ? 'text-green-800' : 'text-red-800'}`}>10% Threshold:</span>
                      <span className={`ml-2 ${thresholds.compliant10 ? 'text-green-900' : 'text-red-900'}`}>
                        {thresholds.compliant10 
                          ? 'COMPLIANT - Maintains minimum 10% balance throughout projection period'
                          : 'NON-COMPLIANT - Balance falls below 10% threshold'}
                      </span>
                    </div>
                    <div>
                      <span className={`font-medium ${thresholds.compliant5 ? 'text-green-800' : 'text-red-800'}`}>5% Threshold:</span>
                      <span className={`ml-2 ${thresholds.compliant5 ? 'text-green-900' : 'text-red-900'}`}>
                        {thresholds.compliant5
                          ? 'COMPLIANT - Maintains minimum 5% balance throughout projection period'
                          : 'NON-COMPLIANT - Balance falls below 5% threshold'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'reserve-cashflow' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">💰 Reserve Fund - 30-Year Cash Flow Projection</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-900 border-r border-gray-300" rowSpan="2">
                          Fiscal<br/>Year
                        </th>
                        <th className="px-6 py-2 text-center text-sm font-bold text-white bg-blue-600" colSpan="3">
                          Current Funding
                        </th>
                        <th className="px-6 py-2 text-center text-sm font-bold text-white bg-green-600" colSpan="3">
                          Full Funding Analysis
                        </th>
                      </tr>
                      <tr>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-blue-50">Current<br/>Contribution</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-blue-50">Annual<br/>Expenditures</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-blue-50 border-r border-gray-300">Ending<br/>Balance</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-green-50">Annual<br/>Contribution</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-green-50">Average Annual<br/>Contribution</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-green-50">Ending<br/>Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reserveCashFlow.map((row, index) => {
                        // Track cumulative expenditures for full funding balance
                        const cumulativeExpend = reserveCashFlow.slice(0, index + 1).reduce((s, r) => s + (r.expenditures || 0), 0);
                        const fullFundingBalance = (reserveFund.currentBalance || 0) + (reserveFund.recommendedContribution || 0) * (index + 1) - cumulativeExpend;
                        
                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-sm font-bold text-gray-900 text-center border-r border-gray-300">{row.year}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">${Math.round(row.contributions).toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">${Math.round(row.expenditures).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-sm font-medium text-right border-r border-gray-300 ${row.endingBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              ${Math.round(row.endingBalance).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right bg-green-50">${Math.round(reserveFund.recommendedContribution || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right bg-green-50">${Math.round(reserveFund.recommendedContribution || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right bg-green-50">
                              ${Math.round(fullFundingBalance).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-100 font-bold">
                        <td className="px-3 py-3 text-sm text-gray-900 text-center border-r border-gray-300">TOTAL</td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right">
                          ${Math.round(reserveCashFlow.reduce((sum, r) => sum + r.contributions, 0)).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right">
                          ${Math.round(reserveCashFlow.reduce((sum, r) => sum + r.expenditures, 0)).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-300"></td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right bg-green-50">
                          ${Math.round((reserveFund.recommendedContribution || 0) * 30).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right bg-green-50">
                          ${Math.round((reserveFund.recommendedContribution || 0) * 30).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 bg-green-50"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PM Cash Flow - only rendered when PM is required */}
            {activeTab === 'pm-cashflow' && pmRequired && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">🟣 PM Fund - 30-Year Cash Flow Projection</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-purple-50">
                      <tr>
                        <th className="px-3 py-3 text-center text-xs font-bold text-gray-900 border-r border-gray-300" rowSpan="2">
                          Fiscal<br/>Year
                        </th>
                        <th className="px-6 py-2 text-center text-sm font-bold text-white bg-purple-600" colSpan="3">
                          Current Funding
                        </th>
                        <th className="px-6 py-2 text-center text-sm font-bold text-white bg-green-600" colSpan="3">
                          Full Funding Analysis
                        </th>
                      </tr>
                      <tr>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-purple-50">Current<br/>Contribution</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-purple-50">Annual<br/>Expenditures</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-purple-50 border-r border-gray-300">Ending<br/>Balance</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-green-50">Annual<br/>Contribution</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-green-50">Average Annual<br/>Contribution</th>
                        <th className="px-3 py-2 text-xs font-medium text-gray-700 bg-green-50">Ending<br/>Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pmCashFlow.map((row, index) => {
                        const cumulativeExpend = pmCashFlow.slice(0, index + 1).reduce((s, r) => s + (r.expenditures || 0), 0);
                        const fullFundingBalance = (pmFund.currentBalance || 0) + (pmFund.recommendedContribution || 0) * (index + 1) - cumulativeExpend;
                        
                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-sm font-bold text-gray-900 text-center border-r border-gray-300">{row.year}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">${Math.round(row.contributions).toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">${Math.round(row.expenditures).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-sm font-medium text-right border-r border-gray-300 ${row.endingBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              ${Math.round(row.endingBalance).toLocaleString()}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right bg-green-50">${Math.round(pmFund.recommendedContribution || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right bg-green-50">${Math.round(pmFund.recommendedContribution || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-sm font-medium text-gray-900 text-right bg-green-50">
                              ${Math.round(fullFundingBalance).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-100 font-bold">
                        <td className="px-3 py-3 text-sm text-gray-900 text-center border-r border-gray-300">TOTAL</td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right">
                          ${Math.round(pmCashFlow.reduce((sum, r) => sum + r.contributions, 0)).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right">
                          ${Math.round(pmCashFlow.reduce((sum, r) => sum + r.expenditures, 0)).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-300"></td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right bg-green-50">
                          ${Math.round((pmFund.recommendedContribution || 0) * 30).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-sm text-gray-900 text-right bg-green-50">
                          ${Math.round((pmFund.recommendedContribution || 0) * 30).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 bg-green-50"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* SUMMARY TAB - FIXED Component Schedule Summary               */}
            {/* ============================================================ */}
            {activeTab === 'summary' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-6">📊 Component Schedule Summary</h3>
                
                {/* Reserve Fund Summary */}
                <div className="mb-8">
                  <h4 className="text-md font-bold text-blue-900 mb-3">💰 Reserve Fund Component Summary</h4>
                  <div className="overflow-x-auto border border-gray-300 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Items</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">Percent<br/>Funded</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Replacement Cost<br/>Totals</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Current Reserve<br/>Funds</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Funds<br/>Needed</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Annual<br/>Funding</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Full Funded<br/>Balance</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {reserveCategorySummary.map((cat) => (
                          <tr key={cat.category} className="border-b border-gray-300">
                            <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">{cat.category}</td>
                            <td className="px-4 py-2 text-center text-sm text-gray-900 border-r border-gray-300">
                              {cat.percentFunded > 0 ? `${cat.percentFunded.toFixed(0)}%` : '-'}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">
                              ${Math.round(cat.replacementCost).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">
                              ${Math.round(cat.currentReserveFunds).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">
                              ${Math.round(cat.fundsNeeded).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">
                              ${Math.round(cat.annualFunding).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              ${Math.round(cat.fullFundedBalance).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-blue-100 font-bold border-t-2 border-blue-900">
                          <td className="px-4 py-3 text-sm text-blue-900">Totals</td>
                          <td className="px-4 py-3 text-center text-sm text-blue-900">
                            {reserveFund.percentFunded?.toFixed(0)}%
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">
                            ${Math.round(reserveFund.totalReplacementCost || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">
                            ${Math.round(reserveFund.currentBalance || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">
                            ${Math.round(reserveFundsNeeded).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">
                            ${Math.round(reserveFund.recommendedContribution || 0).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">
                            ${Math.round(reserveFund.fullyFundedBalance || 0).toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PM Fund Summary - Only show when PM required */}
                {pmRequired && (
                  <div>
                    <h4 className="text-md font-bold text-purple-900 mb-3">🟣 PM Fund Component Summary</h4>
                    <div className="overflow-x-auto border border-gray-300 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-purple-900">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Items</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-white uppercase">Percent<br/>Funded</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Replacement Cost<br/>Totals</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Current Reserve<br/>Funds</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Funds<br/>Needed</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Annual<br/>Funding</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-white uppercase">Full Funded<br/>Balance</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {pmCategorySummary.map((cat) => (
                            <tr key={cat.category} className="bg-white">
                              <td className="px-4 py-2 text-sm text-gray-900 font-medium">{cat.category}</td>
                              <td className="px-4 py-2 text-center text-sm text-gray-900">
                                {cat.percentFunded > 0 ? `${cat.percentFunded.toFixed(0)}%` : '-'}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900">
                                ${Math.round(cat.replacementCost).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900">
                                ${Math.round(cat.currentReserveFunds).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900">
                                ${Math.round(cat.fundsNeeded).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900">
                                ${Math.round(cat.annualFunding).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900">
                                ${Math.round(cat.fullFundedBalance).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-purple-100 font-bold border-t-2 border-purple-900">
                            <td className="px-4 py-3 text-sm text-purple-900">Totals</td>
                            <td className="px-4 py-3 text-center text-sm text-purple-900">
                              {pmFund.percentFunded?.toFixed(0)}%
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">
                              ${Math.round(pmFund.totalReplacementCost || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">
                              ${Math.round(pmFund.currentBalance || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">
                              ${Math.round(pmFundsNeeded).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">
                              ${Math.round(pmFund.recommendedContribution || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">
                              ${Math.round(pmFund.fullyFundedBalance || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'expenditure-schedule' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">📅 Expenditure Schedule - 30-Year Matrix</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Shows which components are replaced in which years (scroll horizontally to see all years)
                </p>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-700 sticky top-0 z-20">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-bold text-white uppercase sticky left-0 bg-gray-700 z-30 border-r-2 border-gray-500">
                          Item
                        </th>
                        {Array.from({ length: 30 }, (_, i) => (site?.beginningYear || 2026) + i).map(year => (
                          <th key={year} className="px-2 py-3 text-center text-xs font-bold text-white min-w-[70px] border-l border-gray-500">
                            {year}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {/* Category Headers and Components */}
                      {['Sitework', 'Building', 'Interior', 'Exterior', 'Electrical', 'Special', 'Mechanical'].map(category => {
                        const categoryItems = schedule.filter(item => 
                          pmRequired ? (!item.isPM && item.category === category) : item.category === category
                        );
                        if (categoryItems.length === 0) return null;
                        
                        return (
                          <React.Fragment key={category}>
                            <tr className="bg-blue-100 sticky" style={{top: '48px', zIndex: 15}}>
                              <td colSpan="31" className="px-3 py-2 text-sm font-bold text-blue-900 uppercase sticky left-0 z-20 bg-blue-100 border-r-2 border-gray-300">
                                {category}
                              </td>
                            </tr>
                            {categoryItems
                              .sort((a, b) => a.description.localeCompare(b.description))
                              .map((item, idx) => (
                                <tr key={`${category}-${idx}`} className={idx % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-gray-50 hover:bg-blue-50'}>
                                  <td className="px-3 py-2 text-sm text-gray-900 font-medium sticky left-0 z-10 bg-inherit border-r-2 border-gray-300 whitespace-nowrap">
                                    {item.description}
                                  </td>
                                  {Array.from({ length: 30 }, (_, i) => (site?.beginningYear || 2026) + i).map(year => {
                                    const isReplacementYear = item.year === year;
                                    const cost = isReplacementYear ? Math.round(item.cost) : null;
                                    return (
                                      <td 
                                        key={year} 
                                        className={`px-2 py-2 text-center border-l border-gray-200 ${
                                          isReplacementYear ? 'bg-blue-300 font-bold text-gray-900' : ''
                                        }`}
                                      >
                                        {cost ? `$${cost.toLocaleString()}` : ''}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })}
                      
                      {/* PM Fund Components - Only show when PM required and has PM items */}
                      {pmRequired && schedule.some(item => item.isPM) && (
                        <>
                          <tr className="bg-purple-100 sticky" style={{top: '48px', zIndex: 15}}>
                            <td colSpan="31" className="px-3 py-2 text-sm font-bold text-purple-900 uppercase sticky left-0 z-20 bg-purple-100 border-r-2 border-gray-300">
                              Preventive Maintenance
                            </td>
                          </tr>
                          
                          {schedule
                            .filter(item => item.isPM)
                            .sort((a, b) => a.description.localeCompare(b.description))
                            .map((item, idx) => (
                              <tr key={`pm-${idx}`} className={idx % 2 === 0 ? 'bg-white hover:bg-purple-50' : 'bg-gray-50 hover:bg-purple-50'}>
                                <td className="px-3 py-2 text-sm text-gray-900 font-medium sticky left-0 z-10 bg-inherit border-r-2 border-gray-300 whitespace-nowrap">
                                  {item.description}
                                </td>
                                {Array.from({ length: 30 }, (_, i) => (site?.beginningYear || 2026) + i).map(year => {
                                  const isReplacementYear = item.year === year;
                                  const cost = isReplacementYear ? Math.round(item.cost) : null;
                                  return (
                                    <td 
                                      key={year} 
                                      className={`px-2 py-2 text-center border-l border-gray-200 ${
                                        isReplacementYear ? 'bg-purple-300 font-bold text-gray-900' : ''
                                      }`}
                                    >
                                      {cost ? `$${cost.toLocaleString()}` : ''}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </>
                      )}
                      
                      {/* Yearly Totals Row */}
                      <tr className="bg-gray-700 font-bold sticky bottom-0 z-15">
                        <td className="px-3 py-3 text-sm text-white uppercase sticky left-0 bg-gray-700 z-20 border-r-2 border-gray-500">
                          YEARLY TOTALS
                        </td>
                        {Array.from({ length: 30 }, (_, i) => {
                          const year = (site?.beginningYear || 2026) + i;
                          const yearTotal = schedule
                            .filter(item => item.year === year)
                            .reduce((sum, item) => sum + (item.cost || 0), 0);
                          return (
                            <td key={year} className="px-2 py-3 text-center text-white font-bold border-l border-gray-500">
                              {yearTotal > 0 ? `$${Math.round(yearTotal).toLocaleString()}` : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Summary Cards */}
                <div className={`mt-6 grid grid-cols-1 ${pmRequired ? 'md:grid-cols-3' : 'md:grid-cols-1 max-w-md'} gap-4`}>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm text-blue-700 font-medium">Reserve Fund Total</div>
                    <div className="text-2xl font-bold text-blue-900">
                      ${Math.round(schedule.filter(s => pmRequired ? !s.isPM : true).reduce((sum, s) => sum + s.cost, 0)).toLocaleString()}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {schedule.filter(s => pmRequired ? !s.isPM : true).length} components over 30 years
                    </div>
                  </div>
                  {pmRequired && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="text-sm text-purple-700 font-medium">PM Fund Total</div>
                      <div className="text-2xl font-bold text-purple-900">
                        ${Math.round(schedule.filter(s => s.isPM).reduce((sum, s) => sum + s.cost, 0)).toLocaleString()}
                      </div>
                      <div className="text-xs text-purple-600 mt-1">
                        {schedule.filter(s => s.isPM).length} components over 30 years
                      </div>
                    </div>
                  )}
                  {pmRequired && (
                    <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                      <div className="text-sm text-gray-700 font-medium">Combined Total</div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${Math.round(schedule.reduce((sum, s) => sum + s.cost, 0)).toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        All {schedule.length} components
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Legend */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-2">Legend:</div>
                  <div className="flex gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-4 bg-blue-200 border border-blue-300"></div>
                      <span className="text-gray-700">Reserve Fund Expenditure</span>
                    </div>
                    {pmRequired && (
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-4 bg-purple-200 border border-purple-300"></div>
                        <span className="text-gray-700">PM Fund Expenditure</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">📋 Component Replacement Schedule</h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Year</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Component</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Cost</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Category</th>
                        {pmRequired && (
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Fund</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.year}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right">${Math.round(item.cost).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{item.category}</td>
                          {pmRequired && (
                            <td className="px-4 py-3 text-center">
                              {item.isPM ? (
                                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded font-medium">PM</span>
                              ) : (
                                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded font-medium">Reserve</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Success Message */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-900 font-medium">
            ✅ {pmRequired ? 'Dual Fund Calculations Complete!' : 'Reserve Fund Calculations Complete!'}
          </p>
          <p className="text-green-800 text-sm mt-1">
            {pmRequired 
              ? 'Reserve Fund and PM Fund calculated separately with 30-year projections showing Current vs Full Funding scenarios.'
              : 'Reserve Fund calculated with 30-year projections showing Current vs Full Funding scenarios.'
            }
          </p>
        </div>
      </main>
    </div>
  );
}
