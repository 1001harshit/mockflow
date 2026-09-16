'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { api, setToken } from '@/lib/api';
import { listContainer, listItem, spring, springSnappy } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

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
        padding: '1.5rem',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <motion.div
        style={{ width: '100%', maxWidth: 390 }}
        variants={listContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div
          variants={listItem}
          style={{ textAlign: 'center', marginBottom: '1.7rem' }}
        >
          <motion.span
            className="brand"
            style={{ fontSize: '1.6rem', justifyContent: 'center' }}
            initial="rest"
            animate="rest"
            whileHover="hover"
          >
            <motion.span
              className="brand-mark"
              style={{ width: 26, height: 26, borderRadius: 9 }}
              variants={{
                rest: { rotate: 0, scale: 1 },
                hover: { rotate: 90, scale: 1.1 },
              }}
              transition={springSnappy}
            />
            MockFlow
          </motion.span>

          {/* the subtitle swaps rather than flips between modes */}
          <div style={{ height: '1.5rem', marginTop: '0.5rem', overflow: 'hidden' }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={mode}
                className="muted"
                style={{ margin: 0 }}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={spring}
              >
                {mode === 'login'
                  ? 'Sign in to your workspace'
                  : 'Create an account to get started'}
              </motion.p>
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.form
          onSubmit={submit}
          className="card edge grid"
          style={{ gap: '0.95rem' }}
          variants={listItem}
          layout
        >
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
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </label>

          <Alert>{error}</Alert>

          <Button variant="primary" busy={busy} type="submit">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={busy ? 'busy' : mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
              >
                {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
              </motion.span>
            </AnimatePresence>
          </Button>
        </motion.form>

        <motion.p
          className="muted"
          style={{ marginTop: '1.1rem', textAlign: 'center' }}
          variants={listItem}
        >
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
        </motion.p>
      </motion.div>
    </div>
  );
}
