# Lección 28 — Publicación de paquetes TypeScript: `package.json`, `types` y `exports`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, reglas y datos de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos  

---

## Introducción

En la lección anterior dividiste un repositorio en proyectos TypeScript y aprendiste a construir su grafo mediante Project References, `composite` y `tsc -b`. Eso resuelve el orden de compilación, pero deja pendiente otra pregunta:

> ¿Cómo sabe un consumidor qué JavaScript puede ejecutar, qué declaraciones debe leer y qué rutas del paquete forman parte de la API pública?

La respuesta vive principalmente en `package.json`.

Para SiteOps Tracker construiremos un paquete ficticio llamado `@siteops/audit-contracts`. React podrá usar sus contratos y schemas para comprobar respuestas HTTP; la API Node.js podrá usar los mismos schemas para validar requests antes de llamar al Service. El paquete deberá publicar únicamente entradas deliberadas, no carpetas internas accidentales.

La idea central de hoy es:

> Compilar crea archivos; empaquetar define cuáles son públicos y cómo los encuentran JavaScript y TypeScript.

---

## Objetivo

Al terminar esta lección podrás:

1. distinguir código fuente, salida de compilación y contenido publicable;
2. explicar para qué sirven `name`, `version`, `type`, `main`, `types`, `exports` y `files`;
3. publicar una entrada principal y un subpath con JavaScript y declaraciones coherentes;
4. comprender cómo `exports` encapsula rutas internas;
5. evitar confundir Project References con resolución de paquetes en runtime;
6. clasificar dependencias entre `dependencies`, `devDependencies` y `peerDependencies`;
7. verificar el tarball antes de una publicación mediante `npm pack --dry-run`;
8. detectar configuraciones donde los tipos funcionan, pero JavaScript falla;
9. mantener explícita la diferencia entre type checking y validación runtime;
10. relacionar un paquete compartido con las capas React → HTTP → Node → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL.

---

## 1. El problema: “compila” no significa “se puede consumir”

Supón que el paquete tiene esta estructura:

```text
packages/audit-contracts/
├── src/
│   ├── index.ts
│   ├── schemas.ts
│   └── internal/
│       └── normalize-rule.ts
├── dist/
│   ├── index.js
│   ├── index.d.ts
│   ├── schemas.js
│   ├── schemas.d.ts
│   └── internal/
│       ├── normalize-rule.js
│       └── normalize-rule.d.ts
├── package.json
└── tsconfig.json
```

TypeScript puede construir `dist` sin errores y aun así el paquete quedar roto.

### 1.1 El consumidor encuentra tipos, pero no JavaScript

```json
{
  "types": "./dist/index.d.ts"
}
```

El editor puede conocer los tipos, pero Node.js todavía necesita una entrada JavaScript ejecutable.

### 1.2 JavaScript carga, pero los tipos apuntan a otro contrato

```json
{
  "main": "./dist/index.js",
  "types": "./src/index.ts"
}
```

Publicar una entrada runtime desde `dist` y tipos desde el código fuente mezcla dos representaciones. El consumidor podría depender de opciones, rutas o archivos que no existen en el paquete instalado.

### 1.3 Los consumidores importan detalles internos

Sin una API pública deliberada alguien podría escribir:

```ts
import { normalizeRule } from "@siteops/audit-contracts/dist/internal/normalize-rule.js";
```

Ese deep import acopla al consumidor con la estructura de build. Mover el archivo se vuelve un cambio rompedor aunque nunca formara parte del contrato deseado.

### 1.4 El tarball incluye archivos innecesarios o sensibles

Una publicación mal revisada puede incluir fuentes, fixtures, reportes, archivos de pruebas o configuraciones locales. Nunca deben existir secretos dentro del paquete ni del historial del repositorio; `files` ayuda a reducir la superficie publicada, pero no reemplaza una revisión de seguridad.

---

## 2. Tres contratos que deben coincidir

Un paquete TypeScript útil tiene, como mínimo, tres perspectivas.

| Perspectiva | Artefacto principal | Pregunta que responde |
| --- | --- | --- |
| Runtime | `.js`, `.mjs` o `.cjs` | ¿Qué código ejecuta el consumidor? |
| Tipos | `.d.ts`, `.d.mts` o `.d.cts` | ¿Qué contrato comprueba TypeScript? |
| Paquete | `package.json` y tarball | ¿Qué entradas y archivos se distribuyen? |

Los tres deben representar la misma API pública.

Si `package.json` anuncia `./dist/schemas.js`, ese archivo debe existir. Si la condición `types` anuncia `./dist/schemas.d.ts`, la declaración debe describir esa misma entrada. Si `files` excluye `dist`, ambas rutas quedarán rotas después de instalar el paquete, aunque funcionen en el repositorio original.

