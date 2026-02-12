// src/app/sites/[id]/project-info/page.js
// Complete Project Information Form - All 30+ Fields

'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { getSite, updateSite } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

export default function ProjectInfoPage() {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const params = useParams();
  const siteId = params.id;

  const { register, handleSubmit, formState: { errors } } = useForm();

  useEffect(() => {
    const loadData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        window.location.href = '/';
        return;
      }
      
      try {
        const siteData = await getSite(siteId);
        setSite(siteData);
      } catch (error) {
        console.error('Error:', error);
        alert('Error loading site');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []); // Run once

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      // Convert string numbers to actual numbers
      const processedData = {
        ...data,
        numberOfUnits: parseInt(data.numberOfUnits) || 0,
        ageOfCommunity: parseInt(data.ageOfCommunity) || 0,
        beginningReserveBalance: parseFloat(data.beginningReserveBalance) || 0,
        currentAnnualContribution: parseFloat(data.currentAnnualContribution) || 0,
        costAdjustmentFactor: parseFloat(data.costAdjustmentFactor) || 1.15,
        inflationRate: parseFloat(data.inflationRate) || 0,
        interestRate: parseFloat(data.interestRate) || 0,
        comparisonRate: parseFloat(data.comparisonRate) || 0,
        beginningYear: parseInt(data.beginningYear) || new Date().getFullYear(),
        projectionYears: parseInt(data.projectionYears) || 30,
        pmBeginningBalance: parseFloat(data.pmBeginningBalance) || 0,
        pmAnnualContribution: parseFloat(data.pmAnnualContribution) || 0,
        pmAveragingLength: parseInt(data.pmAveragingLength) || 30,
      };
      
      await updateSite(siteId, processedData);
      alert('Project information saved successfully!');
      window.location.href = `/sites/${siteId}`;
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error saving project information');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-900">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <main className="w-full px-6 py-8">
        <Link href={`/sites/${siteId}`} className="text-red-600 hover:text-red-700 font-medium">
          ← Back to Site
        </Link>
        
        <div className="mt-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Project Information</h1>
          <p className="text-gray-700 mt-2">{site?.siteName || 'Untitled Site'}</p>
        </div>

        {/* Complete Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Basic Information */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Project Number *
                </label>
                <input
                  {...register('projectNumber', { required: true })}
                  defaultValue={site?.projectNumber}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="25CA 003"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Project Name *
                </label>
                <input
                  {...register('siteName', { required: true })}
                  defaultValue={site?.siteName}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="Willow Park Condominium Association"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Location *
                </label>
                <input
                  {...register('location', { required: true })}
                  defaultValue={site?.location}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="Hoboken, New Jersey"
                />
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Contact Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Contact Name</label>
                <input
                  {...register('contactName')}
                  defaultValue={site?.contactName}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="Mark Horowitz"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Contact Email</label>
                <input
                  {...register('contactEmail')}
                  type="email"
                  defaultValue={site?.contactEmail}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="mark@hunterhomes.com"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-900">Company Name</label>
                <input
                  {...register('clientName')}
                  defaultValue={site?.clientName}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="Hunter Homes of NJ"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-900">Company Address</label>
                <input
                  {...register('companyAddress')}
                  defaultValue={site?.companyAddress}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="33 Newark Street"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">City</label>
                <input
                  {...register('companyCity')}
                  defaultValue={site?.companyCity}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="Hoboken"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">State</label>
                <select
                  {...register('companyState')}
                  defaultValue={site?.companyState || ''}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                >
                  <option value="">Select State</option>
                  <option value="New Jersey">New Jersey</option>
                  <option value="California">California</option>
                  <option value="New York">New York</option>
                  <option value="Florida">Florida</option>
                  <option value="Texas">Texas</option>
                  <option value="Pennsylvania">Pennsylvania</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Zip Code</label>
                <input
                  {...register('companyZip')}
                  defaultValue={site?.companyZip}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="07030"
                />
              </div>
            </div>
          </section>

          {/* Property Details */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Property Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Number of Units *</label>
                <input
                  {...register('numberOfUnits', { required: true })}
                  type="number"
                  defaultValue={site?.numberOfUnits}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="71"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Unit Type</label>
                <select
                  {...register('unitType')}
                  defaultValue={site?.unitType || 'Condominium'}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                >
                  <option value="Condominium">Condominium</option>
                  <option value="Townhouse">Townhouse</option>
                  <option value="Cooperative">Cooperative</option>
                  <option value="Apartment">Apartment</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1 text-gray-900">Building Description</label>
                <textarea
                  {...register('buildingDescription')}
                  defaultValue={site?.buildingDescription}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  rows="2"
                  placeholder="(1) One (6) Six Story Building and Basement"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Age of Community (Years)</label>
                <input
                  {...register('ageOfCommunity')}
                  type="number"
                  defaultValue={site?.ageOfCommunity}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="38"
                />
              </div>
            </div>
          </section>

          {/* Study Information */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Study Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Type of Study</label>
                <select
                  {...register('studyType')}
                  defaultValue={site?.studyType || 'Level 1 Full'}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                >
                  <option value="Level 1 Full">Level 1 Full</option>
                  <option value="Level 2 Update">Level 2 Update</option>
                  </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Inspection Date</label>
                <input
                  {...register('inspectionDate')}
                  type="date"
                  defaultValue={site?.inspectionDate}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Effective Date</label>
                <input
                  {...register('effectiveDate')}
                  type="date"
                  defaultValue={site?.effectiveDate}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Study Date</label>
                <input
                  {...register('studyDate')}
                  type="date"
                  defaultValue={site?.studyDate}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Date Sent to Client</label>
                <input
                  {...register('studySentDate')}
                  type="date"
                  defaultValue={site?.studySentDate}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Previous Reserve Study Date</label>
                <input
                  {...register('previousReserveStudyDate')}
                  type="date"
                  defaultValue={site?.previousReserveStudyDate}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                />
              </div>
            </div>
          </section>

          {/* Financial Parameters */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Financial Parameters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Beginning Reserve Balance * ($)
                </label>
                <input
                  {...register('beginningReserveBalance', { required: true })}
                  type="number"
                  step="0.01"
                  defaultValue={site?.beginningReserveBalance}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="143713"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Current Annual Contribution * ($)
                </label>
                <input
                  {...register('currentAnnualContribution', { required: true })}
                  type="number"
                  step="0.01"
                  defaultValue={site?.currentAnnualContribution}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="29000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Cost Adjustment Factor (GF)
                </label>
                <input
                  {...register('costAdjustmentFactor')}
                  type="number"
                  step="0.01"
                  defaultValue={site?.costAdjustmentFactor || 1.15}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="1.15"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Inflation Rate (%)</label>
                <input
                  {...register('inflationRate')}
                  type="number"
                  step="0.01"
                  defaultValue={site?.inflationRate || 0}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Interest Rate (%)</label>
                <input
                  {...register('interestRate')}
                  type="number"
                  step="0.01"
                  defaultValue={site?.interestRate || 0}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Comparison Rate (%)</label>
                <input
                  {...register('comparisonRate')}
                  type="number"
                  step="0.01"
                  defaultValue={site?.comparisonRate || 0}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="0.00"
                />
              </div>
            </div>
          </section>

          {/* Study Settings */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Study Settings</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Beginning Year *</label>
                <input
                  {...register('beginningYear', { required: true })}
                  type="number"
                  defaultValue={site?.beginningYear || new Date().getFullYear()}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="2025"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Projection Years</label>
                <input
                  {...register('projectionYears')}
                  type="number"
                  defaultValue={site?.projectionYears || 30}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="30"
                />
              </div>
            </div>
          </section>

          {/* Preventive Maintenance */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Preventive Maintenance</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  PM Beginning Balance ($)
                </label>
                <input
                  {...register('pmBeginningBalance')}
                  type="number"
                  step="0.01"
                  defaultValue={site?.pmBeginningBalance || 0}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="1000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  PM Annual Contribution ($)
                </label>
                <input
                  {...register('pmAnnualContribution')}
                  type="number"
                  step="0.01"
                  defaultValue={site?.pmAnnualContribution || 0}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="1000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  PM Averaging Length (Years)
                </label>
                <input
                  {...register('pmAveragingLength')}
                  type="number"
                  defaultValue={site?.pmAveragingLength || 30}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="30"
                />
              </div>
            </div>
          </section>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
            >
              {saving ? 'Saving...' : 'Save Project Information'}
            </button>
          </div>

          {/* Success Notice */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-green-900 font-medium">
              ✅ All 31 fields available!
            </p>
            <p className="text-green-800 text-sm mt-1">
              You now have the complete project information form with all fields from your Google Sheets workbook.
            </p>
          </div>
        </form>
      </main>
    </div>
  );
}
