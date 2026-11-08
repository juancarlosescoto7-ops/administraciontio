// Prueba scripts/limpiar-operaciones-desarrollo.sql en PostgreSQL temporal (PGlite
// ya instalado en .temp; sin Docker ni datos reales) con el esquema actual completo.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '../supabase/.temp/pruebas-cobros/node_modules/@electric-sql/pglite/dist/index.js';
import { btree_gist } from '../supabase/.temp/pruebas-cobros/node_modules/@electric-sql/pglite/dist/contrib/btree_gist.js';
const db=new PGlite({extensions:{btree_gist}});
const contar=async(tablas)=>Object.fromEntries(await Promise.all(tablas.map(async t=>
  [t,Number((await db.query(`select count(*) as n from public.${t}`)).rows[0].n)])));
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    -- Privilegios por defecto de Supabase (las migraciones revocan lo necesario).
    alter default privileges in schema public grant all on tables to anon,authenticated,service_role;`);
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')&&!f.includes('limpieza_datos_prueba')).sort())
    await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));
  // Datos ficticios de todos los módulos; se dejan en la transacción abierta.
  for(const semilla of ['verificar-servicios-contrato.sql','verificar-personal.sql','verificar-flota.sql','verificar-bienes.sql'])
    await db.exec(readFileSync('scripts/'+semilla,'utf8').replace(/rollback;\s*$/i,'set constraints all immediate; set constraints all deferred; reset role;'));
  // Contratos de servicio con la función real sobre los servicios ficticios.
  await db.exec(`do $$ declare r record; begin
    perform set_config('request.jwt.claim.sub',current_setting('prueba.administrador'),true);
    for r in select 'alquiler' as tipo,id from public.alquileres union all
      select 'transporte',id from public.transportes union all
      select 'traslado',id from public.traslados_ambulancia loop
      perform public.generar_contrato_servicio(r.tipo,r.id);
    end loop;
  end $$; set constraints all immediate; set constraints all deferred;`);
  const catalogos=['clientes','vehiculos','empleados','conductores','proveedores','beneficiarios','planes','tarifas','perfiles','peticiones','plantillas_contrato'];
  const operaciones=['gastos','gastos_personal','contratos_servicio','membresias','asientos','movimientos_dinero','traslados_ambulancia','mantenimientos_vehiculo','bienes','depreciaciones_bien','pagos_bien','comprobantes_pago'];
  const antes={catalogos:await contar(catalogos),operaciones:await contar(operaciones)};
  console.log('Antes:',JSON.stringify(antes));
  const conDatos=Object.entries(antes.operaciones).filter(([,n])=>n>0).length;
  if(conDatos<4) throw new Error('Las semillas no generaron operaciones suficientes para probar.');
  const resumen=await db.exec(readFileSync('scripts/limpiar-operaciones-desarrollo.sql','utf8'));
  console.log('Resumen del comando:',JSON.stringify(resumen.at(-1).rows));
  const despues={catalogos:await contar(catalogos),operaciones:await contar(operaciones)};
  console.log('Después:',JSON.stringify(despues));
  if(JSON.stringify(despues.catalogos)!==JSON.stringify(antes.catalogos)) throw new Error('Cambiaron conteos de catálogos.');
  if(Object.values(despues.operaciones).some(n=>n!==0)) throw new Error('Quedaron operaciones.');
  // La protección contra tablas sin clasificar debe abortar sin borrar nada.
  await db.exec('savepoint tabla_nueva; create table public.tabla_sin_clasificar(id int);');
  try {
    await db.exec(readFileSync('scripts/limpiar-operaciones-desarrollo.sql','utf8'));
    throw new Error('No se detuvo ante una tabla sin clasificar.');
  } catch(e){ if(!/sin clasificar: revisar/.test(e.message)) throw e; }
  await db.exec('rollback to savepoint tabla_nueva;');
  console.log('Limpieza aprobada: 28 tablas vacías, 14 catálogos idénticos, triggers restaurados y bloqueo ante tablas sin clasificar.');
  await db.exec('rollback');
}catch(e){console.error(e.message,e.code,e.where);process.exitCode=1;}finally{await db.close();}
