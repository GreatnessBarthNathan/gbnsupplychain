import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, money, stages, whatsappLink } from '../api';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';

const nextByStage = {
  new: ['activated'],
  activated: ['in_transit', 'failed'],
  in_transit: ['at_state', 'failed'],
  at_state: ['delivered', 'failed', 'returning'],
  delivered: ['transferred'],
  failed: ['returning'],
  returning: ['returned'],
  transferred: []
};

const activeFilters = [
  ['all', 'Active orders'],
  ['new', 'New'],
  ['activated', 'Activated'],
  ['in_transit', 'In transit'],
  ['at_state', 'With rider'],
  ['delivered', 'Delivered'],
  ['returning', 'Returning'],
  ['returned', 'Returned']
];
const completedFilters = [
  ['all', 'All completed'],
  ['transferred', 'Transferred to account'],
  ['failed', 'Failed']
];

export default function Orders({ completed = false }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [riders, setRiders] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [rerouting, setRerouting] = useState(null);
  const [stockAssignment, setStockAssignment] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedTrackingLink, setCopiedTrackingLink] = useState('');
  const filter = searchParams.get('stage') || 'all';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const search = searchParams.get('q') || '';

  function load() {
    setLoading(true);
    setError('');
    const query = new URLSearchParams(searchParams);
    query.set('completed', String(completed));
    Promise.all([api(`/orders?${query.toString()}`), api('/riders')])
      .then(([orderData, riderData]) => {
        setOrders(orderData.orders);
        setTotalOrders(orderData.total);
        setTotalPages(orderData.pages);
        setRiders(riderData);
        if (orderData.page !== page) {
          setSearchParams((current) => {
            const updated = new URLSearchParams(current);
            updated.set('page', String(orderData.page));
            return updated;
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [searchParams, completed]);

  function updateFilter(stage) {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      if (stage === 'all') updated.delete('stage');
      else updated.set('stage', stage);
      updated.set('page', '1');
      return updated;
    });
    setEditing(null);
  }

  function updateSearch(value) {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      if (value) updated.set('q', value);
      else updated.delete('q');
      updated.set('page', '1');
      return updated;
    });
  }

  function changePage(nextPage) {
    setSearchParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set('page', String(nextPage));
      return updated;
    });
  }

  const visible = orders;
  const editingOrder = editing && orders.find((order) => order._id === editing.id);
  const eligibleRiders = editingOrder?.state
    ? riders.filter((rider) => rider.active
      && rider.state?.trim().toLowerCase() === editingOrder.state.trim().toLowerCase())
    : [];

  async function saveStage(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${editing.id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({
          stage: editing.stage,
          riderId: editing.riderId,
          note: editing.note,
          ...(editing.stage === 'transferred' ? { serviceCharge: editing.serviceCharge } : {})
        })
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyTrackingLink(orderNumber) {
    const trackingLink = new URL(`/track/${encodeURIComponent(orderNumber)}`, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(trackingLink);
      setCopiedTrackingLink(orderNumber);
    } catch (err) {
      setError(`Unable to copy tracking link: ${err.message}`);
    }
  }

  async function openReroute(order) {
    setError('');
    setBusy(true);
    try {
      const options = await api(`/orders/${order._id}/reroute-options`);
      setRerouting({ order, options, targetOrderId: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function transferFailedParcel(event) {
    event.preventDefault();
    if (!rerouting?.targetOrderId) {
      setError('Choose an open customer order for this parcel.');
      return;
    }
    const target = rerouting.options.find((option) => option._id === rerouting.targetOrderId);
    if (!window.confirm(`Assign this parcel to ${target?.customerName || 'the selected customer'}’s existing order? The failed order will remain in history.`)) return;
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${rerouting.order._id}/redirect`, {
        method: 'POST',
        body: JSON.stringify({ targetOrderId: rerouting.targetOrderId })
      });
      setRerouting(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function assignFromStock(event) {
    event.preventDefault();
    if (!stockAssignment?.riderId) {
      setError('Choose a rider with enough available product stock.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${stockAssignment.order._id}/assign-from-stock`, {
        method: 'POST',
        body: JSON.stringify({ riderId: stockAssignment.riderId })
      });
      setStockAssignment(null);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-toolbar order-toolbar"><p className="subtle-copy">{completed ? 'Review transferred and failed COD orders.' : 'Track active COD orders from confirmation through delivery.'}</p><label className="search-field"><span>⌕</span><input aria-label="Search orders" value={search} onChange={(e) => updateSearch(e.target.value)} placeholder="Find an order…" /></label></div>
      {error && <div className="form-error">{error}</div>}
      <div className="filter-tabs">{(completed ? completedFilters : activeFilters).map(([id, label]) =>
        <button key={id} className={filter === id ? 'selected' : ''} onClick={() => updateFilter(id)}>{label}</button>
      )}</div>
      <div className="table-wrap orders-table-wrap"><table><thead><tr><th>ORDER / DATE</th><th>CUSTOMER</th><th>PRODUCT</th><th>DESTINATION</th><th>QTY</th><th>COD AMOUNT</th><th>STATUS</th><th>CUSTOMER TRACKING</th><th></th></tr></thead>
        <tbody>{loading ? <tr><td className="table-empty" colSpan="9"><LoadingIndicator message="Loading orders…" /></td></tr> : visible.length ? visible.map((order) => <tr key={order._id}>
          <td><strong className="order-id">{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></td>
          <td><strong>{order.customerName}</strong><small>{order.phone}</small>{order.whatsapp && <small><a className="whatsapp-link" href={whatsappLink(order.whatsapp)} target="_blank" rel="noreferrer">WhatsApp {order.whatsapp} ↗</a></small>}</td><td>{order.funnel?.productName || 'Product'}</td>
          <td className="order-destination"><strong>{order.address}</strong><small>{[order.city, order.state].filter(Boolean).join(', ')}</small></td>
          <td>{order.quantity}</td><td>{money(order.total, order.funnel?.currency)}{order.stage === 'transferred' && <small>Rider charge: {money(order.remittanceServiceCharge, order.funnel?.currency)}<br />Transferred: {money(order.remittedAmount, order.funnel?.currency)}<br />Recorded: {new Date(order.remittedAt).toLocaleDateString()}</small>}</td>
          <td><StatusBadge stage={order.stage} />{order.rider && <small className="rider-subline">{order.rider.name} · {[order.rider.city, order.rider.state].filter(Boolean).join(', ')}</small>}{order.stockRestocked && <small>Product returned to rider stock</small>}{order.redirectedTo && <small>Parcel transferred to {order.redirectedTo.orderNumber}</small>}{order.redirectedFrom && <small>Parcel rerouted from {order.redirectedFrom.orderNumber}</small>}</td>
          <td className="tracking-link-cell"><a href={`/track/${encodeURIComponent(order.orderNumber)}`} target="_blank" rel="noreferrer">Track order ↗</a><button type="button" onClick={() => copyTrackingLink(order.orderNumber)}>{copiedTrackingLink === order.orderNumber ? 'Copied!' : 'Copy link'}</button></td>
          <td>{order.redirectedTo ? <small className="transferred-order-note">Parcel transferred · no further action</small> : <>{order.stage === 'activated' && <button className="row-action" onClick={() => setStockAssignment({ order, riderId: '' })}>Assign from rider stock →</button>}{order.stage === 'failed' && order.rider && !order.stockRestocked && <button className="row-action" disabled={busy} onClick={() => openReroute(order)}>Transfer parcel →</button>}{order.stockRestocked && <><small className="transferred-order-note">Product returned to rider stock.</small><button className="row-action" onClick={() => setEditing({ id: order._id, stage: 'returning', riderId: '', note: '', serviceCharge: '' })}>Return stock to supplier →</button></>}{nextByStage[order.stage]?.length > 0 && !(order.stage === 'failed' && order.stockRestocked) && (order.stage !== 'delivered' || isAdmin) && <button className="row-action" onClick={() => setEditing({ id: order._id, stage: nextByStage[order.stage][0], riderId: '', note: '', serviceCharge: '' })}>{order.stage === 'delivered' ? 'Record transfer' : 'Move order'} <span>→</span></button>}</>}</td>
        </tr>) : <tr><td className="table-empty" colSpan="9">{search ? 'No orders match your search.' : completed ? 'No completed orders in this stage yet.' : 'No active orders in this stage yet.'}</td></tr>}</tbody>
      </table></div>
      {totalOrders > 0 && <nav className="orders-pagination" aria-label="Order pages">
        <span>Showing {((page - 1) * (completed ? 20 : 10)) + 1}–{Math.min(page * (completed ? 20 : 10), totalOrders)} of {totalOrders}</span>
        <div>
          <button type="button" className="button secondary" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" className="button secondary" disabled={page >= totalPages} onClick={() => changePage(page + 1)}>Next</button>
        </div>
      </nav>}
      {editing && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><section className="modal-card stage-modal">
        <button className="modal-close" aria-label="Close" onClick={() => setEditing(null)}>×</button><p className="eyebrow">KEEP THE PROMISE MOVING</p><h2>{editing.stage === 'transferred' ? 'Record transfer to your account' : 'Update order status'}</h2><p className="modal-description">Choose the next step. Orders with a dispatch rider are counted in that rider’s bag until delivery is confirmed.</p>
        <form className="form-stack" onSubmit={saveStage}>
          <label>Move to<select required value={editing.stage} onChange={(e) => setEditing({ ...editing, stage: e.target.value, riderId: '' })}>{(nextByStage[orders.find((order) => order._id === editing.id)?.stage] || []).map((id) => <option key={id} value={id}>{stages.find((item) => item.id === id)?.label}</option>)}</select></label>
          {editing.stage === 'at_state' && <label>Dispatch rider<select required value={editing.riderId} onChange={(e) => setEditing({ ...editing, riderId: e.target.value })}><option value="">Choose a rider in {editingOrder?.state || 'the destination state'}</option>{eligibleRiders.map((rider) => <option key={rider._id} value={rider._id}>{rider.name} · {[rider.city, rider.state].filter(Boolean).join(', ')} · {rider.inventory} items with them</option>)}</select>{eligibleRiders.length === 0 && <small>No active riders are registered in {editingOrder?.state || 'the destination state'}. Add an active rider in that state first.</small>}</label>}
          {editing.stage === 'transferred' && <><p className="modal-description">Enter the agreed rider charge. The amount to transfer is calculated from the COD total of {money(editingOrder?.total, editingOrder?.funnel?.currency)}.</p><label>Rider service charge<input required type="number" min="0" max={editingOrder?.total} step="0.01" value={editing.serviceCharge} onChange={(e) => setEditing({ ...editing, serviceCharge: e.target.value })} placeholder="Enter charge" /></label>{editing.serviceCharge !== '' && <p className="modal-description">Amount transferred to your account: {money(Math.max(0, Number(editingOrder?.total || 0) - Number(editing.serviceCharge || 0)), editingOrder?.funnel?.currency)}</p>}</>}
          <label>Update note <span className="optional">OPTIONAL</span><textarea maxLength="500" rows="2" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} placeholder="Add a useful handover or delivery note" /></label>
          {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? 'Saving…' : editing.stage === 'transferred' ? 'Confirm transfer received' : 'Save order update'} <span>→</span></button></div>
        </form>
      </section></div>}
      {rerouting && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setRerouting(null)}><section className="modal-card stage-modal">
        <button className="modal-close" aria-label="Close" onClick={() => setRerouting(null)}>×</button><p className="eyebrow">FAILED DELIVERY</p><h2>Transfer parcel to another customer</h2><p className="modal-description">Choose an open order for the same product and quantity in {rerouting.order.state}. The parcel stays with rider {rerouting.order.rider?.name || ''}.</p>
        <form className="form-stack" onSubmit={transferFailedParcel}>
          <label>Matching customer order<select required value={rerouting.targetOrderId} onChange={(event) => setRerouting({ ...rerouting, targetOrderId: event.target.value })}><option value="">Choose an open order</option>{rerouting.options.map((option) => <option key={option._id} value={option._id}>{option.customerName} · {option.orderNumber} · {option.city}</option>)}</select></label>
          {!rerouting.options.length && <small>No open order for the same product and quantity was found in this state.</small>}
          {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setRerouting(null)}>Cancel</button><button className="button primary" disabled={busy || !rerouting.options.length}>{busy ? 'Transferring…' : 'Transfer parcel'} <span>→</span></button></div>
        </form>
      </section></div>}
      {stockAssignment && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setStockAssignment(null)}><section className="modal-card stage-modal">
        <button className="modal-close" aria-label="Close" onClick={() => setStockAssignment(null)}>×</button><p className="eyebrow">FULFIL FROM LOCAL STOCK</p><h2>Assign order to a rider</h2><p className="modal-description">{stockAssignment.order.quantity} × {stockAssignment.order.funnel?.productName || 'Product'} for {stockAssignment.order.city}, {stockAssignment.order.state}. This will reserve those units from the rider’s available stock.</p>
        <form className="form-stack" onSubmit={assignFromStock}>
          <label>Rider with enough stock<select required value={stockAssignment.riderId} onChange={(event) => setStockAssignment({ ...stockAssignment, riderId: event.target.value })}><option value="">Choose a rider</option>{riders.filter((rider) => rider.active && rider.state?.trim().toLocaleLowerCase() === stockAssignment.order.state?.trim().toLocaleLowerCase() && rider.stock?.some((stock) => (stock.funnel?._id || stock.funnel) === (stockAssignment.order.funnel?._id || stockAssignment.order.funnel) && stock.quantity >= stockAssignment.order.quantity)).map((rider) => {
            const stock = rider.stock.find((item) => (item.funnel?._id || item.funnel) === (stockAssignment.order.funnel?._id || stockAssignment.order.funnel));
            return <option key={rider._id} value={rider._id}>{rider.name} · {stock.quantity} available</option>;
          })}</select></label>
          {!riders.some((rider) => rider.active && rider.state?.trim().toLocaleLowerCase() === stockAssignment.order.state?.trim().toLocaleLowerCase() && rider.stock?.some((stock) => (stock.funnel?._id || stock.funnel) === (stockAssignment.order.funnel?._id || stockAssignment.order.funnel) && stock.quantity >= stockAssignment.order.quantity)) && <small>No active rider in this state has enough available stock for this product.</small>}
          {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setStockAssignment(null)}>Cancel</button><button className="button primary" disabled={busy || !stockAssignment.riderId}>{busy ? 'Assigning…' : 'Assign order'} <span>→</span></button></div>
        </form>
      </section></div>}
    </div>
  );
}
