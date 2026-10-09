export default function LoadingIndicator({ message = 'Loading…', className = '' }) {
  return (
    <div className={`loading-indicator ${className}`.trim()} role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
