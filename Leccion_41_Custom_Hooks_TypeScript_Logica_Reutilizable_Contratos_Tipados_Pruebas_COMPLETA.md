# Lección 41 — Custom Hooks con TypeScript: extraer lógica reutilizable, contratos tipados y pruebas

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — reutilización de lógica con Hooks propios  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## 1. Introducción

En la lección anterior sincronizaste componentes con sistemas externos mediante `useEffect`: solicitudes HTTP, listeners, timers y suscripciones. También aprendiste a declarar dependencias, limpiar recursos y validar datos externos antes de guardarlos en estado.

Ese código funciona, pero aparece una nueva dificultad cuando varias pantallas necesitan la misma conducta. Por ejemplo, el panel de hallazgos, el resumen de una sede y la vista de acciones correctivas podrían repetir:

- estado de carga, éxito, vacío y error;
- inicio de una solicitud cuando cambia `siteId`;
- cancelación de la solicitud anterior;
- validación runtime de la respuesta;
- normalización de errores;
- una acción para reintentar;
- pruebas de la misma transición de estados.

Copiar esa lógica entre componentes produce pequeñas diferencias, errores de limpieza y contratos difíciles de mantener. Un **Custom Hook** permite extraer lógica React reutilizable detrás de una API con nombre y tipos explícitos.

La idea central es importante:

> Un Custom Hook comparte lógica con estado, Effects u otros Hooks; no comparte automáticamente la misma instancia de estado entre sus consumidores.

Cada llamada al Hook posee su propio estado y su propio ciclo de sincronización.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. explicar qué problema resuelve un Custom Hook;
2. distinguir lógica reutilizable de estado compartido;
3. extraer un Effect sin cambiar su comportamiento;
4. diseñar parámetros y resultados tipados;
5. elegir entre parámetros posicionales y un objeto de opciones;
6. elegir entre una tupla y un objeto de retorno;
7. respetar las Rules of Hooks dentro de un Hook propio;
8. mantener dependencias y limpiezas correctas;
9. integrar un cliente HTTP inyectable y estable;
10. validar respuestas `unknown` con Zod;
11. modelar carga, vacío, éxito y error con una unión discriminada;
12. probar el Hook y, cuando convenga, el componente que lo consume;
13. reconocer abstracciones útiles y Hooks innecesarios;
14. relacionar el Hook con toda la arquitectura Full Stack de SiteOps Tracker.

---

## 3. El problema que resuelve un Custom Hook

Imagina dos componentes que necesitan conocer si el navegador está conectado. Sin una abstracción, ambos pueden repetir este patrón:

~~~tsx
import { useEffect, useState } from "react";

export function ConnectionBadge() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return <span>{isOnline ? "Con conexión" : "Sin conexión"}</span>;
}
~~~

El código mezcla dos responsabilidades:

1. **Lógica de sincronización:** leer el estado del navegador, registrar listeners y limpiarlos.
2. **Presentación:** decidir qué texto y estilo mostrar.

Si otra pantalla copia el mismo Effect, ambos lugares deberán evolucionar juntos. Si uno olvida retirar un listener, el comportamiento deja de ser equivalente.

Un Custom Hook separa esas responsabilidades:

~~~tsx
import { useDebugValue, useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateStatus = () => setIsOnline(navigator.onLine);

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  useDebugValue(isOnline ? "online" : "offline");

  return isOnline;
}
~~~

El componente queda enfocado en la interfaz:

~~~tsx
import { useOnlineStatus } from "./useOnlineStatus";

export function ConnectionBadge() {
  const isOnline = useOnlineStatus();

  return (
    <span role="status">
      {isOnline ? "Con conexión" : "Sin conexión"}
    </span>
  );
}
~~~

El Hook oculta el mecanismo, pero conserva visible su intención: obtener el estado de conexión.

---

## 4. Razón de existir

Los componentes expresan interfaz. A medida que una aplicación crece, también coordinan estado, eventos, Effects, contexto, recursos externos y reglas de interacción.

Los Custom Hooks existen para:

- reutilizar lógica React sin duplicarla;
- dar un nombre de dominio a una conducta técnica;
- reducir detalles de sincronización dentro del componente;
- centralizar cleanup, manejo de errores y transiciones;
- ofrecer un contrato pequeño y tipado;
- probar lógica compleja con dependencias controladas;
- facilitar cambios de implementación sin modificar cada consumidor.

En SiteOps Tracker, `useFindingsBySite` comunica más intención que “un `useEffect` con `fetch`, tres `setState` y un `AbortController`”. El nombre convierte una secuencia técnica en una capacidad del producto.

Un Custom Hook no es una capa obligatoria. Existe cuando la extracción mejora el vocabulario, la reutilización, el aislamiento o la capacidad de prueba.

---

## 5. Funcionamiento

Un Custom Hook es una función JavaScript o TypeScript que:

1. tiene un nombre que comienza con `use`;
2. puede llamar Hooks de React u otros Hooks propios;
3. se llama únicamente desde un componente o desde otro Hook;
4. se ejecuta durante cada render del componente consumidor;
5. puede devolver valores y funciones para que el componente los use.

Ejemplo mínimo:

~~~tsx
import { useState } from "react";

type UseDisclosureResult = Readonly<{
  isOpen: boolean;
  open: () => void;
  close: () => void;
}>;

