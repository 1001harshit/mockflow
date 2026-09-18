import type { ReactNode } from 'react';
import './globals.css';
import { MotionProvider } from '@/components/MotionProvider';
import { Backdrop } from '@/components/ui/Backdrop';

export const metadata = {
  title: 'MockFlow',
  description: 'The Intelligent API Mocking Platform for Modern Development Teams',
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MotionProvider>
          <Backdrop />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
