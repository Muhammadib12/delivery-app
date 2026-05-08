/* global React */
const { useState: useStateT, useEffect: useEffectT, useRef: useRefT } = React;

// ===== ORDER CONFIRMATION SCREEN =====
const ConfirmationScreen = ({ orderId, onTrack, onHome, rtl }) => {
  const { t, mode } = useTheme();
  return (
    <div style={{ background: t.bg, height: '100%', display: 'flex', flexDirection: 'column', direction: rtl ? 'rtl' : 'ltr' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
        {/* big animated check */}
        <div style={{ position: 'relative', width: 140, height: 140, marginBottom: 24 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 999, background: hexToRgba(t.primary, mode === 'dark' ? 0.16 : 0.08), animation: 'kpulse 2.6s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', inset: 14, borderRadius: 999, background: hexToRgba(t.primary, mode === 'dark' ? 0.22 : 0.16) }}/>
          <div style={{ position: 'absolute', inset: 28, borderRadius: 999, background: t.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 28px rgba(27,107,58,0.35)' }}>
            <svg width="56" height="56" viewBox="0 0 56 56">
              <path d="M14 28 L24 38 L42 18" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 60, strokeDashoffset: 0, animation: 'kdraw 600ms ease-out 100ms backwards' }}/>
            </svg>
          </div>
        </div>
        <style>{`@keyframes kdraw { from { stroke-dashoffset: 60; } to { stroke-dashoffset: 0; } }`}</style>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: t.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>Order placed!</h1>
        <div style={{ fontSize: 14, fontWeight: 600, color: t.textSecondary, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{orderId || '#KD-20260507-0142'}</div>
        <div style={{ fontSize: 15, color: t.textPrimary, marginTop: 16, lineHeight: 1.5, maxWidth: 280 }}>
          <b>Al-Mansour Grill</b> has received your order
        </div>
        <Card style={{ marginTop: 28, width: '100%', maxWidth: 320 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, background: hexToRgba(t.warning, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="clock" size={20} color={t.warning}/>
            </div>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 500 }}>Estimated delivery</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, marginTop: 2 }}>35–45 min</div>
            </div>
          </div>
          <Divider style={{ margin: '14px 0' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: 999, background: t.warning, animation: 'kpulse 1.4s ease-in-out infinite' }}/>
            <div style={{ fontSize: 13, color: t.textSecondary, textAlign: 'left' }}>Waiting for restaurant confirmation...</div>
          </div>
        </Card>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button variant="primary" fullWidth size="lg" onClick={onTrack}>Track my order</Button>
        <Button variant="ghost" fullWidth onClick={onHome}>Back to home</Button>
      </div>
    </div>
  );
};

// ===== ORDER TRACKING SCREEN =====
const TrackingScreen = ({ orderId, onBack, onMap, statusIndex = 2, rtl, offline }) => {
  const { t, mode } = useTheme();
  const steps = [
    { id: 'placed', label: 'Order placed', time: '10:00', icon: 'check' },
    { id: 'accepted', label: 'Restaurant accepted', time: '10:02', icon: 'check' },
    { id: 'preparing', label: 'Preparing your order', time: 'Started 10:03', icon: 'pot' },
    { id: 'driver', label: 'Driver assigned', time: 'Pending', icon: 'user' },
    { id: 'pickup', label: 'Order picked up', time: 'Pending', icon: 'bag' },
    { id: 'on-the-way', label: 'On the way', time: 'Pending', icon: 'bike' },
    { id: 'delivered', label: 'Delivered', time: 'Pending', icon: 'home' },
  ];
  const driverAssigned = statusIndex >= 3;
  return (
    <div style={{ background: t.bg, height: '100%', display: 'flex', flexDirection: 'column', direction: rtl ? 'rtl' : 'ltr' }}>
      <OfflineBanner visible={offline}/>
      <AppBar title="Track order" onBack={onBack} right={<button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, fontFamily: 'inherit' }}><Icon name="info" size={20} color={t.textSecondary}/></button>}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px 16px' }}>
        <div style={{ padding: '0 4px 16px' }}>
          <div style={{ fontSize: 12, color: t.textSecondary, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{orderId || 'KD-20260507-0142'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.textPrimary, marginTop: 2 }}>Al-Mansour Grill</div>
        </div>
        {/* ETA hero */}
        <Card style={{ background: `linear-gradient(135deg, ${t.primary}, ${t.primaryLight})`, padding: 20, position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.85)' }}>Arriving in</div>
          <div style={{ fontSize: 38, fontWeight: 800, color: '#fff', marginTop: 4, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>~25 min</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 4 }}>{steps[statusIndex]?.label || 'Preparing'}</div>
          <div style={{ position: 'absolute', right: -10, top: -10, opacity: 0.12 }}>
            <Icon name="bike" size={140} color="#fff"/>
          </div>
        </Card>
        {/* Driver card (after assigned) */}
        {driverAssigned && (
          <Card style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: 999, background: 'linear-gradient(135deg, #F39C12, #E67E22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>YH</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Yousef H.</div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>Honda PCX · 52-401-22</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: 12, color: t.textPrimary }}>
                  <Icon name="star" size={12} color={t.accent}/> 4.9 <span style={{ color: t.textSecondary, fontWeight: 400 }}>· 412 trips</span>
                </div>
              </div>
              <button style={{
                width: 44, height: 44, borderRadius: 999, border: 'none',
                background: t.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: mode === 'dark' ? '0 0 16px rgba(39,174,96,0.4)' : '0 4px 12px rgba(27,107,58,0.3)',
              }}>
                <Icon name="phone-fill" size={20} color="#fff"/>
              </button>
            </div>
            <Button variant="secondary" fullWidth onClick={onMap} icon="pin" style={{ marginTop: 12 }}>View on map</Button>
          </Card>
        )}
        {/* Timeline */}
        <Card style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary, marginBottom: 4 }}>Order progress</div>
          <div style={{ marginTop: 12 }}>
            {steps.map((step, i) => (
              <TimelineStep key={step.id} step={step} state={i < statusIndex ? 'done' : i === statusIndex ? 'active' : 'pending'} isLast={i === steps.length - 1}/>
            ))}
          </div>
        </Card>
        {/* Reconnecting (subtle) */}
        {offline && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: hexToRgba(t.warning, 0.12), display: 'flex', gap: 10, alignItems: 'center' }}>
            <Spinner color={t.warning} size={16}/>
            <div style={{ fontSize: 13, color: t.textPrimary, fontWeight: 500 }}>Reconnecting... showing last known status</div>
          </div>
        )}
        <div style={{ height: 8 }}/>
      </div>
      {statusIndex < 1 && (
        <div style={{ padding: 16, background: t.surface, borderTop: `1px solid ${t.border}` }}>
          <Button variant="destructive-outline" fullWidth>Cancel order</Button>
        </div>
      )}
    </div>
  );
};

