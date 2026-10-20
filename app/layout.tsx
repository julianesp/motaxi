import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import VehicleNoticeAlert from "@/components/VehicleNoticeAlert";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import Footer from "@/components/Footer/page";
import Script from "next/script";
import OpenInBrowser from "@/components/OpenInBrowser";
import InstallPWAModal from "@/components/InstallPWAModal";
import { APP_ONLY } from "@/lib/constants/stores";
import PageViewTracker from "@/components/PageViewTracker";
import { Analytics } from "@vercel/analytics/next";
import { GoogleMapsProvider } from "@/lib/google-maps-provider";
import { ThemeProvider } from "@/lib/theme-context";

const inter = Inter({ subsets: ["latin"], display: "swap", preload: true });

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: "MoTaxi - Taxis de servicio público en el Alto Putumayo",
  description:
    "Pide un taxi de servicio público en Sibundoy, Santiago, Colón y San Francisco (Putumayo, Colombia), con conductores afiliados a empresas de transporte habilitadas.",
  // Solo taxis de servicio público: MoTaxi no ofrece motos, motocarros ni vehículos particulares
  keywords: [
    "taxi Sibundoy",
    "taxi Valle de Sibundoy",
    "taxi Alto Putumayo",
    "taxi Santiago Putumayo",
    "taxi Colón Putumayo",
    "taxi San Francisco Putumayo",
    "MoTaxi",
  ],
  metadataBase: new URL("https://motaxi.dev"),
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "https://motaxi.dev/logo.png",
    apple:
      "https://motaxi.dev/logo.png",
  },
  openGraph: {
    title: "MoTaxi - Tu taxi, a un toque",
    description:
      "Pide un taxi de servicio público en el Alto Putumayo, con conductores afiliados a empresas de transporte habilitadas. Conoces el valor total antes del viaje.",
    url: "https://motaxi.dev",
    siteName: "MoTaxi",
    images: [
      {
        url: "https://motaxi.dev/logo.png",
        width: 512,
        height: 512,
        alt: "MoTaxi - Taxis del Alto Putumayo",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "MoTaxi - Tu taxi, a un toque",
    description:
      "Pide un taxi de servicio público en el Alto Putumayo, con conductores afiliados a empresas de transporte habilitadas. Conoces el valor total antes del viaje.",
    images: [
      "https://motaxi.dev/logo.png",
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
          {/* Script bloqueante: aplica tema antes del primer render para evitar flash */}
          <script dangerouslySetInnerHTML={{ __html: `
            (function() {
              try {
                var saved = localStorage.getItem('motaxi_theme');
                var hour = new Date().getHours();
                var isDark = saved === 'dark' || (!saved && (hour >= 19 || hour < 7));
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.body.classList.add('dark');
                }
              } catch(e) {}
            })();
          `}} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                name: "MoTaxi",
                description:
                  "Plataforma que conecta pasajeros con taxis de servicio público de empresas de transporte habilitadas en Sibundoy, Santiago, Colón y San Francisco (Putumayo, Colombia).",
                url: "https://motaxi.dev",
                logo: "https://motaxi.dev/logo.png",
                image:
                  "https://motaxi.dev/logo.png",
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
                serviceType: "Intermediación de taxis de servicio público",
                priceRange: "$",
                openingHours: "Mo-Su 00:00-23:59",
                sameAs: [],
              }),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "MoTaxi",
                url: "https://motaxi.dev",
                potentialAction: [
                  {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: "https://motaxi.dev/?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                  },
                ],
              }),
            }}
          />
          <ThemeProvider>
            <Analytics />
            <PageViewTracker />
            <OpenInBrowser />
            {/* Con el interruptor encendido (solo app) ya no se invita a instalar la PWA */}
            {!APP_ONLY && <InstallPWAModal />}
            <GoogleMapsProvider>
              <AuthProvider>
                <VehicleNoticeAlert />
                {children}
              </AuthProvider>
            </GoogleMapsProvider>
            <Footer />
          </ThemeProvider>
          <Script
            src="https://checkout.epayco.co/checkout.js"
            strategy="lazyOnload"
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
