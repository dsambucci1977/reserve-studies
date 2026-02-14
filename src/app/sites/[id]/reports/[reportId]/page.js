'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ReportEditorPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;
  const reportId = params.reportId;

  const [site, setSite] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const editorRef = useRef(null);

  useEffect(() => {
    if (user) loadData();
  }, [user, siteId, reportId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const siteDoc = await getDoc(doc(db, 'sites', siteId));
      if (siteDoc.exists()) setSite({ id: siteDoc.id, ...siteDoc.data() });

      const reportDoc = await getDoc(doc(db, 'sites/' + siteId + '/reports', reportId));
      if (reportDoc.exists()) {
        const reportData = { id: reportDoc.id, ...reportDoc.data() };
        setReport(reportData);
        setHtmlContent(reportData.htmlContent || '');
      } else {
        alert('Report not found');
        router.push('/sites/' + siteId + '/reports');
      }
    } catch (error) {
      console.error('Error loading report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (status) => {
    status = status || 'draft';
    try {
      setSaving(true);
      var content = editorRef.current ? editorRef.current.innerHTML : htmlContent;

      await updateDoc(doc(db, 'sites/' + siteId + '/reports', reportId), {
        htmlContent: content,
        status: status,
        updatedAt: new Date(),
        updatedBy: user.uid
      });

      setHtmlContent(content);
      setHasChanges(false);
      setReport(prev => ({ ...prev, status: status }));
      alert(status === 'final' ? 'Report finalized!' : 'Report saved!');
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Error saving report');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const content = editorRef.current ? editorRef.current.innerHTML : htmlContent;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownloadWord = async () => {
    setDownloading(true);
    try {
      const content = editorRef.current ? editorRef.current.innerHTML : htmlContent;
      const siteName = site?.siteName || 'Site';
      const studyTypeName = site?.studyType || 'Reserve Study';
      const fileName = `${siteName} - ${studyTypeName} Report.doc`;
      
      // Extract body content if it's a full HTML document
      let bodyContent = content;
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        bodyContent = bodyMatch[1];
      } else {
        bodyContent = content
          .replace(/<!DOCTYPE[^>]*>/gi, '')
          .replace(/<html[^>]*>/gi, '')
          .replace(/<\/html>/gi, '')
          .replace(/<head[\s\S]*?<\/head>/gi, '');
      }
      
      // ============================================================
      // DOM-BASED TRANSFORMATION
      // Parse into a temporary DOM for reliable manipulation
      // ============================================================
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = bodyContent;
      
      // 1. Strip editor-only elements
      tempDiv.querySelectorAll('.page-break-indicator, .no-print').forEach(el => el.remove());
      
      // 2. Unwrap page-container divs (keep children)
      tempDiv.querySelectorAll('.page-container').forEach(el => {
        while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
        el.remove();
      });
      
      // 3. Convert .summary-cards grid → HTML table (side-by-side cards)
      tempDiv.querySelectorAll('.summary-cards').forEach(grid => {
        const cards = grid.querySelectorAll('.summary-card');
        if (cards.length === 0) return;
        
        const table = document.createElement('table');
        table.setAttribute('width', '100%');
        table.setAttribute('cellpadding', '0');
        table.setAttribute('cellspacing', '8');
        table.style.cssText = 'border-collapse: separate; border-spacing: 8px; margin: 8px 0;';
        
        const row = document.createElement('tr');
        cards.forEach(card => {
          const td = document.createElement('td');
          td.setAttribute('width', Math.floor(100 / cards.length) + '%');
          td.setAttribute('valign', 'top');
          td.style.cssText = 'border: 2px solid #e0e0e0; padding: 0; vertical-align: top;';
          td.innerHTML = card.innerHTML;
          row.appendChild(td);
        });
        table.appendChild(row);
        grid.parentNode.replaceChild(table, grid);
      });
      
      // 4. Also handle single-card grids
      tempDiv.querySelectorAll('.summary-cards-single').forEach(grid => {
        const cards = grid.querySelectorAll('.summary-card');
        if (cards.length === 0) return;
        const table = document.createElement('table');
        table.setAttribute('width', '50%');
        table.setAttribute('cellpadding', '0');
        table.setAttribute('cellspacing', '0');
        table.style.cssText = 'border: 2px solid #e0e0e0; margin: 8px 0;';
        const row = document.createElement('tr');
        const td = document.createElement('td');
        td.style.cssText = 'padding: 0;';
        td.innerHTML = cards[0].innerHTML;
        row.appendChild(td);
        table.appendChild(row);
        grid.parentNode.replaceChild(table, grid);
      });
      
      // 5. Convert .summary-card-body grid → 2x2 table
      tempDiv.querySelectorAll('.summary-card-body').forEach(body => {
        const items = body.querySelectorAll('.summary-item');
        if (items.length === 0) return;
        
        const table = document.createElement('table');
        table.setAttribute('width', '100%');
        table.setAttribute('cellpadding', '4');
        table.setAttribute('cellspacing', '0');
        table.style.cssText = 'border-collapse: collapse;';
        
        // Create 2-column rows
        for (let i = 0; i < items.length; i += 2) {
          const row = document.createElement('tr');
          for (let j = 0; j < 2 && (i + j) < items.length; j++) {
            const item = items[i + j];
            const td = document.createElement('td');
            td.setAttribute('width', '50%');
            td.style.cssText = 'padding: 4px 8px; border-bottom: 1px solid #eee;';
            const label = item.querySelector('.summary-label');
            const value = item.querySelector('.summary-value');
            if (label && value) {
              const isHighlight = value.classList.contains('highlight');
              td.innerHTML = `<div style="font-size:7pt;color:#666;">${label.textContent}</div><div style="font-size:12pt;font-weight:bold;${isHighlight ? 'color:#c55a11;' : ''}">${value.textContent}</div>`;
            } else {
              td.innerHTML = item.innerHTML;
            }
            row.appendChild(td);
          }
          table.appendChild(row);
        }
        body.parentNode.replaceChild(table, body);
      });
      
      // 6. Apply inline styles to card headers (replace gradient with solid color)
      tempDiv.querySelectorAll('.summary-card-header').forEach(header => {
        if (header.classList.contains('reserve')) {
          header.style.cssText = 'background-color: #dbeafe; color: #1e40af; padding: 6px 8px; font-weight: bold; font-size: 9pt; text-align: center; border-bottom: 2px solid #3b82f6;';
        } else if (header.classList.contains('pm')) {
          header.style.cssText = 'background-color: #dcfce7; color: #166534; padding: 6px 8px; font-weight: bold; font-size: 9pt; text-align: center; border-bottom: 2px solid #22c55e;';
        }
      });
      
      // 7. Fix recommendation boxes (replace gradient)
      tempDiv.querySelectorAll('.recommendation-header').forEach(header => {
        header.style.cssText = (header.style.cssText || '') + 'background-color: #fef3e8; color: #c55a11; padding: 5px 8px; font-weight: bold; border-bottom: 1px solid #c55a11;';
      });
      
      // 8. Add alternating row backgrounds inline (Word ignores nth-child)
      tempDiv.querySelectorAll('table').forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, i) => {
          if (i > 0 && i % 2 === 0 && !row.classList.contains('total-row')) {
            if (!row.style.background && !row.style.backgroundColor) {
              row.style.backgroundColor = '#f8f9fa';
            }
          }
        });
      });
      
      // 9. Inline section headers (these use custom classes)
      tempDiv.querySelectorAll('.section-header').forEach(header => {
        const isGreen = header.classList.contains('section-header-green');
        const bg = isGreen ? '#166534' : '#1e3a5f';
        header.style.cssText = `background-color:${bg}; color:white; padding:8px 12px; font-size:12pt; font-weight:bold; letter-spacing:1px; margin:16px 0 0 0;`;
      });
      
      // 10. Inline sub-headers
      tempDiv.querySelectorAll('.sub-header').forEach(header => {
        header.style.cssText = 'font-size:10pt; font-weight:bold; color:#1e3a5f; border-bottom:1px solid #3b82f6; padding-bottom:3px; margin:12px 0 6px 0;';
      });
      
      // 11. Content sections padding
      tempDiv.querySelectorAll('.content-section').forEach(section => {
        section.style.cssText = 'padding: 8px 4px; margin-bottom: 8px;';
      });
      
      // 12. Cover page - convert flex layout to centered block
      tempDiv.querySelectorAll('.cover-page').forEach(cover => {
        cover.style.cssText = 'text-align:center; padding:48px 72px; min-height:700px;';
      });
      tempDiv.querySelectorAll('.cover-project-name').forEach(el => {
        el.style.cssText = 'font-size:26pt; font-weight:bold; color:#1e3a5f; margin:24px 0;';
      });
      tempDiv.querySelectorAll('.cover-title').forEach(el => {
        el.style.cssText = 'font-size:18pt; font-weight:bold; letter-spacing:2px; margin:4px 0;';
      });
      tempDiv.querySelectorAll('.cover-title-highlight').forEach(el => {
        el.style.cssText = 'font-size:18pt; font-weight:bold; letter-spacing:2px; background-color:#e07020; color:white; padding:3px 12px; margin:4px 0; display:inline-block;';
      });
      tempDiv.querySelectorAll('.cover-prepared').forEach(el => {
        el.style.cssText = 'margin-top:36px; font-size:11pt;';
      });
      tempDiv.querySelectorAll('.cover-footer').forEach(el => {
        el.style.cssText = 'margin-top:48px; font-size:9pt; color:#666;';
      });
      tempDiv.querySelectorAll('.cover-logo img').forEach(img => {
        img.style.cssText = 'max-width:300px; max-height:100px;';
      });
      
      // 13. Page footers
      tempDiv.querySelectorAll('.page-footer').forEach(footer => {
        footer.style.cssText = 'text-align:center; padding:6px 0; margin-top:16px; border-top:1px solid #ccc; font-size:7pt; color:#666;';
      });
      
      // Get the transformed HTML
      bodyContent = tempDiv.innerHTML;
      
      // ============================================================
      // CONVERT IMAGES TO BASE64
      // ============================================================
      const imgRegex = /<img[^>]+src="(https?:\/\/[^"]+)"[^>]*>/gi;
      const imgMatches = [...bodyContent.matchAll(imgRegex)];
      for (const match of imgMatches) {
        try {
          const response = await fetch(match[1]);
          const blob = await response.blob();
          const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          bodyContent = bodyContent.replace(match[1], base64);
        } catch (e) {
          console.warn('Could not embed image:', match[1], e);
        }
      }
      
      // ============================================================
      // BUILD WORD-COMPATIBLE DOCUMENT
      // ============================================================
      const wordDoc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <meta name="ProgId" content="Word.Document">
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page WordSection1 {
      size: 8.5in 11.0in;
      mso-page-orientation: portrait;
      margin: 0.75in 0.75in 0.75in 0.75in;
      mso-header-margin: 0.5in;
      mso-footer-margin: 0.5in;
    }
    div.WordSection1 { page: WordSection1; }
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      font-size: 10pt; 
      line-height: 1.4;
      color: #1a1a1a;
    }
    p { margin: 4pt 0; }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 6px 0;
      font-size: 8pt; 
    }
    th { 
      background: #1e3a5f; 
      color: white; 
      padding: 4px 3px; 
      text-align: center; 
      font-weight: bold; 
      border: 1px solid #1e3a5f; 
      font-size: 7pt; 
    }
    td { 
      padding: 3px; 
      border: 1px solid #ddd; 
      vertical-align: top; 
    }
    .table-green th { background: #166534; color: white; border: 1px solid #166534; }
    .table-teal th { background: #0f766e; color: white; border: 1px solid #0f766e; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .text-bold { font-weight: bold; }
    .total-row { background: #d9d9d9; font-weight: bold; }
    .negative { color: #dc2626; font-weight: bold; }
    .component-table { font-size: 7pt; }
    .component-table th { padding: 3px 2px; font-size: 6pt; }
    .component-table td { padding: 2px; }
    .cashflow-table { font-size: 7pt; }
    .cashflow-table th { padding: 3px 2px; font-size: 6pt; }
    .cashflow-table td { padding: 2px 3px; text-align: right; }
    .cashflow-table-green th { background: #166534; color: white; border: 1px solid #166534; }
    .expenditure-horizontal { font-size: 8pt; }
    .expenditure-table-green th { background: #166534; color: white; border: 1px solid #166534; }
    .page-break { page-break-before: always; height: 0; margin: 0; padding: 0; }
    .page-break-indicator { display: none; }
    .no-print { display: none; }
  </style>
</head>
<body>
  <div class="WordSection1">
  ${bodyContent}
  </div>
</body>
</html>`;
      
      const docBlob = new Blob([wordDoc], { type: 'application/msword' });
      const url = URL.createObjectURL(docBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Word download error:', err);
      alert('Error generating Word document. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const execCommand = (command, value) => {
    document.execCommand(command, false, value || null);
    editorRef.current?.focus();
    setHasChanges(true);
  };

  const insertPageBreak = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const pageBreakHtml = '<div class="page-break" style="page-break-before: always; height: 0; margin: 20px 0; border-top: 2px dashed #f97316; position: relative;"><span style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #f97316; color: white; font-size: 9px; padding: 2px 8px; border-radius: 3px;">PAGE BREAK</span></div>';
      const div = document.createElement('div');
      div.innerHTML = pageBreakHtml;
      range.deleteContents();
      range.insertNode(div.firstChild);
      setHasChanges(true);
    }
  };

  const insertHorizontalLine = () => {
    execCommand('insertHTML', '<hr style="border: none; border-top: 2px solid #ccc; margin: 16px 0;">');
  };

  const clearFormatting = () => {
    execCommand('removeFormat');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const studyType = site?.studyType || 'Level 1 Full';
  const reportDate = report?.createdAt?.seconds 
    ? new Date(report.createdAt.seconds * 1000).toLocaleDateString() 
    : 'N/A';

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ============ TOP HEADER BAR ============ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="px-4 py-3 pr-6">
          {/* Row 1: Navigation and Title */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <Link 
                href={'/sites/' + siteId + '/reports'} 
                className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
              >
                ← Back to Reports
              </Link>
            </div>
          </div>
          
          {/* Row 2: Report Title and Status */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-800">
                {studyType} Report - {reportDate}
              </h1>
              <p className="text-sm text-gray-500">
                {site?.siteName || 'Site'} 
                <span className={'ml-2 px-2 py-0.5 rounded text-xs font-medium ' + 
                  (report?.status === 'final' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700')}>
                  •{report?.status || 'Draft'}
                </span>
              </p>
            </div>
          </div>
          
          {/* Row 3: Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className={'px-4 py-2 font-medium text-sm transition-all border ' + 
                (editMode 
                  ? 'bg-orange-500 text-white border-orange-600' 
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200')}
            >
              {editMode ? '✏️ Editing' : '👁️ View Mode'}
            </button>
            
            <button
              onClick={() => handleSave('draft')}
              disabled={saving || !hasChanges}
              className="px-4 py-2 bg-green-600 text-white font-medium text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 border border-green-700"
            >
              💾 Save Draft
            </button>
            
            <button
              onClick={() => handleSave('final')}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 border border-emerald-700"
            >
              ✓ Finalize
            </button>
            
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-purple-600 text-white font-medium text-sm hover:bg-purple-700 flex items-center gap-1 border border-purple-700"
            >
              🖨️ Print
            </button>
            
            <button
              onClick={handleDownloadWord}
              disabled={downloading}
              className="px-4 py-2 bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 border border-blue-700"
            >
              {downloading ? '⏳ Preparing...' : '📄 Download Word'}
            </button>
          </div>
        </div>
      </div>

      {/* ============ FORMATTING TOOLBAR (only in edit mode) ============ */}
      {editMode && (
        <div className="bg-gray-50 border-b border-gray-200 sticky top-[140px] z-40">
          {/* Row 1: Text Formatting */}
          <div className="px-4 py-2 flex items-center gap-6 border-b border-gray-100">
            {/* Text Style Group */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2 w-10">Style</span>
              <button onClick={() => execCommand('bold')} title="Bold (Ctrl+B)"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 font-bold">
                B
              </button>
              <button onClick={() => execCommand('italic')} title="Italic (Ctrl+I)"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 italic">
                I
              </button>
              <button onClick={() => execCommand('underline')} title="Underline (Ctrl+U)"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 underline">
                U
              </button>
              <button onClick={() => execCommand('strikeThrough')} title="Strikethrough"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 line-through">
                S
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            {/* Font Size Group */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2">Size</span>
              <select 
                onChange={(e) => execCommand('fontSize', e.target.value)}
                className="h-8 px-2 border border-gray-300 rounded bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                defaultValue="3"
              >
                <option value="1">8pt</option>
                <option value="2">10pt</option>
                <option value="3">12pt</option>
                <option value="4">14pt</option>
                <option value="5">18pt</option>
                <option value="6">24pt</option>
                <option value="7">36pt</option>
              </select>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            {/* Text Color Group */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2">Color</span>
              <button onClick={() => execCommand('foreColor', '#000000')} title="Black"
                className="w-6 h-6 rounded border border-gray-300 bg-black hover:scale-110 transition-transform"></button>
              <button onClick={() => execCommand('foreColor', '#dc2626')} title="Red"
                className="w-6 h-6 rounded border border-gray-300 bg-red-600 hover:scale-110 transition-transform"></button>
              <button onClick={() => execCommand('foreColor', '#2563eb')} title="Blue"
                className="w-6 h-6 rounded border border-gray-300 bg-blue-600 hover:scale-110 transition-transform"></button>
              <button onClick={() => execCommand('foreColor', '#16a34a')} title="Green"
                className="w-6 h-6 rounded border border-gray-300 bg-green-600 hover:scale-110 transition-transform"></button>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            {/* Highlight Group */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2">Highlight</span>
              <button onClick={() => execCommand('backColor', '#fef08a')} title="Yellow Highlight"
                className="w-6 h-6 rounded border border-gray-300 bg-yellow-200 hover:scale-110 transition-transform"></button>
              <button onClick={() => execCommand('backColor', '#bbf7d0')} title="Green Highlight"
                className="w-6 h-6 rounded border border-gray-300 bg-green-200 hover:scale-110 transition-transform"></button>
              <button onClick={() => execCommand('backColor', '#bfdbfe')} title="Blue Highlight"
                className="w-6 h-6 rounded border border-gray-300 bg-blue-200 hover:scale-110 transition-transform"></button>
              <button onClick={() => execCommand('backColor', '#fecaca')} title="Red Highlight"
                className="w-6 h-6 rounded border border-gray-300 bg-red-200 hover:scale-110 transition-transform"></button>
              <button onClick={() => execCommand('backColor', 'transparent')} title="Remove Highlight"
                className="w-6 h-6 rounded border border-gray-300 bg-white hover:scale-110 transition-transform flex items-center justify-center text-gray-400 text-xs">
                ✕
              </button>
            </div>
          </div>

          {/* Row 2: Paragraph & Insert */}
          <div className="px-4 py-2 flex items-center gap-6">
            {/* Alignment Group */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2">Align</span>
              <button onClick={() => execCommand('justifyLeft')} title="Align Left"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm">
                ⫷
              </button>
              <button onClick={() => execCommand('justifyCenter')} title="Align Center"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm">
                ≡
              </button>
              <button onClick={() => execCommand('justifyRight')} title="Align Right"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm">
                ⫸
              </button>
              <button onClick={() => execCommand('justifyFull')} title="Justify"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm">
                ☰
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            {/* Lists Group */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2">Lists</span>
              <button onClick={() => execCommand('insertUnorderedList')} title="Bullet List"
                className="h-8 px-2 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm gap-1">
                •≡
              </button>
              <button onClick={() => execCommand('insertOrderedList')} title="Numbered List"
                className="h-8 px-2 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm gap-1">
                1.
              </button>
              <button onClick={() => execCommand('outdent')} title="Decrease Indent"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm">
                ⇤
              </button>
              <button onClick={() => execCommand('indent')} title="Increase Indent"
                className="w-8 h-8 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm">
                ⇥
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            {/* Insert Group */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-2">Insert</span>
              <button onClick={insertPageBreak} title="Insert Page Break"
                className="h-8 px-3 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm gap-1 text-orange-600">
                📄 Page Break
              </button>
              <button onClick={insertHorizontalLine} title="Insert Horizontal Line"
                className="h-8 px-3 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm gap-1">
                — Line
              </button>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            {/* Edit Group */}
            <div className="flex items-center gap-1">
              <button onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)"
                className="h-8 px-2 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm gap-1">
                ↩ Undo
              </button>
              <button onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)"
                className="h-8 px-2 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm gap-1">
                ↪ Redo
              </button>
              <button onClick={clearFormatting} title="Clear Formatting"
                className="h-8 px-2 flex items-center justify-center hover:bg-white rounded border border-transparent hover:border-gray-300 text-sm gap-1 text-red-500">
                ✕ Clear
              </button>
            </div>

            {/* Unsaved Changes Indicator */}
            {hasChanges && (
              <div className="ml-auto flex items-center gap-2 text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full text-sm">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                Unsaved changes
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============ DOCUMENT AREA ============ */}
      <div className="p-6">
        <div 
          className={'bg-white shadow-lg mx-auto transition-all ' + 
            (editMode ? 'ring-4 ring-blue-400 ring-opacity-50' : '')}
          style={{ 
            maxWidth: '8.5in', 
            minHeight: '11in',
            width: '100%'
          }}
        >
          {editMode ? (
            <div 
              ref={editorRef} 
              contentEditable 
              onInput={() => setHasChanges(true)}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              className="outline-none"
              style={{ 
                padding: '0.6in',
                minHeight: '11in',
                fontSize: '10pt',
                lineHeight: '1.4'
              }}
            />
          ) : (
            <div 
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              style={{
                padding: '0.6in'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
