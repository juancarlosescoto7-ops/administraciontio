// PostgreSQL temporal con PGlite ya instalado en .temp; sin Docker ni datos reales.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '../supabase/.temp/pruebas-cobros/node_modules/@electric-sql/pglite/dist/index.js';
import { btree_gist } from '../supabase/.temp/pruebas-cobros/node_modules/@electric-sql/pglite/dist/contrib/btree_gist.js';
const db = new PGlite({ extensions: { btree_gist } });
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  for (const file of readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql') && !f.includes('limpieza_datos_prueba')).sort()) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
  const result = await db.exec(readFileSync('scripts/verificar-servicios-contrato.sql','utf8'));
  console.log(JSON.stringify(result.filter((r) => r.rows.length).map((r) => r.rows)));
} catch (error) {
  console.error(error.message, error.code, error.where);
  process.exitCode = 1;
} finally { await db.close(); }
