# Lección 25 — `tsconfig.json`: `strict`, `module`, `moduleResolution`, `target`, `lib` y `types`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos  

---

## Introducción

En la lección anterior organizaste el código con módulos ES, `import`, `export` y límites entre responsabilidades. Sin embargo, escribir imports correctos no basta: TypeScript necesita saber **qué proyecto está analizando, qué nivel de seguridad debe exigir, qué entorno ejecutará el JavaScript y cómo debe resolver cada módulo**.

Ese contrato vive principalmente en `tsconfig.json`.

Un `tsconfig.json` mal alineado puede producir situaciones engañosas:

- el editor acepta un import, pero Node.js no puede cargarlo;
- el código usa `document` en un backend aunque no existe en Node;
- una lectura de array se considera `string` aunque podría devolver `undefined`;
- los tests reconocen `describe` globalmente, pero el código de producción también;
- el compilador transforma el código para una versión de JavaScript que el runtime no soporta;
- el frontend recibe tipos de Node que no debería conocer;
- `tsc` compila correctamente, pero una variable de entorno inválida rompe la aplicación en producción.

Configurar TypeScript no consiste en copiar un archivo de Internet. Consiste en describir con precisión el contrato de cada entorno.

> `tsconfig.json` gobierna el análisis y, cuando corresponde, la emisión de JavaScript. No instala APIs, no crea polyfills, no valida datos externos y no reemplaza la configuración del runtime.

---

## Objetivo

Al terminar esta lección podrás:

1. explicar por qué existe `tsconfig.json`;
2. distinguir archivos raíz, grafo de dependencias y salida compilada;
3. activar y defender el modo `strict`;
4. reconocer opciones de seguridad que no están incluidas automáticamente en `strict`;
5. diferenciar `target` de `lib`;
6. diferenciar `module` de `moduleResolution`;
7. configurar Node.js ESM con `NodeNext`;
8. configurar React con un bundler usando `Bundler`;
9. controlar tipos globales mediante `types`;
10. crear configuraciones separadas para aplicación, frontend y tests;
11. diagnosticar imports con `--showConfig`, `--listFiles` y `--traceResolution`;
12. explicar por qué TypeScript y `tsconfig.json` no validan HTTP, formularios, archivos, variables de entorno ni PostgreSQL en runtime.

---

## 1. El problema que resuelve `tsconfig.json`

Imagina esta función de SiteOps Tracker:

```ts
export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}
```

La función está tipada, pero quedan preguntas que el archivo no responde:

- ¿puede usarse `String.prototype.trim` en el runtime objetivo?
- ¿se compilará a ESM o CommonJS?
- ¿puede el proyecto usar APIs del navegador?
- ¿`null` y `undefined` se comprueban estrictamente?
- ¿dónde se escribirán los archivos JavaScript?
- ¿los tests forman parte del build de producción?
- ¿cómo se resuelve `./device.js` desde un archivo `.ts`?

`tsconfig.json` proporciona contexto de proyecto. Sin él, TypeScript no puede interpretar de forma profesional todas esas decisiones.

---

## 2. Qué ocurre cuando ejecutas `tsc`

De forma simplificada, el compilador:

1. localiza una configuración;
2. determina los archivos raíz;
3. sigue sus imports para construir un grafo;
4. carga declaraciones de tipos del entorno;
5. comprueba el programa completo;
6. emite JavaScript y otros archivos si la configuración lo permite.

```text
tsconfig.json
      │
      ├── archivos raíz: include / files
      │
      ▼
grafo de módulos e imports
      │
      ├── tipos propios
      ├── lib de JavaScript/DOM
      └── paquetes de tipos visibles
      │
      ▼
type checking
      │
      └── emisión opcional: JavaScript, maps, declaraciones
```

El análisis no ocurre archivo por archivo de manera aislada. TypeScript necesita comprender el programa.

---

## 3. Anatomía mínima de un `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Las dos zonas principales son:

- `compilerOptions`: cómo se analiza y, si aplica, cómo se emite el programa;
- selección de archivos: qué entradas iniciales pertenecen al proyecto.

`tsconfig.json` acepta comentarios, por eso suele tratarse como JSON con comentarios o JSONC.

---

## 4. `include`, `exclude` y `files`

### `include`

Selecciona archivos mediante patrones:

```jsonc
{
  "include": ["src/**/*.ts"]
}
```

### `exclude`

Evita que ciertos archivos se incorporen como raíces a través de `include`:

```jsonc
{
  "exclude": ["node_modules", "dist", "coverage"]
}
```

Hay un detalle importante: **`exclude` no es una barrera de seguridad para el grafo**. Si un archivo incluido importa otro archivo excluido, ese archivo puede entrar al programa por la dependencia.

Por ejemplo:

```ts
// src/server.ts
import { seedDatabase } from "../scripts/seed-database.js";
```

Aunque `scripts` aparezca en `exclude`, el import lo introduce en el grafo.

### `files`

Enumera archivos raíz exactos:

```jsonc
{
  "files": ["src/server.ts"]
}
```

Es útil en proyectos muy controlados, pero resulta incómodo cuando crecen. Para aplicaciones habituales, `include` suele expresar mejor la intención.

---

## 5. `strict`: la línea base profesional

```jsonc
{
  "compilerOptions": {
    "strict": true
  }
}
```

`strict` activa una familia de comprobaciones estrictas. Entre ellas se encuentran controles relacionados con:

- `any` implícito;
- `null` y `undefined`;
- el tipo de `this`;
- compatibilidad de funciones;
- inicialización de propiedades;
- variables capturadas en `catch`.

La familia exacta puede evolucionar con TypeScript. Esta es una buena razón para configurar `strict: true` como intención general en vez de copiar manualmente una lista antigua.

