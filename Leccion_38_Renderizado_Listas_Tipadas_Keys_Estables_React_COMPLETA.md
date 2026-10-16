# Lección 38 — Renderizado de listas tipadas y keys estables en React

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — colecciones, identidad y reconciliación  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## 1. Introducción

En la lección anterior elevaste estado para coordinar filtros, selección y detalle entre varios componentes. Esa coordinación normalmente termina mostrando una colección dinámica: hallazgos, activos, sedes, responsables o acciones correctivas.

React permite transformar un array en elementos JSX mediante `map`. La sintaxis es sencilla; la parte importante aparece cuando la colección cambia:

- entra un hallazgo nuevo;
- se elimina un activo;
- se reordena una tabla;
- un filtro oculta varios elementos;
- llega otra página desde la API;
- una fila conserva estado local, foco o un borrador.

Para relacionar cada elemento anterior con el siguiente, React necesita una identidad estable. Esa identidad se expresa con `key`.

Una `key` incorrecta puede producir errores difíciles de detectar: el texto escrito en una fila aparece en otra, se pierde el foco, un panel abierto cambia de registro o un componente se reinicia sin motivo aparente.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. renderizar arrays tipados con `map`, `filter` y componentes reutilizables;
2. explicar por qué React necesita `key`;
3. elegir identidades únicas, estables y ligadas a los datos;
4. reconocer cuándo un índice, `Math.random()` o `useId` no sirven como `key`;
5. colocar la `key` en el elemento correcto, incluso con componentes extraídos y Fragments;
6. ordenar colecciones sin mutar props ni estado;
7. validar arrays recibidos en runtime y detectar identificadores duplicados;
8. probar que el estado local permanece asociado con el elemento correcto después de reordenar;
9. conectar las identidades de React con HTTP, Node.js, Services, Repositories y PostgreSQL sin confundir sus responsabilidades.

---

## 3. El problema que resuelve el renderizado de listas

Podríamos escribir cada hallazgo manualmente:

~~~tsx
export function HardcodedFindings() {
  return (
    <ul>
      <li>UPS sin monitoreo</li>
      <li>Rack sin identificación</li>
      <li>Inventario desactualizado</li>
    </ul>
  );
}
~~~

Pero una aplicación real no conoce de antemano el número de resultados. La información puede venir de PostgreSQL a través de una API y cambiar entre solicitudes.

Modelamos la colección como datos:

~~~ts
type FindingStatus = "open" | "in_progress" | "resolved";

type Finding = {
  id: string;
  title: string;
  status: FindingStatus;
};

const findings: readonly Finding[] = [
  {
    id: "finding-demo-01",
    title: "UPS sin monitoreo",
    status: "open",
  },
  {
    id: "finding-demo-02",
    title: "Rack sin identificación",
    status: "in_progress",
  },
];
~~~

Luego transformamos cada objeto en JSX:

~~~tsx
export function FindingsList() {
  return (
    <ul>
      {findings.map((finding) => (
        <li key={finding.id}>
          {finding.title} — {finding.status}
        </li>
      ))}
    </ul>
  );
}
~~~

TypeScript infiere que `finding` es `Finding`; React usa `finding.id` para conservar la identidad entre renderizaciones.

---

## 4. Funcionamiento de `map` con JSX, paso a paso

`map` no modifica el array original. Produce uno nuevo con un resultado por elemento.

~~~tsx
const listItems = findings.map((finding) => (
  <li key={finding.id}>{finding.title}</li>
));

return <ul>{listItems}</ul>;
~~~

El proceso conceptual es:

1. `findings` contiene objetos del dominio de la UI.
2. `map` recibe cada `Finding`.
3. El callback devuelve un elemento JSX.
4. El resultado es un array de elementos renderizables.
5. React compara ese array con el de la renderización anterior.
6. Las `key` ayudan a reconocer qué identidad continúa, se mueve, aparece o desaparece.

También puede escribirse directamente dentro del JSX. Elegir una variable intermedia o una expresión en línea es una decisión de legibilidad, no de comportamiento.

---

## 5. Filtrar y después renderizar

`filter` conserva solo los elementos que cumplen una condición; `map` los convierte en JSX.

~~~tsx
type FindingsByStatusProps = Readonly<{
  findings: readonly Finding[];
  status: FindingStatus;
}>;

export function FindingsByStatus({
  findings,
  status,
}: FindingsByStatusProps) {
  const visibleFindings = findings.filter(
    (finding) => finding.status === status,
  );

  if (visibleFindings.length === 0) {
    return <p>No hay hallazgos con ese estado.</p>;
  }

  return (
    <ul>
      {visibleFindings.map((finding) => (
        <li key={finding.id}>{finding.title}</li>
      ))}
    </ul>
  );
}
~~~

`visibleFindings` es información derivada. No necesita otro `useState` si puede calcularse desde `findings` y `status` durante el render.

`filter` y `map` crean arrays nuevos. No cambian las props recibidas.

---

## 6. Razón de existir de `key`

Sin una identidad explícita, React solo tiene la posición para intentar relacionar elementos:

~~~tsx
// React mostrará una advertencia: falta una key única.
{findings.map((finding) => (
  <li>{finding.title}</li>
))}
~~~

La posición funciona mal cuando la colección puede cambiar. Si eliminamos el primer elemento, el que antes ocupaba la segunda posición pasa a la primera. ¿Es el mismo componente que se movió o debe reemplazar al anterior?

La `key` responde:

> “Este elemento representa la misma identidad de datos que tenía esta clave en la renderización anterior”.

~~~tsx
{findings.map((finding) => (
  <li key={finding.id}>{finding.title}</li>
))}
~~~

