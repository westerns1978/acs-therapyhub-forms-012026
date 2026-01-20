
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary class component to catch rendering errors in its children.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  /**
   * Static lifecycle method to update state when an error occurs.
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * Lifecycle method to perform logging or side effects on error.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  /**
   * Resets the error state and reloads the application.
   */
  public handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  public render() {
    if (this.state.hasError) {
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
                
                {this.state.error && (
                    <div className="bg-gray-100 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-left overflow-auto max-h-32 text-xs font-mono text-red-600 mb-6">
                        {this.state.error.message}
                    </div>
                )}

                <button 
                    onClick={this.handleReload}
                    className="w-full bg-red-600 text-white py-3 rounded-xl hover:bg-red-700 font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                >
                    <RefreshCw size={18} /> Reload Application
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
