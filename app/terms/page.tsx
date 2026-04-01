import Navbar from "@/components/Navbar/page";

export const metadata = {
  title: "Términos y Condiciones - MoTaxi",
  description: "Términos y condiciones de uso de MoTaxi. Lee las reglas y condiciones de nuestra plataforma.",
};

export default function TermsPage() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: "#000000",
        backgroundImage: "linear-gradient(to top, #008000, #000000)",
      }}
    >
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-24">
        <div className="bg-white bg-opacity-90 rounded-2xl shadow-2xl border border-[#008000] border-opacity-30 p-8 md:p-12 text-black">
          <h1 className="text-3xl font-bold text-[#008000] mb-2">Términos y Condiciones</h1>
          <p className="text-sm text-gray-500 mb-8">Última actualización: 1 de abril de 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">1. Aceptación de los términos</h2>
            <p className="text-gray-700 leading-relaxed">
              Al registrarte y usar MoTaxi, aceptas estos Términos y Condiciones en su totalidad. Si no estás
              de acuerdo con alguno de los términos, no debes usar la plataforma.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">2. Descripción del servicio</h2>
            <p className="text-gray-700 leading-relaxed">
              MoTaxi es una plataforma digital que conecta pasajeros con conductores de mototaxi en el
              Valle de Sibundoy, Putumayo, Colombia. MoTaxi actúa exclusivamente como intermediario tecnológico
              y no es una empresa de transporte. Los viajes son prestados por conductores independientes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">3. Registro y cuenta</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Para usar MoTaxi debes:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 pl-2">
              <li>Ser mayor de 18 años</li>
              <li>Proporcionar información veraz y actualizada</li>
              <li>Mantener la confidencialidad de tu contraseña</li>
              <li>Ser responsable de toda actividad realizada desde tu cuenta</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">4. Conductores</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Los conductores registrados en MoTaxi declaran que:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 pl-2">
              <li>Poseen la licencia de conducción vigente y habilitada para mototaxi</li>
              <li>Su vehículo cuenta con SOAT y revisión técnico-mecánica vigentes</li>
              <li>Cumplen con la normativa local de transporte en el Valle de Sibundoy</li>
              <li>Son responsables de su comportamiento durante los viajes</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">5. Pagos</h2>
            <p className="text-gray-700 leading-relaxed">
              MoTaxi no procesa, retiene ni intermedia pagos entre conductores y pasajeros. El método y
              monto de pago por cada viaje es acordado directamente entre las partes. MoTaxi no asume
              ninguna responsabilidad sobre las transacciones económicas realizadas entre usuarios.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">6. Suscripción de conductores</h2>
            <p className="text-gray-700 leading-relaxed">
              Los conductores pueden adquirir una suscripción mensual para acceder a la plataforma. Los pagos
              de suscripción son procesados por ePayco. MoTaxi no almacena datos de tarjetas de crédito.
              Las suscripciones no son reembolsables una vez activadas, salvo en casos de falla técnica
              comprobable atribuible a MoTaxi.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">7. Conducta del usuario</h2>
            <p className="text-gray-700 leading-relaxed mb-3">Está prohibido:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 pl-2">
              <li>Usar la plataforma para actividades ilegales</li>
              <li>Acosar, amenazar o agredir a otros usuarios</li>
              <li>Crear cuentas falsas o suplantar identidades</li>
              <li>Manipular o interferir con el funcionamiento de la plataforma</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              El incumplimiento de estas normas puede resultar en la suspensión permanente de la cuenta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">8. Limitación de responsabilidad</h2>
            <p className="text-gray-700 leading-relaxed">
              MoTaxi no es responsable por accidentes, lesiones, pérdidas o daños ocurridos durante los viajes.
              La relación entre conductores y pasajeros es directa y autónoma. MoTaxi tampoco es responsable
              por interrupciones del servicio causadas por fallas técnicas, de conectividad o de terceros.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">9. Modificaciones</h2>
            <p className="text-gray-700 leading-relaxed">
              MoTaxi puede modificar estos términos en cualquier momento. Los cambios serán notificados
              publicando la nueva versión en esta página. El uso continuado de la plataforma tras los cambios
              implica la aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Contacto</h2>
            <p className="text-gray-700 leading-relaxed">
              Para consultas sobre estos términos, contáctanos en{" "}
              <a href="mailto:admin@neurai.dev" className="text-[#42CE1D] hover:underline">
                admin@neurai.dev
              </a>
              . Valle de Sibundoy, Putumayo, Colombia.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
