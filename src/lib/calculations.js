// src/lib/calculations.js
// Reserve Study Calculation Engine v7
// Fixes:
// 1. "Full Funding Analysis" (Annual Contribution) column now correctly accounts for 
//    existing reserve balances. This fixes the Year 1 inflation ($199k -> $139k).
// 2. Ensures the component method calculation tracks accurately with the cash flow.

/**
 * Calculate complete 30-year reserve study projections
 */
export function calculateReserveStudy(projectInfo, components) {
  const years = [];
  
  // Calculate each year (1-31)
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
 */
function calculateYear(year, projectInfo, components, previousYears) {
  const fiscalYear = projectInfo.beginningYear + year - 1;
  const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
  
  let componentCurrentReserves = {};
  
  if (year === 1) {
    const beginningBalance = projectInfo.beginningReserveBalance || 0;
    
    // Pass 1: Calculate FFB for each component to determine distribution
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
  
  // Pass 2: Full component calculation
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
 */
function calculateComponent(component, year, fiscalYear, projectInfo, inflationMultiplier, componentCurrentReserve) {
  const costPerUnit = (component.costPerUnit || 0) * inflationMultiplier;
  const totalCost = (component.quantity || 0) * costPerUnit;
  const remainingLife = Math.max(0, component.estimatedRemainingLife - (year - 1));
  
  let fullFundingBalance;
  if (component.typicalUsefulLife > 0) {
    const effectiveAge = component.typicalUsefulLife - remainingLife;
    fullFundingBalance = (totalCost / component.typicalUsefulLife) * effectiveAge;
  } else {
    fullFundingBalance = totalCost;
  }
  
  const currentReserve = componentCurrentReserve || 0;
  
  // FIX: Calculate Annual Funding Requirement based on (Cost - Reserves) / Life
  const fundsNeeded = Math.max(0, totalCost - currentReserve);
  
  let annualFunding = 0;
  if (remainingLife > 0) {
    annualFunding = fundsNeeded / remainingLife;
  } else if (component.typicalUsefulLife > 0) {
    // If remaining life is 0 (replacement year), and we still need funds, 
    // it implies we are underfunded for this specific item.
    // Standard practice for the "Annual Contribution" column is to ask for the deficit.
    annualFunding = fundsNeeded; 
  }
  
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

function calculateReserveFundBalance(year, totals, projectInfo, components, previousYears) {
  let beginningBalance;
  if (year === 1) {
    beginningBalance = projectInfo.beginningReserveBalance;
  } else {
    beginningBalance = previousYears[year - 2].reserveBalance.endingBalance;
  }
  
  // FIX: Use current contribution for all years in the "Projection" view
  const contributions = projectInfo.currentAnnualContribution;
  
  const interest = beginningBalance * projectInfo.interestRate;
  const expenditures = totals.overall.expenditures;
  const endingBalance = beginningBalance + contributions + interest - expenditures;
  
  const percentFunded = totals.overall.fullFundingBalance > 0
    ? beginningBalance / totals.overall.fullFundingBalance
    : 0;
  
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

function buildExpenditureSchedule(components, years) {
  const schedule = {};
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

function calculateThresholdScenario(projectInfo, components, thresholdRate) {
  
  // Helper: Run a 31-year cash flow with component cycling
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
      
      // FIX: Apply contribution to ALL years (1-31)
      const contributions = constantContribution;
      
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
  
  // 1. Find Average Annual Contribution (Cash Flow Method)
  let averageAnnualContribution;
  let cashFlowData = [];
  
  if (thresholdRate === null) {
    // Binary Search for Baseline Funding (Balance > 0)
    let low = 0;
    // Upper bound: Total replacement cost / 2 is usually safe for annual
    let high = components.reduce((acc, c) => acc + (c.quantity * c.costPerUnit), 0) / 2;
    
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const testFlow = runCashFlow(mid);
      const minBalance = Math.min(...testFlow.map(y => y.endingBalance));
      
      if (minBalance >= 0) { // Baseline condition
        high = mid;
      } else {
        low = mid;
      }
    }
    averageAnnualContribution = high;
  } else {
    averageAnnualContribution = projectInfo.currentAnnualContribution * (1 + thresholdRate);
  }
  
  cashFlowData = runCashFlow(averageAnnualContribution);

  // 2. Calculate "Annual Funding" (Component Method) for the Projection Table
  // This must account for the projected reserve balance (allocated by FFB)
  const yearlyAnnualFunding = [];
  
  const compStatesForAF = components.map(comp => ({
    ...comp,
    currentRemainingLife: comp.estimatedRemainingLife,
  }));

  for (let year = 1; year <= 31; year++) {
    const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
    const yearBeginningBalance = cashFlowData[year - 1].beginningBalance;
    
    // 2a. Calculate Total FFB to determine distribution
    let totalFFBThisYear = 0;
    const compCalculations = compStatesForAF.map(comp => {
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
      totalFFBThisYear += ffb;
      return { compTotalCost, remainingLife, ffb, typicalUsefulLife: comp.typicalUsefulLife };
    });
    
    // 2b. Calculate Annual Funding (Component Method)
    let totalAnnualFundingForYear = 0;
    
    compCalculations.forEach(calc => {
      const ffbShare = totalFFBThisYear > 0 ? (calc.ffb / totalFFBThisYear) : 0;
      const componentReserve = yearBeginningBalance * ffbShare;
      
      // VITAL FIX: (Cost - Reserves) / Life
      const fundsNeeded = Math.max(0, calc.compTotalCost - componentReserve);
      
      if (calc.remainingLife > 0) {
        totalAnnualFundingForYear += fundsNeeded / calc.remainingLife;
      } else if (calc.typicalUsefulLife > 0) {
        totalAnnualFundingForYear += fundsNeeded; 
      }
    });
    
    yearlyAnnualFunding.push(totalAnnualFundingForYear);
    
    // Cycle components
    compStatesForAF.forEach(comp => {
      if (comp.currentRemainingLife <= 0) {
        comp.currentRemainingLife = comp.typicalUsefulLife;
      } else {
        comp.currentRemainingLife -= 1;
      }
    });
  }
  
  const years = cashFlowData.map((yearData, i) => {
    return {
      year: yearData.year,
      fiscalYear: yearData.fiscalYear,
      componentBreakdowns: [],
      totals: {
        overall: {
          totalCost: yearData.totalCost,
          fullFundingBalance: yearData.totalFFB,
          annualFunding: yearlyAnnualFunding[i], // Corrected Component Method Value
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

function calculateSummary(yearOne, projectInfo) {
  const beginningBalance = projectInfo.beginningReserveBalance || 0;
  const totalFFB = yearOne.totals.overall.fullFundingBalance || 0;
  
  const byCategory = Object.entries(yearOne.totals)
    .filter(([key]) => key !== 'overall')
    .map(([category, data]) => {
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
        fundsNeeded: data.fundsNeeded,
        percentFunded: percentFunded,
        expenditures: data.expenditures
      };
    });
  
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

function sum(array, property) {
  if (typeof property === 'function') {
    return array.reduce((total, item) => total + (property(item) || 0), 0);
  }
  return array.reduce((total, item) => total + (item[property] || 0), 0);
}

export function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value || 0);
}

export function formatPercent(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}
