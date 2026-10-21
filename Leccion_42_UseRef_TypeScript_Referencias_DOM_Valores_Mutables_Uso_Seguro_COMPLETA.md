# Lección 42 — `useRef` con TypeScript: referencias al DOM, valores mutables persistentes y uso seguro

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — referencias, DOM y valores persistentes fuera del render  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## 1. Introducción

En la lección anterior creaste Custom Hooks para reutilizar lógica con estado, Effects, cancelación y pruebas. Ahora necesitas resolver problemas que no encajan bien en el estado visual:

- enfocar el primer campo inválido de un formulario;
- desplazar una tarjeta hasta hacerla visible;
- guardar el identificador de un timer entre renders;
- conservar un `AbortController` al que pueda acceder un botón “Cancelar”;
- mantener una instancia imperativa que no forma parte del JSX;
- acceder a una API del navegador sobre un nodo real.

Para esos casos React ofrece `useRef`.

Una ref es un objeto estable con una propiedad `current`. Puede apuntar a un nodo DOM o almacenar un valor que debe sobrevivir a los renders sin provocar uno nuevo.

La decisión esencial es esta:

> Si un cambio debe reflejarse en pantalla, normalmente usa estado. Si el valor solo coordina una operación imperativa y no participa en el render, una ref puede ser apropiada.

Las refs son una salida controlada de la programación declarativa de React. Son útiles, pero no deben convertirse en un segundo sistema de estado oculto.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. explicar qué problema resuelve `useRef`;
2. describir la forma y estabilidad de un objeto ref;
3. diferenciar una variable local, estado y ref;
4. tipar referencias a `HTMLInputElement`, `HTMLSelectElement` y otros nodos;
5. manejar correctamente el valor inicial `null`;
6. entender cuándo React asigna y limpia una ref DOM;
7. enfocar y desplazar nodos de manera segura;
8. conservar timers y controladores entre renders;
9. evitar leer o escribir `ref.current` durante el render;
10. reconocer la excepción de inicialización predecible;
11. evitar mutaciones destructivas del DOM administrado por React;
12. combinar estado, refs y Zod en un formulario profesional;
13. probar comportamiento imperativo con Vitest y Testing Library;
14. relacionar `useRef` con la arquitectura Full Stack de SiteOps Tracker.

---

## 3. El problema que resuelve `useRef`

Una variable local no persiste como almacenamiento entre renders:

~~~tsx
import { useState } from "react";

export function BrokenTimer() {
  const [status, setStatus] = useState<"idle" | "running">("idle");
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function start() {
    timeoutId = setTimeout(() => {
      setStatus("idle");
    }, 1_000);

    setStatus("running");
  }

  function cancel() {
    // En otro render, timeoutId volvió a ser null.
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }

  return (
    <section>
      <p>{status}</p>
      <button type="button" onClick={start}>Iniciar</button>
      <button type="button" onClick={cancel}>Cancelar</button>
    </section>
  );
}
~~~

Cada render vuelve a ejecutar el cuerpo del componente. La nueva ejecución crea otra variable `timeoutId` con valor `null`.

Moverla fuera del componente tampoco es correcto:

~~~ts
// Problemático: todas las instancias del componente compartirían este valor.
let sharedTimeoutId: ReturnType<typeof setTimeout> | null = null;
~~~

Necesitas un contenedor que:

- permanezca asociado a una instancia del componente;
- sobreviva a los renders;
- pueda cambiar sin disparar un render.

Ese contenedor es una ref.

---

## 4. Razón de existir

React administra datos declarativos mediante props, estado y contexto. Cuando esos datos cambian, React vuelve a renderizar para calcular la interfaz.

Sin embargo, ciertos valores son operativos y no visuales:

- un nodo DOM;
- un timer activo;
- una conexión o controlador imperativo;
- una instancia de una librería externa;
- un identificador de solicitud;
- un valor técnico consultado solo desde un evento o Effect.

Forzar esos valores dentro del estado causaría renders que no producen ningún cambio visual. Una ref permite conservarlos sin notificar a React.

También conecta JSX con un nodo real. React decide cuándo crear, reemplazar o eliminar ese nodo y actualiza `ref.current` durante la fase de commit.

---

## 5. Funcionamiento de `useRef`

La forma general es:

~~~tsx
import { useRef } from "react";

const ref = useRef(initialValue);
~~~

El resultado se parece conceptualmente a:

~~~ts
type RefContainer<T> = {
  current: T;
};
~~~

Propiedades importantes:

1. `current` comienza con el valor inicial.
2. React devuelve el mismo objeto ref en los renders siguientes.
3. Puedes cambiar `current` desde eventos o Effects.
4. Cambiar `current` no solicita un nuevo render.
5. Cada instancia del componente recibe su propio objeto ref.
6. Si la ref se conecta al atributo JSX `ref`, React administra su valor.

Ejemplo de valor técnico:

~~~tsx
const requestCountRef = useRef(0);

function recordRequest(): void {
  requestCountRef.current += 1;
  console.info("Solicitudes de esta instancia:", requestCountRef.current);
}
~~~

El contador sirve para diagnóstico dentro de un evento. No se muestra en JSX. Si debiera verse en pantalla, tendría que ser estado.

---

## 6. La misma ref entre renders

Aunque el componente se ejecuta otra vez, el objeto devuelto por `useRef` conserva su identidad:

~~~tsx
import { useRef, useState } from "react";

export function InstanceCounter() {
  const [label, setLabel] = useState("Sede demo");
  const actionCountRef = useRef(0);

  function handleAction(): void {
    actionCountRef.current += 1;
  }

  return (
    <section>
      <input
        value={label}
        onChange={(event) => setLabel(event.currentTarget.value)}
      />
      <button type="button" onClick={handleAction}>
        Registrar acción técnica
      </button>
    </section>
  );
}
~~~