export function useDisclosure(initialValue = false): UseDisclosureResult {
  const [isOpen, setIsOpen] = useState(initialValue);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
~~~

Cuando dos componentes llaman `useDisclosure()`, React crea dos estados independientes:

~~~tsx
export function AuditWorkspace() {
  const filters = useDisclosure();
  const createFinding = useDisclosure();

  return (
    <section>
      <button onClick={filters.open}>Abrir filtros</button>
      <button onClick={createFinding.open}>Registrar hallazgo</button>

      {filters.isOpen && <p>Panel de filtros</p>}
      {createFinding.isOpen && <p>Formulario de hallazgo</p>}
    </section>
  );
}
~~~

Abrir los filtros no abre el formulario. Se reutilizó la lógica, no la instancia de estado.

Para compartir el mismo estado entre componentes se requiere elevarlo a un ancestro común, usar contexto o adoptar otra estrategia de almacenamiento. Crear un Custom Hook por sí solo no transforma estado local en estado global.

---

## 6. Las Rules of Hooks siguen aplicando

Extraer código no elimina las reglas de React. Dentro de un Hook propio:

- llama Hooks en el nivel superior;
- no los llames dentro de `if`, ciclos, callbacks ni `try/catch`;
- no los llames después de un retorno temprano;
- llama Hooks solo desde componentes u otros Hooks;
- conserva el mismo orden de llamadas en cada render.

Código incorrecto:

~~~tsx
import { useEffect } from "react";

export function useOptionalSubscription(enabled: boolean) {
  if (enabled) {
    // Incorrecto: la llamada es condicional.
    useEffect(() => {
      // Suscripción ficticia.
    }, []);
  }
}
~~~

La condición debe vivir dentro del Effect:

~~~tsx
import { useEffect } from "react";

export function useOptionalSubscription(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const unsubscribe = subscribeToAuditEvents();

    return unsubscribe;
  }, [enabled]);
}

function subscribeToAuditEvents(): () => void {
  return () => {
    // Liberación ficticia del recurso.
  };
}
~~~

El Hook siempre se llama. La sincronización decide internamente si debe activarse.

> **Precisión:** estas reglas describen Hooks como `useState`, `useEffect` y los Hooks propios. La API especial `use` de React tiene reglas particulares; esa excepción no permite llamar condicionalmente a los demás Hooks.

---

## 7. El nombre `use` es un contrato

El prefijo `use` no es decoración. Indica a React, al linter y al equipo que la función obedece las Rules of Hooks.

Usa `use` cuando la función llama Hooks:

~~~ts
function useFindingsBySite() {
  // Puede llamar useState, useEffect y otros Hooks.
}
~~~

No uses `use` para una utilidad pura:

~~~ts
type FindingSeverity = "low" | "medium" | "high" | "critical";

function sortSeverities(
  severities: readonly FindingSeverity[],
): FindingSeverity[] {
  const weight: Record<FindingSeverity, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };

  return [...severities].sort((left, right) => weight[right] - weight[left]);
}
~~~

`sortSeverities` no depende de React. Puede vivir en el repositorio de algoritmos TypeScript y probarse como una función normal.

---

## 8. Qué conviene extraer

Una extracción suele ser valiosa cuando aparece una o más de estas señales:

- la misma combinación de Hooks se repite;
- la lógica tiene un nombre claro en el dominio;
- el componente contiene demasiados detalles de coordinación;
- varias transiciones deben mantenerse consistentes;
- la lógica requiere setup y cleanup delicados;
- quieres inyectar una dependencia para probar estados sin red real;
- esperas cambiar el mecanismo sin afectar la presentación.

No necesitas esperar a que exista duplicación literal. Una conducta compleja y bien delimitada puede merecer un Hook aunque tenga un solo consumidor.

---

## 9. Qué no conviene extraer

Evita crear un Hook cuando:

- solo renombra una línea sin aportar significado;
- mezcla responsabilidades no relacionadas;
- oculta una mutación importante detrás de un nombre ambiguo;
- devuelve casi todo el estado interno sin una API coherente;
- reemplaza una función pura que no necesita React;
- se convierte en un “Hook dios” para toda la pantalla;
- crea una fábrica dinámica de Hooks;
- intenta compartir estado solo por estar definido en un archivo común.

Esta abstracción aporta poco:

~~~tsx
import { useState } from "react";

export function useString() {
  return useState("");
}
~~~

El nombre no expresa dominio, restricciones ni comportamiento. En un formulario concreto, `useFindingDraft` podría ser útil si centraliza un modelo, validación local y acciones coherentes; `useString` solo añade navegación mental.

---

## 10. Extracción paso a paso

Para extraer con seguridad la consulta de hallazgos de la lección anterior:

1. **Identifica una responsabilidad:** cargar hallazgos de una sede.
2. **Marca las entradas externas:** `siteId` y el cliente HTTP.
3. **Marca el estado interno:** carga, vacío, éxito o error.
4. **Conserva la sincronización:** el Effect depende de la sede, el cliente y el intento actual.
5. **Conserva la limpieza:** abortar y descartar resultados obsoletos.
6. **Diseña la salida:** `state` y `retry`.
7. **Mueve la lógica sin cambiarla:** primero extracción; después mejoras.
8. **Deja JSX en el componente:** el Hook no debe devolver elementos visuales.
9. **Prueba el contrato observable:** estados, llamadas y cleanup.

La extracción correcta conserva la conducta. Si al mover el código se cambian simultáneamente el manejo de errores, el modelo de estado y el cliente, será difícil saber qué modificación introdujo un fallo.

---

## 11. Diseñar entradas tipadas

Para una entrada breve y estable, un parámetro posicional es legible:

~~~ts
function useFinding(findingId: string) {
  // ...
}
~~~

Cuando el contrato tiene varias opciones o probablemente crecerá, un objeto escala mejor:

~~~ts
type UseFindingsBySiteOptions = Readonly<{
  siteId: string;
  enabled?: boolean;
  client?: FindingsClient;
}>;

function useFindingsBySite(options: UseFindingsBySiteOptions) {
  // ...
}
~~~

Comparación:

| Forma | Ventaja | Riesgo | Úsala cuando |
|---|---|---|---|
| Posicional | llamada corta | el orden pierde claridad al crecer | hay una o dos entradas inequívocas |
| Objeto de opciones | nombres visibles y evolución sencilla | más sintaxis | hay opciones, dependencias o valores opcionales |

`Readonly` comunica que el Hook no debe mutar el objeto recibido. Los argumentos de un Hook deben tratarse como instantáneas inmutables del render actual.

---

## 12. Diseñar el resultado tipado

Un Hook puede devolver una tupla o un objeto.

### Tupla

~~~ts
type UseToggleResult = readonly [
  value: boolean,
  toggle: () => void,
];
~~~

Es adecuada cuando el contrato es pequeño, el orden es convencional y el consumidor suele elegir sus propios nombres.

### Objeto

~~~ts
type UseFindingsBySiteResult = Readonly<{
  state: FindingsQueryState;
  retry: () => void;
}>;
~~~

Es preferible cuando existen varias propiedades, los nombres mejoran la lectura o el contrato puede crecer.

