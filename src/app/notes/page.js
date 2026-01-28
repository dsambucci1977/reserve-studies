'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function NotesLibraryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [notes, setNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [editingNote, setEditingNote] = useState(null);
  const [message, setMessage] = useState('');

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    loadData();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [notes, searchTerm]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        setMessage('User profile not found');
        return;
      }
      
      const userData = userDoc.data();
      setUserProfile(userData);
      
      if (!userData.organizationId) {
        setMessage('No organization assigned. Contact your administrator.');
        return;
      }
      
      const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
      if (orgDoc.exists()) {
        setOrganization({ id: orgDoc.id, ...orgDoc.data() });
      }
      
      await loadNotes(userData.organizationId);
      
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading notes library');
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (orgId) => {
    try {
      const notesRef = collection(db, `organizations/${orgId}/notes`);
      const notesSnapshot = await getDocs(notesRef);
      const notesList = notesSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      notesList.sort((a, b) => (a.componentName || '').localeCompare(b.componentName || ''));
      
      setNotes(notesList);
      setFilteredNotes(notesList);
    } catch (error) {
      console.error('Error loading notes:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...notes];
    
    if (searchTerm) {
      filtered = filtered.filter(note =>
        note.componentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.componentGroup?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    setFilteredNotes(filtered);
  };

  const handleEditNote = (note) => {
    if (!isAdmin) {
      setMessage('Only admins can edit notes');
      return;
    }
    setEditingNote({ ...note });
  };

  const handleSaveNote = async () => {
    try {
      if (!editingNote || !organization) return;
      
      const noteRef = doc(db, `organizations/${organization.id}/notes`, editingNote.id);
      await updateDoc(noteRef, {
        description: editingNote.description,
        componentName: editingNote.componentName,
        componentGroup: editingNote.componentGroup,
        updatedAt: new Date()
      });
      
      setMessage('Note updated successfully');
      setEditingNote(null);
      await loadNotes(organization.id);
    } catch (error) {
      console.error('Error saving note:', error);
      setMessage('Error saving note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!isAdmin) {
      setMessage('Only admins can delete notes');
      return;
    }
    
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
      await deleteDoc(doc(db, `organizations/${organization.id}/notes`, noteId));
      setMessage('Note deleted successfully');
      await loadNotes(organization.id);
    } catch (error) {
      console.error('Error deleting note:', error);
      setMessage('Error deleting note');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!userProfile || !organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">No Organization</h1>
          <p className="text-gray-600 mt-2">You need to be assigned to an organization</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Component Notes Library</h1>
          <p className="text-gray-600 mt-2">{organization?.name} - Component Descriptions</p>
          {!isAdmin && (
            <p className="text-sm text-gray-500 mt-1">View-only access. Contact your admin to edit notes.</p>
          )}
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error') || message.includes('denied')
              ? 'bg-red-50 border border-red-200 text-red-800' 
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {message}
          </div>
        )}

        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex-1 mr-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search notes by component name, description, or group..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
              />
            </div>
            <div className="text-sm text-gray-600">
              {filteredNotes.length} of {notes.length} notes
            </div>
          </div>
        </div>

        {filteredNotes.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📝</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No notes found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search' : 'Your organization has no notes yet. Contact your administrator.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map(note => (
              <div key={note.id} className="bg-white shadow rounded-lg p-6">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{note.componentName}</h3>
                    {note.componentGroup && (
                      <span className="text-sm text-gray-500">Group: {note.componentGroup}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedNote(note)}
                      className="px-3 py-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleEditNote(note)}
                          className="px-3 py-1 text-purple-600 hover:text-purple-800 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="px-3 py-1 text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-gray-700 line-clamp-2">{note.description}</p>
              </div>
            ))}
          </div>
        )}

        {selectedNote && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">{selectedNote.componentName}</h2>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                >
                  ✕
                </button>
              </div>
              {selectedNote.componentGroup && (
                <p className="text-sm text-gray-600 mb-4">Group: {selectedNote.componentGroup}</p>
              )}
              <div className="prose max-w-none">
                <p className="text-gray-700 whitespace-pre-wrap">{selectedNote.description}</p>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedNote(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {editingNote && isAdmin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Edit Note</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Component Name</label>
                  <input
                    type="text"
                    value={editingNote.componentName || ''}
                    onChange={(e) => setEditingNote({...editingNote, componentName: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Component Group</label>
                  <input
                    type="text"
                    value={editingNote.componentGroup || ''}
                    onChange={(e) => setEditingNote({...editingNote, componentGroup: e.target.value})}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editingNote.description || ''}
                    onChange={(e) => setEditingNote({...editingNote, description: e.target.value})}
                    rows="8"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setEditingNote(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveNote}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
