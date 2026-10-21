# Lección 43 — Memoización consciente con useMemo, useCallback y memo: identidad, dependencias y cuándo no optimizar

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — rendimiento medido, identidad referencial y límites de renderizado  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 35–50 minutos

---

## 1. Introducción

En la lección anterior usaste refs para conservar nodos DOM y valores mutables que no deben provocar un render. Ahora aparece otro problema: un render puede repetir cálculos o volver a renderizar componentes aunque sus datos relevantes no hayan cambiado.

React ofrece tres herramientas relacionadas:

- **useMemo** conserva el resultado de un cálculo puro;
- **useCallback** conserva la identidad de una función;
- **memo** permite omitir el render de un componente cuando sus props siguen siendo equivalentes.

Estas herramientas no son requisitos para escribir React correcto. Son optimizaciones. Añaden comparaciones, memoria y complejidad, por lo que deben responder a un problema observado.

La regla central de esta lección es:

> Primero haz que el componente sea correcto, después mide, optimiza el cuello de botella y vuelve a medir.

SiteOps Tracker servirá para estudiar un panel de hallazgos que filtra, ordena y muestra muchas filas. El objetivo no es envolver todo en memoización, sino reconocer cuándo una identidad estable evita trabajo real y cuándo solo hace el código más difícil de mantener.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. explicar qué significa memoizar;
2. distinguir render, commit y actualización real del DOM;
3. razonar sobre identidad referencial y Object.is;
4. usar useMemo para un cálculo puro y costoso;
5. usar useCallback cuando una función estable tiene un consumidor concreto;
6. usar memo en componentes que renderizan con frecuencia y con las mismas props;
7. entender por qué una prop siempre nueva rompe memo;
8. declarar dependencias completas sin engañar al linter;
9. reconocer closures obsoletas causadas por dependencias omitidas;
10. reducir dependencias con actualizaciones funcionales de estado;
11. evitar efectos secundarios dentro de useMemo;
12. evitar comparadores personalizados peligrosos;
13. medir con React DevTools y Profiler;
14. probar comportamiento sin acoplar todas las pruebas al número de renders;
15. comprender el papel actual de React Compiler;
16. separar type checking de validación runtime;
17. relacionar la optimización del frontend con toda la arquitectura Full Stack.

---

## 3. El problema que resuelve la memoización

Imagina un dashboard con:

- 8 000 hallazgos ya validados;
- un filtro por texto;
- un filtro por severidad;
- un orden por fecha;
- una tabla con filas enriquecidas;
- un panel lateral con estado independiente.

Cada cambio de estado solicita un render del componente que posee ese estado. Durante el render, React vuelve a ejecutar el cuerpo del componente.

~~~tsx
type Finding = {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
};

type Props = {
  findings: readonly Finding[];
};

export function FindingsDashboard({ findings }: Props) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const visibleFindings = expensiveFilterAndSort(findings);

  return (
    <>
      <button onClick={() => setIsHelpOpen((open) => !open)}>
        Ayuda
      </button>

      {isHelpOpen && <aside>Cómo interpretar el tablero</aside>}
      <FindingsTable findings={visibleFindings} />
    </>
  );
}
~~~

Abrir la ayuda no cambia los hallazgos, pero el componente se ejecuta otra vez y repite expensiveFilterAndSort.

Eso no significa que React sea incorrecto. El modelo normal es volver a calcular la descripción de la interfaz. En la mayoría de los componentes, esos cálculos son suficientemente baratos.

La memoización importa cuando:

1. el cálculo o render es perceptiblemente costoso;
2. ocurre con frecuencia;
3. sus entradas suelen permanecer iguales;
4. medir demuestra que evita trabajo significativo.

---

## 4. Render no equivale a modificar el DOM

Conviene separar tres ideas:

1. **Solicitud de render:** cambia estado, contexto o props.
2. **Render:** React ejecuta componentes y calcula la siguiente descripción.
3. **Commit:** React aplica al DOM solamente las diferencias necesarias.

Que un componente vuelva a renderizar no implica que React reemplace todo el DOM. React compara el resultado y puede no tocar nodos reales.

Por eso, “hubo un render” no demuestra por sí solo un problema. Un render pequeño puede ser más barato que mantener varias memoizaciones.

La pregunta profesional no es “¿cómo evito todos los renders?”, sino:

> ¿Existe trabajo suficientemente costoso y repetido que una identidad estable pueda omitir?

---

## 5. Modelo mental: valor, referencia e identidad

JavaScript compara valores primitivos y referencias de manera distinta.

~~~ts
Object.is(3, 3); // true
Object.is("open", "open"); // true

Object.is({}, {}); // false
Object.is([], []); // false
Object.is(() => undefined, () => undefined); // false
~~~

Dos objetos con el mismo contenido no son la misma referencia:

~~~ts
const first = { severity: "high" };
const second = { severity: "high" };
const alias = first;

Object.is(first, second); // false
Object.is(first, alias); // true
~~~

Durante cada render, estos valores son nuevos:

~~~tsx
const options = { compact: true };
const visible = findings.filter((finding) => finding.status === "open");
const onSelect = (id: string) => setSelectedId(id);
~~~

Aunque options tenga el mismo contenido, visible contenga los mismos elementos y onSelect haga lo mismo, sus referencias se crean de nuevo.

Esto es importante porque:

- React compara dependencias de Hooks mediante Object.is;
- memo compara cada prop con Object.is de forma predeterminada;
- una sola prop siempre nueva puede impedir que memo omita el render.

---

## 6. ¿Por qué existe la memoización?

Memoizar significa conservar una salida asociada a determinadas entradas.

Conceptualmente:

~~~ts
const output = calculate(input);
~~~

se transforma en:

~~~ts
if (Object.is(previousInput, input)) {
  return previousOutput;
}

previousInput = input;
previousOutput = calculate(input);
return previousOutput;
~~~

En React, esta idea se aplica a tres niveles:

| Herramienta | Conserva | Se vuelve a calcular o renderizar cuando |
|---|---|---|
| useMemo | un valor calculado | cambia alguna dependencia |
| useCallback | una referencia de función | cambia alguna dependencia |
| memo | el resultado del render de un componente | cambia alguna prop, estado o contexto usado |

No son garantías semánticas. El programa debe seguir siendo correcto si React decide descartar una caché y recalcular.

---

## 7. useMemo: conservar el resultado de un cálculo

La forma general es:

~~~tsx
const value = useMemo(
  () => calculateValue(inputA, inputB),
  [inputA, inputB],
);
~~~

Durante el primer render, React ejecuta la función de cálculo. En renders posteriores:

- si todas las dependencias son iguales según Object.is, devuelve el valor almacenado;
- si alguna cambia, ejecuta de nuevo el cálculo y conserva el nuevo resultado.

### Un ejemplo mínimo

~~~tsx
import { useMemo } from "react";

type Finding = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
};

type Props = {
  findings: readonly Finding[];
  minimumSeverity: Finding["severity"];
};

const severityRank: Record<Finding["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function FindingCount({ findings, minimumSeverity }: Props) {
  const count = useMemo(
    () =>
      findings.filter(
        (finding) =>
          severityRank[finding.severity] >= severityRank[minimumSeverity],
      ).length,
    [findings, minimumSeverity],
  );

  return <output>{count}</output>;
}
~~~

TypeScript infiere count como number. useMemo no cambia el tipo del resultado; cambia cuándo se recalcula.

---

## 8. El cálculo debe ser puro

La función entregada a useMemo se ejecuta durante el render. Por tanto, debe ser pura:

- mismas entradas, misma salida;
- no modifica props ni estado;
- no realiza HTTP;
- no escribe en localStorage;
- no registra analítica;
- no cambia el DOM;
- no depende de valores ocultos mutables.

Uso incorrecto:

~~~tsx
const result = useMemo(() => {
  fetch("/api/findings"); // Incorrecto: efecto secundario durante render.
}, []);
~~~

