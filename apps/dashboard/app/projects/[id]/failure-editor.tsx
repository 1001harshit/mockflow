'use client';

import { useState } from 'react';
import { FailureRule, FailureType, api } from '../../../lib/api';

const TYPES: Array<{ value: FailureType; label: string; hint: string }> = [
  { value: 'error', label: 'Error', hint: 'Answer with an error status' },
  { value: 'slow', label: 'Slow', hint: 'Real response, but delayed' },
  { value: 'timeout', label: 'Timeout', hint: 'Stall, then 504' },
  { value: 'network', label: 'Network', hint: 'Drop the connection' },
  { value: 'db_down', label: 'DB down', hint: 'Answer 503' },
];

const cell: React.CSSProperties = {
  background: '#0e1220',
  border: '1px solid var(--border)',
  borderRadius: 6,
  color: 'var(--text)',
  padding: '0.35rem 0.45rem',
  font: 'inherit',
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
    <div className="card" style={{ marginBottom: '1.4rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <strong>Failure simulation</strong>
          {endpointLabel && (
            <span className="muted mono" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
              {endpointLabel}
            </span>
          )}
        </div>
        <button className="btn secondary sm" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="muted" style={{ margin: '0.4rem 0 0.6rem' }}>
        One roll per request across these rules — {total}% of traffic misbehaves,{' '}
        {Math.max(0, 100 - total)}% is served normally.
      </p>

      <div
        style={{
          display: 'flex',
          height: 6,
          borderRadius: 999,
          overflow: 'hidden',
          background: 'var(--green)',
          marginBottom: '0.9rem',
        }}
      >
        <div
          style={{
            width: `${Math.min(total, 100)}%`,
            background: overBudget ? 'var(--red)' : 'var(--amber)',
            transition: 'width 0.18s ease',
          }}
        />
      </div>

      {rules.length === 0 && (
        <p className="muted">No rules yet — this endpoint always behaves.</p>
      )}

      {rules.map((rule, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            marginBottom: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <select
            style={{ ...cell, width: 110 }}
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
            style={{ ...cell, width: 70, marginTop: 0 }}
            value={rule.percent}
            onChange={(e) => update(i, { percent: Number(e.target.value) })}
          />
          <span className="muted">%</span>

          {rule.type === 'error' && (
            <input
              type="number"
              placeholder="500"
              style={{ ...cell, width: 90, marginTop: 0 }}
              value={rule.statusCode ?? ''}
              onChange={(e) =>
                update(i, {
                  statusCode: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          )}

          {(rule.type === 'slow' || rule.type === 'timeout') && (
            <input
              type="number"
              placeholder={rule.type === 'slow' ? '1000' : '30000'}
              style={{ ...cell, width: 110, marginTop: 0 }}
              value={rule.delayMs ?? ''}
              onChange={(e) =>
                update(i, {
                  delayMs: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          )}

          <span className="muted" style={{ fontSize: '0.78rem' }}>
            {TYPES.find((t) => t.value === rule.type)?.hint}
          </span>

          <label className="muted" style={{ fontSize: '0.78rem' }}>
            <input
              type="checkbox"
              style={{ width: 'auto', marginTop: 0, marginRight: 4 }}
              checked={rule.enabled !== false}
              onChange={(e) => update(i, { enabled: e.target.checked })}
            />
            on
          </label>

          <button
            className="btn danger sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setRules(rules.filter((_, j) => j !== i))}
          >
            Remove
          </button>
        </div>
      ))}

      {overBudget && (
        <div className="alert error">
          Rules total {total}% — they must not exceed 100%.
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.7rem' }}>
        <button
          className="btn secondary"
          onClick={() =>
            setRules([...rules, { type: 'error', percent: 10 }])
          }
        >
          Add rule
        </button>
        <button
          className="btn"
          onClick={() => void save()}
          disabled={overBudget || saving}
        >
          {saving ? 'Saving…' : 'Save rules'}
        </button>
      </div>
    </div>
  );
}
