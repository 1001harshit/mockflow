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
      const { accessToken } = await api.login(email, password);
      setToken(accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 400 }}>
      <h1 style={{ marginBottom: '0.25rem' }}>MockFlow</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {mode === 'login' ? 'Sign in to your workspace' : 'Create an account'}
      </p>
      <form onSubmit={submit} className="card grid" style={{ gap: '0.9rem' }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        {error && <div className="badge-err">{error}</div>}
        <button className="btn" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Register'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: '1rem' }}>
        {mode === 'login' ? "No account? " : 'Have an account? '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setMode(mode === 'login' ? 'register' : 'login');
          }}
        >
          {mode === 'login' ? 'Register' : 'Sign in'}
        </a>
      </p>
    </div>
  );
}
