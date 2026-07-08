import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown): void {
    console.error('[ErrorBoundary]', error, info);
  }

  render(): ReactNode {
    if (this.state.error === null) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#FEE2E2] flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-[#EF4444]" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold text-[#0B1220] mb-2">Something went wrong</h1>
          <p className="text-sm text-[#6B7280] mb-6">An unexpected error occurred. Try refreshing the page or returning home.</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" className="border-[#E5E7EB]" onClick={() => location.reload()}>Refresh</Button>
            <Button className="bg-[#2952E3] hover:bg-[#1e3a8a]" onClick={() => { location.href = '/'; }}>Go home</Button>
          </div>
        </div>
      </div>
    );
  }
}
