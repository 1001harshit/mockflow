'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';

type Endpoints = Awaited<ReturnType<typeof api.endpoints>>;
type Stats = Awaited<ReturnType<typeof api.stats>>;
type Logs = Awaited<ReturnType<typeof api.logs>>;

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [endpoints, setEndpoints] = useState<Endpoints | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Logs>([]);
  const [spec, setSpec] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [e, s, l] = await Promise.all([
        api.endpoints(id),
        api.stats(id),
        api.logs(id, 20),
      ]);
      setEndpoints(e);
      setStats(s);
      setLogs(l);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function importSpec() {
    setError(null);
    try {
      await api.importSpec(id, JSON.parse(spec));
      setSpec('');
      void load();
    } catch (err) {
      setError('Import failed: ' + (err instanceof Error ? err.message : err));
    }
  }

  const mockBase = `${api.base}/mock/${id}`;

  return (
    <>
      <div className="topbar">
        <a href="/" className="brand">
          MockFlow
        </a>
        <button className="btn secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <div className="container">
        <p className="muted">
          <a href="/">← Workspaces</a>
        </p>
        <h2>Project</h2>
        <p className="muted">
          Mock base URL: <span className="mono">{mockBase}/…</span>
        </p>
        {error && <div className="badge-err">{error}</div>}

        <div className="grid stat-row" style={{ margin: '1rem 0 1.4rem' }}>
          <div className="card stat">
            <div className="label">Requests</div>
            <div className="value">{stats?.totalRequests ?? '—'}</div>
          </div>
          <div className="card stat">
            <div className="label">Error rate</div>
            <div className="value">
              {stats ? `${(stats.errorRate * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
          <div className="card stat">
            <div className="label">p50 latency</div>
            <div className="value">
              {stats ? `${stats.latencyMs.p50}ms` : '—'}
            </div>
          </div>
          <div className="card stat">
            <div className="label">p95 latency</div>
            <div className="value">
              {stats ? `${stats.latencyMs.p95}ms` : '—'}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.4rem' }}>
          <strong>Import OpenAPI</strong>
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="Paste OpenAPI JSON…"
            style={{
              width: '100%',
              minHeight: 90,
              marginTop: '0.5rem',
              background: '#0e1220',
              color: 'inherit',
              border: '1px solid var(--border)',
              borderRadius: 7,
              padding: '0.6rem',
              fontFamily: 'ui-monospace, monospace',
            }}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <button className="btn" onClick={importSpec}>
              Import
            </button>
          </div>
        </div>

        <h3>Endpoints</h3>
        <div
          className="card"
          style={{ padding: 0, overflow: 'hidden', marginBottom: '1.4rem' }}
        >
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Try</th>
              </tr>
            </thead>
            <tbody>
              {endpoints?.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="method">{e.method}</span>
                  </td>
                  <td className="mono">{e.path}</td>
                  <td>{e.responses[0]?.statusCode ?? '—'}</td>
                  <td>
                    <a
                      href={`${mockBase}${e.path.replace(/\{[^}]+\}/g, '1')}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      open
                    </a>
                  </td>
                </tr>
              ))}
              {endpoints?.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No endpoints — import a spec above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <h3>Recent requests</h3>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead>
              <tr>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Latency</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className="method">{l.method}</span>
                  </td>
                  <td className="mono">{l.path}</td>
                  <td className={l.statusCode >= 400 ? 'badge-err' : 'badge-ok'}>
                    {l.statusCode}
                  </td>
                  <td>{l.latencyMs}ms</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No requests yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