Además de mezclar responsabilidades, esa función no devuelve un valor útil.

Uso correcto:

~~~tsx
const visibleFindings = useMemo(
  () => filterAndSortFindings(findings, filters),
  [findings, filters],
);
~~~

El acceso a red pertenece a un Effect, a un framework de datos o a una capa de consulta. useMemo solo calcula.

---

## 9. Una función pura reutilizable para SiteOps Tracker

Conviene extraer el algoritmo fuera del componente. Así puede probarse sin React y reutilizarse en el repositorio de algoritmos TypeScript.

~~~ts
export type FindingSeverity = "low" | "medium" | "high" | "critical";
export type FindingStatus = "open" | "in_progress" | "resolved";

export type Finding = Readonly<{
  id: string;
  title: string;
  siteName: string;
  severity: FindingSeverity;
  status: FindingStatus;
  detectedAt: string;
}>;

export type FindingFilters = Readonly<{
  query: string;
  minimumSeverity: FindingSeverity;
  status: FindingStatus | "all";
}>;

const severityRank: Readonly<Record<FindingSeverity, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function filterAndSortFindings(
  findings: readonly Finding[],
  filters: FindingFilters,
): readonly Finding[] {
  const normalizedQuery = filters.query.trim().toLocaleLowerCase("es-MX");
  const minimumRank = severityRank[filters.minimumSeverity];

  return findings
    .filter((finding) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        finding.title.toLocaleLowerCase("es-MX").includes(normalizedQuery) ||
        finding.siteName.toLocaleLowerCase("es-MX").includes(normalizedQuery);

      const matchesSeverity =
        severityRank[finding.severity] >= minimumRank;

      const matchesStatus =
        filters.status === "all" || finding.status === filters.status;

      return matchesQuery && matchesSeverity && matchesStatus;
    })
    .sort(
      (left, right) =>
        Date.parse(right.detectedAt) - Date.parse(left.detectedAt),
    );
}
~~~

La función:

- recibe readonly para comunicar que no debe mutar las entradas;
- filter crea un arreglo nuevo;
- sort modifica ese arreglo nuevo, no la prop original;
- no conoce React;
- no conoce HTTP ni PostgreSQL;
- es determinista para las mismas entradas.

Esta separación mejora el código aun si finalmente no necesitas useMemo.

---

## 10. Cuándo usar useMemo

useMemo es razonable cuando al menos uno de estos casos fue medido:

1. filtras, agrupas o transformas una colección grande;
2. ejecutas un algoritmo costoso durante renders frecuentes;
3. necesitas conservar la identidad de un objeto o arreglo que recibe un componente memoizado;
4. el valor es dependencia de otro Hook y crearlo siempre provoca trabajo externo innecesario;
5. una biblioteca requiere una configuración referencialmente estable.

Ejemplo con un filtro construido de forma estable:

~~~tsx
const filters = useMemo<FindingFilters>(
  () => ({
    query,
    minimumSeverity,
    status,
  }),
  [query, minimumSeverity, status],
);

const visibleFindings = useMemo(
  () => filterAndSortFindings(findings, filters),
  [findings, filters],
);
~~~

También puedes evitar el objeto intermedio:

~~~tsx
const visibleFindings = useMemo(
  () =>
    filterAndSortFindings(findings, {
      query,
      minimumSeverity,
      status,
    }),
  [findings, query, minimumSeverity, status],
);
~~~

La segunda versión suele ser más simple porque expresa directamente todas las entradas reactivas.

---

## 11. Cuándo evitar useMemo

No lo uses automáticamente para:

- una suma simple;
- una concatenación pequeña;
- una condición booleana;
- un acceso directo a una propiedad;
- un arreglo diminuto que rara vez renderiza;
- un valor que cambia en prácticamente cada render;
- corregir un error de lógica;
- almacenar estado;
- ejecutar efectos secundarios;
- evitar escribir una función clara.

Sobreoptimización:

~~~tsx
const fullLabel = useMemo(
  () => finding.siteName + " — " + finding.title,
  [finding.siteName, finding.title],
);
~~~

Versión suficiente:

~~~tsx
const fullLabel = finding.siteName + " — " + finding.title;
~~~

La memoización también cuesta:

- crear la función de cálculo;
- mantener la lista de dependencias;
- comparar dependencias;
- conservar el valor en memoria;
- aumentar el esfuerzo de revisión y depuración.

---

## 12. Dependencias: describe la realidad

La lista de dependencias no es una lista de preferencias. Debe incluir todo valor reactivo leído por la función de cálculo.

Incorrecto:

~~~tsx
const visibleFindings = useMemo(
  () => filterAndSortFindings(findings, filters),
  [findings], // Falta filters.
);
~~~

Si filters cambia, el resultado puede quedar obsoleto.

Correcto:

~~~tsx
const visibleFindings = useMemo(
  () => filterAndSortFindings(findings, filters),
  [findings, filters],
);
~~~

El linter exhaustive-deps ayuda a mantener esa relación. Silenciarlo puede ocultar una closure obsoleta.

Una dependencia cambia si su identidad cambia. Por eso este patrón invalida la memoización:

~~~tsx
const filters = {
  query,
  minimumSeverity,
  status,
};

const visibleFindings = useMemo(
  () => filterAndSortFindings(findings, filters),
  [findings, filters],
);
~~~

filters es un objeto nuevo en cada render.

Soluciones:

- construirlo dentro del cálculo;
- memoizarlo si tiene un consumidor real;
- pasar sus propiedades primitivas como dependencias.

---

## 13. React compara dependencias con Object.is

React no realiza comparación profunda.

~~~tsx
const firstFilters = { status: "open" };
const secondFilters = { status: "open" };

Object.is(firstFilters, secondFilters); // false
~~~

Una comparación profunda automática sería costosa e impredecible. Además:

- los objetos pueden ser enormes;
- pueden contener ciclos;
- las funciones no tienen equivalencia estructural segura;
- comparar profundamente podría costar más que recalcular.

Por eso React usa identidad.

La consecuencia de diseño es importante: conserva estructuras inmutables y estabiliza referencias solamente en los límites donde tenga valor.

---

## 14. useMemo no es almacenamiento de estado

No uses una caché para conservar una decisión de negocio.

Incorrecto:

~~~tsx
const selectedFinding = useMemo(
  () => findings.find((finding) => finding.id === selectedId),
  [findings],
);
~~~

Falta selectedId y la selección podría quedar obsoleta. Aun con dependencias correctas, selectedId sigue siendo estado; useMemo solo deriva el objeto.

Correcto:

~~~tsx
const [selectedId, setSelectedId] = useState<string | null>(null);

const selectedFinding = useMemo(
  () => findings.find((finding) => finding.id === selectedId) ?? null,
  [findings, selectedId],
);
~~~

El estado conserva la intención del usuario. La memoización puede evitar una búsqueda costosa, pero no reemplaza esa intención.

Tampoco dependas de useMemo para crear una instancia cuya identidad sea requisito de corrección. React documenta useMemo como optimización y puede descartar su caché. Para identidad persistente imperativa, considera una ref; para estado visible, usa estado.

---

## 15. useCallback: conservar una referencia de función

La forma general es:

~~~tsx
const handleSelect = useCallback(
  (id: string) => {
    setSelectedId(id);
  },
  [],
);
~~~

useCallback devuelve la misma referencia de función mientras sus dependencias no cambien.

No significa:

- que la función no se cree nunca;
- que su cuerpo se ejecute automáticamente;
- que su resultado quede almacenado;
- que siempre mejore el rendimiento.

Conceptualmente:

~~~tsx
const handleSelect = useMemo(
  () => (id: string) => {
    setSelectedId(id);
  },
  [],
);
~~~

useCallback es la forma más clara para expresar que se memoiza una función.

---

## 16. Cuándo usar useCallback

