# Lección 29 — Monorepos y workspaces: dependencias internas, enlaces locales y límites entre paquetes

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, datos, reglas y escenarios de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos  

---

## Introducción

En la lección 27 aprendiste que **Project References** permite dividir TypeScript en proyectos compilables y que `tsc -b` entiende su orden de construcción. En la lección 28 aprendiste que cada paquete necesita un `package.json` coherente, entradas públicas mediante `exports`, declaraciones y JavaScript ejecutable.

Todavía falta conectar ambos mundos:

> ¿Cómo pueden varias aplicaciones y librerías vivir en un solo repositorio, instalar sus dependencias una sola vez e importarse entre sí por nombre de paquete?

Una respuesta común es un **monorepo con workspaces**.

Para SiteOps Tracker usaremos npm workspaces con estas piezas ficticias:

- una aplicación React;
- una API Node.js/Express;
- un paquete de contratos y schemas;
- un analizador de configuraciones;
- un SDK tipado.

La idea central de hoy es:

> Un workspace hace descubrible y enlazable un paquete local; no reemplaza sus dependencias declaradas, su build, su API pública ni la validación runtime.

---

## Objetivo

Al terminar esta lección podrás:

1. distinguir repositorio, monorepo, workspace, paquete y proyecto TypeScript;
2. configurar npm workspaces desde el `package.json` raíz;
3. declarar una dependencia interna mediante el nombre y la versión del paquete;
4. explicar qué enlace local crea `npm install` y qué problemas no resuelve;
5. importar entre paquetes sin atravesar sus carpetas internas;
6. diferenciar el grafo de instalación del grafo de compilación de TypeScript;
7. combinar workspaces, `exports` y Project References sin confundir sus funciones;
8. ejecutar scripts para un workspace concreto o para todos;
9. evitar dependencias fantasma provocadas por el hoisting;
10. relacionar estos límites con React → HTTP → Node → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL;
11. explicar por qué los tipos compartidos siguen sin validar HTTP, formularios, APIs externas, archivos, variables de entorno o filas de base de datos;
12. defender esta arquitectura en una entrevista técnica.

---

## 1. El problema: varios paquetes que deben evolucionar juntos

Imagina que SiteOps Tracker comienza con tres repositorios independientes:

```text
siteops-web/
siteops-api/
siteops-audit-contracts/
```

Muy pronto aparecen tareas repetidas:

- clonar y actualizar tres repositorios;
- coordinar versiones compatibles;
- publicar contratos antes de probar la API;
- ejecutar varias instalaciones;
- mantener configuraciones duplicadas;
- abrir varios pull requests para un solo cambio transversal;
- probar manualmente si frontend, backend y paquete compartido aún funcionan juntos.

También puede aparecer el extremo opuesto: colocar todo dentro de una sola aplicación sin límites.

```text
src/
├── frontend/
├── backend/
├── database/
└── shared-everything/
```

Esto reduce repositorios, pero permite acoplamientos accidentales:

```ts
// Mala frontera: React alcanza una implementación del backend.
import { findingRepository } from "../../backend/repositories/finding-repository.js";
```

El navegador no debe conocer un Repository de PostgreSQL. El problema no es solo la ruta larga: el import rompe la arquitectura.

Un monorepo bien diseñado busca dos propiedades al mismo tiempo:

1. **proximidad:** las piezas relacionadas cambian y se prueban juntas;
2. **límites:** cada paquete conserva una API pública y dependencias explícitas.

---

## 2. Vocabulario preciso

### 2.1 Repositorio

Es la unidad versionada por Git. Puede contener una o muchas aplicaciones o librerías.

### 2.2 Monorepo

Es un repositorio que contiene varios proyectos o paquetes relacionados. “Monorepo” describe una organización del código; no es una característica exclusiva de npm ni de TypeScript.

### 2.3 Workspace

En npm, un workspace es un paquete local incluido mediante el campo `workspaces` del `package.json` raíz. Durante `npm install`, npm puede enlazar esos paquetes en `node_modules` para que se consuman por su nombre.

### 2.4 Paquete

Es una carpeta con su propio `package.json`. Tiene identidad, versión, dependencias, scripts y, cuando corresponde, entradas públicas.

### 2.5 Proyecto TypeScript

Es una unidad definida por un `tsconfig.json`. Puede coincidir con un paquete, pero no es obligatorio.

### 2.6 Aplicación

Es una pieza desplegable, como `@siteops/web` o `@siteops/api`. Una aplicación puede ser un workspace y normalmente se marca como privada para impedir una publicación accidental.

La relación típica de esta lección será:

```text
un repositorio Git
└── un monorepo npm
    ├── workspace @siteops/web
    ├── workspace @siteops/api
    ├── workspace @siteops/audit-contracts
    ├── workspace @siteops/config-analyzer
    └── workspace @siteops/sdk
```

---

## 3. Arquitectura objetivo del monorepo

Una estructura inicial razonable es:

```text
siteops-tracker/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── api/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── packages/
│   ├── audit-contracts/
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── config-analyzer/
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── sdk/
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── package.json
├── package-lock.json
├── tsconfig.base.json
└── tsconfig.json
```

Convención usada:

- `apps/`: procesos o interfaces que se ejecutan y despliegan;
- `packages/`: librerías con una API reusable;
- raíz: coordinación de instalación, herramientas y comandos globales.

