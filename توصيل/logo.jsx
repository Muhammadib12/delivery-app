/* global React */
// Kdel logo — wordmark + speed mark (stylized chevron arrow)
const KdelLogo = ({ size = 32, color, accent, showTagline = false, style }) => {
  const c = color || '#1B6B3A';
  const a = accent || '#F39C12';
  const h = size;
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, ...style }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: h * 0.18 }}>
        {/* Speed mark — stacked chevrons */}
        <svg width={h * 1.05} height={h} viewBox="0 0 32 28" style={{ display: 'block', overflow: 'visible' }}>
          <path d="M2 14 L10 6 L10 12 L18 4 L18 12 L26 4" stroke={a} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55"/>
          <path d="M6 22 L14 14 L14 20 L22 12 L22 20 L30 12" stroke={c} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
        <span style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 800,
          fontSize: h * 0.95,
          letterSpacing: '-0.04em',
          color: c,
          lineHeight: 1,
        }}>
          kdel
        </span>
      </div>
      {showTagline && (
        <div style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: h * 0.32,
          color: c,
          opacity: 0.7,
          letterSpacing: '0.01em',
          marginLeft: h * 1.25,
        }}>
          fast delivery, right to your door
        </div>
      )}
    </div>
  );
};
window.KdelLogo = KdelLogo;
