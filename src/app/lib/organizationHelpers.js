// lib/organizationHelpers.js

import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Create a new organization
 */
export async function createOrganization(name, createdBy, allowedDomains = []) {
  try {
    const orgData = {
      name,
      allowedDomains, // Email domains that auto-join this org
      createdBy,
      createdAt: serverTimestamp(),
      settings: {
        banner: {
          enabled: false,
          message: '',
          backgroundColor: '#0066cc',
          textColor: '#ffffff'
        }
      },
      subscription: {
        plan: 'professional',
        status: 'active',
        maxSites: 50,
        maxUsers: 10
      }
    };
    
    const orgRef = await addDoc(collection(db, 'organizations'), orgData);
    return orgRef.id;
  } catch (error) {
    console.error('Error creating organization:', error);
    throw error;
  }
}

/**
 * Get user's organization
 */
export async function getUserOrganization(userId) {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return null;
    }
    
    const userData = userDoc.data();
    if (!userData.organizationId) {
      return null;
    }
    
    const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
    if (!orgDoc.exists()) {
      return null;
    }
    
    return {
      id: orgDoc.id,
      ...orgDoc.data()
    };
  } catch (error) {
    console.error('Error getting user organization:', error);
    throw error;
  }
}

/**
 * Find organization by email domain
 * @param {string} email - User's email address
 * @returns {object|null} Organization data or null if not found
 */
export async function findOrganizationByEmail(email) {
  try {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return null;
    }
    
    // Query organizations that have this domain in allowedDomains
    const orgsQuery = query(
      collection(db, 'organizations'),
      where('allowedDomains', 'array-contains', domain)
    );
    
    const orgsSnapshot = await getDocs(orgsQuery);
    
    if (orgsSnapshot.empty) {
      return null;
    }
    
    // Return first matching organization
    const orgDoc = orgsSnapshot.docs[0];
    return {
      id: orgDoc.id,
      ...orgDoc.data()
    };
  } catch (error) {
    console.error('Error finding organization by email:', error);
    throw error;
  }
}

/**
 * Get all sites for a user's organization
 */
export async function getOrganizationSites(userId) {
  try {
    // Get user's organization ID
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return [];
    }
    
    const userData = userDoc.data();
    if (!userData.organizationId) {
      return [];
    }
    
    // Get all sites for this organization
    const sitesQuery = query(
      collection(db, 'sites'),
      where('organizationId', '==', userData.organizationId)
    );
    
    const sitesSnapshot = await getDocs(sitesQuery);
    const sites = sitesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return sites;
  } catch (error) {
    console.error('Error getting organization sites:', error);
    throw error;
  }
}

/**
 * Check if user has access to a site
 */
export async function checkUserAccess(userId, siteId) {
  try {
    // Get user's organization
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      return false;
    }
    
    const userData = userDoc.data();
    if (!userData.organizationId) {
      return false;
    }
    
    // Get site's organization
    const siteDoc = await getDoc(doc(db, 'sites', siteId));
    if (!siteDoc.exists()) {
      return false;
    }
    
    const siteData = siteDoc.data();
    
    // Check if organizations match
    return userData.organizationId === siteData.organizationId;
  } catch (error) {
    console.error('Error checking user access:', error);
    return false;
  }
}

/**
 * Get all users in an organization
 */
export async function getOrganizationUsers(organizationId) {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('organizationId', '==', organizationId)
    );
    
    const usersSnapshot = await getDocs(usersQuery);
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return users;
  } catch (error) {
    console.error('Error getting organization users:', error);
    throw error;
  }
}

/**
 * Add organization ID to user
 */
export async function addUserToOrganization(userId, organizationId, role = 'member') {
  try {
    await updateDoc(doc(db, 'users', userId), {
      organizationId,
      role,
      status: 'active',
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error adding user to organization:', error);
    throw error;
  }
}

/**
 * Create or update user profile with organization (domain-based assignment)
 */
export async function ensureUserProfile(uid, email, displayName) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    
    if (!userDoc.exists()) {
      // New user - find organization by email domain
      const domain = email.split('@')[1]?.toLowerCase();
      let organizationId = null;
      let role = 'member';
      
      // Try to find existing organization by domain
      const existingOrg = await findOrganizationByEmail(email);
      
      if (existingOrg) {
        // Domain matches existing organization
        organizationId = existingOrg.id;
        role = 'member'; // New users joining existing org are members
        console.log(`User ${email} auto-assigned to organization: ${existingOrg.name}`);
      } else {
        // No organization found for this domain - create new one
        const orgName = domain ? `${domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1)} Organization` : `${displayName}'s Organization`;
        const allowedDomains = domain ? [domain] : [];
        
        organizationId = await createOrganization(orgName, uid, allowedDomains);
        role = 'admin'; // First user with this domain is admin
        console.log(`Created new organization for domain ${domain}: ${orgName}`);
      }
      
      // Create user profile
      const userData = {
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        phone: '',
        organizationId,
        role,
        status: 'active',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp()
      };
      
      await updateDoc(doc(db, 'users', uid), userData);
      
      return { 
        created: true, 
        organizationId,
        isNewOrg: !existingOrg,
        role
      };
    } else {
      // Existing user - update last login
      await updateDoc(doc(db, 'users', uid), {
        lastLoginAt: serverTimestamp()
      });
      
      const userData = userDoc.data();
      return { 
        created: false, 
        organizationId: userData.organizationId,
        isNewOrg: false,
        role: userData.role
      };
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    throw error;
  }
}

/**
 * Migrate existing sites to have organizationId
 */
export async function migrateSitesToOrganization(userId, organizationId) {
  try {
    // Get all sites created by this user that don't have organizationId
    const sitesQuery = query(
      collection(db, 'sites'),
      where('createdBy', '==', userId)
    );
    
    const sitesSnapshot = await getDocs(sitesQuery);
    
    const updates = [];
    sitesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!data.organizationId) {
        updates.push(
          updateDoc(doc.ref, {
            organizationId,
            updatedAt: serverTimestamp()
          })
        );
      }
    });
    
    await Promise.all(updates);
    console.log(`Migrated ${updates.length} sites to organization ${organizationId}`);
    
    return updates.length;
  } catch (error) {
    console.error('Error migrating sites:', error);
    throw error;
  }
}
