/* global React */
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS } = React;

// ===== SAMPLE DATA =====
const RESTAURANTS = [
  { id: 'r1', name: 'Al-Mansour Grill', cat: 'grills', rating: 4.7, reviews: 234, time: '25–35 min', fee: 4.0, status: 'open', tags: ['Mansaf', 'Mixed Grill', 'Hummus'], distance: 1.4 },
  { id: 'r2', name: 'Pizza Roma', cat: 'pizza', rating: 4.5, reviews: 891, time: '20–30 min', fee: 0, status: 'open', tags: ['Stone-baked'], distance: 0.8, isNew: true },
  { id: 'r3', name: 'Shawarma House', cat: 'shawarma', rating: 4.8, reviews: 1240, time: '15–25 min', fee: 4.0, status: 'open', tags: ['Lamb', 'Chicken'], distance: 0.6 },
  { id: 'r4', name: 'Sweet Sahar', cat: 'sweets', rating: 4.6, reviews: 178, time: '30–40 min', fee: 5.0, status: 'busy', tags: ['Knafeh'], distance: 2.1 },
  { id: 'r5', name: 'Burger Yard', cat: 'burgers', rating: 4.4, reviews: 612, time: '25–35 min', fee: 0, status: 'open', tags: ['Smash'], distance: 1.7 },
];

const PRODUCTS = {
  r1: [
    { id: 'p1', cat: 'Grills', name: 'Mixed Grill Platter', desc: 'Lamb chops, kafta, chicken shish, rice & salad', price: 89, img: 'grills' },
    { id: 'p2', cat: 'Grills', name: 'Lamb Mansaf', desc: 'Slow-cooked lamb on jameed rice with almonds', price: 78, img: 'grills' },
    { id: 'p3', cat: 'Grills', name: 'Kafta Skewers', desc: 'Two skewers of charcoal-grilled kafta', price: 52, img: 'grills' },
    { id: 'p4', cat: 'Mains', name: 'Chicken Shish Tawook', desc: 'Marinated chicken cubes, garlic sauce, fries', price: 56, img: 'grills' },
    { id: 'p5', cat: 'Starters', name: 'Hummus & Pita', desc: 'House hummus, warm pita, olive oil', price: 22, img: 'shawarma' },
    { id: 'p6', cat: 'Starters', name: 'Tabbouleh', desc: 'Parsley, bulgur, tomato, lemon', price: 18, img: 'shawarma' },
    { id: 'p7', cat: 'Drinks', name: 'Mint Lemonade', desc: 'Fresh mint, lemon, light sweetness', price: 14, img: 'drinks' },
    { id: 'p8', cat: 'Drinks', name: 'Arabic Coffee', desc: 'Cardamom-spiced, served small', price: 10, img: 'drinks' },
  ],
};

// ===== HOME SCREEN =====
const HomeScreen = ({ onOpenRestaurant, onOpenCart, cartCount, onTab, offline, rtl }) => {
  const { t, mode } = useTheme();
  const cats = [
    { id: 'all', label: rtl ? 'الكل' : 'All', icon: 'sparkle' },
    { id: 'fastfood', label: 'Fast Food', icon: 'flame' },
    { id: 'grills', label: 'Grills', icon: 'fork-knife' },
    { id: 'pizza', label: 'Pizza', icon: 'pot' },
    { id: 'burgers', label: 'Burgers', icon: 'flame' },
    { id: 'shawarma', label: 'Shawarma', icon: 'fork-knife' },
    { id: 'sweets', label: 'Sweets', icon: 'sparkle' },
    { id: 'grocery', label: 'Grocery', icon: 'bag' },
  ];
  const [activeCat, setActiveCat] = useStateS('all');
  return (
    <div style={{ background: t.bg, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', direction: rtl ? 'rtl' : 'ltr' }}>
      <OfflineBanner visible={offline} />
      <div style={{ flex: 1, overflow: 'auto', paddingTop: offline ? 32 : 0 }}>
        {/* Top bar */}
        <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 12, background: t.bg }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, background: hexToRgba(t.primary, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="pin-fill" size={18} color={t.primary}/>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 11, color: t.textSecondary, fontWeight: 500, lineHeight: 1.2 }}>{rtl ? 'التوصيل إلى' : 'Deliver to'}</div>
              <div style={{ fontSize: 14, color: t.textPrimary, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {rtl ? '٢٣ شارع يافا، تل أبيب' : '23 Jaffa Street, Tel Aviv'}
                <Icon name="chevron-down" size={14} color={t.textPrimary}/>
              </div>
            </div>
          </div>
          <button style={{ width: 40, height: 40, borderRadius: 999, background: t.surface, border: 'none', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.shadowSm, cursor: 'pointer' }}>
            <Icon name="bell" size={20} color={t.textPrimary}/>
            <div style={{ position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 999, background: t.error, border: `2px solid ${t.surface}` }}/>
          </button>
        </div>
        {/* Search */}
        <div style={{ padding: '8px 16px 12px' }}>
          <Input icon="search" placeholder={rtl ? 'ابحث عن مطاعم أو أطباق...' : 'Search restaurants or dishes...'} suffix={<Icon name="mic" size={18} color={t.textSecondary}/>}/>
        </div>
        {/* Promo strip */}
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{
            background: `linear-gradient(110deg, ${t.primary}, ${t.primaryLight})`,
            borderRadius: 16, padding: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 12,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.85 }}>Free delivery</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 2 }}>{rtl ? 'الطلب الأول عليك' : 'Your first order is on us'}</div>
              <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>Use code <b>KDEL10</b> · valid today</div>
            </div>
            <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.2 }}>
              <KdelLogo size={80} color="#fff" accent="#fff"/>
            </div>
            <div style={{ width: 56, height: 56, borderRadius: 999, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="bike" size={28} color="#fff"/>
            </div>
          </div>
        </div>
        {/* Categories */}
        <div style={{ padding: '0 0 16px' }}>
          <div style={{ display: 'flex', gap: 10, padding: '0 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {cats.map(c => {
              const isActive = activeCat === c.id;
              return (
                <button key={c.id} onClick={() => setActiveCat(c.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                  background: isActive ? t.primary : t.surface,
                  color: isActive ? '#fff' : t.textPrimary,
                  borderRadius: 999, border: isActive ? 'none' : `1px solid ${t.border}`,
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}>
                  <Icon name={c.icon} size={14} color={isActive ? '#fff' : t.textSecondary}/>
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* Featured */}
        <SectionHeader title={rtl ? 'مميز' : 'Featured'} action="See all" />
        <div style={{ display: 'flex', gap: 12, padding: '0 16px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {RESTAURANTS.slice(0, 4).map(r => (
            <FeaturedRestaurantCard key={r.id} r={r} onClick={() => onOpenRestaurant(r)} />
          ))}
        </div>
        {/* List */}
        <SectionHeader title={rtl ? 'كل المطاعم' : 'All Restaurants'} subtitle={`${RESTAURANTS.length} near you`} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 16px 100px' }}>
          {RESTAURANTS.map(r => (
            <RestaurantRow key={r.id} r={r} onClick={() => onOpenRestaurant(r)} />
          ))}
        </div>
      </div>
      {cartCount > 0 && (
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 80, animation: 'kfade-up 220ms' }}>
          <button onClick={onOpenCart} style={{
            width: '100%', height: 52, border: 'none', borderRadius: 14,
            background: t.primary, color: '#fff', fontWeight: 600, fontSize: 15,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
            boxShadow: '0 8px 24px rgba(27,107,58,0.35)', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ background: 'rgba(255,255,255,0.22)', padding: '2px 8px', borderRadius: 999, fontSize: 12 }}>{cartCount}</span>
              View cart
            </span>
            <span>₪89.00</span>
          </button>
        </div>
      )}
      <BottomNav active="home" cartCount={cartCount} onTab={onTab}/>
    </div>
  );
};

