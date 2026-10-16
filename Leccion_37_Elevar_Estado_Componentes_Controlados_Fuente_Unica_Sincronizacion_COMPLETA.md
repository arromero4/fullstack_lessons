# Lección 37 — Elevar estado y diseñar componentes controlados: fuente única de verdad y sincronización entre componentes

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — coordinación de estado entre componentes  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## 1. Introducción

En la lección anterior construiste formularios controlados: React mantenía el valor y cada control notificaba cambios mediante eventos tipados. Ahora aplicaremos el mismo principio a componentes completos.

Imagina una pantalla de SiteOps Tracker con tres piezas:

- un filtro por estado del hallazgo;
- una lista de hallazgos;
- un panel de detalle del elemento seleccionado.

Las tres deben estar coordinadas. Si cada componente conserva su propia copia del filtro o de la selección, tarde o temprano mostrarán información contradictoria. La lista podría indicar “solo abiertos”, mientras el resumen cuenta todos; o el detalle podría conservar un hallazgo que ya no aparece.

React resuelve este problema mediante una idea sencilla:

> Cuando varios componentes necesitan coordinar el mismo dato, ese estado se mueve a su ancestro común más cercano.

Este proceso se conoce como **elevar el estado**. El padre conserva la fuente de verdad, envía valores hacia abajo mediante props y recibe intenciones de cambio mediante callbacks.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. reconocer cuándo dos estados locales representan en realidad el mismo dato;
2. localizar el ancestro común adecuado para alojar el estado;
3. elevar estado sin duplicarlo;
4. diseñar componentes controlados con props y callbacks tipados;
5. distinguir estado fuente de información derivada;
6. evitar copiar props a estado o sincronizarlas con Effects innecesarios;
7. coordinar filtros, selección y paneles de SiteOps Tracker;
8. validar en runtime los datos que llegaron desde HTTP antes de convertirlos en props confiables;
9. probar la sincronización desde la perspectiva de una persona usuaria.

---

## 3. El problema: estados locales que deberían estar sincronizados

Supongamos que cada panel de hallazgo controla de forma independiente si está abierto:

~~~tsx
import { useState } from "react";

type FindingPreview = {
  id: string;
  title: string;
  summary: string;
};

function IndependentFindingPanel({
  finding,
}: {
  finding: FindingPreview;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        {finding.title}
      </button>

      {isOpen && <p>{finding.summary}</p>}
    </section>
  );
}
~~~

El componente funciona si cada panel es independiente. Pero aparece un nuevo requisito: **solo puede haber un panel abierto a la vez**.

Con un `isOpen` privado dentro de cada instancia, ningún panel conoce el estado de los demás. Dos componentes hermanos no pueden coordinar directamente sus memorias locales.

Una solución frágil sería intentar comunicar paneles mediante variables externas, consultas al DOM o Effects que copien estados. La solución declarativa consiste en guardar una sola identidad en el padre:

~~~ts
type OpenFindingId = string | null;
~~~

Si el padre conoce el único `openFindingId`, la regla “como máximo uno abierto” queda representada por la estructura del tipo.

---

## 4. ¿Qué significa elevar estado?

Elevar estado consiste en cuatro pasos:

1. **Identificar el dato compartido.** En el ejemplo, es el identificador del panel abierto.
2. **Encontrar el ancestro común más cercano.** Es el componente que renderiza todos los paneles que deben coordinarse.
3. **Mover allí el `useState`.** Los hijos dejan de conservar copias independientes.
4. **Conectar valor y eventos.** El padre pasa el valor por props y los hijos notifican intenciones mediante callbacks.

El flujo queda así:

| Dirección | Información | Mecanismo |
|---|---|---|
| Padre → hijo | Estado actual | Props |
| Hijo → padre | Intención de cambio | Callback |
| Padre → todos los hijos | Nuevo estado coherente | Nueva renderización |

El hijo no modifica una prop. Solicita un cambio. El padre decide qué estado producir y React vuelve a renderizar el árbol correspondiente.

---

## 5. Razón de existir: una sola fuente de verdad

Si el mismo hecho se almacena en dos lugares, ambos deben sincronizarse para siempre:

~~~ts
type DuplicatedUiState = {
  listStatusFilter: "all" | "open" | "resolved";
  summaryStatusFilter: "all" | "open" | "resolved";
};
~~~

Estas propiedades pueden divergir. El tipo permite que una sea `"open"` y la otra `"resolved"`, aunque la interfaz pretenda usar un único filtro.

Una fuente de verdad elimina la contradicción:

~~~ts
type CoordinatedUiState = {
  statusFilter: "all" | "open" | "resolved";
};
~~~

La lista y el resumen reciben el mismo valor. No necesitan sincronizarse entre sí; ambos se derivan de la misma fuente.

### “Una fuente de verdad” no significa “todo en una variable global”

La fuente debe vivir tan cerca como sea posible de quienes la usan:

- si solo un campo necesita el borrador, puede ser local;
- si dos hermanos necesitan el filtro, súbelo a su padre;
- si una sección completa necesita una selección, su contenedor puede poseerla;
- si toda la aplicación necesita autenticación, más adelante se evaluará Context u otra estrategia.

Elevar estado demasiado también genera acoplamiento. La meta es **propiedad clara**, no centralización indiscriminada.

---

## 6. Primer refactor paso a paso: un acordeón controlado

### Paso 1: el hijo recibe su estado

~~~tsx
type FindingPanelProps = Readonly<{
  finding: FindingPreview;
  isOpen: boolean;
  onOpenChange: (nextOpen: boolean) => void;
}>;

function FindingPanel({
  finding,
  isOpen,
  onOpenChange,
}: FindingPanelProps) {
  const contentId = `finding-panel-${finding.id}`;

  return (
    <section>
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          onClick={() => onOpenChange(!isOpen)}
        >
          {finding.title}
        </button>
      </h3>

      {isOpen && (
        <div id={contentId}>
          <p>{finding.summary}</p>
        </div>
      )}
    </section>
  );
}
~~~

