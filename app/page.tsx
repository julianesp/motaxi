import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar/page";
import { MUNICIPALITIES } from "@/lib/constants/municipalities";
import { APP_ONLY } from "@/lib/constants/stores";

export const metadata: Metadata = {
  title: "MoTaxi · Taxis de servicio público en el Alto Putumayo",
  description:
    "MoTaxi conecta a los pasajeros del Alto Putumayo con taxis de servicio público afiliados a empresas de transporte legalmente habilitadas, desde la app.",
};

// Presentación de MoTaxi. Con NEXT_PUBLIC_APP_ONLY=true todo el uso ocurre en la app y quien
// quiera ingresar va a /app (abre la app o lleva a la tienda). Con el interruptor apagado
// (hoy, hasta que Google Play apruebe Producción) la web sigue funcionando: se ofrece
// iniciar sesión o registrarse y se avisa que la app llega pronto.
// MoTaxi solo intermedia viajes de pasajeros en taxis de servicio público (placa blanca)
// afiliados a empresas de transporte habilitadas. Motos, motocarros y particulares no operan.
const CLIENT_FEATURES = [
  { title: "Pide tu taxi", text: "Marca dónde te recogemos y a dónde vas, y tu solicitud llega a los taxis disponibles." },
  { title: "Taxis cerca de ti", text: "Mira qué taxis están disponibles, con su calificación y su distancia." },
  { title: "Valor total antes del viaje", text: "Conoces el precio antes de confirmar y es el que pagas; solo cambia si aceptas una contraoferta." },
  { title: "Sabes quién te lleva", text: "Nombre del conductor, placa del taxi y empresa de transporte que presta el servicio." },
  { title: "Chat y seguimiento", text: "Habla con el conductor y sigue en el mapa cómo llega el taxi." },
  { title: "Tu historial", text: "Consulta tus viajes anteriores y califica a los conductores." },
];

const DRIVER_FEATURES = [
  { title: "Solo taxis habilitados", text: "Para taxis de servicio público afiliados a una empresa de transporte habilitada, con tarjeta de operación." },
  { title: "Verificación de tu empresa", text: "Registras la empresa, su NIT y tu tarjeta de operación; el equipo de MoTaxi los verifica." },
  { title: "Avisos de solicitudes", text: "Te suena una notificación cuando un pasajero pide un taxi cerca de ti, incluso con la app cerrada." },
  { title: "Mapa y ruta por calles", text: "Ves dónde recoger al pasajero y el recorrido hasta el destino, sin salir de la app." },
  { title: "Tu perfil visible", text: "Foto, datos del taxi, la empresa a la que perteneces y las calificaciones que recibes." },
  { title: "Tus viajes", text: "Consulta tus servicios y lo que has generado, todo en un solo lugar." },
];

const STEPS = APP_ONLY
  ? [
      { n: "1", title: "Descarga la app", text: "Instala MoTaxi desde la tienda de aplicaciones de tu celular." },
      { n: "2", title: "Crea tu cuenta", text: "Elige si vas a pedir taxis o si eres conductor de taxi, y completa tus datos." },
      { n: "3", title: "Empieza a usarla", text: "Pide tu taxi o, si eres conductor verificado, ponte en línea para recibir solicitudes." },
    ]
  : [
      { n: "1", title: "Crea tu cuenta", text: "Regístrate como pasajero o como conductor de taxi y completa tus datos." },
      { n: "2", title: "Pide tu taxi", text: "Marca la recogida y el destino; si eres conductor, registra tu taxi y tu empresa." },
      { n: "3", title: "Viaja", text: "Sigue al taxi en el mapa o, como conductor verificado, recibe solicitudes en línea." },
    ];

