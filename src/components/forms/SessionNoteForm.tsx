'use client';

import { useState, useEffect, Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { generateSessionNote } from '@/lib/openai';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ToastNotification } from '@/components/ui/Notification';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiPost } from '@/lib/api';
import { styles } from '@/lib/styles';
import { useSearchParams } from 'next/navigation';

function SessionNoteFormContent() {
  const [loading, setLoading] = useState(false);
  const [generatedNote, setGeneratedNote] = useState('');
  const [error, setError] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [objectivesAutoPopulated, setObjectivesAutoPopulated] = useState(false);
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [treatmentPlanText, setTreatmentPlanText] = useState('');
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });
  // Intervention management state
  const [localInterventions, setLocalInterventions] = useState<string[]>([]);
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
  const { clients, locations, objectives, setClients } = useApp();
  const searchParams = useSearchParams();

  // Pre-select client from URL params
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId && clients.some(client => client.id === clientId)) {
      setSelectedClientId(clientId);
    }
  }, [searchParams, clients]);

  // Auto-populate objectives and treatment plan when client is selected
  useEffect(() => {
    if (selectedClientId) {
      const selectedClient = clients.find(client => client.id === selectedClientId);
      if (selectedClient) {
        // Auto-populate objectives (only if objectives are loaded)
        if (selectedClient.objectivesSelected && selectedClient.objectivesSelected.length > 0 && objectives.length > 0) {
          // Convert objective IDs to names for the form
          const objectiveNames = selectedClient.objectivesSelected
            .map(objId => {
              const objective = objectives.find(obj => obj.id === objId);
              return objective?.name;
            })
            .filter(Boolean) as string[];
          
          if (objectiveNames.length > 0) {
            setSelectedObjectives(objectiveNames);
            setObjectivesAutoPopulated(true);
          } else {
            // Client has objectives but none matched - clear selection
            setSelectedObjectives([]);
            setObjectivesAutoPopulated(false);
          }
        } else {
          // No objectives selected for this client or objectives not loaded yet
          setSelectedObjectives([]);
          setObjectivesAutoPopulated(false);
        }
        
        // Auto-populate treatment plan
        setTreatmentPlanText(selectedClient.treatmentPlan || '');
        // Auto-populate interventions (local state for editing)
        setLocalInterventions(selectedClient.extractedInterventions || []);
      }
    } else {
      setSelectedObjectives([]);
      setObjectivesAutoPopulated(false);
      setTreatmentPlanText('');
      setLocalInterventions([]);
    }
  }, [selectedClientId, clients, objectives]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    
    // Read all required fields from form to ensure we get current values, not stale state
    const clientIdValue = (formData.get('clientId') as string || '').trim();
    const locationValue = (formData.get('location') as string || '').trim();
    const durationValue = (formData.get('duration') as string || '').trim();
    const feedbackValue = (formData.get('feedback') as string || '').trim();
    
    // Validate all required fields
    if (!clientIdValue) {
      setError('Please select a client.');
      setLoading(false);
      return;
    }
    
    if (!locationValue) {
      setError('Please select a location.');
      setLoading(false);
      return;
    }
    
    if (!durationValue || isNaN(parseInt(durationValue)) || parseInt(durationValue) <= 0) {
      setError('Please select a valid session duration.');
      setLoading(false);
      return;
    }
    
    if (selectedObjectives.length === 0) {
      setError('Please select at least one objective.');
      setLoading(false);
      return;
    }
    
    console.log('Form submission data:', {
      clientId: clientIdValue,
      location: locationValue,
      duration: durationValue,
      objectives: selectedObjectives,
      hasTreatmentPlan: !!treatmentPlanText.trim()
    });
    
    try {
      // Get client treatment plan for intervention extraction
      const selectedClient = clients.find(c => c.id === clientIdValue);
      if (!selectedClient) {
        setError('Selected client not found. Please refresh and try again.');
        setLoading(false);
        return;
      }
      
      // Save/update treatment plan and interventions to client if they were modified
      const needsUpdate = 
        treatmentPlanText.trim() !== (selectedClient.treatmentPlan || '') ||
        JSON.stringify(localInterventions) !== JSON.stringify(selectedClient.extractedInterventions || []);
      
      if (needsUpdate) {
        try {
          const updateResponse = await fetch(`/api/clients/${clientIdValue}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              treatmentPlan: treatmentPlanText.trim(),
              extractedInterventions: localInterventions
            })
          });
          
          if (updateResponse.ok) {
            console.log('Treatment plan and interventions updated for client');
            // Refresh clients list to get updated data
            try {
              const clientsResponse = await fetch('/api/clients', {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              });
              if (clientsResponse.ok) {
                const clientsResult = await clientsResponse.json();
                if (clientsResult.success && clientsResult.data) {
                  setClients(clientsResult.data);
                }
              }
            } catch (refreshError) {
              console.warn('Failed to refresh clients:', refreshError);
            }
          }
        } catch (updateError) {
          console.warn('Failed to update client data:', updateError);
          // Continue anyway - session note generation shouldn't fail
        }
      }

      // Format client name: "FirstName LastInitial."
      const clientName = `${selectedClient.firstName} ${selectedClient.lastInitial}.`;

      const sessionData = {
        clientId: clientIdValue, // Use value from form, not state
        clientName: clientName, // Format: "FirstName LastInitial." (e.g., "Dark T.")
        location: locationValue, // Use value from form, not state
        duration: durationValue, // Use value from form, not state
        objectives: selectedObjectives, // MultiSelect uses controlled state (correct)
        feedback: feedbackValue, // Use value from form, not state
        treatmentPlan: treatmentPlanText.trim(), // Textarea uses controlled state (correct)
        interventions: localInterventions, // Use local interventions state (can be edited)
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
    setNotification({
      isOpen: true,
      message: 'Note copied to clipboard!',
      type: 'success'
    });
  };

  // Intervention extraction and management handlers
  const handleExtractInterventions = async () => {
    if (!treatmentPlanText.trim()) {
      setExtractionError('Please enter a treatment plan before extracting interventions');
      return;
    }

    // If interventions already exist, show warning
    if (localInterventions.length > 0) {
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
        treatmentPlan: treatmentPlanText,
        objectives: selectedObjectives
      });

      if (response.success && response.interventions) {
        setLocalInterventions(response.interventions);
        setNotification({
          isOpen: true,
          message: `Successfully extracted ${response.interventions.length} interventions`,
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
    setLocalInterventions(prev => [...prev, newIntervention]);
    // Start editing the new intervention immediately
    setEditingInterventionIndex(localInterventions.length);
    setEditingInterventionText(newIntervention);
  };

  const handleDeleteIntervention = (index: number) => {
    setLocalInterventions(prev => prev.filter((_, i) => i !== index));
  };

  const handleStartEditIntervention = (index: number) => {
    setEditingInterventionIndex(index);
    setEditingInterventionText(localInterventions[index]);
  };

  const handleSaveEditIntervention = () => {
    if (editingInterventionIndex !== null) {
      setLocalInterventions(prev =>
        prev.map((int, i) => i === editingInterventionIndex ? editingInterventionText : int)
      );
      setEditingInterventionIndex(null);
      setEditingInterventionText('');
    }
  };

  const handleCancelEditIntervention = () => {
    setEditingInterventionIndex(null);
    setEditingInterventionText('');
  };

  const exportSession = async (format: 'pdf' | 'docx' | 'txt') => {
    if (!lastSessionId) {
      setNotification({
        isOpen: true,
        message: 'Session not saved. Cannot export.',
        type: 'error'
      });
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setNotification({
          isOpen: true,
          message: 'Authentication required',
          type: 'error'
        });
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
        setNotification({
          isOpen: true,
          message: 'Export failed. Please try again.',
          type: 'error'
        });
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
            {[30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180].map(minutes => (
              <option key={minutes} value={minutes.toString()}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </div>
        
        {/* Multi-select objectives */}
        <div>
          <label className={styles.label}>Goals/Objectives *</label>
          {objectivesAutoPopulated && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
              <p className="text-xs text-blue-800">
                ✅ Objectives auto-populated from client profile. You can adjust as needed.
              </p>
            </div>
          )}
          <MultiSelect 
            name="objectives"
            options={objectives.map(o => ({ value: o.name, label: o.name }))}
            placeholder="Search objectives..."
            value={selectedObjectives}
            onChange={(selected) => {
              setSelectedObjectives(selected);
              setObjectivesAutoPopulated(false); // User manually changed, no longer auto-populated
            }}
          />
          {objectives.length === 0 && (
            <p className="text-sm text-gray-600 mt-1">
              Loading objectives... If this persists, contact your administrator.
            </p>
          )}
        </div>
        
        {/* Treatment Plan */}
        <div>
          <label className={styles.label}>Treatment Plan</label>
          <p className="text-xs text-gray-600 mb-2">
            Treatment plan is auto-populated from client profile. You can edit it here and changes will be saved to the client profile when you generate the note.
          </p>
          <textarea 
            name="treatmentPlan"
            value={treatmentPlanText}
            onChange={(e) => setTreatmentPlanText(e.target.value)}
            className={`${styles.input} resize-none`}
            rows={8}
            placeholder="Treatment plan will appear here when client is selected. Edit to update client profile."
          />
          {treatmentPlanText && (
            <p className="text-xs text-blue-600 mt-1">
              💡 Changes will be saved to client profile when you generate the note.
            </p>
          )}
        </div>

        {/* Interventions Section - Editable */}
        {selectedClientId && (
          <div className="border-t border-gray-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className={styles.label}>Peer Support Interventions</label>
                <p className="text-xs text-gray-600 mt-1">
                  AI-extracted interventions from treatment plan. These will be included in session notes.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExtractInterventions}
                disabled={extractingInterventions || !treatmentPlanText.trim()}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ${
                  extractingInterventions || !treatmentPlanText.trim()
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

            {localInterventions.length > 0 ? (
              <div className="space-y-2">
                {localInterventions.map((intervention, index) => (
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
                  {treatmentPlanText.trim() 
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
        )}
        
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
              setSelectedClientId('');
              setSelectedLocation('');
              setSelectedDuration('60');
              setSelectedObjectives([]);
              setTreatmentPlanText('');
              setGeneratedNote('');
              setLastSessionId(null);
              setObjectivesAutoPopulated(false);
              setLocalInterventions([]);
              setExtractionError('');
              setEditingInterventionIndex(null);
              setEditingInterventionText('');
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
      
      {/* Notification */}
      <ToastNotification
        isOpen={notification.isOpen}
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification(prev => ({ ...prev, isOpen: false }))}
      />
      
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Yes, Replace"
        cancelText="Cancel"
        confirmVariant="primary"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
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
