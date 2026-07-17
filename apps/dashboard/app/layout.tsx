import type { ReactNode } from 'react';

export const metadata = {
  title: 'MockFlow',
  description: 'The Intelligent API Mocking Platform for Modern Development Teams',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        {children}
      </body>
    </html>
  );
}
