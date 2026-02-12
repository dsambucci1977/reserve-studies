

// src/app/sites/[id]/page.js
// Site Detail with Status Management and Study Type Display
'use client';
import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getSite, getComponents } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// Status configuration
const STATUSES = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 border-gray-300', icon: '📝' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-300', icon: '⏳' },
  calculated: { label: 'Calculated', color: 'bg-blue-100 text-blue-800 border-blue-300', icon: '🔢' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-300', icon: '✅' },
  sent: { label: 'Sent to Client', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: '📤' }
};

export default function SiteDetailPage() {
  const [site, setSite] = useState(null);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const params = useParams();
  const siteId = params.id;

  useEffect(() => {
    const loadData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        window.location.href = '/';
        return;
      }
      
      try {
        const [siteData, componentsData] = await Promise.all([
          getSite(siteId),
          getComponents(siteId)
        ]);
        
        if (siteData) {
          setSite(siteData);
          setComponents(componentsData);
        } else {
          alert('Site not found');
          window.location.href = '/sites';
        }
      } catch (error) {
        console.error('Error loading site:', error);
        alert('Error loading site');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [siteId]);

  const handleStatusChange = async (newStatus) => {
    try {
      setUpdatingStatus(true);
      await updateDoc(doc(db, 'sites', siteId), {
        status: newStatus,
        updatedAt: new Date()
      });
      setSite(prev => ({ ...prev, status: newStatus }));
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusInfo = (status) => {
    const normalizedStatus = status?.toLowerCase() || 'draft';
    return STATUSES[normalizedStatus] || STATUSES.draft;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  const hasProjectInfo = site?.beginningReserveBalance !== undefined;
  const hasComponents = components.length > 0;
  const canCalculate = hasProjectInfo && hasComponents;
  const hasResults = site?.status === 'calculated' || site?.status === 'completed' || site?.status === 'sent';
  const statusInfo = getStatusInfo(site?.status);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <main className="w-full px-6 py-8">
        <div className="mb-6">
          <Link
            href="/sites"
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            ← Back to Projects
          </Link>
        </div>

        {/* Site Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {site?.siteName || 'Untitled Site'}
              </h1>
              <p className="text-gray-600">
                Project #{site?.projectNumber || 'N/A'}
              </p>
            </div>
            
            {/* Status Selector */}
            <div className="flex flex-col items-end gap-2">
              <label className="text-xs text-gray-500 font-medium">Site Status</label>
              <div className="relative">
                <select
                  value={site?.status || 'draft'}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  className={`appearance-none pl-8 pr-10 py-2 text-sm font-medium rounded-lg border-2 cursor-pointer focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 ${statusInfo.color}`}
                >
                  {Object.entries(STATUSES).map(([key, { label, icon }]) => (
                    <option key={key} value={key}>
                      {icon} {label}
                    </option>
                  ))}
                </select>
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none">
                  {statusInfo.icon}
                </span>
                <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {updatingStatus && (
                <span className="text-xs text-blue-600">Updating...</span>
              )}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Location:</span>
              <p className="font-medium text-gray-900">{site?.city && site?.state ? `${site.city}, ${site.state}` : site?.location || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-500">Units:</span>
              <p className="font-medium text-gray-900">{site?.totalUnits || site?.numberOfUnits || 0}</p>
            </div>
            <div>
              <span className="text-gray-500">Study Type:</span>
              <p className="font-medium text-gray-900">{site?.studyType || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-gray-500">Components:</span>
              <p className="font-medium text-gray-900">{components.length}</p>
            </div>
            <div>
              <span className="text-gray-500">Created:</span>
              <p className="font-medium text-gray-900">
                {site?.createdAt && new Date(site.createdAt.seconds * 1000).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Study Progress</span>
            <span className="text-sm text-gray-500">
              {[hasProjectInfo, hasComponents, hasResults].filter(Boolean).length} of 3 steps
            </span>
          </div>
          <div className="flex gap-2">
            <div className={`flex-1 h-2 rounded-full ${hasProjectInfo ? 'bg-green-500' : 'bg-gray-200'}`}></div>
            <div className={`flex-1 h-2 rounded-full ${hasComponents ? 'bg-green-500' : 'bg-gray-200'}`}></div>
            <div className={`flex-1 h-2 rounded-full ${hasResults ? 'bg-green-500' : 'bg-gray-200'}`}></div>
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-500">
            <span>Project Info</span>
            <span>Components</span>
            <span>Calculated</span>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Project Information */}
          <Link
            href={`/sites/${siteId}/project-info`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-blue-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  📋 Project Information
                </h3>
                <p className="text-sm text-gray-600">
                  Financial parameters & settings
                </p>
              </div>
            </div>
            <div className={`text-sm font-medium mb-4 ${hasProjectInfo ? 'text-green-600' : 'text-orange-600'}`}>
              {hasProjectInfo ? '✅ Complete' : '⚠️ Required for calculations'}
            </div>
            <div className="w-full px-4 py-2 bg-blue-600 text-white text-center rounded-lg hover:bg-blue-700">
              {hasProjectInfo ? 'Edit Info' : 'Add Info'} →
            </div>
          </Link>

          {/* Components */}
          <Link
            href={`/sites/${siteId}/components`}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-purple-500"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  🔧 Components
                </h3>
                <p className="text-sm text-gray-600">
                  Manage reserve & PM items
                </p>
              </div>
            </div>
            <div className={`text-sm font-medium mb-4 ${hasComponents ? 'text-green-600' : 'text-orange-600'}`}>
              {hasComponents ? `✅ ${components.length} components` : '⚠️ Add components to calculate'}
            </div>
            <div className="w-full px-4 py-2 bg-purple-600 text-white text-center rounded-lg hover:bg-purple-700">
              Manage Components →
            </div>
          </Link>

          {/* Calculate */}
          <Link
            href={canCalculate ? `/sites/${siteId}/calculate` : '#'}
            className={`bg-white rounded-lg shadow p-6 transition-shadow border-l-4 ${
              canCalculate 
                ? 'hover:shadow-lg border-green-500 cursor-pointer' 
                : 'opacity-60 border-gray-300 cursor-not-allowed'
            }`}
            onClick={(e) => !canCalculate && e.preventDefault()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  🧮 Calculate
                </h3>
                <p className="text-sm text-gray-600">
                  Run 30-year projections
                </p>
              </div>
            </div>
            <div className={`text-sm font-medium mb-4 ${canCalculate ? 'text-green-600' : 'text-gray-500'}`}>
              {canCalculate ? '✅ Ready to calculate' : '⏳ Complete steps above first'}
            </div>
            <div className={`w-full px-4 py-2 text-white text-center rounded-lg ${
              canCalculate ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'
            }`}>
              Run Calculations →
            </div>
          </Link>

          {/* View Results */}
          {hasResults && (
            <Link
              href={`/sites/${siteId}/results`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-indigo-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    📊 View Results
                  </h3>
                  <p className="text-sm text-gray-600">
                    Cash flows & projections
                  </p>
                </div>
              </div>
              <div className="text-sm font-medium mb-4 text-green-600">
                ✅ Results available
              </div>
              <div className="w-full px-4 py-2 bg-indigo-600 text-white text-center rounded-lg hover:bg-indigo-700">
                View Results →
              </div>
            </Link>
          )}

          {/* Charts & Visualizations */}
          {hasResults && (
            <Link
              href={`/sites/${siteId}/charts`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-teal-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    📈 Charts
                  </h3>
                  <p className="text-sm text-gray-600">
                    Visual fund analysis
                  </p>
                </div>
              </div>
              <div className="text-sm font-medium mb-4 text-green-600">
                ✅ Charts available
              </div>
              <div className="w-full px-4 py-2 bg-teal-600 text-white text-center rounded-lg hover:bg-teal-700">
                View Charts →
              </div>
            </Link>
          )}

          {/* Generate Reports */}
          {hasResults && (
            <Link
              href={`/sites/${siteId}/reports`}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow border-l-4 border-orange-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    📄 Generate Reports
                  </h3>
                  <p className="text-sm text-gray-600">
                    Create professional PDF reports
                  </p>
                </div>
              </div>
              <div className="text-sm font-medium mb-4 text-green-600">
                ✅ Ready to generate
              </div>
              <div className="w-full px-4 py-2 bg-orange-600 text-white text-center rounded-lg hover:bg-orange-700">
                Manage Reports →
              </div>
            </Link>
          )}

        </div>

        {/* Status Legend */}
        <div className="mt-8 bg-white rounded-lg shadow p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Status Guide</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUSES).map(([key, { label, color, icon }]) => (
              <span key={key} className={`px-3 py-1.5 text-xs font-medium rounded-lg border ${color}`}>
                {icon} {label}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Use the status dropdown above to track where each study is in your workflow.
          </p>
        </div>

      </main>
    </div>
  );
}
