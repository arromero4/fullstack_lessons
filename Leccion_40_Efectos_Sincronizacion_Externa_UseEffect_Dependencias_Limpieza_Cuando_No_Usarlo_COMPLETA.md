# Lección 40 — Efectos y sincronización externa con `useEffect`: dependencias, limpieza y cuándo no usarlo

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — efectos, recursos externos y ciclos de sincronización  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## 1. Introducción

En la lección anterior modelaste estados visuales exhaustivos: carga, vacío, éxito y error. La carga ocurría después de un clic, por lo que el manejador del evento sabía exactamente cuándo iniciar la solicitud.

Ahora SiteOps Tracker necesita otra conducta: cuando la persona selecciona una sede distinta, la vista debe sincronizarse automáticamente con los hallazgos de esa sede. También puede necesitar:

- conectarse a un flujo de eventos;
- registrar y retirar un listener del navegador;
- iniciar y detener un temporizador;
- controlar un widget que no pertenece a React;
- cancelar una solicitud cuando cambia el recurso solicitado;
- liberar una conexión al desmontar el componente.

Estas tareas conectan React con sistemas externos. `useEffect` existe para describir esa sincronización después de que React confirma una renderización.

El reto no es “hacer que algo ocurra después del render”. El reto es decidir si realmente existe un sistema externo, declarar todas las dependencias reactivas y escribir una limpieza que sea el reflejo exacto de la configuración.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. explicar qué problema resuelve `useEffect`;
2. diferenciar render, eventos y Effects;
3. describir el ciclo configuración → limpieza → nueva configuración;
4. declarar dependencias reactivas completas;
5. reconocer la diferencia entre omitir dependencias, usar `[]` y usar `[valores]`;
6. limpiar listeners, timers, suscripciones y solicitudes;
7. entender el ciclo adicional de Strict Mode en desarrollo;
8. evitar Effects para datos derivados y acciones causadas por el usuario;
9. cancelar solicitudes y prevenir respuestas fuera de orden;
10. validar respuestas HTTP con Zod antes de actualizar estado;
11. probar configuración, resultado y limpieza con Vitest y Testing Library;
12. conectar los Effects con la arquitectura Full Stack completa.

---

## 3. El problema que resuelve un Effect

El cuerpo de un componente debe ser puro. Recibe props y estado, calcula JSX y no modifica el mundo exterior.

Este código es incorrecto:

~~~tsx
type FindingsPageProps = Readonly<{
  siteId: string;
}>;

export function FindingsPage({ siteId }: FindingsPageProps) {
  // Incorrecto: la solicitud ocurre durante el render.
  void fetch(`/api/sites/${encodeURIComponent(siteId)}/findings`);

  return <h1>Hallazgos</h1>;
}
~~~

React puede renderizar más de una vez. Si una operación externa vive en el cuerpo, cada render puede repetirla. Además, React todavía no ha confirmado que ese árbol vaya a permanecer en pantalla.

Otro error común es actualizar estado durante el render:

~~~tsx
export function BrokenCounter() {
  const [count, setCount] = useState(0);

  // Incorrecto: provoca otra renderización de inmediato.
  setCount(count + 1);

  return <p>{count}</p>;
}
~~~

React necesita una fase separada para sincronizar el resultado confirmado con algo externo. Esa fase es el Effect.

---

## 4. Funcionamiento: render, commit y Effect

El flujo conceptual es:

1. **Render:** React llama al componente y calcula JSX. Debe ser puro.
2. **Commit:** React aplica al DOM los cambios confirmados.
3. **Effect:** React ejecuta la configuración para sincronizar un sistema externo.
4. **Cambio de dependencias:** antes de una nueva configuración, React ejecuta la limpieza anterior.
5. **Desmontaje:** React ejecuta la última limpieza.

Un Effect no es una segunda fase para calcular datos que podían calcularse durante el render. Es una salida controlada hacia la red, el navegador, una suscripción o una librería ajena a React.

La forma general es:

~~~tsx
import { useEffect } from "react";

useEffect(() => {
  // Configuración: iniciar o sincronizar un recurso externo.

  return () => {
    // Limpieza: detener o deshacer esa configuración.
  };
}, [/* dependencias reactivas */]);
~~~

`useEffect` debe llamarse en el nivel superior del componente o de un Hook propio. No se llama dentro de condiciones, ciclos ni callbacks arbitrarios.

---

## 5. Razón de existir

React controla su propio árbol, pero no controla automáticamente:

- conexiones WebSocket;
- listeners de `window` o `document`;
- timers del navegador;
- reproducción multimedia;
- mapas, editores o widgets de terceros;
- solicitudes HTTP iniciadas por la aparición o cambio de una vista;
- APIs del navegador como geolocalización;
- suscripciones a servicios externos.

Un Effect declara:

> “Mientras este componente esté sincronizado con estos valores, mantén activo este recurso externo; cuando esos valores cambien o el componente desaparezca, libera el recurso anterior”.

Pensar en **sincronización** es más preciso que pensar en “código que corre una vez”. Un Effect puede iniciar y detener la sincronización muchas veces durante la vida del componente.

---

## 6. Anatomía de `useEffect`

~~~tsx
useEffect(() => {
  const connection = connectToSite(siteId);
  connection.open();

  return () => {
    connection.close();
  };
}, [siteId]);
~~~

Cada pieza tiene una responsabilidad:

| Pieza | Responsabilidad |
|---|---|
| Función de configuración | Crear o sincronizar el recurso externo |
| Función de limpieza | Detener o deshacer lo creado por esa configuración |
| Array de dependencias | Indicar qué valores reactivos obligan a resincronizar |

La configuración puede devolver una función de limpieza o no devolver nada. No debe devolver una promesa.

`siteId` es reactivo porque es una prop que puede cambiar entre renderizaciones. Cuando cambia:

1. React ejecuta la limpieza correspondiente al `siteId` anterior.
2. React ejecuta una configuración nueva con el `siteId` actual.

---

## 7. Los tres comportamientos del array de dependencias

### Sin array

~~~tsx
useEffect(() => {
  document.title = `Render: ${renderCount}`;
});
~~~

Se ejecuta después de cada commit. Es poco frecuente que eso sea exactamente lo necesario.