function Check() {
  return (
    <svg className="mt-1 h-5 w-5 flex-none text-[#008000]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FeatureList({ items }: { items: { title: string; text: string }[] }) {
  return (
    <ul className="space-y-4">
      {items.map((f) => (
        <li key={f.title} className="flex gap-3">
          <Check />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">{f.title}</p>
            <p className="text-gray-600 dark:text-gray-300">{f.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <div className="bg-white dark:bg-gray-950">
      <Navbar />

      {/* Presentación */}
      <section className="bg-gradient-to-b from-[#008000] to-[#0a5c0a] text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 lg:px-8">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
              Tu taxi, a un toque
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/90">
              MoTaxi conecta a los pasajeros del Alto Putumayo con taxis de servicio público
              afiliados a empresas de transporte legalmente habilitadas. {APP_ONLY ? "Todo desde la app." : "Todo desde tu celular."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {APP_ONLY ? (
                <Link
                  href="/app"
                  className="rounded-xl bg-white px-6 py-3 font-bold text-[#008000] shadow-lg transition hover:bg-gray-100"
                >
                  Descargar la app
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/register"
                    className="rounded-xl bg-white px-6 py-3 font-bold text-[#008000] shadow-lg transition hover:bg-gray-100"
                  >
                    Registrarse
                  </Link>
                  <Link
                    href="/auth/login"
                    className="rounded-xl border-2 border-white/70 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                  >
                    Iniciar sesión
                  </Link>
                </>
              )}
              <a
                href="#funciones"
                className="rounded-xl border-2 border-white/70 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Ver qué puedes hacer
              </a>
            </div>
            {!APP_ONLY && (
              <p className="mt-4 text-sm text-white/80">
                La app de MoTaxi para Android llegará muy pronto a Google Play.
              </p>
            )}
          </div>
          <div className="flex justify-center">
            <img src="/logo-512.png" alt="Logo de MoTaxi" className="w-56 rounded-3xl shadow-2xl sm:w-72" />
          </div>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Todo lo que puedes hacer en MoTaxi</h2>
        <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-300">
          {APP_ONLY ? "Todo se hace desde la app" : "Todo en un solo lugar"}, con taxis de empresas habilitadas del Alto Putumayo.
        </p>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <div>
            <h3 className="mb-6 text-xl font-bold text-[#008000]">Si necesitas un taxi</h3>
            <FeatureList items={CLIENT_FEATURES} />
          </div>
          <div>
            <h3 className="mb-6 text-xl font-bold text-[#008000]">Si conduces un taxi</h3>
            <FeatureList items={DRIVER_FEATURES} />
          </div>
        </div>
      </section>

      {/* Cómo empezar */}
      <section className="bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Empieza en tres pasos</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#008000] font-bold text-white">
                  {s.n}
                </span>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{s.title}</p>
                  <p className="text-gray-600 dark:text-gray-300">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Cobertura */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Dónde funciona</h2>
        <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-300">
          MoTaxi funciona únicamente en los municipios del Valle de Sibundoy, Alto Putumayo.
        </p>
        <ul className="mt-8 flex flex-wrap gap-3">
          {MUNICIPALITIES.map((m) => (
            <li
              key={m.id}
              className="rounded-full border border-[#008000]/30 bg-[#008000]/5 px-5 py-2 font-medium text-[#006600] dark:text-green-300"
            >
              {m.name}
            </li>
          ))}
        </ul>
      </section>

      {/* Aviso de intermediación (igual que en los términos y condiciones) */}
      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        <p className="text-center text-sm leading-relaxed text-gray-500 dark:text-gray-400">
          MoTaxi es un intermediario tecnológico entre pasajeros y empresas de transporte
          legalmente habilitadas. Solo operan taxis de servicio público (placa blanca) con tarjeta
          de operación; el servicio lo presta la empresa del conductor. MoTaxi no procesa pagos.
          Consulta los{" "}
          <Link href="/terms" className="underline">términos y condiciones</Link> y la{" "}
          <Link href="/privacy" className="underline">política de privacidad</Link>.
        </p>
      </section>

      {/* Llamado final */}
      <section className="bg-[#008000]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">
            {APP_ONLY ? "Descarga MoTaxi y empieza hoy" : "Crea tu cuenta y empieza hoy"}
          </h2>
          <Link
            href={APP_ONLY ? "/app" : "/auth/register"}
            className="rounded-xl bg-white px-8 py-3 font-bold text-[#008000] shadow-lg transition hover:bg-gray-100"
          >
            {APP_ONLY ? "Descargar la app" : "Registrarse"}
          </Link>
        </div>
      </section>
    </div>
  );
}
