'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FailureRule, FailureType, api } from '@/lib/api';
import { popIn, spring, springSoft } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';

const TYPES: Array<{ value: FailureType; label: string; hint: string }> = [
  { value: 'error', label: 'Error', hint: 'Answer with an error status' },
  { value: 'slow', label: 'Slow', hint: 'Real response, but delayed' },
  { value: 'timeout', label: 'Timeout', hint: 'Stall, then 504' },
  { value: 'network', label: 'Network', hint: 'Drop the connection' },
  { value: 'db_down', label: 'DB down', hint: 'Answer 503' },
];

const cell: React.CSSProperties = {
  background: 'var(--bg-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-sm)',
  color: 'var(--text)',
  padding: '0.35rem 0.5rem',
  font: 'inherit',
  marginTop: 0,
};

/** A one-line summary of an endpoint's rules, for the endpoints table. */
export function failureSummary(rules: FailureRule[] | null): string {
  const active = (rules ?? []).filter((r) => r.enabled !== false && r.percent > 0);
  if (active.length === 0) return '—';
  return active.map((r) => `${r.percent}% ${r.type}`).join(', ');
}

export function FailureEditor({
  projectId,
  endpointId,
  initial,
  endpointLabel,
  onClose,
  onSaved,
}: {
  projectId: string;
  endpointId: string;
  initial: FailureRule[] | null;
  endpointLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [rules, setRules] = useState<FailureRule[]>(initial ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = rules
    .filter((r) => r.enabled !== false)
    .reduce((sum, r) => sum + (Number(r.percent) || 0), 0);
  const overBudget = total > 100;

  function update(i: number, patch: Partial<FailureRule>) {
    setRules(rules.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      // Drop the fields that don't apply to the chosen type, so the API isn't
      // asked to store a delay on an endpoint that answers instantly.
      const payload = rules.map((r) => ({
        type: r.type,
        percent: Number(r.percent) || 0,
        ...(r.type === 'error' && r.statusCode ? { statusCode: Number(r.statusCode) } : {}),
        ...(['slow', 'timeout'].includes(r.type) && r.delayMs !== undefined
          ? { delayMs: Number(r.delayMs) }
          : {}),
        ...(r.enabled === false ? { enabled: false } : {}),
      }));
      await api.updateEndpoint(projectId, endpointId, { failureRules: payload });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      className="card edge"
      style={{ marginTop: '0.9rem', overflow: 'hidden' }}
      variants={popIn}
      initial="hidden"
      animate="show"
      exit="exit"
      layout
    >
      <div className="row between">
        <div>
          <strong>Failure simulation</strong>
          {endpointLabel && (
            <span className="muted mono" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
              {endpointLabel}
            </span>
          )}
        </div>
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <p className="muted" style={{ margin: '0.5rem 0 0.7rem' }}>
        One roll per request across these rules —{' '}
        <motion.strong
          key={total}
          initial={{ scale: 1.25, color: 'var(--a)' }}
          animate={{ scale: 1, color: 'var(--muted)' }}
          transition={spring}
          style={{ display: 'inline-block' }}
        >
          {total}%
        </motion.strong>{' '}
        of traffic misbehaves, {Math.max(0, 100 - total)}% is served normally.
      </p>

      <div className={`budget-bar${overBudget ? ' over' : ''}`}>
        <motion.span
          animate={{ width: `${Math.min(total, 100)}%` }}
          transition={springSoft}
        />
      </div>

      <AnimatePresence initial={false} mode="popLayout">
        {rules.length === 0 && (
          <motion.p
            key="empty"
            className="muted"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            No rules yet — this endpoint always behaves.
          </motion.p>
        )}

        {rules.map((rule, i) => (
          <motion.div
            key={i}
            className="rule-row"
            layout
            initial={{ opacity: 0, x: -20, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            exit={{ opacity: 0, x: 24, height: 0 }}
            transition={springSoft}
          >
            <select
              style={{ ...cell, width: 112 }}
              value={rule.type}
              onChange={(e) => update(i, { type: e.target.value as FailureType })}
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0}
              max={100}
              style={{ ...cell, width: 72 }}
              value={rule.percent}
              onChange={(e) => update(i, { percent: Number(e.target.value) })}
            />
            <span className="muted">%</span>

            {/* type-specific fields swap in place rather than popping the row */}
            <AnimatePresence mode="popLayout" initial={false}>
              {rule.type === 'error' && (
                <motion.input
                  key="status"
                  type="number"
                  placeholder="500"
                  style={{ ...cell, width: 92 }}
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 92 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={springSoft}
                  value={rule.statusCode ?? ''}
                  onChange={(e) =>
                    update(i, {
                      statusCode: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              )}

              {(rule.type === 'slow' || rule.type === 'timeout') && (
                <motion.input
                  key="delay"
                  type="number"
                  placeholder={rule.type === 'slow' ? '1000' : '30000'}
                  style={{ ...cell, width: 112 }}
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 112 }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={springSoft}
                  value={rule.delayMs ?? ''}
                  onChange={(e) =>
                    update(i, {
                      delayMs: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              )}
            </AnimatePresence>

            <motion.span
              key={rule.type}
              className="faint"
              style={{ fontSize: '0.78rem' }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {TYPES.find((t) => t.value === rule.type)?.hint}
            </motion.span>

            <label className="muted" style={{ fontSize: '0.78rem' }}>
              <input
                type="checkbox"
                style={{ width: 'auto', marginTop: 0, marginRight: 4 }}
                checked={rule.enabled !== false}
                onChange={(e) => update(i, { enabled: e.target.checked })}
              />
              on
            </label>

            <div style={{ marginLeft: 'auto' }}>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setRules(rules.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <Alert>{overBudget ? `Rules total ${total}% — they must not exceed 100%.` : error}</Alert>

      <div className="row" style={{ marginTop: '0.8rem' }}>
        <Button onClick={() => setRules([...rules, { type: 'error', percent: 10 }])}>
          Add rule
        </Button>
        <Button
          variant="primary"
          busy={saving}
          onClick={() => void save()}
          disabled={overBudget}
        >
          {saving ? 'Saving…' : 'Save rules'}
        </Button>
      </div>
    </motion.div>
  );
}
