import {Component, type ErrorInfo, type ReactNode} from 'react';
import {AlertTriangle} from 'lucide-react';
import {Button, Loader} from './ui';

export const RouteLoader = () => <div aria-live="polite" aria-label="Loading page"><Loader/></div>;

export class RouteErrorBoundary extends Component<{children:ReactNode},{error:Error|null}> {
  state = {error:null as Error|null};
  static getDerivedStateFromError(error: Error){ return {error}; }
  componentDidCatch(error: Error, info: ErrorInfo){ console.error('Route render failed', error, info.componentStack); }
  render(){
    if(this.state.error) return (
      <div className="state p-8" role="alert">
        <span className="state-icon danger"><AlertTriangle/></span>
        <h2>Unable to display this page</h2>
        <p>The page encountered an unexpected error. No data was changed.</p>
        <div className="bg-red-50 text-red-900 p-4 rounded text-left font-mono text-sm overflow-auto max-w-full">
          {this.state.error.message}
          <br/>
          {this.state.error.stack}
        </div>
        <Button onClick={()=>location.reload()} className="mt-4">Reload page</Button>
      </div>
    );
    return this.props.children;
  }
}
