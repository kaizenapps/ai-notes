'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DataTable, Column } from '@/components/ui/DataTable';
import { styles } from '@/lib/styles';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Client as ClientType, User } from '@/types';
import { UserManager } from '@/components/admin/UserManager';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastNotification } from '@/components/ui/Notification';
import Link from 'next/link';

interface LookupItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  is_active?: boolean;
  [key: string]: unknown;
}


interface LookupData {
  locations: LookupItem[];
  objectives: LookupItem[];
  clients: Client[];
  users: never[]; // Users are handled by UserManager component
}

interface Client extends ClientType {
  created_at?: string;
  [key: string]: unknown;
}

export default function AdminPage() {
  const { user, setUser, loadLookupData } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lookupData, setLookupData] = useState<LookupData>({
    locations: [],
    objectives: [],
    clients: [],
    users: []
  });
  const [userCount, setUserCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'users' | 'clients' | 'objectives' | 'locations'>('users');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<LookupItem | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: ''
  });
  const [clientFormData, setClientFormData] = useState({
    firstName: '',
    lastInitial: '',
    treatmentPlan: '',
    objectivesSelected: [] as string[]
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  useSessionTimeout();

  // Define columns for each tab
  const getColumnsForTab = (tab: string): Column<LookupItem | Client>[] => {
    switch (tab) {
      case 'locations':
        return [
          {
            key: 'name',
            label: 'Location Name',
            sortable: true,
            render: (value) => <span className="font-medium text-gray-900">{String(value)}</span>
          },
          {
            key: 'description',
            label: 'Description',
            sortable: true,
            render: (value) => {
              const displayValue = value && value !== 'undefined' && value !== 'null' ? String(value) : '';
              return <span className="text-gray-600">{displayValue || '-'}</span>;
            }
          }
        ];
      case 'objectives':
        return [
          {
            key: 'name',
            label: 'Objective',
            sortable: true,
            render: (value) => <span className="font-medium text-gray-900">{String(value)}</span>
          },
          {
            key: 'category',
            label: 'Category',
            sortable: true,
            render: (value) => {
              const displayValue = value && value !== 'undefined' && value !== 'null' ? String(value) : '';
              return <span className="text-gray-600">{displayValue || '-'}</span>;
            }
          },
          {
            key: 'description',
            label: 'Description',
            sortable: true,
            render: (value) => {
              const displayValue = value && value !== 'undefined' && value !== 'null' ? String(value) : '';
              return <span className="text-gray-600">{displayValue || '-'}</span>;
            }
          }
        ];
      case 'clients':
        return [
          {
            key: 'firstName',
            label: 'Client Name',
            sortable: true,
            render: (value, item) => (
              <span className="font-medium text-gray-900">
                {String(value)} {(item as Client).lastInitial}.
              </span>
            )
          },
          {
            key: 'treatmentPlan',
            label: 'Treatment Plan',
            sortable: true,
            render: (value) => (
              <span className="text-gray-600 max-w-xs truncate block">
                {String(value) || '-'}
              </span>
            )
          }
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    const loadAdminData = async () => {
      try {
        // Check authentication and admin role
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '/';
          return;
        }

        if (!user) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
              if (userData.role !== 'admin') {
                window.location.href = '/dashboard';
                return;
              }
            } catch {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/';
              return;
            }
          } else {
            window.location.href = '/';
            return;
          }
        }

        if (user && user.role !== 'admin') {
          window.location.href = '/dashboard';
          return;
        }

        // Load lookup data
        const lookupResponse = await apiGet<{ success: boolean; data: LookupData }>('/lookup');
        if (lookupResponse.success && lookupResponse.data) {
          setLookupData(prev => ({ ...prev, ...lookupResponse.data }));
        }

        // Load clients data
        const clientsResponse = await apiGet<{ success: boolean; data: Client[] }>('/clients');
        if (clientsResponse.success && clientsResponse.data) {
          setLookupData(prev => ({ ...prev, clients: clientsResponse.data }));
        }

        // Load users count for tab display
        try {
          const usersResponse = await apiGet<{ success: boolean; data: Array<{
            id: string;
            username: string;
            email?: string;
            role: 'peer_support' | 'admin';
            firstName?: string;
            lastName?: string;
            isActive: boolean;
            lastLoginAt?: Date;
            createdAt: Date;
          }> }>('/admin/users');
          if (usersResponse.success && usersResponse.data) {
            setUserCount(usersResponse.data.length);
          }
        } catch (error) {
          console.error('Error loading users count:', error);
        }

      } catch (error) {
        console.error('Error loading admin data:', error);
        setError('Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };

    loadAdminData();
  }, [user, setUser]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  const openForm = (item?: LookupItem | Client) => {
    if (activeTab === 'clients') {
      const client = item as Client;
      if (client) {
        setEditingClient(client);
        setClientFormData({
          firstName: client.firstName,
          lastInitial: client.lastInitial,
          treatmentPlan: client.treatmentPlan || '',
          objectivesSelected: client.objectivesSelected || []
        });
      } else {
        setEditingClient(null);
        setClientFormData({
          firstName: '',
          lastInitial: '',
          treatmentPlan: '',
          objectivesSelected: []
        });
      }
    } else {
      const lookupItem = item as LookupItem;
      if (lookupItem) {
        setEditingItem(lookupItem);
        setFormData({
          name: lookupItem.name,
          category: lookupItem.category || '',
          description: lookupItem.description || ''
        });
      } else {
        setEditingItem(null);
        setFormData({
          name: '',
          category: '',
          description: ''
        });
      }
    }
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setEditingClient(null);
    setFormData({ name: '', category: '', description: '' });
    setClientFormData({ firstName: '', lastInitial: '', treatmentPlan: '', objectivesSelected: [] });
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      if (activeTab === 'clients') {
        // Handle client form submission
        if (!clientFormData.firstName.trim()) {
          setFormError('First name is required');
          setFormLoading(false);
          return;
        }

        if (!clientFormData.lastInitial.trim() || clientFormData.lastInitial.length !== 1) {
          setFormError('Last initial must be a single letter');
          setFormLoading(false);
          return;
        }

        const clientData = {
          firstName: clientFormData.firstName.trim(),
          lastInitial: clientFormData.lastInitial.trim().toUpperCase(),
          treatmentPlan: clientFormData.treatmentPlan.trim(),
          objectivesSelected: clientFormData.objectivesSelected
        };

        let response;
        if (editingClient) {
          response = await apiPut<{ success: boolean; data: Client }>(`/clients/${editingClient.id}`, clientData);
        } else {
          response = await apiPost<{ success: boolean; data: Client }>('/clients', clientData);
        }

        if (response.success && response.data) {
          // Update local state
          setLookupData(prev => ({
            ...prev,
            clients: editingClient 
              ? prev.clients.map(client => client.id === editingClient.id ? response.data : client)
              : [...prev.clients, response.data]
          }));
          
          closeForm();
        } else {
          setFormError('Failed to save client');
        }
      } else {
        // Handle lookup item form submission
        if (!formData.name.trim()) {
          setFormError('Name is required');
          setFormLoading(false);
          return;
        }

        const submitData = {
          name: formData.name.trim(),
          category: formData.category.trim() || null,
          description: formData.description.trim() || null
        };

        let response;
        if (editingItem) {
          response = await apiPut<{ success: boolean; data: LookupItem }>(`/admin/${activeTab}/${editingItem.id}`, submitData);
        } else {
          response = await apiPost<{ success: boolean; data: LookupItem }>(`/admin/${activeTab}`, submitData);
        }

        if (response.success && response.data) {
          // Update local state
          setLookupData(prev => ({
            ...prev,
            [activeTab]: editingItem 
              ? prev[activeTab].map(item => item.id === editingItem.id ? response.data : item)
              : [...prev[activeTab], response.data]
          }));
          
          // Refresh app context lookup data
          await loadLookupData();
          
          closeForm();
        } else {
          setFormError('Failed to save item');
        }
      }
    } catch (error) {
      console.error('Error saving item:', error);
      setFormError('Failed to save item. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (item: LookupItem | Client) => {
    const name = 'name' in item ? item.name : `${item.firstName} ${item.lastInitial}.`;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Delete',
      message: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
          let response;
          if (activeTab === 'clients') {
            response = await apiDelete<{ success: boolean }>(`/clients/${item.id}`);
          } else {
            response = await apiDelete<{ success: boolean }>(`/admin/${activeTab}/${item.id}`);
          }
          
          if (response.success) {
            setLookupData(prev => ({
              ...prev,
              [activeTab]: prev[activeTab].filter(i => i.id !== item.id)
            }));
            
            // Refresh app context lookup data if not clients
            if (activeTab !== 'clients') {
              await loadLookupData();
            }
            
            // Update user count if deleting from users tab
            if (activeTab === 'users') {
              setUserCount(prev => Math.max(0, prev - 1));
            }
            
            setNotification({
              isOpen: true,
              message: 'Item deleted successfully',
              type: 'success'
            });
          } else {
            setNotification({
              isOpen: true,
              message: 'Failed to delete item',
              type: 'error'
            });
          }
        } catch (error) {
          console.error('Error deleting item:', error);
          setNotification({
            isOpen: true,
            message: 'Failed to delete item. Please try again.',
            type: 'error'
          });
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button onClick={() => window.location.reload()} className={styles.button.primary}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">Access denied. Admin privileges required.</div>
          <Link href="/dashboard" className={styles.button.primary}>
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentData = lookupData[activeTab];
  const tabLabels = {
    users: 'User Management',
    clients: 'Client Management',
    objectives: 'Goals and Objectives',
    locations: 'Session Locations'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className={`${styles.container} flex justify-between items-center py-4`}>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-sm text-gray-600">Manage lookup data and system settings</p>
          </div>
          <div className="flex gap-3">
            <Link href="/dashboard" className={styles.button.secondary}>
              Dashboard
            </Link>
            <Link href="/dashboard/history" className={styles.button.secondary}>
              History
            </Link>
            <button onClick={handleLogout} className={styles.button.secondary}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-8">
        <div className={styles.container}>
          {/* Tab Navigation */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {Object.entries(tabLabels).map(([key, label]) => {
                  // For users tab, use the separate userCount state
                  // For other tabs, use lookupData
                  const count = key === 'users' 
                    ? userCount 
                    : (Array.isArray(lookupData[key as keyof LookupData]) 
                        ? lookupData[key as keyof LookupData].length 
                        : 0);
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key as keyof LookupData)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === key
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Action Bar (hidden for tabs that render their own headings) */}
          {activeTab !== 'users' ? (
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-sm text-gray-600">
                  Manage {activeTab} used in session forms
                </p>
              </div>
              <button
                onClick={() => openForm()}
                className={styles.button.primary}
              >
                Add New {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}
              </button>
            </div>
          ) : (
            <div className="mb-6" />
          )}

          {/* Content Area */}
          {activeTab === 'users' ? (
            <UserManager />
          ) : currentData.length === 0 ? (
            <div className={`${styles.card} text-center py-12`}>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No {tabLabels[activeTab]} Yet
              </h3>
              <p className="text-gray-600 mb-6">
                Add your first {activeTab.slice(0, -1)} to get started.
              </p>
              <button
                onClick={() => openForm()}
                className={styles.button.primary}
              >
                Add First {activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}
              </button>
            </div>
          ) : (
            <DataTable
              data={currentData}
              columns={getColumnsForTab(activeTab)}
              searchable={true}
              searchPlaceholder={`Search ${tabLabels[activeTab].toLowerCase()}...`}
              pagination={true}
              pageSize={10}
              emptyMessage={`No ${tabLabels[activeTab].toLowerCase()} found`}
              actions={(item) => (
                <div className="flex gap-2">
                  <button
                    onClick={() => openForm(item)}
                    className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
                    className="text-red-600 hover:text-red-900 text-sm font-medium"
                  >
                    {activeTab === 'clients' ? 'Remove' : 'Delete'}
                  </button>
                </div>
              )}
            />
          )}
        </div>
      </main>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeForm}>
          <div className={`bg-white rounded-lg shadow-2xl w-full ${activeTab === 'clients' ? 'max-w-2xl' : 'max-w-md'} max-h-[95vh] flex flex-col`} onClick={(e) => e.stopPropagation()}>
            <div className="flex-shrink-0 p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeTab === 'clients' 
                    ? (editingClient ? 'Edit Client' : 'Add New Client')
                    : `${editingItem ? 'Edit' : 'Add'} ${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}`
                  }
                </h3>
                <button
                  onClick={closeForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded hover:bg-gray-100"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {formError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {formError}
                  </div>
                )}

                {activeTab === 'clients' ? (
                  <>
                    <div>
                      <label className={styles.label}>First Name *</label>
                      <input
                        type="text"
                        value={clientFormData.firstName}
                        onChange={(e) => setClientFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        className={styles.input}
                        placeholder="Enter first name"
                        required
                      />
                    </div>

                    <div>
                      <label className={styles.label}>Last Initial *</label>
                      <input
                        type="text"
                        value={clientFormData.lastInitial}
                        onChange={(e) => setClientFormData(prev => ({ ...prev, lastInitial: e.target.value.slice(0, 1) }))}
                        className={styles.input}
                        placeholder="Enter last initial"
                        maxLength={1}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        HIPAA Compliance: Only store the first letter of last name
                      </p>
                    </div>

                    <div>
                      <label className={styles.label}>Treatment Plan (Optional)</label>
                      <textarea
                        value={clientFormData.treatmentPlan}
                        onChange={(e) => setClientFormData(prev => ({ ...prev, treatmentPlan: e.target.value }))}
                        className={`${styles.input} resize-none`}
                        rows={4}
                        placeholder={`Paste treatment plan here. Recommended format:
Long-term Goal 1: [description]
Short-term Goal 1: [description]
Intervention 1: [category] - [description]`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use the standardized format for best AI parsing results
                      </p>
                    </div>

                    <div className="relative">
                      <label className={styles.label}>Goals & Objectives *</label>
                      <p className="text-xs text-gray-600 mb-2">
                        Select the objectives that apply to this client. These will be pre-populated for all future sessions.
                      </p>
                      <div className="relative z-10">
                        <MultiSelect
                          name="objectivesSelected"
                          options={lookupData.objectives.map(obj => ({ value: obj.id, label: obj.name }))}
                          placeholder="Select objectives for this client..."
                          value={clientFormData.objectivesSelected}
                          onChange={(selected) => setClientFormData(prev => ({ ...prev, objectivesSelected: selected }))}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className={styles.label}>Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={styles.input}
                        placeholder={`Enter ${activeTab.slice(0, -1)} name`}
                        required
                      />
                    </div>

                    {activeTab !== 'locations' && (
                      <div>
                        <label className={styles.label}>Category</label>
                        <input
                          type="text"
                          value={formData.category}
                          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                          className={styles.input}
                          placeholder="Enter category (optional)"
                        />
                      </div>
                    )}

                    <div>
                      <label className={styles.label}>Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className={`${styles.input} resize-none`}
                        rows={3}
                        placeholder="Enter description (optional)"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-4 border-t border-gray-200 mt-6">
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
                    {formLoading ? 'Saving...' : 
                     activeTab === 'clients' ? (editingClient ? 'Update Client' : 'Add Client') :
                     (editingItem ? 'Update' : 'Add')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className={`${styles.container} py-4 text-center text-sm text-gray-500`}>
          <p>Admin Dashboard • HIPAA Compliant • Session timeout: 15 minutes</p>
        </div>
      </footer>
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
      
      {/* Notification */}
      <ToastNotification
        isOpen={notification.isOpen}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
