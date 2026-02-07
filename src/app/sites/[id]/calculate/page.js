// src/app/sites/[id]/calculate/page.js
// CONDITIONAL DUAL FUND SYSTEM - PM calculations only when state requires it
// v10: Adds full funding cash flow data to saved results
// - fullFundingCashFlow and averageAnnualContribution now saved
// - costAdjustmentFactor removed from threshold projections (already in unitCost)
// - Year 0 = starting snapshot (no contributions)
// - 31-year loops (year 0 snapshot + 30 contributing years)

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
  const [pmRequired, setPmRequired] = useState(true); // default true for backwards compat
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
        
        // ========================================
        // CHECK STATE COMPLIANCE FOR PM REQUIREMENT
        // ========================================
        let isPMRequired = true; // default true
        try {
          // Find org ID: check site doc first, then user doc
          let orgId = siteData?.organizationId;
          if (!orgId) {
            // Look up from user doc
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
              orgId = userDoc.data()?.organizationId;
            }
          }
          
          console.log('🔍 Org ID:', orgId);
          
          if (orgId) {
            const orgDoc = await getDoc(doc(db, 'organizations', orgId));
            if (orgDoc.exists()) {
              const orgData = orgDoc.data();
              const stateCompliance = orgData?.settings?.stateCompliance || [];
              const siteState = siteData?.companyState || '';
              
              console.log('🔍 Site state:', siteState);
              console.log('🔍 State compliance entries:', stateCompliance.length);
              
              // Find matching state - check code, abbreviation, and name
              const stateConfig = stateCompliance.find(
                s => s.code === siteState || s.name === siteState || 
                     s.abbreviation === siteState || s.code === siteState.toUpperCase()
              );
              
              if (stateConfig) {
                isPMRequired = stateConfig.pmRequired === true;
                console.log(`🏛️ Found state config:`, stateConfig);
              } else {
                console.log(`⚠️ No state config found for "${siteState}", defaulting PM to true`);
              }
              
              console.log(`🏛️ State: ${siteState}, PM Required: ${isPMRequired}`);
            } else {
              console.log('⚠️ Org document not found:', orgId);
            }
          } else {
            console.log('⚠️ No organizationId found on site or user doc');
          }
        } catch (err) {
          console.warn('Could not load org compliance settings, defaulting PM to true:', err);
        }
        
        setPmRequired(isPMRequired);
        
        console.log(isPMRequired ? '🔵 DUAL FUND SYSTEM LOADED' : '🔵 RESERVE FUND ONLY (PM not required for this state)');
        console.log('Total components:', componentsData.length);
        console.log('PM components:', componentsData.filter(c => c.isPreventiveMaintenance).length);
        
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
      }));

      // SPLIT INTO RESERVE AND PM COMPONENTS
      // When PM not required, ALL components go into reserve fund
      const reserveComponents = pmRequired 
        ? mappedComponents.filter(c => !c.isPreventiveMaintenance)
        : mappedComponents; // All components are reserve when PM not required
      
      const pmComponents = pmRequired 
        ? mappedComponents.filter(c => c.isPreventiveMaintenance)
        : []; // No PM components when PM not required

      console.log('========================================');
      console.log(pmRequired ? '🔵 DUAL FUND CALCULATION SYSTEM' : '🔵 RESERVE FUND ONLY CALCULATION');
      console.log('========================================');
      console.log('Total Components:', mappedComponents.length);
      console.log('Reserve Components:', reserveComponents.length);
      if (pmRequired) {
        console.log('PM Components:', pmComponents.length);
      }

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
        pmBeginningBalance: 0,
        pmAnnualContribution: 0,
        pmAveragingLength: 30,
      };

      const reserveResults = calculateReserveStudy(reserveProjectInfo, reserveComponents);
      
      console.log('========================================');
      console.log('💰 RESERVE FUND RESULTS:');
      console.log('========================================');
      console.log('Components:', reserveComponents.length);
      console.log('Total Replacement Cost:', reserveResults.summary.totalReplacementCost);
      console.log('Percent Funded:', (reserveResults.years[0].reserveBalance?.percentFunded || 0) * 100);
      console.log('Recommended Contribution:', reserveResults.summary.recommendedAnnualFunding);

      // ========================================
      // PM FUND CALCULATION (only if PM required)
      // ========================================
      let pmResults = null;
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
          pmBeginningBalance: 0,
          pmAnnualContribution: 0,
          pmAveragingLength: 30,
        };

        pmResults = calculateReserveStudy(pmProjectInfo, pmComponents);
        
        console.log('========================================');
        console.log('🟣 PM FUND RESULTS:');
        console.log('========================================');
        console.log('Components:', pmComponents.length);
        console.log('Total Replacement Cost:', pmResults.summary.totalReplacementCost);
        console.log('Recommended Contribution:', pmResults.summary.recommendedAnnualFunding);
        
        // Build PM Fund cash flow
        pmCashFlowWithExpend = buildCashFlowWithExpenditures(
          pmComponents,
          pmProjectInfo,
          'pm'
        );
      } else if (!pmRequired) {
        console.log('========================================');
        console.log('ℹ️ PM FUND: SKIPPED (not required for this state)');
        console.log('========================================');
      }

      // ========================================
      // BUILD CASH FLOW WITH EXPENDITURES
      // ========================================
      
      // Build Reserve Fund cash flow with actual expenditures
      const reserveCashFlowWithExpend = buildCashFlowWithExpenditures(
        reserveComponents,
        reserveProjectInfo,
        'reserve'
      );
      
      console.log('✅ Cash flows built with year-by-year expenditures');
      console.log('Reserve Fund total expenditures over 30 years:', 
        reserveCashFlowWithExpend.reduce((sum, y) => sum + y.expenditures, 0));
      if (pmRequired) {
        console.log('PM Fund total expenditures over 30 years:', 
          pmCashFlowWithExpend.reduce((sum, y) => sum + y.expenditures, 0));
      }
      
      // ========================================
      // CALCULATE THRESHOLD PROJECTIONS
      // ========================================
      setProgress('Calculating threshold projections...');
      
      const thresholdResults = calculateThresholdMultipliers(
        reserveProjectInfo,
        reserveComponents,
        site.beginningReserveBalance || 0
      );
      
      // ========================================
      // COMBINE RESULTS FOR DISPLAY
      // ========================================
      const displayResults = {
        // Flag for whether PM is included
        pmRequired: pmRequired,
        
        // Reserve Fund Results (includes byCategory for Component Schedule Summary)
        reserveFund: {
          percentFunded: (reserveResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          fullyFundedBalance: reserveResults.years[0].totals?.overall?.fullFundingBalance || 0,
          recommendedContribution: reserveResults.summary.recommendedAnnualFunding || 0,
          currentBalance: site.beginningReserveBalance || 0,
          currentContribution: site.currentAnnualContribution || 0,
          componentCount: reserveComponents.length,
          totalReplacementCost: reserveResults.summary.totalReplacementCost || 0,
          byCategory: reserveResults.summary.byCategory || [],
        },
        // PM Fund Results (empty when PM not required)
        pmFund: pmRequired && pmResults ? {
          percentFunded: (pmResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          fullyFundedBalance: pmResults.years[0].totals?.overall?.fullFundingBalance || 0,
          recommendedContribution: pmResults.summary.recommendedAnnualFunding || 0,
          currentBalance: site.pmBeginningBalance || 0,
          currentContribution: site.pmAnnualContribution || 0,
          componentCount: pmComponents.length,
          totalReplacementCost: pmResults.summary.totalReplacementCost || 0,
          byCategory: pmResults.summary.byCategory || [],
        } : {
          percentFunded: 0,
          fullyFundedBalance: 0,
          recommendedContribution: 0,
          currentBalance: 0,
          currentContribution: 0,
          componentCount: 0,
          totalReplacementCost: 0,
          byCategory: [],
        },
        // Threshold Projections
        thresholds: {
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
        // Keep legacy summary for compatibility
        summary: {
          percentFunded: (reserveResults.years[0].reserveBalance?.percentFunded || 0) * 100,
          recommendedContribution: reserveResults.summary.recommendedAnnualFunding || 0,
          currentReserveBalance: site.beginningReserveBalance || 0,
          fullyFundedBalance: reserveResults.years[0].totals?.overall?.fullFundingBalance || 0,
          asOfYear: site.beginningYear || new Date().getFullYear(),
          totalComponents: mappedComponents.length,
        },
        // Cash flows
        reserveCashFlow: reserveCashFlowWithExpend,
        pmCashFlow: pmCashFlowWithExpend,
        // Full Funding cash flow from calculations engine (for results page Full Funding Analysis columns)
        fullFundingCashFlow: reserveResults.thresholdScenarios.fullFunding.years.map((y, i) => ({
          year: y.fiscalYear,
          annualContribution: Math.round(reserveResults.thresholdScenarios.fullFunding.yearlyAnnualFunding[i]),
          contributions: Math.round(y.reserveBalance.contributions),
          expenditures: Math.round(y.reserveBalance.expenditures),
          endingBalance: Math.round(y.reserveBalance.endingBalance),
        })),
        averageAnnualContribution: Math.round(reserveResults.thresholdScenarios.fullFunding.averageAnnualContribution),
        // Legacy cash flow (Reserve only for compatibility)
        cashFlow: reserveCashFlowWithExpend,
        // Replacement schedule (all components with fund designation)
        replacementSchedule: buildReplacementSchedule(components, site.beginningYear || new Date().getFullYear()),
      };
      
      console.log('========================================');
      console.log('✅ CALCULATIONS COMPLETE');
      console.log(pmRequired ? '   Mode: Dual Fund (Reserve + PM)' : '   Mode: Reserve Fund Only');
      console.log('   Average Annual Contribution:', displayResults.averageAnnualContribution);
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
      console.error('========================================');
      console.error('ERROR:', error);
      console.error('========================================');
      alert(`Error: ${error.message}`);
      setCalculating(false);
      setProgress('');
    }
  };

  // Helper function to build cash flow with actual expenditures
  const buildCashFlowWithExpenditures = (components, projectInfo, fundType) => {
    const cashFlow = [];
    const startYear = projectInfo.beginningYear;
    let runningBalance = projectInfo.beginningReserveBalance;
    
    for (let year = 0; year < 31; year++) {
      const fiscalYear = startYear + year;
      
      // Calculate expenditures for this year
      let yearExpenditures = 0;
      components.forEach(comp => {
        const replacementYear = comp.replacementYear || (startYear + (comp.remainingUsefulLife || 0));
        
        if (replacementYear === fiscalYear) {
          const yearsFromNow = year;
          const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, yearsFromNow);
          // costAdjustmentFactor NOT applied - already included in comp.totalCost from Firebase
          const inflatedCost = (comp.totalCost || 0) * inflationMultiplier;
          yearExpenditures += inflatedCost;
        }
      });
      
      const beginningBalance = runningBalance;
      // Year 0 = starting snapshot, no contributions added
      const contributions = year === 0 ? 0 : projectInfo.currentAnnualContribution;
      const interest = beginningBalance * projectInfo.interestRate;
      const expenditures = yearExpenditures;
      const endingBalance = beginningBalance + contributions + interest - expenditures;
      
      cashFlow.push({
        year: fiscalYear,
        beginningBalance: Math.round(beginningBalance),
        contributions: Math.round(contributions),
        interest: Math.round(interest),
        expenditures: Math.round(expenditures),
        endingBalance: Math.round(endingBalance),
      });
      
      runningBalance = endingBalance;
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

  // ========================================
  // THRESHOLD PROJECTION CALCULATIONS
  // ========================================

  const projectThresholdScenario = (projectInfo, components, beginningBalance, multiplier) => {
    const projection = [];
    const startYear = projectInfo.beginningYear;
    const reducedContribution = (projectInfo.currentAnnualContribution || 0) * multiplier;
    let runningBalance = beginningBalance;
    
    for (let year = 0; year < 31; year++) {
      const fiscalYear = startYear + year;
      
      let yearExpenditures = 0;
      components.forEach(comp => {
        const replacementYear = comp.replacementYear || (startYear + (comp.remainingUsefulLife || 0));
        
        if (replacementYear === fiscalYear) {
          const yearsFromNow = year;
          const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, yearsFromNow);
          // costAdjustmentFactor NOT applied - already included in comp.totalCost from Firebase
          const inflatedCost = (comp.totalCost || 0) * inflationMultiplier;
          yearExpenditures += inflatedCost;
        }
      });
      
      const beginningBalanceYear = runningBalance;
      // Year 0 = starting snapshot, no contributions
      const contributions = year === 0 ? 0 : reducedContribution;
      const interest = beginningBalanceYear * projectInfo.interestRate;
      const expenditures = yearExpenditures;
      const endingBalance = beginningBalanceYear + contributions + interest - expenditures;
      
      projection.push({
        year: fiscalYear,
        beginningBalance: beginningBalanceYear,
        contributions,
        interest,
        expenditures,
        endingBalance
      });
      
      runningBalance = endingBalance;
    }
    
    return projection;
  };

  const findThresholdMultiplier = (projectInfo, components, beginningBalance, thresholdPercent, label) => {
    const targetBalance = beginningBalance * thresholdPercent;
    let low = 0.5;
    let high = 1.0;
    let iterations = 0;
    const maxIterations = 50;
    
    while (iterations < maxIterations && (high - low) > 0.0001) {
      const testMultiplier = (low + high) / 2;
      
      const projection = projectThresholdScenario(
        projectInfo,
        components,
        beginningBalance,
        testMultiplier
      );
      
      const minBalance = Math.min(...projection.map(year => year.endingBalance));
      const hasNegatives = projection.some(year => year.endingBalance < 0);
      const meetsTarget = !hasNegatives && minBalance >= targetBalance;
      
      if (meetsTarget) {
        high = testMultiplier;
      } else {
        low = testMultiplier;
      }
      
      iterations++;
    }
    
    return high;
  };

  const calculateThresholdMultipliers = (projectInfo, components, beginningBalance) => {
    const multiplier10 = findThresholdMultiplier(projectInfo, components, beginningBalance, 0.10, '10% Threshold');
    const multiplier5 = findThresholdMultiplier(projectInfo, components, beginningBalance, 0.05, '5% Threshold');
    const multiplierBaseline = findThresholdMultiplier(projectInfo, components, beginningBalance, 0.00, 'Baseline (0%)');
    
    const projection10 = projectThresholdScenario(projectInfo, components, beginningBalance, multiplier10);
    const projection5 = projectThresholdScenario(projectInfo, components, beginningBalance, multiplier5);
    const projectionBaseline = projectThresholdScenario(projectInfo, components, beginningBalance, multiplierBaseline);
    
    const minBalance10 = Math.min(...projection10.map(y => y.endingBalance));
    const minBalance5 = Math.min(...projection5.map(y => y.endingBalance));
    const minBalanceBaseline = Math.min(...projectionBaseline.map(y => y.endingBalance));
    
    const compliant10 = !projection10.some(y => y.endingBalance < 0) && minBalance10 >= beginningBalance * 0.10;
    const compliant5 = !projection5.some(y => y.endingBalance < 0) && minBalance5 >= beginningBalance * 0.05;
    
    return {
      multiplier10, multiplier5, multiplierBaseline,
      minBalance10, minBalance5, minBalanceBaseline,
      percentOfBeginning10: (minBalance10 / beginningBalance) * 100,
      percentOfBeginning5: (minBalance5 / beginningBalance) * 100,
      percentOfBeginningBaseline: (minBalanceBaseline / beginningBalance) * 100,
      compliant10, compliant5,
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
            {/* Reserve Fund Results */}
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

            {/* PM Fund Results - Only show when PM is required */}
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
                {/* Reserve Fund */}
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

                {/* PM Fund - Only show when PM is required */}
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

              {/* Info banner when PM not required */}
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
