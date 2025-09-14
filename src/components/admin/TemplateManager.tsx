'use client';

import { useState, useEffect } from 'react';
import { styles } from '@/lib/styles';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import { MultiSelect } from '@/components/ui/MultiSelect';

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
}

interface LookupItem {
  id: string;
  name: string;
  category?: string;
}

interface TemplateManagerProps {
  locations: LookupItem[];
  objectives: LookupItem[];
  interventions: LookupItem[];
}

export function TemplateManager({ locations, objectives, interventions }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SessionTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    defaultDuration: '60',
    defaultLocationId: '',
    templateObjectives: [] as string[],
    templateInterventions: [] as string[]
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await apiGet<{ success: boolean; data: SessionTemplate[] }>('/templates');
      if (response.success && response.data) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const openForm = (template?: SessionTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        defaultDuration: template.defaultDuration?.toString() || '60',
        defaultLocationId: template.defaultLocationId || '',
        templateObjectives: template.templateObjectives || [],
        templateInterventions: template.templateInterventions || []
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        defaultDuration: '60',
        defaultLocationId: '',
        templateObjectives: [],
        templateInterventions: []
      });
    }
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      defaultDuration: '60',
      defaultLocationId: '',
      templateObjectives: [],
      templateInterventions: []
    });
    setFormError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');

    try {
      if (!formData.name.trim()) {
        setFormError('Template name is required');
        setFormLoading(false);
        return;
      }

      // Get objective and intervention IDs from names
      const objectiveIds = formData.templateObjectives
        .map(name => objectives.find(obj => obj.name === name)?.id)
        .filter(Boolean);
      
      const interventionIds = formData.templateInterventions
        .map(name => interventions.find(int => int.name === name)?.id)
        .filter(Boolean);

      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        defaultDuration: parseInt(formData.defaultDuration),
        defaultLocationId: formData.defaultLocationId || null,
        templateObjectives: objectiveIds,
        templateInterventions: interventionIds
      };

      let response;
      if (editingTemplate) {
        response = await apiPut<{ success: boolean; data: SessionTemplate }>(`/templates/${editingTemplate.id}`, templateData);
      } else {
        response = await apiPost<{ success: boolean; data: SessionTemplate }>('/templates', templateData);
      }

      if (response.success && response.data) {
        await loadTemplates(); // Reload to get updated data
        closeForm();
      } else {
        setFormError('Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      setFormError('Failed to save template. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (template: SessionTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiDelete<{ success: boolean }>(`/templates/${template.id}`);
      
      if (response.success) {
        setTemplates(prev => prev.filter(t => t.id !== template.id));
      } else {
        alert('Failed to delete template');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template. Please try again.');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading templates...</div>;
  }

  return (
    <div>
      {/* Action Bar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Session Templates ({templates.length})
          </h3>
          <p className="text-sm text-gray-600">
            Pre-configured session templates for common session types
          </p>
        </div>
        <button
          onClick={() => openForm()}
          className={styles.button.primary}
        >
          Add New Template
        </button>
      </div>

      {/* Templates Table */}
      {templates.length === 0 ? (
        <div className={`${styles.card} text-center py-12`}>
          <h4 className="text-lg font-semibold text-gray-900 mb-2">No Templates Yet</h4>
          <p className="text-gray-600 mb-6">Create your first session template to speed up session creation.</p>
          <button
            onClick={() => openForm()}
            className={styles.button.primary}
          >
            Create First Template
          </button>
        </div>
      ) : (
        <div className={styles.card}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Objectives
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-gray-500">{template.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.defaultDuration ? `${template.defaultDuration} min` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.defaultLocationName || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                      <div className="truncate">
                        {template.templateObjectives.length > 0 
                          ? `${template.templateObjectives.length} objectives`
                          : 'No objectives'
                        }
                      </div>
                      <div className="truncate text-xs">
                        {template.templateInterventions.length > 0 
                          ? `${template.templateInterventions.length} interventions`
                          : 'No interventions'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openForm(template)}
                        className="text-blue-600 hover:text-blue-900 mr-4"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(template)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Template Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {editingTemplate ? 'Edit Template' : 'Add New Template'}
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
                  <label className={styles.label}>Template Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className={styles.input}
                    placeholder="Enter template name"
                    required
                  />
                </div>

                <div>
                  <label className={styles.label}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    className={`${styles.input} resize-none`}
                    rows={2}
                    placeholder="Enter template description (optional)"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={styles.label}>Default Duration</label>
                    <select
                      value={formData.defaultDuration}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultDuration: e.target.value }))}
                      className={styles.select}
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="90">90 minutes</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.label}>Default Location</label>
                    <select
                      value={formData.defaultLocationId}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultLocationId: e.target.value }))}
                      className={styles.select}
                    >
                      <option value="">No default location</option>
                      {locations.map(location => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={styles.label}>Template Objectives</label>
                  <MultiSelect
                    name="templateObjectives"
                    options={objectives.map(obj => ({ value: obj.name, label: obj.name }))}
                    placeholder="Select default objectives for this template..."
                    defaultSelected={formData.templateObjectives}
                    onChange={(selected) => setFormData(prev => ({ ...prev, templateObjectives: selected }))}
                  />
                </div>

                <div>
                  <label className={styles.label}>Template Interventions</label>
                  <MultiSelect
                    name="templateInterventions"
                    options={interventions.map(int => ({ value: int.name, label: int.name }))}
                    placeholder="Select default interventions for this template..."
                    defaultSelected={formData.templateInterventions}
                    onChange={(selected) => setFormData(prev => ({ ...prev, templateInterventions: selected }))}
                  />
                </div>

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
                    {formLoading ? 'Saving...' : editingTemplate ? 'Update Template' : 'Create Template'}
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
