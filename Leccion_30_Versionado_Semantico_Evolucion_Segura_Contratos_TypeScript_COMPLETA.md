# Lección 30 — Versionado semántico y evolución segura de contratos TypeScript

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, datos, reglas y escenarios de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos  

---

## Introducción

En la lección 28 aprendiste a publicar una API de paquete mediante `package.json`, `exports`, JavaScript y declaraciones `.d.ts`. En la lección 29 conectaste varios paquetes con npm workspaces sin romper sus límites.

Ahora aparece una responsabilidad nueva:

> ¿Cómo cambias un contrato ya consumido sin sorprender ni romper a React, la API, el SDK u otros paquetes?

Cambiar un archivo y conseguir que compile en tu rama no demuestra que el cambio sea compatible. Un consumidor puede depender de:

- el nombre de un export;
- la forma de un objeto;
- los valores de una unión;
- los parámetros y el resultado de una función;
- el comportamiento runtime;
- los errores que una operación puede producir;
- las rutas públicas declaradas en `exports`;
- un schema Zod que acepta o rechaza datos reales.

El **versionado semántico**, o SemVer, comunica el alcance de esos cambios mediante una versión `MAJOR.MINOR.PATCH`. Pero el número solo es útil cuando primero defines qué forma parte de tu API pública y compruebas el impacto desde la perspectiva del consumidor.

La idea central de hoy es:

> La compatibilidad no se decide por cuántas líneas cambiaste, sino por si un consumidor válido de la versión anterior puede seguir compilando y ejecutándose correctamente.

---

## Objetivo

Al terminar esta lección podrás:

1. explicar por qué SemVer exige una API pública definida;
2. distinguir cambios `major`, `minor` y `patch`;
3. reconocer que un contrato TypeScript incluye más que interfaces;
4. analizar compatibilidad desde la perspectiva del consumidor;
5. evaluar cambios en propiedades, uniones, funciones, exports y schemas;
6. diferenciar compatibilidad estática y compatibilidad runtime;
7. diseñar una transición segura con adición, deprecación, adaptación y retiro;
8. interpretar rangos como `^1.4.2`, `~1.4.2` y `^0.2.3`;
9. separar la versión de un paquete, la versión de una API HTTP y una migración de PostgreSQL;
10. relacionar la evolución de contratos con React → HTTP → Node → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL;
11. proponer verificaciones antes de liberar una nueva versión;
12. defender estas decisiones en una entrevista técnica.

---

## 1. El problema que resuelve SemVer

Supón que `@siteops/audit-contracts` publica este contrato:

~~~ts
export type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved";

export interface Finding {
  readonly id: string;
  readonly siteId: string;
  readonly title: string;
  readonly status: FindingStatus;
}
~~~

React lo consume:

~~~ts
import type { Finding } from "@siteops/audit-contracts";

export function statusLabel(finding: Finding): string {
  switch (finding.status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
  }
}
~~~

Después, el paquete cambia `"in_progress"` por `"working"`:

~~~ts
export type FindingStatus =
  | "open"
  | "working"
  | "resolved";
~~~

La modificación ocupa una sola línea, pero el consumidor anterior deja de representar el contrato nuevo. También pueden fallar:

- datos almacenados que todavía usan `"in_progress"`;
- respuestas HTTP de una versión anterior;
- pruebas y fixtures;
- código que realiza un `switch` exhaustivo;
- filtros de React;
- validadores runtime;
- consultas o restricciones de PostgreSQL.

SemVer permite anunciar la magnitud de la ruptura, pero no la evita por sí mismo. El proceso seguro requiere:

1. identificar la API pública;
2. comparar el contrato anterior y el nuevo;
3. clasificar el cambio;
4. preparar compatibilidad o migración;
5. verificar consumidores reales;
6. publicar una versión nueva, sin modificar una versión ya liberada.

---

## 2. Qué significa `MAJOR.MINOR.PATCH`

Una versión normal tiene tres números:

~~~text
2.7.4
│ │ └── PATCH
│ └──── MINOR
└────── MAJOR
~~~

### 2.1 PATCH: corrección compatible

Incrementa `PATCH` cuando corriges comportamiento incorrecto sin romper la API pública.

~~~text
1.4.2 → 1.4.3
~~~

Ejemplos:

- corregir un cálculo interno del analizador;
- reparar un error de serialización manteniendo la forma documentada;
- mejorar mensajes internos sin cambiar códigos públicos;
- optimizar rendimiento sin alterar resultados observables.

Una corrección no es automáticamente `patch`. Si los consumidores dependían razonablemente del comportamiento existente o el cambio altera el contrato observable, puede requerir una versión mayor.

### 2.2 MINOR: funcionalidad nueva compatible

Incrementa `MINOR` cuando añades funcionalidad pública compatible:

~~~text
1.4.3 → 1.5.0
~~~

Ejemplos:

- añadir una función pública sin quitar las anteriores;
- aceptar una nueva opción verdaderamente opcional;
- añadir un subpath público en `exports`;
- marcar una función como obsoleta sin eliminarla;
- ampliar una entrada aceptada sin cambiar resultados existentes.

Al incrementar `MINOR`, `PATCH` vuelve a cero.

### 2.3 MAJOR: cambio incompatible

Incrementa `MAJOR` cuando un consumidor válido puede necesitar cambios:

~~~text
1.5.0 → 2.0.0
~~~

Ejemplos:

- eliminar o renombrar un export;
- hacer obligatoria una propiedad antes opcional;
- quitar un valor aceptado;
- añadir una variante que el consumidor debe manejar exhaustivamente;
- cambiar el formato de errores públicos;
- mover una entrada pública sin conservar compatibilidad;
- modificar un schema para rechazar payloads antes válidos.

Al incrementar `MAJOR`, `MINOR` y `PATCH` vuelven a cero.

### 2.4 Versión `0.y.z`

