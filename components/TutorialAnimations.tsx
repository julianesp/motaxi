"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tutoriales animados de MoTaxi para la homepage.
 * Un "teléfono" reproduce, paso a paso, cómo usar la PWA (pasajero, conductor e instalación).
 * Propósito: explicación (aprendizaje de primera vez). Solo CSS + transform/opacity,
 * con autoplay pausado fuera de pantalla y respeto a prefers-reduced-motion.
 */

type Tab = "passenger" | "driver" | "install";

const STEP_MS = 3600;

// ───────────────────────── Escenas (cada una se remonta por paso) ─────────────────────────

function Tap({ x, y, delay = 0.9 }: { x: string; y: string; delay?: number }) {
  return (
    <span
      className="tut-tap"
      style={{ left: x, top: y, animationDelay: `${delay}s` }}
      aria-hidden
    />
  );
}

function ScreenHeader({ title }: { title: string }) {
  return (
    <div className="bg-[#008000] text-white text-[11px] font-bold px-3 py-2.5 flex items-center gap-2">
      <span className="w-4 h-4 rounded bg-white/25 inline-block" />
      {title}
    </div>
  );
}

// ── Pasajero ──
function PassengerService() {
  const opts = [
    { icon: "🛻", label: "Piaggio", sub: "Mudanzas · carga" },
    { icon: "🚐", label: "Van", sub: "Carga voluminosa" },
  ];
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="MoTaxi · Pasajero" />
      <div className="p-3 space-y-2">
        <p className="text-[11px] font-semibold text-gray-600">¿Cuál vehículo necesitas?</p>
        {opts.map((o, i) => (
          <div
            key={o.label}
            className={`tut-rise flex items-center gap-3 rounded-xl border-2 bg-white px-3 py-2.5 ${i === 1 ? "tut-select border-gray-200" : "border-gray-200"}`}
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="text-2xl">{o.icon}</span>
            <div>
              <p className="text-xs font-bold text-gray-800">{o.label}</p>
              <p className="text-[10px] text-gray-500">{o.sub}</p>
            </div>
          </div>
        ))}
      </div>
      <Tap x="62%" y="62%" />
    </div>
  );
}

function PassengerRoute() {
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="¿A dónde vas?" />
      <div className="p-3 space-y-2.5">
        <div className="tut-rise rounded-xl bg-white border border-gray-200 px-3 py-2.5">
          <p className="text-[9px] text-gray-400 uppercase tracking-wide">Recoger en</p>
          <p className="text-xs font-semibold text-gray-800">📍 Mi ubicación actual</p>
        </div>
        <div className="tut-rise rounded-xl bg-white border-2 border-[#008000] px-3 py-2.5" style={{ animationDelay: "70ms" }}>
          <p className="text-[9px] text-gray-400 uppercase tracking-wide">Destino</p>
          <p className="text-xs font-semibold text-gray-800 flex items-center">
            <span className="tut-type">Plaza de Sibundoy</span>
            <span className="tut-caret" />
          </p>
        </div>
        <div className="tut-rise rounded-xl bg-[#008000] text-white text-center text-xs font-bold py-2.5 tut-btn" style={{ animationDelay: "140ms" }}>
          Buscar conductores
        </div>
      </div>
      <Tap x="55%" y="58%" delay={2.1} />
    </div>
  );
}

function PassengerDrivers() {
  const drivers = [
    { name: "Carlos M.", v: "🚐 Van", price: "$12.000", r: "4.9" },
    { name: "Luis A.", v: "🛻 Piaggio", price: "$10.000", r: "4.8" },
    { name: "Jorge P.", v: "🚐 Van", price: "$13.500", r: "4.7" },
  ];
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="Conductores disponibles" />
      <div className="p-3 space-y-2">
        {drivers.map((d, i) => (
          <div
            key={d.name}
            className={`tut-rise flex items-center gap-2 rounded-xl bg-white border px-2.5 py-2 ${i === 1 ? "tut-pick border-gray-200" : "border-gray-200"}`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span className="w-8 h-8 rounded-full bg-[#008000]/15 flex items-center justify-center text-sm">👤</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-gray-800">{d.name}</p>
              <p className="text-[9px] text-gray-500">{d.v} · ⭐ {d.r}</p>
            </div>
            <span className="text-[11px] font-bold text-[#008000]">{d.price}</span>
          </div>
        ))}
      </div>
      <Tap x="55%" y="50%" delay={1.5} />
    </div>
  );
}

