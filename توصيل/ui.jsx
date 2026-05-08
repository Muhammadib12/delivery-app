/* global React */
const { useState, useEffect, useRef } = React;

// ============ THEME CONTEXT ============
const ThemeCtx = React.createContext(null);
const useTheme = () => React.useContext(ThemeCtx);

const ThemeProvider = ({ mode = 'light', children, scope }) => {
  const t = window.KdelTokens[mode];
  const value = { mode, t, tokens: window.KdelTokens };
  return (
    <ThemeCtx.Provider value={value}>
      <div data-mode={mode} style={scope ? { contain: 'layout style' } : undefined}>{children}</div>
    </ThemeCtx.Provider>
  );
};

// ============ BUTTON ============
const Button = ({ variant = 'primary', size = 'md', icon, iconRight, fullWidth, loading, disabled, onClick, children, style }) => {
  const { t, mode } = useTheme();
  const sizeMap = {
    sm: { h: 36, px: 14, fs: 14 },
    md: { h: 48, px: 18, fs: 15 },
    lg: { h: 56, px: 22, fs: 16 },
  };
  const sz = sizeMap[size];
  const variants = {
    primary: { bg: t.primary, color: '#fff', border: 'none', shadow: mode === 'dark' ? t.shadowSm : 'none' },
    secondary: { bg: 'transparent', color: t.primary, border: `1.5px solid ${t.primary}`, shadow: 'none' },
    ghost: { bg: 'transparent', color: t.primary, border: 'none', shadow: 'none' },
    destructive: { bg: t.error, color: '#fff', border: 'none', shadow: 'none' },
    'destructive-outline': { bg: 'transparent', color: t.error, border: `1.5px solid ${t.error}`, shadow: 'none' },
    surface: { bg: t.surfaceVariant, color: t.textPrimary, border: 'none', shadow: 'none' },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      style={{
        height: sz.h, padding: `0 ${sz.px}px`, fontSize: sz.fs, fontWeight: 600,
        background: v.bg, color: v.color, border: v.border,
        borderRadius: 12, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        width: fullWidth ? '100%' : 'auto', opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit', boxShadow: v.shadow, transition: 'transform 120ms, opacity 120ms',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
      onMouseUp={e => e.currentTarget.style.transform = ''}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      {loading ? <Spinner color={v.color} /> : icon && <Icon name={icon} size={18} color={v.color}/>}
      {children}
      {!loading && iconRight && <Icon name={iconRight} size={18} color={v.color}/>}
    </button>
  );
};

const Spinner = ({ color = '#fff', size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'kspin 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2.5" fill="none" opacity="0.25"/>
    <path d="M21 12a9 9 0 00-9-9" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  </svg>
);

// ============ STATUS CHIP ============
const StatusChip = ({ status, size = 'md', icon = true }) => {
  const { mode } = useTheme();
  const meta = window.KdelTokens.status[status] || { bg: '#eee', text: '#000', label: status };
  let bg = meta.bg, text = meta.text;
  if (mode === 'dark') {
    // Convert solid to translucent + bright text
    bg = hexToRgba(meta.bg, 0.18);
    text = brightenForDark(meta.text, meta.bg);
  }
  const sizes = {
    sm: { h: 22, px: 8, fs: 11, gap: 4, ic: 12 },
    md: { h: 28, px: 10, fs: 12, gap: 5, ic: 14 },
    lg: { h: 34, px: 14, fs: 13, gap: 6, ic: 16 },
  };
  const s = sizes[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: s.gap,
      height: s.h, padding: `0 ${s.px}px`, borderRadius: 999,
      background: bg, color: text, fontSize: s.fs, fontWeight: 600,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {icon && <Icon name={meta.icon} size={s.ic} color={text}/>}
      {meta.label}
    </span>
  );
};

const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
};
const brightenForDark = (textHex, bgHex) => {
  // For dark mode chip text, use the original "bg" colour (vivid) — and brighten
  const map = {
    '#856404': '#FFD668',
    '#0C5460': '#7ED9E8',
    '#5A189A': '#C8A6FF',
    '#7C3A00': '#FFB870',
    '#0A5E4A': '#5DECC0',
    '#FFFFFF': '#FFFFFF',
    '#7B1414': '#FF8A8A',
    '#491217': '#FFA8B0',
  };
  return map[textHex] || textHex;
};

// ============ CARD ============
const Card = ({ children, padded = true, elevated = false, style, onClick }) => {
  const { t, mode } = useTheme();
  return (
    <div onClick={onClick} style={{
      background: elevated ? t.surfaceElevated : t.surface,
      borderRadius: 16,
      border: mode === 'dark' ? `1px solid ${t.border}` : 'none',
      boxShadow: mode === 'dark' ? 'none' : t.shadowSm,
      padding: padded ? 16 : 0,
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
};

// ============ DIVIDER ============
const Divider = ({ style }) => {
  const { t } = useTheme();
  return <div style={{ height: 1, background: t.border, ...style }} />;
};

// ============ INPUT ============
const Input = ({ icon, suffix, placeholder, value, onChange, style, prefix, type = 'text' }) => {
  const { t } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: t.surfaceVariant, borderRadius: 12,
      padding: '0 14px', height: 48,
      border: `1.5px solid ${focus ? t.primary : 'transparent'}`,
      transition: 'border 120ms',
      ...style,
    }}>
      {icon && <Icon name={icon} size={18} color={t.textSecondary}/>}
      {prefix && <span style={{ color: t.textSecondary, fontSize: 15, fontWeight: 500 }}>{prefix}</span>}
      <input
        type={type}
        value={value} onChange={onChange}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        placeholder={placeholder}
        style={{
          flex: 1, border: 'none', outline: 'none', background: 'transparent',
          color: t.textPrimary, fontSize: 15, fontFamily: 'inherit',
          minWidth: 0,
        }}
      />
      {suffix}
    </div>
  );
};

// ============ OFFLINE BANNER ============
const OfflineBanner = ({ visible }) => {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
      background: '#C0392B', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      padding: '8px 12px', fontSize: 13, fontWeight: 600,
    }}>
      <Icon name="wifi-off" size={16} color="#fff"/>
      No internet connection
    </div>
  );
};

