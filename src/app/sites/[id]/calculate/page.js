// src/app/sites/[id]/results/page.js
// CONDITIONAL DUAL FUND RESULTS PAGE - Shows PM only when required by state
// v23: Fixes Threshold Cards UI
//      1. Adds "Final Balance (Year 30)" to 10%, 5%, and Baseline cards for consistent comparison.
//      2. Ensures "Annual Funding" totals in Summary tab sum the column correctly.

'use client';

// FIX: Import Fragment directly to avoid "React is not defined" errors
import { useEffect, useState, Fragment } from 'react';
import { auth } from '@/lib/firebase';
import { getSite, getProjections } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ResultsPage() {
  const [site, setSite] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary'); // Default to summary
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
  const reserveCashFlow = results.cashFlow || results.reserveCashFlow || [];
  const pmCashFlow = results.pmCashFlow || [];
  const schedule = results.replacementSchedule || [];
  
  // Full Funding cash flow data from calculations engine (v5+)
  const fullFundingCashFlow = results.fullFundingCashFlow || [];
  const averageAnnualContribution = results.averageAnnualContribution || 0;
  
  const thresholds = results.thresholds || {
    multiplier10: 0,
    multiplier5: 0,
    multiplierBaseline: 0,
    minBalance10: 0,
    minBalance5: 0,
    minBalanceBaseline: 0,
    percentOfBeginning10: 0,
    percentOfBeginning5: 0,
    percentOfBeginningBaseline: 0,
    compliant10: true,
    compliant5: true,
    projection10: [],
    projection5: [],
    projectionBaseline: []
  };

  // ========================================
  // HELPER: Build per-category summary data
  // Distributes beginning balance by FFB ratio
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
                        <div className="text-lg font-bold text-gray-900">{thresholds.multiplier10?.toFixed(4)}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Annual Contribution (Yr 1)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(thresholds.contribution10 || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Min Balance (Low Point)</div>
                        <div className="text-md font-bold text-gray-900">${Math.round(thresholds.minBalance10 || 0).toLocaleString()}</div>
                      </div>
                      {/* FIX: ADD FINAL BALANCE YEAR 30 TO ALL CARDS */}
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Final Balance (Year 30)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(thresholds.projection10?.[29]?.endingBalance || 0).toLocaleString()}
                        </div>
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
                        <div className="text-lg font-bold text-gray-900">{thresholds.multiplier5?.toFixed(4)}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Annual Contribution (Yr 1)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(thresholds.contribution5 || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Min Balance (Low Point)</div>
                        <div className="text-md font-bold text-gray-900">${Math.round(thresholds.minBalance5 || 0).toLocaleString()}</div>
                      </div>
                      {/* FIX: ADD FINAL BALANCE YEAR 30 */}
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Final Balance (Year 30)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(thresholds.projection5?.[29]?.endingBalance || 0).toLocaleString()}
                        </div>
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
                        <div className="text-lg font-bold text-gray-900">{thresholds.multiplierBaseline?.toFixed(4)}</div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Annual Contribution (Yr 1)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(thresholds.contributionBaseline || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Min Balance (Low Point)</div>
                        <div className="text-md font-bold text-gray-900">${Math.round(thresholds.minBalanceBaseline || 0).toLocaleString()}</div>
                      </div>
                      {/* FIX: ADD FINAL BALANCE YEAR 30 */}
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Final Balance (Year 30)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(thresholds.projectionBaseline?.[29]?.endingBalance || 0).toLocaleString()}
                        </div>
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
                        <div className="text-xs text-gray-600">Annual Contribution (Yr 1)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(reserveFund.recommendedContribution || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Min Balance (Low Point)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(Math.min(...(reserveCashFlow.map(r => r.endingBalance) || [0]))).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white rounded p-2">
                        <div className="text-xs text-gray-600">Final Balance (Year 30)</div>
                        <div className="text-md font-bold text-gray-900">
                          ${Math.round(fullFundingCashFlow[29]?.endingBalance || reserveCashFlow[29]?.endingBalance || 0).toLocaleString()}
                        </div>
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
                          // Use fullFundingCashFlow if available, fallback to current funding row
                          const ffRow = fullFundingCashFlow[index] || { expenditures: row.expenditures, endingBalance: row.endingBalance };
                          
                          return (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 text-center font-bold text-gray-900 border-r border-gray-300">{row.year}</td>
                              <td className="px-3 py-2 text-right text-gray-900 bg-red-50
