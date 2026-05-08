/* global React */
const { useState: useStateP, useEffect: useEffectP } = React;

// ===== PRODUCT DETAIL BOTTOM SHEET =====
const ProductSheet = ({ product, onClose, onAdd, rtl }) => {
  const { t, mode } = useTheme();
  const p = product;
  const [size, setSize] = useStateP('m');
  const [extras, setExtras] = useStateP({});
  const [qty, setQty] = useStateP(1);
  const [notes, setNotes] = useStateP('');

  const sizes = [
    { id: 's', label: 'Small', delta: 0 },
    { id: 'm', label: 'Medium', delta: 5 },
    { id: 'l', label: 'Large', delta: 10 },
  ];
  const extrasList = [
    { id: 'sauce', label: 'Extra sauce', price: 2 },
    { id: 'cheese', label: 'Extra cheese', price: 4 },
    { id: 'pickles', label: 'Pickles', price: 1.5 },
  ];
  const sizeDelta = sizes.find(s => s.id === size).delta;
  const extrasTotal = Object.entries(extras).filter(([k, v]) => v).reduce((sum, [k]) => sum + (extrasList.find(e => e.id === k)?.price || 0), 0);
  const total = (p.price + sizeDelta + extrasTotal) * qty;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      animation: 'kfade-in 200ms',
    }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: t.scrim }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: t.surfaceElevated, borderRadius: '20px 20px 0 0',
        animation: 'kslide-up 280ms cubic-bezier(.2,.9,.2,1)',
        maxHeight: '92%', display: 'flex', flexDirection: 'column',
        direction: rtl ? 'rtl' : 'ltr',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 0' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: t.borderStrong }}/>
        </div>
        <button onClick={onClose} style={{
          position: 'absolute', top: 18, right: 16, zIndex: 2,
          width: 32, height: 32, borderRadius: 999, border: 'none',
          background: t.surfaceVariant, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="x" size={18} color={t.textPrimary}/>
        </button>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '12px 16px 0' }}>
            <FoodImg category={p.img} size={'100%'} radius={14} style={{ height: 200, width: '100%' }}/>
          </div>
          <div style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: t.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>{p.name}</h2>
                <div style={{ fontSize: 14, color: t.textSecondary, marginTop: 6, lineHeight: 1.5 }}>{p.desc}</div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: t.primary, whiteSpace: 'nowrap' }}>₪{p.price.toFixed(2)}</div>
            </div>
            {/* Size */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary }}>Choose size</div>
                <span style={{ background: hexToRgba(t.error, 0.12), color: t.error, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>REQUIRED</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sizes.map(s => (
                  <RadioRow key={s.id} active={size === s.id} onClick={() => setSize(s.id)} label={s.label} suffix={s.delta === 0 ? 'Included' : `+₪${s.delta.toFixed(2)}`}/>
                ))}
              </div>
            </div>
            {/* Extras */}
            <div style={{ marginTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary }}>Add extras</div>
                <span style={{ color: t.textSecondary, fontSize: 12 }}>Optional</span>
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {extrasList.map(e => (
                  <CheckRow key={e.id} active={!!extras[e.id]} onClick={() => setExtras(prev => ({ ...prev, [e.id]: !prev[e.id] }))} label={e.label} suffix={`+₪${e.price.toFixed(2)}`}/>
                ))}
              </div>
            </div>
            {/* Notes */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, marginBottom: 8 }}>Special instructions</div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g., No onions, extra spicy" rows={2} style={{
                width: '100%', borderRadius: 12, background: t.surfaceVariant,
                border: 'none', outline: 'none', padding: 14, color: t.textPrimary,
                fontFamily: 'inherit', fontSize: 14, resize: 'none',
              }}/>
            </div>
          </div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${t.border}`, background: t.surfaceElevated, display: 'flex', alignItems: 'center', gap: 14 }}>
          <QtyStepper value={qty} onChange={setQty}/>
          <button onClick={() => onAdd({ ...p, qty, total, size, extras })} style={{
            flex: 1, height: 52, borderRadius: 14, border: 'none',
            background: t.primary, color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px',
          }}>
            <span>Add to cart</span>
            <span>₪{total.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const RadioRow = ({ active, onClick, label, suffix }) => {
  const { t } = useTheme();
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderRadius: 12, border: `1.5px solid ${active ? t.primary : t.border}`,
      background: active ? hexToRgba(t.primary, 0.06) : 'transparent',
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 999,
        border: `2px solid ${active ? t.primary : t.borderStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <div style={{ width: 10, height: 10, borderRadius: 999, background: t.primary }}/>}
      </div>
      <div style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{label}</div>
      <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>{suffix}</div>
    </button>
  );
};