### Array vacío

~~~tsx
useEffect(() => {
  const unsubscribe = subscribeToBrowserStatus();
  return unsubscribe;
}, []);
~~~

No lee valores reactivos del componente. Se configura al montar, se limpia al desmontar y puede pasar por un ciclo adicional de desarrollo con Strict Mode.

### Dependencias explícitas

~~~tsx
useEffect(() => {
  const connection = connectToSite(siteId);
  connection.open();

  return () => connection.close();
}, [siteId]);
~~~

Se configura al montar y se resincroniza cuando cambia `siteId` según `Object.is`.

No elijas `[]` para expresar “quiero que corra una vez”. Primero escribe la lógica y después declara todos los valores reactivos que esa lógica lee.

---

## 8. Qué es un valor reactivo

Dentro de un componente son reactivos:

- props;
- estado;
- variables calculadas en el cuerpo;
- objetos creados en el cuerpo;
- funciones declaradas en el cuerpo.

Ejemplo:

~~~tsx
type SiteStreamProps = Readonly<{
  siteId: string;
  enabled: boolean;
}>;

export function SiteStream({
  siteId,
  enabled,
}: SiteStreamProps) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const connection = createAuditConnection(siteId);
    connection.connect();

    return () => connection.disconnect();
  }, [enabled, siteId]);

  return <p>Flujo de auditoría: {enabled ? "activo" : "inactivo"}</p>;
}
~~~

El Effect lee `enabled` y `siteId`, así que ambos son dependencias. La función `createAuditConnection` puede omitirse si está declarada a nivel de módulo y no es reactiva.

Los setters de `useState` tienen identidad estable. La regla oficial de Hooks reconoce que no necesitan agregarse.

---

## 9. Las dependencias no son una preferencia

Este código tiene una dependencia faltante:

~~~tsx
useEffect(() => {
  const connection = createAuditConnection(siteId);
  connection.connect();

  return () => connection.disconnect();
  // Incorrecto: el Effect lee siteId, pero declara [].
}, []);
~~~

Si `siteId` cambia, la conexión puede continuar asociada con la sede anterior. Eso es un **stale closure**: la configuración conserva valores de una renderización antigua.

La corrección es declarar la dependencia:

~~~tsx
useEffect(() => {
  const connection = createAuditConnection(siteId);
  connection.connect();

  return () => connection.disconnect();
}, [siteId]);
~~~

No silencies `react-hooks/exhaustive-deps` para imponer un ciclo de vida deseado. Cambia la estructura del código para que las dependencias reflejen la sincronización real.

---

## 10. Limpieza simétrica

La limpieza debe detener o deshacer lo iniciado por la configuración.

| Configuración | Limpieza |
|---|---|
| `addEventListener` | `removeEventListener` |
| `setInterval` | `clearInterval` |
| `connect` | `disconnect` |
| `subscribe` | `unsubscribe` |
| iniciar solicitud cancelable | abortar o ignorar respuesta obsoleta |
| crear widget | destruir widget |

Ejemplo con un listener tipado:

~~~tsx
import { useEffect, useState } from "react";

export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    function handleOnline(): void {
      setIsOnline(true);
    }

    function handleOffline(): void {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <p role="status">
      {isOnline ? "Con conexión" : "Sin conexión"}
    </p>
  );
}
~~~

Las mismas referencias `handleOnline` y `handleOffline` se usan para registrar y retirar los listeners.

---

## 11. Ciclo de vida de un Effect

Supón que `siteId` cambia de `site-demo-north` a `site-demo-south`:

1. La UI renderiza con el nuevo `siteId`.
2. React confirma el cambio.
3. React ejecuta la limpieza creada con `site-demo-north`.
4. React ejecuta la configuración con `site-demo-south`.
5. Si el componente se desmonta, ejecuta la limpieza de `site-demo-south`.

Cada ejecución de configuración forma una pareja con su propia limpieza. La limpieza “recuerda” los valores de la renderización que la creó.

No pienses solo en “mount/update/unmount” del componente. Piensa en un proceso independiente que comienza y termina cada vez que necesita resincronizarse.

---

## 12. Strict Mode y el ciclo adicional de desarrollo

Con Strict Mode, React ejecuta en desarrollo un ciclo extra:

~~~text
configuración → limpieza → configuración
~~~

Este comportamiento comprueba que la limpieza realmente refleja a la configuración. No ocurre como un doble montaje normal en producción.

Si el ciclo adicional causa conexiones duplicadas, listeners repetidos o timers huérfanos, el Effect ya tenía una limpieza incompleta.

Evita este “arreglo”:

~~~tsx
const didRun = useRef(false);

useEffect(() => {
  if (didRun.current) {
    return;
  }

  didRun.current = true;
  connectWithoutCleanup();
}, []);
~~~

La referencia solo oculta la prueba de desarrollo. El recurso continúa sin liberarse al desmontar. La solución es implementar la limpieza correcta.

---

## 13. Render, evento o Effect

| Pregunta | Lugar correcto |
|---|---|
| ¿Se puede calcular desde props o estado? | Durante el render |
| ¿Ocurre por un clic, submit o interacción concreta? | Manejador de evento |
| ¿Debe mantenerse sincronizado con un sistema externo mientras la vista existe? | Effect |

### Cálculo durante el render

~~~tsx
const visibleFindings = findings.filter(
  (finding) => finding.status === selectedStatus,
);
~~~

No necesita Effect ni estado duplicado.

### Acción causada por el usuario

~~~tsx
async function handleResolve(): Promise<void> {
  await resolveFinding(findingId);
}

return (
  <button type="button" onClick={() => void handleResolve()}>
    Resolver hallazgo
  </button>
);
~~~

La causa es el clic, por lo que pertenece al evento.

### Sincronización por presencia o cambio de la vista

~~~tsx
useEffect(() => {
  const subscription = subscribeToFinding(findingId);
  return () => subscription.unsubscribe();
}, [findingId]);
~~~

La suscripción debe existir mientras esa identidad esté representada en pantalla.

---

## 14. Cuándo no usar un Effect: datos derivados

Este patrón añade una renderización innecesaria y permite desincronización:

~~~tsx
// Evitar.
const [visibleFindings, setVisibleFindings] =
  useState<readonly Finding[]>([]);

useEffect(() => {
  setVisibleFindings(
    findings.filter(
      (finding) => finding.status === selectedStatus,
    ),
  );
}, [findings, selectedStatus]);
~~~

Calcula el resultado durante el render:

~~~tsx
const visibleFindings = findings.filter(
  (finding) => finding.status === selectedStatus,
);
~~~

React volverá a ejecutar el cálculo cuando cambien las entradas. No necesitas mantener una segunda fuente de verdad.

Si el cálculo fuera realmente costoso, se evaluaría una memoización basada en medición. Un Effect sigue sin ser la herramienta para producir datos de render.

---

## 15. Cuándo no usar un Effect: eventos del usuario

Este patrón pierde la causa concreta de la operación:

~~~tsx
// Evitar.
const [shouldExport, setShouldExport] = useState(false);

useEffect(() => {
  if (shouldExport) {
    void exportAuditReport();
  }
}, [shouldExport]);
~~~

La exportación ocurre porque la persona pulsó un botón. Escríbela en el manejador:

~~~tsx
async function handleExport(): Promise<void> {
  await exportAuditReport();
}

return (
  <button type="button" onClick={() => void handleExport()}>
    Exportar auditoría
  </button>
);
~~~

El Effect no debe convertirse en un sistema indirecto de eventos basado en banderas.

---

## 16. Timers con limpieza

~~~tsx
import { useEffect, useState } from "react";

type RefreshCountdownProps = Readonly<{
  seconds: number;
}>;

export function RefreshCountdown({
  seconds,
}: RefreshCountdownProps) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);

    const intervalId = window.setInterval(() => {
      setRemaining((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [seconds]);

  return <p>Actualización en {remaining} segundos</p>;
}
~~~

Cuando `seconds` cambia, React elimina el intervalo anterior y crea uno nuevo. Al desmontar, también lo elimina.

La actualización funcional `setRemaining((current) => ...)` evita leer `remaining` dentro del Effect; por eso `remaining` no es una dependencia y el timer no se recrea cada segundo.

---

## 17. Objetos y funciones inestables

Este objeto es nuevo en cada render:

~~~tsx
const options = {
  siteId,
  includeResolved,
};

useEffect(() => {
  const connection = connectWithOptions(options);
  return () => connection.disconnect();
}, [options]);
~~~

Aunque sus propiedades no cambien, la identidad del objeto sí cambia. El Effect se resincroniza en cada render.

Una solución es crear el objeto dentro del Effect y depender de primitivas:

~~~tsx
useEffect(() => {
  const options = {
    siteId,
    includeResolved,
  };

  const connection = connectWithOptions(options);
  return () => connection.disconnect();
}, [includeResolved, siteId]);
~~~

Otras estrategias válidas según el caso son:

- mover constantes a nivel de módulo;
- mover funciones no reactivas fuera del componente;
- pasar primitivas en lugar de objetos completos;
- estabilizar callbacks cuando la API realmente requiere identidad estable.

No uses memoización únicamente para silenciar el linter. Primero simplifica la dependencia.

---

## 18. Bucles infinitos

Un Effect puede entrar en ciclo si:

1. actualiza estado;
2. esa actualización cambia una dependencia;
3. el Effect vuelve a ejecutarse;
4. vuelve a actualizar el mismo estado.

~~~tsx
// Incorrecto: cada items nuevo vuelve a disparar el Effect.
useEffect(() => {
  setItems([...items]);
}, [items]);
~~~

Pregúntate:

- ¿Existe un sistema externo?
- ¿El valor puede calcularse durante el render?
- ¿La actualización realmente debe ser estado?
- ¿La dependencia cambia por identidad aunque conserve el mismo contenido?

Eliminar una dependencia para detener el ciclo suele esconder el problema. Corrige el modelo o separa las responsabilidades.

---

## 19. Un Effect no debe ser `async`

Esto es incorrecto:

~~~tsx
useEffect(async () => {
  const response = await fetch("/api/findings");
  // ...
}, []);
~~~

Una función `async` siempre devuelve una promesa. React espera que la configuración devuelva `undefined` o una función de limpieza, no una promesa.

Declara una función asíncrona dentro:

~~~tsx
useEffect(() => {
  const controller = new AbortController();

  async function load(): Promise<void> {
    const response = await fetch("/api/findings", {
      signal: controller.signal,
    });
    // ...
  }

  void load();

  return () => controller.abort();
}, []);
~~~

La función externa sigue devolviendo limpieza de forma sincrónica. La función interna realiza el trabajo asíncrono.

---

## 20. Solicitudes, cancelación y respuestas fuera de orden

Imagina que la persona cambia rápidamente de sede:

1. comienza la solicitud A;
2. cambia `siteId` y comienza la solicitud B;
3. B responde primero y muestra la sede nueva;
4. A responde después y sobrescribe la pantalla con datos antiguos.

Es una condición de carrera.

`AbortController` permite cancelar la solicitud anterior:

~~~tsx
useEffect(() => {
  const controller = new AbortController();

  async function load(): Promise<void> {
    const response = await fetch(
      `/api/sites/${encodeURIComponent(siteId)}/findings`,
      { signal: controller.signal },
    );

    if (controller.signal.aborted) {
      return;
    }

    // Validar y actualizar estado.
  }

  void load();

  return () => controller.abort();
}, [siteId]);
~~~

La comprobación posterior sigue siendo útil porque el trabajo puede incluir lectura y validación después de recibir la respuesta.

La cancelación reduce trabajo innecesario. Otra técnica es ignorar explícitamente respuestas obsoletas. Una solución profesional debe asegurar que una respuesta vieja no actualice la vista nueva.

---

## 21. TypeScript no valida la red

Esto no valida nada:

~~~ts
const findings = (await response.json()) as Finding[];
~~~

El servidor podría devolver:

- un objeto en vez de un array;
- IDs vacíos o duplicados;
- un estado desconocido;
- fechas inválidas;
- campos faltantes;
- un cuerpo HTML de un proxy.

Los tipos TypeScript desaparecen al ejecutar JavaScript. La respuesta debe recibirse como `unknown` y comprobarse con un esquema runtime.

~~~ts
const payload: unknown = await response.json();
const parsed = FindingsPayloadSchema.safeParse(payload);

if (!parsed.success) {
  return {
    ok: false,
    error: {
      kind: "invalid_response",
      message: "La respuesta no cumple el contrato esperado.",
    },
  };
}
~~~

El Effect decide **cuándo sincronizar**. Zod decide **si el valor recibido cumple el contrato**. Son problemas distintos.

---

## 22. Ejemplo completo: hallazgos por sede en SiteOps Tracker

El ejemplo se divide por responsabilidades para que los bloques puedan trasladarse a un proyecto real.

### 22.1 Esquema runtime

~~~ts
// finding.schema.ts
import { z } from "zod";

export const FindingSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  title: z.string().min(1).max(160),
  status: z.enum(["open", "in_progress", "resolved"]),
  severity: z.enum(["low", "medium", "high"]),
  createdAt: z.string().datetime({ offset: true }),
});

