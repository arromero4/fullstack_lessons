# Lección 26 — Declaraciones de tipos: archivos `.d.ts`, `@types`, módulos ambientales y ampliación segura de librerías

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación totalmente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, reglas y datos de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos  

---

## Introducción

En la lección anterior configuraste `tsconfig.json` para que TypeScript comprenda el entorno real de cada proyecto: navegador, Node.js, tests o paquete compartido. También viste que la opción `declaration` puede producir archivos `.d.ts` para un SDK.

Ahora debes responder una pregunta distinta:

> ¿Cómo puede TypeScript comprobar una librería JavaScript, un paquete externo, un asset procesado por el bundler o una API ampliada por un plugin cuando su implementación no contiene tipos TypeScript visibles?

La respuesta son las **declaraciones de tipos**.

Un archivo `.d.ts` describe la forma pública de valores que existen en otro lugar. Puede describir:

- un paquete JavaScript;
- una API global proporcionada por el navegador o por un script;
- un módulo especial procesado por Vite u otro bundler;
- la salida pública de un SDK escrito en TypeScript;
- miembros añadidos por un plugin a una librería existente.

Sin embargo, una declaración también puede crear una falsa sensación de seguridad. Si declaras que una función existe, TypeScript te creerá aunque el JavaScript real no la implemente. Si declaras que una respuesta tiene forma `Asset[]`, el compilador no inspeccionará la respuesta HTTP, el archivo ni la fila de PostgreSQL.

La regla central de esta lección es:

> Un archivo `.d.ts` describe el runtime; no lo crea, no lo modifica y no lo valida.

---

## Objetivo

Al terminar esta lección podrás:

1. explicar qué problema resuelve un archivo `.d.ts`;
2. distinguir implementación runtime de contrato estático;
3. reconocer declaraciones incluidas en una librería y paquetes `@types`;
4. escribir una declaración local para un módulo JavaScript sin tipos;
5. usar `declare module` para módulos ambientales específicos y patrones de assets;
6. comprender cuándo `declare module` crea un módulo y cuándo amplía uno existente;
7. usar `declare global` sin contaminar innecesariamente el alcance global;
8. aplicar declaration merging y module augmentation de forma segura;
9. evitar que una ampliación prometa métodos inexistentes en runtime;
10. generar `.d.ts` desde un SDK TypeScript en vez de mantenerlos manualmente;
11. probar contratos de tipos con `tsc` y `@ts-expect-error`;
12. explicar por qué HTTP, formularios, APIs externas, archivos, variables de entorno y PostgreSQL siguen necesitando validación runtime.

---

## 1. El problema que resuelven las declaraciones de tipos

Imagina que SiteOps Tracker integra un paquete JavaScript ficticio que analiza archivos heredados:

```ts
import { parseLegacyConfig } from "siteops-legacy-parser";

const result = parseLegacyConfig("hostname=core-01");
```

En runtime, Node.js puede encontrar el paquete y ejecutar su JavaScript. Pero si el paquete no contiene tipos, TypeScript no sabe:

- qué argumentos acepta `parseLegacyConfig`;
- qué devuelve;
- si la función es síncrona o asíncrona;
- qué nombres exporta el módulo;
- qué opciones son obligatorias;
- qué errores forman parte del contrato documentado.

Una declaración puede describir esa superficie:

```ts
declare module "siteops-legacy-parser" {
  export interface ParseOptions {
    readonly preserveComments?: boolean;
  }

  export function parseLegacyConfig(
    source: string,
    options?: ParseOptions,
  ): unknown;
}
```

Ahora TypeScript conoce el uso permitido:

```ts
import { parseLegacyConfig } from "siteops-legacy-parser";

const result: unknown = parseLegacyConfig("hostname=core-01", {
  preserveComments: true,
});
```

Observa que el retorno es `unknown`. La librería analiza contenido externo, así que la declaración no debe fingir que todo archivo produce automáticamente un objeto de dominio válido.

---

## 2. Dos piezas distintas: implementación y declaración

Una integración tipada puede tener dos archivos conceptualmente paralelos:

```text
index.js     → comportamiento que JavaScript ejecuta
index.d.ts   → contrato que TypeScript comprueba
```

Ejemplo de implementación JavaScript:

```js
// index.js
export function normalizeAssetTag(value) {
  return value.trim().toUpperCase();
}
```

Declaración correspondiente:

```ts
// index.d.ts
export declare function normalizeAssetTag(value: string): string;
```

Uso TypeScript:

```ts
import { normalizeAssetTag } from "siteops-text-utils";

const tag = normalizeAssetTag(" mx-cdmx-001 ");
// tag: string
```

El archivo `.d.ts` no incluye el cuerpo de la función porque no implementa nada. Solo declara que el valor existe y cuál es su contrato.

Si el JavaScript real devolviera un número, TypeScript no lo descubriría por sí solo:

```js
// Implementación defectuosa que contradice index.d.ts
export function normalizeAssetTag(value) {
  return value.length;
}
```

El consumidor compilaría creyendo que recibe `string`, pero en runtime recibiría `number`.

> La precisión de una declaración depende de que refleje fielmente la implementación real.

---

## 3. Qué es un archivo `.d.ts`

Un `.d.ts` es un **archivo de declaraciones**. Contiene información para el sistema de tipos y no produce un archivo JavaScript equivalente.

Puede contener, entre otras construcciones:

```ts
export interface SiteSummary {
  readonly id: string;
  readonly name: string;
}

export type SiteStatus = "active" | "maintenance" | "retired";

export declare const SDK_VERSION: string;

export declare function getSite(id: string): Promise<SiteSummary | null>;

export declare class SiteOpsClient {
  constructor(options: { readonly baseUrl: string });

  getSite(id: string): Promise<SiteSummary | null>;
}
```

No debe contener implementaciones:

```ts
// Incorrecto dentro de un .d.ts: hay un cuerpo ejecutable.
export function normalize(value: string): string {
  return value.trim();
}
```

La forma declarativa correcta es:

```ts
export declare function normalize(value: string): string;
```

En interfaces y aliases no necesitas escribir `declare`, porque esas construcciones ya existen únicamente en el sistema de tipos:

```ts
export interface Finding {
  readonly id: string;
  readonly title: string;
}

export type Severity = "low" | "medium" | "high";
```

---

## 4. Los tipos desaparecen; los valores deben existir

Considera esta declaración:

```ts
export declare const siteOpsClient: {
  getHealth(): Promise<"ok">;
};
```

TypeScript permite escribir:

```ts
import { siteOpsClient } from "siteops-client";

const status = await siteOpsClient.getHealth();
```

Pero el runtime todavía necesita:

1. encontrar el paquete `siteops-client`;
2. cargar un módulo compatible;
3. encontrar el export `siteOpsClient`;
4. encontrar el método `getHealth`;
5. recibir un valor que cumpla el comportamiento prometido.

El `.d.ts` no realiza ninguno de esos pasos. Por eso instalar solamente un paquete `@types` tampoco instala la librería ejecutable.

```bash
npm install siteops-client
npm install --save-dev @types/siteops-client
```

Este ejemplo supone que el paquete runtime y el paquete de tipos existen por separado. Muchos paquetes modernos ya incluyen sus propias declaraciones, por lo que el segundo comando no sería necesario.

