/* global React */
const { useState: useStateR, useRef: useRefR, useEffect: useEffectR } = React;

// ===== RESTAURANT DETAILS SCREEN =====
const RestaurantScreen = ({ restaurant, onBack, onAddProduct, cartCount, cartTotal, onOpenCart, offline, rtl }) => {
  const { t, mode } = useTheme();
  const r = restaurant || RESTAURANTS[0];
  const products = PRODUCTS.r1;
  const cats = ['Starters', 'Mains', 'Grills', 'Drinks'];
  const [tab, setTab] = useStateR('menu');
  const [activeCat, setActiveCat] = useStateR(cats[0]);
  return (
    <div style={{ background: t.bg, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', direction: rtl ? 'rtl' : 'ltr' }}>
      <OfflineBanner visible={offline}/>
      <div style={{ flex: 1, overflow: 'auto', paddingTop: offline ? 32 : 0 }}>
        {/* Hero */}
        <div style={{ position: 'relative' }}>
          <FoodImg category={r.cat} size={390} radius={0} style={{ height: 220, width: '100%' }}/>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0) 35%, rgba(0,0,0,0.15) 100%)' }}/>
          <button onClick={onBack} style={{
            position: 'absolute', top: 12, left: 12, width: 40, height: 40, borderRadius: 999,
            background: 'rgba(0,0,0,0.45)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)',
          }}>
            <Icon name="arrow-left" size={20} color="#fff"/>
          </button>
          <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
              <Icon name="search" size={18} color="#fff"/>
            </div>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
              <Icon name="info" size={18} color="#fff"/>
            </div>
          </div>
        </div>
        {/* Logo + name overlap */}
        <div style={{ padding: '0 16px', marginTop: -36, position: 'relative', zIndex: 2 }}>
          <div style={{
            background: t.surface, borderRadius: 20, padding: '14px 16px 16px',
            boxShadow: mode === 'dark' ? 'none' : t.shadowMd,
            border: mode === 'dark' ? `1px solid ${t.border}` : 'none',
          }}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 14, marginTop: -36,
                background: t.surface, padding: 4, boxShadow: t.shadowSm,
              }}>
                <FoodImg category={r.cat} size={56} radius={10}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: t.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>{r.name}</h1>
                  <span style={{ background: hexToRgba(t.success, mode === 'dark' ? 0.18 : 0.14), color: mode === 'dark' ? '#5DECC0' : t.success, fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>OPEN</span>
                </div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{r.tags.join(' · ')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
              <Stat icon="star" iconColor={t.accent} primary={r.rating.toFixed(1)} secondary={`${r.reviews} reviews`}/>
              <Stat icon="clock" primary={r.time.split('–')[0] + ' min'} secondary="Delivery"/>
              <Stat icon="bike" primary={r.fee === 0 ? 'Free' : `₪${r.fee.toFixed(2)}`} secondary="Delivery fee"/>
              <Stat icon="pin" primary={`${r.distance} km`} secondary="Away"/>
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 24, padding: '20px 20px 12px', borderBottom: `1px solid ${t.border}`, marginTop: 16 }}>
          {[{ id: 'menu', l: 'Menu' }, { id: 'info', l: 'Info' }].map(x => (
            <button key={x.id} onClick={() => setTab(x.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 15, fontWeight: 600,
              color: tab === x.id ? t.textPrimary : t.textSecondary,
              paddingBottom: 10, position: 'relative',
            }}>
              {x.l}
              {tab === x.id && <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2.5, borderRadius: 2, background: t.primary }}/>}
            </button>
          ))}
        </div>
        {tab === 'menu' && (
          <>
            {/* Sticky cat scroll */}
            <div style={{ position: 'sticky', top: 0, zIndex: 5, background: t.bg, padding: '12px 16px 12px' }}>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {cats.map(c => (
                  <button key={c} onClick={() => setActiveCat(c)} style={{
                    padding: '7px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600,
                    background: activeCat === c ? t.textPrimary : t.surface,
                    color: activeCat === c ? t.surface : t.textPrimary,
                    border: activeCat === c ? 'none' : `1px solid ${t.border}`,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{c}</button>
                ))}
              </div>
            </div>
            {/* Menu sections */}
            <div style={{ padding: '0 16px 120px' }}>
              {cats.map(cat => {
                const items = products.filter(p => p.cat === cat);
                if (!items.length) return null;
                return (
                  <div key={cat} style={{ marginTop: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, padding: '12px 0' }}>{cat}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      {items.map(p => <ProductCard key={p.id} p={p} onAdd={() => onAddProduct(p)}/>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === 'info' && (
          <div style={{ padding: 16, paddingBottom: 120 }}>
            <Card>
              <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>Address</div>
              <div style={{ fontSize: 15, color: t.textPrimary, fontWeight: 600, marginTop: 4 }}>14 King George St, Tel Aviv</div>
              <div style={{ height: 120, marginTop: 12, borderRadius: 12, background: t.surfaceVariant, position: 'relative', overflow: 'hidden' }}>
                <MapPattern dim/>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -100%)' }}>
                  <Icon name="pin-fill" size={28} color={t.primary}/>
                </div>
              </div>
            </Card>
            <Card style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500, marginBottom: 8 }}>Working hours</div>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                <div key={d} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14, color: i === 2 ? t.primary : t.textPrimary, fontWeight: i === 2 ? 600 : 400 }}>
                  <span>{d} {i === 2 && '· Today'}</span>
                  <span>10:00 – 23:30</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
      {cartCount > 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, background: t.surface, borderTop: `1px solid ${t.border}`, animation: 'kfade-up 220ms' }}>
          <button onClick={onOpenCart} style={{
            width: '100%', height: 52, border: 'none', borderRadius: 14,
            background: t.primary, color: '#fff', fontWeight: 600, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'rgba(255,255,255,0.22)', padding: '2px 10px', borderRadius: 999, fontSize: 12 }}>{cartCount}</span>
              View cart
            </span>
            <span>₪{cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
};

const Stat = ({ icon, iconColor, primary, secondary }) => {
  const { t } = useTheme();
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Icon name={icon} size={14} color={iconColor || t.textSecondary}/>
        <span style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{primary}</span>
      </div>
      <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 2 }}>{secondary}</div>
    </div>
  );
};

const ProductCard = ({ p, onAdd }) => {
  const { t, mode } = useTheme();
  return (
    <div style={{
      background: t.surface, borderRadius: 14, overflow: 'hidden',
      boxShadow: mode === 'dark' ? 'none' : t.shadowSm,
      border: mode === 'dark' ? `1px solid ${t.border}` : 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'relative' }}>
        <FoodImg category={p.img} size={'100%'} radius={0} style={{ aspectRatio: '1.1', width: '100%' }}/>
        <button onClick={onAdd} style={{
          position: 'absolute', bottom: 8, right: 8,
          width: 32, height: 32, borderRadius: 999,
          background: t.primary, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
        }}>
          <Icon name="plus" size={18} color="#fff"/>
        </button>
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary, lineHeight: 1.2 }}>{p.name}</div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.desc}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.primary, marginTop: 8 }}>₪{p.price.toFixed(2)}</div>
      </div>
    </div>
  );
};

