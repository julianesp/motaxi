import Navbar from "@/components/Navbar/page";

export const metadata = {
  title: "Términos y Condiciones - MoTaxi",
  description:
    "Términos y condiciones de uso de MoTaxi. Lee las reglas y condiciones de nuestra plataforma.",
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
        <div className="bg-white bg-opacity-90 dark:bg-gray-900/90 rounded-2xl shadow-2xl border border-[#008000] border-opacity-30 p-8 md:p-12 text-black dark:text-gray-100">
          <h1 className="text-3xl font-bold text-[#008000] dark:text-[#42CE1D] mb-2">
            Términos y Condiciones
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Última actualización: 19 de octubre de 2026
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              1. Aceptación de los términos
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Al registrarte y usar MoTaxi aceptas estos Términos y Condiciones
              en su totalidad, así como nuestra{" "}
              <a
                href="/privacy"
                className="text-[#008000] hover:underline"
              >
                Política de Privacidad
              </a>
              . Si no estás de acuerdo con alguno de los términos, no debes usar
              la plataforma.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              2. Naturaleza del servicio: MoTaxi es un intermediario tecnológico
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              MoTaxi es una plataforma tecnológica cuyo único objeto es{" "}
              <strong>
                conectar a los pasajeros con taxis de servicio público
              </strong>{" "}
              afiliados a <strong>empresas de transporte legalmente constituidas y
              habilitadas</strong> en el Alto Putumayo (Colombia). El servicio de
              transporte lo presta la empresa a la que está afiliado el conductor.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              MoTaxi <strong>no es una empresa de transporte</strong>, no presta
              directamente el servicio de transporte, no posee vehículos, no
              vincula laboralmente a los conductores y no ejerce control sobre la
              ejecución del servicio. MoTaxi actúa exclusivamente como{" "}
              <strong>intermediario tecnológico de contacto</strong>.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              La prestación del servicio de transporte se rige por el Estatuto
              Nacional de Transporte (Ley 336 de 1996), el Decreto Único
              Reglamentario del Sector Transporte (Decreto 1079 de 2015), la
              Resolución 2163 de 2016 del Ministerio de Transporte y el Código
              Nacional de Tránsito (Ley 769 de 2002). La responsabilidad de
              cumplir dicha normativa en la prestación del servicio recae en la
              empresa de transporte habilitada y en el conductor afiliado a ella.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              3. Cobertura geográfica
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              MoTaxi conecta únicamente servicios prestados en los
              municipios del <strong>Alto Putumayo</strong> (Valle de Sibundoy:
              Sibundoy, Santiago, Colón y San Francisco), Colombia. La plataforma
              no está destinada a operar en ninguna otra zona del país. Cualquier
              uso fuera de esta cobertura no está soportado por MoTaxi.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              4. Servicio y vehículos admitidos
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              A través de MoTaxi solo se solicitan <strong>viajes de pasajeros en
              taxi</strong>. Únicamente pueden operar:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 pl-2">
              <li>
                <strong>Taxis de servicio público (placa blanca)</strong>{" "}
                afiliados a una empresa de transporte habilitada y con{" "}
                <strong>tarjeta de operación</strong> vigente.
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
              <strong>No pueden operar</strong> en MoTaxi las motocicletas, los
              motocarros (Piaggio / Piayo) ni los vehículos particulares. MoTaxi no
              ofrece envíos de paquetes, domicilios, mensajería, trasteos ni carga.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              5. Obligaciones y responsabilidad del conductor
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              Al registrarse en MoTaxi, cada conductor declara bajo su
              responsabilidad, y acredita ante MoTaxi, que:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 pl-2">
              <li>
                Posee licencia de conducción vigente y de la categoría exigida
                para conducir un taxi de servicio público.
              </li>
              <li>
                Su vehículo cuenta con SOAT y revisión técnico-mecánica vigentes.
              </li>
              <li>
                Conduce un taxi de servicio público (placa blanca) afiliado a una
                empresa de transporte debidamente habilitada y sujeta a la
                vigilancia de la Superintendencia de Transporte, cuya razón social
                y NIT registra en la plataforma, y cuenta con la{" "}
                <strong>tarjeta de operación</strong> vigente del vehículo.
              </li>
              <li>
                Conoce y cumple la normativa de tránsito y transporte aplicable
                en su municipio y en el Alto Putumayo.
              </li>
              <li>
                Junto con su empresa, es responsable de la legalidad, seguridad y
                ejecución del servicio que presta. MoTaxi no otorga, tramita ni
                sustituye ninguna habilitación, permiso o tarjeta de operación.
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
              MoTaxi verifica la empresa y la tarjeta de operación antes de
              permitir que un conductor reciba solicitudes, y podrá suspender o
              eliminar la cuenta de cualquier conductor que no acredite los
              documentos exigidos o que preste servicios sin los permisos legales
              correspondientes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">6. Registro y cuenta</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              Para usar MoTaxi debes:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 pl-2">
              <li>Ser mayor de 18 años</li>
              <li>Proporcionar información veraz y actualizada</li>
              <li>Mantener la confidencialidad de tu contraseña</li>
              <li>
                Ser responsable de toda actividad realizada desde tu cuenta
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">7. Pagos</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Antes de confirmar cada viaje, la plataforma le muestra al pasajero
              el <strong>valor total</strong> del servicio, y ese es el valor que
              se cobra; solo puede cambiar si el pasajero acepta de forma expresa
              una contraoferta del conductor antes del viaje. El pasajero paga
              directamente al conductor por el medio que acuerden. MoTaxi no
              procesa, retiene ni intermedia pagos.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              8. Suscripción de conductores
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Los conductores pueden adquirir una suscripción mensual para
              acceder a la visibilidad de la plataforma. Los pagos de suscripción
              son procesados por ePayco. MoTaxi no almacena datos de tarjetas de
              crédito. Las suscripciones no son reembolsables una vez activadas,
              salvo en casos de falla técnica comprobable atribuible a MoTaxi.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              9. Conducta del usuario
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              Está prohibido:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 pl-2">
              <li>Usar la plataforma para actividades ilegales</li>
              <li>
                Ofrecer servicios con motocicletas, motocarros o vehículos
                particulares, o con un taxi sin empresa habilitada ni tarjeta de
                operación
              </li>
              <li>Acosar, amenazar o agredir a otros usuarios</li>
              <li>Crear cuentas falsas o suplantar identidades</li>
              <li>
                Manipular o interferir con el funcionamiento de la plataforma
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
              El incumplimiento de estas normas puede resultar en la suspensión
              permanente de la cuenta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              10. Limitación de responsabilidad
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Al ser MoTaxi un intermediario tecnológico, el servicio de transporte
              y sus riesgos (accidentes, lesiones, pérdidas, daños o
              incumplimientos) son responsabilidad de la empresa de transporte
              que lo presta y de su conductor, en los términos de la ley. MoTaxi tampoco es responsable por interrupciones del
              servicio causadas por fallas técnicas, de conectividad o de
              terceros.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              11. Tratamiento de datos personales
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              El tratamiento de tus datos personales se rige por la Ley 1581 de
              2012 (Régimen de Protección de Datos Personales — Habeas Data) y sus
              decretos reglamentarios, según se detalla en nuestra{" "}
              <a
                href="/privacy"
                className="text-[#008000] hover:underline"
              >
                Política de Privacidad
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">12. Modificaciones</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              MoTaxi puede modificar estos términos en cualquier momento. Los
              cambios serán notificados publicando la nueva versión en esta
              página. El uso continuado de la plataforma tras los cambios implica
              la aceptación de los nuevos términos.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">13. Contacto</h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Para consultas sobre estos términos, contáctanos en{" "}
              <a
                href="mailto:admin@neurai.dev"
                className="text-[#008000] hover:underline"
              >
                admin@neurai.dev
              </a>
              . Alto Putumayo, Colombia.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
