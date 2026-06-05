import type { Metadata, Viewport } from 'next';
import './globals.css';
import { cn } from '@/lib/utils';
import { Providers } from '@/components/providers';
import { SiteChrome } from '@/components/site-chrome';
import { Toaster } from '@/components/ui/toaster';
import { MaintenanceBanner } from '@/components/maintenance-banner';

export const metadata: Metadata = {
  title: 'SB Bundles - Affordable Data Bundles',
  description: 'Purchase MTN, Telecel, and AirtelTigo data bundles in Ghana at the best rates.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SB Bundles',
  },
};

export const viewport: Viewport = {
  themeColor: '#1D9E75',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased')}>
        <Providers>
          <MaintenanceBanner />
          <SiteChrome>{children}</SiteChrome>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