function PassengerTrack() {
  return (
    <div className="relative h-full bg-[#e8f5e2] overflow-hidden">
      <ScreenHeader title="Tu conductor va en camino" />
      <svg viewBox="0 0 200 220" className="absolute inset-x-0 top-8 w-full h-[calc(100%-2rem)]" aria-hidden>
        <path d="M0 150 H80 V60 H200" fill="none" stroke="#fff" strokeWidth="14" />
        <path d="M30 220 V110 H120 V220" fill="none" stroke="#fff" strokeWidth="9" opacity=".8" />
        <path className="tut-route" d="M20 150 H80 V60 H170" fill="none" stroke="#008000" strokeWidth="3" strokeDasharray="6 5" strokeLinecap="round" />
        <circle cx="170" cy="60" r="7" fill="#ef4444" />
        <circle cx="170" cy="60" r="12" fill="#ef4444" opacity=".2" />
      </svg>
      <span className="tut-drive absolute text-xl" aria-hidden>🚐</span>
      <div className="tut-rise absolute bottom-3 inset-x-3 rounded-xl bg-white shadow-md px-3 py-2 flex items-center gap-2">
        <span className="w-8 h-8 rounded-full bg-[#008000]/15 flex items-center justify-center">👤</span>
        <div className="flex-1">
          <p className="text-[11px] font-bold text-gray-800">Luis A.</p>
          <p className="text-[9px] text-gray-500">Llega en 3 min</p>
        </div>
        <span className="text-[10px] font-bold text-[#008000]">En vivo</span>
      </div>
    </div>
  );
}

function PassengerRate() {
  return (
    <div className="relative h-full bg-gray-50 flex flex-col items-center justify-center gap-3 px-4 text-center">
      <span className="tut-pop text-4xl">✅</span>
      <p className="tut-rise text-sm font-bold text-gray-800" style={{ animationDelay: "120ms" }}>¡Llegaste!</p>
      <p className="tut-rise text-[11px] text-gray-500" style={{ animationDelay: "180ms" }}>Califica a tu conductor</p>
      <div className="flex gap-1 text-2xl" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="tut-star" style={{ animationDelay: `${0.5 + i * 0.12}s` }}>⭐</span>
        ))}
      </div>
    </div>
  );
}

// ── Conductor ──
function DriverOnline() {
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="MoTaxi · Conductor" />
      <div className="p-4 space-y-3">
        <div className="tut-rise rounded-2xl bg-white border border-gray-200 p-4 text-center">
          <p className="text-[11px] text-gray-500 mb-2">Tu estado</p>
          <div className="tut-toggle mx-auto"><span /></div>
          <p className="tut-status mt-2 text-xs font-bold"><span className="tut-off">Desconectado</span><span className="tut-on">Disponible</span></p>
        </div>
        <p className="tut-rise text-[10px] text-gray-500 text-center" style={{ animationDelay: "100ms" }}>
          Completa tu perfil y sube tu SOAT para activarte.
        </p>
      </div>
      <Tap x="50%" y="38%" delay={0.8} />
    </div>
  );
}

function DriverRequest() {
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="Disponible" />
      <div className="tut-sheet absolute inset-x-3 top-14 rounded-2xl bg-white shadow-lg border border-gray-100 p-3 space-y-2">
        <p className="text-xs font-bold text-gray-800">🔔 ¡Nueva solicitud de viaje!</p>
        <p className="text-[10px] text-gray-500">📍 Barrio Centro → Plaza de Sibundoy</p>
        <p className="text-[11px] font-bold text-[#008000]">$12.000 · 1,8 km</p>
        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className="tut-countdown h-full bg-[#42CE1D] origin-left" /></div>
      </div>
    </div>
  );
}

