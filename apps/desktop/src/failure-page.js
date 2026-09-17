'use strict';

/**
 * Shown when the servers do not come up.
 *
 * The alternative is a white window or a connection-refused page, neither of
 * which tells the user whether the app is broken, still starting, or missing a
 * build step — which is the usual cause.
 */
function failurePage(message) {
  const safe = String(message)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html><head><meta charset="utf-8"><title>MockFlow</title><style>
  :root { color-scheme: dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center;
         justify-content:center; background:#0b0a09; color:#f2efec;
         font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; padding:2rem; }
  .card { max-width:620px; }
  .mark { width:22px; height:22px; border-radius:7px;
          background:linear-gradient(118deg,#f0a52a,#f2683c); margin-bottom:1.1rem; }
  h1 { font-size:1.2rem; margin:0 0 .5rem; letter-spacing:-.01em; }
  p { color:#9a8f88; line-height:1.55; margin:0 0 1rem; }
  pre { background:#161311; border:1px solid #2b2421; border-radius:9px;
        padding:.8rem .9rem; overflow:auto; font-size:.8rem; color:#ff6b6b;
        white-space:pre-wrap; word-break:break-word; }
  code { background:#161311; border:1px solid #2b2421; border-radius:5px;
         padding:.12rem .35rem; font-size:.84rem; color:#ffc35c; }
</style></head><body><div class="card">
  <div class="mark"></div>
  <h1>MockFlow could not start</h1>
  <p>The app starts its own API and dashboard. One of them did not come up.</p>
  <pre>${safe}</pre>
  <p>This is usually a missing build. From the project directory, run
     <code>pnpm install</code>, then <code>pnpm db:migrate</code>,
     then <code>pnpm build</code>, and open the app again.</p>
</div></body></html>`)}`;
}

module.exports = { failurePage };