Esta es una convención, no una regla de npm. npm solo necesita patrones que apunten a carpetas con un `package.json` válido.

---

## 4. Configurar el `package.json` raíz

```json
{
  "name": "siteops-tracker-monorepo",
  "version": "0.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "clean": "tsc -b --clean",
    "build": "tsc -b",
    "check:types": "tsc -b --pretty false",
    "test": "npm run test --workspaces --if-present",
    "build:contracts": "npm run build --workspace=@siteops/audit-contracts",
    "build:api": "npm run build --workspace=@siteops/api"
  },
  "devDependencies": {
    "typescript": "<versión-compatible-del-proyecto>"
  }
}
```

### 4.1 `private: true`

La raíz coordina el repositorio, pero no representa una librería publicable. `private: true` evita una publicación accidental de ese paquete raíz.

No vuelve privados automáticamente a todos los workspaces. Cada paquete debe declarar su intención.

### 4.2 `workspaces`

Los patrones indican dónde debe buscar npm los paquetes locales:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

Una carpeta que coincide con el patrón pero no tiene `package.json` no constituye un paquete válido.

### 4.3 Un lockfile en la raíz

En este diseño se ejecuta la instalación desde la raíz y se versiona un `package-lock.json` raíz. El lockfile registra el árbol resuelto para una instalación reproducible.

```bash
npm install
```

En un entorno limpio o en CI se usará más adelante:

```bash
npm ci
```

No crees instalaciones independientes dentro de cada workspace salvo que tu estrategia haya sido diseñada expresamente así. Mezclar lockfiles y árboles instalados puede ocultar qué resolución se está probando.

---

## 5. La identidad de cada workspace

El paquete de contratos necesita un nombre único y una versión.

```json
{
  "name": "@siteops/audit-contracts",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "clean": "tsc -b --clean",
    "build": "tsc -b",
    "check:types": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "<versión-compatible-del-proyecto>"
  }
}
```

El nombre permite importar por una frontera estable:

```ts
import {
  CreateFindingInputSchema,
  type CreateFindingInput,
} from "@siteops/audit-contracts";
```

El consumidor no necesita saber que el paquete vive en `packages/audit-contracts`.

---

## 6. Declarar una dependencia interna

La API usa los contratos, por lo que su propio `package.json` debe declarar esa dependencia.

Desde la raíz puedes ejecutar:

```bash
npm install @siteops/audit-contracts --workspace=@siteops/api
```

Con un workspace local compatible, npm lo detecta, crea el enlace correspondiente y guarda un rango de versión estándar en el consumidor. El resultado conceptual es:

```json
{
  "name": "@siteops/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@siteops/audit-contracts": "^0.1.0"
  }
}
```

La declaración expresa dos cosas diferentes:

1. **relación lógica:** la API necesita `@siteops/audit-contracts`;
2. **compatibilidad:** acepta una versión que satisfaga el rango indicado.

En el entorno local npm enlaza el workspace. Fuera del monorepo, un consumidor necesitaría obtener una versión compatible desde un registro, un tarball u otra fuente configurada.

### La versión local debe ser compatible

Si el consumidor exige:

```json
{
  "dependencies": {
    "@siteops/audit-contracts": "^2.0.0"
  }
}
```

pero el workspace declara `0.1.0`, no debes asumir que npm usará el paquete local de cualquier manera. El rango es parte del contrato. Una incompatibilidad puede provocar una búsqueda en el registro o un error de instalación.

---

## 7. Qué significa el enlace local

Después de instalar, el árbol puede contener una entrada conceptual como esta:

```text
node_modules/
└── @siteops/
    └── audit-contracts -> ../../packages/audit-contracts
```

El detalle físico puede variar, pero el resultado importante es que la resolución por nombre encuentra el paquete local.

Esto permite:

```ts
import { FindingSchema } from "@siteops/audit-contracts";
```

en lugar de:

```ts
// Evitar: atraviesa carpetas y omite la frontera del paquete.
import { FindingSchema } from "../../../packages/audit-contracts/src/schemas.js";
```

El enlace **no** hace ninguna de estas tareas:

- no compila TypeScript;
- no genera `dist`;
- no corrige un `exports` roto;
- no añade una dependencia olvidada al `package.json`;
- no ordena el build;
- no valida respuestas HTTP;
- no impide ciclos entre paquetes;
- no convierte una API interna en pública.

---

## 8. Importar por la API pública, no por la ubicación física

### Correcto

```ts
import {
  FindingSchema,
  type Finding,
} from "@siteops/audit-contracts";
```

### Incorrecto: import relativo entre workspaces

```ts
import { FindingSchema } from "../../../packages/audit-contracts/src/schemas.js";
```

### Incorrecto: deep import no exportado

```ts
import { normalizeFinding } from "@siteops/audit-contracts/dist/internal/normalize-finding.js";
```

Importar por nombre obliga al consumidor a respetar `exports`. Esto permite reorganizar archivos internos sin romper a quien solo usa la API pública.

Una regla útil es:

> Si dos carpetas tienen `package.json` distintos, su comunicación debe parecerse a la de dos paquetes instalados, aunque vivan en el mismo repositorio.

---

## 9. Workspaces no sustituyen Project References

Hay varios grafos dentro del mismo monorepo.

