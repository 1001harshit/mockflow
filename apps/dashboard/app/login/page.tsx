'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setToken } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        await api.register(email, password);
      }
      const { accessToken, refreshToken } = await api.login(email, password);
      setToken(accessToken, refreshToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span className="brand" style={{ fontSize: '1.5rem' }}>
            MockFlow
          </span>
          <p className="muted" style={{ margin: '0.45rem 0 0' }}>
            {mode === 'login'
              ? 'Sign in to your workspace'
              : 'Create an account to get started'}
          </p>
        </div>

        <form onSubmit={submit} className="card grid" style={{ gap: '0.9rem' }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              autoFocus
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              autoComplete={
                mode === 'register' ? 'new-password' : 'current-password'
              }
              minLength={8}
              required
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button className="btn" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'login'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="muted" style={{ marginTop: '1rem', textAlign: 'center' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setError(null);
              setMode(mode === 'login' ? 'register' : 'login');
            }}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </a>
        </p>
      </div>
    </div>
  );
}
