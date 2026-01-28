// src/app/sites/[id]/components/[componentId]/page.js
// Component Detail & Edit Page
'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { getSite, getComponent, updateComponent, deleteComponent } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { NoteSelector } from '@/components/NoteSelector';
import { doc, getDoc } from 'firebase/firestore';

export default function ComponentDetailPage() {
  const [site, setSite] = useState(null);
  const [component, setComponent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [organizationId, setOrganizationId] = useState(null);
  
  const params = useParams();
  const siteId = params.id;
  const componentId = params.componentId;
  
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm();
  
  const quantity = watch('quantity');
  const unitCost = watch('unitCost');

  useEffect(() => {
    const loadData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        window.location.href = '/';
        return;
      }
      
      try {
        // Load user's organization
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setOrganizationId(userDoc.data().organizationId);
        }
        
        const [siteData, componentData] = await Promise.all([
          getSite(siteId),
          getComponent(siteId, componentId)
        ]);
        
        setSite(siteData);
        setComponent(componentData);
        
        if (componentData) {
          reset(componentData);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [siteId, componentId, reset]);

  // Auto-calculate total cost in edit mode
  useEffect(() => {
    if (editMode && quantity !== undefined && unitCost !== undefined) {
      const total = (parseInt(quantity) || 0) * (parseFloat(unitCost) || 0);
      setValue('totalCost', total.toFixed(2));
    }
  }, [quantity, unitCost, editMode, setValue]);

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
        assignedNoteId: data.assignedNoteId || null,
      };
      
      await updateComponent(siteId, componentId, componentData);
      alert('Component updated successfully!');
      setEditMode(false);
      setComponent({...component, ...componentData});
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating component');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this component? This action cannot be undone.')) {
      return;
    }
    
    setDeleting(true);
    try {
      await deleteComponent(siteId, componentId);
      alert('Component deleted successfully!');
      window.location.href = `/sites/${siteId}/components`;
    } catch (error) {
      console.error('Error:', error);
      alert('Error deleting component');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!component) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">Component not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Link 
          href={`/sites/${siteId}/components`}
          className="text-red-600 hover:text-red-800 mb-4 inline-block"
        >
          ← Back to Components
        </Link>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{component.description}</h1>
              <p className="text-gray-600 mt-1">{site?.siteName}</p>
            </div>
            
            <div className="flex gap-2">
              {!editMode ? (
                <>
                  <button
                    onClick={() => setEditMode(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditMode(false);
                    reset(component);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-gray-900"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Component Information */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Component Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Category</label>
                {editMode ? (
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
                ) : (
                  <p className="text-gray-900">{component.category}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Description</label>
                {editMode ? (
                  <input
                    {...register('description', { required: true })}
                    className="w-full px-3 py-2 border rounded text-gray-900"
                  />
                ) : (
                  <p className="text-gray-900">{component.description}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Notes</label>
                {editMode ? (
                  <textarea
                    {...register('notes')}
                    className="w-full px-3 py-2 border rounded text-gray-900"
                    rows="3"
                    placeholder="Additional notes or observations about this component..."
                  />
                ) : (
                  <p className="text-gray-900">{component.notes || 'No notes'}</p>
                )}
              </div>

              {/* NEW: Assigned Component Note */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">
                  📋 Assigned Component Note
                </label>
                {editMode ? (
                  <>
                    <NoteSelector
                      value={watch('assignedNoteId')}
                      onChange={(noteId) => setValue('assignedNoteId', noteId)}
                      organizationId={organizationId}
                      componentName={watch('description')}
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Select a standard component description from your organization's notes library. 
                      This will be used in reports and documentation.
                    </p>
                  </>
                ) : (
                  <div>
                    {component.assignedNoteId ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-sm text-blue-900">
                          ✓ Component note assigned
                        </p>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No component note assigned</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Quantity and Cost */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Quantity & Cost</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Quantity</label>
                {editMode ? (
                  <input
                    type="number"
                    {...register('quantity', { required: true })}
                    className="w-full px-3 py-2 border rounded text-gray-900"
                  />
                ) : (
                  <p className="text-gray-900">{component.quantity}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Unit</label>
                {editMode ? (
                  <input
                    {...register('unit', { required: true })}
                    className="w-full px-3 py-2 border rounded text-gray-900"
                    placeholder="EA, SF, LF, etc."
                  />
                ) : (
                  <p className="text-gray-900">{component.unit}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Unit Cost ($)</label>
                {editMode ? (
                  <input
                    type="number"
                    step="0.01"
                    {...register('unitCost', { required: true })}
                    className="w-full px-3 py-2 border rounded text-gray-900"
                  />
                ) : (
                  <p className="text-gray-900">${parseFloat(component.unitCost || 0).toFixed(2)}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Total Cost ($)</label>
                {editMode ? (
                  <input
                    type="number"
                    step="0.01"
                    {...register('totalCost')}
                    className="w-full px-3 py-2 border rounded bg-gray-100 text-gray-900"
                    readOnly
                  />
                ) : (
                  <p className="text-gray-900 font-bold">${parseFloat(component.totalCost || 0).toFixed(2)}</p>
                )}
              </div>
            </div>
          </section>

          {/* Lifecycle Information */}
          <section className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Lifecycle Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Useful Life (years)</label>
                {editMode ? (
                  <input
                    type="number"
                    {...register('usefulLife', { required: true })}
                    className="w-full px-3 py-2 border rounded text-gray-900"
                  />
                ) : (
                  <p className="text-gray-900">{component.usefulLife} years</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Remaining Useful Life (years)</label>
                {editMode ? (
                  <input
                    type="number"
                    {...register('remainingUsefulLife', { required: true })}
                    className="w-full px-3 py-2 border rounded text-gray-900"
                  />
                ) : (
                  <p className="text-gray-900">{component.remainingUsefulLife} years</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Placement Year</label>
                <p className="text-gray-900">{component.placementYear}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Replacement Year</label>
                <p className="text-gray-900 font-bold">{component.replacementYear}</p>
              </div>
            </div>
            
            {editMode && (
              <div className="mt-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register('isPreventiveMaintenance')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900">Preventive Maintenance Item</span>
                </label>
              </div>
            )}
          </section>

          {editMode && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
