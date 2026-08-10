import {Component, type ErrorInfo, type ReactNode} from 'react';
import {AlertTriangle} from 'lucide-react';
import {Button, Loader} from './ui';

export const RouteLoader = () => <div aria-live="polite" aria-label="Loading page"><Loader/></div>;

export class RouteErrorBoundary extends Component<{children:ReactNode},{error:boolean}> {
  state = {error:false};
  static getDerivedStateFromError(){ return {error:true}; }
  componentDidCatch(error: Error, info: ErrorInfo){ console.error('Route render failed', error, info.componentStack); }
  render(){
    if(this.state.error) return <div className="state" role="alert"><span className="state-icon danger"><AlertTriangle/></span><h2>Unable to display this page</h2><p>The page encountered an unexpected error. No data was changed.</p><Button onClick={()=>location.reload()}>Reload page</Button></div>;
    return this.props.children;
  }
}
