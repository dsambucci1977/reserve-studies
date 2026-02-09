// src/app/sites/[id]/results/page.js
// CONDITIONAL DUAL FUND RESULTS PAGE
// v33: Fixed Reserve Cash Flow table to match original design
//      1. Restored "Current Funding" (green) and "Full Funding Analysis" (red) headers
//      2. Restored correct columns: Annual Contribution, Average Annual Contribution, Ending Balance
//      3. Fixed color scheme to match original design

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

  const pmRequired = results.pmRequired !== false;
  
  const reserveFund = results.reserveFund || {};
  const pmFund = results.pmFund || {};
  
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

  return (
    <div className="min-h-screen bg-gray-50">
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
                  className={`px-6 py-3 font-medium whitespace-nowrap capitalize ${
                    activeTab === tab
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.replace(/-/g, ' ')}
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

            {/* THRESHOLD TAB */}
            {activeTab === 'threshold' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">📊 Threshold Funding Analysis</h3>
                <p className="text-sm text-gray-600 mb-6">Comparison of funding scenarios over 30 years.</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-center">
                    <div className="text-xs text-green-700 font-medium">Full Funding</div>
                    <div className="text-xl font-bold text-green-900">${Math.round(thresholds.contributionFull || reserveFund.recommendedContribution || 0).toLocaleString()}</div>
                    <div className="text-xs text-green-600">Annual Contribution</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 text-center">
                    <div className="text-xs text-blue-700 font-medium">+10% Threshold</div>
                    <div className="text-xl font-bold text-blue-900">${Math.round(thresholds.contribution10 || 0).toLocaleString()}</div>
                    <div className="text-xs text-blue-600">Min Balance: ${Math.round(thresholds.minBalance10 || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 text-center">
                    <div className="text-xs text-yellow-700 font-medium">+5% Threshold</div>
                    <div className="text-xl font-bold text-yellow-900">${Math.round(thresholds.contribution5 || 0).toLocaleString()}</div>
                    <div className="text-xs text-yellow-600">Min Balance: ${Math.round(thresholds.minBalance5 || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-center">
                    <div className="text-xs text-gray-700 font-medium">Baseline</div>
                    <div className="text-xl font-bold text-gray-900">${Math.round(thresholds.contributionBaseline || 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-600">Min Balance: ${Math.round(thresholds.minBalanceBaseline || 0).toLocaleString()}</div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-800 text-white">
                      <tr>
                        <th className="px-3 py-3 text-center text-xs font-bold uppercase">Year</th>
                        <th className="px-3 py-3 text-right text-xs font-bold uppercase bg-green-700" colSpan="2">Full Funding</th>
                        <th className="px-3 py-3 text-right text-xs font-bold uppercase bg-blue-700" colSpan="2">+10% Threshold</th>
                        <th className="px-3 py-3 text-right text-xs font-bold uppercase bg-yellow-600" colSpan="2">+5% Threshold</th>
                        <th className="px-3 py-3 text-right text-xs font-bold uppercase bg-gray-600" colSpan="2">Baseline</th>
                      </tr>
                      <tr className="text-xs">
                        <th className="px-3 py-2 bg-gray-700"></th>
                        <th className="px-3 py-2 bg-green-600 text-right">Expend</th>
                        <th className="px-3 py-2 bg-green-600 text-right">Balance</th>
                        <th className="px-3 py-2 bg-blue-600 text-right">Expend</th>
                        <th className="px-3 py-2 bg-blue-600 text-right">Balance</th>
                        <th className="px-3 py-2 bg-yellow-500 text-right">Expend</th>
                        <th className="px-3 py-2 bg-yellow-500 text-right">Balance</th>
                        <th className="px-3 py-2 bg-gray-500 text-right">Expend</th>
                        <th className="px-3 py-2 bg-gray-500 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {(thresholds.projectionFull || []).slice(0, 30).map((row, index) => {
                        const row10 = thresholds.projection10?.[index] || {};
                        const row5 = thresholds.projection5?.[index] || {};
                        const rowBase = thresholds.projectionBaseline?.[index] || {};
                        return (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-3 py-2 text-center text-sm font-bold">{row.year || (2025 + index)}</td>
                            <td className="px-3 py-2 text-right text-sm">${Math.round(row.expenditures || 0).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right text-sm font-medium ${(row.endingBalance || 0) < 0 ? 'text-red-600' : ''}`}>${Math.round(row.endingBalance || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-sm">${Math.round(row10.expenditures || 0).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right text-sm font-medium ${(row10.endingBalance || 0) < 0 ? 'text-red-600' : ''}`}>${Math.round(row10.endingBalance || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-sm">${Math.round(row5.expenditures || 0).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right text-sm font-medium ${(row5.endingBalance || 0) < 0 ? 'text-red-600' : ''}`}>${Math.round(row5.endingBalance || 0).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right text-sm">${Math.round(rowBase.expenditures || 0).toLocaleString()}</td>
                            <td className={`px-3 py-2 text-right text-sm font-medium ${(rowBase.endingBalance || 0) < 0 ? 'text-red-600' : ''}`}>${Math.round(rowBase.endingBalance || 0).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* RESERVE CASH FLOW TAB - RESTORED ORIGINAL DESIGN */}
            {activeTab === 'reserve-cashflow' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">💰 Reserve Fund - 30-Year Cash Flow Projection</h3>
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
                        {/* Current Funding - GREEN */}
                        <th 
                          className="px-4 py-2 text-center text-xs font-bold uppercase border-r" 
                          colSpan="3" 
                          style={{ backgroundColor: '#22c55e', color: 'white', borderColor: '#16a34a' }}
                        >
                          Current Funding
                        </th>
                        {/* Full Funding Analysis - RED */}
                        <th 
                          className="px-4 py-2 text-center text-xs font-bold uppercase" 
                          colSpan="3" 
                          style={{ backgroundColor: '#dc2626', color: 'white' }}
                        >
                          Full Funding Analysis
                        </th>
                      </tr>
                      <tr>
                        {/* Current Funding sub-headers - GREEN */}
                        <th 
                          className="px-4 py-2 text-right text-xs font-bold uppercase text-white" 
                          style={{ backgroundColor: '#22c55e' }}
                        >
                          Current<br/>Contribution
                        </th>
                        <th 
                          className="px-4 py-2 text-right text-xs font-bold uppercase text-white" 
                          style={{ backgroundColor: '#22c55e' }}
                        >
                          Annual<br/>Expenditures
                        </th>
                        <th 
                          className="px-4 py-2 text-right text-xs font-bold uppercase text-white border-r border-gray-300" 
                          style={{ backgroundColor: '#22c55e' }}
                        >
                          Ending<br/>Balance
                        </th>
                        
                        {/* Full Funding Analysis sub-headers - RED */}
                        <th 
                          className="px-4 py-2 text-right text-xs font-bold uppercase text-white" 
                          style={{ backgroundColor: '#dc2626' }}
                        >
                          Annual<br/>Contribution
                        </th>
                        <th 
                          className="px-4 py-2 text-right text-xs font-bold uppercase text-white" 
                          style={{ backgroundColor: '#dc2626' }}
                        >
                          Average Annual<br/>Contribution
                        </th>
                        <th 
                          className="px-4 py-2 text-right text-xs font-bold uppercase text-white" 
                          style={{ backgroundColor: '#dc2626' }}
                        >
                          Ending<br/>Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reserveCashFlow.map((row, index) => {
                        // Get Full Funding data
                        const ffRow = reserveFullFundingCashFlow[index] || {};
                        
                        return (
                          <tr key={row.year} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            {/* Fiscal Year */}
                            <td className="px-4 py-2 text-center text-sm font-bold text-gray-900 border-r border-gray-200">
                              {row.year}
                            </td>
                            
                            {/* Current Funding columns */}
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              ${Math.round(row.contributions || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              ${Math.round(row.expenditures || 0).toLocaleString()}
                            </td>
                            <td className={`px-4 py-2 text-right text-sm font-medium border-r border-gray-200 ${
                              (row.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'
                            }`}>
                              ${Math.round(row.endingBalance || 0).toLocaleString()}
                            </td>
                            
                            {/* Full Funding Analysis columns */}
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              ${Math.round(ffRow.annualContribution || averageAnnualContribution).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">
                              ${Math.round(averageAnnualContribution).toLocaleString()}
                            </td>
                            <td className={`px-4 py-2 text-right text-sm font-medium ${
                              (ffRow.endingBalance || 0) < 0 ? 'text-red-600 font-bold' : 'text-gray-900'
                            }`}>
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

            {/* PM CASH FLOW TAB - SIDE BY SIDE */}
            {activeTab === 'pm-cashflow' && pmRequired && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">🟣 PM Fund Cash Flow (30-Year)</h3>
                <p className="text-sm text-gray-600 mb-6">Comparison: Current Funding vs. Recommended Funding</p>
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
                            
                            {/* Current Funding Data */}
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(row.contributions).toLocaleString()}</td>
                            <td className="px-4 py-2 text-right text-sm text-gray-900">${Math.round(row.expenditures).toLocaleString()}</td>
                            <td className={`px-4 py-2 text-right text-sm font-medium border-r border-gray-200 ${row.endingBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>${Math.round(row.endingBalance).toLocaleString()}</td>
                            
                            {/* Recommended Funding Data */}
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

            {/* SEPARATED RESERVE EXPENDITURE SCHEDULE */}
            {activeTab === 'reserve-expenditures' && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">📅 Reserve Annual Expenditure Schedule</h3>
                <p className="text-sm text-gray-600 mb-6">Total anticipated expenses by year (Reserve Items Only).</p>
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
                            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              {item.category}
                            </span>
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

            {/* SEPARATED PM EXPENDITURE SCHEDULE */}
            {activeTab === 'pm-expenditures' && pmRequired && (
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">📅 PM Annual Expenditure Schedule</h3>
                <p className="text-sm text-gray-600 mb-6">Total anticipated expenses by year (Preventive Maintenance Items Only).</p>
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-purple-800 text-white">
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
                            <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                              {item.category}
                            </span>
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
                <p className="text-sm text-gray-600 mb-6">Combined list of all components and their replacement timeline.</p>
                <div className="overflow-x-auto border border-gray-300 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-green-700 text-white">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">Component</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase">Repl. Year</th>
                        <th className="px-4 py-3 text-right text-xs font-bold uppercase">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {schedule.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{item.category}</td>
                          <td className="px-4 py-2 text-sm text-gray-900">{item.description}</td>
                          <td className="px-4 py-2 text-right text-sm text-gray-900">{item.year}</td>
                          <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">${Math.round(item.cost).toLocaleString()}</td>
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
