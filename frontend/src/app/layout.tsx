import type { Metadata } from 'next';
import { Instrument_Serif } from 'next/font/google';
import Providers from './providers';
import '../index.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-instrument-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SquadHire - Talent Platform',
  description: 'Connect talent with opportunities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={instrumentSerif.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
