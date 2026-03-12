import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ClerkProvider } from '@clerk/nextjs';
import { esES } from '@clerk/localizations';
import Footer from '@/components/Footer/page';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MoTaxi - Transporte Rápido y Seguro',
  description: 'Aplicación de mototaxis para pasajeros y conductores en el Valle de Sibundoy',
  icons: {
    icon: 'https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png',
    apple: 'https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png',
  },
  openGraph: {
    title: 'MoTaxi - Transporte Rápido y Seguro',
    description: 'Aplicación de mototaxis para pasajeros y conductores en el Valle de Sibundoy',
    url: 'https://motaxi.dev',
    siteName: 'MoTaxi',
    images: [
      {
        url: 'https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png',
        width: 512,
        height: 512,
        alt: 'MoTaxi logo',
      },
    ],
    locale: 'es_CO',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'MoTaxi - Transporte Rápido y Seguro',
    description: 'Aplicación de mototaxis para pasajeros y conductores en el Valle de Sibundoy',
    images: ['https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider localization={esES}>
      <html lang="es">
        <body className={inter.className}>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Footer/>
        </body>
      </html>
    </ClerkProvider>
  );
}
