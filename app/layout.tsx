import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AmbientBackground } from '@/components/AmbientBackground';
import { ServiceWorker } from '@/components/ServiceWorker';
import { DENSITY_COOKIE, parseDensity } from '@/lib/density';
import './globals.css';

export const metadata: Metadata = {
  title: 'daily-web',
  description: 'Painel pessoal do dia a dia',
  appleWebApp: {
    capable: true,
    title: 'daily',
    // O iOS não lê o manifest: a barra de status precisa ser dita aqui, ou
    // ela fica clara sobre o fundo escuro da app.
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0b14',
  // A app é um painel, não um documento: dar zoom horizontal só quebraria as
  // colunas, mas o zoom de acessibilidade continua liberado.
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Reading the cookie here, rather than stamping the attribute from a client
// effect, is what keeps a compact layout from rendering comfortable on first
// paint and snapping a frame later. It costs static rendering for the tree,
// which this dashboard never had: every screen is authenticated and polled.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const density = parseDensity((await cookies()).get(DENSITY_COOKIE)?.value);

  return (
    <html
      lang="pt-BR"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      data-density={density === 'compact' ? 'compact' : undefined}
      // The client can change density after hydration.
      suppressHydrationWarning
    >
      <body>
        <AmbientBackground />
        <ServiceWorker />
        {children}
      </body>
    </html>
  );
}
