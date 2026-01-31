// src/lib/reports/jsPDFReportGenerator.js
// Professional PDF Report Generator using jsPDF
// Install: npm install jspdf jspdf-autotable

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper functions
const formatCurrency = (value) => {
  const num = parseFloat(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
};

const formatPercent = (value) => {
  const num = parseFloat(value) || 0;
  return num.toFixed(2) + '%';
};

const formatDate = (date) => {
  if (!date) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Colors
const COLORS = {
  primary: [30, 58, 95],
  secondary: [59, 130, 246],
  accent: [224, 112, 32],
  success: [34, 197, 94],
  warning: [245, 158, 11],
  text: [26, 26, 26],
  lightGray: [243, 244, 246],
  gray: [107, 114, 128],
  white: [255, 255, 255]
};

// Page setup
const PAGE = {
  width: 612,
  height: 792,
  margin: 54,
  contentWidth: 504 // 612 - 54*2
};

export async function generatePDFReport(data) {
  const { site, components, results, organization } = data;
  
  // Separate components
  const reserveComponents = components.filter(c => !c.isPreventiveMaintenance);
  const pmComponents = components.filter(c => c.isPreventiveMaintenance);
  
  // Get fund info
  const reserveFund = results?.reserveFund || {};
  const pmFund = results?.pmFund || {};
  const reserveCashFlow = results?.reserveCashFlow || [];
  const pmCashFlow = results?.pmCashFlow || [];
  const thresholds = results?.thresholds || {};
  
  // Organization info
  const company = {
    name: organization?.name || 'Beahm Consulting',
    address: [organization?.address, organization?.city, organization?.state, organization?.zipCode].filter(Boolean).join(', '),
    phone: organization?.phone || '',
    logo: organization?.logoUrl || ''
  };
  
  // Create PDF
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  let pageNum = 0;
  
  // Footer function
  const addFooter = () => {
    if (pageNum === 0) return;
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.setDrawColor(...COLORS.lightGray);
    doc.line(PAGE.margin, PAGE.height - 50, PAGE.width - PAGE.margin, PAGE.height - 50);
    doc.text(`${company.name} | ${company.address} | ${company.phone}`, PAGE.width / 2, PAGE.height - 38, { align: 'center' });
    doc.text(`Page ${pageNum}`, PAGE.width / 2, PAGE.height - 26, { align: 'center' });
  };
  
  // New page helper
  const newPage = () => {
    if (pageNum > 0) addFooter();
    if (pageNum > 0) doc.addPage();
    pageNum++;
    return 72;
  };
  
  // Section header helper
  const sectionHeader = (title, y, color = COLORS.primary) => {
    doc.setFillColor(...color);
    doc.rect(PAGE.margin, y, PAGE.contentWidth, 24, 'F');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'bold');
    doc.text(title, PAGE.margin + 10, y + 16);
    return y + 34;
  };
  
  // ========== COVER PAGE ==========
  let y = 100;
  
  // Logo or company name
  if (company.logo) {
    try {
      const img = await loadImage(company.logo);
      const dims = fitImage(img, 200, 80);
      doc.addImage(img, 'PNG', (PAGE.width - dims.w) / 2, y, dims.w, dims.h);
      y += dims.h + 30;
    } catch (e) {
      doc.setFontSize(20);
      doc.setTextColor(...COLORS.primary);
      doc.setFont('helvetica', 'bold');
      doc.text(company.name, PAGE.width / 2, y, { align: 'center' });
      y += 50;
    }
  } else {
    doc.setFontSize(20);
    doc.setTextColor(...COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text(company.name, PAGE.width / 2, y, { align: 'center' });
    y += 50;
  }
  
  // Project name
  doc.setFontSize(26);
  doc.setTextColor(...COLORS.primary);
  doc.text(site?.siteName || 'Project Name', PAGE.width / 2, y, { align: 'center' });
  y += 60;
  
  // Title
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.text);
  doc.text('RESERVE STUDY', PAGE.width / 2, y, { align: 'center' });
  y += 25;
  
  // Update badge
  if (site?.studyType?.toLowerCase().includes('update')) {
    doc.setFillColor(...COLORS.accent);
    doc.roundedRect((PAGE.width - 80) / 2, y - 5, 80, 22, 3, 3, 'F');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.white);
    doc.text('UPDATE', PAGE.width / 2, y + 10, { align: 'center' });
    y += 30;
  }
  
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.gray);
  doc.text('&', PAGE.width / 2, y, { align: 'center' });
  y += 25;
  
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.text);
  doc.text('PREVENTIVE MAINTENANCE SCHEDULE', PAGE.width / 2, y, { align: 'center' });
  y += 80;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`PREPARED BY: ${company.name}`, PAGE.width / 2, y, { align: 'center' });
  y += 18;
  doc.text(`SUBMITTED: ${formatDate(new Date())}`, PAGE.width / 2, y, { align: 'center' });
  y += 50;
  
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.gray);
  doc.text('Complies with New Jersey Residential Housing Bill S2760/A4384', PAGE.width / 2, y, { align: 'center' });
  
  // Cover footer
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(1);
  doc.line(PAGE.margin, 680, PAGE.width - PAGE.margin, 680);
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text(company.name, PAGE.width / 2, 695, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(9);
  doc.text(`${company.address} | ${company.phone}`, PAGE.width / 2, 707, { align: 'center' });

  // ========== PAGE 2: INTRODUCTION ==========
  y = newPage();
  y = sectionHeader('INTRODUCTION', y);
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Planning', PAGE.margin, y);
  doc.setDrawColor(...COLORS.primary);
  doc.line(PAGE.margin, y + 4, PAGE.width - PAGE.margin, y + 4);
  y += 18;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  const intro = 'One of the key responsibilities of the Board of Trustees or Directors is to ensure that the property is properly protected and maintained. Effective financial planning and budgeting are essential to maintaining the property and ensuring that sufficient funds are available to meet ongoing and future needs.';
  const introLines = doc.splitTextToSize(intro, PAGE.contentWidth);
  doc.text(introLines, PAGE.margin, y);
  y += introLines.length * 12 + 20;
  
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('Level of Service Provided', PAGE.margin, y);
  doc.line(PAGE.margin, y + 4, PAGE.width - PAGE.margin, y + 4);
  y += 18;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  const studyType = site?.studyType?.toLowerCase().includes('update') ? 'Level 2: Reserve Update' : 'Level 1: Full Reserve Study';
  doc.text(`This report includes a ${studyType}, With Site Visit/On-Site Review.`, PAGE.margin, y);
  y += 25;
  
  y = sectionHeader('DESCRIPTION OF DEVELOPMENT', y);
  const desc = `${site?.siteName || 'The property'} consists of a ${site?.buildingType || 'Residential'} comprising ${site?.totalUnits || 'N/A'} residential units located in ${site?.city || ''}, ${site?.state || ''}.`;
  const descLines = doc.splitTextToSize(desc, PAGE.contentWidth);
  doc.text(descLines, PAGE.margin, y);

  // ========== PAGE 3: RESERVE STUDY CHART ==========
  y = newPage();
  y = sectionHeader('RESERVE STUDY CHART', y);
  
  // Reserve Fund Box
  const boxW = (PAGE.contentWidth - 20) / 2;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(PAGE.margin, y, boxW, 95, 4, 4, 'F');
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(PAGE.margin, y, boxW, 22, 4, 4, 'F');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('Reserve Fund', PAGE.margin + 10, y + 15);
  
  let bY = y + 32;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Percent Funded', PAGE.margin + 10, bY);
  doc.text('Current Balance', PAGE.margin + boxW/2 + 5, bY);
  bY += 12;
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(formatPercent(reserveFund.percentFunded || 0), PAGE.margin + 10, bY);
  doc.text(formatCurrency(site?.beginningReserveBalance || 0), PAGE.margin + boxW/2 + 5, bY);
  bY += 20;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Current Contribution', PAGE.margin + 10, bY);
  doc.text('Recommended', PAGE.margin + boxW/2 + 5, bY);
  bY += 12;
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(site?.currentAnnualContribution || 0), PAGE.margin + 10, bY);
  doc.setTextColor(...COLORS.success);
  doc.text(formatCurrency(reserveFund.recommendedContribution || 0), PAGE.margin + boxW/2 + 5, bY);
  
  // PM Fund Box
  const pmX = PAGE.margin + boxW + 20;
  doc.setFillColor(...COLORS.lightGray);
  doc.roundedRect(pmX, y, boxW, 95, 4, 4, 'F');
  doc.setFillColor(...COLORS.success);
  doc.roundedRect(pmX, y, boxW, 22, 4, 4, 'F');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.text('PM Fund', pmX + 10, y + 15);
  
  bY = y + 32;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Percent Funded', pmX + 10, bY);
  doc.text('Current Balance', pmX + boxW/2 + 5, bY);
  bY += 12;
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(formatPercent(pmFund.percentFunded || 0), pmX + 10, bY);
  doc.text(formatCurrency(site?.beginningPMBalance || 0), pmX + boxW/2 + 5, bY);
  bY += 20;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Current Contribution', pmX + 10, bY);
  doc.text('Recommended', pmX + boxW/2 + 5, bY);
  bY += 12;
  doc.setFontSize(13);
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(site?.currentPMContribution || 0), pmX + 10, bY);
  doc.setTextColor(...COLORS.success);
  doc.text(formatCurrency(pmFund.recommendedContribution || 0), pmX + boxW/2 + 5, bY);
  
  y += 115;
  
  // Fund Info Tables
  y = sectionHeader('RESERVE FUND INFORMATION', y);
  autoTable(doc, {
    startY: y,
    body: [
      ['Beginning Reserve Balance:', formatCurrency(site?.beginningReserveBalance || 0)],
      ['Current Annual Contribution:', formatCurrency(site?.currentAnnualContribution || 0)],
      ['Current Percent Funded:', formatPercent(reserveFund.percentFunded || 0)],
      ['Recommended Annual Funding:', formatCurrency(reserveFund.recommendedContribution || 0)],
      ['Averaging Length in Years:', '30']
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 0: { cellWidth: 300 }, 1: { cellWidth: PAGE.contentWidth - 300, halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: PAGE.margin }
  });
  y = doc.lastAutoTable.finalY + 15;
  
  y = sectionHeader('PREVENTIVE MAINTENANCE FUND', y, COLORS.success);
  autoTable(doc, {
    startY: y,
    body: [
      ['Beginning PM Balance:', formatCurrency(site?.beginningPMBalance || 0)],
      ['Current Annual Contribution:', formatCurrency(site?.currentPMContribution || 0)],
      ['Current Percent Funded:', formatPercent(pmFund.percentFunded || 0)],
      ['Recommended Annual Funding:', formatCurrency(pmFund.recommendedContribution || 0)]
    ],
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 5 },
    columnStyles: { 0: { cellWidth: 300 }, 1: { cellWidth: PAGE.contentWidth - 300, halign: 'right', fontStyle: 'bold' } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: PAGE.margin }
  });

  // ========== PAGE 4: COMPONENTS ==========
  y = newPage();
  y = sectionHeader('COMPONENT SCHEDULE SUMMARY', y);
  
  const compData = reserveComponents.map(c => [
    (c.name || '').substring(0, 28),
    c.category || 'Building',
    c.quantity || '1',
    c.unit || 'EA',
    formatCurrency(c.unitCost || 0),
    formatCurrency(c.totalCost || 0),
    c.usefulLife || '',
    c.remainingLife || ''
  ]);
  
  const totalCost = reserveComponents.reduce((sum, c) => sum + (parseFloat(c.totalCost) || 0), 0);
  compData.push(['TOTAL', '', '', '', '', formatCurrency(totalCost), '', '']);
  
  autoTable(doc, {
    startY: y,
    head: [['Component', 'Category', 'Qty', 'Unit', 'Unit Cost', 'Total Cost', 'UL', 'RL']],
    body: compData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 60 },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 30, halign: 'center' },
      4: { cellWidth: 55, halign: 'right' },
      5: { cellWidth: 60, halign: 'right' },
      6: { cellWidth: 30, halign: 'center' },
      7: { cellWidth: 30, halign: 'center' }
    },
    margin: { left: PAGE.margin },
    didParseCell: (data) => {
      if (data.row.index === compData.length - 1) {
        data.cell.styles.fillColor = COLORS.primary;
        data.cell.styles.textColor = COLORS.white;
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // ========== PAGE 5: CASH FLOW ==========
  y = newPage();
  y = sectionHeader('RESERVE FUND THIRTY YEAR CASH FLOW', y);
  
  const recContrib = reserveFund.recommendedContribution || 0;
  let ffBalance = parseFloat(site?.beginningReserveBalance) || 0;
  
  const cfData = reserveCashFlow.slice(0, 30).map((row, i) => {
    ffBalance = ffBalance + recContrib - (row.expenditures || 0);
    return [
      row.year,
      formatCurrency(row.contributions || 0),
      formatCurrency(row.expenditures || 0),
      formatCurrency(row.endingBalance || 0),
      formatCurrency(recContrib),
      formatCurrency(recContrib),
      formatCurrency(ffBalance)
    ];
  });
  
  // Total row
  const totalContrib = reserveCashFlow.reduce((s, r) => s + (r.contributions || 0), 0);
  const totalExpend = reserveCashFlow.reduce((s, r) => s + (r.expenditures || 0), 0);
  cfData.push(['TOTAL', formatCurrency(totalContrib), formatCurrency(totalExpend), '', formatCurrency(recContrib * 30), formatCurrency(recContrib * 30), '']);
  
  autoTable(doc, {
    startY: y,
    head: [['Year', 'Current\nContrib', 'Annual\nExpend', 'Ending\nBalance', 'Full Fund\nContrib', 'Avg\nContrib', 'Full Fund\nBalance']],
    body: cfData,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 2 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    columnStyles: {
      0: { cellWidth: 40, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 65, halign: 'right' },
      2: { cellWidth: 65, halign: 'right' },
      3: { cellWidth: 70, halign: 'right' },
      4: { cellWidth: 65, halign: 'right' },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 70, halign: 'right' }
    },
    margin: { left: PAGE.margin },
    didParseCell: (data) => {
      // Red for negative balances
      if (data.column.index === 3 && data.section === 'body') {
        const val = parseFloat(String(data.cell.raw).replace(/[^0-9.-]/g, ''));
        if (val < 0) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
      // Style total row
      if (data.row.index === cfData.length - 1) {
        data.cell.styles.fillColor = COLORS.primary;
        data.cell.styles.textColor = COLORS.white;
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  // ========== PAGE 6: RECOMMENDATIONS ==========
  y = newPage();
  y = sectionHeader('RECOMMENDATIONS', y, COLORS.accent);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text('The following recommendations are based on our review of the community and information provided by the Association.', PAGE.margin, y);
  y += 30;
  
  // Reserve Recommendation Box
  doc.setDrawColor(...COLORS.warning);
  doc.setLineWidth(1);
  doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 70, 4, 4, 'S');
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 22, 4, 4, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.warning);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Recommendation - RESERVE FUNDING', PAGE.margin + 10, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  const pctFunded = reserveFund.percentFunded || 0;
  const assess = pctFunded >= 70 ? 'adequate' : pctFunded >= 50 ? 'marginally adequate' : 'inadequate';
  doc.text(`The current annual contribution of ${formatCurrency(site?.currentAnnualContribution || 0)} is ${assess}.`, PAGE.margin + 10, y + 38);
  doc.text(`Beahm Consulting recommends increasing the annual contribution to ${formatCurrency(reserveFund.recommendedContribution || 0)}.`, PAGE.margin + 10, y + 52);
  y += 85;
  
  // PM Recommendation Box
  doc.setDrawColor(...COLORS.success);
  doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 50, 4, 4, 'S');
  doc.setFillColor(220, 252, 231);
  doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 22, 4, 4, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.success);
  doc.setFont('helvetica', 'bold');
  doc.text('Preventive Maintenance Funding', PAGE.margin + 10, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text(`Current: ${formatCurrency(site?.currentPMContribution || 0)} | Recommended: ${formatCurrency(pmFund.recommendedContribution || 0)}`, PAGE.margin + 10, y + 38);
  y += 65;
  
  // Update Schedule Box
  doc.setDrawColor(...COLORS.secondary);
  doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 50, 4, 4, 'S');
  doc.setFillColor(219, 234, 254);
  doc.roundedRect(PAGE.margin, y, PAGE.contentWidth, 22, 4, 4, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont('helvetica', 'bold');
  doc.text('Updating the Reserve Study', PAGE.margin + 10, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text('Recommended: Every Three (3) Years. NJ Law requires updates at a Maximum of Every Five (5) Years.', PAGE.margin + 10, y + 38);

  // ========== PAGE 7: DISCLOSURES ==========
  y = newPage();
  y = sectionHeader('DISCLOSURES', y, COLORS.warning);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.text);
  doc.text('Beahm Consulting is not aware of any conflicts of interest that would influence this study.', PAGE.margin, y);
  y += 18;
  doc.text('Physical observations were cursory and included only accessible common elements.', PAGE.margin, y);
  y += 18;
  doc.text(`This study was prepared by ${organization?.preparedBy || 'Jordan Beahm'}, Beahm Consulting.`, PAGE.margin, y);
  y += 18;
  doc.text('The Reserve Study reflects information provided and was not audited.', PAGE.margin, y);
  y += 35;
  
  y = sectionHeader('BIBLIOGRAPHY', y);
  
  const bib = [
    `1. Master Deed of ${site?.siteName || 'the Property'}`,
    '2. Best Practices for Reserve Studies/Management - Foundation for Community Association Research, 2023',
    '3. National Reserve Study Standards - Community Associations Institute, 2023',
    '4. Cost Works - R.S. Means Company, 2025',
    '5. New Jersey Reserve Study Law (NJ Senate Bill S2760/A4384), 2024'
  ];
  bib.forEach(item => {
    doc.text(item, PAGE.margin, y);
    y += 16;
  });

  // Add footers to all pages
  addFooter();
  
  // Return PDF blob
  return doc.output('blob');
}

// Helper to load image
async function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Helper to fit image dimensions
function fitImage(img, maxW, maxH) {
  let w = img.width;
  let h = img.height;
  if (w > maxW) { h = (maxW / w) * h; w = maxW; }
  if (h > maxH) { w = (maxH / h) * w; h = maxH; }
  return { w, h };
}

export default generatePDFReport;