const SectionHeader = ({ title, subtitle, action }) => {
  const { t } = useTheme();
  return (
    <div style={{ padding: '8px 16px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary, letterSpacing: '-0.01em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action && <button style={{ background: 'none', border: 'none', color: t.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{action}</button>}
    </div>
  );
};

const FeaturedRestaurantCard = ({ r, onClick }) => {
  const { t, mode } = useTheme();
  return (
    <div onClick={onClick} style={{
      width: 240, flexShrink: 0,
      background: t.surface, borderRadius: 16, overflow: 'hidden',
      cursor: 'pointer', boxShadow: mode === 'dark' ? 'none' : t.shadowSm,
      border: mode === 'dark' ? `1px solid ${t.border}` : 'none',
    }}>
      <div style={{ position: 'relative' }}>
        <FoodImg category={r.cat} size={240} radius={0} style={{ height: 130, width: 240 }}/>
        {r.isNew && (
          <span style={{ position: 'absolute', top: 10, left: 10, background: t.accent, color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999, letterSpacing: '0.06em' }}>NEW</span>
        )}
        {r.fee === 0 && (
          <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999 }}>FREE DELIVERY</span>
        )}
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: t.textPrimary, fontSize: 12, fontWeight: 600 }}>
            <Icon name="star" size={12} color={t.accent}/>
            {r.rating}
          </div>
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 3 }}>{r.tags.join(' · ')}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', fontSize: 12, color: t.textSecondary }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="clock" size={13} color={t.textSecondary}/>{r.time}</span>
          <span>·</span>
          <span>{r.fee === 0 ? 'Free' : `₪${r.fee.toFixed(2)}`}</span>
        </div>
      </div>
    </div>
  );
};

const RestaurantRow = ({ r, onClick }) => {
  const { t, mode } = useTheme();
  return (
    <div onClick={onClick} style={{
      background: t.surface, borderRadius: 16, padding: 12,
      display: 'flex', gap: 12, cursor: 'pointer',
      boxShadow: mode === 'dark' ? 'none' : t.shadowSm,
      border: mode === 'dark' ? `1px solid ${t.border}` : 'none',
    }}>
      <FoodImg category={r.cat} size={88} radius={12}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
          {r.status === 'busy' && <span style={{ fontSize: 10, fontWeight: 700, color: t.warning, background: hexToRgba(t.warning, 0.12), padding: '2px 6px', borderRadius: 6 }}>BUSY</span>}
        </div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{r.tags.join(' · ')}</div>
        <div style={{ marginTop: 8, display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: t.textPrimary, fontWeight: 600 }}>
            <Icon name="star" size={12} color={t.accent}/> {r.rating}
            <span style={{ color: t.textSecondary, fontWeight: 400 }}>({r.reviews})</span>
          </span>
          <span style={{ color: t.textSecondary }}>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: t.textSecondary }}>
            <Icon name="clock" size={12} color={t.textSecondary}/> {r.time}
          </span>
          <span style={{ color: t.textSecondary }}>·</span>
          <span style={{ color: r.fee === 0 ? t.primary : t.textSecondary, fontWeight: r.fee === 0 ? 600 : 400 }}>{r.fee === 0 ? 'Free' : `₪${r.fee.toFixed(2)}`}</span>
        </div>
      </div>
    </div>
  );
};

window.HomeScreen = HomeScreen;
window.RESTAURANTS = RESTAURANTS;
window.PRODUCTS = PRODUCTS;
