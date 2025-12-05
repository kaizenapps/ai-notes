'use client';

import { useState, useEffect } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ToastNotification } from '@/components/ui/Notification';
import { styles } from '@/lib/styles';
import { apiGet, apiPut } from '@/lib/api';
import { MasterSessionTemplate, TemplateSection } from '@/types';

export function TemplateManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<MasterSessionTemplate | null>(null);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });

  useEffect(() => {
    loadTemplate();
  }, []);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiGet<{ success: boolean; data: MasterSessionTemplate }>('/admin/template');
      if (response.success && response.data) {
        setTemplate(response.data);
      } else {
        setError('Failed to load template');
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!template) return;

    try {
      setSaving(true);
      setError('');
      const response = await apiPut<{ success: boolean; data: MasterSessionTemplate }>(`/admin/template/${template.id}`, {
        name: template.name,
        sections: template.sections
      });

      if (response.success && response.data) {
        setTemplate(response.data);
        setNotification({
          isOpen: true,
          message: 'Template saved successfully',
          type: 'success'
        });
      } else {
        setError('Failed to save template');
      }
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = (index: number, updates: Partial<TemplateSection>) => {
    if (!template) return;
    const updatedSections = [...template.sections];
    updatedSections[index] = { ...updatedSections[index], ...updates };
    setTemplate({ ...template, sections: updatedSections });
  };

  const toggleSectionVisibility = (index: number) => {
    if (!template) return;
    updateSection(index, { isVisible: !template.sections[index].isVisible });
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    if (!template) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= template.sections.length) return;

    const updatedSections = [...template.sections];
    const [moved] = updatedSections.splice(index, 1);
    updatedSections.splice(newIndex, 0, moved);
    
    // Update order numbers
    updatedSections.forEach((section, idx) => {
      section.order = idx + 1;
    });

    setTemplate({ ...template, sections: updatedSections });
  };

  const availablePlaceholders = [
    { name: '{{clientName}}', description: 'Client name (e.g., "Jane S.")' },
    { name: '{{location}}', description: 'Session location' },
    { name: '{{duration}}', description: 'Session duration in minutes' },
    { name: '{{treatmentPlan}}', description: 'Treatment plan for this session' },
    { name: '{{selectedInterventions}}', description: 'Selected peer support interventions for this session' }
  ];

  if (loading) {
    return (
      <div className={styles.card}>
        <LoadingSpinner />
        <p className="text-center text-gray-600 mt-2">Loading template...</p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className={styles.card}>
        <div className="text-center py-8">
          <p className="text-gray-600">No template found. Please contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className={styles.card}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Master Session Note Template</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure how AI generates session notes. Edit section instructions, reorder sections, and show/hide sections.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`${styles.button.primary} flex items-center gap-2`}
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Template
              </>
            )}
          </button>
        </div>

        {/* Template Name */}
        <div className="mb-6">
          <label className={styles.label}>Template Name</label>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            className={styles.input}
            placeholder="Default Template"
          />
        </div>

        {/* Available Placeholders Reference */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Available Placeholders</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {availablePlaceholders.map((placeholder) => (
              <div key={placeholder.name} className="text-blue-800">
                <code className="bg-blue-100 px-1 py-0.5 rounded">{placeholder.name}</code>
                <span className="ml-2 text-blue-700">- {placeholder.description}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Template Sections</h3>
          <p className="text-sm text-gray-600 mb-4">
            Drag sections to reorder, toggle visibility, and edit instructions. Use placeholders like {'{{'}clientName{'}}'} in instructions.
          </p>

          {template.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => {
              const originalIndex = template.sections.findIndex(s => s.name === section.name);
              return (
                <div key={section.name} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-base font-semibold text-gray-900">{section.heading}</h4>
                        <span className="text-xs text-gray-500">({section.name})</span>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={section.isVisible}
                            onChange={() => toggleSectionVisibility(originalIndex)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-xs text-gray-600">Visible</span>
                        </label>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveSection(originalIndex, 'up')}
                        disabled={section.order === 1}
                        className={`p-1.5 rounded transition-colors ${
                          section.order === 1
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Move up"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(originalIndex, 'down')}
                        disabled={section.order === template.sections.length}
                        className={`p-1.5 rounded transition-colors ${
                          section.order === template.sections.length
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 hover:bg-gray-200'
                        }`}
                        title="Move down"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className={styles.label}>Section Heading</label>
                      <input
                        type="text"
                        value={section.heading}
                        onChange={(e) => updateSection(originalIndex, { heading: e.target.value })}
                        className={styles.input}
                        placeholder="Section Heading:"
                      />
                    </div>

                    <div>
                      <label className={styles.label}>AI Instructions</label>
                      <p className="text-xs text-gray-600 mb-1">
                        Instructions for AI on how to generate content for this section. Type placeholders directly in the text below, for example: {'{{'}location{'}}'}, {'{{'}clientName{'}}'}, {'{{'}duration{'}}'}, etc.
                      </p>
                      <textarea
                        value={section.instructions}
                        onChange={(e) => updateSection(originalIndex, { instructions: e.target.value })}
                        className={`${styles.input} resize-none`}
                        rows={6}
                        placeholder="Describe how AI should generate content for this section. Use placeholders like {{location}}, {{clientName}}, {{duration}}, etc."
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <ToastNotification
        isOpen={notification.isOpen}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

