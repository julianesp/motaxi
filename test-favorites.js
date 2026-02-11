#!/usr/bin/env node

/**
 * Script para probar el endpoint de favorites
 * Esto ayudará a identificar el problema exacto
 */

const API_URL = 'http://localhost:8787';

async function testFavorites() {
  console.log('🔍 Probando endpoint de favorites...\n');

  try {
    // 1. Registrar un usuario de prueba
    console.log('1️⃣ Registrando usuario de prueba...');
    const registerResponse = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `test_${Date.now()}@example.com`,
        password: 'password123',
        phone: `300${Math.floor(Math.random() * 10000000)}`,
        full_name: 'Usuario de Prueba',
        role: 'passenger',
      }),
    });

    if (!registerResponse.ok) {
      const error = await registerResponse.text();
      throw new Error(`Error al registrar: ${error}`);
    }

    const { token, user } = await registerResponse.json();
    console.log(`✅ Usuario registrado: ${user.email}`);
    console.log(`🔑 Token: ${token.substring(0, 20)}...\n`);

    // 2. Probar GET /favorites (debería estar vacío)
    console.log('2️⃣ Obteniendo favoritos (debería estar vacío)...');
    const getFavoritesResponse = await fetch(`${API_URL}/favorites`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!getFavoritesResponse.ok) {
      const error = await getFavoritesResponse.text();
      console.error(`❌ Error al obtener favoritos: ${error}`);
      console.error(`Status: ${getFavoritesResponse.status}`);

      // Mostrar más detalles del error
      try {
        const errorJson = JSON.parse(error);
        console.error('Detalles del error:', JSON.stringify(errorJson, null, 2));
      } catch (e) {
        console.error('Error raw:', error);
      }

      throw new Error(`GET /favorites falló con status ${getFavoritesResponse.status}`);
    }

    const favoritesData = await getFavoritesResponse.json();
    console.log(`✅ Favoritos obtenidos: ${JSON.stringify(favoritesData, null, 2)}\n`);

    // 3. Crear un favorito
    console.log('3️⃣ Creando favorito de prueba...');
    const createResponse = await fetch(`${API_URL}/favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Casa',
        address: 'Calle 123 #45-67, Bogotá',
        latitude: 4.7110,
        longitude: -74.0721,
        place_id: 'ChIJKcumLf2bP44RFDmjIFVjnBA',
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Error al crear favorito: ${error}`);
    }

    const newFavorite = await createResponse.json();
    console.log(`✅ Favorito creado: ${JSON.stringify(newFavorite, null, 2)}\n`);

    // 4. Verificar que aparece en la lista
    console.log('4️⃣ Verificando que el favorito aparece en la lista...');
    const verifyResponse = await fetch(`${API_URL}/favorites`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const updatedFavorites = await verifyResponse.json();
    console.log(`✅ Lista actualizada: ${JSON.stringify(updatedFavorites, null, 2)}\n`);

    console.log('✅ ¡Todas las pruebas pasaron exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error en las pruebas:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar pruebas
testFavorites();