const CheckRow = ({ active, onClick, label, suffix }) => {
  const { t } = useTheme();
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
      borderRadius: 12, border: `1.5px solid ${active ? t.primary : t.border}`,
      background: active ? hexToRgba(t.primary, 0.06) : 'transparent',
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 6,
        border: `2px solid ${active ? t.primary : t.borderStrong}`,
        background: active ? t.primary : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <Icon name="check" size={14} color="#fff" weight={3}/>}
      </div>
      <div style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600, color: t.textPrimary }}>{label}</div>
      <div style={{ fontSize: 13, color: t.textSecondary, fontWeight: 500 }}>{suffix}</div>
    </button>
  );
};

// ===== CART SCREEN =====
const CartScreen = ({ items, onBack, onCheckout, onUpdateQty, onRemove, restaurant, rtl }) => {
  const { t, mode } = useTheme();
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const fee = 4;
  const total = subtotal + fee;
  return (
    <div style={{ background: t.bg, height: '100%', display: 'flex', flexDirection: 'column', direction: rtl ? 'rtl' : 'ltr' }}>
      <AppBar title="Your cart" onBack={onBack}/>
      <div style={{ padding: '8px 16px 4px' }}>
        <div style={{ fontSize: 13, color: t.textSecondary }}>From</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: t.textPrimary, marginTop: 2 }}>{restaurant?.name || 'Al-Mansour Grill'}</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {items.length === 0 ? (
          <EmptyCart/>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it, i) => (
              <Card key={i} padded={false}>
                <div style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'flex-start' }}>
                  <FoodImg category={it.img} size={64} radius={10}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{it.name}</div>
                    <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 3 }}>
                      {it.size === 's' ? 'Small' : it.size === 'l' ? 'Large' : 'Medium'}
                      {Object.entries(it.extras || {}).filter(([, v]) => v).length > 0 && ' · +Extras'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                      <QtyStepper value={it.qty} onChange={(q) => onUpdateQty(i, q)} size="sm"/>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>₪{it.total.toFixed(2)}</div>
                    </div>
                  </div>
                  <button onClick={() => onRemove(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textSecondary, padding: 0, alignSelf: 'flex-start' }}>
                    <Icon name="trash" size={18} color={t.textSecondary}/>
                  </button>
                </div>
              </Card>
            ))}
            <button onClick={onBack} style={{
              marginTop: 4, padding: '12px', fontSize: 14, fontWeight: 600,
              background: 'none', border: `1.5px dashed ${t.border}`, borderRadius: 12,
              color: t.primary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit',
            }}>
              <Icon name="plus" size={16} color={t.primary}/> Add more items
            </button>
            {/* Notes */}
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.textPrimary, marginBottom: 8 }}>Order notes</div>
              <textarea placeholder="Anything the restaurant should know?" rows={2} style={{
                width: '100%', borderRadius: 12, background: t.surfaceVariant,
                border: 'none', outline: 'none', padding: 14, color: t.textPrimary,
                fontFamily: 'inherit', fontSize: 14, resize: 'none',
              }}/>
            </div>
            {/* Breakdown */}
            <div style={{ marginTop: 8 }}>
              <Card>
                <SummaryLine label="Subtotal" value={`₪${subtotal.toFixed(2)}`}/>
                <SummaryLine label="Delivery fee" value={`₪${fee.toFixed(2)}`}/>
                <Divider style={{ margin: '10px 0' }}/>
                <SummaryLine label="Total" value={`₪${total.toFixed(2)}`} bold/>
              </Card>
            </div>
          </div>
        )}
      </div>
      {items.length > 0 && (
        <div style={{ padding: 16, background: t.surface, borderTop: `1px solid ${t.border}` }}>
          <Button variant="primary" fullWidth size="lg" onClick={onCheckout}>
            Proceed to checkout · ₪{total.toFixed(2)}
          </Button>
        </div>
      )}
    </div>
  );
};

const SummaryLine = ({ label, value, bold }) => {
  const { t } = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: bold ? 16 : 14, fontWeight: bold ? 700 : 500, color: bold ? t.textPrimary : t.textSecondary }}>
      <span>{label}</span>
      <span style={{ color: t.textPrimary }}>{value}</span>
    </div>
  );
};