También puedes anular una opción individual:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "strictPropertyInitialization": false
  }
}
```

Eso es técnicamente válido, pero cada excepción debe tener una razón documentada. Desactivar controles sin comprenderlos convierte errores reales en deuda silenciosa.

---

## 6. Por qué `strictNullChecks` cambia el diseño

Sin comprobación estricta de nulos, TypeScript puede tratar un resultado ausente como si siempre existiera.

```ts
interface Device {
  id: string;
  hostname: string;
}

function findDevice(
  devices: readonly Device[],
  id: string,
): Device | undefined {
  return devices.find((device) => device.id === id);
}

const devices: Device[] = [];
const found = findDevice(devices, "dev-404");

if (found === undefined) {
  console.log("Dispositivo no encontrado");
} else {
  console.log(found.hostname);
}
```

La ausencia forma parte del contrato: `find` puede devolver `undefined`. El código debe manejar ese caso.

En una API REST, esa decisión puede transformarse después en un `404`. Ocultarla con una aserción rompe la conexión entre dominio y comportamiento HTTP:

```ts
// Mala idea: silencia la posibilidad real de ausencia.
const hostname = found!.hostname;
```

Una aserción no crea el dispositivo en runtime. Solo pide al compilador que deje de advertirte.

---

## 7. `noImplicitAny` y fronteras sin contrato

Con `strict`, un parámetro cuyo tipo no puede inferirse de manera segura no debe quedar como `any` implícito.

```ts
// @ts-expect-error El parámetro carece de contrato.
function normalize(value) {
  return value.trim().toLowerCase();
}
```

Una versión tipada:

```ts
function normalize(value: string): string {
  return value.trim().toLowerCase();
}
```

En una frontera externa, sin embargo, no debes mentir y anotar directamente datos desconocidos como `string`:

```ts
function parseExternalValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError("Se esperaba texto");
  }

  return value.trim().toLowerCase();
}
```

`unknown` exige verificar. `any` desactiva la protección.

---

## 8. `useUnknownInCatchVariables` y errores reales

Bajo configuración estricta moderna, el valor capturado puede tratarse como `unknown`:

```ts
async function loadAudit(): Promise<void> {
  try {
    await Promise.reject(new Error("Timeout"));
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
      return;
    }

    console.error("Error no estándar", error);
  }
}
```

JavaScript permite lanzar cualquier valor:

```ts
throw "falló";
```

Por eso asumir que todo `catch` contiene un `Error` sería incorrecto.

---

## 9. Opciones valiosas que `strict` no cubre por completo

`strict` es el inicio, no el final. Para una base profesional puedes considerar:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Estas opciones descubren categorías distintas de errores.

---

## 10. `noUncheckedIndexedAccess`

Una lectura por índice puede no encontrar ningún elemento:

```ts
const hostnames: string[] = ["core-router"];
const firstHostname = hostnames[0];
```

Con `noUncheckedIndexedAccess`, `firstHostname` es `string | undefined`.

Debes comprobarlo:

```ts
const firstHostname = hostnames[0];

if (firstHostname === undefined) {
  throw new Error("La lista de dispositivos está vacía");
}

console.log(firstHostname.toUpperCase());
```

También afecta firmas de índice:

```ts
type Headers = Record<string, string>;

const headers: Headers = {
  authorization: "Bearer token",
};

const requestId = headers["x-request-id"];
// string | undefined con noUncheckedIndexedAccess
```

Esto modela mejor el comportamiento de JavaScript. Un `Record<string, string>` no puede garantizar en runtime que todas las claves posibles existen.

---

## 11. `exactOptionalPropertyTypes`

Estas dos situaciones no siempre significan lo mismo:

1. la propiedad no existe;
2. la propiedad existe con valor `undefined`.

```ts
interface UpdateDeviceInput {
  alias?: string;
}

const noChange: UpdateDeviceInput = {};

// Con exactOptionalPropertyTypes:
// @ts-expect-error undefined no fue declarado como valor permitido.
const ambiguousChange: UpdateDeviceInput = {
  alias: undefined,
};
```

Si tu API utiliza `null` para limpiar explícitamente un valor:

```ts
interface UpdateDeviceInput {
  alias?: string | null;
}

const keepAlias: UpdateDeviceInput = {};
const replaceAlias: UpdateDeviceInput = { alias: "Router principal" };
const clearAlias: UpdateDeviceInput = { alias: null };
```

Esto es especialmente útil en operaciones `PATCH`:

- propiedad ausente: no modificar;
- `null`: limpiar;
- `string`: reemplazar.

La configuración obliga a distinguir esas intenciones.

---

## 12. `noImplicitReturns` y contratos incompletos

```ts
type Severity = "low" | "medium" | "high";

function severityLabel(severity: Severity): string {
  switch (severity) {
    case "low":
      return "Baja";
    case "medium":
      return "Media";
    case "high":
      return "Alta";
  }
}
```

El union actual es exhaustivo, pero `noImplicitReturns` ayuda a detectar rutas sin retorno en funciones más complejas. Puede combinarse con `never` para documentar exhaustividad:

```ts
function assertNever(value: never): never {
  throw new Error("Caso no soportado: " + JSON.stringify(value));
}
```

Así se conectan las lecciones sobre uniones discriminadas, `never` y configuración del compilador.

---

## 13. `target`: qué JavaScript se emite

`target` indica el nivel de sintaxis JavaScript que TypeScript debe producir:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022"
  }
}
```

Si el código fuente usa una característica más nueva y el compilador sabe transformarla, puede emitir una versión equivalente compatible con el target.

Ejemplo fuente:

```ts
class NetworkAudit {
  constructor(
    public readonly id: string,
    public readonly createdAt: Date,
  ) {}
}
```

El JavaScript exacto emitido depende de `target` y otras opciones.

### Lo que `target` no hace

`target`:

- no instala nuevas APIs;
- no añade automáticamente polyfills;
- no cambia la versión real de Node.js;
- no garantiza compatibilidad con todos los navegadores;
- no valida que Docker use el runtime previsto.

