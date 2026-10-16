# Lección 39 — Renderizado condicional con TypeScript: estados de UI exhaustivos y componentes predecibles

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — estados visuales, narrowing y exhaustividad  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## 1. Introducción

En la lección anterior renderizaste colecciones tipadas y aprendiste a conservar la identidad de cada elemento mediante `key`. Sin embargo, una pantalla real no siempre tiene una lista lista para mostrar.

La interfaz de SiteOps Tracker puede estar:

- esperando que el usuario inicie una consulta;
- cargando hallazgos;
- mostrando resultados;
- informando que no existen resultados;
- mostrando un error recuperable;
- ocultando una acción que el usuario no puede ejecutar.

El renderizado condicional transforma ese estado actual en JSX. React no necesita una sintaxis especial: utiliza condiciones normales de JavaScript como `if`, el operador ternario y `&&`.

El reto profesional no consiste solo en escribir una condición. Consiste en modelar estados que no se contradigan, renderizar todos los casos posibles y hacer que TypeScript avise cuando una nueva variante todavía no tiene interfaz.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. elegir entre retornos tempranos, ternarios, `&&` y `null`;
2. explicar qué problema resuelve el renderizado condicional en React;
3. evitar estados booleanos que permiten combinaciones imposibles;
4. representar estados de UI con uniones discriminadas;
5. aprovechar el narrowing de TypeScript dentro de cada rama;
6. comprobar exhaustividad con `never`;
7. distinguir estado vacío, carga, éxito y error;
8. validar datos HTTP en runtime antes de construir un estado de éxito;
9. probar cada salida visible con Vitest y Testing Library;
10. conectar las decisiones de UI con HTTP, Node.js, Services, Repositories y PostgreSQL.

---

## 3. El problema que resuelve el renderizado condicional

Una primera implementación suele acumular variables independientes:

~~~tsx
const [isLoading, setIsLoading] = useState(false);
const [hasError, setHasError] = useState(false);
const [findings, setFindings] = useState<readonly Finding[]>([]);
~~~

Cada variable parece razonable, pero juntas permiten combinaciones confusas:

| `isLoading` | `hasError` | `findings.length` | Pregunta abierta |
|---|---|---:|---|
| `true` | `true` | 0 | ¿Se muestra carga o error? |
| `true` | `false` | 4 | ¿Se ocultan los datos mientras carga? |
| `false` | `true` | 4 | ¿Son datos válidos, antiguos o parciales? |
| `false` | `false` | 0 | ¿Aún no se consultó o la respuesta está vacía? |

Tres valores independientes producen más combinaciones de las que el diseño necesita. Algunas son imposibles desde el punto de vista del producto, pero TypeScript no lo sabe.

El problema tiene dos partes:

1. **Modelado:** representar solamente estados válidos.
2. **Renderizado:** producir la interfaz correcta para cada estado válido.

Una unión discriminada resuelve el modelado y una condición exhaustiva resuelve el renderizado.

---

## 4. Funcionamiento del renderizado condicional, paso a paso

React ejecuta el componente para obtener una descripción del árbol que debe mostrar.

~~~tsx
type ConnectionBadgeProps = Readonly<{
  isOnline: boolean;
}>;

export function ConnectionBadge({ isOnline }: ConnectionBadgeProps) {
  if (isOnline) {
    return <span>API disponible</span>;
  }

  return <span>API no disponible</span>;
}
~~~

El proceso conceptual es:

1. React llama a `ConnectionBadge` con sus props actuales.
2. JavaScript evalúa `isOnline`.
3. Solo una rama produce el JSX retornado.
4. React compara ese resultado con el render anterior.
5. React actualiza el DOM cuando sea necesario.

El JSX no ejecutado no forma parte del resultado de esa renderización.

El render debe seguir siendo puro: decide qué mostrar a partir de props y estado, pero no debe iniciar solicitudes, mutar datos ni llamar a un setter durante la renderización.

---

## 5. Razón de existir

Una interfaz declarativa describe **qué debe verse para el estado actual**.

Por ejemplo:

- si la solicitud está cargando, muestra progreso;
- si falló, muestra un error seguro y una opción para reintentar;
- si terminó sin filas, muestra un estado vacío;
- si terminó con filas, muestra la lista.

El renderizado condicional es el puente entre el modelo de estado y el árbol de UI. Existe porque la misma pantalla debe describir varias salidas posibles sin manipular el DOM de manera imperativa.

TypeScript agrega otra garantía: si el estado es una unión discriminada, cada condición reduce el tipo a la variante correspondiente. Así, `items` solo existe cuando el estado realmente representa éxito.

---

## 6. Retornos tempranos con `if`

Los retornos tempranos son apropiados cuando una condición reemplaza una sección completa de la pantalla.

~~~tsx
type Asset = Readonly<{
  id: string;
  label: string;
  status: "active" | "maintenance" | "retired";
}>;

type AssetSummaryProps = Readonly<{
  asset: Asset | null;
  isLoading: boolean;
}>;

export function AssetSummary({
  asset,
  isLoading,
}: AssetSummaryProps) {
  if (isLoading) {
    return <p role="status">Cargando activo…</p>;
  }

  if (asset === null) {
    return <p>No se encontró el activo.</p>;
  }

  return (
    <article>
      <h2>{asset.label}</h2>
      <p>Estado: {asset.status}</p>
    </article>
  );
}
~~~

Después de comprobar `asset === null`, TypeScript sabe que `asset` es `Asset` en la última rama.

Los retornos tempranos reducen anidación y hacen visibles primero los casos excepcionales. Sin embargo, dos props independientes todavía pueden contradecirse. Más adelante las reemplazaremos por una sola unión.