const EmptyCart = () => {
  const { t } = useTheme();
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
      <div style={{ width: 80, height: 80, margin: '0 auto', borderRadius: 999, background: t.surfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bag" size={36} color={t.textSecondary}/>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: t.textPrimary, marginTop: 16 }}>Your cart is empty</div>
      <div style={{ fontSize: 14, color: t.textSecondary, marginTop: 4 }}>Browse restaurants to add items</div>
    </div>
  );
};

// ===== CHECKOUT SCREEN =====
const CheckoutScreen = ({ subtotal, onBack, onPlaceOrder, placing, rtl }) => {
  const { t, mode } = useTheme();
  const fee = 4;
  const total = subtotal + fee;
  const [pay, setPay] = useStateP('cash');
  const [summaryOpen, setSummaryOpen] = useStateP(false);
  return (
    <div style={{ background: t.bg, height: '100%', display: 'flex', flexDirection: 'column', direction: rtl ? 'rtl' : 'ltr' }}>
      <AppBar title="Checkout" onBack={onBack}/>
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
        {/* Address */}
        <SectionLabel>Delivery address</SectionLabel>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: hexToRgba(t.primary, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="home" size={20} color={t.primary}/>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Home</span>
                <span style={{ background: hexToRgba(t.primary, 0.12), color: t.primary, fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>DEFAULT</span>
              </div>
              <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>23 Jaffa St · Tel Aviv · Apt 4B</div>
            </div>
            <button style={{ background: 'none', border: 'none', color: t.primary, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Change</button>
          </div>
        </Card>
        {/* Order summary */}
        <SectionLabel>Order summary</SectionLabel>
        <Card>
          <button onClick={() => setSummaryOpen(!summaryOpen)} style={{ width: '100%', background: 'none', border: 'none', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontFamily: 'inherit' }}>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary }}>2 items · ₪{subtotal.toFixed(2)}</div>
              <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>Al-Mansour Grill</div>
            </div>
            <Icon name="chevron-down" size={18} color={t.textSecondary} style={{ transform: summaryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}/>
          </button>
          {summaryOpen && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textPrimary }}>
                <span>1× Mixed Grill Platter (M)</span><span>₪94.00</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: t.textPrimary }}>
                <span>1× Mint Lemonade</span><span>₪14.00</span>
              </div>
            </div>
          )}
        </Card>
        {/* Payment */}
        <SectionLabel>Payment method</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PayOption active={pay === 'cash'} onClick={() => setPay('cash')} icon="cash" title="Cash on delivery" subtitle={`Pay ₪${total.toFixed(2)} to driver`}/>
          <PayOption disabled icon="lock" title="Credit card" subtitle="Coming soon"/>
        </div>
        {/* Notes */}
        <SectionLabel>Delivery notes</SectionLabel>
        <textarea placeholder="Apartment, gate code, etc." rows={2} style={{
          width: '100%', borderRadius: 12, background: t.surfaceVariant,
          border: 'none', outline: 'none', padding: 14, color: t.textPrimary,
          fontFamily: 'inherit', fontSize: 14, resize: 'none',
        }}/>
        {/* Breakdown */}
        <SectionLabel>Price breakdown</SectionLabel>
        <Card>
          <SummaryLine label="Subtotal" value={`₪${subtotal.toFixed(2)}`}/>
          <SummaryLine label="Delivery fee" value={`₪${fee.toFixed(2)}`}/>
          <Divider style={{ margin: '10px 0' }}/>
          <SummaryLine label="Total" value={`₪${total.toFixed(2)}`} bold/>
        </Card>
        <div style={{ height: 24 }}/>
      </div>
      <div style={{ padding: 16, background: t.surface, borderTop: `1px solid ${t.border}` }}>
        <Button variant="primary" fullWidth size="lg" icon={placing ? null : 'lock'} loading={placing} onClick={onPlaceOrder} disabled={placing}>
          {placing ? 'Placing order...' : `Place order · ₪${total.toFixed(2)}`}
        </Button>
      </div>
    </div>
  );
};

const SectionLabel = ({ children }) => {
  const { t } = useTheme();
  return <div style={{ fontSize: 12, fontWeight: 700, color: t.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '20px 4px 10px' }}>{children}</div>;
};

const PayOption = ({ active, disabled, icon, title, subtitle, onClick }) => {
  const { t } = useTheme();
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: 14,
      borderRadius: 12, border: `1.5px solid ${active ? t.primary : t.border}`,
      background: active ? hexToRgba(t.primary, 0.06) : t.surface,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1,
      fontFamily: 'inherit',
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: t.surfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={active ? t.primary : t.textPrimary}/>
      </div>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>{title}</div>
        <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{
        width: 22, height: 22, borderRadius: 999, border: `2px solid ${active ? t.primary : t.borderStrong}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <div style={{ width: 10, height: 10, borderRadius: 999, background: t.primary }}/>}
      </div>
    </button>
  );
};

window.ProductSheet = ProductSheet;
window.CartScreen = CartScreen;
window.CheckoutScreen = CheckoutScreen;
