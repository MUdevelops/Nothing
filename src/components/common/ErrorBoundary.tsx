import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './ui';

interface S { error: Error | null }
export class ErrorBoundary extends Component<{ children: ReactNode }, S> {
  state: S = { error: null };
  static getDerivedStateFromError(error: Error): S { return { error }; }
  componentDidCatch(e: Error, i: ErrorInfo) { console.error('[NOTHING] window crashed', e, i.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-xs">
        <div className="text-sm font-medium text-red-400">This window crashed</div>
        <p className="max-w-sm font-mono text-muted">{this.state.error.message}</p>
        <Button onClick={() => this.setState({ error: null })}>Reload window</Button>
      </div>
    );
  }
}