---

## 5. De dónde obtiene TypeScript las declaraciones

Cuando importas una dependencia, las declaraciones pueden proceder de varias fuentes.

### 5.1 Tipos incluidos por TypeScript

TypeScript incorpora archivos como `lib.es2022.d.ts` y `lib.dom.d.ts` para describir APIs estándar del lenguaje y, cuando se configura, APIs del navegador.

```jsonc
{
  "compilerOptions": {
    "lib": ["ES2022", "DOM"]
  }
}
```

Estas declaraciones no implementan `Promise`, `document` ni `fetch`. Describen APIs que el runtime seleccionado debe proporcionar.

### 5.2 Tipos incluidos por el propio paquete

Un paquete puede distribuir JavaScript y `.d.ts` conjuntamente:

```text
node_modules/@siteops/audit-sdk/
├── package.json
└── dist/
    ├── index.js
    └── index.d.ts
```

Su `package.json` puede señalar el contrato público:

```json
{
  "name": "@siteops/audit-sdk",
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

### 5.3 Tipos publicados en `@types`

Si una librería JavaScript no publica tipos, la comunidad puede mantenerlos en DefinitelyTyped y distribuirlos bajo el scope `@types`:

```bash
npm install --save-dev @types/example-library
```

Para un paquete con scope como `@vendor/parser`, el nombre histórico en `@types` suele adoptar la forma:

```text
@types/vendor__parser
```

No debes instalar un paquete `@types` por reflejo. Primero comprueba si la dependencia ya incluye sus propias declaraciones.

### 5.4 Declaraciones locales

Si mantienes una integración pequeña con JavaScript legado o un módulo interno ficticio sin tipos, puedes escribir una declaración local:

```text
src/
├── integrations/
│   └── legacy-parser.ts
└── types/
    └── siteops-legacy-parser.d.ts
```

La declaración debe estar incluida en el programa TypeScript:

```jsonc
{
  "include": ["src/**/*.ts", "src/**/*.d.ts"]
}
```

---

## 6. Qué es `@types` y qué no es

Un paquete `@types` contiene declaraciones para otra librería o entorno.

Ejemplo conocido:

```bash
npm install --save-dev @types/node
```

Esto permite que TypeScript conozca contratos de Node.js como `process`, `Buffer` y módulos del runtime.

No significa que `@types/node`:

- instale Node.js;
- seleccione la versión de Node usada por Docker;
- valide variables de entorno;
- añada APIs de Node al navegador;
- convierta automáticamente una aplicación en backend;
- garantice que la versión de tipos coincide con el runtime desplegado.

La configuración debe contar una historia coherente:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"]
  }
}
```

Y el runtime real debe ser compatible, por ejemplo mediante la versión fijada en una imagen Docker o en la plataforma cloud.

---

## 7. Antes de escribir tipos: investiga la forma runtime

No empieces una declaración imaginando la API. Primero observa evidencia:

1. documentación oficial del paquete;
2. exports de `package.json`;
3. ejemplos reales de importación;
4. código fuente JavaScript cuando esté disponible;
5. tests del paquete;
6. versión instalada y lockfile;
7. comportamiento ESM o CommonJS;
8. valores y errores reales.

Supón que la documentación muestra:

```js
import { createParser } from "siteops-legacy-parser";

const parser = createParser({ strict: true });
const output = parser.parse(text);
```

Una declaración razonable comienza reflejando exactamente esa forma:

```ts
declare module "siteops-legacy-parser" {
  export interface ParserOptions {
    readonly strict?: boolean;
  }

  export interface Parser {
    parse(source: string): unknown;
  }

  export function createParser(options?: ParserOptions): Parser;
}
```

No añadas sobrecargas, propiedades o excepciones que la implementación no ofrezca.

---

## 8. Módulos ambientales con `declare module`

Una declaración ambiental describe algo que existe fuera del archivo TypeScript actual.

```ts
// src/types/siteops-legacy-parser.d.ts
declare module "siteops-legacy-parser" {
  export interface ParseOptions {
    readonly allowUnknownKeys?: boolean;
  }

  export function parse(source: string, options?: ParseOptions): unknown;
}
```

Después, cualquier archivo incluido en el mismo programa puede importar el paquete:

```ts
import { parse } from "siteops-legacy-parser";

const rawResult: unknown = parse("hostname=edge-01");
```

El nombre entre comillas debe coincidir con el specifier que usa el consumidor:

```ts
import { parse } from "siteops-legacy-parser";
//                    ^^^^^^^^^^^^^^^^^^^^^^^
```

Si declaras otro nombre, TypeScript no conectará ambos contratos.

---

## 9. El atajo peligroso: declarar un módulo vacío

Este archivo elimina rápidamente un error:

```ts
declare module "siteops-legacy-parser";
```

Pero equivale, en la práctica, a renunciar a la mayor parte de la comprobación para ese módulo. Sus exports se tratan como `any`.

```ts
import parser from "siteops-legacy-parser";

parser.anything().that.does.not.exist();
```

El código puede compilar y fallar inmediatamente en runtime.

Usa una declaración vacía únicamente como transición breve y documentada. La meta debe ser reemplazarla por el contrato mínimo verdadero:

```ts
declare module "siteops-legacy-parser" {
  export function parse(source: string): unknown;
}
```

`unknown` conserva la obligación de comprobar el resultado. `any` propaga ausencia de seguridad por toda la aplicación.

---

## 10. Declaraciones co-localizadas para JavaScript propio

Si controlas un pequeño módulo JavaScript, puedes colocar la declaración junto a su implementación:

```text
src/vendor/siteops-text-utils.js
src/vendor/siteops-text-utils.d.ts
```

Implementación:

```js
// siteops-text-utils.js
export function normalizeLocationCode(value) {
  return value.trim().toUpperCase();
}
```

Declaración:

```ts
// siteops-text-utils.d.ts
export declare function normalizeLocationCode(value: string): string;
```

Consumidor:

```ts
import { normalizeLocationCode } from "./vendor/siteops-text-utils.js";

const code = normalizeLocationCode(" mx-cdmx ");
```

La declaración debe seguir la misma estructura y estrategia de módulos que la implementación. Bajo Node moderno, la extensión y el `package.json` participan en la interpretación ESM/CommonJS.

---

## 11. `.d.ts`, `.d.mts` y `.d.cts`

Las extensiones pueden comunicar el tipo de módulo:

| Declaración | Implementación asociada | Interpretación inequívoca |
| --- | --- | --- |
| `.d.ts` | normalmente `.js` | depende del contexto del paquete |
| `.d.mts` | `.mjs` | ES Module |
| `.d.cts` | `.cjs` | CommonJS |

Esto importa especialmente cuando un paquete publica entradas ESM y CommonJS. La declaración no solo describe firmas; también debe corresponder al formato de módulo que TypeScript resuelve.

Evita copiar un único `.d.ts` para dos entradas incompatibles sin probar cómo las resuelve `NodeNext`.

---

## 12. Declarar assets procesados por un bundler

Un frontend React puede importar recursos que JavaScript nativo no entiende por sí solo:

```ts
import circuitDiagramUrl from "./circuit-diagram.svg";
```