---

## 7. Operador ternario para elegir entre dos salidas

El ternario es útil para una decisión breve con dos resultados.

~~~tsx
type FindingStatusBadgeProps = Readonly<{
  isResolved: boolean;
}>;

export function FindingStatusBadge({
  isResolved,
}: FindingStatusBadgeProps) {
  return (
    <span>
      {isResolved ? "Hallazgo resuelto" : "Hallazgo pendiente"}
    </span>
  );
}
~~~

También puede seleccionar componentes:

~~~tsx
type FindingToolbarProps = Readonly<{
  canEdit: boolean;
}>;

export function FindingToolbar({ canEdit }: FindingToolbarProps) {
  return canEdit
    ? <button type="button">Editar hallazgo</button>
    : <p>Acceso de solo lectura</p>;
}
~~~

Evita ternarios anidados con varias decisiones. Cuando la expresión necesita releerse para entenderse, usa `if`, un `switch`, una variable con nombre o componentes separados.

~~~tsx
// Difícil de mantener.
return isLoading
  ? <Loading />
  : error
    ? <ErrorMessage />
    : data
      ? <Results />
      : <Empty />;
~~~

---

## 8. Operador `&&` para incluir o excluir un fragmento

`&&` funciona bien cuando se quiere mostrar algo o no mostrar nada.

~~~tsx
type FindingActionsProps = Readonly<{
  canResolve: boolean;
  findingId: string;
}>;

export function FindingActions({
  canResolve,
  findingId,
}: FindingActionsProps) {
  return (
    <div>
      <a href={`/findings/${findingId}`}>Ver detalle</a>
      {canResolve && (
        <button type="button">Marcar como resuelto</button>
      )}
    </div>
  );
}
~~~

La parte izquierda debe expresar un booleano claro. Hay una trampa frecuente con números:

~~~tsx
// Si length es 0, React puede renderizar el número 0.
{findings.length && <FindingsList findings={findings} />}

// La condición ahora es boolean.
{findings.length > 0 && (
  <FindingsList findings={findings} />
)}
~~~

No uses `&&` cuando necesitas una alternativa visible. Para “A o B”, un ternario o un `if` comunica mejor la intención.

---

## 9. Retornar `null`

Un componente puede retornar `null` para no aportar nodos al árbol.

~~~tsx
type PermissionNoticeProps = Readonly<{
  message: string | null;
}>;

export function PermissionNotice({
  message,
}: PermissionNoticeProps) {
  if (message === null) {
    return null;
  }

  return <p role="status">{message}</p>;
}
~~~

Retornar `null` no significa que el componente no se haya ejecutado. Significa que el resultado visual de esa ejecución no contiene nodos.

Úsalo para contenido realmente opcional. No ocultes silenciosamente errores, estados de carga o falta de permisos que el usuario necesita comprender.

---

## 10. Guía para elegir la sintaxis

| Necesidad | Herramienta preferida |
|---|---|
| Reemplazar toda la salida | Retorno temprano con `if` |
| Elegir entre dos fragmentos breves | Ternario |
| Mostrar algo o nada | `&&` con condición booleana |
| Omitir por completo la salida de un componente | `return null` |
| Manejar varias variantes de una unión | `switch` exhaustivo |
| Reutilizar una rama compleja | Componente extraído |

No existe una única sintaxis correcta para todo. La prioridad es que el conjunto de estados posibles resulte evidente.

---

## 11. El problema de los “booleanos sueltos”

Considera este tipo:

~~~ts
type FragileUiState = {
  isLoading: boolean;
  hasError: boolean;
  findings: readonly Finding[];
};
~~~

El tipo acepta esto:

~~~ts
const impossibleState: FragileUiState = {
  isLoading: true,
  hasError: true,
  findings: [],
};
~~~

TypeScript no puede rechazarlo porque el contrato declara que cada campo es independiente.

Si el negocio dice que la pantalla está exactamente en un estado a la vez, el tipo debe expresar esa exclusividad.

---

## 12. Modelar estados válidos con una unión discriminada

Usaremos `status` como discriminante:

~~~ts
type SafeUiError = Readonly<{
  kind: "network" | "http" | "invalid_response";
  message: string;
}>;

type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

type FindingsUiState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{
      status: "success";
      items: NonEmptyReadonlyArray<Finding>;
    }>
  | Readonly<{
      status: "error";
      error: SafeUiError;
    }>;
~~~

Ahora cada variante contiene solamente la información que necesita:

- `idle` no finge que existe una respuesta;
- `loading` no contiene un error simultáneo;
- `empty` distingue una respuesta válida sin registros;
- `success` contiene al menos un hallazgo;
- `error` exige un error seguro para la UI.

Estas asignaciones fallan durante el typecheck:

~~~ts
// @ts-expect-error: loading no contiene items.
const invalidLoading: FindingsUiState = { status: "loading", items: [] };

// @ts-expect-error: success requiere al menos un elemento.
const invalidSuccess: FindingsUiState = { status: "success", items: [] };
~~~

`@ts-expect-error` se usa aquí como prueba didáctica de que el compilador debe rechazar esas líneas. No es una forma de silenciar errores inesperados en código de producción.

---

## 13. Narrowing dentro de cada rama

TypeScript reduce la unión cuando inspeccionas el discriminante:

~~~ts
function describeState(state: FindingsUiState): string {
  if (state.status === "success") {
    return `${state.items.length} hallazgo(s)`;
  }

  if (state.status === "error") {
    return state.error.message;
  }

  return `Estado: ${state.status}`;
}
~~~

