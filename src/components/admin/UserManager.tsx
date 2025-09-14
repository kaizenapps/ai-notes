'use client';

import { useState, useEffect } from 'react';
import { styles } from '@/lib/styles';
import { apiGet, apiPost, apiPut } from '@/lib/api';

interface User {
  id: string;
  username: string;
  email?: string;
  role: 'peer_support' | 'admin';
  firstName?: string;
  lastName?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

export function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    role: 'peer_support' as 'peer_support' | 'admin',
    password: ''
  });
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await apiGet<{ success: boolean; data: User[] }>('/admin/users');
      if (response.success && response.data) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const openForm = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        email: user.email || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        password: '' // Never pre-fill password
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        role: 'peer_support',
        password: ''
      });
    }
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      role: 'peer_support',
      password: ''
    });
    setFormError('');
  };

  const openPasswordReset = (user: User) => {
    setResetPasswordUser(user);
    setPasswordData({
      newPassword: '',
      confirmPassword: ''
    });
    setFormError('');
    setShowPasswordReset(true);
  };

  const closePasswordReset = () => {
    setShowPasswordReset(false);
    setResetPasswordUser(null);
    setPasswordData({
      newPassword: '',
      confirmPassword: ''
    });
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      // Validation
      if (!formData.username.trim()) {
        setFormError('Username is required');
        setFormLoading(false);
        return;
      }

      if (!editingUser && (!formData.password || formData.password.length < 6)) {
        setFormError('Password must be at least 6 characters for new users');
        setFormLoading(false);
        return;
      }

      const userData = {
        username: formData.username.trim(),
        email: formData.email.trim() || undefined,
        firstName: formData.firstName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
        role: formData.role,
        ...(editingUser ? {} : { password: formData.password }) // Only include password for new users
      };

      let response;
      if (editingUser) {
        response = await apiPut<{ success: boolean; data: User }>(`/admin/users/${editingUser.id}`, userData);
      } else {
        response = await apiPost<{ success: boolean; data: User }>('/admin/users', userData);
      }

      if (response.success && response.data) {
        await loadUsers(); // Reload to get updated data
        closeForm();
      } else {
        setFormError('Failed to save user');
      }
    } catch (error) {
      console.error('Error saving user:', error);
      setFormError('Failed to save user. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    setFormLoading(true);
    setFormError('');

    try {
      if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
        setFormError('Password must be at least 6 characters');
        setFormLoading(false);
        return;
      }

      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setFormError('Passwords do not match');
        setFormLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/users/${resetPasswordUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          newPassword: passwordData.newPassword
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          closePasswordReset();
          alert('Password reset successfully');
        } else {
          setFormError(result.error || 'Failed to reset password');
        }
      } else {
        const result = await response.json();
        setFormError(result.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setFormError('Failed to reset password. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    const action = user.isActive ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} ${user.username}?`)) {
      return;
    }

    try {
      const response = await apiPut<{ success: boolean; data: User }>(`/admin/users/${user.id}`, {
        isActive: !user.isActive
      });

      if (response.success) {
        await loadUsers();
      } else {
        alert(`Failed to ${action} user`);
      }
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      alert(`Failed to ${action} user. Please try again.`);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>;
  }

  return (
    <div>
      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            User Management ({users.length})
          </h3>
          <p className="text-sm text-gray-600">
            Manage system users and their access permissions
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className={styles.button.primary}
        >
          Add New User
        </button>
      </div>

      {/* Users Table */}
      {users.length === 0 ? (
        <div className={`${styles.card} text-center py-12`}>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">No Users Yet</h4>
          <p className="text-gray-600 mb-6">Create your first user account to get started.</p>
          <button
            onClick={() => openForm()}
            className={styles.button.primary}
          >
            Create First User
          </button>
        </div>
      ) : (
        <div className={styles.card}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        <div className="text-sm text-gray-500">
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}`
                            : user.email || 'No email'
                          }
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role === 'admin' ? 'Administrator' : 'Peer Support'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastLoginAt 
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openForm(user)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openPasswordReset(user)}
                          className="text-yellow-600 hover:text-yellow-900"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={user.isActive ? "text-red-600 hover:text-red-900" : "text-green-600 hover:text-green-900"}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h3>
                <button
                  onClick={closeForm}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {formError}
                  </div>
                )}

                <div>
                  <label className={styles.label}>Username *</label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    className={styles.input}
                    placeholder="Enter username"
                    required
                  />
                </div>

                <div>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className={styles.input}
                    placeholder="Enter email (optional)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={styles.label}>First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      className={styles.input}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      className={styles.input}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div>
                  <label className={styles.label}>Role *</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as 'peer_support' | 'admin' }))}
                    className={styles.select}
                    required
                  >
                    <option value="peer_support">Peer Support Specialist</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                {!editingUser && (
                  <div>
                    <label className={styles.label}>Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={styles.input}
                      placeholder="Enter password (min 6 characters)"
                      minLength={6}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum 6 characters. User can be given this password to login.
                    </p>
                  </div>
                )}

                {editingUser && (
                  <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-200">
                    <p className="text-blue-800 text-sm">
                      💡 To change password, use the &quot;Reset Password&quot; button instead.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeForm}
                    className={`flex-1 ${styles.button.secondary}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className={`flex-1 ${styles.button.primary}`}
                  >
                    {formLoading ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordReset && resetPasswordUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Reset Password - {resetPasswordUser.username}
                </h3>
                <button
                  onClick={closePasswordReset}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-4">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {formError}
                  </div>
                )}

                <div>
                  <label className={styles.label}>New Password *</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className={styles.input}
                    placeholder="Enter new password"
                    minLength={6}
                    required
                  />
                </div>

                <div>
                  <label className={styles.label}>Confirm Password *</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className={styles.input}
                    placeholder="Confirm new password"
                    minLength={6}
                    required
                  />
                </div>

                <div className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-200">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ The user will need to use this new password to login. Make sure to communicate it securely.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closePasswordReset}
                    className={`flex-1 ${styles.button.secondary}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className={`flex-1 ${styles.button.primary}`}
                  >
                    {formLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
