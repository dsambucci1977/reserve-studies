// src/lib/calculations.js
// Reserve Study Calculation Engine
// Replicates all Google Sheets formulas

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
    summary: calculateSummary(years[0]) // Year 1 summary
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
 * Replicates Year sheet formulas (columns F, G, L, M)
 */
function calculateComponent(component, year, fiscalYear, projectInfo, inflationMultiplier) {
  // Apply cost adjustment factor and inflation
  // Column F: Value (Cost Adjustment Factor)
  // Column G: Cost Per Unit (with inflation)
  const costPerUnit = (component.costPerUnit || 0) * 
                      projectInfo.costAdjustmentFactor * 
                      inflationMultiplier;
  
  // Column H: Total Cost
  const totalCost = (component.quantity || 0) * costPerUnit;
  
  // Column J: Estimated Remaining Life for this year
  const remainingLife = Math.max(0, component.estimatedRemainingLife - (year - 1));
  
  // Column M: Full Funding Balance
  // Formula: If remaining life > 0, calculate accumulated funding, else full cost
  let fullFundingBalance;
  if (remainingLife > 0) {
    const yearsElapsed = component.typicalUsefulLife - component.estimatedRemainingLife + (year - 1);
    fullFundingBalance = (totalCost / component.typicalUsefulLife) * yearsElapsed;
  } else {
    fullFundingBalance = totalCost;
  }
  
  // Column L: Annual Funding
  // Formula: (Total Cost - Full Funding Balance) / Remaining Life
  let annualFunding = 0;
  if (remainingLife > 0) {
    annualFunding = (totalCost - fullFundingBalance) / remainingLife;
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
  
  // Percent funded
  const percentFunded = totals.overall.fullFundingBalance > 0
    ? endingBalance / totals.overall.fullFundingBalance
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
      
      // For each year, get expenditure for this component
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
  // Similar to calculateYear but with threshold adjustments
  // This is a simplified version - full implementation would match your Google Sheets threshold logic
  
  const fiscalYear = projectInfo.beginningYear + year - 1;
  const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
  
  const componentBreakdowns = components.map(comp => {
    return calculateComponent(comp, year, fiscalYear, projectInfo, inflationMultiplier);
  });
  
  const totals = aggregateByComponentType(componentBreakdowns);
  
  // Adjust contributions based on threshold
  let contributions = projectInfo.currentAnnualContribution;
  if (thresholdRate !== null) {
    // Apply threshold multiplier (simplified - adjust based on your actual formula)
    contributions = totals.overall.annualFunding * (1 + thresholdRate);
  }
  
  // Calculate reserve balance with adjusted contributions
  let beginningBalance = year === 1 
    ? projectInfo.beginningReserveBalance 
    : previousYears[year - 2].reserveBalance.endingBalance;
  
  const interest = beginningBalance * projectInfo.interestRate;
  const expenditures = totals.overall.expenditures;
  const endingBalance = beginningBalance + contributions + interest - expenditures;
  const percentFunded = totals.overall.fullFundingBalance > 0
    ? endingBalance / totals.overall.fullFundingBalance
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
 */
function calculateSummary(yearOne) {
  return {
    totalComponents: yearOne.componentBreakdowns.length,
    totalReplacementCost: yearOne.totals.overall.totalCost,
    currentReserveFunds: yearOne.reserveBalance.beginningBalance,
    recommendedAnnualFunding: yearOne.totals.overall.annualFunding,
    percentFunded: yearOne.reserveBalance.percentFunded,
    byCategory: Object.entries(yearOne.totals)
      .filter(([key]) => key !== 'overall')
      .map(([category, data]) => ({
        category,
        ...data
      }))
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
