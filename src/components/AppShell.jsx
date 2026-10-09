import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { disablePushNotifications, enablePushNotifications } from '../pushNotifications';

const navItems = [
  { to: '/', label: 'Overview', icon: '◫', end: true },
  { to: '/funnels', label: 'Sales funnels', icon: '⌁' },
  { to: '/orders', label: 'Orders', icon: '▤' },
  { to: '/completed-orders', label: 'Completed orders', icon: '✓' },
  { to: '/riders', label: 'Dispatch riders', icon: '⌖' }
];

const titles = {
  '/': ['Good business starts here', 'Your business at a glance'],
  '/funnels': ['Sales funnels', 'Turn your ads into paid deliveries'],
  '/orders': ['Orders', 'Every order, moving forward'],
  '/completed-orders': ['Completed orders', 'Transferred and failed orders'],
  '/riders': ['Dispatch riders', 'Keep your last-mile team in sync']
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notice, setNotice] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!pushSupported) return undefined;
    let mounted = true;
    navigator.serviceWorker.getRegistration().then((registration) => (
      registration ? registration.pushManager.getSubscription() : null
    )).then((subscription) => {
      if (mounted) setPushEnabled(Boolean(subscription));
    }).catch((error) => {
      if (mounted) setPushError(error.message);
    });
    return () => { mounted = false; };
  }, [pushSupported]);

  async function toggleDevicePush() {
    setPushBusy(true);
    setPushError('');
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
      } else {
        await enablePushNotifications();
        setPushEnabled(true);
      }
    } catch (error) {
      setPushError(error.message);
    } finally {
      setPushBusy(false);
    }
  }

  async function sendTestPush() {
    setPushBusy(true);
    setPushError('');
    setPushMessage('');
    try {
      const result = await api('/push/test', { method: 'POST' });
      setPushMessage(result.message);
    } catch (error) {
      setPushError(error.message);
    } finally {
      setPushBusy(false);
    }
  }

  async function createInviteLink() {
    try {
      const result = await api('/auth/invite', { method: 'POST' });
      setInviteLink(result.inviteUrl);
      await navigator.clipboard.writeText(result.inviteUrl);
      setNotice('Invite link copied to clipboard. Share it with the person you want to grant access.');
    } catch (error) {
      setNotice(error.message);
    }
  }

  useEffect(() => {
    let mounted = true;
    const load = () => api('/notifications').then((items) => mounted && setNotifications(items))
      .catch((error) => mounted && setNotice(error.message));
    load();
    const interval = window.setInterval(load, 30000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const [eyebrow, title] = titles[location.pathname] || titles['/'];
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">G</span>
          <span>GBN <b>Supply Chain</b></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.to === '/orders' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-spark">✳</span>
            <strong>Built for the long run.</strong>
            <p>From first click to doorstep, keep every detail in view.</p>
          </div>
          <button className="profile-button" onClick={logout}>
            <span className="avatar">{user?.name?.slice(0, 1).toUpperCase()}</span>
            <span className="profile-copy"><strong>{user?.name}</strong><small>{user?.email}</small></span>
            <span className="profile-menu">↗</span>
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">G</span> GBN Supply Chain</div>
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{title}</strong></div>
          <div className="topbar-actions">
            {isAdmin && (
              <button className="button secondary" onClick={createInviteLink}>
                {inviteLink ? 'Invite copied' : 'Create invite link'}
              </button>
            )}
            <button className={`button ${pushEnabled ? 'secondary' : 'primary'} push-enable-button`} disabled={pushBusy || pushEnabled || !pushSupported} onClick={toggleDevicePush} title={!pushSupported ? 'Push notifications are not supported by this browser.' : undefined}>
              {pushBusy ? 'Enabling…' : pushEnabled ? 'Notifications on' : 'Enable notifications'}
            </button>
            <div className="notification-wrap">
              <button className="icon-button" aria-label="Notifications" onClick={() => setShowNotifications(!showNotifications)}>
                ♧{unread > 0 && <i>{unread > 9 ? '9+' : unread}</i>}
              </button>
              {showNotifications && (
                <div className="notification-popover">
                  <div className="popover-title"><strong>Notifications</strong><span>{notifications.length} recent</span></div>
                  {notifications.length === 0 ? <p className="empty-note">You’re all caught up.</p> : notifications.slice(0, 6).map((item) => (
                    <div className="notification-item" key={item._id}><span className="notification-pip" /><div><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString()}</small></div></div>
                  ))}
                  <div className="push-settings">
                    {pushSupported ? <>
                      {pushEnabled && <p>✓ Push alerts are on for this device.</p>}
                      <button className={`button ${pushEnabled ? 'secondary' : 'primary'} full`} disabled={pushBusy} onClick={toggleDevicePush}>{pushBusy ? 'Updating…' : pushEnabled ? 'Disable push on this device' : 'Enable push on this device'}</button>
                      {pushEnabled && <button className="button secondary full push-test-button" disabled={pushBusy} onClick={sendTestPush}>{pushBusy ? 'Sending…' : 'Send test notification'}</button>}
                    </> : <p>Push notifications aren’t supported by this browser.</p>}
                    {pushError && <p className="push-error">{pushError}</p>}
                    {pushMessage && <p>{pushMessage}</p>}
                  </div>
                </div>
              )}
            </div>
            <div className="user-short"><span className="avatar small">{user?.name?.slice(0, 1).toUpperCase()}</span><span>{user?.name?.split(' ')[0]}</span></div>
          </div>
        </header>
        {pushError && <div className="inline-error">{pushError}<button aria-label="Dismiss notification error" onClick={() => setPushError('')}>×</button></div>}
        <section className="page-heading">
          <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
          <div className="heading-date">{new Intl.DateTimeFormat('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</div>
        </section>
        {notice && <div className="inline-error">{notice}<button onClick={() => setNotice('')}>×</button></div>}
        <Outlet />
      </main>
    </div>
  );
}
