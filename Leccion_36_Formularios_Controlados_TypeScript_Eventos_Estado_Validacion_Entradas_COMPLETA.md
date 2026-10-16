# Lección 36 — Formularios controlados con TypeScript: eventos, estado y validación de entradas

> **Proyecto guía:** SiteOps Tracker, una aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, responsables, acciones correctivas e historial.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** React profesional con TypeScript — estado e interacción del usuario  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## 1. Introducción

En la lección anterior aprendiste a modelar estado local con `useState`, inferencia, uniones y actualizaciones inmutables. El siguiente paso natural es usar ese estado para recibir datos de una persona mediante un formulario.

En SiteOps Tracker, una persona auditora podría registrar un hallazgo con:

- una sede;
- un título;
- una prioridad;
- una descripción;
- y la indicación de que requiere seguimiento.

Un formulario parece sencillo hasta que aparecen preguntas reales:

- ¿Quién conserva el valor actual: el navegador o React?
- ¿Qué tipo tiene el evento de un `input`, un `select` o un `textarea`?
- ¿Por qué un campo numérico suele llegar como texto?
- ¿Cómo evitamos enviar una prioridad inválida solo porque usamos una aserción `as`?
- ¿La validación del navegador o de TypeScript protege la API?
- ¿Cómo representamos errores de campo, un envío en curso y un fallo del servidor?

Un formulario profesional no es solo un conjunto de cajas de texto. Es una frontera en la que datos introducidos en runtime pasan de ser entradas no confiables a convertirse, después de validación, en un comando que la aplicación puede usar.

---

## 2. Objetivo de la lección

Al terminar podrás:

1. explicar la diferencia entre un campo controlado y uno no controlado;
2. tipar eventos de `input`, `textarea`, `select` y `form`;
3. actualizar formularios de forma inmutable;
4. separar el estado editable del formulario del dato validado que necesita el dominio;
5. validar entradas en runtime con Zod antes de llamar a un SDK o una API;
6. representar estados de envío sin combinaciones imposibles;
7. reconocer qué validaciones pertenecen a React, al backend y a PostgreSQL;
8. probar la interacción del formulario desde la perspectiva del usuario.

---

## 3. El problema que resuelven los formularios controlados

Comencemos con un campo que deja al navegador conservar su propio valor:

~~~tsx
export function UncontrolledTitleField() {
  return <input name="title" defaultValue="" />;
}
~~~

Este campo es **no controlado**. React define su valor inicial, pero después el DOM mantiene el valor actual. Es una opción válida cuando solo necesitas leer los datos al enviar el formulario.

Ahora observa un campo cuyo valor procede del estado:

~~~tsx
import { useState, type ChangeEvent } from "react";

export function ControlledTitleField() {
  const [title, setTitle] = useState("");

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setTitle(event.currentTarget.value);
  }

  return (
    <label>
      Título del hallazgo
      <input value={title} onChange={handleTitleChange} />
    </label>
  );
}
~~~

Este campo es **controlado**:

1. React renderiza `value={title}`.
2. La persona escribe una tecla.
3. React ejecuta `onChange`.
4. El manejador lee `event.currentTarget.value`.
5. `setTitle` solicita una nueva renderización.
6. React entrega al campo el nuevo `value`.

La variable `title` es la fuente de verdad. Esto permite mostrar una vista previa, habilitar o deshabilitar acciones, limpiar errores y enviar exactamente el valor que representa la interfaz.

### El error clásico: `value` sin actualización

~~~tsx
export function FrozenField() {
  const title = "Cable expuesto";

  return <input value={title} />;
}
~~~

El campo queda efectivamente de solo lectura. React fuerza el valor recibido en cada renderización. Todo campo controlado necesita un `onChange` que actualice sincrónicamente el estado asociado, salvo que sea intencionalmente `readOnly`.

---

## 4. ¿Por qué existen los componentes controlados?

El navegador ya sabe manejar formularios. React no reemplaza esa capacidad; ofrece una forma de sincronizarla con el modelo de estado de la interfaz.

Un campo controlado resulta útil cuando otras partes de la UI dependen de lo que se escribe:

- contador de caracteres;
- vista previa de un hallazgo;
- validación inmediata;
- campos que aparecen según una selección;
- botón deshabilitado durante un envío;
- limpieza coordinada después de guardar;
- valores compartidos entre componentes;
- pruebas que verifican estados visibles.

La idea central es:

> La interfaz muestra el estado de React y los eventos del usuario solicitan cambios a ese estado.

Esto hace explícito el flujo de datos. El costo es que cada cambio produce una actualización de estado y requiere diseñar con cuidado el modelo del formulario.

---

## 5. Dos modelos distintos: borrador editable y dato válido

Un error frecuente es intentar que el estado del formulario tenga desde el primer momento el mismo tipo que el comando válido del dominio.

Supongamos que SiteOps Tracker acepta tres prioridades:

~~~ts
type Priority = "low" | "medium" | "high";

type CreateFindingInput = {
  siteId: string;
  title: string;
  priority: Priority;
  description: string;
  requiresFollowUp: boolean;
};
~~~

Durante la edición, sin embargo, la persona todavía puede no haber elegido una prioridad. El formulario necesita representar ese estado incompleto:

~~~ts
type CreateFindingDraft = {
  siteId: string;
  title: string;
  priority: "" | "low" | "medium" | "high";
  description: string;
  requiresFollowUp: boolean;
};

const INITIAL_DRAFT: CreateFindingDraft = {
  siteId: "",
  title: "",
  priority: "",
  description: "",
  requiresFollowUp: false,
};
~~~

La cadena vacía no es una prioridad del dominio; es un estado legítimo de la interfaz: “todavía no seleccionado”. Separar ambos tipos evita mentirle al compilador.

| Modelo | Propósito | Puede estar incompleto | Debe cruzar HTTP |
|---|---|---:|---:|
| `CreateFindingDraft` | Reflejar lo que se edita en pantalla | Sí | No directamente |
| `CreateFindingInput` | Comando validado para crear un hallazgo | No | Sí, después de validarlo |

No uses una aserción para borrar esta diferencia:

~~~ts
// Incorrecto: la aserción no comprueba nada en runtime.
const priority = rawValue as Priority;
~~~

Si `rawValue` fuera `"urgent"`, TypeScript confiaría en la aserción, aunque el dato siguiera siendo inválido.

---

## 6. Los tipos de TypeScript desaparecen en runtime

Esta distinción es esencial en toda la ruta:

~~~ts
type Priority = "low" | "medium" | "high";
~~~

El tipo ayuda durante el desarrollo, pero no se incluye como verificación automática en el JavaScript generado. En runtime, un formulario, una respuesta HTTP o un archivo pueden contener cualquier valor.

Por eso debemos separar:

- **type checking:** el compilador revisa nuestro código antes de ejecutarlo;
- **validación runtime:** código real examina un valor que existe durante la ejecución.

Esto aplica a:

- formularios de React;
- cuerpos y parámetros HTTP;
- APIs externas;
- archivos JSON o CSV;
- variables de entorno;
- resultados obtenidos de PostgreSQL;
- mensajes de colas y eventos.

Un tipo anotado no valida esos datos. En esta lección usaremos Zod para convertir un borrador desconocido o incompleto en un dato comprobado.

---

## 7. Un esquema Zod como frontera de validación

Definimos el esquema ejecutable y derivamos de él el tipo válido:

~~~ts
import * as z from "zod";

export const CreateFindingInputSchema = z
  .object({
    siteId: z.string().trim().min(1, "Selecciona una sede"),
    title: z
      .string()
      .trim()
      .min(3, "El título debe tener al menos 3 caracteres")
      .max(120, "El título no puede superar 120 caracteres"),
    priority: z.enum(["low", "medium", "high"]),
    description: z
      .string()
      .trim()
      .max(1_000, "La descripción no puede superar 1000 caracteres"),
    requiresFollowUp: z.boolean(),
  })
  .strict();

export type CreateFindingInput = z.infer<
  typeof CreateFindingInputSchema
>;
~~~

El esquema tiene dos trabajos:

1. comprueba datos en runtime;
2. permite inferir el tipo TypeScript del resultado válido.

`safeParse` devuelve una unión discriminada:

~~~ts
const result = CreateFindingInputSchema.safeParse({
  siteId: "site-demo-01",
  title: "UPS sin registro de mantenimiento",
  priority: "high",
  description: "Hallazgo ficticio para práctica.",
  requiresFollowUp: true,
});

if (result.success) {
  // result.data ya fue validado y tiene tipo CreateFindingInput.
  console.log(result.data.title);
} else {
  // result.error describe problemas encontrados en runtime.
  console.error(result.error.issues);
}
~~~

No necesitamos `as CreateFindingInput`. El éxito de la validación estrecha la unión y entrega un dato confiable respecto del esquema.

### Cliente y servidor deben validar

Validar en React mejora la experiencia: da retroalimentación rápida y evita solicitudes evidentemente inválidas. No constituye una frontera de seguridad. Cualquier cliente puede omitir la interfaz y llamar directamente a la API.

Por eso:

- React valida para experiencia de usuario;
- Node.js valida nuevamente al recibir HTTP;
- el Service aplica reglas de negocio;
- PostgreSQL conserva restricciones de integridad apropiadas.

---

## 8. Tipar eventos de formulario en React

React ofrece tipos específicos según el elemento y el evento.

| Interacción | Tipo recomendado | Valor principal |
|---|---|---|
| Texto en `input` | `ChangeEvent<HTMLInputElement>` | `currentTarget.value` |
| Cambio en `textarea` | `ChangeEvent<HTMLTextAreaElement>` | `currentTarget.value` |
| Selección en `select` | `ChangeEvent<HTMLSelectElement>` | `currentTarget.value` |
| Checkbox | `ChangeEvent<HTMLInputElement>` | `currentTarget.checked` |
| Envío de `form` | `FormEvent<HTMLFormElement>` | `preventDefault()` y `currentTarget` |

Importa los eventos como tipos:

~~~tsx
import type { ChangeEvent, FormEvent } from "react";
~~~

### `currentTarget` frente a `target`

`currentTarget` representa el elemento al que está asociado el manejador y conserva un tipo útil. `target` representa el origen más profundo del evento, que podría variar por propagación.

~~~tsx
function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
  const nextTitle = event.currentTarget.value;
  console.log(nextTitle);
}
~~~

En manejadores tipados de controles, `currentTarget` expresa mejor la intención.

### Inferencia en línea

TypeScript puede inferir el tipo si el manejador está escrito directamente en JSX:

~~~tsx
<input
  value={title}
  onChange={(event) => setTitle(event.currentTarget.value)}
/>
~~~

Cuando extraes el manejador a una función con nombre, anota el evento explícitamente. Esto mejora legibilidad y evita recurrir a `any`.

---

## 9. Texto, `textarea`, `select` y checkbox

Cada control tiene una propiedad distinta que actúa como fuente de verdad.

### 9.1 `input` de texto

~~~tsx
const [siteId, setSiteId] = useState("");

<input
  name="siteId"
  value={siteId}
  onChange={(event) => setSiteId(event.currentTarget.value)}
/>
~~~

Un campo de texto controlado debe mantener un `string`. Inicializarlo con `""` evita cambiar accidentalmente de no controlado a controlado.

### 9.2 `textarea`

~~~tsx
const [description, setDescription] = useState("");

<textarea
  name="description"
  value={description}
  onChange={(event) => setDescription(event.currentTarget.value)}
/>
~~~

En React, un `textarea` controlado recibe su contenido mediante `value`, no mediante hijos JSX.

### 9.3 `select`

~~~tsx
type PriorityOption = "" | "low" | "medium" | "high";

const [priority, setPriority] = useState<PriorityOption>("");

<select
  name="priority"
  value={priority}
  onChange={(event) => {
    const result = z
      .enum(["low", "medium", "high"])
      .safeParse(event.currentTarget.value);

    setPriority(result.success ? result.data : "");
  }}
>
  <option value="">Selecciona una prioridad</option>
  <option value="low">Baja</option>
  <option value="medium">Media</option>
  <option value="high">Alta</option>
</select>
~~~

Aunque las opciones parezcan limitadas, `event.currentTarget.value` tiene tipo `string`. Validarlo es más honesto que escribir `as Priority`. React controla la opción mediante el `value` del `select`; no uses `selected` en cada `option`.

### 9.4 Checkbox

~~~tsx
const [requiresFollowUp, setRequiresFollowUp] = useState(false);

<input
  name="requiresFollowUp"
  type="checkbox"
  checked={requiresFollowUp}
  onChange={(event) => {
    setRequiresFollowUp(event.currentTarget.checked);
  }}
/>
~~~

Para un checkbox, la selección está en `checked`, no en `value`.

---

