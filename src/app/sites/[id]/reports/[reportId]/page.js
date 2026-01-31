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
      alert(status === 'final' ? 'Report finalized!' : 'Report saved as draft');
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Error saving report');
    } finally {
      setSaving(false);
    }
  };

  // Formatting commands
  const execCommand = (command, value) => {
    document.execCommand(command, false, value || null);
    editorRef.current?.focus();
    setHasChanges(true);
  };

  // Insert page break at cursor
  const insertPageBreak = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const pageBreakDiv = document.createElement('div');
      pageBreakDiv.className = 'page-break';
      pageBreakDiv.innerHTML = '';
      
      const indicatorDiv = document.createElement('div');
      indicatorDiv.className = 'page-break-indicator no-print';
      indicatorDiv.innerHTML = '';
      
      range.insertNode(indicatorDiv);
      range.insertNode(pageBreakDiv);
      
      // Move cursor after the inserted elements
      range.setStartAfter(indicatorDiv);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      setHasChanges(true);
      editorRef.current?.focus();
    }
  };

  // Remove nearest page break
  const removePageBreak = () => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      // Find and remove page break indicators
      const editor = editorRef.current;
      if (editor) {
        const pageBreaks = editor.querySelectorAll('.page-break');
        const indicators = editor.querySelectorAll('.page-break-indicator');
        
        // Remove the last one (or could prompt user)
        if (pageBreaks.length > 0) {
          const lastBreak = pageBreaks[pageBreaks.length - 1];
          const lastIndicator = indicators[indicators.length - 1];
          lastBreak?.remove();
          lastIndicator?.remove();
          setHasChanges(true);
        } else {
          alert('No page breaks to remove');
        }
      }
    }
  };

  // Insert horizontal line
  const insertHorizontalLine = () => {
    execCommand('insertHTML', '<hr style="border: none; border-top: 1px solid #ccc; margin: 10px 0;">');
  };

  // Change font size
  const changeFontSize = (size) => {
    execCommand('fontSize', size);
  };

  const handlePrint = () => {
    var content = editorRef.current ? editorRef.current.innerHTML : htmlContent;
    var printWindow = window.open('', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function() { printWindow.print(); }, 500);
  };

  const handleDownloadHTML = () => {
    var content = editorRef.current ? editorRef.current.innerHTML : htmlContent;
    var blob = new Blob([content], { type: 'text/html' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (site?.siteName || 'report') + '_Reserve_Study.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-300">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-50 bg-white shadow-md border-b border-gray-300">
        {/* Row 1: Title and Actions */}
        <div className="px-4 py-3 flex justify-between items-center border-b border-gray-200">
          {/* Left - Back and Title */}
          <div className="flex items-center gap-4">
            <Link href={'/sites/' + siteId + '/reports'} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              ← Back to Reports
            </Link>
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-xl font-bold text-gray-900">{report?.title}</h1>
              <p className="text-sm text-gray-500">
                {site?.siteName} •
                <span className={'ml-2 px-2 py-0.5 text-xs rounded font-medium ' + (report?.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>
                  {report?.status === 'final' ? 'Final' : 'Draft'}
                </span>
              </p>
            </div>
          </div>

          {/* Right - Main Actions */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setEditMode(!editMode)}
              className={'px-4 py-2 rounded-lg text-sm font-medium transition-colors ' + (editMode ? 'bg-orange-100 text-orange-700 border-2 border-orange-400' : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200')}
            >
              {editMode ? '✏️ Editing' : '👁️ View Only'}
            </button>

            {editMode && (
              <>
                <button onClick={() => handleSave('draft')} disabled={saving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? '⏳' : '💾'} Save
                </button>
                <button onClick={() => handleSave('final')} disabled={saving}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors">
                  ✅ Finalize
                </button>
              </>
            )}

            <div className="border-l border-gray-300 pl-3 flex gap-2">
              <button onClick={handlePrint}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors">
                🖨️ Print
              </button>
              <button onClick={handleDownloadHTML}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                📥 HTML
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: Formatting Toolbar - Only show in edit mode */}
        {editMode && (
          <div className="px-4 py-3 bg-gray-50 flex flex-wrap gap-4 items-center">
            
            {/* Text Style Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <span className="text-xs text-gray-500 px-2">Style</span>
              <button onClick={() => execCommand('bold')} title="Bold (Ctrl+B)"
                className="w-8 h-8 hover:bg-gray-100 rounded font-bold text-sm flex items-center justify-center">B</button>
              <button onClick={() => execCommand('italic')} title="Italic (Ctrl+I)"
                className="w-8 h-8 hover:bg-gray-100 rounded italic text-sm flex items-center justify-center">I</button>
              <button onClick={() => execCommand('underline')} title="Underline (Ctrl+U)"
                className="w-8 h-8 hover:bg-gray-100 rounded underline text-sm flex items-center justify-center">U</button>
              <button onClick={() => execCommand('strikeThrough')} title="Strikethrough"
                className="w-8 h-8 hover:bg-gray-100 rounded line-through text-sm flex items-center justify-center">S</button>
            </div>

            {/* Font Size Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <span className="text-xs text-gray-500 px-2">Size</span>
              <select 
                onChange={(e) => changeFontSize(e.target.value)} 
                className="h-8 px-2 text-sm border-0 bg-transparent focus:ring-0"
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

            {/* Text Color Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <span className="text-xs text-gray-500 px-2">Color</span>
              <button onClick={() => execCommand('foreColor', '#000000')} title="Black"
                className="w-7 h-7 rounded border border-gray-300" style={{backgroundColor: '#000000'}}></button>
              <button onClick={() => execCommand('foreColor', '#FF0000')} title="Red"
                className="w-7 h-7 rounded border border-gray-300" style={{backgroundColor: '#FF0000'}}></button>
              <button onClick={() => execCommand('foreColor', '#0000FF')} title="Blue"
                className="w-7 h-7 rounded border border-gray-300" style={{backgroundColor: '#0000FF'}}></button>
              <button onClick={() => execCommand('foreColor', '#008000')} title="Green"
                className="w-7 h-7 rounded border border-gray-300" style={{backgroundColor: '#008000'}}></button>
            </div>

            {/* Highlight Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <span className="text-xs text-gray-500 px-2">Highlight</span>
              <button onClick={() => execCommand('backColor', '#FFFF00')} title="Yellow"
                className="w-7 h-7 rounded border border-gray-300" style={{backgroundColor: '#FFFF00'}}></button>
              <button onClick={() => execCommand('backColor', '#90EE90')} title="Green"
                className="w-7 h-7 rounded border border-gray-300" style={{backgroundColor: '#90EE90'}}></button>
              <button onClick={() => execCommand('backColor', '#87CEEB')} title="Blue"
                className="w-7 h-7 rounded border border-gray-300" style={{backgroundColor: '#87CEEB'}}></button>
              <button onClick={() => execCommand('backColor', 'transparent')} title="Remove Highlight"
                className="w-7 h-7 rounded border border-gray-300 bg-white text-xs">✕</button>
            </div>

            {/* Alignment Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <span className="text-xs text-gray-500 px-2">Align</span>
              <button onClick={() => execCommand('justifyLeft')} title="Align Left"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">⫷</button>
              <button onClick={() => execCommand('justifyCenter')} title="Align Center"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">☰</button>
              <button onClick={() => execCommand('justifyRight')} title="Align Right"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">⫸</button>
              <button onClick={() => execCommand('justifyFull')} title="Justify"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">≡</button>
            </div>

            {/* Lists & Indent Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <span className="text-xs text-gray-500 px-2">Lists</span>
              <button onClick={() => execCommand('insertUnorderedList')} title="Bullet List"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">•≡</button>
              <button onClick={() => execCommand('insertOrderedList')} title="Numbered List"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">1.</button>
              <button onClick={() => execCommand('outdent')} title="Decrease Indent"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">⇤</button>
              <button onClick={() => execCommand('indent')} title="Increase Indent"
                className="w-8 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">⇥</button>
            </div>

            {/* Insert Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <span className="text-xs text-gray-500 px-2">Insert</span>
              <button onClick={insertPageBreak} title="Insert Page Break"
                className="px-3 h-8 hover:bg-orange-100 rounded text-sm flex items-center justify-center text-orange-600 font-medium">
                📄 Page Break
              </button>
              <button onClick={insertHorizontalLine} title="Insert Horizontal Line"
                className="px-3 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">
                ― Line
              </button>
            </div>

            {/* Edit Group */}
            <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-300 p-1">
              <button onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)"
                className="px-3 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">↩ Undo</button>
              <button onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)"
                className="px-3 h-8 hover:bg-gray-100 rounded text-sm flex items-center justify-center">↪ Redo</button>
              <button onClick={() => execCommand('removeFormat')} title="Clear Formatting"
                className="px-3 h-8 hover:bg-red-100 rounded text-sm flex items-center justify-center text-red-600">✕ Clear</button>
            </div>

            {/* Unsaved indicator */}
            {hasChanges && (
              <span className="text-orange-600 text-sm font-medium bg-orange-50 px-3 py-1 rounded-full">
                ⚠️ Unsaved changes
              </span>
            )}
          </div>
        )}
      </div>

      {/* Report Content - Full Width */}
      <div className="p-6">
        <div 
          className={'bg-white shadow-xl mx-auto ' + (editMode ? 'ring-4 ring-blue-400 ring-opacity-50' : '')}
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
                padding: '0.75in',
                minHeight: '11in',
                fontSize: '11pt',
                lineHeight: '1.5'
              }}
            />
          ) : (
            <div 
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              style={{
                padding: '0.75in'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