El bundler transforma ese import. TypeScript necesita un contrato que refleje la transformación:

```ts
// src/types/assets.d.ts
declare module "*.svg" {
  const url: string;
  export default url;
}
```

Para módulos CSS:

```ts
declare module "*.module.css" {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
```

Estas declaraciones solo son correctas si el toolchain realmente exporta esos valores.

Si un plugin transforma SVG en componente React, el contrato será diferente. No declares un componente solo porque deseas usarlo así; confirma el comportamiento de Vite, del plugin y de su versión instalada.

### Limitación del `Record<string, string>`

El tipo anterior permite cualquier nombre de clase:

```ts
classes["doesNotExist"];
```

Una solución más precisa es generar declaraciones con las claves reales del archivo CSS:

```ts
declare const classes: {
  readonly card: string;
  readonly title: string;
};

export default classes;
```

La precisión adicional requiere que una herramienta mantenga el `.d.ts` sincronizado con el asset.

---

## 13. Archivo script frente a archivo módulo

En TypeScript, un archivo con `import` o `export` en el nivel superior se considera módulo. Un archivo sin ellos puede actuar como script y aportar nombres al alcance global.

### Declaración global accidental

```ts
// globals.d.ts — no tiene import ni export
interface RequestContext {
  requestId: string;
}
```

`RequestContext` puede quedar disponible globalmente en todo el programa. Esto aumenta el riesgo de colisiones y dependencias invisibles.

### Declaración exportada explícitamente

```ts
// request-context.d.ts
export interface RequestContext {
  readonly requestId: string;
}
```

Ahora el consumidor debe importar el contrato:

```ts
import type { RequestContext } from "./request-context.js";
```

La segunda opción suele ser más mantenible porque hace visible la dependencia.

---

## 14. El doble significado de `declare module`

Esta es una de las partes más delicadas de la lección.

### Caso A — Crear la descripción de un módulo ambiental

En un `.d.ts` que no es módulo externo:

```ts
declare module "siteops-legacy-parser" {
  export function parse(source: string): unknown;
}
```

La declaración describe un módulo que no tenía tipos visibles.

### Caso B — Ampliar un módulo existente

En un archivo que ya es módulo por tener un `import` o `export` superior:

```ts
import type { FindingSeverity } from "../domain/finding.js";

declare module "@siteops/contracts/audit-events" {
  interface AuditEventMap {
    "finding.closed": {
      readonly findingId: string;
      readonly previousSeverity: FindingSeverity;
    };
  }
}

export {};
```

Aquí `declare module` no inventa un paquete nuevo: **amplía** las declaraciones de un módulo existente.

Regla práctica:

> Antes de usar `declare module`, determina si el archivo crea una declaración ambiental o si, por su contexto de módulo, intenta hacer module augmentation.

Confundir ambos casos puede hacer que un contrato no se encuentre o que una declaración reemplace mentalmente algo que en realidad debía combinarse.

---

## 15. Declaration merging

TypeScript puede combinar ciertas declaraciones con el mismo nombre.

```ts
interface AuditMetadata {
  readonly requestId: string;
}

interface AuditMetadata {
  readonly actorId?: string;
}

const metadata: AuditMetadata = {
  requestId: "req-001",
  actorId: "user-018",
};
```

El resultado contiene ambos miembros.

No todas las construcciones se combinan de la misma manera. Dos aliases no pueden declararse repetidamente:

```ts
type Severity = "low" | "high";

// Error: identificador duplicado.
type Severity = "medium";
```

La ampliación de módulos aprovecha el merging, especialmente con interfaces diseñadas como puntos de extensión.

---

## 16. Module augmentation con un punto de extensión seguro

Supón que el SDK de SiteOps Tracker expone un mapa de eventos:

```ts
// @siteops/contracts/audit-events.d.ts
export interface AuditEventMap {
  "audit.created": {
    readonly auditId: string;
    readonly siteId: string;
  };
}

export declare function publishEvent<Name extends keyof AuditEventMap>(
  name: Name,
  payload: AuditEventMap[Name],
): Promise<void>;
```

Un paquete de hallazgos puede ampliar el mapa:

```ts
// finding-events.d.ts
import type { FindingSeverity } from "./finding.js";

declare module "@siteops/contracts/audit-events" {
  interface AuditEventMap {
    "finding.closed": {
      readonly findingId: string;
      readonly severity: FindingSeverity;
    };
  }
}

export {};
```

Después, el contrato genérico reconoce el nuevo evento:

```ts
import { publishEvent } from "@siteops/contracts/audit-events";

await publishEvent("finding.closed", {
  findingId: "finding-104",
  severity: "high",
});
```

Esta ampliación es razonable porque:

- el runtime ya sabe publicar cualquier nombre y payload;
- solo se amplía un mapa de tipos diseñado para extensión;
- no se promete un método nuevo en un objeto runtime;
- el paquete dueño del contrato conserva una interfaz explícita.

---

## 17. Una ampliación insegura puede mentir sobre el runtime

Considera:

```ts
declare module "siteops-client" {
  interface SiteOpsClient {
    retryFailedRequests(): Promise<number>;
  }
}
```

El código ahora puede compilar:

```ts
const retried = await client.retryFailedRequests();
```

Pero si ningún plugin o implementación asignó realmente el método, el resultado será un error como:

```text
TypeError: client.retryFailedRequests is not a function
```

Para que la ampliación sea verdadera, deben existir dos piezas:

1. la ampliación estática;
2. la modificación o implementación runtime.

Ejemplo conceptual:

```ts
// Runtime: modifica realmente el prototipo.
SiteOpsClient.prototype.retryFailedRequests = async function () {
  return 0;
};
```

Modificar prototipos tiene costes de mantenimiento, orden de carga y colisiones. En aplicaciones propias suele ser más claro crear un wrapper:

```ts
interface RetryCapableClient {
  retryFailedRequests(): Promise<number>;
}

export function withRetrySupport(client: SiteOpsClient): RetryCapableClient {
  return {
    async retryFailedRequests(): Promise<number> {
      // Coordina llamadas reales del cliente.
      return 0;
    },
  };
}
```

El wrapper hace visible la construcción del nuevo comportamiento y evita depender de efectos secundarios globales.

---

## 18. Restricciones de module augmentation

Una ampliación tiene límites importantes:

- solo puede modificar declaraciones existentes;
- no debe inventar exports superiores completamente nuevos;
- el nombre del módulo se resuelve como un specifier de importación;
- no puede ampliar directamente un `default export` por nombre, porque `default` no es un nombre exportado utilizable para el merging;
- el archivo de ampliación debe formar parte del programa TypeScript;
- la ampliación no ejecuta código runtime;
- la librería debe estar instalada y ser resoluble.

Si necesitas una API nueva que la librería no diseñó para extensión, considera:

- una función helper;
- un adapter;
- un wrapper;
- composición;
- una contribución upstream;
- un fork temporal claramente administrado.

La ampliación debe representar un comportamiento real, no evitar un error del compilador.

---

## 19. `declare global` de manera explícita

A veces el runtime sí proporciona un valor global. Por ejemplo, el servidor puede insertar datos iniciales en la página antes de cargar React.

Una declaración prudente puede modelar el dato como opcional y desconocido:

