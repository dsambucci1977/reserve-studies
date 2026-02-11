// =====================================================
// CHANGES FOR: src/app/sites/[id]/calculate/page.js
// =====================================================

// ==============================
// CHANGE 1: Replace buildReplacementSchedule function
// ==============================
// FIND this function (near bottom of file, before the return/JSX):
//
//   const buildReplacementSchedule = (components, beginningYear) => {
//     const schedule = [];
//     components.forEach(component => {
//       const rul = component.estimatedRemainingLife || 0;
//       const replacementYear = beginningYear + rul;
//       schedule.push({
//         year: replacementYear,
//         description: component.description,
//         cost: component.totalCost || 0,
//         category: component.category,
//         isPM: component.isPreventiveMaintenance || false,
//       });
//     });
//     schedule.sort((a, b) => a.year - b.year);
//     return schedule;
//   };
//
// REPLACE WITH:

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


// ==============================
// CHANGE 2: Update the call to buildReplacementSchedule
// ==============================
// FIND (in the displayResults object):
//
//   replacementSchedule: buildReplacementSchedule(mappedComponents, site.beginningYear || new Date().getFullYear()),
//
// REPLACE WITH:
//
//   replacementSchedule: buildReplacementSchedule(mappedComponents, site.beginningYear || new Date().getFullYear(), costAdjustmentFactor, inflationRate),


// ==============================
// CHANGE 3: Add projectSettings to displayResults
// ==============================
// FIND (near top of displayResults object):
//
//   const displayResults = {
//     pmRequired: pmRequired,
//
// REPLACE WITH:
//
//   const displayResults = {
//     pmRequired: pmRequired,
//     projectSettings: {
//       beginningYear: reserveProjectInfo.beginningYear,
//       inflationRate: inflationRate,
//       interestRate: interestRate,
//       costAdjustmentFactor: costAdjustmentFactor,
//     },
