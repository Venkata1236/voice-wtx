import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/authService';

export default function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await authService.register({ full_name: fullName, email, password, role: 'view' });
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not create account. Please contact your admin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrapStyle}>
      {/* Left panel */}
      <div style={leftStyle}>
        <div style={{ maxWidth: '360px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '48px' }}>
            <span style={{ fontWeight: 900, fontSize: '28px', letterSpacing: '-1px', color: '#fff' }}>WTX</span>
            <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.3)' }} />
            <span style={{ fontWeight: 700, fontSize: '22px', color: 'var(--accent)' }}>Voice</span>
          </div>
          <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: '16px', letterSpacing: '-0.5px' }}>
            AI-powered copy,<br />built for your brand.
          </h2>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
            Write, compare, and refine on-brand marketing copy across all your clients — in seconds.
          </p>
          <div style={{ marginTop: '48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              'Single, Compare & Forge modes',
              'Brand Knowledge Base per client',
              'Vision — generate from images',
              'Notes & insights per brand',
            ].map((label) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--accent)', fontSize: '10px' }}>✦</span>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={rightStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px', color: 'var(--label1)' }}>
              Create account
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--label3)' }}>
              Request access to WTX Voice
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Full name */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>User name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                placeholder="Enter your name"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your mail"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '8px' }}>
              <label style={labelStyle}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  style={{ ...inputStyle, paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--label3)', fontSize: '13px', padding: '2px',
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                marginTop: '12px', padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--red-bg)', color: 'var(--red)', fontSize: '12px',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', marginTop: '20px', padding: '12px',
                borderRadius: 'var(--radius-md)', border: 'none',
                background: '#1E1E2A', color: '#fff',
                fontSize: '14px', fontWeight: 600,
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.65 : 1, fontFamily: 'inherit',
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p style={{ marginTop: '24px', fontSize: '12px', color: 'var(--label3)', textAlign: 'center' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
              Sign in
            </Link>
          </p>

          <div style={{
            marginTop: '32px', paddingTop: '20px',
            borderTop: '1px solid var(--sep)',
            display: 'flex', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--label3)' }}>
              WTX India · Internal platform
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const wrapStyle = { height: '100vh', display: 'flex', fontFamily: 'inherit' };
const leftStyle = { width: '42%', background: '#1E1E2A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' };
const rightStyle = { flex: 1, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' };
const cardStyle = { background: '#fff', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)', padding: '40px', width: '100%', maxWidth: '400px', border: '1px solid var(--sep)' };
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--label2)', marginBottom: '6px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--sep)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', background: 'var(--surface)', boxSizing: 'border-box' };