`FindingPanel` ya no posee `useState`. Su estado importante está controlado por props:

- `isOpen` indica la realidad actual;
- `onOpenChange` comunica el siguiente estado solicitado.

### Paso 2: el padre conserva la identidad abierta

~~~tsx
import { useState } from "react";

type FindingsAccordionProps = Readonly<{
  findings: readonly FindingPreview[];
}>;

export function FindingsAccordion({
  findings,
}: FindingsAccordionProps) {
  const [openFindingId, setOpenFindingId] = useState<
    string | null
  >(null);

  function handleOpenChange(
    findingId: string,
    nextOpen: boolean,
  ) {
    setOpenFindingId((currentId) => {
      if (nextOpen) {
        return findingId;
      }

      return currentId === findingId ? null : currentId;
    });
  }

  return (
    <div>
      {findings.map((finding) => (
        <FindingPanel
          key={finding.id}
          finding={finding}
          isOpen={openFindingId === finding.id}
          onOpenChange={(nextOpen) => {
            handleOpenChange(finding.id, nextOpen);
          }}
        />
      ))}
    </div>
  );
}
~~~

Ahora la estructura impide que haya dos identificadores abiertos simultáneamente. Al abrir un panel, el padre reemplaza la identidad anterior; al cerrar el actual, guarda `null`.

### Paso 3: cada hijo vuelve a renderizar con la misma decisión

No enviamos órdenes imperativas como “cierra el panel anterior”. El padre cambia `openFindingId`; cada panel calcula `isOpen` a partir de ese dato. Esa es la diferencia entre coordinar estado declarativamente y manipular componentes desde fuera.

---

## 7. Componente controlado y componente no controlado

La distinción no se limita a elementos HTML.

### Componente controlado

Su información importante procede de props y el padre decide el valor actual:

~~~tsx
<FindingPanel
  finding={finding}
  isOpen={openFindingId === finding.id}
  onOpenChange={handleOpenChange}
/>
~~~

Ventajas:

- coordinación con otros componentes;
- estado visible y predecible para el padre;
- reglas como “solo uno abierto”;
- pruebas de contrato sencillas;
- posibilidad de controlar el valor desde URL, navegación u otra fuente.

### Componente no controlado

Mantiene su propio estado interno:

~~~tsx
function IndependentPanel({
  finding,
}: {
  finding: FindingPreview;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => setIsOpen((current) => !current)}
    >
      {finding.title}
    </button>
  );
}
~~~

Ventajas:

- API externa más pequeña;
- autonomía cuando nadie más necesita conocer el dato;
- apropiado para detalles visuales verdaderamente locales.

“Controlado” no significa mejor en todos los casos. Significa que el dueño del estado está fuera del componente.

---

## 8. Diseñar callbacks semánticos con TypeScript

El contrato del componente debe describir una intención del dominio de la interfaz.

~~~ts
type StatusFilter =
  | "all"
  | "open"
  | "in_progress"
  | "resolved";

type StatusFilterProps = Readonly<{
  value: StatusFilter;
  onChange: (nextValue: StatusFilter) => void;
}>;
~~~

`onChange` no expone detalles de React ni del DOM. El componente padre recibe un `StatusFilter`, no un `ChangeEvent<HTMLSelectElement>`.

Compara con una API que filtra demasiado poco:

~~~ts
import type { ChangeEvent } from "react";

// Evítala como contrato público del componente.
type LeakyFilterProps = {
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
};
~~~

Ahora el padre debe conocer que el hijo usa un `select`. Si mañana el filtro cambia a botones, la API deja de tener sentido.

El hijo debería interpretar su evento DOM y emitir un valor del dominio de la UI.

---

## 9. No expongas el setter del padre sin necesidad

También es posible pasar el setter de `useState`:

~~~tsx
import type { Dispatch, SetStateAction } from "react";

type CoupledProps = {
  setStatusFilter: Dispatch<SetStateAction<StatusFilter>>;
};
~~~

Aunque está correctamente tipado, suele ser una API demasiado acoplada. El hijo puede:

- enviar un valor;
- enviar una función actualizadora;
- depender de que el padre use exactamente `useState`;
- decidir detalles que pertenecen al padre.

Prefiere un callback semántico:

~~~ts
type DecoupledProps = {
  onStatusFilterChange: (nextFilter: StatusFilter) => void;
};
~~~

El padre puede actualizar estado, escribir métricas, sincronizar la URL o rechazar una transición sin cambiar el contrato del hijo.

Pasar un setter no es un error de TypeScript; es una decisión de diseño. Puede ser aceptable entre componentes muy cercanos, pero no debería ser el valor predeterminado de una API reusable.

---

## 10. Los datos bajan; las intenciones suben

Considera un filtro controlado basado en botones:

~~~tsx
const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En progreso" },
  { value: "resolved", label: "Resueltos" },
] as const satisfies readonly {
  value: StatusFilter;
  label: string;
}[];

