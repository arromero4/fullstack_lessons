# Lección 34 — React con TypeScript: JSX, componentes funcionales y props tipadas

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, datos, reglas y escenarios de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — fundamentos de interfaz  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## Introducción

En la lección 33 cerraste la etapa de TypeScript profundo construyendo quality gates reproducibles. Ahora comienza la etapa de React profesional con TypeScript: usarás el sistema de tipos para convertir requisitos visuales en componentes con contratos explícitos.

Una interfaz de SiteOps Tracker debe mostrar datos que cambian: sedes, activos, hallazgos, responsables y acciones correctivas. Manipular el DOM nodo por nodo obliga a mantener sincronizados manualmente el dato, el texto visible, las clases CSS y los manejadores de eventos. React propone otro modelo:

> Un componente recibe entradas y describe con JSX qué interfaz corresponde a esas entradas.

TypeScript añade una segunda garantía: comprueba durante el desarrollo qué props necesita el componente, cuáles son opcionales y qué callbacks puede invocar. Pero esa garantía tiene una frontera importante:

> Las props tipadas no validan datos externos. Los tipos TypeScript desaparecen en runtime.

Si un hallazgo procede de HTTP, un formulario, un archivo, una variable de entorno o PostgreSQL, primero debe comprobarse como dato real. Solo después conviene entregarlo a los componentes como un valor confiable.

---

## Objetivo

Al terminar esta lección podrás:

1. explicar el problema que resuelve el modelo declarativo de React;
2. distinguir React, JSX, componentes y elementos;
3. configurar archivos `.tsx` y el modo JSX de TypeScript;
4. escribir JSX válido y reconocer sus diferencias con HTML;
5. crear componentes funcionales con nombres correctos;
6. declarar props mediante `type` o `interface`;
7. modelar props obligatorias, opcionales y con valor predeterminado;
8. pasar objetos, funciones y contenido anidado de forma tipada;
9. diseñar callbacks con vocabulario del dominio;
10. renderizar condiciones y colecciones sin perder seguridad de tipos;
11. entender por qué `key` no es una prop ordinaria;
12. mantener los componentes puros y las props inmutables;
13. decidir cuándo extraer un componente y cuándo evitarlo;
14. validar respuestas HTTP con Zod antes de renderizarlas;
15. ubicar React dentro de la arquitectura Full Stack de SiteOps Tracker;
16. reconocer errores frecuentes de JSX y props;
17. probar de forma básica el contrato observable de un componente;
18. defender estas decisiones en una entrevista técnica.

---

## 1. El problema: una interfaz imperativa acumula sincronización manual

Imagina que debes mostrar un hallazgo y habilitar un botón para abrir su detalle. Con manipulación directa del DOM podrías terminar coordinando muchas operaciones:

~~~ts
const titleElement = document.querySelector("[data-finding-title]");
const statusElement = document.querySelector("[data-finding-status]");
const openButton = document.querySelector("[data-open-finding]");

if (
  !(titleElement instanceof HTMLElement) ||
  !(statusElement instanceof HTMLElement) ||
  !(openButton instanceof HTMLButtonElement)
) {
  throw new Error("Missing finding UI elements");
}

titleElement.textContent = "UPS battery inspection";
statusElement.textContent = "Open";
statusElement.className = "status status--open";
openButton.disabled = false;
openButton.addEventListener("click", () => {
  console.log("Open finding-demo-101");
});
~~~

Este código no es incorrecto por existir, pero escala mal cuando cada cambio de datos exige recordar todos los cambios del DOM relacionados.

Los riesgos aparecen paso a paso:

1. cambia el estado del hallazgo;
2. se actualiza el texto, pero no la clase CSS;
3. el botón conserva un identificador anterior;
4. se registra otro listener sin retirar el previo;
5. una rama deja el DOM en un estado parcialmente actualizado;
6. la interfaz ya no representa una única fuente de verdad.

React invierte la responsabilidad. En vez de describir **cómo mutar** cada nodo, describes **qué debe verse** para unas entradas concretas:

~~~tsx
type FindingStatus = "open" | "in_progress" | "resolved";

type FindingSummaryProps = {
  readonly id: string;
  readonly title: string;
  readonly status: FindingStatus;
  readonly onOpen: (findingId: string) => void;
};

export function FindingSummary({
  id,
  title,
  status,
  onOpen,
}: FindingSummaryProps) {
  return (
    <article className={`finding finding--${status}`}>
      <h2>{title}</h2>
      <p>Estado: {status}</p>
      <button type="button" onClick={() => onOpen(id)}>
        Abrir hallazgo
      </button>
    </article>
  );
}
~~~

Para los mismos valores de props, el componente debe describir el mismo resultado. React se encarga de reconciliar esa descripción con la interfaz renderizada.

---

## 2. El modelo mental: datos → componente → JSX → interfaz

La cadena conceptual es:

~~~text
props tipadas
     ↓
función componente
     ↓
JSX evaluado
     ↓
elementos de React
     ↓
React actualiza el entorno de renderizado
~~~

Cada concepto tiene una responsabilidad distinta:

| Concepto | Qué es | Qué no es |
| --- | --- | --- |
| React | biblioteca para componer y renderizar interfaces | un validador de respuestas HTTP |
| JSX | extensión de sintaxis semejante a HTML | HTML copiado literalmente |
| Componente | función que participa en el renderizado de React | una función que debe mutar el DOM |
| Props | entradas de solo lectura para un render | almacenamiento local mutable |
| Elemento de React | descripción del contenido a renderizar | necesariamente un nodo DOM ya creado |
| TypeScript | comprobación estática del código fuente | validación de valores recibidos en runtime |

JSX y React suelen utilizarse juntos, pero no son lo mismo. JSX se transforma en llamadas o estructuras JavaScript que el runtime de JSX puede interpretar. TypeScript puede comprobar y transformar esa sintaxis según la opción `jsx`.

---

## 3. Preparar React con TypeScript

Para practicar en un proyecto aislado puedes crear una aplicación con la plantilla oficial React + TypeScript de Vite:

