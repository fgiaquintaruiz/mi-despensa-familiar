import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';
import SWRegistration from './_components/SWRegistration';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: 'Mi Despensa Familiar',
  description: 'Inventario y lista de compra para la familia',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#FF6B35',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={nunito.variable}>
      <body className="font-sans bg-app text-foreground antialiased">
        {children}
        <SWRegistration />
      </body>
    </html>
  );
}
