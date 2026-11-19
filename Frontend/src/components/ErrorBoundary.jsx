import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h1>Something went wrong</h1>
          <p>This page failed to load. Please refresh and try again.</p>
          <p style={{ color: '#6b6558', fontSize: '0.85rem' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button className="btn" onClick={this.handleReload}>
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}