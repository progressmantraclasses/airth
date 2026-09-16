export function LoadingSkeleton() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton" style={{ width: 72 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="skeleton" style={{ width: '55%' }} />
            <div className="skeleton" style={{ width: '30%', height: 11 }} />
          </div>
          <div className="skeleton" style={{ width: 80, height: 26, borderRadius: 999 }} />
          <div className="skeleton" style={{ width: 90 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <div className="skeleton" style={{ width: 70, height: 28, borderRadius: 999 }} />
            <div className="skeleton" style={{ width: 55, height: 28, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
