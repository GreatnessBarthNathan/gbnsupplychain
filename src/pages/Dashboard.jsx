import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, whatsappLink } from '../api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import LoadingIndicator from '../components/LoadingIndicator';

const statItems = [
  { key: 'orders', label: 'Total orders', icon: '▤', tone: 'mint' },
  { key: 'activeFunnels', label: 'Active funnels', icon: '⌁', tone: 'peach' },
  { key: 'riders', label: 'Dispatch riders', icon: '⌖', tone: 'lavender' }
];

const adminStatItems = [
  ...statItems,
  { key: 'deliveredRevenue', label: 'Cash collected', icon: '₦', tone: 'yellow', currency: true },
  { key: 'remittedCash', label: 'Cash remitted', icon: '↗', tone: 'mint', currency: true }
];

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/dashboard')
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);
  const visibleStats = isAdmin ? adminStatItems : statItems;
  const stages = data?.stats.stages || {};
  const pipeline = [
    ['new', 'New orders', 'Fresh from your funnels'],
    ['activated', 'Activated', 'Confirmed by your team'],
    ['in_transit', 'On the way', 'Travelling to their state'],
    ['at_state', 'With dispatch', 'Rider has the parcel']
  ];
  return (
    <div className="page-content">
      {error && <div className="form-error">{error}</div>}
      {loading && <LoadingIndicator message="Loading your dashboard…" />}
      <section className="welcome-banner">
        <div><span className="banner-overline">YOUR BUSINESS, IN MOTION</span><h2>Let’s make today<br />a <em>delivery day.</em></h2><p>Every order is a promise. Here’s how yours are moving.</p></div>
        <div className="banner-art" aria-hidden="true"><span className="sun" /><span className="hill hill-back" /><span className="hill hill-front" /><span className="delivery-box"><i>G</i></span><span className="art-spark one">✳</span><span className="art-spark two">✦</span></div>
      </section>
      <div className="stats-grid">
        {visibleStats.map((item) => <article className="stat-card" key={item.key}>
          <div className={`stat-icon ${item.tone}`}>{item.icon}</div><span className="stat-label">{item.label}</span>
          <strong>{item.currency ? money(data?.stats[item.key]) : (data?.stats[item.key] ?? '—')}</strong>
          <span className="stat-foot">{item.key === 'deliveredRevenue' ? 'Successfully delivered' : item.key === 'remittedCash' ? 'Transferred by riders' : 'Across your workspace'}</span>
        </article>)}
      </div>
      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">THE DELIVERY JOURNEY</p><h2>Orders in motion</h2></div><Link className="text-link" to="/orders">View all orders <span>→</span></Link></div>
        <div className="pipeline-grid">{pipeline.map(([key, label, copy], index) => <Link to={`/orders?stage=${key}`} className="pipeline-card" key={key}>
          <span className="pipeline-index">0{index + 1}</span><span className="pipeline-count">{stages[key] || 0}</span><strong>{label}</strong><small>{copy}</small><span className="pipeline-arrow">↗</span>
        </Link>)}</div>
      </section>
      <section className="section-block recent-section">
        <div className="section-heading"><div><p className="eyebrow">FRESH OFF THE FUNNEL</p><h2>Recent orders</h2></div><Link className="text-link" to="/orders">Order management <span>→</span></Link></div>
        <div className="table-wrap">
          <table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PRODUCT</th><th>AMOUNT</th><th>STATUS</th></tr></thead>
            <tbody>{data?.recentOrders?.length ? data.recentOrders.map((order) => <tr key={order._id}>
              <td><strong className="order-id">{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString()}</small></td>
              <td><strong>{order.customerName}</strong><small>{order.phone}</small>{order.whatsapp && <small><a className="whatsapp-link" href={whatsappLink(order.whatsapp)} target="_blank" rel="noreferrer">WhatsApp {order.whatsapp} ↗</a></small>}</td><td>{order.funnel?.productName || 'Product'}</td><td>{money(order.total, order.funnel?.currency)}</td><td><StatusBadge stage={order.stage} /></td>
            </tr>) : <tr><td className="table-empty" colSpan="5">{data ? 'Your first order will show up here.' : 'Loading your orders…'}</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