Una buena `key` permite que React asocie correctamente:

- estado local;
- nodos DOM;
- foco;
- selección de texto;
- referencias;
- trabajo pendiente del componente;
- posición después de insertar, eliminar u ordenar.

---

## 7. Cómo usa React las keys conceptualmente

Supongamos esta primera renderización:

| Posición | `key` | Título |
|---:|---|---|
| 0 | `finding-demo-01` | UPS sin monitoreo |
| 1 | `finding-demo-02` | Rack sin identificación |
| 2 | `finding-demo-03` | Inventario desactualizado |

Después de ordenar por título:

| Posición | `key` | Título |
|---:|---|---|
| 0 | `finding-demo-03` | Inventario desactualizado |
| 1 | `finding-demo-02` | Rack sin identificación |
| 2 | `finding-demo-01` | UPS sin monitoreo |

Aunque cambien las posiciones, las identidades no cambian. React puede relacionar `finding-demo-01` con la misma instancia lógica y moverla.

De forma simplificada, al comparar hijos React considera la `key` y el tipo de elemento o componente. Una coincidencia estable permite preservar la identidad; una clave nueva representa otra entidad y puede provocar montaje nuevo y pérdida del estado anterior.

La `key` no es una optimización cosmética. Forma parte del modelo de identidad de la UI.

---

## 8. Las tres propiedades de una buena key

### 8.1 Única entre hermanos

Dos elementos del mismo array renderizado no deben compartir clave.

~~~tsx
// Correcto si cada finding.id es único en esta lista.
{findings.map((finding) => (
  <FindingRow key={finding.id} finding={finding} />
))}
~~~

No necesita ser globalmente única en toda la aplicación. Otra lista independiente puede reutilizar el mismo ID.

### 8.2 Estable entre renderizaciones

La identidad debe conservar la misma clave aunque cambien la posición, el estado o el título.

### 8.3 Ligada al dato

La clave debe proceder de la entidad, no de la ejecución del render. Un ID persistente de PostgreSQL suele ser una excelente opción.

---

## 9. `key` no es una prop del componente

React consume `key` internamente. El componente no la recibe dentro de sus props.

~~~tsx
type FindingRowProps = Readonly<{
  findingId: string;
  title: string;
}>;

function FindingRow({ findingId, title }: FindingRowProps) {
  return (
    <li data-finding-id={findingId}>
      {title}
    </li>
  );
}

function List({ findings }: { findings: readonly Finding[] }) {
  return (
    <ul>
      {findings.map((finding) => (
        <FindingRow
          key={finding.id}
          findingId={finding.id}
          title={finding.title}
        />
      ))}
    </ul>
  );
}
~~~

Si el hijo necesita el identificador, pásalo explícitamente como `findingId` o dentro de `finding`. No intentes leer `props.key`.

---

## 10. Por qué el índice suele ser una mala key

Este código compila y puede parecer correcto:

~~~tsx
{findings.map((finding, index) => (
  <FindingDraftRow key={index} finding={finding} />
))}
~~~

Ahora cada fila conserva un borrador local:

~~~tsx
import { useState } from "react";

type FindingDraftRowProps = Readonly<{
  finding: Finding;
}>;

function FindingDraftRow({ finding }: FindingDraftRowProps) {
  const [note, setNote] = useState("");

  return (
    <li>
      <strong>{finding.title}</strong>
      <label>
        Nota local
        <input
          value={note}
          onChange={(event) => {
            setNote(event.currentTarget.value);
          }}
        />
      </label>
    </li>
  );
}
~~~

Si se elimina el primer hallazgo, el elemento que estaba en el índice `1` pasa al `0`. React encuentra la misma clave posicional `0` y puede reutilizar el estado que pertenecía a otro registro. La nota parece “moverse”.

La solución es ligar la identidad al dato:

~~~tsx
{findings.map((finding) => (
  <FindingDraftRow key={finding.id} finding={finding} />
))}
~~~

El índice solo es razonable en un caso estrecho: lista verdaderamente estática, sin reordenamiento, inserciones, eliminaciones ni estado por elemento. Aun así, un ID explícito comunica mejor la intención.

---

## 11. Por qué no usar valores aleatorios

Estas claves cambian en cada render:

~~~tsx
// Incorrecto: una identidad nueva en cada renderización.
<FindingRow key={Math.random()} finding={finding} />

// También incorrecto si se ejecuta durante cada render.
<FindingRow key={crypto.randomUUID()} finding={finding} />
~~~

React interpreta todos los elementos como nuevos:

- desmonta componentes anteriores;
- monta otros;
- pierde estado local y foco;
- recrea nodos DOM;
- ejecuta trabajo innecesario.

Un UUID es útil si se genera **una vez cuando nace el dato**, no cada vez que se pinta.

~~~tsx
import { useState } from "react";

type LocalFinding = {
  id: string;
  title: string;
  status: FindingStatus;
};

function LocalFindingsExample() {
  const [items, setItems] = useState<LocalFinding[]>([]);

  function addLocalFinding(title: string) {
    const newFinding: LocalFinding = {
      id: crypto.randomUUID(),
      title,
      status: "open",
    };

    setItems((current) => [...current, newFinding]);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => addLocalFinding("Hallazgo ficticio")}
      >
        Agregar
      </button>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </>
  );
}
~~~

Aquí el ID se guarda dentro de la entidad y permanece estable.

---

## 12. `useId` tampoco genera keys de listas

`useId` está diseñado principalmente para relacionar atributos de accesibilidad y evitar colisiones entre instancias, por ejemplo `label` e `input`.

No lo uses para fabricar claves de datos:

