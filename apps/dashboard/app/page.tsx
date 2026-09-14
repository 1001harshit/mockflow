'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearToken, getToken } from '../lib/api';

type Workspace = Awaited<ReturnType<typeof api.workspaces>>[number];
type Project = Awaited<ReturnType<typeof api.projects>>[number];
type WorkspaceWithProjects = Workspace & { projects: Project[] };

export default function Home() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithProjects[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const wss = await api.workspaces();
      const withProjects = await Promise.all(
        wss.map(async (w) => ({ ...w, projects: await api.projects(w.id) })),
      );
      setWorkspaces(withProjects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.push('/login');
      return;
    }
    void load();
  }, [load, router]);

  async function createProject(wsId: string) {
    const name = (draft[wsId] ?? '').trim();
    if (!name) return;
    setCreating(wsId);
    try {
      await api.createProject(wsId, name);
      setDraft((d) => ({ ...d, [wsId]: '' }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <span className="brand">MockFlow</span>
        <div className="topbar-actions">
          <button className="btn secondary sm" onClick={() => void load()}>
            Refresh
          </button>
          <button
            className="btn secondary sm"
            onClick={() => {
              clearToken();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="container">
        <h2>Workspaces</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Each project gets its own mock server and URL.
        </p>

        {error && <div className="alert error">{error}</div>}

        {!workspaces && (
          <div className="card grid" style={{ gap: '0.7rem' }}>
            <div className="skeleton" style={{ width: '30%' }} />
            <div className="skeleton" style={{ width: '65%' }} />
            <div className="skeleton" style={{ width: '45%' }} />
          </div>
        )}

        <div className="grid" style={{ gap: '1rem' }}>
          {workspaces?.map((w) => (
            <div className="card" key={w.id}>
              <div className="row between">
                <strong style={{ fontSize: '1rem' }}>{w.name}</strong>
                <span className="pill">{w.role.toLowerCase()}</span>
              </div>

              <div style={{ marginTop: '0.85rem' }}>
                {w.projects.length > 0 ? (
                  <div className="grid" style={{ gap: '0.45rem' }}>
                    {w.projects.map((p) => (
                      <a
                        key={p.id}
                        href={`/projects/${p.id}`}
                        className="row between"
                        style={{
                          background: 'var(--bg-soft)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--r)',
                          padding: '0.6rem 0.75rem',
                          color: 'var(--text)',
                          textDecoration: 'none',
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span className="muted mono" style={{ fontSize: '0.78rem' }}>
                          /{p.slug} →
                        </span>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="empty" style={{ padding: '1.2rem 0.5rem' }}>
                    <strong>No projects yet</strong>
                    Create one below, then import an OpenAPI spec into it.
                  </div>
                )}
              </div>

              <div className="row" style={{ marginTop: '0.85rem' }}>
                <input
                  placeholder="New project name"
                  value={draft[w.id] ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [w.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createProject(w.id);
                  }}
                />
                <button
                  className="btn"
                  onClick={() => void createProject(w.id)}
                  disabled={creating === w.id || !(draft[w.id] ?? '').trim()}
                >
                  {creating === w.id ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
