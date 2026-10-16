# Lección 35 — Estado local con `useState`: inferencia, unions y actualizaciones inmutables

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, datos, reglas y escenarios de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — estado e interacción  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## Introducción

En la lección 34 construiste componentes funcionales con JSX y props tipadas. Las props permiten que un padre entregue información a un hijo, pero una interfaz también necesita recordar decisiones locales: si un panel está abierto, qué filtro eligió el usuario, qué elemento está seleccionado o cómo cambia un borrador antes de guardarlo.

Una variable ordinaria no resuelve ese problema dentro de un componente. Puede cambiar durante un evento, pero React no sabe que debe renderizar de nuevo y el valor vuelve a inicializarse en la siguiente ejecución de la función.

`useState` existe para unir dos necesidades:

1. conservar un valor entre renders del mismo componente;
2. solicitar un nuevo render cuando ese valor cambia.

TypeScript puede inferir muchos estados sencillos, pero los estados profesionales suelen necesitar contratos explícitos: unions para filtros, `null` para ausencia, arreglos tipados, objetos de solo lectura y uniones discriminadas para evitar combinaciones imposibles.

La idea central de hoy es:

> El estado representa la memoria mínima de la interfaz; se reemplaza mediante el setter y se actualiza sin mutar sus objetos o arreglos.

Y se mantiene una frontera esencial:

> Un valor guardado en `useState<T>` no ha sido validado por existir dentro de React. Los tipos TypeScript desaparecen en runtime.

---

## Objetivo

Al terminar esta lección podrás:

1. explicar por qué una variable local no sustituye al estado de React;
2. describir qué conserva `useState` y qué provoca su setter;
3. leer la tupla `[state, setState]` con tipos correctos;
4. aplicar las reglas de los Hooks;
5. decidir cuándo aprovechar inferencia y cuándo escribir un genérico;
6. tipar estados primitivos, unions, valores nulos, objetos y arreglos;
7. entender el estado como snapshot de un render;
8. distinguir reemplazo directo de actualización funcional;
9. explicar batching y actualizaciones en cola;
10. evitar estado redundante, duplicado o contradictorio;
11. actualizar objetos y arreglos sin mutarlos;
12. modelar estados de petición con una unión discriminada;
13. usar inicialización diferida de manera pura;
14. validar valores persistidos o recibidos antes de guardarlos;
15. probar una interacción que modifica estado con Vitest y Testing Library;
16. relacionar el estado local con la arquitectura Full Stack;
17. reconocer errores frecuentes de `useState`;
18. justificar estas decisiones en una entrevista técnica.

---

## 1. El problema: una variable local no es memoria de interfaz

Este componente intenta expandir una descripción con una variable ordinaria:

~~~tsx
type FindingDetailsProps = {
  readonly description: string;
};

export function FindingDetails({
  description,
}: FindingDetailsProps) {
  let expanded = false;

  function handleToggle() {
    expanded = !expanded;
  }

  return (
    <section>
      <button type="button" onClick={handleToggle}>
        {expanded ? "Ocultar" : "Mostrar"} detalle
      </button>

      {expanded && <p>{description}</p>}
    </section>
  );
}
~~~

El clic cambia la variable, pero el ejemplo falla por dos motivos:

1. React no recibió una solicitud para volver a renderizar;
2. cuando el componente se ejecute otra vez, `expanded` volverá a ser `false`.

La función del componente describe un render. Sus variables locales pertenecen a esa ejecución, no constituyen memoria persistente de la interfaz.

Con `useState`, React conserva el valor y conoce el momento en que debe volver a ejecutar el componente:

~~~tsx
import { useState } from "react";

type FindingDetailsProps = {
  readonly description: string;
};

export function FindingDetails({
  description,
}: FindingDetailsProps) {
  const [expanded, setExpanded] = useState(false);

  function handleToggle() {
    setExpanded((current) => !current);
  }

  return (
    <section>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        {expanded ? "Ocultar" : "Mostrar"} detalle
      </button>

      {expanded && <p>{description}</p>}
    </section>
  );
}
~~~

Ahora el clic solicita otro render y el nuevo JSX refleja el siguiente valor.

---

## 2. Qué es estado local y por qué existe

El **estado local** es información que React asocia con una instancia de componente en una posición concreta del árbol de interfaz.

Sirve para recordar valores que:

- pueden cambiar por interacción o eventos;
- afectan lo que el componente renderiza;
- pertenecen al componente o a un ancestro cercano;
- deben sobrevivir entre renders.

Ejemplos en SiteOps Tracker:

- filtro de hallazgos seleccionado;
- texto de búsqueda aún no enviado;
- identificador del activo seleccionado;
- panel expandido o contraído;
- borrador de una acción correctiva;
- estado visual de una petición iniciada por el usuario.

React conserva el estado mientras preserve la identidad del componente en el árbol. Cambiar su posición o su `key` puede hacer que React descarte esa memoria y cree otra. Por eso no uses keys aleatorias para componentes que deben conservar estado.

### Estado no significa “cualquier variable”

Un valor calculable durante render no necesita almacenarse. Si tienes `findings` y `filter`, la lista visible puede derivarse de ambos. Guardarla además en estado crea dos fuentes de verdad.

---

## 3. Anatomía de `useState`

La forma básica es:

~~~tsx
const [state, setState] = useState(initialState);
~~~

Para un booleano:

~~~tsx
const [expanded, setExpanded] = useState(false);
~~~

TypeScript infiere:

- `expanded` como `boolean`;
- `setExpanded` como una función que acepta un `boolean` o una función que produce el siguiente `boolean`.

Una representación simplificada del contrato es:

~~~ts
type SetStateAction<State> =
  | State
  | ((previousState: State) => State);

type StateSetter<State> = (
  action: SetStateAction<State>,
) => void;
~~~

Por eso ambas llamadas son válidas:

~~~tsx
setExpanded(true);
setExpanded((current) => !current);
~~~

El nombre `setExpanded` es una convención útil: `set` seguido del nombre del valor. El setter no “edita” la variable existente; pone en cola el siguiente estado y solicita renderizado.

---

## 4. Reglas de los Hooks

`useState` es un Hook. React depende de que los Hooks se invoquen en el mismo orden durante cada render.

### Regla 1 — Llama Hooks solo en el nivel superior

No los llames dentro de:

- condiciones;
- ciclos;
- callbacks;
- manejadores de eventos;
- `try/catch/finally`;
- funciones anidadas.

~~~tsx
// Incorrecto
function FindingPanel({ editable }: { readonly editable: boolean }) {
  if (editable) {
    const [draft, setDraft] = useState("");
  }

  return <section />;
}
~~~

La llamada debe ocurrir antes de retornos condicionales:

~~~tsx
function FindingPanel({ editable }: { readonly editable: boolean }) {
  const [draft, setDraft] = useState("");

  if (!editable) {
    return <p>Vista de solo lectura</p>;
  }

  return (
    <button type="button" onClick={() => setDraft("Nuevo borrador")}>
      Crear borrador: {draft}
    </button>
  );
}
~~~

### Regla 2 — Llama Hooks solo desde funciones React

Puedes llamar `useState` desde:

- un componente funcional;
- un Hook personalizado.

No lo llames desde una utilidad TypeScript ordinaria ni desde módulos del SDK, Service o Repository.

`eslint-plugin-react-hooks` puede detectar muchas infracciones. Mantén `rules-of-hooks` dentro del quality gate de lint.

---

## 5. Inferencia útil para estados simples

TypeScript infiere bien cuando el valor inicial representa todo el dominio esperado:

~~~tsx
const [expanded, setExpanded] = useState(false);
const [query, setQuery] = useState("");
const [page, setPage] = useState(1);
~~~

Los tipos inferidos son:

~~~text
expanded → boolean
query    → string
page     → number
~~~

No necesitas escribir genéricos redundantes:

~~~tsx
// Válido, pero el genérico no agrega información.
const [expanded, setExpanded] = useState<boolean>(false);
~~~

Prefiere inferencia cuando el tipo resultante es exactamente el contrato deseado. Escribe el tipo cuando el inicializador sea más estrecho, ambiguo o incompleto.

---

## 6. Cuándo declarar el tipo explícitamente

### 6.1 Union de literales

Si el estado admite un conjunto finito, exprésalo:

~~~tsx
type FindingFilter =
  | "all"
  | "open"
  | "in_progress"
  | "resolved";

const [filter, setFilter] =
  useState<FindingFilter>("all");
~~~

Sin el genérico, el string inicial normalmente se amplía a `string` y se pierde el conjunto permitido.

~~~tsx
setFilter("open");

// @ts-expect-error: no pertenece a FindingFilter.
setFilter("archived");
~~~

### 6.2 Ausencia con `null`

~~~tsx
const [selectedFindingId, setSelectedFindingId] =
  useState<string | null>(null);
~~~

Si escribes únicamente `useState(null)`, TypeScript no puede adivinar que después aceptarás un `string`.

### 6.3 Arreglo inicialmente vacío

~~~tsx
type FindingSummary = {
  readonly id: string;
  readonly title: string;
};

const [findings, setFindings] =
  useState<readonly FindingSummary[]>([]);
~~~

Un arreglo vacío no aporta un tipo de elemento útil y, con configuración estricta, puede terminar inferido como `never[]` en este contexto.

### 6.4 Objeto con contrato estable

~~~tsx
type FindingFilters = {
  readonly query: string;
  readonly priority: "all" | "low" | "medium" | "high";
};

const [filters, setFilters] = useState<FindingFilters>({
  query: "",
  priority: "all",
});
~~~

El tipo explícito conserva el dominio completo de `priority` y documenta el contrato del estado.

### Evita assertions para fabricar un estado incompleto

~~~tsx
// Evitar: el objeto todavía no cumple el contrato real.
const [finding, setFinding] =
  useState<FindingSummary>({} as FindingSummary);
~~~

Modela la ausencia:

~~~tsx
const [finding, setFinding] =
  useState<FindingSummary | null>(null);
~~~

---

## 7. El estado es un snapshot del render

Cada render recibe una instantánea de sus props y estado. El setter no cambia la variable que ya está ejecutándose dentro del manejador.

~~~tsx
import { useState } from "react";

export function OpenCount() {
  const [count, setCount] = useState(0);

  function handleIncrement() {
    setCount(count + 1);
    console.log(count);
  }

  return (
    <button type="button" onClick={handleIncrement}>
      Aperturas: {count}
    </button>
  );
}
~~~

Dentro de ese manejador, `count` mantiene el valor del render que creó la función. `setCount` pone en cola otro render; no reescribe retroactivamente esa constante.

Secuencia mental:

~~~text
render con count = 0
        ↓
clic ejecuta el manejador de ese render
        ↓
setCount(1) solicita actualización
        ↓
el manejador termina con su snapshot count = 0
        ↓
nuevo render recibe count = 1
~~~

No leas el valor inmediatamente después del setter esperando observar el siguiente estado. Si ya calculaste el siguiente valor y lo necesitas en el mismo evento, guárdalo en una constante local.

---

## 8. Reemplazo directo frente a actualización funcional

### Reemplazo directo

Úsalo cuando el siguiente estado no depende del anterior:

~~~tsx
setFilter("resolved");
setSelectedFindingId("finding-demo-204");
setSelectedFindingId(null);
~~~

### Actualización funcional

Úsala cuando calculas el siguiente estado a partir del anterior:

~~~tsx
setExpanded((current) => !current);
setPage((current) => current + 1);
~~~

El parámetro `current` es el valor que React entrega a esa actualización dentro de la cola, no necesariamente el snapshot capturado por el manejador.

### Regla práctica

~~~text
Siguiente valor independiente → setState(value)
Siguiente valor depende del anterior → setState(previous => next)
~~~

La forma funcional reduce errores cuando se encadenan actualizaciones o cuando un callback se ejecuta después.

---

## 9. Batching y varias actualizaciones

React puede agrupar actualizaciones de un evento antes del siguiente render. Este código no suma tres sobre snapshots sucesivos:

~~~tsx
setCount(count + 1);
setCount(count + 1);
setCount(count + 1);
~~~

Las tres líneas usan el mismo `count` del render actual.

Si cada operación debe consumir el resultado anterior, usa updaters:

~~~tsx
setCount((current) => current + 1);
setCount((current) => current + 1);
setCount((current) => current + 1);
~~~

React procesa la cola y entrega el resultado de cada updater al siguiente.

Los updaters deben ser puros:

- no mutan el estado recibido;
- no hacen HTTP;
- no escriben archivos o almacenamiento;
- no generan IDs aleatorios;
- devuelven el siguiente estado de forma síncrona.

En desarrollo con Strict Mode, React puede invocar inicializadores y updaters más de una vez para detectar impurezas. El resultado correcto no debe depender del número de invocaciones.

---

## 10. Guarda el estado mínimo y deriva el resto

Supón que posees hallazgos y un filtro. No guardes también el arreglo filtrado y su cantidad:

~~~tsx
// Evitar: tres valores que deben sincronizarse.
const [findings, setFindings] = useState<readonly FindingSummary[]>([]);
const [visibleFindings, setVisibleFindings] = useState<readonly FindingSummary[]>([]);
const [visibleCount, setVisibleCount] = useState(0);
~~~

Conserva solo las fuentes necesarias:

~~~tsx
const [findings, setFindings] =
  useState<readonly FindingSummary[]>([]);

const [filter, setFilter] =
  useState<FindingFilter>("all");

const visibleFindings =
  filter === "all"
    ? findings
    : findings.filter((finding) => finding.status === filter);

const visibleCount = visibleFindings.length;
~~~

`visibleFindings` y `visibleCount` se calculan durante render. No pueden quedarse desactualizados respecto de sus fuentes.

### Principios útiles

1. Agrupa estado que siempre cambia junto.
2. Separa valores no relacionados.
3. Evita contradicciones.
4. Evita redundancia calculable.
5. Evita duplicar el mismo dato.
6. Prefiere estructuras planas frente a anidación profunda.

---

## 11. No copies props a estado sin una razón explícita

Este patrón sorprende:

~~~tsx
type SiteNameEditorProps = {
  readonly siteName: string;
};

function SiteNameEditor({ siteName }: SiteNameEditorProps) {
  const [name, setName] = useState(siteName);

  return <p>{name}</p>;
}
~~~

`siteName` solo inicializa el estado en el primer render de esa instancia. Si el padre entrega otra prop después, `name` no se sincroniza automáticamente.

Esto puede ser correcto cuando la prop es deliberadamente un valor inicial:

~~~tsx
type SiteNameEditorProps = {
  readonly initialSiteName: string;
};
~~~

El prefijo `initial` comunica que el componente toma propiedad de un borrador independiente.

Si no necesitas independencia, usa la prop directamente. Si padre e hijo deben editar la misma fuente, eleva el estado al propietario común y pasa valor más callback.

---

## 12. Actualizaciones inmutables de objetos

Los objetos JavaScript son mutables, pero un objeto guardado en estado debe tratarse como de solo lectura.

### Incorrecto

~~~tsx
filters.query = "backup";
setFilters(filters);
~~~

Se alteró el objeto que pertenece al snapshot anterior y se entregó la misma referencia. Esto rompe el modelo de React y puede impedir la actualización esperada.

### Correcto

~~~tsx
setFilters((current) => ({
  ...current,
  query: "backup",
}));
~~~

El spread copia las propiedades de primer nivel y la propiedad posterior reemplaza `query`.

### El setter reemplaza; no mezcla parcialmente

Con Hooks, esto perdería `priority`:

~~~tsx
// @ts-expect-error: falta priority en FindingFilters.
setFilters({ query: "backup" });
~~~

Debes construir el objeto completo:

~~~tsx
setFilters((current) => ({
  ...current,
  query: "backup",
}));
~~~

### Objetos anidados

El spread es superficial. Copia cada nivel que conduce al valor modificado:

~~~tsx
type FindingDraft = {
  readonly title: string;
  readonly assignment: {
    readonly assigneeId: string | null;
    readonly dueDate: string | null;
  };
};

setDraft((current) => ({
  ...current,
  assignment: {
    ...current.assignment,
    assigneeId: "user-demo-12",
  },
}));
~~~

Si necesitas copiar muchos niveles con frecuencia, revisa la estructura. Aplanarla suele ser más claro que acumular spreads profundos.

---

## 13. Actualizaciones inmutables de arreglos

Trata los arreglos de estado como `readonly`.

| Operación | Evita | Prefiere |
| --- | --- | --- |
| agregar | `push`, `unshift` | spread o `concat` |
| eliminar | `pop`, `shift`, `splice` | `filter` |
| reemplazar | asignación por índice, `splice` | `map` |
| ordenar | `sort` sobre el original | copia y luego ordena |
| invertir | `reverse` sobre el original | copia y luego invierte |

### Agregar

~~~tsx
setFindings((current) => [...current, newFinding]);
~~~

### Eliminar

~~~tsx
setFindings((current) =>
  current.filter((finding) => finding.id !== findingId),
);
~~~

### Actualizar un elemento

~~~tsx
setFindings((current) =>
  current.map((finding) =>
    finding.id === findingId
      ? { ...finding, status: "resolved" }
      : finding,
  ),
);
~~~

### Ordenar sin mutar

~~~tsx
setFindings((current) =>
  [...current].sort((left, right) =>
    left.title.localeCompare(right.title),
  ),
);
~~~

Copiar el arreglo no copia profundamente sus objetos. Si modificas un objeto interno, también debes crear una nueva versión de ese objeto, como hace el ejemplo con `map`.

---

## 14. Selección sin duplicar objetos

Evita guardar a la vez la colección y una copia del objeto seleccionado:

~~~tsx
const [findings, setFindings] =
  useState<readonly FindingSummary[]>(initialFindings);

const [selectedFinding, setSelectedFinding] =
  useState<FindingSummary | null>(null);
~~~

Si actualizas el elemento dentro de `findings`, la copia seleccionada puede conservar datos viejos.

Guarda la identidad mínima:

~~~tsx
const [selectedFindingId, setSelectedFindingId] =
  useState<string | null>(null);

const selectedFinding =
  selectedFindingId === null
    ? null
    : findings.find(
        (finding) => finding.id === selectedFindingId,
      ) ?? null;
~~~

Así la selección siempre se deriva de la colección actual.

Este principio se parece a normalizar datos: un hecho tiene una fuente principal y las vistas se derivan de ella.

---

## 15. Unions discriminadas para estados de interfaz

Varios booleanos pueden representar estados imposibles:

~~~tsx
const [isLoading, setIsLoading] = useState(false);
const [hasError, setHasError] = useState(false);
const [hasData, setHasData] = useState(false);
~~~

