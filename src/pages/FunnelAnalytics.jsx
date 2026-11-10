import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import LoadingIndicator from '../components/LoadingIndicator';

const periods = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'This week' },
  { key: 'monthly', label: 'This month' },
  { key: 'allTime', label: 'All time' }
];

const numberFormat = new Intl.NumberFormat('en-NG');

export default function FunnelAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  function loadAnalytics() {
    setLoading(true);
    setError('');
    api('/analytics/funnels')
      .then(setAnalytics)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  return (
    <div className="page-content">
      <div className="page-toolbar analytics-toolbar">
        <p className="subtle-copy">Page visits across your live product funnels. Tracking starts with this release.</p>
        <span className="analytics-period-note">UTC calendar periods · Weeks start Monday</span>
      </div>
      {error && (
        <div className="form-error analytics-error">
          {error}
          <button className="button secondary" onClick={loadAnalytics}>Try again</button>
        </div>
      )}
      {loading ? <LoadingIndicator message="Loading funnel visits…" /> : analytics && (
        <>
          <section className="analytics-summary" aria-label="Total funnel visits by period">
            {periods.map((period, index) => (
              <article className={`analytics-stat analytics-stat-${index}`} key={period.key}>
                <span>{period.label}</span>
                <strong>{numberFormat.format(analytics.totals[period.key])}</strong>
                <small>Total visits</small>
              </article>
            ))}
          </section>
          <section className="analytics-table-section">
            <div className="section-heading">
              <div><p className="eyebrow">PERFORMANCE</p><h2>Visits by funnel</h2></div>
              <span>{analytics.funnels.length} live {analytics.funnels.length === 1 ? 'funnel' : 'funnels'}</span>
            </div>
            {analytics.funnels.length > 0 ? (
              <div className="table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>FUNNEL</th>
                      <th>TODAY</th>
                      <th>THIS WEEK</th>
                      <th>THIS MONTH</th>
                      <th>ALL TIME</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.funnels.map((funnel) => (
                      <tr key={funnel._id}>
                        <td>
                          <strong>{funnel.productName}</strong>
                          <small>{funnel.name}</small>
                        </td>
                        <td>{numberFormat.format(funnel.daily)}</td>
                        <td>{numberFormat.format(funnel.weekly)}</td>
                        <td>{numberFormat.format(funnel.monthly)}</td>
                        <td><strong>{numberFormat.format(funnel.allTime)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-card analytics-empty">
                <span>▥</span>
                <h3>No live funnels yet</h3>
                <p>Create a sales funnel and its visits will appear here.</p>
                <Link className="button primary" to="/funnels">View funnels <span>→</span></Link>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
