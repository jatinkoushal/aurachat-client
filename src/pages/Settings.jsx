import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

const THEMES = {
  dark:   { label: '🌑 Dark (Default)', bg: '#0f0e1a', accent: '#6c63ff' },
  purple: { label: '💜 Deep Purple',    bg: '#120b2e', accent: '#9c27b0' },
  blue:   { label: '💙 Ocean Blue',     bg: '#0a1628', accent: '#2196f3' },
  green:  { label: '💚 Forest Green',   bg: '#0a1f0a', accent: '#4caf50' },
  red:    { label: '❤️  Ruby Red',      bg: '#1a0a0a', accent: '#f44336' },
};

function applyTheme(key) {
  const t = THEMES[key]; if (!t) return;
  document.documentElement.style.setProperty('--bg-primary',    t.bg);
  document.documentElement.style.setProperty('--accent-primary', t.accent);
  document.documentElement.style.setProperty('--bg-secondary',  t.bg === '#0f0e1a' ? '#1a1830' : t.bg + 'cc');
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

function Toggle({ on, onToggle, label, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={onToggle} type="button"
        style={{ width: 50, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: on ? 'var(--accent-primary)' : 'var(--bg-card)', transition: 'background .25s', position: 'relative', flexShrink: 0 }}>
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: on ? 25 : 3, transition: 'left .25s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
      </button>
    </div>
  );
}

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [section, setSection] = useState(null);

  // Account fields
  const [bio, setBio]         = useState(user?.bio || '');
  const [newUsername, setNewUsername] = useState(user?.username || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const [avatarFile, setAvatarFile]       = useState(null);

  // Password
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });

  // Privacy
  const [profilePrivate, setProfilePrivate] = useState(user?.profile_private || false);
  const [savingPrivacy, setSavingPrivacy]   = useState(false);

  // Notifications & Sound
  const [notifEnabled, setNotifEnabled] = useState(localStorage.getItem('notif_enabled') !== 'false');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('sound_enabled') !== 'false');

  // Theme
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  // Danger zone
  const [deletePass, setDeletePass]           = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Shared state
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState({ text: '', ok: true });
  const fileRef = useRef();

  const flash = (text, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: '', ok: true }), 4000);
  };

  // ── Avatar ────────────────────────────────────────────────────────────────
  const handleAvatarChange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) return flash('Image must be under 5MB', false);
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const removeAvatar = async () => {
    if (!window.confirm('Remove your profile picture?')) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('removeAvatar', 'true');
      const res = await api.patch('/api/auth/profile', fd);
      setUser(p => ({ ...p, ...res.data.user }));
      setAvatarPreview(null);
      setAvatarFile(null);
      flash('✅ Profile picture removed!');
    } catch (err) { flash('❌ ' + (err.response?.data?.error || 'Failed'), false); }
    finally { setSaving(false); }
  };

  // ── Profile save ──────────────────────────────────────────────────────────
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

  // ── Password ──────────────────────────────────────────────────────────────
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

  // ── Profile privacy ───────────────────────────────────────────────────────
  const toggleProfilePrivate = async (value) => {
    const next = value !== undefined ? value : !profilePrivate;
    if (next === profilePrivate) return;
    setSavingPrivacy(true);
    try {
      const fd = new FormData();
      fd.append('profile_private', String(next));
      const res = await api.patch('/api/auth/profile', fd);
      setUser(p => ({ ...p, ...res.data.user }));
      setProfilePrivate(next);
      flash(next ? '👥 Profile now visible to friends only' : '🌍 Profile is now public to everyone');
    } catch (err) { flash('❌ Failed to update privacy', false); }
    finally { setSavingPrivacy(false); }
  };

  // ── Notifications ─────────────────────────────────────────────────────────
  const toggleNotifications = async () => {
    if (!notifEnabled) {
      if ('Notification' in window) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { flash('❌ Browser denied permission — allow it in site settings', false); return; }
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

  // ── Sound ─────────────────────────────────────────────────────────────────
  const toggleSound = () => {
    const next = !soundEnabled;
    localStorage.setItem('sound_enabled', String(next));
    setSoundEnabled(next);
    flash(next ? '🔊 Message sounds ON' : '🔇 Message sounds OFF');
  };

  // Test sound
  const playTestTone = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(); osc.stop(ctx.currentTime + 0.4);
      setTimeout(() => { try { ctx.close(); } catch {} }, 800);
    } catch {}
  };

  // ── Theme ─────────────────────────────────────────────────────────────────
  const handleTheme = key => { applyTheme(key); setTheme(key); flash('✅ Theme applied!'); };

  // ── Delete account ────────────────────────────────────────────────────────
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

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <div style={s.card}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
            <Avatar username={user?.username} avatarUrl={avatarPreview} size="xl" />
            <span style={s.camBadge}>📷</span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          {/* Remove avatar button */}
          {(avatarPreview || user?.avatar_url) && (
            <button onClick={removeAvatar} title="Remove photo"
              style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: 'var(--danger)', border: '2px solid var(--bg-secondary)', color: '#fff', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              ✕
            </button>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.username}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
          </div>
          <div style={{ fontSize: 12, color: profilePrivate ? 'var(--warning)' : 'var(--online-green)', marginTop: 4 }}>
            {profilePrivate ? '🔒 Private profile' : '🌍 Public profile'}
          </div>
        </div>
      </div>

      {/* Flash message */}
      {msg.text && (
        <div style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, flexShrink: 0,
          background: msg.ok ? 'rgba(0,184,148,.15)' : 'rgba(225,112,85,.15)',
          color: msg.ok ? 'var(--online-green)' : 'var(--danger)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── ACCOUNT ──────────────────────────────────────────────────────── */}
        <Section icon="👤" label="Account" sub="Username, bio & avatar"
          open={section === 'account'} onToggle={() => setSection(p => p === 'account' ? null : 'account')}>

          <label style={s.lbl}>Username</label>
          <input className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)}
            placeholder="Username" style={{ marginBottom: 12 }} />

          <label style={s.lbl}>Bio</label>
          <textarea className="input" value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell people about yourself…" rows={3} maxLength={150}
            style={{ resize: 'none', marginBottom: 4 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 12 }}>
            {bio.length}/150
          </div>

          <InfoRow label="Member since"
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />

          {/* Avatar actions */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-ghost" style={{ flex: 1, fontSize: 12 }} onClick={() => fileRef.current?.click()}>
              📷 {avatarFile ? 'Change photo ✓' : 'Change photo'}
            </button>
            {(avatarPreview || user?.avatar_url) && (
              <button className="btn btn-danger" style={{ fontSize: 12, padding: '10px 14px' }} onClick={removeAvatar} disabled={saving}>
                🗑️ Remove photo
              </button>
            )}
          </div>

          {profileChanged && (
            <button className="btn btn-primary w-full" onClick={saveProfile} disabled={saving} style={{ marginTop: 12 }}>
              {saving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          )}
        </Section>

        {/* ── PRIVACY & SECURITY ───────────────────────────────────────────── */}
        <Section icon="🔒" label="Privacy & Security" sub="Profile visibility & password"
          open={section === 'privacy'} onToggle={() => setSection(p => p === 'privacy' ? null : 'privacy')}>

          {/* Profile visibility — who can see my profile */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
              👁️ Who can see my profile?
            </div>
            {[
              { value: false, icon: '🌍', title: 'Everyone', desc: 'Anyone can find you and send friend requests' },
              { value: true,  icon: '👥', title: 'Friends only', desc: 'Only your friends can see your profile and find you' },
            ].map(opt => (
              <div key={String(opt.value)} onClick={() => !savingPrivacy && toggleProfilePrivate(opt.value)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  marginBottom: 8, borderRadius: 12,
                  border: `2px solid ${profilePrivate === opt.value ? 'var(--accent-primary)' : 'var(--border)'}`,
                  background: profilePrivate === opt.value ? 'rgba(108,99,255,.1)' : 'var(--bg-card)',
                  cursor: savingPrivacy ? 'wait' : 'pointer', transition: 'all .2s',
                }}>
                <span style={{ fontSize: 22 }}>{opt.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{opt.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${profilePrivate === opt.value ? 'var(--accent-primary)' : 'var(--border)'}`,
                  background: profilePrivate === opt.value ? 'var(--accent-primary)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {profilePrivate === opt.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                </div>
              </div>
            ))}
            {savingPrivacy && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Saving…</div>}
          </div>

          {/* Change password */}
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
            Change Password
          </div>
          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <PwInput value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} placeholder="Current password" autoComplete="current-password" />
            <PwInput value={pwForm.next}    onChange={e => setPwForm(p => ({ ...p, next:    e.target.value }))} placeholder="New password (min 6 chars)" autoComplete="new-password" />
            <PwInput value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} placeholder="Confirm new password" autoComplete="new-password" />
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Changing...' : '🔑 Change Password'}
            </button>
          </form>
        </Section>

        {/* ── NOTIFICATIONS & SOUND ────────────────────────────────────────── */}
        <Section icon="🔔" label="Notifications & Sound" sub="Alerts, sounds & ringtones"
          open={section === 'notifs'} onToggle={() => setSection(p => p === 'notifs' ? null : 'notifs')}>

          <Toggle on={notifEnabled} onToggle={toggleNotifications}
            label="Browser Notifications"
            sub="Get popup alerts for messages and calls" />

          <Toggle on={soundEnabled} onToggle={toggleSound}
            label="Message Sound"
            sub="Play a chime when you receive a message" />

          {soundEnabled && (
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={playTestTone} style={{ fontSize: 12, padding: '8px 16px' }}>
                🎵 Test message sound
              </button>
            </div>
          )}

          <div style={{ marginTop: 12, padding: 10, background: 'var(--bg-card)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            📞 <strong style={{ color: 'var(--text-secondary)' }}>Call ringtone</strong> — plays automatically when someone calls you.<br/>
            💬 <strong style={{ color: 'var(--text-secondary)' }}>Message tone</strong> — soft chime on incoming messages.<br/>
            Both use your device's audio output.
          </div>

          {notifEnabled && 'Notification' in window && Notification.permission !== 'granted' && (
            <div style={{ marginTop: 8, padding: 10, background: 'rgba(253,203,110,.1)', border: '1px solid rgba(253,203,110,.3)', borderRadius: 8, fontSize: 12, color: 'var(--warning)' }}>
              ⚠️ Browser permission not yet granted. Toggle off then on again to request it.
            </div>
          )}
        </Section>

        {/* ── THEME ────────────────────────────────────────────────────────── */}
        <Section icon="🎨" label="Theme" sub="App color scheme"
          open={section === 'theme'} onToggle={() => setSection(p => p === 'theme' ? null : 'theme')}>
          {Object.entries(THEMES).map(([key, t]) => (
            <div key={key} onClick={() => handleTheme(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, marginBottom: 6, borderRadius: 'var(--radius-sm)', border: `2px solid ${theme === key ? t.accent : 'var(--border)'}`, cursor: 'pointer', background: theme === key ? 'var(--bg-hover)' : 'transparent', transition: 'all .2s' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.bg, border: `3px solid ${t.accent}`, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{t.label}</span>
              {theme === key && <span style={{ color: t.accent, fontWeight: 800 }}>✓</span>}
            </div>
          ))}
        </Section>

        {/* ── ABOUT ────────────────────────────────────────────────────────── */}
        <Section icon="ℹ️" label="About AuraChat" sub="Version info"
          open={section === 'about'} onToggle={() => setSection(p => p === 'about' ? null : 'about')}>
          <InfoRow label="Version"    value="3.0.0" />
          <InfoRow label="Frontend"   value="React 18 + Vite" />
          <InfoRow label="Backend"    value="Node.js + Socket.io" />
          <InfoRow label="Database"   value="PostgreSQL (Neon)" />
          <InfoRow label="Calling"    value="WebRTC (native P2P)" />
          <InfoRow label="Real-time"  value="Socket.io v4" />
        </Section>

        {/* ── DANGER ZONE ──────────────────────────────────────────────────── */}
        <Section icon="⚠️" label="Danger Zone" sub="Permanently delete account"
          open={section === 'danger'} onToggle={() => setSection(p => p === 'danger' ? null : 'danger')}>
          <div style={{ background: 'rgba(225,112,85,.08)', border: '1px solid rgba(225,112,85,.25)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>⚠️ Delete Account Forever</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>
              This will permanently delete your account, all messages, friends, and group data. This cannot be undone.
            </div>
            {!showDeleteConfirm ? (
              <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)} style={{ padding: '9px 18px', fontSize: 13 }}>
                🗑️ Delete My Account
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <PwInput value={deletePass} onChange={e => setDeletePass(e.target.value)} placeholder="Enter password to confirm" autoComplete="current-password" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-danger" onClick={deleteAccount} disabled={!deletePass} style={{ flex: 1 }}>✓ Confirm Delete</button>
                  <button className="btn btn-ghost" onClick={() => { setShowDeleteConfirm(false); setDeletePass(''); }} style={{ padding: '10px 16px' }}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Sign out */}
        <div style={{ padding: '16px 16px 40px' }}>
          <button className="btn btn-danger w-full" onClick={logout} style={{ padding: 14, fontSize: 15 }}>
            🚪 Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
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
        <span style={{ color: 'var(--text-muted)', fontSize: 22, transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block', lineHeight: 1 }}>›</span>
      </div>
      {open && <div style={s.content}>{children}</div>}
    </div>
  );
}

const s = {
  page:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)', width: '100%' },
  card:    { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 16px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  camBadge:{ position: 'absolute', bottom: 0, right: 0, background: 'var(--accent-primary)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, pointerEvents: 'none' },
  item:    { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', userSelect: 'none', transition: 'background .15s' },
  icon:    { width: 38, height: 38, borderRadius: 10, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  content: { padding: 16, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  lbl:     { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
};