```ts
// src/types/siteops-bootstrap.d.ts
export {};

declare global {
  interface Window {
    __SITEOPS_BOOTSTRAP__?: unknown;
  }
}
```

El `export {}` convierte el archivo en módulo. `declare global` indica de forma explícita qué parte se añade al alcance global.

El consumidor todavía valida:

```ts
import { z } from "zod";

const BootstrapSchema = z.object({
  apiBaseUrl: z.string().url(),
  buildId: z.string().min(1),
});

export type Bootstrap = z.infer<typeof BootstrapSchema>;

export function readBootstrap(): Bootstrap {
  return BootstrapSchema.parse(window.__SITEOPS_BOOTSTRAP__);
}
```

Por qué esta forma es honesta:

- la propiedad puede no haber sido inyectada;
- su contenido llega desde una frontera runtime;
- el global solo afirma `unknown`;
- Zod comprueba y transforma el dato real;
- el tipo `Bootstrap` se deriva del schema y desaparece al compilar;
- `BootstrapSchema` permanece como JavaScript ejecutable.

---

## 20. Antipatrón: hacer obligatorias las variables de entorno mediante merging

Puede resultar tentador escribir:

```ts
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL: string;
    PORT: `${number}`;
  }
}
```

Esto hace que el editor parezca saber que ambas variables existen. Pero el proceso puede arrancar sin ellas o con valores inválidos.

La declaración no inspecciona el entorno real. Una estrategia más segura es mantener la frontera como desconocida o potencialmente ausente y validar al inicio:

```ts
import { z } from "zod";

const EnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const environment: Environment = EnvironmentSchema.parse(process.env);
```

Después del parseo, el resto de la aplicación consume `environment`, no `process.env` directamente.

> La ampliación global no debe utilizarse para transformar una posibilidad runtime en una certeza estática ficticia.

---

## 21. Ampliación de Express: útil, pero solo después del middleware real

En una etapa posterior del backend, un middleware de autenticación podría añadir un actor a la request.

Contrato de dominio:

```ts
// src/auth/authenticated-actor.ts
export interface AuthenticatedActor {
  readonly id: string;
  readonly roles: readonly string[];
}
```

Ampliación:

```ts
// src/types/express.d.ts
import type { AuthenticatedActor } from "../auth/authenticated-actor.js";

declare module "express-serve-static-core" {
  interface Request {
    actor?: AuthenticatedActor;
  }
}

export {};
```

El miembro se mantiene opcional porque no todas las rutas ni todos los puntos del pipeline garantizan que el middleware ya se ejecutó.

El middleware debe validar credenciales y asignar el valor real. Un controller protegido debe volver explícita la precondición:

```ts
import type { Request } from "express";

function requireActor(request: Request): AuthenticatedActor {
  if (request.actor === undefined) {
    throw new Error("Authenticated actor is required");
  }

  return request.actor;
}
```

La ampliación mejora ergonomía; no autentica al usuario, no verifica tokens y no controla el orden del middleware.

---

## 22. `types` y `typeRoots`: visibilidad de declaraciones

La opción `types` limita qué paquetes de tipos aportan globals al proyecto:

```jsonc
{
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  }
}
```

Esto no impide necesariamente importar tipos exportados explícitamente desde una dependencia. Su función principal es controlar paquetes de declaraciones globales visibles.

`typeRoots` cambia las carpetas donde TypeScript busca paquetes de tipos:

```jsonc
{
  "compilerOptions": {
    "typeRoots": ["./src/types", "./node_modules/@types"]
  }
}
```

Úsalo con cautela. Al configurarlo, puedes ocultar tipos que antes eran visibles. Para declaraciones locales normales suele bastar con incluir los `.d.ts` mediante `include`:

```jsonc
{
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.d.ts"]
}
```

Antes de añadir `typeRoots`, confirma que realmente necesitas tratar una carpeta como raíz de paquetes de tipos.

---

## 23. Generar declaraciones para un SDK TypeScript

Si la fuente ya está escrita en TypeScript, lo normal es generar las declaraciones en vez de reescribirlas manualmente.

```jsonc
// packages/audit-sdk/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmitOnError": true
  },
  "include": ["src/**/*.ts"]
}
```

Fuente pública implementada:

```ts
// src/index.ts
export interface AuditSummary {
  readonly id: string;
  readonly siteId: string;
  readonly status: "draft" | "in_progress" | "completed";
}

export interface AuditSdk {
  getAudit(id: string): Promise<AuditSummary | null>;
}

export function createAuditSdk(options: {
  readonly baseUrl: string;
  readonly accessToken: string;
}): AuditSdk {
  // Implementación real del SDK.
  return {
    async getAudit(id: string): Promise<AuditSummary | null> {
      void options;
      void id;
      return null;
    },
  };
}
```

Al compilar, TypeScript puede producir:

```ts
// dist/index.d.ts — salida simplificada
export interface AuditSummary {
  readonly id: string;
  readonly siteId: string;
  readonly status: "draft" | "in_progress" | "completed";
}

export interface AuditSdk {
  getAudit(id: string): Promise<AuditSummary | null>;
}

export declare function createAuditSdk(options: {
  readonly baseUrl: string;
  readonly accessToken: string;
}): AuditSdk;
```

La generación reduce el riesgo de que implementación y tipos diverjan.

---

## 24. `emitDeclarationOnly`

Si otra herramienta genera el JavaScript, TypeScript puede emitir únicamente declaraciones:

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist/types"
  }
}
```

Esto puede encajar en un SDK donde:

- un bundler genera JavaScript;
- `tsc` genera `.d.ts`;
- el proceso de publicación combina ambos outputs.

Debes verificar que las rutas finales de `package.json` coincidan con los archivos realmente publicados. Un `types` que apunta a un archivo ausente rompe la experiencia del consumidor aunque el JavaScript funcione.

---

## 25. Diseñar la superficie pública del paquete

Las declaraciones generadas revelan el contrato que otros equipos consumirán. Por eso conviene exportar desde un punto de entrada deliberado:

```ts
// src/index.ts
export { createAuditSdk } from "./client/create-audit-sdk.js";
export type { AuditSdk } from "./client/audit-sdk.js";
export type { AuditSummary } from "./audits/audit-summary.js";
```

Evita pedir a los consumidores imports profundos:

```ts
// Frágil: depende de la estructura interna del paquete.
import type { AuditSummary } from "@siteops/audit-sdk/dist/internal/models/audit.js";
```

Prefiere:

```ts
import type { AuditSummary } from "@siteops/audit-sdk";
```

Una superficie pública pequeña permite reorganizar internamente el SDK sin romper a los consumidores.

Pregunta de diseño:

> Si un tipo aparece en el `.d.ts` público, ¿quieres mantenerlo como contrato compatible en futuras versiones?

---

## 26. No filtres tipos privados accidentalmente

Considera:

```ts
interface InternalTransportResponse {
  readonly payload: unknown;
  readonly debugHeaders: Readonly<Record<string, string>>;
}

export function requestAudit(): Promise<InternalTransportResponse> {
  throw new Error("Not implemented");
}
```

Aunque la interfaz no está exportada con una declaración separada, forma parte de la firma de una función exportada. El emisor de declaraciones debe representarla de alguna manera.

Una mejor separación expone un DTO público intencional:

```ts
export interface AuditResponse {
  readonly data: unknown;
}

