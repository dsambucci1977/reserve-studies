// src/lib/calculations.js
// Reserve Study Calculation Engine v2
// Fixes from v1:
// 1. Annual Funding = Total Cost / Useful Life (straight-line accrual, matches old program)
// 2. Summary includes per-category FFB for proper distribution
// 3. Percent Funded uses beginning balance (not ending balance after contributions)
// 4. Full Funding Balance calculation unchanged (correct)
// 5. Added currentReserveFunds per category (distributed by FFB ratio)
// 6. Added fundsNeeded per category (FFB - current reserve funds)

/**
 * Calculate complete 30-year reserve study projections
 * @param {Object} projectInfo - Site/project information
 * @param {Array} components - Array of component objects
 * @returns {Object} Complete projection results
 */
export function calculateReserveStudy(projectInfo, components) {
  const years = [];
  
  // Calculate each year (1-30)
  for (let year = 1; year <= 30; year++) {
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
 */
function calculateYear(year, projectInfo, components, previousYears) {
  const fiscalYear = projectInfo.beginningYear + year - 1;
  const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
  
  // Calculate each component for this year
  const componentBreakdowns = components.map(comp => {
    return calculateComponent(comp, year, fiscalYear, projectInfo, inflationMultiplier);
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
 *   Total Cost = Quantity × Unit Cost × Cost Adjustment Factor × Inflation
 *   Full Funding Balance (FFB) = Total Cost × (Effective Age / Useful Life)
 *   Annual Funding = Total Cost / Useful Life  (straight-line accrual)
 *   
 * NOTE: Annual Funding uses straight-line (totalCost / usefulLife), NOT the gap method
 *       (totalCost - FFB) / remainingLife. The straight-line method matches the old
 *       program's output and represents what should be set aside each year over the
 *       component's full life cycle.
 */
function calculateComponent(component, year, fiscalYear, projectInfo, inflationMultiplier) {
  // Apply cost adjustment factor and inflation
  const costPerUnit = (component.costPerUnit || 0) * 
                      projectInfo.costAdjustmentFactor * 
                      inflationMultiplier;
  
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
  
  // Annual Funding = Total Cost / Useful Life (straight-line accrual)
  // This is the amount that should be set aside each year over the component's
  // entire useful life to have the full replacement cost available when needed.
  let annualFunding = 0;
  if (component.typicalUsefulLife > 0) {
    annualFunding = totalCost / component.typicalUsefulLife;
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
    annualFunding: sum(allComponents, 'annualFunding'),
    expenditures: sum(allComponents, 'expenditures')
  };
  
  return totals;
}

/**
 * Calculate reserve fund balance (Projection sheet)
 * 
 * FIX: Percent Funded now uses beginning balance (before contributions/interest),
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
  
  // Contributions (current annual contribution)
  const contributions = projectInfo.currentAnnualContribution;
  
  // Interest earned
  const interest = beginningBalance * projectInfo.interestRate;
  
  // Expenditures (sum of all replaced components this year)
  const expenditures = totals.overall.expenditures;
  
  // Ending balance
  const endingBalance = beginningBalance + contributions + interest - expenditures;
  
  // Percent funded uses BEGINNING balance (before contributions)
  // This represents the actual funded status at the start of the year
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
 * Calculate threshold scenario
 */
function calculateThresholdScenario(projectInfo, components, thresholdRate) {
  const years = [];
  
  for (let year = 1; year <= 30; year++) {
    const yearProjection = calculateYearWithThreshold(
      year,
      projectInfo,
      components,
      thresholdRate,
      years
    );
    years.push(yearProjection);
  }
  
  const totalContributions = sum(years, y => y.reserveBalance.contributions);
  
  return {
    thresholdRate,
    years,
    totalContributions
  };
}

/**
 * Calculate year with threshold multiplier
 */
function calculateYearWithThreshold(year, projectInfo, components, thresholdRate, previousYears) {
  const fiscalYear = projectInfo.beginningYear + year - 1;
  const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
  
  const componentBreakdowns = components.map(comp => {
    return calculateComponent(comp, year, fiscalYear, projectInfo, inflationMultiplier);
  });
  
  const totals = aggregateByComponentType(componentBreakdowns);
  
  // Adjust contributions based on threshold
  let contributions = projectInfo.currentAnnualContribution;
  if (thresholdRate !== null) {
    contributions = totals.overall.annualFunding * (1 + thresholdRate);
  }
  
  let beginningBalance = year === 1 
    ? projectInfo.beginningReserveBalance 
    : previousYears[year - 2].reserveBalance.endingBalance;
  
  const interest = beginningBalance * projectInfo.interestRate;
  const expenditures = totals.overall.expenditures;
  const endingBalance = beginningBalance + contributions + interest - expenditures;
  const percentFunded = totals.overall.fullFundingBalance > 0
    ? beginningBalance / totals.overall.fullFundingBalance
    : 0;
  
  return {
    year,
    fiscalYear,
    componentBreakdowns,
    totals,
    reserveBalance: {
      beginningBalance,
      contributions,
      interest,
      expenditures,
      endingBalance,
      percentFunded
    }
  };
}

/**
 * Calculate summary for dashboard
 * 
 * v2: Now includes per-category breakdown with FFB, currentReserveFunds (distributed
 * by FFB ratio), fundsNeeded, and annualFunding for the Component Schedule Summary table.
 */
function calculateSummary(yearOne, projectInfo) {
  const beginningBalance = projectInfo.beginningReserveBalance || 0;
  const totalFFB = yearOne.totals.overall.fullFundingBalance || 0;
  
  // Build per-category data with proper distribution
  const byCategory = Object.entries(yearOne.totals)
    .filter(([key]) => key !== 'overall')
    .map(([category, data]) => {
      // Distribute beginning balance by FFB ratio (matches old program)
      const ffbShare = totalFFB > 0 ? (data.fullFundingBalance / totalFFB) : 0;
      const currentReserveFunds = beginningBalance * ffbShare;
      const fundsNeeded = data.fullFundingBalance - currentReserveFunds;
      
      // Per-category percent funded
      const percentFunded = data.fullFundingBalance > 0 
        ? (currentReserveFunds / data.fullFundingBalance) * 100 
        : 0;
      
      return {
        category,
        count: data.count,
        totalCost: data.totalCost,
        fullFundingBalance: data.fullFundingBalance,
        annualFunding: data.annualFunding,
        currentReserveFunds: currentReserveFunds,
        fundsNeeded: fundsNeeded,
        percentFunded: percentFunded,
        expenditures: data.expenditures
      };
    });
  
  // Overall funds needed
  const totalFundsNeeded = totalFFB - beginningBalance;
  
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