~~~bash
npm create vite@latest siteops-web -- --template react-ts
cd siteops-web
npm install
npm run dev
~~~

La plantilla resuelve configuración inicial, pero no sustituye comprenderla. Todo archivo TypeScript que contenga JSX debe usar la extensión `.tsx`:

~~~text
FindingCard.tsx  → contiene JSX
finding.types.ts → solo contiene TypeScript
~~~

Una configuración típica incluye un modo JSX compatible con el runtime automático:

~~~json
{
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "noUncheckedIndexedAccess": true
  }
}
~~~

Según la herramienta de build, el JSX puede preservarse o transformarse en otra etapa. En una aplicación moderna, la plantilla debe coordinar TypeScript, Vite y el plugin de React.

### Conserva el quality gate de tipos

Vite transpila TypeScript para desarrollo y build, pero la velocidad de esa transformación no debe confundirse con una comprobación completa del programa. Conserva un script explícito:

~~~json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "build": "tsc -b && vite build"
  }
}
~~~

El comando exacto depende de la estructura generada, pero la regla permanece: el frontend debe pasar typecheck, lint, pruebas y build como gates diferenciados.

---

## 4. JSX: JavaScript con sintaxis declarativa de marcado

Este componente mezcla marcado y expresiones sin convertir el archivo en HTML:

~~~tsx
type SiteHeadingProps = {
  readonly code: string;
  readonly name: string;
  readonly openFindings: number;
};

export function SiteHeading({
  code,
  name,
  openFindings,
}: SiteHeadingProps) {
  return (
    <header className="site-heading">
      <p className="site-heading__code">{code}</p>
      <h1>{name}</h1>
      <p>{openFindings} hallazgos abiertos</p>
    </header>
  );
}
~~~

Las llaves `{}` cambian temporalmente de JSX a una **expresión** JavaScript. Puedes incluir:

- variables;
- accesos a propiedades;
- llamadas puras;
- operadores condicionales;
- expresiones lógicas;
- `map` para crear colecciones de elementos.

No puedes colocar directamente una sentencia `if`, un `for` o una declaración `const` dentro de las llaves. Esas sentencias se escriben antes del `return`, o se reemplazan por una expresión legible.

---

## 5. Reglas esenciales de JSX

### 5.1 Devuelve una raíz

Esto es inválido porque hay dos elementos hermanos sin contenedor:

~~~tsx
// Inválido
return (
  <h2>Hallazgos</h2>
  <p>Revisión pendiente</p>
);
~~~

Puedes usar un elemento semántico o un Fragment:

~~~tsx
return (
  <>
    <h2>Hallazgos</h2>
    <p>Revisión pendiente</p>
  </>
);
~~~

Un Fragment agrupa elementos sin agregar un nodo DOM innecesario.

### 5.2 Cierra todas las etiquetas

~~~tsx
<img src="/icons/finding.svg" alt="" />
<input name="search" type="search" />
~~~

JSX exige el cierre explícito incluso para elementos que HTML suele aceptar sin cierre.

### 5.3 Usa nombres compatibles con JavaScript y el DOM de React

~~~tsx
<section className="finding-list" tabIndex={-1}>
  Contenido
</section>
~~~

La mayoría de las propiedades usan `camelCase`. `class` se escribe `className`. Los atributos `aria-*` y `data-*` conservan guiones:

~~~tsx
<button
  type="button"
  aria-label="Abrir hallazgo UPS"
  data-finding-id="finding-demo-101"
>
  Abrir
</button>
~~~

### 5.4 Las cadenas literales y las expresiones no son iguales

~~~tsx
const priority = "high";

return (
  <>
    <p data-priority="high">Literal</p>
    <p data-priority={priority}>Expresión</p>
  </>
);
~~~

### 5.5 Los comentarios también son expresiones

~~~tsx
return (
  <section>
    {/* Esta nota no se renderiza en el DOM. */}
    <h2>Resumen</h2>
  </section>
);
~~~

---

## 6. Componentes funcionales: funciones con reglas de renderizado

Un componente funcional es una función que React invoca durante el renderizado. Su nombre debe comenzar con mayúscula:

~~~tsx
export function StatusBadge() {
  return <span className="status-badge">Abierto</span>;
}
~~~

La mayúscula es semántica. En JSX:

- `<section>` representa un elemento integrado del entorno;
- `<StatusBadge />` representa un componente definido o importado por ti.

### Decláralos en el nivel superior

Evita crear una definición de componente dentro de otra:

~~~tsx
// Evitar
export function FindingPage() {
  function StatusBadge() {
    return <span>Abierto</span>;
  }

  return <StatusBadge />;
}
~~~

La identidad de esa función cambia cuando se ejecuta el componente exterior. Define los componentes en el nivel superior y pasa la información mediante props.

### Deja que TypeScript infiera el retorno normalmente

No es obligatorio escribir `React.FC` ni anotar cada retorno. Este estilo es directo:

~~~tsx
type StatusBadgeProps = {
  readonly label: string;
};

export function StatusBadge({ label }: StatusBadgeProps) {
  return <span className="status-badge">{label}</span>;
}
~~~

`React.FC<StatusBadgeProps>` es una opción válida cuando el equipo la elige conscientemente, pero no aporta seguridad automática a los datos externos ni elimina la necesidad de declarar las props. Tipar el parámetro suele mostrar el contrato con menos ruido.

---

## 7. Props: el contrato público del componente

Las props responden: “¿qué necesita este componente para producir su descripción visual?”.

Primero modela un dato de presentación:

~~~ts
export type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved";

export type FindingPriority = "low" | "medium" | "high";

export type FindingSummary = {
  readonly id: string;
  readonly title: string;
  readonly siteName: string;
  readonly status: FindingStatus;
  readonly priority: FindingPriority;
  readonly assigneeName: string | null;
};
~~~

Después declara las entradas exactas del componente:

~~~tsx
import type { FindingSummary } from "./finding.types";

type FindingCardProps = {
  readonly finding: FindingSummary;
  readonly onOpen: (findingId: string) => void;
};

