// src/lib/calculations.js
// Reserve Study Calculation Engine v4
// Fixes from v3:
// 1. Funds Needed = Replacement Cost - Current Reserve Funds (not FFB - Current Reserve)
//    Old program: $689,200 = $867,855 - $178,655
// 2. Annual Funding = Funds Needed per component / Remaining Life (not totalCost / remainingLife)
//    Old program: $139,354. Formula: sum of (componentCost - componentCurrentReserve) / remainingLife
//    Current Reserve per component is distributed from beginning balance by FFB ratio.
// Carries forward from v3:
// - costAdjustmentFactor removed (unitCost already includes it)
// - Per-category FFB distribution (byCategory)
// - Percent Funded uses beginning balance
// - Two-pass year 1 calculation for FFB-based distribution

/**
 * Calculate complete 30-year reserve study projections
 * @param {Object} projectInfo - Site/project information
 * @param {Array} components - Array of component objects
 * @returns {Object} Complete projection results
 */
export function calculateReserveStudy(projectInfo, components) {
  const years = [];
  
  // Calculate each year (1-31): year 1 = starting snapshot, years 2-31 = 30 contributing years
  for (let year = 1; year <= 31; year++) {
    const yearProjection = calculateYear(
      year,
      projectInfo,
      components,
      years // Previous years for cumulative calculations
    );
    years.push(yearProjection);
  }
  
  // Build expenditure schedule
  const expenditureSchedule = buildExpenditureSchedule(components, years);
  
  // Calculate threshold scenarios
  const thresholdScenarios = {
    fullFunding: calculateThresholdScenario(projectInfo, components, null),
    threshold_10: calculateThresholdScenario(projectInfo, components, 0.10),
    threshold_5: calculateThresholdScenario(projectInfo, components, 0.05),
    baseline: calculateThresholdScenario(projectInfo, components, 0.00)
  };
  
  return {
    years,
    expenditureSchedule,
    thresholdScenarios,
    summary: calculateSummary(years[0], projectInfo) // Year 1 summary with project info
  };
}

/**
 * Calculate single year projection
 * 
 * Uses a two-pass approach for year 1:
 * Pass 1: Calculate FFB for each component (needed to distribute beginning balance)
 * Pass 2: Calculate full component details including annual funding (needs currentReserve)
 * 
 * For years 2+, currentReserve distribution is not used in annual funding
 * (annual funding is only shown for year 1 in the Component Schedule Summary)
 */
function calculateYear(year, projectInfo, components, previousYears) {
  const fiscalYear = projectInfo.beginningYear + year - 1;
  const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
  
  // For year 1, we need to distribute beginning balance by FFB ratio
  // This requires a two-pass approach:
  // Pass 1: Get each component's FFB (without needing currentReserve)
  // Pass 2: Calculate full details with distributed currentReserve
  
  let componentCurrentReserves = {};
  
  if (year === 1) {
    const beginningBalance = projectInfo.beginningReserveBalance || 0;
    
    // Pass 1: Calculate FFB for each component
    const ffbByComponent = {};
    let totalFFB = 0;
    
    components.forEach(comp => {
      const costPerUnit = (comp.costPerUnit || 0) * inflationMultiplier;
      const totalCost = (comp.quantity || 0) * costPerUnit;
      const remainingLife = Math.max(0, comp.estimatedRemainingLife);
      
      let ffb;
      if (comp.typicalUsefulLife > 0) {
        const effectiveAge = comp.typicalUsefulLife - remainingLife;
        ffb = (totalCost / comp.typicalUsefulLife) * effectiveAge;
      } else {
        ffb = totalCost;
      }
      
      ffbByComponent[comp.id] = ffb;
      totalFFB += ffb;
    });
    
    // Distribute beginning balance by FFB ratio
    components.forEach(comp => {
      const ffbShare = totalFFB > 0 ? (ffbByComponent[comp.id] / totalFFB) : 0;
      componentCurrentReserves[comp.id] = beginningBalance * ffbShare;
    });
  }
  
  // Pass 2 (or only pass for years 2+): Full component calculation
  const componentBreakdowns = components.map(comp => {
    const currentReserve = componentCurrentReserves[comp.id] || 0;
    return calculateComponent(comp, year, fiscalYear, projectInfo, inflationMultiplier, currentReserve);
  });
  
  // Aggregate by component type
  const totals = aggregateByComponentType(componentBreakdowns);
  
  // Calculate reserve fund balance
  const reserveBalance = calculateReserveFundBalance(
    year,
    totals,
    projectInfo,
    componentBreakdowns,
    previousYears
  );
  
  return {
    year,
    fiscalYear,
    componentBreakdowns,
    totals,
    reserveBalance
  };
}