`state.items` solo puede leerse en `success`. `state.error` solo puede leerse en `error`.

No son necesarias aserciones como `state.items!` ni comprobaciones dispersas. El tipo y las condiciones comparten el mismo vocabulario.

---

## 14. Renderizado exhaustivo con `never`

Una función auxiliar expresa que no debería quedar ninguna variante:

~~~ts
function assertNever(value: never): never {
  throw new Error(
    `Estado no manejado: ${JSON.stringify(value)}`,
  );
}
~~~

El componente atiende cada caso:

~~~tsx
type FindingsStateViewProps = Readonly<{
  state: FindingsUiState;
  onLoad: () => Promise<void>;
  onRetry: () => Promise<void>;
}>;

export function FindingsStateView({
  state,
  onLoad,
  onRetry,
}: FindingsStateViewProps) {
  switch (state.status) {
    case "idle":
      return (
        <button
          type="button"
          onClick={() => void onLoad()}
        >
          Cargar hallazgos
        </button>
      );

    case "loading":
      return <p role="status">Cargando hallazgos…</p>;

    case "empty":
      return (
        <section aria-labelledby="empty-title">
          <h2 id="empty-title">Sin hallazgos</h2>
          <p>La sede no tiene hallazgos registrados.</p>
          <button
            type="button"
            onClick={() => void onRetry()}
          >
            Consultar de nuevo
          </button>
        </section>
      );

    case "success":
      return <FindingsList findings={state.items} />;

    case "error":
      return (
        <section role="alert" aria-labelledby="error-title">
          <h2 id="error-title">No fue posible cargar</h2>
          <p>{state.error.message}</p>
          <button
            type="button"
            onClick={() => void onRetry()}
          >
            Reintentar
          </button>
        </section>
      );

    default:
      return assertNever(state);
  }
}
~~~

Después de eliminar `idle`, `loading`, `empty`, `success` y `error`, TypeScript concluye que `state` debe ser `never`.

Si agregas una variante y olvidas renderizarla, `assertNever(state)` deja de aceptar el argumento. El typecheck convierte una omisión visual en un error detectable antes de desplegar.

---

## 15. Cómo demuestra TypeScript la exhaustividad

Agreguemos un estado de actualización en segundo plano:

~~~ts
type FindingsUiStateWithRefresh =
  | FindingsUiState
  | Readonly<{
      status: "refreshing";
      items: NonEmptyReadonlyArray<Finding>;
    }>;
~~~

Si una función recibe `FindingsUiStateWithRefresh` pero conserva el `switch` anterior, el caso `default` ya no contiene `never`: contiene la variante `refreshing`.

La corrección no consiste en usar una aserción para callar al compilador. Debes decidir explícitamente qué experiencia tendrá el usuario mientras conserva datos anteriores y se solicita una versión nueva.

Esa presión del compilador es la razón práctica de la exhaustividad: cada cambio del modelo obliga a revisar sus consumidores.

---

## 16. Estado vacío no es lo mismo que estado inicial

Un array vacío puede significar varias cosas:

- la consulta todavía no se ejecutó;
- la respuesta fue válida y no contiene registros;
- los filtros no encontraron coincidencias;
- los datos se descartaron después de un error.

Representar todo como `[]` borra esa diferencia.

~~~ts
const initialState: FindingsUiState = { status: "idle" };
const validEmptyState: FindingsUiState = { status: "empty" };
~~~

La UI puede ofrecer acciones distintas:

- `idle`: “Cargar hallazgos”.
- `empty`: “Registrar hallazgo” o “Cambiar filtros”.

Modelar la intención produce componentes más predecibles que inferirla a partir de valores ambiguos.

---

## 17. No dupliques información derivada

Si el estado ya contiene `items`, no necesitas guardar otro booleano `hasFindings`.

~~~tsx
// Redundante: ambas piezas pueden quedar desincronizadas.
const [items, setItems] = useState<readonly Finding[]>([]);
const [hasFindings, setHasFindings] = useState(false);
~~~

Puedes derivarlo durante el render:

~~~ts
const hasFindings = items.length > 0;
~~~

Con la unión propuesta, ni siquiera necesitas esa derivación para el estado remoto: `success` ya comunica que existe una colección no vacía.

Guarda la fuente mínima de verdad. Calcula etiquetas, permisos visuales, conteos y visibilidad cuando puedan obtenerse de props o estado existente.

---

## 18. Extraer ramas complejas a componentes

Una condición no debe convertir un componente en una función enorme.