// ===== Map background pattern (used for thumbnails) =====
const MapPattern = ({ dim, animated }) => {
  const { t, mode } = useTheme();
  const baseFill = mode === 'dark' ? '#1A1D27' : '#E8EEF2';
  const road = mode === 'dark' ? '#2D3250' : '#FFFFFF';
  const roadStroke = mode === 'dark' ? '#3A3F5C' : '#D1D8DD';
  const blockA = mode === 'dark' ? '#252A3A' : '#DCE3E8';
  const blockB = mode === 'dark' ? '#22263A' : '#E5EAEE';
  return (
    <svg viewBox="0 0 390 400" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: dim ? 0.85 : 1 }}>
      <rect width="390" height="400" fill={baseFill}/>
      {/* blocks */}
      <rect x="20" y="20" width="100" height="80" fill={blockA} rx="3"/>
      <rect x="140" y="20" width="80" height="60" fill={blockB} rx="3"/>
      <rect x="240" y="20" width="130" height="100" fill={blockA} rx="3"/>
      <rect x="20" y="120" width="60" height="120" fill={blockB} rx="3"/>
      <rect x="100" y="100" width="120" height="60" fill={blockA} rx="3"/>
      <rect x="240" y="140" width="60" height="80" fill={blockB} rx="3"/>
      <rect x="320" y="140" width="50" height="100" fill={blockA} rx="3"/>
      <rect x="100" y="180" width="120" height="80" fill={blockB} rx="3"/>
      <rect x="20" y="260" width="100" height="120" fill={blockA} rx="3"/>
      <rect x="140" y="280" width="160" height="80" fill={blockB} rx="3"/>
      <rect x="320" y="260" width="50" height="120" fill={blockA} rx="3"/>
      {/* roads */}
      <g stroke={roadStroke} strokeWidth="0.5">
        <rect x="0" y="100" width="390" height="20" fill={road}/>
        <rect x="0" y="240" width="390" height="20" fill={road}/>
        <rect x="0" y="370" width="390" height="20" fill={road}/>
        <rect x="120" y="0" width="20" height="400" fill={road}/>
        <rect x="220" y="0" width="20" height="400" fill={road}/>
        <rect x="300" y="0" width="20" height="400" fill={road}/>
      </g>
      {/* dashed center line */}
      {animated && (
        <line x1="0" y1="110" x2="390" y2="110" stroke={t.primary} strokeWidth="1" strokeDasharray="6 6" opacity="0.5" style={{ animation: 'kdash-flow 1s linear infinite' }}/>
      )}
    </svg>
  );
};

window.RestaurantScreen = RestaurantScreen;
window.MapPattern = MapPattern;
