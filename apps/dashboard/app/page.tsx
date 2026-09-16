'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { api, clearToken, getToken } from '@/lib/api';
import { listContainer, listItem, spring, springSnappy } from '@/components/motion';
import { Topbar } from '@/components/ui/Topbar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Pill } from '@/components/ui/Badges';

type Workspace = Awaited<ReturnType<typeof api.workspaces>>[number];
type Project = Awaited<ReturnType<typeof api.projects>>[number];
type WorkspaceWithProjects = Workspace & { projects: Project[] };

export default function Home() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceWithProjects[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const wss = await api.workspaces();
      const withProjects = await Promise.all(
        wss.map(async (w) => ({ ...w, projects: await api.projects(w.id) })),
      );
      setWorkspaces(withProjects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
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
      <Topbar>
        <Button size="sm" busy={refreshing} onClick={() => void load()}>
          <motion.span
            aria-hidden
            animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={
              refreshing
                ? { repeat: Infinity, duration: 0.8, ease: 'linear' }
                : springSnappy
            }
            style={{ display: 'inline-block' }}
          >
            ⟳
          </motion.span>
          Refresh
        </Button>
        <Button
          size="sm"
          onClick={() => {
            clearToken();
            router.push('/login');
          }}
        >
          Sign out
        </Button>
      </Topbar>

      <motion.div className="container" variants={listContainer}>
        <motion.h2 variants={listItem}>Workspaces</motion.h2>
        <motion.p className="page-sub" variants={listItem}>
          Each project gets its own mock server and URL.
        </motion.p>

        <Alert>{error}</Alert>

        <AnimatePresence mode="wait">
          {!workspaces && (
            <motion.div
              key="loading"
              className="card grid"
              style={{ gap: '0.7rem', marginTop: '1.4rem' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <Skeleton width="30%" />
              <Skeleton width="65%" />
              <Skeleton width="45%" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div className="grid" style={{ gap: '1rem', marginTop: '1.4rem' }}>
          {workspaces?.map((w) => (
            <Card key={w.id} edge>
              <div className="row between">
                <strong style={{ fontSize: '1.02rem' }}>{w.name}</strong>
                <Pill tone="grad">{w.role.toLowerCase()}</Pill>
              </div>

              <div style={{ marginTop: '0.95rem' }}>
                {w.projects.length > 0 ? (
                  <motion.div
                    className="grid"
                    style={{ gap: '0.5rem' }}
                    variants={listContainer}
                    initial="hidden"
                    animate="show"
                  >
                    <AnimatePresence mode="popLayout">
                      {w.projects.map((p) => (
                        <motion.a
                          key={p.id}
                          layout
                          href={`/projects/${p.id}`}
                          className="project-link"
                          variants={listItem}
                          exit="exit"
                          initial="rest"
                          whileHover="hover"
                          animate="rest"
                        >
                          <motion.span
                            style={{ fontWeight: 620 }}
                            variants={{ rest: { x: 0 }, hover: { x: 4 } }}
                            transition={spring}
                          >
                            {p.name}
                          </motion.span>
                          <span className="muted mono" style={{ fontSize: '0.78rem' }}>
                            /{p.slug}{' '}
                            <motion.span
                              className="arrow"
                              variants={{
                                rest: { x: 0, color: 'var(--faint)' },
                                hover: { x: 5, color: 'var(--p)' },
                              }}
                              transition={spring}
                            >
                              →
                            </motion.span>
                          </span>
                        </motion.a>
                      ))}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <EmptyState title="No projects yet">
                    Create one below, then import an OpenAPI spec into it.
                  </EmptyState>
                )}
              </div>

              <div className="row" style={{ marginTop: '0.95rem' }}>
                <input
                  placeholder="New project name"
                  value={draft[w.id] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [w.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void createProject(w.id);
                  }}
                />
                <Button
                  variant="primary"
                  busy={creating === w.id}
                  onClick={() => void createProject(w.id)}
                  disabled={!(draft[w.id] ?? '').trim()}
                >
                  {creating === w.id ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </Card>
          ))}
        </motion.div>
      </motion.div>
    </>
  );
}