~~~tsx
function FindingsList({
  findings,
}: Readonly<{
  findings: NonEmptyReadonlyArray<Finding>;
}>) {
  return (
    <section aria-labelledby="findings-title">
      <h2 id="findings-title">Hallazgos</h2>
      <ul>
        {findings.map((finding) => (
          <li key={finding.id}>
            <strong>{finding.title}</strong>
            <span> — {finding.status}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
~~~

`FindingsStateView` decide **qué estado** mostrar. `FindingsList` decide **cómo mostrar resultados**. Esta separación reduce condiciones mezcladas con detalles de presentación.

No extraigas cada línea a un componente sin necesidad. Crea un límite cuando una rama tenga responsabilidad, comportamiento, pruebas o reutilización propios.

---

## 19. Renderizar o esconder: no son equivalentes

Estas decisiones producen ciclos de vida distintos:

~~~tsx
// El componente se desmonta cuando showEditor es false.
{showEditor && <FindingEditor />}
~~~

~~~tsx
// El componente continúa montado; solo cambia una propiedad visual.
<div hidden={!showEditor}>
  <FindingEditor />
</div>
~~~

Cuando un componente deja de ocupar su posición en el árbol, su estado local puede perderse. Si permanece montado y solo se oculta, conserva estado y recursos.

Elige conscientemente:

- desmonta contenido costoso o que debe reiniciarse;
- conserva montado cuando el borrador debe sobrevivir a una ocultación breve;
- considera accesibilidad y navegación por teclado;
- no uses CSS para esconder contenido que debería ser inaccesible por autorización.

La autorización real pertenece al backend. Ocultar un botón en React mejora la experiencia, pero no protege una operación HTTP.

---

## 20. Validación runtime antes de construir `success`

Los datos que llegan por HTTP no adquieren validez por escribir un tipo:

~~~ts
// Esto es una promesa al compilador, no una validación.
const payload = (await response.json()) as {
  items: Finding[];
};
~~~

Define un esquema ejecutable:

~~~ts
import { z } from "zod";

const FindingSchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  title: z.string().min(1).max(160),
  status: z.enum(["open", "in_progress", "resolved"]),
  severity: z.enum(["low", "medium", "high"]),
  createdAt: z.string().datetime({ offset: true }),
});

const FindingsPayloadSchema = z.object({
  items: z.array(FindingSchema),
});

type Finding = z.infer<typeof FindingSchema>;
~~~

TypeScript usa el tipo inferido durante desarrollo. Zod comprueba el valor real durante ejecución.

Solo después de una validación exitosa puedes decidir entre `empty` y `success`.

---

## 21. Ejemplo completo: SiteOps Tracker

El siguiente flujo consulta hallazgos ficticios al pulsar un botón. La carga automática y la sincronización con sistemas externos se estudiarán después.

### 21.1 Tipos y resultado del cliente HTTP

~~~ts
type SafeUiError = Readonly<{
  kind: "network" | "http" | "invalid_response";
  message: string;
}>;

type LoadFindingsResult =
  | Readonly<{
      ok: true;
      items: readonly Finding[];
    }>
  | Readonly<{
      ok: false;
      error: SafeUiError;
    }>;

export async function fetchFindings(): Promise<LoadFindingsResult> {
  let response: Response;

  try {
    response = await fetch("/api/findings");
  } catch {
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
    return {
      ok: false,
      error: {
        kind: "invalid_response",
        message: "El servicio devolvió una respuesta ilegible.",
      },
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
}
~~~

El SDK no expone al usuario detalles internos del servidor ni el árbol completo del error de Zod. Esa información puede enviarse a logging seguro con un identificador de correlación.

### 21.2 Convertir un array validado en uno no vacío

~~~ts
type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

function toNonEmpty<T extends object>(
  items: readonly T[],
): NonEmptyReadonlyArray<T> | null {
  const [first, ...rest] = items;

  if (first === undefined) {
    return null;
  }

  return [first, ...rest];
}
~~~

La comprobación ocurre en runtime. Después de ella, TypeScript puede representar que la rama de éxito tiene al menos un elemento.

### 21.3 Estado y componente controlador

~~~tsx
import { useState } from "react";

export type FindingsUiState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "empty" }>
  | Readonly<{
      status: "success";
      items: NonEmptyReadonlyArray<Finding>;
    }>
  | Readonly<{
      status: "error";
      error: SafeUiError;
    }>;

type FindingsScreenProps = Readonly<{
  loadFindings?: () => Promise<LoadFindingsResult>;
}>;

export function FindingsScreen({
  loadFindings = fetchFindings,
}: FindingsScreenProps) {
  const [state, setState] = useState<FindingsUiState>({
    status: "idle",
  });

  async function handleLoad(): Promise<void> {
    setState({ status: "loading" });

    const result = await loadFindings();

    if (!result.ok) {
      setState({
        status: "error",
        error: result.error,
      });
      return;
    }

    const nonEmptyItems = toNonEmpty(result.items);

    if (nonEmptyItems === null) {
      setState({ status: "empty" });
      return;
    }

    setState({
      status: "success",
      items: nonEmptyItems,
    });
  }

  return (
    <main>
      <h1>SiteOps Tracker</h1>
      <FindingsStateView
        state={state}
        onLoad={handleLoad}
        onRetry={handleLoad}
      />
    </main>
  );
}
~~~

### 21.4 Vista exhaustiva

~~~tsx
function assertNever(value: never): never {
  throw new Error(
    `Estado de UI no manejado: ${JSON.stringify(value)}`,
  );
}

type FindingsStateViewProps = Readonly<{
  state: FindingsUiState;
  onLoad: () => Promise<void>;
  onRetry: () => Promise<void>;
}>;

export function FindingsStateView({
  state,
  onLoad,
  onRetry,
}: FindingsStateViewProps) {
  switch (state.status) {
    case "idle":
      return (
        <button
          type="button"
          onClick={() => void onLoad()}
        >
          Cargar hallazgos
        </button>
      );

    case "loading":
      return <p role="status">Cargando hallazgos…</p>;

    case "empty":
      return (
        <section aria-labelledby="empty-findings-title">
          <h2 id="empty-findings-title">Sin hallazgos</h2>
          <p>No existen hallazgos para esta consulta.</p>
          <button
            type="button"
            onClick={() => void onRetry()}
          >
            Consultar de nuevo
          </button>
        </section>
      );

    case "success":
      return <FindingsList findings={state.items} />;

    case "error":
      return (
        <section role="alert" aria-labelledby="load-error-title">
          <h2 id="load-error-title">No fue posible cargar</h2>
          <p>{state.error.message}</p>
          <button
            type="button"
            onClick={() => void onRetry()}
          >
            Reintentar
          </button>
        </section>
      );

    default:
      return assertNever(state);
  }
}
~~~

---

## 22. Funcionamiento del ejemplo completo

1. `FindingsScreen` comienza en `idle`.
2. El usuario pulsa “Cargar hallazgos”.
3. El evento cambia el estado a `loading`.
4. El cliente HTTP obtiene una respuesta.
5. El cuerpo se recibe como `unknown`.
6. Zod valida el contrato en runtime.
7. El resultado tipado distingue éxito y error mediante `ok`.
8. Un array vacío produce `empty`.
9. Un array con datos se convierte en una tupla no vacía y produce `success`.
10. `FindingsStateView` renderiza exactamente una rama.
11. El `switch` exhaustivo obliga a atender futuras variantes.
12. Cada botón envuelve la promesa con `void` para que el manejador de React siga retornando `void`.

No existe una combinación “cargando y error al mismo tiempo”. El modelo no la permite.

---

## 23. Separar estado remoto de reglas de negocio

La unión de UI describe lo que la persona ve. No sustituye las reglas del dominio.

Por ejemplo:

~~~ts
type FindingStatus = "open" | "in_progress" | "resolved";

type FindingsUiStatus =
  | "idle"
  | "loading"
  | "empty"
  | "success"
  | "error";
~~~

`FindingStatus` pertenece a la entidad. `FindingsUiStatus` pertenece al ciclo de la pantalla. No mezcles ambos vocabularios en un solo campo `status` sin contexto.

Una entidad resuelta puede aparecer dentro de una pantalla que está en `success`. La pantalla también puede estar en `loading` sin cambiar el estado persistente de ninguna entidad.

---

## 24. Cuándo utilizar estas técnicas

Usa renderizado condicional cuando:

- una acción depende de permisos;
- una sección es opcional;
- existe una alternativa breve entre dos salidas;
- una solicitud tiene estados de carga, vacío, éxito y error;
- un flujo de formulario cambia según su etapa;
- un recurso puede no existir;
- una pantalla debe reaccionar a filtros o selección;
- el diseño enumera estados visuales distintos.

Usa una unión discriminada cuando:

- cada variante requiere datos diferentes;
- varios booleanos se actualizan juntos;
- hay combinaciones inválidas;
- agregar una variante debe obligar a revisar la UI;
- el equipo necesita un vocabulario explícito para el flujo.

---

## 25. Cuándo evitarlo o reconsiderarlo

Evita:

- ternarios anidados de varias líneas;
- condiciones repetidas en muchos componentes;
- `any` para escapar del narrowing;
- aserciones que convierten una variante en otra;
- booleanos redundantes derivados de los mismos datos;
- ramas vacías que ocultan errores importantes;
- lógica de autorización exclusivamente en React;
- setters o solicitudes ejecutadas durante el render;
- una unión gigantesca que mezcle varios flujos independientes.

Si dos estados cambian de forma independiente, quizá no deban formar una sola unión. Por ejemplo, el panel seleccionado y la preferencia de tema pueden ser variables separadas porque no representan etapas mutuamente excluyentes.

No conviertas cada `boolean` en una unión por costumbre. Hazlo cuando el modelo gane claridad o seguridad.

---

## 26. Errores comunes y sus causas

### Error 1: usar varios booleanos para un solo flujo

Permite combinaciones contradictorias. Modela variantes mutuamente excluyentes.

### Error 2: usar verdad implícita para un número

`0 && <Component />` puede mostrar `0`. Compara explícitamente: `count > 0`.

### Error 3: encadenar ternarios complejos

La sintaxis compacta reduce legibilidad. Usa un `switch`, retornos tempranos o componentes.

### Error 4: confundir `null`, `undefined` y array vacío

Define qué significa cada valor o usa estados explícitos.

### Error 5: guardar datos derivados en estado

La copia puede desincronizarse. Calcula el valor durante el render.

### Error 6: acceder a campos fuera de su variante

`items!` oculta un problema de modelado. Reduce por el discriminante.

### Error 7: omitir una variante nueva

Usa `never` o una regla de lint consciente de tipos para exigir exhaustividad.

### Error 8: usar `as` para fabricar éxito

Una aserción no valida el payload ni crea datos ausentes.

### Error 9: tratar `response.ok` como validación del JSON

Un HTTP 200 todavía puede contener una forma inválida. Valida el cuerpo.

### Error 10: mostrar mensajes internos al usuario

No expongas stack traces, SQL ni detalles sensibles. Usa mensajes seguros y logging estructurado.

### Error 11: llamar `setState` durante el render

Puede causar bucles. Las transiciones ocurren en eventos o mecanismos de sincronización apropiados.

### Error 12: ocultar controles como única autorización

La API debe comprobar permisos aunque el botón no exista en la UI.

### Error 13: olvidar accesibilidad en estados dinámicos

Usa semántica como `role="status"` para progreso informativo y `role="alert"` para errores importantes, sin duplicar anuncios innecesarios.

### Error 14: desmontar un formulario sin considerar su borrador

El renderizado condicional puede reiniciar estado local. Decide si esa pérdida es deseada.

### Error 15: crear una rama `default` que devuelve `null`

Oculta variantes no manejadas. Un `assertNever` mantiene la comprobación exhaustiva.

---

## 27. TypeScript desaparece en runtime

Los tipos y las uniones discriminadas protegen el código que compilas. Después de emitir JavaScript:

- `Finding` ya no existe;
- `FindingsUiState` ya no existe;
- `NonEmptyReadonlyArray` ya no existe;
- una aserción `as` no ejecuta ninguna comprobación;
- el servidor todavía puede enviar datos inválidos.

Por eso los límites externos deben validarse realmente:

- respuestas HTTP;
- formularios;
- APIs externas;
- archivos importados;
- variables de entorno;
- filas de bases de datos;
- mensajes y eventos.

Zod ejecuta comprobaciones y produce datos tipados después del éxito. TypeScript comprueba cómo usas esos datos dentro del programa. PostgreSQL protege restricciones persistentes. Son responsabilidades complementarias.

El discriminante de una unión creada localmente es confiable si todas las transiciones están tipadas. Si la unión proviene directamente de JSON, primero valida el discriminante y los campos de cada variante.

---

## 28. Relación explícita con la arquitectura Full Stack

El flujo objetivo es:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

| Capa | Relación con el estado condicional |
|---|---|
| React | Convierte el estado actual en carga, vacío, éxito o error |
| HTTP/SDK | Distingue fallos de transporte, códigos HTTP y payload inválido |
| Node.js | Ejecuta la aplicación que recibe datos no confiables |
| Router | Relaciona método y ruta con el Controller correcto |
| Controller | Traduce request y resultado del caso de uso a HTTP |
| Runtime Validation | Comprueba params, query, body y contratos externos |
| Service | Aplica autorización y reglas de negocio |
| Repository | Devuelve resultados o errores de acceso a datos de forma explícita |
| PostgreSQL | Conserva entidades, restricciones e integridad persistente |
| Testing | Verifica cada estado observable y sus transiciones |
| Docker | Reproduce frontend, API y base de datos en entornos consistentes |
| CI/CD | Ejecuta typecheck, lint, pruebas y build antes de desplegar |
| Cloud | Aporta disponibilidad, logs, métricas y trazabilidad operacional |

Una respuesta vacía de PostgreSQL puede traducirse en dos resultados distintos según el caso de uso:

- una búsqueda de colección puede producir `200` con `items: []`, que React muestra como `empty`;
- buscar un único ID inexistente puede producir `404`, que React modela como `not_found`.

El Repository no decide el JSX. React no decide autorización ni integridad. Cada capa aporta una decisión explícita.

---

## 29. Pruebas con Vitest y Testing Library

Prueba lo que la persona observa, no el valor interno de `status`.

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  FindingsStateView,
  type FindingsUiState,
} from "./FindingsStateView";

const noAction = (): Promise<void> => Promise.resolve();

function renderState(state: FindingsUiState) {
  render(
    <FindingsStateView
      state={state}
      onLoad={noAction}
      onRetry={noAction}
    />,
  );
}

describe("FindingsStateView", () => {
  it("muestra progreso durante loading", () => {
    renderState({ status: "loading" });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando hallazgos",
    );
  });

  it("muestra una acción cuando la respuesta está vacía", () => {
    renderState({ status: "empty" });

    expect(
      screen.getByRole("heading", { name: "Sin hallazgos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Consultar de nuevo" }),
    ).toBeInTheDocument();
  });

  it("muestra un error seguro", () => {
    renderState({
      status: "error",
      error: {
        kind: "network",
        message: "No se pudo conectar con el servicio.",
      },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el servicio.",
    );
  });

  it("invoca la carga desde idle", async () => {
    const user = userEvent.setup();
    const onLoad = vi.fn<() => Promise<void>>()
      .mockResolvedValue(undefined);

    render(
      <FindingsStateView
        state={{ status: "idle" }}
        onLoad={onLoad}
        onRetry={noAction}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Cargar hallazgos",
      }),
    );

    expect(onLoad).toHaveBeenCalledOnce();
  });
});
~~~

En un proyecto real, usa `userEvent` para interacciones de usuario:

~~~tsx
import userEvent from "@testing-library/user-event";

const user = userEvent.setup();

await user.click(
  screen.getByRole("button", { name: "Reintentar" }),
);
~~~

Usa:

- `getBy...` cuando el elemento debe existir ahora;
- `queryBy...` cuando compruebas que no existe;
- `findBy...` cuando aparecerá de forma asíncrona;
- `waitForElementToBeRemoved` cuando debe desaparecer después de una transición.

Las consultas por rol y nombre accesible reflejan mejor la experiencia que selectores basados en clases o detalles internos.

---

## 30. Typecheck, ESLint y calidad

Una comprobación sólida combina:

- TypeScript con `strict`;
- `noImplicitReturns` para detectar rutas sin retorno;
- `noFallthroughCasesInSwitch` para evitar caídas accidentales;
- `noUncheckedIndexedAccess` para accesos más honestos a arrays;
- `@typescript-eslint/switch-exhaustiveness-check` cuando el proyecto usa lint consciente de tipos;
- `@typescript-eslint/no-unnecessary-condition` con configuración revisada;
- Vitest y Testing Library;
- build de producción.

Un pipeline puede ejecutar:

~~~text
typecheck → lint → pruebas → build
~~~

`assertNever` vive cerca del código y produce un error de tipos cuando falta una rama. La regla de ESLint puede detectar switches no exhaustivos de forma adicional. Ninguna de las dos valida JSON externo: para eso se necesita validación runtime.

---

## 31. Relación con las piezas del portafolio

### SiteOps Tracker

Las pantallas de sedes, activos, hallazgos y acciones correctivas deben demostrar carga, vacío, error, permisos y éxito. Una UI que solo funciona con datos ideales parece incompleta.

### SDK tipado para una API

El SDK puede devolver un `Result` discriminado y clasificar fallos de red, HTTP y contrato. La UI consume ese resultado sin depender de excepciones ambiguas.

### API REST Node.js + TypeScript + PostgreSQL

Controller y Service pueden representar resultados como `found`, `not_found`, `forbidden` o `conflict`; después el Controller los traduce a códigos HTTP. React vuelve a traducir la respuesta a estados visuales.

### Analizador de configuraciones

La interfaz puede distinguir `idle`, `reading_file`, `analyzing`, `no_findings`, `success` y `invalid_file`. Cada variante requiere información distinta.

### Repositorio de algoritmos TypeScript

Un visualizador puede modelar `ready`, `running`, `paused`, `completed` y `failed`. La exhaustividad ayuda cuando se agrega una nueva etapa del algoritmo.

### Aplicación Full Stack

Mostrar un flujo probado desde JSON `unknown` hasta una UI exhaustiva demuestra dominio de TypeScript, React, contratos y errores. Es una historia concreta para portafolio e entrevistas.

---

## 32. Ejercicio práctico — Detalle de un activo

Construye `AssetDetailsPanel` sin copiar una solución completa.

### Modelo inicial

~~~ts
type Asset = Readonly<{
  id: string;
  siteId: string;
  label: string;
  category: "server" | "switch" | "ups" | "workstation";
  status: "active" | "maintenance" | "retired";
}>;

type AssetDetailsError = Readonly<{
  kind: "network" | "forbidden" | "invalid_response";
  message: string;
}>;

type AssetDetailsState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; asset: Asset }>
  | Readonly<{ status: "not_found"; assetId: string }>
  | Readonly<{
      status: "error";
      error: AssetDetailsError;
    }>;
