// src/app/sites/[id]/project-info/page.js
// Project Information - Complete 30+ field form

'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getSite } from '@/lib/db';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import ProjectInfoForm from '@/components/forms/ProjectInfoForm';

export default function ProjectInfoPage() {
  const [user, setUser] = useState(null);
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const siteId = params.id;

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Load site data
        try {
          const siteData = await getSite(siteId);
          if (siteData) {
            setSite(siteData);
          } else {
            alert('Site not found');
            router.push('/sites');
          }
        } catch (error) {
          console.error('Error loading site:', error);
          alert('Error loading site');
        }
        
        setLoading(false);
      } else {
        router.push('/');
      }
    });

    return () => unsubscribe();
  }, [router, siteId]);

  const handleSave = () => {
    // After save, go back to site detail
    router.push(`/sites/${siteId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/sites" className="text-2xl font-bold text-red-600 hover:text-red-700">
              Pronoia Reserve Studies
            </Link>
            <div className="flex gap-4">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/sites"
                className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
              >
                Sites
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href={`/sites/${siteId}`}
            className="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            ← Back to Site
          </Link>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Project Information</h1>
          <p className="text-gray-600">
            {site?.siteName || 'Untitled Site'}
          </p>
        </div>

        {/* Project Info Form */}
        <ProjectInfoForm 
          siteId={siteId}
          initialData={site}
          onSave={handleSave}
        />
      </main>
    </div>
  );
}
