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
  description: 'Aplicación de mototaxis para pasajeros y conductores',
  icons: {
    icon: '/favicon.svg',
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
