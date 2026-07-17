export default function Home() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '5rem 1.5rem',
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>MockFlow</h1>
      <p style={{ color: '#666', fontSize: '1.1rem', marginTop: 0 }}>
        The Intelligent API Mocking Platform for Modern Development Teams.
      </p>
      <p style={{ marginTop: '2rem' }}>
        Scaffold is live. The real dashboard (projects, endpoints, live logs,
        latency, errors) arrives in <strong>Phase 3</strong>.
      </p>
    </main>
  );
}
