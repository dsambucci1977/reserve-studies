// src/lib/db.js
// Database Operations - FIXED saveProjections

import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';

// ============================================
// SITE MANAGEMENT
// ============================================

/**
 * Create a new reserve study site
 */
export async function createSite(siteData, userId) {
  const sitesRef = collection(db, 'sites');
  
  const newSite = {
    ...siteData,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'draft'
  };
  
  const docRef = await addDoc(sitesRef, newSite);
  return docRef.id;
}

/**
 * Get all sites for a user
 */
export async function getSites(userId) {
  const sitesRef = collection(db, 'sites');
  const q = query(
    sitesRef, 
    where('createdBy', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Get a single site by ID
 */
export async function getSite(siteId) {
  const siteRef = doc(db, 'sites', siteId);
  const snapshot = await getDoc(siteRef);
  
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
}

/**
 * Update a site
 */
export async function updateSite(siteId, siteData) {
  const siteRef = doc(db, 'sites', siteId);
  
  await updateDoc(siteRef, {
    ...siteData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a site
 */
export async function deleteSite(siteId) {
  const siteRef = doc(db, 'sites', siteId);
  await deleteDoc(siteRef);
}

// ============================================
// COMPONENT MANAGEMENT
// ============================================

/**
 * Create a new component for a site
 */
export async function createComponent(siteId, componentData) {
  const componentsRef = collection(db, 'sites', siteId, 'components');
  
  const newComponent = {
    ...componentData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(componentsRef, newComponent);
  return docRef.id;
}

/**
 * Get all components for a site
 */
export async function getComponents(siteId) {
  const componentsRef = collection(db, 'sites', siteId, 'components');
  const q = query(componentsRef, orderBy('category'), orderBy('description'));
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * Get a single component by ID
 */
export async function getComponent(siteId, componentId) {
  const componentRef = doc(db, 'sites', siteId, 'components', componentId);
  const snapshot = await getDoc(componentRef);
  
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
}

/**
 * Update a component
 */
export async function updateComponent(siteId, componentId, componentData) {
  const componentRef = doc(db, 'sites', siteId, 'components', componentId);
  
  await updateDoc(componentRef, {
    ...componentData,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a component
 */
export async function deleteComponent(siteId, componentId) {
  const componentRef = doc(db, 'sites', siteId, 'components', componentId);
  await deleteDoc(componentRef);
}

// ============================================
// PROJECTIONS MANAGEMENT (for Week 5) - FIXED
// ============================================

/**
 * Save calculation results/projections for a site
 * FIXED: Uses setDoc instead of updateDoc to create if doesn't exist
 */
export async function saveProjections(siteId, projectionsData) {
  const projectionsRef = doc(db, 'sites', siteId, 'projections', 'latest');
  
  const data = {
    ...projectionsData,
    calculatedAt: serverTimestamp(),
  };
  
  // Use setDoc with merge:true to create or update
  await setDoc(projectionsRef, data, { merge: true });
}

/**
 * Get saved projections for a site
 */
export async function getProjections(siteId) {
  const projectionsRef = doc(db, 'sites', siteId, 'projections', 'latest');
  const snapshot = await getDoc(projectionsRef);
  
  if (snapshot.exists()) {
    return snapshot.data();
  }
  return null;
}