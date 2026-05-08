/* global React */
const { useState: useStateDS } = React;

// ===== DESIGN SYSTEM PAGE — laid out in a canvas =====

const DSPage = ({ mode = 'light' }) => {
  const t = window.KdelTokens[mode];
  const dark = mode === 'dark';
  return (
    <div data-mode={mode} style={{
      background: t.bg, color: t.textPrimary,
      fontFamily: 'Inter, system-ui, sans-serif',
      width: 1280, padding: '48px 56px 80px',
      minHeight: '100%',
    }}>
      <ThemeProvider mode={mode}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 28, borderBottom: `1px solid ${t.border}` }}>
          <div>
            <KdelLogo size={48} color={dark ? '#27AE60' : '#1B6B3A'} accent={t.accent} showTagline/>
            <div style={{ fontSize: 14, color: t.textSecondary, marginTop: 14, maxWidth: 580, lineHeight: 1.6 }}>
              A delivery platform for Israel's Arabic- and Hebrew-speaking communities. This page documents the foundations and the components used across customer, restaurant, driver and admin surfaces — in both light and dark mode.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: t.textSecondary, textTransform: 'uppercase' }}>{mode} mode</span>
            <span style={{ background: dark ? '#22263A' : '#FFFFFF', border: `1px solid ${t.border}`, padding: '6px 12px', borderRadius: 8, fontSize: 12, color: t.textPrimary, fontFamily: 'ui-monospace, Menlo, monospace' }}>v1.0 · 2026</span>
          </div>
        </div>

        {/* Logo lockups */}
        <Section title="01 · Logo" subtitle="Wordmark + speed mark. Stacked chevrons read as motion at any size.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <SwatchCard label="Primary" sub="On surface">
              <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KdelLogo size={48} color={dark ? '#27AE60' : '#1B6B3A'} accent={t.accent}/>
              </div>
            </SwatchCard>
            <SwatchCard label="On primary" sub="On brand">
              <div style={{ height: 100, background: dark ? '#27AE60' : '#1B6B3A', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KdelLogo size={48} color="#fff" accent="#fff"/>
              </div>
            </SwatchCard>
            <SwatchCard label="Mark only" sub="Avatar / app icon">
              <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 18, background: dark ? '#27AE60' : '#1B6B3A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width={48} height={42} viewBox="0 0 32 28">
                    <path d="M2 14 L10 6 L10 12 L18 4 L18 12 L26 4" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55"/>
                    <path d="M6 22 L14 14 L14 20 L22 12 L22 20 L30 12" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              </div>
            </SwatchCard>
            <SwatchCard label="Small" sub="Inline / tab bar">
              <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <KdelLogo size={20} color={dark ? '#27AE60' : '#1B6B3A'} accent={t.accent}/>
              </div>
            </SwatchCard>
          </div>
        </Section>

        {/* Color */}
        <Section title="02 · Color" subtitle="Forest green primary, warm amber accent. Backgrounds use cool tones; never pure white or pure black.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
            <ColorChip name="Primary" value={t.primary}/>
            <ColorChip name="Primary light" value={t.primaryLight}/>
            <ColorChip name="Primary dark" value={t.primaryDark}/>
            <ColorChip name="Accent" value={t.accent}/>
            <ColorChip name="Success" value={t.success}/>
            <ColorChip name="Error" value={t.error}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginTop: 12 }}>
            <ColorChip name="Background" value={t.bg}/>
            <ColorChip name="Surface" value={t.surface}/>
            <ColorChip name="Surface variant" value={t.surfaceVariant}/>
            <ColorChip name="Border" value={t.border}/>
            <ColorChip name="Text primary" value={t.textPrimary}/>
            <ColorChip name="Text secondary" value={t.textSecondary}/>
          </div>
          {/* Status palette */}
          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Order status palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {Object.entries(window.KdelTokens.status).map(([k, v]) => (
                <div key={k} style={{ background: t.surface, borderRadius: 12, padding: 12, border: dark ? `1px solid ${t.border}` : 'none', boxShadow: dark ? 'none' : t.shadowSm }}>
                  <StatusChip status={k}/>
                  <div style={{ marginTop: 10, fontSize: 11, fontFamily: 'ui-monospace, Menlo, monospace', color: t.textSecondary }}>{k}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Typography */}
        <Section title="03 · Type" subtitle="Inter — high-legibility on small screens. Tight tracking on large sizes.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, background: t.surface, padding: 24, borderRadius: 16, border: dark ? `1px solid ${t.border}` : 'none' }}>
            <TypeRow name="Headline large" specs="28 / 34 · Bold" style={{ fontSize: 28, fontWeight: 700, lineHeight: '34px', letterSpacing: '-0.02em' }}>Fast delivery, right to your door</TypeRow>
            <TypeRow name="Headline medium" specs="24 / 30 · Bold" style={{ fontSize: 24, fontWeight: 700, lineHeight: '30px', letterSpacing: '-0.01em' }}>Track your order in real time</TypeRow>
            <TypeRow name="Headline small" specs="20 / 26 · SemiBold" style={{ fontSize: 20, fontWeight: 600, lineHeight: '26px' }}>Al-Mansour Grill</TypeRow>
            <TypeRow name="Title large" specs="18 / 24 · SemiBold" style={{ fontSize: 18, fontWeight: 600, lineHeight: '24px' }}>Mixed Grill Platter</TypeRow>
            <TypeRow name="Body large" specs="16 / 24 · Regular" style={{ fontSize: 16, fontWeight: 400, lineHeight: '24px' }}>Lamb chops, kafta, chicken shish, rice & salad</TypeRow>
            <TypeRow name="Body medium" specs="14 / 20 · Regular" style={{ fontSize: 14, fontWeight: 400, lineHeight: '20px' }}>Delivered within 25–35 minutes from order placement</TypeRow>
            <TypeRow name="Label large" specs="14 / 20 · SemiBold" style={{ fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>Add to cart — ₪38.00</TypeRow>
            <TypeRow name="Caption" specs="12 / 16 · Regular" style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px', color: t.textSecondary }}>Last updated 2 min ago · 1.4 km away</TypeRow>
          </div>
        </Section>

        {/* Spacing & radius */}
        <Section title="04 · Spacing & shape" subtitle="8 px base grid. Six radius tokens span chips through bottom sheets.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: t.surface, padding: 20, borderRadius: 16, border: dark ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Spacing</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['xs', 4], ['sm', 8], ['md', 16], ['lg', 24], ['xl', 32], ['2xl', 40], ['3xl', 48]].map(([n, v]) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 13 }}>
                    <span style={{ width: 36, color: t.textSecondary, fontFamily: 'ui-monospace, Menlo, monospace' }}>{n}</span>
                    <div style={{ width: v, height: 14, background: t.primary, borderRadius: 2 }}/>
                    <span style={{ color: t.textPrimary, fontFamily: 'ui-monospace, Menlo, monospace' }}>{v}px</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: t.surface, padding: 20, borderRadius: 16, border: dark ? `1px solid ${t.border}` : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>Radius</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[['xs', 6], ['sm', 8], ['md', 12], ['lg', 16], ['xl', 20], ['full', 9999]].map(([n, v]) => (
                  <div key={n} style={{ textAlign: 'center' }}>
                    <div style={{ width: '100%', height: 64, background: hexToRgba(t.primary, 0.16), borderRadius: v }}/>
                    <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 6, fontFamily: 'ui-monospace, Menlo, monospace' }}>{n} · {v === 9999 ? '∞' : v + 'px'}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 22, marginBottom: 12 }}>Elevation</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {['shadowSm', 'shadowMd', 'shadowLg'].map(s => (
                  <div key={s} style={{ height: 64, background: t.surface, borderRadius: 12, boxShadow: t[s], border: dark ? `1px solid ${t.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: t.textSecondary, fontFamily: 'ui-monospace, Menlo, monospace' }}>
                    {s.replace('shadow', '').toLowerCase()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* Components */}
        <Section title="05 · Components" subtitle="Every state, light and dark. Touch targets ≥ 48 px.">
          {/* Buttons */}
          <ComponentBlock title="Buttons">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <Button variant="primary">Primary</Button>
              <Button variant="primary" loading>Loading</Button>
              <Button variant="primary" disabled>Disabled</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Text</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="primary" icon="plus">With icon</Button>
              <button style={{ width: 48, height: 48, borderRadius: 999, border: 'none', background: t.primary, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={20} color="#fff"/>
              </button>
            </div>
          </ComponentBlock>
          {/* Inputs */}
          <ComponentBlock title="Inputs">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 720 }}>
              <Input icon="search" placeholder="Search restaurants or dishes..."/>
              <Input prefix="🇮🇱  +972" placeholder="52-000-0000"/>
              <Input icon="pin" placeholder="Delivery address"/>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} style={{
                    width: 44, height: 52, borderRadius: 10,
                    background: t.surfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: i === 3 ? `1.5px solid ${t.primary}` : '1.5px solid transparent',
                    fontSize: 18, fontWeight: 700, color: t.textPrimary, fontVariantNumeric: 'tabular-nums',
                  }}>{i <= 2 ? ['4', '7'][i - 1] : ''}</div>
                ))}
              </div>
            </div>
          </ComponentBlock>
          {/* Status chips */}
          <ComponentBlock title="Status chips">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.keys(window.KdelTokens.status).map(s => <StatusChip key={s} status={s}/>)}
            </div>
          </ComponentBlock>
          {/* Cards */}
          <ComponentBlock title="Cards">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 880 }}>
              <RestaurantRow r={RESTAURANTS[0]}/>
              <RestaurantRow r={RESTAURANTS[1]}/>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 880 }}>
              <FeaturedRestaurantCard r={RESTAURANTS[2]}/>
              <FeaturedRestaurantCard r={RESTAURANTS[0]}/>
              <FeaturedRestaurantCard r={RESTAURANTS[1]}/>
            </div>
          </ComponentBlock>
          {/* Bottom nav */}
          <ComponentBlock title="Bottom navigation">
            <div style={{ width: 380, borderRadius: 16, overflow: 'hidden', border: `1px solid ${t.border}` }}>
              <BottomNav active="home" cartCount={3}/>
            </div>
          </ComponentBlock>
          {/* Stepper */}
          <ComponentBlock title="Order timeline">
            <div style={{ background: t.surface, padding: 20, borderRadius: 16, border: dark ? `1px solid ${t.border}` : 'none', maxWidth: 420 }}>
              <TimelineStep step={{ label: 'Order placed', time: '10:00' }} state="done"/>
              <TimelineStep step={{ label: 'Restaurant accepted', time: '10:02' }} state="done"/>
              <TimelineStep step={{ label: 'Preparing your order', time: 'Started 10:03' }} state="active"/>
              <TimelineStep step={{ label: 'Driver assigned', time: 'Pending' }} state="pending"/>
              <TimelineStep step={{ label: 'Delivered', time: 'Pending' }} state="pending" isLast/>
            </div>
          </ComponentBlock>
          {/* Toast / banner */}
          <ComponentBlock title="Feedback">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
              <Toast type="success" msg="Order placed successfully"/>
              <Toast type="error" msg="Couldn't connect to restaurant"/>
              <Toast type="warning" msg="Restaurant is busy — expect 5–10 min extra"/>
              <Toast type="info" msg="A new driver was assigned"/>
              <div style={{ background: t.error, color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="wifi-off" size={16} color="#fff"/> No internet connection
              </div>
            </div>
          </ComponentBlock>
        </Section>

        {/* Currency / locale */}
        <Section title="06 · Locale" subtitle="Israel-specific formatting. Symbol always before amount, no space.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <FormatChip label="Currency" value="₪89.00"/>
            <FormatChip label="Free delivery" value="Free"/>
            <FormatChip label="Distance" value="1.4 km away"/>
            <FormatChip label="ETA" value="~25 min"/>
            <FormatChip label="Phone" value="+972 52-401-2233"/>
            <FormatChip label="Time" value="22:30"/>
            <FormatChip label="Order id" value="KD-20260507-0142"/>
            <FormatChip label="Relative" value="2 min ago"/>
          </div>
        </Section>
      </ThemeProvider>
    </div>
  );
};

const Section = ({ title, subtitle, children }) => {
  const { t } = useTheme();
  return (
    <div style={{ marginTop: 56 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingBottom: 18, borderBottom: `1px solid ${t.border}` }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.textPrimary, letterSpacing: '-0.01em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 4, maxWidth: 540 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ marginTop: 24 }}>{children}</div>
    </div>
  );
};

const ComponentBlock = ({ title, children }) => {
  const { t } = useTheme();
  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
};

const SwatchCard = ({ label, sub, children }) => {
  const { t, mode } = useTheme();
  return (
    <div style={{ background: t.surface, borderRadius: 14, padding: 14, border: mode === 'dark' ? `1px solid ${t.border}` : 'none', boxShadow: mode === 'dark' ? 'none' : t.shadowSm }}>
      {children}
      <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginTop: 10 }}>{label}</div>
      <div style={{ fontSize: 11, color: t.textSecondary, marginTop: 1 }}>{sub}</div>
    </div>
  );
};

const ColorChip = ({ name, value }) => {
  const { t, mode } = useTheme();
  // Determine if light or dark needs inverse text
  const needsLight = isLightColor(value) ? false : true;
  return (
    <div style={{ background: t.surface, borderRadius: 12, overflow: 'hidden', border: mode === 'dark' ? `1px solid ${t.border}` : 'none', boxShadow: mode === 'dark' ? 'none' : t.shadowSm }}>
      <div style={{ height: 64, background: value }}/>
      <div style={{ padding: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: t.textPrimary }}>{name}</div>
        <div style={{ fontSize: 11, color: t.textSecondary, fontFamily: 'ui-monospace, Menlo, monospace', marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
};

const isLightColor = (hex) => {
  const h = hex.replace('#', '');
  if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) > 160;
};

const TypeRow = ({ name, specs, style, children }) => {
  const { t } = useTheme();
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 100px 1fr', alignItems: 'baseline', gap: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: t.textSecondary }}>{name}</div>
      <div style={{ fontSize: 11, color: t.textTertiary, fontFamily: 'ui-monospace, Menlo, monospace' }}>{specs}</div>
      <div style={{ color: t.textPrimary, ...style }}>{children}</div>
    </div>
  );
};

const Toast = ({ type, msg }) => {
  const { t, mode } = useTheme();
  const colors = {
    success: { bg: t.success, icon: 'check-circle' },
    error: { bg: t.error, icon: 'alert' },
    warning: { bg: t.warning, icon: 'alert' },
    info: { bg: '#3B82F6', icon: 'info' },
  }[type];
  return (
    <div style={{
      background: mode === 'dark' ? hexToRgba(colors.bg, 0.18) : hexToRgba(colors.bg, 0.1),
      border: `1px solid ${hexToRgba(colors.bg, 0.4)}`,
      padding: '12px 14px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Icon name={colors.icon} size={18} color={colors.bg}/>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary }}>{msg}</div>
    </div>
  );
};

const FormatChip = ({ label, value }) => {
  const { t, mode } = useTheme();
  return (
    <div style={{ background: t.surface, padding: 14, borderRadius: 12, border: mode === 'dark' ? `1px solid ${t.border}` : 'none', boxShadow: mode === 'dark' ? 'none' : t.shadowSm }}>
      <div style={{ fontSize: 11, color: t.textSecondary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: t.textPrimary, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
};

window.DSPage = DSPage;
