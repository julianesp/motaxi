import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * D1 de pruebas: SQLite en memoria (node:sqlite) con el esquema exportado de producción
 * (test/fixtures/schema.sql, generado con `wrangler d1 export --remote --no-data`).
 * Implementa la parte de la API de D1 que usa el Worker: prepare/bind/first/all/run/batch/exec.
 */
const SCHEMA = readFileSync(join(__dirname, '..', 'fixtures', 'schema.sql'), 'utf8');

// Migraciones creadas después de exportar el esquema y que aún no están en producción:
// se aplican encima, igual que se hará al desplegar.
const PENDING_MIGRATIONS = ['add_transport_company.sql'].map((f) =>
  readFileSync(join(__dirname, '..', '..', 'migrations', f), 'utf8')
);

// D1 convierte los booleanos a 0/1 y rechaza undefined (D1_TYPE_ERROR); se replica igual.
function toSqlValue(value: unknown) {
  if (value === undefined) {
    throw new Error("D1_TYPE_ERROR: Type 'undefined' not supported for value 'undefined'");
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value as any;
}

class TestStatement {
  private params: unknown[] = [];

  constructor(private db: DatabaseSync, private sql: string) {}

  bind(...params: unknown[]) {
    const next = new TestStatement(this.db, this.sql);
    next.params = params.map(toSqlValue);
    return next;
  }

  async first<T = any>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...(this.params as any[])) as any;
    if (!row) return null;
    return (column ? row[column] : { ...row }) as T;
  }

  async all<T = any>() {
    const rows = this.db.prepare(this.sql).all(...(this.params as any[])) as any[];
    return { results: rows.map((r) => ({ ...r })) as T[], success: true, meta: {} };
  }

  async run() {
    const info = this.db.prepare(this.sql).run(...(this.params as any[]));
    return {
      success: true,
      meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) },
    };
  }

  async raw() {
    const rows = this.db.prepare(this.sql).all(...(this.params as any[])) as any[];
    return rows.map((r) => Object.values(r));
  }
}

export function createTestD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);
  for (const sql of PENDING_MIGRATIONS) db.exec(sql);
  const d1 = {
    prepare: (sql: string) => new TestStatement(db, sql),
    batch: async (stmts: TestStatement[]) => {
      const out = [];
      for (const s of stmts) out.push(await s.run());
      return out;
    },
    exec: async (sql: string) => {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
    /** Acceso directo para preparar datos y verificar resultados en las pruebas. */
    raw: db,
  };
  return d1 as unknown as D1Database & { raw: DatabaseSync };
}