La especificación SemVer reserva la versión mayor cero para desarrollo inicial y advierte que la API no debe considerarse estable. Eso no significa que puedas ignorar a tus consumidores.

Una política útil para SiteOps Tracker durante desarrollo podría ser:

- `0.2.4 → 0.2.5`: corrección compatible;
- `0.2.5 → 0.3.0`: cambio incompatible;
- `1.0.0`: primer compromiso explícito con una API pública estable.

Esta convención debe documentarse. SemVer dice que en `0.y.z` cualquier cosa puede cambiar; el equipo decide cuánto cuidado contractual mantiene antes de `1.0.0`.

---

## 3. SemVer necesita una API pública

No puedes clasificar cambios si no sabes qué prometiste.

Para `@siteops/audit-contracts`, la API pública puede incluir:

### Superficie estática

- interfaces y aliases exportados;
- parámetros y resultados de funciones;
- genéricos y restricciones;
- sobrecargas;
- propiedades `readonly` u opcionales;
- valores literales de uniones;
- declaraciones `.d.ts` emitidas.

### Superficie runtime

- funciones, clases y constantes ejecutables;
- schemas Zod;
- códigos de error;
- valores por defecto;
- excepciones y condiciones de fallo;
- efectos secundarios;
- formato ESM o CommonJS admitido;
- comportamiento observable.

### Superficie de empaquetado

- nombre del paquete;
- subpaths de `exports`;
- archivos publicados;
- versiones de runtime admitidas;
- dependencias o peer dependencies públicas.

### Superficie Full Stack

- JSON de request y response;
- parámetros, query strings y headers;
- eventos o mensajes;
- variables de entorno documentadas;
- formatos de archivos;
- esquema de base de datos expuesto indirectamente;
- compatibilidad entre frontend, backend y SDK.

El archivo `src/internal/normalize-title.ts` no es público solo porque existe. En cambio, `@siteops/audit-contracts/schemas` sí es público si aparece en `exports`.

~~~json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./schemas": {
      "types": "./dist/schemas.d.ts",
      "import": "./dist/schemas.js"
    }
  }
}
~~~

Una regla profesional es:

> Versiona lo que prometes a consumidores, no cada detalle de implementación.

---

## 4. Compatibilidad: piensa como consumidor

Considera dos preguntas separadas:

1. **¿El código consumidor anterior todavía compila?**
2. **¿Ese mismo código todavía se comporta correctamente al ejecutarse?**

Puede existir compatibilidad en una dimensión y ruptura en la otra.

### Compila, pero falla en runtime

~~~ts
export interface Finding {
  readonly id: string;
  readonly status: "open" | "resolved";
}

// El tipo asegura una promesa estática, pero no inspecciona el JSON.
const payload = (await response.json()) as Finding;
~~~

Si el servidor responde `{ "id": 7, "status": "unknown" }`, la assertion no valida nada.

### Funciona en runtime, pero rompe el type check

~~~ts
// Antes
export function getFinding(id: string): Promise<Finding>;

// Después: misma implementación posible, contrato distinto.
export function getFinding(
  id: string,
  options: { signal: AbortSignal },
): Promise<Finding>;
~~~

JavaScript podría tolerar la ausencia de `options`, pero el nuevo `.d.ts` obliga a modificar consumidores TypeScript. Es una ruptura pública.

Por eso una revisión contractual debe inspeccionar:

- declaraciones emitidas;
- comportamiento ejecutable;
- schemas runtime;
- consumidores representativos.

---

## 5. TypeScript es estructural: la dirección del dato importa

TypeScript compara principalmente la forma de los valores. Esto crea diferencias importantes entre **entradas** y **salidas**.

### 5.1 Ampliar una entrada suele ser compatible

Antes:

~~~ts
export type ListFindingsOptions = {
  readonly siteId?: string;
};
~~~

Después:

~~~ts
export type ListFindingsOptions = {
  readonly siteId?: string;
  readonly status?: "open" | "in_progress" | "resolved";
};
~~~

El consumidor anterior todavía puede enviar solo `siteId`. La opción nueva es aditiva y, si el comportamiento previo se conserva, normalmente es un cambio `minor`.

### 5.2 Exigir una entrada nueva rompe consumidores

~~~ts
export type ListFindingsOptions = {
  readonly siteId?: string;
  readonly status: "open" | "in_progress" | "resolved";
};
~~~

Código anterior como `listFindings({ siteId })` ya no compila. Normalmente es `major`.

### 5.3 Ampliar una salida puede romper manejo exhaustivo

Antes:

~~~ts
export type FindingStatus = "open" | "resolved";
~~~

Después:

~~~ts
export type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved";
~~~

Si `FindingStatus` representa un valor que la librería **devuelve**, añadir `"in_progress"` obliga a algunos consumidores a manejar un caso nuevo.

~~~ts
function assertNever(value: never): never {
  throw new Error("Unexpected status: " + String(value));
}

function label(status: FindingStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "resolved":
      return "Resolved";
    default:
      return assertNever(status);
  }
}
~~~

Tras ampliar la unión, el argumento de `assertNever` deja de ser `never`. Aunque “solo añadiste” un valor, para una salida exhaustiva el cambio suele ser `major`.

### 5.4 Un mismo tipo usado como entrada y salida es difícil de evolucionar

~~~ts
export interface Finding {
  readonly id: string;
  readonly title: string;
  readonly status: FindingStatus;
}
~~~

Si los consumidores:

- reciben `Finding` desde la API;
- y también deben construir un `Finding` completo para enviarlo;

añadir una propiedad requerida tiene efectos opuestos. Los receptores suelen tolerar propiedades adicionales en TypeScript estructural, pero los productores ahora deben crearlas.

Es preferible separar intenciones:

~~~ts
export type CreateFindingInput = {
  readonly siteId: string;
  readonly title: string;
};

export type FindingResponse = {
  readonly id: string;
  readonly siteId: string;
  readonly title: string;
  readonly status: FindingStatus;
};
~~~