---

## 3. Fuente, build y paquete instalado

Conviene separar mentalmente tres árboles.

### 3.1 Código fuente

```text
src/index.ts
src/schemas.ts
```

Aquí desarrollas y ejecutas el type checker.

### 3.2 Salida de compilación

```text
dist/index.js
dist/index.d.ts
dist/schemas.js
dist/schemas.d.ts
```

Esta es la salida generada. En una librería que emite JavaScript con `tsc`, normalmente no debes editarla manualmente.

### 3.3 Contenido empacado

```text
package/package.json
package/README.md
package/LICENSE
package/dist/index.js
package/dist/index.d.ts
package/dist/schemas.js
package/dist/schemas.d.ts
```

Este tercer árbol es lo que recibe el consumidor. Por eso la verificación del tarball es una prueba distinta del build.

---

## 4. Un paquete ESM mínimo y coherente

Esta lección elegirá una sola estrategia: paquete ESM para Node.js moderno y bundlers compatibles. No construiremos todavía un paquete dual ESM/CommonJS, porque mantener dos formatos exige dos salidas realmente compatibles y pruebas en ambos consumidores.

### `tsconfig.json`

```jsonc
// packages/audit-contracts/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "verbatimModuleSyntax": true,
    "tsBuildInfoFile": "dist/audit-contracts.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

### `package.json`

```json
{
  "name": "@siteops/audit-contracts",
  "version": "0.1.0",
  "description": "Fictional contracts and runtime schemas for SiteOps Tracker",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./schemas": {
      "types": "./dist/schemas.d.ts",
      "import": "./dist/schemas.js"
    }
  },
  "files": [
    "dist"
  ],
  "sideEffects": false,
  "engines": {
    "node": ">=24"
  },
  "scripts": {
    "clean": "tsc -b --clean",
    "build": "tsc -b",
    "check:types": "tsc --noEmit",
    "check:package": "npm pack --dry-run"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^6.0.0"
  }
}
```

Las versiones anteriores son ilustrativas para el ejercicio. En un repositorio real debes usar versiones instaladas, compatibles y fijadas por el lockfile del proyecto.

---

## 5. `name` y `version`: identidad del paquete

```json
{
  "name": "@siteops/audit-contracts",
  "version": "0.1.0"
}
```

`name` define el specifier base que escribirá el consumidor:

```ts
import type { Finding } from "@siteops/audit-contracts";
```

`version` identifica una publicación concreta. Una actualización de versión no es decoración: comunica compatibilidad mediante Semantic Versioning.

- **Patch**: corrección compatible, por ejemplo `0.1.1`.
- **Minor**: capacidad compatible nueva, por ejemplo `0.2.0`.
- **Major**: cambio incompatible, por ejemplo `1.0.0` a `2.0.0`.

Antes de `1.0.0`, muchos equipos aún tratan cambios de minor como potencialmente incompatibles. Lo importante es documentar y aplicar una política consistente.

Cambiar o eliminar un export público, modificar un campo requerido o cerrar un subpath usado por consumidores puede requerir una versión incompatible.

---

## 6. `type`: cómo interpreta Node los archivos `.js`

```json
{
  "type": "module"
}
```

Dentro del alcance de ese `package.json`, Node.js interpreta los archivos `.js` como ES Modules.

Por eso este JavaScript emitido es coherente:

```js
export { FindingSchema } from "./schemas.js";
```

Sin un marcador explícito, un archivo `.js` puede interpretarse de forma diferente según su contexto. Para autores de paquetes es preferible declarar la intención.

Relación con TypeScript:

- `module: "NodeNext"` modela el sistema de módulos de Node;
- el `package.json` más cercano ayuda a decidir si un `.ts`/`.js` pertenece a ESM o CommonJS;
- las extensiones `.mts`/`.mjs` y `.cts`/`.cjs` permiten hacerlo inequívoco por archivo.

`type` no transforma código, no instala un loader y no hace que Node ejecute cualquier sintaxis TypeScript. El paquete sigue necesitando una estrategia real de build o un runtime que soporte explícitamente la entrada entregada.

---

## 7. `main`: compatibilidad para la entrada principal

```json
{
  "main": "./dist/index.js"
}
```

`main` define tradicionalmente la entrada principal. Solo puede señalar una entrada principal y no expresa por sí mismo subpaths ni condiciones.

Cuando `exports` y `main` aparecen juntos, runtimes compatibles con `exports` priorizan `exports`. Mantener `main` puede ayudar a herramientas antiguas, siempre que apunte a la misma API runtime que la entrada `.` de `exports`.

Configuración incoherente:

```json
{
  "main": "./dist/legacy.js",
  "exports": {
    ".": "./dist/index.js"
  }
}
```

Dos herramientas podrían recibir APIs distintas. Evita este desacuerdo salvo que exista una razón de compatibilidad cuidadosamente probada.

---

## 8. `types`: entrada estática principal

```json
{
  "types": "./dist/index.d.ts"
}
```

`types` indica la declaración principal del paquete. `typings` es un alias histórico, pero en código nuevo conviene usar `types`.

Supón esta fuente:

```ts
// src/index.ts
export type FindingStatus = "open" | "in_progress" | "resolved";