~~~tsx
// Incorrecto como estrategia de identidad de una colección.
const generatedId = useId();
~~~

Además, los Hooks no pueden llamarse dentro de un `map` ni de manera condicional. La identidad de una lista debe proceder de los datos.

Usa `useId` para relaciones como esta:

~~~tsx
import { useId } from "react";

function SearchField() {
  const inputId = useId();

  return (
    <>
      <label htmlFor={inputId}>Buscar hallazgos</label>
      <input id={inputId} />
    </>
  );
}
~~~

El propósito es distinto de identificar una entidad `Finding`.

---

## 13. Fuentes apropiadas de identidad

### Datos persistidos

Usa una clave primaria estable de PostgreSQL o el identificador público establecido por la API:

~~~tsx
<FindingRow key={finding.id} finding={finding} />
~~~

### Datos locales persistentes

Genera el identificador al crear el dato y consérvalo:

~~~ts
const item = {
  id: crypto.randomUUID(),
  title: "Activo ficticio",
};
~~~

### Clave compuesta

Úsala solo cuando ninguna propiedad sea única por sí sola y las partes sean estables:

~~~tsx
<PermissionRow
  key={`${permission.siteId}:${permission.userId}`}
  permission={permission}
/>
~~~

Evita títulos, nombres o estados que una persona pueda modificar.

### Elementos optimistas

Si el servidor todavía no devuelve ID, crea una identidad de UI una sola vez y no la reemplaces como `key` al llegar la respuesta:

~~~ts
type OptimisticFinding = {
  uiId: string;
  serverId: string | null;
  title: string;
  status: "pending" | "saved" | "failed";
};

const optimisticFinding: OptimisticFinding = {
  uiId: crypto.randomUUID(),
  serverId: null,
  title: "Hallazgo ficticio pendiente",
  status: "pending",
};
~~~

`uiId` puede seguir siendo la `key`; `serverId` identifica el recurso remoto cuando esté disponible. Cambiar la `key` durante la confirmación reiniciaría el componente.

---

## 14. La key pertenece al elemento devuelto por `map`

Este código coloca la clave demasiado abajo:

~~~tsx
function FindingRow({ finding }: { finding: Finding }) {
  return <li key={finding.id}>{finding.title}</li>;
}

// Incorrecto: los hermanos directos son FindingRow sin key.
{findings.map((finding) => (
  <FindingRow finding={finding} />
))}
~~~

La clave debe estar donde se crea el array de hermanos:

~~~tsx
function FindingRow({ finding }: { finding: Finding }) {
  return <li>{finding.title}</li>;
}

{findings.map((finding) => (
  <FindingRow key={finding.id} finding={finding} />
))}
~~~

Regla práctica: coloca `key` en el elemento JSX más externo que devuelve el callback de `map`.

---

## 15. Varias etiquetas por elemento: usa `Fragment` explícito

La sintaxis corta `<>...</>` no acepta una `key`. Si cada elemento produce varios nodos sin contenedor adicional, importa `Fragment`:

~~~tsx
import { Fragment } from "react";

type SiteGroup = {
  siteId: string;
  siteName: string;
  findings: readonly Finding[];
};

function FindingsBySite({
  groups,
}: {
  groups: readonly SiteGroup[];
}) {
  return (
    <>
      {groups.map((group) => (
        <Fragment key={group.siteId}>
          <h2>{group.siteName}</h2>
          <ul>
            {group.findings.map((finding) => (
              <li key={finding.id}>{finding.title}</li>
            ))}
          </ul>
        </Fragment>
      ))}
    </>
  );
}
~~~

Hay dos niveles de hermanos:

- cada grupo necesita una `key` respecto de los otros grupos;
- cada hallazgo necesita una `key` respecto de los otros hallazgos de su lista.

Las claves se evalúan dentro de su conjunto de hermanos, no globalmente.

---

## 16. Ordenar sin mutar props ni estado

`Array.prototype.sort()` muta el array. No lo ejecutes directamente sobre props o estado.

~~~ts
type SortMode = "title" | "severity";

const SEVERITY_RANK: Readonly<Record<
  "low" | "medium" | "high",
  number
>> = {
  low: 1,
  medium: 2,
  high: 3,
};

function sortFindings(
  findings: readonly DetailedFinding[],
  mode: SortMode,
): DetailedFinding[] {
  const copy = [...findings];

  if (mode === "title") {
    return copy.sort((left, right) =>
      left.title.localeCompare(right.title),
    );
  }

  return copy.sort(
    (left, right) =>
      SEVERITY_RANK[right.severity] -
      SEVERITY_RANK[left.severity],
  );
}
~~~

La copia protege la inmutabilidad de la entrada. Las `key` estables permiten que los elementos mantengan identidad aunque el orden resultante cambie.

En entornos que incluyan ES2023 también existe `toSorted`, que devuelve un array nuevo. Verifica el objetivo de compilación y soporte antes de adoptarlo.

---

## 17. TypeScript tipa la forma, no garantiza IDs únicos

Este tipo asegura que existe un `id: string`:

~~~ts
type Entity = {
  id: string;
};
~~~

Pero TypeScript no impide este array en runtime:

~~~ts
const duplicated: Entity[] = [
  { id: "same-id" },
  { id: "same-id" },
];
~~~

Tampoco puede demostrar que el ID permanecerá estable mañana. La unicidad y estabilidad dependen de los datos, el contrato HTTP y la persistencia.

Esto refuerza la separación:

- **type checking:** revisa cómo usa tu código un `id`;
- **validación runtime:** examina los valores reales recibidos;
- **restricción de base de datos:** evita duplicados persistidos;
- **diseño de identidad:** garantiza que un recurso conserva su ID.