export function requestAudit(): Promise<AuditResponse> {
  throw new Error("Not implemented");
}
```

Después, el SDK valida `data` antes de convertirlo en un modelo útil.

Los `.d.ts` son una herramienta de revisión arquitectónica: muestran qué detalles cruzan la frontera del paquete.

---

## 27. Declaraciones honestas para datos no confiables

Supón que un paquete JavaScript ficticio solo ejecuta `JSON.parse`:

```js
// Runtime JavaScript
export function parseConfiguration(source) {
  return JSON.parse(source);
}
```

Esta declaración sería peligrosa:

```ts
export declare function parseConfiguration(source: string): DeviceConfiguration;
```

`JSON.parse` puede devolver cualquier valor JSON. La declaración más honesta es:

```ts
export declare function parseConfiguration(source: string): unknown;
```

El adapter de SiteOps Tracker valida después:

```ts
import { z } from "zod";
import { parseConfiguration } from "siteops-config-parser";

const DeviceConfigurationSchema = z.object({
  hostname: z.string().trim().min(1),
  managementIp: z.string().ip(),
  interfaces: z.array(z.string().min(1)),
});

export type DeviceConfiguration = z.infer<
  typeof DeviceConfigurationSchema
>;

export function parseDeviceConfiguration(
  source: string,
): DeviceConfiguration {
  const candidate: unknown = parseConfiguration(source);
  return DeviceConfigurationSchema.parse(candidate);
}
```

Responsabilidades:

| Pieza | Responsabilidad |
| --- | --- |
| JavaScript del parser | Ejecutar el parsing |
| `.d.ts` del parser | Describir que recibe `string` y devuelve `unknown` |
| Zod | Validar el valor real en runtime |
| `DeviceConfiguration` | Dar seguridad estática después de validar |
| Service | Aplicar reglas de aplicación |

Esta separación evita usar una declaración como sustituto de validación.

---

## 28. PostgreSQL y los generics del driver

Una librería de base de datos puede declarar un método genérico:

```ts
interface QueryExecutor {
  query<Row>(sql: string, values?: readonly unknown[]): Promise<readonly Row[]>;
}
```

El consumidor podría escribir:

```ts
interface FindingRow {
  id: string;
  severity: "low" | "medium" | "high";
}

const rows = await database.query<FindingRow>(
  "SELECT id, severity FROM findings",
);
```

El argumento genérico informa al compilador; no inspecciona el resultado enviado por PostgreSQL. La consulta puede cambiar, el driver puede transformar valores o los datos pueden no cumplir la unión esperada.

En una frontera crítica, valida o mapea de forma explícita:

```ts
import { z } from "zod";

const FindingRowSchema = z.object({
  id: z.string().uuid(),
  severity: z.enum(["low", "medium", "high"]),
});

type FindingRow = z.infer<typeof FindingRowSchema>;

function parseFindingRows(rows: readonly unknown[]): readonly FindingRow[] {
  return rows.map((row) => FindingRowSchema.parse(row));
}
```

Además, PostgreSQL debe aplicar constraints apropiados. TypeScript, `.d.ts`, Zod y SQL protegen capas diferentes.

---

## 29. Probar una declaración de tipos

Los tests runtime no detectan por sí solos que una firma pública acepta tipos incorrectos. Puedes crear comprobaciones compiladas por `tsc`.

### Caso válido

```ts
import { createAuditSdk } from "@siteops/audit-sdk";

createAuditSdk({
  baseUrl: "https://api.example.test",
  accessToken: "test-token",
});
```

### Caso inválido esperado

```ts
import { createAuditSdk } from "@siteops/audit-sdk";

// @ts-expect-error accessToken es obligatorio.
createAuditSdk({
  baseUrl: "https://api.example.test",
});
```

`@ts-expect-error` es útil porque exige que exista un error en la siguiente línea. Si una modificación vuelve aceptable el código inválido, el propio comentario produce un fallo y revela la regresión.

También prueba inferencia:

```ts
const sdk = createAuditSdk({
  baseUrl: "https://api.example.test",
  accessToken: "test-token",
});

const auditPromise: Promise<AuditSummary | null> = sdk.getAudit(
  "audit-001",
);
```

Una estrategia completa para un SDK combina:

- tests de tipos;
- tests unitarios del comportamiento;
- tests de integración HTTP;
- pruebas de empaquetado e importación;
- verificación del contenido publicado.

---

## 30. Diagnóstico cuando TypeScript no encuentra tipos

Sigue este orden:

1. comprueba que el paquete runtime está instalado;
2. revisa si su `package.json` publica `types`, `typings` o condiciones `exports`;
3. comprueba si existe un paquete `@types` compatible;
4. revisa `module` y `moduleResolution`;
5. confirma que el `.d.ts` local está incluido;
6. revisa `types` y `typeRoots`;
7. confirma que el specifier declarado coincide con el import;
8. usa el rastreo de resolución.

```bash
npx tsc -p tsconfig.json --traceResolution --noEmit
```

Para ver los archivos cargados:

```bash
npx tsc -p tsconfig.json --listFiles --noEmit
```

Para ver la configuración efectiva:

```bash
npx tsc -p tsconfig.json --showConfig
```

No soluciones automáticamente el problema creando:

```ts
declare module "missing-package";
```

Primero determina si falta la dependencia, existe una incompatibilidad de exports o la configuración no encuentra una declaración ya publicada.

---

## 31. Relación con la arquitectura Full Stack

```text
React
  │ declaraciones del navegador, assets y SDK
  ▼
HTTP ───────────── datos reales sin tipos TypeScript
  │
Node / Express
  │ declaraciones de Node, Express y paquetes JS
  ▼
Router → Controller → Runtime Validation → Service → Repository → PostgreSQL
                         │                               │
                         │ Zod                          │ SQL + mapeo
                         ▼                               ▼
                    datos confiables              estado persistente
  │
  ▼