| Grafo | Herramienta | Qué representa |
| --- | --- | --- |
| Dependencias de paquetes | npm y `package.json` | qué necesita instalar o enlazar cada paquete |
| Compilación TypeScript | `tsc -b` y `references` | qué proyecto debe construirse antes |
| Imports públicos | Node/bundler y `exports` | qué módulos puede resolver el runtime |
| Arquitectura de aplicación | reglas del equipo | qué capa puede depender de cuál |

Si la API depende del paquete de contratos, deben alinearse por lo menos dos declaraciones.

### Dependencia npm

```json
{
  "dependencies": {
    "@siteops/audit-contracts": "^0.1.0"
  }
}
```

### Referencia TypeScript

```jsonc
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/api.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "references": [
    { "path": "../../packages/audit-contracts" }
  ]
}
```

La primera relación sirve al package manager y al runtime. La segunda sirve al build de TypeScript.

No siempre tienen que existir ambas: una dependencia solo runtime puede no requerir una Project Reference; una organización especial de proyectos puede tener referencias internas que no sean paquetes publicables. Pero cuando cada proyecto TypeScript coincide con un paquete, mantener los grafos alineados reduce sorpresas.

---

## 10. `tsconfig.json` coordinador en la raíz

La raíz puede contener un proyecto solución sin archivos propios:

```jsonc
// tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./packages/audit-contracts" },
    { "path": "./packages/config-analyzer" },
    { "path": "./packages/sdk" },
    { "path": "./apps/api" },
    { "path": "./apps/web" }
  ]
}
```

Entonces:

```bash
npm run build
```

ejecuta:

```bash
tsc -b
```

Build mode inspecciona las referencias y construye los proyectos necesarios. El orden correcto proviene del grafo de `references`, no de adivinar una lista manual.

En cambio:

```bash
npm run build --workspaces
```

ejecuta el script `build` de cada workspace seleccionado. npm documenta que los comandos se ejecutan según el orden de workspaces configurado; esa iteración no debe confundirse con un planificador que comprenda automáticamente el grafo TypeScript.

Para el build compuesto de esta lección, `tsc -b` es la fuente de verdad del orden de compilación.

---

## 11. Configuración base compartida sin borrar diferencias

La raíz puede aportar opciones comunes:

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": false
  }
}
```

Cada workspace amplía lo que necesita:

```jsonc
// packages/audit-contracts/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "dist/audit-contracts.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

No fuerces todas las aplicaciones a tener exactamente las mismas bibliotecas ambientales.

- React necesita tipos del DOM.
- Una librería Node pura no debería depender accidentalmente de `window`.
- Un paquete compartido debe evitar APIs ambientales que limiten consumidores sin necesidad.

Compartir una base reduce duplicación; cada proyecto conserva su contexto real.

---

## 12. Ejemplo tipado: paquete de contratos

```ts
// packages/audit-contracts/src/index.ts
import { z } from "zod";

export const FindingStatusSchema = z.enum([
  "open",
  "in_progress",
  "resolved",
]);

export const CreateFindingInputSchema = z.object({
  siteId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
});

export const FindingSchema = CreateFindingInputSchema.extend({
  id: z.string().uuid(),
  status: FindingStatusSchema,
});

export type FindingStatus = z.infer<typeof FindingStatusSchema>;
export type CreateFindingInput = z.infer<typeof CreateFindingInputSchema>;
export type Finding = z.infer<typeof FindingSchema>;
```

Este paquete expone dos categorías:

- tipos estáticos: `Finding`, `CreateFindingInput`;
- valores runtime: `FindingSchema`, `CreateFindingInputSchema`.

Su `package.json` debe declarar Zod porque el JavaScript distribuido lo importa.

---

## 13. Ejemplo tipado: consumo desde la API

```ts
// apps/api/src/controllers/create-finding-controller.ts
import {
  CreateFindingInputSchema,
  type CreateFindingInput,
} from "@siteops/audit-contracts";

type HttpRequest = {
  readonly body: unknown;
};

type HttpResponse = {
  readonly status: number;
  readonly body: unknown;
};

type CreateFindingService = {
  execute(input: CreateFindingInput): Promise<{ readonly id: string }>;
};

export function makeCreateFindingController(
  service: CreateFindingService,
) {
  return async function createFindingController(
    request: HttpRequest,
  ): Promise<HttpResponse> {
    const parsed = CreateFindingInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return {
        status: 400,
        body: {
          error: "INVALID_REQUEST_BODY",
          issues: parsed.error.issues,
        },
      };
    }

    const created = await service.execute(parsed.data);

    return {
      status: 201,
      body: created,
    };
  };
}
```

El workspace resuelve el import. TypeScript comprueba el contrato. Zod valida el valor real.

Estas tres acciones no son equivalentes.

---

## 14. Los tipos desaparecen en runtime

Este código compila:

```ts
import type { CreateFindingInput } from "@siteops/audit-contracts";

function unsafeBody(body: unknown): CreateFindingInput {
  return body as CreateFindingInput;
}
```

Pero no inspecciona `body`. La assertion desaparece al emitir JavaScript.

Un monorepo facilita compartir tipos, y precisamente por eso puede crear una falsa sensación de seguridad:

```ts
// Incorrecto: el genérico no obliga al servidor a enviar ese shape.
const response = await fetch("/api/findings/123");
const finding = (await response.json()) as Finding;
```

