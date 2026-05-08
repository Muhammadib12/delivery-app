/* global React */
// Kdel icon library — minimal stroke icons (Phosphor-inspired)
const Icon = ({ name, size = 20, weight = 1.8, color = 'currentColor', fill, style }) => {
  const s = { width: size, height: size, display: 'block', ...style };
  const stroke = { stroke: color, strokeWidth: weight, fill: fill || 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const filled = { fill: color, stroke: 'none' };
  switch (name) {
    case 'arrow-left': return <svg viewBox="0 0 24 24" style={s}><path d="M15 18l-6-6 6-6" {...stroke}/></svg>;
    case 'arrow-right': return <svg viewBox="0 0 24 24" style={s}><path d="M9 6l6 6-6 6" {...stroke}/></svg>;
    case 'chevron-down': return <svg viewBox="0 0 24 24" style={s}><path d="M6 9l6 6 6-6" {...stroke}/></svg>;
    case 'chevron-right': return <svg viewBox="0 0 24 24" style={s}><path d="M9 6l6 6-6 6" {...stroke}/></svg>;
    case 'pin': return <svg viewBox="0 0 24 24" style={s}><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" {...stroke}/><circle cx="12" cy="9" r="2.5" {...stroke}/></svg>;
    case 'pin-fill': return <svg viewBox="0 0 24 24" style={s}><path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" {...filled}/><circle cx="12" cy="9" r="2.2" fill="white"/></svg>;
    case 'bell': return <svg viewBox="0 0 24 24" style={s}><path d="M6 8a6 6 0 0112 0v5l1.5 3h-15L6 13V8z" {...stroke}/><path d="M10 19a2 2 0 004 0" {...stroke}/></svg>;
    case 'search': return <svg viewBox="0 0 24 24" style={s}><circle cx="11" cy="11" r="7" {...stroke}/><path d="M20 20l-4-4" {...stroke}/></svg>;
    case 'home': return <svg viewBox="0 0 24 24" style={s}><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" {...stroke}/></svg>;
    case 'home-fill': return <svg viewBox="0 0 24 24" style={s}><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-9z" {...filled}/></svg>;
    case 'bag': return <svg viewBox="0 0 24 24" style={s}><path d="M5 8h14l-1 12a1 1 0 01-1 1H7a1 1 0 01-1-1L5 8z" {...stroke}/><path d="M9 8V6a3 3 0 016 0v2" {...stroke}/></svg>;
    case 'bag-fill': return <svg viewBox="0 0 24 24" style={s}><path d="M5 8h14l-1 12a1 1 0 01-1 1H7a1 1 0 01-1-1L5 8z" {...filled}/><path d="M9 8V6a3 3 0 016 0v2" stroke={color} strokeWidth="2" fill="none"/></svg>;
    case 'user': return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="8" r="4" {...stroke}/><path d="M4 21c0-4.5 3.5-8 8-8s8 3.5 8 8" {...stroke}/></svg>;
    case 'user-fill': return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="8" r="4" {...filled}/><path d="M4 21c0-4.5 3.5-8 8-8s8 3.5 8 8" {...filled}/></svg>;
    case 'plus': return <svg viewBox="0 0 24 24" style={s}><path d="M12 5v14M5 12h14" {...stroke}/></svg>;
    case 'minus': return <svg viewBox="0 0 24 24" style={s}><path d="M5 12h14" {...stroke}/></svg>;
    case 'x': return <svg viewBox="0 0 24 24" style={s}><path d="M6 6l12 12M18 6L6 18" {...stroke}/></svg>;
    case 'check': return <svg viewBox="0 0 24 24" style={s}><path d="M5 12l5 5L20 7" {...stroke}/></svg>;
    case 'check-circle': return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="10" {...filled}/><path d="M7 12l3.5 3.5L17 9" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    case 'star': return <svg viewBox="0 0 24 24" style={s}><path d="M12 3l2.7 5.5 6 .9-4.4 4.3 1 6L12 17l-5.4 2.7 1-6L3.4 9.4l6-.9L12 3z" {...filled}/></svg>;
    case 'clock': return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...stroke}/><path d="M12 7v5l3 2" {...stroke}/></svg>;
    case 'phone': return <svg viewBox="0 0 24 24" style={s}><path d="M5 4h3l2 5-2 1a11 11 0 006 6l1-2 5 2v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" {...stroke}/></svg>;
    case 'phone-fill': return <svg viewBox="0 0 24 24" style={s}><path d="M5 4h3l2 5-2 1a11 11 0 006 6l1-2 5 2v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" {...filled}/></svg>;
    case 'wifi-off': return <svg viewBox="0 0 24 24" style={s}><path d="M2 2l20 20M5 12a10 10 0 0114 0M8.5 15.5a5 5 0 017 0M12 19h.01" {...stroke}/></svg>;
    case 'mic': return <svg viewBox="0 0 24 24" style={s}><rect x="9" y="3" width="6" height="11" rx="3" {...stroke}/><path d="M5 11a7 7 0 0014 0M12 18v3" {...stroke}/></svg>;
    case 'flame': return <svg viewBox="0 0 24 24" style={s}><path d="M12 3s4 4 4 8a4 4 0 01-8 0c0-2 1-3 1-3s-1-3 3-5z" {...filled}/></svg>;
    case 'bike': return <svg viewBox="0 0 24 24" style={s}><circle cx="6" cy="17" r="3" {...stroke}/><circle cx="18" cy="17" r="3" {...stroke}/><path d="M6 17l3-7h6l3 7M9 10l-1-3h-2M15 10l1-2" {...stroke}/></svg>;
    case 'fork-knife': return <svg viewBox="0 0 24 24" style={s}><path d="M7 3v8a2 2 0 002 2v8M5 3v5a2 2 0 002 2M9 3v5M17 3c-2 1-3 3-3 6 0 2 1 3 3 3v9" {...stroke}/></svg>;
    case 'shield': return <svg viewBox="0 0 24 24" style={s}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" {...stroke}/></svg>;
    case 'menu': return <svg viewBox="0 0 24 24" style={s}><path d="M4 7h16M4 12h16M4 17h16" {...stroke}/></svg>;
    case 'edit': return <svg viewBox="0 0 24 24" style={s}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3" {...stroke}/></svg>;
    case 'trash': return <svg viewBox="0 0 24 24" style={s}><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M7 7l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" {...stroke}/></svg>;
    case 'lock': return <svg viewBox="0 0 24 24" style={s}><rect x="5" y="11" width="14" height="9" rx="2" {...stroke}/><path d="M8 11V8a4 4 0 018 0v3" {...stroke}/></svg>;
    case 'cash': return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="6" width="18" height="12" rx="2" {...stroke}/><circle cx="12" cy="12" r="3" {...stroke}/></svg>;
    case 'tag': return <svg viewBox="0 0 24 24" style={s}><path d="M3 12V4h8l10 10-8 8L3 12z" {...stroke}/><circle cx="8" cy="9" r="1.5" {...filled}/></svg>;
    case 'pot': return <svg viewBox="0 0 24 24" style={s}><path d="M4 10h16v7a3 3 0 01-3 3H7a3 3 0 01-3-3v-7zM3 10h18M9 7c0-2 6-2 6 0M12 4v3" {...stroke}/></svg>;
    case 'alert': return <svg viewBox="0 0 24 24" style={s}><path d="M12 4l10 17H2L12 4z" {...stroke}/><path d="M12 11v4M12 18v.01" {...stroke}/></svg>;
    case 'info': return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...stroke}/><path d="M12 11v6M12 8v.01" {...stroke}/></svg>;
    case 'sparkle': return <svg viewBox="0 0 24 24" style={s}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" {...filled}/></svg>;
    case 'arrow-up-right': return <svg viewBox="0 0 24 24" style={s}><path d="M7 17L17 7M9 7h8v8" {...stroke}/></svg>;
    default: return <svg viewBox="0 0 24 24" style={s}><circle cx="12" cy="12" r="9" {...stroke}/></svg>;
  }
};
window.Icon = Icon;
