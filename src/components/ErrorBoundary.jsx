/**
 * @file ErrorBoundary.jsx
 * Last line of defence: if rendering throws, show a calm recovery screen
 * instead of a blank page.
 */

import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('[Velocity] render error', error, info);
  }

  retry = () => this.setState({ failed: false });

  reload = () => window.location.reload();

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="crash" role="alert">
        <h1>Something went wrong.</h1>
        <p>The app hit an unexpected error. Your past results are safe.</p>
        <div className="crash-actions">
          <button type="button" className="go" onClick={this.reload}>Reload</button>
          <button type="button" className="text-btn" onClick={this.retry}>Try without reloading</button>
        </div>
      </main>
    );
  }
}
