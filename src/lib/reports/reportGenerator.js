// Report Generation Engine - Professional Version v4
// FIXED: Load results from projections subcollection, not site.results
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function formatCurrency(value) {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

export function formatPercent(value) {
  const num = parseFloat(value) || 0;
  return num.toFixed(2) + '%';
}

export function formatDate(date) {
  if (!date) return 'N/A';
  if (date.seconds) {
    return new Date(date.seconds * 1000).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
}

export async function loadReportData(siteId, organizationId) {
  try {
    // Load site document
    const siteDoc = await getDoc(doc(db, 'sites', siteId));
    if (!siteDoc.exists()) throw new Error('Site not found');
    const site = { id: siteDoc.id, ...siteDoc.data() };

    // Load components
    const componentsSnapshot = await getDocs(collection(db, 'sites/' + siteId + '/components'));
    const components = componentsSnapshot.docs.map(function(d) { return { id: d.id, ...d.data() }; });

    // Load notes from organization
    let notes = [];
    if (organizationId) {
      try {
        const notesSnapshot = await getDocs(collection(db, 'organizations/' + organizationId + '/notes'));
        notes = notesSnapshot.docs.map(function(d) { return { id: d.id, ...d.data() }; });
      } catch (e) {
        console.log('No notes collection found');
      }
    }

    // FIXED: Load results from projections subcollection
    let results = {};
    try {
      const projectionsDoc = await getDoc(doc(db, 'sites', siteId, 'projections', 'latest'));
      if (projectionsDoc.exists()) {
        results = projectionsDoc.data();
        console.log('Loaded projections:', Object.keys(results));
      } else {
        console.log('No projections found for site');
      }
    } catch (e) {
      console.log('Error loading projections:', e);
    }

    return { site: site, components: components, notes: notes, results: results };
  } catch (error) {
    console.error('Error loading report data:', error);
    throw error;
  }
}

// Component Summary Table with full column names and PM/Note indicators
function generateComponentSummaryTable(components, notes, showPMColumn) {
  if (!components || components.length === 0) {
    return '<p><em>No components found</em></p>';
  }

  var sorted = components.slice().sort(function(a, b) {
    if (a.category !== b.category) return (a.category || '').localeCompare(b.category || '');
    return (a.description || '').localeCompare(b.description || '');
  });

  var html = '<table class="component-table">';
  html += '<thead><tr>';
  html += '<th>Component</th>';
  html += '<th>Category</th>';
  html += '<th class="text-center">Qty</th>';
  html += '<th>Unit</th>';
  html += '<th class="text-right">Unit Cost</th>';
  html += '<th class="text-right">Total Cost</th>';
  html += '<th class="text-center">Useful<br>Life</th>';
  html += '<th class="text-center">Remaining<br>Life</th>';
  html += '<th class="text-center">Replace<br>Year</th>';
  if (showPMColumn) {
    html += '<th class="text-center">PM</th>';
  }
  html += '<th class="text-center">Note</th>';
  html += '</tr></thead><tbody>';

  var totalCost = 0;
  sorted.forEach(function(comp) {
    var cost = parseFloat(comp.totalCost) || 0;
    totalCost += cost;
    
    // Find note number if assigned
    var noteNum = '';
    if (comp.assignedNoteId) {
      var note = notes.find(function(n) { return n.id === comp.assignedNoteId; });
      if (note && note.componentId) {
        noteNum = note.componentId;
      }
    }
    
    html += '<tr>';
    html += '<td>' + (comp.description || 'N/A') + '</td>';
    html += '<td>' + (comp.category || 'N/A') + '</td>';
    html += '<td class="text-center">' + (comp.quantity || 0) + '</td>';
    html += '<td>' + (comp.unit || 'EA') + '</td>';
    html += '<td class="text-right">' + formatCurrency(comp.unitCost) + '</td>';
    html += '<td class="text-right">' + formatCurrency(comp.totalCost) + '</td>';
    html += '<td class="text-center">' + (comp.usefulLife || 0) + '</td>';
    html += '<td class="text-center">' + (comp.remainingUsefulLife || 0) + '</td>';
    html += '<td class="text-center">' + (comp.replacementYear || 'N/A') + '</td>';
    if (showPMColumn) {
      html += '<td class="text-center">' + (comp.isPreventiveMaintenance ? '✓' : '') + '</td>';
    }
    html += '<td class="text-center">' + noteNum + '</td>';
    html += '</tr>';
  });

  // Total row
  html += '<tr class="total-row">';
  var colSpanBefore = 5;
  html += '<td colspan="' + colSpanBefore + '" class="text-right"><strong>TOTAL:</strong></td>';
  html += '<td class="text-right"><strong>' + formatCurrency(totalCost) + '</strong></td>';
  var colSpanAfter = showPMColumn ? 5 : 4;
  html += '<td colspan="' + colSpanAfter + '"></td>';
  html += '</tr>';

  html += '</tbody></table>';
  return html;
}

// Category table - returns empty string if no components (skip empty categories)
function generateCategoryTable(components, category, notes) {
  var filtered = components.filter(function(c) { 
    return c.category === category && !c.isPreventiveMaintenance; 
  });
  if (filtered.length === 0) return '';
  return generateComponentSummaryTable(filtered, notes, false);
}

// Component Notes Table - sorted numerically by note ID, no duplicates
function generateComponentNotesTable(components, notes) {
  var withNotes = components.filter(function(c) { return c.assignedNoteId; });
  if (withNotes.length === 0) return '<p><em>No component notes assigned</em></p>';

  // Build unique notes list sorted by componentId numerically
  var uniqueNotes = [];
  var seenIds = {};
  
  withNotes.forEach(function(comp) {
    var note = notes.find(function(n) { return n.id === comp.assignedNoteId; });
    if (note && !seenIds[note.id]) {
      seenIds[note.id] = true;
      uniqueNotes.push({
        noteId: parseInt(note.componentId) || 9999,
        componentId: note.componentId || 'N/A',
        componentName: note.componentName || comp.description,
        description: note.description || 'No description'
      });
    }
  });
  
  // Sort by note number numerically
  uniqueNotes.sort(function(a, b) { return a.noteId - b.noteId; });

  var html = '<table class="notes-table">';
  html += '<thead><tr>';
  html += '<th style="width:60px;">Note</th>';
  html += '<th style="width:200px;">Component</th>';
  html += '<th>Description</th>';
  html += '</tr></thead><tbody>';

  uniqueNotes.forEach(function(note) {
    html += '<tr>';
    html += '<td class="text-center text-bold">' + note.componentId + '</td>';
    html += '<td>' + note.componentName + '</td>';
    html += '<td>' + note.description + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

// Cash Flow Table - Uses actual data structure from calculations
function generateCashFlowTable(cashFlow, fundInfo, fundType) {
  if (!cashFlow || cashFlow.length === 0) {
    return '<p><em>No cash flow data available. Please run calculations first.</em></p>';
  }

  var headerBg = fundType === 'pm' ? '#22c55e' : '#1e3a5f';
  var currentBg = fundType === 'pm' ? '#86efac' : '#3b82f6';
  var fullBg = '#22c55e';
  var recommendedContribution = fundInfo.recommendedContribution || 0;
  var currentBalance = fundInfo.currentBalance || 0;

  var html = '<table class="cashflow-table">';
  html += '<thead>';
  html += '<tr>';
  html += '<th rowspan="2" style="background:' + headerBg + ';">Fiscal<br>Year</th>';
  html += '<th colspan="3" style="background:' + currentBg + '; text-align:center;">Current Funding</th>';
  html += '<th colspan="3" style="background:' + fullBg + '; text-align:center;">Full Funding Analysis</th>';
  html += '</tr>';
  html += '<tr>';
  html += '<th style="background:' + currentBg + ';">Current<br>Contribution</th>';
  html += '<th style="background:' + currentBg + ';">Annual<br>Expenditures</th>';
  html += '<th style="background:' + currentBg + ';">Ending<br>Balance</th>';
  html += '<th style="background:' + fullBg + ';">Annual<br>Contribution</th>';
  html += '<th style="background:' + fullBg + ';">Average Annual<br>Contribution</th>';
  html += '<th style="background:' + fullBg + ';">Ending<br>Balance</th>';
  html += '</tr>';
  html += '</thead><tbody>';

  // Track cumulative for full funding calculation
  var cumulativeExpend = 0;
  
  cashFlow.forEach(function(row, index) {
    var bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    var balanceClass = (row.endingBalance || 0) < 0 ? ' style="color:red;font-weight:bold;"' : '';
    
    // Calculate full funding ending balance
    cumulativeExpend += (row.expenditures || 0);
    var fullFundingBalance = currentBalance + (recommendedContribution * (index + 1)) - cumulativeExpend;
    
    html += '<tr style="background:' + bgColor + ';">';
    html += '<td class="text-center text-bold">' + row.year + '</td>';
    html += '<td class="text-right">' + formatCurrency(row.contributions) + '</td>';
    html += '<td class="text-right">' + formatCurrency(row.expenditures) + '</td>';
    html += '<td class="text-right"' + balanceClass + '>' + formatCurrency(row.endingBalance) + '</td>';
    html += '<td class="text-right">' + formatCurrency(recommendedContribution) + '</td>';
    html += '<td class="text-right">' + formatCurrency(recommendedContribution) + '</td>';
    html += '<td class="text-right">' + formatCurrency(fullFundingBalance) + '</td>';
    html += '</tr>';
  });

  // Totals row
  var totalContributions = cashFlow.reduce(function(sum, r) { return sum + (r.contributions || 0); }, 0);
  var totalExpend = cashFlow.reduce(function(sum, r) { return sum + (r.expenditures || 0); }, 0);
  
  html += '<tr class="total-row">';
  html += '<td class="text-center text-bold">TOTAL</td>';
  html += '<td class="text-right">' + formatCurrency(totalContributions) + '</td>';
  html += '<td class="text-right">' + formatCurrency(totalExpend) + '</td>';
  html += '<td></td>';
  html += '<td class="text-right">' + formatCurrency(recommendedContribution * 30) + '</td>';
  html += '<td class="text-right">' + formatCurrency(recommendedContribution * 30) + '</td>';
  html += '<td></td>';
  html += '</tr>';

  html += '</tbody></table>';
  return html;
}

// Threshold Table - Uses projection10 from thresholds
function generateThresholdTable(thresholds, reserveCashFlow, reserveFund) {
  var projection = thresholds.projection10 || [];
  
  if (projection.length === 0 && reserveCashFlow && reserveCashFlow.length > 0) {
    // If no projection10, build from reserveCashFlow with threshold multiplier
    var multiplier = thresholds.multiplier10 || 1;
    var beginningBalance = reserveFund.currentBalance || 0;
    projection = reserveCashFlow.map(function(row, idx) {
      var contribution = Math.round((reserveFund.recommendedContribution || 0) * multiplier);
      return {
        year: row.year,
        contribution: contribution,
        expenditures: row.expenditures || 0,
        endingBalance: row.endingBalance || 0,
        percentOfBeginning: beginningBalance > 0 ? ((row.endingBalance || 0) / beginningBalance * 100) : 0
      };
    });
  }
  
  if (projection.length === 0) {
    return '<p><em>No threshold data available. Please run calculations first.</em></p>';
  }
  
  var html = '<table class="cashflow-table">';
  html += '<thead><tr style="background:#1e3a5f; color:white;">';
  html += '<th>Fiscal<br>Year</th>';
  html += '<th>Annual<br>Contribution</th>';
  html += '<th>Annual<br>Expenditures</th>';
  html += '<th>Ending<br>Balance</th>';
  html += '<th>% of Beginning<br>Balance</th>';
  html += '</tr></thead><tbody>';

  projection.forEach(function(row, index) {
    var bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    var balanceClass = (row.endingBalance || 0) < 0 ? ' style="color:red;font-weight:bold;"' : '';
    
    html += '<tr style="background:' + bgColor + ';">';
    html += '<td class="text-center text-bold">' + row.year + '</td>';
    html += '<td class="text-right">' + formatCurrency(row.contribution) + '</td>';
    html += '<td class="text-right">' + formatCurrency(row.expenditures) + '</td>';
    html += '<td class="text-right"' + balanceClass + '>' + formatCurrency(row.endingBalance) + '</td>';
    html += '<td class="text-right">' + formatPercent(row.percentOfBeginning || 0) + '</td>';
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

// Horizontal Expenditure Table (Year | Components | Total - fits on page)
function generateExpenditureTable(components, startYear, years, isPM) {
  startYear = parseInt(startYear) || 2026;
  years = years || 30;
  
  var filteredComponents = isPM 
    ? components.filter(function(c) { return c.isPreventiveMaintenance; })
    : components.filter(function(c) { return !c.isPreventiveMaintenance; });
  
  if (filteredComponents.length === 0) {
    return '<p><em>No ' + (isPM ? 'PM' : 'reserve') + ' components found</em></p>';
  }

  var headerColor = isPM ? '#22c55e' : '#1e3a5f';

  // Build year data - only years with expenditures
  var yearData = [];
  for (var i = 0; i < years; i++) {
    var year = startYear + i;
    var expenditures = [];
    var total = 0;
    
    filteredComponents.forEach(function(comp) {
      var replaceYear = parseInt(comp.replacementYear) || (startYear + (parseInt(comp.remainingUsefulLife) || 0));
      
      if (replaceYear === year) {
        expenditures.push({
          name: comp.description,
          cost: parseFloat(comp.totalCost) || 0
        });
        total += parseFloat(comp.totalCost) || 0;
      }
    });
    
    if (total > 0) {
      yearData.push({
        year: year,
        expenditures: expenditures,
        total: total
      });
    }
  }

  if (yearData.length === 0) {
    return '<p><em>No expenditures scheduled in the next ' + years + ' years</em></p>';
  }

  // Horizontal table: Years as rows
  var html = '<table class="expenditure-horizontal">';
  html += '<thead><tr style="background:' + headerColor + '; color:white;">';
  html += '<th style="width:80px;">Year</th>';
  html += '<th>Components to be Replaced</th>';
  html += '<th style="width:120px; text-align:right;">Total Cost</th>';
  html += '</tr></thead><tbody>';

  yearData.forEach(function(yd, index) {
    var bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    var componentList = yd.expenditures.map(function(e) {
      return e.name + ' (' + formatCurrency(e.cost) + ')';
    }).join('; ');
    
    html += '<tr style="background:' + bgColor + ';">';
    html += '<td class="text-center text-bold">' + yd.year + '</td>';
    html += '<td style="font-size:9pt;">' + componentList + '</td>';
    html += '<td class="text-right text-bold">' + formatCurrency(yd.total) + '</td>';
    html += '</tr>';
  });

  // Grand total
  var grandTotal = yearData.reduce(function(sum, yd) { return sum + yd.total; }, 0);
  html += '<tr class="total-row">';
  html += '<td colspan="2" class="text-right"><strong>TOTAL ALL YEARS:</strong></td>';
  html += '<td class="text-right"><strong>' + formatCurrency(grandTotal) + '</strong></td>';
  html += '</tr>';

  html += '</tbody></table>';
  return html;
}

// PM Summary Table
function generatePMSummaryTable(components, notes) {
  var pmComponents = components.filter(function(c) { return c.isPreventiveMaintenance; });
  if (pmComponents.length === 0) return '<p><em>No preventive maintenance components</em></p>';
  return generateComponentSummaryTable(pmComponents, notes, false);
}

// Generate category sections - skip empty categories
function generateCategorySections(components, notes) {
  var categories = ['Sitework', 'Building', 'Building Exterior', 'Interior', 'Electrical', 'Mechanical', 'Special'];
  var html = '';
  
  categories.forEach(function(cat) {
    var table = generateCategoryTable(components, cat, notes);
    if (table) {
      html += '<div class="sub-header">' + cat + '</div>';
      html += table;
    }
  });
  
  if (!html) {
    html = '<p><em>No reserve components found by category</em></p>';
  }
  
  return html;
}

// Main Report Generation
export function generateReport(template, data) {
  var site = data.site;
  var components = data.components;
  var notes = data.notes;
  var results = data.results;
  
  console.log('Generating report with results:', results ? Object.keys(results) : 'none');
  
  var reserveComponents = components.filter(function(c) { return !c.isPreventiveMaintenance; });
  var pmComponents = components.filter(function(c) { return c.isPreventiveMaintenance; });
  
  var totalReplacementCost = reserveComponents.reduce(function(sum, c) { 
    return sum + (parseFloat(c.totalCost) || 0); 
  }, 0);
  
  var pmTotalCost = pmComponents.reduce(function(sum, c) { 
    return sum + (parseFloat(c.totalCost) || 0); 
  }, 0);

  // Get fund info from results
  var reserveFund = results.reserveFund || {};
  var pmFund = results.pmFund || {};
  var reserveCashFlow = results.reserveCashFlow || [];
  var pmCashFlow = results.pmCashFlow || [];
  var thresholds = results.thresholds || {};

  console.log('Reserve Fund:', reserveFund);
  console.log('PM Fund:', pmFund);

  var startYear = parseInt(site.beginningYear) || new Date().getFullYear();
  var location = ((site.city || '') + ', ' + (site.state || '')).replace(/^,\s*|,\s*$/g, '') || 'Location';

  // Use values from results, with fallbacks to site data
  var percentFunded = reserveFund.percentFunded || 0;
  var recommendedContribution = reserveFund.recommendedContribution || 0;
  var pmPercentFunded = pmFund.percentFunded || 0;
  var pmRecommendedContribution = pmFund.recommendedContribution || 0;

  var placeholders = {
    // Project Info
    projectName: site.siteName || site.projectName || 'Project Name',
    projectNumber: site.projectNumber || 'N/A',
    projectLocation: location,
    buildingType: site.buildingType || 'Residential',
    totalUnits: site.totalUnits || 'N/A',
    physicalDescription: site.physicalDescription || '',
    
    // Contact Info
    contactName: site.contactName || 'Property Manager',
    companyName: site.companyName || 'Beahm Consulting, LLC',
    managementCompany: site.managementCompany || site.companyName || 'Management Company',
    preparedBy: site.preparedBy || 'Jordan Beahm',
    
    // Dates
    currentDate: formatDate(new Date()),
    inspectionDate: site.inspectionDate ? formatDate(site.inspectionDate) : formatDate(new Date()),
    beginningYear: startYear,
    masterDeedPreparedBy: site.masterDeedPreparedBy || '{prepared by}',
    masterDeedDate: site.masterDeedDate || '{dated}',
    
    // Reserve Fund Financial - use results data
    beginningReserveBalance: formatCurrency(site.beginningReserveBalance || reserveFund.currentBalance),
    currentAnnualContribution: formatCurrency(site.currentAnnualContribution || reserveFund.currentContribution),
    percentFunded: formatPercent(percentFunded),
    recommendedAnnualFunding: formatCurrency(recommendedContribution),
    fullFundingContribution: formatCurrency(recommendedContribution),
    averageAnnualContribution: formatCurrency(recommendedContribution),
    thresholdContribution: formatCurrency(thresholds.multiplier10 ? recommendedContribution * thresholds.multiplier10 : 0),
    
    // PM Fund Financial - use results data
    pmBeginningBalance: formatCurrency(site.beginningPMBalance || pmFund.currentBalance),
    pmCurrentContribution: formatCurrency(site.currentPMContribution || pmFund.currentContribution),
    pmPercentFunded: formatPercent(pmPercentFunded),
    pmRecommendedFunding: formatCurrency(pmRecommendedContribution),
    
    // Component Counts
    totalComponents: components.length,
    reserveComponentCount: reserveComponents.length,
    pmComponentCount: pmComponents.length,
    totalReplacementCost: formatCurrency(totalReplacementCost),
    pmTotalCost: formatCurrency(pmTotalCost),
    
    // Assessment Text
    fundingAssessment: percentFunded >= 70 ? 'adequate' : 
                       percentFunded >= 50 ? 'marginally adequate' : 'inadequate',
    fundingRecommendation: 'increasing the annual contribution to ' + formatCurrency(recommendedContribution),
    
    // Generated Tables - pass fund info for full funding calculations
    componentSummaryTable: generateComponentSummaryTable(reserveComponents, notes, true),
    categorySections: generateCategorySections(components, notes),
    componentNotesTable: generateComponentNotesTable(components, notes),
    reserveCashFlowTable: generateCashFlowTable(reserveCashFlow, reserveFund, 'reserve'),
    thresholdProjectionTable: generateThresholdTable(thresholds, reserveCashFlow, reserveFund),
    expenditureScheduleTable: generateExpenditureTable(components, startYear, 30, false),
    pmComponentSummaryTable: generatePMSummaryTable(components, notes),
    pmCashFlowTable: generateCashFlowTable(pmCashFlow, pmFund, 'pm'),
    pmExpenditureTable: generateExpenditureTable(components, startYear, 30, true)
  };

  var html = template;
  Object.keys(placeholders).forEach(function(key) {
    var regex = new RegExp('\\{' + key + '\\}', 'g');
    html = html.replace(regex, placeholders[key] || '');
  });

  return html;
}