const UniqueFindingsSchema = z
  .array(FindingSchema)
  .superRefine((items, context) => {
    const seenIds = new Set<string>();

    items.forEach((item, index) => {
      if (seenIds.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "El ID del hallazgo está duplicado",
          path: [index, "id"],
        });
      }

      seenIds.add(item.id);
    });
  });

export const FindingsPayloadSchema = z.object({
  items: UniqueFindingsSchema,
});

export type Finding = z.infer<typeof FindingSchema>;
~~~

El esquema verifica forma, valores literales, fecha e IDs duplicados dentro de la respuesta.

### 22.2 Cliente HTTP cancelable

~~~ts
// findings.client.ts
import {
  FindingsPayloadSchema,
  type Finding,
} from "./finding.schema";

export type FindingsClientError = Readonly<{
  kind: "aborted" | "network" | "http" | "invalid_response";
  message: string;
}>;

export type LoadFindingsResult =
  | Readonly<{
      ok: true;
      items: readonly Finding[];
    }>
  | Readonly<{
      ok: false;
      error: FindingsClientError;
    }>;

export type LoadFindingsInput = Readonly<{
  siteId: string;
  signal: AbortSignal;
}>;

export type FindingsClient = (
  input: LoadFindingsInput,
) => Promise<LoadFindingsResult>;

export const fetchFindingsBySite: FindingsClient = async ({
  siteId,
  signal,
}) => {
  let response: Response;

  try {
    response = await fetch(
      `/api/sites/${encodeURIComponent(siteId)}/findings`,
      { signal },
    );
  } catch {
    if (signal.aborted) {
      return {
        ok: false,
        error: { kind: "aborted", message: "Solicitud cancelada" },
      };
    }

    return {
      ok: false,
      error: {
        kind: "network",
        message: "No se pudo conectar con el servicio.",
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: {
        kind: "http",
        message: "El servicio rechazó la solicitud.",
      },
    };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    if (signal.aborted) {
      return {
        ok: false,
        error: { kind: "aborted", message: "Solicitud cancelada" },
      };
    }

    return {
      ok: false,
      error: {
        kind: "invalid_response",
        message: "La respuesta no contiene JSON válido.",
      },
    };
  }

  if (signal.aborted) {
    return {
      ok: false,
      error: { kind: "aborted", message: "Solicitud cancelada" },
    };
  }

  const parsed = FindingsPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      ok: false,
      error: {
        kind: "invalid_response",
        message: "La respuesta no cumple el contrato esperado.",
      },
    };
  }

  return {
    ok: true,
    items: parsed.data.items,
  };
};
~~~

El cliente clasifica cancelación, red, HTTP y contrato. La UI no recibe el detalle interno de Zod ni información sensible.

### 22.3 Componente con estado exhaustivo y Effect

~~~tsx
// FindingsBySite.tsx
import { useEffect, useState } from "react";
import type { Finding } from "./finding.schema";
import {
  fetchFindingsBySite,
  type FindingsClient,
  type FindingsClientError,
} from "./findings.client";

type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

type FindingsUiState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{
      status: "success";
      items: NonEmptyReadonlyArray<Finding>;
    }>
  | Readonly<{
      status: "error";
      error: FindingsClientError;
    }>;

function toNonEmpty<T extends object>(
  items: readonly T[],
): NonEmptyReadonlyArray<T> | null {
  const [first, ...rest] = items;

  if (first === undefined) {
    return null;
  }

  return [first, ...rest];
}

function assertNever(value: never): never {
  throw new Error(
    `Estado de UI no manejado: ${JSON.stringify(value)}`,
  );
}

type FindingsBySiteProps = Readonly<{
  siteId: string;
  client?: FindingsClient;
}>;

export function FindingsBySite({
  siteId,
  client = fetchFindingsBySite,
}: FindingsBySiteProps) {
  const [state, setState] = useState<FindingsUiState>({
    status: "loading",
  });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function synchronize(): Promise<void> {
      setState({ status: "loading" });

      const result = await client({
        siteId,
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (!result.ok) {
        if (result.error.kind === "aborted") {
          return;
        }

        setState({
          status: "error",
          error: result.error,
        });
        return;
      }

      const items = toNonEmpty(result.items);

      if (items === null) {
        setState({ status: "empty" });
        return;
      }

      setState({ status: "success", items });
    }

    void synchronize();

    return () => controller.abort();
  }, [client, requestVersion, siteId]);

  function retry(): void {
    setRequestVersion((current) => current + 1);
  }

  switch (state.status) {
    case "loading":
      return <p role="status">Cargando hallazgos…</p>;

    case "empty":
      return (
        <section aria-labelledby="empty-findings-title">
          <h2 id="empty-findings-title">Sin hallazgos</h2>
          <p>La sede no tiene hallazgos registrados.</p>
        </section>
      );

    case "success":
      return (
        <section aria-labelledby="findings-title">
          <h2 id="findings-title">Hallazgos</h2>
          <ul>
            {state.items.map((finding) => (
              <li key={finding.id}>
                {finding.title} — {finding.status}
              </li>
            ))}
          </ul>
        </section>
      );

    case "error":
      return (
        <section role="alert" aria-labelledby="findings-error-title">
          <h2 id="findings-error-title">No fue posible cargar</h2>
          <p>{state.error.message}</p>
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </section>
      );

    default:
      return assertNever(state);
  }
}
~~~

