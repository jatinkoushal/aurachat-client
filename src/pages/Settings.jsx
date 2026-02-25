import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

const THEMES = {
  dark:   { label: '🌑 Dark (Default)', bg: '#0f0e1a', accent: '#6c63ff' },
  purple: { label: '💜 Deep Purple',    bg: '#120b2e', accent: '#9c27b0' },
  blue:   { label: '💙 Ocean Blue',     bg: '#0a1628', accent: '#2196f3' },
  green:  { label: '💚 Forest Green',   bg: '#0a1f0a', accent: '#4caf50' },
  red:    { label: '❤️ Ruby Red',       bg: '#1a0a0a', accent: '#f44336' },
};

function applyTheme(key) {
  const t = THEMES[key];
  if (!t) return;
  document.documentElement.style.setProperty('--bg-primary', t.bg);
  document.documentElement.style.setProperty('--accent-primary', t.accent);
  document.documentElement.style.setProperty('--bg-secondary', t.bg === '#0f0e1a' ? '#1a1830' : t.bg + 'cc');
  localStorage.setItem('theme', key);
}

// Apply saved theme on load
const savedTheme = localStorage.getItem('theme');
if (savedTheme) applyTheme(savedTheme);

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
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem('theme') || 'dark');
  const fileRef = useRef();

  const showMsg = (text, ok = true) => setMsg({ text, ok });

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return showMsg('Image must be under 5MB', false);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    setSaving(true); showMsg('');
    try {
      const fd = new FormData();
      fd.append('bio', bio);
      if (newUsername.trim() && newUsername.trim() !== user?.username) {
        fd.append('username', newUsername.trim());
      }
      if (avatarFile) fd.append('avatar', avatarFile);
      const res = await api.patch('/api/auth/profile', fd);
      setUser(prev => ({ ...prev, ...res.data.user }));
      setAvatarFile(null);
      showMsg('✅ Profile updated successfully!');
    } catch (err) {
      showMsg('❌ ' + (err.response?.data?.error || 'Failed to save'), false);
    } finally { setSaving(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) return showMsg('❌ Passwords do not match', false);
    if (pwForm.next.length < 6) return showMsg('❌ Password must be at least 6 characters', false);
    setSaving(true); showMsg('');
    try {
      await api.patch('/api/auth/password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      showMsg('✅ Password changed successfully!');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      showMsg('❌ ' + (err.response?.data?.error || 'Failed'), false);
    } finally { setSaving(false); }
  };

  const handleTheme = (key) => {
    applyTheme(key);
    setCurrentTheme(key);
    showMsg('✅ Theme applied!');
  };

  const profileChanged = avatarFile || bio !== (user?.bio || '') || newUsername.trim() !== (user?.username || '');

  return (
    <div style={s.page}>
      {/* Profile card */}
      <div style={s.profileCard}>
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

      {/* Message bar */}
      {msg.text && (
        <div style={{ ...s.msgBar, background: msg.ok ? 'rgba(0,184,148,0.15)' : 'rgba(225,112,85,0.15)', color: msg.ok ? 'var(--online-green)' : 'var(--danger)' }}>
          {msg.text}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* ── ACCOUNT ── */}
        <Section icon="👤" label="Account" sub="Username, Bio, Avatar" open={section === 'account'} onToggle={() => setSection(p => p === 'account' ? null : 'account')}>
          <label style={s.fieldLabel}>Username</label>
          <input className="input" value={newUsername} onChange={e => setNewUsername(e.target.value)}
            placeholder="New username" style={{ marginBottom: 12 }} />

          <label style={s.fieldLabel}>Bio</label>
          <textarea className="input" value={bio} onChange={e => setBio(e.target.value)}
            placeholder="Tell people about yourself..." rows={3} maxLength={150}
            style={{ resize: 'none', marginBottom: 4 }} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: 12 }}>{bio.length}/150</div>

          <div style={s.infoRow}><span style={s.infoLbl}>Member since</span>
            <span style={s.infoVal}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}</span>
          </div>
          <div style={s.infoRow}><span style={s.infoLbl}>User ID</span>
            <span style={{ ...s.infoVal, fontFamily: 'monospace', fontSize: 11 }}>{user?.id?.slice(0, 18)}...</span>
          </div>

          <button className="input" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border)', cursor: 'pointer', textAlign: 'center', color: 'var(--text-secondary)', marginTop: 8 }}
            onClick={() => fileRef.current?.click()}>
            📷 {avatarFile ? 'Photo selected ✓' : 'Change Profile Photo'}
          </button>

          {profileChanged && (
            <button className="btn btn-primary w-full" onClick={saveProfile} disabled={saving} style={{ marginTop: 14 }}>
              {saving ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          )}
        </Section>

        {/* ── PRIVACY & SECURITY ── */}
        <Section icon="🔒" label="Privacy & Security" sub="Password change" open={section === 'privacy'} onToggle={() => setSection(p => p === 'privacy' ? null : 'privacy')}>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>
            Change your login password. You'll need your current password.
          </p>
          <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="input" type="password" placeholder="Current password"
              value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required />
            <input className="input" type="password" placeholder="New password (min 6 chars)"
              value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} required />
            <input className="input" type="password" placeholder="Confirm new password"
              value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required />
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Changing...' : '🔑 Change Password'}
            </button>
          </form>
        </Section>

        {/* ── THEME ── */}
        <Section icon="🎨" label="Theme" sub="Change app color scheme" open={section === 'theme'} onToggle={() => setSection(p => p === 'theme' ? null : 'theme')}>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 12 }}>Select a theme. Changes apply instantly.</p>
          {Object.entries(THEMES).map(([key, t]) => (
            <div key={key} onClick={() => handleTheme(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', marginBottom: 6, borderRadius: 'var(--radius-sm)', border: `2px solid ${currentTheme === key ? t.accent : 'var(--border)'}`, cursor: 'pointer', background: currentTheme === key ? 'var(--bg-hover)' : 'transparent' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.bg, border: `3px solid ${t.accent}`, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{t.label}</span>
              {currentTheme === key && <span style={{ color: t.accent, fontWeight: 800 }}>✓</span>}
            </div>
          ))}
        </Section>

        {/* ── NOTIFICATIONS ── */}
        <Section icon="🔔" label="Notifications" sub="Sound, alerts" open={section === 'notifs'} onToggle={() => setSection(p => p === 'notifs' ? null : 'notifs')}>
          <div style={s.infoRow}><span style={s.infoLbl}>Message sounds</span><span style={s.infoVal}>✅ Enabled</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Call alerts</span><span style={s.infoVal}>✅ Enabled</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Group notifications</span><span style={s.infoVal}>✅ Enabled</span></div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Full per-chat notification controls coming soon.</p>
        </Section>

        {/* ── ABOUT ── */}
        <Section icon="ℹ️" label="About AuraChat" sub="Version, tech stack" open={section === 'about'} onToggle={() => setSection(p => p === 'about' ? null : 'about')}>
          <div style={s.infoRow}><span style={s.infoLbl}>Version</span><span style={s.infoVal}>2.0.0</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Frontend</span><span style={s.infoVal}>React 18 + Vite</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Backend</span><span style={s.infoVal}>Node.js + Socket.io</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Database</span><span style={s.infoVal}>PostgreSQL (Neon)</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Video calls</span><span style={s.infoVal}>Jitsi Meet (free)</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Images</span><span style={s.infoVal}>Compressed → WebP 200px</span></div>
          <div style={s.infoRow}><span style={s.infoLbl}>Real-time</span><span style={s.infoVal}>Socket.io v4</span></div>
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

function Section({ icon, label, sub, open, onToggle, children }) {
  return (
    <div>
      <div onClick={onToggle} style={s.menuItem}>
        <span style={s.menuIcon}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontSize: 20, transition: 'transform .2s', display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </div>
      {open && <div style={s.sectionContent}>{children}</div>}
    </div>
  );
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' },
  profileCard: { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 16px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  cam: { position: 'absolute', bottom: 0, right: 0, background: 'var(--accent-primary)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 },
  msgBar: { padding: '10px 16px', fontSize: 13, fontWeight: 600 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', userSelect: 'none' },
  menuIcon: { width: 38, height: 38, borderRadius: 10, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  sectionContent: { padding: '16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  fieldLabel: { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 },
  infoLbl: { color: 'var(--text-secondary)' },
  infoVal: { color: 'var(--accent-secondary)', fontWeight: 600 },
};