export function FindingCard({
  finding,
  onOpen,
}: FindingCardProps) {
  return (
    <article className="finding-card">
      <header>
        <p>{finding.siteName}</p>
        <h2>{finding.title}</h2>
      </header>

      <p>Estado: {finding.status}</p>
      <p>Prioridad: {finding.priority}</p>
      <p>
        Responsable: {finding.assigneeName ?? "Sin asignar"}
      </p>

      <button
        type="button"
        onClick={() => onOpen(finding.id)}
      >
        Abrir hallazgo
      </button>
    </article>
  );
}
~~~

El consumidor obtiene errores estáticos si omite `finding`, entrega un estado imposible o pasa un callback incompatible.

~~~tsx
<FindingCard
  finding={finding}
  onOpen={(findingId) => {
    console.log(findingId);
  }}
/>
~~~

### `readonly` comunica intención, no congela el runtime

`readonly` impide asignaciones accidentales desde TypeScript. No ejecuta `Object.freeze` ni protege contra código JavaScript externo. Es una política estática que desaparece junto con los demás tipos.

---

## 8. Props obligatorias, opcionales y valores predeterminados

Una prop debe ser opcional solo cuando el componente tenga una conducta correcta al no recibirla.

~~~tsx
type FindingCountProps = {
  readonly count: number;
  readonly compact?: boolean;
};

export function FindingCount({
  count,
  compact = false,
}: FindingCountProps) {
  if (compact) {
    return <span>{count}</span>;
  }

  return <span>{count} hallazgos</span>;
}
~~~

El valor predeterminado se usa cuando `compact` falta o vale `undefined`. No transforma `null`; si `null` tiene significado, debe aparecer explícitamente en el tipo.

### No uses `?` para silenciar un error de diseño

Esto es sospechoso:

~~~tsx
type RiskyProps = {
  readonly finding?: FindingSummary;
};
~~~

Ahora todo el componente debe decidir qué significa “sin hallazgo”. Quizá existan dos estados diferentes que merecen componentes o una unión explícita:

~~~ts
type FindingPanelState =
  | { readonly kind: "empty" }
  | {
      readonly kind: "ready";
      readonly finding: FindingSummary;
    };
~~~

Las uniones discriminadas hacen visibles los estados posibles y evitan combinaciones incoherentes.

---

## 9. Callbacks tipados: el hijo informa intención, el padre decide

Un componente de presentación no necesita conocer navegación, HTTP ni estado global. Puede emitir una intención mediante una prop función:

~~~tsx
type FindingActionsProps = {
  readonly findingId: string;
  readonly onOpen: (findingId: string) => void;
  readonly onAssign: (findingId: string) => void;
};

export function FindingActions({
  findingId,
  onOpen,
  onAssign,
}: FindingActionsProps) {
  return (
    <div className="finding-actions">
      <button type="button" onClick={() => onOpen(findingId)}>
        Ver detalle
      </button>
      <button type="button" onClick={() => onAssign(findingId)}>
        Asignar
      </button>
    </div>
  );
}
~~~

`onOpen` expresa vocabulario del dominio mejor que exponer siempre el evento del navegador. El hijo conoce el identificador; el padre decide si abre una ruta, un panel o un modal.

### Cuando sí necesitas el evento del DOM

Tipa el evento cuando su información forma parte del trabajo del componente:

~~~tsx
import type { ChangeEvent } from "react";

type FindingSearchProps = {
  readonly query: string;
  readonly onQueryChange: (value: string) => void;
};

export function FindingSearch({
  query,
  onQueryChange,
}: FindingSearchProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onQueryChange(event.currentTarget.value);
  }

  return (
    <label>
      Buscar hallazgos
      <input
        type="search"
        value={query}
        onChange={handleChange}
      />
    </label>
  );
}
~~~

El estado que controla `query` se estudiará en la siguiente lección. Aquí importa el contrato: este componente recibe un valor y notifica el nuevo texto.

### No invoques el callback durante el render

~~~tsx
// Incorrecto: ejecuta onOpen inmediatamente.
<button onClick={onOpen(findingId)}>Abrir</button>

// Correcto: entrega una función para ejecutarla ante el evento.
<button onClick={() => onOpen(findingId)}>Abrir</button>
~~~

---

## 10. `children`: composición explícita

Si un componente está diseñado para envolver contenido, declara `children`:

~~~tsx
import type { ReactNode } from "react";

type PanelProps = {
  readonly title: string;
  readonly children: ReactNode;
};

export function Panel({ title, children }: PanelProps) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="panel__content">{children}</div>
    </section>
  );
}
~~~

El consumidor puede componerlo así:

~~~tsx
<Panel title="Hallazgos prioritarios">
  <p>Revisa primero los hallazgos de prioridad alta.</p>
</Panel>
~~~

`ReactNode` admite el conjunto de valores que React puede renderizar, incluido JSX, cadenas, números, `null` y colecciones renderizables.

No agregues `children` automáticamente a todos los componentes. Si un componente no acepta contenido arbitrario, excluirlo mantiene el contrato más preciso.

---

## 11. Renderizado condicional con estados explícitos

JSX permite decidir qué descripción producir:

~~~tsx
type AssigneeProps = {
  readonly name: string | null;
};

export function Assignee({ name }: AssigneeProps) {
  return (
    <p>
      Responsable: {name ?? <strong>Sin asignar</strong>}
    </p>
  );
}
~~~

Para ramas más grandes, un retorno temprano suele ser más legible:

~~~tsx
type FindingListProps = {
  readonly findings: readonly FindingSummary[];
  readonly onOpen: (findingId: string) => void;
};