export interface Finding {
  readonly id: string;
  readonly siteId: string;
  readonly title: string;
  readonly status: FindingStatus;
}
```

TypeScript puede emitir:

```ts
// dist/index.d.ts
export type FindingStatus = "open" | "in_progress" | "resolved";

export interface Finding {
  readonly id: string;
  readonly siteId: string;
  readonly title: string;
  readonly status: FindingStatus;
}
```

La declaración se usa durante el análisis estático y desaparece al ejecutar JavaScript. No crea objetos, no comprueba JSON y no garantiza que una API externa envíe esos campos.

---

## 9. `exports`: la frontera pública del paquete

`exports` declara las entradas accesibles por nombre de paquete.

```json
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
```

### Entrada principal

```ts
import type { Finding } from "@siteops/audit-contracts";
```

El specifier `@siteops/audit-contracts` corresponde a `.`.

### Subpath público

```ts
import { FindingSchema } from "@siteops/audit-contracts/schemas";
```

El specifier termina en `/schemas`, por lo que corresponde a `./schemas`.

### Ruta no exportada

```ts
import { normalizeRule } from "@siteops/audit-contracts/internal/normalize-rule";
```

Debe fallar porque el subpath no forma parte de `exports`. Esto protege la libertad de reorganizar internamente el paquete.

La presencia de `exports` es una decisión de encapsulación. Añadirla a un paquete existente puede ser un cambio rompedor si antes los consumidores realizaban deep imports.

---

## 10. Condiciones `types` e `import`

En esta entrada:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

- TypeScript puede seleccionar `types` durante resolución estática.
- Un consumidor ESM selecciona `import` para ejecutar JavaScript.

El orden de condiciones es significativo. Coloca condiciones más específicas antes de condiciones generales; para un paquete tipado, `types` debe aparecer antes de las entradas runtime aplicables.

No agregues una condición `require` si no produces una salida CommonJS real:

```jsonc
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js" // Incorrecto si este archivo es ESM.
    }
  }
}
```

Un mapa de condiciones no convierte el formato del archivo. Si necesitas compatibilidad dual, debes emitir, declarar y probar ambas variantes. Es una decisión de distribución avanzada, no una llave que se activa con JSON.

---

## 11. `files`: qué entra al tarball

```json
{
  "files": [
    "dist"
  ]
}
```

`files` actúa como lista de inclusión para el paquete. El objetivo es publicar solo lo que el consumidor necesita.

Normalmente npm también incluye archivos especiales como `package.json`, README y licencia. No debes depender de memoria o suposiciones: inspecciona el resultado real del empaquetado.

Sin una selección deliberada, podrías distribuir más archivos de los previstos. Aun usando `files`, revisa que `dist` no contenga:

- secretos o credenciales;
- `.env`;
- fixtures con información sensible;
- reportes internos;
- mapas de fuente con contenido que no deseas distribuir;
- scripts administrativos accidentales;
- artefactos de otros paquetes.

`files` reduce la superficie; no desinfecta archivos ni elimina secretos ya incluidos en la salida.

---

## 12. El índice público y los barrels

Un archivo `index.ts` puede reunir la API pública:

```ts
// src/index.ts
export type {
  Finding,
  FindingStatus,
  CreateFindingInput,
} from "./finding.js";

export {
  CreateFindingInputSchema,
  FindingSchema,
} from "./schemas.js";
```

Los imports relativos incluyen `.js` porque la salida ESM ejecutará archivos JavaScript y `NodeNext` modela esa realidad.

Observa la diferencia:

```ts
export type { Finding } from "./finding.js";
```

Ese export solo existe para el checker.

```ts
export { FindingSchema } from "./schemas.js";
```

Ese export debe existir en JavaScript, porque el schema se ejecuta.

Un barrel no vuelve pública automáticamente toda la carpeta. La API efectiva depende de:

1. lo que exporta el archivo de entrada;
2. lo que permite `package.json#exports`;
3. los archivos realmente incluidos en el tarball.

