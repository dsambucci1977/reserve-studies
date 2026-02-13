// src/app/sites/[id]/components/new/page.js
// Add New Component Form - Quantity as whole number

'use client';

import { useEffect, useState } from 'react';
import { getSite, createComponent } from '@/lib/db';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

export default function NewComponentPage() {
  const [site, setSite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const params = useParams();
  const siteId = params.id;
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      category: 'Sitework',
      quantity: 1,
      unit: 'Each',
      unitCost: 0,
      totalCost: 0,
      usefulLife: 20,
      remainingUsefulLife: 10,
      condition: 'Good',
      isPreventiveMaintenance: false,
    }
  });

  const quantity = watch('quantity');
  const unitCost = watch('unitCost');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/auth/signin'); return; }
    
    const loadData = async () => {
      try {
        const siteData = await getSite(siteId);
        setSite(siteData);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [user, authLoading, siteId, router]);

  // Auto-calculate total cost
  useEffect(() => {
    const total = (parseInt(quantity) || 0) * (parseFloat(unitCost) || 0);
    setValue('totalCost', total.toFixed(2));
  }, [quantity, unitCost, setValue]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const beginningYear = site?.beginningYear || new Date().getFullYear();
      const placementYear = beginningYear - (data.usefulLife - data.remainingUsefulLife);
      const replacementYear = beginningYear + data.remainingUsefulLife;
      
      const componentData = {
        ...data,
        quantity: parseInt(data.quantity) || 0,
        unitCost: parseFloat(data.unitCost) || 0,
        totalCost: parseFloat(data.totalCost) || 0,
        usefulLife: parseInt(data.usefulLife) || 0,
        remainingUsefulLife: parseInt(data.remainingUsefulLife) || 0,
        placementYear: placementYear,
        replacementYear: replacementYear,
        isPreventiveMaintenance: data.isPreventiveMaintenance || false,
      };
      
      await createComponent(siteId, componentData);
      alert('Component added successfully!');
      router.push(`/sites/${siteId}/components`);
    } catch (error) {
      console.error('Error:', error);
      alert('Error adding component');
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
      {/* Header */}
      <header className="bg-white shadow">
        <div className="w-full px-6 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-red-600">Pronoia Reserve Studies</h1>
            <div className="flex gap-4">
              <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
              <Link href="/sites" className="text-gray-700 hover:text-gray-900">Sites</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-6 py-8">
        <Link href={`/sites/${siteId}/components`} className="text-red-600 hover:text-red-700 font-medium">
          ← Back to Components
        </Link>
        
        <div className="mt-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Add Component</h1>
          <p className="text-gray-700 mt-2">{site?.siteName}</p>
        </div>

        {/* Component Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Basic Information */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Component Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Category *
                </label>
                <select
                  {...register('category', { required: true })}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                >
                  <option value="Sitework">Sitework</option>
                  <option value="Building">Building</option>
                  <option value="Building Exterior">Building Exterior</option>
                  <option value="Interior">Interior</option>
                  <option value="Electrical">Electrical</option>
                  <option value="Special">Special</option>
                  <option value="Mechanical">Mechanical</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Component Description *
                </label>
                <input
                  {...register('description', { required: true })}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="e.g., Asphalt Paving - Parking Lot"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Notes / Comments
                </label>
                <textarea
                  {...register('notes')}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  rows="3"
                  placeholder="Additional details about this component..."
                />
              </div>
            </div>
          </section>

          {/* Quantity and Cost */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Quantity & Cost</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Quantity *</label>
                <input
                  {...register('quantity', { required: true })}
                  type="number"
                  step="1"
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Unit *</label>
                <select
                  {...register('unit', { required: true })}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                >
                  <option value="Each">Each</option>
                  <option value="SF">Square Feet (SF)</option>
                  <option value="LF">Linear Feet (LF)</option>
                  <option value="SY">Square Yards (SY)</option>
                  <option value="Gallons">Gallons</option>
                  <option value="Units">Units</option>
                  <option value="LS">Lump Sum (LS)</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Unit Cost ($) *</label>
                <input
                  {...register('unitCost', { required: true })}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Total Cost ($)</label>
                <input
                  {...register('totalCost')}
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border rounded text-gray-900 bg-gray-50"
                  readOnly
                  placeholder="Auto-calculated"
                />
                <p className="text-xs text-gray-600 mt-1">Auto-calculated: Quantity × Unit Cost</p>
              </div>
            </div>
          </section>

          {/* Life Cycle Information */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Life Cycle</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Useful Life (Years) *
                </label>
                <input
                  {...register('usefulLife', { required: true })}
                  type="number"
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="20"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Remaining Useful Life (Years) *
                </label>
                <input
                  {...register('remainingUsefulLife', { required: true })}
                  type="number"
                  className="w-full px-3 py-2 border rounded text-gray-900"
                  placeholder="10"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">
                  Condition
                </label>
                <select
                  {...register('condition')}
                  className="w-full px-3 py-2 border rounded text-gray-900"
                >
                  <option value="Excellent">Excellent</option>
                  <option value="Good">Good</option>
                  <option value="Fair">Fair</option>
                  <option value="Poor">Poor</option>
                </select>
              </div>
            </div>
          </section>

          {/* Funding Designation */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Funding Designation</h2>
            
            <div className="flex items-start space-x-3">
              <input
                {...register('isPreventiveMaintenance')}
                type="checkbox"
                className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <div>
                <label className="block text-sm font-medium text-gray-900">
                  Preventive Maintenance
                </label>
                <p className="text-sm text-gray-600 mt-1">
                  Check this box if this component should be funded from the Preventive Maintenance fund instead of the Reserve fund.
                </p>
              </div>
            </div>
          </section>

          {/* Save Buttons */}
          <div className="flex justify-end gap-4">
            <Link
              href={`/sites/${siteId}/components`}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 font-medium"
            >
              {saving ? 'Saving...' : 'Add Component'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}