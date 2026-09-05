import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FetchErrorCard } from './FetchErrorCard';
import { forceFreshPageLoad, isChunkLoadError } from '../lib/chunkRecovery';

interface ChunkLoadErrorBoundaryState {
  error: Error | null;
}

export class ChunkLoadErrorBoundary extends Component<
  { children: ReactNode },
  ChunkLoadErrorBoundaryState
> {
  state: ChunkLoadErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ChunkLoadErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application screen failed to load:', error, errorInfo);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const message = isChunkLoadError(this.state.error)
      ? 'Обновление сайта загрузилось не полностью. Повторите загрузку.'
      : 'Не удалось открыть этот экран. Повторите загрузку.';

    return (
      <div className="flex h-full items-center justify-center bg-[#0A0908]">
        <FetchErrorCard message={message} onRetry={() => forceFreshPageLoad()} />
      </div>
    );
  }
}