function DriverAccept() {
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="Solicitud" />
      <div className="p-3">
        <div className="rounded-2xl bg-white border border-gray-100 p-3 space-y-2">
          <p className="text-xs font-bold text-gray-800">Barrio Centro → Plaza</p>
          <p className="text-[11px] font-bold text-[#008000]">$12.000</p>
          <div className="flex gap-2 pt-1">
            <div className="flex-1 text-center text-[11px] font-semibold py-2 rounded-lg bg-gray-100 text-gray-500">Rechazar</div>
            <div className="tut-btn flex-1 text-center text-[11px] font-bold py-2 rounded-lg bg-[#008000] text-white" style={{ animationDelay: "0.95s" }}>Aceptar</div>
          </div>
        </div>
        <p className="tut-after mt-3 text-center text-[11px] font-bold text-[#008000]">✅ Viaje aceptado — dirígete al pasajero</p>
      </div>
      <Tap x="72%" y="30%" delay={0.8} />
    </div>
  );
}

function DriverTrip() {
  const steps = ["Aceptado", "Llegando", "En viaje", "Completado"];
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="Viaje en curso" />
      <div className="p-4">
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className="tut-dot w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold" style={{ animationDelay: `${0.3 + i * 0.7}s` }}>{i + 1}</span>
              <span className="text-xs font-semibold text-gray-700">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[10px] text-gray-500 text-center">Pulsa el botón de estado en cada etapa del viaje.</p>
      </div>
    </div>
  );
}

