// src/app/sites/[id]/reports/page.js
// Reports page - Direct Word download + legacy report list
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, getDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadReportData, generateReport } from '@/lib/reports/reportGenerator';
import { DEFAULT_REPORT_TEMPLATE } from '@/lib/reports/DEFAULT_REPORT_TEMPLATE';
import { exportToWord } from '@/lib/reports/wordExporter';

export default function ReportsListPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;

  const [site, setSite] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
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
        setReports([]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadWord = async () => {
    try {
      setDownloading(true);
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
      const siteName = site?.siteName || 'Site';
      const studyType = site?.studyType || 'Reserve Study';
      const fileName = `${siteName} - ${studyType} Report.doc`;
      
      await exportToWord(htmlContent, fileName);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report: ' + error.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleDeleteReport = async (reportId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this report?')) return;
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
        </div>

        {/* PRIMARY: Download Word Report */}
        <div className="bg-white shadow rounded-lg p-8 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Download Report</h2>
              <p className="text-gray-600 text-sm">
                Generate a formatted Word document with all study data, cash flows, and recommendations. Edit directly in Microsoft Word.
              </p>
            </div>
            <button
              onClick={handleDownloadWord}
              disabled={downloading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
            >
              {downloading ? (
                <>
                  <span className="animate-spin inline-block">⏳</span>
                  Preparing...
                </>
              ) : (
                <>📄 Download Word Report</>
              )}
            </button>
          </div>
        </div>

        {/* LEGACY: Previously saved reports */}
        {reports.length > 0 && (
          <>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Previously Saved Reports</h3>
            <div className="space-y-4">
              {reports.map(report => (
                <div key={report.id} className="bg-white shadow rounded-lg p-6 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start">
                    <Link href={'/sites/' + siteId + '/reports/' + report.id} className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{report.title}</h3>
                        <span className={'px-2 py-1 text-xs rounded-full ' + (report.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800')}>
                          {report.status === 'final' ? 'Final' : 'Draft'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Version {report.version || 1} • Created {formatDate(report.createdAt)}</p>
                    </Link>
                    <div className="flex gap-2">
                      <Link href={'/sites/' + siteId + '/reports/' + report.id}
                        className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
                        Open Editor
                      </Link>
                      <button onClick={(e) => handleDeleteReport(report.id, e)}
                        className="px-4 py-2 text-red-600 hover:bg-red-50 rounded text-sm">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
