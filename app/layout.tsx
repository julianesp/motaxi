import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import Footer from "@/components/Footer/page";
import Script from "next/script";
import OpenInBrowser from "@/components/OpenInBrowser";
import InstallPWAModal from "@/components/InstallPWAModal";
import PageViewTracker from "@/components/PageViewTracker";
import { Analytics } from "@vercel/analytics/next";
import { GoogleMapsProvider } from "@/lib/google-maps-provider";

const inter = Inter({ subsets: ["latin"], display: "swap", preload: true });

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: "MoTaxi - Mototaxi en el Valle de Sibundoy, Putumayo",
  description:
    "Pide tu mototaxi en Sibundoy, Santiago, Colón y San Francisco (Putumayo, Colombia). Conectamos pasajeros con conductores de moto cerca de ti. Rápido, seguro y económico.",
  keywords: [
    "mototaxi Valle de Sibundoy",
    "mototaxi Sibundoy",
    "mototaxi Alto Putumayo",
    "mototaxi alto putumayo",
    "mototaxi Santiago Putumayo",
    "mototaxi Colón Putumayo",
    "mototaxi San Francisco Putumayo",
    "moto taxi Putumayo",
    "transporte Sibundoy",
    "taxi moto Putumayo",
    "mototaxista Valle de Sibundoy",
    "transporte Valle de Sibundoy",
    "moto taxi Colombia",
    "MoTaxi",
  ],
  metadataBase: new URL("https://motaxi.dev"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
    apple:
      "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
  },
  openGraph: {
    title: "MoTaxi - Mototaxi en el Valle de Sibundoy, Putumayo",
    description:
      "Pide tu mototaxi en Sibundoy, Santiago, Colón y San Francisco (Putumayo). Conductores cerca de ti, tarifas justas.",
    url: "https://motaxi.dev",
    siteName: "MoTaxi",
    images: [
      {
        url: "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
        width: 512,
        height: 512,
        alt: "MoTaxi - Mototaxi Valle de Sibundoy",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MoTaxi - Mototaxi en el Valle de Sibundoy, Putumayo",
    description:
      "Pide tu mototaxi en Sibundoy, Santiago, Colón y San Francisco (Putumayo). Rápido y económico.",
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
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                name: "MoTaxi",
                description:
                  "Servicio de mototaxi en el Valle de Sibundoy, Putumayo, Colombia. Conectamos pasajeros con conductores de moto en Sibundoy, Santiago, Colón y San Francisco.",
                url: "https://motaxi.dev",
                logo: "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
                image:
                  "https://0dwas2ied3dcs14f.public.blob.vercel-storage.com/motaxi/logo.png",
                telephone: "",
                address: {
                  "@type": "PostalAddress",
                  addressLocality: "Sibundoy",
                  addressRegion: "Putumayo",
                  addressCountry: "CO",
                },
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: 1.1556,
                  longitude: -77.0625,
                },
                areaServed: [
                  {
                    "@type": "City",
                    name: "Sibundoy",
                    containedInPlace: {
                      "@type": "AdministrativeArea",
                      name: "Putumayo",
                    },
                  },
                  {
                    "@type": "City",
                    name: "Santiago",
                    containedInPlace: {
                      "@type": "AdministrativeArea",
                      name: "Putumayo",
                    },
                  },
                  {
                    "@type": "City",
                    name: "Colón",
                    containedInPlace: {
                      "@type": "AdministrativeArea",
                      name: "Putumayo",
                    },
                  },
                  {
                    "@type": "City",
                    name: "San Francisco",
                    containedInPlace: {
                      "@type": "AdministrativeArea",
                      name: "Putumayo",
                    },
                  },
                ],
                serviceType: "Servicio de mototaxi",
                priceRange: "$",
                openingHours: "Mo-Su 00:00-23:59",
                sameAs: [],
              }),
            }}
          />
          <Analytics />
          <PageViewTracker />
          <OpenInBrowser />
          <InstallPWAModal />
          <GoogleMapsProvider>
            <AuthProvider>{children}</AuthProvider>
          </GoogleMapsProvider>
          <Footer />
          <Script
            src="https://checkout.epayco.co/checkout.js"
            strategy="lazyOnload"
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