Las siguientes fuentes siguen siendo externas o inciertas:

- cuerpos, parámetros, query strings y headers HTTP;
- formularios de React;
- respuestas de APIs externas;
- archivos JSON, CSV o YAML;
- variables de entorno;
- mensajes de colas;
- filas devueltas por drivers de base de datos;
- datos antiguos creados antes de una migración.

La forma segura mantiene la frontera explícita:

```ts
const payload: unknown = await response.json();
const finding = FindingSchema.parse(payload);
```

> Compartir un tipo reduce duplicación estática. Compartir un schema ejecutable permite reutilizar una validación. Ninguno autoriza a saltarse la validación en la frontera.

---

## 15. Dependencias honestas y el peligro del hoisting

Un package manager puede colocar dependencias en un `node_modules` superior para reutilizarlas. Eso no concede permiso arquitectónico para importarlas desde cualquier workspace.

Supón que `@siteops/api` importa Express, pero Express solo está declarado en la raíz:

```jsonc
// Incorrecto como propiedad del paquete api
{
  "devDependencies": {
    "express": "<versión>"
  }
}
```

La API podría compilar en tu máquina porque la resolución encuentra el paquete hoisted. Sin embargo, el `package.json` de `@siteops/api` no expresa su dependencia runtime.

Regla práctica:

- si el código de un workspace importa una dependencia en runtime, declárala en ese workspace;
- si sus `.d.ts` públicos exponen tipos de otra dependencia, asegúrate de que el consumidor pueda resolverla;
- si una herramienta solo coordina todo el repositorio, puede pertenecer a `devDependencies` de la raíz;
- no uses la presencia física dentro de `node_modules` como prueba de propiedad.

### Dependencia fantasma

```ts
// Puede funcionar localmente por hoisting, aunque falte en package.json.
import express from "express";
```

Una instalación aislada del paquete, un cambio de versión o una estrategia distinta de instalación puede romperlo.

El smoke test de un tarball, aprendido en la lección 28, ayuda a descubrir este acoplamiento accidental.

---

## 16. No uses `paths` como sustituto de workspaces

Una configuración como esta puede parecer atractiva:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@siteops/audit-contracts": [
        "./packages/audit-contracts/src/index.ts"
      ]
    }
  }
}
```

Pero `paths` informa a TypeScript cómo resolver un import durante el análisis. Por sí solo:

- no instala ni enlaza el paquete;
- no reescribe el specifier emitido;
- no enseña a Node cómo encontrarlo;
- puede saltarse `exports` y leer el código fuente;
- puede ocultar un paquete mal construido.

Los aliases son útiles cuando el runtime o bundler tiene una configuración compatible y existe una razón clara. Para representar dependencias entre paquetes reales, prefiere:

1. workspaces para instalación y enlace;
2. `package.json` para identidad y dependencias;
3. `exports` para la API pública;
4. Project References para el build TypeScript.

---

## 17. Ejecutar scripts por workspace

### Un workspace por nombre

```bash
npm run build --workspace=@siteops/audit-contracts
```

Forma abreviada:

```bash
npm run build -w @siteops/audit-contracts
```

### Varios workspaces

```bash
npm run test \
  --workspace=@siteops/audit-contracts \
  --workspace=@siteops/config-analyzer
```

### Todos los workspaces que tengan el script

```bash
npm run test --workspaces --if-present
```

`--if-present` evita fallar solo porque un workspace aún no define ese script. Úsalo deliberadamente: también puede ocultar que olvidaste agregar una prueba obligatoria.

### Instalar una dependencia externa en un workspace

```bash
npm install zod --workspace=@siteops/audit-contracts
```

### Inspeccionar la dependencia interna

```bash
npm ls @siteops/audit-contracts --workspace=@siteops/api
```

Los comandos deben ejecutarse desde una raíz con la configuración de workspaces reconocida.

---

## 18. Diseñar límites de paquetes

Una frontera útil separa responsabilidades que pueden explicarse y probarse por separado.

### `@siteops/audit-contracts`

Puede contener:

- contratos HTTP deliberados;
- schemas Zod para requests y responses;
- literal unions y errores serializables.

No debe contener:

- Controllers de Express;
- componentes de React;
- SQL;
- conexiones a PostgreSQL.

### `@siteops/config-analyzer`

Puede contener:

- funciones puras para analizar texto ya recibido;
- reglas tipadas;
- resultados independientes del transporte.

No debe leer automáticamente variables de entorno ni abrir conexiones a base de datos al importarse.

### `@siteops/sdk`

Puede contener:

- un cliente HTTP;
- contratos y schemas públicos;
- manejo tipado de respuestas;
- configuración explícita como `baseUrl` y una implementación de `fetch`.

No debe importar Services internos ni Repositories.

### `@siteops/api`

Puede contener:

- Router, Controllers, Services, Repositories;
- composición de dependencias;
- adaptación a Express y PostgreSQL.

No debe ser importado por React.

### `@siteops/web`

Puede contener:

- componentes y hooks React;
- estado de interfaz;
- llamadas al SDK o adaptadores HTTP;
- validación de formularios y respuestas.

No debe conocer tablas ni drivers de PostgreSQL.

---

## 19. Dependencias permitidas y ciclos

Un grafo inicial puede ser:

```text
@siteops/web ──► @siteops/sdk ──► @siteops/audit-contracts
                                      ▲
