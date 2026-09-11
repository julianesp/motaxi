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
            Última actualización: 11 de septiembre de 2026
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
              2. Naturaleza del servicio: MoTaxi es una plataforma de visibilidad
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              MoTaxi es una plataforma tecnológica cuyo único objeto es{" "}
              <strong>
                dar visibilidad y facilitar el contacto directo
              </strong>{" "}
              entre personas que necesitan un servicio de mensajería, domicilios,
              carga o transporte y conductores independientes que lo ofrecen en
              el Alto Putumayo (Colombia).
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              MoTaxi <strong>no es una empresa de transporte</strong>, no presta
              directamente el servicio de transporte, no posee vehículos, no
              vincula laboralmente a los conductores y no ejerce control sobre la
              ejecución del servicio. MoTaxi actúa exclusivamente como{" "}
              <strong>intermediario tecnológico de contacto</strong>.
            </p>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              La prestación del servicio de transporte, cuando aplique, se rige
              por el Estatuto Nacional de Transporte (Ley 336 de 1996), el
              Decreto Único Reglamentario del Sector Transporte (Decreto 1079 de
              2015) y el Código Nacional de Tránsito (Ley 769 de 2002). La
              responsabilidad de cumplir dicha normativa recae exclusivamente en
              el conductor y, cuando corresponda, en la empresa de transporte
              habilitada a la que esté vinculado.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              3. Cobertura geográfica
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              MoTaxi da visibilidad únicamente a servicios prestados en los
              municipios del <strong>Alto Putumayo</strong> (Valle de Sibundoy:
              Sibundoy, Santiago, Colón y San Francisco), Colombia. La plataforma
              no está destinada a operar en ninguna otra zona del país. Cualquier
              uso fuera de esta cobertura no está soportado por MoTaxi.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              4. Tipos de servicio y uso de la motocicleta
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              A través de MoTaxi se pueden dar visibilidad a los siguientes
              servicios:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 pl-2">
              <li>
                <strong>Motocicleta:</strong> exclusivamente para{" "}
                <strong>
                  envío de paquetes, encomiendas, domicilios y mensajería
                </strong>
                . La motocicleta <strong>no se utiliza para el transporte de
                pasajeros</strong>. MoTaxi no facilita ni promueve el mototaxismo
                de personas, actividad no autorizada por la normativa de
                transporte colombiana.
              </li>
              <li>
                <strong>Piaggio / Piayo, Van y automóvil:</strong> para carga,
                mudanzas, trasteos y, cuando el vehículo y el conductor cuenten
                con la habilitación correspondiente, transporte de personas.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">
              5. Obligaciones y responsabilidad del conductor
            </h2>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
              Al registrarse en MoTaxi, cada conductor declara bajo su exclusiva
              responsabilidad que:
            </p>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1 pl-2">
              <li>
                Posee licencia de conducción vigente y de la categoría exigida
                para el vehículo que opera.
              </li>
              <li>
                Su vehículo cuenta con SOAT y revisión técnico-mecánica vigentes.
              </li>
              <li>
                Cuando el servicio corresponda a transporte de pasajeros o de
                carga sujeto a habilitación (por ejemplo automóviles, vans o
                vehículos tipo Piaggio destinados a transporte público), cuenta
                con la <strong>tarjeta de operación</strong> y demás permisos
                exigidos, o está vinculado a una empresa de transporte
                debidamente habilitada por el Ministerio de Transporte y sujeta a
                la vigilancia de la Superintendencia de Transporte.
              </li>
              <li>
                Conoce y cumple la normativa de tránsito y transporte aplicable
                en su municipio y en el Alto Putumayo.
              </li>
              <li>
                Es el único responsable de la legalidad, seguridad y ejecución
                del servicio que presta. MoTaxi no otorga, tramita ni sustituye
                ninguna habilitación, permiso o tarjeta de operación.
              </li>
            </ul>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-3">
              MoTaxi podrá suspender o eliminar la cuenta de cualquier conductor
              que no acredite los documentos exigidos o que preste servicios sin
              los permisos legales correspondientes.
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
              MoTaxi no procesa, retiene ni intermedia pagos entre conductores y
              usuarios. El método y monto de pago por cada servicio es acordado
              directa y libremente entre las partes. MoTaxi no asume ninguna
              responsabilidad sobre las transacciones económicas realizadas entre
              usuarios.
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
                Ofrecer o solicitar transporte de personas en motocicleta
                (mototaxismo)
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
              Al ser MoTaxi únicamente una plataforma de visibilidad y contacto,
              no es responsable por accidentes, lesiones, pérdidas, daños,
              incumplimientos ni por la legalidad del servicio prestado por los
              conductores. La relación entre conductores y usuarios es directa y
              autónoma. MoTaxi tampoco es responsable por interrupciones del
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