~~~

### Punto de partida

~~~tsx
type AssetDetailsPanelProps = Readonly<{
  state: AssetDetailsState;
  onLoad: () => Promise<void>;
  onRetry: () => Promise<void>;
}>;

export function AssetDetailsPanel({
  state,
  onLoad,
  onRetry,
}: AssetDetailsPanelProps) {
  // TODO: renderiza todas las variantes sin solución completa aquí.
  return null;
}
~~~

### Requisitos

1. Usa un `switch` sobre `state.status`.
2. Renderiza exactamente una salida por variante.
3. Accede a `asset` únicamente en `ready`.
4. Accede a `assetId` únicamente en `not_found`.
5. Usa `role="status"` para carga y `role="alert"` para error.
6. Incluye acción de carga en `idle` y reintento en `error`.
7. Termina con una comprobación `never`.
8. No uses `any`, `as Asset` ni non-null assertions.
9. Añade una prueba por estado visible.
10. Agrega una prueba de interacción para `onRetry`.
11. Mantén todos los datos completamente ficticios.
12. No implementes todavía carga automática con un Effect.

El ejercicio queda deliberadamente sin solución completa.

---

## 33. Pistas para el ejercicio

1. Empieza con `switch (state.status)`.
2. TypeScript reducirá `state` dentro de cada `case`.
3. Un botón que recibe una función asíncrona puede usar `onClick={() => void onLoad()}`.
4. `not_found` no es necesariamente un error técnico; puede tener una explicación y navegación alternativa.
5. Extrae `AssetCard` si la rama `ready` crece demasiado.
6. Implementa `assertNever(value: never): never` fuera del componente.
7. Si agregar una variante no rompe el typecheck, revisa tu rama `default`.
8. Prueba por rol y nombre accesible.
9. Usa `queryByRole` para demostrar que una rama incompatible no aparece.
10. No conviertas el objeto de estado con una aserción.

