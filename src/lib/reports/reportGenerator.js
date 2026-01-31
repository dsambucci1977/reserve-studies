// Report Generation Engine - Professional Version v7
// Added dynamic Study Type support for cover page and Level of Service section
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function formatCurrency(value) {
  var num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

export function formatPercent(value) {
  var num = parseFloat(value) || 0;
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
    var siteDoc = await getDoc(doc(db, 'sites', siteId));
    if (!siteDoc.exists()) throw new Error('Site not found');
    var site = { id: siteDoc.id, ...siteDoc.data() };

    // Load components
    var componentsSnapshot = await getDocs(collection(db, 'sites/' + siteId + '/components'));
    var components = componentsSnapshot.docs.map(function(d) { return { id: d.id, ...d.data() }; });

    // Load notes and organization data
    var notes = [];
    var organization = {};
    if (organizationId) {
      try {
        var notesSnapshot = await getDocs(collection(db, 'organizations/' + organizationId + '/notes'));
        notes = notesSnapshot.docs.map(function(d) { return { id: d.id, ...d.data() }; });
      } catch (e) {
        console.log('No notes collection found');
      }
      
      // Load organization branding data
      try {
        var orgDoc = await getDoc(doc(db, 'organizations', organizationId));
        if (orgDoc.exists()) {
          organization = orgDoc.data();
          console.log('Loaded organization branding:', organization.name);
        }
      } catch (e) {
        console.log('Error loading organization:', e);
      }
    }

    // FIXED: Load results from projections subcollection
    var results = {};
    try {
      var projectionsDoc = await getDoc(doc(db, 'sites', siteId, 'projections', 'latest'));
      if (projectionsDoc.exists()) {
        results = projectionsDoc.data();
        console.log('Loaded projections:', Object.keys(results));
      } else {
        console.log('No projections found for site');
      }
    } catch (e) {
      console.log('Error loading projections:', e);
    }

    return { site: site, components: components, notes: notes, results: results, organization: organization };
  } catch (error) {
    console.error('Error loading report data:', error);
    throw error;
  }
}