Los dos casos comunes son:

1. pasar una función a un hijo envuelto en memo;
2. usar esa función como dependencia de otro Hook o API sensible a identidad.

Ejemplo:

~~~tsx
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);

return (
  <MemoizedFindingsTable
    findings={visibleFindings}
    onSelect={handleSelect}
  />
);
~~~

Aquí existe un consumidor:

- MemoizedFindingsTable compara onSelect;
- una función nueva rompería la omisión de render;
- useCallback mantiene la referencia cuando sus dependencias no cambian.

Sin memo en el hijo y sin otro consumidor de identidad, useCallback suele no aportar nada.

---

## 17. Reducir dependencias con una actualización funcional

Esta función depende de selectedIds:

~~~tsx
const toggleSelected = useCallback(
  (id: string) => {
    setSelectedIds(
      selectedIds.includes(id)
        ? selectedIds.filter((currentId) => currentId !== id)
        : [...selectedIds, id],
    );
  },
  [selectedIds],
);
~~~

La referencia cambia cada vez que cambia la selección.

Si solo necesitas el estado anterior para calcular el siguiente, usa una actualización funcional:

~~~tsx
const toggleSelected = useCallback((id: string) => {
  setSelectedIds((currentIds) =>
    currentIds.includes(id)
      ? currentIds.filter((currentId) => currentId !== id)
      : [...currentIds, id],
  );
}, []);
~~~

No se omitió una dependencia. Se reestructuró el código para no leer selectedIds desde la closure.

Eso es distinto de silenciar exhaustive-deps.

---

## 18. Closure obsoleta: el riesgo de mentir

Este callback parece estable, pero conserva la primera versión de siteId:

~~~tsx
const openFinding = useCallback(
  (findingId: string) => {
    navigateToFinding(siteId, findingId);
  },
  [], // Incorrecto: siteId es reactivo.
);
~~~

Correcto:

~~~tsx
const openFinding = useCallback(
  (findingId: string) => {
    navigateToFinding(siteId, findingId);
  },
  [siteId],
);
~~~

Que la referencia cambie cuando cambia siteId es correcto. El callback representa otro comportamiento.

La estabilidad nunca debe conseguirse sacrificando actualidad.

---

## 19. Cuándo evitar useCallback

Evítalo cuando:

- la función solo se usa como evento en el mismo componente;
- el hijo no está memoizado;
- todas las demás props del hijo cambian igualmente;
- el callback depende de valores que cambian siempre;
- no existe un problema medido;
- empeora la legibilidad.

Innecesario:

~~~tsx
export function HelpButton() {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((current) => !current);
  }, []);

  return <button onClick={toggle}>{open ? "Cerrar" : "Abrir"}</button>;
}
~~~

Versión simple:

~~~tsx
export function HelpButton() {
  const [open, setOpen] = useState(false);

  return (
    <button onClick={() => setOpen((current) => !current)}>
      {open ? "Cerrar" : "Abrir"}
    </button>
  );
}
~~~

Ambas son correctas. La segunda tiene menos carga mental si nadie consume una identidad estable.

---

## 20. memo: omitir renders de un componente

memo recibe un componente y devuelve una versión memoizada.

~~~tsx
import { memo } from "react";

type FindingsTableProps = {
  findings: readonly Finding[];
  onSelect: (id: string) => void;
};

export const FindingsTable = memo(function FindingsTable({
  findings,
  onSelect,
}: FindingsTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>Hallazgo</th>
          <th>Severidad</th>
          <th>Acción</th>
        </tr>
      </thead>

      <tbody>
        {findings.map((finding) => (
          <tr key={finding.id}>
            <td>{finding.title}</td>
            <td>{finding.severity}</td>
            <td>
              <button onClick={() => onSelect(finding.id)}>
                Ver detalle
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
});
~~~

Por defecto, React compara cada prop anterior con la nueva usando Object.is.

memo puede omitir un render causado por el padre, pero el componente todavía renderiza si:

- cambia su propio estado;
- cambia un contexto que consume;
- cambia alguna prop;
- React necesita renderizarlo por otra razón.

memo es optimización, no una barrera absoluta.

---

## 21. memo solo sirve con props estables

Este padre rompe memo en cada render:

~~~tsx
<FindingsTable
  findings={findings.filter((finding) => finding.status === "open")}
  onSelect={(id) => setSelectedId(id)}
/>
~~~

findings y onSelect son referencias nuevas.

Versión estabilizada cuando el costo está justificado:

~~~tsx
const openFindings = useMemo(
  () => findings.filter((finding) => finding.status === "open"),
  [findings],
);

const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);

return (
  <FindingsTable
    findings={openFindings}
    onSelect={handleSelect}
  />
);
~~~

La combinación tiene sentido porque:

- FindingsTable está memoizada;
- filtrar o renderizar la tabla es costoso;
- el padre cambia por otros motivos;
- findings suele conservar su referencia;
- la mejora fue medida.

---

## 22. No agregues memo de manera indiscriminada

memo es poco útil si:

- el componente es barato;
- renderiza rara vez;
- casi siempre recibe props nuevas;
- depende de un contexto que cambia con frecuencia;
- la prop children se reconstruye cada vez;
- un objeto inline rompe la comparación.

Ejemplo sin beneficio real:

~~~tsx
const FindingBadge = memo(function FindingBadge({
  severity,
}: {
  severity: FindingSeverity;
}) {
  return <span>{severity}</span>;
});
~~~

Un span con texto suele ser más barato que el razonamiento y las comparaciones añadidas. No es un error técnico, pero necesita una razón.

---

## 23. Comparadores personalizados: último recurso

memo acepta una función arePropsEqual:

~~~tsx
const Component = memo(BaseComponent, arePropsEqual);
~~~

Un comparador incorrecto puede conservar callbacks con closures antiguas.

Peligroso:

~~~tsx
const FindingsTable = memo(
  FindingsTableBase,
  (previous, next) => previous.findings.length === next.findings.length,
);
~~~

Dos arreglos con igual longitud pueden contener datos distintos. Además, el comparador ignora otras props.

Si alguna vez escribes uno:

- compara todas las props;
- compara funciones;
- evita comparación profunda ilimitada;
- mide que comparar sea más barato que renderizar;
- documenta el invariante;
- añade pruebas específicas.

En la mayoría de los casos es mejor:

- conservar datos inmutables;
- reducir las props;
- estabilizar referencias relevantes;
- usar la comparación predeterminada.

---

## 24. Ejemplo integrado: dashboard memoizado de forma consciente

Primero definimos contratos validados para los datos remotos.

~~~ts
// finding-contracts.ts
import { z } from "zod";

export const FindingSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  siteName: z.string().trim().min(1).max(100),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "in_progress", "resolved"]),
  detectedAt: z.string().datetime(),
});

export const FindingsResponseSchema = z.object({
  data: z.array(FindingSchema),
  meta: z.object({
    total: z.number().int().nonnegative(),
  }),
});

export type Finding = z.infer<typeof FindingSchema>;
export type FindingsResponse = z.infer<typeof FindingsResponseSchema>;
~~~

El SDK trata la respuesta como unknown:

~~~ts
// siteops-sdk.ts
import { FindingsResponseSchema, type Finding } from "./finding-contracts";

export interface FindingsSdk {
  listFindings(signal?: AbortSignal): Promise<readonly Finding[]>;
}