Que TypeScript conozca `Promise` o `Array.prototype.find` no significa que un runtime antiguo las implemente.

> `target` trata principalmente de sintaxis emitida y supuestos del lenguaje; la compatibilidad real también depende del runtime, bundler y polyfills.

---

## 14. `lib`: qué APIs declara el entorno

`lib` selecciona archivos de declaraciones incorporados:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"]
  }
}
```

En un frontend:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

`DOM` declara APIs como:

- `window`;
- `document`;
- `HTMLElement`;
- tipos web relacionados.

### El error de incluir DOM en todas partes

Si un backend incluye `DOM` sin necesitarlo, este código puede parecer válido:

```ts
document.querySelector("#app");
```

Pero `document` no existe en un proceso Node.js normal. El compilador aceptó una declaración; no creó el objeto.

Usa `lib` para describir el entorno real, no para hacer desaparecer errores.

### `lib` tampoco es un polyfill

Agregar `"DOM"` o `"ES2022"` no incorpora implementaciones. Solo proporciona información estática al compilador.

---

## 15. `types`: controlar paquetes de tipos globales

Por defecto, TypeScript puede incluir paquetes `@types` visibles desde la jerarquía de carpetas. La opción `types` restringe cuáles aportan nombres globales:

```jsonc
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

Para Vitest con globals:

```jsonc
{
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  }
}
```

Esto puede hacer visibles `describe`, `it` y `expect` en el proyecto de tests.

### Lo que `types` no hace

`types`:

- no instala `@types/node`;
- no instala Vitest;
- no importa un módulo en runtime;
- no valida variables de entorno;
- no controla todos los tipos que puedes importar explícitamente desde paquetes.

Su función principal aquí es controlar qué paquetes aportan declaraciones globales al proyecto.

Una buena separación evita que los globals de testing contaminen el código de producción.

---

## 16. `module`: el modelo de módulos

`module` describe cómo debe tratarse o emitirse el sistema de módulos:

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext"
  }
}
```

No es una elección estética. Debe concordar con:

- el runtime;
- `package.json`;
- las extensiones;
- el bundler, si existe;
- el runner de tests;
- las dependencias instaladas.

Dos escenarios frecuentes en esta ruta serán:

| Entorno | Configuración común |
| --- | --- |
| Backend Node.js ESM | `module: "NodeNext"` |
| Frontend con Vite u otro bundler moderno | `module: "ESNext"` |

No copies estas parejas sin comprender el entorno. Son puntos de partida, no recetas universales.

---

## 17. `moduleResolution`: cómo encuentra TypeScript los módulos

`moduleResolution` determina cómo TypeScript interpreta un specifier:

```ts
import { createAudit } from "./create-audit.js";
import { z } from "zod";
```

Debe decidir:

- qué archivo representa `./create-audit.js` durante el análisis;
- cómo leer `package.json`;
- cómo interpretar `exports` de un paquete;
- qué declaraciones corresponden a `zod`;
- qué condiciones de resolución aplicar.

### Node.js moderno

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

Esta pareja modela la resolución moderna de Node, incluida la relación con `package.json` y ESM/CommonJS.

### Bundler moderno

```jsonc
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

Esta pareja es adecuada cuando Vite, esbuild, Rollup, webpack u otra herramienta controla la resolución y la salida.

### Regla clave

> `module` y `moduleResolution` deben contar una historia coherente sobre quién ejecuta o empaqueta los módulos.

---

## 18. Node ESM y extensiones `.js` desde TypeScript

Considera:

```ts
// src/server.ts
import { createApp } from "./app.js";
```

Aunque el archivo fuente sea `app.ts`, el import especifica `app.js` porque ese será el archivo que Node cargará después de compilar.

Con `NodeNext`, TypeScript puede relacionar ese specifier con el archivo fuente durante el análisis.

Un `package.json` compatible:

```json
{
  "name": "network-audit-api",
  "private": true,
  "type": "module"
}
```

Y una configuración coherente:

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

Cambiar únicamente un import hasta que “deje de marcar error” no resuelve el sistema. Debes alinear fuente, compilador, `package.json` y runtime.

---

## 19. `verbatimModuleSyntax` e `import type`

```jsonc
{
  "compilerOptions": {
    "verbatimModuleSyntax": true
  }
}
```

Esta opción hace más explícita la relación entre sintaxis escrita y salida. Los imports y exports marcados con `type` pueden eliminarse:

```ts
import { AuditSchema, type Audit } from "./audit.schema.js";

export function parseAudit(input: unknown): Audit {
  return AuditSchema.parse(input);
}
```

- `AuditSchema` es un valor runtime y debe permanecer;
- `Audit` es un tipo y desaparece.

Esto ayuda a evitar ambigüedad entre dependencias estáticas y runtime.

Si la configuración de módulos contradice la sintaxis escrita, `verbatimModuleSyntax` puede revelar el conflicto en vez de transformarlo silenciosamente.

---

## 20. `rootDir`, `outDir` y el árbol emitido

Backend:

```jsonc
{
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

Estructura fuente:

```text
src/
├── app.ts
├── server.ts
└── audits/
    └── audit.service.ts
```

Salida esperada:

```text
dist/
├── app.js
├── server.js
└── audits/
    └── audit.service.js
```

`rootDir` no es un alias de imports. Define la raíz lógica usada para organizar la salida.

`outDir` indica dónde escribir archivos emitidos.

No pongas `dist` dentro de `src`. Evita mezclar código generado con código fuente.

---

## 21. `noEmit` y `noEmitOnError`

### `noEmit`

```jsonc
{
  "compilerOptions": {
    "noEmit": true
  }
}
```

TypeScript solo comprueba tipos. Es frecuente en React cuando el bundler produce la salida.

### `noEmitOnError`

```jsonc
{
  "compilerOptions": {
    "noEmitOnError": true
  }
}
```

Cuando `tsc` es responsable del build, evita generar salida nueva si existen errores.

No confundas ambos:

- `noEmit`: nunca emitir;
- `noEmitOnError`: emitir solo si el chequeo permite hacerlo.

---

## 22. Source maps y declaraciones

Para depuración:

```jsonc
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

