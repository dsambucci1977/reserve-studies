'use client';

import { useState } from 'react';
import { importNotesToMasterTemplate, getMasterTemplateNoteCount, parseExcelToNotes } from '@/lib/notesHelpers';

export function NotesTab({ masterNoteCount, onImportComplete }) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setMessage('Please upload an Excel file (.xlsx)');
      return;
    }

    try {
      setUploading(true);
      setMessage('');
      setProgress('Parsing Excel file...');

      // Parse Excel
      const notesData = await parseExcelToNotes(file);
      setProgress(`Found ${notesData.length} notes. Importing...`);

      // Import to master template
      const result = await importNotesToMasterTemplate(notesData);

      setProgress('');
      setMessage(`Successfully imported ${result.imported} notes to master template!`);
      onImportComplete();
    } catch (error) {
      console.error('Import error:', error);
      setMessage(`Error: ${error.message}`);
      setProgress('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Master Notes Template</h2>
      <p className="text-gray-600 mb-6">
        Import CN_DB.xlsx once. All new organizations will automatically receive a copy of these notes.
      </p>

      {/* Status Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-blue-900">Master Template Status</h3>
            <p className="text-blue-700 mt-1">
              {masterNoteCount > 0 
                ? `${masterNoteCount} notes in master template`
                : 'No notes imported yet'}
            </p>
          </div>
          {masterNoteCount > 0 && (
            <div className="text-4xl text-blue-600">✅</div>
          )}
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <h3 className="font-bold text-gray-900 mb-4">
          {masterNoteCount > 0 ? 'Re-import Notes (Overwrite)' : 'Import CN_DB.xlsx'}
        </h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload CN_DB.xlsx
          </label>
          <input
            type="file"
            accept=".xlsx"
            onChange={handleFileUpload}
            disabled={uploading}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-white focus:outline-none disabled:opacity-50"
          />
          <p className="text-xs text-gray-500 mt-2">
            Excel file with columns: Components_ID, Component, Description, Component Group
          </p>
        </div>

        {progress && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800 text-sm">
            {progress}
          </div>
        )}

        {message && (
          <div className={`p-3 rounded text-sm ${
            message.includes('Error') 
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {message}
          </div>
        )}

        {uploading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="font-bold text-yellow-900 mb-2">📋 How It Works</h4>
        <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
          <li>Upload CN_DB.xlsx to create master template (one time)</li>
          <li>When creating new organizations, notes are automatically copied</li>
          <li>Each organization gets their own editable copy</li>
          <li>Changes to one org don't affect others</li>
        </ol>
      </div>
    </div>
  );
}
