// src/app/sites/new/page.js
// Create New Project - Basic site creation form

'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { createSite } from '@/lib/db';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewSitePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  // Form fields
  const [projectNumber, setProjectNumber] = useState('');
  const [siteName, setSiteName] = useState('');
  const [location, setLocation] = useState('');
  const [numberOfUnits, setNumberOfUnits] = useState('');

  useEffect(() => {
    // Check authentication
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create site in Firestore
      const siteId = await createSite(
        {
          projectNumber,
          siteName,
          location,
          numberOfUnits: parseInt(numberOfUnits) || 0,
          // Set defaults for other required fields
          beginningReserveBalance: 0,
          currentAnnualContribution: 0,
          costAdjustmentFactor: 1.15,
          inflationRate: 0.00,
          interestRate: 0.00,
          beginningYear: new Date().getFullYear(),
          projectionYears: 30,
        },
        user.uid
      );

      // Success! Redirect to the site detail page
      alert('Site created successfully!');
      router.push(`/sites/${siteId}`);
    } catch (err) {
      console.error('Error creating site:', err);
      setError('Failed to create site. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="w-full px-6 py-8">
        <div className="mb-6">
          <Link
            href="/sites"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← Back to Projects
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Project</h1>
          <p className="text-gray-600 mb-8">
            Enter basic information to get started. You can add detailed project info and components later.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Number *
              </label>
              <input
                type="text"
                value={projectNumber}
                onChange={(e) => setProjectNumber(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 26NJ-101"
                required
              />
              <p className="text-sm text-gray-500 mt-1">
                Unique identifier for this project
              </p>
            </div>

            {/* Site Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Oakridge Towers Homeowners Association"
                required
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location *
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Maplewood, New Jersey"
                required
              />
            </div>

            {/* Number of Units */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Units *
              </label>
              <input
                type="number"
                value={numberOfUnits}
                onChange={(e) => setNumberOfUnits(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., 48"
                required
                min="1"
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">What&apos;s Next?</h3>
              <p className="text-blue-700 text-sm">
                After creating the site, you&apos;ll be able to:
              </p>
              <ul className="text-blue-700 text-sm ml-4 mt-2 space-y-1 list-disc">
                <li>Add complete project information (30+ fields)</li>
                <li>Add components and their details</li>
                <li>Run reserve study calculations</li>
                <li>View results and reports</li>
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
              <Link
                href="/sites"
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
