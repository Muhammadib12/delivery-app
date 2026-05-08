/* global React */
// Gradient-based food/restaurant imagery placeholders with category icons.
const FOOD_GRADIENTS = {
  grills:    ['#3A1F0E', '#A04923', '#F39C12'],
  pizza:     ['#5C1818', '#C0392B', '#F39C12'],
  burgers:   ['#3D2410', '#8B5A2B', '#E67E22'],
  shawarma:  ['#1F2A14', '#5D7D34', '#A8C572'],
  sweets:    ['#3A1840', '#9B5DE5', '#F8BBD0'],
  fastfood:  ['#0F2540', '#1565C0', '#42A5F5'],
  grocery:   ['#0F3D2F', '#1B6B3A', '#27AE60'],
  drinks:    ['#1F1F2E', '#4A5BD8', '#7DCFFF'],
  default:   ['#1F2937', '#374151', '#6B7280'],
};

const FoodImg = ({ category = 'grills', size = 120, radius = 12, label, style, dim = false }) => {
  const g = FOOD_GRADIENTS[category] || FOOD_GRADIENTS.default;
  const id = React.useMemo(() => 'fg-' + Math.random().toString(36).slice(2, 9), []);
  const w = typeof size === 'number' ? size : '100%';
  const h = typeof size === 'number' ? size : '100%';
  return (
    <div style={{
      width: w, height: h, borderRadius: radius, overflow: 'hidden',
      position: 'relative', flexShrink: 0,
      filter: dim ? 'saturate(0.85) brightness(0.92)' : 'none',
      ...style,
    }}>
      <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id={id} cx="70%" cy="20%" r="100%">
            <stop offset="0%" stopColor={g[2]} />
            <stop offset="55%" stopColor={g[1]} />
            <stop offset="100%" stopColor={g[0]} />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill={`url(#${id})`} />
        {/* subtle grain dots */}
        <g opacity="0.08" fill="white">
          <circle cx="20" cy="80" r="1.2"/>
          <circle cx="40" cy="20" r="0.8"/>
          <circle cx="80" cy="60" r="1"/>
          <circle cx="65" cy="35" r="0.6"/>
          <circle cx="30" cy="55" r="0.9"/>
        </g>
      </svg>
      {/* category icon */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'rgba(255,255,255,0.85)',
      }}>
        <CategoryGlyph category={category} size={Math.min(typeof size === 'number' ? size * 0.42 : 48, 64)} />
      </div>
      {label && (
        <div style={{
          position: 'absolute', left: 8, bottom: 8,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 10, color: 'rgba(255,255,255,0.7)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>{label}</div>
      )}
    </div>
  );
};

const CategoryGlyph = ({ category, size = 48 }) => {
  const s = { width: size, height: size, display: 'block' };
  const c = 'currentColor';
  switch (category) {
    case 'grills': return <svg viewBox="0 0 48 48" style={s}><path d="M10 20h28l-2 14a4 4 0 01-4 4H16a4 4 0 01-4-4l-2-14z" stroke={c} strokeWidth="2.5" fill="none"/><path d="M16 14c0-3 4-3 4-6M24 14c0-3 4-3 4-6M32 14c0-3 4-3 4-6" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>;
    case 'pizza': return <svg viewBox="0 0 48 48" style={s}><path d="M24 6L8 38h32L24 6z" stroke={c} strokeWidth="2.5" fill="none" strokeLinejoin="round"/><circle cx="20" cy="26" r="2" fill={c}/><circle cx="28" cy="22" r="2" fill={c}/><circle cx="26" cy="32" r="2" fill={c}/></svg>;
    case 'burgers': return <svg viewBox="0 0 48 48" style={s}><path d="M8 18c0-6 7-10 16-10s16 4 16 10H8z" stroke={c} strokeWidth="2.5" fill="none"/><path d="M8 24h32M8 30h32M8 36c0 2 2 4 4 4h24c2 0 4-2 4-4" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>;
    case 'shawarma': return <svg viewBox="0 0 48 48" style={s}><path d="M24 6c-6 0-10 4-10 10v20c0 4 4 6 10 6s10-2 10-6V16c0-6-4-10-10-10zM14 20h20M14 28h20" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/></svg>;
    case 'sweets': return <svg viewBox="0 0 48 48" style={s}><circle cx="24" cy="26" r="14" stroke={c} strokeWidth="2.5" fill="none"/><path d="M24 12V6M20 6h8" stroke={c} strokeWidth="2.5" fill="none" strokeLinecap="round"/><circle cx="20" cy="24" r="1.5" fill={c}/><circle cx="28" cy="28" r="1.5" fill={c}/></svg>;
    case 'fastfood': return <svg viewBox="0 0 48 48" style={s}><path d="M14 20h20l-2 18H16L14 20zM12 20l4-12h16l4 12" stroke={c} strokeWidth="2.5" fill="none" strokeLinejoin="round"/></svg>;
    case 'grocery': return <svg viewBox="0 0 48 48" style={s}><path d="M10 14h28l-3 22a2 2 0 01-2 2H15a2 2 0 01-2-2L10 14zM18 14V8a6 6 0 0112 0v6" stroke={c} strokeWidth="2.5" fill="none"/></svg>;
    case 'drinks': return <svg viewBox="0 0 48 48" style={s}><path d="M14 10h20l-2 28a4 4 0 01-4 4h-8a4 4 0 01-4-4L14 10zM14 20h20" stroke={c} strokeWidth="2.5" fill="none"/></svg>;
    default: return <svg viewBox="0 0 48 48" style={s}><circle cx="24" cy="24" r="14" stroke={c} strokeWidth="2.5" fill="none"/></svg>;
  }
};

window.FoodImg = FoodImg;
window.CategoryGlyph = CategoryGlyph;