---

## 34. Reto adicional — Flujo Full Stack de hallazgos por sede

Construye una versión más exigente de la consulta de hallazgos.

### React

- Modela `idle`, `loading`, `empty`, `success`, `forbidden` y `error`.
- Agrega una variante `refreshing` que conserve resultados anteriores.
- Renderiza el flujo con exhaustividad.
- Distingue una colección vacía de un error.
- No dupliques `hasData`, `hasError` ni `isEmpty`.

### SDK y HTTP

- Solicita `GET /sites/:siteId/findings`.
- Trata el body como `unknown`.
- Valida la respuesta con Zod.
- Clasifica red, HTTP y contrato inválido.
- No muestres mensajes internos del servidor.

### Node.js

- Router identifica la ruta.
- Controller traduce parámetros y resultados.
- Validación runtime comprueba `siteId`.
- Service verifica autorización.
- Repository obtiene hallazgos con parámetros seguros.

### PostgreSQL

- Usa identificadores ficticios.
- Distingue sede inexistente de sede sin hallazgos.
- Mantén integridad con claves y restricciones.
- Devuelve un orden determinista.

### Testing

- Prueba cada variante de UI.
- Prueba transición de error a reintento exitoso.
- Prueba respuesta vacía.
- Prueba payload inválido.
- Prueba `403` sin depender de ocultar un botón.

