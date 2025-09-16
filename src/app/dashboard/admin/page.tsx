'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DataTable, Column } from '@/components/ui/DataTable';
import { styles } from '@/lib/styles';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Client as ClientType } from '@/types';
import { TemplateManager } from '@/components/admin/TemplateManager';
import { UserManager } from '@/components/admin/UserManager';
import Link from 'next/link';

interface LookupItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  defaultDuration?: number;
  defaultLocationId?: string;
  defaultLocationName?: string;
  templateObjectives: string[];
  templateInterventions: string[];
  createdBy?: string;
  isActive: boolean;
  createdAt: Date;
  [key: string]: unknown;
}

interface LookupData {
  locations: LookupItem[];
  objectives: LookupItem[];
  interventions: LookupItem[];
  clients: Client[];
  templates: SessionTemplate[];
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
    interventions: [],
    clients: [],
    templates: [],
    users: []
  });
  const [activeTab, setActiveTab] = useState<'locations' | 'objectives' | 'interventions' | 'clients' | 'templates' | 'users'>('locations');
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
    treatmentPlan: ''
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useSessionTimeout();

  // Define columns for each tab
  const getColumnsForTab = (tab: string): Column<LookupItem | Client | SessionTemplate>[] => {
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
            render: (value) => <span className="text-gray-600">{String(value) || '-'}</span>
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
            render: (value) => <span className="text-gray-600">{String(value) || '-'}</span>
          },
          {
            key: 'description',
            label: 'Description',
            sortable: true,
            render: (value) => <span className="text-gray-600">{String(value) || '-'}</span>
          }
        ];
      case 'interventions':
        return [
          {
            key: 'name',
            label: 'Intervention',
            sortable: true,
            render: (value) => <span className="font-medium text-gray-900">{String(value)}</span>
          },
          {
            key: 'category',
            label: 'Category',
            sortable: true,
            render: (value) => <span className="text-gray-600">{String(value) || '-'}</span>
          },
          {
            key: 'description',
            label: 'Description',
            sortable: true,
            render: (value) => <span className="text-gray-600">{String(value) || '-'}</span>
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

        // Load templates data
        const templatesResponse = await apiGet<{ success: boolean; data: SessionTemplate[] }>('/templates');
        if (templatesResponse.success && templatesResponse.data) {
          setLookupData(prev => ({ ...prev, templates: templatesResponse.data }));
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

  const openForm = (item?: LookupItem | Client | SessionTemplate) => {
    if (activeTab === 'clients') {
      const client = item as Client;
      if (client) {
        setEditingClient(client);
        setClientFormData({
          firstName: client.firstName,
          lastInitial: client.lastInitial,
          treatmentPlan: client.treatmentPlan || ''
        });
      } else {
        setEditingClient(null);
        setClientFormData({
          firstName: '',
          lastInitial: '',
          treatmentPlan: ''
        });
      }
    } else if (activeTab === 'templates') {
      // Templates are handled by TemplateManager component - no form needed here
      return;
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
    setClientFormData({ firstName: '', lastInitial: '', treatmentPlan: '' });
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
          treatmentPlan: clientFormData.treatmentPlan.trim()
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
      } else if (activeTab === 'templates') {
        // Templates are handled by TemplateManager component
        setFormError('Template management is handled separately');
        closeForm();
        return;
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
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

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
      } else {
        alert('Failed to delete item');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Failed to delete item. Please try again.');
    }
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
    locations: 'Session Locations',
    objectives: 'Treatment Objectives', 
    interventions: 'Peer Support Interventions',
    clients: 'Client Management',
    templates: 'Session Templates',
    users: 'User Management'
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
                {Object.entries(tabLabels).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as keyof LookupData)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {label} ({currentData.length})
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Action Bar (hidden for tabs that render their own headings) */}
          {activeTab !== 'templates' && activeTab !== 'users' ? (
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {tabLabels[activeTab]}
                </h2>
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
          {activeTab === 'templates' ? (
            <TemplateManager 
              locations={lookupData.locations}
              objectives={lookupData.objectives}
              interventions={lookupData.interventions}
            />
          ) : activeTab === 'users' ? (
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {activeTab === 'clients' 
                    ? (editingClient ? 'Edit Client' : 'Add New Client')
                    : `${editingItem ? 'Edit' : 'Add'} ${activeTab.slice(0, -1).charAt(0).toUpperCase() + activeTab.slice(1, -1)}`
                  }
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
                        placeholder="Enter treatment plan or goals..."
                      />
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
    </div>
  );
}