## 10. Actualizar un objeto de formulario sin mutarlo

Un formulario suele agrupar varios campos en un solo objeto:

~~~tsx
import { useState, type ChangeEvent } from "react";

type FindingDraft = {
  siteId: string;
  title: string;
  description: string;
};

const INITIAL_FINDING_DRAFT: FindingDraft = {
  siteId: "",
  title: "",
  description: "",
};

export function FindingDraftExample() {
  const [draft, setDraft] = useState<FindingDraft>(
    INITIAL_FINDING_DRAFT,
  );

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;

    setDraft((current) => ({
      ...current,
      title: value,
    }));
  }

  function handleDescriptionChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    const value = event.currentTarget.value;

    setDraft((current) => ({
      ...current,
      description: value,
    }));
  }

  return (
    <>
      <input value={draft.title} onChange={handleTitleChange} />
      <textarea
        value={draft.description}
        onChange={handleDescriptionChange}
      />
    </>
  );
}
~~~

La actualización funcional usa el estado más reciente y crea un objeto nuevo. Evita esta mutación:

~~~tsx
// Incorrecto: modifica el objeto existente.
draft.title = "Nuevo título";
setDraft(draft);
~~~

React compara referencias. Conservar la misma referencia puede impedir una actualización predecible y vuelve más difícil razonar sobre el historial del estado.

### ¿Un manejador genérico para todos los campos?

Es posible crear uno basado en `name`, pero puede diluir los dominios de cada campo: todos los valores de texto llegan como `string`, mientras un checkbox produce `boolean` y un `select` puede requerir validación. Al comenzar, los manejadores explícitos ofrecen más claridad. Extrae abstracciones solo cuando preserven los tipos y reduzcan repetición real.

---

## 11. Los campos numéricos también requieren conversión y validación

Un `input type="number"` no convierte automáticamente el estado del formulario en un número de dominio. `value` sigue siendo texto y debe poder representar el campo vacío durante la edición.

~~~tsx
import { useState } from "react";

export function EstimatedHoursField() {
  const [estimatedHoursDraft, setEstimatedHoursDraft] = useState("");

  return (
    <input
      type="number"
      min="0"
      max="1000"
      value={estimatedHoursDraft}
      onChange={(event) => {
        setEstimatedHoursDraft(event.currentTarget.value);
      }}
    />
  );
}
~~~

Después valida y transforma explícitamente:

~~~ts
import * as z from "zod";

const EstimatedHoursSchema = z
  .string()
  .trim()
  .min(1, "Indica las horas estimadas")
  .transform((value) => Number(value))
  .pipe(
    z
      .number()
      .finite("Las horas deben ser un número finito")
      .min(0, "Las horas no pueden ser negativas")
      .max(1_000, "Las horas no pueden superar 1000"),
  );

const result = EstimatedHoursSchema.safeParse("12.5");

if (result.success) {
  // result.data tiene tipo number y valor 12.5.
  console.log(result.data);
}
~~~

El `min(1)` antes de `Number` es importante porque `Number("")` produce `0`, algo que podría transformar un campo vacío en un dato aparentemente válido.

Los atributos HTML como `min`, `max` y `required` ayudan a la experiencia, pero el servidor debe validar nuevamente.

---

## 12. Enviar el formulario de manera explícita

El envío se maneja en el elemento `form`, no solamente en el clic del botón. Así también funciona al presionar Enter y se conserva la semántica accesible del navegador.

~~~tsx
import { useState, type FormEvent } from "react";

export function MinimalFindingForm() {
  const [title, setTitle] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    console.log({ title });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="finding-title">Título</label>
      <input
        id="finding-title"
        name="title"
        value={title}
        onChange={(event) => setTitle(event.currentTarget.value)}
      />

      <button type="submit">Registrar hallazgo</button>
      <button type="button" onClick={() => setTitle("")}>
        Limpiar
      </button>
    </form>
  );
}
~~~

`event.preventDefault()` evita la navegación tradicional de la página para que la aplicación maneje el envío. Además:

- `type="submit"` declara el botón de envío;
- `type="button"` evita que una acción auxiliar envíe el formulario;
- un `button` sin `type` dentro de un formulario se comporta como botón de envío.

---

## 13. Modelar el estado del envío con una unión discriminada

Tres booleanos pueden crear combinaciones absurdas:

~~~ts
type FragileSubmitState = {
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
};
~~~

¿Qué significa que los tres sean `true`? Una unión discriminada permite solo estados nombrados:

~~~ts
type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; findingId: string }
  | { status: "error"; message: string };

const INITIAL_SUBMIT_STATE: SubmitState = { status: "idle" };
~~~

El render puede estrechar cada caso:

~~~tsx
function SubmitFeedback({ state }: { state: SubmitState }) {
  switch (state.status) {
    case "idle":
      return null;
    case "submitting":
      return <p>Guardando…</p>;
    case "success":
      return <p>Hallazgo registrado: {state.findingId}</p>;
    case "error":
      return <p role="alert">{state.message}</p>;
  }
}
~~~

El estado representa la realidad de la interfaz y TypeScript impide leer `findingId` fuera del caso exitoso.

---

## 14. Convertir errores de Zod en errores de campo

El formulario necesita asociar mensajes con controles concretos:

~~~ts
type FieldErrors = Partial<
  Record<keyof CreateFindingDraft, string>
>;
~~~

Zod puede aplanar un error y agrupar los mensajes por campo:

~~~ts
import * as z from "zod";

function validateFindingDraft(draft: CreateFindingDraft) {
  const result = CreateFindingInputSchema.safeParse(draft);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    } as const;
  }

  const { fieldErrors } = z.flattenError(result.error);

  const errors: FieldErrors = {
    siteId: fieldErrors.siteId?.[0],
    title: fieldErrors.title?.[0],
    priority: fieldErrors.priority?.[0],
    description: fieldErrors.description?.[0],
    requiresFollowUp: fieldErrors.requiresFollowUp?.[0],
  };

  return {
    success: false,
    errors,
  } as const;
}
~~~

La función devuelve otra unión discriminada. En el caso exitoso entrega el comando validado; en el caso fallido entrega errores presentables.

Para una aplicación internacionalizada conviene almacenar códigos o construir mensajes mediante un sistema de traducción. Aquí usamos mensajes directos para concentrarnos en el flujo.

---

## 15. Ejemplo completo: formulario de hallazgos de SiteOps Tracker