Cambiar `label` provoca renders, pero `actionCountRef` sigue apuntando al mismo contenedor. Incrementar la ref no vuelve a renderizar.

No uses esta propiedad para esconder datos visuales. La estabilidad de la ref es una herramienta de coordinación, no un reemplazo general de `useState`.

---

## 7. Variable, ref o estado

| Mecanismo | Persiste entre renders | Cambiarlo renderiza | Alcance | Uso típico |
|---|---:|---:|---|---|
| Variable local | No | No | ejecución actual | cálculo temporal del render o evento |
| Variable de módulo | Sí | No | compartida por importadores | constantes o recursos realmente globales |
| `useRef` | Sí | No | instancia del componente | DOM, timers, handles imperativos |
| `useState` | Sí | Sí | instancia del componente | información que determina la interfaz |

Regla práctica: si el cambio debe modificar lo que la persona ve, usa estado, props o contexto. Si no debe modificar la vista pero necesita persistir entre renders, considera una ref. Si tampoco necesita persistir, usa una variable local.

Una ref no valida datos, no sincroniza por sí sola y no causa Effects. Solo conserva una referencia mutable.

---

## 8. Tipar una referencia al DOM

Con TypeScript debes indicar qué clase de nodo recibirá la ref:

~~~tsx
import { useRef } from "react";

export function FocusExample() {
  const inputRef = useRef<HTMLInputElement>(null);

  function focusInput(): void {
    inputRef.current?.focus();
  }

  return (
    <>
      <label htmlFor="asset-search">Buscar activo</label>
      <input id="asset-search" ref={inputRef} />
      <button type="button" onClick={focusInput}>
        Enfocar búsqueda
      </button>
    </>
  );
}
~~~

`HTMLInputElement` ofrece métodos y propiedades como:

- `focus()`;
- `select()`;
- `value`;
- `setSelectionRange()`.

Otros tipos comunes:

~~~tsx
const selectRef = useRef<HTMLSelectElement>(null);
const buttonRef = useRef<HTMLButtonElement>(null);
const listRef = useRef<HTMLUListElement>(null);
const sectionRef = useRef<HTMLElement>(null);
const dialogRef = useRef<HTMLDialogElement>(null);
~~~

El genérico describe el nodo futuro; `null` describe que todavía puede no existir.

---

## 9. Por qué `null` es parte del ciclo real

Una ref DOM no contiene el nodo durante el primer render. React todavía está calculando JSX.

El ciclo simplificado es:

1. durante render, `current` es `null` si el nodo aún no existe;
2. durante commit, React crea o actualiza el DOM;
3. React asigna el nodo a `current`;
4. antes de retirar o reemplazar el nodo, React vuelve a asignar `null`;
5. después de un nuevo commit, puede asignar otro nodo.

Por eso este código es inseguro:

~~~tsx
const inputRef = useRef<HTMLInputElement>(null);

function focusInput(): void {
  // Error de TypeScript: current puede ser null.
  inputRef.current.focus();
}
~~~

Opciones seguras:

~~~tsx
function focusWithOptionalChaining(): void {
  inputRef.current?.focus();
}

function focusWithGuard(): void {
  const input = inputRef.current;

  if (input === null) {
    return;
  }

  input.focus();
}
~~~

El guard es mejor cuando necesitas varias operaciones sobre el mismo nodo.

---

## 10. Evita `null!` como solución automática

Podrías encontrar este patrón:

~~~tsx
const inputRef = useRef<HTMLInputElement>(null!);
~~~

La aserción dice al compilador que ignore `null`; no cambia el runtime. Si el nodo se renderiza condicionalmente o ya fue desmontado, el acceso puede fallar.

Prefiere modelar la realidad:

~~~tsx
const inputRef = useRef<HTMLInputElement>(null);

inputRef.current?.focus();
~~~

Usa una aserción no nula solo cuando puedas demostrar el invariante y el fallo sea verdaderamente imposible. En código de interfaz con renderizado condicional, esa certeza suele ser menor de lo que parece.

---

## 11. Referencias DOM: operaciones razonables

Las refs son apropiadas para acciones no destructivas como:

- enfocar un control;
- seleccionar texto;
- desplazar un elemento;
- reproducir o pausar multimedia;
- medir tamaño o posición;
- integrar un widget imperativo;
- observar un elemento con APIs del navegador.

Ejemplo de desplazamiento:

~~~tsx
import { useRef } from "react";

export function FindingsSummary() {
  const criticalSectionRef = useRef<HTMLElement>(null);

  function showCriticalFindings(): void {
    criticalSectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <main>
      <button type="button" onClick={showCriticalFindings}>
        Ir a hallazgos críticos
      </button>

      <section ref={criticalSectionRef} tabIndex={-1}>
        <h2>Hallazgos críticos</h2>
      </section>
    </main>
  );
}
~~~

`tabIndex={-1}` permite enfocar programáticamente una sección si la experiencia lo requiere, sin añadirla al orden normal de tabulación.

---

## 12. No modifiques destructivamente el DOM de React

Evita eliminar, reemplazar o añadir manualmente hijos que React administra:

~~~tsx
function removeOutsideReact(): void {
  // Evitar: React conserva un modelo que ya no coincide con el DOM.
  criticalSectionRef.current?.remove();
}
~~~

La forma declarativa usa estado:

~~~tsx
import { useState } from "react";

export function DismissibleNotice() {
  const [visible, setVisible] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setVisible(false)}>
        Ocultar aviso
      </button>
      {visible && <p>Revisión pendiente</p>}
    </>
  );
}
~~~

React debe seguir siendo la fuente de verdad de la estructura que renderiza. Usa refs para interactuar con nodos, no para mantener un DOM paralelo.

---

## 13. No leas ni escribas `current` durante el render