const TimelineStep = ({ step, state, isLast }) => {
  const { t, mode } = useTheme();
  const done = state === 'done';
  const active = state === 'active';
  const dotColor = done ? t.primary : active ? t.primary : t.borderStrong;
  const labelColor = done || active ? t.textPrimary : t.textSecondary;
  return (
    <div style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
      <div style={{ position: 'relative', width: 24 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 999,
          background: done ? t.primary : active ? hexToRgba(t.primary, 0.18) : 'transparent',
          border: done ? 'none' : active ? `2px solid ${t.primary}` : `2px solid ${t.borderStrong}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', zIndex: 2,
        }}>
          {done && <Icon name="check" size={14} color="#fff" weight={3}/>}
          {active && <div style={{ width: 8, height: 8, borderRadius: 999, background: t.primary, animation: 'kpulse 1.4s ease-in-out infinite' }}/>}
        </div>
        {!isLast && (
          <div style={{
            position: 'absolute', top: 24, bottom: -16, left: '50%', width: 2, marginLeft: -1,
            background: done ? t.primary : 'transparent',
            borderLeft: done ? 'none' : `2px dashed ${t.border}`,
          }}/>
        )}
      </div>
      <div style={{ flex: 1, paddingTop: 1 }}>
        <div style={{ fontSize: 14, fontWeight: active ? 700 : 600, color: labelColor }}>{step.label}{active && '...'}</div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{step.time}</div>
      </div>
    </div>
  );
};

// ===== DRIVER LIVE TRACKING (full-bleed map) =====
const DriverMapScreen = ({ onBack, eta = 8, offline, rtl }) => {
  const { t, mode } = useTheme();
  // animate driver moving along a path
  const [progress, setProgress] = useStateT(0.18);
  useEffectT(() => {
    let raf;
    const tick = () => {
      setProgress(p => (p + 0.0008) % 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // bezier path for driver movement
  const pathPoints = [
    { x: 60, y: 600 },   // restaurant
    { x: 110, y: 520 },
    { x: 180, y: 480 },
    { x: 240, y: 400 },
    { x: 290, y: 320 },
    { x: 320, y: 220 },  // customer
  ];
  const pickPoint = (p) => {
    const i = p * (pathPoints.length - 1);
    const a = pathPoints[Math.floor(i)] || pathPoints[0];
    const b = pathPoints[Math.ceil(i)] || pathPoints[pathPoints.length - 1];
    const f = i - Math.floor(i);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  const driverPos = pickPoint(progress);

  return (
    <div style={{ background: t.bg, height: '100%', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', direction: rtl ? 'rtl' : 'ltr' }}>
      {/* Map background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <MapPattern dim={mode === 'dark'} animated/>
        {/* route path */}
        <svg viewBox="0 0 390 800" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
          <path
            d={`M ${pathPoints.map(p => `${p.x} ${p.y}`).join(' L ')}`}
            stroke={t.primary} strokeWidth="4" fill="none"
            strokeDasharray="8 6" strokeLinecap="round"
            opacity="0.85"
            style={{ animation: 'kdash-flow 1.2s linear infinite' }}
          />
          {/* restaurant */}
          <g transform={`translate(${pathPoints[0].x}, ${pathPoints[0].y})`}>
            <circle r="18" fill={t.accent} stroke="#fff" strokeWidth="3"/>
            <g transform="translate(-8,-9)">
              <Icon name="fork-knife" size={16} color="#fff"/>
            </g>
          </g>
          {/* customer */}
          <g transform={`translate(${pathPoints[pathPoints.length - 1].x}, ${pathPoints[pathPoints.length - 1].y})`}>
            <circle r="20" fill={t.primary} stroke="#fff" strokeWidth="3"/>
          </g>
          {/* driver */}
          <g transform={`translate(${driverPos.x}, ${driverPos.y})`}>
            <circle r="24" fill={t.primary} fillOpacity="0.18" style={{ animation: 'kpulse-ring 1.6s ease-out infinite' }}/>
            <circle r="18" fill={t.primary} stroke="#fff" strokeWidth="3"/>
          </g>
        </svg>
        {/* Render icons via positioned divs (better than embedded svg components) */}
        <div style={{
          position: 'absolute',
          left: `${(pathPoints[pathPoints.length - 1].x / 390) * 100}%`,
          top: `${(pathPoints[pathPoints.length - 1].y / 800) * 100}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}>
          <Icon name="home-fill" size={18} color="#fff"/>
        </div>
        <div style={{
          position: 'absolute',
          left: `${(driverPos.x / 390) * 100}%`,
          top: `${(driverPos.y / 800) * 100}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          animation: 'kdriver-bob 1.4s ease-in-out infinite',
        }}>
          <Icon name="bike" size={18} color="#fff"/>
        </div>
      </div>
      <OfflineBanner visible={offline}/>
      {/* Top bar */}
      <div style={{ position: 'relative', zIndex: 10, padding: '12px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: offline ? 32 : 0 }}>
        <button onClick={onBack} style={{
          width: 40, height: 40, borderRadius: 999, border: 'none',
          background: t.surface, boxShadow: t.shadowMd, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="arrow-left" size={20} color={t.textPrimary}/>
        </button>
        <div style={{
          height: 40, padding: '0 14px', borderRadius: 999, background: t.surface,
          boxShadow: t.shadowMd, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: 999, background: t.success, animation: 'kpulse 1.4s ease-in-out infinite' }}/>
          <span style={{ fontSize: 12, fontWeight: 600, color: t.textPrimary }}>Live</span>
        </div>
        <button style={{
          width: 40, height: 40, borderRadius: 999, border: 'none',
          background: t.surface, boxShadow: t.shadowMd, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="info" size={20} color={t.textPrimary}/>
        </button>
      </div>
      {/* Bottom card */}
      <div style={{ flex: 1 }}/>
      <div style={{
        position: 'relative', zIndex: 10,
        background: t.surface, borderRadius: '20px 20px 0 0',
        padding: '12px 20px 24px',
        boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: t.borderStrong }}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: t.textSecondary }}>Arriving in</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: t.textPrimary, marginTop: 2, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{eta} min</div>
          </div>
          <span style={{ background: hexToRgba(t.primary, mode === 'dark' ? 0.18 : 0.12), color: mode === 'dark' ? '#5DECC0' : t.primary, fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 999 }}>ON THE WAY</span>
        </div>
        <Divider style={{ margin: '14px 0' }}/>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 999, background: 'linear-gradient(135deg, #F39C12, #E67E22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, fontWeight: 700 }}>YH</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Yousef H. <span style={{ color: t.textSecondary, fontWeight: 400 }}>· Your driver</span></div>
            <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="bike" size={13} color={t.textSecondary}/> Honda PCX · <b style={{ color: t.textPrimary, fontWeight: 600 }}>52-401-22</b>
            </div>
          </div>
          <button style={{
            width: 44, height: 44, borderRadius: 999, border: 'none',
            background: t.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: mode === 'dark' ? '0 0 16px rgba(39,174,96,0.5)' : '0 4px 12px rgba(27,107,58,0.3)',
          }}>
            <Icon name="phone-fill" size={20} color="#fff"/>
          </button>
        </div>
        <div style={{ fontSize: 11, color: t.textTertiary, marginTop: 12, textAlign: 'center' }}>Last updated just now</div>
      </div>
    </div>
  );
};

window.ConfirmationScreen = ConfirmationScreen;
window.TrackingScreen = TrackingScreen;
window.DriverMapScreen = DriverMapScreen;