Este ejemplo integra estado controlado, eventos tipados, Zod, accesibilidad y una dependencia de SDK. Los nombres y datos son completamente ficticios.

~~~tsx
import {
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import * as z from "zod";

const PrioritySchema = z.enum(["low", "medium", "high"]);

const CreateFindingInputSchema = z
  .object({
    siteId: z.string().trim().min(1, "Selecciona una sede"),
    title: z
      .string()
      .trim()
      .min(3, "Escribe al menos 3 caracteres")
      .max(120, "Usa como máximo 120 caracteres"),
    priority: PrioritySchema,
    description: z
      .string()
      .trim()
      .max(1_000, "Usa como máximo 1000 caracteres"),
    requiresFollowUp: z.boolean(),
  })
  .strict();

type Priority = z.infer<typeof PrioritySchema>;
type CreateFindingInput = z.infer<
  typeof CreateFindingInputSchema
>;

type CreateFindingDraft = {
  siteId: string;
  title: string;
  priority: "" | Priority;
  description: string;
  requiresFollowUp: boolean;
};

type FindingSummary = {
  id: string;
  title: string;
  priority: Priority;
};

type FindingsSdk = {
  createFinding(input: CreateFindingInput): Promise<FindingSummary>;
};

type FieldErrors = Partial<
  Record<keyof CreateFindingDraft, string>
>;

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; findingId: string }
  | { status: "error"; message: string };

const INITIAL_DRAFT: CreateFindingDraft = {
  siteId: "",
  title: "",
  priority: "",
  description: "",
  requiresFollowUp: false,
};

type CreateFindingFormProps = {
  sdk: FindingsSdk;
};

export function CreateFindingForm({
  sdk,
}: CreateFindingFormProps) {
  const [draft, setDraft] = useState<CreateFindingDraft>(
    INITIAL_DRAFT,
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(
    {},
  );
  const [submitState, setSubmitState] = useState<SubmitState>({
    status: "idle",
  });

  const isSubmitting = submitState.status === "submitting";

  function clearFieldError(field: keyof CreateFindingDraft) {
    setFieldErrors((current) => {
      if (current[field] === undefined) {
        return current;
      }

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleSiteChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.currentTarget.value;

    setDraft((current) => ({ ...current, siteId: value }));
    clearFieldError("siteId");
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.currentTarget.value;

    setDraft((current) => ({ ...current, title: value }));
    clearFieldError("title");
  }

  function handlePriorityChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const result = PrioritySchema.safeParse(
      event.currentTarget.value,
    );

    setDraft((current) => ({
      ...current,
      priority: result.success ? result.data : "",
    }));
    clearFieldError("priority");
  }

  function handleDescriptionChange(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    const value = event.currentTarget.value;

    setDraft((current) => ({ ...current, description: value }));
    clearFieldError("description");
  }

  function handleFollowUpChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const checked = event.currentTarget.checked;

    setDraft((current) => ({
      ...current,
      requiresFollowUp: checked,
    }));
    clearFieldError("requiresFollowUp");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const validation = CreateFindingInputSchema.safeParse(draft);

    if (!validation.success) {
      const { fieldErrors: zodFieldErrors } = z.flattenError(
        validation.error,
      );

      setFieldErrors({
        siteId: zodFieldErrors.siteId?.[0],
        title: zodFieldErrors.title?.[0],
        priority: zodFieldErrors.priority?.[0],
        description: zodFieldErrors.description?.[0],
        requiresFollowUp:
          zodFieldErrors.requiresFollowUp?.[0],
      });
      setSubmitState({ status: "idle" });
      return;
    }

    setFieldErrors({});
    setSubmitState({ status: "submitting" });

    try {
      const created = await sdk.createFinding(validation.data);

      setDraft(INITIAL_DRAFT);
      setSubmitState({
        status: "success",
        findingId: created.id,
      });
    } catch (error: unknown) {
      console.error("Could not create finding", error);
      setSubmitState({
        status: "error",
        message:
          "No fue posible registrar el hallazgo. Intenta de nuevo.",
      });
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      <fieldset disabled={isSubmitting}>
        <legend>Nuevo hallazgo</legend>

        <label htmlFor="finding-site">Sede</label>
        <select
          id="finding-site"
          name="siteId"
          value={draft.siteId}
          onChange={handleSiteChange}
          aria-invalid={Boolean(fieldErrors.siteId)}
          aria-describedby={
            fieldErrors.siteId ? "finding-site-error" : undefined
          }
        >
          <option value="">Selecciona una sede</option>
          <option value="site-demo-north">Sede Norte Demo</option>
          <option value="site-demo-south">Sede Sur Demo</option>
        </select>
        {fieldErrors.siteId && (
          <p id="finding-site-error" role="alert">
            {fieldErrors.siteId}
          </p>
        )}

        <label htmlFor="finding-title">Título</label>
        <input
          id="finding-title"
          name="title"
          value={draft.title}
          onChange={handleTitleChange}
          maxLength={120}
          aria-invalid={Boolean(fieldErrors.title)}
          aria-describedby={
            fieldErrors.title ? "finding-title-error" : undefined
          }
        />
        <p>{draft.title.length}/120</p>
        {fieldErrors.title && (
          <p id="finding-title-error" role="alert">
            {fieldErrors.title}
          </p>
        )}

        <label htmlFor="finding-priority">Prioridad</label>
        <select
          id="finding-priority"
          name="priority"
          value={draft.priority}
          onChange={handlePriorityChange}
          aria-invalid={Boolean(fieldErrors.priority)}
          aria-describedby={
            fieldErrors.priority
              ? "finding-priority-error"
              : undefined
          }
        >
          <option value="">Selecciona una prioridad</option>
          <option value="low">Baja</option>
          <option value="medium">Media</option>
          <option value="high">Alta</option>
        </select>
        {fieldErrors.priority && (
          <p id="finding-priority-error" role="alert">
            {fieldErrors.priority}
          </p>
        )}

        <label htmlFor="finding-description">Descripción</label>
        <textarea
          id="finding-description"
          name="description"
          value={draft.description}
          onChange={handleDescriptionChange}
          maxLength={1_000}
          aria-invalid={Boolean(fieldErrors.description)}
          aria-describedby={
            fieldErrors.description
              ? "finding-description-error"
              : undefined
          }
        />
        {fieldErrors.description && (
          <p id="finding-description-error" role="alert">
            {fieldErrors.description}
          </p>
        )}

        <label>
          <input
            name="requiresFollowUp"
            type="checkbox"
            checked={draft.requiresFollowUp}
            onChange={handleFollowUpChange}
          />
          Requiere seguimiento
        </label>

        <button type="submit">
          {isSubmitting ? "Guardando…" : "Registrar hallazgo"}
        </button>
      </fieldset>

      {submitState.status === "success" && (
        <p role="status">
          Hallazgo registrado: {submitState.findingId}
        </p>
      )}

      {submitState.status === "error" && (
        <p role="alert">{submitState.message}</p>
      )}
    </form>
  );
}
~~~

### Qué está ocurriendo, paso a paso

1. `CreateFindingDraft` representa valores editables, incluida la prioridad vacía.
2. Cada control recibe su valor desde `draft`.
3. Cada evento actualiza una copia nueva del borrador.
4. Al cambiar un campo se elimina solo su error anterior; todavía no se afirma que sea válido.
5. `onSubmit` evita la navegación y bloquea envíos duplicados.
6. Zod valida todo el borrador como una unidad.
7. Si falla, se muestran errores junto a los campos.
8. Si pasa, `validation.data` tiene tipo `CreateFindingInput` y se entrega al SDK.
9. El `fieldset` se deshabilita mientras la operación está en curso.
10. El éxito limpia el borrador y conserva el identificador recibido.
11. Un error inesperado se registra técnicamente y muestra un mensaje seguro a la persona.

`noValidate` desactiva deliberadamente los mensajes nativos del navegador para demostrar la presentación de errores de Zod. En otro diseño puedes conservar la validación HTML. En ambos casos, el backend sigue siendo responsable de validar la solicitud.

---

## 16. El SDK también debe desconfiar de la respuesta HTTP

El formulario entrega un comando validado al SDK. Aun así, la respuesta de la red es `unknown` hasta comprobarla.

~~~ts
import * as z from "zod";

const FindingSummarySchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    priority: z.enum(["low", "medium", "high"]),
  })
  .strict();

