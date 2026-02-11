#!/bin/bash

# Script para configurar variables de entorno en Vercel
# Asegúrate de tener Vercel CLI instalado: npm i -g vercel

echo "🚀 Configurando variables de entorno para MoTaxi en Vercel"
echo ""
echo "📋 Este script agregará las siguientes variables:"
echo "  - NEXT_PUBLIC_API_URL"
echo "  - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
echo "  - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
echo "  - CLERK_SECRET_KEY"
echo "  - NEXT_PUBLIC_CLERK_SIGN_IN_URL"
echo "  - NEXT_PUBLIC_CLERK_SIGN_UP_URL"
echo "  - NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL"
echo "  - NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL"
echo ""

# Cargar variables desde .env.local
if [ ! -f .env.local ]; then
    echo "❌ Error: No se encuentra el archivo .env.local"
    exit 1
fi

source .env.local

echo "✅ Variables cargadas desde .env.local"
echo ""

# Función para agregar variable a Vercel
add_vercel_env() {
    local var_name=$1
    local var_value=$2
    local env_type=$3

    echo "📤 Agregando $var_name a $env_type..."
    echo "$var_value" | vercel env add "$var_name" "$env_type" --force
}

# Agregar variables a todos los ambientes
for env in production preview development; do
    echo ""
    echo "🔧 Configurando ambiente: $env"
    echo "────────────────────────────────────────"

    add_vercel_env "NEXT_PUBLIC_API_URL" "$NEXT_PUBLIC_API_URL" "$env"
    add_vercel_env "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" "$env"
    add_vercel_env "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" "$env"
    add_vercel_env "CLERK_SECRET_KEY" "$CLERK_SECRET_KEY" "$env"
    add_vercel_env "NEXT_PUBLIC_CLERK_SIGN_IN_URL" "$NEXT_PUBLIC_CLERK_SIGN_IN_URL" "$env"
    add_vercel_env "NEXT_PUBLIC_CLERK_SIGN_UP_URL" "$NEXT_PUBLIC_CLERK_SIGN_UP_URL" "$env"
    add_vercel_env "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL" "$NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL" "$env"
    add_vercel_env "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL" "$NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL" "$env"
done

echo ""
echo "✅ Todas las variables han sido configuradas!"
echo ""
echo "🔄 Próximo paso: Redeployar tu aplicación"
echo "   Ejecuta: vercel --prod"
echo ""
