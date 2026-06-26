import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/authService';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      // Backend always returns generic success (anti-enumeration)
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrapStyle}>
      <div style={cardStyle}>
        <div style={logoStyle}>
          <span style={{ fontWeight: 800, fontSize: '20px', letterSpacing: '-0.5px' }}>WTX</span>
          <div style={{ width: '1px', height: '18px', background: 'var(--sep)' }} />
          <span style={{ fontWeight: 600, fontSize: '16px', color: 'var(--accent)' }}>Voice</span>
        </div>

        {sent ? (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Check your inbox</h1>
            <p style={{ fontSize: '13px', color: 'var(--label3)', lineHeight: 1.5, marginBottom: '24px' }}>
              If an account exists for <strong>{email}</strong>, we've sent a password reset link.
              It's valid for 1 hour. Don't forget to check spam.
            </p>
            <Link to="/login" style={backLinkStyle}>← Back to sign in</Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Forgot password</h1>
            <p style={{ fontSize: '13px', color: 'var(--label3)', marginBottom: '24px' }}>
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@wtxindia.com"
                style={inputStyle}
              />

              {error && <div style={errorStyle}>{error}</div>}

              <button type="submit" disabled={loading} style={btnStyle(loading)}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '18px' }}>
              <Link to="/login" style={backLinkStyle}>← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const wrapStyle = {
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--surface)',
};

const cardStyle = {
  background: '#fff',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow-md)',
  padding: '40px',
  width: '380px',
  border: '1px solid var(--sep)',
};

const logoStyle = { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' };

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--label2)',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--sep)',
  fontSize: '14px',
  fontFamily: 'inherit',
  outline: 'none',
  background: 'var(--surface)',
};

const errorStyle = {
  marginTop: '12px',
  padding: '10px 12px',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--red-bg)',
  color: 'var(--red)',
  fontSize: '12px',
};

const btnStyle = (loading) => ({
  width: '100%',
  marginTop: '20px',
  padding: '11px',
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: '#1E1E2A',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 600,
  cursor: loading ? 'default' : 'pointer',
  opacity: loading ? 0.6 : 1,
  fontFamily: 'inherit',
});

const backLinkStyle = {
  fontSize: '13px',
  color: 'var(--accent)',
  textDecoration: 'none',
  fontWeight: 500,
};