'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

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
      
      if (userData.role !== 'admin') {
        setMessage('Access denied. Organization admin privileges required.');
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
      where('organizationId', '==', orgId),
      where('status', '==', 'pending')
    );
    const invitesSnapshot = await getDocs(invitesQuery);
    const invitesList = invitesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setInvitations(invitesList);
  };

  const handleInviteUser = async (email, role) => {
    try {
      if (!email || !role) {
        setMessage('Email and role are required');
        return;
      }
      
      const existingUserQuery = query(collection(db, 'users'), where('email', '==', email));
      const existingUser = await getDocs(existingUserQuery);
      if (!existingUser.empty) {
        setMessage('User with this email already exists');
        return;
      }
      
      const existingInviteQuery = query(
        collection(db, 'invitations'),
        where('email', '==', email),
        where('status', '==', 'pending')
      );
      const existingInvite = await getDocs(existingInviteQuery);
      if (!existingInvite.empty) {
        setMessage('Invitation already sent to this email');
        return;
      }
      
      const invitation = {
        organizationId: userProfile.organizationId,
        email: email,
        role: role,
        invitedBy: user.uid,
        invitedAt: new Date(),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };
      
      await addDoc(collection(db, 'invitations'), invitation);
      
      setMessage(`Invitation sent to ${email}`);
      await loadInvitations(userProfile.organizationId);
      
    } catch (error) {
      console.error('Error inviting user:', error);
      setMessage('Error sending invitation');
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date()
      });
      
      setMessage('User role updated');
      await loadUsers(userProfile.organizationId);
      
    } catch (error) {
      console.error('Error updating user role:', error);
      setMessage('Error updating user role');
    }
  };

  const handleDeactivateUser = async (userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: 'suspended',
        updatedAt: new Date()
      });
      
      setMessage('User deactivated');
      await loadUsers(userProfile.organizationId);
      
    } catch (error) {
      console.error('Error deactivating user:', error);
      setMessage('Error deactivating user');
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    try {
      await deleteDoc(doc(db, 'invitations', invitationId));
      setMessage('Invitation cancelled');
      await loadInvitations(userProfile.organizationId);
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      setMessage('Error cancelling invitation');
    }
  };

  const handleUpdateOrganization = async (updatedData) => {
    try {
      await setDoc(doc(db, 'organizations', organization.id), {
        ...organization,
        ...updatedData,
        updatedAt: new Date(),
        updatedBy: user.uid
      }, { merge: true });
      
      setOrganization(prev => ({ ...prev, ...updatedData }));
      setMessage('Organization settings saved successfully!');
    } catch (error) {
      console.error('Error updating organization:', error);
      setMessage('Error saving organization settings');
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

  if (!userProfile || userProfile.role !== 'admin') {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Administration</h1>
          <p className="text-gray-600 mt-2">{organization?.name}</p>
        </div>

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

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('users')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'users'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                👥 Users ({users.length})
              </button>
              <button
                onClick={() => setActiveTab('invitations')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'invitations'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                ✉️ Invitations ({invitations.length})
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-6 py-4 font-medium text-sm border-b-2 ${
                  activeTab === 'settings'
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                🎨 Branding & Settings
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
              />
            )}

            {activeTab === 'settings' && (
              <OrganizationSettingsTab
                organization={organization}
                onSave={handleUpdateOrganization}
                setMessage={setMessage}
              />
            )}

          </div>
        </div>

      </div>
    </div>
  );
}

function UsersTab({ users, currentUserId, onUpdateRole, onDeactivate }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Active Users</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-gray-900">{user.displayName || 'Unknown'}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={user.role}
                    onChange={(e) => onUpdateRole(user.id, e.target.value)}
                    disabled={user.id === currentUserId}
                    className="px-3 py-1 border border-gray-300 rounded text-sm disabled:bg-gray-100 text-gray-900"
                  >
                    <option value="admin">Admin</option>
                    <option value="specialist">Specialist</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded ${
                    user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.id !== currentUserId && user.status === 'active' && (
                    <button
                      onClick={() => onDeactivate(user.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Deactivate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvitationsTab({ invitations, onInvite, onCancel }) {
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('specialist');

  const handleSubmit = (e) => {
    e.preventDefault();
    onInvite(newEmail, newRole);
    setNewEmail('');
    setNewRole('specialist');
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">Invite New User</h2>
      
      <form onSubmit={handleSubmit} className="mb-8 p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
              placeholder="user@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
            >
              <option value="specialist">Specialist</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
        >
          Send Invitation
        </button>
      </form>

      <h3 className="text-lg font-bold text-gray-900 mb-4">Pending Invitations</h3>
      <div className="space-y-4">
        {invitations.length === 0 ? (
          <p className="text-gray-600">No pending invitations</p>
        ) : (
          invitations.map(invite => (
            <div key={invite.id} className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{invite.email}</div>
                <div className="text-sm text-gray-600">
                  Role: {invite.role} • Expires: {new Date(invite.expiresAt.seconds * 1000).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => onCancel(invite.id)}
                className="px-4 py-2 text-red-600 hover:text-red-800 font-medium"
              >
                Cancel
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function OrganizationSettingsTab({ organization, onSave, setMessage }) {
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    address: organization?.address || '',
    city: organization?.city || '',
    state: organization?.state || '',
    zipCode: organization?.zipCode || '',
    phone: organization?.phone || '',
    email: organization?.email || '',
    website: organization?.website || '',
    logoUrl: organization?.logoUrl || '',
    preparedBy: organization?.preparedBy || '',
    licenseNumber: organization?.licenseNumber || ''
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setMessage('Please upload an image file (PNG, JPG, etc.)');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Logo file must be less than 2MB');
      return;
    }
    
    try {
      setUploadingLogo(true);
      
      const logoRef = ref(storage, `organizations/${organization.id}/logo-${Date.now()}`);
      await uploadBytes(logoRef, file);
      const logoUrl = await getDownloadURL(logoRef);
      
      setFormData(prev => ({ ...prev, logoUrl }));
      setMessage('Logo uploaded successfully!');
    } catch (error) {
      console.error('Error uploading logo:', error);
      setMessage('Error uploading logo: ' + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave(formData);
    setSaving(false);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Organization Branding & Settings</h2>
      <p className="text-gray-600 mb-6">Configure your company branding for report generation</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Logo Section */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-2">🎨 Company Logo</h3>
          <p className="text-sm text-gray-600 mb-4">
            This logo will appear on the cover page of all generated reports. Recommended size: 300x100 pixels.
          </p>
          
          <div className="flex items-start gap-6">
            <div className="w-64 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white overflow-hidden">
              {formData.logoUrl ? (
                <img 
                  src={formData.logoUrl} 
                  alt="Company Logo" 
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center text-gray-400">
                  <div className="text-4xl mb-2">🏢</div>
                  <div className="text-sm">No logo uploaded</div>
                </div>
              )}
            </div>
            
            <div className="flex flex-col gap-3">
              <label className="cursor-pointer">
                <span className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block font-medium text-sm">
                  {uploadingLogo ? 'Uploading...' : formData.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                  className="hidden"
                />
              </label>
              
              {formData.logoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium text-left"
                >
                  Remove Logo
                </button>
              )}
              
              <p className="text-xs text-gray-500">PNG, JPG, or SVG (max 2MB)</p>
            </div>
          </div>
        </div>

        {/* Company Information */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">🏢 Company Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="Beahm Consulting, LLC"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="1709 Langhorne Newtown Road, Suite 4"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="Langhorne"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <select
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                >
                  <option value="">Select</option>
                  <option value="PA">PA</option>
                  <option value="NJ">NJ</option>
                  <option value="NY">NY</option>
                  <option value="DE">DE</option>
                  <option value="MD">MD</option>
                  <option value="CA">CA</option>
                  <option value="FL">FL</option>
                  <option value="TX">TX</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zip Code</label>
                <input
                  type="text"
                  name="zipCode"
                  value={formData.zipCode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                  placeholder="19047"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📞 Contact Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="732-207-7850"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="info@beahmconsulting.com"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
              <input
                type="url"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="https://www.beahmconsulting.com"
              />
            </div>
          </div>
        </div>

        {/* Report Settings */}
        <div className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">📄 Report Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prepared By (Name)</label>
              <input
                type="text"
                name="preparedBy"
                value={formData.preparedBy}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="Jordan Beahm"
              />
              <p className="text-xs text-gray-500 mt-1">This name appears in report disclosures</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License/Certification Number</label>
              <input
                type="text"
                name="licenseNumber"
                value={formData.licenseNumber}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900"
                placeholder="RS #12345"
              />
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-blue-900 mb-2">👁️ Report Footer Preview</h3>
          <p className="text-sm text-blue-700 mb-4">This is how your company info will appear in report footers:</p>
          
          <div className="border border-blue-200 rounded-lg p-4 bg-white text-center">
            <div className="text-sm font-bold text-gray-800">
              {formData.name || 'Company Name'}
            </div>
            <div className="text-xs text-gray-600">
              {[
                formData.address,
                formData.city,
                formData.state,
                formData.zipCode
              ].filter(Boolean).join(', ') || 'Address'}
              {formData.phone && ` • ${formData.phone}`}
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
