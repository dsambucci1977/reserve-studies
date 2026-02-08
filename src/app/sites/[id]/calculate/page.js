// src/app/sites/[id]/calculate/page.js
// CONDITIONAL DUAL FUND SYSTEM - Fixed separation of Reserve and PM funds
// v12: Fixes double-counting and recommended funding display

'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { getSite, getComponents, updateSite, saveProjections } from '@/lib/db';
import { calculateReserveStudy } from '@/lib/calculations';
import { doc, getDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CalculatePage() {
  const [site, setSite] = useState(null);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [progress, setProgress] = useState('');
  const [calculationResults, setCalculationResults] = useState(null);
  const [pmRequired, setPmRequired] = useState(true);
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;

  useEffect(() => {
    const loadData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        router.push('/');
        return;
      }
      
      try {
        const [siteData, componentsData] = await Promise.all([
          getSite(siteId),
          getComponents(siteId)
        ]);
        
        setSite(siteData);
        setComponents(componentsData);
        
        // CHECK STATE COMPLIANCE FOR PM REQUIREMENT
        let isPMRequired = true;
        try {
          let orgId = siteData?.organizationId;
          if (!orgId) {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              orgId = userDoc.data()?.organizationId;
            }
          }
          
          if (orgId) {
            const orgDoc = await getDoc(doc(db, 'organizations', orgId));
            if (orgDoc.exists()) {
              const orgData = orgDoc.data();
              const stateCompliance = orgData?.settings?.stateCompliance || [];
              const siteState = siteData?.companyState || '';
              
              const stateConfig = stateCompliance.find(
                s => s.code === siteState || s.name === siteState || 
                     s.abbreviation === siteState || s.code === siteState.toUpperCase()
              );
              
              if (stateConfig) {
                isPMRequired = stateConfig.pmRequired === true;
              }
            }
          }
        } catch (err) {
          console.warn('Could not load org compliance settings, defaulting PM to true:', err);
        }
        
        setPmRequired(isPMRequired);
        
      } catch (error) {
        console.error('Error:', error);
        alert('Error loading data');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [siteId, router]);

  const handleCalculate = async () => {
    if (!site || components.length === 0) {
      alert('Missing required data');
      return;
    }

    setCalculating(true);
    setProgress(pmRequired ? 'Starting dual-fund calculations...' : 'Starting reserve fund calculations...');

    try {
      setProgress('Preparing data...');
      
      // Map component fields
      const mappedComponents = components.map(comp => ({
        ...comp,
        costPerUnit: comp.unitCost || 0,
        estimatedRemainingLife: comp.remainingUsefulLife || 0,
        typicalUsefulLife: comp.usefulLife || 0,
        quantity: comp.quantity || 0,
        description: comp.description || '',
        category: comp.category || '',
        componentType: comp.isPreventiveMaintenance ? 'Preventive Maintenance' : (comp.category || ''),
        itemName: comp.description || '',
        isPreventiveMaintenance: comp.isPreventiveMaintenance || false,
        totalCost: comp.totalCost || ((comp.quantity || 0) * (comp.unitCost || 0)),
      }));

      // SPLIT INTO RESERVE AND PM COMPONENTS
      // FIX: Ensure lists are strictly separated if PM is required
      const reserveComponents = pmRequired 
        ? mappedComponents.filter(c => !c.isPreventiveMaintenance)
        : mappedComponents;
      
      const pmComponents = pmRequired 
        ? mappedComponents.filter(c => c.isPreventiveMaintenance)
        : [];
        
      // Components used for total property projections (Thresholds usually look at the whole picture, 
      // but in a dual system, Reserve Thresholds should arguably only look at Reserve Items.
      // We will stick to the separated list for the main Reserve Study Calculation).
      
      console.log('========================================');
      console.log(pmRequired ? '🔵 DUAL FUND CALCULATION SYSTEM' : '🔵 RESERVE FUND ONLY CALCULATION');
      console.log('========================================');
      console.log('Total Components:', mappedComponents.length);
      console.log('Reserve-only Components:', reserveComponents.length);
      console.log('PM Components:', pmComponents.length);

      // ========================================
      // RESERVE FUND CALCULATION
      // ========================================
      setProgress(`Calculating Reserve Fund (${reserveComponents.length} components)...`);
      
      const reserveProjectInfo = {
        beginningYear: site.beginningYear || new Date().getFullYear(),
        projectionYears: site.projectionYears || 30,
        beginningReserveBalance: site.beginningReserveBalance || 0,
        currentAnnualContribution: site.currentAnnualContribution || 0,
        inflationRate: (site.inflationRate || 0) / 100,
        interestRate: (site.interestRate || 0) / 100,
        costAdjustmentFactor: site.costAdjustmentFactor || 1.15,
      };

      // FIX: Use ONLY reserveComponents here to prevent double counting PM items
      const reserveResults = calculateReserveStudy(reserveProjectInfo, reserveComponents);
      
      // FIX: Use the Cash Flow Average (Full Funding) for the "Recommended" number to match Excel (~$55k)
      // The reserveResults.summary.recommendedAnnualFunding is the Component Method Sum (~$139k)
      const reserveRecommendedFunding = reserveResults.thresholdScenarios.fullFunding.averageAnnualContribution;

      console.log('========================================');
      console.log('💰 RESERVE FUND RESULTS:');
      console.log('Total Replacement Cost:', reserveResults.summary.totalReplacementCost);
      console.log('Recommended Contribution (Cash Flow):', reserveRecommendedFunding);

      // ========================================
      // PM FUND CALCULATION (only if PM required)
      // ========================================
      let pmResults = null;
      let pmRecommendedFunding = 0;
      let pmCashFlowWithExpend = [];
      
      if (pmRequired && pmComponents.length > 0) {
        setProgress(`Calculating PM Fund (${pmComponents.length} components)...`);
        
        const pmProjectInfo = {
          beginningYear: site.beginningYear || new Date().getFullYear(),
          projectionYears: site.projectionYears || 30,
          beginningReserveBalance: site.pmBeginningBalance || 0,
          currentAnnualContribution: site.pmAnnualContribution || 0,
          inflationRate: (site.inflationRate || 0) / 100,
          interestRate: (site.interestRate || 0) / 100,
          costAdjustmentFactor: site.costAdjustmentFactor || 1.15,
        };

        pmResults = calculateReserveStudy(pmProjectInfo, pmComponents);
        pmRecommendedFunding = pmResults.thresholdScenarios.fullFunding.averageAnnualContribution;
        
        console.log('========================================');
        console.log('🟣 PM FUND RESULTS:');
        console.log('Recommended Contribution (Cash Flow):', pmRecommendedFunding);
        
        pmCashFlowWithExpend = buildCashFlowWithCycling(
          pmComponents,
          pmProjectInfo
        );
      }

      // ========================================
      // BUILD CASH FLOW (Reserve Components Only)
      // ========================================
      // This ensures the chart in the Reserve tab only shows Reserve expenditures
      const reserveCashFlowWithExpend = buildCashFlowWithCycling(
        reserveComponents,
        reserveProjectInfo
      );
      
      // ========================================
      // CALCULATE THRESHOLD PROJECTIONS
      // ========================================
      // FIX: Pass reserveComponents only. Thresholds should calculate based on the fund's specific liabilities.
      setProgress('Calculating threshold projections...');
      
      const thresholdResults = calculateThresholdProjections(
        reserveProjectInfo,
        reserveComponents, 
        site.beginningReserveBalance || 0
      );
      
      // ========================================
      // COMBINE RESULTS FOR DISPLAY
      // ========================================
      const displayResults = {
        pmRequired: pmRequired,
        
        reserveFund: {
          percentFunded: (reserveResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          fullyFundedBalance: reserveResults.years[0].totals?.overall?.fullFundingBalance || 0,
          // FIX: Use the smoothed Cash Flow recommendation
          recommendedContribution: reserveRecommendedFunding || 0,
          currentBalance: site.beginningReserveBalance || 0,
          currentContribution: site.currentAnnualContribution || 0,
          componentCount: reserveComponents.length,
          totalReplacementCost: reserveResults.summary.totalReplacementCost || 0,
          byCategory: reserveResults.summary.byCategory || [],
        },
        pmFund: pmRequired && pmResults ? {
          percentFunded: (pmResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          fullyFundedBalance: pmResults.years[0].totals?.overall?.fullFundingBalance || 0,
          // FIX: Use the smoothed Cash Flow recommendation
          recommendedContribution: pmRecommendedFunding || 0,
          currentBalance: site.pmBeginningBalance || 0,
          currentContribution: site.pmAnnualContribution || 0,
          componentCount: pmComponents.length,
          totalReplacementCost: pmResults.summary.totalReplacementCost || 0,
          byCategory: pmResults.summary.byCategory || [],
        } : {
          percentFunded: 0, fullyFundedBalance: 0, recommendedContribution: 0,
          currentBalance: 0, currentContribution: 0, componentCount: 0,
          totalReplacementCost: 0, byCategory: [],
        },
        thresholds: {
          contribution10: thresholdResults.contribution10,
          contribution5: thresholdResults.contribution5,
          contributionBaseline: thresholdResults.contributionBaseline,
          multiplier10: thresholdResults.multiplier10,
          multiplier5: thresholdResults.multiplier5,
          multiplierBaseline: thresholdResults.multiplierBaseline,
          minBalance10: thresholdResults.minBalance10,
          minBalance5: thresholdResults.minBalance5,
          minBalanceBaseline: thresholdResults.minBalanceBaseline,
          percentOfBeginning10: thresholdResults.percentOfBeginning10,
          percentOfBeginning5: thresholdResults.percentOfBeginning5,
          percentOfBeginningBaseline: thresholdResults.percentOfBeginningBaseline,
          compliant10: thresholdResults.compliant10,
          compliant5: thresholdResults.compliant5,
          projection10: thresholdResults.projection10,
          projection5: thresholdResults.projection5,
          projectionBaseline: thresholdResults.projectionBaseline,
        },
        summary: {
          percentFunded: (reserveResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          // FIX: Use the smoothed Cash Flow recommendation
          recommendedContribution: reserveRecommendedFunding || 0,
          currentReserveBalance: site.beginningReserveBalance || 0,
          fullyFundedBalance: reserveResults.years[0].totals?.overall?.fullFundingBalance || 0,
          asOfYear: site.beginningYear || new Date().getFullYear(),
          totalComponents: mappedComponents.length,
        },
        reserveCashFlow: reserveCashFlowWithExpend,
        pmCashFlow: pmCashFlowWithExpend,
        fullFundingCashFlow: reserveResults.thresholdScenarios.fullFunding.years.map((y, i) => ({
          year: y.fiscalYear,
          annualContribution: Math.round(reserveResults.thresholdScenarios.fullFunding.yearlyAnnualFunding[i] || 0),
          contributions: Math.round(y.reserveBalance.contributions),
          expenditures: Math.round(y.reserveBalance.expenditures),
          endingBalance: Math.round(y.reserveBalance.endingBalance),
        })),
        averageAnnualContribution: Math.round(reserveRecommendedFunding),
        cashFlow: reserveCashFlowWithExpend,
        replacementSchedule: buildReplacementSchedule(components, site.beginningYear || new Date().getFullYear()),
      };
      
      console.log('========================================');
      console.log('✅ CALCULATIONS COMPLETE');
      console.log('========================================');
      
      setProgress('Saving results...');
      await saveProjections(siteId, displayResults);
      await updateSite(siteId, { 
        status: 'calculated',
        lastCalculated: new Date().toISOString()
      });
      
      setProgress('Complete!');
      setCalculationResults(displayResults);
      setCalculating(false);
      
    } catch (error) {
      console.error('ERROR:', error);
      alert(`Error: ${error.message}`);
      setCalculating(false);
      setProgress('');
    }
  };

  const buildCashFlowWithCycling = (components, projectInfo) => {
    const cashFlow = [];
    const startYear = projectInfo.beginningYear;
    let runningBalance = projectInfo.beginningReserveBalance;
    
    const compStates = components.map(comp => ({
      ...comp,
      currentRemainingLife: comp.estimatedRemainingLife || comp.remainingUsefulLife || 0,
    }));
    
    for (let year = 0; year < 31; year++) {
      const fiscalYear = startYear + year;
      const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year);
      
      let yearExpenditures = 0;
      compStates.forEach(comp => {
        if (comp.currentRemainingLife === 0 && year > 0) {
          const inflatedCost = (comp.totalCost || 0) * inflationMultiplier;
          yearExpenditures += inflatedCost;
        }
      });
      
      if (year === 0) yearExpenditures = 0;
      
      const beginningBalance = runningBalance;
      const contributions = year === 0 ? 0 : projectInfo.currentAnnualContribution;
      const interest = beginningBalance * projectInfo.interestRate;
      const endingBalance = beginningBalance + contributions + interest - yearExpenditures;
      
      cashFlow.push({
        year: fiscalYear,
        beginningBalance: Math.round(beginningBalance),
        contributions: Math.round(contributions),
        interest: Math.round(interest),
        expenditures: Math.round(yearExpenditures),
        endingBalance: Math.round(endingBalance),
      });
      
      runningBalance = endingBalance;
      
      compStates.forEach(comp => {
        if (comp.currentRemainingLife <= 0) {
          comp.currentRemainingLife = comp.typicalUsefulLife || comp.usefulLife || 20;
        }
        comp.currentRemainingLife -= 1;
      });
    }
    
    return cashFlow;
  };

  const buildReplacementSchedule = (components, beginningYear) => {
    const schedule = [];
    components.forEach(component => {
      const replacementYear = component.replacementYear || (beginningYear + (component.remainingUsefulLife || 0));
      schedule.push({
        year: replacementYear,
        description: component.description,
        cost: component.totalCost || 0,
        category: component.category,
        isPM: component.isPreventiveMaintenance || false,
      });
    });
    schedule.sort((a, b) => a.year - b.year);
    return schedule;
  };

  const runProjectionWithCycling = (components, projectInfo, beginningBalance, constantContribution) => {
    const projection = [];
    const startYear = projectInfo.beginningYear;
    let runningBalance = beginningBalance;
    
    const compStates = components.map(comp => ({
      ...comp,
      currentRemainingLife: comp.estimatedRemainingLife || comp.remainingUsefulLife || 0,
    }));
    
    for (let year = 0; year < 31; year++) {
      const fiscalYear = startYear + year;
      const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year);
      
      let yearExpenditures = 0;
      if (year > 0) {
        compStates.forEach(comp => {
          if (comp.currentRemainingLife === 0) {
            yearExpenditures += (comp.totalCost || 0) * inflationMultiplier;
          }
        });
      }
      
      const beginningBalanceYear = runningBalance;
      const contributions = constantContribution;
      const interest = beginningBalanceYear * projectInfo.interestRate;
      const endingBalance = beginningBalanceYear + contributions + interest - yearExpenditures;
      
      projection.push({
        year: fiscalYear,
        beginningBalance: beginningBalanceYear,
        contributions,
        interest,
        expenditures: yearExpenditures,
        endingBalance
      });
      
      runningBalance = endingBalance;
      
      compStates.forEach(comp => {
        if (comp.currentRemainingLife <= 0) {
          comp.currentRemainingLife = comp.typicalUsefulLife || comp.usefulLife || 20;
        }
        comp.currentRemainingLife -= 1;
      });
    }
    
    return projection;
  };

  const findContributionForThreshold = (projectInfo, components, beginningBalance, thresholdPercent) => {
    const totalReplacementCost = components.reduce((sum, c) => sum + (c.totalCost || 0), 0);
    const targetBalance = totalReplacementCost * thresholdPercent;
    
    let low = 0;
    let high = totalReplacementCost / 5; // adjusted upper bound
    
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const projection = runProjectionWithCycling(components, projectInfo, beginningBalance, mid);
      const minBalance = Math.min(...projection.map(y => y.endingBalance));
      
      if (minBalance >= targetBalance) high = mid;
      else low = mid;
      
      if ((high - low) < 1) break;
    }
    return high;
  };

  const calculateThresholdProjections = (projectInfo, components, beginningBalance) => {
    const totalReplacementCost = components.reduce((sum, c) => sum + (c.totalCost || 0), 0);
    
    const contributionBaseline = findContributionForThreshold(projectInfo, components, beginningBalance, 0.00);
    const contribution5 = findContributionForThreshold(projectInfo, components, beginningBalance, 0.05);
    const contribution10 = findContributionForThreshold(projectInfo, components, beginningBalance, 0.10);
    
    const projectionBaseline = runProjectionWithCycling(components, projectInfo, beginningBalance, contributionBaseline);
    const projection5 = runProjectionWithCycling(components, projectInfo, beginningBalance, contribution5);
    const projection10 = runProjectionWithCycling(components, projectInfo, beginningBalance, contribution10);
    
    const minBalanceBaseline = Math.min(...projectionBaseline.map(y => y.endingBalance));
    const minBalance5 = Math.min(...projection5.map(y => y.endingBalance));
    const minBalance10 = Math.min(...projection10.map(y => y.endingBalance));
    
    return {
      contribution10, contribution5, contributionBaseline,
      multiplier10: contribution10 > 0 ? contribution10 / contribution10 : 1,
      multiplier5: contribution5 > 0 ? contribution5 / contribution10 : 1,
      multiplierBaseline: contributionBaseline > 0 ? contributionBaseline / contribution10 : 1,
      minBalance10, minBalance5, minBalanceBaseline,
      percentOfBeginning10: beginningBalance > 0 ? (minBalance10 / beginningBalance) * 100 : 0,
      percentOfBeginning5: beginningBalance > 0 ? (minBalance5 / beginningBalance) * 100 : 0,
      percentOfBeginningBaseline: beginningBalance > 0 ? (minBalanceBaseline / beginningBalance) * 100 : 0,
      compliant10: minBalance10 >= totalReplacementCost * 0.10,
      compliant5: minBalance5 >= totalReplacementCost * 0.05,
      projection10, projection5, projectionBaseline
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-900">Loading...</div>
      </div>
    );
  }

  const hasRequiredData = site?.beginningReserveBalance !== undefined && components.length > 0;
  const pmComponentCount = components.filter(c => c.isPreventiveMaintenance).length;
  const reserveComponentCount = pmRequired ? (components.length - pmComponentCount) : components.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Link href={`/sites/${siteId}`} className="text-red-600 hover:text-red-700 font-medium">
          ← Back to Site
        </Link>
        
        <div className="mt-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Run Calculations</h1>
          <p className="text-gray-700 mt-2">{site?.siteName}</p>
          <p className="text-sm mt-1" style={{ color: pmRequired ? '#9333ea' : '#2563eb' }}>
            {pmRequired ? '🔵 Dual Fund System (Reserve + PM)' : '🔵 Reserve Fund Only'}
            <span className="text-gray-500 ml-2">• State: {site?.companyState || 'Not set'}</span>
          </p>
        </div>

        {calculationResults && (
          <div className="mb-6 space-y-6">
            <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-blue-900 mb-4">💰 Reserve Fund Results</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded p-4">
                  <div className="text-sm text-gray-600">Percent Funded</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {calculationResults.reserveFund.percentFunded?.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-white rounded p-4">
                  <div className="text-sm text-gray-600">Fully Funded</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${Math.round(calculationResults.reserveFund.fullyFundedBalance || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white rounded p-4">
                  <div className="text-sm text-gray-600">Recommended</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${Math.round(calculationResults.reserveFund.recommendedContribution || 0).toLocaleString()}
                  </div>
                </div>
                <div className="bg-white rounded p-4">
                  <div className="text-sm text-gray-600">Components</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {calculationResults.reserveFund.componentCount}
                  </div>
                </div>
              </div>
            </div>

            {pmRequired && (
              <div className="bg-purple-50 border-2 border-purple-500 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-purple-900 mb-4">🟣 PM Fund Results</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded p-4">
                    <div className="text-sm text-gray-600">Percent Funded</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {calculationResults.pmFund.percentFunded?.toFixed(2)}%
                    </div>
                  </div>
                  <div className="bg-white rounded p-4">
                    <div className="text-sm text-gray-600">Fully Funded</div>
                    <div className="text-xl font-bold text-gray-900">
                      ${Math.round(calculationResults.pmFund.fullyFundedBalance || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white rounded p-4">
                    <div className="text-sm text-gray-600">Recommended</div>
                    <div className="text-xl font-bold text-gray-900">
                      ${Math.round(calculationResults.pmFund.recommendedContribution || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white rounded p-4">
                    <div className="text-sm text-gray-600">Components</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {calculationResults.pmFund.componentCount}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-4">
              <Link
                href={`/sites/${siteId}/results`}
                className="flex-1 px-6 py-3 bg-green-600 text-white text-center rounded-lg hover:bg-green-700 font-medium"
              >
                View Full Results →
              </Link>
              <button
                onClick={() => setCalculationResults(null)}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
              >
                Run Again
              </button>
            </div>
          </div>
        )}

        {!calculationResults && !calculating && (
          <>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 text-gray-900">
                {pmRequired ? 'Dual Fund Calculation Summary' : 'Reserve Fund Calculation Summary'}
              </h2>
              
              <div className={`grid grid-cols-1 ${pmRequired ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-lg'} gap-6 mb-6`}>
                <div className="border-2 border-blue-300 rounded-lg p-4">
                  <h3 className="font-bold text-blue-900 mb-3">💰 Reserve Fund</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">Components:</span>
                      <span className="font-semibold text-gray-900">{reserveComponentCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Beginning Balance:</span>
                      <span className="font-semibold text-gray-900">${site?.beginningReserveBalance?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700">Annual Contribution:</span>
                      <span className="font-semibold text-gray-900">${site?.currentAnnualContribution?.toLocaleString() || '0'}</span>
                    </div>
                  </div>
                </div>

                {pmRequired && (
                  <div className="border-2 border-purple-300 rounded-lg p-4">
                    <h3 className="font-bold text-purple-900 mb-3">🟣 PM Fund</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Components:</span>
                        <span className="font-semibold text-gray-900">{pmComponentCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Beginning Balance:</span>
                        <span className="font-semibold text-gray-900">${site?.pmBeginningBalance?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Annual Contribution:</span>
                        <span className="font-semibold text-gray-900">${site?.pmAnnualContribution?.toLocaleString() || '0'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!pmRequired && pmComponentCount > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <p className="text-amber-800 text-sm">
                    <strong>ℹ️ Note:</strong> This site has {pmComponentCount} PM-flagged component{pmComponentCount !== 1 ? 's' : ''}, 
                    but PM fund is not required for {site?.companyState || 'this state'}. 
                    All components will be calculated under the Reserve Fund.
                  </p>
                </div>
              )}

              {!hasRequiredData && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-orange-800">
                    <strong>⚠️ Missing Required Data:</strong> Please add project information and components.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              <Link
                href={`/sites/${siteId}`}
                className="flex-1 px-6 py-4 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium text-center"
              >
                Cancel
              </Link>
              <button
                onClick={handleCalculate}
                disabled={!hasRequiredData}
                className={`flex-1 px-6 py-4 text-white rounded-lg font-medium text-lg ${
                  pmRequired 
                    ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400' 
                    : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400'
                }`}
              >
                {pmRequired ? '🚀 Run Dual Fund Calculations' : '🚀 Run Reserve Fund Calculations'}
              </button>
            </div>
          </>
        )}

        {calculating && !calculationResults && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="mb-4">
              <div className={`inline-block animate-spin rounded-full h-12 w-12 border-b-2 ${pmRequired ? 'border-purple-600' : 'border-blue-600'}`}></div>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Calculating...</h3>
            <p className="text-gray-600">{progress}</p>
          </div>
        )}

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">
            {pmRequired ? '🔵 Dual Fund System' : '🔵 Reserve Fund System'}
          </h3>
          <p className="text-blue-800 text-sm">
            {pmRequired 
              ? 'This calculates Reserve Fund and PM Fund separately as required by state regulations.'
              : `PM fund is not required for ${site?.companyState || 'this state'}. All components are calculated under the Reserve Fund.`
            }
          </p>
        </div>
      </main>
    </div>
  );
}
