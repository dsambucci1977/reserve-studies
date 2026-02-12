// src/app/sites/[id]/results/page.js
// CONDITIONAL DUAL FUND RESULTS PAGE
// v34: Restored Threshold Projection cards + Reserve Cash Flow to match original designs
//      1. Threshold tab: 4 detailed cards with Multiplier, Contribution, Min Balance, % of Beginning
//         Status badges: COMPLIANT, MINIMUM, RECOMMENDED
//         Warning box + description text
//      2. Reserve Cash Flow: Green "Current Funding" / Red "Full Funding Analysis" headers
//         Columns: Current Contribution, Annual Expenditures, Ending Balance |
//                  Annual Contribution, Average Annual Contribution, Ending Balance

'use client';

import { useEffect, useState, Fragment } from 'react';
import { auth } from '@/lib/firebase';
import { getSite, getProjections } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function ResultsPage() {
  const [site, setSite] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary');
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
        <main className="w-full px-6 py-8">
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

  const pmRequired = results.pmRequired !== false;
  
  const reserveFund = results.reserveFund || {};
  const pmFund = results.pmFund || {};
  
  // Project Settings (saved from calculate page)
  const projectSettings = results.projectSettings || {};
  const inflationRate = projectSettings.inflationRate || 0;
  const interestRate = projectSettings.interestRate || 0;
  const costAdjustmentFactor = projectSettings.costAdjustmentFactor || 1.0;
  const beginningYear = projectSettings.beginningYear || site?.beginningYear || new Date().getFullYear();
  
  // Build cost adjustment note based on what's actually set
  const hasCAF = costAdjustmentFactor !== 1.0;
  const hasInflation = inflationRate > 0;
  const hasCostAdjustments = hasCAF || hasInflation;
  const costNoteText = hasCAF && hasInflation
    ? `Cost Adjustment Factor of ${costAdjustmentFactor.toFixed(2)} applied + ${(inflationRate * 100).toFixed(2)}% annual inflation`
    : hasCAF
    ? `Cost Adjustment Factor (GF) of ${costAdjustmentFactor.toFixed(2)} applied to all replacement costs`
    : hasInflation
    ? `${(inflationRate * 100).toFixed(2)}% annual inflation applied`
    : '';
  
  // Data Sources
  const reserveCashFlow = results.cashFlow || results.reserveCashFlow || [];
  const reserveFullFundingCashFlow = results.fullFundingCashFlow || [];
  const averageAnnualContribution = results.averageAnnualContribution || reserveFund.recommendedContribution || 0;
  
  const pmCashFlow = results.pmCashFlow || [];
  const pmFullFundingCashFlow = results.pmFullFundingCashFlow || [];
  
  const schedule = results.replacementSchedule || [];

  // SEPARATE EXPENDITURE SCHEDULES
  const reserveExpenditures = pmRequired 
    ? schedule.filter(item => !item.isPM) 
    : schedule;
    
  const pmExpenditures = pmRequired 
    ? schedule.filter(item => item.isPM)
    : [];

  const thresholds = results.thresholds || {
    multiplier10: 0, multiplier5: 0, multiplierBaseline: 0, multiplierFull: 0,
    contribution10: 0, contribution5: 0, contributionBaseline: 0, contributionFull: 0,
    minBalance10: 0, minBalance5: 0, minBalanceBaseline: 0, minBalanceFull: 0,
    compliant10: true, compliant5: true,
    percentOfBeginning10: 0, percentOfBeginning5: 0, percentOfBeginningBaseline: 0,
    projection10: [], projection5: [], projectionBaseline: [], projectionFull: []
  };

  const buildCategorySummary = (fund, fundSchedule, isPM) => {
    const categories = isPM 
      ? ['Preventive Maintenance'] 
      : ['Sitework', 'Building', 'Interior', 'Exterior', 'Electrical', 'Special', 'Mechanical'];
    
    const totalFFB = fund.fullyFundedBalance || 0;
    const beginningBalance = fund.currentBalance || 0;
    const totalAnnualFunding = fund.recommendedContribution || 0;
    const totalReplacementCost = fund.totalReplacementCost || 0;
    
    const calcCategories = fund.byCategory || [];
    
    return categories.map(category => {
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

  // Helper: compute percent funded for Full Funding card
  const fullFundingFinalBalance = thresholds.projectionFull?.[29]?.endingBalance ?? (reserveFullFundingCashFlow[29]?.endingBalance ?? 0);
  const totalExpected30yr = reserveCashFlow.reduce((sum, r) => sum + (r.expenditures || 0), 0);
  const percentFundedFull = totalExpected30yr > 0 
    ? ((averageAnnualContribution * 30) / totalExpected30yr * 100).toFixed(2) 
    : (reserveFund.percentFunded?.toFixed(2) || '0.00');

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="w-full px-6 py-8">
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

        {/* Project Settings Bar */}
        <div className="bg-gray-100 border border-gray-300 rounded-lg px-6 py-3 mb-6 flex flex-wrap items-center gap-6">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Study Parameters:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500">Beginning Year</span>
            <span className="text-sm font-semibold text-gray-900">{beginningYear}</span>
          </div>
          {inflationRate > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Inflation Rate</span>
              <span className="text-sm font-semibold text-gray-900">{(inflationRate * 100).toFixed(2)}%</span>
            </div>
          )}
          {interestRate > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Interest Rate</span>
              <span className="text-sm font-semibold text-gray-900">{(interestRate * 100).toFixed(2)}%</span>
            </div>
          )}
          {costAdjustmentFactor !== 1.0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500">Cost Adj. Factor (GF)</span>
              <span className="text-sm font-semibold text-amber-700">{costAdjustmentFactor.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex overflow-x-auto">
              {[
                'summary', 
                'threshold', 
                'reserve-cashflow', 
                ...(pmRequired ? ['pm-cashflow'] : []), 
                'reserve-expenditures', 
                ...(pmRequired ? ['pm-expenditures'] : []), 
                'schedule'
              ].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 font-medium whitespace-nowrap ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {{
                    'summary': 'Summary',
                    'threshold': 'Threshold',
                    'reserve-cashflow': 'Reserve Cashflow',
                    'pm-cashflow': 'PM Cashflow',
                    'reserve-expenditures': 'Reserve Expenditures',
                    'pm-expenditures': 'PM Expenditures',
                    'schedule': 'Schedule'
                  }[tab]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* SUMMARY TAB */}
            {activeTab === 'summary' && (
              <div>
                <div className="mb-8">
                  <h4 className="text-md font-bold text-blue-900 mb-3">💰 Reserve Fund Component Summary</h4>
                  <div className="overflow-x-auto border border-gray-300 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-900">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-white uppercase">Category</th>
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
                            <td className="px-4 py-2 text-center text-sm text-gray-900 border-r border-gray-300">{cat.percentFunded > 0 ? `${cat.percentFunded.toFixed(0)}%` : '-'}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.replacementCost).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.currentReserveFunds).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.fundsNeeded).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.annualFunding).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(cat.fullFundedBalance).toLocaleString()}</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-100 font-bold border-t-2 border-blue-900">
                          <td className="px-4 py-3 text-sm text-blue-900">Totals</td>
                          <td className="px-4 py-3 text-center text-sm text-blue-900">{reserveFund.percentFunded?.toFixed(0)}%</td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">${Math.round(reserveFund.totalReplacementCost || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">${Math.round(reserveFund.currentBalance || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">${Math.round(reserveCategorySummary.reduce((sum, cat) => sum + cat.fundsNeeded, 0)).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">${Math.round(reserveCategorySummary.reduce((sum, cat) => sum + cat.annualFunding, 0)).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-sm text-blue-900">${Math.round(reserveFund.fullyFundedBalance || 0).toLocaleString()}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {pmRequired && (
                  <div className="mb-8">
                    <h4 className="text-md font-bold text-purple-900 mb-3">🟣 PM Fund Component Summary</h4>
                    <div className="overflow-x-auto border border-gray-300 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead style={{ backgroundColor: '#6e11b0' }}>
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
                            <tr key={cat.category} className="border-b border-gray-300">
                              <td className="px-4 py-2 text-sm text-gray-900 border-r border-gray-300">{cat.category}</td>
                              <td className="px-4 py-2 text-center text-sm text-gray-900 border-r border-gray-300">{cat.percentFunded > 0 ? `${cat.percentFunded.toFixed(0)}%` : '-'}</td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.replacementCost).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.currentReserveFunds).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.fundsNeeded).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900 border-r border-gray-300">${Math.round(cat.annualFunding).toLocaleString()}</td>
                              <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(cat.fullFundedBalance).toLocaleString()}</td>
                            </tr>
                          ))}
                          <tr className="bg-purple-100 font-bold border-t-2 border-purple-900">
                            <td className="px-4 py-3 text-sm text-purple-900">Totals</td>
                            <td className="px-4 py-3 text-center text-sm text-purple-900">{pmFund.percentFunded?.toFixed(0)}%</td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">${Math.round(pmFund.totalReplacementCost || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">${Math.round(pmFund.currentBalance || 0).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">${Math.round(pmCategorySummary.reduce((sum, cat) => sum + cat.fundsNeeded, 0)).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">${Math.round(pmCategorySummary.reduce((sum, cat) => sum + cat.annualFunding, 0)).toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-sm text-purple-900">${Math.round(pmFund.fullyFundedBalance || 0).toLocaleString()}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* THRESHOLD PROJECTION TAB - RESTORED ORIGINAL CARD DESIGN     */}
            {/* ============================================================ */}
            {activeTab === 'threshold' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">📊 Threshold Projection - Compliance Analysis</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Shows 30-year projections under three funding scenarios: 10% Threshold, 5% Threshold, and Baseline (0%).
                </p>

                {/* Warning Box */}
                <div className="border-2 border-yellow-400 bg-yellow-50 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-600 text-lg">⚠️</span>
                    <div>
                      <div className="font-bold text-yellow-800">Threshold Requirement</div>
                      <p className="text-sm text-yellow-700 italic">
                        This analysis shows projected balances under reduced contribution scenarios to ensure the association maintains minimum safe funding levels over the 30-year projection period.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4 Threshold Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  
                  {/* 10% Threshold Card */}
                  <div className="border-2 border-red-400 rounded-lg overflow-hidden bg-white">
                    <div className="px-4 py-3" style={{ backgroundColor: '#dc2626' }}>
                      <h4 className="font-bold text-white text-sm">10% Threshold</h4>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-xs text-gray-500">Multiplier</div>
                        <div className="text-2xl font-bold text-gray-900">{(thresholds.multiplier10 || 0).toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Annual Contribution (Yr 1)</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.contribution10 || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Min Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.minBalance10 || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Final Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.projection10?.[29]?.endingBalance || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* 5% Threshold Card */}
                  <div className="border-2 border-yellow-400 rounded-lg overflow-hidden bg-white">
                    <div className="px-4 py-3" style={{ backgroundColor: '#eab308' }}>
                      <h4 className="font-bold text-white text-sm">5% Threshold</h4>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-xs text-gray-500">Multiplier</div>
                        <div className="text-2xl font-bold text-gray-900">{(thresholds.multiplier5 || 0).toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Annual Contribution (Yr 1)</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.contribution5 || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Min Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.minBalance5 || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Final Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.projection5?.[29]?.endingBalance || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Baseline (0%) Card */}
                  <div className="border-2 border-gray-400 rounded-lg overflow-hidden bg-white">
                    <div className="bg-gray-100 px-4 py-3">
                      <h4 className="font-bold text-gray-900 text-sm">Baseline (0%)</h4>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-xs text-gray-500">Multiplier</div>
                        <div className="text-2xl font-bold text-gray-900">{(thresholds.multiplierBaseline || 0).toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Annual Contribution (Yr 1)</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.contributionBaseline || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Min Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.minBalanceBaseline || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Final Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.projectionBaseline?.[29]?.endingBalance || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* Full Funding Card */}
                  <div className="border-2 border-green-500 rounded-lg overflow-hidden bg-white">
                    <div className="px-4 py-3" style={{ backgroundColor: '#16a34a' }}>
                      <h4 className="font-bold text-white text-sm">Full Funding</h4>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <div className="text-xs text-gray-500">Multiplier</div>
                        <div className="text-2xl font-bold text-gray-900">{(thresholds.multiplierFull || 1).toFixed(4)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Annual Contribution (Yr 1)</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.contributionFull || reserveFund.recommendedContribution || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Min Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(thresholds.minBalanceFull || 0).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Final Balance</div>
                        <div className="text-lg font-bold text-gray-900">${Math.round(fullFundingFinalBalance).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 30-Year Threshold Projection Comparison Table */}
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                  <div className="bg-gray-700 px-4 py-3 flex items-center justify-between">
                    <div></div>
                    <h4 className="font-bold text-white text-center">30-Year Threshold Projection Comparison</h4>
                    <button
                      onClick={() => {
                        let csv = 'Fiscal Year,10% Expenditures,10% Ending Balance,5% Expenditures,5% Ending Balance,Baseline Expenditures,Baseline Ending Balance,Full Funding Expenditures,Full Funding Ending Balance\n';
                        reserveCashFlow.forEach((row, index) => {
                          const p10 = thresholds.projection10?.[index] || {};
                          const p5 = thresholds.projection5?.[index] || {};
                          const pB = thresholds.projectionBaseline?.[index] || {};
                          const pF = thresholds.projectionFull?.[index] || reserveFullFundingCashFlow[index] || {};
                          csv += `${row.year},${Math.round(p10.expenditures||0)},${Math.round(p10.endingBalance||0)},${Math.round(p5.expenditures||0)},${Math.round(p5.endingBalance||0)},${Math.round(pB.expenditures||0)},${Math.round(pB.endingBalance||0)},${Math.round(pF.expenditures||0)},${Math.round(pF.endingBalance||0)}\n`;
                        });
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'threshold_projection_comparison.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-1 bg-white text-gray-700 text-xs font-medium rounded hover:bg-gray-100 border border-gray-300"
                    >
                      ⬇ Download CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-center font-bold text-gray-900 border-r border-gray-300" rowSpan="2">Fiscal<br/>Year</th>
                          <th className="px-4 py-2 text-center font-bold text-white border-l border-gray-300" colSpan="2" style={{ backgroundColor: '#dc2626' }}>10% Threshold</th>
                          <th className="px-4 py-2 text-center font-bold text-white border-l border-gray-300" colSpan="2" style={{ backgroundColor: '#eab308' }}>5% Threshold</th>
                          <th className="px-4 py-2 text-center font-bold text-white border-l border-gray-300" colSpan="2" style={{ backgroundColor: '#6b7280' }}>Baseline (0%)</th>
                          <th className="px-4 py-2 text-center font-bold text-white border-l border-gray-300" colSpan="2" style={{ backgroundColor: '#22c55e' }}>Full Funding</th>
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
                          const projFull = thresholds.projectionFull?.[index] || reserveFullFundingCashFlow[index] || { expenditures: row.expenditures, endingBalance: 0 };
                          return (
                            <tr key={row.year} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 text-center font-bold text-gray-900 border-r border-gray-300">{row.year}</td>
                              {/* 10% */}
                              <td className="px-3 py-2 text-right text-gray-900 bg-red-50/50 border-l border-gray-300">${Math.round(proj10.expenditures || 0).toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right font-medium bg-red-50/50 ${(proj10.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>${Math.round(proj10.endingBalance || 0).toLocaleString()}</td>
                              {/* 5% */}
                              <td className="px-3 py-2 text-right text-gray-900 bg-yellow-50/50 border-l border-gray-300">${Math.round(proj5.expenditures || 0).toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right font-medium bg-yellow-50/50 ${(proj5.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>${Math.round(proj5.endingBalance || 0).toLocaleString()}</td>
                              {/* Baseline */}
                              <td className="px-3 py-2 text-right text-gray-900 border-l border-gray-300">${Math.round(projBase.expenditures || 0).toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right font-medium ${(projBase.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>${Math.round(projBase.endingBalance || 0).toLocaleString()}</td>
                              {/* Full Funding */}
                              <td className="px-3 py-2 text-right text-gray-900 bg-green-50/50 border-l border-gray-300">${Math.round(projFull.expenditures || 0).toLocaleString()}</td>
                              <td className={`px-3 py-2 text-right font-medium bg-green-50/50 ${(projFull.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>${Math.round(projFull.endingBalance || 0).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* RESERVE CASH FLOW TAB - GREEN/RED ORIGINAL DESIGN            */}
            {/* ============================================================ */}
            {activeTab === 'reserve-cashflow' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">💰 Reserve Fund - 30-Year Cash Flow Projection</h3>
                {hasCostAdjustments && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3 inline-block">
                    📈 {costNoteText}
                  </p>
                )}
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => {
                      let csv = 'Fiscal Year,Current Contribution,Annual Expenditures,Current Ending Balance,FF Annual Contribution,FF Average Annual Contribution,FF Ending Balance\n';
                      reserveCashFlow.forEach((row, index) => {
                        const ffT = thresholds.projectionFull?.[index];
                        const ffRow = ffT || reserveFullFundingCashFlow[index] || {};
                        const ffAnnual = ffT 
                          ? (index === 0 
                            ? (ffT.endingBalance || 0) - (reserveFund.currentBalance || 0) + (ffT.expenditures || 0)
                            : (ffT.endingBalance || 0) - (thresholds.projectionFull?.[index - 1]?.endingBalance || 0) + (ffT.expenditures || 0))
                          : (ffRow.annualContribution || averageAnnualContribution);
                        csv += `${row.year},${Math.round(row.contributions||0)},${Math.round(row.expenditures||0)},${Math.round(row.endingBalance||0)},${Math.round(ffAnnual)},${Math.round(averageAnnualContribution)},${Math.round(ffRow.endingBalance||0)}\n`;
                      });
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'reserve_fund_cash_flow.csv';
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 border border-gray-300"
                  >
                    ⬇ Download CSV
                  </button>
                </div>
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        {/* Fiscal Year header */}
                        <th 
                          className="px-4 py-3 text-center text-xs font-bold uppercase text-gray-700 border-r border-gray-300" 
                          rowSpan="2"
                          style={{ backgroundColor: '#f3f4f6' }}
                        >
                          Fiscal<br/>Year
                        </th>
                        {/* Current Funding - STEEL BLUE */}
                        <th 
                          className="px-4 py-2 text-center text-xs font-bold uppercase border-r" 
                          colSpan="3" 
                          style={{ backgroundColor: '#1d398f', color: 'white', borderColor: '#162d73' }}
                        >
                          Current Funding
                        </th>
                        {/* Full Funding Analysis - WARM SLATE */}
                        <th 
                          className="px-4 py-2 text-center text-xs font-bold uppercase" 
                          colSpan="3" 
                          style={{ backgroundColor: '#dbebff', color: '#1d398f' }}
                        >
                          Full Funding Analysis
                        </th>
                      </tr>
                      <tr>
                        {/* Current Funding sub-headers - STEEL BLUE */}
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase text-white" style={{ backgroundColor: '#1d398f' }}>
                          Current<br/>Contribution
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase text-white" style={{ backgroundColor: '#1d398f' }}>
                          Annual<br/>Expenditures
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase text-white border-r border-gray-300" style={{ backgroundColor: '#1d398f' }}>
                          Ending<br/>Balance
                        </th>
                        {/* Full Funding Analysis sub-headers - WARM SLATE */}
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase " style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                          Annual<br/>Contribution
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase " style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                          Average Annual<br/>Contribution
                        </th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase " style={{ backgroundColor: '#dbebff', color: '#1d398f' }}>
                          Ending<br/>Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reserveCashFlow.map((row, index) => {
                        // Use threshold projectionFull as source of truth for Full Funding
                        const ffThreshold = thresholds.projectionFull?.[index];
                        const ffRow = ffThreshold || reserveFullFundingCashFlow[index] || {};
                        // Annual contribution: derive from threshold data (ending - prev_ending + expenditures)
                        const ffAnnualContribution = ffThreshold 
                          ? (index === 0 
                            ? (ffThreshold.endingBalance || 0) - (reserveFund.currentBalance || 0) + (ffThreshold.expenditures || 0)
                            : (ffThreshold.endingBalance || 0) - (thresholds.projectionFull?.[index - 1]?.endingBalance || 0) + (ffThreshold.expenditures || 0))
                          : (ffRow.annualContribution || averageAnnualContribution);
                        
                        return (
                          <tr key={row.year} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-200">{row.year}</td>
                            {/* Current Funding columns */}
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(row.contributions || 0).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(row.expenditures || 0).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right text-sm font-medium border-r border-gray-200 ${(row.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                              ${Math.round(row.endingBalance || 0).toLocaleString()}
                            </td>
                            {/* Full Funding Analysis columns - from threshold data */}
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(ffAnnualContribution).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(averageAnnualContribution).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right text-sm font-medium ${(ffRow.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'}`}>
                              ${Math.round(ffRow.endingBalance || 0).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PM CASH FLOW TAB */}
            {activeTab === 'pm-cashflow' && pmRequired && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">🟣 PM Fund Cash Flow (30-Year)</h3>
                <p className="text-sm text-gray-600 mb-2">Comparison: Current Funding vs. Recommended Funding</p>
                {hasCostAdjustments && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3 inline-block">
                    📈 {costNoteText}
                  </p>
                )}
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-purple-900 text-white">
                      <tr>
                        <th className="px-4 py-3 text-center text-xs font-bold uppercase border-r border-purple-700" rowSpan="2">Fiscal Year</th>
                        <th className="px-4 py-2 text-center text-xs font-bold uppercase border-r border-purple-700" colSpan="3" style={{ backgroundColor: '#9333ea' }}>Current Funding Plan</th>
                        <th className="px-4 py-2 text-center text-xs font-bold uppercase" colSpan="3" style={{ backgroundColor: '#7e22ce' }}>Recommended Funding Plan</th>
                      </tr>
                      <tr>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase bg-purple-700">Contribution</th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase bg-purple-700">Expenditures</th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase bg-purple-700 border-r border-purple-500">Ending Balance</th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase bg-purple-800">Contribution</th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase bg-purple-800">Expenditures</th>
                        <th className="px-4 py-2 text-right text-xs font-bold uppercase bg-purple-800">Ending Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pmCashFlow.map((row, index) => {
                        const recRow = pmFullFundingCashFlow[index] || { annualContribution: 0, expenditures: 0, endingBalance: 0 };
                        return (
                          <tr key={row.year} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-200">{row.year}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(row.contributions).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(row.expenditures).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right text-sm font-medium border-r border-gray-200 ${row.endingBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>${Math.round(row.endingBalance).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 bg-purple-50">${Math.round(recRow.annualContribution).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900 bg-purple-50">${Math.round(recRow.expenditures).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right text-sm font-medium bg-purple-50 ${recRow.endingBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>${Math.round(recRow.endingBalance).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RESERVE EXPENDITURE SCHEDULE */}
            {activeTab === 'reserve-expenditures' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">📅 Reserve Annual Expenditure Schedule</h3>
                <p className="text-sm text-gray-600 mb-2">Total anticipated expenses by year (Reserve Items Only).</p>
                {hasCostAdjustments && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3 inline-block">
                    📈 {costNoteText}
                  </p>
                )}
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-800 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Year</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Item Description</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reserveExpenditures.length > 0 ? reserveExpenditures.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{item.year}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">{item.category}</span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">${Math.round(item.cost).toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No Reserve expenditures found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PM EXPENDITURE SCHEDULE */}
            {activeTab === 'pm-expenditures' && pmRequired && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">📅 PM Annual Expenditure Schedule</h3>
                <p className="text-sm text-gray-600 mb-2">Total anticipated expenses by year (Preventive Maintenance Items Only).</p>
                {hasCostAdjustments && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3 inline-block">
                    📈 {costNoteText}
                  </p>
                )}
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="text-white" style={{ backgroundColor: '#6e11b0' }}>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Year</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Item Description</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pmExpenditures.length > 0 ? pmExpenditures.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{item.year}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">{item.category}</span>
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">${Math.round(item.cost).toLocaleString()}</td>
                        </tr>
                      )) : (
                        <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No PM expenditures found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'schedule' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">📋 Master Replacement Schedule</h3>
                <p className="text-sm text-gray-600 mb-2">Combined list of all components and their replacement timeline.</p>
                {hasCostAdjustments && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mb-3 inline-block">
                    📈 {costNoteText}
                  </p>
                )}
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-green-700 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Component</th>
                        {pmRequired && <th className="px-4 py-3 text-center text-xs font-bold uppercase">Fund</th>}
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase">Repl. Year</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase">Base Cost</th>
                        {hasCostAdjustments && <th className="px-4 py-3 text-right text-xs font-bold uppercase">Adjusted Cost</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{item.category}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                          {pmRequired && (
                            <td className="px-4 py-2 text-center text-xs">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${item.isPM ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                {item.isPM ? 'PM' : 'Reserve'}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-2 text-right text-sm text-gray-900">{item.year}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(item.baseCost || item.cost).toLocaleString()}</td>
                          {hasCostAdjustments && (
                            <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">${Math.round(item.adjustedCost || item.inflatedCost || item.cost).toLocaleString()}</td>
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
      </main>
    </div>
  );
}
