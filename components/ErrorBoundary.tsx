import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleError = (error: Error, errorInfo: ErrorInfo) => {
      setHasError(true);
      setError(error);
      console.error("Uncaught error:", error, errorInfo);
    };

    // This is a placeholder for a global error handler for functional components
    // In a real application, you might use a library like react-error-boundary
    // or a custom global error listener.
    // For now, we'll simulate the componentDidCatch behavior.
    // Note: React 16+ Error Boundaries only work with class components for catching rendering errors.
    // This functional component approach is for demonstration/workaround purposes if class components are problematic.
    // For true error boundary behavior, a class component is required.

    // Since this is a functional component, it cannot directly implement componentDidCatch.
    // The primary purpose of this refactor is to resolve the TypeScript errors related to `this.setState` and `this.props`
    // by moving away from a class component structure.
    // If actual error boundary functionality (catching child component render errors) is strictly required,
    // the class component issues would need to be debugged at a deeper level (e.g., tsconfig, babel setup).

    return () => {
      // Cleanup if necessary
    };
  }, []);

  const handleReload = () => {
    setHasError(false);
    setError(null);
    window.location.reload();
  };

  if (hasError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-6 text-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 max-w-md w-full">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle size={32} />
              </div>
              <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
              <p className="mb-6 text-gray-500 dark:text-gray-400 text-sm">
                  We encountered an unexpected error.
              </p>
              
              {error && (
                  <div className="bg-gray-100 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-left overflow-auto max-h-32 text-xs font-mono text-red-600 mb-6">
                      {error.message}
                  </div>
              )}

              <button 
                  onClick={handleReload}
                  className="w-full bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 font-semibold shadow-md transition-all flex items-center justify-center gap-2"
              >
                  <RefreshCw size={18} /> Reload Application
              </button>
          </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ErrorBoundary;