@siteops/api ─────────────────────────┘
      │
      └────────► @siteops/config-analyzer
```

Evita ciclos como:

```text
@siteops/sdk ──► @siteops/api ──► @siteops/sdk
```

Un ciclo suele indicar que una responsabilidad está mal ubicada.

Antes de crear un nuevo paquete “shared”, pregunta:

1. ¿Tiene una responsabilidad coherente?
2. ¿Existe una API pública pequeña?
3. ¿Hay más de un consumidor real o una razón clara de aislamiento?
4. ¿Puede evitar dependencias hacia capas superiores?
5. ¿Su extracción simplifica el grafo o solo mueve archivos?

Un paquete llamado `utils` que importa React, Express y el driver de PostgreSQL no es compartido: es un punto de acoplamiento.

---

## 20. Paquetes privados y publicables

No todo workspace debe publicarse.

### Aplicación privada

```json
{
  "name": "@siteops/api",
  "private": true
}
```

### Librería interna privada

```json
{
  "name": "@siteops/config-analyzer",
  "version": "0.1.0",
  "private": true
}
```

### Librería preparada para distribución

```json
{
  "name": "@siteops/sdk",
  "version": "0.1.0",
  "files": ["dist"],
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  }
}
```

Aunque un paquete sea solo interno, conviene mantener una versión y dependencias coherentes. Los rangos permiten detectar desacuerdos y facilitan una futura extracción.

`private: true` protege contra publicar por accidente; no crea controles de acceso, cifrado ni secretos seguros.

---

## 21. Flujo de trabajo seguro

Un flujo local razonable desde la raíz es:

```bash
# 1. Instalar o actualizar el árbol según package.json
npm install

# 2. Limpiar salidas del build compuesto
npm run clean

# 3. Construir de acuerdo con Project References
npm run build

# 4. Ejecutar scripts disponibles en los workspaces
npm run test --workspaces --if-present

# 5. Revisar un paquete publicable
npm pack --dry-run --workspace=@siteops/audit-contracts
```

Antes de confirmar un cambio transversal revisa:

- que el lockfile refleje la instalación;
- que cada import externo tenga una dependencia declarada;
- que cada import interno use el nombre del paquete;
- que los rangos internos acepten las versiones locales;
- que `tsc -b` construya desde un estado limpio;
- que `exports` apunte a archivos existentes;
- que las pruebas no dependan de una salida vieja;
- que ningún paquete consuma detalles internos de otro;
- que los schemas sigan validando datos externos.

---

## 22. Cuándo utilizar un monorepo con workspaces

Es una buena opción cuando:

- varias aplicaciones cambian junto con paquetes compartidos;
- quieres un solo cambio atómico para frontend, API y contrato;
- el equipo necesita una instalación y un lockfile coordinados;
- deseas reutilizar tooling y configuración sin eliminar límites;
- ejecutas pruebas de integración entre consumidores locales;
- mantienes un SDK y su API en el mismo ciclo de desarrollo;
- quieres mostrar en portafolio una arquitectura Full Stack coherente.

En SiteOps Tracker permite demostrar:

- modelado de contratos;
- separación frontend/backend;
- validación en runtime;
- paquetes ESM tipados;
- build compuesto;
- disciplina de dependencias;
- preparación para Testing, Docker y CI/CD posteriores.

---

## 23. Cuándo evitarlo

No adoptes un monorepo únicamente porque parezca más avanzado.

Puede no convenir cuando:

- existe una sola aplicación pequeña sin componentes reutilizables;
- los proyectos no comparten ciclo de cambios, equipo ni políticas;
- los permisos del repositorio deben estar completamente separados;
- el tooling añadido cuesta más que el problema que resuelve;
- intentas ocultar una arquitectura acoplada detrás de muchas carpetas;
- cada paquete tendría un solo archivo sin frontera significativa.

Un monorepo no garantiza modularidad. Puedes tener muchos paquetes fuertemente acoplados o una aplicación única con módulos internos muy claros.

La pregunta correcta es:

> ¿Esta frontera hace explícitas la propiedad, las dependencias y la API, o solo añade configuración?

---

## 24. Errores comunes y su causa

### Error 1 — Ejecutar `npm install` en cada carpeta

**Problema:** aparecen árboles y lockfiles independientes que ya no representan una resolución única.  
**Corrección:** instala desde la raíz del monorepo y usa `--workspace` para dirigir operaciones.

### Error 2 — Importar directamente desde `src` de otro paquete

```ts
import { x } from "../../../packages/sdk/src/internal/x.js";
```

**Problema:** se omiten `exports`, el build y la encapsulación.  
**Corrección:** importa una entrada pública por nombre de paquete.

### Error 3 — Confiar en una dependencia hoisted

**Problema:** el código encuentra una librería que su propio manifiesto no declara.  
**Corrección:** declara la dependencia en el workspace que la usa.

### Error 4 — Creer que el enlace compila TypeScript

**Problema:** el paquete se resuelve, pero `dist/index.js` no existe.  
**Corrección:** ejecuta el build compuesto o una estrategia de desarrollo explícita.

### Error 5 — Usar `paths` como instalador

**Problema:** el editor resuelve el alias, pero Node no.  
**Corrección:** configura un paquete real y un workspace; usa aliases solo con soporte equivalente en el runtime.

### Error 6 — Desalinear versión y rango interno

**Problema:** el consumidor pide una versión que el workspace local no satisface.  
**Corrección:** actualiza de manera deliberada la versión, el rango y los consumidores afectados.

### Error 7 — Confundir `npm run --workspaces` con orden topológico

**Problema:** un consumidor puede construirse antes que su dependencia.  
**Corrección:** usa `tsc -b` con referencias correctas para el grafo TypeScript o una herramienta que declare explícitamente su estrategia.

### Error 8 — Crear un paquete compartido que conoce todas las capas

**Problema:** React, Express y PostgreSQL quedan acoplados por una supuesta carpeta común.  
**Corrección:** comparte contratos deliberados o lógica pura, no implementaciones de capas.

### Error 9 — Suponer que un tipo valida JSON

```ts
const finding = (await response.json()) as Finding;
```

**Problema:** la assertion desaparece en runtime.  
**Corrección:** recibe `unknown` y valida con un schema ejecutable.

### Error 10 — Importar un tipo como valor

```ts
import { Finding } from "@siteops/audit-contracts";
```

**Problema:** según la configuración, puedes generar un import runtime innecesario o recibir un error porque `Finding` solo existe como tipo.  
**Corrección:** usa `import type { Finding } ...` cuando solo necesitas información estática.

### Error 11 — Permitir ciclos entre workspaces

**Problema:** el orden de build, inicialización y responsabilidades se vuelve ambiguo.  
**Corrección:** mueve el contrato común a una capa inferior o rediseña la dirección de dependencias.

### Error 12 — Marcar la raíz como publicable

**Problema:** un comando accidental puede intentar publicar el coordinador del repositorio.  
**Corrección:** usa `private: true` en la raíz y también en cada aplicación no publicable.

---

## 25. Relación explícita con la arquitectura Full Stack

El monorepo reúne las piezas, pero cada capa conserva su responsabilidad.

```text
React
  ↓ envía formulario y valida respuesta con schemas públicos