/**
 * Calculate single component for a specific year
 * 
 * KEY FORMULAS (matching old program):
 *   Total Cost = Quantity × Unit Cost × Inflation
 *     NOTE: costAdjustmentFactor is NOT applied here because unitCost from Firebase
 *     already includes it. The cost adj factor was applied when components were
 *     imported/created. Applying it again would inflate costs by ~15%.
 *   
 *   Full Funding Balance (FFB) = Total Cost × (Effective Age / Useful Life)
 *   
 *   Funds Needed = Total Cost - Current Reserve Funds (per component)
 *     where Current Reserve Funds is distributed by FFB ratio from beginning balance
 *   
 *   Annual Funding = Funds Needed / Remaining Life
 *     This is the amount needed each year over the remaining life to close the gap
 *     between what's already saved and the full replacement cost.
 *     Components with 0 remaining life use usefulLife as fallback.
 */
function calculateComponent(component, year, fiscalYear, projectInfo, inflationMultiplier, componentCurrentReserve) {
  // Apply inflation ONLY (costAdjustmentFactor already in unitCost from Firebase)
  const costPerUnit = (component.costPerUnit || 0) * inflationMultiplier;
  
  // Total Cost
  const totalCost = (component.quantity || 0) * costPerUnit;
  
  // Remaining Life for this year
  const remainingLife = Math.max(0, component.estimatedRemainingLife - (year - 1));
  
  // Full Funding Balance (FFB)
  // FFB = Total Cost × (Effective Age / Useful Life)
  // Effective Age = Useful Life - Remaining Life
  let fullFundingBalance;
  if (component.typicalUsefulLife > 0) {
    const effectiveAge = component.typicalUsefulLife - remainingLife;
    fullFundingBalance = (totalCost / component.typicalUsefulLife) * effectiveAge;
  } else {
    fullFundingBalance = totalCost;
  }
  
  // Funds Needed = Total Cost - Current Reserve Funds (per component)
  // Current Reserve Funds per component is passed in (distributed by FFB ratio)
  const currentReserve = componentCurrentReserve || 0;
  const fundsNeeded = totalCost - currentReserve;
  
  // Annual Funding = Funds Needed / Remaining Life
  // This is the amount needed each year over the remaining life to close the gap
  // between what's already saved (current reserve) and full replacement cost.
  let annualFunding = 0;
  if (remainingLife > 0) {
    annualFunding = fundsNeeded / remainingLife;
  } else if (component.typicalUsefulLife > 0) {
    // Component is due for replacement now - use useful life for the next cycle
    annualFunding = fundsNeeded / component.typicalUsefulLife;
  }
  
  // Check if component is replaced this year
  const replacementYear = projectInfo.beginningYear + component.estimatedRemainingLife;
  const isReplaced = (fiscalYear === replacementYear);
  
  return {
    componentId: component.id,
    componentName: component.itemName,
    componentType: component.componentType,
    quantity: component.quantity,
    measurement: component.measurement,
    costPerUnit: costPerUnit,
    totalCost: totalCost,
    typicalUsefulLife: component.typicalUsefulLife,
    remainingLife: remainingLife,
    fullFundingBalance: fullFundingBalance,
    currentReserveFunds: currentReserve,
    fundsNeeded: fundsNeeded,
    annualFunding: annualFunding,
    isReplaced: isReplaced,
    expenditure: isReplaced ? totalCost : 0
  };
}

/**
 * Aggregate components by type (Summary sheet)
 */