Testing → Docker → CI/CD → Cloud
```

### React

Usa declaraciones de React, DOM, bundler y assets. Un `.d.ts` puede describir un import SVG o un bootstrap global, pero el bundler y el HTML deben producir esos valores realmente.

### HTTP

Transporta bytes y JSON, no interfaces TypeScript. Las declaraciones del cliente mejoran el desarrollo, pero una respuesta debe tratarse como `unknown` hasta validarse cuando la confianza importa.

### Node.js y Express

`@types/node` y las declaraciones de Express describen APIs runtime. Una ampliación de `Request` solo es correcta si el middleware asigna el miembro de verdad.

### Router

Conecta rutas con Controllers. Los tipos ayudan a expresar parámetros previstos, pero la URL real sigue necesitando parsing y validación.

### Controller

Recibe datos externos. No debe confiar en una aserción ni en una declaración ambiental para convertir `req.body` en un comando válido.

### Runtime Validation

Los schemas Zod son valores JavaScript y permanecen después de compilar. Convierten `unknown` en datos comprobados o producen un error controlado.

### Service

Trabaja con contratos internos ya validados. Puede importar tipos desde paquetes de dominio sin depender de Express.

### Repository

Una interfaz o `.d.ts` describe el port y el driver, pero el adapter debe mapear filas reales y manejar errores de infraestructura.

### PostgreSQL

Constraints, tipos SQL y transacciones protegen los datos persistidos. Un generic TypeScript no ejecuta ninguna comprobación en la base.

### Testing

Los tests de tipos comprueban contratos estáticos. Los tests unitarios, de integración y E2E comprueban comportamiento runtime.

### Docker

Ejecuta JavaScript y dependencias reales. Una declaración no instala módulos faltantes ni corrige incompatibilidades ESM/CommonJS.

### CI/CD

Debe verificar typecheck, generación de declaraciones, tests, build y, para un SDK, el paquete que se publicará.

### Cloud

Ejecuta el artefacto real con configuración y datos reales. Los tipos ya desaparecieron; la validación en fronteras continúa siendo necesaria.

---

## 32. Relación explícita con tus proyectos

### SiteOps Tracker

Usa declaraciones de Node, Express, React y paquetes externos. Mantén las ampliaciones pequeñas y respaldadas por middleware o plugins reales. Valida HTTP, configuración y filas críticas.

### Repositorio de algoritmos en TypeScript

Normalmente no necesita declaraciones personalizadas. Puede usar tests de tipos para comprobar que helpers genéricos infieren entradas y salidas sin `any`.

### Analizador de configuraciones

Una declaración local puede tipar un parser JavaScript heredado. Si el parser procesa archivos externos, su salida honesta será `unknown` hasta pasar por un schema.

### SDK tipado para una API

Genera `.d.ts`, define un punto de entrada público, prueba imports y evita exponer rutas internas. El SDK debe validar respuestas de red aunque publique modelos TypeScript.

### API REST Node.js + TypeScript + PostgreSQL

Consume `@types/node`, declaraciones de Express y del driver. Ninguno sustituye validación HTTP, manejo de errores, constraints SQL ni tests de integración.

### Aplicación Full Stack React + TypeScript + Node.js + PostgreSQL

Puede compartir un paquete de contratos y schemas, pero debe separar valores runtime de tipos borrados. Publica schemas cuando ambas aplicaciones necesitan validar; exporta tipos derivados con `z.infer` para evitar duplicación.

---

## 33. Cuándo usar un `.d.ts` manual

Úsalo cuando:

- consumes una librería JavaScript pequeña sin tipos;
- describes un global que el runtime realmente proporciona;
- el bundler transforma una clase de assets;
- mantienes una integración heredada mientras se migra;
- amplías una interfaz que la librería diseñó como punto de extensión;
- necesitas describir una superficie que no puedes convertir todavía a TypeScript.

Mantén la declaración:

- mínima;
- verificable;
- cercana a la integración;
- versionada;
- probada;
- honesta respecto a `unknown` y opcionalidad.

---

## 34. Cuándo no usarlo

No uses un `.d.ts` para:

- ocultar que un paquete no está instalado;
- inventar un método que no existe;
- transformar datos externos en datos confiables;
- evitar corregir un import ESM/CommonJS;
- declarar como obligatoria una variable de entorno no validada;
- reemplazar tests runtime;
- duplicar manualmente tipos que tu propia fuente TypeScript puede generar;
- silenciar todos los exports de una dependencia con `any` de manera permanente;
- hacer global un tipo que podría importarse explícitamente;
- encubrir una incompatibilidad real entre versiones.

Si controlas la fuente TypeScript, prefiere generar declaraciones. Si controlas el comportamiento, prefiere diseñar una API tipada directamente. Si no controlas los datos, valida en runtime.

---

## 35. Errores comunes

### Error 1 — Creer que `.d.ts` contiene implementación

No produce comportamiento ni JavaScript ejecutable.

### Error 2 — Instalar solo `@types`

Los tipos no instalan el paquete runtime.

### Error 3 — Instalar `@types` cuando el paquete ya incluye tipos

Puede introducir duplicación o versiones incompatibles.

### Error 4 — Declarar un módulo vacío y olvidar reemplazarlo

El `any` resultante se propaga por la aplicación.

### Error 5 — Anotar datos externos con un modelo de dominio

Una declaración no valida HTTP, archivos, formularios ni PostgreSQL.

### Error 6 — Añadir miembros mediante augmentation sin implementación

El código compila y falla con `is not a function` o `undefined`.

### Error 7 — Convertir variables de entorno en `string` obligatorio

El deployment real puede omitirlas o proporcionar valores inválidos.

### Error 8 — Confundir módulo ambiental con module augmentation

El significado cambia según si el archivo es script o módulo.

### Error 9 — Declarar el nombre de módulo equivocado

El specifier de `declare module` debe corresponder con el import real.

### Error 10 — No incluir el `.d.ts` en `tsconfig`

La declaración existe en disco, pero no forma parte del programa.

### Error 11 — Usar `typeRoots` sin comprender su alcance

Puede ocultar paquetes `@types` que antes se resolvían automáticamente.

### Error 12 — Declarar assets de forma distinta al bundler

TypeScript acepta un componente o URL que el runtime no exporta así.

### Error 13 — Mantener a mano `.d.ts` de código TypeScript propio

Implementación y contrato pueden divergir; prefiere `declaration: true`.

### Error 14 — Exponer detalles internos del SDK

Los consumidores se acoplan a rutas y tipos que querías cambiar libremente.

### Error 15 — No probar el paquete publicado

El repositorio compila, pero el tarball carece de `.d.ts` o `package.json` apunta a una ruta incorrecta.

### Error 16 — Confundir test de tipos con test de comportamiento

`@ts-expect-error` comprueba el contrato estático; no demuestra que una petición HTTP funcione.

---

## 36. Checklist para una declaración segura

Antes de aceptar un `.d.ts`, responde:

- ¿qué JavaScript real describe?
- ¿la versión de la declaración coincide con la implementación?
- ¿los nombres y formas de exports son exactos?
- ¿el paquete es ESM, CommonJS o dual?
- ¿el specifier coincide con el import real?
- ¿el retorno debe ser `unknown` por provenir de una frontera?
- ¿algún miembro opcional fue declarado obligatorio sin evidencia?
- ¿la declaración crea un global innecesario?
- ¿el archivo está incluido por `tsconfig`?
- ¿hay un `@types` o tipos incluidos que ya resuelven el problema?
- ¿la ampliación corresponde a comportamiento runtime real?
- ¿sería más claro usar un wrapper?
- ¿los casos válidos e inválidos tienen tests de tipos?
- ¿el build publica realmente los `.d.ts`?
- ¿HTTP, archivos, variables de entorno y base de datos se validan aparte?

---

# PRÁCTICAS

## Práctica 1 — Tipo o valor

Clasifica cada elemento según exista solo en type checking, solo en runtime o en ambos mediante piezas separadas:

```ts
interface AuditSummary {
  id: string;
}

const AuditSummarySchema = z.object({
  id: z.string().uuid(),
});

declare function loadAudit(id: string): Promise<AuditSummary>;

function normalizeId(id: string): string {
  return id.trim();
}
```

Explica qué queda en el JavaScript emitido.

---

## Práctica 2 — Detectar la declaración mentirosa

La implementación es:

```js
export function parse(source) {
  return JSON.parse(source);
}
```

Se propusieron dos contratos:

```ts
// Opción A
export declare function parse(source: string): DeviceConfiguration;

