'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { copyMasterNotesToOrganization, getMasterTemplateNoteCount, importNotesToMasterTemplate, parseExcelToNotes } from '@/lib/notesHelpers';

const SUPER_ADMINS = [
  'donato@pronoia.com',
  'donato@pronoia.solutions'
];

export default function SuperAdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('organizations');
  const [message, setMessage] = useState('');
  
  const [organizations, setOrganizations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [masterNoteCount, setMasterNoteCount] = useState(0);
  const [copyingNotes, setCopyingNotes] = useState(null); // Track which org is copying
  
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    totalUsers: 0,
    activeOrganizations: 0
  });

  useEffect(() => {
    if (!user) {
      router.push('/auth/signin');
      return;
    }
    
    if (!SUPER_ADMINS.includes(user.email)) {
      router.push('/');
      return;
    }
    
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadOrganizations(),
        loadAllUsers(),
        loadMasterNoteCount()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading super admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizations = async () => {
    const orgsSnapshot = await getDocs(collection(db, 'organizations'));
    const orgsList = orgsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setOrganizations(orgsList);
    
    const activeOrgs = orgsList.filter(org => org.status === 'active').length;
    setStats(prev => ({ ...prev, totalOrganizations: orgsList.length, activeOrganizations: activeOrgs }));
  };

  const loadAllUsers = async () => {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setAllUsers(usersList);
    setStats(prev => ({ ...prev, totalUsers: usersList.length }));
  };

  const loadMasterNoteCount = async () => {
    const count = await getMasterTemplateNoteCount();
    setMasterNoteCount(count);
  };

  const handleCreateOrganization = async (name, contactEmail) => {
    try {
      // Create organization
      const orgDoc = await addDoc(collection(db, 'organizations'), {
        name,
        contactEmail,
        status: 'active',
        createdAt: new Date(),
        createdBy: user.uid,
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
      });

      setMessage(`Organization "${name}" created successfully!`);
      
      // Auto-copy master notes if they exist
      if (masterNoteCount > 0) {
        setMessage(`Organization "${name}" created! Copying ${masterNoteCount} notes...`);
        const result = await copyMasterNotesToOrganization(orgDoc.id);
        if (result.success) {
          setMessage(`Organization "${name}" created with ${result.copied} notes!`);
        }
      }
      
      await loadOrganizations();
    } catch (error) {
      console.error('Error creating organization:', error);
      setMessage('Error creating organization');
    }
  };

  const handleCopyNotesToOrganization = async (orgId, orgName) => {
    if (masterNoteCount === 0) {
      setMessage('No master notes template found. Import CN_DB.xlsx first.');
      return;
    }

    if (!confirm(`Copy ${masterNoteCount} notes to "${orgName}"? This will overwrite existing notes if any.`)) {
      return;
    }

    try {
      setCopyingNotes(orgId);
      setMessage(`Copying ${masterNoteCount} notes to "${orgName}"...`);
      
      const result = await copyMasterNotesToOrganization(orgId);
      
      if (result.success) {
        setMessage(`✅ Successfully copied ${result.copied} notes to "${orgName}"!`);
      } else {
        setMessage(`Error: ${result.message || 'Failed to copy notes'}`);
      }
    } catch (error) {
      console.error('Error copying notes:', error);
      setMessage(`Error copying notes: ${error.message}`);
    } finally {
      setCopyingNotes(null);
    }
  };

  const handleDeleteOrganization = async (orgId, orgName) => {
    if (!confirm(`Delete organization "${orgName}"? This cannot be undone.`)) return;
    
    try {
      await deleteDoc(doc(db, 'organizations', orgId));
      setMessage(`Organization "${orgName}" deleted`);
      await loadOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
      setMessage('Error deleting organization');
    }
  };

  const handleChangeUserOrganization = async (userId, newOrgId) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        organizationId: newOrgId,
        updatedAt: new Date()
      });
      setMessage('User organization updated');
      await loadAllUsers();
    } catch (error) {
      console.error('Error updating user organization:', error);
      setMessage('Error updating user organization');
    }
  };

  const handleChangeUserRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date()
      });
      setMessage('User role updated');
      await loadAllUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      setMessage('Error updating user role');
    }
  };

  const handleInviteUser = async (email, organizationId, role) => {
    try {
      await addDoc(collection(db, 'invitations'), {
        email,
        organizationId,
        role,
        invitedBy: user.uid,
        invitedAt: new Date(),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      });
      setMessage(`Invitation sent to ${email}`);
    } catch (error) {
      console.error('Error inviting user:', error);
      setMessage('Error sending invitation');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!SUPER_ADMINS.includes(user?.email)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600 mt-2">Super Admin privileges required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="w-full px-6">
        
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">⚡</span>
            <h1 className="text-3xl font-bold text-gray-900">Super Admin Panel</h1>
          </div>
          <p className="text-gray-600">Pronoia Solutions - Master Control</p>
          <div className="mt-2 inline-block px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            SUPER ADMIN ACCESS
          </div>
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

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-gray-600 text-sm mb-1">Total Organizations</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalOrganizations}</div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-gray-600 text-sm mb-1">Total Users</div>
            <div className="text-3xl font-bold text-gray-900">{stats.totalUsers}</div>
          </div>
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-gray-600 text-sm mb-1">Active Organizations</div>
            <div className="text-3xl font-bold text-gray-900">{stats.activeOrganizations}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('organizations')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'organizations'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                🏢 Organizations ({organizations.length})
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'users'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                👥 All Users ({allUsers.length})
              </button>
              <button
                onClick={() => setActiveTab('invite')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'invite'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                ✉️ Invite User
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'notes'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                📝 Notes ({masterNoteCount})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'organizations' && (
              <OrganizationsTab
                organizations={organizations}
                masterNoteCount={masterNoteCount}
                copyingNotes={copyingNotes}
                onCreateOrganization={handleCreateOrganization}
                onDeleteOrganization={handleDeleteOrganization}
                onCopyNotes={handleCopyNotesToOrganization}
              />
            )}

            {activeTab === 'users' && (
              <AllUsersTab
                users={allUsers}
                organizations={organizations}
                onChangeOrganization={handleChangeUserOrganization}
                onChangeRole={handleChangeUserRole}
              />
            )}

            {activeTab === 'invite' && (
              <InviteUserTab
                organizations={organizations}
                onInvite={handleInviteUser}
              />
            )}

            {activeTab === 'notes' && (
              <NotesTab
                masterNoteCount={masterNoteCount}
                onImportComplete={loadMasterNoteCount}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

function OrganizationsTab({ organizations, masterNoteCount, copyingNotes, onCreateOrganization, onDeleteOrganization, onCopyNotes }) {
  const [showForm, setShowForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgEmail, setNewOrgEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreateOrganization(newOrgName, newOrgEmail);
    setNewOrgName('');
    setNewOrgEmail('');
    setShowForm(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Organizations</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
        >
          + Create Organization
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
              <input
                type="text"
                required
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                placeholder="e.g., Beahm Management"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Email</label>
              <input
                type="email"
                required
                value={newOrgEmail}
                onChange={(e) => setNewOrgEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                placeholder="admin@example.com"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {masterNoteCount > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Click "Copy Notes" to add {masterNoteCount} component descriptions to existing organizations.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {organizations.map(org => (
          <div key={org.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <div className="font-bold text-gray-900">{org.name}</div>
              <div className="text-sm text-gray-600">{org.contactEmail}</div>
            </div>
            <div className="flex gap-2">
              {masterNoteCount > 0 && (
                <button
                  onClick={() => onCopyNotes(org.id, org.name)}
                  disabled={copyingNotes === org.id}
                  className="px-4 py-2 text-purple-600 hover:text-purple-800 font-medium disabled:opacity-50"
                >
                  {copyingNotes === org.id ? '⏳ Copying...' : '📝 Copy Notes'}
                </button>
              )}
              <button
                onClick={() => onDeleteOrganization(org.id, org.name)}
                className="px-4 py-2 text-red-600 hover:text-red-800 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AllUsersTab({ users, organizations, onChangeOrganization, onChangeRole }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">All Users</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Organization</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => {
              const org = organizations.find(o => o.id === user.organizationId);
              return (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{user.displayName || 'Unknown'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.organizationId || ''}
                      onChange={(e) => onChangeOrganization(user.id, e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    >
                      <option value="">No Organization</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <select
                      value={user.role || 'specialist'}
                      onChange={(e) => onChangeRole(user.id, e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-900 bg-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="specialist">Specialist</option>
                    </select>
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

function InviteUserTab({ organizations, onInvite }) {
  const [email, setEmail] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [role, setRole] = useState('specialist');

  const handleSubmit = (e) => {
    e.preventDefault();
    onInvite(email, organizationId, role);
    setEmail('');
    setOrganizationId('');
    setRole('specialist');
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Invite User to Organization</h2>
      
      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Organization</label>
            <select
              required
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
            >
              <option value="">Select Organization</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
            >
              <option value="specialist">Specialist</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          Send Invitation
        </button>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-2">ℹ️ Role Permissions</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Admin:</strong> Can invite users, manage organization settings, and work on sites</li>
          <li>• <strong>Specialist:</strong> Can create and manage sites, but cannot manage users</li>
        </ul>
      </div>
    </div>
  );
}

function NotesTab({ masterNoteCount, onImportComplete }) {
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

      const notesData = await parseExcelToNotes(file);
      setProgress(`Found ${notesData.length} notes. Importing...`);

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
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Master Notes Template</h2>
      <p className="text-gray-600 mb-6">
        Import CN_DB.xlsx once. All new organizations will automatically receive a copy of these notes.
      </p>

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