¿Qué significa `isLoading === true` y `hasError === true` al mismo tiempo? El modelo lo permite aunque la interfaz no lo quiera.

Usa una unión discriminada:

~~~ts
type FindingsRequestState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly status: "success";
      readonly findings: readonly FindingSummary[];
    }
  | {
      readonly status: "error";
      readonly message: string;
    };
~~~

Inicializa con el contrato completo:

~~~tsx
const [requestState, setRequestState] =
  useState<FindingsRequestState>({ status: "idle" });
~~~

Actualizaciones válidas:

~~~tsx
setRequestState({ status: "loading" });

setRequestState({
  status: "success",
  findings: validatedFindings,
});

setRequestState({
  status: "error",
  message: "No fue posible actualizar los hallazgos.",
});
~~~

TypeScript evita combinar `status: "success"` con una forma que no contiene los datos requeridos.

### Renderizado mediante narrowing

~~~tsx
function FindingsRequestView({
  state,
}: {
  readonly state: FindingsRequestState;
}) {
  switch (state.status) {
    case "idle":
      return <p>La actualización todavía no inicia.</p>;
    case "loading":
      return <p>Actualizando hallazgos…</p>;
    case "success":
      return <p>{state.findings.length} hallazgos recibidos.</p>;
    case "error":
      return <p role="alert">{state.message}</p>;
  }
}
~~~

El discriminante reduce la necesidad de assertions y hace visible cada estado permitido.

---

## 16. Una petición iniciada por evento con estado tipado

Todavía no profundizaremos en efectos. Una acción explícita del usuario puede iniciar una petición desde su manejador:

~~~tsx
type FindingsSdk = {
  readonly listFindings: () => Promise<readonly FindingSummary[]>;
};

type RefreshFindingsProps = {
  readonly sdk: FindingsSdk;
};

export function RefreshFindings({ sdk }: RefreshFindingsProps) {
  const [state, setState] = useState<FindingsRequestState>({
    status: "idle",
  });

  async function handleRefresh() {
    setState({ status: "loading" });

    try {
      const findings = await sdk.listFindings();
      setState({ status: "success", findings });
    } catch (error: unknown) {
      console.error("Failed to refresh findings", error);
      setState({
        status: "error",
        message: "No fue posible actualizar los hallazgos.",
      });
    }
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={state.status === "loading"}
      >
        Actualizar
      </button>

      <FindingsRequestView state={state} />
    </section>
  );
}
~~~

El mensaje visible es seguro y genérico; el detalle técnico se registra para diagnóstico. En una aplicación profesional, el logger definiría contexto y evitaría secretos.

La interfaz `FindingsSdk` no demuestra que la respuesta HTTP sea válida. La implementación del SDK debe recibir JSON como `unknown`, validarlo con Zod y solo entonces resolver `FindingSummary[]`.

---

## 17. Inicialización diferida

Si calcular el estado inicial es costoso, entrega una función inicializadora:

~~~tsx
const [filters, setFilters] = useState<FindingFilters>(() =>
  createInitialFilters(initialSerializedFilters),
);
~~~

React usa la función para obtener el estado inicial, en vez de ejecutar el cálculo como parte ordinaria de cada render.

La inicializadora debe ser pura e idempotente. No debe:

- modificar almacenamiento;
- enviar HTTP;
- generar un ID diferente cada vez;
- registrar efectos destructivos;
- depender del número de invocaciones.

En desarrollo con Strict Mode puede invocarse dos veces para ayudar a detectar impurezas.

### No confundas función inicializadora con resultado inmediato

~~~tsx
// Ejecuta la función al evaluar cada render, aunque React use solo el
// valor inicial en el montaje.
useState(createExpensiveInitialState());

// Entrega la función para inicialización diferida.
useState(createExpensiveInitialState);
~~~

Si la función necesita argumentos, usa una función flecha.

---

## 18. Validar datos persistidos antes de inicializar estado

`localStorage`, archivos, variables de entorno, respuestas HTTP y bases de datos contienen valores runtime. Un genérico de `useState` no los valida.

Supón que otra capa entrega filtros serializados:

~~~ts
import { z } from "zod";

const FindingFiltersSchema = z.object({
  query: z.string().max(100),
  priority: z.enum(["all", "low", "medium", "high"]),
}).strict();

type FindingFilters = Readonly<
  z.infer<typeof FindingFiltersSchema>
>;

const DEFAULT_FILTERS: FindingFilters = {
  query: "",
  priority: "all",
};

export function parseInitialFilters(
  serialized: string | null,
): FindingFilters {
  if (serialized === null) {
    return DEFAULT_FILTERS;
  }

  try {
    const raw: unknown = JSON.parse(serialized);
    const result = FindingFiltersSchema.safeParse(raw);

    return result.success ? result.data : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}
~~~

Después inicializas el componente:

~~~tsx
type FindingFiltersPanelProps = {
  readonly initialSerializedFilters: string | null;
};

export function FindingFiltersPanel({
  initialSerializedFilters,
}: FindingFiltersPanelProps) {
  const [filters] = useState<FindingFilters>(() =>
    parseInitialFilters(initialSerializedFilters),
  );

  return (
    <p>
      Prioridad: {filters.priority}; búsqueda: {filters.query || "vacía"}
    </p>
  );
}
~~~

La secuencia correcta es:

~~~text
string persistido
      ↓ JSON.parse
unknown
      ↓ schema Zod
FindingFilters validado
      ↓ useState
memoria local de React
~~~

`useState<FindingFilters>` solo comprueba tu código fuente. Zod inspecciona el valor real. Si existe renderizado en servidor, el acceso directo a APIs del navegador requiere además una estrategia compatible con SSR e hidratación; no lo escondas dentro de render.

---

## 19. Ejemplo integrado: espacio de trabajo de hallazgos

Este ejemplo conserva únicamente estado esencial, deriva vistas y actualiza la colección sin mutarla.

### Tipos de dominio y presentación

~~~ts
export type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved";

export type FindingSummary = {
  readonly id: string;
  readonly title: string;
  readonly status: FindingStatus;
  readonly priority: "low" | "medium" | "high";
};

export type FindingFilter = "all" | FindingStatus;
~~~

### Componente con estado local

~~~tsx
import { useState } from "react";
import type {
  FindingFilter,
  FindingSummary,
} from "./finding.types";

const STATUS_LABEL = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
} satisfies Record<FindingSummary["status"], string>;