No reutilices un “modelo universal” para formulario, request HTTP, dominio, fila PostgreSQL y response. Cada dirección tiene reglas de compatibilidad diferentes.

---

## 6. Matriz práctica de cambios

Esta tabla es un punto de partida, no un sustituto del análisis del contrato real.

| Cambio público | Riesgo para el consumidor | Versión habitual |
| --- | --- | --- |
| Corregir implementación sin alterar contrato | Código previo sigue compilando y funcionando | PATCH |
| Añadir un export independiente | Nadie está obligado a usarlo | MINOR |
| Añadir una opción de entrada opcional | Llamadas anteriores siguen válidas | MINOR |
| Añadir un parámetro obligatorio | Llamadas anteriores dejan de compilar | MAJOR |
| Eliminar o renombrar un export | Imports existentes fallan | MAJOR |
| Cambiar un subpath de `exports` | Imports públicos dejan de resolver | MAJOR |
| Añadir una variante producida en una unión | Un `switch` exhaustivo puede romperse | MAJOR |
| Aceptar una variante adicional como entrada | Amplía valores aceptados | MINOR |
| Dejar de aceptar un valor documentado | Rechaza entradas antes válidas | MAJOR |
| Añadir campo opcional a un objeto de entrada | Productores anteriores siguen válidos | MINOR |
| Hacer obligatorio un campo de entrada | Productores anteriores deben cambiar | MAJOR |
| Añadir propiedad `readonly` donde consumidores escribían | Asignaciones dejan de compilar | MAJOR |
| Marcar API como `@deprecated` sin retirarla | Prepara migración sin ruptura inmediata | MINOR |
| Eliminar API obsoleta | Consumidores deben migrar | MAJOR |
| Endurecer schema runtime | Payloads antes aceptados pueden fallar | MAJOR |
| Relajar schema de entrada | Acepta más payloads | MINOR, si no altera resultados previos |
| Cambiar un código público de error | Manejo de errores puede fallar | MAJOR |

La palabra clave es **producida** o **aceptada**. Añadir un valor aceptado como entrada puede ser compatible; empezar a producir ese valor como salida puede no serlo.

---

## 7. Ejemplo compatible: añadir una opción sin romper llamadas

Versión `1.3.0`:

~~~ts
export type ListFindingsOptions = {
  readonly siteId?: string;
};

export interface SiteOpsClient {
  listFindings(
    options?: ListFindingsOptions,
  ): Promise<readonly FindingResponse[]>;
}
~~~

Versión `1.4.0`:

~~~ts
export type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved";

export type ListFindingsOptions = {
  readonly siteId?: string;
  readonly status?: FindingStatus;
};

export interface SiteOpsClient {
  listFindings(
    options?: ListFindingsOptions,
  ): Promise<readonly FindingResponse[]>;
}
~~~

Las llamadas anteriores siguen válidas:

~~~ts
await client.listFindings();
await client.listFindings({ siteId });
~~~

Y existe una capacidad nueva:

~~~ts
await client.listFindings({ status: "open" });
~~~

Para que sea realmente compatible, el runtime también debe conservar:

- el comportamiento de `listFindings()` sin opciones;
- el significado anterior de `siteId`;
- el formato de errores existente;
- la forma documentada de la respuesta.

Una firma compatible no compensa un cambio de comportamiento oculto.

---

## 8. Ejemplo incompatible: añadir un caso de salida

Versión `1.4.0`:

~~~ts
export type AnalysisResult =
  | {
      readonly kind: "passed";
      readonly score: number;
    }
  | {
      readonly kind: "failed";
      readonly issues: readonly string[];
    };
~~~

Versión propuesta:

~~~ts
export type AnalysisResult =
  | {
      readonly kind: "passed";
      readonly score: number;
    }
  | {
      readonly kind: "failed";
      readonly issues: readonly string[];
    }
  | {
      readonly kind: "skipped";
      readonly reason: string;
    };
~~~

El caso `"skipped"` parece aditivo, pero rompe consumidores exhaustivos:

~~~ts
function renderResult(result: AnalysisResult): string {
  switch (result.kind) {
    case "passed":
      return "Score: " + String(result.score);
    case "failed":
      return result.issues.join(", ");
    default:
      return assertNever(result);
  }
}
~~~

Opciones de diseño:

1. publicar `2.0.0`;
2. introducir una función nueva que devuelva otro contrato;
3. añadir antes una capacidad de negociación;
4. documentar y migrar consumidores coordinadamente;
5. evitar producir el nuevo caso hasta que los consumidores estén preparados.

En un monorepo puedes actualizar todo en un pull request, pero eso no convierte el cambio en compatible para consumidores externos o despliegues desacoplados.

---

## 9. La validación runtime también forma parte del contrato

Los tipos desaparecen durante la ejecución. HTTP, formularios, APIs externas, archivos, variables de entorno y PostgreSQL entregan datos reales, no interfaces TypeScript.

Contrato inicial:

~~~ts
import { z } from "zod";

export const CreateFindingInputSchema = z.object({
  siteId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
});

export type CreateFindingInput =
  z.infer<typeof CreateFindingInputSchema>;
~~~

Cambio compatible de entrada:

~~~ts
export const CreateFindingInputSchema = z.object({
  siteId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
});
~~~

Los payloads válidos anteriores continúan siendo válidos. Si `description` es realmente opcional y no cambia el significado previo, normalmente corresponde a `minor`.

Cambio incompatible:

~~~ts
export const CreateFindingInputSchema = z.object({
  siteId: z.string().uuid(),
  title: z.string().trim().min(20).max(160),
});
~~~

Antes se aceptaba un título de 5 caracteres; ahora no. Aunque el tipo inferido siga mostrando `title: string`, el contrato runtime se hizo más estricto. Esto puede exigir `major`.

Conclusión:

> Comparar solo `.d.ts` no detecta todas las rupturas; también debes comparar reglas ejecutables.

---

## 10. Evolución explícita de payloads con versiones

