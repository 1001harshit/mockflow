'use client';

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api, type WebhookProvider } from '@/lib/api';
import { collapse, listItem, rowItem, spring, springSnappy } from './motion';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Pill } from './ui/Badges';
import { EmptyState } from './ui/EmptyState';
import { SectionHead } from './ui/SectionHead';
import { Skeleton } from './ui/Skeleton';

type Webhook = Awaited<ReturnType<typeof api.webhooks>>[number];
type Catalog = Awaited<ReturnType<typeof api.webhookProviders>>;
type Report = Awaited<ReturnType<typeof api.sendWebhook>>;

/**
 * Register a target, fire a signed delivery at it, and watch each attempt.
 *
 * The secret is shown once, on creation, and never again — the same contract
 * the real providers use, so nobody builds a habit of reading it back later.
 */
export function WebhooksPanel({ projectId }: { projectId: string }) {
  const [hooks, setHooks] = useState<Webhook[] | null>(null);
  const [catalog, setCatalog] = useState<Catalog>([]);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<WebhookProvider>('stripe');
  const [targetUrl, setTargetUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<{ value: string; header: string } | null>(null);

  const [openHook, setOpenHook] = useState<string | null>(null);
  const [event, setEvent] = useState('');
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  const load = useCallback(async () => {
    try {
      const [list, cat] = await Promise.all([
        api.webhooks(projectId),
        api.webhookProviders(projectId),
      ]);
      setHooks(list);
      setCatalog(cat);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const eventsFor = (p: WebhookProvider) =>
    catalog.find((c) => c.provider === p)?.events ?? [];

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const created = await api.createWebhook(projectId, {
        name: name.trim(),
        provider,
        targetUrl: targetUrl.trim(),
      });
      setSecret({ value: created.secret, header: created.signatureHeader });
      setName('');
      setTargetUrl('');
      setAdding(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function send(hook: Webhook) {
    setSending(true);
    setReport(null);
    setError(null);
    try {
      const chosen = event || eventsFor(hook.provider)[0];
      setReport(await api.sendWebhook(projectId, hook.id, { event: chosen, maxAttempts: 3 }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function remove(hook: Webhook) {
    setError(null);
    try {
      await api.deleteWebhook(projectId, hook.id);
      if (openHook === hook.id) setOpenHook(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <>
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <SectionHead title="Webhooks" count={hooks ? String(hooks.length) : undefined} />
        <Button
          size="sm"
          variant={adding ? 'ghost' : 'secondary'}
          onClick={() => setAdding((a) => !a)}
        >
          {adding ? 'Cancel' : '+ Add webhook'}
        </Button>
      </div>

      <Alert>{error}</Alert>

      {/* the secret, shown exactly once */}
      <AnimatePresence>
        {secret && (
          <motion.div
            className="secret-note"
            variants={collapse}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            <div className="row between wrap" style={{ gap: '0.5rem' }}>
              <strong>Copy this secret now — it won&apos;t be shown again</strong>
              <Button size="sm" onClick={() => setSecret(null)}>
                Done
              </Button>
            </div>
            <code className="mono secret-value">{secret.value}</code>
            <p className="faint" style={{ margin: '0.4rem 0 0', fontSize: '0.78rem' }}>
              Signature arrives in <span className="mono">{secret.header}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* create form */}
      <AnimatePresence initial={false}>
        {adding && (
          <motion.div
            className="card"
            variants={collapse}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ overflow: 'hidden', marginBottom: '0.9rem' }}
          >
            <div className="hook-form">
              <label>
                Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Payments"
                />
              </label>
              <label>
                Provider
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as WebhookProvider)}
                >
                  {catalog.map((c) => (
                    <option key={c.provider} value={c.provider}>
                      {c.provider}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ gridColumn: '1 / -1' }}>
                Target URL
                <input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="http://localhost:4999/hook"
                />
              </label>
            </div>
            <div className="row" style={{ marginTop: '0.7rem' }}>
              <Button
                variant="primary"
                busy={creating}
                disabled={!name.trim() || !targetUrl.trim()}
                onClick={() => void create()}
              >
                Create webhook
              </Button>
              <span className="faint" style={{ fontSize: '0.78rem' }}>
                Signed the way {provider} signs its own
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* list */}
      {!hooks && <Skeleton width="60%" />}

      {hooks?.length === 0 && !adding && (
        <EmptyState title="No webhooks yet">
          Add one to send signed events at a URL and watch the retries.
        </EmptyState>
      )}

      <div className="grid" style={{ gap: '0.55rem' }}>
        <AnimatePresence mode="popLayout">
          {hooks?.map((h, i) => (
            <motion.div
              key={h.id}
              layout
              className="hook-row"
              variants={rowItem}
              custom={i}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <div
                className="row between wrap"
                style={{ gap: '0.5rem', cursor: 'pointer' }}
                onClick={() => {
                  setOpenHook(openHook === h.id ? null : h.id);
                  setReport(null);
                  setEvent('');
                }}
              >
                <div className="row" style={{ gap: '0.55rem', minWidth: 0 }}>
                  <motion.span
                    className="chev"
                    animate={{ rotate: openHook === h.id ? 90 : 0 }}
                    transition={springSnappy}
                  >
                    ›
                  </motion.span>
                  <strong>{h.name}</strong>
                  <Pill tone="grad">{h.provider}</Pill>
                </div>
                <span className="faint mono hook-url">{h.targetUrl}</span>
              </div>

              <AnimatePresence initial={false}>
                {openHook === h.id && (
                  <motion.div
                    variants={collapse}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    style={{ overflow: 'hidden' }}
                  >
                    <div className="row wrap" style={{ gap: '0.5rem', marginTop: '0.8rem' }}>
                      <select
                        value={event || eventsFor(h.provider)[0] || ''}
                        onChange={(e) => setEvent(e.target.value)}
                        style={{ maxWidth: 260 }}
                      >
                        {eventsFor(h.provider).map((ev) => (
                          <option key={ev} value={ev}>
                            {ev}
                          </option>
                        ))}
                      </select>
                      <Button variant="primary" busy={sending} onClick={() => void send(h)}>
                        Send event
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => void remove(h)}>
                        Delete
                      </Button>
                    </div>

                    <AnimatePresence initial={false}>
                      {report && (
                        <motion.div
                          variants={listItem}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          style={{ marginTop: '0.8rem' }}
                        >
                          <div className="row" style={{ gap: '0.5rem' }}>
                            <Pill tone={report.delivered ? 'ok' : 'on'}>
                              {report.delivered ? 'delivered' : 'gave up'}
                            </Pill>
                            <span className="faint" style={{ fontSize: '0.79rem' }}>
                              {report.attempts.length} attempt
                              {report.attempts.length === 1 ? '' : 's'} ·{' '}
                              <span className="mono">{report.signatureHeader}</span>
                            </span>
                          </div>

                          <div className="attempts">
                            {report.attempts.map((a) => (
                              <motion.div
                                key={a.attempt}
                                className="attempt"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ ...spring, delay: a.attempt * 0.07 }}
                              >
                                <span className="faint">#{a.attempt}</span>
                                <span className={a.success ? 'status' : 'status err'}>
                                  {a.statusCode ?? (a.error ? 'no response' : '—')}
                                </span>
                                {!a.success && a.error && (
                                  <span className="faint mono">{a.error}</span>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
