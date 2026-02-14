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
    
    // The report HTML may be a full document — extract styles and body content
    let reportStyles = '';
    let bodyContent = content;
    
    // Extract <style> blocks from content
    const styleMatches = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
    if (styleMatches) {
      reportStyles = styleMatches.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n');
    }
    
    // Extract body content if it's a full HTML document
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
    
    // Strip editor-only elements
    bodyContent = bodyContent
      .replace(/<div[^>]*class="[^"]*page-break-indicator[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
      .replace(/<div[^>]*class="[^"]*no-print[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    
    // Remove page-container wrapper divs (keep their content)
    bodyContent = bodyContent
      .replace(/<div[^>]*class="[^"]*page-container[^"]*"[^>]*>/gi, '')
      .replace(/<!-- page-container end -->/gi, '');
    
    // Convert remote images to base64 for Word compatibility
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
    
    // Clean up report styles for Word compatibility
    let cleanStyles = reportStyles
      // Remove @media screen blocks (editor-only styles)
      .replace(/@media\s+screen\s*\{[\s\S]*?\}\s*\}/g, '')
      // Remove @media print blocks
      .replace(/@media\s+print\s*\{[\s\S]*?\}\s*\}/g, '')
      // Remove CSS reset that kills all spacing
      .replace(/\*\s*\{[^}]*margin:\s*0[^}]*padding:\s*0[^}]*\}/g, '')
      .replace(/\*\s*\{[^}]*\}/g, function(match) {
        // Only remove if it contains margin:0 or padding:0
        if (/margin\s*:\s*0/.test(match) || /padding\s*:\s*0/.test(match)) return '';
        return match;
      })
      // Remove max-width and margin:auto from body (breaks Word page layout)
      .replace(/(body\s*\{[^}]*?)max-width\s*:[^;]+;/g, '$1')
      .replace(/(body\s*\{[^}]*?)margin\s*:\s*0\s+auto[^;]*;/g, '$1')
      // Replace flexbox with Word-compatible alternatives
      .replace(/display\s*:\s*flex\s*;/g, '')
      .replace(/flex-direction\s*:\s*column\s*;/g, '')
      .replace(/justify-content\s*:\s*[^;]+;/g, '')
      .replace(/align-items\s*:\s*center\s*;/g, 'text-align: center;')
      .replace(/align-items\s*:\s*[^;]+;/g, '')
      .replace(/flex\s*:\s*[^;]+;/g, '')
      .replace(/gap\s*:\s*[^;]+;/g, '')
      .trim();
    
    // Build Word-compatible document
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
    @page { 
      size: 8.5in 11in; 
      margin: 0.75in 0.6in 0.75in 0.6in; 
    }
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      font-size: 10pt; 
      line-height: 1.4;
      color: #1a1a1a;
    }
    p { margin: 4pt 0; }
    /* Report styles */
    ${cleanStyles}
    /* Word-specific overrides */
    .page-break { page-break-before: always; height: 0; margin: 0; padding: 0; }
    .page-break-indicator { display: none; }
    .no-print { display: none; }
    .cover-page { text-align: center; padding: 36pt; }
    .cover-logo img { max-width: 300px; }
  </style>
</head>
<body>
  ${bodyContent}
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