Los source maps relacionan el JavaScript ejecutado con el TypeScript original.

Para un SDK tipado:

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

`declaration` genera archivos `.d.ts` que describen la API pública para consumidores TypeScript.

Una aplicación interna no siempre necesita declaraciones. Una biblioteca o SDK publicado normalmente sí.

---

## 23. `skipLibCheck`: decisión pragmática, no garantía

```jsonc
{
  "compilerOptions": {
    "skipLibCheck": true
  }
}
```

Esta opción evita comprobar en profundidad ciertos archivos de declaraciones de dependencias. Puede reducir tiempo y conflictos entre tipos externos.

No significa:

- omitir el chequeo de tu código;
- arreglar dependencias incompatibles;
- validar paquetes en runtime;
- convertir un tipo incorrecto en correcto.

Es una decisión pragmática habitual, pero si sospechas un problema en declaraciones externas puedes desactivarla para investigar.

---

## 24. Configuración base compartida

En un repositorio con frontend, backend y paquetes compartidos, conviene extraer reglas verdaderamente comunes:

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  }
}
```

Observa lo que no aparece:

- `lib`;
- `types`;
- `module`;
- `moduleResolution`;
- `rootDir`;
- `outDir`;
- `jsx`.

Esas opciones dependen del entorno. Compartirlas ciegamente entre navegador y Node puede mezclar contratos incompatibles.

---

## 25. Configuración profesional para Node.js ESM

```jsonc
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist",
    "sourceMap": true,
    "noEmitOnError": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "coverage", "node_modules", "src/**/*.test.ts"]
}
```

Qué comunica:

- el runtime entiende JavaScript moderno;
- Node resuelve módulos;
- las APIs DOM no están declaradas;
- los tipos globales de Node están disponibles;
- `src` contiene la fuente de producción;
- `dist` recibe el build;
- los tests no se emiten en el build de producción.

El `package.json` debe mantener coherencia:

```json
{
  "type": "module",
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js"
  }
}
```

`typecheck` y `build` tienen objetivos distintos:

- `typecheck` comprueba sin escribir;
- `build` comprueba y emite.

---

## 26. Configuración profesional para React con bundler

```jsonc
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["dist", "coverage", "node_modules"]
}
```

Qué comunica:

- el código se ejecutará en navegador;
- JSX usa el transform moderno de React;
- el bundler controla la resolución y la emisión;
- `tsc` se utiliza para comprobar, no para construir assets;
- los tipos específicos del entorno Vite están disponibles.

El bundler sigue necesitando su propia configuración. `tsconfig.json` no reemplaza `vite.config.ts`.

---

## 27. Configuración separada para Vitest

Los tests necesitan tipos y archivos que el build de producción no necesita:

```jsonc
// apps/api/tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"],
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.test.ts", "tests/**/*.ts"],
  "exclude": ["dist", "coverage", "node_modules"]
}
```

Así:

- `describe`, `it` y `expect` pertenecen al contexto de tests;
- el build de producción no emite pruebas;
- los tests conservan las mismas reglas estrictas del backend;
- la resolución de módulos no cambia accidentalmente.

También puedes importar funciones de Vitest explícitamente y evitar globals:

```ts
import { describe, expect, it } from "vitest";

describe("normalizeHostname", () => {
  it("normaliza espacios y mayúsculas", () => {
    expect(" Core-Router ".trim().toLowerCase()).toBe("core-router");
  });
});
```

En ese estilo, `vitest/globals` puede no ser necesario.

---

## 28. `extends` y el principio de configuración mínima

`extends` permite heredar configuración:

```jsonc
{
  "extends": "../../tsconfig.base.json"
}
```

Ventajas:

- reglas de seguridad consistentes;
- menos duplicación;
- cambios centrales deliberados;
- diferencias de entorno visibles.

Riesgos:

- una base demasiado grande oculta decisiones;
- arrays y opciones no siempre se combinan como el desarrollador imagina;
- una opción apropiada para frontend puede romper backend;
- múltiples niveles de herencia vuelven difícil saber qué valor gana.

Usa una base pequeña y comprueba el resultado efectivo con:

```bash
npx tsc -p apps/api/tsconfig.json --showConfig
```

---

## 29. `paths` no configura el runtime

Puedes declarar:

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@domain/*": ["src/domain/*"]
    }
  }
}
```

Y escribir:

```ts
import type { Audit } from "@domain/audits/audit.js";
```

Pero `paths` ayuda a TypeScript a resolver tipos; no garantiza que Node, Vitest, Vite, ESLint o Docker entiendan el mismo alias. Tampoco reescribe necesariamente el specifier emitido.

Si usas aliases, alinea:

- TypeScript;
- bundler o runtime;
- test runner;
- linter;
- herramientas de desarrollo.

Antes de añadir un alias, pregunta si una ruta larga está revelando una frontera arquitectónica mal colocada.

---

## 30. TypeScript configura tipos; el runtime sigue siendo JavaScript

Este tipo desaparece:

```ts
interface Environment {
  PORT: number;
  DATABASE_URL: string;
}
```

Esta aserción tampoco valida:

```ts
const environment = process.env as unknown as Environment;
```

En runtime, `process.env.PORT` es texto o `undefined`. Puede contener `"abc"`.

Validación real con Zod:

```ts
import { z } from "zod";

const EnvironmentSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

export const environment: Environment = EnvironmentSchema.parse(process.env);
```

Comparación:

| Garantía | TypeScript / `tsconfig` | Zod |
| --- | --- | --- |
| Comprueba código durante desarrollo | Sí | No es su función principal |
| Existe después de compilar | Los tipos no | Sí, el schema es un valor |
| Valida `process.env` real | No | Sí |
| Convierte `PORT` a número | No | Sí, con coerción explícita |
| Puede rechazar datos al arrancar | No | Sí |

La misma regla aplica a:

- cuerpos y parámetros HTTP;
- respuestas de APIs externas;
- formularios;
- archivos de configuración;
- mensajes de colas;
- filas de PostgreSQL cuando cruzan una frontera no confiable.

> Un `tsconfig` estricto reduce errores en el código que controlas. La validación runtime protege las fronteras cuyos datos no controlas.

---

## 31. Ejemplo integrado: SiteOps Tracker

### Contrato de dominio

```ts
// src/domain/devices/device.schema.ts
import { z } from "zod";

export const DeviceSchema = z.object({
  id: z.string().uuid(),
  hostname: z.string().trim().min(1),
  managementIp: z.string().ip(),
  status: z.enum(["online", "offline", "unknown"]),
});

export type Device = z.infer<typeof DeviceSchema>;
```

### Repository port

```ts
// src/application/devices/device.repository.port.ts
import type { Device } from "../../domain/devices/device.schema.js";

export interface DeviceRepository {
  findById(id: string): Promise<Device | null>;
}
```

### Service

```ts
// src/application/devices/get-device.service.ts
import type { DeviceRepository } from "./device.repository.port.js";

export type GetDeviceResult =
  | { kind: "found"; deviceId: string }
  | { kind: "not_found"; deviceId: string };

export function createGetDevice(repository: DeviceRepository) {
  return async function getDevice(id: string): Promise<GetDeviceResult> {
    const device = await repository.findById(id);

    if (device === null) {
      return { kind: "not_found", deviceId: id };
    }

    return { kind: "found", deviceId: device.id };
  };
}
```

La configuración estricta ayuda a:

- no olvidar el caso `null`;
- distinguir imports de tipo;
- conservar exhaustividad;
- impedir `any` implícito;
- detectar rutas sin retorno.

Zod ayuda en otra dimensión: validar el dato que llega desde fuera.

---

## 32. La arquitectura Full Stack bajo configuraciones distintas

```text
React
  │ tsconfig del navegador
  ▼
HTTP ─────────── datos runtime sin tipos TypeScript
  │
Node
  │ tsconfig del servidor
  ▼
Router → Controller → Runtime Validation → Service → Repository → PostgreSQL
                                                         │
                                                         ▼
                                      Testing → Docker → CI/CD → Cloud
```

### React

Necesita `DOM`, JSX, módulos para bundler y normalmente `noEmit`. No debe recibir globals de Node por comodidad.

### HTTP

No transporta tipos TypeScript. El JSON debe considerarse `unknown` hasta validarlo.

### Node.js

Necesita una configuración alineada con su versión, `package.json` y sistema de módulos. No debe asumir que existe `document`.

### Router

Define rutas y conecta Controllers. La configuración detecta imports incompatibles, pero no valida requests.

### Controller

Traduce HTTP hacia la aplicación y ejecuta validación runtime antes de confiar en datos externos.

### Runtime Validation

Zod existe como valor JavaScript. Sus schemas deben importarse como valores, no con `import type`.

### Service

Usa tipos de dominio y ports. `strict` revela ausencias, variantes y contratos incompletos sin acoplar el negocio a Express.

### Repository

El port se comprueba estáticamente. El adapter real usa el driver y mapea datos de infraestructura.

### PostgreSQL

Constraints, tipos SQL y transacciones protegen el estado real. Un generic del driver no convierte una fila en dato validado.

### Testing

Usa su propio contexto de tipos. Vitest no debe introducir globals en el build de producción; Testing Library necesitará DOM simulado en los tests de React.

### Docker

Fija el runtime real y ejecuta el JavaScript construido. Puede descubrir casing incorrecto, Node incompatible o archivos no emitidos.

### CI/CD

Debe ejecutar explícitamente typecheck, lint, tests y build. Que el editor no marque errores no sustituye el pipeline.

### Cloud

Ejecuta JavaScript, configuración y secretos reales. Los tipos ya desaparecieron, por lo que la validación al arrancar y en fronteras sigue siendo obligatoria.

---

## 33. Relación explícita con tus proyectos

### SiteOps Tracker

Usa configuración Node estricta en la API y una configuración React independiente en el dashboard. Valida variables de entorno y payloads con Zod.

### Repositorio de algoritmos en TypeScript

`strict`, `noUncheckedIndexedAccess` y `noImplicitReturns` revelan casos límite en arrays, mapas y funciones recursivas. El proyecto puede usar `noEmit` si ejecuta tests mediante Vitest.

### Analizador de configuraciones de red

Configura APIs de Node para leer archivos, pero no DOM. El contenido de cada archivo continúa siendo texto no confiable y requiere parsing y validación.

### SDK tipado para una API

Activa `declaration` y `declarationMap` para publicar contratos `.d.ts`. Diseña la salida de módulos según los runtimes consumidores; no expongas detalles internos.

### API REST Node.js + TypeScript + PostgreSQL

Usa `NodeNext` de manera coherente, separa tests del build y valida `process.env`. Los tipos del driver no reemplazan constraints, migraciones ni tests de integración.

### Aplicación Full Stack React + TypeScript + Node.js + PostgreSQL

Mantén al menos configuraciones distintas para web, API y tests. Comparte reglas estáticas seguras mediante una base pequeña; no compartas accidentalmente entornos globales.

---

## 34. Cuándo usar una sola configuración

Una sola configuración puede bastar cuando:

- el proyecto tiene un único runtime;
- el mismo conjunto de archivos participa en typecheck y build;
- no existen globals especiales de tests;
- la herramienta de build y `tsc` comparten expectativas;
- las diferencias entre entornos son mínimas.

