import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthPage({ invite = false }) {
  const { token: inviteToken } = useParams();
  const { user, authenticate } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = invite
        ? { token: inviteToken, ...form }
        : { email: form.email, password: form.password };
      await authenticate(invite ? '/auth/register' : '/auth/login', payload);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-visual">
        <a className="brand auth-brand" href="/"><span className="brand-mark">G</span><span>GBN <b>Supply Chain</b></span></a>
        <div className="auth-message">
          <span className="auth-kicker">THE JOURNEY, ALL IN ONE PLACE</span>
          <h1>Good things<br />are <em>on their way.</em></h1>
          <p>From your first ad click to a knock at the door. Make every delivery count.</p>
          <div className="route-art"><span className="route-point start">Ad</span><span className="route-line" /><span className="route-point middle">Box</span><span className="route-line" /><span className="route-point end">Home</span></div>
        </div>
        <span className="auth-copyright">© 2026 GBN Supply Chain</span>
      </div>
      <div className="auth-panel">
        <div className="auth-form-wrap">
          <p className="eyebrow">{invite ? 'YOU’RE INVITED' : 'WELCOME BACK'}</p>
          <h2>{invite ? 'Complete your account setup' : 'Sign in to your workspace'}</h2>
          <p className="auth-subtitle">{invite ? 'Create your login using the shared invite link from your admin.' : 'Use the email and password linked to your workspace account.'}</p>
          <form onSubmit={submit} className="form-stack">
            {invite && <label>Your name<input autoComplete="name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Ada Okafor" /></label>}
            <label>Email address<input type="email" autoComplete="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="you@company.com" /></label>
            <label>
              Password
              <div className="password-field">
                <input type={showPassword ? 'text' : 'password'} autoComplete={invite ? 'new-password' : 'current-password'} minLength={8} required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={invite ? 'At least 8 characters' : 'Enter your password'} />
                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>
            {error && <div className="form-error">{error}</div>}
            <button className="button primary full" disabled={busy}>{busy ? 'Please wait…' : invite ? 'Create account' : 'Sign in'} <span>→</span></button>
          </form>
          <p className="auth-switch">{invite ? 'Already have an account?' : 'Need access?'} <Link to={invite ? '/login' : '/login'}>{invite ? 'Sign in' : 'Ask your admin for an invite link'}</Link></p>
          <p className="privacy-note">{invite ? 'Your account is created from the admin share link only.' : 'Only invited team members can access the workspace.'}</p>
        </div>
      </div>
    </main>
  );
}