function aggregateByComponentType(components) {
  const types = ['Sitework', 'Building', 'Interior', 'Exterior', 
                 'Electrical', 'Special', 'Mechanical', 'Preventive Maintenance'];
  
  const totals = {};
  
  types.forEach(type => {
    const typeComponents = components.filter(c => c.componentType === type);
    
    totals[type] = {
      count: typeComponents.length,
      totalCost: sum(typeComponents, 'totalCost'),
      fullFundingBalance: sum(typeComponents, 'fullFundingBalance'),
      currentReserveFunds: sum(typeComponents, 'currentReserveFunds'),
      fundsNeeded: sum(typeComponents, 'fundsNeeded'),
      annualFunding: sum(typeComponents, 'annualFunding'),
      expenditures: sum(typeComponents, 'expenditure')
    };
  });
  
  // Overall totals
  const allComponents = Object.values(totals);
  totals.overall = {
    count: sum(allComponents, 'count'),
    totalCost: sum(allComponents, 'totalCost'),
    fullFundingBalance: sum(allComponents, 'fullFundingBalance'),
    currentReserveFunds: sum(allComponents, 'currentReserveFunds'),
    fundsNeeded: sum(allComponents, 'fundsNeeded'),
    annualFunding: sum(allComponents, 'annualFunding'),
    expenditures: sum(allComponents, 'expenditures')
  };
  
  return totals;
}

/**
 * Calculate reserve fund balance (Projection sheet)
 * 
 * Percent Funded uses beginning balance (before contributions/interest),
 * which represents the actual funded status at the start of the fiscal year.
 */
function calculateReserveFundBalance(year, totals, projectInfo, components, previousYears) {
  // Beginning balance
  let beginningBalance;
  if (year === 1) {
    beginningBalance = projectInfo.beginningReserveBalance;
  } else {
    beginningBalance = previousYears[year - 2].reserveBalance.endingBalance;
  }
  
  // Contributions: Year 1 is starting snapshot (no contribution)
  // Contributions begin in year 2
  const contributions = year === 1 ? 0 : projectInfo.currentAnnualContribution;
  
  // Interest earned
  const interest = beginningBalance * projectInfo.interestRate;
  
  // Expenditures (sum of all replaced components this year)
  const expenditures = totals.overall.expenditures;
  
  // Ending balance
  const endingBalance = beginningBalance + contributions + interest - expenditures;
  
  // Percent funded uses BEGINNING balance (before contributions)
  const percentFunded = totals.overall.fullFundingBalance > 0
    ? beginningBalance / totals.overall.fullFundingBalance
    : 0;
  
  // Get list of components replaced this year
  const replacedComponents = components
    .filter(c => c.isReplaced)
    .map(c => ({
      name: c.componentName,
      cost: c.totalCost
    }));
  
  return {
    beginningBalance,
    contributions,
    interest,
    expenditures,
    endingBalance,
    percentFunded,
    replacedComponents
  };
}

/**
 * Build expenditure schedule (30-year matrix)
 */
function buildExpenditureSchedule(components, years) {
  const schedule = {};
  
  // Group by component type
  const types = ['Sitework', 'Building', 'Interior', 'Exterior', 
                 'Electrical', 'Special', 'Mechanical', 'Preventive Maintenance'];
  
  types.forEach(type => {
    schedule[type] = {};
    
    const typeComponents = components.filter(c => c.componentType === type);
    
    typeComponents.forEach(comp => {
      const componentSchedule = {};
      
      years.forEach(yearData => {
        const yearComp = yearData.componentBreakdowns.find(
          cb => cb.componentId === comp.id
        );
        
        componentSchedule[yearData.fiscalYear] = yearComp ? yearComp.expenditure : 0;
      });
      
      schedule[type][comp.itemName] = componentSchedule;
    });
  });
  
  return schedule;
}

/**
 * Calculate threshold scenario with proper component lifecycle tracking
 * 
 * Components cycle after replacement: remaining life resets to usefulLife.
 * 
 * For the Full Funding scenario (thresholdRate === null):
 *   - Uses binary search to find the minimum constant annual contribution
 *     that keeps the fund balance ≥ 0 throughout the 30-year projection
 *   - Also calculates year-specific annualFunding for the "Annual Contribution" column
 * 
 * For threshold scenarios (thresholdRate is a number):
 *   - Uses currentAnnualContribution * (1 + thresholdRate) as contribution
 */