HTTP
  ↓ transporta JSON sin tipos TypeScript
Node / Express
  ↓ recibe valores externos
Router
  ↓ selecciona endpoint y middleware
Controller
  ↓ coordina request y response
Runtime Validation
  ↓ convierte unknown en input confiable
Service
  ↓ aplica reglas del caso de uso
Repository
  ↓ traduce dominio y persistencia
PostgreSQL
  ↓ conserva filas y restricciones
Testing + Docker + CI/CD + Cloud
  ↓ verifican, empaquetan y ejecutan artefactos reproducibles
```

### React

`@siteops/web` puede depender de `@siteops/sdk` y de contratos destinados al navegador. No importa Controllers, Services ni Repositories.

### HTTP

La red no transporta interfaces TypeScript. El cliente envía y recibe bytes; los datos deben serializarse y validarse.

### Node, Router y Controller

`@siteops/api` adapta Express a contratos propios. El Controller no debe confiar en `request.body` solo porque el tipo del editor parece correcto.

### Runtime Validation

Los schemas compartidos pueden residir en `@siteops/audit-contracts`, siempre que su API sea deliberada y no exponga detalles internos de persistencia.

### Service

Recibe valores ya validados y ejecuta reglas. Puede depender de tipos de dominio y puertos, no de React.

### Repository y PostgreSQL

Permanecen en la API o en un paquete backend específico. React no consume tipos de filas. El Repository transforma resultados del driver y debe tratar con cuidado valores que llegan de la base.

### Testing

Más adelante habrá pruebas unitarias por paquete, integración de API y E2E. El monorepo permitirá ejecutar conjuntos coordinados, pero cada workspace deberá declarar sus scripts y dependencias de prueba.

### Docker

Una imagen de la API necesitará solo los paquetes y artefactos requeridos. Un contexto de build indiscriminado puede copiar todo el monorepo y aumentar tamaño o filtrar archivos; se estudiará en su etapa.

### CI/CD y Cloud

CI instalará desde el lockfile, ejecutará build y pruebas, y producirá artefactos. Cloud ejecutará JavaScript y contenedores, no tipos TypeScript ni enlaces locales de tu laptop.

---

## 26. Ejercicio — Crear el esqueleto del monorepo

### Escenario

Diseña un monorepo ficticio de SiteOps Tracker con estos workspaces:

```text
@siteops/web
@siteops/api
@siteops/audit-contracts
@siteops/config-analyzer
```

Relaciones deseadas:

- `web` depende de `audit-contracts`;
- `api` depende de `audit-contracts` y `config-analyzer`;
- los dos paquetes de `packages/` no dependen de las aplicaciones;
- ninguna pieza forma un ciclo.

### Tu tarea

1. Escribe el árbol de directorios.
2. Crea el `package.json` raíz con `private` y `workspaces`.
3. Define nombre, versión y condición `private` de cada workspace.
4. Declara las dependencias internas de `web` y `api` con rangos compatibles.
5. Diseña un `tsconfig.json` solución con Project References.
6. Añade las `references` de cada consumidor.
7. Escribe los comandos para instalar, construir y ejecutar scripts de todos los workspaces.
8. Define tres reglas de imports permitidos y tres prohibidos.
9. Explica dónde debe declararse Zod si `audit-contracts` lo importa en runtime.
10. Muestra cómo validarías un `response.json()` antes de tratarlo como `Finding`.

### Restricciones

- No uses `any`.
- No uses imports relativos entre workspaces.
- No hagas deep imports a `dist` o `src`.
- No uses `paths` para reemplazar la dependencia npm.
- No declares dependencias runtime solo en la raíz.
- No uses assertions para validar datos externos.
- No implementes aún Docker ni CI/CD.
- No publiques ningún paquete real.

### Pistas

1. El `name` del paquete es el specifier que escribirán los consumidores.
2. `workspaces` enlaza paquetes; `references` ordena proyectos TypeScript.
3. La raíz normalmente es privada.
4. Las aplicaciones también suelen ser privadas.
5. El rango del consumidor debe aceptar la versión local.
6. Un import disponible por hoisting sigue necesitando una declaración correcta.
7. `unknown` más un schema runtime es una frontera honesta.

### Entrega esperada

- árbol del monorepo;
- cinco archivos `package.json` conceptuales;
- `tsconfig.json` solución;
- dos `tsconfig.json` consumidores con referencias;
- comandos de instalación y build;
- matriz pequeña de dependencias permitidas;
- ejemplo corto de validación runtime.

No se incluye una solución completa: primero intenta diseñar el grafo y justifica cada flecha.

---

## 27. Reto Full Stack — Añadir un SDK sin romper límites

### Escenario

Añade `@siteops/sdk` al monorepo. React lo usará para consumir la API, pero el SDK no puede importar código del backend.

### Tu reto

Define:

1. dónde vive el workspace;
2. su `name`, `version`, `private`, `exports` y `files`;
3. su dependencia hacia `@siteops/audit-contracts`;
4. qué workspace puede depender del SDK;
5. qué imports debe prohibir;
6. la firma de `createSiteOpsClient` con `baseUrl` y `fetch` inyectados;
7. la firma de `getFinding(id)`;
8. dónde ocurre la validación de la respuesta HTTP;
9. cómo se representa el error de status HTTP frente al error de schema;
10. qué referencias TypeScript necesita;
11. qué comandos ejecutarían build y prueba solo del SDK;
12. cómo comprobarías el tarball en un consumidor aislado.

Firma orientativa, no solución completa:

```ts
import type { Finding } from "@siteops/audit-contracts";

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type SiteOpsClient = {
  getFinding(id: string): Promise<Finding>;
};