El Effect lee tres valores reactivos: `client`, `requestVersion` y `siteId`. Los tres aparecen en dependencias.

`client` tiene una función estable por defecto porque `fetchFindingsBySite` vive a nivel de módulo. Si un padre inyecta una función nueva en cada render, provocará resincronizaciones; en pruebas se debe pasar una referencia estable.

---

## 23. Funcionamiento del ejemplo completo, paso a paso

1. `FindingsBySite` renderiza inicialmente `loading`.
2. Después del commit, el Effect crea un `AbortController`.
3. El cliente recibe `siteId` y `signal`.
4. `fetch` inicia una solicitud cancelable.
5. El body se guarda como `unknown`.
6. Zod valida forma, literales, fecha y duplicados.
7. El resultado discriminado separa éxito de error.
8. El componente comprueba si la sincronización ya fue abortada.
9. Un array vacío produce `empty`.
10. Un array no vacío produce `success`.
11. Un error seguro produce `error` y permite reintentar.
12. Reintentar incrementa `requestVersion`, que resincroniza el Effect.
13. Si cambia `siteId`, React aborta la solicitud anterior antes de configurar la nueva.
14. Si el componente se desmonta, la limpieza aborta el trabajo pendiente.
15. El `switch` exhaustivo renderiza exactamente una variante.

El Effect no valida JSON, no autoriza al usuario y no consulta PostgreSQL directamente. Solo coordina la sincronización de la UI con el cliente HTTP.

---

## 24. Data fetching en Effects: útil, pero con límites

Una solicitud directa en un Effect sirve para aprender el mecanismo y puede ser suficiente en una aplicación cliente sencilla. Sin embargo, presenta retos:

- no ejecuta durante renderizado del servidor;
- puede crear cascadas de solicitudes;
- no incluye caché ni deduplicación por sí sola;
- necesita manejar cancelación y carreras;
- vuelve a solicitar al remontar;
- mezcla coordinación de datos con el componente si no se extrae.

En aplicaciones mayores, un framework, un loader de rutas o una biblioteca de consulta puede resolver precarga, caché, deduplicación y revalidación. Eso no elimina la necesidad de entender Effects: ayuda a reconocer cuándo otra abstracción administra la sincronización por ti.

No agregues una biblioteca solo para evitar aprender el problema. Tampoco reconstruyas manualmente una plataforma de datos completa dentro de cada componente.

---

## 25. Cuándo utilizar `useEffect`

Úsalo cuando un componente deba mantenerse sincronizado con:

- una conexión de red asociada a la vista actual;
- una suscripción o stream;
- un listener global del navegador;
- un temporizador;
- una API imperativa del DOM;
- un reproductor multimedia;
- un mapa, editor o widget de terceros;
- telemetría causada por la aparición de una pantalla;
- una solicitud cliente dependiente del recurso actualmente mostrado.

Una prueba útil es preguntar:

> “Si React desapareciera, ¿seguiría existiendo un sistema externo que debe iniciarse, actualizarse o detenerse?”

Si la respuesta es sí, un Effect puede ser apropiado.

---

## 26. Cuándo evitarlo

Evita un Effect para:

- filtrar, ordenar o transformar datos para renderizar;
- copiar props a estado sin una razón de identidad;
- calcular etiquetas, conteos o permisos visuales;
- responder a un clic o submit conocido;
- encadenar setters mediante banderas;
- notificar al padre algo que podía ocurrir en el mismo evento;
- “observar” cada cambio de estado interno;
- corregir una estructura de estado contradictoria;
- esconder una dependencia que el linter detecta;
- ejecutar lógica pura.

Quitar Effects innecesarios reduce renders, estados intermedios, carreras y código de limpieza.

---

## 27. Errores comunes y sus causas

### Error 1: ejecutar una operación externa durante el render

El render debe ser puro y puede repetirse. Mueve la sincronización a un Effect o la acción a un evento.

### Error 2: escribir `useEffect(async () => ...)`

Una función async devuelve una promesa, no una limpieza. Declara la función async dentro.

### Error 3: omitir una dependencia

La configuración conserva valores antiguos. Declara todos los valores reactivos leídos.

### Error 4: desactivar `exhaustive-deps`

Silencia una advertencia de sincronización. Reestructura el código.

### Error 5: usar un objeto creado durante cada render

Su identidad cambia y reinicia el Effect. Crea el objeto dentro o depende de primitivas.

### Error 6: usar una función inline inestable como dependencia

La función cambia por identidad. Muévela, rediseña la API o estabilízala solo cuando sea necesario.

### Error 7: olvidar limpieza

Deja listeners, timers, conexiones o trabajo pendiente después de cambiar o desmontar.

### Error 8: escribir limpieza sin configuración correspondiente

La limpieza debe ser simétrica, no una colección arbitraria de setters.

### Error 9: impedir el ciclo de Strict Mode con una ref

Oculta fugas. Implementa setup y cleanup correctos.

### Error 10: actualizar estado después de una solicitud obsoleta

Puede mostrar datos de otra sede. Cancela o ignora la respuesta anterior.

### Error 11: usar Effect para datos derivados

Duplica estado y añade una renderización. Calcula durante el render.

### Error 12: usar Effect para un evento

Se pierde la causa y aparecen banderas intermedias. Ejecuta la operación en el manejador.

### Error 13: mezclar varias sincronizaciones no relacionadas

Una conexión y un timer pueden requerir dependencias y limpiezas distintas. Usa Effects separados.

### Error 14: afirmar que `[]` significa “una vez”

Describe ausencia de dependencias reactivas, no una garantía universal de una única ejecución de desarrollo.

### Error 15: confiar en una aserción TypeScript para HTTP

Los tipos desaparecen en runtime. Valida el body como `unknown`.

### Error 16: exponer errores internos

No muestres stack traces, SQL o información sensible. Registra detalles de forma segura y presenta un mensaje controlado.

### Error 17: guardar secretos en variables del frontend

El código enviado al navegador puede inspeccionarse. Los secretos pertenecen al backend o a servicios seguros.

---

## 28. TypeScript desaparece en runtime

TypeScript puede comprobar:

