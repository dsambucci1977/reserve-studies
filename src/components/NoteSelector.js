'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function NoteSelector({ 
  value, 
  onChange, 
  organizationId, 
  componentName = '',
  className = '' 
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);

  useEffect(() => {
    loadNotes();
  }, [organizationId]);

  useEffect(() => {
    if (value && notes.length > 0) {
      const note = notes.find(n => n.id === value);
      setSelectedNote(note);
    }
  }, [value, notes]);

  const loadNotes = async () => {
    if (!organizationId) return;
    
    try {
      setLoading(true);
      const notesRef = collection(db, `organizations/${organizationId}/notes`);
      const snapshot = await getDocs(notesRef);
      const notesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by component name
      notesList.sort((a, b) => 
        (a.componentName || '').localeCompare(b.componentName || '')
      );
      
      setNotes(notesList);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredNotes = () => {
    if (!searchTerm && !componentName) return notes;
    
    return notes.filter(note => {
      const search = searchTerm.toLowerCase();
      const compName = componentName.toLowerCase();
      const noteName = (note.componentName || '').toLowerCase();
      
      if (searchTerm) {
        return noteName.includes(search) || 
               (note.description || '').toLowerCase().includes(search);
      }
      
      if (componentName) {
        return noteName.includes(compName);
      }
      
      return true;
    });
  };

  const handleChange = (noteId) => {
    onChange(noteId);
    const note = notes.find(n => n.id === noteId);
    setSelectedNote(note);
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500">Loading notes...</div>
    );
  }

  const filteredNotes = getFilteredNotes();

  return (
    <div className={className}>
      <div className="space-y-2">
        {/* Note Selection Dropdown */}
        <select
          value={value || ''}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
        >
          <option value="">-- No Note Assigned --</option>
          {filteredNotes.map(note => (
            <option key={note.id} value={note.id}>
              {note.componentName}
            </option>
          ))}
        </select>

        {/* Search Filter */}
        {notes.length > 20 && (
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
          />
        )}

        {/* Preview Button */}
        {selectedNote && (
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            📄 Preview Note
          </button>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold text-gray-900">{selectedNote.componentName}</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
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
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Compact version for table cells
export function NoteDisplay({ noteId, organizationId }) {
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNote();
  }, [noteId, organizationId]);

  const loadNote = async () => {
    if (!noteId || !organizationId) {
      setLoading(false);
      return;
    }

    try {
      const noteDoc = await getDoc(doc(db, `organizations/${organizationId}/notes`, noteId));
      if (noteDoc.exists()) {
        setNote({ id: noteDoc.id, ...noteDoc.data() });
      }
    } catch (error) {
      console.error('Error loading note:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <span className="text-gray-400 text-sm">Loading...</span>;
  if (!note) return <span className="text-gray-400 text-sm">No note</span>;

  return (
    <span className="text-gray-900 text-sm" title={note.description}>
      {note.componentName}
    </span>
  );
}
