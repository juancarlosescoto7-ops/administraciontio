// Prueba de extremo a extremo del alta integrada de membresías y del contrato
// en un navegador real. Requiere la app en ejecución y las mismas variables que
// e2e-navegador.mjs. Crea registros marcados con "[PRUEBA E6.6]". Guarda la
// plantilla del contrato sin cambiar su texto. No elimina nada.
import { cargarEntorno, crearClienteRest, crearReporte } from "./comun.mjs";
import { abrirNavegador } from "./navegador.mjs";

const MARCA = "[PRUEBA E6.6]";
const env = cargarEntorno();
const { comprobar, terminar } = crearReporte();
const { iniciarSesion: sesionApi, api } = crearClienteRest(env);
const sufijo = Date.now().toString(36).toUpperCase();
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Tegucigalpa" }).format(new Date());

const adminApi = await sesionApi(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
const plan = (await api(adminApi.token, "POST", "planes", {
  nombre: `${MARCA} Plan navegador ${sufijo}`, precio_mensual: "650.00", cupo_mensual: 2, modalidad_cupo: "compartido", dias_gracia: 5,
})).datos[0].id;
const plantillaAntes = (await api(adminApi.token, "GET", "plantillas_contrato?select=version,contenido&order=version.desc&limit=1")).datos[0];
const titular = `${MARCA} Titular navegador ${sufijo}`;
const hijo = `${MARCA} Hijo navegador ${sufijo}`;
const descartado = `${MARCA} Descartado ${sufijo}`;
const agregado = `${MARCA} Agregado en detalle ${sufijo}`;

const { cdp, evaluar, esperar, ruta, ir, llenar, pulsar, capturar, vista, iniciarSesion, cerrar, abrirVentana } = await abrirNavegador();
const visible = (selector) => esperar(`document.querySelector(${JSON.stringify(selector)})?.checkVisibility()`);
const contiene = (texto) => esperar(`document.body.innerText.includes(${JSON.stringify(texto)})`, 8000);
const marcar = (selector) => evaluar(`document.querySelector(${JSON.stringify(selector)}).click()`);
const filas = () => evaluar("[...document.querySelectorAll('[data-fila-nueva]')].map((f) => f.dataset.filaNueva)");
const sinDesborde = () => evaluar("document.documentElement.scrollWidth <= window.innerWidth + 1");

try {
  // 1. Operador: titular nuevo en la ventana flotante y beneficiarios nuevos en el formulario
  await iniciarSesion(env.E2E_OPERADOR_CORREO, env.E2E_OPERADOR_CLAVE);
  await esperar("location.pathname === '/'");
  await ir("/membresias/nueva");
  await abrirVentana("Cliente nuevo");
  comprobar("«Cliente nuevo» abre una ventana flotante con los datos del cliente", await visible("dialog[open] #campo-nuevo-cliente-nombre"));
  await capturar("e66-00-cliente-nuevo");
  await llenar("#campo-nuevo-cliente-nombre", titular);
  await llenar("#campo-nuevo-cliente-identificacion", `NAV-${sufijo}`);
  await pulsar("Registrar y continuar");
  comprobar("el cliente se registra y queda elegido sin salir de la membresía",
    await esperar(`location.pathname === "/membresias/nueva" && location.search.includes("cliente_nuevo=1") && document.body.innerText.includes(${JSON.stringify(titular)})`, 20000));
  comprobar("aviso flotante «Cliente registrado»", await esperar("document.querySelector('.notificacion')?.innerText.includes('Cliente registrado')"));
  const clienteTitular = await evaluar("new URLSearchParams(location.search).get('cliente')");
  await visible("select[name=plan]");
  await llenar("select[name=plan]", plan);
  await llenar("input[name=inicio]", hoy);
  await pulsar("Revisar condiciones");
  await visible("#campo-confirmar");
  await capturar("e66-01-formulario");

  const filasIniciales = (await filas()).length;
  await pulsar("+ Agregar beneficiario nuevo");
  await pulsar("+ Agregar beneficiario nuevo");
  const [primera, segunda] = (await filas()).slice(filasIniciales === 0 ? 0 : filasIniciales);
  comprobar("se agregan filas de beneficiarios nuevos sin salir de la página",
    (await filas()).length === filasIniciales + 2 && (await ruta()).startsWith("/membresias/nueva"));
  await llenar(`#campo-nuevo_${primera}_nombre`, hijo);
  await llenar(`#campo-nuevo_${primera}_fecha_nacimiento`, "2016-04-12");
  await llenar(`#campo-nuevo_${segunda}_telefono`, "9999-1234");
  await marcar("#campo-titular_beneficiario");
  await marcar("#campo-confirmar");
  await pulsar("Confirmar membresía");
  comprobar("una fila con datos pero sin nombre se marca y lo escrito se conserva",
    (await contiene("Indique el nombre o quite la fila")) &&
      (await evaluar(`document.querySelector('#campo-nuevo_${primera}_nombre').value`)) === hijo);

  // Se quita la fila incompleta y se agrega otra que luego se descarta vacía.
  await evaluar(`document.querySelector('[data-fila-nueva="${segunda}"] button').click()`);
  await pulsar("+ Agregar beneficiario nuevo");
  comprobar("quitar una fila la elimina del formulario", !(await evaluar(`Boolean(document.querySelector('[data-fila-nueva="${segunda}"]'))`)));
  const ultima = (await filas()).at(-1);
  await llenar(`#campo-nuevo_${ultima}_nombre`, descartado);
  await evaluar(`document.querySelector('[data-fila-nueva="${ultima}"] button').click()`);
  await pulsar("Confirmar membresía");
  comprobar("membresía registrada con titular nuevo",
    await esperar("location.pathname.startsWith('/membresias/') && document.body.innerText.includes('Membresía registrada')", 20000));
  const rutaMembresia = (await ruta()).split("?")[0];
  comprobar("el detalle muestra al titular y a los beneficiarios (el titular también es beneficiario)",
    (await contiene(titular)) && (await contiene(hijo)) && !(await evaluar(`document.body.innerText.includes(${JSON.stringify(descartado)})`)));

  // 2. Beneficiario nuevo desde el detalle
  await abrirVentana("Registrar beneficiario nuevo");
  await llenar("#campo-nuevo-nombre", agregado);
  await pulsar("Registrar y agregar");
  comprobar("beneficiario nuevo registrado y agregado desde el detalle",
    (await esperar("document.body.innerText.includes('Beneficiario agregado')", 20000)) && (await contiene(agregado)));

  // 3. Contrato
  await pulsar("Contrato");
  await esperar("location.pathname.endsWith('/contrato')");
  comprobar("contrato con los datos del titular y los beneficiarios, sin variables pendientes",
    (await visible("[data-contrato]")) &&
      (await evaluar(`(() => { const t = document.querySelector('[data-contrato]').innerText; return t.includes(${JSON.stringify(titular)}) && t.includes(${JSON.stringify(hijo)}) && t.includes("L 650.00") && !t.includes("{{"); })()`)));
  comprobar("el contrato quedó congelado: no incluye al beneficiario agregado después",
    !(await evaluar(`document.querySelector('[data-contrato]').innerText.includes(${JSON.stringify(agregado)})`)));
  comprobar("botón para imprimir o guardar PDF", await esperar("[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Imprimir o guardar PDF') && !b.disabled)"));
  await capturar("e66-02-contrato");
  await cdp("Emulation.setEmulatedMedia", { media: "print" });
  comprobar("al imprimir solo se ve el contrato (menú y encabezado ocultos)",
    await evaluar(`(() => {
      const oculto = (e) => !e || getComputedStyle(e).visibility === "hidden" || getComputedStyle(e).display === "none";
      return oculto(document.querySelector("nav")) && oculto(document.querySelector("h1")) &&
        getComputedStyle(document.querySelector("[data-contrato]")).visibility === "visible";
    })()`));
  await cdp("Emulation.setEmulatedMedia", { media: "" });

  // 4. El operador no edita la plantilla
  comprobar("el operador no ve «Contrato de membresía» en el menú", !(await evaluar("Boolean(document.querySelector('nav a[href=\"/configuracion/contrato\"]'))")));
  await ir("/configuracion/contrato");
  comprobar("el operador recibe aviso de permiso en la plantilla", await contiene("La plantilla del contrato la edita el administrador"));

  // 5. Móvil
  await vista(390, 844, true);
  await ir(`/membresias/nueva?cliente=${clienteTitular}&plan=${plan}&inicio=${hoy}`);
  await visible("#campo-confirmar");
  await pulsar("+ Agregar beneficiario nuevo");
  comprobar("móvil: formulario integrado sin desplazamiento horizontal", await sinDesborde());
  await capturar("e66-03-formulario-movil");
  await ir(`${rutaMembresia}/contrato`);
  await visible("[data-contrato]");
  comprobar("móvil: contrato sin desplazamiento horizontal", await sinDesborde());
  await vista(1280, 900, false);

  // 6. Administrador: plantilla
  await iniciarSesion(env.E2E_ADMIN_CORREO, env.E2E_ADMIN_CLAVE);
  await esperar("location.pathname === '/'");
  comprobar("el administrador ve «Contrato de membresía» en Configuración",
    await esperar("document.querySelector('nav a[href=\"/configuracion/contrato\"]')"));
  await ir("/configuracion/contrato");
  comprobar("la plantilla vigente se edita con la lista de variables y una vista previa con datos de ejemplo",
    (await visible("#campo-contenido")) && (await contiene("{{beneficiarios}}")) &&
      (await evaluar("document.querySelector('[data-vista-previa]').innerText.includes('María Ejemplo López')")));
  const original = await evaluar("document.querySelector('#campo-contenido').value");
  await llenar("#campo-contenido", `${original}\n{{cliente_nonbre}}`);
  await pulsar("Guardar nueva versión");
  comprobar("una variable mal escrita se rechaza y lo escrito se conserva",
    (await contiene("Variable desconocida: {{cliente_nonbre}}")) &&
      (await evaluar("document.querySelector('#campo-contenido').value.includes('{{cliente_nonbre}}')")));
  await llenar("#campo-contenido", original);
  await pulsar("Guardar nueva versión");
  comprobar("guardar crea una versión nueva", await esperar("document.body.innerText.includes('Plantilla guardada como versión nueva')", 20000));
  const plantillaDespues = (await api(adminApi.token, "GET", "plantillas_contrato?select=version,contenido&order=version.desc&limit=1")).datos[0];
  comprobar("la versión nueva conserva el texto (sin cambios de esta prueba)",
    plantillaDespues.version === plantillaAntes.version + 1 && plantillaDespues.contenido === plantillaAntes.contenido.replace(/\r\n/g, "\n").trim());
  await capturar("e66-04-plantilla");

  // Condiciones particulares: en una ventana flotante dentro del formulario.
  const titularAdmin = `${MARCA} Titular con precio ${sufijo}`;
  const clienteAdmin = (await api(adminApi.token, "POST", "clientes", { nombre: titularAdmin })).datos[0].id;
  await ir(`/membresias/nueva?cliente=${clienteAdmin}&plan=${plan}&inicio=${hoy}`);
  await visible("#campo-confirmar");
  comprobar("condiciones particulares ocultas hasta pulsar el botón",
    !(await evaluar("Boolean(document.querySelector('#campo-precio')?.checkVisibility())")) &&
      (await esperar("[...document.querySelectorAll('button')].some((b) => b.textContent.includes('Pactar condiciones particulares') && !b.disabled)")));
  await capturar("e66-05-condiciones-cerradas");
  await pulsar("Pactar condiciones particulares");
  await visible("#campo-precio");
  await llenar("#campo-precio", "999");
  await pulsar("Quitar y usar las del plan");
  comprobar("«Quitar y usar las del plan» cierra la ventana y descarta lo escrito",
    !(await evaluar("document.querySelector('#campo-precio').checkVisibility()")) &&
      (await evaluar("document.querySelector('#campo-precio').value")) === "" &&
      (await evaluar("document.querySelector('[data-resumen-condiciones]').innerText.startsWith('Opcional')")));
  await pulsar("Pactar condiciones particulares");
  await visible("#campo-precio");
  comprobar("al reabrir, el precio está vacío", (await evaluar("document.querySelector('#campo-precio').value")) === "");
  await llenar("#campo-precio", "600");
  await capturar("e66-06-condiciones-abiertas");
  await pulsar("Aplicar");
  comprobar("al aplicar, el resumen muestra lo pactado junto al botón",
    await esperar("document.querySelector('[data-resumen-condiciones]').innerText.includes('600')"));
  await marcar("#campo-titular_beneficiario");
  await marcar("#campo-confirmar");
  await pulsar("Confirmar membresía");
  await esperar("document.body.innerText.includes('Membresía registrada')", 20000);
  await ir(`${(await ruta()).split("?")[0]}/contrato`);
  comprobar("las condiciones pactadas llegan a la membresía y al contrato (L 600.00 en lugar de L 650.00)",
    (await visible("[data-contrato]")) && (await evaluar("document.querySelector('[data-contrato]').innerText.includes('L 600.00')")));

  // 7. Finanzas consulta el contrato, sin generar ni editar
  await iniciarSesion(env.E2E_FINANZAS_CORREO, env.E2E_FINANZAS_CLAVE);
  await esperar("location.pathname === '/'");
  await ir(`${rutaMembresia}/contrato`);
  comprobar("finanzas consulta el contrato", (await visible("[data-contrato]")) && (await contiene(titular)));
} catch (error) {
  comprobar("la prueba termina sin errores inesperados", false, error.message);
} finally {
  await cerrar();
  terminar();
}
