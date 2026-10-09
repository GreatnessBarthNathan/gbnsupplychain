import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money, whatsappLink } from '../api';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';

export default function RiderPortal() {
  const { accessToken } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRefreshing(true);
    api(`/public/riders/${accessToken}`)
      .then((result) => {
        setData(result);
        setError('');
      })
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  }, [accessToken]);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 60000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function updateDelivery(orderId, stage) {
    const confirmation = {
      failed: 'Report this delivery as failed? The item will remain in your inventory.',
      returned: 'Confirm that the supplier has received this returned item? It will be removed from your inventory.'
    }[stage];
    if (confirmation && !window.confirm(confirmation)) return;
    setBusyId(orderId);
    setError('');
    try {
      await api(`/public/riders/${accessToken}/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stage })
      });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function confirmStockReceipt(transferId) {
    setBusyId(transferId);
    setError('');
    try {
      await api(`/public/riders/${accessToken}/stock-transfers/${transferId}/receive`, { method: 'PATCH' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className="rider-portal-page">
      <header className="store-header"><Link className="brand" to="/"><span className="brand-mark">G</span><span>GBN <b>Supply Chain</b></span></Link><span className="store-trust">RIDER DELIVERY PORTAL</span></header>
      {error && !data ? <div className="rider-portal-error">{error}</div> : !data ? <LoadingIndicator message="Loading your deliveries…" /> : <>
        <section className="rider-portal-heading"><span className="store-overline">YOUR ROUTE, RIGHT HERE</span><h1>You’ve got this, {data.rider.name.split(' ')[0]}.</h1><p>Your active parcels and delivery details, all in one place.</p><p className="rider-coverage">⌖ &nbsp; Primary coverage: {[data.rider.city, data.rider.state].filter(Boolean).join(', ') || 'Not set'}</p>
          <div className="portal-stock"><div><small>ITEMS IN YOUR HAND</small><strong>{data.inventory}</strong><span className="portal-stock-breakdown">{data.availableStockItems} available + {data.assignedDeliveryItems} on {data.activeOrders.length === 1 ? '1 delivery' : `${data.activeOrders.length} deliveries`}</span></div><span>▣</span></div>
        </section>
        <section className="rider-available-stock"><p className="eyebrow">PRODUCT STOCK</p><h3>Shipments in transit</h3>{data.stockInTransit?.length ? data.stockInTransit.map((item) => <div className="rider-stock-item" key={item._id}><span>{item.quantity} × {item.funnel?.productName || 'Product'} · sent {new Date(item.sentAt).toLocaleDateString()}</span><button className="button primary" disabled={busyId === item._id} onClick={() => confirmStockReceipt(item._id)}>{busyId === item._id ? 'Saving…' : 'Confirm receipt'}</button></div>) : <small>No product shipments are currently in transit.</small>}<h3>Available for customer orders</h3>{data.availableStock?.length ? data.availableStock.map((item) => <div className="rider-stock-item" key={item.funnel?._id}><span>{item.funnel?.productName || 'Product'}</span><strong>{item.quantity} available</strong></div>) : <small>No received product stock is currently available.</small>}</section>
        {error && <div className="form-error">{error}</div>}
        <section className="portal-orders"><div className="section-heading"><div><p className="eyebrow">YOUR CURRENT BAG</p><h2>Active deliveries</h2></div>{refreshing && <LoadingIndicator className="compact" message="Refreshing…" />}<button className="button secondary" onClick={load}>↻ &nbsp; Refresh</button></div>
          {data.activeOrders.length ? <div className="portal-order-list">{data.activeOrders.map((order) => <article className="portal-order-card" key={order._id}>
            <div className="portal-order-top"><div><span className="order-id">{order.orderNumber}</span><h3>{order.funnel?.productName || 'Product'}</h3><StatusBadge stage={order.stage} />{order.redirectedFrom && <small>Parcel rerouted from {order.redirectedFrom.orderNumber}</small>}</div><span className="portal-quantity">{order.quantity} {order.quantity === 1 ? 'item' : 'items'}</span></div>
            <div className="portal-detail-grid"><div><small>DELIVER TO</small><strong>{order.customerName}</strong></div><div><small>PHONE</small><a href={`tel:${order.phone}`}>{order.phone} ↗</a>{order.whatsapp && <a href={whatsappLink(order.whatsapp)} target="_blank" rel="noreferrer">WhatsApp {order.whatsapp} ↗</a>}</div><div className="portal-address"><small>DELIVERY ADDRESS</small><strong>{order.address}, {[order.city, order.state].filter(Boolean).join(', ')}</strong></div><div><small>COLLECT ON DELIVERY</small><strong>{money(order.total, order.funnel?.currency)}</strong></div></div>
            <div className="portal-order-actions">
              {order.stage === 'at_state' && <>
                <button className="button secondary" disabled={busyId === order._id} onClick={() => updateDelivery(order._id, 'failed')}>Couldn’t deliver</button>
                <button className="button primary" disabled={busyId === order._id} onClick={() => updateDelivery(order._id, 'delivered')}>{busyId === order._id ? 'Saving…' : 'Delivered & paid'} <span>→</span></button>
              </>}
              {order.stage === 'returning' && <button className="button primary" disabled={busyId === order._id} onClick={() => updateDelivery(order._id, 'returned')}>{busyId === order._id ? 'Saving…' : 'Supplier received item'} <span>→</span></button>}
            </div>
          </article>)}</div> : <div className="empty-card portal-empty"><span>✓</span><h3>{data.inventory > 0 ? 'Your stock is ready' : 'Your bag is clear'}</h3><p>{data.inventory > 0 ? 'You have products available for new customer orders. They will appear here once the owner assigns them to you.' : 'There are no products or active deliveries assigned to you right now. New stock and handovers will appear here.'}</p><button className="button secondary" onClick={load}>Refresh</button></div>}
        </section>
      </>}
      <footer className="store-footer"><span>Made for the journey. Delivered with care.</span><span>© 2026 GBN Supply Chain</span></footer>
    </main>
  );
}