// Opción B
export declare function parse(source: string): unknown;
```

Elige el contrato más honesto y explica dónde convertirías el resultado en `DeviceConfiguration`.

---

## Práctica 3 — `@types` no es runtime

Responde:

1. ¿qué aporta `@types/node`?
2. ¿instala Node.js?
3. ¿hace que `Buffer` exista en un navegador?
4. ¿valida `process.env.PORT`?
5. ¿qué debe fijar la versión real del runtime?

---

## Práctica 4 — Asset del bundler

El frontend usa:

```ts
import floorPlanUrl from "./floor-plan.svg";
```

Escribe una declaración para `*.svg` suponiendo que el bundler devuelve una URL `string`. Después explica por qué sería incorrecto declarar un componente React sin instalar y configurar un transformador que lo genere.

---

## Práctica 5 — Global seguro

Modela una propiedad opcional `window.__SITEOPS_FEATURES__` como `unknown`. Luego describe, sin implementar por completo, cómo la validarías con Zod antes de habilitar funcionalidades.

### Pista

Convierte el archivo en módulo con `export {}` y usa `declare global`.

---

## Práctica 6 — Ampliación o wrapper

Una librería no expone `retry()`. Compara:

1. declarar el método mediante module augmentation;
2. modificar el prototipo y declarar el método;
3. crear un wrapper que coordine reintentos.

Explica cuál elegirías para una aplicación profesional y qué evidencia runtime necesitaría cada alternativa.

---

# EJERCICIO PRINCIPAL — Tipar una integración JavaScript sin mentir

SiteOps Tracker consumirá un paquete JavaScript ficticio llamado `siteops-legacy-csv`. Su documentación runtime indica:

```js
import { createCsvReader } from "siteops-legacy-csv";

const reader = createCsvReader({ delimiter: "," });
const candidate = reader.parse(csvText);
```

La implementación puede devolver cualquier estructura porque procesa archivos externos.

## Tu tarea

Crea un archivo:

```text
src/types/siteops-legacy-csv.d.ts
```

Debe declarar:

- el módulo exacto `siteops-legacy-csv`;
- una interfaz `CsvReaderOptions`;
- `delimiter` opcional y limitado a `"," | ";" | "\t"`;
- una interfaz `CsvReader`;
- un método `parse(source: string): unknown`;
- una función `createCsvReader(options?: CsvReaderOptions): CsvReader`;
- propiedades inmutables cuando corresponda;
- cero usos de `any`.

Después diseña, sin recibir la solución completa, un adapter:

```text
src/integrations/legacy-csv/parse-assets.ts
```

El adapter debe:

1. recibir texto CSV;
2. llamar al paquete JavaScript;
3. conservar el resultado como `unknown`;
4. validar un array de activos con Zod;
5. devolver únicamente datos validados;
6. convertir errores del parser o validación en un resultado discriminado;
7. no filtrar detalles del paquete hacia el Service.

Contrato sugerido para que tú lo completes:

```ts
type ParseAssetsResult =
  | {
      readonly kind: "success";
      readonly assets: readonly AssetImport[];
    }
  | {
      readonly kind: "invalid_file";
      readonly message: string;
    };
```

## Restricciones

- no uses `any`;
- no uses una aserción `as AssetImport[]`;
- no declares que el paquete devuelve datos ya validados;
- no pongas implementación dentro del `.d.ts`;
- no hagas globales `CsvReaderOptions` ni `CsvReader`;
- no muestres mensajes internos sensibles al usuario;
- no cambies el contrato para evitar manejar errores.

## Pistas

1. El `.d.ts` describe la API del paquete, no el contenido correcto del CSV.
2. `unknown` obliga a pasar por un schema.
3. `z.array(...)` puede validar una colección.
4. Usa `try/catch` con el error como `unknown`.
5. El adapter pertenece a infraestructura; el Service no necesita conocer `siteops-legacy-csv`.
6. Incluye `src/**/*.d.ts` en la configuración si tu patrón actual no los cubre.
7. Usa `@ts-expect-error` para probar un delimitador inválido.

## Entrega esperada

Comparte:

1. el `.d.ts`;
2. el schema Zod;
3. el adapter incompleto o completo escrito por ti;
4. un caso de uso válido;
5. dos casos que deben fallar en type checking;
6. dos datos runtime inválidos que Zod debe rechazar;
7. una explicación de por qué el retorno del parser es `unknown`.

> No se incluye la solución completa. Cuando compartas tu código, primero se analizarán sus aciertos, errores y causas; después recibirás pistas. La solución integral solo se mostrará si la solicitas expresamente.

---

# RETO — Publicar un SDK tipado y extensible para SiteOps Tracker

Diseña la superficie pública de un paquete ficticio:

```text
packages/audit-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── client/
│   │   └── create-audit-sdk.ts
│   └── events/
│       └── audit-event-map.ts
└── tests/
    └── public-api.test-d.ts
