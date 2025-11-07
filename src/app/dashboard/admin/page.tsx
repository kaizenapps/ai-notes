'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DataTable, Column } from '@/components/ui/DataTable';
import { styles } from '@/lib/styles';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { Client as ClientType } from '@/types';
import { UserManager } from '@/components/admin/UserManager';
import { TemplateManager } from '@/components/admin/TemplateManager';
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
  const [activeTab, setActiveTab] = useState<'users' | 'clients' | 'objectives' | 'locations' | 'template'>('users');
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
    objectivesSelected: [] as string[],
    extractedInterventions: [] as string[]
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [extractingInterventions, setExtractingInterventions] = useState(false);
  const [extractionError, setExtractionError] = useState('');
  const [editingInterventionIndex, setEditingInterventionIndex] = useState<number | null>(null);
  const [editingInterventionText, setEditingInterventionText] = useState('');
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
          objectivesSelected: client.objectivesSelected || [],
          extractedInterventions: client.extractedInterventions || []
        });
      } else {
        setEditingClient(null);
        setClientFormData({
          firstName: '',
          lastInitial: '',
          treatmentPlan: '',
          objectivesSelected: [],
          extractedInterventions: []
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

  // Intervention extraction and management handlers
  const handleExtractInterventions = async () => {
    if (!clientFormData.treatmentPlan.trim()) {
      setExtractionError('Please enter a treatment plan before extracting interventions');
      return;
    }

    // If interventions already exist, show warning
    if (clientFormData.extractedInterventions.length > 0) {
      setConfirmDialog({
        isOpen: true,
        title: 'Re-extract Interventions?',
        message: 'This will replace existing interventions. Are you sure you want to continue?',
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          await performExtraction();
        }
      });
      return;
    }

    await performExtraction();
  };

  const performExtraction = async () => {
    setExtractingInterventions(true);
    setExtractionError('');

    try {
      const response = await apiPost<{ success: boolean; interventions: string[] }>('/clients/extract-interventions', {
        treatmentPlan: clientFormData.treatmentPlan,
        objectives: clientFormData.objectivesSelected
      });

      if (response.success && response.interventions) {
        setClientFormData(prev => ({
          ...prev,
          extractedInterventions: response.interventions
        }));
        setNotification({
          isOpen: true,
          message: `Successfully extracted ${response.interventions.length} interventions. All interventions are saved to the client profile.`,
          type: 'success'
        });
      } else {
        setExtractionError('Failed to extract interventions');
      }
    } catch (error) {
      console.error('Error extracting interventions:', error);
      setExtractionError('Failed to extract interventions. Please try again.');
    } finally {
      setExtractingInterventions(false);
    }
  };

  const handleAddIntervention = () => {
    const newIntervention = '[Category] - [Description]';
    setClientFormData(prev => ({
      ...prev,
      extractedInterventions: [...prev.extractedInterventions, newIntervention]
    }));
    // Start editing the new intervention immediately
    setEditingInterventionIndex(clientFormData.extractedInterventions.length);
    setEditingInterventionText(newIntervention);
  };

  const handleDeleteIntervention = (index: number) => {
    setClientFormData(prev => ({
      ...prev,
      extractedInterventions: prev.extractedInterventions.filter((_, i) => i !== index)
    }));
  };

  const handleStartEditIntervention = (index: number) => {
    setEditingInterventionIndex(index);
    setEditingInterventionText(clientFormData.extractedInterventions[index]);
  };

  const handleSaveEditIntervention = () => {
    if (editingInterventionIndex !== null) {
      setClientFormData(prev => ({
        ...prev,
        extractedInterventions: prev.extractedInterventions.map((int, i) => 
          i === editingInterventionIndex ? editingInterventionText : int
        )
      }));
      setEditingInterventionIndex(null);
      setEditingInterventionText('');
    }
  };

  const handleCancelEditIntervention = () => {
    setEditingInterventionIndex(null);
    setEditingInterventionText('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setEditingClient(null);
    setFormData({ name: '', category: '', description: '' });
    setClientFormData({ firstName: '', lastInitial: '', treatmentPlan: '', objectivesSelected: [], extractedInterventions: [] });
    setFormError('');
    setExtractionError('');
    setEditingInterventionIndex(null);
    setEditingInterventionText('');
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
          objectivesSelected: clientFormData.objectivesSelected,
          extractedInterventions: clientFormData.extractedInterventions // Always save all extracted interventions
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
      } else if (activeTab === 'template') {
        // Template is handled by TemplateManager component, not this form
        setFormLoading(false);
        return;
      } else {
        // Handle lookup item form submission (objectives, locations)
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
          // Update local state - only for objectives and locations
          if (activeTab === 'objectives' || activeTab === 'locations') {
            setLookupData(prev => ({
              ...prev,
              [activeTab]: editingItem 
                ? prev[activeTab].map(item => item.id === editingItem.id ? response.data : item)
                : [...prev[activeTab], response.data]
            }));
          }
          
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
        // Only update lookupData for valid tabs (objectives, locations, clients)
        if (activeTab === 'objectives' || activeTab === 'locations' || activeTab === 'clients') {
          setLookupData(prev => ({
            ...prev,
            [activeTab]: prev[activeTab].filter(i => i.id !== item.id)
          }));
        }
        
        // Refresh app context lookup data if not clients or template
        if (activeTab !== 'clients' && activeTab !== 'template') {
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

  // Get current data for valid tabs only (template and users have their own components)
  const currentData = (activeTab === 'objectives' || activeTab === 'locations' || activeTab === 'clients')
    ? lookupData[activeTab]
    : [];
  const tabLabels = {
    users: 'User Management',
    clients: 'Client Management',
    objectives: 'Goals and Objectives',
    locations: 'Session Locations',
    template: 'Master Session Note'
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
                  // For template tab, show no count
                  // For other tabs, use lookupData
                  const count = key === 'users' 
                    ? userCount 
                    : key === 'template'
                    ? ''
                    : (key === 'objectives' || key === 'locations' || key === 'clients'
                        ? (Array.isArray(lookupData[key as keyof LookupData]) 
                            ? lookupData[key as keyof LookupData].length 
                            : 0)
                        : 0);
                  return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as 'users' | 'clients' | 'objectives' | 'locations' | 'template')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                      {label}{count !== '' ? ` (${count})` : ''}
                  </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Action Bar (hidden for tabs that render their own headings) */}
          {activeTab !== 'users' && activeTab !== 'template' ? (
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
          ) : activeTab === 'template' ? (
            <TemplateManager />
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

                    {/* Extracted Interventions Section */}
                    <div className="border-t border-gray-200 pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <label className={styles.label}>Peer Support Interventions</label>
                          <p className="text-xs text-gray-600 mt-1">
                            AI-extracted interventions from treatment plan. All extracted interventions are saved to the client profile and will be available for selection in session notes.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleExtractInterventions}
                          disabled={extractingInterventions || !clientFormData.treatmentPlan.trim()}
                          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                            extractingInterventions || !clientFormData.treatmentPlan.trim()
                              ? 'bg-gray-400 cursor-not-allowed'
                              : 'bg-purple-600 hover:bg-purple-700'
                          }`}
                        >
                          {extractingInterventions ? (
                            <>
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Extracting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Extract Interventions with AI
                            </>
                          )}
                        </button>
                      </div>

                      {extractionError && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-3">
                          {extractionError}
                        </div>
                      )}

                      {clientFormData.extractedInterventions.length > 0 ? (
                        <div className="space-y-2">
                          {clientFormData.extractedInterventions.map((intervention, index) => (
                            <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                              {editingInterventionIndex === index ? (
                                <div className="flex-1 flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingInterventionText}
                                    onChange={(e) => setEditingInterventionText(e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="[Category] - [Description]"
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={handleSaveEditIntervention}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="Save"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEditIntervention}
                                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                    title="Cancel"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <span className="flex-1 text-sm text-gray-900">{intervention}</span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditIntervention(index)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                      title="Edit"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteIntervention(index)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                      title="Delete"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={handleAddIntervention}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Custom Intervention
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <p className="text-sm text-gray-600 mb-3">No interventions extracted yet</p>
                          <p className="text-xs text-gray-500 mb-4">
                            {clientFormData.treatmentPlan.trim() 
                              ? 'Click "Extract Interventions with AI" to analyze the treatment plan'
                              : 'Enter a treatment plan first, then extract interventions'}
                          </p>
                          <button
                            type="button"
                            onClick={handleAddIntervention}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add Manually
                          </button>
                        </div>
                      )}
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