Ejemplo: un pequeño repositorio de algoritmos que solo contiene funciones TypeScript y pruebas importadas explícitamente.

---

## 35. Cuándo separar configuraciones

Separa configuraciones cuando:

- navegador y Node conviven;
- tests necesitan otros globals;
- el build debe excluir pruebas;
- un SDK necesita declaraciones y la app no;
- un paquete compartido debe ser neutral al entorno;
- el editor necesita analizar más archivos de los que se publican;
- distintos paquetes tienen diferentes estrategias de módulos.

No crees archivos de configuración solo por apariencia. Cada uno debe representar un programa o una tarea distinta.

---

## 36. Cuándo no usar una opción para ocultar un problema

Evita:

- agregar `DOM` al backend solo para que desaparezca un error;
- agregar todos los paquetes a `types`;
- desactivar `strict` por una dependencia mal tipada;
- usar `skipLibCheck` como explicación de cualquier incompatibilidad;
- cambiar `moduleResolution` hasta que un único import funcione;
- añadir `paths` sin configurar el runtime;
- excluir un archivo pensando que eso impide importarlo;
- bajar `target` esperando que aparezcan polyfills.

Una opción debe describir la realidad del proyecto. Si solo silencia un síntoma, probablemente crea una contradicción nueva.

---

## 37. Errores comunes

### Error 1 — Copiar un `tsconfig` enorme

No sabes qué problema resuelve cada opción y resulta difícil diagnosticar interacciones.

### Error 2 — Desactivar `strict` para avanzar

El proyecto acumula contratos implícitos que serán más costosos de corregir.

### Error 3 — Creer que `target` define la versión de Node

La imagen Docker o el entorno cloud siguen decidiendo qué runtime ejecuta el programa.

### Error 4 — Creer que `lib` instala APIs

Las declaraciones no crean implementaciones ni polyfills.

### Error 5 — Incluir `DOM` en backend sin intención

TypeScript acepta globals que Node no proporciona.

### Error 6 — Incluir `node` en frontend por comodidad

El navegador no implementa automáticamente `process`, `Buffer` o `fs`.

### Error 7 — Mezclar `NodeNext` y `Bundler` sin entender quién resuelve

Los entornos pueden aceptar specifiers distintos.

### Error 8 — Suponer que `paths` reescribe imports

El código compila, pero falla al ejecutarse.

### Error 9 — Usar assertions para “arreglar” datos externos

`as Environment` no valida `process.env`.

### Error 10 — Contaminar producción con globals de tests

`describe` y `expect` quedan visibles donde no corresponden.

### Error 11 — Compilar tests dentro de `dist`

La imagen de producción contiene archivos innecesarios y puede requerir dependencias de desarrollo.

### Error 12 — Tener un build diferente al typecheck

El editor o CI comprueba una configuración, pero producción construye otra.

### Error 13 — Ignorar `forceConsistentCasingInFileNames`

Imports que funcionan en un sistema pueden fallar en Docker/Linux.

### Error 14 — Confundir tipos con validación

Los tipos desaparecen y nunca inspeccionan el JSON, formulario, archivo o fila real.

### Error 15 — Forzar `any` para resolver tipos de librerías

El problema se propaga por el sistema. Prefiere `unknown`, narrowing, wrappers tipados o corregir la declaración.

---

## 38. Herramientas de diagnóstico

### Ver la configuración efectiva

```bash
npx tsc -p apps/api/tsconfig.json --showConfig
```

Útil cuando existen varios `extends`.

### Ver los archivos incluidos

```bash
npx tsc -p apps/api/tsconfig.json --listFiles --noEmit
```

Útil cuando un test, script o tipo global aparece inesperadamente.

### Rastrear resolución de módulos

```bash
npx tsc -p apps/api/tsconfig.json --traceResolution --noEmit
```

Produce mucha información. Úsalo para investigar un import específico, no como salida cotidiana de CI.

### Ejecutar únicamente el chequeo

```bash
npx tsc -p apps/api/tsconfig.json --noEmit
```

### Probar el build real

```bash
npm run build
node dist/server.js
```

Que `tsc` termine correctamente no demuestra por sí solo que Node pueda arrancar. Prueba también la salida.

---

## 39. Checklist de configuración profesional

Antes de aceptar un `tsconfig`, responde:

- ¿qué runtime ejecutará el JavaScript?
- ¿quién emite: `tsc` o el bundler?
- ¿el proyecto es ESM, CommonJS o necesita ambos?
- ¿`module` y `moduleResolution` están alineados?
- ¿`package.json` cuenta la misma historia?
- ¿qué APIs globales existen realmente?
- ¿qué paquetes de tipos globales deben ser visibles?
- ¿qué archivos pertenecen a producción?
- ¿qué archivos pertenecen solo a tests?
- ¿la salida está separada de la fuente?
- ¿`strict` está activo?
- ¿se manejan índices y propiedades opcionales con precisión?
- ¿CI ejecuta la misma configuración?
- ¿Docker usa una versión compatible del runtime?
- ¿las fronteras externas se validan en runtime?

---

# PRÁCTICAS

## Práctica 1 — Identificar el entorno

Clasifica cada API como navegador, Node.js o JavaScript estándar:

```ts
document.querySelector("#app");
process.env.DATABASE_URL;
Array.prototype.map;
Buffer.from("router");
window.location.href;
Promise.resolve("ok");
```

Después decide qué `lib` y qué `types` necesita:

1. una API Node;
2. un dashboard React.

### Pista

`ES2022`, `DOM` y `node` no representan lo mismo.

---

## Práctica 2 — Detectar el contrato falso

Revisa:

```ts
interface AppConfig {
  port: number;
}

const config = {
  port: process.env.PORT,
} as unknown as AppConfig;
```

Responde:

1. ¿qué tipo tiene realmente `process.env.PORT` antes de la aserción?
2. ¿qué ocurre si contiene `"abc"`?
3. ¿qué parte desaparece al compilar?
4. ¿qué herramienta runtime usarías?

