import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  // When this value changes, a tripped boundary auto-recovers. MainLayout passes
  // the route path so navigating away from a crashed page clears the error —
  // a clinician mid-session is never stranded on the panel.
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey: unknown;
}

// Real React error boundary. MUST be a class component: getDerivedStateFromError /
// componentDidCatch are class-only lifecycles, so a functional component physically
// cannot catch render errors. The previous functional version never caught anything —
// any render throw propagated to the root and unmounted the whole app into a SILENT
// blank screen. Now an uncaught render throw renders the card below.
//
// Two recovery paths so a crash never costs the whole session:
//   • "Try again" re-renders the subtree in place (no reload) — recovers from a
//     transient render throw without losing app/auth/Clara state.
//   • A changing `resetKey` (route path, via MainLayout) auto-clears the error on
//     navigation, so the panel never persists after the user moves on.
// "Reload" remains as the last resort.
class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  // Auto-recover when the reset key changes (e.g. the route changed). Keeps the
  // tracked key in sync even when no error is showing.
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return state.hasError
        ? { hasError: false, error: null, resetKey: props.resetKey }
        : { resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] py-12 text-gray-800 dark:text-gray-200 p-6 text-center">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 max-w-md w-full">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={32} />
                </div>
                <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
                <p className="mb-6 text-gray-500 dark:text-gray-400 text-sm">
                    This part of the app hit an unexpected error. Your work elsewhere is safe — try again, or head to another page.
                </p>

                {this.state.error && (
                    <div className="bg-gray-100 dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-left overflow-auto max-h-32 text-xs font-mono text-red-600 mb-6">
                        {this.state.error.message}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={this.handleTryAgain}
                        className="flex-1 bg-primary text-white py-3 rounded-xl hover:bg-primary-focus font-semibold shadow-md transition-all flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={18} /> Try Again
                    </button>
                    <button
                        onClick={this.handleReload}
                        className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-all flex items-center justify-center gap-2"
                    >
                        <RefreshCw size={18} /> Reload
                    </button>
                </div>
            </div>
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

export default ErrorBoundary;
