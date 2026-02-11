/**
 * Script para crear un conductor de prueba en la base de datos local
 * Uso: node test-create-driver.js
 */

const sqlite3 = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Abrir base de datos local de Wrangler
const dbPath = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/c0fa8d382dfbcbf6fbf525f1cff23f69dbc2a8e0f0c69a0fabd28e7cbee8406e.sqlite';
const db = sqlite3(dbPath);

async function createTestDriver() {
  try {
    const driverId = uuidv4();
    const email = `conductor${Date.now()}@test.com`;
    const phone = `+573${Math.floor(Math.random() * 100000000)}`;
    const password = await bcrypt.hash('password123', 10);

    console.log('Creando conductor de prueba...');
    console.log('Email:', email);
    console.log('Teléfono:', phone);
    console.log('Contraseña: password123');

    // Insertar usuario
    db.prepare(
      `INSERT INTO users (id, email, phone, full_name, role, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'driver', ?, datetime('now'), datetime('now'))`
    ).run(driverId, email, phone, 'Conductor de Prueba', password);

    // Insertar datos de conductor
    db.prepare(
      `INSERT INTO drivers (
        id, license_number, vehicle_plate, vehicle_model, vehicle_color,
        is_available, is_verified, verification_status, rating, total_trips,
        current_latitude, current_longitude, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 1, 'approved', 5.0, 0, 1.1656, -77.0, datetime('now'), datetime('now'))`
    ).run(
      driverId,
      'LIC' + Math.floor(Math.random() * 1000000),
      'ABC' + Math.floor(Math.random() * 1000),
      'Honda CG 150',
      'Rojo'
    );

    console.log('\n✅ Conductor creado exitosamente!');
    console.log('\nPuedes iniciar sesión con:');
    console.log('Email:', email);
    console.log('Contraseña: password123');
    console.log('\nEl conductor está ubicado en el Valle de Sibundoy (1.1656, -77.0)');
    console.log('Estado: Disponible y Verificado');

  } catch (error) {
    console.error('❌ Error creando conductor:', error);
  } finally {
    db.close();
  }
}

createTestDriver();
