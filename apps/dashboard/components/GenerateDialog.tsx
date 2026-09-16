'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '@/lib/api';
import { spring, springSnappy } from './motion';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Alert } from './ui/Alert';
import { Pill } from './ui/Badges';
import { JsonView } from './ui/JsonView';

export interface GenerateTarget {
  id: string;
  method: string;
  path: string;
}

/**
 * Fills an endpoint's stored response with believable data.
 *
 * The result is previewed before it is kept, because generation is a guess —
 * seeing it first is the difference between a useful default and a surprise
 * the next person has to undo.
 */
export function GenerateDialog({
  projectId,
  target,
  onClose,
  onSaved,
}: {
  projectId: string;
  target: GenerateTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [count, setCount] = useState(8);
  const [seed, setSeed] = useState<number | ''>('');
  const [hint, setHint] = useState('');
  const [result, setResult] = useState<{ source: string; data: unknown } | null>(null);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset between endpoints so one endpoint's preview never shows under another.
  useEffect(() => {
    if (!target) return;
    setResult(null);
    setError(null);
    api
      .aiStatus(projectId)
      .then((s) => setAiReady(s.configured))
      .catch(() => setAiReady(false));
  }, [target, projectId]);

  async function run(save: boolean) {
    save ? setSaving(true) : setBusy(true);
    setError(null);
    try {
      const res = await api.generate(projectId, target!.id, {
        count,
        save,
        ...(seed === '' ? {} : { seed: Number(seed) }),
        ...(hint.trim() ? { hint: hint.trim() } : {}),
      });
      setResult({ source: res.source, data: res.data });
      if (save) {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(target)} onClose={onClose}>
      {target && (
        <>
          <div className="modal-head">
            <motion.div
              className="row"
              style={{ gap: '0.55rem', minWidth: 0 }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={spring}
            >
              <span className={`method ${target.method}`}>{target.method}</span>
              <span className="mono modal-path">{target.path}</span>
            </motion.div>
            <Button size="sm" onClick={onClose} aria-label="Close">
              ✕
            </Button>
          </div>

          <div className="modal-body">
            <div className="row between wrap" style={{ gap: '0.6rem' }}>
              <strong>Generate response data</strong>
              <AnimatePresence mode="wait" initial={false}>
                {aiReady !== null && (
                  <motion.span
                    key={String(aiReady)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={springSnappy}
                  >
                    <Pill tone={aiReady ? 'ok' : undefined}>
                      {aiReady ? 'model connected' : 'local generation'}
                    </Pill>
                  </motion.span>
                )}
              </AnimatePresence>
            </div>

            <p className="muted" style={{ margin: '0.35rem 0 1rem' }}>
              Values come from the field names in your schema, so an email looks
              like an email and a price like a price.
            </p>

            <div className="gen-grid">
              <label>
                Items
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </label>
              <label>
                Seed <span className="faint">(optional)</span>
                <input
                  type="number"
                  placeholder="same seed, same data"
                  value={seed}
                  onChange={(e) =>
                    setSeed(e.target.value === '' ? '' : Number(e.target.value))
                  }
                />
              </label>
            </div>

            <label style={{ marginTop: '0.75rem', display: 'block' }}>
              Hint <span className="faint">(used only when a model is connected)</span>
              <input
                placeholder="e.g. electronics for a resale marketplace"
                value={hint}
                onChange={(e) => setHint(e.target.value)}
              />
            </label>

            <Alert>{error}</Alert>

            <AnimatePresence initial={false}>
              {result && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={spring}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="row between" style={{ margin: '1rem 0 0.5rem' }}>
                    <span className="faint" style={{ fontSize: '0.78rem' }}>
                      Preview — not saved yet
                    </span>
                    <Pill>{result.source}</Pill>
                  </div>
                  <div className="gen-preview">
                    <JsonView value={result.data} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="modal-foot">
            <Button busy={busy} onClick={() => void run(false)}>
              {result ? 'Try again' : 'Preview'}
            </Button>
            <Button variant="primary" busy={saving} onClick={() => void run(true)}>
              Save to endpoint
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
