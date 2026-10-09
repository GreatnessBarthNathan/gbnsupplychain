import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, stages } from '../api';
import LoadingIndicator from '../components/LoadingIndicator';

const journey = ['new', 'activated', 'in_transit', 'at_state', 'delivered', 'transferred'];
const descriptions = {
  new: 'We’ve received your order. Our team will call to confirm it shortly.',
  activated: 'Your order is confirmed and getting ready to travel.',
  in_transit: 'Your package is on its way to your state.',
  at_state: 'A dispatch rider has picked up your package for the final leg.',
  delivered: 'Your order has been delivered. Thank you!',
  transferred: 'Your payment has been transferred to the seller after delivery.',
  failed: 'Delivery could not be completed. Our team is arranging the next step for this order.',
  returning: 'Your parcel is on its way back to the supplier.',
  returned: 'Your parcel has been received back by the supplier.'
};

export default function TrackOrder() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setOrder(null);
    setError('');
    api(`/public/track/${orderNumber}`)
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [orderNumber]);
  const position = order ? journey.indexOf(order.stage) : -1;
  return (
    <main className="tracking-page">
      <header className="store-header"><Link className="brand" to="/"><span className="brand-mark">G</span><span>GBN <b>Supply Chain</b></span></Link><span className="store-trust">YOUR DELIVERY, IN VIEW</span></header>
      <section className="tracking-card">
        <span className="store-overline">GOOD THINGS, ON THEIR WAY</span><h1>Track your order</h1><p className="tracking-id">{orderNumber}</p>
        {error ? <div className="form-error">{error}</div> : loading ? <LoadingIndicator message="Finding your latest delivery update…" /> : order ? <>
          <div className={`tracking-current ${order.stage === 'failed' ? 'failed-track' : ''}`}><span className="tracking-current-icon">{order.stage === 'failed' ? '!' : ['delivered', 'transferred', 'returned'].includes(order.stage) ? '✓' : '↗'}</span><div><small>CURRENT STATUS</small><h2>{stages.find((item) => item.id === order.stage)?.label}</h2><p>{descriptions[order.stage]}</p></div></div>
          {!['failed', 'returning', 'returned'].includes(order.stage) && <div className="tracking-timeline">{journey.map((stage, index) => {
            const complete = index <= position;
            const history = order.stageHistory?.find((item) => item.stage === stage);
            return <div className={`timeline-step ${complete ? 'complete' : ''} ${index === position ? 'current' : ''}`} key={stage}><span className="timeline-dot">{complete && index < position ? '✓' : ''}</span><div><strong>{stages.find((item) => item.id === stage)?.label}</strong>{history && <small>{new Date(history.changedAt).toLocaleString()}</small>}</div></div>;
          })}</div>}
          {order.rider && <div className="tracking-rider"><span className="avatar rider-avatar">{order.rider.name.slice(0, 1)}</span><div><small>YOUR DISPATCH RIDER</small><strong>{order.rider.name}</strong></div><a href={`tel:${order.rider.phone}`}>Call rider <span>↗</span></a></div>}
          <p className="tracking-customer">Order placed for {order.customerName}</p>
        </> : null}
      </section>
      <footer className="store-footer"><span>Made for the journey. Delivered with care.</span><span>© 2026 GBN Supply Chain</span></footer>
    </main>
  );
}