Cuando dos versiones deben coexistir, puedes versionar el payload y adaptarlo a un modelo interno común.

~~~ts
import { z } from "zod";

const FindingV1Schema = z.object({
  apiVersion: z.literal("1"),
  id: z.string().uuid(),
  title: z.string().min(1),
  status: z.enum(["open", "in_progress", "resolved"]),
});

const FindingV2Schema = z.object({
  apiVersion: z.literal("2"),
  id: z.string().uuid(),
  title: z.string().min(1),
  state: z.enum(["pending", "working", "closed"]),
  priority: z.enum(["low", "medium", "high"]),
});

const VersionedFindingSchema = z.discriminatedUnion("apiVersion", [
  FindingV1Schema,
  FindingV2Schema,
]);

type Finding = {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "in_progress" | "resolved";
  readonly priority: "low" | "medium" | "high";
};

export function parseFindingPayload(payload: unknown): Finding {
  const parsed = VersionedFindingSchema.parse(payload);

  if (parsed.apiVersion === "1") {
    return {
      id: parsed.id,
      title: parsed.title,
      status: parsed.status,
      priority: "medium",
    };
  }

  const statusByState = {
    pending: "open",
    working: "in_progress",
    closed: "resolved",
  } as const satisfies Record<
    typeof parsed.state,
    Finding["status"]
  >;

  return {
    id: parsed.id,
    title: parsed.title,
    status: statusByState[parsed.state],
    priority: parsed.priority,
  };
}
~~~

Este patrón separa:

- **wire contract:** la forma recibida por HTTP;
- **validación runtime:** comprueba qué versión llegó;
- **adapter:** transforma versiones externas;
- **modelo interno:** permanece coherente para Service o UI.

No necesitas versionar cada payload. Úsalo cuando de verdad exista convivencia, despliegue gradual o consumidores que no pueden migrar al mismo tiempo.

---

## 11. Deprecar antes de eliminar

Supón que el SDK expone una función con un nombre poco claro:

~~~ts
export function makeClient(
  baseUrl: string,
  fetch: typeof globalThis.fetch,
): SiteOpsClient {
  // Implementación omitida.
  throw new Error("Not implemented");
}
~~~

Puedes introducir una API mejor sin eliminar inmediatamente la anterior:

~~~ts
export type CreateSiteOpsClientOptions = {
  readonly baseUrl: string;
  readonly fetch: typeof globalThis.fetch;
};

export function createSiteOpsClient(
  options: CreateSiteOpsClientOptions,
): SiteOpsClient {
  // Implementación real compartida.
  throw new Error("Not implemented");
}

/**
 * @deprecated Usa createSiteOpsClient({ baseUrl, fetch }).
 */
export function makeClient(
  baseUrl: string,
  fetch: typeof globalThis.fetch,
): SiteOpsClient {
  return createSiteOpsClient({ baseUrl, fetch });
}
~~~

Secuencia segura:

1. `1.5.0`: añade `createSiteOpsClient` y marca `makeClient` como obsoleta;
2. documentación y ejemplos migran al nombre nuevo;
3. consumidores reciben advertencias del editor;
4. `2.0.0`: elimina `makeClient`;
5. la guía de migración muestra el reemplazo exacto.

SemVer 2.0.0 indica que marcar funcionalidad pública como obsoleta requiere al menos un incremento `minor`.

Deprecar no significa dejar una API rota. Mientras siga publicada, debe conservar su contrato documentado.

---

## 12. Rangos de versión en `package.json`

Un consumidor puede declarar:

~~~json
{
  "dependencies": {
    "@siteops/audit-contracts": "^1.4.2",
    "@siteops/sdk": "~1.8.3",
    "@siteops/config-analyzer": "2.1.0"
  }
}
~~~

Interpretación simplificada:

| Rango | Acepta | No acepta |
| --- | --- | --- |
| `^1.4.2` | `>=1.4.2 <2.0.0` | `2.0.0` |
| `~1.8.3` | `>=1.8.3 <1.9.0` | `1.9.0` |
| `2.1.0` | solo `2.1.0` | cualquier otra |
| `^0.2.3` | `>=0.2.3 <0.3.0` | `0.3.0` |
| `^0.0.4` | `>=0.0.4 <0.0.5` | `0.0.5` |

### Caret `^`

Permite cambios que no modifican el primer número distinto de cero:

- `^1.4.2` permite minor y patch dentro de la major 1;
- `^0.2.3` permite patch dentro de `0.2`;
- `^0.0.4` queda limitado a esa versión.

### Tilde `~`

Con major, minor y patch presentes, permite cambios patch dentro de la misma minor:

~~~text
~1.8.3 → >=1.8.3 <1.9.0
~~~

### Versión exacta

Reduce cambios automáticos, pero también obliga a actualizar manualmente para recibir correcciones.

### El lockfile

El rango declara qué versiones serían aceptables. `package-lock.json` registra la resolución concreta instalada. Ambos cumplen funciones diferentes:

- `package.json` expresa política de compatibilidad;
- `package-lock.json` ayuda a reproducir la instalación resuelta.

No uses un rango amplio para compensar una clasificación SemVer descuidada. Si publicas una ruptura como `minor`, un consumidor con caret puede recibirla legítimamente.

---

## 13. Prereleases y canales de adopción

Una versión previa puede ser:

~~~text
2.0.0-beta.1
2.0.0-rc.1
~~~

Sirve para que consumidores voluntarios prueben una API antes de la versión estable. Una estrategia conceptual:

~~~bash
npm version prerelease --preid=beta
npm publish --tag next
~~~

`latest` suele representar la versión estable que instala `npm install paquete` sin versión explícita. Un tag como `next` puede señalar una versión futura. El nombre del tag no cambia la compatibilidad; solo ofrece otro canal de selección.

En esta lección no publicarás ningún paquete real. Lo importante es comprender que:

