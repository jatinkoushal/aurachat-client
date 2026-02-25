import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input className="input" type={show ? 'text' : 'password'}
        placeholder={placeholder} value={value} onChange={onChange}
        autoComplete={autoComplete} required minLength={6}
        style={{ paddingRight: 44 }} />
      <button type="button" onClick={() => setShow(s => !s)}
        style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--text-muted)', padding:0, lineHeight:1 }}>
        {show ? '🙈' : '👁️'}
      </button>
    </div>
  );
}

export default function Register() {
  const [form, setForm] = useState({ username:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    try { await register(form.username, form.password); navigate('/chats'); }
    catch (err) { setError(err.response?.data?.error || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={s.page}>
      <div style={s.card} className="fade-in">
        <div style={s.logo}>⬡</div>
        <h1 style={s.title}>Create Account</h1>
        <p style={s.sub}>Join AuraChat today</p>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Username</label>
            <input className="input" type="text" placeholder="3–30 chars, letters/numbers/_"
              value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              minLength={3} maxLength={30} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <PasswordInput value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="At least 6 characters" autoComplete="new-password" />
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirm Password</label>
            <PasswordInput value={form.confirm} onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              placeholder="Repeat password" autoComplete="new-password" />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>
        <p style={s.footer}>Already have an account? <Link to="/login" style={s.link}>Sign in</Link></p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight:'100dvh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 },
  card: { background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:40, width:'100%', maxWidth:400, boxShadow:'var(--shadow)', textAlign:'center' },
  logo: { fontSize:48, color:'var(--accent-primary)', marginBottom:8 },
  title: { fontSize:28, fontWeight:800, marginBottom:4 },
  sub: { color:'var(--text-muted)', fontSize:14, marginBottom:32 },
  form: { display:'flex', flexDirection:'column', gap:16, textAlign:'left' },
  field: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontSize:13, fontWeight:600, color:'var(--text-secondary)' },
  error: { background:'rgba(225,112,85,.15)', border:'1px solid var(--danger)', borderRadius:'var(--radius-sm)', color:'var(--danger)', padding:'10px 14px', fontSize:13, textAlign:'center' },
  footer: { marginTop:24, color:'var(--text-muted)', fontSize:14 },
  link: { color:'var(--accent-primary)', textDecoration:'none', fontWeight:600 },
};
