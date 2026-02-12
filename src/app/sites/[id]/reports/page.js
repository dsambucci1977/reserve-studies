'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, getDoc, addDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { loadReportData, generateReport } from '@/lib/reports/reportGenerator';
import { DEFAULT_REPORT_TEMPLATE } from '@/lib/reports/DEFAULT_REPORT_TEMPLATE';

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

      // Include study type in report title
      const studyType = site?.studyType || 'Reserve Study';
      const reportTitle = `${studyType} Report - ${new Date().toLocaleDateString()}`;

      const reportRef = await addDoc(collection(db, `sites/${siteId}/reports`), {
        title: reportTitle,
        studyType: site?.studyType || null,
        status: 'draft',
        htmlContent,
        createdBy: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
        version: reports.length + 1
      });

      router.push('/sites/' + siteId + '/reports/' + reportRef.id);
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
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
          >
            {generating ? '⏳ Generating...' : '📄 Generate New Report'}
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📄</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No reports yet</h3>
            <p className="text-gray-600 mb-6">
              Generate your first {site?.studyType || 'Reserve Study'} Report
            </p>
            <button onClick={handleGenerateReport} disabled={generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
              Generate Report
            </button>
          </div>
        ) : (
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
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                      Open
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
        )}
      </div>
    </div>
  );
}
