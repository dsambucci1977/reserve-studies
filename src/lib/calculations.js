// src/lib/calculations.js
// Reserve Study Calculation Engine v7
// Fixes:
// 1. "Full Funding Analysis" (Annual Contribution) now correctly accounts for existing 
//    reserve balances, fixing the inflated Year 1 value (now matches Excel ~$139k).
// 2. Ensures the Annual Contribution column is calculated based on the balances 
//    projected by the Recommended (Cash Flow) plan.

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
  const fundsNeeded = totalCost - currentReserve;
  
  let annualFunding = 0;
  if (remainingLife > 0) {
    annualFunding = fundsNeeded / remainingLife;
  } else if (component.typicalUsefulLife > 0) {
    annualFunding = fundsNeeded / component.typicalUsefulLife;
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

/**
 * Calculate reserve fund balance (Projection sheet)
 */
function calculateReserveFundBalance(year, totals, projectInfo, components, previousYears) {
  let beginningBalance;
  if (year === 1) {
    beginningBalance = projectInfo.beginningReserveBalance;
  } else {
    beginningBalance = previousYears[year - 2].reserveBalance.endingBalance;
  }
  
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

/**
 * Calculate threshold scenario with proper component lifecycle tracking
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
  
  // ========================================
  // 1. Find the Average Annual Contribution (Cash Flow Method) first
  // ========================================
  let averageAnnualContribution;
  let cashFlowData = [];
  
  if (thresholdRate === null) {
    // Determine bounds by running a raw calculation first
    // Use Year 1 Component Method calc (roughly) as a starting point
    // Note: We use a simplified check here just for bounds
    let low = 0;
    // Upper bound: Total replacement cost / 2 is usually safe
    let high = components.reduce((acc, c) => acc + (c.quantity * c.costPerUnit), 0) / 2;
    
    // Binary Search for Cash Flow Adequacy
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      const testFlow = runCashFlow(mid);
      const minBalance = Math.min(...testFlow.map(y => y.endingBalance));
      
      // We want min balance >= 0 (Baseline Full Funding requirement)
      // Actually "Full Funding" usually implies maintaining 100% funded, but 
      // typically for the "Recommended" line in these reports, it solves for Positive Cash Flow
      // or "Baseline" funding (min balance > 0). The Excel often calls this "Full Funding Analysis"
      // but uses the Pooled Method to smooth it.
      
      // For "Full Funding" in strict sense, we might aim for 100% funded. 
      // However, Excel's "Average Annual Contribution" ($55k) vs Total Cost ($800k+)
      // strongly suggests a Cash Flow Baseline approach (avoid running out of money).
      
      if (minBalance >= 0) {
        high = mid;
      } else {
        low = mid;
      }
    }
    averageAnnualContribution = high;
  } else {
    averageAnnualContribution = projectInfo.currentAnnualContribution * (1 + thresholdRate);
  }
  
  // Get the FINAL Cash Flow projection using the found contribution
  cashFlowData = runCashFlow(averageAnnualContribution);

  // ========================================
  // 2. Calculate "Annual Funding" (Component Method) 
  //    BASED ON the balances from the Cash Flow Projection
  // ========================================
  const yearlyAnnualFunding = [];
  
  // Clone components for state tracking
  const compStatesForAF = components.map(comp => ({
    ...comp,
    currentRemainingLife: comp.estimatedRemainingLife,
  }));

  for (let year = 1; year <= 31; year++) {
    const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
    
    // Get the Beginning Balance for this year from our Cash Flow Projection
    // This ensures our Component Method calculation is "aware" of the money we actually have.
    const yearBeginningBalance = cashFlowData[year - 1].beginningBalance;
    
    // 2a. Calculate Total FFB for this year to determine distribution ratios
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
    
    // 2b. Calculate Annual Funding required for each component
    let totalAnnualFundingForYear = 0;
    
    compCalculations.forEach(calc => {
      // Distribute the general fund balance to this component based on its FFB share
      const ffbShare = totalFFBThisYear > 0 ? (calc.ffb / totalFFBThisYear) : 0;
      const componentReserve = yearBeginningBalance * ffbShare;
      
      // Calculate deficit/surplus
      const fundsNeeded = Math.max(0, calc.compTotalCost - componentReserve);
      
      // Component Method: Funds Needed / Remaining Life
      if (calc.remainingLife > 0) {
        totalAnnualFundingForYear += fundsNeeded / calc.remainingLife;
      } else if (calc.typicalUsefulLife > 0) {
        // If life is 0 (replacement year), normally we'd say full cost, 
        // but typically we fund for the NEXT cycle.
        // For simplicity in this report column, we often fallback to depreciation rate
        // or treat it as 1 year if it wasn't replaced yet?
        // In standard practice, if remaining life is 0, it's an expenditure year.
        // The funding requirement for THAT year is technically 0 if fully funded,
        // or the cost if unfunded.
        // Using "Funds Needed" handles this: if we have the money, funds needed is 0.
        // If we don't, we need the money NOW (divide by 1).
        totalAnnualFundingForYear += fundsNeeded; 
      }
    });
    
    yearlyAnnualFunding.push(totalAnnualFundingForYear);
    
    // Cycle components for next year loop
    compStatesForAF.forEach(comp => {
      if (comp.currentRemainingLife <= 0) {
        comp.currentRemainingLife = comp.typicalUsefulLife;
      } else {
        comp.currentRemainingLife -= 1;
      }
    });
  }
  
  // Map results for output
  const years = cashFlowData.map((yearData, i) => {
    return {
      year: yearData.year,
      fiscalYear: yearData.fiscalYear,
      componentBreakdowns: [],
      totals: {
        overall: {
          totalCost: yearData.totalCost,
          fullFundingBalance: yearData.totalFFB,
          annualFunding: yearlyAnnualFunding[i], // The corrected column
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
 */
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