function StatusFilterBar({
  value,
  onChange,
}: StatusFilterProps) {
  return (
    <div aria-label="Filtrar hallazgos">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
~~~

El ciclo es:

1. El padre renderiza `value="all"`.
2. El hijo muestra “Todos” como activo.
3. La persona pulsa “Abiertos”.
4. El hijo ejecuta `onChange("open")`.
5. El padre decide actualizar su estado.
6. El padre renderiza `value="open"`.
7. Todos los consumidores observan el mismo filtro.

El callback no cambia el valor por sí solo. Si el padre no actualiza la prop, el componente seguirá mostrando el valor anterior. Es el mismo principio de un `input` controlado.

---

## 11. Estado fuente frente a información derivada

Después de elevar un filtro, puede surgir la tentación de guardar también la lista filtrada:

~~~tsx
// Evita duplicar información que puede calcularse.
const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
const [visibleFindings, setVisibleFindings] = useState<Finding[]>([]);
~~~

Ahora existen dos fuentes relacionadas. Cada cambio en `findings` o `statusFilter` obliga a actualizar `visibleFindings` correctamente.

Si el cálculo es rápido, derívalo durante el render:

~~~ts
function matchesStatus(
  finding: Finding,
  filter: StatusFilter,
): boolean {
  return filter === "all" || finding.status === filter;
}

const visibleFindings = findings.filter((finding) =>
  matchesStatus(finding, statusFilter),
);
~~~

La lista visible no es memoria independiente; es una vista de dos fuentes:

- los hallazgos disponibles;
- el filtro actual.

### Regla práctica

Si puedes calcular un valor completamente desde props y estado durante el render, normalmente no necesitas otro `useState`.

---

## 12. Evitar Effects para sincronizar estado derivado

Este patrón produce una renderización con datos antiguos y otra para corregirlos:

~~~tsx
// Diseño innecesariamente sincronizado.
const [visibleFindings, setVisibleFindings] = useState(findings);

useEffect(() => {
  setVisibleFindings(
    findings.filter((finding) =>
      matchesStatus(finding, statusFilter),
    ),
  );
}, [findings, statusFilter]);
~~~

El valor puede calcularse directamente. Eliminar el estado duplicado también elimina el Effect, una transición intermedia y una fuente de errores.

Los Effects sirven para sincronizar React con **sistemas externos**, no para mantener dos variables de React copiándose mutuamente. Más adelante estudiarás Effects con profundidad.

---

## 13. Guarda identidades estables, no copias completas

Para seleccionar un hallazgo, podrías guardar todo el objeto:

~~~tsx
const [selectedFinding, setSelectedFinding] =
  useState<Finding | null>(null);
~~~

Si después `findings` recibe una versión actualizada desde la API, el objeto seleccionado puede quedar obsoleto. Una estrategia más estable es conservar su identidad:

~~~tsx
const [selectedFindingId, setSelectedFindingId] = useState<
  string | null
>(null);

const selectedFinding =
  findings.find((finding) => finding.id === selectedFindingId) ??
  null;
~~~

Así el detalle siempre se deriva de la colección actual.

Este principio recuerda a la normalización de una base de datos: evita guardar copias del mismo registro en varias ubicaciones cuando una identidad permite recuperarlo.

---

## 14. Modelo tipado para el espacio de trabajo de hallazgos

Definamos datos ficticios y genéricos para SiteOps Tracker:

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
    id: z.string().min(1),
    siteId: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    status: FindingStatusSchema,
    severity: FindingSeveritySchema,
  })
  .strict();

export const FindingListSchema = z.array(FindingSchema);

export type FindingStatus = z.infer<
  typeof FindingStatusSchema
>;
export type FindingSeverity = z.infer<
  typeof FindingSeveritySchema
>;
export type Finding = z.infer<typeof FindingSchema>;

export type StatusFilter = "all" | FindingStatus;
~~~

El esquema existirá en runtime. Los tipos inferidos ayudarán durante el desarrollo, pero desaparecerán al compilar.

---

## 15. Ejemplo completo: filtro, lista y detalle sincronizados

En este ejemplo, `FindingsWorkspace` es el ancestro común. Posee únicamente el filtro y el identificador seleccionado. La lista visible, los conteos y el objeto seleccionado se derivan.

~~~tsx
import { useState } from "react";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "open", label: "Abiertos" },
  { value: "in_progress", label: "En progreso" },
  { value: "resolved", label: "Resueltos" },
] as const satisfies readonly {
  value: StatusFilter;
  label: string;
}[];

type StatusCounts = Readonly<Record<StatusFilter, number>>;

function matchesStatus(
  finding: Finding,
  filter: StatusFilter,
): boolean {
  return filter === "all" || finding.status === filter;
}

function countByStatus(
  findings: readonly Finding[],
): StatusCounts {
  const counts: Record<StatusFilter, number> = {
    all: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
  };

  for (const finding of findings) {
    counts.all += 1;
    counts[finding.status] += 1;
  }

  return counts;
}

type StatusFilterBarProps = Readonly<{
  value: StatusFilter;
  counts: StatusCounts;
  onChange: (nextValue: StatusFilter) => void;
}>;

function StatusFilterBar({
  value,
  counts,
  onChange,
}: StatusFilterBarProps) {
  return (
    <div aria-label="Filtrar hallazgos por estado">
      {STATUS_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label} ({counts[option.value]})
        </button>
      ))}
    </div>
  );
}

type FindingsListProps = Readonly<{
  findings: readonly Finding[];
  selectedId: string | null;
  onSelect: (findingId: string) => void;
}>;

