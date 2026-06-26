import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not reset password. The link may be invalid or expired.');
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

        {!token ? (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Invalid link</h1>
            <p style={{ fontSize: '13px', color: 'var(--label3)', lineHeight: 1.5, marginBottom: '24px' }}>
              This reset link is missing its token. Please request a new one.
            </p>
            <Link to="/forgot-password" style={backLinkStyle}>Request a new reset link</Link>
          </>
        ) : done ? (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Password reset</h1>
            <p style={{ fontSize: '13px', color: 'var(--label3)', lineHeight: 1.5, marginBottom: '24px' }}>
              Your password has been updated. Redirecting you to sign in…
            </p>
            <Link to="/login" style={backLinkStyle}>Go to sign in →</Link>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '6px' }}>Set a new password</h1>
            <p style={{ fontSize: '13px', color: 'var(--label3)', marginBottom: '24px' }}>
              Choose a new password for your account.
            </p>

            <form onSubmit={handleSubmit}>
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
                style={inputStyle}
              />

              <label style={{ ...labelStyle, marginTop: '16px' }}>Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Re-enter password"
                style={inputStyle}
              />

              {error && <div style={errorStyle}>{error}</div>}

              <button type="submit" disabled={loading} style={btnStyle(loading)}>
                {loading ? 'Resetting...' : 'Reset password'}
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