interface Props {
  message: string;
  onClose: () => void;
}

export function ErrorBanner({ message, onClose }: Props) {
  return (
    <div className="error-banner" role="alert">
      <span className="error-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4M12 16h.01" strokeLinecap="round"/>
        </svg>
      </span>
      <span className="error-msg">{message}</span>
      <button className="error-close" onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}