function calculateThresholdScenario(projectInfo, components, thresholdRate) {
  
  // ========================================
  // Helper: Run a 31-year cash flow with component cycling
  // Returns array of year objects with balances
  // ========================================
  function runCashFlow(constantContribution) {
    const compStates = components.map(comp => ({
      ...comp,
      currentRemainingLife: comp.estimatedRemainingLife,
    }));
    
    const result = [];
    
    for (let year = 1; year <= 31; year++) {
      const fiscalYear = projectInfo.beginningYear + year - 1;
      const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
      
      let totalExpenditures = 0;
      let totalFFB = 0;
      let totalCostThisYear = 0;
      
      compStates.forEach(comp => {
        const costPerUnit = (comp.costPerUnit || 0) * inflationMultiplier;
        const compTotalCost = (comp.quantity || 0) * costPerUnit;
        const remainingLife = Math.max(0, comp.currentRemainingLife);
        
        let ffb = 0;
        if (comp.typicalUsefulLife > 0) {
          const effectiveAge = comp.typicalUsefulLife - remainingLife;
          ffb = (compTotalCost / comp.typicalUsefulLife) * effectiveAge;
        } else {
          ffb = compTotalCost;
        }
        
        totalFFB += ffb;
        totalCostThisYear += compTotalCost;
        
        if (remainingLife === 0) {
          totalExpenditures += compTotalCost;
        }
      });
      
      // Contributions: year 1 = starting snapshot (no contribution)
      const contributions = year === 1 ? 0 : constantContribution;
      
      const beginningBalance = year === 1
        ? projectInfo.beginningReserveBalance
        : result[year - 2].endingBalance;
      
      const interest = beginningBalance * projectInfo.interestRate;
      const endingBalance = beginningBalance + contributions + interest - totalExpenditures;
      
      result.push({
        year,
        fiscalYear,
        beginningBalance,
        contributions,
        interest,
        expenditures: totalExpenditures,
        endingBalance,
        totalFFB,
        totalCost: totalCostThisYear
      });
      
      // Cycle components
      compStates.forEach(comp => {
        if (comp.currentRemainingLife <= 0) {
          comp.currentRemainingLife = comp.typicalUsefulLife;
        } else {
          comp.currentRemainingLife -= 1;
        }
      });
    }
    
    return result;
  }
  
  // ========================================
  // Calculate year-specific annualFunding (for "Annual Contribution" column)
  // This tracks component cycling and computes totalCost/remainingLife each year
  // ========================================
  const compStatesForAF = components.map(comp => ({
    ...comp,
    currentRemainingLife: comp.estimatedRemainingLife,
  }));
  
  const yearlyAnnualFunding = [];
  
  for (let year = 1; year <= 31; year++) {
    const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
    
    let totalAnnualFunding = 0;
    
    compStatesForAF.forEach(comp => {
      const costPerUnit = (comp.costPerUnit || 0) * inflationMultiplier;
      const compTotalCost = (comp.quantity || 0) * costPerUnit;
      const remainingLife = Math.max(0, comp.currentRemainingLife);
      
      if (remainingLife > 0) {
        totalAnnualFunding += compTotalCost / remainingLife;
      } else if (comp.typicalUsefulLife > 0) {
        totalAnnualFunding += compTotalCost / comp.typicalUsefulLife;
      }
    });
    
    yearlyAnnualFunding.push(totalAnnualFunding);
    
    // Cycle components
    compStatesForAF.forEach(comp => {
      if (comp.currentRemainingLife <= 0) {
        comp.currentRemainingLife = comp.typicalUsefulLife;
      } else {
        comp.currentRemainingLife -= 1;
      }
    });
  }
  
  // ========================================
  // Find the average annual contribution using binary search
  // Goal: find the minimum constant contribution that keeps ending balance ≥ 0
  // ========================================
  let averageAnnualContribution;
  
  if (thresholdRate === null) {
    // Binary search for the constant contribution that keeps the fund fully funded
    // Target: ending balance in year 31 should equal the FFB (fully funded balance)
    // This ensures the fund maintains adequate reserves throughout
    let low = 0;
    let high = yearlyAnnualFunding[0] * 3; // generous upper bound
    
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const testFlow = runCashFlow(mid);
      
      // Check if the final year ending balance >= final year FFB
      const lastYear = testFlow[testFlow.length - 1];
      
      if (lastYear.endingBalance >= lastYear.totalFFB) {
        high = mid; // Can go lower
      } else {
        low = mid; // Need more
      }
    }
    
    averageAnnualContribution = high;
  } else {
    // For threshold scenarios, contribution = currentAnnualContribution * (1 + rate)
    // (This branch isn't used for Full Funding)
    averageAnnualContribution = projectInfo.currentAnnualContribution * (1 + thresholdRate);
  }
  
  // ========================================
  // Build the final cash flow using the determined contribution
  // ========================================
  const cashFlowData = runCashFlow(averageAnnualContribution);
  
  // Convert to the expected output format
  const years = cashFlowData.map((yearData, i) => {
    return {
      year: yearData.year,
      fiscalYear: yearData.fiscalYear,
      componentBreakdowns: [], // Not needed for cash flow display
      totals: {
        overall: {
          totalCost: yearData.totalCost,
          fullFundingBalance: yearData.totalFFB,
          annualFunding: yearlyAnnualFunding[i],
          expenditures: yearData.expenditures
        }
      },
      reserveBalance: {
        beginningBalance: yearData.beginningBalance,
        contributions: yearData.contributions,
        interest: yearData.interest,
        expenditures: yearData.expenditures,
        endingBalance: yearData.endingBalance,
        percentFunded: yearData.totalFFB > 0 ? yearData.beginningBalance / yearData.totalFFB : 0
      }
    };
  });
  
  const totalContributions = sum(years, y => y.reserveBalance.contributions);
  
  return {
    thresholdRate,
    years,
    totalContributions,
    averageAnnualContribution,
    yearlyAnnualFunding
  };
}

