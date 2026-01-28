'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { getSite, getComponents, updateComponent, deleteComponent } from '@/lib/db';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export default function ComponentsListPage() {
  const [site, setSite] = useState(null);
  const [components, setComponents] = useState([]);
  const [notes, setNotes] = useState([]);
  const [organizationId, setOrganizationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [previewNote, setPreviewNote] = useState(null);
  const [selectedComponents, setSelectedComponents] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  
  const params = useParams();
  const router = useRouter();
  const siteId = params.id;

  useEffect(() => {
    loadData();
  }, [siteId]);

  const loadData = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      router.push('/auth/signin');
      return;
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const orgId = userDoc.data().organizationId;
        setOrganizationId(orgId);
        
        if (orgId) {
          const notesRef = collection(db, `organizations/${orgId}/notes`);
          const notesSnapshot = await getDocs(notesRef);
          const notesList = notesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          notesList.sort((a, b) => (a.componentId || 0) - (b.componentId || 0));
          setNotes(notesList);
        }
      }

      const [siteData, componentsData] = await Promise.all([
        getSite(siteId),
        getComponents(siteId)
      ]);

      setSite(siteData);
      setComponents(componentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = async (componentId, field, value) => {
    try {
      const component = components.find(c => c.id === componentId);
      const updates = { [field]: value };
      
      if (field === 'quantity' || field === 'unitCost') {
        const qty = field === 'quantity' ? parseFloat(value) : parseFloat(component.quantity);
        const cost = field === 'unitCost' ? parseFloat(value) : parseFloat(component.unitCost);
        updates.totalCost = (qty * cost).toFixed(2);
      }
      
      await updateComponent(siteId, componentId, updates);
      
      setComponents(prev => prev.map(c => 
        c.id === componentId ? { ...c, ...updates } : c
      ));
      
      setEditingCell(null);
    } catch (error) {
      console.error('Error updating component:', error);
      alert('Error updating component');
    }
  };

  const handleNoteChange = async (componentId, noteId) => {
    await handleCellEdit(componentId, 'assignedNoteId', noteId || null);
  };

  const handlePreventiveMaintenanceToggle = async (componentId, currentValue) => {
    await handleCellEdit(componentId, 'isPreventiveMaintenance', !currentValue);
  };

  const toggleSelectAll = () => {
    if (selectedComponents.size === components.length) {
      setSelectedComponents(new Set());
    } else {
      setSelectedComponents(new Set(components.map(c => c.id)));
    }
  };

  const toggleSelectComponent = (componentId) => {
    const newSelected = new Set(selectedComponents);
    if (newSelected.has(componentId)) {
      newSelected.delete(componentId);
    } else {
      newSelected.add(componentId);
    }
    setSelectedComponents(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedComponents.size === 0) {
      alert('Please select components to delete');
      return;
    }

    if (!confirm(`Delete ${selectedComponents.size} component(s)? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const deletePromises = Array.from(selectedComponents).map(id => 
        deleteComponent(siteId, id)
      );
      await Promise.all(deletePromises);
      
      setComponents(prev => prev.filter(c => !selectedComponents.has(c.id)));
      setSelectedComponents(new Set());
      
      alert(`Successfully deleted ${deletePromises.length} component(s)`);
    } catch (error) {
      console.error('Error deleting components:', error);
      alert('Error deleting components');
    } finally {
      setDeleting(false);
    }
  };

  const getNoteById = (noteId) => {
    return notes.find(n => n.id === noteId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-full mx-auto px-4">
        
        <Link href={`/sites/${siteId}`} className="text-red-600 hover:text-red-800 mb-4 inline-block">
          ← Back to Site
        </Link>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Components</h1>
            <p className="text-gray-600 mt-1">{site?.siteName}</p>
          </div>
          <div className="flex gap-2">
            {selectedComponents.size > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : `🗑️ Delete (${selectedComponents.size})`}
              </button>
            )}
            <Link
              href={`/sites/${siteId}/components/import`}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
            >
              📄 Import CSV
            </Link>
            <Link
              href={`/sites/${siteId}/components/new`}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
            >
              + Add Component
            </Link>
          </div>
        </div>

        {/* Spreadsheet-style table with frozen header */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto" style={{ maxHeight: 'calc(100vh - 250px)' }}>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-3 bg-gray-50 w-12">
                    <input
                      type="checkbox"
                      checked={selectedComponents.size === components.length && components.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                  </th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-48">Component</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-32">Category</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-24">Quantity</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-20">Unit</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-28">Unit Cost</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-28">Total Cost</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-16 text-center" title="Preventive Maintenance">PM</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase w-24">Note #</th>
                  <th className="px-3 py-3 bg-gray-50 text-left text-xs font-medium text-gray-700 uppercase">Note Description</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {components.map(component => {
                  const assignedNote = getNoteById(component.assignedNoteId);
                  const isSelected = selectedComponents.has(component.id);
                  
                  return (
                    <tr key={component.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                      {/* Checkbox */}
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectComponent(component.id)}
                          className="h-4 w-4 text-blue-600 rounded"
                        />
                      </td>

                      {/* Component Name */}
                      <td className="px-3 py-2">
                        {editingCell === `${component.id}-description` ? (
                          <input
                            type="text"
                            defaultValue={component.description}
                            onBlur={(e) => handleCellEdit(component.id, 'description', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            className="w-full px-2 py-1 border rounded text-gray-900 text-sm"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell(`${component.id}-description`)}
                            className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-gray-900"
                          >
                            {component.description}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td className="px-3 py-2">
                        <select
                          value={component.category}
                          onChange={(e) => handleCellEdit(component.id, 'category', e.target.value)}
                          className="w-full px-2 py-1 border rounded text-gray-900 text-sm bg-white"
                        >
                          <option value="Sitework">Sitework</option>
                          <option value="Building">Building</option>
                          <option value="Building Exterior">Building Exterior</option>
                          <option value="Interior">Interior</option>
                          <option value="Electrical">Electrical</option>
                          <option value="Special">Special</option>
                          <option value="Mechanical">Mechanical</option>
                        </select>
                      </td>

                      {/* Quantity */}
                      <td className="px-3 py-2">
                        {editingCell === `${component.id}-quantity` ? (
                          <input
                            type="number"
                            defaultValue={component.quantity}
                            onBlur={(e) => handleCellEdit(component.id, 'quantity', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            className="w-full px-2 py-1 border rounded text-gray-900 text-sm"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell(`${component.id}-quantity`)}
                            className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-gray-900 text-right"
                          >
                            {component.quantity}
                          </div>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="px-3 py-2">
                        {editingCell === `${component.id}-unit` ? (
                          <input
                            type="text"
                            defaultValue={component.unit}
                            onBlur={(e) => handleCellEdit(component.id, 'unit', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            className="w-full px-2 py-1 border rounded text-gray-900 text-sm"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell(`${component.id}-unit`)}
                            className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-gray-900"
                          >
                            {component.unit}
                          </div>
                        )}
                      </td>

                      {/* Unit Cost */}
                      <td className="px-3 py-2">
                        {editingCell === `${component.id}-unitCost` ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={component.unitCost}
                            onBlur={(e) => handleCellEdit(component.id, 'unitCost', e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                            className="w-full px-2 py-1 border rounded text-gray-900 text-sm"
                            autoFocus
                          />
                        ) : (
                          <div
                            onClick={() => setEditingCell(`${component.id}-unitCost`)}
                            className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-gray-900 text-right"
                          >
                            ${parseFloat(component.unitCost || 0).toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* Total Cost */}
                      <td className="px-3 py-2 text-gray-900 font-semibold text-right">
                        ${parseFloat(component.totalCost || 0).toFixed(2)}
                      </td>

                      {/* Preventive Maintenance */}
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={component.isPreventiveMaintenance || false}
                          onChange={() => handlePreventiveMaintenanceToggle(component.id, component.isPreventiveMaintenance)}
                          className="h-4 w-4 text-green-600 rounded"
                          title="Preventive Maintenance"
                        />
                      </td>

                      {/* Note Number */}
                      <td className="px-3 py-2">
                        <select
                          value={component.assignedNoteId || ''}
                          onChange={(e) => handleNoteChange(component.id, e.target.value)}
                          className="w-full px-2 py-1 border rounded text-gray-900 text-sm bg-white"
                        >
                          <option value="">--</option>
                          {notes.map(note => (
                            <option key={note.id} value={note.id}>
                              {note.componentId}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Note Description */}
                      <td className="px-3 py-2">
                        {assignedNote ? (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-900 truncate" title={assignedNote.description}>
                              {assignedNote.componentName}
                            </span>
                            <button
                              onClick={() => setPreviewNote(assignedNote)}
                              className="text-blue-600 hover:text-blue-800 text-xs flex-shrink-0"
                            >
                              👁️
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">No note assigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {components.length === 0 && (
          <div className="bg-white shadow rounded-lg p-12 text-center mt-6">
            <div className="text-gray-400 text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No components yet</h3>
            <p className="text-gray-600 mb-6">Get started by adding your first component</p>
            <Link
              href={`/sites/${siteId}/components/new`}
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              + Add Component
            </Link>
          </div>
        )}

        {/* Note Preview Modal */}
        {previewNote && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded font-mono font-bold">
                      #{previewNote.componentId}
                    </span>
                    <h3 className="text-2xl font-bold text-gray-900">{previewNote.componentName}</h3>
                  </div>
                  {previewNote.componentGroup && (
                    <p className="text-sm text-gray-600">Group: {previewNote.componentGroup}</p>
                  )}
                </div>
                <button
                  onClick={() => setPreviewNote(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{previewNote.description}</p>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setPreviewNote(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
