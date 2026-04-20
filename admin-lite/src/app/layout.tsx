import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import '../index.css';

export const metadata: Metadata = {
  title: 'Admin Lite - SquadHire',
  description: 'Focused admin tools for candidates and approvals',
  manifest: '/admin-lite/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/admin-lite/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/admin-lite/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/admin-lite/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Admin Lite',
  },
};

export const viewport: Viewport = {
  themeColor: '#4F46E5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
