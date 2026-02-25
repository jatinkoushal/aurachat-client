import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

const THEMES = {
  dark:   { label: '🌑 Dark',         bg: '#0f0e1a', accent: '#6c63ff' },
  purple: { label: '💜 Deep Purple',   bg: '#120b2e', accent: '#9c27b0' },
  blue:   { label: '💙 Ocean Blue',    bg: '#0a1628', accent: '#2196f3' },
  green:  { label: '💚 Forest Green',  bg: '#0a1f0a', accent: '#4caf50' },
  red:    { label: '❤️ Ruby Red',      bg: '#1a0a0a', accent: '#f44336' },
};

function applyTheme(key) {
  const t = THEMES[key]; if (!t) return;
  document.documentElement.style.setProperty('--bg-primary',   t.bg);
  document.documentElement.style.setProperty('--accent-primary', t.accent);
  document.documentElement.style.setProperty('--bg-secondary', t.bg === '#0f0e1a' ? '#1a1830' : t.bg + 'cc');
  localStorage.setItem('theme', key);
}
const saved = localStorage.getItem('theme');
if (saved) applyTheme(saved);

function PwInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input className="input" type={show ? 'text' : 'password'} value={value}
        onChange={onChange} placeholder={placeholder} autoComplete={autoComplete}
        required style={{ paddingRight: 44 }} />
      <button type="button" onClick={() => setShow(s => !s)}
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)', padding: 0 }}>
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [section, setSection] = useState(null);
  const [bio, setBio] = useState(user?.bio || '');
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', ok: true });
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [notifEnabled, setNotifEnabled] = useState(localStorage.getItem('notif_enabled') !== 'false');
  const [deletePass, setDeletePass] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileRef = useRef();

  const flash = (text, ok = true) => { setMsg({ text, ok }); setTimeout(() => setMsg({ text: '', ok: true }), 4000); };

  const handleAvatarChange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) return flash('Image must be under 5MB', false);
    setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f));
  };

  const saveProfile = async () => {
    setSaving(true); flash('');
    try {
      const fd = new FormData();
      fd.append('bio', bio);
      if (newUsername.trim() && newUsername.trim() !== user?.username) fd.append('username', newUsername.trim());
      if (avatarFile) fd.append('avatar', avatarFile);
      const res = await api.patch('/api/auth/profile', fd);
      setUser(p => ({ ...p, ...res.data.user }));
      setAvatarFile(null);
      flash('✅ Profile updated!');
    } catch (err) { flash('❌ ' + (err.response?.data?.error || 'Failed'), false); }
    finally { setSaving(false); }
  };

  const changePassword = async e => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) return flash('❌ Passwords do not match', false);
    if (pwForm.next.length < 6) return flash('❌ Min 6 characters', false);
    setSaving(true);
    try {
      await api.patch('/api/auth/password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      flash('✅ Password changed!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) { flash('❌ ' + (err.response?.data?.error || 'Failed'), false); }
    finally { setSaving(false); }
  };

  const handleTheme = key => { applyTheme(key); setTheme(key); flash('✅ Theme applied!'); };

  const toggleNotifications = async () => {
    if (!notifEnabled) {
      // Request permission
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { flash('❌ Notification permission denied by browser', false); return; }
      }
      localStorage.setItem('notif_enabled', 'true');
      setNotifEnabled(true);
      flash('✅ Notifications enabled!');
    } else {
      localStorage.setItem('notif_enabled', 'false');
      setNotifEnabled(false);
      flash('🔕 Notifications disabled');
    }
  };

  const deleteAccount = async () => {
    if (!deletePass) return flash('❌ Enter your password to confirm', false);
    try {
      await api.delete('/api/auth/account', { data: { password: deletePass } });
      logout();
    } catch (err) { flash('❌ ' + (err.response?.data?.error || 'Failed'), false); }
  };

  const profileChanged = avatarFile || bio !== (user?.bio || '') || newUsername.trim() !== (user?.username || '');

  return (
    <div style={s.page}>
      {/* Profile card */}
      <div style={s.card}>
        <div style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} onClick={() => fileRef.current?.click()}>
          <Avatar username={user?.username} avatarUrl={avatarPreview} size="xl" />
          <span style={s.cam}>📷</span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.username}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{user?.bio || 'No bio yet'}</div>
        </div>
      </div>

      {msg.text && (
        <div style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, background: msg.ok ? 'rgba(0,184,148,.15)' : 'rgba(225,112,85,.15)', color: msg.ok ? 'var(--online-green)' : 'var(--danger)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ACCOUNT */}
        <Section icon="👤" label="Account" sub="Username, bio, avatar" open={section==='account'} onToggle={() => setSection(p => p==='account' ? null : 'account')}>
          <label style={s.lbl}>Username</label>
          <input className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="New username" style={{ marginBottom: 12 }} />
          <label style={s.lbl}>Bio</label>
          <textarea className="input" value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell people about yourself…" rows={3} maxLength={150} style={{ resize: 'none', marginBottom: 4 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 12 }}>{bio.length}/150</div>
          <Row label="Member since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '—'} />
          <button className="input" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', cursor: 'pointer', textAlign: 'center', color: 'var(--text-secondary)', marginTop: 8 }} onClick={() => fileRef.current?.click()}>
            📷 {avatarFile ? 'Photo selected ✓' : 'Change Profile Photo'}
          </button>
          {profileChanged && (
            <button className="btn btn-primary w-full" onClick={saveProfile} disabled={saving} style={{ marginTop: 14 }}>
              {saving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          )}
        </Section>

        {/* PRIVACY */}
        <Section icon="🔒" label="Privacy & Security" sub="Change password" open={section==='privacy'} onToggle={() => setSection(p => p==='privacy' ? null : 'privacy')}>
          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PwInput value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="Current password" autoComplete="current-password" />
            <PwInput value={pwForm.next}    onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))}    placeholder="New password (min 6)" autoComplete="new-password" />
            <PwInput value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Confirm new password" autoComplete="new-password" />
            <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : '🔑 Change Password'}</button>
          </form>
        </Section>

        {/* NOTIFICATIONS */}
        <Section icon="🔔" label="Notifications" sub="Message and call alerts" open={section==='notifs'} onToggle={() => setSection(p => p==='notifs' ? null : 'notifs')}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Browser Notifications</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Get alerts for messages and calls</div>
            </div>
            <button onClick={toggleNotifications}
              style={{ width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: notifEnabled ? 'var(--accent-primary)' : 'var(--bg-card)', transition: 'background .2s', position: 'relative' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: notifEnabled ? 25 : 3, transition: 'left .2s' }} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
            {notifEnabled
              ? '✅ Notifications ON — you\'ll be alerted for messages, calls, and friend requests'
              : '🔕 Notifications OFF — enable to get alerts even when the app is in the background'}
          </div>
          {notifEnabled && 'Notification' in window && Notification.permission !== 'granted' && (
            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 8 }}>
              ⚠️ Browser permission not granted. Click the toggle to request permission.
            </div>
          )}
        </Section>

        {/* THEME */}
        <Section icon="🎨" label="Theme" sub="App color scheme" open={section==='theme'} onToggle={() => setSection(p => p==='theme' ? null : 'theme')}>
          {Object.entries(THEMES).map(([key, t]) => (
            <div key={key} onClick={() => handleTheme(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6, borderRadius: 'var(--radius-sm)', border: `2px solid ${theme===key ? t.accent : 'var(--border)'}`, cursor: 'pointer', background: theme===key ? 'var(--bg-hover)' : 'transparent' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.bg, border: `3px solid ${t.accent}`, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{t.label}</span>
              {theme===key && <span style={{ color: t.accent, fontWeight: 800 }}>✓</span>}
            </div>
          ))}
        </Section>

        {/* ABOUT */}
        <Section icon="ℹ️" label="About AuraChat" sub="Version info" open={section==='about'} onToggle={() => setSection(p => p==='about' ? null : 'about')}>
          <Row label="Version"   value="3.0.0" />
          <Row label="Frontend"  value="React 18 + Vite" />
          <Row label="Backend"   value="Node.js + Socket.io" />
          <Row label="Database"  value="PostgreSQL (Neon)" />
          <Row label="Calling"   value="WebRTC (native)" />
          <Row label="Real-time" value="Socket.io v4" />
        </Section>

        {/* DANGER ZONE */}
        <Section icon="⚠️" label="Danger Zone" sub="Delete account" open={section==='danger'} onToggle={() => setSection(p => p==='danger' ? null : 'danger')}>
          <div style={{ background: 'rgba(225,112,85,.1)', border: '1px solid rgba(225,112,85,.3)', borderRadius: 'var(--radius-sm)', padding: 14, marginBottom: 14 }}>
            <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>⚠️ Permanently Delete Account</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              This will delete ALL your data — messages, friends, groups — forever. This cannot be undone.
            </div>
            {!showDeleteConfirm ? (
              <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)} style={{ padding: '8px 16px' }}>
                Delete My Account
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <PwInput value={deletePass} onChange={e => setDeletePass(e.target.value)} placeholder="Enter your password to confirm" autoComplete="current-password" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-danger" onClick={deleteAccount} disabled={!deletePass} style={{ flex: 1 }}>
                    ✓ Confirm Delete
                  </button>
                  <button className="btn btn-ghost" onClick={() => { setShowDeleteConfirm(false); setDeletePass(''); }} style={{ padding: '10px 16px' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        <div style={{ padding: '16px 16px 40px' }}>
          <button className="btn btn-danger w-full" onClick={logout} style={{ padding: 14, fontSize: 15 }}>
            🚪 Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Section({ icon, label, sub, open, onToggle, children }) {
  return (
    <div>
      <div onClick={onToggle} style={s.item}>
        <span style={s.icon}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 20, transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>›</span>
      </div>
      {open && <div style={s.content}>{children}</div>}
    </div>
  );
}

const s = {
  page:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)', width: '100%' },
  card:    { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 16px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  cam:     { position: 'absolute', bottom: 0, right: 0, background: 'var(--accent-primary)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 },
  item:    { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', userSelect: 'none' },
  icon:    { width: 38, height: 38, borderRadius: 10, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  content: { padding: 16, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  lbl:     { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
};