---

## 18. Validar la colección y sus IDs con Zod

Definamos el modelo completo de esta lección:

~~~ts
import * as z from "zod";

export const FindingStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
]);

export const FindingSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
]);

export const FindingSchema = z
  .object({
    id: z.string().trim().min(1),
    siteId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().max(1_000),
    status: FindingStatusSchema,
    severity: FindingSeveritySchema,
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const FindingListSchema = z
  .array(FindingSchema)
  .superRefine((findings, context) => {
    const seenIds = new Set<string>();

    findings.forEach((finding, index) => {
      if (seenIds.has(finding.id)) {
        context.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `ID duplicado: ${finding.id}`,
        });
      }

      seenIds.add(finding.id);
    });
  });

export type FindingStatus = z.infer<
  typeof FindingStatusSchema
>;
export type FindingSeverity = z.infer<
  typeof FindingSeveritySchema
>;
export type DetailedFinding = z.infer<typeof FindingSchema>;
~~~

`superRefine` comprueba una relación entre elementos del array. Un esquema por objeto no puede detectar por sí solo que otro elemento repite el mismo ID.

La validación de una respuesta HTTP podría ser:

~~~ts
export async function fetchFindings(
  baseUrl: string,
): Promise<readonly DetailedFinding[]> {
  const response = await fetch(`${baseUrl}/findings`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  return FindingListSchema.parse(payload);
}
~~~

La anotación de retorno no valida JSON. El `parse` sí ejecuta comprobaciones en runtime.

---

## 19. Ejemplo completo: lista ordenable de SiteOps Tracker

Cada tarjeta mantiene localmente si está expandida. Al cambiar el orden, la `key={finding.id}` hace que esa expansión continúe asociada con el hallazgo correcto.

~~~tsx
import {
  useState,
  type ChangeEvent,
} from "react";
import * as z from "zod";

const SortModeSchema = z.enum([
  "newest",
  "severity",
  "title",
]);

type SortMode = z.infer<typeof SortModeSchema>;
type StatusFilter = "all" | FindingStatus;

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En progreso" },
  { value: "resolved", label: "Resueltos" },
] as const satisfies readonly {
  value: StatusFilter;
  label: string;
}[];

const SEVERITY_RANK: Readonly<Record<
  FindingSeverity,
  number
>> = {
  low: 1,
  medium: 2,
  high: 3,
};

function compareFindings(
  left: DetailedFinding,
  right: DetailedFinding,
  mode: SortMode,
): number {
  switch (mode) {
    case "newest":
      return Date.parse(right.createdAt) - Date.parse(left.createdAt);
    case "severity":
      return (
        SEVERITY_RANK[right.severity] -
        SEVERITY_RANK[left.severity]
      );
    case "title":
      return left.title.localeCompare(right.title);
  }
}

type FindingCardProps = Readonly<{
  finding: DetailedFinding;
}>;

function FindingCard({ finding }: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const detailsId = `finding-details-${finding.id}`;

  return (
    <article>
      <h3>{finding.title}</h3>
      <p>
        Estado: {finding.status} · Severidad: {finding.severity}
      </p>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        onClick={() => setIsExpanded((current) => !current)}
      >
        {isExpanded
          ? `Ocultar detalles de ${finding.title}`
          : `Ver detalles de ${finding.title}`}
      </button>

      {isExpanded && (
        <p id={detailsId}>{finding.description}</p>
      )}
    </article>
  );
}

type FindingCardListProps = Readonly<{
  findings: readonly DetailedFinding[];
}>;

export function FindingCardList({
  findings,
}: FindingCardListProps) {
  if (findings.length === 0) {
    return <p>No hay hallazgos para mostrar.</p>;
  }

  return (
    <ul aria-label="Hallazgos de infraestructura">
      {findings.map((finding) => (
        <li key={finding.id}>
          <FindingCard finding={finding} />
        </li>
      ))}
    </ul>
  );
}

type FindingsBoardProps = Readonly<{
  findings: readonly DetailedFinding[];
}>;

export function FindingsBoard({ findings }: FindingsBoardProps) {
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [sortMode, setSortMode] =
    useState<SortMode>("newest");

  const visibleFindings = findings
    .filter(
      (finding) =>
        statusFilter === "all" ||
        finding.status === statusFilter,
    )
    .sort((left, right) =>
      compareFindings(left, right, sortMode),
    );

  function handleSortChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const parsed = SortModeSchema.safeParse(
      event.currentTarget.value,
    );

    if (parsed.success) {
      setSortMode(parsed.data);
    }
  }

  return (
    <section aria-labelledby="findings-board-title">
      <h1 id="findings-board-title">Hallazgos</h1>

      <div role="group" aria-label="Filtrar por estado">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={statusFilter === option.value}
            onClick={() => setStatusFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label htmlFor="findings-sort">Ordenar por</label>
      <select
        id="findings-sort"
        value={sortMode}
        onChange={handleSortChange}
      >
        <option value="newest">Más recientes</option>
        <option value="severity">Severidad</option>
        <option value="title">Título</option>
      </select>

      <p role="status">
        {visibleFindings.length} hallazgo(s) visible(s)
      </p>

      <FindingCardList findings={visibleFindings} />
    </section>
  );
}
~~~

### Observación importante sobre `filter` y `sort`

`filter` ya produce un array nuevo. Por eso, en este encadenamiento, el `sort` muta solo ese resultado nuevo y no la prop `findings`.

Si no hubiera un `filter` antes, sería necesario copiar:

~~~ts
const ordered = [...findings].sort((left, right) =>
  compareFindings(left, right, sortMode),
);
~~~