---

## 13. Ejemplo completo: contratos y schemas honestos

### Contrato y validación

```ts
// src/schemas.ts
import { z } from "zod";

export const FindingStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
]);

export const FindingSchema = z.object({
  id: z.string().uuid(),
  siteId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  status: FindingStatusSchema,
});

export const CreateFindingInputSchema = FindingSchema.pick({
  siteId: true,
  title: true,
});

export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type CreateFindingInput = z.infer<typeof CreateFindingInputSchema>;
```

### Entrada principal

```ts
// src/index.ts
export {
  CreateFindingInputSchema,
  FindingSchema,
  FindingStatusSchema,
} from "./schemas.js";

export type {
  CreateFindingInput,
  Finding,
  FindingStatus,
} from "./schemas.js";
```

### Uso en la API Node.js

```ts
import { CreateFindingInputSchema } from "@siteops/audit-contracts";

export function parseCreateFindingBody(body: unknown) {
  return CreateFindingInputSchema.parse(body);
}
```

El parámetro es `unknown` porque el body HTTP existe en runtime y aún no es confiable.

### Uso en React

```ts
import { FindingSchema, type Finding } from "@siteops/audit-contracts";

export async function getFinding(id: string): Promise<Finding> {
  const response = await fetch(`/api/findings/${encodeURIComponent(id)}`);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  return FindingSchema.parse(payload);
}
```

Anotar directamente el resultado no valida:

```ts
// Incorrecto: la anotación no inspecciona el JSON.
const payload: Finding = await response.json();
```

El package distribuye dos clases de export:

- `Finding`, que solo ayuda al checker;
- `FindingSchema`, que ejecuta validación real.

---

## 14. Por qué Zod pertenece a `dependencies` en este ejemplo

El JavaScript emitido desde `schemas.ts` importa Zod:

```js
import { z } from "zod";
```

Por tanto, el consumidor necesita que Zod esté disponible para ejecutar el paquete. Debe declararse como dependencia runtime:

```json
{
  "dependencies": {
    "zod": "^4.0.0"
  }
}
```

Clasificación general:

| Campo | Úsalo cuando | Ejemplo en este paquete |
| --- | --- | --- |
| `dependencies` | el código distribuido requiere el paquete en runtime o sus declaraciones públicas lo necesitan directamente | Zod, porque los schemas emitidos lo importan |
| `devDependencies` | solo se necesita para desarrollar, compilar o probar | TypeScript, Vitest, ESLint |
| `peerDependencies` | el consumidor debe aportar una instancia o versión compatible de una dependencia anfitriona | React en una librería de componentes |

No muevas una dependencia a `devDependencies` únicamente para reducir el manifiesto. Inspecciona el JavaScript y los `.d.ts` publicados.

Un paquete de tipos puede exponer tipos de otra dependencia en sus declaraciones. Si el consumidor necesita resolverlos, esa dependencia también debe quedar disponible mediante una categoría apropiada; no copies sus `.d.ts` dentro de los tuyos.

---

## 15. `sideEffects`: una promesa que debe ser verdadera

```json
{
  "sideEffects": false
}
```

Esta marca ayuda a bundlers a eliminar exports no utilizados. Es correcta solo si importar cualquier módulo del paquete no ejecuta efectos secundarios observables necesarios.

Este módulo sería incompatible con una afirmación global de ausencia de efectos:

```ts
// Se ejecuta apenas alguien importa el módulo.
globalThis.addEventListener?.("unhandledrejection", () => {
  // Registro global
});
```

En un paquete de contratos y schemas puros, `sideEffects: false` suele ser razonable. Si existen archivos con efectos, declara patrones específicos o elimina la afirmación. Una configuración falsa puede hacer que un bundler descarte código necesario.

---

## 16. Project References y paquetes resuelven problemas distintos

En la lección 27 configuraste:

```jsonc
{
  "references": [
    { "path": "../audit-contracts" }
  ]
}
```

Eso le dice a `tsc -b` qué proyecto construir primero.

El consumidor, sin embargo, importa por nombre:

```ts
import { FindingSchema } from "@siteops/audit-contracts";
```

Para que funcione durante desarrollo y después de instalarlo, aún necesitas:

- un workspace o una instalación que enlace el paquete;
- un `package.json` con el nombre correcto;
- entradas `exports` válidas;
- archivos `dist` construidos;
- dependencias runtime disponibles;
- una estrategia compatible con Node o el bundler.