### Docker, CI/CD y Cloud

Documenta, sin profundizar todavía, cómo Docker Compose reproducirá frontend, API y PostgreSQL; cómo GitHub Actions ejecutará typecheck, ESLint, pruebas y build; y qué logs o métricas permitirán investigar errores en Cloud.

---

## 35. Preguntas de comprensión

1. ¿Qué hace React con el JSX retornado por una rama condicional?
2. ¿Cuándo conviene un retorno temprano?
3. ¿Cuándo es apropiado un ternario?
4. ¿Qué problema tiene `{count && <Component />}` cuando `count` vale cero?
5. ¿Qué significa retornar `null`?
6. ¿Por qué tres booleanos pueden producir estados contradictorios?
7. ¿Qué es el discriminante de una unión?
8. ¿Cómo reduce TypeScript el tipo dentro de un `case`?
9. ¿Qué representa `never` al terminar un switch exhaustivo?
10. ¿Qué ocurre si agregas `refreshing` y no lo manejas?
11. ¿Por qué `idle` y `empty` no son equivalentes?
12. ¿Por qué no conviene guardar `hasItems` junto con `items`?
13. ¿Qué diferencia existe entre esconder y desmontar un componente?
14. ¿Ocultar un botón implementa autorización?
15. ¿Por qué `response.ok` no valida el JSON?
16. ¿Qué aporta Zod que TypeScript no puede aportar en runtime?
17. ¿Qué consulta de Testing Library usarías para un elemento que aparecerá después?
18. ¿Cómo se relaciona un `404` del backend con un estado visual `not_found`?

