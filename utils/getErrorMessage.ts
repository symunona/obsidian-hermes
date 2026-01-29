/**
 * Safely extracts an error message from an unknown error type.
 * TypeScript's catch clause types errors as `unknown`, so we need
 * to handle various error formats gracefully.
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    // Try common error-like properties
    if ('message' in error && typeof error.message === 'string') return error.message;
    if ('error' in error && typeof error.error === 'string') return error.error;
    // Fallback to JSON for objects
    try {
      return JSON.stringify(error);
    } catch {
      return '[object Object]';
    }
  }
  return String(error);
};