La referencia de proyecto no publica, instala ni enlaza un paquete. El `package.json` tampoco ordena por sí solo el build compuesto. Ambas capas cooperan, pero no se sustituyen.

---

## 17. Flujo seguro de construcción y verificación

Un flujo local razonable es:

```bash
# 1. Limpiar salidas conocidas del build compuesto
npm run clean

# 2. Construir JavaScript y declaraciones
npm run build

# 3. Revisar qué incluiría el paquete sin publicarlo
npm pack --dry-run
```

`npm pack --dry-run` informa qué haría el empaquetado sin crear una publicación. Revisa al menos:

- que `dist/index.js` exista;
- que `dist/index.d.ts` exista;
- que todas las rutas de `exports` aparezcan;
- que no se incluyan secretos ni archivos internos;
- que el tamaño sea razonable;
- que el nombre y la versión sean correctos.

Para una comprobación más realista puedes crear un tarball con `npm pack` en un entorno de prueba e instalarlo en un consumidor temporal. Esa prueba detecta dependencias accidentales del monorepo.

Ejemplo conceptual de smoke test:

```ts
// consumer-smoke-test/src/index.ts
import {
  FindingSchema,
  type Finding,
} from "@siteops/audit-contracts";

const candidate: unknown = {
  id: "f2c673aa-54bc-45fc-9de5-b50fb9ac792f",
  siteId: "0d7da80e-74e5-4782-966e-f30e543d7513",
  title: "Replace unsupported network device",
  status: "open",
};

const finding: Finding = FindingSchema.parse(candidate);
console.log(finding.status);
```

Prueba el paquete instalado, no solo imports directos desde `src`, porque el consumidor real recibe el tarball.

---

## 18. Cuándo utilizar este enfoque

Usa un paquete TypeScript con entradas explícitas cuando:

- varias aplicaciones consumen un contrato estable;
- publicas un SDK tipado para una API;
- compartes schemas runtime entre frontend y backend;
- necesitas una frontera pública independiente de la estructura interna;
- el código será instalado fuera de su carpeta fuente;
- quieres versionar un contrato reutilizable;
- un monorepo contiene paquetes con responsabilidades claras.

Para SiteOps Tracker encaja especialmente en:

- `@siteops/audit-contracts` para contratos y schemas;
- `@siteops/config-analyzer` para análisis puro;
- `@siteops/sdk` para el cliente HTTP público;
- un repositorio de algoritmos solo si realmente ofrece una biblioteca reutilizable.

---

## 19. Cuándo evitarlo

No conviertas cada carpeta en un paquete.

Evita añadir una frontera publicable cuando:

- el código solo lo usa una aplicación y no tiene API estable;
- separar el paquete obliga a versionar cambios que siempre ocurren juntos;
- la configuración pesa más que el beneficio arquitectónico;
- un módulo interno normal expresa mejor la relación;
- pretendes compartir modelos de base de datos directamente con React;
- buscas evitar validación runtime mediante “tipos compartidos”.

Compartir el tipo de una fila PostgreSQL con el navegador suele filtrar detalles de persistencia. Es mejor transformar la fila en el Repository y publicar un contrato HTTP deliberado.

---

## 20. Errores comunes y su causa

### Error 1 — `types` apunta al código fuente

```json
{
  "types": "./src/index.ts"
}
```

**Problema:** el consumidor recibe una ruta que puede no estar incluida y que depende de la configuración fuente del autor.  
**Corrección:** publica declaraciones emitidas y apunta a `./dist/index.d.ts`.

### Error 2 — `exports` anuncia un archivo excluido

```json
{
  "exports": {
    ".": "./dist/index.js"
  },
  "files": ["README.md"]
}
```

**Problema:** funciona en el repositorio, pero no después de instalar el tarball.  
**Corrección:** incluye todas las salidas anunciadas y verifica con `npm pack --dry-run`.

### Error 3 — Exportar tipos sin comportamiento runtime

```ts
type Finding = {
  id: string;
};

const finding = responseJson as Finding;
```

**Problema:** la aserción no valida la respuesta.  
**Corrección:** recibe `unknown` y aplica un schema ejecutable.

### Error 4 — Deep imports a `dist`

```ts
import { x } from "@siteops/audit-contracts/dist/internal/x.js";
```

**Problema:** el consumidor depende del layout interno.  
**Corrección:** crea un subpath público deliberado o no expongas el símbolo.

### Error 5 — Declarar `require` sin salida CommonJS

**Problema:** el mapa promete un formato que no existe.  
**Corrección:** publica solo `import` mientras el paquete sea ESM o implementa un build dual real y probado.

### Error 6 — Zod solo en `devDependencies`