// ============ BOTTOM NAV ============
const BottomNav = ({ active = 'home', onTab, cartCount = 0 }) => {
  const { t, mode } = useTheme();
  const tabs = [
    { id: 'home', label: 'Home', icon: 'home', activeIcon: 'home-fill' },
    { id: 'search', label: 'Search', icon: 'search', activeIcon: 'search' },
    { id: 'orders', label: 'Orders', icon: 'bag', activeIcon: 'bag-fill' },
    { id: 'profile', label: 'Profile', icon: 'user', activeIcon: 'user-fill' },
  ];
  return (
    <div style={{
      background: t.surface,
      borderTop: `1px solid ${t.border}`,
      padding: '8px 8px 10px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id;
        const color = isActive ? t.primary : t.textSecondary;
        return (
          <button key={tab.id} onClick={() => onTab && onTab(tab.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '6px 12px', minWidth: 56, position: 'relative',
              fontFamily: 'inherit',
            }}>
            <div style={{ position: 'relative' }}>
              <Icon name={isActive ? tab.activeIcon : tab.icon} size={22} color={color}/>
              {tab.id === 'orders' && cartCount > 0 && (
                <div style={{
                  position: 'absolute', top: -4, right: -8, minWidth: 16, height: 16,
                  borderRadius: 999, background: t.error, color: '#fff',
                  fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>{cartCount}</div>
              )}
            </div>
            <span style={{ fontSize: 11, fontWeight: isActive ? 600 : 500, color }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// ============ APP BAR ============
const AppBar = ({ title, onBack, right, transparent }) => {
  const { t } = useTheme();
  return (
    <div style={{
      height: 56, padding: '0 8px',
      display: 'flex', alignItems: 'center', gap: 8,
      background: transparent ? 'transparent' : t.surface,
      borderBottom: transparent ? 'none' : `1px solid ${t.border}`,
    }}>
      {onBack && (
        <button onClick={onBack} style={{
          width: 40, height: 40, border: 'none', background: transparent ? 'rgba(0,0,0,0.4)' : 'transparent',
          borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <Icon name="arrow-left" size={22} color={transparent ? '#fff' : t.textPrimary}/>
        </button>
      )}
      <div style={{ flex: 1, fontSize: 17, fontWeight: 600, color: transparent ? '#fff' : t.textPrimary, paddingLeft: onBack ? 0 : 8 }}>{title}</div>
      {right}
    </div>
  );
};

// ============ QTY STEPPER ============
const QtyStepper = ({ value, onChange, size = 'md' }) => {
  const { t } = useTheme();
  const sizes = { sm: 28, md: 36, lg: 44 };
  const s = sizes[size];
  const btn = {
    width: s, height: s, borderRadius: 999, border: 'none',
    background: t.surfaceVariant, color: t.textPrimary,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  };
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button style={btn} onClick={() => onChange(Math.max(1, value - 1))}><Icon name="minus" size={16}/></button>
      <div style={{ minWidth: 22, textAlign: 'center', fontSize: 15, fontWeight: 600, color: t.textPrimary }}>{value}</div>
      <button style={{ ...btn, background: t.primary, color: '#fff' }} onClick={() => onChange(value + 1)}><Icon name="plus" size={16} color="#fff"/></button>
    </div>
  );
};

// global keyframes injected once
if (!document.getElementById('kdel-keyframes')) {
  const s = document.createElement('style');
  s.id = 'kdel-keyframes';
  s.textContent = `
    @keyframes kspin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
    @keyframes kpulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.08); opacity: 0.85; } }
    @keyframes kpulse-ring { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(2); opacity: 0; } }
    @keyframes kshimmer { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
    @keyframes kfade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes kfade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes kslide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes kdriver-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
    @keyframes kdash-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -20; } }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { ThemeProvider, useTheme, Button, Spinner, StatusChip, Card, Divider, Input, OfflineBanner, BottomNav, AppBar, QtyStepper, hexToRgba });
