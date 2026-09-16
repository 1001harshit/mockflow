'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Modal } from './ui/Modal';
import { JsonView } from './ui/JsonView';
import { Button } from './ui/Button';
import { MethodBadge } from './ui/Badges';
import { CountUp } from './ui/CountUp';
import { spring, springSnappy } from './motion';

export type PreviewTarget = {
  id: string;
  method: string;
  path: string;
  url: string;
} | null;

type Result = {
  status: number;
  statusText: string;
  ms: number;
  bytes: number;
  json?: unknown;
  text?: string;
  headers: Record<string, string>;
};

const BODY_METHODS = ['POST', 'PUT', 'PATCH'];

export function ResponsePreview({
  target,
  onClose,
}: {
  target: PreviewTarget;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'body' | 'headers'>('body');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = useCallback(async () => {
    if (!target) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const started = performance.now();
    try {
      const res = await fetch(target.url, {
        method: target.method,
        ...(BODY_METHODS.includes(target.method)
          ? { headers: { 'content-type': 'application/json' }, body: '{}' }
          : {}),
      });
      const text = await res.text();

      // Wall-clock here would also count time this tab spent animating or
      // laying out, which on a busy frame reads as seconds for a 2ms mock.
      // Resource timing is the browser's own measurement of the request.
      const entry = performance
        .getEntriesByName(target.url, 'resource')
        .filter((e) => e.startTime >= started)
        .pop() as PerformanceResourceTiming | undefined;
      const ms = Math.round(entry ? entry.duration : performance.now() - started);
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });
      let json: unknown;
      try {
        json = text ? JSON.parse(text) : undefined;
      } catch {
        /* not JSON — the raw text is shown instead */
      }
      setResult({
        status: res.status,
        statusText: res.statusText,
        ms,
        bytes: new Blob([text]).size,
        json,
        text,
        headers,
      });
    } catch (err) {
      // A dropped connection is a legitimate outcome here — it's what the
      // "network" failure rule is meant to produce.
      setError(
        err instanceof Error
          ? `${err.message} — the connection was dropped before a response arrived.`
          : String(err),
      );
    } finally {
      setLoading(false);
    }
  }, [target]);

  useEffect(() => {
    if (target) {
      setTab('body');
      void send();
    }
  }, [target, send]);

  const tone =
    result == null ? '' : result.status >= 500 ? 'err' : result.status >= 400 ? 'warn' : 'ok';

  return (
    <Modal open={!!target} onClose={onClose}>
      {target && (
        <>
          <div className="modal-head">
            <motion.div
              className="row"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...spring, delay: 0.06 }}
            >
              <MethodBadge method={target.method} layoutId={`method-${target.id}`} />
              <span className="mono modal-path">{target.path}</span>
            </motion.div>

            <div className="row" style={{ gap: '0.45rem' }}>
              <Button size="sm" busy={loading} onClick={() => void send()}>
                <motion.span
                  aria-hidden
                  style={{ display: 'inline-block' }}
                  animate={loading ? { rotate: 360 } : { rotate: 0 }}
                  transition={
                    loading
                      ? { repeat: Infinity, duration: 0.8, ease: 'linear' }
                      : springSnappy
                  }
                >
                  ⟳
                </motion.span>
                Send again
              </Button>
              <Button size="sm" onClick={onClose} aria-label="Close">
                ✕
              </Button>
            </div>
          </div>

          {/* the response line-up: status, time, size */}
          <div className="modal-meta">
            <AnimatePresence mode="wait">
              {result && (
                <motion.div
                  key="meta"
                  className="row"
                  style={{ gap: '0.5rem' }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={spring}
                >
                  <motion.span
                    className={`chip ${tone}`}
                    initial={{ scale: 0.7 }}
                    animate={{ scale: 1 }}
                    transition={{ ...spring, delay: 0.05 }}
                  >
                    {result.status} {result.statusText}
                  </motion.span>
                  <span className="chip" title="Round trip measured by the browser">
                    <CountUp value={result.ms} format={(n) => `${Math.round(n)} ms`} />
                  </span>
                  <span className="chip">
                    <CountUp value={result.bytes} format={(n) => `${Math.round(n)} B`} />
                  </span>
                </motion.div>
              )}
              {loading && (
                <motion.span
                  key="loading"
                  className="muted"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Calling the mock…
                </motion.span>
              )}
            </AnimatePresence>

            {result && (
              <div className="tabs">
                {(['body', 'headers'] as const).map((t) => (
                  <button
                    key={t}
                    className={`tab ${tab === t ? 'on' : ''}`}
                    onClick={() => setTab(t)}
                  >
                    {t === 'body' ? 'Body' : `Headers (${Object.keys(result.headers).length})`}
                    {tab === t && (
                      /* one underline that slides between tabs */
                      <motion.span
                        className="tab-underline"
                        layoutId="preview-tab-underline"
                        transition={spring}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="modal-body">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  key="skeleton"
                  className="grid"
                  style={{ gap: '0.55rem', padding: '1rem 1.15rem' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {['62%', '84%', '48%', '73%', '35%'].map((w, i) => (
                    <motion.div
                      key={w}
                      className="skeleton"
                      style={{ width: w }}
                      animate={{ backgroundPosition: ['100% 50%', '0% 50%'] }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.3,
                        ease: 'linear',
                        delay: i * 0.08,
                      }}
                    />
                  ))}
                </motion.div>
              )}

              {error && !loading && (
                <motion.div
                  key="error"
                  className="alert error"
                  style={{ margin: '1rem 1.15rem' }}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={spring}
                >
                  {error}
                </motion.div>
              )}

              {result && !loading && (
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  style={{ minHeight: 0, display: 'flex' }}
                >
                  {tab === 'body' ? (
                    result.json !== undefined ? (
                      <JsonView value={result.json} />
                    ) : (
                      <JsonView raw={result.text || '(empty response body)'} />
                    )
                  ) : (
                    <JsonView value={result.headers} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="modal-foot">
            <span className="mono faint modal-url">{target.url}</span>
            <a
              className="row-link"
              href={target.url}
              target="_blank"
              rel="noreferrer"
              style={{ marginLeft: 'auto' }}
            >
              open in a tab ↗
            </a>
          </div>
        </>
      )}
    </Modal>
  );
}
