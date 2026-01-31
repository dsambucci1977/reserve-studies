// src/app/sites/[id]/reports/page.js
// Reports Page - Updated to use jsPDF for professional PDF generation
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, getDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generatePDFReport } from '@/lib/reports/jsPDFReportGenerator';

export default function ReportsListPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;

  const [site, setSite] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [organizationId, setOrganizationId] = useState(null);

  useEffect(() => {
    if (user) loadData();
  }, [user, siteId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) setOrganizationId(userDoc.data().organizationId);

      const siteDoc = await getDoc(doc(db, 'sites', siteId));
      if (siteDoc.exists()) setSite({ id: siteDoc.id, ...siteDoc.data() });

      try {
        const reportsRef = collection(db, `sites/${siteId}/reports`);
        const reportsQuery = query(reportsRef, orderBy('createdAt', 'desc'));
        const reportsSnapshot = await getDocs(reportsQuery);
        setReports(reportsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.log('No reports yet');
        setReports([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load all data needed for report generation
  const loadReportData = async () => {
    // Load site
    const siteDoc = await getDoc(doc(db, 'sites', siteId));
    const siteData = siteDoc.exists() ? { id: siteDoc.id, ...siteDoc.data() } : {};

    // Load components
    const componentsSnapshot = await getDocs(collection(db, `sites/${siteId}/components`));
    const components = componentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // Load organization
    let organization = {};
    if (organizationId) {
      try {
        const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
        if (orgDoc.exists()) {
          organization = orgDoc.data();
        }
      } catch (e) {
        console.log('Error loading organization:', e);
      }
    }

    // Load projections/results
    let results = {};
    try {
      const projectionsDoc = await getDoc(doc(db, `sites/${siteId}/projections/latest`));
      if (projectionsDoc.exists()) {
        results = projectionsDoc.data();
      }
    } catch (e) {
      console.log('No projections found');
    }

    // Load notes
    let notes = [];
    if (organizationId) {
      try {
        const notesSnapshot = await getDocs(collection(db, `organizations/${organizationId}/notes`));
        notes = notesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (e) {
        console.log('No notes found');
      }
    }

    return { site: siteData, components, organization, results, notes };
  };

  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      
      // Load all report data
      const reportData = await loadReportData();
      
      // Generate PDF using jsPDF
      const pdfBlob = await generatePDFReport(reportData);
      
      // Create filename
      const studyType = site?.studyType || 'Reserve Study';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${site?.siteName || 'Report'}_${studyType}_${dateStr}.pdf`;
      
      // Download the PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Save report record to Firebase
      const reportTitle = `${studyType} Report - ${new Date().toLocaleDateString()}`;
      await addDoc(collection(db, `sites/${siteId}/reports`), {
        title: reportTitle,
        studyType: site?.studyType || null,
        status: 'generated',
        filename: filename,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: reports.length + 1
      });

      // Reload reports list
      await loadData();
      
      alert('PDF generated and downloaded successfully!');
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this report record?')) return;
    try {
      await deleteDoc(doc(db, `sites/${siteId}/reports`, reportId));
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const formatDate = (date) => {
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
      <div className="max-w-6xl mx-auto px-4">
        <Link href={'/sites/' + siteId} className="text-red-600 hover:text-red-800 mb-4 inline-block">
          ← Back to Site
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
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {generating ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Generating PDF...
              </>
            ) : (
              <>📄 Generate PDF Report</>
            )}
          </button>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-blue-500 text-xl">ℹ️</span>
            <div>
              <h4 className="font-medium text-blue-900">Professional PDF Reports</h4>
              <p className="text-sm text-blue-700 mt-1">
                Click "Generate PDF Report" to create and download a professional PDF with page numbers, 
                headers, footers, and properly formatted tables. The PDF will download automatically.
              </p>
            </div>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📄</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No reports generated yet</h3>
            <p className="text-gray-600 mb-6">
              Generate your first {site?.studyType || 'Reserve Study'} Report
            </p>
            <button 
              onClick={handleGenerateReport} 
              disabled={generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate PDF Report'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-700">Generated Reports History</h2>
            {reports.map(report => (
              <div key={report.id} className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">📄</span>
                      <h3 className="text-lg font-bold text-gray-900">{report.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        report.status === 'generated' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {report.status === 'generated' ? '✓ Generated' : report.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Version {report.version || 1} • Created {formatDate(report.createdAt)}
                      {report.filename && <span className="ml-2 text-gray-400">• {report.filename}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateReport}
                      disabled={generating}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    <button 
                      onClick={(e) => handleDeleteReport(report.id, e)}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