Este código rompe la pureza:

~~~tsx
import { useRef } from "react";

export function BrokenRenderCounter() {
  const renderCountRef = useRef(0);

  // Incorrecto: mutación durante render.
  renderCountRef.current += 1;

  // Incorrecto: el JSX depende de una ref mutable.
  return <p>Renders: {renderCountRef.current}</p>;
}
~~~

React puede ejecutar, pausar, repetir o descartar renders. Leer o mutar una ref durante esa fase hace que el resultado dependa del orden de ejecución.

Lugares apropiados:

- manejadores de eventos;
- Effects y su cleanup;
- callbacks de APIs externas;
- inicialización predecible que cumple la excepción explicada más adelante.

Si necesitas leer un valor para decidir JSX, usa estado, props o contexto.

---

## 14. Strict Mode no convierte una inicialización impura en segura

En desarrollo, Strict Mode puede llamar dos veces al componente para detectar impurezas. Una de las ref creadas será descartada.

No hagas trabajo externo dentro del argumento inicial:

~~~tsx
// Evitar si el constructor abre conexiones, registra listeners o escribe logs.
const clientRef = useRef(new ExternalAuditClient());
~~~

Además, la expresión `new ExternalAuditClient()` se evalúa en cada render aunque React conserve solo el primer valor.

Las conexiones, listeners y suscripciones pertenecen a un Effect con cleanup. Una ref solo puede guardar su handle cuando realmente se necesita fuera del Effect.

---

## 15. Excepción: inicialización predecible y perezosa

React permite un patrón muy limitado durante render cuando el resultado es siempre equivalente, la asignación ocurre solo al inicializar y no produce efectos externos:

~~~tsx
import { useRef } from "react";

class ConfigurationAnalyzer {
  analyze(text: string): readonly string[] {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }
}

export function ConfigurationPreview() {
  const analyzerRef = useRef<ConfigurationAnalyzer | null>(null);

  if (analyzerRef.current === null) {
    // Aceptable solo porque la construcción es local, pura y predecible.
    analyzerRef.current = new ConfigurationAnalyzer();
  }

  function handleAnalyze(): void {
    const rules = analyzerRef.current?.analyze("hostname demo-switch");
    console.info(rules);
  }

  return (
    <button type="button" onClick={handleAnalyze}>
      Analizar configuración ficticia
    </button>
  );
}
~~~

No uses esta excepción para `fetch`, WebSockets, timers, acceso a almacenamiento, telemetría ni mutaciones globales.

---

## 16. Valor mutable persistente: timer tipado

`ReturnType<typeof setTimeout>` evita asumir si el entorno representa el timer como número u objeto:

~~~tsx
import { useEffect, useRef, useState } from "react";

export function AutoSaveIndicator() {
  const [status, setStatus] = useState<"idle" | "scheduled" | "saved">(
    "idle",
  );
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(): void {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    setStatus("scheduled");

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setStatus("saved");
    }, 800);
  }

  function cancelSave(): void {
    if (timeoutRef.current === null) {
      return;
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setStatus("idle");
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <section>
      <p role="status">Estado: {status}</p>
      <button type="button" onClick={scheduleSave}>Programar</button>
      <button type="button" onClick={cancelSave}>Cancelar</button>
    </section>
  );
}
~~~

La ref guarda el handle porque no se muestra. El estado guarda `status` porque sí determina la interfaz. El cleanup evita que el timer sobreviva al componente.

---

## 17. Valor mutable persistente: `AbortController`

En la lección 41, el controlador podía vivir dentro del Effect porque solo el cleanup lo necesitaba. Si un botón también debe cancelar la solicitud, una ref conecta ambos lugares:

~~~tsx
import { useEffect, useRef, useState } from "react";

type LoadState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "success" }>
  | Readonly<{ status: "cancelled" }>
  | Readonly<{ status: "error" }>;