export function createFindingsSdk(baseUrl: URL): FindingsSdk {
  return {
    async listFindings(signal) {
      const response = await fetch(new URL("/api/findings", baseUrl), {
        signal,
        headers: {
          accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("No fue posible consultar los hallazgos");
      }

      const raw: unknown = await response.json();
      return FindingsResponseSchema.parse(raw).data;
    },
  };
}
~~~

El algoritmo permanece independiente:

~~~ts
// finding-algorithms.ts
import type { Finding } from "./finding-contracts";

export type DashboardFilters = Readonly<{
  query: string;
  status: Finding["status"] | "all";
  minimumSeverity: Finding["severity"];
}>;

const rank: Readonly<Record<Finding["severity"], number>> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function getVisibleFindings(
  findings: readonly Finding[],
  filters: DashboardFilters,
): readonly Finding[] {
  const query = filters.query.trim().toLocaleLowerCase("es-MX");

  return findings
    .filter((finding) => {
      const text =
        finding.title.toLocaleLowerCase("es-MX") +
        " " +
        finding.siteName.toLocaleLowerCase("es-MX");

      return (
        (query.length === 0 || text.includes(query)) &&
        rank[finding.severity] >= rank[filters.minimumSeverity] &&
        (filters.status === "all" || finding.status === filters.status)
      );
    })
    .sort(
      (left, right) =>
        Date.parse(right.detectedAt) - Date.parse(left.detectedAt),
    );
}
~~~

La tabla se memoiza porque fue identificada como un render costoso:

~~~tsx
// FindingsTable.tsx
import { memo } from "react";
import type { Finding } from "./finding-contracts";

type FindingsTableProps = Readonly<{
  findings: readonly Finding[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}>;

export const FindingsTable = memo(function FindingsTable({
  findings,
  selectedId,
  onSelect,
}: FindingsTableProps) {
  return (
    <table aria-label="Hallazgos de infraestructura">
      <thead>
        <tr>
          <th scope="col">Título</th>
          <th scope="col">Sede</th>
          <th scope="col">Severidad</th>
          <th scope="col">Estado</th>
          <th scope="col">Acción</th>
        </tr>
      </thead>

      <tbody>
        {findings.map((finding) => {
          const selected = finding.id === selectedId;

          return (
            <tr key={finding.id} aria-selected={selected}>
              <td>{finding.title}</td>
              <td>{finding.siteName}</td>
              <td>{finding.severity}</td>
              <td>{finding.status}</td>
              <td>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onSelect(finding.id)}
                >
                  {selected ? "Seleccionado" : "Revisar"}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
});
~~~

El dashboard estabiliza únicamente los límites útiles:

~~~tsx
// FindingsDashboard.tsx
import { useCallback, useMemo, useState } from "react";
import type { Finding } from "./finding-contracts";
import { getVisibleFindings } from "./finding-algorithms";
import { FindingsTable } from "./FindingsTable";

type FindingsDashboardProps = Readonly<{
  findings: readonly Finding[];
}>;

export function FindingsDashboard({
  findings,
}: FindingsDashboardProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] =
    useState<Finding["status"] | "all">("all");
  const [minimumSeverity, setMinimumSeverity] =
    useState<Finding["severity"]>("low");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const visibleFindings = useMemo(
    () =>
      getVisibleFindings(findings, {
        query,
        status,
        minimumSeverity,
      }),
    [findings, query, status, minimumSeverity],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  return (
    <section aria-labelledby="findings-title">
      <h1 id="findings-title">Hallazgos</h1>

      <label>
        Buscar
        <input
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </label>

      <label>
        Estado
        <select
          value={status}
          onChange={(event) =>
            setStatus(
              event.currentTarget.value as Finding["status"] | "all",
            )
          }
        >
          <option value="all">Todos</option>
          <option value="open">Abierto</option>
          <option value="in_progress">En progreso</option>
          <option value="resolved">Resuelto</option>
        </select>
      </label>

      <label>
        Severidad mínima
        <select
          value={minimumSeverity}
          onChange={(event) =>
            setMinimumSeverity(
              event.currentTarget.value as Finding["severity"],
            )
          }
        >
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => setIsHelpOpen((current) => !current)}
      >
        {isHelpOpen ? "Ocultar ayuda" : "Mostrar ayuda"}
      </button>

      {isHelpOpen && (
        <aside>
          Los filtros se aplican sobre datos previamente validados.
        </aside>
      )}

      <p>{visibleFindings.length} resultados</p>

      <FindingsTable
        findings={visibleFindings}
        selectedId={selectedId}
        onSelect={handleSelect}
      />
    </section>
  );
}
~~~

### ¿Qué trabajo se evita?

Al abrir o cerrar la ayuda:

- el dashboard vuelve a renderizar;
- findings, query, status y minimumSeverity no cambian;
- useMemo devuelve el mismo arreglo visibleFindings;
- handleSelect conserva su identidad;
- selectedId no cambia;
- FindingsTable recibe las mismas props;
- memo puede omitir el render de la tabla.

Cuando cambia query:

- useMemo recalcula el arreglo;
- findings recibe una referencia distinta;
- la tabla debe renderizar;
- ese trabajo es correcto porque el resultado visible cambió.

---

## 25. Mejorar el tipado de select sin confiar en una aserción

En el ejemplo anterior, event.currentTarget.value es string y usamos una aserción. Esa aserción no valida runtime.

Podemos definir un guard:

~~~ts
const findingStatuses = [
  "open",
  "in_progress",
  "resolved",
] as const;

type FindingStatus = (typeof findingStatuses)[number];

export function isFindingStatus(value: string): value is FindingStatus {
  return findingStatuses.some((status) => status === value);
}
~~~

Y usarlo:

~~~tsx
onChange={(event) => {
  const value = event.currentTarget.value;

  if (value === "all" || isFindingStatus(value)) {
    setStatus(value);
  }
}}
~~~

Para formularios más amplios, Zod puede validar el objeto completo.

La memoización no convierte string en una unión segura. Solo conserva referencias o resultados.

---

## 26. TypeScript desaparece en runtime

Este principio sigue siendo obligatorio:

> Los tipos TypeScript se eliminan al compilar. No validan datos reales.

Ninguna de estas expresiones valida una respuesta:

~~~ts
const findings = (await response.json()) as Finding[];
const findings = useMemo<Finding[]>(() => rawData, [rawData]);
~~~

Una API externa podría devolver:

~~~json
{
  "data": [
    {
      "id": 17,
      "title": "",
      "severity": "urgent",
      "detectedAt": "ayer"
    }
  ]
}
~~~

TypeScript no inspecciona esos bytes. useMemo tampoco.

Requieren validación runtime:

- respuestas HTTP;
- formularios;
- APIs externas;
- archivos JSON o CSV;
- variables de entorno;
- filas de PostgreSQL;
- mensajes de colas;
- contenido de localStorage.

Con Zod:

~~~ts
const raw: unknown = await response.json();
const parsed = FindingsResponseSchema.parse(raw);
const findings = parsed.data;
~~~

Después de parsear, React puede memoizar cálculos sobre datos confiables. El orden es:

1. recibir unknown;
2. validar;
3. obtener un tipo inferido;
4. calcular;
5. medir;
6. memoizar solo si aporta.

---

## 27. Memoización y arquitectura Full Stack

La cadena objetivo de SiteOps Tracker es:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

La relación con esta lección es:

| Capa | Responsabilidad | Relación con memoización |
|---|---|---|
| React | estado, interacción y render | puede omitir cálculos o renders medidos |
| HTTP | transportar solicitudes y respuestas | no garantiza forma ni identidad estable |
| Node.js | ejecutar la aplicación backend | no debe delegar seguridad al frontend |
| Router | relacionar método y ruta | no conoce useMemo ni memo |
| Controller | traducir HTTP a casos de uso | recibe entradas aún no confiables |
| Runtime Validation | convertir unknown en datos válidos | protege la frontera real |
| Service | aplicar reglas de negocio | debe ser correcto sin caché visual |
| Repository | aislar persistencia | devuelve modelos mapeados y validados |
| PostgreSQL | constraints, consultas y transacciones | conserva integridad persistente |
| Testing | demostrar comportamiento y contratos | mide optimización solo cuando es un requisito |
| Docker | reproducir entorno de ejecución | no cambia la semántica de React |
| CI/CD | ejecutar quality gates | impide publicar typecheck, lint, tests o build fallidos |
| Cloud | operar la aplicación | aporta métricas reales de rendimiento y errores |

Una tabla lenta en React no se corrige omitiendo validación del backend. Una consulta lenta en PostgreSQL no se corrige con useMemo del frontend.

Cada capa optimiza su propio trabajo sin absorber responsabilidades ajenas.

---

## 28. Node.js, validación, Service y Repository

Un endpoint de filtros puede validar parámetros antes de consultar.

~~~ts
// list-findings-query.ts
import { z } from "zod";

export const ListFindingsQuerySchema = z.object({
  siteId: z.string().uuid().optional(),
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  minimumSeverity: z
    .enum(["low", "medium", "high", "critical"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListFindingsQuery = z.infer<
  typeof ListFindingsQuerySchema
>;
~~~

Controller:

~~~ts
import type { Request, Response } from "express";

export async function listFindingsController(
  request: Request,
  response: Response,
): Promise<void> {
  const query = ListFindingsQuerySchema.parse(request.query);
  const result = await listFindingsService.execute(query);

  response.status(200).json({
    data: result.items,
    meta: {
      total: result.total,
    },
  });
}
~~~

Service:

~~~ts
export interface FindingsRepository {
  list(
    query: ListFindingsQuery,
  ): Promise<{
    items: readonly Finding[];
    total: number;
  }>;
}

export class ListFindingsService {
  constructor(private readonly repository: FindingsRepository) {}

  execute(query: ListFindingsQuery) {
    return this.repository.list(query);
  }
}
~~~

Repository:

~~~ts
type FindingRow = {
  id: unknown;
  title: unknown;
  site_name: unknown;
  severity: unknown;
  status: unknown;
  detected_at: unknown;
};

export class PostgreSqlFindingsRepository
  implements FindingsRepository
{
  async list(query: ListFindingsQuery) {
    const result = await pool.query<FindingRow>(
      "SELECT id, title, site_name, severity, status, detected_at " +
        "FROM findings " +
        "WHERE ($1::uuid IS NULL OR site_id = $1) " +
        "ORDER BY detected_at DESC " +
        "LIMIT $2",
      [query.siteId ?? null, query.limit],
    );

    const items = result.rows.map((row) =>
      FindingSchema.parse({
        id: row.id,
        title: row.title,
        siteName: row.site_name,
        severity: row.severity,
        status: row.status,
        detectedAt:
          row.detected_at instanceof Date
            ? row.detected_at.toISOString()
            : row.detected_at,
      }),
    );

    return {
      items,
      total: items.length,
    };
  }
}
~~~

El tipo genérico de la librería PostgreSQL describe una expectativa de compilación. Parsear la fila protege frente a cambios de esquema, conversiones del driver o consultas defectuosas.

La optimización React comienza después de esta frontera confiable.

---

## 29. El analizador de configuraciones

El proyecto también incluye un analizador ficticio de configuraciones. Un archivo puede contener miles de reglas y producir un resumen costoso.

~~~ts
export type ConfigurationIssue = Readonly<{
  code: string;
  message: string;
  line: number;
  severity: "warning" | "error";
}>;

export type AnalyzerSummary = Readonly<{
  errors: number;
  warnings: number;
  affectedLines: readonly number[];
}>;

export function summarizeIssues(
  issues: readonly ConfigurationIssue[],
): AnalyzerSummary {
  const affectedLines = new Set<number>();
  let errors = 0;
  let warnings = 0;

  for (const issue of issues) {
    affectedLines.add(issue.line);

    if (issue.severity === "error") {
      errors += 1;
    } else {
      warnings += 1;
    }
  }

  return {
    errors,
    warnings,
    affectedLines: [...affectedLines].sort((left, right) => left - right),
  };
}
~~~

En React:

~~~tsx
const summary = useMemo(
  () => summarizeIssues(validatedIssues),
  [validatedIssues],
);
~~~

Tiene sentido si:

- validatedIssues conserva su referencia mientras no cambia el análisis;
- summarizeIssues fue medido como costoso;
- el panel renderiza por otros estados independientes.

No tiene sentido si validatedIssues se reconstruye sin necesidad en cada render.

---

## 30. El repositorio de algoritmos TypeScript

La memoización no mejora la complejidad algorítmica de una función.

Si una búsqueda es O(n²), useMemo puede evitar algunas ejecuciones, pero cada ejecución sigue siendo O(n²).

Primero revisa el algoritmo:

~~~ts
export function groupFindingsBySite(
  findings: readonly Finding[],
): ReadonlyMap<string, readonly Finding[]> {
  const mutableGroups = new Map<string, Finding[]>();

  for (const finding of findings) {
    const current = mutableGroups.get(finding.siteName);

    if (current) {
      current.push(finding);
    } else {
      mutableGroups.set(finding.siteName, [finding]);
    }
  }

  return mutableGroups;
}
~~~

Después mide si memoizar su resultado aporta valor:

~~~tsx
const findingsBySite = useMemo(
  () => groupFindingsBySite(findings),
  [findings],
);
~~~

Para entrevistas, explica ambos niveles:

1. mejorar la complejidad del algoritmo;
2. evitar repetirlo cuando las entradas no cambiaron.

---

## 31. React Compiler cambia la cantidad de memoización manual

La documentación actual de React indica que React Compiler puede memoizar automáticamente valores, funciones y componentes, reduciendo la necesidad de useMemo, useCallback y memo manuales.

Esto no vuelve inútiles los conceptos:

- no todos los proyectos tienen el compilador habilitado;
- puedes mantener bibliotecas o código legado;
- necesitas entender identidad y dependencias para diseñar APIs correctas;
- una optimización manual existente comunica una intención;
- las reglas de pureza siguen siendo obligatorias;
- debes medir antes y después de adoptar el compilador.

Una estrategia profesional:

1. confirma si el toolchain usa React Compiler;
2. sigue las Rules of React;
3. habilita sus diagnósticos de ESLint;
4. evita agregar memoización manual por costumbre;
5. conserva manualmente solo límites medidos y documentados;
6. revisa optimizaciones antiguas durante migraciones;
7. no borres memoizaciones masivamente sin perfiles y pruebas.

El compilador optimiza rendimiento; no valida HTTP, no corrige reglas de negocio y no reemplaza tests.

---

## 32. Medir antes de optimizar

Puedes usar:

- la pestaña Profiler de React DevTools;
- el componente Profiler;
- React Performance tracks disponibles en herramientas compatibles;
- Performance del navegador;
- mediciones controladas de funciones puras.

Ejemplo con Profiler:

~~~tsx
import {
  Profiler,
  type ProfilerOnRenderCallback,
} from "react";

const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
) => {
  console.info("react-profile", {
    id,
    phase,
    actualDuration,
    baseDuration,
  });
};

export function ProfiledDashboard({
  findings,
}: {
  findings: readonly Finding[];
}) {
  return (
    <Profiler id="findings-dashboard" onRender={onRender}>
      <FindingsDashboard findings={findings} />
    </Profiler>
  );
}
~~~

Profiler añade sobrecarga, por lo que se usa de forma deliberada.

Proceso recomendado:

1. reproduce una interacción lenta;
2. captura una línea base;
3. identifica qué componente o cálculo domina;
4. realiza un cambio pequeño;
5. repite exactamente el escenario;
6. compara duración y cantidad de trabajo;
7. conserva el cambio solo si la mejora compensa su complejidad.

No uses console.log como prueba definitiva: desarrollo, Strict Mode y herramientas pueden alterar el número de ejecuciones.

---

## 33. Strict Mode y funciones puras

En desarrollo, React puede ejecutar cálculos más de una vez para detectar impurezas. Un cálculo puro produce el mismo resultado y no daña entradas.

Incorrecto:

~~~tsx
const sortedFindings = useMemo(() => {
  return findings.sort(compareFindings);
}, [findings]);
~~~

sort muta la prop findings.

Correcto:

~~~tsx
const sortedFindings = useMemo(() => {
  return [...findings].sort(compareFindings);
}, [findings]);
~~~

Si una doble ejecución revela duplicados o mutaciones, el problema es la impureza, no Strict Mode.

---

## 34. ESLint y dependencias

Las reglas de Hooks deben formar parte del quality gate.

Ejemplo conceptual de configuración plana:

~~~ts
// eslint.config.ts
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
~~~

Según las versiones instaladas, los nombres exactos de presets pueden variar. Consulta la documentación del paquete del proyecto antes de copiar configuración.

Dos reglas relevantes:

- **exhaustive-deps:** exige dependencias necesarias y evita closures obsoletas;
- **use-memo:** detecta useMemo sin retorno útil y posibles usos como efecto.

La configuración debe fijarse mediante lockfile y ejecutarse en CI.

No añadas comentarios de desactivación para conseguir “estabilidad”. Reestructura el componente o incluye la dependencia real.

---

## 35. Pruebas: comportamiento antes que implementación

Testing Library recomienda probar como lo haría una persona. Una prueba principal debe demostrar que filtrar cambia la UI.

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FindingsDashboard } from "./FindingsDashboard";

const findings: readonly Finding[] = [
  {
    id: "9b2c3e16-9d1f-4aa2-8094-6d420842a051",
    title: "Puerto de administración expuesto",
    siteName: "Sede Norte",
    severity: "critical",
    status: "open",
    detectedAt: "2026-10-20T12:00:00.000Z",
  },
  {
    id: "8fa4c292-981e-42d4-b0ee-dd0fb7b750d5",
    title: "Inventario pendiente de revisión",
    siteName: "Sede Centro",
    severity: "low",
    status: "in_progress",
    detectedAt: "2026-10-19T12:00:00.000Z",
  },
];

describe("FindingsDashboard", () => {
  it("filtra por el texto que escribe la persona", async () => {
    const user = userEvent.setup();
    render(<FindingsDashboard findings={findings} />);

    await user.type(screen.getByLabelText("Buscar"), "puerto");

    expect(
      screen.getByText("Puerto de administración expuesto"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Inventario pendiente de revisión"),
    ).not.toBeInTheDocument();
  });
});
~~~

Esta prueba seguiría siendo válida si mañana eliminas useMemo porque React Compiler hace el trabajo.

---

## 36. Prueba un algoritmo costoso sin React

La función pura merece pruebas directas:

~~~ts
import { describe, expect, it } from "vitest";
import { getVisibleFindings } from "./finding-algorithms";

describe("getVisibleFindings", () => {
  it("filtra por severidad y devuelve orden descendente", () => {
    const result = getVisibleFindings(findings, {
      query: "",
      status: "all",
      minimumSeverity: "high",
    });

    expect(result.map((finding) => finding.severity)).toEqual([
      "critical",
    ]);
  });

  it("no modifica el arreglo recibido", () => {
    const originalOrder = findings.map((finding) => finding.id);

    getVisibleFindings(findings, {
      query: "",
      status: "all",
      minimumSeverity: "low",
    });

    expect(findings.map((finding) => finding.id)).toEqual(
      originalOrder,
    );
  });
});
~~~

Estas pruebas protegen corrección e inmutabilidad, no una estrategia de caché.

---

## 37. ¿Cuándo probar el número de renders?

No conviertas cada prueba en una inspección de renders. Eso acopla la suite a detalles internos.

Una prueba de optimización puede justificarse cuando:

- existe una regresión documentada;
- el límite memoizado forma parte de un requisito de rendimiento;
- la tabla o visualización es realmente costosa;
- el equipo acepta el costo de mantenimiento.

Ejemplo didáctico:

~~~tsx
import { memo, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

it("no recalcula la tabla al abrir ayuda", async () => {
  const user = userEvent.setup();
  const renderTable = vi.fn();

  const TableProbe = memo(function TableProbe({
    findings,
  }: {
    findings: readonly Finding[];
  }) {
    renderTable(findings);
    return <div>Tabla</div>;
  });

  function Harness() {
    const [open, setOpen] = useState(false);

    return (
      <>
        <button onClick={() => setOpen((current) => !current)}>
          Ayuda
        </button>
        {open && <aside>Contenido</aside>}
        <TableProbe findings={findings} />
      </>
    );
  }

  render(<Harness />);
  const initialCalls = renderTable.mock.calls.length;

  await user.click(screen.getByRole("button", { name: "Ayuda" }));

  expect(renderTable.mock.calls.length).toBe(initialCalls);
});
~~~

Esta prueba es sensible a configuración de desarrollo y Strict Mode. Úsala solo en un entorno de prueba controlado y no la confundas con una medición de duración.

---

## 38. Errores comunes

### Error 1: memoizar todo

El código acumula dependencias y comparaciones sin una mejora demostrable.

**Corrección:** perfila primero y optimiza un límite concreto.

### Error 2: usar useMemo para efectos

HTTP, analítica o escritura en almacenamiento durante render rompe pureza.

**Corrección:** usa la capa de datos o un Effect cuando exista sincronización externa.

### Error 3: omitir dependencias

La caché usa datos antiguos.

**Corrección:** incluye cada valor reactivo o reestructura para no leerlo.

### Error 4: crear una dependencia objeto en cada render

El objeto siempre cambia y la caché se invalida.

**Corrección:** construye el objeto dentro del cálculo o usa dependencias primitivas.

### Error 5: pasar props siempre nuevas a memo

Un arreglo, objeto o callback inline rompe la omisión.

**Corrección:** estabiliza solamente las props que cruzan un límite costoso.

### Error 6: mutar una prop dentro de useMemo

sort, reverse o asignaciones cambian datos ajenos.

**Corrección:** crea una copia antes de ordenar o transforma de manera inmutable.

### Error 7: usar un comparador incompleto

El hijo puede conservar funciones o datos obsoletos.

**Corrección:** prefiere la comparación predeterminada; si personalizas, compara todas las props y mide.

### Error 8: depender de memoización para corrección

El código falla si React recalcula o descarta la caché.

**Corrección:** estado para decisiones, refs para handles persistentes y memoización solo para rendimiento.

### Error 9: creer que useCallback evita la ejecución

useCallback conserva la referencia, pero el cuerpo se ejecuta cuando se invoca.

**Corrección:** distingue identidad de función y resultado calculado.

### Error 10: ignorar el algoritmo

Memoizar una operación O(n²) no mejora el costo de cada ejecución.

**Corrección:** optimiza primero estructura de datos y complejidad.

### Error 11: medir solo en desarrollo

Las herramientas, Strict Mode y sourcemaps alteran el perfil.

**Corrección:** usa escenarios reproducibles y una build apropiada para perfilar.

### Error 12: asumir que TypeScript valida datos

Una respuesta tipada mediante as no se verifica.

**Corrección:** recibe unknown y valida con Zod en cada frontera.

### Error 13: recrear datos en el padre

~~~tsx
<Dashboard findings={[...findings]} />
~~~

La copia innecesaria cambia identidad.

**Corrección:** conserva la referencia si el contenido no cambió.

### Error 14: usar useMemo para el valor inicial del estado

~~~tsx
const initial = useMemo(() => buildInitialState(), []);
const [state] = useState(initial);
~~~

**Corrección:** usa un inicializador perezoso.

~~~tsx
const [state] = useState(() => buildInitialState());
~~~

---

## 39. Cuándo utilizar cada herramienta

| Situación | Herramienta probable | Motivo |
|---|---|---|
| cálculo puro y costoso | useMemo | conserva el resultado |
| callback hacia un hijo memoizado | useCallback | conserva la referencia |
| componente costoso con props repetidas | memo | omite el render del hijo |
| dato visible que cambia | useState o useReducer | representa estado |
| handle imperativo no visual | useRef | persiste sin render |
| validación de entrada desconocida | Zod | comprueba runtime |
| solicitud HTTP | cliente de datos o Effect adecuado | sincronización externa |
| consulta lenta | índices y SQL | optimización de persistencia |
| render barato | ninguna memoización | simplicidad |

---

## 40. Cuándo evitar la memoización

Evítala si:

- todavía no existe una interacción lenta;
- no tienes una línea base;
- el componente es trivial;
- las entradas cambian siempre;
- React Compiler ya resuelve el caso y el perfil lo confirma;
- obliga a silenciar el linter;
- oculta una mutación;
- reemplaza estado o validación;
- dificulta una API que podría aceptar props primitivas;
- el costo de comparar y retener supera al de recalcular.

Una solución simple, pura e inmutable suele ser el mejor punto de partida.

---

## 41. Ejercicio para resolver

### Situación

El componente AssetsPanel de SiteOps Tracker muestra activos ficticios. Abrir un panel de ayuda vuelve lenta la interfaz porque la tabla realiza un agrupamiento costoso.

Código inicial:

~~~tsx
import { useState } from "react";

type Asset = Readonly<{
  id: string;
  siteId: string;
  name: string;
  category: "server" | "switch" | "workstation";
  status: "active" | "maintenance" | "retired";
}>;

type AssetsPanelProps = Readonly<{
  assets: readonly Asset[];
}>;

function groupAndSortAssets(
  assets: readonly Asset[],
  category: Asset["category"] | "all",
): readonly Asset[] {
  // Supón que la implementación real realiza trabajo costoso.
  return assets
    .filter((asset) => category === "all" || asset.category === category)
    .sort((left, right) => left.name.localeCompare(right.name, "es-MX"));
}

function AssetsTable({
  assets,
  onSelect,
}: {
  assets: readonly Asset[];
  onSelect: (assetId: string) => void;
}) {
  return (
    <ul>
      {assets.map((asset) => (
        <li key={asset.id}>
          <button onClick={() => onSelect(asset.id)}>
            {asset.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function AssetsPanel({ assets }: AssetsPanelProps) {
  const [category, setCategory] =
    useState<Asset["category"] | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const visibleAssets = groupAndSortAssets(assets, category);
  const handleSelect = (assetId: string) => {
    setSelectedId(assetId);
  };

  return (
    <section>
      <button onClick={() => setHelpOpen((open) => !open)}>
        Ayuda
      </button>

      {helpOpen && <aside>Ayuda de activos</aside>}

      <p>Seleccionado: {selectedId ?? "ninguno"}</p>

      <AssetsTable
        assets={visibleAssets}
        onSelect={handleSelect}
      />
    </section>
  );
}
~~~

### Tu tarea

Sin cambiar el comportamiento visible:

1. registra una línea base con Profiler;
2. memoiza groupAndSortAssets solo si la medición lo justifica;
3. decide si AssetsTable debe envolverse en memo;
4. estabiliza handleSelect solo si existe un consumidor de identidad;
5. conserva todas las dependencias correctas;
6. evita mutar la prop assets;
7. añade un selector de categoría correctamente tipado;
8. escribe una prueba de comportamiento con Testing Library;
9. documenta qué interacción mejoró;
10. registra la medición posterior.

No se incluye la solución completa.

### Criterios de aceptación

- TypeScript compila con strict;
- ESLint no reporta dependencias ausentes;
- abrir ayuda no repite el trabajo costoso si las entradas no cambiaron;
- cambiar categoría sí recalcula;
- seleccionar un activo actualiza la UI;
- la lista original no se modifica;
- las pruebas no dependen innecesariamente de detalles internos;
- existe evidencia antes y después.

---

## 42. Pistas

1. La función costosa depende de assets y category.
2. La salida de useMemo debe ser el arreglo visible.
3. memo solo ayudará a AssetsTable si sus dos props conservan identidad.
4. La función setSelectedId es estable; un callback que solo la usa puede tener dependencias vacías.
5. No elimines category de dependencias para impedir una recalculación legítima.
6. El select entrega string en runtime; comprueba que pertenezca a la unión.
7. Prueba primero que la persona pueda filtrar y seleccionar.
8. Añade una prueba de renders solo si el requisito de rendimiento la necesita.
9. Compara perfiles del mismo conjunto de datos y la misma interacción.
10. Si no hay mejora medible, conserva la versión más simple.

---

## 43. Reto Full Stack

Construye un módulo de consulta de hallazgos para SiteOps Tracker.

### React + TypeScript

- Carga hallazgos con un SDK tipado.
- Trata response.json como unknown.
- Valida la respuesta con Zod.
- Modela loading, success, empty y error.
- Filtra por sede, severidad, estado y texto.
- Pagina resultados.
- Perfila el dashboard con al menos 5 000 registros ficticios.
- Usa useMemo, useCallback y memo solo en límites medidos.
- Mantén accesibilidad de tabla, filtros y botones.

### SDK

- Expón una interfaz FindingsSdk.
- Acepta AbortSignal.
- Distingue errores HTTP, validación y cancelación.
- No uses as para fingir que la respuesta ya es Finding[].

### Node.js y Express

- Define GET /api/findings.
- Separa Router, Controller, Runtime Validation, Service y Repository.
- Valida query params con Zod.
- Limita tamaño de página.
- Devuelve un contrato estable de datos y metadatos.
- Registra errores sin datos sensibles.

### PostgreSQL

- Usa consultas parametrizadas.
- Añade índices según el plan de consulta medido.
- Evita cargar miles de filas si el servidor puede paginar.
- Conserva constraints para estados y severidades.
- Valida el mapeo de filas en la frontera del Repository.

### Testing

- Prueba el algoritmo puro con Vitest.
- Prueba filtros y selección con Testing Library.
- Prueba Controller y Repository en integración.
- Añade un E2E para consulta, filtro y apertura de detalle.
- Crea una prueba de rendimiento solo si tiene umbrales reproducibles.

### Docker, CI/CD y Cloud

- Levanta API y PostgreSQL de pruebas con Docker Compose.
- Ejecuta typecheck, ESLint, unitarias, integración y build en CI.
- Usa GitHub Actions con cachés de dependencias seguras.
- Valida variables de entorno al iniciar.
- Despliega imágenes inmutables.
- Observa latencia de API, consulta SQL y experiencia del frontend por separado.

### Evidencia para portafolio

Incluye:

- captura del perfil antes y después;
- explicación del cuello de botella;
- decisión sobre cada memoización;
- pruebas relevantes;
- diagrama de capas;
- consulta SQL e índice justificados;
- nota sobre validación runtime;
- conclusión honesta, incluso si una memoización no produjo mejora.

El reto demuestra criterio: no solo conoces tres APIs, sabes decidir dónde una optimización aporta valor dentro de un sistema completo.

---

## 44. Relación explícita con trabajo Full Stack

En un equipo real, el rendimiento atraviesa varias capas:

- React puede repetir cálculos o renders;
- HTTP puede transferir demasiado;
- Node puede serializar respuestas enormes;
- el Service puede repetir reglas costosas;
- el Repository puede generar consultas ineficientes;
- PostgreSQL puede necesitar índices o paginación;
- Docker puede imponer límites de CPU o memoria;
- CI puede detectar regresiones;
- Cloud puede mostrar latencia real.

useMemo no sustituye paginación. memo no sustituye un índice. useCallback no sustituye un contrato HTTP estable.

Tu valor como Full Stack Developer aumenta cuando:

1. localizas la capa responsable;
2. mides con herramientas adecuadas;
3. implementas la optimización mínima;
4. mantienes correctitud y seguridad;
5. verificas el resultado de extremo a extremo.

---

## 45. Relevancia para portafolio

Una historia sólida para SiteOps Tracker podría decir:

> El dashboard de hallazgos repetía filtrado y renderizado de una tabla grande al cambiar estado no relacionado. Separé el algoritmo puro, validé datos HTTP con Zod, medí con Profiler y estabilicé el arreglo y callback que cruzaban el límite de una tabla memoizada. Después repetí el perfil y mantuve pruebas orientadas al comportamiento.

Lo importante es acompañarla con evidencia:

- datos completamente ficticios;
- commit pequeño y explicable;
- perfil antes y después;
- pruebas;
- documentación de tradeoffs;
- ningún detalle de sistemas privados.

Evita afirmar “mejoré 90 %” sin escenario, volumen, dispositivo y medición reproducible.

---

## 46. Relevancia para entrevistas técnicas

### “¿Qué diferencia hay entre useMemo y useCallback?”

useMemo conserva un valor calculado. useCallback conserva una referencia de función. Ambos reutilizan el resultado mientras sus dependencias permanezcan iguales según Object.is.

### “¿Qué hace memo?”

Permite que React omita el render de un componente cuando sus props son equivalentes. No evita renders provocados por su estado o por contextos consumidos.

### “¿Por qué memo puede no funcionar?”

Porque una prop objeto, arreglo o función se crea de nuevo en cada render. Una sola prop siempre nueva rompe la comparación.

### “¿Debemos memoizar todo?”

No. La memoización añade complejidad, comparaciones y retención de memoria. Primero se mide una interacción y se optimiza un cuello de botella.

### “¿Cómo decides las dependencias?”

Incluyo cada valor reactivo leído. Si quiero menos dependencias, reestructuro el código, por ejemplo con una actualización funcional; no miento al linter.

### “¿Qué es una closure obsoleta?”

Una función conserva valores de un render anterior porque sus dependencias fueron omitidas. Puede ejecutar lógica con props o estado antiguos.

### “¿useMemo garantiza que una instancia nunca cambie?”

No. Es una optimización y el código debe ser correcto si React recalcula o descarta la caché. Para estado uso state o reducer; para handles imperativos, refs.

### “¿Cómo medirías?”

Reproduzco una interacción, capturo una línea base con React DevTools o Profiler, identifico el trabajo dominante, hago un cambio pequeño y repito el mismo escenario.

### “¿Qué cambia con React Compiler?”

Puede aplicar memoización automática y reducir llamadas manuales. Aun necesito pureza, dependencias correctas, perfiles y conocimiento de identidad, especialmente en proyectos sin compilador o límites de biblioteca.

### “¿TypeScript valida la respuesta de una API?”

No. Sus tipos desaparecen en runtime. Recibo unknown y valido con Zod u otro esquema antes de confiar en los datos.

### “¿Qué optimizarías primero: useMemo o un algoritmo O(n²)?”

Primero la complejidad y estructura de datos. Después evaluaría si evitar ejecuciones repetidas añade otra mejora.

---

## 47. Preguntas de comprensión

1. ¿Qué significa memoizar?
2. ¿Por qué render no equivale a modificar todo el DOM?
3. ¿Cómo compara React dependencias?
4. ¿Por qué dos objetos con igual contenido pueden ser diferentes?
5. ¿Qué conserva useMemo?
6. ¿Qué conserva useCallback?
7. ¿Qué permite memo?
8. ¿Por qué useMemo debe contener un cálculo puro?
9. ¿Qué ocurre si falta una dependencia?
10. ¿Por qué un objeto inline puede invalidar una caché?
11. ¿Cuándo una actualización funcional reduce dependencias legítimamente?
12. ¿Por qué memo no bloquea actualizaciones de estado interno?
13. ¿Qué riesgo tiene un comparador personalizado?
14. ¿Cuándo una prop children puede romper memo?
15. ¿Por qué no debes usar useMemo como estado?
16. ¿Qué costo añade la memoización?
17. ¿Qué pasos sigues antes y después de optimizar?
18. ¿Cómo afecta Strict Mode a cálculos impuros?
19. ¿Qué papel tiene React Compiler?
20. ¿Por qué Zod sigue siendo necesario?
21. ¿Cómo probarías el comportamiento sin inspeccionar renders?
22. ¿Cuándo sí probarías el número de renders?
23. ¿Por qué una consulta SQL lenta no se corrige con useMemo?
24. ¿Qué evidencia incluirías en un portafolio?

---

## 48. Lista de verificación profesional

Antes de aprobar una memoización:

- [ ] Existe un problema de rendimiento observado.
- [ ] Hay una medición inicial reproducible.
- [ ] El cálculo o render es realmente costoso.
- [ ] Las entradas suelen permanecer iguales.
- [ ] La función de cálculo es pura.
- [ ] No se mutan props ni estado.
- [ ] Todas las dependencias reactivas están declaradas.
- [ ] exhaustive-deps permanece activo.
- [ ] useMemo devuelve un valor.
- [ ] useCallback tiene un consumidor de identidad.
- [ ] memo recibe props que pueden conservar su referencia.
- [ ] No hay una prop siempre nueva que invalide todo.
- [ ] No existe un comparador personalizado innecesario.
- [ ] La corrección no depende de la caché.
- [ ] El algoritmo tiene complejidad razonable.
- [ ] Los datos externos llegan como unknown.
- [ ] Zod valida HTTP, formularios, archivos, entorno y filas.
- [ ] Las pruebas principales observan comportamiento.
- [ ] La optimización se volvió a medir.
- [ ] El resultado compensa la complejidad.
- [ ] Se comprobó si React Compiler está habilitado.
- [ ] Typecheck, lint, tests y build pasan en CI.
- [ ] La documentación no contiene datos internos ni privados.

---

## 49. Resumen

- Memoizar es reutilizar una salida mientras sus entradas no cambian.
- React puede renderizar sin modificar el DOM.
- Object.is gobierna dependencias y comparación predeterminada de props.
- Objetos, arreglos y funciones nuevos tienen identidad nueva.
- useMemo conserva el resultado de un cálculo puro.
- useCallback conserva la referencia de una función.
- memo permite omitir el render de un hijo con props equivalentes.
- Las tres herramientas son optimizaciones, no mecanismos de corrección.
- Una prop siempre nueva puede inutilizar memo.
- Omitir dependencias produce closures o valores obsoletos.
- Las actualizaciones funcionales pueden reducir dependencias de forma legítima.
- useMemo no debe ejecutar efectos secundarios.
- Los comparadores personalizados requieren extrema cautela.
- Primero se mejora el algoritmo; luego se evita repetirlo si conviene.
- React Compiler reduce la necesidad de memoización manual en toolchains compatibles.
- Profiler y React DevTools permiten medir antes y después.
- Testing Library prioriza comportamiento sobre detalles internos.
- TypeScript desaparece en runtime.
- Zod valida datos reales en fronteras HTTP, formularios, archivos, entorno y PostgreSQL.
- En SiteOps Tracker, React optimiza render; cada capa Full Stack mantiene su responsabilidad.

---

## Referencias oficiales

- [React: useMemo](https://react.dev/reference/react/useMemo)
- [React: useCallback](https://react.dev/reference/react/useCallback)
- [React: memo](https://react.dev/reference/react/memo)
- [React: Profiler](https://react.dev/reference/react/Profiler)
- [React: React Developer Tools](https://react.dev/learn/react-developer-tools)
- [React: React Compiler introduction](https://react.dev/learn/react-compiler/introduction)
- [React: exhaustive-deps](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps)
- [React: use-memo lint](https://react.dev/reference/eslint-plugin-react-hooks/lints/use-memo)
- [React: You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [Testing Library: React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Library: user-event](https://testing-library.com/docs/user-event/intro/)
- [Vitest: Mocking Functions](https://vitest.dev/guide/mocking/functions)
- [Zod: Basic usage](https://zod.dev/basics)

Referencias consultadas el **21 de octubre de 2026**.

---

# Próxima lección

**Lección 44 — useReducer con TypeScript: estados complejos, acciones discriminadas y transiciones exhaustivas.**
