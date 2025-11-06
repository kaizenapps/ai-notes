'use client';

import { useState } from 'react';

export interface SessionCardProps {
  session: {
    id: string;
    client_name?: string;
    user_name?: string;
    clientId: string;
    userId: string;
    date: Date | string;
    duration: number;
    location: string;
    objectives: string[];
    generatedNote: string;
    feedback?: string;
    status: 'draft' | 'completed' | 'archived';
    createdAt: Date | string;
    treatmentPlan?: string;
  };
  onEdit?: (session: SessionCardProps['session']) => void;
  onDelete?: (sessionId: string) => void;
  onExport?: (sessionId: string, format: 'pdf' | 'docx' | 'txt') => void;
  onStatusChange?: (sessionId: string, status: 'draft' | 'completed' | 'archived') => void;
  onRefine?: (session: SessionCardProps['session']) => void;
  showClientName?: boolean;
  showUserName?: boolean;
}

export function SessionCard({
  session,
  onEdit,
  onDelete,
  onExport,
  onStatusChange,
  onRefine,
  showClientName = true,
  showUserName = false
}: SessionCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'archived':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'draft':
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'archived':
        return '🗂️';
      case 'draft':
      default:
        return '📝';
    }
  };

  const formatDate = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {showClientName && (
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {session.client_name || `Client ${session.clientId.slice(0, 8)}...`}
                </h3>
              )}
              <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(session.status)}`}>
                <span>{getStatusIcon(session.status)}</span>
                {session.status === 'completed' ? 'Completed' :
                 session.status === 'archived' ? 'Archived' : 'Draft'}
              </span>
            </div>
            
            {showUserName && session.user_name && (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {session.user_name}
                </span>
              </div>
            )}
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(session.date)}
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {session.duration} min
              </div>
              <div className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {session.location}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 ml-4">
            {onRefine && session.status !== 'archived' && (
              <button
                onClick={() => onRefine(session)}
                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                title="Refine with AI feedback"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </button>
            )}
            
            {onEdit && session.status !== 'archived' && (
              <button
                onClick={() => onEdit(session)}
                className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                title="Edit session"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            )}
            
            {onDelete && session.status !== 'archived' && (
              <button
                onClick={() => onDelete(session.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Archive session"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            {onExport && (
              <div className="relative group">
                <button
                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Export session"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                
                {/* Export Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <button
                    onClick={() => onExport(session.id, 'pdf')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>📄</span>
                    HTML/PDF
                  </button>
                  <button
                    onClick={() => onExport(session.id, 'docx')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>📝</span>
                    Word/RTF
                  </button>
                  <button
                    onClick={() => onExport(session.id, 'txt')}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span>📋</span>
                    Plain Text
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Objectives */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Objectives</h4>
          <div className="flex flex-wrap gap-1">
            {session.objectives.map((objective, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {objective}
              </span>
            ))}
          </div>
        </div>

        {/* Session Notes */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Session Notes</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {isExpanded || session.generatedNote.length <= 200
                ? session.generatedNote
                : `${session.generatedNote.substring(0, 200)}...`}
            </div>
            {session.generatedNote.length > 200 && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {isExpanded ? 'Show less' : 'Read more'}
              </button>
            )}
          </div>
        </div>

        {/* Additional Notes */}
        {session.feedback && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-200">
            <h5 className="text-sm font-medium text-blue-900 mb-1">Additional Notes</h5>
            <div className="text-sm text-blue-800 whitespace-pre-wrap">{session.feedback}</div>
          </div>
        )}

        {/* Quick Actions */}
        {onStatusChange && session.status !== 'archived' && (
          <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-700">Quick Status:</span>
            {session.status !== 'completed' && (
              <button
                onClick={() => onStatusChange(session.id, 'completed')}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full hover:bg-green-200 transition-colors"
              >
                <span>✅</span>
                Mark Complete
              </button>
            )}
            {session.status !== 'draft' && (
              <button
                onClick={() => onStatusChange(session.id, 'draft')}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-full hover:bg-yellow-200 transition-colors"
              >
                <span>📝</span>
                Mark Draft
              </button>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Created: {formatDateTime(session.createdAt)}</span>
            <span>Session ID: {session.id.slice(0, 8)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
}
