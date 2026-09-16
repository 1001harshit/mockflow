'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { api } from '@/lib/api';
import {
  listContainer,
  listItem,
  rowItem,
  spring,
  springSnappy,
} from '@/components/motion';
import { Topbar } from '@/components/ui/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Panel } from '@/components/ui/Panel';
import { Stat, StatStrip } from '@/components/ui/Stat';
import { SectionHead } from '@/components/ui/SectionHead';
import { Toggle } from '@/components/ui/Toggle';
import { GenerateDialog, type GenerateTarget } from '@/components/GenerateDialog';
import { WebhooksPanel } from '@/components/WebhooksPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { MethodBadge, Pill, StatusCode } from '@/components/ui/Badges';
import { TopProgress } from '@/components/ui/TopProgress';
import { ResponsePreview, type PreviewTarget } from '@/components/ResponsePreview';
import { FailureEditor, failureSummary } from './failure-editor';

type Project = Awaited<ReturnType<typeof api.project>>;
type Endpoints = Awaited<ReturnType<typeof api.endpoints>>;
type Stats = Awaited<ReturnType<typeof api.stats>>;
type Logs = Awaited<ReturnType<typeof api.logs>>;

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const ms = (n: number) => `${Math.round(n)}ms`;

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [project, setProject] = useState<Project | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoints | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<Logs>([]);
  const [spec, setSpec] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [generating, setGenerating] = useState<GenerateTarget | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [preview, setPreview] = useState<PreviewTarget>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
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
    } finally {
      setRefreshing(false);
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

  /** Flip an endpoint between a fixed response and the CRUD-backed store. */
  async function toggleStateful(endpointId: string, next: boolean) {
    setTogglingId(endpointId);
    setError(null);
    try {
      await api.updateEndpoint(id, endpointId, { stateful: next });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTogglingId(null);
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
      setNotice(`Imported ${(result as { imported: number }).imported} endpoint(s).`);
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

  /** Path params have no meaning on a mock, so a placeholder stands in. */
  const mockUrlFor = (path: string) =>
    `${mockBase}${path.replace(/\{[^}]+\}/g, '1')}`;

  return (
    <>
      <TopProgress active={refreshing} />
      <Topbar href="/">
        <Button size="sm" busy={refreshing} onClick={() => void load()}>
          <motion.span
            aria-hidden
            style={{ display: 'inline-block' }}
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={
              refreshing
                ? { repeat: Infinity, duration: 0.8, ease: 'linear' }
                : springSnappy
            }
          >
            ⟳
          </motion.span>
          Refresh
        </Button>
      </Topbar>

      <motion.div className="container" variants={listContainer}>
        <motion.a
          href="/"
          className="crumb"
          variants={listItem}
          initial="rest"
          animate="rest"
          whileHover="hover"
        >
          <motion.span
            variants={{ rest: { x: 0 }, hover: { x: -4 } }}
            transition={spring}
          >
            ←
          </motion.span>
          Workspaces
        </motion.a>

        <motion.div className="page-head" variants={listItem}>
          <h2>{project ? project.name : <span className="muted">Loading…</span>}</h2>
          {project && (
            <span className="faint" style={{ fontSize: '0.82rem' }}>
              {project.workspace.name} · {project._count.endpoints} endpoint
              {project._count.endpoints === 1 ? '' : 's'}
            </span>
          )}
        </motion.div>

        <motion.div
          className="url-bar"
          variants={listItem}
          style={{ marginTop: '0.9rem' }}
        >
          <span>{mockBase}/…</span>
          <div style={{ marginLeft: 'auto' }}>
            <Button size="sm" onClick={() => void copyBase()}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={copied ? 'copied' : 'copy'}
                  initial={{ opacity: 0, y: 9 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -9 }}
                  transition={{ duration: 0.15 }}
                  style={{ display: 'inline-block' }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </motion.span>
              </AnimatePresence>
            </Button>
          </div>
        </motion.div>

        <Alert>{error}</Alert>
        <Alert kind="ok">{notice}</Alert>

        <div style={{ marginTop: '1.3rem' }}>
          <StatStrip>
            <Stat label="Requests" value={stats?.totalRequests} sub="all time" />
            <Stat
              label="Error rate"
              value={stats?.errorRate}
              format={pct}
              sub={`of the last ${stats?.sampleSize ?? 0}`}
            />
            <Stat label="p50" value={stats?.latencyMs.p50} format={ms} sub="median latency" />
            <Stat label="p95" value={stats?.latencyMs.p95} format={ms} sub="slowest 5%" />
            <Stat
              label="Injected"
              value={stats?.injectedFailures.rate}
              format={pct}
              sub={
                stats && stats.injectedFailures.count > 0
                  ? Object.entries(stats.injectedFailures.byType)
                      .map(([type, n]) => `${type} ${n}`)
                      .join(' · ')
                  : 'no chaos'
              }
            />
          </StatStrip>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <Panel
            title="Import OpenAPI"
            hint="JSON only · re-importing updates existing endpoints"
          >
            <textarea
              className="code"
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder='{ "openapi": "3.0.0", "info": { … }, "paths": { … } }'
            />
            <div className="row" style={{ marginTop: '0.7rem' }}>
              <Button
                variant="primary"
                busy={importing}
                onClick={() => void importSpec()}
                disabled={!spec.trim()}
              >
                {importing ? 'Importing…' : 'Import'}
              </Button>
              <AnimatePresence>
                {spec && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={springSnappy}
                  >
                    <Button onClick={() => setSpec('')}>Clear</Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Panel>
        </div>

        {/* ---------- endpoints ---------- */}
        <SectionHead
          title="Endpoints"
          count={endpoints ? `${endpoints.length} total` : undefined}
        />
        <Card flush layout>
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
                <AnimatePresence initial={false}>
                  {endpoints?.map((e, i) => (
                    <motion.tr
                      key={e.id}
                      custom={i}
                      variants={rowItem}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.028)' }}
                      whileTap={{ scale: 0.998 }}
                    >
                      <td>
                        <MethodBadge
                          method={e.method}
                          layoutId={`method-${e.id}`}
                          dimmed={preview?.id === e.id}
                        />
                      </td>
                      <td className="mono">{e.path}</td>
                      <td>
                        <StatusCode code={e.responses[0]?.statusCode} />
                      </td>
                      <td>
                        <div className="row" style={{ gap: '0.5rem' }}>
                          <Toggle
                            on={e.stateful}
                            busy={togglingId === e.id}
                            label={`Stateful mode for ${e.method} ${e.path}`}
                            onChange={(next) => void toggleStateful(e.id, next)}
                          />
                          <span className={e.stateful ? '' : 'faint'} style={{ fontSize: '0.79rem' }}>
                            {e.stateful ? 'stateful' : 'static'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant={(e.failureRules ?? []).length ? 'chaos' : 'ghost'}
                          onClick={() => setEditing(editing === e.id ? null : e.id)}
                        >
                          {failureSummary(e.failureRules)}
                        </Button>
                      </td>
                      <td>
                        <div className="row" style={{ gap: '0.35rem' }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setGenerating({ id: e.id, method: e.method, path: e.path })
                            }
                          >
                            Generate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setPreview({
                                id: e.id,
                                method: e.method,
                                path: e.path,
                                url: mockUrlFor(e.path),
                              })
                            }
                          >
                            open ↗
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {endpoints?.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState title="No endpoints yet">
                        Paste an OpenAPI document above and they appear here, live
                        immediately.
                      </EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <AnimatePresence>
          {editing && (
            <FailureEditor
              key={editing}
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
        </AnimatePresence>

        {/* ---------- logs ---------- */}
        <SectionHead
          title="Recent requests"
          count={logs.length > 0 ? `last ${logs.length}` : undefined}
        />
        <Card flush layout>
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
                <AnimatePresence initial={false}>
                  {logs.map((l, i) => (
                    <motion.tr
                      key={l.id}
                      custom={i}
                      variants={rowItem}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      whileHover={{ backgroundColor: 'rgba(255,255,255,0.028)' }}
                      whileTap={{ scale: 0.998 }}
                    >
                      <td>
                        <MethodBadge method={l.method} />
                      </td>
                      <td className="mono">{l.path}</td>
                      <td>
                        <StatusCode code={l.statusCode} />
                      </td>
                      <td className="num">{l.latencyMs}ms</td>
                      <td>
                        {l.failureType ? (
                          <Pill tone="on">{l.failureType}</Pill>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No requests yet">
                        Call a mock URL above and it shows up here.
                      </EmptyState>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <GenerateDialog
          projectId={id}
          target={generating}
          onClose={() => setGenerating(null)}
          onSaved={() => void load()}
        />

        <ResponsePreview target={preview} onClose={() => setPreview(null)} />
        <div style={{ marginTop: '2rem' }}>
          <WebhooksPanel projectId={id} />
        </div>

      </motion.div>
    </>
  );
}
