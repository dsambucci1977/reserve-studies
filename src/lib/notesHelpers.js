// Notes Management Helper Functions
import { collection, doc, getDocs, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Import notes from parsed Excel data to Master Template
 * @param {Array} notesData - Array of note objects from CN_DB.xlsx
 */
export async function importNotesToMasterTemplate(notesData) {
  try {
    console.log(`Importing ${notesData.length} notes to master template...`);
    
    const batchSize = 500; // Firestore batch limit
    let imported = 0;
    
    for (let i = 0; i < notesData.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = notesData.slice(i, i + batchSize);
      
      chunk.forEach(note => {
        const noteRef = doc(collection(db, 'masterTemplates/notes/items'));
        batch.set(noteRef, {
          componentId: note.componentId || 0,
          componentName: note.componentName || '',
          description: note.description || '',
          componentGroup: note.componentGroup || '',
          isDefault: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
      
      await batch.commit();
      imported += chunk.length;
      console.log(`Imported ${imported}/${notesData.length} notes`);
    }
    
    // Store metadata
    await setDoc(doc(db, 'masterTemplates', 'notes'), {
      totalNotes: notesData.length,
      lastImported: new Date(),
      version: '1.0'
    });
    
    return {
      success: true,
      total: notesData.length,
      imported: imported
    };
  } catch (error) {
    console.error('Error importing notes:', error);
    throw error;
  }
}

/**
 * Copy master template notes to a new organization
 * @param {string} organizationId - The organization ID to copy notes to
 */
export async function copyMasterNotesToOrganization(organizationId) {
  try {
    console.log(`Copying master notes to organization: ${organizationId}`);
    
    // Get all master template notes
    const masterNotesRef = collection(db, 'masterTemplates/notes/items');
    const snapshot = await getDocs(masterNotesRef);
    
    if (snapshot.empty) {
      console.warn('No master notes found. Import CN_DB.xlsx first.');
      return {
        success: false,
        message: 'No master notes template found'
      };
    }
    
    const notes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`Found ${notes.length} notes in master template`);
    
    // Batch copy to organization
    const batchSize = 500;
    let copied = 0;
    
    for (let i = 0; i < notes.length; i += batchSize) {
      const batch = writeBatch(db);
      const chunk = notes.slice(i, i + batchSize);
      
      chunk.forEach(note => {
        const orgNoteRef = doc(collection(db, `organizations/${organizationId}/notes`));
        const { id, ...noteData } = note; // Remove master template ID
        batch.set(orgNoteRef, {
          ...noteData,
          copiedFromMaster: true,
          copiedAt: new Date()
        });
      });
      
      await batch.commit();
      copied += chunk.length;
      console.log(`Copied ${copied}/${notes.length} notes`);
    }
    
    return {
      success: true,
      total: notes.length,
      copied: copied
    };
  } catch (error) {
    console.error('Error copying notes:', error);
    throw error;
  }
}

/**
 * Get master template note count
 */
export async function getMasterTemplateNoteCount() {
  try {
    const metaDoc = await getDoc(doc(db, 'masterTemplates', 'notes'));
    if (metaDoc.exists()) {
      return metaDoc.data().totalNotes || 0;
    }
    
    // Fallback: count manually
    const snapshot = await getDocs(collection(db, 'masterTemplates/notes/items'));
    return snapshot.size;
  } catch (error) {
    console.error('Error getting note count:', error);
    return 0;
  }
}

/**
 * Reset organization notes to master template
 * @param {string} organizationId - The organization ID
 */
export async function resetOrganizationNotesToMaster(organizationId) {
  try {
    console.log(`Resetting notes for organization: ${organizationId}`);
    
    // Delete existing org notes
    const orgNotesRef = collection(db, `organizations/${organizationId}/notes`);
    const orgSnapshot = await getDocs(orgNotesRef);
    
    const deleteSize = 500;
    for (let i = 0; i < orgSnapshot.docs.length; i += deleteSize) {
      const batch = writeBatch(db);
      const chunk = orgSnapshot.docs.slice(i, i + deleteSize);
      chunk.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    
    // Copy fresh from master
    return await copyMasterNotesToOrganization(organizationId);
  } catch (error) {
    console.error('Error resetting notes:', error);
    throw error;
  }
}

/**
 * Parse Excel file to notes data
 * @param {File} file - The Excel file
 */
export async function parseExcelToNotes(file) {
  // This requires xlsx library
  const XLSX = await import('xlsx');
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets['CN_DB'];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const notes = jsonData.map(row => ({
          componentId: parseInt(row.Components_ID) || 0,
          componentName: row.Component || '',
          description: row.Description || '',
          componentGroup: row['Component Group'] || ''
        }));
        
        resolve(notes);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
