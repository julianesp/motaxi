#!/bin/bash

# Script para iniciar el backend y frontend de MoTaxi
# Uso: ./start-dev.sh

echo "🚀 Iniciando MoTaxi..."
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: Ejecuta este script desde la raíz del proyecto"
    exit 1
fi

# Verificar que el directorio backend existe
if [ ! -d "backend" ]; then
    echo "❌ Error: No se encontró el directorio backend"
    exit 1
fi

# Función para limpiar procesos al salir
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $(jobs -p) 2>/dev/null
    exit 0
}

# Capturar Ctrl+C para limpiar procesos
trap cleanup SIGINT SIGTERM

echo "📦 Iniciando Backend (Cloudflare Workers)..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Esperar a que el backend esté listo
echo "⏳ Esperando que el backend inicie..."
sleep 3

# Verificar que el backend está corriendo
if ! ps -p $BACKEND_PID > /dev/null; then
    echo "❌ Error: El backend no pudo iniciarse. Revisa backend.log"
    cat backend.log
    exit 1
fi

# Verificar conexión al backend
for i in {1..10}; do
    if curl -s http://localhost:8787/ > /dev/null 2>&1; then
        echo "✅ Backend corriendo en http://localhost:8787"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Error: El backend no respondió. Revisa backend.log"
        cat backend.log
        kill $BACKEND_PID
        exit 1
    fi
    sleep 1
done

echo ""
echo "📦 Iniciando Frontend (Next.js)..."
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

# Esperar a que el frontend esté listo
echo "⏳ Esperando que el frontend inicie..."
sleep 5

# Verificar que el frontend está corriendo
if ! ps -p $FRONTEND_PID > /dev/null; then
    echo "❌ Error: El frontend no pudo iniciarse. Revisa frontend.log"
    cat frontend.log
    kill $BACKEND_PID
    exit 1
fi

echo ""
echo "✅ Todos los servicios están corriendo!"
echo ""
echo "📍 URLs:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:8787"
echo ""
echo "📝 Logs:"
echo "   - Backend:  tail -f backend.log"
echo "   - Frontend: tail -f frontend.log"
echo ""
echo "🛑 Presiona Ctrl+C para detener todos los servicios"
echo ""

# Mostrar logs en tiempo real (mezclados)
tail -f backend.log frontend.log 2>/dev/null