- una prerelease no sustituye las pruebas;
- no debes mover una ruptura silenciosamente a `latest`;
- la versión estable final sigue necesitando una guía de migración;
- una versión ya publicada no se modifica: se publica otra versión.

---

## 14. La versión del paquete no es la versión de todo el sistema

SiteOps Tracker puede tener varias líneas de evolución:

| Elemento | Qué versiona | Ejemplo |
| --- | --- | --- |
| Paquete npm | API pública del paquete | `@siteops/sdk@2.0.0` |
| API HTTP | Contrato disponible por red | `/api/v2/findings` |
| Payload | Forma concreta del mensaje | `apiVersion: "2"` |
| Base de datos | Estructura persistente | migración `20261002_add_priority` |
| Aplicación | Artefacto desplegado | release `2026.10.2` |
| Imagen Docker | Build ejecutable | tag inmutable por commit |

No asumas estas equivalencias:

~~~text
paquete 2.0.0 ≠ endpoint /v2 obligatorio
endpoint /v2 ≠ migración PostgreSQL número 2
imagen Docker v2 ≠ contrato npm 2.0.0
~~~

Puedes incrementar el SDK a `2.0.0` porque su constructor cambió mientras sigue consumiendo `/api/v1`. También puedes publicar `/api/v2` y mantener el paquete en una versión minor si el SDK añade métodos compatibles para elegirla.

Cada sistema de versiones debe tener un propósito explícito.

---

## 15. Estrategia segura de migración en un monorepo

Un monorepo facilita coordinar cambios, pero no elimina despliegues independientes ni consumidores externos.

Para una evolución incompatible:

### Paso 1 — Congela el contrato anterior

Conserva fixtures y pruebas que representen la versión publicada.

~~~ts
const findingV1Fixture: unknown = {
  apiVersion: "1",
  id: "148cb5cf-d5b9-4c3a-b3c5-b60bdd86825f",
  title: "Replace unsupported device",
  status: "open",
};
~~~

### Paso 2 — Añade el contrato nuevo

No sobrescribas de inmediato el único schema si ambas versiones deben coexistir.

~~~ts
export {
  FindingV1Schema,
  FindingV2Schema,
  VersionedFindingSchema,
} from "./finding-schemas.js";
~~~

### Paso 3 — Adapta en la frontera

Convierte v1 y v2 a un modelo interno común después de validar `unknown`.

### Paso 4 — Migra consumidores

- React usa el adapter;
- el SDK reconoce ambas versiones;
- la API puede responder según una estrategia documentada;
- los tests cubren versiones antiguas y nuevas.

### Paso 5 — Observa el uso

Si existe telemetría permitida, registra qué versión se consume sin incluir datos sensibles.

### Paso 6 — Depreca

Anuncia fecha o versión de retiro cuando sea posible.

### Paso 7 — Elimina en una versión mayor

Retira v1 únicamente cuando la política acordada lo permita.

Una migración segura convierte una ruptura instantánea en una transición controlada.

---

## 16. Verificación antes de liberar

Una revisión profesional no termina en “mi paquete compila”.

### 16.1 Build limpio

~~~bash
npm run clean
npm run build
~~~

Comprueba JavaScript y declaraciones emitidas.

### 16.2 Type check de consumidores

Construye los workspaces que dependen del paquete:

~~~bash
npm run check:types --workspace=@siteops/web
npm run check:types --workspace=@siteops/api
npm run check:types --workspace=@siteops/sdk
~~~

### 16.3 Pruebas runtime

Ejecuta:

- pruebas de schemas con payloads válidos e inválidos;
- pruebas del adapter v1 → dominio;
- pruebas del adapter v2 → dominio;
- integración del SDK con respuestas simuladas;
- integración de la API con el contrato real.

### 16.4 Inspección del paquete

~~~bash
npm pack --dry-run --workspace=@siteops/audit-contracts
~~~

Verifica que `exports`, `.d.ts`, JavaScript y schemas publicados correspondan.

### 16.5 Consumidor aislado

Crea un proyecto temporal, instala el tarball y compila código de uso real. Esto descubre dependencias fantasma, archivos faltantes y deep imports accidentales.

### 16.6 Comparación de API pública

Revisa el diff de:

- `dist/**/*.d.ts`;
- `package.json#exports`;
- schemas y reglas runtime;
- documentación de errores;
- requisitos de plataforma.

El diff de declaraciones es evidencia importante, no la única evidencia.

---

## 17. Prueba de compatibilidad estática mínima

Puedes conservar ejemplos de consumidor que TypeScript deba aceptar.

~~~ts
import {
  createSiteOpsClient,
  type ListFindingsOptions,
  type SiteOpsClient,
} from "@siteops/sdk";

declare const fetchLike: typeof globalThis.fetch;

const client: SiteOpsClient = createSiteOpsClient({
  baseUrl: "https://api.example.invalid",
  fetch: fetchLike,
});

const previousOptions: ListFindingsOptions = {
  siteId: "68aef9ca-fde6-4171-bf6f-18d97b3264f5",
};

void client.listFindings(previousOptions);
~~~

También puedes documentar usos que deben ser rechazados:

~~~ts
import type { FindingStatus } from "@siteops/audit-contracts";

// Este valor no forma parte del contrato actual.
// @ts-expect-error — estado inexistente
const invalidStatus: FindingStatus = "archived";

void invalidStatus;
~~~

`@ts-expect-error` es útil solo cuando el comentario explica el error esperado. Si la línea deja de producir error, TypeScript avisa que la directiva ya no es necesaria.

Estas comprobaciones no validan JSON. Para runtime todavía necesitas ejecutar schemas y pruebas.

---

## 18. Cuándo utilizar versionado semántico

Úsalo cuando exista una API consumida por otra unidad con identidad propia:

- un paquete publicado en un registro;
- un paquete interno de un monorepo;
- un SDK tipado;
- una librería de componentes;
- un analizador de configuraciones reutilizable;
- contratos y schemas compartidos;
- una CLI con opciones documentadas;
- un plugin o integración externa.

