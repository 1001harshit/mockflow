'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

type Token = { text: string; cls: string };

const TOKEN =
  /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g;

/** Classify JSON literals so the viewer can colour them without a dependency. */
function tokenize(line: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: line.slice(last, i), cls: 'j-punct' });
    const t = m[0];
    const cls = t.startsWith('"')
      ? t.trimEnd().endsWith(':')
        ? 'j-key'
        : 'j-str'
      : t === 'true' || t === 'false'
        ? 'j-bool'
        : t === 'null'
          ? 'j-null'
          : 'j-num';
    out.push({ text: t, cls });
    last = i + t.length;
  }
  if (last < line.length) out.push({ text: line.slice(last), cls: 'j-punct' });
  return out;
}

/**
 * Pretty-printed, highlighted and scrollable. Lines cascade in, but only for
 * payloads small enough that the cascade reads as one motion rather than a
 * thousand separate ones — past that they simply appear.
 */
export function JsonView({ value, raw }: { value?: unknown; raw?: string }) {
  const text =
    raw !== undefined ? raw : JSON.stringify(value ?? null, null, 2) ?? 'null';
  const lines = text.split('\n');
  const animate = lines.length <= 160;

  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ top: 0, bottom: 0 });

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setEdges({
      top: Math.min(1, el.scrollTop / 24),
      bottom: max > 0 ? Math.min(1, (max - el.scrollTop) / 24) : 0,
    });
  }, []);

  // Scroll alone can't seed this: a body that overflows on arrival needs its
  // bottom fade before anyone has scrolled at all.
  useEffect(() => {
    measure();
  }, [measure, text]);

  return (
    <div className="json-wrap">
      {/* the fades only appear on the side that actually has more content */}
      <motion.div
        className="json-fade top"
        initial={{ opacity: 0 }}
        animate={{ opacity: edges.top }}
      />
      <motion.div
        className="json-fade bottom"
        initial={{ opacity: 0 }}
        animate={{ opacity: edges.bottom }}
      />
      <div className="json-scroll" ref={scroller} onScroll={measure} tabIndex={0}>
        <pre className="json">
          {lines.map((line, i) => {
            const spans = tokenize(line).map((t, j) => (
              <span key={j} className={t.cls}>
                {t.text}
              </span>
            ));
            return animate ? (
              <motion.div
                key={i}
                className="json-line"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 60) * 0.012, duration: 0.24 }}
              >
                {spans}
              </motion.div>
            ) : (
              <div key={i} className="json-line">
                {spans}
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}