- el tipo de props;
- la firma del cliente;
- el tipo del estado;
- las variantes de un resultado;
- que una función de limpieza retorne `void`;
- el uso de `AbortSignal`.

No puede comprobar en ejecución:

- el JSON real de HTTP;
- un evento recibido por WebSocket;
- un archivo cargado;
- un valor de formulario;
- una variable de entorno;
- una respuesta externa;
- una fila leída de la base de datos.

Los tipos se eliminan al emitir JavaScript. Usa Zod en fronteras runtime y conserva las capas de seguridad adecuadas:

- frontend/SDK valida respuestas no confiables;
- Router y Controller reciben entradas externas;
- Runtime Validation comprueba params, query y body;
- Service aplica reglas y autorización;
- Repository usa parámetros y mapea filas;
- PostgreSQL impone integridad persistente.

Un Effect correcto puede sincronizar en el momento adecuado y aun así propagar datos inválidos si omites la validación.

---

## 29. Relación explícita con la arquitectura Full Stack

El flujo objetivo continúa siendo:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

| Capa | Relación con `useEffect` y sincronización |
|---|---|
| React | Configura y limpia sincronización según props y estado |
| HTTP/SDK | Acepta cancelación, clasifica errores y valida la respuesta |
| Node.js | Ejecuta la API y administra recursos del servidor |
| Router | Relaciona método y URL con el Controller |
| Controller | Traduce request y resultado a un contrato HTTP |
| Runtime Validation | Comprueba `siteId`, filtros, body y payloads externos |
| Service | Aplica autorización y reglas de negocio |
| Repository | Ejecuta consultas parametrizadas y mapea filas |
| PostgreSQL | Mantiene datos, relaciones y restricciones |
| Testing | Comprueba setup, resultado, resincronización y cleanup |
| Docker | Reproduce frontend, API y PostgreSQL |
| CI/CD | Ejecuta typecheck, lint, pruebas y build |
| Cloud | Proporciona logs, métricas, trazas, timeouts y escalamiento |

Un cambio de `siteId` en React no autoriza la consulta. La API debe comprobar que la identidad autenticada puede consultar esa sede.

Abortar el `fetch` del navegador no garantiza que PostgreSQL cancele instantáneamente el trabajo que ya comenzó. Backend, driver y plataforma requieren sus propios timeouts, límites y observabilidad. Cada capa administra su ciclo de vida.

---

## 30. ESLint, TypeScript y calidad

Una configuración profesional puede combinar:

- TypeScript con `strict`;
- `eslint-plugin-react-hooks`;
- `react-hooks/rules-of-hooks`;
- `react-hooks/exhaustive-deps`;
- `typescript-eslint` para promesas mal manejadas;
- Vitest;
- Testing Library;
- build de producción.

Ejemplo conceptual de quality gate:

~~~text
typecheck → lint → pruebas → build
~~~

El linter no “inventa” dependencias. Analiza qué valores reactivos lee el Effect. Si una dependencia genera ejecuciones excesivas, investiga por qué cambia en vez de borrarla.

Una regla como `@typescript-eslint/no-floating-promises` ayuda a hacer explícito el inicio intencional de una promesa:

~~~ts
void synchronize();
~~~

Ese `void` no maneja errores por sí solo. La función debe convertir los fallos esperados en resultados o capturarlos de forma segura.

---

## 31. Pruebas del resultado y la limpieza

Inyectar el cliente permite probar sin realizar solicitudes reales.

~~~tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FindingsBySite } from "./FindingsBySite";
import type {
  FindingsClient,
  LoadFindingsResult,
} from "./findings.client";

const SUCCESS_RESULT = {
  ok: true,
  items: [
    {
      id: "finding-demo-01",
      siteId: "site-demo-north",
      title: "UPS sin monitoreo",
      status: "open",
      severity: "high",
      createdAt: "2026-10-16T12:00:00Z",
    },
  ],
} as const satisfies LoadFindingsResult;

describe("FindingsBySite", () => {
  it("muestra datos validados devueltos por el cliente", async () => {
    const client = vi.fn<FindingsClient>()
      .mockResolvedValue(SUCCESS_RESULT);

    render(
      <FindingsBySite
        siteId="site-demo-north"
        client={client}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando hallazgos",
    );

    expect(
      await screen.findByText("UPS sin monitoreo — open"),
    ).toBeInTheDocument();

    expect(client).toHaveBeenCalledOnce();
  });

  it("aborta la sincronización anterior cuando cambia la sede", async () => {
    const observedSignals: AbortSignal[] = [];

    const client: FindingsClient = ({ signal }) => {
      observedSignals.push(signal);

      return new Promise<LoadFindingsResult>(() => {
        // La promesa queda pendiente para observar la limpieza.
      });
    };

    const { rerender, unmount } = render(
      <FindingsBySite
        siteId="site-demo-north"
        client={client}
      />,
    );

    await waitFor(() => {
      expect(observedSignals).toHaveLength(1);
    });

    rerender(
      <FindingsBySite
        siteId="site-demo-south"
        client={client}
      />,
    );

    await waitFor(() => {
      expect(observedSignals).toHaveLength(2);
    });

    const firstSignal = observedSignals[0];
    const secondSignal = observedSignals[1];

    if (firstSignal === undefined || secondSignal === undefined) {
      throw new Error("Se esperaban dos señales de cancelación");
    }

    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);

    unmount();

    expect(secondSignal.aborted).toBe(true);
  });
});
~~~

La primera prueba observa la transición visible. La segunda prueba demuestra la limpieza al cambiar dependencias y al desmontar.

En un proyecto con Strict Mode, evita afirmar un número rígido de configuraciones cuando el objetivo de la prueba es otro. Prueba el contrato observable y que cada recurso creado pueda limpiarse.

---

## 32. Probar timers

Vitest permite controlar el tiempo:

~~~tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RefreshCountdown } from "./RefreshCountdown";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("reduce el contador cada segundo", () => {
  render(<RefreshCountdown seconds={3} />);

  expect(screen.getByText("Actualización en 3 segundos"))
    .toBeInTheDocument();

  act(() => {
    vi.advanceTimersByTime(1_000);
  });

  expect(screen.getByText("Actualización en 2 segundos"))
    .toBeInTheDocument();
});
~~~