**Problema:** el JavaScript publicado importa Zod, pero una instalación de producción puede no recibirlo.  
**Corrección:** colócalo en `dependencies` en este diseño.

### Error 7 — `sideEffects: false` sin comprobar módulos

**Problema:** un bundler puede eliminar inicialización necesaria.  
**Corrección:** mantén módulos puros o declara las excepciones reales.

### Error 8 — Suponer que `references` enlaza el paquete

**Problema:** `tsc -b` conoce el grafo, pero Node no encuentra el specifier.  
**Corrección:** configura workspaces o instala el paquete y conserva un manifiesto válido.

### Error 9 — Probar solo dentro del monorepo

**Problema:** hoisting, aliases o fuentes vecinas ocultan archivos faltantes.  
**Corrección:** instala el tarball en un consumidor limpio y ejecuta type check más smoke test runtime.

### Error 10 — Incluir secretos confiando en `.gitignore`

**Problema:** reglas de empaquetado y de Git no son idénticas.  
**Corrección:** nunca generes secretos dentro de la carpeta publicable e inspecciona el tarball.

---

## 21. Relación explícita con la arquitectura Full Stack

El paquete de contratos participa en varias capas, pero no reemplaza sus responsabilidades.

```text
React
  ↓ valida la respuesta HTTP con un schema ejecutable
HTTP
  ↓ transporta JSON sin tipos TypeScript
Node / Express
  ↓ recibe valores desconocidos
Router
  ↓ selecciona el endpoint y middlewares
Controller
  ↓ coordina request y response
Runtime Validation
  ↓ convierte unknown en input confiable
Service
  ↓ aplica reglas de negocio
Repository
  ↓ traduce entre dominio y persistencia
PostgreSQL
  ↓ almacena filas que también deben interpretarse con cuidado
Testing + Docker + CI/CD + Cloud
  ↓ verifican y ejecutan el mismo contrato en entornos repetibles
```

### React

Consume tipos para desarrollo y schemas para validar datos recibidos. No debe importar Controllers, Services ni Repositories.

### HTTP

Solo transporta bytes y JSON. Los tipos no cruzan la red.

### Node, Router y Controller

Reciben `params`, `query`, headers y body desde el exterior. Deben tratarlos como datos no confiables y dirigirlos a la validación runtime.

### Runtime Validation

Es el punto donde un schema como `CreateFindingInputSchema` convierte `unknown` en un valor seguro o produce un error controlado.

### Service

Recibe datos ya validados y aplica reglas. No debería interpretar detalles de Express.

### Repository y PostgreSQL

El Repository convierte filas a modelos de la aplicación. Compartir tipos no demuestra que una migración, query o driver haya devuelto el shape esperado.

### Testing, Docker, CI/CD y Cloud

Más adelante, las pruebas instalarán y consumirán el paquete; Docker construirá únicamente los artefactos necesarios; CI verificará build, tarball y compatibilidad; Cloud ejecutará JavaScript, no tipos. En esta etapa basta con dejar una frontera empaquetada y verificable.

---

## 22. Ejercicio — Empaquetar contratos del analizador

### Escenario

Crea conceptualmente el paquete ficticio `@siteops/config-analyzer-contracts` con estas entradas públicas:

```text
@siteops/config-analyzer-contracts
@siteops/config-analyzer-contracts/schemas
```

La entrada principal debe exponer:

- `AnalysisSeverity`;
- `AnalysisIssue`;
- `AnalysisResult`.

El subpath `/schemas` debe exponer schemas Zod runtime para validar un resultado recibido desde una API.

### Tu tarea

1. Diseña `src/index.ts` y `src/schemas.ts`.
2. Configura un `tsconfig.json` ESM con declaraciones.
3. Escribe un `package.json` con `type`, `main`, `types`, `exports` y `files`.
4. Decide dónde declarar Zod y explica por qué.
5. Impide imports de `src/internal/normalize-hostname.ts`.
6. Define los comandos de build y revisión del paquete.
7. Escribe un ejemplo de consumo que reciba `unknown` y valide el resultado.

### Restricciones

- No uses `any`.
- No apuntes `types` a `src`.
- No exportes patrones amplios como `"./*": "./dist/*.js"`.
- No añadas una condición `require`.
- No escribas `as AnalysisResult` para datos externos.
- No publiques fixtures, pruebas ni archivos `.env`.
- No muestres una solución completa del ejercicio.

### Pistas