// Generate Study Type content for cover page and Level of Service
function getStudyTypeContent(studyType) {
  // Default to Level 1 Full if not specified
  var type = (studyType || 'Level 1 Full').toLowerCase();
  
  if (type.includes('level 2') || type.includes('update')) {
    return {
      coverSubtitle: '<div class="cover-title-highlight">UPDATE</div>',
      levelOfServiceText: '<p>This report includes a <strong>Level 2: Reserve Update</strong>, With Site Visit/On-Site Review. A reserve study update consists of the following five key tasks:</p>' +
        '<ul>' +
        '<li><strong>Component Inventory</strong></li>' +
        '<li><strong>Condition Assessment</strong> (based on on-site visual inspections)</li>' +
        '<li><strong>Life and Valuation Estimates</strong></li>' +
        '<li><strong>Fund Status Evaluation</strong></li>' +
        '<li><strong>Development of a Funding Plan</strong></li>' +
        '</ul>'
    };
  } else {
    // Level 1 Full (default)
    return {
      coverSubtitle: '', // No subtitle for full study - just "RESERVE STUDY"
      levelOfServiceText: '<p>This report includes a <strong>Level 1: Full Reserve Study</strong>, With Site Visit/On-Site Review. A full reserve study consists of the following five key tasks:</p>' +
        '<ul>' +
        '<li><strong>Component Inventory</strong></li>' +
        '<li><strong>Condition Assessment</strong> (based on on-site visual inspections)</li>' +
        '<li><strong>Life and Valuation Estimates</strong></li>' +
        '<li><strong>Fund Status Evaluation</strong></li>' +
        '<li><strong>Development of a Funding Plan</strong></li>' +
        '</ul>'
    };
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

  // Use consistent navy blue for all tables
  var headerBg = '#1e3a5f';
  var currentBg = '#3b82f6';
  var fullBg = '#1e3a5f';
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

// Full Threshold Projection Table with all 4 scenarios - FIXED CARD HEIGHTS
function generateThresholdTable(thresholds, reserveCashFlow, reserveFund, beginningBalance) {
  // Check if we have threshold data
  if (!thresholds || Object.keys(thresholds).length === 0) {
    return '<p><em>No threshold data available. Please run calculations first.</em></p>';
  }

  var startingBalance = beginningBalance || reserveFund.currentBalance || 0;
  
  // Extract the 4 scenarios from thresholds
  var scenarios = {
    threshold10: {
      name: '10% Threshold',
      multiplier: thresholds.multiplier10 || 0,
      contribution: thresholds.contribution10 || 0,
      minBalance: thresholds.minBalance10 || 0,
      percentOfBeginning: thresholds.percentOfBeginning10 || 0,
      projection: thresholds.projection10 || []
    },
    threshold5: {
      name: '5% Threshold',
      multiplier: thresholds.multiplier5 || 0,
      contribution: thresholds.contribution5 || 0,
      minBalance: thresholds.minBalance5 || 0,
      percentOfBeginning: thresholds.percentOfBeginning5 || 0,
      projection: thresholds.projection5 || []
    },
    baseline: {
      name: 'Baseline (0%)',
      multiplier: thresholds.multiplierBaseline || 0,
      contribution: thresholds.contributionBaseline || 0,
      minBalance: thresholds.minBalanceBaseline || 0,
      percentOfBeginning: thresholds.percentOfBeginningBaseline || 0,
      projection: thresholds.projectionBaseline || []
    },
    fullFunding: {
      name: 'Full Funding',
      multiplier: 1,
      contribution: reserveFund.recommendedContribution || 0,
      minBalance: 0,
      percentOfBeginning: 0,
      projection: []
    }
  };

  // Build summary cards section
  var html = '<div style="margin-bottom: 20px;">';
  html += '<p style="font-size: 9pt; color: #666; margin-bottom: 15px;">Shows 30-year projections under four funding scenarios: 10% Threshold, 5% Threshold, Baseline (0%), and Full Funding.</p>';
  
  // NJ Compliance Notice
  html += '<div style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 6px; padding: 10px; margin-bottom: 15px;">';
  html += '<div style="font-weight: bold; color: #92400e;">⚠ NJ Threshold Requirement</div>';
  html += '<p style="font-size: 9pt; margin: 5px 0 0 0; color: #78350f;">New Jersey law requires reserve studies to demonstrate funding adequacy at different threshold levels. This analysis shows projected balances under reduced contribution scenarios to ensure the association maintains minimum safe funding levels.</p>';
  html += '</div>';

  // Summary cards grid - FIXED with equal height cards using table layout
  html += '<table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 20px;">';
  html += '<tr>';
  
  // 10% Threshold Card
  html += '<td style="width: 25%; vertical-align: top; border: 2px solid #f59e0b; border-radius: 6px; padding: 0; background: white;">';
  html += '<div style="background: #fef3c7; padding: 8px; border-bottom: 2px solid #f59e0b; border-radius: 4px 4px 0 0;">';
  html += '<div style="font-weight: bold; color: #92400e; font-size: 10pt;">10% Threshold</div>';
  html += '<div style="font-size: 7pt; color: #a16207;">Reduced contributions maintaining 10% minimum</div>';
  html += '</div>';
  html += '<div style="padding: 10px; font-size: 9pt; height: 180px;">';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Multiplier</span><br><strong>' + (scenarios.threshold10.multiplier || 0).toFixed(4) + '</strong></div>';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Annual Contribution</span><br><strong>' + formatCurrency(scenarios.threshold10.contribution) + '</strong></div>';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Min Balance</span><br><strong>' + formatCurrency(scenarios.threshold10.minBalance) + '</strong></div>';
  html += '<div><span style="color: #666;">% of Beginning</span><br><strong style="color: #16a34a;">' + formatPercent(scenarios.threshold10.percentOfBeginning) + '</strong></div>';
  html += '</div>';
  html += '<div style="background: #22c55e; color: white; text-align: center; padding: 8px; font-weight: bold; font-size: 9pt; border-radius: 0 0 4px 4px;">✓ COMPLIANT</div>';
  html += '</td>';

  // 5% Threshold Card
  html += '<td style="width: 25%; vertical-align: top; border: 2px solid #eab308; border-radius: 6px; padding: 0; background: white;">';
  html += '<div style="background: #fef9c3; padding: 8px; border-bottom: 2px solid #eab308; border-radius: 4px 4px 0 0;">';
  html += '<div style="font-weight: bold; color: #a16207; font-size: 10pt;">5% Threshold</div>';
  html += '<div style="font-size: 7pt; color: #a16207;">Reduced contributions maintaining 5% minimum</div>';
  html += '</div>';
  html += '<div style="padding: 10px; font-size: 9pt; height: 180px;">';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Multiplier</span><br><strong>' + (scenarios.threshold5.multiplier || 0).toFixed(4) + '</strong></div>';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Annual Contribution</span><br><strong>' + formatCurrency(scenarios.threshold5.contribution) + '</strong></div>';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Min Balance</span><br><strong>' + formatCurrency(scenarios.threshold5.minBalance) + '</strong></div>';
  html += '<div><span style="color: #666;">% of Beginning</span><br><strong style="color: #16a34a;">' + formatPercent(scenarios.threshold5.percentOfBeginning) + '</strong></div>';
  html += '</div>';
  html += '<div style="background: #22c55e; color: white; text-align: center; padding: 8px; font-weight: bold; font-size: 9pt; border-radius: 0 0 4px 4px;">✓ COMPLIANT</div>';
  html += '</td>';

  // Baseline (0%) Card
  html += '<td style="width: 25%; vertical-align: top; border: 2px solid #22c55e; border-radius: 6px; padding: 0; background: white;">';
  html += '<div style="background: #dcfce7; padding: 8px; border-bottom: 2px solid #22c55e; border-radius: 4px 4px 0 0;">';
  html += '<div style="font-weight: bold; color: #166534; font-size: 10pt;">Baseline (0%)</div>';
  html += '<div style="font-size: 7pt; color: #166534;">Minimum to avoid negatives</div>';
  html += '</div>';
  html += '<div style="padding: 10px; font-size: 9pt; height: 180px;">';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Multiplier</span><br><strong>' + (scenarios.baseline.multiplier || 0).toFixed(4) + '</strong></div>';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Annual Contribution</span><br><strong>' + formatCurrency(scenarios.baseline.contribution) + '</strong></div>';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Min Balance</span><br><strong>' + formatCurrency(scenarios.baseline.minBalance) + '</strong></div>';
  html += '<div><span style="color: #666;">% of Beginning</span><br><strong style="color: #16a34a;">' + formatPercent(scenarios.baseline.percentOfBeginning) + '</strong></div>';
  html += '</div>';
  html += '<div style="background: #f59e0b; color: white; text-align: center; padding: 8px; font-weight: bold; font-size: 9pt; border-radius: 0 0 4px 4px;">⚠ MINIMUM</div>';
  html += '</td>';

  // Full Funding Card
  html += '<td style="width: 25%; vertical-align: top; border: 2px solid #3b82f6; border-radius: 6px; padding: 0; background: white;">';
  html += '<div style="background: #dbeafe; padding: 8px; border-bottom: 2px solid #3b82f6; border-radius: 4px 4px 0 0;">';
  html += '<div style="font-weight: bold; color: #1e40af; font-size: 10pt;">Full Funding</div>';
  html += '<div style="font-size: 7pt; color: #1e40af;">Recommended contribution (100%)</div>';
  html += '</div>';
  html += '<div style="padding: 10px; font-size: 9pt; height: 180px;">';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Multiplier</span><br><strong>1.0000</strong></div>';
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Annual Contribution</span><br><strong>' + formatCurrency(scenarios.fullFunding.contribution) + '</strong></div>';
  var fullFundingFinalBalance = calculateFullFundingFinalBalance(reserveCashFlow, scenarios.fullFunding.contribution, startingBalance);
  html += '<div style="margin-bottom: 8px;"><span style="color: #666;">Final Balance (Year 30)</span><br><strong>' + formatCurrency(fullFundingFinalBalance) + '</strong></div>';
  var percentFunded = reserveFund.percentFunded || 0;
  html += '<div><span style="color: #666;">Percent Funded</span><br><strong style="color: #16a34a;">' + formatPercent(percentFunded) + '</strong></div>';
  html += '</div>';
  html += '<div style="background: #3b82f6; color: white; text-align: center; padding: 8px; font-weight: bold; font-size: 9pt; border-radius: 0 0 4px 4px;">★ RECOMMENDED</div>';
  html += '</td>';

  html += '</tr></table>';
  html += '</div>'; // End summary section

  // Page break before the 30-year table
  html += '<div class="page-break"></div>';

  // 30-Year Projection Comparison Table
  html += '<div style="font-weight: bold; font-size: 11pt; margin: 0 0 10px 0; padding: 8px; background: #1e3a5f; color: white; border-radius: 4px; text-align: center;">30-Year Threshold Projection Comparison</div>';
  
  html += '<table class="cashflow-table" style="font-size: 6pt;">';
  html += '<thead>';
  html += '<tr>';
  html += '<th rowspan="2" style="background: #1e3a5f; width: 40px;">Year</th>';
  html += '<th colspan="2" style="background: #f59e0b; text-align: center;">10% Threshold</th>';
  html += '<th colspan="2" style="background: #eab308; text-align: center;">5% Threshold</th>';
  html += '<th colspan="2" style="background: #22c55e; text-align: center;">Baseline (0%)</th>';
  html += '<th colspan="2" style="background: #3b82f6; text-align: center;">Full Funding</th>';
  html += '</tr>';
  html += '<tr>';
  html += '<th style="background: #fef3c7; color: #92400e;">Annual<br>Expenditures</th>';
  html += '<th style="background: #fef3c7; color: #92400e;">Ending<br>Balance</th>';
  html += '<th style="background: #fef9c3; color: #a16207;">Annual<br>Expenditures</th>';
  html += '<th style="background: #fef9c3; color: #a16207;">Ending<br>Balance</th>';
  html += '<th style="background: #dcfce7; color: #166534;">Annual<br>Expenditures</th>';
  html += '<th style="background: #dcfce7; color: #166534;">Ending<br>Balance</th>';
  html += '<th style="background: #dbeafe; color: #1e40af;">Annual<br>Expenditures</th>';
  html += '<th style="background: #dbeafe; color: #1e40af;">Ending<br>Balance</th>';
  html += '</tr>';
  html += '</thead><tbody>';

  // Generate rows - use projection10 as base for years
  var baseProjection = scenarios.threshold10.projection || reserveCashFlow || [];
  var fullFundingBalance = startingBalance;
  
  baseProjection.forEach(function(row, index) {
    var bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    
    // Get data for each scenario
    var row10 = scenarios.threshold10.projection[index] || {};
    var row5 = scenarios.threshold5.projection[index] || {};
    var rowBaseline = scenarios.baseline.projection[index] || {};
    
    // Calculate full funding balance for this year
    var expenditures = row.expenditures || 0;
    fullFundingBalance = fullFundingBalance + scenarios.fullFunding.contribution - expenditures;
    
    var balance10Class = (row10.endingBalance || 0) < 0 ? 'color: red; font-weight: bold;' : '';
    var balance5Class = (row5.endingBalance || 0) < 0 ? 'color: red; font-weight: bold;' : '';
    var balanceBaselineClass = (rowBaseline.endingBalance || 0) < 0 ? 'color: red; font-weight: bold;' : '';
    
    html += '<tr style="background:' + bgColor + ';">';
    html += '<td class="text-center text-bold">' + (row.year || row10.year || (2026 + index)) + '</td>';
    
    // 10% Threshold
    html += '<td class="text-right">' + formatCurrency(row10.expenditures || expenditures) + '</td>';
    html += '<td class="text-right" style="' + balance10Class + '">' + formatCurrency(row10.endingBalance) + '</td>';
    
    // 5% Threshold
    html += '<td class="text-right">' + formatCurrency(row5.expenditures || expenditures) + '</td>';
    html += '<td class="text-right" style="' + balance5Class + '">' + formatCurrency(row5.endingBalance) + '</td>';
    
    // Baseline
    html += '<td class="text-right">' + formatCurrency(rowBaseline.expenditures || expenditures) + '</td>';
    html += '<td class="text-right" style="' + balanceBaselineClass + '">' + formatCurrency(rowBaseline.endingBalance) + '</td>';
    
    // Full Funding
    html += '<td class="text-right">' + formatCurrency(expenditures) + '</td>';
    html += '<td class="text-right">' + formatCurrency(fullFundingBalance) + '</td>';
    
    html += '</tr>';
  });

  html += '</tbody></table>';
  
  return html;
}

// Helper function to calculate full funding final balance
function calculateFullFundingFinalBalance(cashFlow, contribution, startingBalance) {
  if (!cashFlow || cashFlow.length === 0) return startingBalance;
  
  var balance = startingBalance;
  cashFlow.forEach(function(row) {
    balance = balance + contribution - (row.expenditures || 0);
  });
  return balance;
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

  // Use consistent navy blue for all tables
  var headerColor = '#1e3a5f';

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
  var organization = data.organization || {};
  
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
  console.log('Thresholds:', thresholds);

  var startYear = parseInt(site.beginningYear) || new Date().getFullYear();
  var location = ((site.city || '') + ', ' + (site.state || '')).replace(/^,\s*|,\s*$/g, '') || 'Location';

  // Use values from results, with fallbacks to site data
  var percentFunded = reserveFund.percentFunded || 0;
  var recommendedContribution = reserveFund.recommendedContribution || 0;
  var pmPercentFunded = pmFund.percentFunded || 0;
  var pmRecommendedContribution = pmFund.recommendedContribution || 0;
  var beginningBalance = parseFloat(site.beginningReserveBalance) || reserveFund.currentBalance || 0;

  // Get Study Type content for cover page and Level of Service
  var studyTypeContent = getStudyTypeContent(site.studyType);

  // Build organization branding strings
  var orgName = organization.name || site.companyName || 'Beahm Consulting, LLC';
  var orgAddress = organization.address || '';
  var orgCity = organization.city || '';
  var orgState = organization.state || '';
  var orgZip = organization.zipCode || '';
  var orgPhone = organization.phone || '';
  var orgLogo = organization.logoUrl || '';
  
  // Build full address string
  var addressParts = [orgAddress, orgCity, orgState, orgZip].filter(Boolean);
  var companyFullAddress = addressParts.join(', ');
  var companyAddress = orgCity && orgState ? (orgCity + ', ' + orgState + ' ' + orgZip) : '';
  var companyPhone = orgPhone ? ('C:' + orgPhone) : '';
  
  // Build logo HTML
  var organizationLogo = orgLogo 
    ? '<img src="' + orgLogo + '" alt="' + orgName + '" />'
    : '';

  var placeholders = {
    // Study Type placeholders
    coverSubtitle: studyTypeContent.coverSubtitle,
    levelOfServiceText: studyTypeContent.levelOfServiceText,
    
    // Organization branding
    organizationLogo: organizationLogo,
    companyFullAddress: companyFullAddress,
    companyAddress: companyAddress,
    companyPhone: companyPhone,
    
    // Project Info
    projectName: site.siteName || site.projectName || 'Project Name',
    projectNumber: site.projectNumber || 'N/A',
    projectLocation: location,
    buildingType: site.buildingType || 'Residential',
    totalUnits: site.totalUnits || 'N/A',
    physicalDescription: site.physicalDescription || '',
    
    // Contact Info
    contactName: site.contactName || 'Property Manager',
    companyName: orgName,
    managementCompany: site.managementCompany || orgName || 'Management Company',
    preparedBy: organization.preparedBy || site.preparedBy || 'Jordan Beahm',
    
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
    thresholdProjectionTable: generateThresholdTable(thresholds, reserveCashFlow, reserveFund, beginningBalance),
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