---

## 20. Funcionamiento del ejemplo completo

1. `FindingsBoard` recibe una colección ya validada.
2. El filtro y el modo de orden son estado de UI.
3. `filter` produce la colección visible.
4. `sort` establece su orden sin mutar la prop original.
5. `FindingCardList` produce un `li` por hallazgo.
6. Cada `li` usa el ID persistente como `key`.
7. `FindingCard` conserva localmente `isExpanded`.
8. Si cambia el orden, React encuentra la misma `key` y mantiene la expansión con su entidad.
9. El `select` entrega un `string` de runtime; Zod lo comprueba antes de actualizar `SortMode`.
10. Un array vacío produce un estado visible explícito.

La lista no usa el índice, el título ni un valor aleatorio como identidad.

---

## 21. Crear un componente genérico para colecciones tipadas

Un componente genérico puede reutilizar la estructura sin imponer un modelo concreto:

~~~tsx
import type { Key, ReactNode } from "react";

type KeyedListProps<T> = Readonly<{
  items: readonly T[];
  getKey: (item: T) => Key;
  renderItem: (item: T) => ReactNode;
  emptyMessage: string;
  ariaLabel: string;
}>;

export function KeyedList<T>({
  items,
  getKey,
  renderItem,
  emptyMessage,
  ariaLabel,
}: KeyedListProps<T>) {
  if (items.length === 0) {
    return <p>{emptyMessage}</p>;
  }

  return (
    <ul aria-label={ariaLabel}>
      {items.map((item) => (
        <li key={getKey(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
~~~

Uso con hallazgos:

~~~tsx
<KeyedList
  items={findings}
  getKey={(finding) => finding.id}
  renderItem={(finding) => (
    <FindingCard finding={finding} />
  )}
  emptyMessage="No hay hallazgos."
  ariaLabel="Hallazgos"
/>
~~~

TypeScript infiere `T` desde `items`. El diseño es flexible, pero `getKey` no puede demostrar estabilidad o unicidad; esas siguen siendo responsabilidades del contrato de datos.

No extraigas una abstracción genérica solo por tener dos usos. Hazlo cuando exista una estructura repetida y el contrato siga siendo fácil de entender.

---

## 22. Semántica y accesibilidad de las listas

Usa el elemento que represente la información:

- `ul`/`li` para colecciones sin orden significativo;
- `ol`/`li` cuando el orden comunica rango o pasos;
- `table`, `thead`, `tbody`, `tr` y celdas para datos tabulares;
- componentes específicos cuando la interacción requiere otra semántica.

Una tabla de activos conserva la `key` en cada fila:

~~~tsx
type Asset = {
  id: string;
  tag: string;
  category: string;
};

function AssetsTable({ assets }: { assets: readonly Asset[] }) {
  return (
    <table>
      <caption>Activos de la sede</caption>
      <thead>
        <tr>
          <th scope="col">Etiqueta</th>
          <th scope="col">Categoría</th>
        </tr>
      </thead>
      <tbody>
        {assets.map((asset) => (
          <tr key={asset.id}>
            <th scope="row">{asset.tag}</th>
            <td>{asset.category}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
~~~

Una `key` correcta no reemplaza la semántica HTML. React la usa internamente; las tecnologías de asistencia necesitan elementos, nombres y relaciones accesibles.

---

## 23. Cuándo utilizar listas renderizadas

Usa `map` y una identidad estable cuando:

- la cantidad de elementos depende de datos;
- varias entidades comparten la misma presentación;
- la API devuelve resultados, páginas o grupos;
- la colección puede filtrarse, ordenarse, insertar o eliminar;
- necesitas extraer una fila o tarjeta reusable;
- pruebas y accesibilidad se benefician de una estructura semántica repetible.

En SiteOps Tracker aplica a:

- sedes;
- activos;
- hallazgos;
- responsables;
- acciones correctivas;
- eventos de historial;
- resultados de búsqueda;
- registros del analizador de configuraciones.

---

## 24. Cuándo evitar o reconsiderar el patrón

No conviertas todo bloque repetido en un array si:

- son pocos elementos fijos con semántica y comportamiento distintos;
- cada sección tiene una estructura única;
- abstraer los datos oculta más de lo que simplifica;
- el orden visual no procede de una colección real;
- una lista enorme requiere virtualización y el render completo no es viable.

Tampoco uses una `key` para:

- transportar un ID al hijo;
- ocultar errores de estado;
- forzar actualizaciones rutinarias;
- generar selectores CSS;
- sustituir restricciones únicas de la base de datos.

Una `key` puede reiniciar intencionalmente un subárbol, pero no debería cambiar sin una razón de identidad.

---

## 25. Errores comunes y sus causas

### Error 1: omitir la key

React advierte que cada hijo de una lista necesita una identidad única.

### Error 2: colocar la key dentro del componente extraído

La identidad debe estar en el elemento directamente producido por `map`.

### Error 3: usar el índice en una colección dinámica

Al insertar, eliminar u ordenar, el estado puede quedar asociado con otra entidad.

### Error 4: usar `Math.random()`

Todas las identidades cambian en cada render y los componentes se recrean.

### Error 5: ejecutar `crypto.randomUUID()` dentro de `map`

Un buen generador usado en el momento equivocado sigue creando claves inestables. Genera al crear la entidad.

### Error 6: usar `useId` como key de datos

`useId` resuelve IDs de accesibilidad, no identidad de colecciones.

### Error 7: usar un título mutable

Puede cambiar o repetirse. Usa un identificador estable.

### Error 8: duplicar IDs entre hermanos

TypeScript no garantiza unicidad. Valida el payload y aplica restricciones persistentes.

### Error 9: esperar recibir `key` en props

React la consume. Pasa el ID por otra prop.

### Error 10: mutar props con `sort`

Ordena una copia o un array producido por otra operación no mutante.

### Error 11: llamar Hooks dentro de `map`

Los Hooks deben ejecutarse en el nivel superior de un componente. Extrae un componente de fila y usa el Hook allí.

### Error 12: usar la sintaxis corta de Fragment con key

`<>...</>` no acepta `key`; usa `<Fragment key={...}>`.

### Error 13: usar la misma key para todas las filas

Que el valor tenga tipo `string` no lo hace único.

### Error 14: confundir key de React con clave primaria

Pueden compartir el mismo valor, pero resuelven problemas distintos: reconciliación de UI frente a integridad persistente.

### Error 15: asumir que una respuesta anotada está validada

`const data: Finding[] = await response.json()` no comprueba el JSON. Usa `unknown` y un esquema runtime.

---

## 26. TypeScript desaparece en runtime

Este código convence al compilador, no al programa en ejecución:

~~~ts
const payload = (await response.json()) as DetailedFinding[];
~~~

Si el servidor devuelve IDs vacíos, duplicados o tipos incorrectos, la aserción no los corrige.

Debes validar datos procedentes de:

- HTTP;
- formularios;
- APIs externas;
- archivos;
- variables de entorno;
- bases de datos;
- colas y eventos.

Zod puede validar forma y unicidad dentro de una respuesta. PostgreSQL puede garantizar unicidad persistente. React puede usar el ID resultante como `key`. Cada mecanismo actúa en una etapa diferente.

---

## 27. Relación con la arquitectura Full Stack

El flujo objetivo sigue siendo:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

| Capa | Relación con listas e identidad |
|---|---|
| React | Renderiza colecciones y usa `key` para reconciliar identidades |
| HTTP/SDK | Transporta páginas, filtros y respuestas; valida JSON antes de entregarlo |
| Node.js | Recibe parámetros no confiables de búsqueda, orden y paginación |
| Router | Asocia una ruta como `GET /findings` con su Controller |
| Controller | Traduce query params y respuesta HTTP |
| Runtime Validation | Comprueba filtros, límites, cursores y arrays externos |
| Service | Aplica autorización y reglas del caso de uso |
| Repository | Ejecuta lecturas con orden determinista y parámetros seguros |
| PostgreSQL | Proporciona claves primarias, unicidad y datos persistidos |
| Testing | Verifica contenido, reordenamiento e identidad observable |
| Docker | Reproduce frontend, API y base de datos |
| CI/CD | Ejecuta typecheck, ESLint, pruebas y build |
| Cloud | Opera paginación, logs, métricas y escalamiento con datos reales |

Un Repository podría imponer orden determinista con un criterio secundario estable:

~~~sql
SELECT id, site_id, title, status, severity, created_at
FROM findings
WHERE site_id = $1
ORDER BY created_at DESC, id DESC
LIMIT $2;
~~~

El `id` ayuda a estabilizar el orden cuando dos filas comparten fecha. Aun así, `key={finding.id}` es una decisión de React; la clave primaria y `UNIQUE` son garantías de PostgreSQL.

---

## 28. ESLint, pruebas y calidad

El compilador puede comprobar tipos, pero no todas las reglas de identidad.

Una configuración profesional puede combinar:

- TypeScript estricto;
- ESLint;
- `typescript-eslint` para operaciones inseguras;
- reglas de React como detección de `key` ausente;
- una regla que desaliente índices como `key`;
- Vitest y Testing Library;
- revisión de código;
- validación runtime.

CI puede ejecutar:

~~~text
typecheck → lint → pruebas → build
~~~

Ninguna herramienta aislada demuestra que un ID sea semánticamente estable. Esa decisión también requiere entender el dominio y el contrato de datos.

---

## 29. Probar que la identidad sobrevive al reordenamiento

Testing Library permite verificar el comportamiento sin inspeccionar el algoritmo interno de reconciliación.

~~~tsx
import { useState } from "react";
import {
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FindingCardList } from "./FindingCardList";
import type { DetailedFinding } from "./finding.schema";

const FINDINGS: readonly DetailedFinding[] = [
  {
    id: "finding-demo-01",
    siteId: "site-demo-north",
    title: "UPS sin monitoreo",
    description: "Detalle ficticio de UPS.",
    status: "open",
    severity: "high",
    createdAt: "2026-10-14T12:00:00Z",
  },
  {
    id: "finding-demo-02",
    siteId: "site-demo-south",
    title: "Rack sin identificación",
    description: "Detalle ficticio de rack.",
    status: "in_progress",
    severity: "medium",
    createdAt: "2026-10-13T12:00:00Z",
  },
];

function ReorderableFindings() {
  const [items, setItems] = useState(FINDINGS);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setItems((current) => [...current].reverse());
        }}
      >
        Invertir orden
      </button>
      <FindingCardList findings={items} />
    </>
  );
}

describe("FindingCardList", () => {
  it("mantiene la expansión asociada con el mismo ID", async () => {
    const user = userEvent.setup();
    render(<ReorderableFindings />);

    await user.click(
      screen.getByRole("button", {
        name: "Ver detalles de UPS sin monitoreo",
      }),
    );

    expect(
      screen.getByText("Detalle ficticio de UPS."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Invertir orden" }),
    );

    const list = screen.getByRole("list", {
      name: "Hallazgos de infraestructura",
    });
    const rows = within(list).getAllByRole("listitem");

    expect(rows).toHaveLength(2);

    const secondRow = rows[1];
    if (secondRow === undefined) {
      throw new Error("Se esperaba una segunda fila");
    }

    expect(
      within(secondRow).getByText("UPS sin monitoreo"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Ocultar detalles de UPS sin monitoreo",
      }),
    ).toHaveAttribute("aria-expanded", "true");
  });
});
~~~

La prueba demuestra que:

- el orden cambió;
- el hallazgo se movió de posición;
- su estado expandido permaneció con la misma identidad.

Con `key={index}`, esta clase de flujo puede asociar estado con la fila equivocada.

---

## 30. Relación con las piezas del portafolio

### SiteOps Tracker

Las vistas de activos, hallazgos, acciones e historial necesitan IDs estables y listas accesibles. Mostrar reordenamiento, filtros y pruebas de identidad mejora el valor del proyecto.

### SDK tipado para una API

El SDK trata la respuesta como `unknown`, valida el array y entrega entidades con IDs comprobados. No usa una aserción para ocultar respuestas inválidas.

### API REST Node.js + TypeScript + PostgreSQL

La API ofrece paginación y orden determinista. PostgreSQL conserva claves primarias; el Repository evita consultas concatenadas; el Service aplica autorización.

### Analizador de configuraciones

Cada diagnóstico puede tener un ID estable basado en su registro persistido o en una identidad creada al analizar el archivo. No debe regenerarse en cada render.

### Repositorio de algoritmos TypeScript

Una interfaz puede listar ejecuciones, casos de prueba o pasos. La posición visual no siempre es una identidad apropiada si los resultados se reordenan o eliminan.

### Aplicación Full Stack

El tema conecta una decisión aparentemente pequeña de JSX con modelado de datos, contratos HTTP, integridad y pruebas. Esa conexión es valiosa en portafolio y entrevistas.

---

## 31. Ejercicio práctico — Lista de acciones correctivas

Construye `CorrectiveActionsList` para SiteOps Tracker.

### Modelo inicial

~~~ts
type CorrectiveAction = {
  id: string;
  findingId: string;
  title: string;
  ownerName: string;
  status: "pending" | "in_progress" | "done";
  dueDate: string;
};
~~~

### Requisitos

1. Recibe `readonly CorrectiveAction[]` por props.
2. Permite filtrar por estado.
3. Permite ordenar por fecha o título sin mutar las props.
4. Renderiza una lista semántica.
5. Extrae un componente `CorrectiveActionRow`.
6. Coloca la `key` en la invocación creada por `map`.
7. Usa el ID, nunca el índice, título o un valor aleatorio.
8. Cada fila puede expandir notas locales para observar preservación de estado.
9. Muestra un estado vacío si el filtro no produce resultados.
10. Añade una prueba que expanda una fila, cambie el orden y confirme que la misma acción sigue expandida.
11. No incluyas una solución completa en la entrega inicial del ejercicio.

### Restricción adicional

Agrega dos grupos ficticios por hallazgo. Cada grupo y cada acción deben tener su propia `key` en el nivel correcto.

---

## 32. Pistas para el ejercicio

1. `filter` produce un array nuevo; puedes ordenar ese resultado.
2. Si ordenas directamente la prop, TypeScript debería advertirte si la declaraste `readonly`.
3. La `key` de `CorrectiveActionRow` debe escribirse en el `map` del padre.
4. Un grupo puede usar `findingId` si es único entre sus hermanos.
5. Si un grupo devuelve encabezado y lista sin contenedor, usa `Fragment` explícito.
6. El estado local de expansión pertenece a la fila; la identidad estable hace que siga a la entidad.
7. En la prueba, usa `within` para limitar consultas a una fila.
8. No pruebes la prop `key`: no llega al componente ni se muestra en el DOM.

Las pistas orientan el trabajo; el ejercicio queda deliberadamente sin solución completa.

---

## 33. Reto adicional — Tabla Full Stack paginada de activos

Construye un flujo vertical más exigente:

### React

- Tabla tipada de activos con `key={asset.id}`.
- Filtros por sede y estado.
- Orden por etiqueta o fecha.
- Selección por ID, no por índice.
- Estado vacío, carga y error visibles.
- Una fila seleccionada debe conservar identidad al llegar otra página o cambiar el orden.

### SDK y HTTP

- Solicita `GET /assets?siteId=...&status=...&cursor=...`.
- Trata el JSON como `unknown`.
- Valida elementos, IDs únicos dentro de la página y cursor siguiente.
- Modela errores sin exponer detalles internos.

### Node.js

- Router y Controller reciben query params.
- Zod valida filtros, tamaño de página y cursor.
- El Service verifica autorización para la sede.
- El Repository usa parámetros y un orden determinista.

### PostgreSQL

- Clave primaria estable.
- Restricciones apropiadas para la etiqueta del activo.
- Paginación que incluya un criterio de desempate por ID.

### Testing

- Prueba unitaria del orden y filtrado.
- Prueba de componente para identidad después de reordenar.
- Prueba de integración de la ruta.
- Caso de respuesta con IDs duplicados rechazado por el SDK.

### Docker, CI/CD y Cloud

Documenta brevemente cómo se ejecutará más adelante con Docker Compose, qué verificará GitHub Actions y qué métricas o logs ayudarán a investigar páginas incompletas en Cloud. No profundices aún en esas etapas.

---

## 34. Preguntas de comprensión

1. ¿Qué produce `map` cuando su callback devuelve JSX?
2. ¿Por qué cada elemento directamente creado dentro de un `map` necesita `key`?
3. ¿Qué significa que una clave sea estable?
4. ¿En qué alcance debe ser única una `key`?
5. ¿Por qué el índice falla al eliminar o reordenar?
6. ¿Qué sucede con `key={Math.random()}` entre renderizaciones?
7. ¿Cuándo es apropiado generar `crypto.randomUUID()`?
8. ¿Por qué `useId` no sirve como identidad de una colección?
9. ¿Dónde se coloca la `key` si extraes un componente de fila?
10. ¿Cómo asignas una `key` a varios nodos agrupados sin agregar un `div`?
11. ¿Por qué `key` no está disponible dentro de las props?
12. ¿Qué riesgo tiene ordenar directamente un array de props?
13. ¿Por qué `id: string` no demuestra unicidad en runtime?
14. ¿Qué puede comprobar Zod y qué debe garantizar PostgreSQL?
15. ¿Cómo probarías que una expansión permanece en el registro correcto tras reordenar?
16. ¿Qué diferencia existe entre una `key` de React y una clave primaria de base de datos?

---

## 35. Relevancia para entrevistas técnicas

### “¿Para qué sirve `key` en React?”

Ayuda a React a relacionar identidades de hijos entre renderizaciones, especialmente cuando se insertan, eliminan o reordenan elementos. Permite preservar correctamente estado y nodos asociados.

### “¿Por qué no usar el índice?”

Porque la posición cambia. En una colección dinámica, React puede reutilizar el estado de una posición para otra entidad.

### “¿Es válido `Math.random()` como key?”

No. Cambia en cada render, provoca remounts, pierde estado y genera trabajo innecesario.

### “¿Puede un componente leer su key?”

No. React la consume. Si el hijo necesita la identidad, se pasa como otra prop.

### “¿Las keys deben ser globalmente únicas?”

No; deben ser únicas entre hermanos del mismo array. Sí deben permanecer estables para la misma entidad.

### “¿Cómo manejarías un elemento optimista sin ID del servidor?”

Generaría una identidad de UI al crear el elemento, la conservaría como `key` y almacenaría por separado el ID remoto cuando llegue.

### “¿TypeScript garantiza que los IDs no se repitan?”

No. Tipar `id: string` solo garantiza la forma estática. La respuesta debe validarse en runtime y la base de datos debe imponer unicidad persistente.

Una respuesta fuerte explica reconciliación, estado local, datos dinámicos y la diferencia entre identidad de UI e integridad de datos.

---

## 36. Lista de verificación profesional

- [ ] La colección está tipada y, cuando es apropiado, marcada `readonly`.
- [ ] `map` devuelve elementos con una `key`.
- [ ] La clave procede de los datos.
- [ ] La clave es única entre hermanos.
- [ ] La clave permanece estable al filtrar y ordenar.
- [ ] No se usan índices en colecciones dinámicas.
- [ ] No se generan UUIDs durante el render.
- [ ] No se usa `useId` para keys de datos.
- [ ] La `key` está en el elemento más externo devuelto por `map`.
- [ ] Los Fragments con key usan la sintaxis explícita.
- [ ] Los componentes reciben el ID como prop si lo necesitan.
- [ ] El ordenamiento no muta props ni estado.
- [ ] El estado vacío está representado.
- [ ] Los arrays HTTP se tratan como `unknown` y se validan.
- [ ] Los IDs duplicados se rechazan donde corresponda.
- [ ] PostgreSQL conserva integridad persistente.
- [ ] Las pruebas cubren reordenamiento o eliminación.
- [ ] ESLint, typecheck y pruebas se ejecutan en CI.

---

## 37. Resumen

- `map` convierte una colección de datos en una colección de elementos JSX.
- `filter` permite derivar qué elementos serán visibles sin mutar el array original.
- React necesita `key` para reconocer identidades entre renderizaciones.
- Una buena clave es única entre hermanos, estable y ligada al dato.
- Un ID persistente suele ser mejor que una posición o un texto mutable.
- El índice puede asociar estado local con la entidad equivocada al cambiar el orden.
- `Math.random()` y UUIDs generados durante el render fuerzan identidades nuevas.
- `useId` no debe utilizarse para keys de listas.
- `key` se coloca en el elemento directamente devuelto por `map` y no llega como prop.
- `<Fragment key={...}>` permite agrupar varios nodos sin añadir un contenedor DOM.
- Ordenar requiere una copia si el array de entrada no fue ya derivado como uno nuevo.
- TypeScript comprueba la forma del ID, pero no su unicidad ni estabilidad en runtime.
- Zod puede validar arrays e IDs duplicados; PostgreSQL protege la integridad persistente.
- Los tipos TypeScript desaparecen en ejecución: HTTP, formularios, APIs, archivos, variables de entorno y bases de datos requieren validación real.
- Testing Library puede demostrar que el estado permanece con la misma entidad después de reordenar.

---

## Referencias oficiales

- [React: Rendering Lists](https://react.dev/learn/rendering-lists)
- [React: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [React: Fragment](https://react.dev/reference/react/Fragment)
- [React: useId](https://react.dev/reference/react/useId)
- [React: Using TypeScript](https://react.dev/learn/typescript)
- [Zod: Basic usage](https://zod.dev/basics)
- [Zod: Defining schemas](https://zod.dev/api)
- [Testing Library: About Queries](https://testing-library.com/docs/queries/about/)
- [Testing Library: Querying Within Elements](https://testing-library.com/docs/dom-testing-library/api-within/)
- [Testing Library: user-event introduction](https://testing-library.com/docs/user-event/intro/)

Referencias consultadas el **14 de octubre de 2026**.

---

# Próxima lección

**Lección 39 — Renderizado condicional con TypeScript: estados de UI exhaustivos y componentes predecibles.**
