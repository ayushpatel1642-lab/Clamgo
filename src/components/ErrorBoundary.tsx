import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Serene Focus Uncaught Error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F5F2] p-6 text-[#1A1C19]">
          <div className="max-w-md w-full bg-[#FBFDF8] p-8 rounded-[32px] shadow-sm border border-[#E0E3DB] text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6 text-red-600">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-[#191C19] mb-2">Something went sideways</h1>
            <p className="text-[#424940] mb-6 text-sm">
              We encountered an unexpected glitch while loading your space.
            </p>
            {this.state.error?.message && (
              <div className="bg-[#F4F5F2] p-3 rounded-xl text-xs text-[#424940] font-mono mb-6 text-left break-words overflow-auto max-h-32 border border-[#E0E3DB]">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReload}
              className="w-full py-3.5 bg-[#3A693A] text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-[#2F552F] transition-colors shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