export function FindingList({
  findings,
  onOpen,
}: FindingListProps) {
  if (findings.length === 0) {
    return <p>No hay hallazgos para mostrar.</p>;
  }

  return (
    <ul className="finding-list">
      {findings.map((finding) => (
        <li key={finding.id}>
          <FindingCard finding={finding} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
~~~

La prop `findings` acepta una colección de solo lectura. El componente no necesita mutarla para renderizarla.

---

## 12. Colecciones y `key`

Cuando generas elementos con `map`, React necesita una `key` estable para identificar cada elemento entre renders.

~~~tsx
{findings.map((finding) => (
  <FindingCard
    key={finding.id}
    finding={finding}
    onOpen={onOpen}
  />
))}
~~~

Usa un identificador estable del dato, como `finding.id`. Evita el índice si la colección puede reordenarse, insertar o eliminar elementos.

### `key` no llega como prop ordinaria

Este contrato sigue necesitando `finding` o un `findingId` explícito:

~~~tsx
type FindingRowProps = {
  readonly findingId: string;
  readonly title: string;
};

function FindingRow({ findingId, title }: FindingRowProps) {
  return <li data-finding-id={findingId}>{title}</li>;
}
~~~

~~~tsx
<FindingRow
  key={finding.id}
  findingId={finding.id}
  title={finding.title}
/>
~~~

React usa `key` internamente; no la leas dentro del componente como si fuera un campo del dominio.

---

## 13. Componentes puros y props inmutables

Durante el render, un componente debe comportarse como una función pura:

- no muta props;
- no modifica variables externas;
- no realiza peticiones HTTP;
- no escribe en `localStorage`;
- no registra listeners;
- devuelve el mismo JSX para las mismas entradas.

### Ejemplo incorrecto

~~~tsx
type PriorityListProps = {
  readonly findings: FindingSummary[];
};

function PriorityList({ findings }: PriorityListProps) {
  findings.sort((left, right) =>
    left.title.localeCompare(right.title),
  );

  return <p>{findings.length} hallazgos</p>;
}
~~~

`sort` muta el arreglo recibido. Aunque la propiedad sea `readonly`, el arreglo interno se declaró mutable.

### Alternativa segura

~~~tsx
type PriorityListProps = {
  readonly findings: readonly FindingSummary[];
};

function PriorityList({ findings }: PriorityListProps) {
  const sortedFindings = findings.toSorted((left, right) =>
    left.title.localeCompare(right.title),
  );

  return (
    <ol>
      {sortedFindings.map((finding) => (
        <li key={finding.id}>{finding.title}</li>
      ))}
    </ol>
  );
}
~~~

La copia ordenada se deriva durante el render sin alterar la entrada. La disponibilidad de `toSorted` depende del target/runtime que declares; un proyecto con soporte más antiguo puede usar `[...findings].sort(...)`.

Los efectos pertenecen a manejadores de eventos o a mecanismos de React diseñados para sincronizar sistemas externos. No los escondas en el cuerpo del render.

---

## 14. Tipos estáticos frente a validación runtime

Este es un error peligroso:

~~~ts
async function loadFindings(): Promise<FindingSummary[]> {
  const response = await fetch("/api/findings");
  return response.json();
}
~~~

La anotación promete un resultado, pero no inspecciona el JSON. El servidor podría responder:

~~~json
{
  "data": [
    {
      "id": 101,
      "title": null,
      "status": "archived"
    }
  ]
}
~~~

Los tipos TypeScript se eliminan al producir JavaScript. Por eso una respuesta HTTP, un formulario, una API externa, un archivo, una variable de entorno o una fila de PostgreSQL no se vuelve segura por asignarle un tipo.

### Validar con Zod en la frontera HTTP

~~~ts
import { z } from "zod";

export const FindingSummarySchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(3),
  siteName: z.string().trim().min(1),
  status: z.enum(["open", "in_progress", "resolved"]),
  priority: z.enum(["low", "medium", "high"]),
  assigneeName: z.string().trim().min(1).nullable(),
}).strict();

export const FindingsResponseSchema = z.object({
  data: z.array(FindingSummarySchema),
}).strict();

export type FindingSummary = z.infer<
  typeof FindingSummarySchema
>;
~~~

El tipo se deriva del schema para evitar mantener dos contratos manuales.

~~~ts
import { FindingsResponseSchema } from "./finding.schema";
import type { FindingSummary } from "./finding.schema";

export async function listFindings(
  signal?: AbortSignal,
): Promise<readonly FindingSummary[]> {
  const response = await fetch("/api/findings", { signal });

  if (!response.ok) {
    throw new Error(`Findings request failed: ${response.status}`);
  }

  const raw: unknown = await response.json();
  const parsed = FindingsResponseSchema.parse(raw);

  return parsed.data;
}
~~~

La secuencia confiable es:

~~~text
JSON externo
   ↓ unknown
schema Zod en runtime
   ↓ dato validado
tipo inferido
   ↓
props de React
~~~

No necesitas validar el mismo objeto dentro de cada componente si ya atravesó una frontera confiable y tu código interno no rompe el contrato. La validación se coloca en los límites del sistema; las props mantienen la seguridad estática dentro de la aplicación.

---

## 15. Ejemplo integrado de SiteOps Tracker

El siguiente ejemplo reúne unions, props, callbacks, composición y colecciones.

### Etiquetas exhaustivas del dominio

~~~ts
import type {
  FindingPriority,
  FindingStatus,
} from "./finding.types";

export const STATUS_LABEL = {
  open: "Abierto",
  in_progress: "En progreso",
  resolved: "Resuelto",
} satisfies Record<FindingStatus, string>;

export const PRIORITY_LABEL = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
} satisfies Record<FindingPriority, string>;
~~~

`satisfies` comprueba que no falte ninguna variante sin ampliar las claves a `string`.

### Badge reutilizable

~~~tsx
import { STATUS_LABEL } from "./finding.labels";
import type { FindingStatus } from "./finding.types";

type FindingStatusBadgeProps = {
  readonly status: FindingStatus;
};

export function FindingStatusBadge({
  status,
}: FindingStatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${status}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
~~~

### Tarjeta compuesta

~~~tsx
import { PRIORITY_LABEL } from "./finding.labels";
import type { FindingSummary } from "./finding.types";
import { FindingStatusBadge } from "./FindingStatusBadge";

type FindingCardProps = {
  readonly finding: FindingSummary;
  readonly onOpen: (findingId: string) => void;
  readonly compact?: boolean;
};

export function FindingCard({
  finding,
  onOpen,
  compact = false,
}: FindingCardProps) {
  return (
    <article
      className={compact ? "finding-card is-compact" : "finding-card"}
      data-priority={finding.priority}
    >
      <header className="finding-card__header">
        <p>{finding.siteName}</p>
        <FindingStatusBadge status={finding.status} />
        <h2>{finding.title}</h2>
      </header>

      {!compact && (
        <dl>
          <div>
            <dt>Prioridad</dt>
            <dd>{PRIORITY_LABEL[finding.priority]}</dd>
          </div>
          <div>
            <dt>Responsable</dt>
            <dd>{finding.assigneeName ?? "Sin asignar"}</dd>
          </div>
        </dl>
      )}

      <button
        type="button"
        onClick={() => onOpen(finding.id)}
        aria-label={`Abrir hallazgo: ${finding.title}`}
      >
        Abrir
      </button>
    </article>
  );
}
~~~

### Lista que conserva la decisión en el padre

~~~tsx
import type { FindingSummary } from "./finding.types";
import { FindingCard } from "./FindingCard";

type FindingsSectionProps = {
  readonly title: string;
  readonly findings: readonly FindingSummary[];
  readonly onFindingOpen: (findingId: string) => void;
};

export function FindingsSection({
  title,
  findings,
  onFindingOpen,
}: FindingsSectionProps) {
  return (
    <section aria-labelledby="findings-heading">
      <h1 id="findings-heading">{title}</h1>

      {findings.length === 0 ? (
        <p>No hay hallazgos en esta vista.</p>
      ) : (
        <div className="finding-grid">
          {findings.map((finding) => (
            <FindingCard
              key={finding.id}
              finding={finding}
              onOpen={onFindingOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}
~~~

La lista no conoce Express, SQL ni el sistema de navegación. Recibe datos ya validados y notifica una intención. Esa separación permite probar y reutilizar la presentación.

---

## 16. Una prueba pequeña del contrato observable

TypeScript detecta una prop faltante, pero no demuestra que el botón invoque el callback correcto. Una prueba con Vitest y Testing Library puede observar la conducta:

~~~tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FindingCard } from "./FindingCard";

describe("FindingCard", () => {
  it("notifica el identificador al abrir", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn<(findingId: string) => void>();

    render(
      <FindingCard
        finding={{
          id: "finding-demo-101",
          title: "Inspect backup power",
          siteName: "North Demo Site",
          status: "open",
          priority: "high",
          assigneeName: null,
        }}
        onOpen={onOpen}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: /abrir hallazgo/i,
      }),
    );

    expect(onOpen).toHaveBeenCalledWith("finding-demo-101");
  });
});
~~~

Esta prueba no sustituye:

- el typecheck de las props;
- el test runtime del schema Zod;
- una prueba de integración del SDK;
- una prueba E2E del flujo completo.

Cada gate responde una pregunta diferente. La etapa de Testing profundizará en estas capas; aquí basta reconocer el contrato observable del componente.

---

## 17. Cuándo crear un componente

Extrae un componente cuando exista una frontera útil, por ejemplo:

- una pieza visual se repite;
- el bloque tiene un propósito semántico claro;
- necesita props bien definidas;
- contiene una decisión visual independiente;
- puede probarse por una conducta observable;
- reduce la responsabilidad del componente padre;
- representa vocabulario del producto, como `FindingCard` o `SiteHeader`.

Un buen nombre explica intención. `FindingStatusBadge` comunica más que `BlueText` porque el estilo puede cambiar y el concepto permanece.

---

## 18. Cuándo evitar un componente nuevo

Evita extraer una abstracción cuando:

- solo reemplaza una etiqueta sencilla sin aportar significado;
- requiere más props que el JSX original;
- oculta estructura semántica importante;
- intenta anticipar reutilización que todavía no existe;
- combina dominios no relacionados mediante muchas opciones booleanas;
- convierte cada `div` en un archivo separado;
- incluye peticiones HTTP, reglas de negocio y presentación sin fronteras.

Este componente probablemente no ayuda:

~~~tsx
type TextProps = {
  readonly value: string;
};

function Text({ value }: TextProps) {
  return <span>{value}</span>;
}
~~~

La abstracción debe reducir carga mental o expresar dominio, no aumentar ceremonias.

---

## 19. Errores comunes y su causa

### Error 1 — Guardar JSX en un archivo `.ts`

TypeScript no lo interpreta como TSX. Usa `.tsx` y configura la opción `jsx`.

### Error 2 — Nombrar un componente con minúscula

`<findingCard />` se interpreta como una etiqueta integrada, no como tu función. Usa `FindingCard`.

### Error 3 — Copiar HTML sin adaptarlo

`class`, etiquetas sin cerrar y algunos atributos no son JSX válido. Usa `className`, cierre explícito y propiedades compatibles.

### Error 4 — Devolver hermanos sin raíz

Agrupa con un elemento semántico o Fragment.

### Error 5 — Usar `any` para las props

El componente pierde autocompletado, documentación y verificación. Modela el contrato exacto.

### Error 6 — Marcar todas las props como opcionales

Traslada errores de diseño al runtime y llena el JSX de comprobaciones. Haz opcional solo la ausencia válida.

### Error 7 — Afirmar un response con `as FindingSummary`

La assertion no valida JSON. Recibe `unknown` y usa un schema runtime.

### Error 8 — Mutar una prop o su objeto

Las props son snapshots de solo lectura para ese render. Produce nuevos valores en el propietario correspondiente.

### Error 9 — Ejecutar el callback al construir JSX

`onClick={onOpen(id)}` ejecuta inmediatamente. Entrega una función: `onClick={() => onOpen(id)}`.

### Error 10 — Usar el índice como `key` en una lista cambiante

La identidad visual puede asociarse con otro dato después de reordenar o insertar. Prefiere un ID estable.

### Error 11 — Intentar leer `key` como prop

Es información especial para React. Pasa el identificador del dominio por separado.

### Error 12 — Hacer una petición HTTP durante el render

Renderizar puede ocurrir varias veces y debe ser puro. La sincronización con red pertenece a una capa y mecanismo apropiados.

### Error 13 — Definir componentes dentro de componentes

Se crea una identidad nueva en cada ejecución del padre. Decláralos en el nivel superior.

### Error 14 — Colocar objetos directamente como contenido

React no puede presentar un objeto de dominio como texto útil. Selecciona campos o crea un componente específico.

### Error 15 — Olvidar `return` dentro de `map`

Con un cuerpo entre llaves debes retornar explícitamente:

~~~tsx
{findings.map((finding) => {
  return <FindingCard key={finding.id} finding={finding} onOpen={onOpen} />;
})}
~~~

Con paréntesis, el retorno es implícito.

### Error 16 — Usar un booleano como selector de muchos modos

Props como `compact`, `editable`, `admin`, `loading`, `failed` y `empty` pueden formar combinaciones imposibles. Usa componentes especializados o una unión discriminada.

### Error 17 — Creer que una prop tipada hace confiable al servidor

El compilador solo conoce el código. Zod, constraints, mapeos y pruebas protegen el runtime.

---

## 20. Relación explícita con la arquitectura Full Stack

~~~text
React
  ↓ interacción y presentación tipada
HTTP
  ↓ JSON sin tipos TypeScript
Node → Router → Controller
  ↓ recepción y coordinación de la petición
Runtime Validation
  ↓ unknown se valida con Zod
Service
  ↓ reglas de negocio
Repository
  ↓ consultas y mapeos
PostgreSQL
  ↓ persistencia y constraints
Testing → Docker → CI/CD → Cloud
  ↓ verificación, empaquetado y operación
~~~

### React

Los componentes reciben modelos de presentación y callbacks. No deberían conocer filas SQL ni detalles internos de Express.

### HTTP

Los tipos no viajan por la red. El SDK tipado puede prometer `Promise<FindingSummary[]>`, pero debe cumplir esa promesa validando el JSON real.

### Node, Router y Controller

El Router selecciona el handler; el Controller traduce HTTP a una operación de aplicación. Sus tipos facilitan desarrollo, pero el body y los parámetros entran como datos externos.

### Runtime Validation

Zod convierte `unknown` en un valor comprobado o produce un error. En frontend se validan responses; en backend se validan requests y configuración.

### Service

Ejecuta reglas de negocio sin depender de JSX. React no debe importar un Service backend ni duplicar decisiones críticas solo para mostrarlas.

### Repository

Traduce entre el dominio y la persistencia. Sus tipos internos no deben filtrarse a las props de React.

### PostgreSQL

Las filas existen en runtime y pueden contener valores inesperados si consultas, migraciones o mapeos son incorrectos. Constraints y validación/mapeo protegen esta frontera.

### Testing

Typecheck comprueba props; Testing Library observa interacción; Vitest ejecuta lógica y schemas; integración comprueba HTTP y PostgreSQL; E2E comprobará el flujo del usuario.

### Docker

Una imagen reproducible empaquetará frontend y backend más adelante. Docker no corrige props incorrectas ni valida JSON por sí solo.

### CI/CD

CI debe ejecutar typecheck, lint, pruebas y build del frontend. CD solo promueve un commit verificado.

### Cloud

El bundle React y la API operarán en infraestructura con configuración, logs, métricas, secretos y health checks. Una interfaz tipada es una capa del sistema, no toda su confiabilidad.

---

## 21. Relación con los proyectos de la ruta

| Proyecto | Uso del concepto de hoy |
| --- | --- |
| SiteOps Tracker | tarjetas, listas y paneles con props de dominio |
| SDK tipado para API | entrega al frontend datos validados y tipados |
| API REST Node.js + PostgreSQL | expone DTOs sin filtrar filas o tipos internos |
| Analizador de configuraciones | muestra resultados y severidades mediante componentes |
| Repositorio de algoritmos TypeScript | puede añadir después una interfaz que visualice entradas y resultados |
| Aplicación Full Stack | mantiene una frontera explícita entre presentación, red y backend |

El objetivo de portafolio no es exhibir muchos componentes, sino demostrar contratos claros y límites defendibles.

---

## 22. Ejercicio — Tarjeta de activo tipada

Construye un componente `AssetSummaryCard` para una lista de activos ficticios de SiteOps Tracker.

### Modelo requerido

~~~ts
type AssetStatus =
  | "active"
  | "maintenance"
  | "retired";

type AssetSummary = {
  readonly id: string;
  readonly tag: string;
  readonly name: string;
  readonly siteName: string;
  readonly status: AssetStatus;
  readonly ownerName: string | null;
};
~~~

### Requisitos

1. Crea el archivo `AssetSummaryCard.tsx`.
2. Declara `AssetSummaryCardProps` sin `any`.
3. Recibe un `asset` obligatorio.
4. Recibe `compact?: boolean` con valor predeterminado `false`.
5. Recibe `onInspect: (assetId: string) => void`.
6. Presenta tag, nombre, sede y estado.
7. Muestra el responsable solo en modo no compacto.
8. Usa “Sin responsable” cuando `ownerName` sea `null`.
9. Incluye un botón accesible que notifique el ID.
10. No muta el objeto ni realiza peticiones HTTP.
11. Crea `AssetSummaryList` para renderizar varios activos.
12. Usa un identificador estable como `key`.
13. Muestra un estado vacío si la colección no contiene activos.
14. Mantén el arreglo como `readonly AssetSummary[]`.

### Casos que TypeScript debe rechazar

- `status: "unknown"`;
- omitir `onInspect`;
- pasar un número como `asset.id`;
- implementar `onInspect` como una cadena;
- asignar un nuevo valor a `asset.status` dentro del componente.

### Pistas

1. Separa el tipo de dominio del tipo de props.
2. Desestructura las props en el parámetro.
3. Usa `compact = false`.
4. El manejador debe ser una función que invoque `onInspect(asset.id)`.
5. Usa un retorno temprano para la lista vacía.
6. Crea un mapa exhaustivo de etiquetas con `satisfies Record<AssetStatus, string>`.
7. La prop `key` pertenece al elemento de la lista, no al contrato de la tarjeta.
8. Ejecuta `npm run typecheck` y `npm run lint`.

### Entrega esperada

- tipos del activo;
- mapa exhaustivo de estados;
- `AssetSummaryCard.tsx`;
- `AssetSummaryList.tsx`;
- un ejemplo de uso válido;
- dos ejemplos con `@ts-expect-error` y explicación de por qué deben fallar;
- una prueba que compruebe el ID emitido por el botón.

No se incluye la solución completa. El objetivo es diseñar el contrato y comprobarlo.

---

## 23. Reto Full Stack — Panel de resultados del analizador

El analizador ficticio de configuraciones expone:

~~~text
POST /api/config-analysis
        ↓
Node Router → Controller → Zod → Service
        ↓
analizador de configuración
        ↓
JSON de resultados
        ↓
SDK con validación Zod
        ↓
React ConfigAnalysisPanel
~~~

### Tu reto

Diseña un conjunto de componentes de presentación para tres estados:

1. `loading`;
2. `success`, con un reporte validado;
3. `error`, con mensaje y callback de reintento.

El reporte exitoso contiene:

- `analysisId`;
- nombre genérico del archivo;
- cantidad de reglas evaluadas;
- resultados con severidad `info | warning | error`;
- mensaje de cada regla;
- identificador estable de la regla.

### Condiciones

- representa los tres estados mediante una unión discriminada;
- no declares todas las props como opcionales;
- `ConfigAnalysisPanel` no ejecuta `fetch` durante el render;
- el SDK recibe el JSON como `unknown` y lo valida con Zod;
- el componente recibe únicamente el reporte ya validado;
- la lista usa `ruleId` como `key`;
- un callback `onRuleOpen(ruleId)` comunica intención;
- un callback `onRetry()` existe solo en el estado de error;
- no uses assertions para “convencer” al compilador;
- agrega una prueba de interacción y una prueba del schema inválido;
- explica dónde viviría cada archivo en `apps/web`, `packages/sdk` y `packages/contracts`;
- conserva la dirección de dependencias: React consume contratos públicos, no módulos internos de Node o PostgreSQL.

### Pregunta de diseño

Si el componente espera `severity: "error"`, pero el servidor envía `severity: "critical"`, ¿en qué frontera debe fallar y qué debe ver el usuario?

Tu respuesta debe distinguir:

- error estático al programar un fixture incompatible;
- error runtime al recibir JSON real;
- traducción del error técnico a una experiencia de interfaz segura;
- logging técnico sin mostrar detalles sensibles.

No implementes todavía estado local ni efectos complejos; puedes recibir el estado completo como prop. Esos mecanismos se estudiarán gradualmente.

---

## 24. Preguntas de comprensión

Responde sin consultar y después verifica tus ideas.

1. ¿Qué diferencia existe entre React y JSX?
2. ¿Por qué un archivo con JSX debe usar `.tsx`?
3. ¿Qué controla la opción `jsx` de TypeScript?
4. ¿Por qué Vite no elimina la necesidad de `tsc --noEmit`?
5. ¿Qué significa que React sea declarativo?
6. ¿Por qué un componente debe comenzar con mayúscula?
7. ¿Qué representan las props?
8. ¿Cuándo una prop debería ser opcional?
9. ¿Qué ocurre con un valor predeterminado si la prop vale `null`?
10. ¿Por qué conviene marcar props y modelos como `readonly`?
11. ¿`readonly` congela un objeto en runtime?
12. ¿Por qué no se deben mutar las props?
13. ¿Qué ventaja tiene un callback de dominio como `onOpen`?
14. ¿Cuándo necesitas tipar un evento del DOM?
15. ¿Por qué `onClick={onOpen(id)}` suele ser incorrecto?
16. ¿Cuándo se debe declarar `children`?
17. ¿Por qué `ReactNode` es útil para contenido compuesto?
18. ¿Qué problema resuelve `key` en una lista?
19. ¿Por qué el índice puede ser una `key` deficiente?
20. ¿Por qué `key` no sustituye una prop `id`?
21. ¿Qué significa que un componente sea puro?
22. ¿Por qué una petición HTTP no pertenece al cuerpo del render?
23. ¿Por qué `Promise<FindingSummary[]>` no valida una respuesta?
24. ¿Qué papel tiene `unknown` en la frontera HTTP?
25. ¿Qué aporta Zod que TypeScript no conserva en runtime?
26. ¿Dónde termina la responsabilidad del SDK y comienza la de React?
27. ¿Qué comprueba typecheck que una prueba de interacción no comprueba?
28. ¿Qué comprueba una prueba de interacción que typecheck no comprueba?
29. ¿Cuándo conviene extraer un componente?
30. ¿Cuándo una abstracción de UI añade más ruido que valor?

---

## 25. Relevancia para entrevistas técnicas

### Pregunta: ¿Qué es JSX?

Es una extensión de sintaxis que permite expresar marcado dentro de JavaScript o TypeScript. No es HTML ni una cadena; una herramienta lo transforma en descripciones que el runtime de JSX interpreta.

### Pregunta: ¿Cómo tipas un componente funcional?

Declaro un tipo o interface para sus props y anoto el parámetro de la función. Normalmente dejo que TypeScript infiera el tipo de retorno. Uso `ReactNode` de forma explícita si el componente acepta `children`.

### Pregunta: ¿Por qué no usas `React.FC` siempre?

Es una opción válida, pero no es obligatoria. Tipar directamente el parámetro deja el contrato visible y evita agregar una abstracción que el componente no necesita. La decisión puede estandarizarse por equipo.

### Pregunta: ¿Las props deben mutarse?

No. Son entradas de solo lectura para un render. Si la interfaz necesita cambiar, el propietario del dato produce un valor nuevo y React vuelve a renderizar.

### Pregunta: ¿Cómo modelas callbacks?

Prefiero callbacks con intención del dominio, como `(findingId: string) => void`, cuando el hijo no necesita exponer detalles del navegador. Tipeo el evento React cuando su información sí forma parte de la tarea.

### Pregunta: ¿Qué diferencia existe entre props tipadas y datos validados?

Las props tipadas se comprueban durante desarrollo y sus tipos desaparecen. Un schema Zod inspecciona el valor real en runtime. Una respuesta HTTP entra como `unknown`, se valida y después se entrega a los componentes.

### Pregunta: ¿Por qué usar una unión discriminada para estados de UI?

Evita combinaciones imposibles. Cada variante contiene solo los datos y callbacks válidos para ese estado, y el discriminante permite narrowing exhaustivo.

### Pregunta: ¿Qué hace una `key`?

Ayuda a React a mantener la identidad de elementos hermanos entre renders. Debe ser estable y derivarse del dato; no es una prop ordinaria disponible dentro del componente.

### Respuesta breve de 30 segundos

> I model React components as pure functions from typed, read-only props to JSX. Props define the component’s internal compile-time contract, while callbacks communicate domain intent back to the owner. Lists use stable domain IDs as keys, and UI states are modeled with discriminated unions instead of unrelated optional flags. I never treat those types as runtime validation: HTTP JSON enters as unknown, is validated with Zod in the SDK boundary, and only then reaches React components.

---

## 26. Checklist profesional

Antes de considerar listo un componente, comprueba:

- [ ] El archivo que contiene JSX usa `.tsx`.
- [ ] El componente comienza con mayúscula.
- [ ] La definición vive en el nivel superior.
- [ ] Las props tienen un contrato explícito.
- [ ] No se usa `any` para silenciar el diseño.
- [ ] Solo son opcionales las ausencias válidas.
- [ ] Los valores predeterminados tienen semántica clara.
- [ ] `children` se declara solo cuando forma parte del contrato.
- [ ] Las props y colecciones de entrada son de solo lectura.
- [ ] El componente no muta entradas.
- [ ] El render no hace peticiones ni efectos.
- [ ] Los callbacks expresan intención clara.
- [ ] Los callbacks de eventos se entregan, no se ejecutan durante render.
- [ ] El marcado usa elementos semánticos.
- [ ] Los controles poseen nombre accesible.
- [ ] Las listas usan keys estables.
- [ ] El ID del dominio se pasa explícitamente si el hijo lo necesita.
- [ ] Los estados condicionales son legibles.
- [ ] No existen combinaciones imposibles de props.
- [ ] Los datos HTTP empiezan como `unknown`.
- [ ] Un schema runtime valida el JSON externo.
- [ ] No se usa `as` como sustituto de validación.
- [ ] React no importa internals del backend o Repository.
- [ ] Typecheck pasa sin emitir.
- [ ] ESLint pasa sin warnings aceptados accidentalmente.
- [ ] El build de producción termina correctamente.
- [ ] Existe una prueba para la interacción importante.
- [ ] Existe una prueba runtime para el schema relevante.
- [ ] Los ejemplos y datos son ficticios y aptos para portafolio.

---

## 27. Resumen

- React permite describir la interfaz correspondiente a unas entradas.
- JSX es una extensión de sintaxis, no HTML ni React por sí mismo.
- Los archivos TypeScript con JSX usan `.tsx`.
- La opción `jsx` controla cómo TypeScript trata esa sintaxis.
- Vite acelera desarrollo y build, pero conserva un gate de typecheck explícito.
- Un componente funcional comienza con mayúscula y devuelve JSX.
- Los componentes deben declararse en el nivel superior.
- Las props son el contrato público de entrada del componente.
- TypeScript detecta props faltantes e incompatibles durante desarrollo.
- `readonly` comunica inmutabilidad estática, pero no congela el runtime.
- Una prop opcional representa una ausencia válida, no una salida rápida a errores.
- Los valores predeterminados se aplican a ausencia o `undefined`, no a `null`.
- Los callbacks permiten que el hijo comunique intención al padre.
- Los callbacks de dominio reducen acoplamiento con el navegador.
- `children` debe declararse explícitamente cuando el componente compone contenido.
- Las condiciones pueden expresarse con retornos tempranos, ternarios o expresiones lógicas legibles.
- Las colecciones se renderizan con `map` y keys estables.
- `key` ayuda a React con identidad, pero no llega como prop ordinaria.
- Un componente puro no muta entradas ni ejecuta efectos durante render.
- Extrae componentes por significado, responsabilidad o reutilización real.
- Evita abstraer cada etiqueta sin aportar intención.
- Los tipos TypeScript desaparecen al generar JavaScript.
- Props tipadas no validan HTTP, formularios, APIs, archivos, entorno ni PostgreSQL.
- Los datos externos deben entrar como `unknown` y validarse en runtime.
- Zod puede producir un tipo inferido a partir del schema ejecutable.
- El SDK valida respuestas antes de entregar datos a React.
- React no debe depender de detalles internos del Controller, Service o Repository.
- Typecheck, pruebas de interacción y pruebas de schemas protegen riesgos distintos.
- Testing, Docker, CI/CD y Cloud amplían la verificación sin sustituir estos contratos.

---

## Referencias oficiales consultadas

- [React — Your First Component](https://react.dev/learn/your-first-component)
- [React — Writing Markup with JSX](https://react.dev/learn/writing-markup-with-jsx)
- [React — JavaScript in JSX with Curly Braces](https://react.dev/learn/javascript-in-jsx-with-curly-braces)
- [React — Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component)
- [React — Keeping Components Pure](https://react.dev/learn/keeping-components-pure)
- [React — Using TypeScript](https://react.dev/learn/typescript)
- [TypeScript Handbook — JSX](https://www.typescriptlang.org/docs/handbook/jsx.html)
- [Vite — Getting Started](https://vite.dev/guide/)
- [Vite — Features](https://vite.dev/guide/features.html)
- [Zod — Defining schemas](https://zod.dev/api)
- [Testing Library — React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library — User Interactions](https://testing-library.com/docs/user-event/intro/)

Consultadas el **8 de octubre de 2026**.

---

# Próxima lección

**Lección 35 — Estado local con `useState`: inferencia, unions y actualizaciones inmutables.**
