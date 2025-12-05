'use client';

import { useEffect, useState, Suspense } from 'react';
import { useApp } from '@/context/AppContext';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SessionCard } from '@/components/ui/SessionCard';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastNotification } from '@/components/ui/Notification';
import { styles } from '@/lib/styles';
import { SessionNote } from '@/types';
import { apiGet } from '@/lib/api';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface SessionHistoryItem extends Omit<SessionNote, 'date' | 'createdAt'> {
  client_name?: string;
  user_name?: string;
  status: 'draft' | 'completed' | 'archived';
  date: Date | string;
  createdAt: Date | string;
  treatmentPlan?: string;
  selectedInterventions?: string[];
}

function HistoryPageContent() {
  const { user, setUser, clients, locations } = useApp();
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [viewAllSessions, setViewAllSessions] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSession, setEditingSession] = useState<SessionHistoryItem | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState({
    sessionDate: '',
    duration: '',
    location: '',
    generatedNote: '',
    feedback: '',
    status: 'draft' as 'draft' | 'completed' | 'archived'
  });
  const [editFormLoading, setEditFormLoading] = useState(false);
  const [editFormError, setEditFormError] = useState('');
  const [refiningSession, setRefiningSession] = useState<SessionHistoryItem | null>(null);
  const [showRefineModal, setShowRefineModal] = useState(false);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [refineLoading, setRefineLoading] = useState(false);
  const [refineError, setRefineError] = useState('');
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
  const searchParams = useSearchParams();
  
  useSessionTimeout();
  
  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Set client filter from URL params
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId) {
      setSelectedClientId(clientId);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        // Check for existing token
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '/';
          return;
        }

        if (!user) {
          // Try to restore user from localStorage
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
            } catch (parseError) {
              console.error('Error parsing stored user:', parseError);
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/';
              return;
            }
          } else {
            // No stored user, redirect to login
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
          }
        }

        // Load sessions from database
        try {
          const clientParam = selectedClientId ? `&clientId=${selectedClientId}` : '';
          const statusParam = selectedStatus ? `&status=${selectedStatus}` : '';
          const viewAllParam = viewAllSessions && user?.role === 'admin' ? '&viewAll=true' : '';
          const response = await apiGet<{ success: boolean; data: SessionHistoryItem[] }>(`/sessions?limit=20&offset=${page * 20}${clientParam}${statusParam}${viewAllParam}`);
          if (response.success && response.data) {
            if (page === 0) {
              setSessions(response.data);
            } else {
              setSessions(prev => [...prev, ...response.data]);
            }
            setHasMore(response.data.length === 20);
          } else {
            if (page === 0) {
              setSessions([]);
            }
            setHasMore(false);
          }
        } catch (apiError) {
          console.warn('Database not available:', apiError);
          if (page === 0) {
            // Show demo data when database is not available
            const demoSessions: SessionHistoryItem[] = [
              {
                id: '1',
                clientId: '1',
                userId: '1',
                date: new Date(Date.now() - 86400000), // Yesterday
                duration: 60,
                location: 'Telehealth',
                generatedNote: 'Client engaged well in today\'s session. We focused on developing coping strategies for managing anxiety in daily situations.',
                createdAt: new Date(Date.now() - 86400000),
                client_name: 'John D.',
                status: 'completed'
              },
              {
                id: '2',
                clientId: '2',
                userId: '1',
                date: new Date(Date.now() - 172800000), // 2 days ago
                duration: 45,
                location: 'Office',
                generatedNote: 'Session focused on building client\'s confidence and improving communication patterns with family members.',
                createdAt: new Date(Date.now() - 172800000),
                client_name: 'Jane S.',
                status: 'draft'
              }
            ];
            setSessions(demoSessions);
          }
          setHasMore(false);
        }
      } catch (error) {
        console.error('Error loading history:', error);
        setError('Failed to load session history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [user, setUser, page, selectedClientId, selectedStatus, viewAllSessions]);

  // Reset page when filters change
  useEffect(() => {
    if (page > 0) {
      setPage(0);
    }
  }, [selectedClientId, selectedStatus, viewAllSessions, page]);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  const exportSession = async (sessionId: string, format: 'pdf' | 'docx' | 'txt' = 'pdf') => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required');
        return;
      }

      // Create a direct download link
      const exportUrl = `/api/sessions/${sessionId}/export?format=${format}&metadata=true`;
      
      // Create a temporary link element and trigger download
      const link = document.createElement('a');
      link.href = exportUrl;
      link.style.display = 'none';
      
      // Add authorization header by creating a fetch request and converting to blob
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export failed: ${errorText}`);
      }

      // Get the filename from the Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `session-note-${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const openEditForm = (session: SessionHistoryItem) => {
    setEditingSession(session);
    setEditFormData({
      sessionDate: (typeof session.date === 'string' ? new Date(session.date) : session.date).toISOString().split('T')[0],
      duration: session.duration.toString(),
      location: session.location,
      generatedNote: session.generatedNote,
      feedback: session.feedback || '',
      status: session.status || 'draft'
    });
    setEditFormError('');
    setShowEditForm(true);
  };

  const closeEditForm = () => {
    setShowEditForm(false);
    setEditingSession(null);
    setEditFormData({
      sessionDate: '',
      duration: '',
      location: '',
      generatedNote: '',
      feedback: '',
      status: 'draft'
    });
    setEditFormError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;

    setEditFormLoading(true);
    setEditFormError('');

    try {
      const response = await fetch(`/api/sessions/${editingSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          sessionDate: editFormData.sessionDate,
          duration: parseInt(editFormData.duration),
          locationOther: editFormData.location,
          generatedNote: editFormData.generatedNote,
          customFeedback: editFormData.feedback,
          status: editFormData.status
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Update session in list
          setSessions(prev => prev.map(session => 
            session.id === editingSession.id ? { ...session, ...result.data } : session
          ));
          closeEditForm();
        } else {
          setEditFormError('Failed to update session');
        }
      } else {
        const result = await response.json();
        setEditFormError(result.error || 'Failed to update session');
      }
    } catch (error) {
      console.error('Error updating session:', error);
      setEditFormError('Failed to update session. Please try again.');
    } finally {
      setEditFormLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Archive Session',
      message: 'Are you sure you want to archive this session? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
          const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success) {
              // Remove session from list
              setSessions(prev => prev.filter(session => session.id !== sessionId));
              setNotification({
                isOpen: true,
                message: 'Session archived successfully',
                type: 'success'
              });
            } else {
              setNotification({
                isOpen: true,
                message: 'Failed to archive session',
                type: 'error'
              });
            }
          } else {
            const result = await response.json();
            setNotification({
              isOpen: true,
              message: result.error || 'Failed to archive session',
              type: 'error'
            });
          }
        } catch (error) {
          console.error('Error archiving session:', error);
          setNotification({
            isOpen: true,
            message: 'Failed to archive session. Please try again.',
            type: 'error'
          });
        }
      }
    });
  };

  const handleQuickStatusChange = async (sessionId: string, newStatus: 'draft' | 'completed' | 'archived') => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Update session in list
          setSessions(prev => prev.map(session => 
            session.id === sessionId ? { ...session, status: newStatus } : session
          ));
        } else {
          alert('Failed to update status');
        }
      } else {
        const result = await response.json();
        setNotification({
          isOpen: true,
          message: result.error || 'Failed to update status',
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      setNotification({
        isOpen: true,
        message: 'Failed to update status. Please try again.',
        type: 'error'
      });
    }
  };

  const openRefineModal = (session: SessionHistoryItem) => {
    setRefiningSession(session);
    setRefineFeedback('');
    setRefineError('');
    setShowRefineModal(true);
  };

  const closeRefineModal = () => {
    setShowRefineModal(false);
    setRefiningSession(null);
    setRefineFeedback('');
    setRefineError('');
  };

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refiningSession) return;

    if (!refineFeedback.trim()) {
      setRefineError('Please provide feedback for refinement');
      return;
    }

    setRefineLoading(true);
    setRefineError('');

    try {
      // Call OpenAI refinement API
      const openaiResponse = await fetch('/api/openai/refine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentNote: refiningSession.generatedNote,
          refinementFeedback: refineFeedback,
          clientName: refiningSession.client_name,
          location: refiningSession.location,
          duration: refiningSession.duration,
          treatmentPlan: refiningSession.treatmentPlan,
          selectedInterventions: refiningSession.selectedInterventions || []
        })
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json();
        throw new Error(errorData.error || 'Failed to refine note with AI');
      }

      const openaiResult = await openaiResponse.json();
      const refinedNote = openaiResult.note;

      // Update session with refined note
      const updateResponse = await fetch(`/api/sessions/${refiningSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          generatedNote: refinedNote
        })
      });

      if (updateResponse.ok) {
        const result = await updateResponse.json();
        if (result.success && result.data) {
          // Update session in list
          setSessions(prev => prev.map(session => 
            session.id === refiningSession.id ? { ...session, generatedNote: refinedNote } : session
          ));
          
          setNotification({
            isOpen: true,
            message: 'Session note refined successfully!',
            type: 'success'
          });
          
          closeRefineModal();
        } else {
          setRefineError('Failed to update session with refined note');
        }
      } else {
        const result = await updateResponse.json();
        setRefineError(result.error || 'Failed to update session');
      }
    } catch (error) {
      console.error('Error refining session:', error);
      setRefineError(error instanceof Error ? error.message : 'Failed to refine session. Please try again.');
    } finally {
      setRefineLoading(false);
    }
  };
  
  if (loading && page === 0) {
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
          <button
            onClick={() => window.location.reload()}
            className={styles.button.primary}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (!user) {
    window.location.href = '/';
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className={`${styles.container} flex justify-between items-center py-4`}>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Session History</h1>
            <p className="text-sm text-gray-600">View and export your previous session notes</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className={styles.button.secondary}
            >
              Dashboard
            </Link>
            {user?.role === 'admin' && (
              <Link
                href="/dashboard/admin"
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                Admin Dashboard
              </Link>
            )}
            <button
              onClick={handleLogout}
              className={styles.button.secondary}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="py-8">
        <div className={styles.container}>
          {/* Search and Filters */}
          <div className="mb-6">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative max-w-md">
                <input
                  type="text"
                  placeholder="Search sessions by client name or notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div>
                <label className={styles.label}>Filter by Client</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className={styles.select + ' w-64'}
                >
                  <option value="">All Clients</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.firstName} {client.lastInitial}.
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={styles.label}>Filter by Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className={styles.select + ' w-48'}
                >
                  <option value="">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              {user?.role === 'admin' && (
                <div>
                  <label className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      checked={viewAllSessions}
                      onChange={(e) => setViewAllSessions(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">View All Users&apos; Sessions (Admin)</span>
                  </label>
                </div>
              )}
              {(selectedClientId || selectedStatus || viewAllSessions || searchTerm) && (
                <button
                  onClick={() => {
                    setSelectedClientId('');
                    setSelectedStatus('');
                    setViewAllSessions(false);
                    setSearchTerm('');
                  }}
                  className="text-sm text-gray-600 hover:text-gray-800 underline mt-6"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className={`${styles.card} text-center py-12`}>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">No Sessions Yet</h2>
              <p className="text-gray-600 mb-6">You haven&apos;t created any session notes yet.</p>
              <Link
                href="/dashboard"
                className={styles.button.primary}
              >
                Create Your First Session
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {sessions
                .filter(session => {
                  if (!searchTerm) return true;
                  const searchLower = searchTerm.toLowerCase();
                  return (
                    session.client_name?.toLowerCase().includes(searchLower) ||
                    session.generatedNote.toLowerCase().includes(searchLower) ||
                    session.feedback?.toLowerCase().includes(searchLower)
                  );
                })
                .map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onEdit={openEditForm}
                    onDelete={handleDeleteSession}
                    onExport={exportSession}
                    onStatusChange={handleQuickStatusChange}
                    onRefine={openRefineModal}
                    showClientName={true}
                    showUserName={user?.role === 'admin' && viewAllSessions}
                  />
                ))}
              
              {hasMore && (
                <div className="text-center py-6">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className={styles.button.secondary}
                  >
                    {loading ? 'Loading...' : 'Load More Sessions'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      
      {/* Refine with AI Modal */}
      {showRefineModal && refiningSession && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeRefineModal}>
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Refine Session Note with AI
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {refiningSession.client_name} • {formatDate(refiningSession.date)}
                  </p>
                </div>
                <button
                  onClick={closeRefineModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded hover:bg-gray-100"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleRefineSubmit} className="space-y-4">
                {refineError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {refineError}
                  </div>
                )}

                {/* Current Note Display */}
                <div>
                  <label className={styles.label}>Current Session Note</label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-80 overflow-y-auto">
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {refiningSession.generatedNote}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    This is your current note. Provide feedback below to have AI refine it.
                  </p>
                </div>

                {/* Refinement Feedback */}
                <div>
                  <label className={styles.label}>
                    What would you like to change? *
                  </label>
                  <textarea
                    value={refineFeedback}
                    onChange={(e) => setRefineFeedback(e.target.value)}
                    className={`${styles.input} resize-none`}
                    rows={6}
                    required
                    placeholder="Example: 'Add more detail about the client's anxiety coping strategies' or 'Make the activities section more specific with time breakdowns' or 'Emphasize the client's progress in building self-esteem'"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Be specific about what you want to add, change, or improve in the note.
                  </p>
                </div>

                {/* Session Context Display */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-2">Session Context</h4>
                  <div className="text-xs text-blue-800 space-y-1">
                    <p><strong>Current Session Note:</strong> Included above (full text)</p>
                    <p><strong>Client:</strong> {refiningSession.client_name}</p>
                    <p><strong>Duration:</strong> {refiningSession.duration} minutes</p>
                    <p><strong>Location:</strong> {refiningSession.location}</p>
                    {refiningSession.treatmentPlan && refiningSession.treatmentPlan.trim() && (
                      <p><strong>Treatment Plan for This Session:</strong> {refiningSession.treatmentPlan.substring(0, 100)}{refiningSession.treatmentPlan.length > 100 ? '...' : ''}</p>
                    )}
                    {refiningSession.selectedInterventions && refiningSession.selectedInterventions.length > 0 && (
                      <p><strong>Selected Interventions:</strong> {refiningSession.selectedInterventions.join(', ')}</p>
                    )}
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    AI will use the current session note above, this context (including selected interventions and treatment plan), and your feedback to refine the note.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeRefineModal}
                    className={`flex-1 ${styles.button.secondary}`}
                    disabled={refineLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={refineLoading}
                    className={`flex-1 ${styles.button.primary} flex items-center justify-center gap-2`}
                  >
                    {refineLoading ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Refining with AI...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        Refine with AI
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {showEditForm && editingSession && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={closeEditForm}>
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Edit Session - {editingSession.client_name}
                </h3>
                <button
                  onClick={closeEditForm}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded hover:bg-gray-100"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4">
                {editFormError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {editFormError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={styles.label}>Session Date *</label>
                    <input
                      type="date"
                      value={editFormData.sessionDate}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, sessionDate: e.target.value }))}
                      className={styles.input}
                      required
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Duration (minutes) *</label>
                    <select
                      value={editFormData.duration}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, duration: e.target.value }))}
                      className={styles.select}
                      required
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes</option>
                      <option value="90">90 minutes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={styles.label}>Location *</label>
                    <select
                      value={editFormData.location}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, location: e.target.value }))}
                      className={styles.select}
                      required
                    >
                      <option value="">Select location</option>
                      {locations.map(location => (
                        <option key={location.id} value={location.name}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className={styles.label}>Status</label>
                    <select
                      value={editFormData.status}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value as 'draft' | 'completed' | 'archived' }))}
                      className={styles.select}
                    >
                      <option value="draft">Draft</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={styles.label}>Session Notes *</label>
                  <textarea
                    value={editFormData.generatedNote}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, generatedNote: e.target.value }))}
                    className={`${styles.input} resize-none`}
                    rows={8}
                    required
                  />
                </div>

                <div>
                  <label className={styles.label}>Additional Notes</label>
                  <textarea
                    value={editFormData.feedback}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, feedback: e.target.value }))}
                    className={`${styles.input} resize-none`}
                    rows={3}
                    placeholder="Any additional feedback or notes..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeEditForm}
                    className={`flex-1 ${styles.button.secondary}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editFormLoading}
                    className={`flex-1 ${styles.button.primary}`}
                  >
                    {editFormLoading ? 'Updating...' : 'Update Session'}
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
          <p>HIPAA Compliant • Session timeout: 15 minutes</p>
        </div>
      </footer>
      
      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Archive"
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

export default function HistoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <HistoryPageContent />
    </Suspense>
  );
}