```

## Requisitos

1. La fuente está escrita en TypeScript.
2. El build genera JavaScript, `.d.ts`, declaration maps y source maps.
3. `package.json` expone solo la entrada pública.
4. El consumidor puede importar `createAuditSdk`, `AuditSdk` y `AuditSummary` desde el paquete raíz.
5. Las rutas internas no forman parte del contrato.
6. El mapa `AuditEventMap` admite ampliación controlada mediante interfaces.
7. La ampliación no añade métodos runtime inexistentes.
8. Las respuestas HTTP entran como `unknown` y se validan antes de devolverse.
9. Los tests de tipos contienen casos válidos y casos con `@ts-expect-error`.
10. Un test de empaquetado comprueba que los archivos indicados por `exports` y `types` existan.

## Parte A — Contrato público

Define únicamente los exports necesarios para:

- construir el cliente;
- obtener una auditoría;
- listar hallazgos;
- publicar un evento conocido.

No expongas:

- el cliente HTTP interno;
- headers internos;
- rutas físicas de `dist`;
- schemas privados que no quieres versionar;
- detalles de logging.

## Parte B — Punto de extensión

Diseña `AuditEventMap` para que otro paquete pueda añadir un evento mediante module augmentation.

Explica:

- por qué usaste `interface` y no `type` para el mapa;
- qué comportamiento runtime ya existe;
- por qué la ampliación no necesita inventar un método;
- cómo garantizarás que el archivo de ampliación sea incluido.

## Parte C — Validación runtime

Documenta el flujo:

```text
fetch
→ Response.json(): unknown
→ schema Zod
→ AuditSummary validado
→ Promise<AuditSummary> para el consumidor
```

Explica qué partes siguen existiendo después de compilar.

## Parte D — Verificación

Diseña comandos para comprobar:

```bash
npm run typecheck
npm run test
npm run build
npm pack --dry-run
```

Además, crea conceptualmente un proyecto consumidor temporal que instale el paquete generado e intente:

```ts
import { createAuditSdk, type AuditSummary } from "@siteops/audit-sdk";
```

## Criterios de éxito

- no hay `any` público accidental;
- los `.d.ts` coinciden con el JavaScript publicado;
- el package root es suficiente para los imports soportados;
- los deep imports no son necesarios;
- los datos HTTP se validan;
- una ampliación modifica tipos solo donde existe capacidad runtime;
- los casos inválidos fallan durante typecheck;
- el paquete funciona desde un consumidor limpio.

> No se incluye una solución completa. El reto busca que diseñes y defiendas el contrato público, no que copies una configuración terminada.

---

## Preguntas de comprensión

1. ¿Qué diferencia existe entre un archivo `.ts` y un `.d.ts`?
2. ¿Un `.d.ts` produce JavaScript?
3. ¿Por qué una declaración puede compilar y aun así fallar en runtime?
4. ¿Qué diferencia existe entre tipos incluidos por un paquete y `@types`?
5. ¿Instalar `@types/node` instala Node.js?
6. ¿Por qué un parser de JSON o CSV debería declarar `unknown` como retorno?
7. ¿Qué riesgo introduce `declare module "package";` sin cuerpo?
8. ¿Cómo debe relacionarse el nombre de un módulo ambiental con el import?
9. ¿Qué diferencia existe entre un `.d.ts` script y un `.d.ts` módulo?
10. ¿Cuándo `declare module` representa una ampliación?
11. ¿Por qué una interfaz puede servir como punto de extensión?
12. ¿Puede module augmentation añadir comportamiento runtime?
13. ¿Qué ocurre si declaras un método que nadie implementa?
14. ¿Por qué `declare global` debe usarse con moderación?
15. ¿Qué ventaja tiene declarar un bootstrap global como `unknown`?
16. ¿Por qué no conviene declarar `DATABASE_URL: string` como certeza global?
17. ¿Qué diferencia existe entre `declaration` y `emitDeclarationOnly`?
18. ¿Qué problema resuelve `declarationMap`?
19. ¿Por qué debes probar el paquete desde un consumidor limpio?
20. ¿Qué herramienta valida los datos reales: una interface, un `.d.ts` o un schema Zod?

---

## Relevancia para entrevistas técnicas

### Pregunta: ¿Qué es un archivo `.d.ts`?

Es un archivo de declaraciones que describe la forma estática de valores, módulos o APIs existentes. Participa en type checking y no genera comportamiento runtime.

### Pregunta: ¿Cuál es la diferencia entre `.ts` y `.d.ts`?

Un `.ts` puede contener implementación y producir JavaScript. Un `.d.ts` contiene contratos sin implementación y no emite JavaScript equivalente.

### Pregunta: ¿Qué es `@types`?

Es el scope usado para distribuir declaraciones de tipos de paquetes o entornos que no necesariamente las incluyen. Los paquetes suelen proceder de DefinitelyTyped. No sustituyen la dependencia runtime.

### Pregunta: ¿Qué es una ambient module declaration?

Es una declaración como `declare module "nombre"` que describe un módulo proporcionado externamente. Debe coincidir con la forma real de sus exports.

### Pregunta: ¿Qué es module augmentation?

Es la ampliación de declaraciones existentes de un módulo mediante declaration merging. Solo modifica el conocimiento estático y debe corresponder a comportamiento real o a un punto de extensión puramente tipado que el runtime ya soporte.

### Pregunta: ¿Por qué una augmentation puede ser peligrosa?

Porque el compilador puede aceptar miembros que no existen en ejecución. Si la ampliación supone un método nuevo, también debe existir una implementación o un plugin runtime cargado correctamente.

### Pregunta: ¿Por qué usar `unknown` en una declaración?

Porque expresa que el valor existe, pero todavía no se conoce su forma de manera segura. Obliga a validar o hacer narrowing antes de usarlo.

### Pregunta: ¿Cómo publicarías tipos para una librería TypeScript?

Generaría declaraciones con `declaration`, opcionalmente `declarationMap`, expondría una entrada pública deliberada, configuraría `types` y `exports`, probaría casos de tipos y verificaría el paquete construido desde un consumidor limpio.

### Pregunta: ¿Un generic del driver de PostgreSQL valida filas?

No. El generic informa al compilador sobre la forma esperada. La fila real requiere constraints SQL, mapeo y, cuando corresponda, validación runtime.

### Pregunta: ¿Cómo evitarías contaminar el alcance global?

Preferiría exports e imports explícitos. Si el runtime realmente necesita un global, usaría un archivo módulo con `declare global`, un nombre específico, opcionalidad honesta y validación del valor.

### Señal de una respuesta profesional

Conecta siempre estas piezas:

```text
implementación real
→ declaración fiel
→ resolución del módulo
→ type checking
→ JavaScript emitido
→ validación de datos externos
→ pruebas de tipos y runtime
```

---

## Referencias oficiales recomendadas

- [TypeScript Handbook — Type Declarations](https://www.typescriptlang.org/docs/handbook/2/type-declarations)
- [TypeScript Handbook — Modules `.d.ts`](https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts)
- [TypeScript Handbook — Declaration Merging y Module Augmentation](https://www.typescriptlang.org/docs/handbook/declaration-merging.html)
- [TypeScript Handbook — Library Structures](https://www.typescriptlang.org/docs/handbook/declaration-files/library-structures.html)
- [TypeScript Handbook — Creating `.d.ts` Files from JavaScript](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html)
- [TypeScript Handbook — Modules Reference](https://www.typescriptlang.org/docs/handbook/esm-node.html)

---

## Resumen

- un `.d.ts` describe contratos estáticos y no implementa comportamiento;
- una declaración incorrecta puede hacer que código inválido compile;
- TypeScript obtiene declaraciones de sus libs, del propio paquete, de `@types` o de archivos locales;
- `@types` no instala la librería ni el runtime;
- una declaración ambiental debe reflejar nombres, exports y firmas reales;
- declarar un módulo vacío introduce `any` y debe ser solo una transición;
- `.d.mts` y `.d.cts` expresan de forma inequívoca ESM y CommonJS;
- las declaraciones de assets deben coincidir con la transformación real del bundler;
- un archivo sin imports o exports puede contaminar el alcance global;
- `declare module` puede describir un módulo ambiental o ampliar uno existente según el contexto;
- declaration merging permite puntos de extensión controlados mediante interfaces;
- module augmentation no añade comportamiento runtime;
- una ampliación de método necesita una implementación real o fallará;
- los wrappers suelen ser más explícitos que modificar prototipos;
- `declare global` debe ser deliberado, pequeño y honesto;
- convertir variables de entorno en propiedades obligatorias no las valida;
- `declaration` genera contratos desde fuente TypeScript;
- `emitDeclarationOnly` sirve cuando otra herramienta emite JavaScript;
- el punto de entrada del SDK define su superficie pública;
- los tests de tipos y los tests runtime protegen riesgos diferentes;
- `unknown` es el retorno correcto cuando una librería produce datos no confiables;
- HTTP, formularios, APIs externas, archivos, variables de entorno y PostgreSQL requieren validación real;
- Zod existe en runtime; los aliases, interfaces y `.d.ts` no;
- Docker, CI/CD y Cloud ejecutan el artefacto y las dependencias reales, no las promesas de una declaración.

Una declaración profesional no intenta convencer al compilador. Intenta describir con precisión un comportamiento que puedes demostrar que existe.

---

# Próxima lección

**Lección 27 — Project References y builds compuestos con `composite`.**
