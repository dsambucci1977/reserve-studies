// src/app/sites/[id]/calculate/page.js
// CONDITIONAL DUAL FUND SYSTEM
// v33: Fixes Full Funding Multiplier (Sets Base = Full Funding)
//      1. 'calculateThresholdProjections': Sets 'base' to 'contributionFull'.
//         This ensures Full Funding Multiplier is 1.0000.
//      2. Maintains all previous Cash Flow calculation logic.
// v34: Adds projectSettings to results + adjustedCost to schedule

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
      
      const mappedComponents = components.map(comp => {
        const quantity = parseFloat(comp.quantity) || 0;
        const unitCost = parseFloat(comp.unitCost) || 0;
        let totalCost = parseFloat(comp.totalCost);
        if (isNaN(totalCost) || totalCost === 0) {
          totalCost = quantity * unitCost;
        }

        const rul = (comp.remainingUsefulLife !== undefined && comp.remainingUsefulLife !== "") 
          ? parseFloat(comp.remainingUsefulLife) 
          : 0;

        return {
          ...comp,
          costPerUnit: unitCost,
          estimatedRemainingLife: rul,
          typicalUsefulLife: parseFloat(comp.usefulLife) || 20,
          quantity: quantity,
          description: comp.description || '',
          category: comp.category || '',
          componentType: comp.isPreventiveMaintenance ? 'Preventive Maintenance' : (comp.category || ''),
          itemName: comp.description || '',
          isPreventiveMaintenance: comp.isPreventiveMaintenance || false,
          totalCost: totalCost, 
        };
      });

      const reserveComponents = pmRequired 
        ? mappedComponents.filter(c => !c.isPreventiveMaintenance)
        : mappedComponents;
      
      const pmComponents = pmRequired 
        ? mappedComponents.filter(c => c.isPreventiveMaintenance)
        : [];
        
      console.log('========================================');
      console.log(pmRequired ? '🔵 DUAL FUND CALCULATION' : '🔵 RESERVE FUND ONLY');
      console.log('========================================');

      const inflationRate = (site.inflationRate && !isNaN(parseFloat(site.inflationRate))) 
        ? parseFloat(site.inflationRate) / 100 
        : 0;
      const interestRate = (site.interestRate && !isNaN(parseFloat(site.interestRate)))
        ? parseFloat(site.interestRate) / 100
        : 0;
      const costAdjustmentFactor = (site.costAdjustmentFactor && parseFloat(site.costAdjustmentFactor) > 0)
        ? parseFloat(site.costAdjustmentFactor)
        : 1.0;

      const reserveProjectInfo = {
        beginningYear: site.beginningYear || new Date().getFullYear(),
        projectionYears: site.projectionYears || 30,
        beginningReserveBalance: parseFloat(site.beginningReserveBalance) || 0,
        currentAnnualContribution: parseFloat(site.currentAnnualContribution) || 0,
        inflationRate: inflationRate,
        interestRate: interestRate,
        costAdjustmentFactor: costAdjustmentFactor,
      };

      // 1. RESERVE FUND CALCULATION
      setProgress(`Calculating Reserve Fund (${reserveComponents.length} components)...`);
      const reserveResults = calculateReserveStudy(reserveProjectInfo, reserveComponents);
      
      const componentMethodTotal = reserveResults.summary.byCategory 
        ? reserveResults.summary.byCategory.reduce((sum, c) => sum + (c.annualFunding || 0), 0)
        : reserveResults.thresholdScenarios.fullFunding.averageAnnualContribution;

      const reserveRecommendedFunding = reserveResults.thresholdScenarios.fullFunding.averageAnnualContribution;

      // 2. PM FUND CALCULATION
      let pmResults = null;
      let pmRecommendedFunding = 0;
      let pmCashFlowWithExpend = [];
      let pmFullFundingCashFlow = [];
      
      if (pmRequired && pmComponents.length > 0) {
        setProgress(`Calculating PM Fund (${pmComponents.length} components)...`);
        
        const pmProjectInfo = {
          ...reserveProjectInfo,
          beginningReserveBalance: parseFloat(site.pmBeginningBalance) || 0,
          currentAnnualContribution: parseFloat(site.pmAnnualContribution) || 0,
        };

        pmResults = calculateReserveStudy(pmProjectInfo, pmComponents);
        pmRecommendedFunding = pmResults.thresholdScenarios.fullFunding.averageAnnualContribution;
        
        pmCashFlowWithExpend = buildCashFlowWithCycling(pmComponents, pmProjectInfo);
        
        pmFullFundingCashFlow = pmResults.thresholdScenarios.fullFunding.years.map((y, i) => ({
          year: y.fiscalYear,
          annualContribution: Math.round(pmResults.thresholdScenarios.fullFunding.yearlyAnnualFunding[i] || 0),
          contributions: Math.round(y.reserveBalance.contributions),
          expenditures: Math.round(y.reserveBalance.expenditures),
          endingBalance: Math.round(y.reserveBalance.endingBalance),
        }));
      }

      // 3. BUILD CASH FLOWS (WITH FFB)
      const reserveCashFlowWithExpend = buildCashFlowWithCycling(
        reserveComponents,
        reserveProjectInfo
      );
      
      // 4. CALCULATE THRESHOLD PROJECTIONS
      setProgress('Calculating threshold projections...');
      
      const thresholdResults = calculateThresholdProjections(
        reserveProjectInfo,
        reserveComponents, 
        reserveProjectInfo.beginningReserveBalance,
        reserveRecommendedFunding,
        componentMethodTotal
      );
      
      // 5. ASSEMBLE RESULTS
      const displayResults = {
        pmRequired: pmRequired,
        projectSettings: {
          beginningYear: reserveProjectInfo.beginningYear,
          inflationRate: inflationRate,
          interestRate: interestRate,
          costAdjustmentFactor: costAdjustmentFactor,
        },
        
        reserveFund: {
          percentFunded: (reserveResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          fullyFundedBalance: reserveResults.years[0].totals?.overall?.fullFundingBalance || 0,
          recommendedContribution: reserveRecommendedFunding || 0,
          currentBalance: reserveProjectInfo.beginningReserveBalance,
          currentContribution: reserveProjectInfo.currentAnnualContribution,
          componentCount: reserveComponents.length,
          totalReplacementCost: reserveResults.summary.totalReplacementCost || 0,
          byCategory: reserveResults.summary.byCategory || [],
        },
        pmFund: pmRequired && pmResults ? {
          percentFunded: (pmResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          fullyFundedBalance: pmResults.years[0].totals?.overall?.fullFundingBalance || 0,
          recommendedContribution: pmRecommendedFunding || 0,
          currentBalance: parseFloat(site.pmBeginningBalance) || 0,
          currentContribution: parseFloat(site.pmAnnualContribution) || 0,
          componentCount: pmComponents.length,
          totalReplacementCost: pmResults.summary.totalReplacementCost || 0,
          byCategory: pmResults.summary.byCategory || [],
        } : {
          percentFunded: 0, fullyFundedBalance: 0, recommendedContribution: 0,
          currentBalance: 0, currentContribution: 0, componentCount: 0,
          totalReplacementCost: 0, byCategory: [],
        },
        thresholds: thresholdResults,
        summary: {
          percentFunded: (reserveResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          recommendedContribution: reserveRecommendedFunding || 0,
          currentReserveBalance: reserveProjectInfo.beginningReserveBalance,
          fullyFundedBalance: reserveResults.years[0].totals?.overall?.fullFundingBalance || 0,
          asOfYear: site.beginningYear || new Date().getFullYear(),
          totalComponents: mappedComponents.length,
        },
        reserveCashFlow: reserveCashFlowWithExpend,
        pmCashFlow: pmCashFlowWithExpend,
        pmFullFundingCashFlow: pmFullFundingCashFlow,
        
        fullFundingCashFlow: reserveResults.thresholdScenarios.fullFunding.years.map((y, i) => ({
          year: y.fiscalYear,
          annualContribution: Math.round(reserveResults.thresholdScenarios.fullFunding.yearlyAnnualFunding[i] || 0),
          contributions: Math.round(y.reserveBalance.contributions),
          expenditures: Math.round(y.reserveBalance.expenditures),
          endingBalance: Math.round(y.reserveBalance.endingBalance),
        })),
        averageAnnualContribution: Math.round(reserveRecommendedFunding),
        cashFlow: reserveCashFlowWithExpend,
        replacementSchedule: buildReplacementSchedule(mappedComponents, site.beginningYear || new Date().getFullYear(), costAdjustmentFactor, inflationRate),
      };
      
      console.log('✅ Calculations Complete');
      
      await saveProjections(siteId, displayResults);
      await updateSite(siteId, { 
        status: 'calculated',
        lastCalculated: new Date().toISOString()
      });
      
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
    const caf = projectInfo.costAdjustmentFactor || 1.0;
    
    // Init state with real RUL
    const compStates = components.map(comp => ({
      ...comp,
      counter: comp.estimatedRemainingLife !== undefined ? comp.estimatedRemainingLife : 0,
      ul: comp.typicalUsefulLife || 20,
      currentCost: (comp.totalCost || 0) * caf
    }));
    
    for (let year = 0; year < 31; year++) {
      const fiscalYear = startYear + year;
      const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year);
      
      // 1. Calculate Expenditures & Fully Funded Balance
      let yearExpenditures = 0;
      let totalFFB = 0;

      compStates.forEach(comp => {
        // Expenditure Logic
        if (Math.round(comp.counter) <= 0) {
          const inflatedCost = comp.currentCost * inflationMultiplier;
          yearExpenditures += inflatedCost;
          comp.counter = comp.ul;
        }

        // FFB Logic: FFB = Current Cost * (Effective Age / Useful Life)
        const inflatedReplacementCost = comp.currentCost * inflationMultiplier;
        const remainingLife = Math.max(0, comp.counter);
        const usefulLife = Math.max(1, comp.ul);
        const effectiveAge = Math.max(0, usefulLife - remainingLife);
        
        const componentFFB = inflatedReplacementCost * (effectiveAge / usefulLife);
        totalFFB += componentFFB;
      });
      
      const beginningBalance = runningBalance;
      const contributions = projectInfo.currentAnnualContribution * inflationMultiplier;
      const interest = beginningBalance * projectInfo.interestRate;
      const endingBalance = beginningBalance + contributions + interest - yearExpenditures;
      
      const percentFunded = totalFFB > 0 ? (endingBalance / totalFFB) * 100 : 100;

      cashFlow.push({
        year: fiscalYear,
        beginningBalance: Math.round(beginningBalance),
        contributions: Math.round(contributions),
        interest: Math.round(interest),
        expenditures: Math.round(yearExpenditures),
        endingBalance: Math.round(endingBalance),
        fullyFundedBalance: Math.round(totalFFB),
        percentFunded: percentFunded
      });
      
      runningBalance = endingBalance;
      
      compStates.forEach(comp => {
        comp.counter -= 1;
      });
    }
    
    return cashFlow;
  };

  const buildReplacementSchedule = (components, beginningYear, caf, inflationRate) => {
    const schedule = [];
    components.forEach(component => {
      const rul = component.estimatedRemainingLife || 0;
      const replacementYear = beginningYear + rul;
      const baseCost = component.totalCost || 0;
      // Match cash flow logic: baseCost * CAF * inflation^years
      const cafAdjusted = baseCost * (caf || 1.0);
      const inflationMultiplier = Math.pow(1 + (inflationRate || 0), rul);
      const adjustedCost = cafAdjusted * inflationMultiplier;
      
      schedule.push({
        year: replacementYear,
        description: component.description,
        cost: baseCost,
        baseCost: baseCost,
        adjustedCost: Math.round(adjustedCost),
        category: component.category,
        isPM: component.isPreventiveMaintenance || false,
      });
    });
    schedule.sort((a, b) => a.year - b.year);
    return schedule;
  };

  const runProjectionWithCycling = (components, projectInfo, beginningBalance, initialAnnualContribution) => {
    const projection = [];
    const startYear = projectInfo.beginningYear;
    let runningBalance = beginningBalance;
    const caf = projectInfo.costAdjustmentFactor || 1.0;
    
    const compStates = components.map(comp => ({
      ...comp,
      counter: comp.estimatedRemainingLife !== undefined ? comp.estimatedRemainingLife : 0,
      ul: comp.typicalUsefulLife || 20
    }));
    
    for (let year = 0; year < 31; year++) {
      const fiscalYear = startYear + year;
      const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year);
      
      let yearExpenditures = 0;
      compStates.forEach(comp => {
        if (Math.round(comp.counter) <= 0) {
          const inflatedCost = (comp.totalCost || 0) * caf * inflationMultiplier;
          yearExpenditures += inflatedCost;
          comp.counter = comp.ul;
        }
      });
      
      const beginningBalanceYear = runningBalance;
      const contributions = initialAnnualContribution * inflationMultiplier;
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
        comp.counter -= 1;
      });
    }
    
    return projection;
  };

  const findContributionForThreshold = (projectInfo, components, beginningBalance, thresholdPercent) => {
    const caf = projectInfo.costAdjustmentFactor || 1.0;
    const totalReplacementCost = components.reduce((sum, c) => sum + (c.totalCost || 0), 0) * caf;
    const targetBalance = totalReplacementCost * thresholdPercent;
    
    let low = 0;
    let high = totalReplacementCost * 2; 
    if (isNaN(high) || high === 0) high = 1000000;

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

  const calculateThresholdProjections = (projectInfo, components, beginningBalance, recommendedFunding, fullFundingBenchmark) => {
    const caf = projectInfo.costAdjustmentFactor || 1.0;
    const totalReplacementCost = components.reduce((sum, c) => sum + (c.totalCost || 0), 0) * caf;
    
    const contributionBaseline = findContributionForThreshold(projectInfo, components, beginningBalance, 0.00);
    const contribution5 = findContributionForThreshold(projectInfo, components, beginningBalance, 0.05);
    const contribution10 = findContributionForThreshold(projectInfo, components, beginningBalance, 0.10);
    
    const contributionFull = fullFundingBenchmark || findContributionForThreshold(projectInfo, components, beginningBalance, 0.20);

    const projectionBaseline = runProjectionWithCycling(components, projectInfo, beginningBalance, contributionBaseline);
    const projection5 = runProjectionWithCycling(components, projectInfo, beginningBalance, contribution5);
    const projection10 = runProjectionWithCycling(components, projectInfo, beginningBalance, contribution10);
    const projectionFull = runProjectionWithCycling(components, projectInfo, beginningBalance, contributionFull);
    
    const minBalanceBaseline = Math.min(...projectionBaseline.map(y => y.endingBalance));
    const minBalance5 = Math.min(...projection5.map(y => y.endingBalance));
    const minBalance10 = Math.min(...projection10.map(y => y.endingBalance));
    const minBalanceFull = Math.min(...projectionFull.map(y => y.endingBalance));
    
    // FIX: Use 'contributionFull' as the BASE. This ensures Full Funding Multiplier is 1.0.
    const base = contributionFull > 0 ? contributionFull : 1;

    return {
      contribution10, contribution5, contributionBaseline, contributionFull,
      multiplier10: contribution10 / base,
      multiplier5: contribution5 / base,
      multiplierBaseline: contributionBaseline / base,
      multiplierFull: contributionFull / base, // Now guaranteed to be 1.0
      
      minBalance10, minBalance5, minBalanceBaseline, minBalanceFull,
      
      percentOfBeginning10: beginningBalance > 0 ? (minBalance10 / beginningBalance) * 100 : 0,
      percentOfBeginning5: beginningBalance > 0 ? (minBalance5 / beginningBalance) * 100 : 0,
      percentOfBeginningBaseline: beginningBalance > 0 ? (minBalanceBaseline / beginningBalance) * 100 : 0,
      
      compliant10: minBalance10 >= totalReplacementCost * 0.10,
      compliant5: minBalance5 >= totalReplacementCost * 0.05,
      
      projection10, projection5, projectionBaseline, projectionFull
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
      <main className="w-full px-6 py-8">
        <Link href={`/sites/${siteId}`} className="text-red-600 hover:text-red-700 font-medium">
          ← Back to Project
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
