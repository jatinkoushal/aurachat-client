import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      return setError('Passwords do not match');
    }
    setLoading(true);
    try {
      await register(form.username, form.password);
      navigate('/chats');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card} className="fade-in">
        <div style={styles.logo}>⬡</div>
        <h1 style={styles.title}>Create Account</h1>
        <p style={styles.subtitle}>Join AuraChat today</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <input
              className="input"
              type="text"
              placeholder="Choose a username (3–30 chars)"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
              minLength={3}
              maxLength={30}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              className="input"
              type="password"
              placeholder="At least 6 characters"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              minLength={6}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Confirm Password</label>
            <input
              className="input"
              type="password"
              placeholder="Repeat your password"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              required
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button className="btn btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p style={styles.footer}>
          Already have an account?{' '}
          <Link to="/login" style={styles.link}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: 'var(--shadow)',
    textAlign: 'center',
  },
  logo: { fontSize: '48px', color: 'var(--accent-primary)', marginBottom: '8px' },
  title: { fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' },
  subtitle: { color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' },
  error: {
    background: 'rgba(225,112,85,0.15)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--danger)',
    padding: '10px 14px',
    fontSize: '13px',
    textAlign: 'center',
  },
  footer: { marginTop: '24px', color: 'var(--text-muted)', fontSize: '14px' },
  link: { color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: '600' },
};
