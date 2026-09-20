import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  // A template, so every page reads "Items" without each one
  // repeating the product name and one of them forgetting to (F-38).
  title: { default: 'Costed', template: '%s' },
  description: 'What it actually costs to make what you sell.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
