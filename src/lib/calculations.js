// src/lib/calculations.js
// Reserve Study Calculation Engine v6
// Fixes:
// 1. Reverted Year 1 Contribution restriction. 
//    Year 1 (e.g., 2026) IS a funding year and must receive contributions.
//    (Previous v5 fix incorrectly treated it as a 0-contribution snapshot).

/**
 * Calculate complete 30-year reserve study projections
 * @param {Object} projectInfo - Site/project information
 * @param {Array} components - Array of component objects
 * @returns {Object} Complete projection results
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
  
  // FIX: Year 1 IS a funding year. Use current contribution for all years.
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

/**
 * Build expenditure schedule (30-year matrix)
 */
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
      
      // FIX: Apply contribution to ALL years (1-31). 
      // Do not skip Year 1.
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
  // Calculate year-specific annualFunding (for "Annual Contribution" column)
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
  // ========================================
  let averageAnnualContribution;
  
  if (thresholdRate === null) {
    let low = 0;
    let high = yearlyAnnualFunding[0] * 3; 
    
    for (let i = 0; i < 100; i++) {
      const mid = (low + high) / 2;
      
      // Run cash flow with this candidate contribution
      const testFlow = runCashFlow(mid);
      
      const testCompStates = components.map(comp => ({
        ...comp,
        currentRemainingLife: comp.estimatedRemainingLife,
      }));
      
      let totalAF = 0;
      
      for (let year = 1; year <= 31; year++) {
        const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
        const yearBalance = year === 1 
          ? projectInfo.beginningReserveBalance 
          : testFlow[year - 2].endingBalance;
        
        let totalFFBThisYear = 0;
        const compFFBs = testCompStates.map(comp => {
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
          return { compTotalCost, remainingLife, ffb };
        });
        
        if (year >= 2) {
          let yearAF = 0;
          testCompStates.forEach((comp, idx) => {
            const { compTotalCost, remainingLife } = compFFBs[idx];
            const ffbShare = totalFFBThisYear > 0 ? compFFBs[idx].ffb / totalFFBThisYear : 0;
            const compReserve = yearBalance * ffbShare;
            const fundsNeeded = compTotalCost - compReserve;
            
            if (remainingLife > 0) {
              yearAF += fundsNeeded / remainingLife;
            } else if (comp.typicalUsefulLife > 0) {
              yearAF += fundsNeeded / comp.typicalUsefulLife;
            }
          });
          totalAF += yearAF;
        }
        
        testCompStates.forEach(comp => {
          if (comp.currentRemainingLife <= 0) {
            comp.currentRemainingLife = comp.typicalUsefulLife;
          } else {
            comp.currentRemainingLife -= 1;
          }
        });
      }
      
      const computedAverage = totalAF / 30;
      
      if (mid > computedAverage) {
        high = mid;
      } else {
        low = mid;
      }
    }
    
    averageAnnualContribution = (low + high) / 2;
    
    const finalFlow = runCashFlow(averageAnnualContribution);
    const finalCompStates = components.map(comp => ({
      ...comp,
      currentRemainingLife: comp.estimatedRemainingLife,
    }));
    
    yearlyAnnualFunding.length = 0;
    yearlyAnnualFunding.push(0); 
    
    for (let year = 1; year <= 31; year++) {
      const inflationMultiplier = Math.pow(1 + projectInfo.inflationRate, year - 1);
      const yearBalance = year === 1 
        ? projectInfo.beginningReserveBalance 
        : finalFlow[year - 2].endingBalance;
      
      let totalFFBThisYear = 0;
      const compData = finalCompStates.map(comp => {
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
        return { compTotalCost, remainingLife, ffb };
      });
      
      let yearAF = 0;
      finalCompStates.forEach((comp, idx) => {
        const { compTotalCost, remainingLife } = compData[idx];
        const ffbShare = totalFFBThisYear > 0 ? compData[idx].ffb / totalFFBThisYear : 0;
        const compReserve = yearBalance * ffbShare;
        const fundsNeeded = compTotalCost - compReserve;
        
        if (remainingLife > 0) {
          yearAF += fundsNeeded / remainingLife;
        } else if (comp.typicalUsefulLife > 0) {
          yearAF += fundsNeeded / comp.typicalUsefulLife;
        }
      });
      
      if (year >= 2) {
        yearlyAnnualFunding.push(yearAF);
      }
      
      finalCompStates.forEach(comp => {
        if (comp.currentRemainingLife <= 0) {
          comp.currentRemainingLife = comp.typicalUsefulLife;
        } else {
          comp.currentRemainingLife -= 1;
        }
      });
    }
  } else {
    averageAnnualContribution = projectInfo.currentAnnualContribution * (1 + thresholdRate);
  }
  
  const cashFlowData = runCashFlow(averageAnnualContribution);
  
  const years = cashFlowData.map((yearData, i) => {
    return {
      year: yearData.year,
      fiscalYear: yearData.fiscalYear,
      componentBreakdowns: [],
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
