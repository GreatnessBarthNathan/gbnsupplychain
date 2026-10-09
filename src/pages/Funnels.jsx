import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api';
import LoadingIndicator from '../components/LoadingIndicator';
import { useAuth } from '../context/AuthContext';

const blank = { name: '', productName: '', description: '', images: '', price: '', currency: 'NGN', pixelId: '' };

export default function Funnels() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [funnels, setFunnels] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError('');
    api('/funnels')
      .then(setFunnels)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openCreateForm() {
    setEditingId('');
    setForm(blank);
    setError('');
    setShowForm(true);
  }

  function openEditForm(funnel) {
    setEditingId(funnel._id);
    setForm({
      name: funnel.name,
      productName: funnel.productName,
      description: funnel.description || '',
      images: (funnel.images || []).join('\n'),
      price: String(funnel.price),
      currency: funnel.currency || 'NGN',
      pixelId: funnel.pixelId || ''
    });
    setError('');
    setShowForm(true);
  }

  async function saveFunnel(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = {
        ...form,
        images: form.images.split(/\r?\n/).map((image) => image.trim()).filter(Boolean)
      };
      await api(editingId ? `/funnels/${editingId}` : '/funnels', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      setForm(blank);
      setEditingId('');
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-toolbar"><div><p className="subtle-copy">A dedicated page for every product you’re ready to send out.</p></div>{isAdmin && <button className="button primary" onClick={openCreateForm}><span>＋</span> Create new funnel</button>}</div>
      {error && <div className="form-error">{error}</div>}
      <div className="funnel-callout"><span className="callout-icon">✳</span><div><strong>Made for the scroll-stopping moment.</strong><p>Share your funnel link in a Facebook ad. Meta Pixel events are sent when a customer views the page and places an order.</p></div></div>
      <div className="funnel-grid">{loading ? <LoadingIndicator message="Loading funnels…" /> : funnels.map((funnel, index) => (
        <article className="funnel-card" key={funnel._id}>
          <div className={`product-art art-${index % 4}`}>{funnel.images?.[0] ? <img src={funnel.images[0]} alt={funnel.productName} /> : <span className="product-shape">◈</span>}<span className="product-art-label">GBN / PRODUCT {String(index + 1).padStart(2, '0')}</span></div>
          <div className="funnel-card-body"><div className="funnel-card-top"><span className="active-mark"><i /> Live funnel</span><div className="funnel-card-actions">{isAdmin && <button className="icon-button small-button" title="Edit funnel" aria-label={`Edit ${funnel.productName}`} onClick={() => openEditForm(funnel)}>✎</button>}<button className="icon-button small-button" title="Open funnel" aria-label={`Preview ${funnel.productName}`} onClick={() => window.open(`/f/${funnel.slug}`, '_blank', 'noopener,noreferrer')}>↗</button></div></div>
            <h3>{funnel.productName}</h3><p className="funnel-name">{funnel.name}</p><div className="funnel-card-footer"><strong>{money(funnel.price, funnel.currency)}</strong><Link to={`/f/${funnel.slug}`} target="_blank">Preview page <span>→</span></Link></div>
            <div className="funnel-url"><span>gbn.store/f/{funnel.slug}</span><button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/f/${funnel.slug}`)}>Copy link</button></div>
          </div>
        </article>
      ))}
      {!loading && !error && funnels.length === 0 && isAdmin && <div className="empty-card"><span>⌁</span><h3>Your first funnel starts here</h3><p>Create a focused product page and connect it to your Facebook ad with a Meta Pixel.</p><button className="button primary" onClick={openCreateForm}>Create your first funnel <span>→</span></button></div>}
      </div>
      {showForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><section className="modal-card">
        <button className="modal-close" aria-label="Close" onClick={() => setShowForm(false)}>×</button><p className="eyebrow">{editingId ? 'UPDATE YOUR PRODUCT PAGE' : 'A NEW WAY TO GET THERE'}</p><h2>{editingId ? 'Edit sales funnel' : 'Create a sales funnel'}</h2><p className="modal-description">{editingId ? 'Update the product details, images, and order page settings.' : 'Set up a product page designed to turn ad interest into a confirmed order.'}</p>
        <form className="form-stack" onSubmit={saveFunnel}>
          <label>Funnel name<input required maxLength="100" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Summer launch" /></label>
          <label>Product name<input required maxLength="120" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} placeholder="What are you selling?" /></label>
          <label>Product description<textarea maxLength="1200" rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What makes this product worth having?" /></label>
          <label>Product image URLs <span className="optional">UP TO 6</span><textarea rows="3" value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} placeholder={'Add one https:// image link per line'} /><small>Add clear photos of the product from different angles. Use direct image links.</small></label>
          <div className="form-row"><label>Price<input required type="number" min="0" step="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="25000" /></label><label>Currency<select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option value="NGN">NGN · Naira</option><option value="GHS">GHS · Cedi</option><option value="KES">KES · Shilling</option><option value="USD">USD · Dollar</option></select></label></div>
          <label>Meta Pixel ID <span className="optional">OPTIONAL</span><input inputMode="numeric" maxLength="32" value={form.pixelId} onChange={(e) => setForm({ ...form, pixelId: e.target.value.replace(/\D/g, '') })} placeholder="Your Facebook Pixel ID" /><small>Purchase events will fire when an order is submitted.</small></label>
          {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy ? (editingId ? 'Saving…' : 'Creating…') : editingId ? 'Save changes' : 'Create funnel'} <span>→</span></button></div>
        </form>
      </section></div>}
    </div>
  );
}
