#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Envía un email a los 12 conductores aprobados que NO tienen foto de perfil,
# pidiéndoles que actualicen su foto y los datos de su vehículo.
#
# USO:
#   1. Consigue tu token de admin (inicia sesión en motaxi.dev como
#      admin@neurai.dev y copia el valor de la cookie "authToken", o el que
#      uses para el panel /admin).
#   2. Ejecuta:  ADMIN_TOKEN="tu_token_aqui" ./enviar-email-conductores-sin-foto.sh
#
# El backend excluye automáticamente emails @motaxi.local, así que "Cristian"
# (email falso) no recibe nada aunque su viaje aparezca en la lista.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

API_URL="${API_URL:-https://motaxi-api.julii1295.workers.dev}"

if [ -z "${ADMIN_TOKEN:-}" ]; then
  echo "❌ Falta el token de admin."
  echo "   Ejecuta:  ADMIN_TOKEN=\"tu_token\" ./enviar-email-conductores-sin-foto.sh"
  exit 1
fi

SUBJECT="Actualiza tu foto de perfil y los datos de tu vehículo en MoTaxi"

read -r -d '' MESSAGE <<'EOF' || true
Notamos que en tu perfil de conductor aún no tienes una foto de perfil. Esta foto es importante: es lo primero que ven los pasajeros en la página de inicio de MoTaxi y les da confianza para elegirte.

Por favor, entra a tu perfil y actualiza tu información:

1. Sube tu foto de perfil — usa una foto clara de tu rostro, bien iluminada.
2. Revisa los datos de tu vehículo — que el modelo, color y placa estén correctos y completos.
3. Agrega fotos de tu vehículo — así los pasajeros lo reconocen al momento de recogerlos.

Cómo hacerlo: inicia sesión → ve a tu Perfil → edita tu foto y los datos de tu vehículo → guarda los cambios.

Mantener tu perfil completo y actualizado te ayuda a recibir más viajes. ¡Gracias por ser parte de MoTaxi!
EOF

# IDs de los 12 conductores aprobados sin foto de perfil (con email real)
USER_IDS='["7b36313f-171d-4380-bc94-c7814f3bcc1b","21eb23a8-4a94-4d0c-830c-984d89c246ff","ee68ab2e-10be-4d94-ad8b-56b961d4ef65","ec05d9d5-c1c3-4613-a81f-a0593b43c1d2","05af7a6b-1ef8-432d-9a8b-8c17e04704c4","4bfbd841-a28a-4889-ae53-b4f628dbeaad","e1eff096-f2d9-4e24-bc12-1bf13e365ab5","fcb57557-0e79-4bbd-bfaf-8d8b43649ac3","c53c4819-5714-4b32-ad80-52333a8e8558","3d6681cc-23d3-4b7a-8f6e-c58510468756","96e3393e-d627-4f14-befc-2f075da3c6e0","7e66bec8-8e65-4979-ab09-578c8ed884dc"]'

# Construir el cuerpo JSON de forma segura con python
BODY=$(SUBJECT="$SUBJECT" MESSAGE="$MESSAGE" USER_IDS="$USER_IDS" python3 -c '
import json, os
print(json.dumps({
    "target": "specific",
    "subject": os.environ["SUBJECT"],
    "message": os.environ["MESSAGE"],
    "user_ids": json.loads(os.environ["USER_IDS"]),
}))
')

echo "📧 Enviando email a 12 conductores sin foto de perfil…"
curl -s -X POST "$API_URL/admin/emails/broadcast" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$BODY"
echo ""
echo "✅ Listo. Revisa el resultado arriba (sent / failed / total)."
