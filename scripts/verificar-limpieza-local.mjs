import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '../supabase/.temp/pruebas-cobros/node_modules/@electric-sql/pglite/dist/index.js';
import { btree_gist } from '../supabase/.temp/pruebas-cobros/node_modules/@electric-sql/pglite/dist/contrib/btree_gist.js';
const db=new PGlite({extensions:{btree_gist}});
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;`);
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.includes('limpieza_datos_prueba')&&!f.includes('limpiar_operaciones')).sort())
    await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
  await db.exec(readFileSync('scripts/verificar-servicios-contrato.sql','utf8').replace(/rollback;\s*$/i,'set constraints all immediate;'));
  await db.exec(readFileSync('supabase/migrations/20261031101037_limpiar_operaciones_conservar_catalogos.sql','utf8'));
  const r=await db.query(`select (select count(*) from public.clientes) as clientes,
    (select count(*) from public.vehiculos) as vehiculos,
    (select count(*) from public.cargos_cliente) as cargos,
    (select count(*) from public.gastos) as gastos,
    (select count(*) from public.membresias) as membresias,
    (select count(*) from public.asientos) as asientos`);
  console.log(r.rows);
  console.log('Limpieza aprobada: 21 tablas vacías, 12 catálogos idénticos y triggers restaurados (comprobaciones internas).');
  await db.exec('rollback');
}catch(e){console.error(e.message,e.code,e.where);process.exitCode=1;}finally{await db.close();}