Evita devolver una colección sin forma estable, como `unknown[]`, o exponer setters internos sin intención:

~~~ts
// Débil: obliga al componente a conocer detalles de implementación.
return { findings, setFindings, loading, setLoading, error, setError };
~~~

Un mejor contrato expresa capacidades:

~~~ts
return { state, retry };
~~~

El componente conoce qué puede observar y qué acción puede solicitar, pero no manipula directamente las transiciones internas.

---

## 13. Modelar estados con una unión discriminada

Evita combinaciones imposibles como `loading === true` junto con `error !== null` y datos antiguos.

~~~ts
export type Finding = Readonly<{
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
}>;

export type FindingsQueryState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "success"; findings: readonly Finding[] }>
  | Readonly<{ status: "error"; message: string }>;
~~~

La propiedad `status` permite narrowing y renderizado exhaustivo. El Hook es responsable de producir estados válidos; el componente solo los interpreta.

---

## 14. Los tipos desaparecen en runtime

TypeScript revisa el programa durante desarrollo o compilación. Sus tipos no acompañan al JavaScript ejecutado.

Esta aserción no valida una respuesta:

~~~ts
const findings = (await response.json()) as Finding[];
~~~

Solo ordena al compilador confiar. Si el servidor devuelve otra forma, el navegador recibe esa forma incorrecta.

Toda frontera externa produce datos que deben considerarse `unknown` hasta validarlos:

- respuestas HTTP;
- formularios y parámetros de URL;
- APIs externas;
- archivos JSON o CSV;
- variables de entorno;
- mensajes WebSocket;
- filas obtenidas de PostgreSQL;
- cachés y almacenamiento del navegador.

Un Custom Hook puede consumir datos ya validados por un SDK, pero no convierte tipos estáticos en validación real. La validación debe ocurrir en la frontera apropiada.

---

## 15. Esquema Zod para la frontera HTTP

El SDK tipado de SiteOps Tracker valida la respuesta antes de entregarla al Hook:

~~~ts
import { z } from "zod";

export const findingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "in_progress", "resolved"]),
  createdAt: z.string().datetime({ offset: true }),
});

export const findingsSchema = z.array(findingSchema);

export type Finding = Readonly<z.infer<typeof findingSchema>>;
~~~

`z.infer` deriva el tipo desde el esquema, reduciendo el riesgo de que el tipo estático y la validación describan modelos diferentes.

`parse` devuelve datos validados o lanza un `ZodError`. `safeParse` devuelve una unión discriminada con éxito o error. Elige según el flujo de errores de la capa; ninguna opción hace innecesario manejar el fallo.

---

## 16. Cliente HTTP tipado e inyectable

El Hook no necesita conocer todos los detalles de `fetch`. Define la capacidad que requiere:

~~~ts
import { findingsSchema, type Finding } from "./findingSchema";

export type FindingsClient = (
  siteId: string,
  options: Readonly<{ signal: AbortSignal }>,
) => Promise<readonly Finding[]>;

export const fetchFindingsBySite: FindingsClient = async (
  siteId,
  { signal },
) => {
  const response = await fetch(
    `/api/sites/${encodeURIComponent(siteId)}/findings`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      signal,
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();

  return findingsSchema.parse(payload);
};
~~~

El contrato incluye `AbortSignal`, por lo que la cancelación no es un detalle opcional. En producción se usa `fetchFindingsBySite`; en pruebas se inyecta una función controlada.

La constante por defecto está definida a nivel de módulo. Su identidad es estable entre renders.

---

## 17. Ejemplo completo: `useFindingsBySite`

~~~tsx
import {
  useCallback,
  useDebugValue,
  useEffect,
  useState,
} from "react";
import {
  fetchFindingsBySite,
  type FindingsClient,
} from "./findingsClient";
import type { Finding } from "./findingSchema";

export type FindingsQueryState =
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{ status: "success"; findings: readonly Finding[] }>
  | Readonly<{ status: "error"; message: string }>;

type StoredQueryState = Readonly<{
  siteId: string;
  value: FindingsQueryState;
}>;

type UseFindingsBySiteOptions = Readonly<{
  siteId: string;
  client?: FindingsClient | undefined;
}>;

export type UseFindingsBySiteResult = Readonly<{
  state: FindingsQueryState;
  retry: () => void;
}>;

function toPublicMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("HTTP 4")) {
    return "No fue posible consultar esta sede.";
  }

  return "No fue posible cargar los hallazgos. Intenta nuevamente.";
}