/**
 * Calculate summary for dashboard
 * 
 * Includes per-category breakdown with FFB, currentReserveFunds (distributed
 * by FFB ratio), fundsNeeded, and annualFunding for the Component Schedule Summary table.
 */
function calculateSummary(yearOne, projectInfo) {
  const beginningBalance = projectInfo.beginningReserveBalance || 0;
  const totalFFB = yearOne.totals.overall.fullFundingBalance || 0;
  
  // Build per-category data from already-computed component-level data
  // The aggregateByComponentType already summed currentReserveFunds, fundsNeeded, etc.
  const byCategory = Object.entries(yearOne.totals)
    .filter(([key]) => key !== 'overall')
    .map(([category, data]) => {
      // Per-category percent funded = currentReserveFunds / FFB
      // (currentReserveFunds was distributed by FFB ratio in calculateYear)
      const percentFunded = data.fullFundingBalance > 0 
        ? (data.currentReserveFunds / data.fullFundingBalance) * 100 
        : 0;
      
      return {
        category,
        count: data.count,
        totalCost: data.totalCost,
        fullFundingBalance: data.fullFundingBalance,
        annualFunding: data.annualFunding,
        currentReserveFunds: data.currentReserveFunds,
        fundsNeeded: data.fundsNeeded, // = totalCost - currentReserveFunds (per component)
        percentFunded: percentFunded,
        expenditures: data.expenditures
      };
    });
  
  // Overall funds needed = Total Replacement Cost - Beginning Balance
  const totalFundsNeeded = yearOne.totals.overall.totalCost - beginningBalance;
  
  return {
    totalComponents: yearOne.componentBreakdowns.length,
    totalReplacementCost: yearOne.totals.overall.totalCost,
    currentReserveFunds: beginningBalance,
    recommendedAnnualFunding: yearOne.totals.overall.annualFunding,
    percentFunded: yearOne.reserveBalance.percentFunded,
    fullyFundedBalance: totalFFB,
    fundsNeeded: totalFundsNeeded,
    byCategory: byCategory
  };
}

/**
 * Helper: Sum array by property
 */
function sum(array, property) {
  if (typeof property === 'function') {
    return array.reduce((total, item) => total + (property(item) || 0), 0);
  }
  return array.reduce((total, item) => total + (item[property] || 0), 0);
}

/**
 * Format currency
 */
export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
}

/**
 * Format percent
 */
export function formatPercent(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}
