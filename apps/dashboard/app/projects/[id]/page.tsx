'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { FailureEditor, failureSummary } from './failure-editor';

type Project = Awaited<ReturnType<typeof api.project>>;
type Endpoints = Awaited<ReturnType<typeof api.endpoints>>;
type Stats = Awaited<ReturnType<typeof api.stats>>;
type Logs = Awaited<ReturnType<typeof api.logs>>;

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [project, setProject] = useState<Project | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoints | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Logs>([]);
  const [spec, setSpec] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, e, s, l] = await Promise.all([
        api.project(id),
        api.endpoints(id),
        api.stats(id),
        api.logs(id, 20),
      ]);
      setProject(p);
      setEndpoints(e);
      setStats(s);
      setLogs(l);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const mockBase = `${api.base}/mock/${id}`;

  async function copyBase() {
    try {
      await navigator.clipboard.writeText(mockBase);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the URL is on screen anyway */
    }
  }

  async function importSpec() {
    setError(null);
    setNotice(null);
    setImporting(true);
    try {
      const parsed = JSON.parse(spec);
      const result = await api.importSpec(id, parsed);
      setSpec('');
      setNotice(
        `Imported ${(result as { imported: number }).imported} endpoint(s).`,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof SyntaxError
          ? "That isn't valid JSON. Paste the spec as JSON — YAML isn't supported yet."
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setImporting(false);
    }
  }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  return (
    <>
      <div className="topbar">
        <a href="/" className="brand">
          MockFlow
        </a>
        <div className="topbar-actions">
          <button className="btn secondary sm" onClick={() => void load()}>
            Refresh
          </button>
        </div>
      </div>

      <div className="container">
        <p className="muted" style={{ marginTop: 0 }}>
          <a href="/">← Workspaces</a>
        </p>

        <div className="row between wrap" style={{ marginBottom: '0.3rem' }}>
          <h2 style={{ margin: 0 }}>
            {project ? project.name : <span className="muted">Loading…</span>}
          </h2>
          {project && (
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              {project.workspace.name} · {project._count.endpoints} endpoint
              {project._count.endpoints === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="url-bar" style={{ margin: '0.7rem 0 1.2rem' }}>
          <span className="muted">{mockBase}/…</span>
          <button
            className="btn secondary sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => void copyBase()}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert ok">{notice}</div>}

        {/* ---------- stats ---------- */}
        <div className="grid stat-row" style={{ margin: '0 0 1.4rem' }}>
          <div className="card stat">
            <div className="label">Requests</div>
            <div className="value">{stats?.totalRequests ?? '—'}</div>
          </div>
          <div className="card stat">
            <div className="label">Error rate</div>
            <div className="value">{stats ? pct(stats.errorRate) : '—'}</div>
            <div className="sub">of the last {stats?.sampleSize ?? 0}</div>
          </div>
          <div className="card stat">
            <div className="label">p50</div>
            <div className="value">{stats ? `${stats.latencyMs.p50}ms` : '—'}</div>
          </div>
          <div className="card stat">
            <div className="label">p95</div>
            <div className="value">{stats ? `${stats.latencyMs.p95}ms` : '—'}</div>
          </div>
          <div className="card stat">
            <div className="label">Injected</div>
            <div className="value">
              {stats ? pct(stats.injectedFailures.rate) : '—'}
            </div>
            <div className="sub">
              {stats && stats.injectedFailures.count > 0
                ? Object.entries(stats.injectedFailures.byType)
                    .map(([type, n]) => `${type} ${n}`)
                    .join(' · ')
                : 'no chaos'}
            </div>
          </div>
        </div>

        {/* ---------- import ---------- */}
        <div className="card" style={{ marginBottom: '1.4rem' }}>
          <div className="row between">
            <strong>Import OpenAPI</strong>
            <span className="muted" style={{ fontSize: '0.78rem' }}>
              JSON only · re-importing updates existing endpoints
            </span>
          </div>
          <textarea
            className="code"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder='{ "openapi": "3.0.0", "info": { … }, "paths": { … } }'
            style={{ marginTop: '0.6rem' }}
          />
          <div className="row" style={{ marginTop: '0.6rem' }}>
            <button
              className="btn"
              onClick={() => void importSpec()}
              disabled={importing || !spec.trim()}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
            {spec && (
              <button className="btn secondary" onClick={() => setSpec('')}>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* ---------- endpoints ---------- */}
        <h3>Endpoints</h3>
        <div className="card pad-0" style={{ marginBottom: '1.4rem' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Mode</th>
                  <th>Failures</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {endpoints?.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <span className={`method ${e.method}`}>{e.method}</span>
                    </td>
                    <td className="mono">{e.path}</td>
                    <td>{e.responses[0]?.statusCode ?? '—'}</td>
                    <td>
                      <span className={`pill ${e.stateful ? 'ok' : ''}`}>
                        {e.stateful ? 'stateful' : 'static'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn sm ${
                          (e.failureRules ?? []).length ? 'danger' : 'secondary'
                        }`}
                        onClick={() =>
                          setEditing(editing === e.id ? null : e.id)
                        }
                      >
                        {failureSummary(e.failureRules)}
                      </button>
                    </td>
                    <td>
                      <a
                        href={`${mockBase}${e.path.replace(/\{[^}]+\}/g, '1')}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        open ↗
                      </a>
                    </td>
                  </tr>
                ))}
                {endpoints?.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty">
                        <strong>No endpoints yet</strong>
                        Paste an OpenAPI document above and they appear here,
                        live immediately.
                      </div>
                    </td>
                  </tr>
                )}
                {!endpoints && (
                  <tr>
                    <td colSpan={6}>
                      <div className="skeleton" style={{ margin: '0.6rem 0' }} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editing && (
          <FailureEditor
            projectId={id}
            endpointId={editing}
            initial={endpoints?.find((e) => e.id === editing)?.failureRules ?? []}
            endpointLabel={(() => {
              const e = endpoints?.find((x) => x.id === editing);
              return e ? `${e.method} ${e.path}` : undefined;
            })()}
            onClose={() => setEditing(null)}
            onSaved={() => void load()}
          />
        )}

        {/* ---------- logs ---------- */}
        <h3>Recent requests</h3>
        <div className="card pad-0">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Path</th>
                  <th>Status</th>
                  <th>Latency</th>
                  <th>Failure</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className={`method ${l.method}`}>{l.method}</span>
                    </td>
                    <td className="mono">{l.path}</td>
                    <td className={l.statusCode >= 400 ? 'badge-err' : 'badge-ok'}>
                      {l.statusCode === 0 ? 'dropped' : l.statusCode}
                    </td>
                    <td>{l.latencyMs}ms</td>
                    <td>
                      {l.failureType ? (
                        <span className="pill on">{l.failureType}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty">
                        <strong>No requests yet</strong>
                        Call a mock URL above and it shows up here.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