1. El subpath `.` representa la entrada principal.
2. Coloca `types` antes de `import` dentro de cada entrada condicional.
3. Si el JavaScript emitido importa Zod, Zod es una dependencia runtime.
4. Usa `z.infer` para derivar tipos a partir del schema y evitar dos contratos divergentes.
5. Revisa el contenido con `npm pack --dry-run`.
6. Pregunta qué recibe realmente un consumidor después de instalar el tarball.

### Entrega esperada

- árbol de archivos;
- `tsconfig.json`;
- `package.json`;
- exports públicos de TypeScript;
- ejemplo corto de consumo seguro;
- explicación de la frontera pública.

---

## 23. Reto Full Stack — Diseñar y probar un SDK tipado

### Escenario

Diseña el empaquetado de `@siteops/sdk`, un SDK ficticio que consumirá la API HTTP de SiteOps Tracker.

Entradas públicas deseadas:

```text
@siteops/sdk
@siteops/sdk/client
@siteops/sdk/schemas
```

El cliente debe aceptar una dependencia `fetch` inyectada para poder probarse en Node y navegador. Toda respuesta HTTP comienza como `unknown` y se valida antes de devolverse.

### Tu reto

Define, sin implementar el SDK completo:

1. el árbol `src` y `dist`;
2. las tres entradas en `exports`;
3. las rutas `types` e `import` de cada entrada;
4. el `files` mínimo;
5. la ubicación de Zod en las dependencias;
6. una interfaz `SiteOpsClient` con `getFinding(id)`;
7. una firma para `createSiteOpsClient` que reciba `baseUrl` y `fetch`;
8. un smoke test de instalación del tarball;
9. una prueba que simule JSON inválido y espere un error de validación;
10. qué cambio de API considerarías major después de `1.0.0`.

### Condiciones

- El SDK no conoce Express ni PostgreSQL.
- El frontend no importa código fuente del backend.
- Ninguna ruta interna fuera de `exports` es consumible.
- Los tipos no reemplazan la validación.
- El cliente no lee variables de entorno globales; recibe configuración explícita.
- No implementes todavía CI/CD ni publicación real.

### Preguntas guía

- ¿El SDK debe exportar un tipo de fila PostgreSQL o un contrato HTTP? ¿Por qué?
- ¿Qué ocurre si `types` existe, pero el archivo de `import` falta?
- ¿Cómo descubrirías que `files` excluyó un subpath?
- ¿Qué dependencia pertenece al consumidor y cuál al paquete?
- ¿Cómo verificarías que el SDK funciona fuera del monorepo?

---

## 24. Preguntas de comprensión

Intenta responder sin volver a leer y después comprueba tus ideas.

1. ¿Qué diferencia existe entre compilar un proyecto y empaquetarlo?
2. ¿Qué describe `type: "module"`?
3. ¿Qué limitación tiene `main` frente a `exports`?
4. ¿Qué representa el subpath `.`?
5. ¿Por qué `types` debe apuntar a una declaración emitida?
6. ¿Qué ocurre con una ruta que no aparece en `exports`?
7. ¿Por qué añadir `exports` puede romper consumidores existentes?
8. ¿Qué diferencia existe entre `files` y `.gitignore`?
9. ¿Por qué Zod pertenece a `dependencies` en el ejemplo?
10. ¿Cuándo usarías `peerDependencies`?
11. ¿Qué comprueba `npm pack --dry-run` que `tsc -b` no comprueba?
12. ¿Por qué un bloque `require` no convierte ESM en CommonJS?
13. ¿Project References instala o enlaza paquetes?
14. ¿Qué parte del paquete permanece en runtime: `Finding` o `FindingSchema`?
15. ¿Por qué una respuesta HTTP sigue siendo `unknown` aunque el SDK publique `.d.ts`?

---

## 25. Relevancia para entrevistas técnicas

### Pregunta: ¿Para qué sirve `exports`?

**Respuesta esperada:** define las entradas públicas de un paquete, permite subpaths y condiciones y bloquea imports hacia rutas no declaradas. Encapsula el layout interno y convierte los entry points en parte explícita de la API.

### Pregunta: ¿Cuál es la diferencia entre `main` y `types`?

**Respuesta esperada:** `main` señala una entrada JavaScript runtime tradicional; `types` señala la declaración principal que usa TypeScript. Deben describir la misma API pública, pero cumplen funciones diferentes.

### Pregunta: ¿Por qué publicar `.d.ts` no garantiza seguridad de datos?

**Respuesta esperada:** las declaraciones solo intervienen durante el type checking y desaparecen en runtime. JSON de HTTP, formularios, APIs externas, archivos, variables de entorno y filas de base de datos deben validarse mediante código ejecutable.

### Pregunta: ¿Cómo evitarías publicar archivos accidentales?