function DriverEarnings() {
  const bars = [35, 55, 40, 75, 60, 90];
  return (
    <div className="relative h-full bg-gray-50">
      <ScreenHeader title="Ganancias" />
      <div className="p-4 space-y-3">
        <div className="tut-rise rounded-2xl bg-white border border-gray-100 p-3">
          <p className="text-[10px] text-gray-500">Esta semana</p>
          <p className="text-xl font-extrabold text-[#008000]">$186.000</p>
        </div>
        <div className="flex items-end gap-2 h-24 px-1">
          {bars.map((h, i) => (
            <div key={i} className="tut-bar flex-1 rounded-t-md bg-[#42CE1D]" style={{ height: `${h}%`, animationDelay: `${0.2 + i * 0.08}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Instalar ──
function InstallOpen() {
  return (
    <div className="relative h-full bg-white">
      <div className="bg-gray-100 px-2.5 py-2 flex items-center gap-2">
        <span className="flex-1 rounded-full bg-white text-[10px] text-gray-600 px-3 py-1.5 border border-gray-200">🔒 motaxi.dev</span>
        <span className="text-gray-500 text-sm leading-none">⋮</span>
      </div>
      <div className="tut-rise flex flex-col items-center justify-center gap-2 pt-12 text-center px-4">
        <img src="/logo-192.png" alt="" width={56} height={56} className="rounded-2xl" />
        <p className="text-sm font-extrabold text-gray-800">MoTaxi</p>
        <p className="text-[10px] text-gray-500">Abre el sitio desde Chrome (Android) o Safari (iPhone)</p>
      </div>
    </div>
  );
}

function InstallMenu() {
  return (
    <div className="relative h-full bg-white">
      <div className="bg-gray-100 px-2.5 py-2 flex items-center gap-2">
        <span className="flex-1 rounded-full bg-white text-[10px] text-gray-600 px-3 py-1.5 border border-gray-200">🔒 motaxi.dev</span>
        <span className="text-gray-500 text-sm leading-none tut-btn" style={{ animationDelay: "0.4s" }}>⋮</span>
      </div>
      <div className="tut-menu absolute right-2 top-10 w-40 rounded-xl bg-white shadow-xl border border-gray-100 py-1">
        <p className="px-3 py-1.5 text-[10px] text-gray-500">Nueva pestaña</p>
        <p className="tut-pick px-3 py-1.5 text-[10px] font-bold text-gray-800">📲 Instalar app</p>
        <p className="px-3 py-1.5 text-[10px] text-gray-500">Compartir…</p>
      </div>
      <Tap x="78%" y="25%" delay={0.2} />
    </div>
  );
}

function InstallDone() {
  return (
    <div className="relative h-full bg-gradient-to-b from-sky-200 to-indigo-200 p-4">
      <div className="grid grid-cols-4 gap-3 pt-6">
        {["📞", "💬", "📷", "🗺️"].map((e) => (
          <span key={e} className="aspect-square rounded-xl bg-white/70 flex items-center justify-center text-xl">{e}</span>
        ))}
        <div className="tut-pop flex flex-col items-center gap-1" style={{ animationDelay: "0.3s" }}>
          <img src="/logo-192.png" alt="" width={40} height={40} className="rounded-xl shadow-md" />
          <span className="text-[8px] font-bold text-gray-800">MoTaxi</span>
        </div>
      </div>
      <p className="tut-rise absolute bottom-6 inset-x-4 text-center text-[11px] font-bold text-gray-800" style={{ animationDelay: "0.8s" }}>
        ¡Listo! Ábrela como cualquier app
      </p>
    </div>
  );
}

// ───────────────────────── Datos ─────────────────────────

const TUTORIALS: Record<Tab, { label: string; icon: string; steps: { title: string; desc: string; Scene: () => React.JSX.Element }[] }> = {
  passenger: {
    label: "Pasajero",
    icon: "🧍",
    steps: [
      { title: "Elige tu servicio", desc: "Selecciona el vehículo que necesitas: Piaggio o Van para cargas y trasteos.", Scene: PassengerService },
      { title: "Indica tu destino", desc: "Tu ubicación se toma por GPS. Escribe a dónde vas y busca conductores.", Scene: PassengerRoute },
      { title: "Escoge conductor y tarifa", desc: "Compara conductores, calificaciones y precio. Toca el que prefieras.", Scene: PassengerDrivers },
      { title: "Sigue el viaje en vivo", desc: "Mira en el mapa cómo se acerca tu conductor hasta llegar al destino.", Scene: PassengerTrack },
      { title: "Califica el servicio", desc: "Cuando llegues, deja tus estrellas. Ayuda a toda la comunidad.", Scene: PassengerRate },
    ],
  },
  driver: {
    label: "Conductor",
    icon: "🚐",
    steps: [
      { title: "Actívate", desc: "Con tu perfil completo y SOAT al día, cambia tu estado a Disponible.", Scene: DriverOnline },
      { title: "Recibe solicitudes", desc: "Te llega una alerta con el recorrido y la tarifa. Tienes unos segundos.", Scene: DriverRequest },
      { title: "Acepta el viaje", desc: "Toca Aceptar y dirígete al punto de recogida del pasajero.", Scene: DriverAccept },
      { title: "Completa el viaje", desc: "Marca cada etapa: llegando, en viaje y completado.", Scene: DriverTrip },
      { title: "Revisa tus ganancias", desc: "Consulta cuánto ganas por día y por semana en tu panel.", Scene: DriverEarnings },
    ],
  },
  install: {
    label: "Instalar app",
    icon: "📲",
    steps: [
      { title: "Abre motaxi.dev", desc: "Entra desde Chrome en Android o Safari en iPhone.", Scene: InstallOpen },
      { title: "Toca «Instalar app»", desc: "En Chrome: menú ⋮ → Instalar app. En iPhone: Compartir → Añadir a pantalla de inicio.", Scene: InstallMenu },
      { title: "Úsala como app", desc: "MoTaxi queda en tu pantalla de inicio, sin ocupar casi espacio.", Scene: InstallDone },
    ],
  },
};

// ───────────────────────── Componente ─────────────────────────

export default function TutorialAnimations() {
  const [tab, setTab] = useState<Tab>("passenger");
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const tutorial = TUTORIALS[tab];
  const total = tutorial.steps.length;
  const playing = visible && !reduceMotion && !userPaused;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Solo reproducir mientras la sección está en pantalla
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => setStep((s) => (s + 1) % total), STEP_MS);
    return () => window.clearTimeout(id);
  }, [playing, step, tab, total]);

  const selectTab = (t: Tab) => {
    setTab(t);
    setStep(0);
  };
  const goTo = (i: number) => {
    setStep(i);
    setUserPaused(true); // si el usuario elige un paso, deja de avanzar solo
  };

  const Scene = tutorial.steps[step].Scene;

  return (
    <section id="como-usar" className="py-20 bg-white dark:bg-gray-950" ref={rootRef}>
      <style>{TUT_CSS}</style>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full bg-[#008000]/10 text-[#008000] dark:text-[#42CE1D] text-sm font-semibold mb-3">
            Aprende en 1 minuto
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
            Cómo usar MoTaxi paso a paso
          </h2>
          <p className="mt-3 text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
            Mira cómo funciona la app antes de empezar. Toca cualquier paso para verlo de nuevo.
          </p>
        </div>

        <div role="tablist" aria-label="Tutorial" className="flex justify-center gap-2 mb-10 flex-wrap">
          {(Object.keys(TUTORIALS) as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => { selectTab(t); setUserPaused(false); }}
              className={`tut-press px-5 py-2.5 rounded-full text-sm font-semibold border transition-colors ${
                tab === t
                  ? "bg-[#008000] text-white border-[#008000]"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
              }`}
            >
              <span className="mr-1.5">{TUTORIALS[t].icon}</span>{TUTORIALS[t].label}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Teléfono */}
          <div className="flex justify-center">
            <div className="relative w-[260px] h-[500px] rounded-[2.4rem] bg-gray-900 p-2.5 shadow-2xl ring-1 ring-black/10">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-16 h-4 rounded-full bg-gray-900 z-20" />
              <div className="relative w-full h-full rounded-[1.9rem] overflow-hidden bg-white" aria-live="polite">
                <div key={`${tab}-${step}`} className="tut-scene h-full">
                  <Scene />
                </div>
              </div>
            </div>
          </div>

          {/* Pasos */}
          <div>
            <ol className="space-y-3">
              {tutorial.steps.map((s, i) => {
                const active = i === step;
                return (
                  <li key={s.title}>
                    <button
                      onClick={() => goTo(i)}
                      aria-current={active ? "step" : undefined}
                      className={`tut-press w-full text-left flex gap-4 rounded-2xl border p-4 transition-colors ${
                        active
                          ? "border-[#008000] bg-[#008000]/5 dark:bg-[#008000]/10"
                          : "border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700"
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold transition-colors ${active ? "bg-[#008000] text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500"}`}>
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-gray-900 dark:text-gray-100">{s.title}</span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400 mt-0.5">{s.desc}</span>
                        {active && playing && (
                          <span className="block mt-2 h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <span key={`${tab}-${step}`} className="tut-progress block h-full bg-[#42CE1D] origin-left" style={{ animationDuration: `${STEP_MS}ms` }} />
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {(userPaused || reduceMotion) && (
              <button
                onClick={() => { setUserPaused(false); setStep(0); }}
                className="tut-press mt-4 text-sm font-semibold text-[#008000] dark:text-[#42CE1D] disabled:opacity-50"
                disabled={reduceMotion}
              >
                ▶ Reproducir automáticamente
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────── Estilos (solo transform / opacity) ─────────────────────────

const TUT_CSS = `
.tut-scene{--ease-out:cubic-bezier(0.23,1,0.32,1);animation:tut-fade 240ms var(--ease-out) both}
.tut-rise{animation:tut-rise 420ms var(--ease-out) both}
.tut-pop{animation:tut-pop 480ms var(--ease-out) both}
.tut-sheet{animation:tut-sheet 520ms var(--ease-out) 0.2s both}
.tut-menu{transform-origin:top right;animation:tut-menu 220ms var(--ease-out) 0.6s both}
.tut-after{animation:tut-rise 400ms var(--ease-out) 1.6s both}
.tut-press{transition:transform 160ms cubic-bezier(0.23,1,0.32,1)}
.tut-press:active{transform:scale(0.97)}

.tut-tap{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:9999px;background:rgba(66,206,29,.45);border:2px solid #42CE1D;opacity:0;pointer-events:none;z-index:10;animation:tut-tap 900ms var(--ease-out,cubic-bezier(0.23,1,0.32,1)) both}
.tut-btn{animation:tut-press 360ms cubic-bezier(0.23,1,0.32,1) 1.1s both}
.tut-select,.tut-pick{animation:tut-rise 420ms cubic-bezier(0.23,1,0.32,1) both,tut-highlight 300ms ease-out 1.1s forwards}

.tut-type{display:inline-block;overflow:hidden;white-space:nowrap;width:0;animation:tut-typing 1.3s steps(18) 0.5s forwards}
.tut-caret{display:inline-block;width:1px;height:12px;background:#008000;margin-left:1px;animation:tut-blink 800ms steps(1) infinite}

.tut-route{stroke-dashoffset:220;animation:tut-dash 3s linear forwards}
.tut-drive{left:6%;top:calc(2rem + 55%);animation:tut-drive 3s cubic-bezier(0.77,0,0.175,1) 0.2s forwards}
.tut-star{display:inline-block;filter:grayscale(1) opacity(.35);animation:tut-star 320ms cubic-bezier(0.23,1,0.32,1) both}

.tut-toggle{width:56px;height:30px;border-radius:9999px;background:#d1d5db;padding:3px;animation:tut-toggle-bg 240ms ease-out 1.1s forwards}
.tut-toggle span{display:block;width:24px;height:24px;border-radius:9999px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.3);animation:tut-knob 240ms cubic-bezier(0.23,1,0.32,1) 1.1s forwards}
.tut-status{position:relative;height:16px}
.tut-status span{position:absolute;inset:0;text-align:center}
.tut-off{color:#6b7280;animation:tut-out 160ms ease-out 1.1s forwards}
.tut-on{color:#008000;opacity:0;animation:tut-in 200ms ease-out 1.2s forwards}

.tut-countdown{animation:tut-countdown 3s linear 0.7s forwards}
.tut-dot{border-color:#d1d5db;color:#9ca3af;animation:tut-dot 300ms ease-out forwards}
.tut-bar{transform-origin:bottom;animation:tut-grow 600ms cubic-bezier(0.23,1,0.32,1) both}
.tut-progress{animation:tut-progress linear forwards}

@keyframes tut-fade{from{opacity:0}}
@keyframes tut-rise{from{opacity:0;transform:translateY(10px)}}
@keyframes tut-pop{from{opacity:0;transform:scale(0.85)}}
@keyframes tut-sheet{from{opacity:0;transform:translateY(40px)}}
@keyframes tut-menu{from{opacity:0;transform:scale(0.95)}}
@keyframes tut-tap{0%{opacity:0;transform:scale(1.5)}30%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(0.9)}}
@keyframes tut-press{50%{transform:scale(0.95)}}
@keyframes tut-highlight{to{border-color:#008000;background-color:#f0fdf4}}
@keyframes tut-typing{to{width:9.5em}}
@keyframes tut-blink{50%{opacity:0}}
@keyframes tut-dash{to{stroke-dashoffset:0}}
@keyframes tut-drive{0%{transform:translate(0,0)}45%{transform:translate(48px,0)}55%{transform:translate(48px,0)}100%{transform:translate(48px,-70px)}}
@keyframes tut-star{to{filter:none}}
@keyframes tut-toggle-bg{to{background:#42CE1D}}
@keyframes tut-knob{to{transform:translateX(26px)}}
@keyframes tut-out{to{opacity:0}}
@keyframes tut-in{to{opacity:1}}
@keyframes tut-countdown{from{transform:scaleX(1)}to{transform:scaleX(0.15)}}
@keyframes tut-dot{to{background:#008000;border-color:#008000;color:#fff}}
@keyframes tut-grow{from{transform:scaleY(0)}}
@keyframes tut-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}

@media (prefers-reduced-motion: reduce){
  .tut-scene,.tut-rise,.tut-pop,.tut-sheet,.tut-menu,.tut-after,.tut-bar{animation:tut-fade 200ms ease both}
  .tut-tap,.tut-caret{display:none}
  .tut-btn,.tut-select,.tut-pick,.tut-drive,.tut-countdown{animation:none}
  .tut-type{animation:none;width:auto}
  .tut-route{animation:none;stroke-dashoffset:0}
  .tut-drive{transform:translate(48px,-70px)}
  .tut-star{animation:none;filter:none}
  .tut-toggle{animation:none;background:#42CE1D}.tut-toggle span{animation:none;transform:translateX(26px)}
  .tut-off{animation:none;opacity:0}.tut-on{animation:none;opacity:1}
  .tut-dot{animation:none;background:#008000;border-color:#008000;color:#fff}
  .tut-press{transition:none}
}
`;
