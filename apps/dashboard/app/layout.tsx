import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'MockFlow',
  description: 'The Intelligent API Mocking Platform for Modern Development Teams',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