También es valioso en paquetes privados. “Interno” no significa “sin consumidores”; solo cambia quién depende del contrato.

En SiteOps Tracker es especialmente relevante para:

- `@siteops/audit-contracts`;
- `@siteops/sdk`;
- `@siteops/config-analyzer`;
- cualquier paquete que exponga tipos, schemas o funciones a varios workspaces.

---

## 19. Cuándo evitar un sistema de versiones separado

No necesitas versionar independientemente cada carpeta.

Evita crear un paquete versionado cuando:

- el código es un detalle interno de una sola aplicación;
- no existe una API pública estable;
- todos los cambios siempre se despliegan como una unidad indivisible;
- la separación solo crea trabajo administrativo;
- un módulo local expresa mejor la responsabilidad;
- planeas reutilizar modelos de persistencia directamente en React.

Incluso sin paquete separado, los contratos HTTP y las migraciones de datos siguen necesitando una estrategia de compatibilidad. “No usar SemVer aquí” no significa “cambiar sin analizar”.

---

## 20. Errores comunes y su causa

### Error 1 — Clasificar por cantidad de código

**Problema:** una línea puede eliminar un export utilizado por cientos de consumidores.  
**Corrección:** analiza el impacto sobre la API pública.

### Error 2 — Creer que todo cambio aditivo es minor

**Problema:** añadir una variante de salida rompe `switch` exhaustivos.  
**Corrección:** distingue valores aceptados de valores producidos.

### Error 3 — Revisar solo interfaces

**Problema:** un schema más estricto puede romper runtime sin cambiar el tipo inferido.  
**Corrección:** compara tipos, comportamiento y validación ejecutable.

### Error 4 — Compartir un tipo para todas las capas

**Problema:** una propiedad nueva puede ser compatible para lectores e incompatible para productores.  
**Corrección:** separa input, response, dominio y fila de persistencia.

### Error 5 — Publicar ruptura como minor porque el monorepo compila

**Problema:** consumidores externos o despliegues anteriores no están en el build local.  
**Corrección:** conserva una política SemVer basada en la API pública.

### Error 6 — Cambiar una versión ya publicada

**Problema:** la misma versión deja de identificar contenido inmutable.  
**Corrección:** libera una versión nueva.

### Error 7 — Usar `as` para “migrar” datos

~~~ts
const finding = payload as FindingResponse;
~~~

**Problema:** no transforma ni valida el valor.  
**Corrección:** recibe `unknown`, valida y adapta.

### Error 8 — Eliminar una API sin deprecación

**Problema:** el consumidor no recibe una ruta gradual de cambio.  
**Corrección:** añade reemplazo, marca `@deprecated` y retira en major.

### Error 9 — Confundir caret con “cualquier versión”

**Problema:** `^1.4.2` no acepta `2.0.0` y `^0.2.3` no acepta `0.3.0`.  
**Corrección:** comprende y documenta el rango real.

### Error 10 — Suponer que el lockfile reemplaza SemVer

**Problema:** una actualización futura o un consumidor nuevo todavía usa el rango.  
**Corrección:** publica versiones honestas y conserva el lockfile reproducible.

### Error 11 — Acoplar versión npm, HTTP y PostgreSQL

**Problema:** una cifra deja de explicar qué está cambiando.  
**Corrección:** versiona cada contrato por su propósito.

### Error 12 — Exponer tipos de filas como contrato HTTP

**Problema:** una migración de base de datos se convierte accidentalmente en ruptura del frontend.  
**Corrección:** transforma la fila en Repository y publica un DTO deliberado.

---

## 21. Relación explícita con la arquitectura Full Stack

~~~text
React
  ↓ consume contratos y tolera evolución documentada
HTTP
  ↓ transporta JSON sin tipos TypeScript
Node / Express
  ↓ recibe una versión concreta del request
Router
  ↓ selecciona endpoint y estrategia de versión
Controller
  ↓ adapta request y response
Runtime Validation
  ↓ valida unknown contra el schema correspondiente
Service
  ↓ trabaja con un modelo interno estable
Repository
  ↓ adapta dominio y persistencia
PostgreSQL
  ↓ evoluciona mediante migraciones compatibles
Testing + Docker + CI/CD + Cloud
  ↓ comprueban y despliegan versiones reproducibles
~~~

### React

Debe depender de contratos HTTP o del SDK, no de filas PostgreSQL. Al recibir una respuesta, comienza con `unknown` y valida antes de renderizarla.

### HTTP

No transporta tipos TypeScript. La compatibilidad real se mide con JSON, status codes, headers y comportamiento.

### Node, Router y Controller

El Router puede seleccionar `/api/v1` o `/api/v2`. El Controller adapta el protocolo; no debe filtrar directamente modelos de persistencia.

### Runtime Validation

Selecciona el schema correcto, devuelve errores controlados y produce un valor confiable. Cambiar sus reglas cambia el contrato ejecutable.

### Service

Trabaja con un modelo interno estable. Idealmente no necesita conocer todas las versiones HTTP; los adapters convierten antes.

### Repository

Traduce filas a dominio. Una columna nueva, renombrada o nullable no debe aparecer automáticamente en la API pública.

### PostgreSQL

Sus cambios requieren migraciones. Para despliegue gradual puede ser necesario “expandir y contraer”: añadir primero una estructura compatible, migrar datos y retirar después.

### Testing

Las pruebas de contrato deben conservar ejemplos anteriores, comprobar schemas nuevos y compilar consumidores representativos.

### Docker

La imagen debe contener versiones coherentes de API y paquetes internos. Un tag mutable puede dificultar reproducir qué contrato estaba desplegado.

### CI/CD y Cloud

CI debe bloquear una liberación incompatible mal clasificada cuando sea posible. Cloud ejecuta JavaScript y datos reales; ninguna interface TypeScript existe allí.

---

## 22. Ejercicio — Clasificar cambios del paquete de contratos

### Escenario