type FindingSummary = z.infer<typeof FindingSummarySchema>;

export function createFindingsSdk(baseUrl: string) {
  return {
    async createFinding(
      input: CreateFindingInput,
    ): Promise<FindingSummary> {
      const response = await fetch(`${baseUrl}/findings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload: unknown = await response.json();
      return FindingSummarySchema.parse(payload);
    },
  };
}
~~~

La firma `Promise<FindingSummary>` describe el contrato del método, pero no convierte mágicamente el JSON. El `parse` sí ejecuta una comprobación en runtime.

En un proyecto más grande, el SDK puede convertir errores HTTP a una unión conocida, adjuntar un identificador de correlación y centralizar autenticación. El formulario no debería conocer todos esos detalles.

---

## 17. ¿Dónde valida cada capa Full Stack?

El mismo dato cruza varias fronteras, y cada capa resuelve una responsabilidad distinta.

| Capa | Responsabilidad relacionada con el formulario |
|---|---|
| React | Mantener el borrador, mostrar errores y estados de interacción |
| HTTP/SDK | Serializar el comando, enviar credenciales autorizadas y validar respuestas |
| Node.js | Recibir una entrada no confiable |
| Router | Asociar método y ruta, por ejemplo `POST /findings` |
| Controller | Traducir HTTP a una llamada de aplicación y formar la respuesta |
| Runtime Validation | Comprobar cuerpo, parámetros y consultas con un esquema ejecutable |
| Service | Aplicar reglas de negocio y coordinar el caso de uso |
| Repository | Convertir operaciones del dominio en acceso a persistencia |
| PostgreSQL | Conservar datos e imponer integridad estructural |
| Testing | Verificar comportamiento de UI, contrato y flujo integrado |
| Docker | Reproducir frontend, backend y base de datos en entornos consistentes |
| CI/CD | Ejecutar typecheck, lint, pruebas y despliegues de forma repetible |
| Cloud | Ejecutar y observar el sistema con configuración y secretos reales |

El recorrido conceptual es:

**React → HTTP → Node.js → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL → Testing → Docker → CI/CD → Cloud**

El formulario controla experiencia y captura. No sustituye al backend.

### Ejemplo de validación repetida en Node.js

Sin profundizar todavía en Express, la frontera se vería así:

~~~ts
import type { Request, Response } from "express";

export async function createFindingController(
  request: Request,
  response: Response,
) {
  const parsed = CreateFindingInputSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      code: "VALIDATION_ERROR",
      details: z.flattenError(parsed.error),
    });
  }

  const created = await findingService.create(parsed.data);
  return response.status(201).json(created);
}
~~~

Aunque el frontend use el mismo esquema, el servidor debe ejecutar su propia validación porque no controla quién realiza la solicitud.

---

## 18. Validación HTML, validación de interfaz y reglas de negocio

No toda regla pertenece al mismo lugar.

### HTML

~~~tsx
<input required minLength={3} maxLength={120} />
~~~

Es útil para restricciones simples y accesibilidad, pero se puede omitir al llamar directamente a la API.

### Zod en React

Valida forma, tipos, límites y conversiones antes de enviar. Su objetivo principal es dar retroalimentación clara y mantener el cliente consistente.

### Zod en Node.js

Protege la frontera HTTP. Aquí el cuerpo debe tratarse como dato no confiable, aunque proceda de nuestra propia aplicación React.

### Service

Comprueba reglas que requieren conocimiento del sistema. Por ejemplo: que la sede exista, que el usuario tenga permiso o que una transición de estado sea válida.

### PostgreSQL

Aplica garantías finales como `NOT NULL`, claves foráneas, unicidad y restricciones adecuadas. La base de datos no debería depender de que todas las aplicaciones cliente se comporten bien.

Una regla puede aparecer en más de una capa por razones distintas; eso no significa copiar toda la lógica indiscriminadamente.

---

## 19. Campos no controlados y `FormData`: cuándo son apropiados

Los campos controlados no son obligatorios. Para un formulario sencillo que solo se lee al enviar, el DOM puede conservar los valores:

~~~tsx
import type { FormEvent } from "react";

function QuickSearchForm() {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const candidate: unknown = Object.fromEntries(formData);

    console.log(candidate);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="query" defaultValue="" />
      <button type="submit">Buscar</button>
    </form>
  );
}
~~~

`FormData` no vuelve válido el objeto. Sus entradas pueden ser cadenas o archivos, un checkbox sin seleccionar puede no aparecer y los nombres siguen siendo datos de runtime. Valida `candidate` antes de usarlo.

Los campos no controlados son útiles cuando:

- solo importa el valor final;
- no hay UI derivada por cada pulsación;
- se integra una biblioteca basada en DOM;
- se trabaja con archivos;
- un formulario grande requiere reducir actualizaciones y una solución específica lo justifica.

Un `input type="file"` merece atención especial: por seguridad, la selección de archivos la controla la persona mediante el navegador. Se lee `event.currentTarget.files` o `FormData`; no se intenta imponer una ruta local con `value`.

---

## 20. Cuándo utilizar formularios controlados

Prefiérelos cuando necesites:

- mostrar una vista previa mientras se escribe;
- aplicar formato o normalización visible;
- activar campos condicionales;
- sincronizar el valor con otros componentes;
- limpiar selectivamente campos y errores;
- guardar un borrador en otro estado;
- representar un flujo de varios pasos;
- garantizar que la vista refleje exactamente el estado de React.

Son especialmente adecuados para el formulario de hallazgos de SiteOps Tracker porque la prioridad, los errores, el contador y el envío dependen del borrador actual.

---

## 21. Cuándo evitar o reconsiderar el control total

No conviertas cada formulario en un gran objeto controlado por costumbre. Reconsidera la estrategia cuando:

- el formulario es pequeño y solo se lee al enviarse;
- hay cientos de campos y cada pulsación provoca trabajo costoso;
- una biblioteca de formularios ya gestiona suscripciones por campo;
- el control es un selector de archivos;
- una integración de terceros necesita administrar el DOM;
- el estado duplicaría otra fuente de verdad sin aportar comportamiento.

Antes de cambiar de estrategia, mide. Un formulario normal no suele tener problemas por ser controlado; muchas degradaciones provienen de renderizar componentes pesados en el mismo árbol, ejecutar cálculos innecesarios o enviar solicitudes por cada tecla.

---

## 22. Errores comunes y sus causas

### Error 1: usar `value` sin `onChange`

El campo queda bloqueado porque React vuelve a imponer el mismo valor.

### Error 2: iniciar con `undefined` y después usar una cadena

~~~tsx
// Frágil si externalValue puede ser undefined.
<input value={externalValue} onChange={handleChange} />

// Para un campo controlado de texto:
<input value={externalValue ?? ""} onChange={handleChange} />
~~~

Un control no debe cambiar entre no controlado y controlado durante su vida.

### Error 3: leer `value` de un checkbox

Usa `checked`. El `value` de un checkbox cumple otra función en el envío HTML.

### Error 4: colocar `selected` en una opción

En React controla el `select` mediante `value` o usa `defaultValue` si es no controlado.

### Error 5: poner contenido como hijos de `textarea`

Usa `value` para controlarlo o `defaultValue` para darle un valor inicial no controlado.

### Error 6: afirmar que un `string` ya es una unión válida

~~~ts
const priority = event.currentTarget.value as Priority;
~~~

La aserción silencia al compilador; no comprueba el valor. Usa una guarda o un esquema.

### Error 7: olvidar que `input type="number"` produce texto editable

Mantén un borrador que pueda estar vacío y convierte en la frontera de validación.

### Error 8: mutar el objeto de estado

Construye una copia nueva mediante el operador spread o una actualización funcional.

### Error 9: validar solo en React

Un atacante, un script o una versión antigua del cliente puede saltarse esa validación. Node.js debe validar otra vez.

### Error 10: confiar en el tipo de `response.json()`

Trata la respuesta como `unknown` y compruébala antes de convertirla en estado confiable.

### Error 11: manejar el envío solo con `onClick`

Puede romper el envío con teclado y dispersa la responsabilidad. Usa `onSubmit` del `form`.

### Error 12: omitir `type` en botones auxiliares

Dentro de un formulario, pueden enviar accidentalmente. Declara `type="button"` o `type="submit"`.

### Error 13: permitir envíos duplicados

Representa `submitting`, bloquea una repetición y deshabilita controles durante la operación.

### Error 14: exponer errores internos

Registra detalles técnicos mediante logging y muestra un mensaje seguro. No presentes consultas SQL, trazas o secretos en la UI.

### Error 15: guardar estado derivado innecesario

`isSubmitting` puede calcularse desde `submitState.status`; no necesita otro `useState` que pueda desincronizarse.

---

## 23. Accesibilidad básica del formulario

El tipado correcto no garantiza una interfaz accesible. Como mínimo:

- relaciona cada `label` con su control mediante `htmlFor` e `id`;
- usa elementos semánticos `form`, `fieldset`, `legend` y `button`;
- marca el campo inválido con `aria-invalid`;
- conecta el error con `aria-describedby`;
- usa `role="alert"` para errores que deben anunciarse;
- usa `role="status"` para confirmaciones no urgentes;
- no dependas solo del color;
- conserva el envío con teclado.

Ejemplo reducido:

~~~tsx
<label htmlFor="asset-tag">Etiqueta del activo</label>
<input
  id="asset-tag"
  value={assetTag}
  onChange={handleAssetTagChange}
  aria-invalid={Boolean(error)}
  aria-describedby={error ? "asset-tag-error" : undefined}
/>
{error && (
  <p id="asset-tag-error" role="alert">
    {error}
  </p>
)}
~~~

La accesibilidad forma parte del comportamiento que después puede comprobar Testing Library mediante consultas por rol y nombre accesible.

---

## 24. Probar el formulario con Vitest y Testing Library

Una prueba útil interactúa como una persona: encuentra campos por su nombre accesible, escribe, selecciona, envía y observa el resultado.

~~~tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CreateFindingForm } from "./CreateFindingForm";

describe("CreateFindingForm", () => {
  it("envía un comando validado al SDK", async () => {
    const user = userEvent.setup();
    const createFinding = vi.fn().mockResolvedValue({
      id: "finding-demo-01",
      title: "Rack sin identificación",
      priority: "medium",
    });

    render(
      <CreateFindingForm sdk={{ createFinding }} />,
    );

    await user.selectOptions(
      screen.getByLabelText("Sede"),
      "site-demo-north",
    );
    await user.type(
      screen.getByLabelText("Título"),
      "Rack sin identificación",
    );
    await user.selectOptions(
      screen.getByLabelText("Prioridad"),
      "medium",
    );
    await user.type(
      screen.getByLabelText("Descripción"),
      "Registro ficticio de práctica.",
    );
    await user.click(
      screen.getByRole("checkbox", {
        name: "Requiere seguimiento",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Registrar hallazgo",
      }),
    );

    expect(createFinding).toHaveBeenCalledWith({
      siteId: "site-demo-north",
      title: "Rack sin identificación",
      priority: "medium",
      description: "Registro ficticio de práctica.",
      requiresFollowUp: true,
    });

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("finding-demo-01");
  });

  it("muestra errores y no llama al SDK si falta información", async () => {
    const user = userEvent.setup();
    const createFinding = vi.fn();

    render(
      <CreateFindingForm sdk={{ createFinding }} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Registrar hallazgo",
      }),
    );

    expect(createFinding).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});
~~~

`userEvent.setup()` crea una sesión de interacción y sus acciones son asíncronas. Este enfoque comprueba más que llamar manualmente a una función: verifica etiquetas, controles, eventos y resultado visible.

En pruebas reales añade casos para:

- respuesta HTTP fallida;
- doble clic durante `submitting`;
- límites de longitud;
- limpieza del formulario tras éxito;
- conservación de datos tras error recuperable;
- respuesta del SDK con forma inválida.

---

## 25. Relación con las demás piezas del portafolio

### SiteOps Tracker

Los formularios controlados capturan sedes, activos, hallazgos y acciones correctivas. Separar borrador, validación y comando muestra una arquitectura madura.

### SDK tipado para una API

El componente depende de una interfaz pequeña. El SDK serializa solicitudes, interpreta códigos HTTP y valida respuestas externas antes de entregarlas a React.

### API REST con Node.js, TypeScript y PostgreSQL

La API no confía en la UI. El Controller valida el cuerpo; el Service decide si la operación está permitida; el Repository persiste; PostgreSQL protege la integridad.

### Analizador de configuraciones

Una pantalla podría aceptar texto JSON o YAML. Ese texto sigue siendo una cadena hasta que el analizador lo procesa y valida. Un resaltado de sintaxis no demuestra que la configuración sea válida.

### Repositorio de algoritmos en TypeScript

Un formulario puede elegir un algoritmo y proporcionar entradas de ejemplo. Conviene conservar el texto editable y convertirlo a estructuras válidas antes de ejecutar el algoritmo.

### Aplicación Full Stack

El formulario es el punto donde la intención humana inicia un flujo que termina en persistencia. Un buen portafolio demuestra no solo que “manda un `fetch`”, sino que modela estados, valida fronteras, maneja errores y permite pruebas.

---

## 26. Relación explícita con trabajo Full Stack real

En un equipo profesional, este tema aparece todos los días:

- frontend define estados de edición, carga y error;
- diseño y accesibilidad determinan etiquetas y retroalimentación;
- backend publica contratos HTTP;
- validación runtime impide que datos arbitrarios entren al caso de uso;
- base de datos aplica integridad;
- pruebas evitan regresiones en flujos críticos;
- logging ayuda a investigar fallos sin revelar información sensible;
- CI ejecuta typecheck, ESLint, Vitest y pruebas de integración;
- Docker reproduce dependencias locales;
- Cloud suministra configuración, observabilidad y despliegue.

Un formulario bien diseñado demuestra habilidades transferibles: modelado, eventos, asincronía, contratos, seguridad, accesibilidad y pruebas.

---

## 27. Ejercicio práctico — Formulario de acción correctiva

Construye `CreateCorrectiveActionForm` para SiteOps Tracker.

### Requisitos

El borrador debe incluir:

~~~ts
type CorrectiveActionDraft = {
  findingId: string;
  ownerEmail: string;
  dueDate: string;
  notes: string;
  notifyOwner: boolean;
};
~~~

1. Todos los controles deben ser controlados.
2. Usa eventos React específicos, sin `any`.
3. El checkbox debe usar `checked`.
4. El formulario debe manejar `onSubmit` y ejecutar `preventDefault`.
5. Define un esquema Zod que compruebe:
   - `findingId` no vacío;
   - correo válido;
   - fecha no vacía;
   - notas con máximo 500 caracteres;
   - `notifyOwner` booleano.
6. Deriva `CreateCorrectiveActionInput` con `z.infer`.
7. Muestra al menos un error junto al campo correspondiente.
8. Modela `idle`, `submitting`, `success` y `error` mediante una unión discriminada.
9. Recibe por props un SDK con este contrato:

~~~ts
type CorrectiveActionsSdk = {
  createAction(
    input: CreateCorrectiveActionInput,
  ): Promise<{ id: string }>;
};
~~~

10. No escribas todavía el backend ni una solución completa dentro del ejercicio.

### Entrega sugerida

~~~text
src/
  features/
    corrective-actions/
      CreateCorrectiveActionForm.tsx
      corrective-action.schema.ts
      CreateCorrectiveActionForm.test.tsx
~~~

---

## 28. Pistas para el ejercicio

1. El valor inicial de cada campo de texto puede ser `""`; el checkbox puede iniciar en `false`.
2. Usa `ChangeEvent<HTMLInputElement>` tanto para texto como para checkbox, pero lee propiedades distintas.
3. Conserva `dueDate` como cadena durante la edición. Una fecha HTML sin valor debe poder estar vacía.
4. Valida el objeto completo al enviar, no campo por campo mediante aserciones.
5. `z.flattenError(error).fieldErrors` puede ayudarte a obtener el primer mensaje de cada propiedad.
6. Deshabilita el envío mientras `status === "submitting"`.
7. Para probar, inyecta un `createAction` construido con `vi.fn()`.
8. Consulta controles mediante `getByLabelText` o `getByRole` en lugar de buscar clases CSS.

Las pistas orientan la estructura; no sustituyen tu implementación.

---

## 29. Reto adicional — Flujo Full Stack de creación de hallazgos

Extiende el ejemplo de la lección sin resolverlo de forma completa aquí.

### Objetivo

Construye un flujo vertical pequeño:

1. **React:** formulario controlado y accesible.
2. **SDK:** `createFinding` con validación de respuesta.
3. **Node.js/Express:** `POST /findings`.
4. **Runtime Validation:** el servidor vuelve a ejecutar el esquema de entrada.
5. **Service:** rechaza una sede inexistente mediante una abstracción de repositorio.
6. **Repository:** contrato tipado para insertar el hallazgo.
7. **PostgreSQL:** tabla ficticia con claves y restricciones apropiadas.
8. **Testing:**
   - prueba de componente con Testing Library;
   - prueba unitaria del Service;
   - prueba de integración de la ruta.
9. **Docker:** deja preparada una futura composición de API y PostgreSQL, sin profundizar todavía.

### Condiciones

- El Controller no debe contener SQL.
- El Repository no debe decidir permisos.
- El cliente no debe ser la única capa que valida.
- El SDK debe tratar el JSON de respuesta como `unknown`.
- Los errores públicos no deben revelar trazas ni consultas.
- Los datos de prueba deben ser ficticios y genéricos.

### Pregunta de diseño

Si React y Node.js comparten el mismo esquema, ¿por qué Node.js debe ejecutarlo otra vez? Escribe una respuesta breve antes de programar.

---

## 30. Preguntas de comprensión

1. ¿Qué convierte a un `input` en controlado?
2. ¿Por qué debe actualizarse el estado dentro de `onChange`?
3. ¿Qué diferencia hay entre `value` y `defaultValue`?
4. ¿Por qué el borrador puede necesitar una cadena vacía que el dominio no acepta?
5. ¿Qué tipo de evento usarías para un `textarea`?
6. ¿Por qué se recomienda leer `event.currentTarget`?
7. ¿Qué propiedad debes leer en un checkbox?
8. ¿Por qué `event.currentTarget.value as Priority` no valida la prioridad?
9. ¿Qué ventaja ofrece una unión discriminada para el estado del envío?
10. ¿Qué diferencia existe entre la validación HTML y Zod en el servidor?
11. ¿Por qué `response.json()` debe considerarse `unknown`?
12. ¿Cuándo elegirías `FormData` y campos no controlados?
13. ¿Qué capa debe verificar permisos para crear un hallazgo?
14. ¿Qué restricciones seguirían siendo útiles en PostgreSQL?
15. ¿Qué comportamiento comprobarías con Testing Library en lugar de probar detalles internos del componente?

---

## 31. Relevancia para entrevistas técnicas

Preguntas frecuentes:

### “¿Qué es un componente controlado?”

Una respuesta sólida explica que React proporciona el valor mediante `value` o `checked` y que `onChange` actualiza la fuente de verdad en el estado.

### “¿Cuál es la diferencia entre controlado y no controlado?”

En un controlado, React conserva el estado actual; en uno no controlado, lo conserva el DOM y normalmente se lee mediante una referencia o `FormData`. Ninguno es universalmente superior: depende del comportamiento requerido.

### “¿Cómo tipas un evento de cambio?”

Menciona el elemento concreto: `ChangeEvent<HTMLInputElement>`, `ChangeEvent<HTMLTextAreaElement>` o `ChangeEvent<HTMLSelectElement>`.

### “¿TypeScript valida los datos del formulario?”

No. TypeScript revisa el código en compilación y sus tipos desaparecen en runtime. Las entradas del usuario requieren validación ejecutable, por ejemplo con Zod.

### “¿Por qué validar también en el servidor?”

Porque el servidor no controla a sus clientes. La UI puede omitirse, modificarse o quedar desactualizada.

### “¿Cómo evitarías estados imposibles durante un envío?”

Usaría una unión discriminada como `idle | submitting | success | error`, en lugar de varios booleanos independientes.

### “¿Cómo probarías un formulario?”

Interactuaría por roles y nombres accesibles con Testing Library y `user-event`, comprobaría el comando enviado, los errores visibles, el bloqueo durante el envío y los resultados de éxito o fallo.

En una entrevista, conectar React con contratos HTTP, runtime validation y pruebas suele distinguir una respuesta Full Stack de una respuesta limitada al JSX.

---

## 32. Lista de verificación profesional

Antes de considerar terminado un formulario, revisa:

- [ ] Cada control tiene una fuente de verdad intencional.
- [ ] Los campos controlados no cambian a no controlados.
- [ ] Los eventos tienen el elemento genérico correcto.
- [ ] Los checkboxes usan `checked`.
- [ ] El `select` se controla desde su `value`.
- [ ] El `textarea` usa `value`.
- [ ] El estado se actualiza sin mutación.
- [ ] El borrador representa estados incompletos legítimos.
- [ ] El comando se obtiene mediante validación runtime.
- [ ] No se usan aserciones como sustituto de validación.
- [ ] El envío se maneja en `form.onSubmit`.
- [ ] Los botones tienen un `type` explícito.
- [ ] Se evita el envío duplicado.
- [ ] Los errores están asociados con sus campos.
- [ ] El cliente muestra mensajes seguros.
- [ ] El backend vuelve a validar.
- [ ] El SDK valida respuestas externas.
- [ ] Las pruebas interactúan mediante roles y etiquetas.

---

## 33. Resumen

- Un campo controlado recibe `value` o `checked` desde React y actualiza ese estado con `onChange`.
- Los campos no controlados mantienen su valor actual en el DOM y pueden leerse al enviar.
- `ChangeEvent` se parametriza con el elemento concreto; `FormEvent<HTMLFormElement>` modela el envío.
- `currentTarget` identifica el elemento al que pertenece el manejador.
- El borrador del formulario puede representar estados incompletos que el dominio no acepta.
- Los valores de controles llegan en runtime; una aserción TypeScript no los valida.
- Zod convierte un candidato en un comando comprobado o produce errores estructurados.
- Los tipos TypeScript desaparecen al ejecutar JavaScript.
- Formularios, HTTP, APIs externas, archivos, variables de entorno y resultados de base de datos requieren validación real.
- El frontend valida para experiencia; Node.js valida como frontera de confianza; Services aplican reglas y PostgreSQL protege integridad.
- Una unión discriminada representa con claridad `idle`, `submitting`, `success` y `error`.
- Testing Library permite probar el flujo desde la perspectiva de una persona.

---

## Referencias oficiales

- [React: `<input>`](https://react.dev/reference/react-dom/components/input)
- [React: `<select>`](https://react.dev/reference/react-dom/components/select)
- [React: `<textarea>`](https://react.dev/reference/react-dom/components/textarea)
- [React: `<form>`](https://react.dev/reference/react-dom/components/form)
- [React: Using TypeScript](https://react.dev/learn/typescript)
- [Zod: Basic usage](https://zod.dev/basics)
- [Zod: Formatting errors](https://zod.dev/error-formatting)
- [Testing Library: user-event introduction](https://testing-library.com/docs/user-event/intro/)
- [Testing Library: user-event setup](https://testing-library.com/docs/user-event/setup/)

Referencias consultadas el **12 de octubre de 2026**.

---

# Próxima lección

**Lección 37 — Elevar estado y diseñar componentes controlados: fuente única de verdad y sincronización entre componentes.**