---

## Práctica 3 — Índices inseguros

Con `noUncheckedIndexedAccess`, corrige sin usar `!`:

```ts
function firstInterface(interfaces: readonly string[]): string {
  return interfaces[0];
}
```

Decide además qué contrato es más honesto:

- devolver `string | undefined`;
- lanzar un error;
- exigir una tupla no vacía.

No existe una respuesta universal: depende del dominio.

---

## Práctica 4 — Propiedad opcional exacta

Modela un PATCH de dispositivo con estas reglas:

- propiedad ausente: no cambiar;
- `null`: borrar alias;
- `string` no vacío: actualizar alias;
- `undefined` explícito: no permitido.

Escribe solo el tipo TypeScript y tres ejemplos válidos.

### Pista

Combina `?` con `string | null`.

---

## Práctica 5 — Resolver la pareja

Asocia cada proyecto:

1. backend Node ESM compilado con `tsc`;
2. React empaquetado con Vite.

Con una de estas parejas:

```text
A) module: NodeNext  + moduleResolution: NodeNext
B) module: ESNext   + moduleResolution: Bundler
```

Explica quién resuelve módulos y quién emite la salida en cada caso.

---

## Práctica 6 — Encontrar contaminación de tipos

El código de producción acepta esto:

```ts
describe("startup", () => {
  // ...
});
```

Investiga conceptualmente:

1. ¿por qué `describe` puede estar visible?
2. ¿en qué configuración debería declararse?
3. ¿cómo separarías build y tests?

---

# EJERCICIO PRINCIPAL — Configurar la API de SiteOps Tracker

Tienes esta estructura:

```text
network-log-api/
├── package.json
├── tsconfig.base.json
├── tsconfig.json
├── tsconfig.test.json
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   └── environment.ts
│   └── devices/
│       ├── device.schema.ts
│       ├── device.repository.port.ts
│       └── get-device.service.ts
└── tests/
    └── get-device.service.test.ts
```

Tu tarea es escribir las tres configuraciones y los scripts mínimos.

## Requisitos

### `tsconfig.base.json`

- activa `strict`;
- activa `noUncheckedIndexedAccess`;
- activa `exactOptionalPropertyTypes`;
- activa `noImplicitReturns`;
- verifica casing consistente;
- mantiene únicamente reglas reutilizables entre entornos.

### `tsconfig.json`

- backend Node.js ESM;
- target moderno razonable;
- no incluye `DOM`;
- usa tipos de Node;
- fuente en `src`;
- salida en `dist`;
- genera source maps;
- no emite si existen errores;
- excluye tests del build.

### `tsconfig.test.json`

- hereda las reglas del backend;
- incluye `src` y `tests`;
- reconoce Vitest si decides usar globals;
- nunca emite JavaScript.

### `package.json`

Define scripts para:

- `typecheck`;
- `typecheck:test`;
- `build`;
- `start`.

## Restricciones

- no uses `any`;
- no agregues `DOM` al backend;
- no uses `paths` en este ejercicio;
- no desactives opciones estrictas;
- no compiles tests dentro de `dist`;
- no copies una configuración de React;
- `package.json` y el sistema de módulos deben ser coherentes;
- no uses una aserción para convertir `process.env` en configuración válida.

## Pistas

- Node ESM moderno puede usar `NodeNext` en las dos opciones relacionadas con módulos;
- `types` controla declaraciones globales visibles;
- `--noEmit` puede pasarse en un script;
- una configuración de tests puede extender la de producción y sobrescribir selección de archivos;
- valida `process.env` con un schema runtime;
- usa `npx tsc --showConfig` para observar la configuración final.

## Entrega esperada

Comparte:

1. los tres archivos `tsconfig`;
2. el fragmento de scripts de `package.json`;
3. una explicación breve de cinco decisiones;
4. la salida de `typecheck` y `build`;
5. cómo validarías `PORT` y `DATABASE_URL` en runtime.

> No se incluye la solución completa. Primero crea tu configuración y compártela para recibir análisis de aciertos, errores y pistas.

---

# RETO — Configuración Full Stack por entorno

Diseña la configuración de este repositorio:

```text
network-platform/
├── tsconfig.base.json
├── apps/
│   ├── api/
│   │   ├── tsconfig.json
│   │   └── tsconfig.test.json
│   └── web/
│       ├── tsconfig.json
│       └── tsconfig.test.json
└── packages/
    └── contracts/
        └── tsconfig.json
```

## Requisitos

1. La API usa Node ESM y emite a `dist`.
2. La web usa React, JSX y un bundler; `tsc` no emite.
3. Los tests de API usan entorno Node.
4. Los tests de React pueden usar un DOM simulado.
5. `packages/contracts` no debe importar `fs`, Express, `pg` ni componentes React.
6. La base comparte seguridad, no globals de entorno.
7. Los schemas Zod compartidos deben existir en runtime.
8. Los tipos derivados con `z.infer` deben desaparecer.
9. El build de producción no incluye tests.
10. Documenta quién resuelve módulos en cada paquete.

## Parte de análisis

Para cada configuración explica:

- `target` elegido;
- `lib`;
- `module`;
- `moduleResolution`;
- `types`;
- si usa `noEmit`;
- qué archivos incluye;
- quién genera la salida final.

## Verificación mínima

Ejecuta conceptualmente o en tu proyecto:

```bash
npx tsc -p apps/api/tsconfig.json --noEmit
npx tsc -p apps/api/tsconfig.test.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
npx tsc -p packages/contracts/tsconfig.json --noEmit
```

Después comprueba que:

- `document` no sea válido dentro de la API;
- `process` no sea válido en un componente React salvo que exista un contrato explícito del toolchain;
- `describe` no sea global en producción;
- un acceso inseguro a un array produzca `undefined` en el tipo;
- un schema Zod pueda ejecutarse en ambos runtimes si pertenece al paquete compartido.

