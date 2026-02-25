import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Sidebar/Avatar';
import api from '../services/api';

export default function Settings() {
  const { user, setUser, logout } = useAuth();
  const [section, setSection] = useState(null);
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    setSaving(true); setMsg('');
    try {
      const fd = new FormData();
      fd.append('bio', bio);
      if (avatarFile) fd.append('avatar', avatarFile);
      const res = await api.patch('/api/auth/profile', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser(prev => ({ ...prev, ...res.data.user }));
      setAvatarFile(null);
      setMsg('✅ Profile updated!');
    } catch (err) { setMsg('❌ ' + (err.response?.data?.error || 'Failed')); }
    finally { setSaving(false); }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) return setMsg('❌ Passwords do not match');
    setSaving(true); setMsg('');
    try {
      await api.patch('/api/auth/password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setMsg('✅ Password changed!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) { setMsg('❌ ' + (err.response?.data?.error || 'Failed')); }
    finally { setSaving(false); }
  };

  const menuItems = [
    { icon: '👤', label: 'Account', sub: 'Username, Bio, Avatar', key: 'account' },
    { icon: '🔒', label: 'Privacy & Security', sub: 'Password, Blocked users', key: 'privacy' },
    { icon: '🔔', label: 'Notifications', sub: 'Sound, Badges', key: 'notifications' },
    { icon: '💬', label: 'Chat Settings', sub: 'Dark mode, Animations', key: 'chat' },
    { icon: '❓', label: 'Help & About', sub: 'Version, Support', key: 'help' },
  ];

  return (
    <div style={s.page}>
      {/* Profile header — always visible */}
      <div style={s.profileCard}>
        <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
          <Avatar username={user?.username} avatarUrl={avatarPreview} size="xl" />
          <span style={s.cameraBtn}>📷</span>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{user?.username}</div>
          {section === 'account' ? (
            <textarea className="input" style={{ marginTop: 6, resize: 'none', fontSize: 13, padding: '6px 10px' }}
              placeholder="Add a bio..." value={bio} onChange={e => setBio(e.target.value)} rows={2} maxLength={150} />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{user?.bio || 'No bio yet — tap Account to add one'}</div>
          )}
        </div>
      </div>

      {/* Save profile button */}
      {(avatarFile || bio !== (user?.bio || '')) && (
        <div style={{ padding: '0 16px 12px' }}>
          <button className="btn btn-primary w-full" onClick={saveProfile} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      )}

      {msg && <div style={{ margin: '0 16px 12px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: msg.startsWith('✅') ? 'rgba(0,184,148,0.15)' : 'rgba(225,112,85,0.15)', fontSize: 13, color: msg.startsWith('✅') ? 'var(--online-green)' : 'var(--danger)' }}>{msg}</div>}

      {/* Menu items */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {menuItems.map(item => (
          <div key={item.key}>
            <div onClick={() => setSection(section === item.key ? null : item.key)} style={s.menuItem}>
              <span style={s.menuIcon}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{item.label}</div>
                <div className="text-muted">{item.sub}</div>
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{section === item.key ? '∨' : '›'}</span>
            </div>

            {/* Account section */}
            {section === 'account' && item.key === 'account' && (
              <div style={s.sectionContent}>
                <div style={s.infoRow}><span style={s.infoLabel}>Username</span><span style={s.infoVal}>@{user?.username}</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Member since</span><span style={s.infoVal}>{new Date(user?.created_at).toLocaleDateString()}</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>User ID</span><span style={{ ...s.infoVal, fontFamily: 'monospace', fontSize: 11 }}>{user?.id?.slice(0, 16)}...</span></div>
              </div>
            )}

            {/* Privacy section */}
            {section === 'privacy' && item.key === 'privacy' && (
              <div style={s.sectionContent}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 14 }}>Change your password</p>
                <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input className="input" type="password" placeholder="Current password"
                    value={pwForm.currentPassword} onChange={e => setPwForm(p => ({ ...p, currentPassword: e.target.value }))} />
                  <input className="input" type="password" placeholder="New password (min 6 chars)"
                    value={pwForm.newPassword} onChange={e => setPwForm(p => ({ ...p, newPassword: e.target.value }))} />
                  <input className="input" type="password" placeholder="Confirm new password"
                    value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} />
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Changing...' : 'Change Password'}
                  </button>
                </form>
              </div>
            )}

            {/* Notifications section */}
            {section === 'notifications' && item.key === 'notifications' && (
              <div style={s.sectionContent}>
                <div style={s.infoRow}><span style={s.infoLabel}>Message sounds</span><span style={s.infoVal}>Enabled</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Call alerts</span><span style={s.infoVal}>Enabled</span></div>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>Full notification settings coming soon</p>
              </div>
            )}

            {/* Chat settings */}
            {section === 'chat' && item.key === 'chat' && (
              <div style={s.sectionContent}>
                <div style={s.infoRow}><span style={s.infoLabel}>Theme</span><span style={s.infoVal}>Dark (default)</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Animations</span><span style={s.infoVal}>Enabled</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Font size</span><span style={s.infoVal}>Medium</span></div>
              </div>
            )}

            {/* Help */}
            {section === 'help' && item.key === 'help' && (
              <div style={s.sectionContent}>
                <div style={s.infoRow}><span style={s.infoLabel}>Version</span><span style={s.infoVal}>2.0.0</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Frontend</span><span style={s.infoVal}>React + Vite</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Backend</span><span style={s.infoVal}>Node.js + Socket.io</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Database</span><span style={s.infoVal}>PostgreSQL (Neon)</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Video</span><span style={s.infoVal}>Jitsi Meet</span></div>
                <div style={s.infoRow}><span style={s.infoLabel}>Images</span><span style={s.infoVal}>Compressed to WebP 200px</span></div>
              </div>
            )}
          </div>
        ))}

        {/* Sign out */}
        <div style={{ padding: '8px 16px 32px' }}>
          <button className="btn btn-danger w-full" onClick={logout}>Sign Out</button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' },
  profileCard: { display: 'flex', alignItems: 'center', gap: 16, padding: '20px 16px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', marginBottom: 8 },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, background: 'var(--accent-primary)', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 },
  menuItem: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background .15s' },
  menuIcon: { width: 38, height: 38, borderRadius: 10, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 },
  sectionContent: { padding: '14px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 14 },
  infoLabel: { color: 'var(--text-secondary)' },
  infoVal: { color: 'var(--accent-secondary)', fontWeight: 600 },
};
