// Import Notes from CN_DB.xlsx to Firestore
// Usage: Run this in a Node.js environment or as a Cloud Function

const XLSX = require('xlsx');
const admin = require('firebase-admin');

async function importNotesToOrganization(orgId, excelFilePath) {
  console.log(`\n📚 Importing notes for organization: ${orgId}\n`);
  
  // 1. Read Excel file
  const workbook = XLSX.readFile(excelFilePath);
  const worksheet = workbook.Sheets['CN_DB'];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Found ${data.length} notes to import`);
  
  // 2. Transform data
  const notes = data.map(row => ({
    componentId: parseInt(row.Components_ID) || 0,
    componentName: row.Component || '',
    description: row.Description || '',
    componentGroup: row['Component Group'] || '',
    isDefault: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }));
  
  // 3. Batch write to Firestore (max 500 per batch)
  const db = admin.firestore();
  const batchSize = 500;
  let imported = 0;
  
  for (let i = 0; i < notes.length; i += batchSize) {
    const batch = db.batch();
    const chunk = notes.slice(i, i + batchSize);
    
    chunk.forEach(note => {
      const docRef = db.collection(`organizations/${orgId}/notes`).doc();
      batch.set(docRef, note);
    });
    
    await batch.commit();
    imported += chunk.length;
    console.log(`✅ Imported ${imported}/${notes.length} notes`);
  }
  
  console.log(`\n🎉 Successfully imported ${notes.length} notes!`);
  
  return {
    total: notes.length,
    imported: imported
  };
}

// Export for use
module.exports = { importNotesToOrganization };

// Example usage:
// const { importNotesToOrganization } = require('./import-notes-script');
// importNotesToOrganization('your-org-id', './CN_DB.xlsx');
