'use client';

import { useState, useEffect, Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { generateSessionNote } from '@/lib/openai';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ToastNotification } from '@/components/ui/Notification';
import { styles } from '@/lib/styles';
import { useSearchParams } from 'next/navigation';
import { extractInterventionText } from '@/lib/treatmentPlanParser';

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
        // Auto-populate objectives
        if (selectedClient.objectivesSelected && selectedClient.objectivesSelected.length > 0) {
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
          }
        } else {
          setObjectivesAutoPopulated(false);
        }
        
        // Auto-populate treatment plan
        setTreatmentPlanText(selectedClient.treatmentPlan || '');
      }
    } else {
      setObjectivesAutoPopulated(false);
      setTreatmentPlanText('');
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
      
      // Save/update treatment plan to client if it was modified
      if (treatmentPlanText.trim() !== (selectedClient.treatmentPlan || '')) {
        try {
          const updateResponse = await fetch(`/api/clients/${clientIdValue}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              treatmentPlan: treatmentPlanText.trim()
            })
          });
          
          if (updateResponse.ok) {
            console.log('Treatment plan updated for client');
            // Refresh clients list to get updated treatment plan
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
          console.warn('Failed to update treatment plan:', updateError);
          // Continue anyway - session note generation shouldn't fail
        }
      }
      
      // Note: Interventions are now auto-extracted from treatment plan by OpenAI
      // No need to pre-extract them here - OpenAI will use the treatment plan directly

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