---

## 36. Relevancia para entrevistas técnicas

### “¿Cómo manejarías loading, error y success en React?”

Modelaría el flujo como una unión discriminada, renderizaría cada variante y comprobaría exhaustividad. Evitaría booleanos independientes que permitan estados imposibles.

### “¿Cuál es la diferencia entre `&&` y un ternario?”

`&&` sirve para incluir algo o nada. El ternario elige entre dos resultados. Con `&&`, la parte izquierda debe ser booleana para evitar renderizar valores como `0`.

### “¿Para qué sirve `never`?”

Después de reducir todas las variantes conocidas, el valor restante debe ser `never`. Si aparece una variante nueva, la llamada a `assertNever` falla durante el typecheck.

### “¿TypeScript valida una respuesta de API?”

No. Sus tipos desaparecen en runtime. Recibiría el payload como `unknown` y lo validaría con un esquema ejecutable antes de crear el estado de éxito.

### “¿Por qué separar `empty` de `success`?”

Permite contratos y experiencias distintas. También evita que todos los consumidores tengan que recordar que un éxito con array vacío requiere una rama especial.

### “¿Ocultarías una acción sin permiso?”

Sí, para mejorar la experiencia, pero la API debe volver a comprobar autorización. El control visual no es una frontera de seguridad.

### “¿Cómo probarías el renderizado condicional?”

Renderizaría cada variante, consultaría por roles y nombres accesibles, comprobaría presencia o ausencia, y probaría transiciones mediante interacciones reales.

Una respuesta fuerte conecta modelado, exhaustividad, runtime validation, accesibilidad y responsabilidades backend.

---

## 37. Lista de verificación profesional

- [ ] Cada estado visual tiene un significado claro.
- [ ] No existen booleanos que puedan contradecirse.
- [ ] La unión usa un discriminante literal.
- [ ] Cada variante contiene solo los datos que necesita.
- [ ] `idle`, `empty`, `success` y `error` no se confunden.
- [ ] Las ramas complejas están separadas en componentes legibles.
- [ ] Los ternarios anidados se reemplazaron por una estructura clara.
- [ ] `&&` recibe una condición booleana.
- [ ] No se usan `any`, non-null assertions ni aserciones para forzar ramas.
- [ ] El `switch` termina en una comprobación `never`.
- [ ] El render no ejecuta setters ni solicitudes.
- [ ] Los datos externos empiezan como `unknown`.
- [ ] Zod valida el contrato en runtime.
- [ ] Los mensajes de error son seguros para la UI.
- [ ] El backend vuelve a comprobar autorización.
- [ ] Se consideró si desmontar debe borrar estado local.
- [ ] Carga y error tienen semántica accesible.
- [ ] Las pruebas cubren todas las variantes observables.
- [ ] Typecheck, lint, pruebas y build forman parte de CI.

---

## 38. Resumen

- React usa condiciones normales de JavaScript para decidir qué JSX retornar.
- Los retornos tempranos funcionan bien cuando una rama reemplaza toda la salida.
- El ternario elige entre dos alternativas breves.
- `&&` sirve para mostrar algo o nada, pero la condición debe ser booleana.
- `null` omite nodos; no evita que el componente se ejecute.
- Varios booleanos independientes pueden representar combinaciones imposibles.
- Una unión discriminada limita el programa a estados válidos.
- TypeScript estrecha la unión a partir del discriminante.
- `never` permite comprobar que todas las variantes fueron atendidas.
- `idle`, `empty`, `success` y `error` comunican intenciones diferentes.
- La información derivada no debe duplicarse en estado.
- Desmontar y esconder un componente tienen efectos distintos sobre su estado local.
- Ocultar controles no sustituye la autorización del backend.
- Los tipos TypeScript desaparecen en runtime.
- HTTP, formularios, APIs externas, archivos, variables de entorno y bases de datos requieren validación real.
- Zod valida el payload antes de construir un estado de éxito.
- Testing Library verifica el comportamiento visible de cada rama.
- La exhaustividad vuelve más seguro agregar estados futuros.

---

## Referencias oficiales

- [React: Conditional Rendering](https://react.dev/learn/conditional-rendering)
- [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [React: Reacting to Input with State](https://react.dev/learn/reacting-to-input-with-state)
- [React: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [TypeScript: Narrowing and Exhaustiveness Checking](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking)
- [Zod: Basic usage](https://zod.dev/basics)
- [Testing Library: About Queries](https://testing-library.com/docs/queries/about/)
- [Testing Library: Appearance and Disappearance](https://testing-library.com/docs/guide-disappearance/)
- [typescript-eslint: switch-exhaustiveness-check](https://typescript-eslint.io/rules/switch-exhaustiveness-check/)

Referencias consultadas el **15 de octubre de 2026**.

---

# Próxima lección

**Lección 40 — Efectos y sincronización externa con `useEffect`: dependencias, limpieza y cuándo no usarlo.**
