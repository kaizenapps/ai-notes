'use client';

import { useState, useEffect, Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { generateSessionNote } from '@/lib/openai';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { styles } from '@/lib/styles';
import { useSearchParams } from 'next/navigation';

function SessionNoteFormContent() {
  const [loading, setLoading] = useState(false);
  const [generatedNote, setGeneratedNote] = useState('');
  const [error, setError] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>([]);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState<SessionTemplate[]>([]);

interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  defaultDuration?: number;
  defaultLocationName?: string;
  templateObjectives: string[];
  templateInterventions: string[];
}
  const { clients, locations, objectives, interventions } = useApp();
  const searchParams = useSearchParams();

  // Pre-select client from URL params
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId && clients.some(client => client.id === clientId)) {
      setSelectedClientId(clientId);
    }
  }, [searchParams, clients]);

  // Load templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const response = await fetch('/api/templates', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setTemplates(result.data);
          }
        }
      } catch (error) {
        console.warn('Failed to load templates:', error);
      }
    };

    loadTemplates();
  }, []);

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        console.log('Applying template:', template);
        console.log('Template objectives:', template.templateObjectives);
        console.log('Template interventions:', template.templateInterventions);
        
        // Pre-fill form with template defaults
        if (template.defaultDuration) {
          setSelectedDuration(template.defaultDuration.toString());
          console.log('Set duration to:', template.defaultDuration);
        }
        if (template.defaultLocationName) {
          setSelectedLocation(template.defaultLocationName);
          console.log('Set location to:', template.defaultLocationName);
        }
        if (template.templateObjectives && template.templateObjectives.length > 0) {
          setSelectedObjectives([...template.templateObjectives]); // Create new array to trigger re-render
          console.log('Set objectives to:', template.templateObjectives);
        }
        if (template.templateInterventions && template.templateInterventions.length > 0) {
          setSelectedInterventions([...template.templateInterventions]); // Create new array to trigger re-render
          console.log('Set interventions to:', template.templateInterventions);
        }
      }
    } else {
      // Clear template selections
      setSelectedDuration('60');
      setSelectedLocation('');
      setSelectedObjectives([]);
      setSelectedInterventions([]);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    
    if (selectedObjectives.length === 0) {
      setError('Please select at least one objective.');
      setLoading(false);
      return;
    }
    
    if (selectedInterventions.length === 0) {
      setError('Please select at least one intervention.');
      setLoading(false);
      return;
    }
    const feedbackValue = (formData.get('feedback') as string || '').trim();
    
    try {
      const sessionData = {
        clientId: selectedClientId,
        location: selectedLocation,
        duration: selectedDuration,
        objectives: selectedObjectives,
        interventions: selectedInterventions,
        feedback: feedbackValue,
      };

      const note = await generateSessionNote(sessionData);
      
      setGeneratedNote(note);
      
      // Save session to database
      try {
        const saveResponse = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            clientId: sessionData.clientId,
            sessionDate: new Date().toISOString().split('T')[0], // Today's date
            duration: parseInt(sessionData.duration),
            locationOther: sessionData.location,
            generatedNote: note,
            customFeedback: sessionData.feedback,
            status: 'completed', // New sessions are completed when generated
            objectives: selectedObjectives.map(obj => ({ custom: obj })),
            interventions: selectedInterventions.map(int => ({ custom: int }))
          })
        });
        
        if (saveResponse.ok) {
          const saveResult = await saveResponse.json();
          if (saveResult.success && saveResult.data) {
            setLastSessionId(saveResult.data.id);
          }
        }
      } catch (saveError) {
        console.warn('Failed to save session to database:', saveError);
        // Continue anyway - the note was generated successfully
      }
    } catch (error) {
      console.error('Error generating note:', error);
      setError('Failed to generate session note. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedNote);
    alert('Note copied to clipboard!');
  };

  const exportSession = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!lastSessionId) {
      alert('Session not saved. Cannot export.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required');
        return;
      }

      const exportUrl = `/api/sessions/${lastSessionId}/export?format=${format}&metadata=true`;
      
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get filename from header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `session-note.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    }
  };
  
  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={`${styles.card} space-y-6`}>
        <h2 className="text-2xl font-bold text-gray-900">Generate Session Note</h2>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Template Selection */}
        {templates.length > 0 && (
          <div>
            <div className="flex justify-between items-center">
              <label className={styles.label}>Session Template (Optional)</label>
              <button
                type="button"
                onClick={() => {
                  // Reload templates
                  const loadTemplates = async () => {
                    try {
                      const token = localStorage.getItem('token');
                      if (!token) return;

                      const response = await fetch('/api/templates', {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });

                      if (response.ok) {
                        const result = await response.json();
                        if (result.success && result.data) {
                          setTemplates(result.data);
                          console.log('Templates reloaded:', result.data.length);
                        }
                      }
                    } catch (error) {
                      console.warn('Failed to reload templates:', error);
                    }
                  };
                  loadTemplates();
                }}
                className="text-xs text-blue-600 hover:underline"
              >
                🔄 Reload Templates
              </button>
            </div>
            <select
              value={selectedTemplate}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className={styles.select}
            >
              <option value="">Choose a template to pre-fill form...</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} {template.defaultDuration && `(${template.defaultDuration} min)`}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                <p className="text-sm text-blue-800 font-medium">
                  ✅ Template Applied: {templates.find(t => t.id === selectedTemplate)?.name}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Duration, location, objectives, and interventions have been pre-filled.
                </p>
              </div>
            )}
          </div>
        )}
        
        {/* Client Selection */}
        <div>
          <label className={styles.label}>Client *</label>
          <select 
            name="clientId" 
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            required
            className={styles.select}
          >
            <option value="">Select client</option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {client.firstName} {client.lastInitial}.
              </option>
            ))}
          </select>
          {clients.length === 0 && (
            <p className="text-sm text-gray-600 mt-1">
              No clients found. Please contact your administrator to add clients.
            </p>
          )}
        </div>
        
        {/* Location Selection */}
        <div>
          <label className={styles.label}>Location *</label>
          <select 
            name="location"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            required
            className={styles.select}
          >
            <option value="">Select location</option>
            {locations.map(location => (
              <option key={location.id} value={location.name}>
                {location.name}
              </option>
            ))}
          </select>
        </div>
        
        {/* Duration */}
        <div>
          <label className={styles.label}>Session Duration (minutes) *</label>
          <select 
            name="duration"
            value={selectedDuration}
            onChange={(e) => setSelectedDuration(e.target.value)}
            required
            className={styles.select}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">60 minutes</option>
            <option value="90">90 minutes</option>
          </select>
        </div>
        
        {/* Multi-select objectives */}
        <div>
          <label className={styles.label}>Goals/Objectives *</label>
          <MultiSelect 
            name="objectives"
            options={objectives.map(o => ({ value: o.name, label: o.name }))}
            placeholder="Search objectives..."
            value={selectedObjectives}
            onChange={setSelectedObjectives}
          />
          {objectives.length === 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Loading objectives... If this persists, contact your administrator.
            </p>
          )}
        </div>
        
        {/* Multi-select interventions */}
        <div>
          <label className={styles.label}>Interventions Used *</label>
          <MultiSelect 
            name="interventions"
            options={interventions.map(i => ({ value: i.name, label: i.name }))}
            placeholder="Search interventions..."
            value={selectedInterventions}
            onChange={setSelectedInterventions}
          />
          {interventions.length === 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Loading interventions... If this persists, contact your administrator.
            </p>
          )}
        </div>
        
        {/* Additional Feedback */}
        <div>
          <label className={styles.label}>Additional Notes (Optional)</label>
          <textarea 
            name="feedback"
            rows={3}
            placeholder="Any additional details about the session..."
            className={`${styles.input} resize-none`}
          />
        </div>
        
        {/* Submit and Reset */}
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={() => {
              setSelectedTemplate('');
              setSelectedClientId('');
              setSelectedLocation('');
              setSelectedDuration('60');
              setSelectedObjectives([]);
              setSelectedInterventions([]);
              setGeneratedNote('');
              setLastSessionId(null);
            }}
            className={styles.button.secondary}
          >
            Reset Form
          </button>
          <button 
            type="submit" 
            disabled={loading}
            className={`flex-1 ${styles.button.primary}`}
          >
            {loading ? 'Generating Note...' : 'Generate Session Note'}
          </button>
        </div>
      </form>
      
      {/* Loading State */}
      {loading && (
        <div className={`${styles.card} mt-6`}>
          <LoadingSpinner />
          <p className="text-center text-gray-600 mt-2">Generating your session note...</p>
        </div>
      )}
      
      {/* Generated Note Display */}
      {generatedNote && !loading && (
        <div className={`${styles.card} mt-6`}>
          <h3 className="text-lg font-bold mb-4">Generated Session Note</h3>
          <div className="bg-gray-50 p-4 rounded border">
            <pre className="whitespace-pre-wrap font-sans text-sm">{generatedNote}</pre>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button 
              onClick={copyToClipboard}
              className={styles.button.success}
            >
              📋 Copy to Clipboard
            </button>
            {lastSessionId && (
              <>
                <button 
                  onClick={() => exportSession('pdf')}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                  title="Download as HTML (can be saved as PDF)"
                >
                  📄 HTML/PDF
                </button>
                <button 
                  onClick={() => exportSession('docx')}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  title="Download as RTF (opens in Word)"
                >
                  📝 Word/RTF
                </button>
                <button 
                  onClick={() => exportSession('txt')}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  title="Download as plain text"
                >
                  📋 Text
                </button>
              </>
            )}
            <button 
              onClick={() => {
                setGeneratedNote('');
                setLastSessionId(null);
              }}
              className={styles.button.secondary}
            >
              Clear Note
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SessionNoteForm() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SessionNoteFormContent />
    </Suspense>
  );
}
