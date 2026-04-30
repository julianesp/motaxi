"use client";

import { useState, useEffect } from "react";
import Swal from "sweetalert2";

interface EpaycoSubscriptionCheckoutProps {
  user: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  };
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EpaycoSubscriptionCheckout({ user, onClose, onSuccess }: EpaycoSubscriptionCheckoutProps) {
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState({
    name: user.full_name || "",
    email: user.email || "",
    phone: user.phone || "",
    typeDoc: "CC",
    numberDoc: "",
    address: "",
    city: "",
    region: "",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("motaxi_customer_data");
      if (saved) {
        try {
          setCustomerData(prev => ({ ...prev, ...JSON.parse(saved) }));
        } catch {}
      }
    }
  }, []);

  const saveCustomerData = () => {
    try {
      localStorage.setItem("motaxi_customer_data", JSON.stringify(customerData));
    } catch {}
  };

  const loadEpaycoScript = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      if (typeof window !== "undefined" && (window as any).ePayco?.checkout) {
        resolve(true);
        return;
      }

      const existing = document.querySelectorAll('script[src*="checkout.epayco.co"]');
      existing.forEach(s => s.remove());

      if ((window as any).ePayco && !(window as any).ePayco.checkout) {
        delete (window as any).ePayco;
      }

      const script = document.createElement("script");
      script.src = "https://checkout.epayco.co/checkout.js";
      script.async = false;

      script.onload = () => {
        let attempts = 0;
        const check = setInterval(() => {
          attempts++;
          if ((window as any).ePayco?.checkout) {
            clearInterval(check);
            resolve(true);
          } else if (attempts > 100) {
            clearInterval(check);
            reject(new Error("El sistema de pagos no se pudo inicializar. Recarga la página e intenta de nuevo."));
          }
        }, 100);
      };

      script.onerror = () => reject(new Error("No se pudo cargar el sistema de pagos. Verifica tu conexión."));
      document.head.appendChild(script);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCustomerData(prev => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const missing: string[] = [];
    if (!customerData.name || customerData.name.trim().length < 3) missing.push("Nombre completo");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) missing.push("Correo electrónico válido");
    if (!customerData.phone || customerData.phone.length < 7) missing.push("Teléfono");
    if (!customerData.address || customerData.address.trim().length < 5) missing.push("Dirección");
    if (!customerData.city || customerData.city.trim().length < 3) missing.push("Ciudad");
    if (!customerData.region || customerData.region.trim().length < 3) missing.push("Departamento");
    if (!customerData.numberDoc || customerData.numberDoc.trim().length < 6) missing.push("Número de documento");

    if (missing.length > 0) {
      Swal.fire({
        icon: "warning",
        title: "Completa el formulario",
        text: `Faltan: ${missing.join(", ")}`,
        confirmButtonColor: "#008000",
      });
      return false;
    }
    return true;
  };

  const handlePayment = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      // Load ePayco script
      if (!(window as any).ePayco?.checkout) {
        await loadEpaycoScript();
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error de carga", text: err.message, confirmButtonColor: "#008000" });
      setLoading(false);
      return;
    }

    try {
      // El token se guarda en cookie "authToken"
      const cookies = document.cookie.split(';');
      const authCookie = cookies.find(c => c.trim().startsWith('authToken='));
      const token = authCookie ? authCookie.split('=')[1]?.trim() : null;

      const response = await fetch("/api/payments/epayco/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          userId: user.id,
          customerName: customerData.name,
          customerEmail: customerData.email,
          customerPhone: customerData.phone,
          customerAddress: customerData.address,
          customerCity: customerData.city,
          customerRegion: customerData.region,
          customerTypeDoc: customerData.typeDoc,
          customerNumberDoc: customerData.numberDoc,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al crear sesión de pago");

      const { config } = data;
      if (!config) throw new Error("No se recibió configuración del servidor");

      saveCustomerData();

      if (!(window as any).ePayco?.checkout) {
        throw new Error("ePayco no está disponible en este momento");
      }

      const { key, test, ...paymentData } = config;
      const handler = (window as any).ePayco.checkout.configure({ key, test });
      handler.open(paymentData);

      setTimeout(() => {
        setLoading(false);
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      Swal.fire({ icon: "error", title: "Error", text: error.message || "Error al procesar el pago", confirmButtonColor: "#008000" });
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900">Activar suscripción</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Price banner */}
      <div className="bg-gradient-to-r from-green-50 to-green-100 border border-green-200 rounded-xl p-4 mb-5 text-center">
        <p className="text-3xl font-bold text-[#008000]">$14.900 <span className="text-base font-normal text-gray-500">/ mes</span></p>
        <p className="text-sm text-gray-600 mt-1">Acceso completo a MoTaxi</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
          <input type="text" name="name" value={customerData.name} onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico *</label>
          <input type="email" name="email" value={customerData.email} onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono *</label>
          <input type="tel" name="phone" value={customerData.phone} onChange={handleChange} placeholder="3001234567"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de documento *</label>
          <select name="typeDoc" value={customerData.typeDoc} onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm">
            <option value="CC">Cédula de Ciudadanía</option>
            <option value="CE">Cédula de Extranjería</option>
            <option value="NIT">NIT</option>
            <option value="TI">Tarjeta de Identidad</option>
            <option value="PP">Pasaporte</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de documento *</label>
          <input type="text" name="numberDoc" value={customerData.numberDoc} onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dirección *</label>
          <input type="text" name="address" value={customerData.address} onChange={handleChange}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad *</label>
            <input type="text" name="city" value={customerData.city} onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Departamento *</label>
            <input type="text" name="region" value={customerData.region} onChange={handleChange} placeholder="Putumayo"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm" />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors text-sm">
            Cancelar
          </button>
          <button onClick={handlePayment} disabled={loading}
            className="flex-1 bg-[#008000] hover:bg-[#35a818] disabled:bg-green-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm">
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                  <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
                </svg>
                Pagar con ePayco
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