**Respuesta esperada:** usaría una lista `files` restrictiva, construiría desde una salida limpia, ejecutaría `npm pack --dry-run`, inspeccionaría el tarball y realizaría un smoke test instalándolo en un consumidor aislado. Los secretos nunca deben generarse dentro del artefacto.

### Pregunta: ¿Qué diferencia hay entre Project References y workspaces?

**Respuesta esperada:** Project References describe el grafo de compilación para TypeScript. Un workspace gestiona y enlaza paquetes locales para el package manager. Ninguno reemplaza al otro ni a `exports`.

### Pregunta: ¿Cuándo va una dependencia en `dependencies`?

**Respuesta esperada:** cuando el código distribuido la necesita en runtime o cuando el contrato publicado requiere que esté disponible para el consumidor. Las herramientas usadas solo para construir y probar suelen ir en `devDependencies`.

### Respuesta breve de 30 segundos

> Al publicar una librería TypeScript alineo tres contratos: el JavaScript ejecutable, las declaraciones y el contenido del tarball. Uso `type` para declarar el formato de módulos, `exports` para definir las entradas públicas, `types` para la declaración principal y `files` para limitar lo distribuido. Después construyo y reviso `npm pack --dry-run`, porque un type check exitoso no garantiza que el paquete instalado tenga las rutas o dependencias correctas.

---

## 26. Checklist profesional

Antes de considerar listo un paquete TypeScript, comprueba:

- [ ] El nombre del paquete coincide con los imports esperados.
- [ ] La versión sigue una política conocida.
- [ ] `type` refleja el formato JavaScript real.
- [ ] `main` y la entrada `.` de `exports` no contradicen sus APIs.
- [ ] `types` apunta a un `.d.ts` incluido en el paquete.
- [ ] Cada subpath tiene salida runtime y declaración coherentes.
- [ ] Las condiciones específicas aparecen antes que las generales.
- [ ] No existe una condición `require` ficticia.
- [ ] `files` incluye todas las rutas anunciadas y excluye lo innecesario.
- [ ] No hay secretos ni información privada en el artefacto.
- [ ] Los imports internos no forman parte accidental de la API.
- [ ] Las dependencias runtime están en `dependencies`.
- [ ] Las herramientas de build están en `devDependencies`.
- [ ] `sideEffects` describe el comportamiento real.
- [ ] El paquete se construye desde un estado limpio.
- [ ] `npm pack --dry-run` muestra el contenido esperado.
- [ ] Un consumidor aislado puede instalar, tipar y ejecutar el tarball.
- [ ] Los datos externos entran como `unknown` y se validan en runtime.
- [ ] React no importa capas internas de Node, Services o PostgreSQL.

---

## 27. Resumen

- Compilar y empaquetar son etapas distintas.
- El consumidor necesita JavaScript, declaraciones y un manifiesto coherentes.
- `type` define cómo Node interpreta archivos `.js` dentro del paquete.
- `main` es una entrada principal tradicional; `exports` define una frontera pública moderna.
- `types` señala el contrato estático principal.
- Las condiciones `types` e `import` pueden dirigir al checker y al runtime hacia archivos diferentes de la misma API.
- Los subpaths permiten publicar entradas explícitas sin abrir toda la estructura interna.
- `files` controla el contenido distribuido y debe comprobarse sobre el tarball real.
- `dependencies`, `devDependencies` y `peerDependencies` modelan responsabilidades diferentes.
- Project References organiza el build, pero no enlaza ni instala paquetes.
- Un paquete ESM no se vuelve dual por añadir una condición `require`.
- Los tipos desaparecen en runtime; Zod u otra validación ejecutable sigue siendo necesaria en cada frontera externa.
- El paquete compartido debe exponer contratos HTTP deliberados, no detalles de Express o PostgreSQL.

---

## Referencias oficiales consultadas

- TypeScript Handbook — Publishing declaration files: <https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html>
- TypeScript Handbook — Modules Reference: <https://www.typescriptlang.org/docs/handbook/modules/reference.html>
- TypeScript Handbook — Choosing Compiler Options: <https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html>
- Node.js Documentation — Modules: Packages: <https://nodejs.org/api/packages.html>
- npm Docs — `package.json`: <https://docs.npmjs.com/cli/v11/configuring-npm/package-json/>
- npm Docs — `npm pack`: <https://docs.npmjs.com/cli/v11/commands/npm-pack/>

Consultadas el **30 de septiembre de 2026**.

---

# Próxima lección

**Lección 29 — Monorepos y workspaces: dependencias internas, enlaces locales y límites entre paquetes.**
