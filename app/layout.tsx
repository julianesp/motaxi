import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import Footer from "@/components/Footer/page";
import Script from "next/script";
import OpenInBrowser from "@/components/OpenInBrowser";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: "MoTaxi - Transporte Rápido y Desde la Comodidad de tu Hogar",
  description:
    "Aplicación de mototaxis para pasajeros y conductores en el Valle de Sibundoy. Servicio de transporte disponible desde tu ubicación actual",
  icons: {
    icon: "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
    apple:
      "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
  },
  openGraph: {
    title: "MoTaxi - Transporte Rápido y Desde la Comodidad de tu Hogar",
    description:
      "Aplicación de mototaxis para pasajeros y conductores en el Valle de Sibundoy. Servicio de transporte disponible desde tu ubicación actual",
    url: "https://motaxi.dev",
    siteName: "MoTaxi",
    images: [
      {
        url: "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
        width: 512,
        height: 512,
        alt: "MoTaxi logo",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MoTaxi - Transporte Rápido y Desde la Comodidad de tu Hogar",
    description:
      "Aplicación de mototaxis para pasajeros y conductores en el Valle de Sibundoy. Servicio de transporte disponible desde tu ubicación actual",
    images: [
      "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
    ],
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
          <OpenInBrowser />
          <AuthProvider>{children}</AuthProvider>
          <Footer />
          <Script
            src="https://checkout.epayco.co/checkout.js"
            strategy="afterInteractive"
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