export declare function createSiteOpsClient(options: {
  readonly baseUrl: string;
  readonly fetch: FetchLike;
}): SiteOpsClient;
```

Debes completar el diseño, no copiar tipos del Repository ni asumir que `response.json()` ya es un `Finding`.

---

## 28. Preguntas de comprensión

Responde sin consultar y después verifica tus ideas.

1. ¿Qué diferencia existe entre monorepo y workspace?
2. ¿Por qué un workspace es también un paquete?
3. ¿Qué hace el campo `workspaces`?
4. ¿Por qué la raíz suele usar `private: true`?
5. ¿Qué relación existe entre el nombre del paquete y el import del consumidor?
6. ¿Qué ocurre si el rango del consumidor no acepta la versión local?
7. ¿Qué crea `npm install` para los paquetes locales?
8. ¿Por qué un enlace local no reemplaza el build?
9. ¿Qué diferencia existe entre `dependencies` y `references`?
10. ¿Por qué `npm run --workspaces` no equivale necesariamente a un build topológico?
11. ¿Qué problema causa importar desde `../../../packages/x/src`?
12. ¿Qué es una dependencia fantasma?
13. ¿Por qué el hoisting no elimina la obligación de declarar dependencias?
14. ¿Por qué `paths` no enseña a Node a resolver un módulo?
15. ¿Qué paquete debe declarar Zod si su JavaScript lo importa?
16. ¿React debería importar un tipo de fila PostgreSQL? ¿Por qué?
17. ¿Qué diferencia existe entre compartir un tipo y compartir un schema?
18. ¿Por qué un body HTTP comienza como `unknown`?
19. ¿Cómo detectarías un ciclo entre paquetes?
20. ¿Qué ventaja ofrece un smoke test fuera del monorepo?

---

## 29. Relevancia para entrevistas técnicas

### Pregunta: ¿Qué problema resuelven los workspaces?

**Respuesta esperada:** permiten gestionar varios paquetes locales desde una raíz, coordinar la instalación y enlazarlos automáticamente para consumirlos por nombre. No sustituyen el build, los manifiestos ni la API pública.

### Pregunta: ¿En qué se diferencian npm workspaces y TypeScript Project References?

**Respuesta esperada:** workspaces gestiona paquetes, instalación y enlaces locales; Project References describe el grafo de proyectos TypeScript y permite a `tsc -b` construir dependencias en el orden necesario.

### Pregunta: ¿Por qué no importarías directamente desde el `src` de otro workspace?

**Respuesta esperada:** porque se salta `exports`, acopla al layout interno y puede ocultar errores de empaquetado o build. El consumidor debe usar el nombre y las entradas públicas del paquete.

### Pregunta: ¿Qué es una dependencia fantasma?

**Respuesta esperada:** una librería que el código puede resolver por hoisting o por otra dependencia, aunque el workspace consumidor no la declare. Puede romperse al instalar de forma aislada o cambiar el árbol.

### Pregunta: ¿Un contrato TypeScript compartido valida datos entre frontend y backend?

**Respuesta esperada:** no. Los tipos desaparecen al ejecutar. HTTP transporta datos sin tipos; frontend y backend deben validar sus fronteras con schemas o código runtime.

### Pregunta: ¿Cómo evitarías ciclos en un monorepo?

**Respuesta esperada:** definiría una dirección de dependencias, mantendría paquetes inferiores independientes de aplicaciones, extraería contratos verdaderamente comunes y verificaría que cada referencia tenga una sola dirección.

### Respuesta breve de 30 segundos

> En un monorepo uso npm workspaces para instalar y enlazar paquetes locales por su nombre, y Project References para que TypeScript comprenda el grafo de build. Cada workspace conserva su `package.json`, dependencias y `exports`; los consumidores nunca importan desde carpetas internas. Además, trato HTTP y otras entradas como `unknown`, porque compartir tipos dentro del repositorio no crea validación runtime.

---

## 30. Checklist profesional

Antes de considerar sano el monorepo, comprueba:

- [ ] La raíz tiene `private: true`.
- [ ] Los patrones `workspaces` incluyen solo paquetes previstos.
- [ ] Cada workspace tiene un nombre único.
- [ ] Cada paquete interno tiene una versión definida.
- [ ] Cada aplicación no publicable es privada.
- [ ] Existe un lockfile raíz versionado.
- [ ] La instalación se ejecuta desde la raíz.
- [ ] Las dependencias internas aparecen en el `package.json` del consumidor.
- [ ] Los rangos internos aceptan las versiones locales.
- [ ] Cada dependencia runtime externa pertenece al workspace que la importa.
- [ ] No existen dependencias fantasma basadas en hoisting.
- [ ] Los imports entre workspaces usan nombres de paquete.
- [ ] No hay imports directos a `src`, `dist` o rutas internas no exportadas.
- [ ] `exports` señala JavaScript y declaraciones existentes.
- [ ] El build genera `dist` antes de la ejecución runtime.
- [ ] Project References representan el grafo TypeScript.
- [ ] El grafo de paquetes no contiene ciclos.
- [ ] React no depende de la API, Services, Repositories ni PostgreSQL.
- [ ] El SDK no importa implementaciones del backend.
- [ ] Los contratos HTTP no exponen filas de base de datos.
- [ ] Los tipos puros se importan con `import type` cuando corresponde.
- [ ] Los cuerpos HTTP y respuestas externas comienzan como `unknown`.
- [ ] Los schemas runtime se ejecutan en las fronteras apropiadas.
- [ ] Un build limpio con `tsc -b` finaliza correctamente.
- [ ] Los paquetes publicables pasan `npm pack --dry-run`.
- [ ] Un consumidor aislado puede instalar y ejecutar el tarball.

---

## 31. Resumen

- Un monorepo contiene varios proyectos relacionados en un repositorio.
- npm workspaces descubre y enlaza paquetes locales durante la instalación.
- Cada workspace sigue siendo un paquete con identidad, versión y dependencias propias.
- La raíz privada coordina instalación, lockfile y scripts.
- Una dependencia interna debe declararse por nombre y con un rango compatible.
- El enlace local permite resolver el paquete, pero no lo compila.
- Los consumidores deben usar la API pública definida por `exports`.
- Los imports relativos entre paquetes destruyen encapsulación.
- Workspaces y Project References representan grafos diferentes y complementarios.
- `tsc -b` usa referencias para construir proyectos en el orden necesario.
- El hoisting puede ocultar dependencias no declaradas; cada paquete debe ser honesto.
- `paths` no es un reemplazo de instalación, enlace ni resolución runtime.
- Los límites deben impedir que React conozca Express o PostgreSQL.
- Los paquetes compartidos deben contener contratos deliberados o lógica pura, no todas las capas.
- Los tipos TypeScript desaparecen en runtime.
- HTTP, formularios, APIs externas, archivos, variables de entorno y base de datos requieren validación ejecutable.
- Zod pertenece al paquete cuyo JavaScript lo importa en este diseño.
- Un smoke test aislado revela acoplamientos que el monorepo puede ocultar.

---

## Referencias oficiales consultadas

- npm Docs — Workspaces: <https://docs.npmjs.com/cli/v11/using-npm/workspaces/>
- npm Docs — `package.json` y campo `workspaces`: <https://docs.npmjs.com/cli/v11/configuring-npm/package-json/>
- npm Docs — `npm install`: <https://docs.npmjs.com/cli/v11/commands/npm-install/>
- npm Docs — `npm run-script`: <https://docs.npmjs.com/cli/v11/commands/npm-run-script/>
- npm Docs — `npm pack`: <https://docs.npmjs.com/cli/v11/commands/npm-pack/>
- TypeScript Handbook — Project References: <https://www.typescriptlang.org/docs/handbook/project-references.html>
- TypeScript Handbook — Modules Reference: <https://www.typescriptlang.org/docs/handbook/modules/reference.html>
- Node.js Documentation — Modules: Packages: <https://nodejs.org/api/packages.html>

Consultadas el **1 de octubre de 2026**.

---

# Próxima lección

**Lección 30 — Versionado semántico y evolución segura de contratos TypeScript.**
