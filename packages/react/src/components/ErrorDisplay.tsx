/**
 * OpenRouter Auto - Error Display
 * Display errors with helpful tips and retry options
 */

import React from 'react';
import { useOpenRouter } from '../context';
import { OpenRouterError, isRetryableError } from '@openrouter-auto/core';

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px',
    backgroundColor: '#fff5f5',
    borderRadius: '8px',
    border: '1px solid #feb2b2',
    marginBottom: '16px',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  icon: {
    flexShrink: 0,
    width: '20px',
    height: '20px',
    color: '#e53e3e',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#c53030',
    margin: '0 0 8px 0',
  },
  message: {
    fontSize: '13px',
    color: '#742a2a',
    lineHeight: 1.5,
    margin: '0 0 12px 0',
  },
  tip: {
    fontSize: '12px',
    color: '#9b2c2c',
    backgroundColor: '#fed7d7',
    padding: '8px 12px',
    borderRadius: '6px',
    marginTop: '8px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
  },
  retryButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: '#e53e3e',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  dismissButton: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 500,
    backgroundColor: 'transparent',
    color: '#742a2a',
    border: '1px solid #feb2b2',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '11px',
    backgroundColor: '#fed7d7',
    padding: '2px 6px',
    borderRadius: '4px',
    marginTop: '8px',
    display: 'inline-block',
  },
};

// Error tips
const ERROR_TIPS: Record<string, string> = {
  INVALID_API_KEY: 'Double-check your OpenRouter API key. You can find it at https://openrouter.ai/keys',
  RATE_LIMITED: 'Wait a few seconds before retrying, or consider upgrading your plan.',
  MODEL_NOT_FOUND: 'The model may have been removed. Try refreshing the model list.',
  INVALID_PARAMETERS: 'Check that your parameters are within the supported range for this model.',
  INSUFFICIENT_CREDITS: 'Visit https://openrouter.ai/credits to add more credits to your account.',
  PROVIDER_ERROR: 'The model provider is experiencing issues. Try a different model or wait.',
  NETWORK_ERROR: 'Check your internet connection and try again.',
  TIMEOUT: 'The request timed out. Try again or use a different model.',
  UNKNOWN: 'An unexpected error occurred. Please try again.',
};

// Props interface
interface ErrorDisplayProps {
  error?: OpenRouterError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  showCode?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

// Error icon
function ErrorIcon({ style }: { style?: React.CSSProperties }) {
  return (
    <svg
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function ErrorDisplay({
  error,
  onRetry,
  onDismiss,
  showCode = false,
  style = {},
  className = '',
}: ErrorDisplayProps) {
  const { error: contextError } = useOpenRouter();
  const displayError = error || contextError;

  if (!displayError) {
    return null;
  }

  const tip = ERROR_TIPS[displayError.code] || ERROR_TIPS.UNKNOWN;
  const canRetry = isRetryableError(displayError);

  return (
    <div style={{ ...styles.container, ...style }} className={className}>
      <div style={styles.header}>
        <ErrorIcon style={styles.icon} />
        <div style={styles.content}>
          <h4 style={styles.title}>
            Error: {displayError.code}
          </h4>
          <p style={styles.message}>{displayError.message}</p>
          
          <div style={styles.tip}>
            <strong>Tip:</strong> {tip}
          </div>

          {showCode && displayError.details && (
            <code style={styles.code}>
              {JSON.stringify(displayError.details, null, 2).slice(0, 200)}
              {JSON.stringify(displayError.details).length > 200 ? '...' : ''}
            </code>
          )}

          <div style={styles.actions}>
            {canRetry && onRetry && (
              <button onClick={onRetry} style={styles.retryButton}>
                Retry
              </button>
            )}
            {onDismiss && (
              <button onClick={onDismiss} style={styles.dismissButton}>
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook to use error display
export function useErrorDisplay() {
  const { error, fetchModels } = useOpenRouter();
  const [dismissed, setDismissed] = React.useState(false);

  const handleRetry = React.useCallback(() => {
    setDismissed(false);
    fetchModels();
  }, [fetchModels]);

  const handleDismiss = React.useCallback(() => {
    setDismissed(true);
  }, []);

  return {
    error: dismissed ? null : error,
    handleRetry,
    handleDismiss,
  };
}
