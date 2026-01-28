// Migration Script: Move user and their sites to a different organization
// Usage: node src/scripts/migrate-user-to-org.js <email> <org-name>

const admin = require('firebase-admin');
const serviceAccount = require('../../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateUserToOrganization(userEmail, targetOrgName) {
  try {
    console.log(`\n🔄 Starting migration for ${userEmail} to ${targetOrgName}...\n`);

    // 1. Find the user
    const usersSnapshot = await db.collection('users')
      .where('email', '==', userEmail)
      .get();
    
    if (usersSnapshot.empty) {
      console.error('❌ User not found!');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    const userId = userDoc.id;
    const userData = userDoc.data();
    
    console.log(`✅ Found user: ${userData.displayName || userEmail}`);
    console.log(`   Current org: ${userData.organizationId || 'none'}`);

    // 2. Find the target organization
    const orgsSnapshot = await db.collection('organizations')
      .where('name', '==', targetOrgName)
      .get();
    
    if (orgsSnapshot.empty) {
      console.error('❌ Target organization not found!');
      return;
    }
    
    const targetOrgDoc = orgsSnapshot.docs[0];
    const targetOrgId = targetOrgDoc.id;
    
    console.log(`✅ Found organization: ${targetOrgName}`);
    console.log(`   Org ID: ${targetOrgId}`);

    // 3. Find all sites created by this user
    const sitesSnapshot = await db.collection('sites')
      .where('createdBy', '==', userId)
      .get();
    
    console.log(`\n📊 Found ${sitesSnapshot.size} sites created by this user`);

    // 4. Update user's organization
    await db.collection('users').doc(userId).update({
      organizationId: targetOrgId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Updated user's organization to ${targetOrgName}`);

    // 5. Update all their sites
    const batch = db.batch();
    let siteCount = 0;
    
    sitesSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        organizationId: targetOrgId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      siteCount++;
      console.log(`   - Migrating site: ${doc.data().siteName || doc.id}`);
    });
    
    await batch.commit();
    
    console.log(`\n✅ Successfully migrated ${siteCount} sites to ${targetOrgName}`);
    console.log(`✅ Migration complete!\n`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    process.exit();
  }
}

// Run the migration
const userEmail = process.argv[2];
const targetOrgName = process.argv[3];

if (!userEmail || !targetOrgName) {
  console.log('Usage: node src/scripts/migrate-user-to-org.js <user-email> <org-name>');
  console.log('Example: node src/scripts/migrate-user-to-org.js test@test.com "Beahm Management"');
  process.exit(1);
}

migrateUserToOrganization(userEmail, targetOrgName);