`act` agrupa la actualización producida al avanzar el reloj. La intención es controlar el tiempo y verificar la salida, no esperar un segundo real.

También conviene comprobar que el timer deja de producir actualizaciones después del desmontaje.

---

## 33. Relación con las piezas del portafolio

### SiteOps Tracker

Las pantallas por sede pueden cancelar solicitudes anteriores, mostrar estados exhaustivos y suscribirse a cambios sin dejar recursos abiertos.

### SDK tipado para una API

El SDK acepta `AbortSignal`, trata JSON como `unknown`, valida con Zod y devuelve un resultado discriminado. Es una API más profesional que un simple `fetch` con aserción.

### API REST Node.js + TypeScript + PostgreSQL

La cancelación del cliente se complementa con timeouts del servidor y del driver. Router, Controller, Service y Repository mantienen responsabilidades separadas.

### Analizador de configuraciones

Un componente puede sincronizarse con la selección de archivo o con un Worker externo. Los resultados del archivo siguen necesitando validación runtime.

### Repositorio de algoritmos TypeScript

Un visualizador puede iniciar y limpiar un intervalo que avanza pasos. Los cálculos puros del algoritmo no necesitan Effects.

### Aplicación Full Stack

Un ejemplo con cancelación, cleanup, validación y pruebas demuestra que comprendes ciclos de vida y no solo la sintaxis del Hook. Es valioso en portafolio y entrevistas.

---

## 34. Ejercicio práctico — Suscripción a eventos de una sede

Construye `SiteActivityPanel` para mostrar eventos ficticios de SiteOps Tracker. No se incluye la solución completa.

### Contratos iniciales

~~~ts
import { z } from "zod";

export const SiteActivitySchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  kind: z.enum([
    "asset_registered",
    "finding_created",
    "action_completed",
  ]),
  occurredAt: z.string().datetime({ offset: true }),
});

export type SiteActivity = z.infer<typeof SiteActivitySchema>;

export type SubscribeToSiteActivity = (
  input: Readonly<{
    siteId: string;
    onMessage: (payload: unknown) => void;
    onConnectionChange: (connected: boolean) => void;
  }>,
) => () => void;
~~~

### Punto de partida

~~~tsx
type SiteActivityPanelProps = Readonly<{
  siteId: string;
  subscribe: SubscribeToSiteActivity;
}>;

export function SiteActivityPanel({
  siteId,
  subscribe,
}: SiteActivityPanelProps) {
  // TODO: modela estado, configura la suscripción y límpiala.
  return null;
}
~~~

### Requisitos

1. Llama `useEffect` en el nivel superior.
2. Suscríbete con el `siteId` actual.
3. Declara todas las dependencias reactivas.
4. Retorna exactamente la función de desuscripción.
5. Trata cada mensaje como `unknown`.
6. Valida con `SiteActivitySchema.safeParse`.
7. Ignora o registra de forma segura mensajes inválidos.
8. Conserva como máximo los diez eventos más recientes.
9. No muta el array de estado.
10. Muestra conectado, desconectado y lista vacía.
11. Usa IDs estables como `key`.
12. Prueba que cambiar `siteId` llama la limpieza anterior.
13. Prueba que desmontar llama la última limpieza.
14. No desactives `exhaustive-deps`.
15. No generes datos reales ni identificables.

El ejercicio queda deliberadamente sin solución completa.

---

## 35. Pistas para el ejercicio

1. El resultado de `subscribe(...)` ya es una función de limpieza.
2. El Effect lee `siteId` y `subscribe`; ambos son dependencias.
3. Declara `handleMessage(payload: unknown)` dentro del Effect.
4. Usa `SiteActivitySchema.safeParse(payload)` antes de acceder a campos.
5. Para agregar sin mutar: `setEvents((current) => [newEvent, ...current].slice(0, 10))`.
6. La actualización funcional evita depender del array `events`.
7. Una función espía puede representar `unsubscribe` en la prueba.
8. Usa `rerender` para cambiar la prop `siteId`.
9. Usa `unmount` para comprobar la última limpieza.
10. Si la suscripción se reinicia con cada evento, revisa tus dependencias.

---

## 36. Reto adicional — Consulta Full Stack cancelable por filtros

Construye una consulta de activos para SiteOps Tracker con filtros por sede, categoría y estado.

### React

- Sincroniza la consulta con filtros confirmados.
- Cancela la solicitud anterior al cambiar filtros.
- Usa estados `loading`, `empty`, `success` y `error`.
- Ofrece reintento sin duplicar lógica.
- No usa un Effect para calcular la lista visible local.

### SDK y HTTP

- Construye query params de forma segura.
- Acepta `AbortSignal`.
- Recibe el body como `unknown`.
- Valida el payload con Zod.
- Distingue cancelación, red, HTTP y contrato inválido.

### Node.js

- Router define `GET /assets`.
- Controller recibe query params.
- Runtime Validation comprueba filtros y límites.
- Service aplica autorización de sede.
- Repository usa parámetros y un orden determinista.

### PostgreSQL

- Filtra sin concatenar entrada del usuario.
- Usa índices apropiados cuando se estudie optimización.
- Conserva claves y restricciones.
- Devuelve resultados deterministas.

### Testing

- Prueba éxito, vacío, error y payload inválido.
- Prueba cancelación al cambiar filtros.
- Prueba cleanup al desmontar.
- Prueba la ruta de integración sin depender del frontend.

### Docker, CI/CD y Cloud

Documenta, sin adelantar esas etapas en profundidad, cómo Docker Compose reproducirá frontend, API y PostgreSQL; cómo GitHub Actions ejecutará typecheck, ESLint, pruebas y build; y cómo logs, métricas, trazas y timeouts ayudarán a diagnosticar sincronizaciones lentas en Cloud.

---

## 37. Preguntas de comprensión

