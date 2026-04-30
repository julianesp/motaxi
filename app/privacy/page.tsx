import Navbar from "@/components/Navbar/page";

export const metadata = {
  title: "Política de Privacidad - MoTaxi",
  description: "Política de privacidad de MoTaxi. Conoce cómo tratamos y protegemos tus datos personales.",
};

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-[#008000] mb-2">Política de Privacidad</h1>
          <p className="text-sm text-gray-500 mb-8">Última actualización: 1 de abril de 2026</p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">1. Información que recopilamos</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              MoTaxi recopila la siguiente información cuando te registras y usas nuestra plataforma:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 pl-2">
              <li>Nombre completo y correo electrónico</li>
              <li>Número de teléfono (opcional)</li>
              <li>Ubicación en tiempo real durante los viajes activos</li>
              <li>Historial de viajes solicitados o realizados</li>
              <li>Información de inicio de sesión con Google (si la usas)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">2. Cómo usamos tu información</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Usamos tu información exclusivamente para:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 pl-2">
              <li>Conectar pasajeros con conductores en el Valle de Sibundoy</li>
              <li>Mostrar tu ubicación durante un viaje activo al conductor o pasajero correspondiente</li>
              <li>Enviar notificaciones relacionadas con tus viajes</li>
              <li>Mejorar la experiencia de la plataforma</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              No vendemos, alquilamos ni compartimos tu información personal con terceros con fines comerciales.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">3. Ubicación</h2>
            <p className="text-gray-700 leading-relaxed">
              MoTaxi accede a tu ubicación en tiempo real únicamente cuando tienes un viaje activo. Esta información
              se comparte solamente con la otra parte del viaje (conductor o pasajero) y no se almacena de forma
              permanente una vez finalizado el viaje.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">4. Inicio de sesión con Google</h2>
            <p className="text-gray-700 leading-relaxed">
              Si eliges iniciar sesión con Google, recibimos tu nombre y correo electrónico desde tu cuenta de Google.
              No tenemos acceso a tu contraseña de Google ni a otros datos de tu cuenta. Esta información se usa
              únicamente para crear y autenticar tu cuenta en MoTaxi.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">5. Seguridad</h2>
            <p className="text-gray-700 leading-relaxed">
              Protegemos tu información mediante tokens de autenticación seguros (JWT) y comunicaciones cifradas
              (HTTPS). Sin embargo, ningún sistema es 100% seguro. Te recomendamos usar contraseñas únicas y no
              compartir tu cuenta.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">6. Tus derechos</h2>
            <p className="text-gray-700 leading-relaxed mb-3">
              Tienes derecho a:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-1 pl-2">
              <li>Acceder a los datos que tenemos sobre ti</li>
              <li>Solicitar la corrección de datos incorrectos</li>
              <li>Solicitar la eliminación de tu cuenta y datos asociados</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-3">
              Para ejercer estos derechos, contáctanos en{" "}
              <a href="mailto:admin@neurai.dev" className="text-[#008000] hover:underline">
                admin@neurai.dev
              </a>
              .
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-3">7. Menores de edad</h2>
            <p className="text-gray-700 leading-relaxed">
              MoTaxi no está dirigida a personas menores de 18 años. No recopilamos conscientemente información
              de menores. Si detectamos una cuenta de un menor, la eliminaremos de inmediato.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Contacto</h2>
            <p className="text-gray-700 leading-relaxed">
              Si tienes preguntas sobre esta política, escríbenos a{" "}
              <a href="mailto:admin@neurai.dev" className="text-[#008000] hover:underline">
                admin@neurai.dev
              </a>
              . Estamos ubicados en el Valle de Sibundoy, Putumayo, Colombia.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
