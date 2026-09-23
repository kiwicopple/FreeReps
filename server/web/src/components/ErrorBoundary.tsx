import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="page-x" style={{ paddingTop: 26, paddingBottom: 26 }}>
          <h2 style={{ fontSize: 19 }}>Something went wrong</h2>
          <p
            style={{
              font: "400 13px/1.55 var(--font-body)",
              color: "var(--muted-foreground)",
              maxWidth: "62ch",
              margin: "10px 0 0",
            }}
          >
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 14 }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