1. ¿Qué problema resuelve `useEffect`?
2. ¿Qué diferencia existe entre render, commit y Effect?
3. ¿Qué debe devolver la configuración de un Effect?
4. ¿Por qué la función pasada a `useEffect` no debe ser `async`?
5. ¿Qué significa omitir el array de dependencias?
6. ¿Qué significa `[]` realmente?
7. ¿Qué valores se consideran reactivos?
8. ¿Por qué las dependencias deben coincidir con el código?
9. ¿Cuándo se ejecuta la limpieza?
10. ¿Qué intenta detectar Strict Mode con el ciclo adicional?
11. ¿Por qué una ref que bloquea la segunda configuración no corrige una fuga?
12. ¿Cuándo una operación pertenece a un evento?
13. ¿Por qué filtrar datos no necesita un Effect?
14. ¿Cómo puede un objeto causar ejecuciones innecesarias?
15. ¿Qué dos condiciones crean un bucle infinito de Effect?
16. ¿Qué problema resuelve `AbortController`?
17. ¿Por qué hay que comprobar una respuesta incluso después de `fetch`?
18. ¿Qué sucede con los tipos TypeScript en runtime?
19. ¿Cómo probarías la limpieza al cambiar `siteId`?
20. ¿Qué limitaciones tiene obtener datos directamente en un Effect?

---

## 38. Relevancia para entrevistas técnicas

### “¿Para qué sirve `useEffect`?”

Sirve para sincronizar un componente con un sistema externo después del commit. No es la herramienta general para calcular estado derivado.

### “¿Cuándo se ejecuta cleanup?”

Antes de volver a configurar un Effect cuyas dependencias cambiaron y al desmontar. En Strict Mode también forma parte del ciclo adicional de desarrollo.

### “¿Qué debe ir en dependencias?”

Todos los valores reactivos leídos por el Effect. No se eligen según la frecuencia deseada; se derivan del código.

### “¿Por qué un Effect se ejecuta en bucle?”

Porque actualiza estado y esa actualización cambia una dependencia. También puede ocurrir cuando depende de objetos o funciones nuevos en cada render.

### “¿Por qué React ejecuta un Effect dos veces en desarrollo?”

Strict Mode realiza una configuración, limpieza y nueva configuración para comprobar que la lógica sea reversible. La respuesta correcta es implementar cleanup, no bloquear el segundo ciclo.

### “¿Cómo evitas una condición de carrera al hacer fetch?”

Cancelo o ignoro la solicitud anterior, impido actualizaciones obsoletas y pruebo cambios rápidos de dependencia.

### “¿TypeScript garantiza la respuesta HTTP?”

No. Recibo `unknown`, valido con un esquema runtime y solo después creo datos tipados.

### “¿Cuándo no usarías `useEffect`?”

Para cálculos puros, datos derivados o acciones causadas por una interacción concreta. Esos casos pertenecen al render o al manejador del evento.

Una respuesta fuerte explica sistema externo, dependencias, simetría, carreras, validación y pruebas.

---

## 39. Lista de verificación profesional

- [ ] Existe un sistema externo real que necesita sincronización.
- [ ] El render permanece puro.
- [ ] Los eventos del usuario viven en manejadores.
- [ ] Los datos derivados se calculan durante el render.
- [ ] `useEffect` se llama en el nivel superior.
- [ ] La configuración no es una función `async`.
- [ ] Cada valor reactivo leído aparece en dependencias.
- [ ] No se desactiva `exhaustive-deps`.
- [ ] Objetos y funciones no se recrean sin necesidad.
- [ ] La limpieza refleja exactamente la configuración.
- [ ] Listeners usan las mismas referencias al agregarse y quitarse.
- [ ] Timers se cancelan.
- [ ] Suscripciones se cierran.
- [ ] Solicitudes anteriores se cancelan o ignoran.
- [ ] Strict Mode no produce fugas.
- [ ] Los datos HTTP empiezan como `unknown`.
- [ ] Zod valida el contrato en runtime.
- [ ] Errores visibles no exponen detalles internos.
- [ ] El backend aplica autenticación y autorización.
- [ ] Las pruebas cubren resultado, resincronización y cleanup.
- [ ] Typecheck, lint, pruebas y build se ejecutan en CI.

---

## 40. Resumen

- `useEffect` sincroniza React con sistemas externos después del commit.
- El render debe ser puro.
- Los manejadores responden a interacciones concretas.
- Un Effect configura y después limpia una sincronización.
- La limpieza corre antes de resincronizar y al desmontar.
- Strict Mode añade en desarrollo un ciclo de configuración y limpieza para detectar errores.
- Las dependencias se derivan de los valores reactivos leídos.
- `[]` significa que el Effect no lee valores reactivos, no “exactamente una vez”.
- Silenciar `exhaustive-deps` puede crear closures obsoletos.
- Objetos y funciones nuevos pueden resincronizar de más.
- Los datos derivados no necesitan un Effect.
- Las acciones causadas por clic o submit pertenecen al evento.
- La configuración de un Effect no debe ser `async`.
- `AbortController` ayuda a cancelar trabajo anterior.
- Una respuesta obsoleta no debe actualizar la vista actual.
- Los tipos TypeScript desaparecen en runtime.
- HTTP, formularios, APIs externas, archivos, variables de entorno y bases de datos requieren validación real.
- Zod valida el payload; TypeScript protege su uso posterior.
- Los Effects directos para data fetching requieren cancelación, errores, caché y estrategia consciente.
- Testing Library y Vitest pueden comprobar resultado y cleanup.

---

## Referencias oficiales

- [React: Synchronizing with Effects](https://react.dev/learn/synchronizing-with-effects)
- [React: `useEffect`](https://react.dev/reference/react/useEffect)
- [React: Lifecycle of Reactive Effects](https://react.dev/learn/lifecycle-of-reactive-effects)
- [React: Removing Effect Dependencies](https://react.dev/learn/removing-effect-dependencies)
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React: Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [React: exhaustive-deps lint](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps)
- [Zod: Basic usage](https://zod.dev/basics)
- [MDN: AbortController](https://developer.mozilla.org/docs/Web/API/AbortController)
- [Testing Library: Async Methods](https://testing-library.com/docs/dom-testing-library/api-async/)
- [Vitest: Timer mocks](https://vitest.dev/guide/mocking/timers)

Referencias consultadas el **16 de octubre de 2026**.

---

# Próxima lección

**Lección 41 — Custom Hooks con TypeScript: extraer lógica reutilizable, contratos tipados y pruebas.**