function FindingsList({
  findings,
  selectedId,
  onSelect,
}: FindingsListProps) {
  if (findings.length === 0) {
    return <p>No hay hallazgos para este filtro.</p>;
  }

  return (
    <ul aria-label="Hallazgos">
      {findings.map((finding) => (
        <li key={finding.id}>
          <button
            type="button"
            aria-pressed={selectedId === finding.id}
            aria-label={`Seleccionar ${finding.title}`}
            onClick={() => onSelect(finding.id)}
          >
            <strong>{finding.title}</strong>
            <span> — {finding.status}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type FindingDetailsProps = Readonly<{
  finding: Finding | null;
}>;

function FindingDetails({ finding }: FindingDetailsProps) {
  if (finding === null) {
    return <p>Selecciona un hallazgo para ver el detalle.</p>;
  }

  return (
    <article aria-labelledby={`finding-title-${finding.id}`}>
      <h2 id={`finding-title-${finding.id}`}>
        {finding.title}
      </h2>
      <dl>
        <dt>Estado</dt>
        <dd>{finding.status}</dd>
        <dt>Severidad</dt>
        <dd>{finding.severity}</dd>
      </dl>
      <p>{finding.description}</p>
    </article>
  );
}

type FindingsWorkspaceProps = Readonly<{
  findings: readonly Finding[];
}>;

export function FindingsWorkspace({
  findings,
}: FindingsWorkspaceProps) {
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [selectedFindingId, setSelectedFindingId] = useState<
    string | null
  >(null);

  const counts = countByStatus(findings);

  const visibleFindings = findings.filter((finding) =>
    matchesStatus(finding, statusFilter),
  );

  const selectedFinding =
    visibleFindings.find(
      (finding) => finding.id === selectedFindingId,
    ) ?? null;

  function handleStatusFilterChange(nextFilter: StatusFilter) {
    setStatusFilter(nextFilter);

    setSelectedFindingId((currentId) => {
      if (currentId === null) {
        return null;
      }

      const currentFinding = findings.find(
        (finding) => finding.id === currentId,
      );

      if (
        currentFinding === undefined ||
        !matchesStatus(currentFinding, nextFilter)
      ) {
        return null;
      }

      return currentId;
    });
  }

  return (
    <section aria-labelledby="findings-workspace-title">
      <h1 id="findings-workspace-title">Hallazgos</h1>

      <StatusFilterBar
        value={statusFilter}
        counts={counts}
        onChange={handleStatusFilterChange}
      />

      <p role="status">
        {visibleFindings.length} hallazgo(s) visible(s)
      </p>

      <div>
        <FindingsList
          findings={visibleFindings}
          selectedId={selectedFinding?.id ?? null}
          onSelect={setSelectedFindingId}
        />
        <FindingDetails finding={selectedFinding} />
      </div>
    </section>
  );
}
~~~

### Responsabilidad de cada componente

| Componente | Recibe | Notifica | ¿Posee estado compartido? |
|---|---|---|---:|
| `StatusFilterBar` | filtro y conteos | nuevo filtro | No |
| `FindingsList` | lista visible y selección | identificador elegido | No |
| `FindingDetails` | hallazgo derivado | nada | No |
| `FindingsWorkspace` | hallazgos disponibles | — | Sí |

Los hijos pueden reutilizarse porque desconocen cómo se conserva el estado. El padre coordina la regla completa.

---

## 16. Funcionamiento del ejemplo paso a paso

1. `statusFilter` inicia como `"all"`.
2. `selectedFindingId` inicia como `null`.
3. Los conteos se calculan desde `findings`.
4. La lista visible se calcula desde `findings` y `statusFilter`.
5. El detalle se calcula buscando `selectedFindingId` dentro de la lista visible.
6. El filtro recibe `value`, `counts` y `onChange`.
7. Al seleccionar “Abiertos”, el hijo emite `"open"`.
8. El padre actualiza el filtro y revisa si la selección todavía cumple la nueva condición.
9. Si la selección queda oculta, se reemplaza por `null`.
10. La lista y el detalle reciben props coherentes en la siguiente renderización.
11. Ningún Effect copia el filtro ni reconstruye una segunda fuente de verdad.

La actualización funcional de `selectedFindingId` es importante porque calcula el siguiente valor desde el estado más reciente.

---

## 17. Mantener invariantes en el dueño del estado

Una **invariante** es una condición que debe permanecer verdadera. En el ejemplo:

> Si existe un hallazgo seleccionado, debe estar presente en la lista visible.

El padre posee tanto el filtro como la selección, así que es el lugar adecuado para preservar esa relación.

No obligues a `FindingsList` a cambiar directamente el filtro ni a `StatusFilterBar` a conocer la lista. Cada hijo expresa una intención limitada; el padre combina las reglas.

Otros ejemplos de invariantes en SiteOps Tracker:

- solo un panel de detalle puede estar expandido;
- una acción masiva solo puede contener activos de la sede seleccionada;
- al cambiar de sede se limpia una selección incompatible;
- el botón de guardar se deshabilita durante un envío;
- una vista previa usa exactamente el mismo borrador que el formulario.

---

## 18. Diseñar una API que admita modo controlado o no controlado

Algunos componentes reutilizables necesitan ambos modos. TypeScript puede impedir combinaciones ambiguas.

~~~tsx
type BaseFilterProps = Readonly<{
  label: string;
}>;

type ControlledFilterProps = Readonly<{
  value: StatusFilter;
  onChange: (nextValue: StatusFilter) => void;
  defaultValue?: never;
}>;

type UncontrolledFilterProps = Readonly<{
  value?: never;
  defaultValue?: StatusFilter;
  onChange?: (nextValue: StatusFilter) => void;
}>;

type FlexibleStatusFilterProps = BaseFilterProps &
  (ControlledFilterProps | UncontrolledFilterProps);

export function FlexibleStatusFilter(
  props: FlexibleStatusFilterProps,
) {
  const [internalValue, setInternalValue] =
    useState<StatusFilter>(props.defaultValue ?? "all");

  const isControlled = props.value !== undefined;
  const currentValue = isControlled
    ? props.value
    : internalValue;

  function commit(nextValue: StatusFilter) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    props.onChange?.(nextValue);
  }

  return (
    <fieldset>
      <legend>{props.label}</legend>
      {STATUS_FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={currentValue === option.value}
          onClick={() => commit(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
~~~

Usos válidos:

~~~tsx
// Controlado por el padre.
<FlexibleStatusFilter
  label="Estado"
  value={statusFilter}
  onChange={setStatusFilter}
/>

// No controlado; el componente conserva su estado.
<FlexibleStatusFilter
  label="Estado rápido"
  defaultValue="open"
/>
~~~

Uso rechazado por TypeScript:

~~~tsx
// Incorrecto: mezcla dos fuentes iniciales/actuales.
<FlexibleStatusFilter
  label="Estado"
  value="open"
  defaultValue="resolved"
  onChange={() => undefined}
/>
~~~

La unión declara que `value` y `defaultValue` son alternativas. Aun con este diseño, evita cambiar el componente de controlado a no controlado durante su vida.

---

## 19. Error frecuente: copiar props a estado

Este componente usa la prop solo para inicializarse:

~~~tsx
type FindingTitleEditorProps = Readonly<{
  finding: Finding;
}>;

function StaleFindingTitleEditor({
  finding,
}: FindingTitleEditorProps) {
  const [title, setTitle] = useState(finding.title);

  return (
    <input
      value={title}
      onChange={(event) => setTitle(event.currentTarget.value)}
    />
  );
}
~~~

Si el padre cambia de hallazgo pero React conserva la misma instancia del editor, `useState` no vuelve a ejecutar su valor inicial. El campo puede mostrar el título anterior.

Antes de copiar una prop, pregunta qué comportamiento necesitas.

### Caso A: solo mostrar el valor

Usa directamente la prop; no necesitas estado.

### Caso B: el padre debe conocer y compartir cada edición

Haz el editor controlado:

~~~tsx
type ControlledTitleEditorProps = Readonly<{
  value: string;
  onChange: (nextTitle: string) => void;
}>;

function ControlledTitleEditor({
  value,
  onChange,
}: ControlledTitleEditorProps) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    />
  );
}
~~~

### Caso C: cada identidad necesita un borrador local nuevo

El padre puede indicar que se trata de otra instancia mediante `key`:

~~~tsx
<LocalFindingEditor
  key={selectedFinding.id}
  finding={selectedFinding}
/>
~~~

Cambiar la `key` reinicia el estado del subárbol. Hazlo solo cuando descartar el borrador anterior sea la intención explícita.

---

## 20. Cuándo preservar y cuándo reiniciar estado

React asocia el estado con la posición de un componente en el árbol de renderizado. Mientras se mantengan el tipo, la posición y la identidad, React suele preservar ese estado.

Usa una `key` diferente para reiniciar cuando:

- cambiar de hallazgo debe comenzar un borrador nuevo;
- cambiar de sede debe limpiar un formulario local;
- dos identidades no deben compartir historial de edición.

No uses `key={Math.random()}` ni una clave cambiante en cada render. Eso destruye y crea componentes continuamente, pierde foco, borra borradores y desperdicia trabajo.

Si el borrador debe sobrevivir al cambiar entre elementos, una `key` que lo destruya no sirve. En ese caso, el padre puede almacenar borradores por identificador o usar una estrategia de estado más adecuada.

---

## 21. Type checking no sustituye validación runtime

`FindingsWorkspace` recibe `readonly Finding[]`, pero ese tipo solo describe lo que el código espera. Si los datos nacieron en HTTP, el navegador recibió JSON sin garantías.

Valida en la frontera:

~~~ts
export async function fetchFindings(
  baseUrl: string,
): Promise<readonly Finding[]> {
  const response = await fetch(`${baseUrl}/findings`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const payload: unknown = await response.json();
  return FindingListSchema.parse(payload);
}
~~~

Solo después del `parse` resulta razonable pasar los datos como props `Finding[]`.

Los tipos TypeScript desaparecen en runtime. Deben validarse realmente:

- formularios;
- solicitudes y respuestas HTTP;
- APIs externas;
- archivos de configuración;
- variables de entorno;
- filas obtenidas de bases de datos cuando el contrato no está garantizado;
- mensajes asíncronos.

Elevar estado resuelve coordinación dentro de React. No convierte datos externos en confiables.

---

## 22. La fuente de verdad cambia según la responsabilidad

“Fuente única” no significa que React y PostgreSQL guarden exactamente la misma clase de estado.

| Dato | Fuente principal | Copia o representación |
|---|---|---|
| Filtro visible | Estado del contenedor React | Props hacia hijos |
| Elemento seleccionado | Identificador en React | Objeto derivado de la colección |
| Hallazgo persistido | PostgreSQL | Respuesta/caché validada en el cliente |
| Usuario autenticado | Sistema de autenticación/backend | Sesión segura en cliente |
| Regla de autorización | Service/backend | La UI solo refleja capacidades comunicadas |

React puede tener una instantánea de datos del servidor, pero no debe considerarse autoridad para permisos, integridad o reglas de negocio.

---

## 23. Relación con la arquitectura Full Stack

El recorrido del proyecto sigue siendo:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

El tema actual se conecta así:

| Capa | Relación con estado elevado y componentes controlados |
|---|---|
| React | Define el dueño del filtro, selección y borradores compartidos |
| HTTP/SDK | Convierte acciones explícitas en solicitudes y valida respuestas |
| Node.js | Recibe datos externos; no confía en tipos del frontend |
| Router | Dirige cada método y ruta al flujo apropiado |
| Controller | Traduce HTTP sin administrar estado visual |
| Runtime Validation | Convierte candidatos `unknown` en entradas comprobadas |
| Service | Protege reglas de negocio y autorización |
| Repository | Lee y escribe mediante contratos de persistencia |
| PostgreSQL | Es autoridad para los datos persistidos y su integridad |
| Testing | Verifica coordinación de UI y contratos entre capas |
| Docker | Reproduce dependencias sin cambiar quién posee cada estado |
| CI/CD | Ejecuta typecheck, lint, pruebas y build antes de desplegar |
| Cloud | Aloja, configura y observa el flujo en ejecución |

No eleves una decisión de autorización al frontend. Por ejemplo, ocultar el botón “Resolver” mejora la experiencia, pero el Service debe volver a verificar si la persona puede realizar esa acción.

---

## 24. Cuándo utilizar estado elevado

Eleva el estado cuando:

- dos o más componentes hermanos necesitan el mismo valor;
- un componente modifica algo que otro debe reflejar inmediatamente;
- existe una invariante entre varias piezas de UI;
- el padre debe coordinar selección, filtros o expansión;
- una vista y un formulario comparten el mismo borrador;
- quieres convertir un componente en una pieza controlada y reutilizable;
- el estado debe sincronizarse con una fuente superior, como la URL o un contenedor de página.

Señal práctica: si estás escribiendo código para copiar el mismo dato entre componentes, probablemente debes mover la propiedad al dueño común y pasarla mediante props.

---

## 25. Cuándo evitar elevar estado

Conserva estado local cuando:

- solo un componente necesita conocerlo;
- es un detalle efímero como expansión independiente, foco o borrador aislado;
- elevarlo no preserva ninguna regla ni habilita coordinación;
- el padre se volvería responsable de detalles internos irrelevantes;
- provocarías prop drilling extenso sin una necesidad real;
- ya existe una fuente de servidor o caché especializada y solo crearías otra copia manual.

No eleves todo al componente raíz. Busca el **ancestro común más cercano** que necesita coordinar el dato.

Si muchos niveles intermedios solo retransmiten props, más adelante podrás evaluar composición, Context o un gestor de estado. Primero comprueba que el problema sea real.

---

## 26. Errores comunes y sus causas

### Error 1: guardar el mismo filtro en dos hijos

Las copias pueden divergir. Eleva el valor al ancestro común.

### Error 2: almacenar información derivada

Guardar `visibleFindings` además de `findings` y `statusFilter` crea sincronización innecesaria. Calcúlala durante el render.

### Error 3: copiar props a `useState` sin definir una política

El valor inicial solo se usa en el montaje. Decide si el componente será controlado, si necesita un borrador local o si debe reiniciarse por identidad.

### Error 4: usar un Effect para copiar una prop

~~~tsx
useEffect(() => {
  setLocalValue(value);
}, [value]);
~~~

Puede introducir un render intermedio y dos fuentes de verdad. Prefiere leer `value` directamente si el componente es controlado.

### Error 5: pasar eventos DOM al contenedor

Hace que el padre dependa de la implementación visual del hijo. Emite valores semánticos.

### Error 6: exponer setters por defecto

Filtra la implementación del padre y amplía innecesariamente lo que el hijo puede hacer. Prefiere callbacks específicos.

### Error 7: mutar objetos recibidos por props

Las props se tratan como inmutables. El hijo debe emitir una intención; el dueño crea el siguiente estado.

### Error 8: elevar estado demasiado alto

Todo el árbol recibe responsabilidades que no necesita y los contratos se vuelven ruidosos. Usa el ancestro común más cercano.

### Error 9: mezclar `value` y `defaultValue`

Representan modos controlado y no controlado. Una unión de props puede hacer inválida esa combinación.

### Error 10: cambiar de modo durante la vida del componente

No pases `undefined` primero y un valor después como estrategia accidental. Mantén una política estable.

### Error 11: usar `key` aleatoria para “actualizar”

La `key` cambia la identidad y destruye el estado. No es un mecanismo general de refresco.

### Error 12: guardar el objeto seleccionado y su identificador

Son datos duplicados. Conserva normalmente el ID y deriva el objeto actual.

### Error 13: confiar en props tipadas provenientes de HTTP

El tipo estático no valida JSON. Usa Zod u otra validación ejecutable antes de renderizar.

### Error 14: convertir estado de UI en regla de seguridad

Un botón deshabilitado no protege una API. El backend debe validar identidad, permisos y entrada.

### Error 15: crear callbacks ambiguos

`onAction` dice poco. Nombres como `onStatusFilterChange`, `onFindingSelect` u `onOpenChange` explican el contrato.

---

## 27. Rendimiento, renderizaciones y prop drilling

Elevar estado hace que el componente dueño se vuelva a renderizar y, por defecto, también se evalúen sus descendientes. Eso no significa que debas evitar el patrón.

Primero diseña un flujo correcto. Después mide con herramientas adecuadas si existe un problema real.

Buenas decisiones iniciales:

- conserva el estado en el ancestro común más cercano;
- no guardes cálculos duplicados;
- evita componentes enormes con trabajo costoso no relacionado;
- mantén props pequeñas y semánticas;
- no uses `useMemo`, `useCallback` o `memo` sin una razón medida;
- separa estado de servidor de estado puramente visual.

Si el valor debe atravesar muchos niveles que no lo usan, existe prop drilling. La composición puede resolver algunos casos; Context y reducers se estudiarán cuando la escala lo justifique.

---

## 28. Prueba de sincronización con Vitest y Testing Library

La prueba debe observar el comportamiento conjunto, no inspeccionar variables internas.

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FindingsWorkspace } from "./FindingsWorkspace";
import type { Finding } from "./finding.schema";

const FINDINGS: readonly Finding[] = [
  {
    id: "finding-demo-01",
    siteId: "site-demo-north",
    title: "UPS sin monitoreo",
    description: "Dato ficticio para práctica.",
    status: "open",
    severity: "high",
  },
  {
    id: "finding-demo-02",
    siteId: "site-demo-north",
    title: "Etiqueta de rack pendiente",
    description: "Dato ficticio para práctica.",
    status: "open",
    severity: "low",
  },
  {
    id: "finding-demo-03",
    siteId: "site-demo-south",
    title: "Inventario actualizado",
    description: "Dato ficticio para práctica.",
    status: "resolved",
    severity: "medium",
  },
];

describe("FindingsWorkspace", () => {
  it("sincroniza filtro, lista, conteo y detalle", async () => {
    const user = userEvent.setup();

    render(<FindingsWorkspace findings={FINDINGS} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "3 hallazgo(s) visible(s)",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Seleccionar UPS sin monitoreo",
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "UPS sin monitoreo",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Resueltos (1)",
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "1 hallazgo(s) visible(s)",
    );
    expect(
      screen.queryByRole("button", {
        name: "Seleccionar UPS sin monitoreo",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Selecciona un hallazgo para ver el detalle.",
      ),
    ).toBeInTheDocument();
  });
});
~~~

La prueba demuestra la regla observable:

- el filtro cambia la lista;
- el conteo usa la misma fuente;
- una selección incompatible se limpia;
- el detalle refleja el estado coordinado.

`userEvent.setup()` y las consultas por rol aproximan la prueba al uso real y también favorecen una interfaz accesible.

---

## 29. Relación con las piezas del portafolio

### SiteOps Tracker

Un contenedor puede coordinar sede, estado, hallazgo seleccionado y detalle. Los componentes visuales reciben contratos pequeños y reutilizables.

### SDK tipado para una API

El SDK entrega datos validados al contenedor. Cambiar un filtro local no tiene que disparar HTTP automáticamente; el dueño decide si el filtrado es local o remoto y conserva una API clara.

### API REST Node.js + TypeScript + PostgreSQL

El frontend envía filtros de consulta o comandos explícitos. Node valida los valores en runtime, el Service aplica reglas y el Repository consulta PostgreSQL. El estado elevado no reemplaza ninguna de esas capas.

### Analizador de configuraciones

El editor y la vista previa pueden compartir un único texto fuente. La vista previa deriva un resultado analizado; no mantiene otra copia independiente del archivo.

### Repositorio de algoritmos TypeScript

Un selector de algoritmo, un editor de entrada y un panel de resultado pueden coordinarse desde un contenedor. La entrada validada alimenta la ejecución; el resultado es derivado.

### Aplicación Full Stack

Este patrón muestra que puedes diseñar límites tanto dentro del frontend como entre frontend y backend: propiedad clara, contratos tipados, validación runtime y pruebas de comportamiento.

---

## 30. Ejercicio práctico — Sede compartida entre tres componentes

Crea una pantalla `SiteAuditWorkspace` de SiteOps Tracker con:

1. `SiteSelector`: permite elegir una sede ficticia.
2. `SiteFindingSummary`: muestra cuántos hallazgos corresponden a la sede.
3. `CreateFindingShortcut`: muestra para qué sede se creará un futuro hallazgo.

### Datos base

~~~ts
type Site = {
  id: string;
  name: string;
};

type FindingSummary = {
  id: string;
  siteId: string;
  status: "open" | "in_progress" | "resolved";
};
~~~

### Requisitos

- `selectedSiteId` debe existir en un solo componente dueño.
- `SiteSelector` debe ser controlado.
- Su callback debe emitir `string | null`, no un evento DOM.
- El resumen debe derivarse de `findings` y `selectedSiteId`.
- No guardes `filteredFindings` en otro `useState`.
- El atajo debe recibir la sede seleccionada por props.
- Si no hay sede, los otros dos componentes deben mostrar un estado vacío coherente.
- Usa datos exclusivamente ficticios.
- No implementes todavía llamadas HTTP ni una solución completa dentro de este enunciado.

### Contratos sugeridos

~~~ts
type SiteSelectorProps = Readonly<{
  sites: readonly Site[];
  value: string | null;
  onChange: (nextSiteId: string | null) => void;
}>;

type SiteFindingSummaryProps = Readonly<{
  siteId: string | null;
  findings: readonly FindingSummary[];
}>;
~~~

---

## 31. Pistas para el ejercicio

1. El dueño más cercano es el componente que renderiza los tres hijos.
2. Convierte `null` a `""` solo en la prop `value` del `select`.
3. El valor del DOM sigue siendo `string`; comprueba que corresponda a una sede conocida antes de emitirlo.
4. Usa `.filter()` o `.reduce()` durante el render para obtener el conteo.
5. Nombra el callback `onSiteChange` o `onChange`, no `setState`.
6. El atajo no necesita conocer la lista completa; pasa la información mínima.
7. Prueba que cambiar de sede actualiza el selector, el resumen y el atajo con una sola interacción.
8. Si los datos vinieran de HTTP, valida el payload antes de renderizar los componentes.

Las pistas orientan el diseño; el ejercicio queda deliberadamente sin solución completa.

---

## 32. Reto adicional — Espacio de activos coordinado de extremo a extremo

Construye `AssetsWorkspace` con dificultad mayor.

### React

- Un contenedor posee `selectedSiteId`, `statusFilter` y `selectedAssetId`.
- `SiteSelector`, `AssetStatusFilter`, `AssetList` y `AssetDetails` son controlados.
- Al cambiar de sede, se limpia una selección incompatible.
- La lista y el activo seleccionado se derivan; no se duplican.
- Un formulario de búsqueda mantiene localmente su texto solo si ningún hermano lo necesita.

### HTTP y SDK

- El SDK obtiene activos desde una API REST.
- El JSON se trata como `unknown`.
- Zod valida la respuesta antes de entregarla a React.
- Los errores se convierten en una unión segura para la UI.

### Node.js y PostgreSQL

- Expón una ruta ficticia `GET /assets?siteId=...&status=...`.
- El Controller valida query params.
- El Service comprueba acceso a la sede.
- El Repository construye la consulta parametrizada.
- PostgreSQL conserva claves e integridad.

### Testing

- Prueba el componente controlado de forma aislada.
- Prueba la coordinación del contenedor con Testing Library.
- Prueba la ruta con entrada válida e inválida.
- Añade una prueba que demuestre que cambiar de sede limpia un activo incompatible.

### Docker, CI/CD y Cloud

Deja documentado, sin profundizar aún, cómo se ejecutarán más adelante frontend, API y PostgreSQL con Docker; qué verificaciones correrá CI; y dónde vivirán configuración, secretos y logs en Cloud.

---

## 33. Preguntas de comprensión

1. ¿Qué problema resuelve elevar estado?
2. ¿Cómo eliges el componente que debe poseerlo?
3. ¿Qué información baja por props?
4. ¿Qué representan los callbacks enviados a los hijos?
5. ¿En qué sentido un componente React puede ser controlado sin ser un `input`?
6. ¿Por qué dos copias del mismo filtro son peligrosas?
7. ¿Cuándo `visibleFindings` debe ser un cálculo y no estado?
8. ¿Por qué un Effect que copia props a estado suele ser una señal de diseño duplicado?
9. ¿Qué ventaja tiene guardar `selectedFindingId` en lugar del objeto completo?
10. ¿Qué expresa `defaultValue` en una API no controlada?
11. ¿Cómo puede una unión de props impedir mezclar `value` y `defaultValue`?
12. ¿Cuándo una `key` debe reiniciar el estado de un editor?
13. ¿Por qué `key={Math.random()}` es perjudicial?
14. ¿Por qué un callback semántico es preferible a exponer un evento DOM?
15. ¿Por qué una prop `Finding[]` no demuestra que el JSON de la API sea válido?
16. ¿Qué reglas siguen perteneciendo al backend aunque la UI esté perfectamente sincronizada?

---

## 34. Relevancia para entrevistas técnicas

### “¿Qué significa lifting state up?”

Mover el estado compartido al ancestro común más cercano, pasar el valor hacia los hijos mediante props y recibir intenciones mediante callbacks.

### “¿Qué es una fuente única de verdad?”

Una representación canónica de un dato. Las demás vistas se derivan de ella en lugar de conservar copias que requieren sincronización.

### “¿Cuál es la diferencia entre un componente controlado y uno no controlado?”

En el controlado, el valor importante procede de props y el padre decide el siguiente estado. En el no controlado, el componente conserva ese valor internamente.

### “¿Por qué no guardar una lista filtrada en estado?”

Si se obtiene completamente desde la colección y el filtro, almacenarla duplica información y crea riesgo de desincronización. Puede calcularse durante el render.

### “¿Por qué evitar copiar props a estado?”

Porque el inicializador de `useState` no se repite cuando cambia la prop. Sin una política explícita, la copia queda obsoleta y aparecen dos fuentes de verdad.

### “¿Pasarías `setState` a un hijo?”

Puede ser válido en un caso pequeño, pero un callback semántico suele desacoplar mejor: limita acciones, oculta la implementación del padre y permanece estable si cambia la estrategia de estado.

### “¿TypeScript valida la respuesta de la API?”

No. Sus tipos desaparecen en runtime. La respuesta debe tratarse como `unknown` y validarse antes de usarla.

Una respuesta fuerte conecta el patrón de React con invariantes, contratos, runtime validation y pruebas; no se limita a decir “mover `useState` al padre”.

---

## 35. Lista de verificación profesional

- [ ] Cada dato compartido tiene un dueño claro.
- [ ] El dueño es el ancestro común más cercano.
- [ ] No existen copias independientes del mismo filtro o selección.
- [ ] Los hijos reciben valores mediante props.
- [ ] Los hijos emiten intenciones mediante callbacks semánticos.
- [ ] Los componentes no mutan props.
- [ ] No se exponen eventos DOM fuera del componente sin necesidad.
- [ ] Los setters solo se pasan cuando el acoplamiento es intencional.
- [ ] La información calculable se deriva durante el render.
- [ ] Los objetos seleccionados se derivan normalmente desde un ID.
- [ ] No se usa un Effect para copiar estado interno.
- [ ] El modo controlado o no controlado permanece estable.
- [ ] Las `key` representan identidades estables.
- [ ] Los datos HTTP se validan en runtime.
- [ ] El backend conserva autorización y reglas de negocio.
- [ ] Las pruebas verifican sincronización observable.

---

## 36. Resumen

- Elevar estado coordina componentes que necesitan el mismo dato.
- El estado se mueve al ancestro común más cercano.
- Los valores bajan mediante props y las intenciones suben mediante callbacks.
- Un componente controlado recibe su estado importante desde fuera.
- Un componente no controlado conserva ese estado internamente.
- Una fuente única de verdad elimina copias que podrían divergir.
- Los valores derivados, como listas filtradas y conteos, normalmente se calculan durante el render.
- Guardar una identidad y derivar el objeto evita referencias obsoletas.
- Copiar props a estado requiere una política explícita; no es sincronización automática.
- Cambiar una `key` reinicia intencionalmente el estado de un subárbol.
- Callbacks semánticos desacoplan al padre de eventos DOM y detalles internos.
- TypeScript verifica código en compilación, pero sus tipos desaparecen en runtime.
- HTTP, formularios, APIs externas, archivos, variables de entorno y bases de datos requieren validación ejecutable.
- La coordinación de React no reemplaza Controllers, validación runtime, Services, Repositories ni restricciones de PostgreSQL.
- Testing Library permite comprobar que una interacción actualiza todas las vistas coordinadas.

---

## Referencias oficiales

- [React: Sharing State Between Components](https://react.dev/learn/sharing-state-between-components)
- [React: Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
- [React: State — A Component's Memory](https://react.dev/learn/state-a-components-memory)
- [React: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [React: Using TypeScript](https://react.dev/learn/typescript)
- [Zod: Basic usage](https://zod.dev/basics)
- [Testing Library: React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library: user-event introduction](https://testing-library.com/docs/user-event/intro/)
- [Testing Library: user-event setup](https://testing-library.com/docs/user-event/setup/)

Referencias consultadas el **13 de octubre de 2026**.

---

# Próxima lección

**Lección 38 — Renderizado de listas tipadas y keys estables en React.**
