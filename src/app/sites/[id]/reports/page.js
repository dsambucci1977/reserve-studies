'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, getDoc, addDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadReportData, generateReport } from '@/lib/reports/reportGenerator';
import { DEFAULT_REPORT_TEMPLATE } from '@/lib/reports/DEFAULT_REPORT_TEMPLATE';
import { exportToDocx } from '@/lib/reports/docxExporter';

export default function ReportsListPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;

  const [site, setSite] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [expandedReport, setExpandedReport] = useState(null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (user) loadData();
  }, [user, siteId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      let orgId = null;
      if (userDoc.exists()) {
        orgId = userDoc.data().organizationId;
        setOrganizationId(orgId);
      }

      const siteDoc = await getDoc(doc(db, 'sites', siteId));
      if (siteDoc.exists()) setSite({ id: siteDoc.id, ...siteDoc.data() });

      if (orgId) {
        try {
          const orgDoc = await getDoc(doc(db, 'organizations', orgId));
          if (orgDoc.exists()) setOrganization(orgDoc.data());
        } catch (e) { /* ok */ }
      }

      try {
        const reportsRef = collection(db, `sites/${siteId}/reports`);
        const reportsQuery = query(reportsRef, orderBy('createdAt', 'desc'));
        const reportsSnapshot = await getDocs(reportsQuery);
        const reportsData = reportsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        // Load notes for each report
        for (const report of reportsData) {
          try {
            const notesRef = collection(db, `sites/${siteId}/reports/${report.id}/notes`);
            const notesQuery = query(notesRef, orderBy('createdAt', 'desc'));
            const notesSnap = await getDocs(notesQuery);
            report.notes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          } catch (e) {
            report.notes = [];
          }
        }

        setReports(reportsData);
      } catch (e) {
        setReports([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const reportData = await loadReportData(siteId, organizationId);
      
      let template = DEFAULT_REPORT_TEMPLATE;
      if (organizationId) {
        try {
          const templateDoc = await getDoc(doc(db, `organizations/${organizationId}/settings/reportTemplate`));
          if (templateDoc.exists() && templateDoc.data().template) {
            template = templateDoc.data().template;
          }
        } catch (e) {
          console.log('Using default template');
        }
      }

      const htmlContent = generateReport(template, reportData);
      const studyType = site?.studyType || 'Reserve Study';
      const version = reports.length + 1;
      const reportTitle = `${studyType} Report v${version}`;

      await addDoc(collection(db, `sites/${siteId}/reports`), {
        title: reportTitle,
        studyType: site?.studyType || null,
        status: 'draft',
        htmlContent,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        version
      });

      await loadData();
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadWord = async (report) => {
    try {
      setDownloadingId(report.id);
      const siteName = site?.siteName || 'Site';
      const fileName = `${siteName} - ${report.title}.docx`;
      
      const reportData = await loadReportData(siteId, organizationId);

      // Pre-fetch logo via Image+canvas (reliable for Firebase Storage)
      let logoData = null;
      const logoUrl = reportData.organization?.logoUrl;
      if (logoUrl) {
        try {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = logoUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
          if (blob) {
            const buf = await blob.arrayBuffer();
            logoData = new Uint8Array(buf);
          }
        } catch (e) {
          console.warn('Logo pre-fetch failed:', e.message);
        }
      }

      await exportToDocx(reportData, fileName, { logoData });
    } catch (error) {
      console.error('Error downloading report:', error);
      alert('Error downloading: ' + error.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this report version?')) return;
    try {
      await deleteDoc(doc(db, `sites/${siteId}/reports`, reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const handleAddNote = async (reportId) => {
    if (!newNote.trim()) return;
    try {
      setSavingNote(true);
      await addDoc(collection(db, `sites/${siteId}/reports/${reportId}/notes`), {
        text: newNote.trim(),
        createdBy: user.uid,
        createdByEmail: user.email || '',
        createdAt: new Date(),
      });
      setNewNote('');
      // Reload notes for this report
      const notesRef = collection(db, `sites/${siteId}/reports/${reportId}/notes`);
      const notesQuery = query(notesRef, orderBy('createdAt', 'desc'));
      const notesSnap = await getDocs(notesQuery);
      const updatedNotes = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, notes: updatedNotes } : r));
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Error adding note: ' + error.message);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (reportId, noteId) => {
    if (!confirm('Delete this note?')) return;
    try {
      await deleteDoc(doc(db, `sites/${siteId}/reports/${reportId}/notes`, noteId));
      setReports(prev => prev.map(r => {
        if (r.id === reportId) {
          return { ...r, notes: (r.notes || []).filter(n => n.id !== noteId) };
        }
        return r;
      }));
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateShort = (date) => {
    if (!date) return 'N/A';
    if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-6">
        <Link href={'/sites/' + siteId} className="text-red-600 hover:text-red-800 mb-4 inline-block">
          ← Back to Project
        </Link>

        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="text-gray-600 mt-1">{site?.siteName}</p>
            {site?.studyType && (
              <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                {site.studyType}
              </span>
            )}
          </div>
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
          >
            {generating ? '⏳ Generating...' : '📄 Generate Report'}
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📄</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No reports yet</h3>
            <p className="text-gray-600 mb-6">
              Generate your first {site?.studyType || 'Reserve Study'} report to get started.
            </p>
            <button onClick={handleGenerateReport} disabled={generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
              Generate Report
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map(report => (
              <div key={report.id} className="bg-white shadow rounded-lg overflow-hidden">
                {/* Report header row */}
                <div className="p-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">{report.title}</h3>
                        <span className={'px-2 py-1 text-xs rounded-full ' + (report.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>
                          {report.status === 'final' ? 'Final' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">Created {formatDateShort(report.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setExpandedReport(expandedReport === report.id ? null : report.id);
                          setNewNote('');
                        }}
                        className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded text-sm font-medium flex items-center gap-1"
                      >
                        💬 Notes {(report.notes?.length || 0) > 0 && (
                          <span className="bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded-full ml-1">
                            {report.notes.length}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDownloadWord(report)}
                        disabled={downloadingId === report.id}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
                      >
                        {downloadingId === report.id ? '⏳ Preparing...' : '📄 Download .docx'}
                      </button>
                      <button onClick={(e) => handleDeleteReport(report.id, e)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

                {/* Notes/Comments section (expandable) */}
                {expandedReport === report.id && (
                  <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Notes & Change Requests</h4>
                    
                    {/* Add note input */}
                    <div className="flex gap-2 mb-4">
                      <textarea
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Add a note about requested changes, feedback, or comments..."
                        rows={2}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            handleAddNote(report.id);
                          }
                        }}
                      />
                      <button
                        onClick={() => handleAddNote(report.id)}
                        disabled={savingNote || !newNote.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 self-end"
                      >
                        {savingNote ? '...' : 'Add'}
                      </button>
                    </div>

                    {/* Existing notes */}
                    {(!report.notes || report.notes.length === 0) ? (
                      <p className="text-sm text-gray-400 italic">No notes yet. Add a note to track change requests or feedback.</p>
                    ) : (
                      <div className="space-y-2">
                        {report.notes.map(note => (
                          <div key={note.id} className="bg-white rounded-lg p-3 border border-gray-200 flex justify-between items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.text}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {note.createdByEmail || 'User'} — {formatDate(note.createdAt)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteNote(report.id, note.id)}
                              className="text-gray-400 hover:text-red-500 text-xs flex-shrink-0 mt-0.5"
                              title="Delete note"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