export function useFindingsBySite({
  siteId,
  client = fetchFindingsBySite,
}: UseFindingsBySiteOptions): UseFindingsBySiteResult {
  const [stored, setStored] = useState<StoredQueryState>(() => ({
    siteId,
    value: { status: "loading" },
  }));
  const [requestVersion, setRequestVersion] = useState(0);

  const retry = useCallback(() => {
    setRequestVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setStored({
      siteId,
      value: { status: "loading" },
    });

    void client(siteId, { signal: controller.signal })
      .then((findings) => {
        if (!active) {
          return;
        }

        setStored({
          siteId,
          value:
            findings.length === 0
              ? { status: "empty" }
              : { status: "success", findings },
        });
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setStored({
          siteId,
          value: {
            status: "error",
            message: toPublicMessage(error),
          },
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [client, requestVersion, siteId]);

  const state: FindingsQueryState =
    stored.siteId === siteId
      ? stored.value
      : { status: "loading" };

  useDebugValue(`${siteId}: ${state.status}`);

  return { state, retry };
}
~~~

---

## 18. Funcionamiento del Hook, paso a paso

1. El componente llama `useFindingsBySite({ siteId })` durante el render.
2. El Hook obtiene su estado propio y la versión de reintento.
3. Tras el commit, el Effect crea un `AbortController`.
4. El estado pasa a `loading` para la sede solicitada.
5. El cliente solicita la ruta HTTP y valida el JSON con Zod.
6. Una lista vacía produce `empty`; una lista con elementos produce `success`.
7. Un fallo produce un mensaje público y un estado `error`.
8. Si cambia `siteId`, React ejecuta el cleanup anterior antes del nuevo Effect.
9. El cleanup marca el intento como inactivo y aborta la solicitud.
10. Si el cliente no respeta la cancelación, la bandera `active` todavía impide aplicar un resultado obsoleto.
11. `retry` incrementa `requestVersion`; esa dependencia reinicia la sincronización.
12. Si la prop cambia antes de que el Effect nuevo actualice el estado, la comparación con `stored.siteId` evita mostrar hallazgos de la sede anterior.

La lista de dependencias no es una selección manual. `client`, `requestVersion` y `siteId` son valores reactivos leídos por el Effect y deben estar incluidos.

---

## 19. Por qué inyectar el cliente y no el Hook

Inyectar una función normal permite controlar la frontera sin convertir los Hooks en valores dinámicos:

~~~tsx
const result = useFindingsBySite({
  siteId,
  client: testClient,
});
~~~

Evita pasar un Hook como prop:

~~~tsx
// Evitar: los Hooks no deben circular como estrategias dinámicas.
<FindingsPanel useQuery={useFindingsBySite} />
~~~

React debe poder reconocer las llamadas a Hooks de forma estática y local. Inyecta clientes, adaptadores o funciones puras; llama el Hook concreto directamente dentro del componente.

También evita crear un cliente inline en cada render:

~~~tsx
// Problemático: la función cambia de identidad en cada render.
useFindingsBySite({
  siteId,
  client: async (id, options) =>
    fetchFindingsBySite(id, options),
});
~~~

Esa identidad nueva vuelve a disparar el Effect. Usa una dependencia estable de módulo, una prop estable o una función memoizada cuando realmente sea necesario.

---

## 20. Componente consumidor exhaustivo

~~~tsx
import type { FindingsClient } from "./findingsClient";
import { useFindingsBySite } from "./useFindingsBySite";

type FindingsPanelProps = Readonly<{
  siteId: string;
  client?: FindingsClient | undefined;
}>;

function assertNever(value: never): never {
  throw new Error(`Estado no contemplado: ${JSON.stringify(value)}`);
}

export function FindingsPanel({ siteId, client }: FindingsPanelProps) {
  const { state, retry } = useFindingsBySite({ siteId, client });

  switch (state.status) {
    case "loading":
      return <p role="status">Cargando hallazgos…</p>;

    case "empty":
      return <p>No hay hallazgos registrados en esta sede.</p>;

    case "error":
      return (
        <section role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={retry}>
            Reintentar
          </button>
        </section>
      );

    case "success":
      return (
        <ul aria-label="Hallazgos">
          {state.findings.map((finding) => (
            <li key={finding.id}>
              <strong>{finding.title}</strong> — {finding.severity}
            </li>
          ))}
        </ul>
      );

    default:
      return assertNever(state);
  }
}
~~~

El componente decide la presentación. El Hook decide cómo obtener y representar el estado de la consulta. El cliente decide cómo hablar HTTP y validar la respuesta.

---

## 21. La separación de responsabilidades

| Pieza | Responsabilidad | No debería |
|---|---|---|
| `FindingsPanel` | renderizar cada estado y capturar interacción | conocer `AbortController` o Zod |
| `useFindingsBySite` | coordinar ciclo React, transiciones, cancelación y reintento | construir SQL o devolver JSX |
| `fetchFindingsBySite` | ejecutar HTTP y validar JSON | controlar estado React |
| Router/Controller | recibir la solicitud y coordinar respuesta | contener detalles visuales |
| Service | aplicar casos de uso y reglas de negocio | depender de React |
| Repository | traducir operaciones de persistencia | confiar en datos externos sin contrato |
| PostgreSQL | persistir registros y aplicar restricciones | conocer componentes o Hooks |

La extracción útil crea límites. Si el Hook acumula renderizado, SQL, mensajes técnicos y lógica de autorización, no simplifica el sistema: solo esconde el acoplamiento.

---

## 22. Custom Hook no significa estado global

~~~tsx
export function SiteSummary() {
  const query = useFindingsBySite({ siteId: "site-demo-north" });
  // Instancia A.
  return <Summary state={query.state} />;
}

export function SiteDetails() {
  const query = useFindingsBySite({ siteId: "site-demo-north" });
  // Instancia B: estado y Effect independientes.
  return <Details state={query.state} />;
}
~~~

Aunque ambas llamadas reciben el mismo identificador, cada una crea su propio estado y puede iniciar su propia solicitud.

Si varias vistas deben compartir una sola caché o una sola solicitud, hace falta una solución adicional: elevar el estado, usar contexto, una caché externa o una herramienta de consulta. El Custom Hook puede encapsular esa solución, pero no la crea automáticamente.

---

## 23. Hooks específicos frente a Hooks genéricos

Un Hook genérico como `useAsync` parece atractivo, pero puede borrar reglas importantes:

~~~ts
// Demasiado genérico para expresar cancelación, claves y estados de dominio.
function useAsync<T>(operation: () => Promise<T>) {
  // ...
}
~~~

Preguntas que quedan ocultas:

- ¿qué identifica una solicitud?
- ¿cómo se cancela?
- ¿qué significa una respuesta vacía?
- ¿se valida el resultado?
- ¿cuándo se reintenta?
- ¿qué mensaje se presenta?

`useFindingsBySite` tiene un contrato más estrecho y más fácil de entender. Empieza con una abstracción del dominio. Generaliza solo cuando varios casos demuestren una estructura realmente común.

---

## 24. Cuándo utilizar un Custom Hook

Úsalo cuando quieras:

- compartir lógica con estado entre componentes;
- encapsular una suscripción con cleanup;
- convertir una API de bajo nivel en una capacidad declarativa;
- centralizar una transición de estados;
- nombrar una conducta importante del dominio;
- aislar la coordinación entre varios Hooks;
- inyectar dependencias normales para facilitar pruebas;
- preparar una frontera que después pueda cambiar de implementación.

Ejemplos razonables para SiteOps Tracker:

- `useFindingsBySite`;
- `useSiteActivity`;
- `useAssetFilters`;
- `useOnlineStatus`;
- `useDocumentTitle`;
- `useUnsavedChangesWarning`.

Cada nombre debe revelar qué obtiene, sincroniza o controla.

---

## 25. Cuándo evitarlo

Evítalo cuando:

- una función pura resuelve el problema;
- la lógica es mínima y no mejora el vocabulario;
- no puedes explicar una sola responsabilidad;
- el Hook solo reexporta otro Hook sin añadir un contrato útil;
- la abstracción obliga a decenas de banderas opcionales;
- oculta efectos destructivos tras un nombre inocente;
- intentas saltarte las Rules of Hooks;
- buscas compartir estado sin diseñar dónde vive.

No conviertas esto:

~~~ts
const visibleFindings = findings.filter((finding) => finding.status !== "resolved");
~~~

en un Hook solo porque se usa en React. Es una transformación pura. Extrae `filterVisibleFindings` si requiere reutilización y pruébala sin un entorno React.

---

## 26. Errores comunes y sus causas

### Error 1: creer que todas las llamadas comparten estado

Cada llamada tiene estado independiente. Para compartir una instancia, diseña un propietario común o una caché compartida.

### Error 2: llamar el Hook condicionalmente

Rompe el orden que React usa para asociar estados. Llama el Hook siempre y pasa una opción `enabled` si la sincronización debe ser condicional.

### Error 3: crear el Hook dentro de un componente

Una definición nueva en cada render perjudica el razonamiento estático. Define componentes y Hooks a nivel de módulo.

### Error 4: pasar Hooks como props

Los Hooks no son estrategias dinámicas. Inyecta funciones normales o datos.

### Error 5: omitir dependencias en un Effect interno

Mover el Effect no elimina sus valores reactivos. Atiende `exhaustive-deps`; no silencies la regla.

### Error 6: aceptar una función inline inestable

Si el Hook la usa como dependencia, su identidad nueva puede reiniciar la sincronización en cada render.

### Error 7: devolver demasiados setters

Expone la máquina interna y permite estados imposibles. Devuelve acciones con intención.

### Error 8: usar `as` para confiar en HTTP

Una aserción solo afecta al compilador. Valida `unknown` con Zod en la frontera.

### Error 9: mezclar presentación en el Hook

Un Hook devuelve estado y capacidades; el componente devuelve JSX.

### Error 10: crear un Hook excesivamente genérico demasiado pronto

La generalización anticipada acumula opciones y pierde semántica del dominio.

### Error 11: capturar datos obsoletos

Una dependencia ausente puede hacer que una función o Effect vea valores de un render anterior.

### Error 12: olvidar cleanup al extraer

La extracción debe conservar exactamente la liberación de listeners, timers, conexiones y solicitudes.

### Error 13: memoizar todo por costumbre

`useCallback` y `useMemo` no vuelven correcto un contrato. Úsalos cuando la identidad tenga una razón observable, como una dependencia o un consumidor memoizado.

### Error 14: depender del objeto completo devuelto

El objeto `{ state, retry }` puede tener identidad nueva en cada render. Consume sus campos; no lo agregues completo a otro Effect sin una razón.

### Error 15: revelar errores internos

No presentes SQL, rutas internas, trazas ni detalles sensibles. Registra detalles en el backend y devuelve mensajes seguros al usuario.

---

## 27. Contratos estables y memoización consciente

En el ejemplo, `retry` usa `useCallback` porque representa una acción estable que podría pasar a un hijo memoizado o usarse como dependencia.

~~~tsx
const retry = useCallback(() => {
  setRequestVersion((current) => current + 1);
}, []);
~~~

La actualización funcional evita depender del valor actual de `requestVersion`.

No es obligatorio memoizar el objeto completo:

~~~tsx
return { state, retry };
~~~

Crear un objeto pequeño en cada render es normal. Memoizarlo solo es útil si un consumidor depende de su identidad y has medido o demostrado esa necesidad.

La estabilidad no significa “ninguna identidad cambia”. Significa que el contrato deja claro qué valores representan estado actual y qué funciones tienen identidad intencionalmente estable.

---

## 28. ESLint, TypeScript y reglas de calidad

TypeScript comprueba las entradas, salidas y estados del Hook. ESLint cubre categorías distintas:

- `rules-of-hooks`: evita llamadas condicionales o en lugares no válidos;
- `exhaustive-deps`: comprueba dependencias reactivas;
- reglas de pureza e inmutabilidad: detectan mutaciones y trabajo impuro durante render;
- `typescript-eslint`: evita `any`, promesas ignoradas y manejo inseguro de errores.

Un conjunto razonable de controles incluye:

~~~json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "test": "vitest run",
    "build": "vite build"
  }
}
~~~

No desactives una regla para hacer desaparecer el aviso. Pregunta qué dependencia, mutación o promesa está revelando.

---

## 29. Estrategia de pruebas

Hay dos niveles útiles:

1. **Componente consumidor:** suele ser la opción preferida en una aplicación porque prueba la conducta visible.
2. **Hook aislado con `renderHook`:** útil para un Hook reutilizable con transiciones o cleanup difíciles de observar desde una sola vista.

Prueba resultados y contratos, no variables internas:

- muestra carga inicialmente;
- llega a éxito o vacío;
- presenta un error seguro;
- reintenta al solicitarlo;
- cancela al cambiar la sede;
- cancela al desmontar;
- ignora respuestas obsoletas.

No pruebes que “se llamó `setState`”. Eso es una implementación, no una conducta útil.

---

## 30. Prueba de éxito con `renderHook`

~~~tsx
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Finding } from "./findingSchema";
import type { FindingsClient } from "./findingsClient";
import { useFindingsBySite } from "./useFindingsBySite";

const finding: Finding = {
  id: "finding-demo-001",
  title: "Etiqueta de activo pendiente",
  severity: "medium",
  status: "open",
  createdAt: "2026-10-19T12:00:00.000Z",
};

describe("useFindingsBySite", () => {
  it("transita de carga a éxito", async () => {
    const client: FindingsClient = vi.fn(async () => [finding]);

    const { result } = renderHook(() =>
      useFindingsBySite({
        siteId: "site-demo-north",
        client,
      }),
    );

    expect(result.current.state.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    const state = result.current.state;

    if (state.status !== "success") {
      throw new Error("Se esperaba el estado success");
    }

    expect(state.findings).toEqual([finding]);
    expect(client).toHaveBeenCalledOnce();
    expect(client).toHaveBeenCalledWith(
      "site-demo-north",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
~~~

El `if` permite a TypeScript estrechar la unión. Una aserción de Vitest no siempre conserva el narrowing en la siguiente instrucción.

---

## 31. Prueba de cleanup al cambiar entradas y desmontar

~~~tsx
import { renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Finding } from "./findingSchema";
import type { FindingsClient } from "./findingsClient";
import { useFindingsBySite } from "./useFindingsBySite";

it("aborta el intento anterior y el intento activo al desmontar", () => {
  const signals: AbortSignal[] = [];

  const implementation: FindingsClient = (_siteId, { signal }) => {
    signals.push(signal);

    return new Promise<readonly Finding[]>(() => {
      // Permanece pendiente para poder observar la cancelación.
    });
  };
  const client: FindingsClient = vi.fn(implementation);

  const { rerender, unmount } = renderHook(
    ({ siteId }: Readonly<{ siteId: string }>) =>
      useFindingsBySite({ siteId, client }),
    {
      initialProps: { siteId: "site-demo-north" },
    },
  );

  expect(signals).toHaveLength(1);
  expect(signals[0]?.aborted).toBe(false);

  rerender({ siteId: "site-demo-south" });

  expect(signals).toHaveLength(2);
  expect(signals[0]?.aborted).toBe(true);
  expect(signals[1]?.aborted).toBe(false);

  unmount();

  expect(signals[1]?.aborted).toBe(true);
});
~~~

Esta prueba observa el contrato de limpieza. No depende de una variable privada del Hook.

---

## 32. Prueba de reintento

~~~tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Finding } from "./findingSchema";
import type { FindingsClient } from "./findingsClient";
import { useFindingsBySite } from "./useFindingsBySite";

it("vuelve a solicitar datos después de retry", async () => {
  const findings: readonly Finding[] = [
    {
      id: "finding-demo-002",
      title: "Revisión de respaldo programada",
      severity: "low",
      status: "in_progress",
      createdAt: "2026-10-19T13:00:00.000Z",
    },
  ];

  let attempt = 0;

  const client: FindingsClient = vi.fn(async () => {
    attempt += 1;

    if (attempt === 1) {
      throw new Error("Fallo de red simulado");
    }

    return findings;
  });

  const { result } = renderHook(() =>
    useFindingsBySite({
      siteId: "site-demo-west",
      client,
    }),
  );

  await waitFor(() => {
    expect(result.current.state.status).toBe("error");
  });

  act(() => {
    result.current.retry();
  });

  await waitFor(() => {
    expect(result.current.state.status).toBe("success");
  });

  expect(client).toHaveBeenCalledTimes(2);
});
~~~

La red real no participa. La prueba controla la dependencia y observa una transición pública.

---

## 33. Preferir una prueba del componente cuando comunica mejor

Para una aplicación, esta prueba puede ser más valiosa que una prueba aislada del Hook:

~~~tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FindingsPanel } from "./FindingsPanel";
import type { Finding } from "./findingSchema";
import type { FindingsClient } from "./findingsClient";

describe("FindingsPanel", () => {
  it("muestra un estado de carga accesible", () => {
    const client: FindingsClient = () =>
      new Promise<readonly Finding[]>(() => {
        // Mantiene la consulta pendiente para observar loading.
      });

    render(
      <FindingsPanel
        siteId="site-demo-north"
        client={client}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Cargando hallazgos",
    );
  });
});
~~~

En una prueba completa conviene interceptar HTTP en el nivel adecuado y verificar la interfaz. `renderHook` es una herramienta, no el objetivo. Si una prueba con un componente pequeño expresa mejor la experiencia, prefiérela.

---

## 34. Relación explícita con la arquitectura Full Stack

El recorrido de una consulta es:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

Relación de cada capa con el tema:

1. **React:** el componente consume un contrato declarativo y renderiza estados exhaustivos.
2. **Custom Hook:** coordina estado, Effect, cancelación y reintento dentro del ciclo de React.
3. **HTTP:** transporta una solicitud y una respuesta; puede fallar, demorarse o devolver contenido inválido.
4. **Node.js:** ejecuta la aplicación backend y recibe la solicitud.
5. **Router:** relaciona método y ruta con un controlador.
6. **Controller:** traduce HTTP a una llamada del caso de uso y construye la respuesta.
7. **Runtime Validation:** valida parámetros, body y datos no confiables; los tipos TypeScript ya no existen en ejecución.
8. **Service:** aplica reglas del caso de uso sin depender de React ni de Express.
9. **Repository:** ofrece operaciones de persistencia mediante un contrato.
10. **PostgreSQL:** almacena sedes, activos y hallazgos con restricciones reales.
11. **Testing:** comprueba el Hook, la interfaz, el backend y sus integraciones en distintos niveles.
12. **Docker:** reproduce dependencias como Node y PostgreSQL en entornos consistentes.
13. **CI/CD:** ejecuta typecheck, lint, pruebas y build antes de entregar cambios.
14. **Cloud:** hospeda frontend, API, base de datos, secretos, métricas y logs.

El Custom Hook no reemplaza ninguna capa. Reduce el acoplamiento entre la vista React y el mecanismo de consulta.

---

## 35. Validación en ambos extremos

El backend debe validar entradas HTTP aunque el frontend esté tipado. El frontend debe validar respuestas aunque el backend también use TypeScript.

Razones:

- pueden desplegarse versiones distintas;
- un proxy o servicio externo puede cambiar datos;
- la base de datos puede contener registros heredados;
- una petición puede venir de un cliente distinto;
- JavaScript ejecutado no conserva interfaces TypeScript;
- la red no garantiza la forma del JSON.

La defensa por capas no duplica inútilmente el tipado. Cada validación protege una frontera runtime diferente.

---

## 36. Relación con las piezas del portafolio

### SiteOps Tracker

`useFindingsBySite`, `useSiteActivity` y `useAssetFilters` convierten conductas de la aplicación en contratos React legibles y comprobables.

### SDK tipado para una API

El SDK implementa clientes como `fetchFindingsBySite`, valida JSON y expone datos confiables al Hook. Sus tipos mejoran la experiencia de desarrollo; sus esquemas protegen runtime.

### API REST Node.js + TypeScript + PostgreSQL

El Hook consume endpoints, pero la autorización, las reglas y la persistencia permanecen en backend. El cliente no se convierte en autoridad por ocultar lógica dentro de un Hook.

### Analizador de configuraciones

El parseo de archivos y variables de entorno debe vivir en funciones o servicios independientes con validación. Un Hook puede presentar el resultado en React, no reemplazar el analizador.

### Repositorio de algoritmos TypeScript

Ordenamiento, búsqueda, agrupación y cálculo deben seguir como funciones puras. No conviertas algoritmos en Hooks si no dependen del ciclo de React.

### Aplicación Full Stack

Los Hooks actúan como adaptadores de experiencia: traducen datos y eventos en estados que los componentes pueden representar sin conocer detalles de red.

---

## 37. Ejercicio práctico — Extraer `useSiteActivity`

En la lección anterior preparaste una suscripción ficticia a eventos de una sede. Ahora extrae esa conducta a un Custom Hook.

No se incluye la solución completa. El objetivo es que diseñes el contrato y conserves correctamente setup, validación y cleanup.

### Contratos iniciales

~~~tsx
import { z } from "zod";

export const siteActivitySchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  kind: z.enum([
    "asset_registered",
    "finding_created",
    "corrective_action_updated",
  ]),
  occurredAt: z.string().datetime({ offset: true }),
});

export type SiteActivity = Readonly<
  z.infer<typeof siteActivitySchema>
>;

export type ActivityConnection = Readonly<{
  close: () => void;
}>;

export type ConnectToSiteActivity = (
  siteId: string,
  handlers: Readonly<{
    onMessage: (payload: unknown) => void;
    onError: () => void;
  }>,
) => ActivityConnection;

export type SiteActivityState =
  | Readonly<{ status: "connecting" }>
  | Readonly<{ status: "connected"; events: readonly SiteActivity[] }>
  | Readonly<{ status: "error"; message: string }>;
~~~

### Punto de partida

~~~tsx
import { useEffect, useState } from "react";
import {
  siteActivitySchema,
  type ConnectToSiteActivity,
  type SiteActivityState,
} from "./siteActivityContracts";

type UseSiteActivityOptions = Readonly<{
  siteId: string;
  connect: ConnectToSiteActivity;
}>;

type UseSiteActivityResult = Readonly<{
  state: SiteActivityState;
  clear: () => void;
}>;

export function useSiteActivity(
  options: UseSiteActivityOptions,
): UseSiteActivityResult {
  // TODO: implementa el Hook sin mover JSX a esta función.
  // TODO: considera identidad, dependencias y cleanup.
  throw new Error("Ejercicio pendiente");
}
~~~

### Requisitos

1. Llama `useState` y `useEffect` siempre en el nivel superior.
2. Inicia en `connecting`.
3. Abre una conexión para `siteId` después del commit.
4. Trata cada mensaje como `unknown`.
5. Usa `siteActivitySchema.safeParse` antes de agregar un evento.
6. Ignora mensajes inválidos sin convertirlos mediante `as`.
7. Evita actualizar estado desde una conexión obsoleta.
8. Cierra la conexión anterior cuando cambia `siteId`.
9. Cierra la conexión al desmontar.
10. Conserva los eventos como datos inmutables.
11. Implementa `clear` como una acción con intención.
12. Devuelve exactamente `{ state, clear }`.
13. Escribe una prueba de conexión, una de mensaje inválido y una de cleanup.
14. No uses `any`.

---

## 38. Pistas para el ejercicio

1. Desestructura `siteId` y `connect` al inicio del Hook.
2. En el Effect crea `let active = true`.
3. En `onMessage`, retorna de inmediato si `active` es `false`.
4. Guarda el resultado de `siteActivitySchema.safeParse(payload)`.
5. La propiedad `success` permite estrechar la unión del resultado.
6. Usa una actualización funcional para agregar el evento anterior.
7. El callback de cleanup debe hacer dos cosas: desactivar y cerrar.
8. Las dependencias probables son `connect` y `siteId`.
9. `clear` puede usar `useCallback`, pero no necesita conocer el array actual.
10. En la prueba, usa un `connect` falso que capture `handlers` y una función `close` creada con `vi.fn()`.

No copies el ejemplo de consulta sin pensar: una suscripción permanece abierta y recibe múltiples mensajes; una solicitud normalmente produce un resultado.

---

## 39. Reto adicional — `useAssetsQuery` de extremo a extremo

Diseña un Hook más exigente para buscar activos ficticios por sede, estado y texto.

### React

- Define `useAssetsQuery({ siteId, status, search, client })`.
- Modela `idle`, `loading`, `empty`, `success` y `error`.
- No solicites datos cuando `siteId` esté vacío.
- Cancela la consulta anterior al cambiar filtros.
- No muestres resultados pertenecientes a filtros anteriores.
- Devuelve `state`, `retry` y una clave descriptiva de la consulta.

### SDK y HTTP

- Construye `URLSearchParams` sin concatenar valores sin escapar.
- Recibe `AbortSignal`.
- Trata `response.json()` como `unknown`.
- Valida una respuesta paginada mediante Zod.
- Distingue error HTTP de respuesta inválida sin mostrar detalles internos.

### Node.js

- Define `GET /api/sites/:siteId/assets`.
- Valida `siteId`, `status`, `search`, `limit` y `cursor` en runtime.
- Mantén Router, Controller, Service y Repository separados.
- Devuelve códigos HTTP y mensajes públicos coherentes.

### PostgreSQL

- Usa parámetros preparados, nunca interpolación SQL.
- Aplica filtros permitidos y un orden estable.
- Diseña paginación consistente.
- Mapea filas a un contrato de salida validado.

### Testing

- Prueba el Hook con cambios rápidos de filtros.
- Prueba el componente desde la perspectiva del usuario.
- Prueba el endpoint con una integración real de PostgreSQL aislada.
- Añade una prueba E2E para seleccionar sede, filtrar y abrir un activo.

### Docker, CI/CD y Cloud

- Levanta API y PostgreSQL con Docker Compose para integración.
- Ejecuta typecheck, ESLint, pruebas y build en GitHub Actions.
- No incorpores secretos en la imagen ni en el frontend.
- Configura variables de entorno por entorno y valídalas al iniciar Node.
- Envía logs estructurados al backend; no expongas datos sensibles en mensajes UI.

El reto debe demostrar que un Custom Hook mejora el límite de React, pero no absorbe responsabilidades de las demás capas.

---

## 40. Preguntas de comprensión

1. ¿Qué comparte un Custom Hook y qué no comparte automáticamente?
2. ¿Por qué el nombre debe comenzar con `use`?
3. ¿Dónde pueden llamarse Hooks dentro de un Hook propio?
4. ¿Cuándo conviene usar un objeto de opciones?
5. ¿Qué ventaja ofrece un objeto de retorno frente a una tupla grande?
6. ¿Por qué `useFindingsBySite` devuelve una unión discriminada?
7. ¿Qué problema evita guardar `siteId` junto al resultado interno?
8. ¿Por qué `client` aparece en las dependencias del Effect?
9. ¿Qué ocurre si el consumidor crea `client` inline en cada render?
10. ¿Por qué se usan `AbortController` y una bandera `active`?
11. ¿Por qué `as Finding[]` no valida una respuesta HTTP?
12. ¿Dónde se valida el JSON y por qué?
13. ¿Por qué inyectar un cliente es preferible a pasar un Hook como prop?
14. ¿Cuándo probarías un componente en lugar del Hook aislado?
15. ¿Por qué una función de ordenamiento no debe ser un Hook?

---

## 41. Relevancia para entrevistas técnicas

### “¿Qué es un Custom Hook?”

Es una función cuyo nombre comienza con `use`, puede componer otros Hooks y encapsula lógica React reutilizable. Comparte lógica, no una instancia de estado.

### “¿Cuándo extraerías un Hook?”

Cuando existe una responsabilidad nombrable con estado, Effects o coordinación reutilizable; también cuando la extracción mejora claridad, pruebas o cleanup aunque todavía tenga un consumidor.

### “¿Cada consumidor comparte el mismo estado?”

No. Cada llamada tiene estado independiente. Para compartir estado se diseña un propietario o almacenamiento común.

### “¿Qué reglas debe respetar?”

Debe llamar Hooks solo en el nivel superior y únicamente desde componentes u otros Hooks. El orden debe ser igual en cada render.

### “¿Cómo diseñarías su API con TypeScript?”

Usaría entradas explícitas, un objeto de opciones si el contrato puede crecer, una unión discriminada para estados válidos y acciones con intención en lugar de setters internos.

### “¿Cómo probarías un Hook que consulta una API?”

Inyectaría un cliente normal, probaría transiciones observables y cleanup, y usaría `renderHook` solo cuando añada claridad. También probaría el componente consumidor para verificar la experiencia visible.

### “¿TypeScript valida la respuesta de la API?”

No. Los tipos desaparecen en runtime. El JSON es `unknown` hasta validarlo con un esquema u otra comprobación real.

### “¿Por qué no crear un `useAsync<T>` para todo?”

Una abstracción demasiado genérica puede ocultar claves, cancelación, semántica de vacío, validación y reglas específicas. Conviene empezar con un contrato de dominio y generalizar con evidencia.

---

## 42. Lista de verificación profesional

Antes de aceptar un Custom Hook, comprueba:

- [ ] Su nombre comienza con `use` y expresa intención.
- [ ] Tiene una responsabilidad delimitada.
- [ ] Se define a nivel de módulo.
- [ ] Llama Hooks siempre en el nivel superior.
- [ ] No contiene JSX.
- [ ] Sus entradas están tipadas y se tratan como inmutables.
- [ ] Su salida tiene un contrato pequeño y explícito.
- [ ] No expone setters sin necesidad.
- [ ] Sus estados imposibles no son representables.
- [ ] Sus Effects sincronizan un sistema externo real.
- [ ] Todas las dependencias reactivas están declaradas.
- [ ] Setup y cleanup son simétricos.
- [ ] Las funciones inyectadas tienen identidad estable.
- [ ] Cancela o ignora trabajo obsoleto.
- [ ] Los datos externos entran como `unknown`.
- [ ] La validación runtime ocurre antes del uso.
- [ ] Los mensajes públicos no revelan detalles internos.
- [ ] Las pruebas observan conducta y cleanup.
- [ ] Una función pura no fue convertida innecesariamente en Hook.
- [ ] Typecheck, lint, tests y build pasan en CI.

---

## 43. Resumen

- Un Custom Hook extrae lógica React reutilizable detrás de una función con nombre `use`.
- Comparte comportamiento, no una instancia de estado.
- Cada llamada conserva su propio estado y ciclo de Effects.
- Las Rules of Hooks siguen aplicando dentro del Hook.
- Un objeto de opciones facilita contratos que evolucionan.
- Un objeto de retorno expresa mejor contratos con varias propiedades.
- Las uniones discriminadas impiden combinaciones de estado imposibles.
- Un Hook debe devolver datos y acciones, no JSX.
- Inyectar funciones normales facilita pruebas sin pasar Hooks dinámicamente.
- Un cliente estable evita reinicios accidentales del Effect.
- Cleanup y dependencias deben conservarse al extraer lógica.
- TypeScript no valida HTTP, formularios, archivos, variables de entorno ni filas de base de datos.
- Zod convierte `unknown` en datos runtime validados.
- `renderHook` sirve para contratos aislados; una prueba del componente suele comunicar mejor la experiencia.
- Un buen Hook refuerza el límite React → HTTP sin absorber Controller, Service, Repository o PostgreSQL.
- Las funciones puras del analizador o del repositorio de algoritmos deben seguir siendo funciones normales.

---

## Referencias oficiales

- [React: Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [React: Rules of React](https://react.dev/reference/rules)
- [React: Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React: `useDebugValue`](https://react.dev/reference/react/useDebugValue)
- [React: eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks)
- [Testing Library: React Testing Library API (`renderHook`)](https://testing-library.com/docs/react-testing-library/api)
- [Vitest: Mock Functions](https://vitest.dev/guide/mocking/functions)
- [Zod: Basic usage](https://zod.dev/basics)
- [MDN: AbortController](https://developer.mozilla.org/docs/Web/API/AbortController)

Referencias consultadas el **19 de octubre de 2026**.

---

# Próxima lección

**Lección 42 — `useRef` con TypeScript: referencias al DOM, valores mutables persistentes y uso seguro.**
