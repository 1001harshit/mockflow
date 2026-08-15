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

  const load = useCallback(async () => {
    try {
      const wss = await api.workspaces();
      const withProjects = await Promise.all(
        wss.map(async (w) => ({ ...w, projects: await api.projects(w.id) })),
      );
      setWorkspaces(withProjects);
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
    await api.createProject(wsId, name);
    setDraft((d) => ({ ...d, [wsId]: '' }));
    void load();
  }

  return (
    <>
      <div className="topbar">
        <span className="brand">MockFlow</span>
        <button
          className="btn secondary"
          onClick={() => {
            clearToken();
            router.push('/login');
          }}
        >
          Sign out
        </button>
      </div>
      <div className="container">
        <h2>Workspaces</h2>
        {error && <div className="badge-err">{error}</div>}
        {!workspaces && <p className="muted">Loading…</p>}
        <div className="grid" style={{ gap: '1rem' }}>
          {workspaces?.map((w) => (
            <div className="card" key={w.id}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between' }}
              >
                <strong>{w.name}</strong>
                <span className="muted">{w.role}</span>
              </div>
              <div style={{ marginTop: '0.6rem' }}>
                {w.projects.length > 0 ? (
                  <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                    {w.projects.map((p) => (
                      <li key={p.id}>
                        <a href={`/projects/${p.id}`}>{p.name}</a>{' '}
                        <span className="muted mono">/{p.slug}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">No projects yet.</span>
                )}
              </div>
              <div
                style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}
              >
                <input
                  placeholder="New project name"
                  value={draft[w.id] ?? ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [w.id]: e.target.value }))
                  }
                  style={{ marginTop: 0 }}
                />
                <button className="btn" onClick={() => createProject(w.id)}>
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
