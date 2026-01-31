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

  const handlePrint = () => {
    var printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(function() { printWindow.print(); }, 500);
  };

  const handleDownloadHTML = () => {
    var blob = new Blob([htmlContent], { type: 'text/html' });
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
    <div className="min-h-screen bg-gray-200">
      {/* Top Toolbar */}
      <div className="sticky top-0 z-50 bg-white shadow border-b border-gray-300">
        <div className="px-4 py-2">
          <div className="flex justify-between items-center">
            {/* Left - Back and Title */}
            <div className="flex items-center gap-4">
              <Link href={'/sites/' + siteId + '/reports'} className="text-gray-600 hover:text-gray-900 text-sm">
                ← Back to Reports
              </Link>
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-lg font-bold text-gray-900">{report?.title}</h1>
                <p className="text-xs text-gray-500">
                  {site?.siteName} • 
                  <span className={'ml-1 px-2 py-0.5 text-xs rounded ' + (report?.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>
                    {report?.status === 'final' ? 'Final' : 'Draft'}
                  </span>
                </p>
              </div>
            </div>

            {/* Right - Actions */}
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setEditMode(!editMode)}
                className={'px-3 py-1.5 rounded text-sm font-medium ' + (editMode ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' : 'bg-gray-100 text-gray-700 border border-gray-300')}
              >
                {editMode ? '✏️ Editing' : '👁️ View Only'}
              </button>

              {editMode && (
                <>
                  <button onClick={() => handleSave('draft')} disabled={saving}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                    {saving ? 'Saving...' : '💾 Save'}
                  </button>
                  <button onClick={() => handleSave('final')} disabled={saving}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50">
                    ✅ Finalize
                  </button>
                </>
              )}

              <div className="border-l border-gray-300 pl-2 ml-1 flex gap-1">
                <button onClick={handlePrint}
                  className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm hover:bg-gray-800">
                  🖨️ Print
                </button>
                <button onClick={handleDownloadHTML}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">
                  📥 HTML
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Formatting Toolbar - Only show in edit mode */}
        {editMode && (
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap gap-1 items-center">
            {/* Text Formatting */}
            <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
              <button onClick={() => execCommand('bold')} title="Bold (Ctrl+B)"
                className="p-1.5 hover:bg-gray-200 rounded font-bold text-sm">B</button>
              <button onClick={() => execCommand('italic')} title="Italic (Ctrl+I)"
                className="p-1.5 hover:bg-gray-200 rounded italic text-sm">I</button>
              <button onClick={() => execCommand('underline')} title="Underline (Ctrl+U)"
                className="p-1.5 hover:bg-gray-200 rounded underline text-sm">U</button>
              <button onClick={() => execCommand('strikeThrough')} title="Strikethrough"
                className="p-1.5 hover:bg-gray-200 rounded line-through text-sm">S</button>
            </div>

            {/* Highlighting */}
            <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
              <button onClick={() => execCommand('backColor', '#ffff00')} title="Highlight Yellow"
                className="p-1.5 hover:bg-gray-200 rounded text-sm" style={{backgroundColor: '#ffff00'}}>🖍️</button>
              <button onClick={() => execCommand('backColor', '#90EE90')} title="Highlight Green"
                className="p-1.5 hover:bg-gray-200 rounded text-sm" style={{backgroundColor: '#90EE90'}}>🖍️</button>
              <button onClick={() => execCommand('backColor', '#87CEEB')} title="Highlight Blue"
                className="p-1.5 hover:bg-gray-200 rounded text-sm" style={{backgroundColor: '#87CEEB'}}>🖍️</button>
              <button onClick={() => execCommand('backColor', '#FFB6C1')} title="Highlight Pink"
                className="p-1.5 hover:bg-gray-200 rounded text-sm" style={{backgroundColor: '#FFB6C1'}}>🖍️</button>
              <button onClick={() => execCommand('removeFormat')} title="Remove Formatting"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">✖️</button>
            </div>

            {/* Text Color */}
            <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
              <button onClick={() => execCommand('foreColor', '#000000')} title="Black Text"
                className="p-1.5 hover:bg-gray-200 rounded text-sm font-bold" style={{color: '#000000'}}>A</button>
              <button onClick={() => execCommand('foreColor', '#FF0000')} title="Red Text"
                className="p-1.5 hover:bg-gray-200 rounded text-sm font-bold" style={{color: '#FF0000'}}>A</button>
              <button onClick={() => execCommand('foreColor', '#0000FF')} title="Blue Text"
                className="p-1.5 hover:bg-gray-200 rounded text-sm font-bold" style={{color: '#0000FF'}}>A</button>
              <button onClick={() => execCommand('foreColor', '#008000')} title="Green Text"
                className="p-1.5 hover:bg-gray-200 rounded text-sm font-bold" style={{color: '#008000'}}>A</button>
            </div>

            {/* Alignment */}
            <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
              <button onClick={() => execCommand('justifyLeft')} title="Align Left"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">⬅️</button>
              <button onClick={() => execCommand('justifyCenter')} title="Align Center"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">↔️</button>
              <button onClick={() => execCommand('justifyRight')} title="Align Right"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">➡️</button>
            </div>

            {/* Lists */}
            <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
              <button onClick={() => execCommand('insertUnorderedList')} title="Bullet List"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">• List</button>
              <button onClick={() => execCommand('insertOrderedList')} title="Numbered List"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">1. List</button>
            </div>

            {/* Indentation */}
            <div className="flex gap-0.5 border-r border-gray-300 pr-2 mr-2">
              <button onClick={() => execCommand('outdent')} title="Decrease Indent"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">⬅️ Indent</button>
              <button onClick={() => execCommand('indent')} title="Increase Indent"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">➡️ Indent</button>
            </div>

            {/* Undo/Redo */}
            <div className="flex gap-0.5">
              <button onClick={() => execCommand('undo')} title="Undo (Ctrl+Z)"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">↩️ Undo</button>
              <button onClick={() => execCommand('redo')} title="Redo (Ctrl+Y)"
                className="p-1.5 hover:bg-gray-200 rounded text-sm">↪️ Redo</button>
            </div>

            {/* Unsaved indicator */}
            {hasChanges && (
              <span className="ml-4 text-yellow-600 text-sm">⚠️ Unsaved changes</span>
            )}
          </div>
        )}
      </div>

      {/* Report Content - Full Width */}
      <div className="p-4">
        <div 
          className={'bg-white shadow-lg mx-auto ' + (editMode ? 'ring-2 ring-blue-400' : '')}
          style={{ 
            maxWidth: '11in', 
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
