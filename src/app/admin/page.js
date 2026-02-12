'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc, setDoc, orderBy, limit, Timestamp, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

// All US states for dropdown
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'District of Columbia' }
];

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [message, setMessage] = useState('');
  
  const [organization, setOrganization] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [users, setUsers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    loadAdminData();
  }, [user]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        setMessage('User profile not found');
        return;
      }
      
      const userData = userDoc.data();
      setUserProfile(userData);
      
      if (userData.role !== 'admin' && userData.role !== 'super_admin') {
        setMessage('Access denied. Admin privileges required.');
        setTimeout(() => router.push('/profile'), 2000);
        return;
      }
      
      if (!userData.organizationId) {
        setMessage('No organization found');
        return;
      }
      
      const orgDoc = await getDoc(doc(db, 'organizations', userData.organizationId));
      if (!orgDoc.exists()) {
        setMessage('Organization not found');
        return;
      }
      
      const orgData = { id: orgDoc.id, ...orgDoc.data() };
      setOrganization(orgData);
      
      await loadUsers(userData.organizationId);
      await loadInvitations(userData.organizationId);
      
    } catch (error) {
      console.error('Error loading admin data:', error);
      setMessage('Error loading admin panel');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (orgId) => {
    const usersQuery = query(collection(db, 'users'), where('organizationId', '==', orgId));
    const usersSnapshot = await getDocs(usersQuery);
    const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setUsers(usersList);
  };

  const loadInvitations = async (orgId) => {
    const invitesQuery = query(
      collection(db, 'invitations'), 
      where('organizationId', '==', orgId)
    );
    const invitesSnapshot = await getDocs(invitesQuery);
    const invitesList = invitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Sort: pending first, then by date
    invitesList.sort((a, b) => {
      const order = { pending: 0, accepted: 1, expired: 2 };
      const aOrder = order[a.status] ?? 1;
      const bOrder = order[b.status] ?? 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
    setInvitations(invitesList);
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      setMessage('User role updated');
    } catch (error) {
      console.error('Error updating role:', error);
      setMessage('Error updating user role');
    }
  };

  const handleDeactivateUser = async (userId) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await updateDoc(doc(db, 'users', userId), { status: 'inactive' });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: 'inactive' } : u));
      setMessage('User deactivated');
    } catch (error) {
      console.error('Error deactivating user:', error);
      setMessage('Error deactivating user');
    }
  };

  const handleInviteUser = async (email, role, customMessage) => {
    try {
      // Check for existing pending invite
      const existingQuery = query(
        collection(db, 'invitations'),
        where('email', '==', email),
        where('organizationId', '==', organization.id),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(existingQuery);
      if (!existing.empty) {
        setMessage('An invitation is already pending for this email. You can resend it from the list below.');
        return;
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const inviteData = {
        email,
        role,
        customMessage: customMessage || '',
        organizationId: organization.id,
        organizationName: organization.name || 'Your Organization',
        status: 'pending',
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        invitedBy: user.uid,
        invitedByEmail: user.email || '',
        resendCount: 0,
      };

      const docRef = await addDoc(collection(db, 'invitations'), inviteData);

      // Try EmailJS if configured
      const orgSettings = organization.settings || {};
      const emailjsConfigured = orgSettings.emailjsServiceId && orgSettings.emailjsTemplateId && orgSettings.emailjsPublicKey;
      let emailSent = false;

      if (emailjsConfigured) {
        try {
          // Wait for emailjs to be available (CDN might still be loading)
          let ejs = window.emailjs;
          if (!ejs) {
            // Try dynamic load as fallback
            await new Promise((resolve, reject) => {
              const script = document.createElement('script');
              script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
            ejs = window.emailjs;
          }

          if (ejs) {
            const signupUrl = `${window.location.origin}/auth/signup?token=${docRef.id}`;
            await ejs.send(orgSettings.emailjsServiceId, orgSettings.emailjsTemplateId, {
              to_email: email,
              to_name: email.split('@')[0],
              from_name: organization.name || 'Pronoia Solutions',
              role: role,
              organization_name: organization.name || 'Your Organization',
              custom_message: customMessage || 'You have been invited to join our reserve study management platform.',
              signup_url: signupUrl,
              expires_date: expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            }, orgSettings.emailjsPublicKey);
            emailSent = true;
          }
        } catch (emailErr) {
          console.error('EmailJS error:', emailErr);
          setMessage(`Invitation created but email failed: ${emailErr?.text || emailErr?.message || 'Unknown error'}. You can still copy the invite link.`);
        }
      }

      await loadInvitations(organization.id);
      setMessage(emailSent
        ? `Invitation emailed to ${email}`
        : `Invitation created for ${email}. Copy the invite link to share it.`
      );
    } catch (error) {
      console.error('Error sending invitation:', error);
      setMessage('Error sending invitation');
    }
  };

  const handleResendInvite = async (inviteId, email) => {
    try {
      const newExpires = new Date();
      newExpires.setDate(newExpires.getDate() + 7);

      await updateDoc(doc(db, 'invitations', inviteId), {
        status: 'pending',
        expiresAt: Timestamp.fromDate(newExpires),
        resentAt: serverTimestamp(),
        resendCount: (await getDoc(doc(db, 'invitations', inviteId))).data()?.resendCount + 1 || 1,
      });

      // Try EmailJS resend
      const orgSettings = organization.settings || {};
      const emailjsConfigured = orgSettings.emailjsServiceId && orgSettings.emailjsTemplateId && orgSettings.emailjsPublicKey;
      let emailSent = false;

      if (emailjsConfigured) {
        try {
          const ejs = window.emailjs;
          if (ejs) {
            const signupUrl = `${window.location.origin}/auth/signup?token=${inviteId}`;
            await ejs.send(orgSettings.emailjsServiceId, orgSettings.emailjsTemplateId, {
              to_email: email,
              to_name: email.split('@')[0],
              from_name: organization.name || 'Pronoia Solutions',
              role: 'specialist',
              organization_name: organization.name || 'Your Organization',
              custom_message: 'This is a reminder about your pending invitation.',
              signup_url: signupUrl,
              expires_date: newExpires.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
            }, orgSettings.emailjsPublicKey);
            emailSent = true;
          }
        } catch (e) { console.error('EmailJS resend error:', e); }
      }

      await loadInvitations(organization.id);
      setMessage(emailSent ? `Invitation re-sent to ${email}` : `Invitation renewed for ${email}. Copy the link to share.`);
    } catch (error) {
      console.error('Error resending invitation:', error);
      setMessage('Error resending invitation');
    }
  };

  const handleCancelInvitation = async (inviteId) => {
    try {
      await deleteDoc(doc(db, 'invitations', inviteId));
      setInvitations(prev => prev.filter(i => i.id !== inviteId));
      setMessage('Invitation cancelled');
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      setMessage('Error cancelling invitation');
    }
  };

  const handleUpdateOrganization = async (updates) => {
    try {
      await updateDoc(doc(db, 'organizations', organization.id), {
        ...updates,
        updatedAt: new Date()
      });
      // Re-fetch organization to get properly nested data from Firestore
      const orgDoc = await getDoc(doc(db, 'organizations', organization.id));
      if (orgDoc.exists()) {
        setOrganization({ id: orgDoc.id, ...orgDoc.data() });
      }
      setMessage('Organization settings saved');
    } catch (error) {
      console.error('Error updating organization:', error);
      setMessage('Error saving settings');
    }
  };

  const handleSaveStateCompliance = async (stateCompliance) => {
    try {
      await updateDoc(doc(db, 'organizations', organization.id), {
        'settings.stateCompliance': stateCompliance,
        updatedAt: new Date()
      });
      setOrganization(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          stateCompliance
        }
      }));
      setMessage('State compliance settings saved');
    } catch (error) {
      console.error('Error saving state compliance:', error);
      setMessage('Error saving state compliance settings');
    }
  };

  const loadAuditTrail = async () => {
    if (auditTrail.length > 0) return; // Already loaded
    setAuditLoading(true);
    try {
      const thirtyDaysAgo = Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
      const auditQuery = query(
        collection(db, 'deletionAudit'),
        orderBy('deletedAt', 'desc'),
        limit(100)
      );
      const snapshot = await getDocs(auditQuery);
      setAuditTrail(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error loading audit trail:', error);
    } finally {
      setAuditLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600 mt-2">Admin privileges required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-6">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Administration</h1>
          <p className="text-gray-600 mt-2">{organization?.name}</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes('Error') || message.includes('denied')
              ? 'bg-red-50 border border-red-200 text-red-800' 
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {message}
            <button 
              onClick={() => setMessage('')}
              className="float-right text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'users'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                👥 Users ({users.length})
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'invitations'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                ✉️ Invitations ({invitations.length})
              </button>
              <button
                onClick={() => setActiveTab('compliance')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'compliance'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                🏛️ State Compliance
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'settings'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                🎨 Branding & Settings
              </button>
              <button
                onClick={() => { setActiveTab('audit'); loadAuditTrail(); }}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'audit'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                🗂️ Audit Trail
              </button>
            </nav>
          </div>

          <div className="p-6">
            
            {activeTab === 'users' && (
              <UsersTab 
                users={users} 
                currentUserId={user.uid}
                onUpdateRole={handleUpdateUserRole}
                onDeactivate={handleDeactivateUser}
              />
            )}

            {activeTab === 'invitations' && (
              <InvitationsTab
                invitations={invitations}
                onInvite={handleInviteUser}
                onCancel={handleCancelInvitation}
                onResend={handleResendInvite}
                organization={organization}
              />
            )}

            {activeTab === 'compliance' && (
              <StateComplianceTab
                stateCompliance={organization?.settings?.stateCompliance || []}
                onSave={handleSaveStateCompliance}
              />
            )}

            {activeTab === 'settings' && (
              <OrganizationSettingsTab
                organization={organization}
                onSave={handleUpdateOrganization}
                setMessage={setMessage}
              />
            )}

            {activeTab === 'audit' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Deletion Audit Trail</h2>
                    <p className="text-sm text-gray-500 mt-1">Record of deleted projects and their associated data</p>
                  </div>
                  <button
                    onClick={() => { setAuditTrail([]); loadAuditTrail(); }}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    ↻ Refresh
                  </button>
                </div>

                {auditLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-500">Loading audit trail...</p>
                  </div>
                ) : auditTrail.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <div className="text-3xl mb-2">🗂️</div>
                    <p className="text-sm text-gray-500">No deletions recorded yet</p>
                    <p className="text-xs text-gray-400 mt-1">Deleted projects will appear here for auditing</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Date</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Project</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Project #</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-700 uppercase">Components</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Deleted By</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {auditTrail.map(entry => {
                          const deletedDate = entry.deletedAt?.seconds
                            ? new Date(entry.deletedAt.seconds * 1000)
                            : null;
                          const daysSince = deletedDate
                            ? Math.floor((Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24))
                            : null;
                          const isRecent = daysSince !== null && daysSince <= 7;

                          return (
                            <tr key={entry.id} className={`hover:bg-gray-50 ${isRecent ? 'bg-red-50/30' : ''}`}>
                              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                                <div>{deletedDate ? deletedDate.toLocaleDateString() : '—'}</div>
                                <div className="text-[10px] text-gray-400">
                                  {deletedDate ? deletedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                  {daysSince !== null && (
                                    <span className={`ml-1 ${isRecent ? 'text-red-500 font-medium' : ''}`}>
                                      ({daysSince === 0 ? 'today' : daysSince === 1 ? 'yesterday' : `${daysSince}d ago`})
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-gray-900">{entry.siteName || 'Unknown'}</div>
                                {entry.siteData?.numberOfUnits > 0 && (
                                  <div className="text-[10px] text-gray-400">{entry.siteData.numberOfUnits} units</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 font-mono">{entry.projectNumber || '—'}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  {entry.componentCount || 0}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  entry.siteData?.status === 'calculated' ? 'bg-blue-100 text-blue-700' :
                                  entry.siteData?.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  entry.siteData?.status === 'sent' ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {entry.siteData?.status || 'draft'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">{entry.deletedByEmail || '—'}</td>
                              <td className="px-4 py-3 text-sm text-gray-500">{entry.siteData?.location || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-4 text-xs text-gray-400 text-center">
                      Showing last {auditTrail.length} deletion{auditTrail.length !== 1 ? 's' : ''} • Records are retained for auditing purposes
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

// ==================== USERS TAB ====================
function UsersTab({ users, currentUserId, onUpdateRole, onDeactivate }) {

  const formatLastLogin = (ts) => {
    if (!ts) return null;
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / (1000 * 60));
    const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMin < 5) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  const getActivityBadge = (user) => {
    if (!user.lastLoginAt) return { label: 'Never signed in', color: 'bg-gray-100 text-gray-600' };
    const d = user.lastLoginAt.seconds ? new Date(user.lastLoginAt.seconds * 1000) : new Date(user.lastLoginAt);
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) return { label: 'Inactive 30+ days', color: 'bg-red-100 text-red-600' };
    if (diffDays > 7) return { label: `${diffDays}d inactive`, color: 'bg-amber-100 text-amber-700' };
    return { label: 'Active', color: 'bg-green-100 text-green-700' };
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
          <p className="text-xs text-gray-500 mt-0.5">{users.length} user{users.length !== 1 ? 's' : ''} in your organization</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase">User</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase">Activity</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase">Last Login</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              <th className="px-5 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {users.map(u => {
              const activity = getActivityBadge(u);
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#dbebff' }}>
                        <span className="text-xs font-bold" style={{ color: '#1d398f' }}>{(u.displayName || u.email || '?')[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{u.displayName || 'No name'}</p>
                        <p className="text-[11px] text-gray-400">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role || 'specialist'}
                      onChange={(e) => onUpdateRole(u.id, e.target.value)}
                      disabled={u.id === currentUserId}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="specialist">Specialist</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${activity.color}`}>
                      {activity.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {formatLastLogin(u.lastLoginAt) || '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      u.status === 'active' || !u.status
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {u.status || 'active'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {u.id !== currentUserId && (u.status === 'active' || !u.status) && (
                      <button
                        onClick={() => onDeactivate(u.id)}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-red-50 text-red-500 hover:bg-red-100 font-medium transition-colors"
                      >
                        Deactivate
                      </button>
                    )}
                    {u.id === currentUserId && (
                      <span className="text-[10px] text-gray-400 italic">You</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ==================== INVITATIONS TAB ====================
function InvitationsTab({ invitations, onInvite, onCancel, onResend, organization }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('specialist');
  const [customMessage, setCustomMessage] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    onInvite(email.trim(), role, customMessage.trim());
    setEmail('');
    setRole('specialist');
    setCustomMessage('');
    setShowMessage(false);
  };

  const copyInviteLink = (inviteId) => {
    const url = `${window.location.origin}/auth/signup?token=${inviteId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(inviteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getInviteStatus = (invite) => {
    if (invite.status === 'accepted') return { label: 'Accepted', color: 'bg-green-100 text-green-700', icon: '✅' };
    if (invite.status === 'expired') return { label: 'Expired', color: 'bg-red-100 text-red-700', icon: '🔴' };

    // Check if pending but expired by date
    const expiresAt = invite.expiresAt?.seconds
      ? new Date(invite.expiresAt.seconds * 1000)
      : invite.expiresAt ? new Date(invite.expiresAt) : null;

    if (expiresAt && expiresAt < new Date()) return { label: 'Expired', color: 'bg-red-100 text-red-700', icon: '🔴' };
    return { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: '🟡' };
  };

  const formatRelativeDate = (ts) => {
    if (!ts) return 'N/A';
    const d = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    return `${diff} days ago`;
  };

  const getExpiresIn = (invite) => {
    const expiresAt = invite.expiresAt?.seconds
      ? new Date(invite.expiresAt.seconds * 1000)
      : invite.expiresAt ? new Date(invite.expiresAt) : null;
    if (!expiresAt) return '';
    const diff = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return 'Expired';
    if (diff === 1) return '1 day left';
    return `${diff} days left`;
  };

  const emailjsConfigured = organization?.settings?.emailjsServiceId && organization?.settings?.emailjsTemplateId && organization?.settings?.emailjsPublicKey;

  // Separate invites by status
  const pendingInvites = invitations.filter(i => getInviteStatus(i).label === 'Pending');
  const acceptedInvites = invitations.filter(i => getInviteStatus(i).label === 'Accepted');
  const expiredInvites = invitations.filter(i => getInviteStatus(i).label === 'Expired');

  return (
    <div>
      {/* Send invite form */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-1">Invite a New User</h2>
        <p className="text-xs text-gray-500 mb-4">
          {emailjsConfigured
            ? 'An email will be sent with a signup link that expires in 7 days.'
            : 'A signup link will be generated. Copy it and send it to the user manually.'}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="specialist">Specialist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-5 py-2 text-white rounded-lg font-medium text-sm transition-colors"
              style={{ backgroundColor: '#1d398f' }}
            >
              {emailjsConfigured ? 'Send Invite' : 'Create Invite'}
            </button>
          </div>

          {/* Custom message toggle */}
          <div className="mt-3">
            {!showMessage ? (
              <button
                type="button"
                onClick={() => setShowMessage(true)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add a personal message
              </button>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Personal Message (optional)</label>
                <textarea
                  value={customMessage}
                  onChange={e => setCustomMessage(e.target.value)}
                  placeholder="Welcome to the team! We're excited to have you..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  maxLength={500}
                />
                <div className="flex justify-between mt-1">
                  <button type="button" onClick={() => { setShowMessage(false); setCustomMessage(''); }} className="text-xs text-gray-400 hover:text-gray-600">Remove message</button>
                  <span className="text-xs text-gray-400">{customMessage.length}/500</span>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* EmailJS setup hint */}
      {!emailjsConfigured && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <span className="text-lg">💡</span>
            <div>
              <p className="text-xs font-medium text-blue-900">Want to send emails automatically?</p>
              <p className="text-xs text-blue-700 mt-0.5">
                Go to <strong>Branding & Settings</strong> tab to configure EmailJS (free, 200 emails/month). 
                Until then, copy the invite link and email it yourself.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Invitation list */}
      {invitations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <div className="text-3xl mb-2">✉️</div>
          <p className="text-sm text-gray-500">No invitations yet</p>
          <p className="text-xs text-gray-400 mt-1">Use the form above to invite team members</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          {pendingInvites.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Pending ({pendingInvites.length})
              </h3>
              <div className="space-y-2">
                {pendingInvites.map(invite => {
                  const expiresIn = getExpiresIn(invite);
                  return (
                    <div key={invite.id} className="bg-white border border-amber-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-amber-100">
                            <span className="text-amber-700 text-xs font-bold">{(invite.email || '?')[0].toUpperCase()}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{invite.email}</p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500">
                              <span className="capitalize">{invite.role || 'specialist'}</span>
                              <span>•</span>
                              <span>Sent {formatRelativeDate(invite.resentAt || invite.createdAt)}</span>
                              {invite.resendCount > 0 && (
                                <span className="text-blue-500 font-medium">• Resent ×{invite.resendCount}</span>
                              )}
                              <span>•</span>
                              <span className={expiresIn === 'Expired' ? 'text-red-500 font-medium' : expiresIn.includes('1 day') ? 'text-amber-600 font-medium' : ''}>
                                {expiresIn}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                          <button
                            onClick={() => copyInviteLink(invite.id)}
                            className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors ${
                              copiedId === invite.id
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {copiedId === invite.id ? '✓ Copied!' : 'Copy Link'}
                          </button>
                          <button
                            onClick={() => onResend(invite.id, invite.email)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => onCancel(invite.id)}
                            className="text-[11px] px-2.5 py-1 rounded-md font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      {invite.customMessage && (
                        <div className="mt-2 pl-12 text-xs text-gray-400 italic truncate">&quot;{invite.customMessage}&quot;</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Accepted */}
          {acceptedInvites.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Accepted ({acceptedInvites.length})
              </h3>
              <div className="space-y-2">
                {acceptedInvites.map(invite => (
                  <div key={invite.id} className="bg-green-50/50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-green-100">
                          <span className="text-green-700 text-xs font-bold">✓</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{invite.email}</p>
                          <div className="text-[11px] text-gray-500">
                            <span className="capitalize">{invite.role || 'specialist'}</span>
                            <span> • Accepted {formatRelativeDate(invite.acceptedAt || invite.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Joined</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expired */}
          {expiredInvites.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                Expired ({expiredInvites.length})
              </h3>
              <div className="space-y-2">
                {expiredInvites.map(invite => (
                  <div key={invite.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-75">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-200">
                          <span className="text-gray-500 text-xs font-bold">✕</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-600">{invite.email}</p>
                          <div className="text-[11px] text-gray-400">
                            <span className="capitalize">{invite.role || 'specialist'}</span>
                            <span> • Sent {formatRelativeDate(invite.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onResend(invite.id, invite.email)}
                          className="text-[11px] px-2.5 py-1 rounded-md font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          Re-invite
                        </button>
                        <button
                          onClick={() => onCancel(invite.id)}
                          className="text-[11px] px-2.5 py-1 rounded-md font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== STATE COMPLIANCE TAB ====================
function StateComplianceTab({ stateCompliance, onSave }) {
  const [states, setStates] = useState(stateCompliance || []);
  const [selectedState, setSelectedState] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter out states that are already added
  const availableStates = US_STATES.filter(
    s => !states.find(existing => existing.code === s.code)
  );

  const handleAddState = () => {
    if (!selectedState) return;
    
    const stateInfo = US_STATES.find(s => s.code === selectedState);
    if (!stateInfo) return;
    
    // Default: NJ requires PM, others don't
    const pmRequired = selectedState === 'NJ';
    
    setStates(prev => [...prev, {
      code: stateInfo.code,
      name: stateInfo.name,
      pmRequired,
      notes: ''
    }].sort((a, b) => a.name.localeCompare(b.name)));
    
    setSelectedState('');
  };

  const handleTogglePM = (code) => {
    setStates(prev => prev.map(s => 
      s.code === code ? { ...s, pmRequired: !s.pmRequired } : s
    ));
  };

  const handleUpdateNotes = (code, notes) => {
    setStates(prev => prev.map(s => 
      s.code === code ? { ...s, notes } : s
    ));
  };

  const handleRemoveState = (code) => {
    if (!confirm('Remove this state from your compliance configuration?')) return;
    setStates(prev => prev.filter(s => s.code !== code));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(states);
    setSaving(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">State Compliance Configuration</h2>
        <p className="text-gray-600">
          Configure which states your organization operates in and their compliance requirements. 
          When PM (Property Maintenance) Fund is required, reserve study reports will automatically 
          include PM fund calculations and sections.
        </p>
      </div>

      {/* Add State */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-blue-800 mb-3">Add a State</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a state...</option>
              {availableStates.map(s => (
                <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAddState}
            disabled={!selectedState}
            className={`px-6 py-2 rounded-lg font-medium ${
              selectedState
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            + Add State
          </button>
        </div>
      </div>

      {/* State List */}
      {states.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-4xl mb-3">🏛️</div>
          <p className="text-gray-600 font-medium">No states configured yet</p>
          <p className="text-gray-500 text-sm mt-1">Add the states your organization operates in to configure compliance requirements.</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {states.map(state => (
            <div key={state.code} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* State Name & Code */}
                  <div className="min-w-[180px]">
                    <span className="font-bold text-gray-900">{state.name}</span>
                    <span className="ml-2 text-sm text-gray-500">({state.code})</span>
                  </div>
                  
                  {/* PM Required Toggle */}
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={state.pmRequired}
                        onChange={() => handleTogglePM(state.code)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                    <span className={`text-sm font-medium ${state.pmRequired ? 'text-blue-700' : 'text-gray-500'}`}>
                      PM Fund {state.pmRequired ? 'Required' : 'Not Required'}
                    </span>
                  </div>
                  
                  {/* Status Badge */}
                  {state.pmRequired && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                      Reports include PM sections
                    </span>
                  )}
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveState(state.code)}
                  className="text-gray-400 hover:text-red-600 transition-colors ml-4"
                  title="Remove state"
                >
                  🗑️
                </button>
              </div>
              
              {/* Notes Field */}
              <div className="mt-3">
                <input
                  type="text"
                  value={state.notes || ''}
                  onChange={(e) => handleUpdateNotes(state.code, e.target.value)}
                  placeholder="Optional notes (e.g., NJ S2760 compliance, specific regulations...)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <h4 className="text-sm font-semibold text-amber-800 mb-1">💡 How this works</h4>
        <p className="text-sm text-amber-700">
          When a site&apos;s state has PM Fund marked as &quot;Required,&quot; the reserve study report will automatically 
          include Property Maintenance fund calculations, the PM fund expenditure schedule, and PM-specific 
          sections. States without PM requirements will generate reports with reserve fund sections only.
        </p>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-8 py-3 rounded-lg font-medium text-white ${
            saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Compliance Settings'}
        </button>
      </div>
    </div>
  );
}

// ==================== ORGANIZATION SETTINGS TAB ====================
function OrganizationSettingsTab({ organization, onSave, setMessage }) {
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    address: organization?.settings?.address || '',
    city: organization?.settings?.city || '',
    state: organization?.settings?.state || '',
    zip: organization?.settings?.zip || '',
    phone: organization?.settings?.phone || '',
    email: organization?.settings?.email || '',
    website: organization?.settings?.website || '',
    preparedBy: organization?.settings?.preparedBy || '',
    licenseNumber: organization?.settings?.licenseNumber || '',
    emailjsServiceId: organization?.settings?.emailjsServiceId || '',
    emailjsTemplateId: organization?.settings?.emailjsTemplateId || '',
    emailjsPublicKey: organization?.settings?.emailjsPublicKey || '',
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file');
      return;
    }
    
    try {
      setLogoUploading(true);
      const logoRef = ref(storage, `organizations/${organization.id}/logo`);
      await uploadBytes(logoRef, file);
      const logoUrl = await getDownloadURL(logoRef);
      
      await onSave({ 'settings.logoUrl': logoUrl });
      setMessage('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage('Error uploading logo. Make sure Firebase Storage is enabled.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    await onSave({
      name: formData.name,
      'settings.address': formData.address,
      'settings.city': formData.city,
      'settings.state': formData.state,
      'settings.zip': formData.zip,
      'settings.phone': formData.phone,
      'settings.email': formData.email,
      'settings.website': formData.website,
      'settings.preparedBy': formData.preparedBy,
      'settings.licenseNumber': formData.licenseNumber,
      'settings.emailjsServiceId': formData.emailjsServiceId.trim(),
      'settings.emailjsTemplateId': formData.emailjsTemplateId.trim(),
      'settings.emailjsPublicKey': formData.emailjsPublicKey.trim(),
    });
    setSaving(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Branding & Settings</h2>
      <p className="text-gray-600 mb-6">Configure your organization&apos;s branding and report settings.</p>
      
      {/* Logo Section */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Organization Logo</h3>
        <div className="flex items-center gap-6">
          {organization?.settings?.logoUrl ? (
            <img 
              src={organization.settings.logoUrl} 
              alt="Organization Logo" 
              className="h-16 w-auto object-contain bg-white border rounded p-2"
            />
          ) : (
            <div className="h-16 w-32 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-sm">
              No logo
            </div>
          )}
          <div>
            <label className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
              {logoUploading ? 'Uploading...' : 'Upload Logo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                disabled={logoUploading}
              />
            </label>
            <p className="text-xs text-gray-500 mt-2">PNG, JPG, or SVG. Recommended: 300x100px</p>
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => handleChange('state', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
            <input
              type="text"
              value={formData.zip}
              onChange={(e) => handleChange('zip', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
          <input
            type="text"
            value={formData.website}
            onChange={(e) => handleChange('website', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Report Settings */}
      <div className="border-t border-gray-200 pt-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Report Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prepared By</label>
            <input
              type="text"
              value={formData.preparedBy}
              onChange={(e) => handleChange('preparedBy', e.target.value)}
              placeholder="Name for report cover page"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">License Number</label>
            <input
              type="text"
              value={formData.licenseNumber}
              onChange={(e) => handleChange('licenseNumber', e.target.value)}
              placeholder="Professional license #"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      {/* EmailJS Configuration */}
      <div className="border-t border-gray-200 pt-6 mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Email Integration (EmailJS)</h3>
        <p className="text-xs text-gray-500 mb-4">
          Configure EmailJS to automatically send invitation emails. Free tier: 200 emails/month.
          {' '}<a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Set up at emailjs.com</a>
        </p>

        {formData.emailjsServiceId && formData.emailjsTemplateId && formData.emailjsPublicKey ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <span className="text-green-600">✓</span>
            <span className="text-xs text-green-800 font-medium">EmailJS is configured — invitation emails will be sent automatically</span>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
            <span className="text-amber-600">⚠</span>
            <span className="text-xs text-amber-800 font-medium">EmailJS not configured — you&apos;ll need to copy invite links manually</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service ID</label>
            <input
              type="text"
              value={formData.emailjsServiceId}
              onChange={(e) => handleChange('emailjsServiceId', e.target.value)}
              placeholder="service_xxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template ID</label>
            <input
              type="text"
              value={formData.emailjsTemplateId}
              onChange={(e) => handleChange('emailjsTemplateId', e.target.value)}
              placeholder="template_xxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Public Key</label>
            <input
              type="text"
              value={formData.emailjsPublicKey}
              onChange={(e) => handleChange('emailjsPublicKey', e.target.value)}
              placeholder="xxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
        </div>
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] font-medium text-gray-700 mb-1.5">Quick Setup Guide:</p>
          <ol className="text-[11px] text-gray-500 space-y-1 list-decimal list-inside">
            <li>Create a free account at <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">emailjs.com</a></li>
            <li>Add an email service (Gmail, Outlook, etc.) — copy the <strong>Service ID</strong></li>
            <li>Create an email template using these variables: <code className="bg-gray-200 px-1 rounded text-[10px]">{'{{to_email}} {{to_name}} {{from_name}} {{role}} {{organization_name}} {{custom_message}} {{signup_url}} {{expires_date}}'}</code></li>
            <li>Copy the <strong>Template ID</strong> and your <strong>Public Key</strong> (from Account → API Keys)</li>
          </ol>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className={`px-8 py-3 rounded-lg font-medium text-white ${
            saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
