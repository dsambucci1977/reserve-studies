// Professional Report Template - Beahm Consulting Format v9
// Changes from v8:
// 1. Conditional PM sections wrapped in <!--PM_START--> / <!--PM_END--> markers
// 2. Non-PM alternatives wrapped in <!--NOPM_START--> / <!--NOPM_END--> markers
// 3. Update-only sections wrapped in <!--UPDATE_START--> / <!--UPDATE_END--> markers
// 4. NJ-specific compliance wrapped in <!--NJ_START--> / <!--NJ_END--> markers
// 5. Report generator strips blocks based on studyType + state compliance settings
// 6. Non-PM reports: cover page has no PM title, single Reserve Fund card, no PM info/tables/sections
// 7. PM sections still use GREEN headers
// 8. Added REVIEW OF DRAFT REPORTS section for Update studies
//
// Marker reference:
//   <!--PM_START-->...<!--PM_END-->       = PM-only (removed when PM not required)
//   <!--NOPM_START-->...<!--NOPM_END-->   = Reserve-only (removed when PM IS required)
//   <!--UPDATE_START-->...<!--UPDATE_END-->= Update study only (removed for Full studies)
//   <!--NJ_START-->...<!--NJ_END-->       = NJ compliance text (removed for non-NJ)

export const DEFAULT_REPORT_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>{projectName} - Reserve Study Report</title>
  <style>
    @page {
      size: letter;
      margin: 0.6in 0.6in 0.75in 0.6in;
    }
    
    @media print {
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      .page-break-indicator { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    
    /* ============ EDITOR VIEW - PAGE MARGIN INDICATORS ============ */
    @media screen {
      body {
        background: #e0e0e0;
        padding: 20px;
      }
      
      .page-container {
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        margin: 0 auto 30px auto;
        padding: 0.6in;
        min-height: 10in;
        max-width: 8.5in;
        position: relative;
      }
      
      .page-break-indicator {
        border-top: 2px dashed #f97316;
        margin: 20px -0.6in;
        padding: 0;
        position: relative;
      }
      
      .page-break-indicator::before {
        content: '— PAGE BREAK —';
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%);
        background: #f97316;
        color: white;
        font-size: 9px;
        font-weight: bold;
        padding: 2px 10px;
        border-radius: 3px;
      }
      
      .page-break {
        height: 0;
        margin: 0;
        padding: 0;
      }
    }
    
    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.4;
      color: #1a1a1a;
      background: white;
      max-width: 8.5in;
      margin: 0 auto;
    }
    
    /* ============ COMPACT PAGE FOOTER ============ */
    .page-footer {
      text-align: center;
      padding: 6px 0;
      margin-top: 20px;
      border-top: 1px solid #ccc;
      font-size: 7pt;
      color: #666;
    }
    
    .page-footer .company-name {
      font-weight: bold;
      color: #1e3a5f;
    }
    
    /* ============ COVER PAGE ============ */
    .cover-page {
      min-height: 9.5in;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
      padding: 0.5in 1in 0.5in 1in;
      background: white;
      color: #1a1a1a;
    }
    
    .cover-logo {
      margin-bottom: 0.4in;
      max-width: 4in;
      max-height: 1.2in;
    }
    
    .cover-logo img {
      max-width: 100%;
      max-height: 1.2in;
      object-fit: contain;
    }
    
    .cover-project-name {
      font-size: 26pt;
      font-weight: bold;
      margin: 0.4in 0;
      color: #1e3a5f;
    }
    
    .cover-title-box {
      padding: 0.3in 0;
      margin: 0.2in 0;
    }
    
    .cover-title {
      font-size: 18pt;
      font-weight: bold;
      letter-spacing: 2px;
      color: #1a1a1a;
      margin: 0.05in 0;
    }
    
    .cover-title-highlight {
      font-size: 18pt;
      font-weight: bold;
      letter-spacing: 2px;
      background: #e07020;
      color: white;
      padding: 3px 12px;
      display: inline-block;
      margin: 0.03in 0;
    }
    
    .cover-and {
      font-size: 14pt;
      margin: 0.1in 0;
      color: #666;
    }
    
    .cover-prepared {
      margin-top: 0.5in;
      font-size: 11pt;
    }
    
    .cover-prepared p { margin: 0.08in 0; }
    
    .cover-compliance {
      margin-top: 0.4in;
      font-size: 9pt;
      font-style: italic;
      color: #666;
      border-top: 1px solid #ddd;
      padding-top: 0.2in;
    }
    
    .cover-footer {
      margin-top: auto;
      padding-top: 0.3in;
      text-align: center;
      font-size: 9pt;
      color: #666;
      border-top: 2px solid #1e3a5f;
      width: 100%;
    }
    
    .cover-footer .company-name {
      font-weight: bold;
      font-size: 10pt;
      color: #1e3a5f;
    }
    
    /* ============ TABLE OF CONTENTS ============ */
    .toc-page { padding: 0.2in; }
    
    .toc-title {
      font-size: 16pt;
      font-weight: bold;
      color: #1e3a5f;
      text-align: center;
      margin-bottom: 0.2in;
      padding-bottom: 0.1in;
      border-bottom: 2px solid #1e3a5f;
    }
    
    .toc-section {
      display: flex;
      justify-content: space-between;
      padding: 3px 8px;
      border-bottom: 1px dotted #ccc;
      font-size: 9pt;
      text-decoration: none;
      color: inherit;
    }
    
    .toc-section:hover { background: #e8f4f8; color: #1e3a5f; }
    
    /* ============ SECTION HEADERS ============ */
    .section-header {
      background: linear-gradient(90deg, #1e3a5f 0%, #2d5a87 100%);
      color: white;
      padding: 8px 12px;
      font-size: 12pt;
      font-weight: bold;
      margin: 0.15in 0 0.1in 0;
      border-radius: 3px;
    }
    
    /* GREEN for PM sections - consistent with PM Fund branding */
    .section-header-green {
      background: linear-gradient(90deg, #166534 0%, #22c55e 100%);
    }
    
    /* TEAL - kept for potential future use but PM should use green */
    .section-header-teal {
      background: linear-gradient(90deg, #0f766e 0%, #14b8a6 100%);
    }
    
    .section-header-orange {
      background: linear-gradient(90deg, #c55a11 0%, #e07020 100%);
    }
    
    .sub-header {
      font-size: 11pt;
      font-weight: bold;
      color: #1e3a5f;
      margin: 0.1in 0 0.06in 0;
      padding-bottom: 2px;
      border-bottom: 2px solid #1e3a5f;
    }
    
    /* ============ CONTENT SECTIONS ============ */
    .content-section {
      padding: 0 0.05in;
      margin-bottom: 0.08in;
    }
    
    .content-section p {
      margin: 0.06in 0;
      text-align: justify;
      font-size: 9pt;
    }
    
    /* ============ SUMMARY CARDS ============ */
    .summary-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.12in;
      margin: 0.1in 0;
    }
    
    .summary-cards-single {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.12in;
      margin: 0.1in 0;
      max-width: 50%;
    }
    
    .summary-card {
      border: 2px solid #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
    }
    
    .summary-card-header {
      padding: 5px 8px;
      font-weight: bold;
      font-size: 9pt;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .summary-card-header.reserve {
      background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      border-bottom: 2px solid #3b82f6;
    }
    
    .summary-card-header.pm {
      background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 100%);
      color: #166534;
      border-bottom: 2px solid #22c55e;
    }
    
    .summary-card-body {
      padding: 8px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    
    .summary-item {
      background: #f8f9fa;
      padding: 5px;
      border-radius: 3px;
    }
    
    .summary-label {
      font-size: 6pt;
      color: #666;
      margin-bottom: 1px;
    }
    
    .summary-value {
      font-size: 11pt;
      font-weight: bold;
      color: #1a1a1a;
    }
    
    .summary-value.highlight { color: #c55a11; }
    
    /* ============ DATA TABLES ============ */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.08in 0;
      font-size: 8pt;
    }
    
    /* Default table headers - BLUE (for Reserve Fund sections) */
    th {
      background: #1e3a5f;
      color: white;
      padding: 4px 3px;
      text-align: center;
      font-weight: bold;
      border: 1px solid #1e3a5f;
      font-size: 7pt;
    }
    
    /* GREEN table headers - for PM sections */
    .table-green th {
      background: #166534;
      color: white;
      border: 1px solid #166534;
    }
    
    /* TEAL table headers - alternative option */
    .table-teal th {
      background: #0f766e;
      color: white;
      border: 1px solid #0f766e;
    }
    
    td {
      padding: 3px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    
    tr:nth-child(even) { background: #f8f9fa; }
    
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-bold { font-weight: bold; }
    
    .total-row {
      background: #d9d9d9 !important;
      font-weight: bold;
    }
    
    .negative { color: #dc2626; font-weight: bold; }
    
    /* ============ COMPONENT TABLE ============ */
    .component-table { font-size: 7pt; }
    .component-table th { padding: 3px 2px; font-size: 6pt; }
    .component-table td { padding: 2px; }
    
    /* ============ CASH FLOW TABLE ============ */
    .cashflow-table { font-size: 7pt; }
    .cashflow-table th { padding: 3px 2px; font-size: 6pt; }
    .cashflow-table td { padding: 2px 3px; text-align: right; }
    .cashflow-table td:first-child { text-align: center; font-weight: bold; background: #f1f5f9; }
    
    /* PM Cash Flow Table - green variant */
    .cashflow-table-green th {
      background: #166534;
      color: white;
      border: 1px solid #166534;
    }
    
    /* ============ EXPENDITURE TABLE ============ */
    .expenditure-horizontal { font-size: 8pt; }
    .expenditure-horizontal th { padding: 4px; }
    .expenditure-horizontal td { padding: 3px; }
    
    /* PM Expenditure Table - green variant */
    .expenditure-table-green th {
      background: #166534;
      color: white;
      border: 1px solid #166534;
    }
    
    /* ============ NOTES TABLE ============ */
    .notes-table td:first-child { width: 50px; text-align: center; font-weight: bold; background: #f1f5f9; }
    .notes-table td:nth-child(2) { width: 150px; font-weight: bold; }
    
    /* ============ RECOMMENDATION BOXES ============ */
    .recommendation-box {
      border: 2px solid #c55a11;
      border-radius: 5px;
      margin: 0.08in 0;
      overflow: hidden;
    }
    
    .recommendation-header {
      background: linear-gradient(90deg, #fef3e8 0%, #fde8d8 100%);
      padding: 5px 8px;
      font-weight: bold;
      color: #c55a11;
      border-bottom: 1px solid #c55a11;
      font-size: 9pt;
    }
    
    .recommendation-body {
      padding: 8px;
      background: #fffbf5;
      font-size: 9pt;
    }
    
    .recommendation-box.green { border-color: #22c55e; }
    .recommendation-box.green .recommendation-header {
      background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 100%);
      color: #166534;
      border-color: #22c55e;
    }
    .recommendation-box.green .recommendation-body { background: #f0fdf4; }
    
    .recommendation-box.blue { border-color: #3b82f6; }
    .recommendation-box.blue .recommendation-header {
      background: linear-gradient(90deg, #dbeafe 0%, #bfdbfe 100%);
      color: #1e40af;
      border-color: #3b82f6;
    }
    .recommendation-box.blue .recommendation-body { background: #eff6ff; }
    
    /* ============ LISTS ============ */
    ul, ol { margin: 0.04in 0 0.04in 0.2in; font-size: 9pt; }
    li { margin: 0.02in 0; }
    
    /* ============ EDITABLE SECTIONS ============ */
    .editable-section { min-height: 8px; }
    .editable-section:focus { outline: 2px dashed #3b82f6; background: #eff6ff; }
    
    /* ============ PAGE BREAKS ============ */
    .page-break { page-break-before: always; height: 0; margin: 0; padding: 0; }
  </style>
</head>
<body>

<!-- ==================== COVER PAGE ==================== -->
<div class="cover-page">
  <div class="cover-logo">
    {organizationLogo}
  </div>
  
  <div class="cover-project-name">{projectName}</div>
  
  <div class="cover-title-box">
    <div class="cover-title">{coverTitle}</div>
    {coverSubtitle}
<!--PM_START-->
    <div class="cover-and">&amp;</div>
    <div class="cover-title">PREVENTIVE MAINTENANCE</div>
    <div class="cover-title">SCHEDULE</div>
<!--PM_END-->
  </div>
  
  <div class="cover-prepared">
    <p><strong>PREPARED BY:</strong> {companyName}</p>
    <p><strong>SUBMITTED:</strong> {currentDate}</p>
  </div>
  
<!--NJ_START-->
  <div class="cover-compliance">
    Complies with New Jersey Residential Housing Bill S2760/A4384
  </div>
<!--NJ_END-->
  
  <div class="cover-footer">
    <div class="company-name">{companyName}</div>
    <div>{companyAddress} {companyPhone}</div>
  </div>
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== TABLE OF CONTENTS ==================== -->
<div class="toc-page">
  <div class="toc-title">TABLE OF CONTENTS</div>
  
  <div class="toc-entries" style="font-size:11pt; line-height:2.2;">
    <p class="toc-entry"><a href="#_introduction">Introduction</a></p>
    <p class="toc-entry"><a href="#_description">Description of Development</a></p>
    <p class="toc-entry"><a href="#_reservechart">Reserve Study Chart</a></p>
    <p class="toc-entry"><a href="#_terms">Terms and Definitions</a></p>
    <p class="toc-entry"><a href="#_responsiblecharge">Responsible Charge</a></p>
    <p class="toc-entry"><a href="#_specialassessment">Special Assessment</a></p>
    <p class="toc-entry"><a href="#_physicalanalysis">Physical Analysis</a></p>
    <p class="toc-entry"><a href="#_componentsummary">Component Schedule Summary</a></p>
    <p class="toc-entry"><a href="#_capitalitems">Capital Items / Components</a></p>
    <p class="toc-entry"><a href="#_componentnotes">Components Notes</a></p>
    <p class="toc-entry"><a href="#_financialresults">Financial Results</a></p>
    <p class="toc-entry"><a href="#_cashflow">Reserve Fund Thirty Year Cash Flow</a></p>
    <p class="toc-entry"><a href="#_threshold">Reserve Fund Thirty Year Threshold Funding</a></p>
    <p class="toc-entry"><a href="#_expenditures">Reserve Fund Expenditures</a></p>
<!--PM_START-->
    <p class="toc-entry"><a href="#_pmsection">Preventive Maintenance</a></p>
    <p class="toc-entry"><a href="#_pmexpenditures">PM Expenditures</a></p>
    <p class="toc-entry"><a href="#_pmcashflow">PM Thirty Year Cash Flow</a></p>
<!--PM_END-->
    <p class="toc-entry"><a href="#_recommendations">Recommendations</a></p>
    <p class="toc-entry"><a href="#_disclosures">Disclosures</a></p>
    <p class="toc-entry"><a href="#_bibliography">Bibliography</a></p>
  </div>
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== INTRODUCTION ==================== -->
<a name="_introduction"></a>
<div id="introduction" class="section-header">INTRODUCTION</div>

<div class="content-section">
  <div class="sub-header">Financial Planning</div>
  <div class="editable-section">
    <p>One of the key responsibilities of the Board of Trustees or Directors is to ensure that the property is properly protected and maintained. Effective financial planning and budgeting are essential to maintaining the property and ensuring that sufficient funds are available to meet ongoing and future needs.</p>
    <p>The main objective of capital reserve planning is to ensure adequate funding for the future replacement of capital components within the community. Thoughtful planning helps distribute the cost of these projects evenly over time among owners, ensuring funds are available when needed. A well-funded reserve reduces the likelihood of significant fee increases, special assessments, or the need for loans.</p>
  </div>
  
  <div class="sub-header">Capital Reserve Study</div>
  <div class="editable-section">
    <p>A Capital Reserve Study serves as a financial planning tool that estimates the amount of money the Community Association should set aside for the future replacement of common area components. This report has been developed in accordance with the Community Associations Institute (CAI) National Reserve Study Standards. It provides guidance in evaluating and establishing a stable reserve funding strategy for anticipated repairs and replacements.</p>
  </div>
  
  <div class="sub-header">Level of Service Provided</div>
  <div class="editable-section">
    {levelOfServiceText}
  </div>
</div>

<!-- ==================== DESCRIPTION ==================== -->
<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>
<a name="_description"></a>
<div id="description" class="section-header">DESCRIPTION OF DEVELOPMENT</div>

<div class="content-section">
  <div class="editable-section">
    <p>{projectName} consists of a {buildingType} comprising {totalUnits} residential units. The community is located in {projectLocation}.</p>
    <p>Residents access the building through both front and rear entrance stoops. Additional common areas within the community include the front sidewalk, front paver walkway, fencing, exterior building and landscape lighting, the building's exterior, interior hallways and lobbies, as well as the common area HVAC system and domestic hot water infrastructure.</p>
  </div>
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== RESERVE STUDY CHART (own page) ==================== -->
<a name="_reservechart"></a>
<div id="reserve-chart" class="section-header">RESERVE STUDY CHART</div>

<div class="content-section">
<!--PM_START-->
  <div class="summary-cards">
    <div class="summary-card">
      <div class="summary-card-header reserve">💰 Reserve Fund</div>
      <div class="summary-card-body">
        <div class="summary-item">
          <div class="summary-label">Percent Funded</div>
          <div class="summary-value">{percentFunded}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Balance</div>
          <div class="summary-value">{beginningReserveBalance}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Contribution</div>
          <div class="summary-value">{currentAnnualContribution}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Recommended</div>
          <div class="summary-value highlight">{recommendedAnnualFunding}</div>
        </div>
      </div>
    </div>
    <div class="summary-card">
      <div class="summary-card-header pm">🟢 PM Fund</div>
      <div class="summary-card-body">
        <div class="summary-item">
          <div class="summary-label">Percent Funded</div>
          <div class="summary-value">{pmPercentFunded}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Balance</div>
          <div class="summary-value">{pmBeginningBalance}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Contribution</div>
          <div class="summary-value">{pmCurrentContribution}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Recommended</div>
          <div class="summary-value highlight">{pmRecommendedFunding}</div>
        </div>
      </div>
    </div>
  </div>
<!--PM_END-->
<!--NOPM_START-->
  <div class="summary-cards-single">
    <div class="summary-card">
      <div class="summary-card-header reserve">💰 Reserve Fund</div>
      <div class="summary-card-body">
        <div class="summary-item">
          <div class="summary-label">Percent Funded</div>
          <div class="summary-value">{percentFunded}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Balance</div>
          <div class="summary-value">{beginningReserveBalance}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Current Contribution</div>
          <div class="summary-value">{currentAnnualContribution}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">Recommended</div>
          <div class="summary-value highlight">{recommendedAnnualFunding}</div>
        </div>
      </div>
    </div>
  </div>
<!--NOPM_END-->
</div>

<!-- ==================== RESERVE FUND INFO ==================== -->
<div class="section-header">RESERVE FUND INFORMATION</div>

<div class="content-section">
  <table>
    <tr><td style="width:60%;"><strong>Beginning Reserve Balance:</strong></td><td class="text-right text-bold" style="font-size:10pt;">{beginningReserveBalance}</td></tr>
    <tr><td><strong>Current Annual Contribution:</strong></td><td class="text-right text-bold" style="font-size:10pt;">{currentAnnualContribution}</td></tr>
    <tr><td><strong>Current Percent Funded:</strong></td><td class="text-right text-bold" style="font-size:10pt;">{percentFunded}</td></tr>
    <tr><td><strong>Recommended Annual Funding:</strong></td><td class="text-right text-bold" style="font-size:10pt; color:#22c55e;">{recommendedAnnualFunding}</td></tr>
    <tr><td><strong>Averaging Length in Years:</strong></td><td class="text-right text-bold" style="font-size:10pt;">30</td></tr>
  </table>
</div>

<!-- ==================== PM FUND INFO (PM only) ==================== -->
<!--PM_START-->
<div id="pm-fund-info" class="section-header section-header-green">PREVENTIVE MAINTENANCE FUND INFORMATION</div>

<div class="content-section">
  <table class="table-green">
    <tr><td style="width:60%;"><strong>Beginning Preventive Maintenance Balance:</strong></td><td class="text-right text-bold" style="font-size:10pt;">{pmBeginningBalance}</td></tr>
    <tr><td><strong>Current Annual Contribution:</strong></td><td class="text-right text-bold" style="font-size:10pt;">{pmCurrentContribution}</td></tr>
    <tr><td><strong>Current Percent Funded:</strong></td><td class="text-right text-bold" style="font-size:10pt;">{pmPercentFunded}</td></tr>
    <tr><td><strong>Recommended Annual Funding:</strong></td><td class="text-right text-bold" style="font-size:10pt; color:#22c55e;">{pmRecommendedFunding}</td></tr>
    <tr><td><strong>Averaging Length in Years:</strong></td><td class="text-right text-bold" style="font-size:10pt;">30</td></tr>
  </table>
</div>
<!--PM_END-->

<!-- ==================== TERMS ==================== -->
<a name="_terms"></a>
<div id="terms" class="section-header">TERMS AND DEFINITIONS</div>

<div class="content-section">
  <div class="editable-section">
    <p><strong>Capital Improvements</strong> - Additions to the association's common elements that were not previously part of the community. While these new components should be incorporated into future reserve studies for ongoing replacement planning, the initial construction costs should <em>not</em> be paid from the reserve fund.</p>
    
    <p><strong>Cash Flow Method</strong> - A method of creating a reserve funding plan in which contributions are structured to align with projected, fluctuating annual reserve expenditures. Various funding scenarios are modeled against anticipated expense timelines to determine the most suitable funding strategy.</p>
    
    <p><strong>Component</strong> - Individual items listed in the reserve study as identified through the physical analysis. These components represent the common elements of the community and generally meet the following criteria:</p>
    <ol>
      <li>The association is responsible for their upkeep.</li>
      <li>They have a limited useful life.</li>
      <li>Their remaining useful life can be reasonably predicted.</li>
      <li>They exceed a minimum threshold cost.</li>
    </ol>
    <p><em>Note: Some jurisdictions may require specific components or groups of components to be included by statute.</em></p>
    
    <p><strong>Component Inventory</strong> - The process of identifying and quantifying all components to be included in the reserve study. This is achieved through on-site visual inspection, a review of association documents, past practices, and discussions with relevant association representatives.</p>
    
    <p><strong>Component Method</strong> - A funding method where the total reserve contribution is calculated based on the individual funding needs of each component.</p>
    
    <p><strong>Condition Assessment</strong> - The evaluation of a component's current condition, based on either visual observation or reported data.</p>
    
    <p><strong>Effective Age</strong> - The difference between a component's useful life and its remaining useful life. This figure may differ from chronological age due to irregular patterns of wear or usage and is often used in reserve calculations.</p>
    
    <p><strong>Financial Analysis</strong> - The portion of the reserve study that assesses the current status of reserves (as cash or percent funded) and recommends a reserve contribution strategy. It also projects reserve income and expenditures over time. This represents one of the two primary parts of a reserve study.</p>
    
    <p><strong>Fully Funded</strong> - A reserve fund is considered fully funded when the actual or projected balance equals the fully funded balance (FFB), or 100% funded.</p>
    
    <p><strong>Fully Funded Balance (FFB)</strong> - An ideal benchmark reserve balance, representing the proportion of repair or replacement cost that corresponds with the fraction of the component's life that has been "used up."</p>
    <p><strong>Formula:</strong> FFB = Current Cost × (Effective Age ÷ Useful Life)</p>
    <p><strong>Example:</strong> A component with a $10,000 replacement cost, 10-year useful life, and 4 years of effective age would have an FFB of $4,000.</p>
    
    <p><strong>Fund Status</strong> - The financial position of the reserve fund, typically expressed in terms of cash value or percent funded.</p>
    
    <p><strong>Funding Goals</strong> - These are the primary reserve funding objectives, listed below from highest to lowest financial risk:</p>
    <ul>
      <li><strong>Full Funding:</strong> Aim to keep reserves at or near 100% funded. This is the most conservative and financially secure goal. Some jurisdictions may have minimum legal requirements.</li>
      <li><strong>Threshold Funding:</strong> Maintain reserve balances above a specific dollar amount or funding percentage. Depending on the chosen threshold, this approach may be more or less conservative than Full Funding.</li>
      <li><strong>Baseline Funding:</strong> Ensure the reserve fund never drops below zero during the projection period. This is the highest-risk strategy due to the uncertainties in timing and cost of future replacements.</li>
    </ul>
    
    <p><strong>Funding Plan</strong> - A long-term strategy (minimum 20 years) that outlines how an association will fund anticipated reserve expenditures through scheduled contributions.</p>
    
    <p><strong>Funding Principles</strong> - Every funding plan must adhere to these core principles:</p>
    <ol>
      <li>Ensure funds are available when needed</li>
      <li>Maintain a stable contribution rate over time</li>
      <li>Ensure equitable contributions among owners over the years</li>
      <li>Be fiscally responsible</li>
    </ol>
    
    <p><strong>Life and Valuation Estimates</strong> - The task of determining each component's useful life, remaining useful life, and current repair or replacement cost.</p>
    
    <p><strong>Percent Funded</strong> - The ratio (as a percentage) of the actual or projected reserve balance to the fully funded balance at a specific point in time. While a useful indicator of financial health, it should be considered alongside trends and risk tolerance.</p>
    
    <p><strong>Physical Analysis</strong> - One of the two primary components of a reserve study, encompassing the component inventory, condition assessments, and life and cost estimates.</p>
    
    <p><strong>Remaining Useful Life (RUL)</strong> - Also called "remaining life (RL)," this is the estimated number of years a component will continue to function before replacement is necessary. Items scheduled for replacement in the current year are assigned a remaining life of zero.</p>
    
    <p><strong>Replacement Cost</strong> - The total cost to repair, restore, or replace a component to its original functional condition. This includes associated expenses such as design, permits, engineering, shipping, installation, and disposal.</p>
    
    <p><strong>Reserve Balance</strong> - The actual or projected amount of money available in the reserve fund at a given time, designated for major repairs or replacements. Also referred to as reserves, reserve accounts, or cash reserves. This is based on information provided and is not audited.</p>
    
    <p><strong>Reserve Provider</strong> - A professional who prepares reserve studies. Many hold credentials such as the Reserve Specialist (RS) designation from the Community Associations Institute (CAI), indicating competency in producing studies that meet national standards.</p>
    
    <p><strong>Reserve Provider Firm</strong> - A company whose core business includes preparing reserve studies for community associations.</p>
    
    <p><strong>Reserve Study</strong> - A strategic budgeting tool that identifies components the association must maintain or replace, assesses the current reserve fund status, and recommends a funding plan to meet future expenditures. It consists of two parts: the <strong>physical analysis</strong> and the <strong>financial analysis</strong>.</p>
    
    <p><strong>Useful Life (UL)</strong> - The total expected lifespan of a component from installation to replacement, assuming proper construction and maintenance in its current application.</p>
  </div>
</div>

<!-- ==================== RESPONSIBLE CHARGE ==================== -->
<a name="_responsiblecharge"></a>
<div id="responsible-charge" class="section-header">RESPONSIBLE CHARGE</div>
<div class="content-section">
  <p>A <strong>Reserve Specialist (RS)</strong> who is in responsible charge of a reserve study must provide consistent and effective oversight of all individuals performing tasks that directly impact the quality and accuracy of the study. The RS must retain sufficient records to demonstrate that they exercised appropriate and regular supervision throughout the course of the project.</p>
  <p>A Reserve Specialist will be considered <strong>not</strong> to have provided adequate supervision under the following circumstances:</p>
  <ol>
    <li><strong>Frequent or prolonged absence</strong> from the principal office where professional services are rendered—except when engaged in fieldwork or assigned to a project-specific field office.</li>
    <li><strong>Failure to personally inspect or review</strong> subordinate work when such review is necessary or appropriate to ensure quality.</li>
    <li><strong>Performing only a superficial or minimal review</strong> of plans or projects, rather than a thorough and detailed evaluation.</li>
    <li><strong>Not being personally available</strong> for consultation or site inspections when circumstances reasonably require it, or failing to provide adequate notice of availability.</li>
  </ol>
</div>

<!-- ==================== SPECIAL ASSESSMENT ==================== -->
<a name="_specialassessment"></a>
<div id="special-assessment" class="section-header">SPECIAL ASSESSMENT</div>
<div class="content-section">
  <p>A <strong>Special Assessment</strong> is a temporary fee imposed on association members in addition to regular dues or assessments. These assessments are typically used to cover unexpected or one-time expenses and are often subject to limitations or procedures outlined in the association's governing documents or applicable local laws.</p>
</div>

<!-- ==================== USEFUL LIFE ==================== -->
<div class="content-section">
  <p><strong>Useful Life (UL)</strong> - Useful Life refers to the estimated number of years a reserve component is expected to remain functional and perform its intended purpose—assuming it has been properly constructed and maintained in its current application or installation.</p>
</div>

<!-- ==================== REVIEW OF DRAFT REPORTS (Update studies only) ==================== -->
<!--UPDATE_START-->
<div id="review-draft" class="section-header">REVIEW OF DRAFT REPORTS</div>
<div class="content-section">
  <div class="editable-section">
    <p>As part of this update, a draft reserve study was submitted to the Association's Board of Directors and/or Property Manager for review. The draft included preliminary component schedules, cost estimates, and funding projections. Any comments, corrections, or additional information provided by the Association have been incorporated into this final report.</p>
    <p>The Board and/or management representative confirmed that the component inventory and associated costs accurately reflect the current condition of the community's common elements. This collaborative review process ensures the reserve study reflects the most current and accurate information available.</p>
  </div>
</div>
<!--UPDATE_END-->

<!-- ==================== PHYSICAL ANALYSIS ==================== -->
<a name="_physicalanalysis"></a>
<div id="physical-analysis" class="section-header">PHYSICAL ANALYSIS</div>
<div class="content-section">
  <p>The quantities used in the replacement cost estimates of the common elements were generated from field measurements taken during our site visit on {inspectionDate}, and/or from take-offs based on architectural and site design drawings. The remaining life expectancies of the common elements were determined through a visual site inspection of the Community, as well as information provided by the Property Manager and maintenance contractors familiar with the common elements of the Community. The common elements were identified through a review of the governing documents.</p>
  
  <p>Current replacement costs were estimated using published construction cost data referenced in the Bibliography section of this report, along with average costs provided by contractors who have performed similar projects bid out by {companyName}. Useful life and remaining useful life estimates were based on field observations and the assumption that an adequate maintenance schedule is in place and will be followed. Without proper maintenance, common elements may deteriorate more rapidly and require earlier replacement, resulting in a greater draw on reserve funds.</p>
  
  <p>Please note that these estimates are based on the professional judgment and experience of this firm and were developed in accordance with generally accepted industry standards. However, actual costs and useful life expectancies may vary due to factors beyond our control, such as market fluctuations, usage patterns, maintenance practices, deterioration rates, and weather conditions. Future updates of this report will include adjustments to reflect any significant variances in actual costs or life expectancies.</p>
  
  <p>It is recommended that this reserve study be updated every three (3) to five (5) years.</p>
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== COMPONENT SCHEDULE SUMMARY ==================== -->
<a name="_componentsummary"></a>
<div id="component-summary" class="section-header">COMPONENT SCHEDULE SUMMARY</div>

<div class="content-section">
  <p style="font-size:7pt; color:#666; margin-bottom:6px;"><em>Useful Life = Total expected lifespan | Remaining Life = Years until replacement | PM = Preventive Maintenance | Note = Component Note Reference</em></p>
  {componentSummaryTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== CAPITAL ITEMS ==================== -->
<a name="_capitalitems"></a>
<div id="capital-items" class="section-header">CAPITAL ITEMS / COMPONENTS</div>

<div class="content-section">
  <p>The following notes provide information on the location, condition, and replacement cost of the components listed in the tables. The information is based on either visual observation or information provided to the preparer from the Association, their contractors, or maintenance personnel. Review of the common elements was conducted by {companyName} on {inspectionDate}.</p>
  {categorySections}
</div>

<!-- PAGE BREAK BEFORE COMPONENT NOTES -->
<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== COMPONENT NOTES ==================== -->
<a name="_componentnotes"></a>
<div id="component-notes" class="section-header">COMPONENTS NOTES</div>

<div class="content-section">
  <p style="font-size:7pt; margin-bottom:6px;"><em>*EA = Each, *LF = Linear Foot, *LS = Lump Sum, *SF = Square Feet, *SY = Square Yard, *SQ = Square</em></p>
  {componentNotesTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== FINANCIAL RESULTS ==================== -->
<a name="_financialresults"></a>
<div id="financial-results" class="section-header">FINANCIAL RESULTS</div>

<div class="content-section">
  <p>The primary goal of capital reserve planning is to provide adequate funding for the replacement of the capital components within the community. Effective planning ensures that expenditures for these projects are spread across many years, making funds available when they are needed. An adequately funded capital reserve will prevent the need for large fee increases, special assessments, and loans.</p>
  
  <p>Averaging the annual contributions results in consistent maintenance fees, which benefits homeowners and property values.</p>
  
  <p>The charts shown in this report provide a 30-year projection of the funding requirements for {projectName}. This reserve study funding analysis includes funding options: Full Funding, Current Funding, and Threshold Funding.</p>
  
  <p><strong>Current Funding:</strong> reflects the beginning balance with the current annual contribution added and projected expenses subtracted each year. The beginning balance and current annual contribution of {beginningReserveBalance} and {currentAnnualContribution} were provided by the Property Manager. Current funding demonstrates the balances over the projection period, assuming no change in the annual contribution.</p>
  
  <p><strong>Full Funding:</strong> is the annual contribution and fund balances for each year as if each component were Fully Funded. Full funding is the amount necessary so each component will accrue its full replacement cost during its remaining life expectancy.</p>
  
  <p><strong>Threshold Funding:</strong> represents the annual contribution and fund balance for each year as if the reserve balance were to be maintained at or above a specified amount, but no lower (lowest balance). Threshold funding is calculated by adjusting Full Funding to produce the lowest acceptable balance.</p>
  
  <p>If the Association implements Threshold Funding, it is imperative that the Reserve Study be updated regularly to minimize the chances of creating a reserve fund deficit.</p>
  
  <div class="recommendation-box blue">
    <div class="recommendation-header">📊 Reserve Study Funding Summary</div>
    <div class="recommendation-body">
      <ul>
        <li>Current Annual Contribution: <strong>{currentAnnualContribution}</strong></li>
        <li>Full Funding Annual Contribution for {beginningYear}: <strong>{fullFundingContribution}</strong></li>
        <li>Full Funding Average Annual Contribution: <strong>{averageAnnualContribution}</strong></li>
      </ul>
    </div>
  </div>
  
<!--PM_START-->
  <div class="recommendation-box green">
    <div class="recommendation-header">🟢 Preventive Maintenance Funding</div>
    <div class="recommendation-body">
      <ul>
        <li>Current Annual Contribution: <strong>{pmCurrentContribution}</strong></li>
        <li>Annual Full Funding Contribution: <strong>{pmRecommendedFunding}</strong></li>
      </ul>
    </div>
  </div>
<!--PM_END-->
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== CASH FLOW (own page) ==================== -->
<a name="_cashflow"></a>
<div id="cash-flow" class="section-header">RESERVE FUND THIRTY YEAR CASH FLOW</div>

<div class="content-section">
  {reserveCashFlowTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== THRESHOLD (own page) ==================== -->
<a name="_threshold"></a>
<div id="threshold" class="section-header">RESERVE FUND THIRTY YEAR THRESHOLD FUNDING</div>

<div class="content-section">
  {thresholdProjectionTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== EXPENDITURES (own page) ==================== -->
<a name="_expenditures"></a>
<div id="expenditures" class="section-header">RESERVE FUND EXPENDITURES</div>

<div class="content-section">
  {expenditureScheduleTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== PM SECTION (own page) - PM only ==================== -->
<!--PM_START-->
<a name="_pmsection"></a>
<div id="pm-section" class="section-header section-header-green">PREVENTIVE MAINTENANCE</div>

<div class="content-section">
  <div class="sub-header" style="color: #166534; border-color: #166534;">Component Schedule Summary</div>
  {pmComponentSummaryTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== PM EXPENDITURES - PM only ==================== -->
<a name="_pmexpenditures"></a>
<div id="pm-expenditures" class="section-header section-header-green">PM EXPENDITURES</div>

<div class="content-section">
  {pmExpenditureTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>

<!-- ==================== PM CASH FLOW - PM only ==================== -->
<a name="_pmcashflow"></a>
<div id="pm-cash-flow" class="section-header section-header-green">PM THIRTY YEAR CASH FLOW</div>

<div class="content-section">
  {pmCashFlowTable}
</div>

<div class="page-break"></div>
<div class="page-break-indicator no-print"></div>
<!--PM_END-->

<!-- ==================== RECOMMENDATIONS ==================== -->
<a name="_recommendations"></a>
<div id="recommendations" class="section-header section-header-orange">RECOMMENDATIONS</div>

<div class="content-section">
  <p>The following recommendations are based on our review of the community and information provided by the Association and other representatives of {projectName}. It is our understanding that the components, their condition, and replacement costs have been reviewed and approved by the Association. {companyName} recommends the following:</p>
  
  <div class="recommendation-box">
    <div class="recommendation-header">💰 Financial Recommendation - RESERVE FUNDING</div>
    <div class="recommendation-body">
      <p>The current annual contribution of {currentAnnualContribution} is {fundingAssessment}.</p>
      <p>{companyName} recommends {fundingRecommendation} as shown on the Reserve Study Funding Plan.</p>
    </div>
  </div>
  
<!--PM_START-->
  <div class="recommendation-box green">
    <div class="recommendation-header">🟢 Preventive Maintenance Funding</div>
    <div class="recommendation-body">
      <p>Current Annual Contribution: <strong>{pmCurrentContribution}</strong><br>
      Recommended: <strong>{pmRecommendedFunding}</strong></p>
    </div>
  </div>
<!--PM_END-->
  
  <div class="recommendation-box blue">
    <div class="recommendation-header">📅 Updating the Reserve Study</div>
    <div class="recommendation-body">
      <p>{companyName} recommends updating the reserve study <strong>Every Three (3) Years</strong>.</p>
<!--NJ_START-->
      <p>New Jersey Law requires updates at a Maximum of <strong>Every Five (5) Years</strong>.</p>
<!--NJ_END-->
      <p>Regular updates will help avoid the necessity of large increases in the future.</p>
    </div>
  </div>
  
  <div class="sub-header">Final Statements</div>
  <p>In the opinion of {companyName}, the components and conditions at {projectName} are correctly and reasonably represented. This opinion is based on the information provided by the Association and other sources noted within the report.</p>
  <p>There are several variables that affect the useful lives and replacement costs of the common components. Economic forces, including material and labor prices, the overall economy, the construction industry, and local conditions, can have an effect on costs. Weather, maintenance procedures, usage, and other factors will also affect the longevity or life expectancy of the components.</p>
  <p>This report is a financial budgetary tool and should not be used for contracting or bid proposals. The replacement costs used within this report were derived from comparable projects and other sources listed in this report. The costs provided are intended to replace the components with materials of similar quality. Generally, upgrades to components are not included in the costs unless specifically noted. Unforeseen conditions can have an adverse effect on projected costs, resulting in higher replacement costs than planned.</p>
</div>

<!-- ==================== DISCLOSURES & BIBLIOGRAPHY (same page) ==================== -->
<a name="_disclosures"></a>
<div id="disclosures" class="section-header">DISCLOSURES</div>

<div class="content-section">
  <p>{companyName} is not aware of any involvement with {projectName} that could result in any actual or perceived conflicts of interest that would influence the preparation of this study.</p>
  
  <p>The physical on-site observations performed in the preparation of this study were cursory in nature and only included the accessible common and limited common elements. The surfaces of the roofs were not walked unless specifically noted within this report, and no invasive testing was employed.</p>
  
  <p>Unless specifically noted within this report, {companyName} has not utilized any assumptions regarding interest, inflation, taxes, or any other outside economic factors.</p>
  
  <p>This study was prepared by {preparedBy}, {companyName}.</p>
  
  {updateDisclosure}
  
  <p>{companyName} is not aware of any material issues which, if not disclosed, would cause a distortion of the Association's situation.</p>
  
  <p>Information provided by the official representative of the Association regarding financial, physical, quantity, or historical issues will be deemed reliable by {companyName}. The Reserve Study will reflect the information provided to the consultant and assembled for the Association's use, not for the purpose of performing an audit, quality/forensic analyses, or background checks of historical records.</p>
  
  <p>The actual or projected total presented in the Reserve Study is based upon the information provided and was not audited.</p>
  
  <p>Information provided to {companyName} about the reserve project will be considered reliable. Any on-site inspection should not be considered a project audit or quality inspection.</p>
  
  <p>The items included in the Component Inventory are based on information provided in the governing documents and by the association's managing agent. The quantities have not been field measured by a representative of {companyName} unless specifically noted.</p>
</div>

<a name="_bibliography"></a>
<div id="bibliography" class="section-header">BIBLIOGRAPHY</div>

<div class="content-section">
  <ol>
    <li><strong>Master Deed of {projectName}</strong><br>
    Prepared by {masterDeedPreparedBy}<br>
    Dated {masterDeedDate}</li>
    
    <li><strong>Best Practices for Reserve Studies/Management</strong><br>
    By the Foundation for Community Association Research<br>
    Dated 2023</li>
    
    <li><strong>National Reserve Study Standards</strong><br>
    By the Community Associations Institute<br>
    Dated 2023</li>
    
    <li><strong>Cost Works</strong><br>
    By R.S. Means Company<br>
    Dated 2025</li>
    
    <li><strong>Common Interest Realty Association Audit and Accounting Guide</strong><br>
    By the American Institute of Certified Public Accountants<br>
    Dated 2021</li>
    
<!--NJ_START-->
    <li><strong>New Jersey Reserve Study Law</strong> (referred to as NJ Senate Bill S2760 and NJ Assembly Bill A4384)<br>
    Dated 2024</li>
<!--NJ_END-->
  </ol>
</div>

<!-- ==================== PAGE FOOTER ==================== -->
<div class="page-footer">
  <span class="company-name">{companyName}</span> | {companyFullAddress} | {companyPhone}
</div>

</body>
</html>
`;

export default DEFAULT_REPORT_TEMPLATE;
