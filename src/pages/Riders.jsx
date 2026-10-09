import { useEffect, useState } from 'react';
import { api } from '../api';
import LoadingIndicator from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';
import nigerianStates from '../../shared/nigerianStates.json';

const initial = { name: '', phone: '', city: '', state: '', active: true };
const initialStock = { funnelId: '', quantity: '' };

export default function Riders() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [riders, setRiders] = useState([]);
  const [funnels, setFunnels] = useState([]);
  const [form, setForm] = useState(initial);
  const [stockForm, setStockForm] = useState(initialStock);
  const [stockRider, setStockRider] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([api('/riders'), api('/funnels')])
      .then(([riderData, funnelData]) => { setRiders(riderData); setFunnels(funnelData); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openAddForm() {
    setEditingId('');
    setForm(initial);
    setError('');
    setShowForm(true);
  }

  function openEditForm(rider) {
    setEditingId(rider._id);
    setForm({
      name: rider.name,
      phone: rider.phone,
      city: rider.city || '',
      state: rider.state || '',
      active: rider.active
    });
    setError('');
    setShowForm(true);
  }

  async function saveRider(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(editingId ? `/riders/${editingId}` : '/riders', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(form)
      });
      setForm(initial);
      setEditingId('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendStock(event) {
    event.preventDefault();
    if (!isAdmin) {
      setError('Only an admin can record products sent to a rider.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/riders/${stockRider._id}/stock`, {
        method: 'POST',
        body: JSON.stringify({ funnelId: stockForm.funnelId, quantity: Number(stockForm.quantity) })
      });
      setStockRider(null);
      setStockForm(initialStock);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmStockReceipt(rider, transfer) {
    if (!window.confirm(`Confirm that ${rider.name} has received ${transfer.quantity} × ${transfer.funnel?.productName || 'product'}?`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/riders/${rider._id}/stock-transfers/${transfer._id}/receive`, { method: 'PATCH' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-toolbar"><p className="subtle-copy">See who’s carrying each parcel and how many items are still in their hands.</p>{isAdmin && <button className="button primary" onClick={openAddForm}><span>＋</span> Add dispatch rider</button>}</div>
      {error && <div className="form-error">{error}</div>}
      <section className="rider-note"><span>⌖</span><div><strong>A clear handover makes a better delivery.</strong><p>Record product stock sent to a rider here. Assign confirmed orders from their available stock in Orders; active delivery counts update automatically as orders are assigned and completed.</p></div></section>
      <div className="rider-grid">{loading ? <LoadingIndicator message="Loading riders…" /> : riders.map((rider, index) => <article className="rider-card" key={rider._id}>
        <div className="rider-card-top"><span className={`avatar rider-avatar rider-color-${index % 4}`}>{rider.name.slice(0, 1).toUpperCase()}</span><span className="active-mark"><i /> {rider.active ? 'On the team' : 'Inactive'}</span>{isAdmin && <button type="button" className="icon-button small-button" title="Edit rider" aria-label={`Edit ${rider.name}`} onClick={() => openEditForm(rider)}>✎</button>}</div>
        <h3>{rider.name}</h3><a className="rider-phone" href={`tel:${rider.phone}`}>{rider.phone} <span>↗</span></a>
        <div className="rider-location"><span>⌖</span> {[rider.city, rider.state].filter(Boolean).join(', ') || 'Location not set'}</div>
        {rider.accessToken && <div className="rider-portal-actions"><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/rider/${rider.accessToken}`)}>Copy rider portal link</button><a href={`https://wa.me/${rider.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${rider.name}, use this secure link to view your active GBN Supply Chain deliveries and update delivery outcomes: ${window.location.origin}/rider/${rider.accessToken}`)}`} target="_blank" rel="noreferrer">Share via WhatsApp ↗</a></div>}
        <div className="rider-inventory"><div><strong>{rider.inventory}</strong><span>items in rider’s possession</span></div><div className="inventory-icon">▣</div><small>{rider.availableStockItems} available + {rider.assignedDeliveryItems} on delivery</small></div>
        <div className="rider-stock"><div className="section-heading"><strong>Product inventory</strong>{isAdmin && <button type="button" className="row-action" disabled={!rider.active} onClick={() => { setStockRider(rider); setStockForm(initialStock); setError(''); }}>Record stock sent +</button>}</div>
          <small>In transit to rider</small>{rider.inTransitStock?.length ? rider.inTransitStock.map((item) => <div className="rider-stock-item" key={item._id}><span>{item.quantity} × {item.funnel?.productName || 'Product'}</span><button type="button" className="row-action" disabled={busy} onClick={() => confirmStockReceipt(rider, item)}>Confirm rider receipt</button></div>) : <small>No shipments in transit.</small>}
          <small>Available with rider</small>{rider.stock?.length ? rider.stock.map((item) => <div className="rider-stock-item" key={item.funnel?._id}><span>{item.funnel?.productName || 'Product'}</span><strong>{item.quantity} available</strong></div>) : <small>No received product stock available.</small>}
        </div>
      </article>)}
      {!loading && !error && riders.length === 0 && isAdmin && <div className="empty-card"><span>⌖</span><h3>Meet your delivery team</h3><p>Add your first rider. Their current parcels will be counted as orders are handed over.</p><button className="button primary" onClick={openAddForm}>Add a rider <span>→</span></button></div>}</div>      {showForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><section className="modal-card">
        <button className="modal-close" aria-label="Close" onClick={() => setShowForm(false)}>×</button><p className="eyebrow">YOUR LAST-MILE TEAM</p><h2>{editingId ? 'Edit dispatch rider' : 'Add a dispatch rider'}</h2><p className="modal-description">Keep their contact and coverage details close to the orders they carry.</p>
        <form className="form-stack" onSubmit={saveRider}>
          <label>Rider name<input required maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" /></label>
          <label>Phone number<input required type="tel" maxLength="24" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+234 800 000 0000" /></label>
          <label>Primary state<select required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}><option value="">Select state</option>{nigerianStates.map((state) => <option key={state} value={state}>{state === 'FCT' ? 'Federal Capital Territory (FCT)' : state}</option>)}</select></label>
          <label>Primary city / town<input required maxLength="100" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Enter primary city or town" /></label>
          {editingId && <label>Rider status<select value={form.active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, active: e.target.value === 'active' })}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}
          {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? (editingId ? 'Saving…' : 'Adding…') : editingId ? 'Save changes' : 'Add rider'} <span>→</span></button></div>
        </form>
      </section></div>}
      {stockRider && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setStockRider(null)}><section className="modal-card">
        <button className="modal-close" aria-label="Close" onClick={() => setStockRider(null)}>×</button><p className="eyebrow">LOCAL RIDER STOCK</p><h2>Record products sent to {stockRider.name}</h2><p className="modal-description">This records a shipment as in transit. It becomes available for order assignment after the rider confirms receipt in their portal.</p>
        <form className="form-stack" onSubmit={sendStock}>
          <label>Product<select required value={stockForm.funnelId} onChange={(event) => setStockForm({ ...stockForm, funnelId: event.target.value })}><option value="">Select a product</option>{funnels.filter((funnel) => funnel.active).map((funnel) => <option key={funnel._id} value={funnel._id}>{funnel.productName}</option>)}</select>{!funnels.some((funnel) => funnel.active) && <small>Create an active product funnel before recording stock.</small>}</label>
          <label>Quantity sent<input required type="number" min="1" max="10000" step="1" value={stockForm.quantity} onChange={(event) => setStockForm({ ...stockForm, quantity: event.target.value })} placeholder="Enter units sent" /></label>
          {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setStockRider(null)}>Cancel</button><button className="button primary" disabled={busy || !funnels.some((funnel) => funnel.active)}>{busy ? 'Saving…' : 'Mark as in transit'} <span>→</span></button></div>
        </form>
      </section></div>}
    </div>
  );
}