La versión actual de `@siteops/audit-contracts` es `1.6.2`:

~~~ts
export type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved";

export type CreateFindingInput = {
  readonly siteId: string;
  readonly title: string;
};

export type FindingResponse = {
  readonly id: string;
  readonly siteId: string;
  readonly title: string;
  readonly status: FindingStatus;
};

export declare function parseFinding(
  payload: unknown,
): FindingResponse;
~~~

### Cambios propuestos

1. Corregir un error interno que recortaba la última letra del título.
2. Añadir `description?: string` a `CreateFindingInput`.
3. Hacer `description` obligatoria.
4. Añadir `"archived"` a un status que la API puede devolver.
5. Añadir una función nueva `isResolved(finding)`.
6. Renombrar `parseFinding` a `decodeFinding` y eliminar la anterior.
7. Mantener `parseFinding` como wrapper obsoleto.
8. Cambiar el schema para exigir títulos de al menos 20 caracteres.
9. Añadir `priority` a la respuesta y garantizar siempre su presencia.
10. Añadir un subpath `@siteops/audit-contracts/testing`.

### Tu tarea

Para cada cambio:

1. clasifícalo como `patch`, `minor` o `major`;
2. explica qué consumidor podría romperse;
3. separa impacto estático y runtime;
4. indica si necesita deprecación;
5. propone una alternativa compatible cuando sea posible;
6. calcula la próxima versión a partir de `1.6.2`;
7. identifica qué cambios no deberían agruparse sin una decisión explícita.

### Restricciones

- No uses el número de líneas como criterio.
- No supongas que TypeScript valida HTTP.
- No uses assertions para aceptar payloads nuevos.
- No trates todas las adiciones como `minor`.
- No muestres todavía una solución completa.

### Pistas

1. Pregunta si el paquete acepta el valor o lo produce.
2. Un `switch` exhaustivo revela variantes de salida incompatibles.
3. Una propiedad requerida rompe a quien construye el objeto.
4. La validación mínima del título existe en runtime.
5. Deprecar y eliminar son momentos distintos.
6. Si hay al menos un cambio major, la liberación completa será major.

### Entrega esperada

- tabla de diez filas;
- justificación breve por cambio;
- versión propuesta;
- plan de migración en dos etapas;
- lista de pruebas necesarias.

---

## 23. Reto Full Stack — Migración compatible de responses v1 a v2

### Escenario

SiteOps Tracker necesita reemplazar:

~~~json
{
  "apiVersion": "1",
  "status": "in_progress"
}
~~~

por:

~~~json
{
  "apiVersion": "2",
  "state": "working",
  "priority": "high"
}
~~~

React y la API no se desplegarán necesariamente al mismo tiempo.

### Tu reto

Diseña, sin implementar toda la aplicación:

1. `FindingResponseV1Schema`;
2. `FindingResponseV2Schema`;
3. una unión discriminada por `apiVersion`;
4. un modelo interno común;
5. un adapter v1 → modelo interno;
6. un adapter v2 → modelo interno;
7. el comportamiento del SDK ante una versión desconocida;
8. una estrategia para que la API produzca v1 y v2 temporalmente;
9. un error tipado para payload inválido;
10. pruebas unitarias de ambos adapters;
11. una prueba de integración SDK–API;
12. la secuencia de deprecación y retiro;
13. qué cambio corresponde al paquete npm;
14. qué cambio corresponde a la API HTTP;
15. cómo evitar que una columna PostgreSQL se convierta en el response público.

### Condiciones

- Toda respuesta de `response.json()` comienza como `unknown`.
- Debes validar antes de adaptar.
- No uses `any`.
- No uses `as Finding` para saltar la validación.
- El Service recibe un modelo estable, no un payload versionado.
- React no importa Controllers, Repositories ni tipos de fila.
- La solución debe permitir un despliegue gradual.

### Pregunta de diseño

¿Publicarías inmediatamente `@siteops/sdk@2.0.0` o podrías añadir compatibilidad con ambos payloads en una versión minor? Justifica la respuesta desde la API pública del SDK, no desde la implementación interna.

---

## 24. Preguntas de comprensión

Responde sin consultar y después verifica tus ideas.

1. ¿Qué requisito previo establece SemVer sobre la API pública?
2. ¿Qué comunica cada número de `MAJOR.MINOR.PATCH`?
3. ¿Por qué una corrección puede requerir major?
4. ¿Qué significa que `0.y.z` sea desarrollo inicial?
5. ¿Qué componentes forman la API pública de un paquete TypeScript?
6. ¿Por qué `.d.ts` no describe toda la compatibilidad?
7. ¿Qué diferencia existe entre compatibilidad estática y runtime?
8. ¿Por qué añadir una opción de entrada opcional suele ser compatible?
9. ¿Por qué añadir una variante de salida puede ser incompatible?
10. ¿Qué ventaja ofrece separar input y response?
11. ¿Qué cambio produce hacer más estricto un schema?
12. ¿Por qué `as Finding` no migra un payload?
13. ¿Qué valor aporta `@deprecated`?
14. ¿Cuándo se elimina una API obsoleta?
15. ¿Qué acepta `^1.4.2`?
16. ¿Qué acepta `^0.2.3`?
17. ¿Qué diferencia hay entre rango y lockfile?
18. ¿Para qué sirve una prerelease?
19. ¿Por qué versión npm y versión HTTP no son equivalentes?
20. ¿Qué debe ocurrir antes de que el Service reciba un payload versionado?
21. ¿Por qué el Repository protege al contrato HTTP de migraciones PostgreSQL?
22. ¿Qué descubre un consumidor aislado que puede ocultar el monorepo?

---

## 25. Relevancia para entrevistas técnicas

### Pregunta: ¿Qué es SemVer?

**Respuesta esperada:** es una convención `MAJOR.MINOR.PATCH` basada en una API pública definida. Patch corrige de manera compatible, minor añade funcionalidad compatible y major introduce incompatibilidades.

