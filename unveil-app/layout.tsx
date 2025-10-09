import type { Metadata } from 'next';
import '../app/globals.css';

export const metadata: Metadata = {
  title: 'Unveil - Wedding Messaging',
  description: 'Simple wedding communication platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 min-h-100dvh">{children}</body>
    </html>
  );
}