> No resuelvas el reto con un único `tsconfig` gigante. La dificultad está en expresar correctamente las diferencias de entorno.

---

## Preguntas de comprensión

1. ¿Qué diferencia existe entre `target` y la versión real del runtime?
2. ¿Por qué `lib: ["DOM"]` puede hacer que un backend acepte código imposible de ejecutar?
3. ¿Qué controla `types` y qué no instala?
4. ¿Cuál es la diferencia entre `module` y `moduleResolution`?
5. ¿Por qué `NodeNext` suele aparecer en ambas opciones para Node ESM?
6. ¿Por qué un frontend con Vite suele usar `noEmit`?
7. ¿Qué error revela `noUncheckedIndexedAccess`?
8. ¿Qué diferencia expresa `exactOptionalPropertyTypes` entre ausencia y `undefined`?
9. ¿Puede `exclude` impedir que un archivo importado entre al grafo?
10. ¿Por qué `paths` puede compilar y fallar en runtime?
11. ¿Qué diferencia existe entre `noEmit` y `noEmitOnError`?
12. ¿Por qué los globals de Vitest deberían limitarse al proyecto de tests?
13. ¿Qué partes de un schema Zod permanecen en JavaScript?
14. ¿Puede `strict` validar `process.env` o una respuesta HTTP real?
15. ¿Qué comandos usarías para ver la configuración efectiva y rastrear un import?

---

## Relevancia para entrevistas técnicas

### Pregunta: ¿Qué hace `strict`?

Activa una familia de comprobaciones que obliga a modelar de forma más segura `any` implícito, nulos, funciones, `this`, propiedades y otros casos. Es una intención global; opciones individuales pueden ajustarse, aunque cada excepción debe justificarse.

### Pregunta: ¿Cuál es la diferencia entre `target` y `lib`?

`target` influye en el nivel de JavaScript emitido y ciertos defaults. `lib` selecciona declaraciones de APIs disponibles para el chequeo. Ninguno instala polyfills ni cambia el runtime desplegado.

### Pregunta: ¿Cuál es la diferencia entre `module` y `moduleResolution`?

`module` describe el modelo o emisión de módulos. `moduleResolution` describe cómo TypeScript encuentra archivos y paquetes a partir de specifiers.

### Pregunta: ¿Por qué usar `NodeNext`?

Porque modela la semántica moderna de módulos de Node, incluida la interacción con `package.json`, ESM/CommonJS, extensiones y exports de paquetes. Debe acompañarse de una configuración real de Node coherente.

### Pregunta: ¿Cuándo usar `Bundler`?

Cuando un bundler moderno controla la resolución y la salida, como suele ocurrir en React con Vite. No debe usarse para disimular imports que el runtime Node directo no podría resolver.

### Pregunta: ¿Qué hace `noUncheckedIndexedAccess`?

Añade `undefined` a lecturas mediante índices cuando la existencia de la clave o posición no está garantizada. Obliga a manejar arrays vacíos y claves ausentes.

### Pregunta: ¿Qué hace `exactOptionalPropertyTypes`?

Preserva la diferencia entre una propiedad ausente y una propiedad presente con `undefined`, salvo que `undefined` se declare expresamente como valor.

### Pregunta: ¿`paths` configura aliases en Node?

No por sí solo. TypeScript puede resolverlos durante el análisis, pero Node, bundler y herramientas necesitan una estrategia compatible.

### Pregunta: ¿TypeScript valida variables de entorno?

No. Los tipos se eliminan al compilar. Las variables de entorno requieren validación runtime, por ejemplo con Zod, y una política clara de fallo al arrancar.

### Pregunta: ¿Por qué separar configuraciones?

Porque frontend, backend, tests y paquetes publicados pueden tener runtimes, globals, archivos y estrategias de emisión diferentes. Una base pequeña puede compartir reglas de seguridad sin mezclar entornos.

### Señal de respuesta profesional

No basta con recitar opciones. Explica siempre la cadena:

```text
fuente TypeScript
→ configuración efectiva
→ resolución
→ typecheck
→ emisión o bundling
→ JavaScript real
→ runtime real
→ validación de datos externos
```

---

## Resumen

- `tsconfig.json` define el contexto de un programa TypeScript;
- `include` y `files` seleccionan raíces, pero los imports amplían el grafo;
- `exclude` no impide que un archivo importado participe;
- `strict` es la base profesional;
- `noUncheckedIndexedAccess` modela índices ausentes;
- `exactOptionalPropertyTypes` distingue ausencia de `undefined`;
- `target` influye en JavaScript emitido, no instala APIs;
- `lib` aporta declaraciones, no implementaciones;
- `types` controla paquetes que aportan globals visibles;
- `module` y `moduleResolution` deben coincidir con runtime y toolchain;
- `NodeNext` es apropiado para una estrategia Node ESM coherente;
- `ESNext` con `Bundler` es habitual en frontends empaquetados;
- `noEmit` sirve cuando otra herramienta construye la salida;
- una configuración base debe compartir seguridad, no mezclar entornos;
- `paths` no configura automáticamente Node, tests ni bundlers;
- los tipos de TypeScript desaparecen en runtime;
- HTTP, formularios, APIs, archivos, variables de entorno y PostgreSQL requieren validación real;
- Zod complementa el chequeo estático en las fronteras;
- CI debe ejecutar typecheck, lint, tests y build con configuraciones explícitas;
- Docker y Cloud ejecutan JavaScript y runtimes reales, no las promesas de un tipo.

Una configuración profesional no intenta hacer que todos los errores desaparezcan. Intenta que el compilador describa con fidelidad el sistema que realmente vas a ejecutar.

---

# Próxima lección

**Lección 26 — Declaraciones de tipos: archivos `.d.ts`, `@types`, módulos ambientales y ampliación segura de librerías.**