### Pregunta: ¿Añadir un valor a una unión siempre es compatible?

**Respuesta esperada:** no. Si la unión representa entradas aceptadas, ampliar puede ser compatible; si representa salidas producidas, un consumidor exhaustivo debe manejar el caso nuevo y puede romperse.

### Pregunta: ¿Cómo evolucionas un contrato HTTP?

**Respuesta esperada:** trato el payload como `unknown`, valido versiones explícitas, adapto cada versión a un modelo interno, mantengo una ventana de compatibilidad, migro consumidores y retiro la versión anterior mediante una política documentada.

### Pregunta: ¿Por qué comparar `.d.ts` no basta?

**Respuesta esperada:** porque también pueden cambiar comportamiento runtime, schemas, errores, exports, dependencias, requisitos de plataforma y payloads reales.

### Pregunta: ¿Qué diferencia hay entre deprecar y eliminar?

**Respuesta esperada:** deprecar conserva la API y orienta hacia un reemplazo, normalmente en una minor; eliminar obliga a cambiar consumidores y requiere una major.

### Pregunta: ¿Qué significa `^0.2.3`?

**Respuesta esperada:** con las reglas de rangos usadas por npm, acepta versiones desde `0.2.3` y menores que `0.3.0`.

### Respuesta breve de 30 segundos

> Uso SemVer después de definir la API pública real: exports, declaraciones, comportamiento y schemas runtime. Clasifico el cambio desde la perspectiva del consumidor. Una opción de entrada opcional puede ser minor, pero una variante nueva de salida puede ser major porque rompe manejo exhaustivo. Antes de liberar, construyo el paquete, comparo declaraciones y schemas, compilo consumidores y pruebo el tarball de forma aislada.

---

## 26. Checklist profesional

Antes de liberar una versión, comprueba:

- [ ] La API pública está definida.
- [ ] Los exports públicos están inventariados.
- [ ] Se revisó el diff de `.d.ts`.
- [ ] Se revisó el diff de `package.json#exports`.
- [ ] Se revisaron schemas y reglas runtime.
- [ ] Se identificaron entradas y salidas por separado.
- [ ] Las uniones producidas se analizaron como posibles rupturas.
- [ ] Las propiedades nuevas se evaluaron según quién construye el objeto.
- [ ] Los códigos y formatos de error permanecen compatibles o están versionados.
- [ ] No se confundió una assertion con validación.
- [ ] Los payloads externos comienzan como `unknown`.
- [ ] Los adapters convierten versiones externas a un modelo interno.
- [ ] La API obsoleta conserva comportamiento mientras siga publicada.
- [ ] La eliminación de API se reservó para una major.
- [ ] El rango de dependencias expresa la política deseada.
- [ ] El lockfile está actualizado y versionado.
- [ ] El build limpio finaliza correctamente.
- [ ] Los consumidores directos pasan type check.
- [ ] Las pruebas runtime cubren payloads previos y nuevos.
- [ ] El tarball contiene JavaScript y declaraciones correctas.
- [ ] Un consumidor aislado puede instalarlo.
- [ ] La versión de paquete no se confundió con API HTTP o migración SQL.
- [ ] La guía de migración explica cambios incompatibles.
- [ ] Una versión publicada no se sobrescribe.
- [ ] El changelog describe impacto para el consumidor.

---

## 27. Resumen

- SemVer necesita una API pública definida.
- `PATCH` corrige de manera compatible.
- `MINOR` añade funcionalidad compatible.
- `MAJOR` comunica cambios incompatibles.
- La clasificación depende del consumidor, no del tamaño del diff.
- En `0.y.z` la API se considera inestable, pero conviene documentar una política.
- Un contrato TypeScript incluye declaraciones, exports, comportamiento y validación runtime.
- TypeScript utiliza compatibilidad estructural.
- La dirección del dato importa: aceptar más no equivale a producir más.
- Añadir una opción de entrada opcional suele ser compatible.
- Añadir una variante de salida puede romper consumidores exhaustivos.
- Separar inputs, responses, dominio y filas facilita evolucionar cada frontera.
- Los tipos desaparecen durante la ejecución.
- HTTP, formularios, APIs externas, archivos, variables de entorno y PostgreSQL requieren validación real.
- Un schema más estricto puede romper runtime aunque el tipo inferido parezca igual.
- `@deprecated` permite una transición antes de eliminar en una major.
- `^1.4.2` acepta cambios compatibles dentro de major 1.
- `^0.2.3` queda por debajo de `0.3.0`.
- El rango y el lockfile cumplen funciones distintas.
- La versión npm, la versión HTTP y las migraciones PostgreSQL no son la misma cosa.
- Un adapter permite que varias versiones externas alimenten un modelo interno estable.
- Build, pruebas, comparación de API y consumidor aislado reducen liberaciones accidentales.

---

## Referencias oficiales consultadas

- Semantic Versioning 2.0.0: <https://semver.org/>
- Semantic Versioning 2.0.0 en español: <https://semver.org/lang/es/>
- npm Docs — About semantic versioning: <https://docs.npmjs.com/about-semantic-versioning/>
- npm Docs — `package.json`: <https://docs.npmjs.com/cli/configuring-npm/package-json/>
- npm Docs — `npm version`: <https://docs.npmjs.com/cli/v12/commands/npm-version/>
- npm Docs — Adding dist-tags: <https://docs.npmjs.com/adding-dist-tags-to-packages/>
- npm/node-semver — Range grammar and caret ranges: <https://github.com/npm/node-semver>
- TypeScript Handbook — Type Compatibility: <https://www.typescriptlang.org/docs/handbook/type-compatibility>
- TypeScript Handbook — Modules `.d.ts`: <https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts.html>
- Zod — Defining schemas: <https://zod.dev/api>

Consultadas el **2 de octubre de 2026**.

---

# Próxima lección

**Lección 31 — Pruebas de tipos y compatibilidad de la API pública.**