type FindingWorkspaceProps = {
  readonly initialFindings: readonly FindingSummary[];
};

export function FindingWorkspace({
  initialFindings,
}: FindingWorkspaceProps) {
  const [findings, setFindings] =
    useState<readonly FindingSummary[]>(initialFindings);

  const [filter, setFilter] =
    useState<FindingFilter>("all");

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const visibleFindings =
    filter === "all"
      ? findings
      : findings.filter((finding) => finding.status === filter);

  const selectedFinding =
    selectedId === null
      ? null
      : findings.find((finding) => finding.id === selectedId) ?? null;

  function markResolved(findingId: string) {
    setFindings((current) =>
      current.map((finding) =>
        finding.id === findingId
          ? { ...finding, status: "resolved" }
          : finding,
      ),
    );
  }

  return (
    <section aria-labelledby="workspace-heading">
      <h1 id="workspace-heading">Hallazgos</h1>

      <nav aria-label="Filtros de hallazgos">
        {(
          [
            ["all", "Todos"],
            ["open", "Abiertos"],
            ["in_progress", "En progreso"],
            ["resolved", "Resueltos"],
          ] satisfies readonly (readonly [FindingFilter, string])[]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      <p>{visibleFindings.length} resultados visibles</p>

      {visibleFindings.length === 0 ? (
        <p>No hay hallazgos para este filtro.</p>
      ) : (
        <ul>
          {visibleFindings.map((finding) => (
            <li key={finding.id}>
              <button
                type="button"
                onClick={() => setSelectedId(finding.id)}
              >
                {finding.title}
              </button>
              <span>{STATUS_LABEL[finding.status]}</span>
              {finding.status !== "resolved" && (
                <button
                  type="button"
                  onClick={() => markResolved(finding.id)}
                  aria-label={`Resolver: ${finding.title}`}
                >
                  Resolver
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {selectedFinding !== null && (
        <aside aria-label="Hallazgo seleccionado">
          <h2>{selectedFinding.title}</h2>
          <p>{STATUS_LABEL[selectedFinding.status]}</p>
          <button type="button" onClick={() => setSelectedId(null)}>
            Cerrar detalle
          </button>
        </aside>
      )}
    </section>
  );
}
~~~

### Decisiones del ejemplo

- `initialFindings` indica que la prop inicializa una copia local intencional.
- `findings` usa un arreglo de solo lectura.
- `filter` es una union finita.
- `selectedId` modela ausencia con `null`.
- `visibleFindings`, su cantidad y `selectedFinding` son derivados.
- `map` reemplaza solo el hallazgo modificado.
- ningún objeto anterior se muta.
- los botones de filtro proporcionan literales ya tipados, sin assertion.

Este cambio local todavía no persiste en PostgreSQL. En la aplicación completa, “resolver” llamará al SDK, manejará error y confirmación, y reconciliará el resultado validado del servidor.

---

## 20. Probar el cambio de estado

Una prueba de interacción verifica lo que el usuario observa, no la implementación interna de `useState`.

~~~tsx
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindingWorkspace } from "./FindingWorkspace";

describe("FindingWorkspace", () => {
  it("actualiza un hallazgo sin perder los demás", async () => {
    const user = userEvent.setup();

    render(
      <FindingWorkspace
        initialFindings={[
          {
            id: "finding-demo-101",
            title: "Inspect backup power",
            status: "open",
            priority: "high",
          },
          {
            id: "finding-demo-102",
            title: "Review rack labeling",
            status: "in_progress",
            priority: "medium",
          },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Resolver: Inspect backup power",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Resueltos" }),
    );

    expect(
      screen.getByRole("button", {
        name: "Inspect backup power",
      }),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "Review rack labeling",
      }),
    ).not.toBeInTheDocument();
  });
});
~~~

Esta prueba demuestra una transición visible. No prueba por sí sola que:

- el SDK valide JSON;
- el Controller valide un request;
- el Service autorice la transición;
- el Repository actualice PostgreSQL;
- una imagen Docker funcione;
- el flujo E2E sobreviva a la red real.

Esas preguntas pertenecen a otras capas de testing.

---

## 21. Cuándo utilizar `useState`

Úsalo cuando el componente necesita recordar un valor que cambia y afecta su renderizado, por ejemplo:

- expandir o contraer una región;
- seleccionar una pestaña o filtro;
- controlar temporalmente un input;
- mantener un borrador local;
- seleccionar un elemento por ID;
- mostrar progreso o error de una acción explícita;
- editar una colección local antes de confirmarla;
- implementar un estado pequeño y cercano a la UI.

Empieza con estado local. Elévalo solo cuando varios componentes necesiten compartir la misma fuente de verdad.

---

## 22. Cuándo evitar `useState`

No lo uses para:

- constantes del módulo;
- valores calculables desde props o estado existente;
- duplicar un objeto ya presente en una colección;
- copiar props sin intención de crear un borrador independiente;
- guardar un valor que no afecta renderizado;
- sustituir una caché profesional de datos remotos;
- esconder estado global transversal dentro de un componente;
- realizar efectos;
- almacenar una promesa como si fuera un modelo de UI;
- validar datos externos mediante un genérico.

Si el valor no afecta la interfaz y debe ser mutable entre renders, más adelante evaluarás `useRef`. Si la lógica de transiciones crece, `useReducer` puede expresar mejor las acciones. Si el dato pertenece al servidor, su sincronización requiere una estrategia distinta al estado local aislado.

---

## 23. Errores comunes y su causa

### Error 1 — Cambiar una variable ordinaria

No solicita render ni conserva memoria entre ejecuciones.

### Error 2 — Llamar `useState` condicionalmente

Rompe el orden de Hooks que React usa para asociar cada estado.

### Error 3 — Llamar un Hook desde una utilidad común

Los Hooks solo funcionan mientras React renderiza un componente o Hook personalizado.

### Error 4 — Esperar un cambio inmediato en el mismo snapshot

El setter pone en cola el siguiente render; no modifica la constante actual.

### Error 5 — Usar reemplazo directo cuando depende del valor anterior

Varias actualizaciones pueden calcular desde el mismo snapshot. Usa un updater.

### Error 6 — Ejecutar efectos dentro de un updater

Los updaters deben ser puros y pueden invocarse más de una vez en desarrollo.

### Error 7 — Mutar un objeto y reenviarlo

Conservas la misma referencia y alteras snapshots previos.

### Error 8 — Usar `push`, `splice`, `sort` o `reverse` sobre el arreglo original

Esos métodos mutan. Produce una nueva colección.

### Error 9 — Creer que el setter de Hook mezcla objetos

Reemplaza el valor completo. Usa spread para conservar campos.

### Error 10 — Olvidar que el spread es superficial

Los objetos internos siguen compartiendo referencia. Copia cada nivel modificado.

### Error 11 — Inicializar con `[]` sin tipo

El elemento puede inferirse como `never`, bloqueando actualizaciones válidas.

### Error 12 — Inicializar con `null` sin union

El setter puede quedar limitado a `null`.

### Error 13 — Usar `useState("idle")` cuando se desea una union

El estado puede ampliarse a `string`. Declara `useState<Status>("idle")`.

### Error 14 — Crear un estado incompleto con `as`

La assertion oculta que el valor real no cumple el contrato.

### Error 15 — Guardar datos derivados

Creas sincronización manual y riesgo de valores obsoletos.

### Error 16 — Copiar una prop esperando sincronización automática

El inicializador se usa al crear esa instancia; cambios posteriores de la prop no reemplazan el estado.

### Error 17 — Duplicar el objeto seleccionado

La copia puede divergir de la colección. Guarda el ID y deriva el objeto.

### Error 18 — Modelar una petición con booleanos independientes

Permite estados contradictorios. Usa una unión discriminada.

### Error 19 — Llamar al setter durante render

Puede producir un ciclo de renders. Actualiza desde eventos o mecanismos apropiados.

### Error 20 — Usar una key aleatoria

React puede considerar que es otro componente y reiniciar su estado.

### Error 21 — Confundir estado local con persistencia

Cambiar React no actualiza automáticamente la API ni PostgreSQL.

### Error 22 — Guardar JSON externo directamente

El genérico no inspecciona runtime. Valida `unknown` con Zod antes del setter.

---

## 24. Relación explícita con la arquitectura Full Stack

~~~text
React
  ↓ estado local, eventos y presentación
HTTP
  ↓ requests/responses sin tipos runtime
Node → Router → Controller
  ↓ transporte y coordinación
Runtime Validation
  ↓ Zod convierte unknown en datos confiables
Service
  ↓ autoriza y ejecuta reglas de negocio
Repository
  ↓ persiste y consulta
PostgreSQL
  ↓ fuente durable y constraints
Testing → Docker → CI/CD → Cloud
  ↓ verificación, empaquetado y operación
~~~

### React

`useState` recuerda decisiones locales de interfaz. Puede presentar un cambio provisional, pero no convierte la UI en fuente durable.

### HTTP

Una acción puede enviar una transición y recibir otro modelo. Los tipos TypeScript no viajan en el JSON.

### Node, Router y Controller

El Router dirige la petición y el Controller traduce HTTP. No deben confiar en el estado que el frontend afirma tener.

### Runtime Validation

Requests, responses, formularios, APIs externas, archivos, variables de entorno y filas de base de datos requieren comprobación real. Zod valida el valor antes de convertirlo en entrada interna.

### Service

Decide si una transición está permitida. Que React habilite un botón no autoriza por sí solo la operación.

### Repository

Guarda y recupera el estado persistente. No expone filas PostgreSQL directamente como estado de componente.

### PostgreSQL

Constraints y transacciones protegen invariantes runtime. El estado local puede quedar desactualizado y debe reconciliarse con la respuesta del servidor.

### Testing

Testing Library comprueba transiciones visibles; Vitest prueba funciones y schemas; integración cubre HTTP/Repository; E2E valida el flujo completo.

### Docker

Empaqueta la aplicación y sus dependencias. No arregla mutaciones o estados imposibles.

### CI/CD

Typecheck, lint, tests y build deben detectar regresiones antes del despliegue. `rules-of-hooks` protege el orden de Hooks.

### Cloud

La operación real necesita logs, métricas, configuración, autenticación y manejo de fallas. Un estado `error` en React es la experiencia visible, no el diagnóstico completo.

---

## 25. Relación con los proyectos de la ruta

| Proyecto | Uso de `useState` |
| --- | --- |
| SiteOps Tracker | filtros, selección, paneles y borradores locales |
| SDK tipado para API | entrega valores validados que pueden entrar al estado |
| API REST Node.js + PostgreSQL | confirma transiciones y conserva la fuente durable |
| Analizador de configuraciones | selecciona reglas y presenta estados de análisis |
| Repositorio de algoritmos TypeScript | una UI puede conservar entrada, ejecución y resultado |
| Aplicación Full Stack | separa memoria visual de persistencia de servidor |

En portafolio, esta separación demuestra que entiendes tanto React como los límites de un sistema distribuido.

---

## 26. Ejercicio — Tablero local de acciones correctivas

Construye un componente `CorrectiveActionBoard` para acciones ficticias.

### Modelo inicial

~~~ts
type CorrectiveActionStatus =
  | "pending"
  | "in_progress"
  | "completed";

type CorrectiveAction = {
  readonly id: string;
  readonly title: string;
  readonly status: CorrectiveActionStatus;
  readonly responsibleName: string | null;
};
~~~

### Requisitos

1. Recibe `initialActions: readonly CorrectiveAction[]`.
2. Guarda la colección local con un tipo explícito.
3. Crea `ActionFilter = "all" | CorrectiveActionStatus`.
4. Inicializa el filtro en `"all"`.
5. Guarda `selectedActionId` como `string | null`.
6. Deriva la acción seleccionada desde el ID.
7. Deriva la lista visible; no la guardes en estado.
8. Deriva la cantidad visible; no la guardes en estado.
9. Implementa una transición local a `"completed"` mediante `map`.
10. No uses `push`, `splice` ni asignación por índice.
11. No muta objetos existentes.
12. Incluye un botón para limpiar la selección.
13. Presenta un estado vacío por filtro.
14. Usa keys estables.
15. Explica por qué `initialActions` solo inicializa la copia local.

### Casos que TypeScript debe rechazar

- `useState(null)` sin la union necesaria;
- filtro `"archived"`;
- estado de acción `"closed"`;
- un updater que no devuelve el arreglo;
- un elemento sin `id`;
- una asignación directa a una propiedad `readonly`.

### Pistas

1. Usa `useState<readonly CorrectiveAction[]>(initialActions)`.
2. Usa `useState<ActionFilter>("all")`.
3. Usa `useState<string | null>(null)`.
4. `filter === "all"` evita filtrar la colección.
5. `find` puede devolver `undefined`; normaliza a `null` si ese es tu contrato.
6. Para actualizar, combina `map`, un ternario y spread.
7. La cantidad es `visibleActions.length`.
8. Prueba la transición a través de un botón accesible.

### Entrega esperada

- tipos del dominio;
- componente `.tsx`;
- actualizaciones inmutables;
- valores derivados;
- dos pruebas de interacción;
- dos ejemplos `@ts-expect-error` explicados;
- explicación breve de por qué no hay persistencia todavía.

No se incluye la solución completa: debes diseñar y justificar el estado.

---

## 27. Reto Full Stack — Actualización segura de hallazgos

Amplía SiteOps Tracker con un panel que actualiza hallazgos mediante un SDK ficticio.

### Flujo

~~~text
clic del usuario
    ↓
estado local: saving
    ↓
SDK → HTTP PATCH
    ↓
Node → Router → Controller → Zod
    ↓
Service → Repository → PostgreSQL
    ↓
response JSON
    ↓
SDK valida con Zod
    ↓
estado local: success o error
~~~

### Tu reto

1. Modela `SaveFindingState` como unión discriminada.
2. Incluye `idle`, `saving`, `success` y `error`.
3. Impide combinaciones como éxito sin hallazgo.
4. Define una interfaz mínima del SDK e inyéctala por props.
5. El manejador inicia la operación; no hagas HTTP durante render.
6. La implementación del SDK recibe JSON como `unknown`.
7. Usa Zod para validar el response.
8. El setter recibe únicamente datos validados.
9. Actualiza el hallazgo en la colección con `map`.
10. Conserva todos los demás objetos sin modificación.
11. Deshabilita acciones incompatibles mientras guarda.
12. Muestra un mensaje seguro al usuario.
13. Registra el error técnico sin secretos.
14. Permite reintentar desde el estado de error.
15. Añade una prueba de éxito con SDK falso.
16. Añade una prueba de error.
17. Añade un test del schema con un estado externo desconocido.
18. Explica por qué el Controller vuelve a validar aunque React esté tipado.
19. Explica qué constraint o regla protege PostgreSQL.
20. Explica cómo CI ejecutaría typecheck, lint, pruebas y build.

### Restricciones

- No uses `any`.
- No uses `as FindingSummary` para una respuesta.
- No muta el arreglo ni sus elementos.
- No guarda datos derivados en estados adicionales.
- No usa producción en pruebas.
- No expone detalles de error internos en la interfaz.
- No presenta el estado local como confirmación durable antes de la respuesta acordada por el diseño.

### Pregunta de arquitectura

Si React muestra `resolved`, pero la petición a PostgreSQL falla, ¿qué estado debe conservar la interfaz y cómo evitarías que el usuario crea que el cambio quedó guardado?

Distingue entre:

- actualización local provisional;
- confirmación del servidor;
- rollback o reconciliación;
- mensaje visible;
- log técnico;
- prueba de integración.

---

## 28. Preguntas de comprensión

Responde sin consultar y después verifica tus ideas.

1. ¿Qué dos problemas resuelve `useState`?
2. ¿Por qué una variable local no conserva memoria de UI?
3. ¿Qué contiene la tupla devuelta por `useState`?
4. ¿Qué formas acepta el setter?
5. ¿Por qué los Hooks deben llamarse en el nivel superior?
6. ¿Desde qué funciones puedes llamar Hooks?
7. ¿Cuándo basta la inferencia de TypeScript?
8. ¿Por qué una union suele necesitar un genérico explícito?
9. ¿Cómo tipas un estado inicialmente nulo?
10. ¿Por qué `useState([])` puede ser problemático?
11. ¿Qué significa que el estado sea un snapshot?
12. ¿Por qué el valor no cambia inmediatamente dentro del manejador?
13. ¿Cuándo debes usar un updater funcional?
14. ¿Qué ocurre con tres reemplazos calculados desde el mismo snapshot?
15. ¿Qué exige la pureza de un updater?
16. ¿Por qué Strict Mode puede revelar una impureza?
17. ¿Qué es estado mínimo?
18. ¿Por qué no guardar una lista filtrada?
19. ¿Qué problema causa duplicar el objeto seleccionado?
20. ¿Por qué conviene guardar solo su ID?
21. ¿El setter de Hooks mezcla parcialmente un objeto?
22. ¿Por qué el spread es superficial?
23. ¿Qué operación reemplaza a `push`?
24. ¿Qué operación reemplaza a `splice` para eliminar?
25. ¿Cómo actualizas un objeto dentro de un arreglo?
26. ¿Qué evita una unión discriminada de petición?
27. ¿Cuándo usarías una inicializadora diferida?
28. ¿Qué propiedades debe tener esa inicializadora?
29. ¿Por qué un genérico de estado no valida `localStorage`?
30. ¿En qué punto debe actuar Zod?
31. ¿Qué diferencia existe entre estado local y PostgreSQL?
32. ¿Qué comprueba Testing Library en este tema?

---

## 29. Relevancia para entrevistas técnicas

### Pregunta: ¿Qué hace `useState`?

Conserva un valor entre renders de una instancia de componente y proporciona un setter que pone en cola el siguiente estado y solicita otro render.

### Pregunta: ¿Por qué no cambia inmediatamente la variable?

Cada render trabaja con un snapshot. El setter programa una actualización; el manejador actual continúa usando los valores del render que lo creó.

### Pregunta: ¿Cuándo usas un updater funcional?

Cuando el siguiente valor depende del anterior. React procesa el updater con el estado previo dentro de la cola, lo que evita calcular varias actualizaciones desde un snapshot obsoleto.

### Pregunta: ¿Cómo tipas `useState` con TypeScript?

Permito inferencia para primitivas claras. Declaro el genérico para unions, valores inicialmente nulos, arreglos vacíos, objetos con dominio más amplio o uniones discriminadas.

### Pregunta: ¿Por qué no mutas objetos o arreglos?

La mutación altera snapshots anteriores y conserva referencias que React y sus optimizaciones pueden tratar como no modificadas. Creo nuevas referencias con spread, `map` o `filter`.

### Pregunta: ¿Cómo eliges la estructura de estado?

Guardo la información mínima y canónica. Derivo cantidades, filtros y objetos seleccionados; evito contradicciones, duplicación y anidación profunda.

### Pregunta: ¿Cómo modelas loading, success y error?

Con una unión discriminada en lugar de booleanos independientes. Cada variante contiene solo los datos válidos para ese estado y TypeScript hace narrowing por el discriminante.

### Pregunta: ¿`useState<Finding>()` valida una respuesta HTTP?

No. El tipo se elimina en runtime. El SDK recibe el JSON como `unknown`, lo valida con Zod y solo después actualiza el estado.

### Respuesta breve de 30 segundos

> I use state for the minimum UI memory that must survive renders. TypeScript inference is enough for simple primitives, while explicit generics model literal unions, nullable selections, empty collections, and discriminated request states. I treat each render as a snapshot and use functional updaters whenever the next value depends on the previous one. Objects and arrays are replaced immutably, and derived values stay out of state. External JSON remains unknown until a runtime schema validates it.

---

## 30. Checklist profesional

Antes de considerar listo un estado local, comprueba:

- [ ] El valor afecta lo que se renderiza.
- [ ] Debe sobrevivir entre renders.
- [ ] No puede derivarse de props o estado existente.
- [ ] El propietario del estado es el componente correcto.
- [ ] El Hook está en el nivel superior.
- [ ] El Hook pertenece a un componente o Hook personalizado.
- [ ] La inferencia produce el dominio deseado.
- [ ] Las unions tienen un genérico explícito.
- [ ] La ausencia se modela con `null` o una variante.
- [ ] Los arreglos vacíos tienen tipo de elemento.
- [ ] No se fabrican valores incompletos con assertions.
- [ ] El setter se entiende como solicitud de otro render.
- [ ] El código no espera cambio inmediato en el snapshot actual.
- [ ] Se usa updater cuando el siguiente valor depende del anterior.
- [ ] Los updaters son puros.
- [ ] Los objetos se reemplazan sin mutación.
- [ ] Se copian todos los niveles modificados.
- [ ] Los arreglos usan spread, `filter` o `map`.
- [ ] No se usa `sort` sobre el arreglo original.
- [ ] El estado contiene solo información esencial.
- [ ] Los conteos y filtros se derivan.
- [ ] La selección guarda un ID cuando ya existe la colección.
- [ ] No se copian props salvo que sean valores iniciales deliberados.
- [ ] Los estados de petición no admiten combinaciones imposibles.
- [ ] La inicializadora diferida es pura.
- [ ] Los datos persistidos empiezan como `unknown`.
- [ ] Zod valida antes de actualizar con datos externos.
- [ ] Los errores visibles no filtran detalles sensibles.
- [ ] La interacción importante tiene una prueba.
- [ ] Lint aplica las reglas de Hooks.
- [ ] Typecheck, pruebas y build forman parte de CI.
- [ ] El estado local no se confunde con persistencia confirmada.

---

## 31. Resumen

- Una variable local no conserva memoria de UI ni solicita render.
- `useState` conserva un valor y proporciona un setter.
- El setter acepta un reemplazo o un updater funcional.
- Los Hooks se llaman en el nivel superior de componentes o Hooks personalizados.
- React depende de un orden estable de llamadas.
- TypeScript infiere bien booleanos, strings y números sencillos.
- Las unions, `null`, arreglos vacíos y objetos amplios suelen requerir un genérico.
- Las assertions no sustituyen un estado inicial válido.
- Cada render observa un snapshot fijo.
- El setter pone en cola una actualización; no reescribe el snapshot actual.
- Cuando el siguiente valor depende del anterior, usa un updater.
- React puede agrupar varias actualizaciones antes del siguiente render.
- Los updaters e inicializadores deben ser puros.
- Strict Mode puede invocarlos más de una vez en desarrollo para detectar impurezas.
- Guarda solo el estado mínimo y deriva el resto.
- No almacenes conteos o listas filtradas que puedes calcular.
- No copies props a estado sin una intención explícita.
- Un setter de Hook reemplaza el objeto completo; no hace merge parcial.
- Los objetos de estado se actualizan creando nuevas versiones.
- El spread es superficial.
- Los arreglos se actualizan con spread, `filter` y `map`.
- `push`, `splice`, `sort` y `reverse` mutan el arreglo original.
- Guarda IDs para selección si el objeto ya vive en una colección.
- Una unión discriminada evita estados de petición contradictorios.
- La inicialización diferida evita recalcular innecesariamente el valor inicial.
- Los tipos TypeScript desaparecen en runtime.
- `useState<T>` no valida HTTP, formularios, APIs, archivos, entorno ni PostgreSQL.
- Los datos externos entran como `unknown` y se validan con Zod.
- El estado local de React no equivale a persistencia del servidor.
- Testing Library verifica la transición observable de la interfaz.
- Typecheck, lint, pruebas y build protegen riesgos distintos.

---

## Referencias oficiales consultadas

- [React — `useState`](https://react.dev/reference/react/useState)
- [React — State: A Component’s Memory](https://react.dev/learn/state-a-components-memory)
- [React — State as a Snapshot](https://react.dev/learn/state-as-a-snapshot)
- [React — Queueing a Series of State Updates](https://react.dev/learn/queueing-a-series-of-state-updates)
- [React — Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [React — Updating Objects in State](https://react.dev/learn/updating-objects-in-state)
- [React — Updating Arrays in State](https://react.dev/learn/updating-arrays-in-state)
- [React — Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [React — Using TypeScript](https://react.dev/learn/typescript)
- [React — Reacting to Input with State](https://react.dev/learn/reacting-to-input-with-state)
- [Zod — Defining schemas](https://zod.dev/api)
- [Testing Library — React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library — User Interactions](https://testing-library.com/docs/user-event/intro/)
- [Vitest — Mocking Functions and Objects](https://vitest.dev/guide/mocking/functions)

Consultadas el **9 de octubre de 2026**.

---

# Próxima lección

**Lección 36 — Formularios controlados con TypeScript: eventos, estado y validación de entradas.**