export function ManualSiteRefresh({ siteId }: Readonly<{ siteId: string }>) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  function refresh(): void {
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });

    void fetch(`/api/sites/${encodeURIComponent(siteId)}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (controllerRef.current !== controller) {
          return;
        }

        setState({ status: "success" });
      })
      .catch((error: unknown) => {
        if (controllerRef.current !== controller) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          setState({ status: "cancelled" });
          return;
        }

        setState({ status: "error" });
      })
      .finally(() => {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
        }
      });
  }

  function cancel(): void {
    controllerRef.current?.abort();
  }

  useEffect(() => {
    return () => {
      const controller = controllerRef.current;
      controllerRef.current = null;
      controller?.abort();
    };
  }, []);

  return (
    <section>
      <p>Estado: {state.status}</p>
      <button type="button" onClick={refresh}>Actualizar</button>
      <button
        type="button"
        onClick={cancel}
        disabled={state.status !== "loading"}
      >
        Cancelar
      </button>
    </section>
  );
}
~~~

Este ejemplo se concentra en la coordinación. Una implementación real todavía debe tratar el cuerpo HTTP como `unknown`, validarlo y evitar mensajes técnicos en la UI.

---

## 18. Ref no significa “valor reactivo más rápido”

Este componente no actualiza la pantalla correctamente:

~~~tsx
import { useRef } from "react";

export function BrokenFindingCount() {
  const countRef = useRef(0);

  return (
    <button
      type="button"
      onClick={() => {
        countRef.current += 1;
      }}
    >
      Hallazgos seleccionados: {countRef.current}
    </button>
  );
}
~~~

La ref cambia, pero React no sabe que debe volver a renderizar. Usa estado:

~~~tsx
import { useState } from "react";

export function FindingCount() {
  const [count, setCount] = useState(0);

  return (
    <button type="button" onClick={() => setCount((current) => current + 1)}>
      Hallazgos seleccionados: {count}
    </button>
  );
}
~~~

La elección no es una optimización prematura. Es parte del contrato: React debe conocer todo dato que determina la salida visual.

---

## 19. Refs y renderizado condicional

Una ref puede volver a `null` cuando el elemento desaparece:

~~~tsx
import { useRef, useState } from "react";

export function OptionalSearch() {
  const [visible, setVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  function showAndFocus(): void {
    setVisible(true);

    // Todavía puede ser null: el nuevo DOM no se confirmó en este instante.
    searchRef.current?.focus();
  }

  return (
    <section>
      <button type="button" onClick={showAndFocus}>
        Mostrar búsqueda
      </button>
      {visible && <input ref={searchRef} aria-label="Buscar" />}
    </section>
  );
}
~~~

El `setVisible` encola una actualización; no modifica el DOM inmediatamente. Si el foco debe ocurrir cuando aparece el campo, modela esa sincronización con un Effect dependiente de `visible`:

~~~tsx
import { useEffect } from "react";

useEffect(() => {
  if (visible) {
    searchRef.current?.focus();
  }
}, [visible]);
~~~

No introduzcas un Effect cuando el nodo ya existe y un evento puede actuar directamente sobre él.

---

## 20. Refs dentro de listas dinámicas

No llames `useRef` dentro de `map`:

~~~tsx
// Incorrecto: un Hook dentro de un ciclo.
findings.map((finding) => {
  const itemRef = useRef<HTMLLIElement>(null);
  return <li ref={itemRef}>{finding.title}</li>;
});
~~~

Opciones según la necesidad:

- coloca un componente hijo por elemento y usa una ref dentro de ese componente;
- usa una ref al contenedor y una API declarativa cuando sea suficiente;
- usa callback refs para mantener un `Map` por identificador;
- evita índices si los elementos pueden reordenarse.

Una colección de refs debe seguir las mismas reglas de identidad estable que las `key`: el identificador del dominio es mejor que la posición visual.

---

## 21. Refs y componentes propios

Una ref conectada a `<input>` recibe el nodo porque es un elemento integrado. Un componente propio debe exponer explícitamente qué acepta.

En React moderno puede aceptar `ref` como prop y reenviarla:

~~~tsx
import type { ComponentPropsWithoutRef, Ref } from "react";

type SiteSearchInputProps = ComponentPropsWithoutRef<"input"> &
  Readonly<{
    ref?: Ref<HTMLInputElement> | undefined;
  }>;

export function SiteSearchInput({
  ref,
  ...inputProps
}: SiteSearchInputProps) {
  return (
    <input
      {...inputProps}
      ref={ref}
      type="search"
    />
  );
}
~~~

~~~tsx
import { useRef } from "react";
import { SiteSearchInput } from "./SiteSearchInput";

export function SiteToolbar() {
  const searchRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <SiteSearchInput ref={searchRef} aria-label="Buscar sede" />
      <button type="button" onClick={() => searchRef.current?.focus()}>
        Buscar
      </button>
    </>
  );
}
~~~

En bases de código con versiones anteriores de React encontrarás `forwardRef`. Comprueba la versión y los tipos instalados antes de copiar un patrón. No expongas todo un nodo si el consumidor solo necesita una capacidad estrecha.

---

## 22. Ejemplo completo: formulario de hallazgo con foco accesible

SiteOps Tracker debe enfocar el primer campo inválido al intentar registrar un hallazgo. La información visible vive en estado; las refs solo permiten dirigir el foco.

### 22.1 Esquema runtime

~~~ts
import { z } from "zod";

export const createFindingSchema = z.object({
  title: z.string().trim().min(3, "Escribe al menos 3 caracteres."),
  severity: z.enum(["low", "medium", "high", "critical"], {
    error: "Selecciona una severidad válida.",
  }),
  notes: z.string().trim().max(500, "Usa como máximo 500 caracteres."),
});

export type CreateFindingInput = Readonly<
  z.infer<typeof createFindingSchema>
>;
~~~

El esquema es la autoridad runtime. Los estados del formulario siguen siendo strings sin confiar porque provienen de interacción del navegador.

### 22.2 Componente tipado

~~~tsx
import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  createFindingSchema,
  type CreateFindingInput,
} from "./createFindingSchema";

type FieldErrors = Readonly<{
  title?: string | undefined;
  severity?: string | undefined;
  notes?: string | undefined;
}>;

type CreateFindingFormProps = Readonly<{
  onValidSubmit: (input: CreateFindingInput) => void;
}>;

export function CreateFindingForm({
  onValidSubmit,
}: CreateFindingFormProps) {
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const titleRef = useRef<HTMLInputElement>(null);
  const severityRef = useRef<HTMLSelectElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  function focusFirstInvalidField(path: PropertyKey | undefined): void {
    switch (path) {
      case "title":
        titleRef.current?.focus();
        break;
      case "severity":
        severityRef.current?.focus();
        break;
      case "notes":
        notesRef.current?.focus();
        break;
      default:
        titleRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const rawInput: unknown = {
      title,
      severity,
      notes,
    };

    const result = createFindingSchema.safeParse(rawInput);

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;

      setErrors({
        title: fieldErrors.title?.[0],
        severity: fieldErrors.severity?.[0],
        notes: fieldErrors.notes?.[0],
      });

      focusFirstInvalidField(result.error.issues[0]?.path[0]);
      return;
    }

    setErrors({});
    onValidSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="finding-title">Título</label>
        <input
          ref={titleRef}
          id="finding-title"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          aria-invalid={errors.title !== undefined}
          aria-describedby={errors.title ? "finding-title-error" : undefined}
        />
        {errors.title && (
          <p id="finding-title-error" role="alert">
            {errors.title}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="finding-severity">Severidad</label>
        <select
          ref={severityRef}
          id="finding-severity"
          value={severity}
          onChange={(event) => setSeverity(event.currentTarget.value)}
          aria-invalid={errors.severity !== undefined}
          aria-describedby={
            errors.severity ? "finding-severity-error" : undefined
          }
        >
          <option value="">Selecciona una opción</option>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
          <option value="critical">Crítica</option>
        </select>
        {errors.severity && (
          <p id="finding-severity-error" role="alert">
            {errors.severity}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="finding-notes">Notas</label>
        <textarea
          ref={notesRef}
          id="finding-notes"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          aria-invalid={errors.notes !== undefined}
          aria-describedby={errors.notes ? "finding-notes-error" : undefined}
        />
        {errors.notes && (
          <p id="finding-notes-error" role="alert">
            {errors.notes}
          </p>
        )}
      </div>

      <button type="submit">Registrar hallazgo</button>
    </form>
  );
}
~~~

---

## 23. Funcionamiento del ejemplo, paso a paso

1. El componente renderiza controles administrados por estado.
2. React conecta cada atributo `ref` con el nodo correspondiente durante commit.
3. La persona envía el formulario.
4. `handleSubmit` construye un valor `unknown` en la frontera de entrada.
5. Zod valida longitud, enumeración y límite de notas.
6. Si falla, el componente guarda mensajes en estado para volver a renderizar.
7. La primera ruta de error decide qué ref consultar.
8. `focus()` mueve el foco sin modificar la estructura del DOM.
9. Si la validación funciona, `result.data` tiene el tipo inferido y datos normalizados.
10. `onValidSubmit` recibe solo un `CreateFindingInput` validado.

Los errores viven en estado porque deben mostrarse. Los nodos viven en refs porque solo se usan para una operación imperativa. El payload validado vive en una variable local porque se necesita durante esa ejecución del evento.

---

## 24. Type checking no es validación runtime

Este tipo no protege el formulario en ejecución:

~~~ts
type CreateFindingInput = {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  notes: string;
};
~~~

TypeScript desaparece al producir JavaScript. Tampoco valida:

- un `FormData`;
- parámetros de ruta o consulta;
- cuerpos y respuestas HTTP;
- APIs externas;
- archivos de configuración;
- variables de entorno;
- mensajes de una suscripción;
- filas de PostgreSQL.

Una ref correctamente tipada garantiza autocompletado para `focus()` durante desarrollo. No garantiza que un campo exista en el momento del acceso ni que su valor cumpla reglas del negocio.

Por eso el ejemplo usa dos protecciones distintas:

- `useRef<HTMLInputElement>(null)` para el contrato estático del nodo;
- `createFindingSchema.safeParse(rawInput)` para validar datos reales.

---

## 25. Cuándo utilizar `useRef`

Úsalo cuando necesites:

- acceder a un nodo DOM desde un evento o Effect;
- enfocar, seleccionar o desplazar de forma no destructiva;
- guardar un identificador de timer;
- conservar un `AbortController` o handle imperativo;
- integrar una API del navegador o widget externo;
- almacenar una instancia local costosa con inicialización predecible;
- mantener un valor entre renders que no participa en la salida visual.

Antes de elegir una ref, formula dos preguntas:

1. ¿El valor debe persistir entre renders?
2. ¿Cambiarlo no debe actualizar la interfaz?

Si ambas respuestas son sí, una ref puede encajar.

---

## 26. Cuándo evitarlo

Evita una ref cuando:

- el valor determina el JSX;
- necesitas que un cambio provoque render;
- una variable local es suficiente;
- intentas evitar dependencias de un Effect;
- quieres mutar props o estado sin pasar por sus setters;
- pretendes eliminar o reordenar DOM administrado por React;
- una solución declarativa expresa mejor la intención;
- quieres esconder estado compartido;
- la ref solo evita diseñar correctamente el flujo de datos.

Una ref es un escape hatch. Debe reducir una necesidad imperativa concreta, no desplazar la arquitectura declarativa.

---

## 27. Errores comunes y sus causas

### Error 1: mostrar `ref.current` en JSX

Cambiar una ref no renderiza. Usa estado para información visible.

### Error 2: olvidar el genérico DOM

`useRef(null)` puede no ofrecer el tipo útil del nodo. Declara `useRef<HTMLInputElement>(null)`.

### Error 3: eliminar `null` con una aserción automática

TypeScript deja de advertir, pero el nodo todavía puede no existir en runtime.

### Error 4: leer una ref durante render

El valor puede corresponder al commit anterior o cambiar fuera del flujo declarativo.

### Error 5: escribir una ref durante render

Rompe pureza, salvo la excepción estricta de inicialización local y predecible.

### Error 6: crear efectos externos en el valor inicial

La expresión se evalúa al renderizar y Strict Mode puede ayudar a revelar la impureza. Usa un Effect con cleanup.

### Error 7: olvidar cleanup de timers o conexiones

La ref conserva el handle; no libera el recurso automáticamente.

### Error 8: llamar `useRef` dentro de una lista

Viola las Rules of Hooks. Extrae un componente o usa callback refs.

### Error 9: usar índices como identidad de refs

Al reordenar elementos, una posición puede apuntar a otro registro. Usa identificadores estables.

### Error 10: asumir que `setState` actualiza el DOM inmediatamente

La actualización se encola. Una ref todavía puede apuntar al DOM anterior hasta el commit.

### Error 11: mutar el DOM que React controla

El árbol real deja de coincidir con el modelo de React y puede producir fallos.

### Error 12: guardar datos externos en una ref sin validarlos

Una ref preserva cualquier valor, incluso uno inválido. Valida en la frontera.

### Error 13: usar una ref para eludir `exhaustive-deps`

Ocultar un valor reactivo puede crear lógica obsoleta. Reestructura el Effect o usa la API correcta.

### Error 14: compartir una ref mediante una variable de módulo

Una variable externa se comparte entre instancias y solicitudes del servidor. Mantén la ref dentro del componente.

### Error 15: exponer más capacidad imperativa de la necesaria

Si un consumidor solo necesita `focus`, no le entregues una API que pueda modificar arbitrariamente el nodo.

---

## 28. Ref, estado y datos derivados en SiteOps Tracker

Clasifica cada dato:

| Dato | Mecanismo | Motivo |
|---|---|---|
| texto de búsqueda visible | estado | cambia los resultados y el JSX |
| nodo del campo de búsqueda | ref DOM | permite `focus()` |
| timer de debounce | ref | persiste, pero no se muestra |
| lista filtrada | cálculo derivado | se obtiene de datos y filtro |
| respuesta HTTP | estado después de validar | determina la interfaz |
| `AbortController` activo | ref si un evento debe acceder | handle imperativo |
| cliente API estable de módulo | constante | no pertenece a una instancia visual |
| errores de formulario | estado | deben mostrarse y anunciarse |

Esta clasificación evita dos extremos: guardar todo en estado o esconder todo en refs.

---

## 29. ESLint, TypeScript y seguridad

TypeScript ayuda a:

- elegir el tipo DOM correcto;
- exigir comprobaciones de `null`;
- tipar timers y handles;
- impedir métodos inexistentes;
- diferenciar estado visual de recursos técnicos.

ESLint y los plugins de React pueden detectar:

- Hooks llamados en lugares inválidos;
- lectura o escritura de refs durante render;
- dependencias omitidas;
- mutaciones incompatibles con React;
- promesas ignoradas;
- usos inseguros de `any`.

No desactives una regla para convertir una ref en atajo. La advertencia suele señalar una frontera de diseño que merece atención.

---

## 30. Prueba de foco con Testing Library

Prueba la experiencia, no la existencia de la variable `titleRef`:

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateFindingForm } from "./CreateFindingForm";

describe("CreateFindingForm", () => {
  it("enfoca el primer campo inválido al enviar", async () => {
    const user = userEvent.setup();
    const onValidSubmit = vi.fn();

    render(<CreateFindingForm onValidSubmit={onValidSubmit} />);

    const titleInput = screen.getByLabelText("Título");

    await user.click(
      screen.getByRole("button", { name: "Registrar hallazgo" }),
    );

    expect(document.activeElement).toBe(titleInput);
    expect(onValidSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});
~~~

`userEvent` simula una interacción más cercana a la de una persona que disparar un evento aislado. La aserción observa el resultado accesible: cuál nodo tiene el foco.

---

## 31. Prueba de envío validado

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { CreateFindingForm } from "./CreateFindingForm";

it("entrega datos validados y normalizados", async () => {
  const user = userEvent.setup();
  const onValidSubmit = vi.fn();

  render(<CreateFindingForm onValidSubmit={onValidSubmit} />);

  await user.type(
    screen.getByLabelText("Título"),
    "  Etiqueta de activo pendiente  ",
  );
  await user.selectOptions(screen.getByLabelText("Severidad"), "medium");
  await user.type(screen.getByLabelText("Notas"), "Sede ficticia norte");
  await user.click(
    screen.getByRole("button", { name: "Registrar hallazgo" }),
  );

  expect(onValidSubmit).toHaveBeenCalledWith({
    title: "Etiqueta de activo pendiente",
    severity: "medium",
    notes: "Sede ficticia norte",
  });
});
~~~

La prueba demuestra que el tipo final no proviene de una aserción: Zod validó y recortó el texto antes de llamar al consumidor.

---

## 32. Prueba de timers guardados en refs

Cuando una ref guarda un timer, prueba comportamiento y cleanup:

~~~tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AutoSaveIndicator } from "./AutoSaveIndicator";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("cancela el timer pendiente", async () => {
  const user = userEvent.setup({
    advanceTimers: vi.advanceTimersByTime,
  });

  render(<AutoSaveIndicator />);

  await user.click(screen.getByRole("button", { name: "Programar" }));
  expect(screen.getByRole("status").textContent).toContain("scheduled");

  await user.click(screen.getByRole("button", { name: "Cancelar" }));

  act(() => {
    vi.advanceTimersByTime(1_000);
  });

  expect(screen.getByRole("status").textContent).toContain("idle");
});
~~~

La prueba no accede a `timeoutRef`. Verifica que la cancelación impide la transición visual posterior.

---

## 33. Relación explícita con la arquitectura Full Stack

El recorrido completo sigue siendo:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

Relación con `useRef`:

1. **React:** estado y props describen la UI; las refs resuelven interacciones imperativas puntuales.
2. **HTTP:** una ref puede guardar un controlador cancelable, pero no valida solicitudes ni respuestas.
3. **Node.js:** recibe datos reales y ejecuta el backend; no conoce refs del navegador.
4. **Router:** dirige método y ruta al controlador adecuado.
5. **Controller:** traduce HTTP al caso de uso y construye una respuesta pública.
6. **Runtime Validation:** verifica params, query, body y respuestas externas en ejecución.
7. **Service:** aplica reglas de negocio sin depender del DOM.
8. **Repository:** define operaciones de persistencia independientes de React.
9. **PostgreSQL:** conserva datos con constraints y transacciones reales.
10. **Testing:** comprueba foco, cancelación y UI; también prueba integración backend y E2E.
11. **Docker:** reproduce API y PostgreSQL para pruebas consistentes.
12. **CI/CD:** ejecuta typecheck, lint, pruebas y build antes del despliegue.
13. **Cloud:** hospeda servicios, administra configuración, secretos, logs y métricas.

Una ref solo pertenece a la capa React o a una integración de navegador. No debe transportar reglas de negocio hacia la interfaz ni convertirse en persistencia.

---

## 34. Relación con las piezas del portafolio

### SiteOps Tracker

Refs para enfocar filtros inválidos, desplazar hallazgos destacados y cancelar una carga manual. Estado para todo lo visible.

### SDK tipado para una API

El SDK recibe `AbortSignal` como dependencia normal y valida respuestas. La ref puede conservar el controlador, pero el SDK mantiene el contrato HTTP.

### API REST Node.js + TypeScript + PostgreSQL

El backend vuelve a validar cada body. Un foco correcto en React mejora experiencia, pero no representa seguridad ni autorización.

### Analizador de configuraciones

Una instancia pura y local puede guardarse en una ref si su creación es costosa. Los archivos que analiza siguen siendo `unknown` hasta validarlos.

### Repositorio de algoritmos TypeScript

Los algoritmos no necesitan refs. Deben conservarse como funciones puras con entradas, salidas y complejidad verificables.

### Aplicación Full Stack

Las refs mejoran detalles accesibles de interacción sin invadir HTTP, Services, Repositories o PostgreSQL.

---

## 35. Ejercicio práctico — Atajo de teclado para enfocar activos

Crea un Custom Hook `useAssetSearchShortcut` para enfocar el buscador de activos al presionar `Ctrl+K` o `Cmd+K`.

No se incluye la solución completa.

### Punto de partida

~~~tsx
import { useEffect, useRef } from "react";

export function useAssetSearchShortcut() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // TODO: registra un listener keydown estable.
    // TODO: enfoca inputRef.current cuando corresponda.
    // TODO: devuelve el cleanup.
  }, []);

  return inputRef;
}
~~~

~~~tsx
import { useAssetSearchShortcut } from "./useAssetSearchShortcut";

export function AssetSearch() {
  const inputRef = useAssetSearchShortcut();

  return (
    <div>
      <label htmlFor="asset-search">Buscar activos</label>
      <input
        id="asset-search"
        ref={inputRef}
        type="search"
        placeholder="Ctrl/⌘ + K"
      />
    </div>
  );
}
~~~

### Requisitos

1. Llama `useRef` y `useEffect` en el nivel superior.
2. Usa `HTMLInputElement`, no `any`.
3. Registra `keydown` en `window` después del commit.
4. Detecta `event.ctrlKey || event.metaKey` junto con `event.key.toLowerCase() === "k"`.
5. Llama `preventDefault()` solo cuando el atajo coincida.
6. Usa una comprobación segura de `inputRef.current`.
7. Selecciona el texto después de enfocar si ya existe contenido.
8. Retira exactamente el mismo listener en cleanup.
9. No guardes el texto de búsqueda en la ref.
10. Prueba que otra tecla no cambia el foco.
11. Prueba `Ctrl+K` y `Cmd+K`.
12. Desmonta el componente y comprueba que el listener ya no actúa.

---

## 36. Pistas para el ejercicio

1. Define `handleKeyDown(event: KeyboardEvent): void` dentro del Effect.
2. `KeyboardEvent` aquí es el evento DOM global, no `React.KeyboardEvent`.
3. Guarda `const input = inputRef.current` antes de usarlo varias veces.
4. Si `input === null`, retorna.
5. Usa `input.focus()` y luego `input.select()`.
6. Registra con `window.addEventListener("keydown", handleKeyDown)`.
7. Limpia con `window.removeEventListener("keydown", handleKeyDown)`.
8. En la prueba usa `userEvent.setup()` y `user.keyboard()`.
9. Observa `document.activeElement`; no intentes leer la ref privada.
10. El Hook comparte lógica, no el mismo input entre consumidores.

---

## 37. Reto adicional — Registro Full Stack con foco por errores

Extiende el formulario de hallazgos hasta una operación real de SiteOps Tracker.

### React

- Mantén controles visibles en estado.
- Usa refs solo para foco y scroll.
- Modela `idle`, `submitting`, `success` y `error` con una unión discriminada.
- Deshabilita envíos duplicados.
- Enfoca el primer error local.
- Si la API devuelve errores de campos válidos, enfoca el campo correspondiente después de validar esa respuesta.

### SDK y HTTP

- Define `createFinding(input, { signal })`.
- Envía JSON con `Content-Type: application/json`.
- Trata la respuesta de éxito y error como `unknown`.
- Valida ambos contratos con Zod.
- No muestres trazas, SQL ni mensajes internos.

### Node.js

- Implementa `POST /api/sites/:siteId/findings`.
- Separa Router, Controller, Runtime Validation y Service.
- Valida `siteId`, body y autenticación/autorización.
- Devuelve códigos HTTP coherentes y un error público estructurado.

### Repository y PostgreSQL

- Usa consultas parametrizadas.
- Inserta dentro de una transacción si también agregas historial.
- Aplica constraints para identificadores, estados y campos obligatorios.
- Devuelve una fila mapeada y validada.

### Testing

- Prueba validación y foco con Testing Library.
- Prueba cancelación al desmontar.
- Prueba Service de forma unitaria.
- Prueba Controller, Repository y PostgreSQL en integración.
- Añade un E2E para error, corrección y envío exitoso.

### Docker, CI/CD y Cloud

- Usa Docker Compose para API y PostgreSQL de pruebas.
- Ejecuta typecheck, ESLint, Vitest, integración y build en GitHub Actions.
- Valida variables de entorno al arrancar Node.
- Inyecta secretos mediante el entorno de despliegue, nunca en el frontend.
- Registra errores estructurados sin datos sensibles.

El reto debe demostrar que una ref mejora la interacción, mientras la seguridad y la integridad continúan en las capas del servidor y la base de datos.

---

## 38. Preguntas de comprensión

1. ¿Qué contiene el objeto que devuelve `useRef`?
2. ¿Por qué cambiar `current` no vuelve a renderizar?
3. ¿Qué diferencia existe entre una variable local y una ref?
4. ¿Por qué una variable de módulo no reemplaza una ref?
5. ¿Cuándo usarías estado en lugar de una ref?
6. ¿Por qué `useRef<HTMLInputElement>(null)` incluye un estado nulo real?
7. ¿Cuándo asigna React el nodo a `current`?
8. ¿Por qué es peligroso usar `null!` sin demostrar un invariante?
9. ¿Dónde es seguro leer o escribir una ref?
10. ¿Cuál es la excepción de inicialización durante render?
11. ¿Por qué un timer necesita cleanup aunque esté guardado en una ref?
12. ¿Por qué no debes llamar `useRef` dentro de `map`?
13. ¿Qué problema causa eliminar manualmente DOM administrado por React?
14. ¿Una ref tipada valida el valor escrito en un formulario?
15. ¿Cómo probarías que un campo recibió foco sin acceder a la ref interna?

---

## 39. Relevancia para entrevistas técnicas

### “¿Qué diferencia hay entre `useRef` y `useState`?”

Ambos persisten por instancia. Cambiar estado solicita un render; cambiar `ref.current` no. Estado representa datos visuales y la ref conserva handles o nodos imperativos.

### “¿Por qué una ref DOM empieza en `null`?”

El nodo no existe durante el primer render. React lo asigna durante commit y vuelve a `null` al retirarlo.

### “¿Se puede leer `ref.current` durante render?”

En general no. Rompe la pureza y puede observar un commit anterior. La excepción es una inicialización local, determinista y ejecutada solo cuando `current` es nulo.

### “¿Cuándo usarías una ref para un timer?”

Cuando el handle debe persistir entre renders y ser accesible desde otros eventos o cleanup, pero no participa en la UI.

### “¿Por qué `ReturnType<typeof setTimeout>`?”

Evita acoplar el tipo del handle a una representación específica del navegador o Node.

### “¿Qué riesgo tiene manipular el DOM con refs?”

Si modificas estructura administrada por React, el DOM real puede divergir del árbol esperado. Prefiero operaciones no destructivas como foco, scroll o medición.

### “¿Cómo tipas una ref de input?”

Con `useRef<HTMLInputElement>(null)` y una comprobación de nulo antes de llamar métodos del nodo.

### “¿`useRef` valida datos externos?”

No. TypeScript desaparece en runtime y una ref acepta el valor que le asignes. HTTP, formularios, archivos, entorno y base de datos requieren validación real.

---

## 40. Lista de verificación profesional

Antes de aceptar una ref, comprueba:

- [ ] El valor debe persistir entre renders.
- [ ] Su cambio no debe renderizar la interfaz.
- [ ] El tipo DOM o del handle es explícito.
- [ ] `null` está modelado y comprobado.
- [ ] No se usa `null!` por comodidad.
- [ ] No se lee ni escribe `current` durante render.
- [ ] Una inicialización en render es pura y determinista.
- [ ] Las operaciones DOM son no destructivas.
- [ ] React sigue controlando la estructura visual.
- [ ] Los timers, listeners y conexiones tienen cleanup.
- [ ] La ref no oculta estado que debería ser visible.
- [ ] No se usa para silenciar `exhaustive-deps`.
- [ ] Los datos externos se validan en runtime.
- [ ] Las pruebas observan foco, cancelación o resultado visible.
- [ ] No se llama `useRef` dentro de condiciones o ciclos.
- [ ] El alcance sigue siendo la instancia correcta.
- [ ] La integración con componentes propios coincide con la versión de React.
- [ ] Typecheck, lint, tests y build pasan en CI.

---

## 41. Resumen

- `useRef` devuelve un objeto estable con una propiedad `current`.
- Una ref persiste por instancia y cambiarla no provoca render.
- Una variable local se recrea; una variable de módulo se comparte; una ref conserva alcance por componente.
- Usa estado para datos visibles y refs para handles imperativos no visuales.
- Las refs DOM suelen iniciar en `null` porque el nodo se asigna durante commit.
- Tipos como `HTMLInputElement` ofrecen métodos correctos y autocompletado.
- Optional chaining o un guard conservan seguridad frente a `null`.
- Leer o escribir una ref durante render rompe pureza, salvo inicialización predecible y limitada.
- Foco, scroll y medición son usos razonables; eliminar DOM controlado por React no lo es.
- Timers, controladores y conexiones todavía requieren cleanup.
- `ReturnType<typeof setTimeout>` funciona en distintos entornos TypeScript.
- Una ref no valida formularios ni respuestas HTTP.
- TypeScript desaparece en runtime; Zod protege las fronteras reales.
- Testing Library permite probar foco y conducta sin inspeccionar refs privadas.
- En SiteOps Tracker, las refs mejoran interacción React sin absorber responsabilidades de backend o PostgreSQL.

---

## Referencias oficiales

- [React: `useRef`](https://react.dev/reference/react/useRef)
- [React: Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs)
- [React: Referencing Values with Refs](https://react.dev/learn/referencing-values-with-refs)
- [React: Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure)
- [React: Using TypeScript](https://react.dev/learn/typescript)
- [Testing Library: user-event introduction](https://testing-library.com/docs/user-event/intro/)
- [Testing Library: Keyboard](https://testing-library.com/docs/user-event/keyboard/)
- [Vitest: Timer mocks](https://vitest.dev/guide/mocking/timers)
- [Zod: Basic usage](https://zod.dev/basics)
- [MDN: `HTMLElement.focus()`](https://developer.mozilla.org/docs/Web/API/HTMLElement/focus)
- [MDN: `AbortController`](https://developer.mozilla.org/docs/Web/API/AbortController)

Referencias consultadas el **20 de octubre de 2026**.

---

# Próxima lección

**Lección 43 — Memoización consciente con `useMemo`, `useCallback` y `memo`: identidad, dependencias y cuándo no optimizar.**
