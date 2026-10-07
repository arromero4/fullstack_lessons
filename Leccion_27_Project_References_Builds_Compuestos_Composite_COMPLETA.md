# Lección 27 — Project References y builds compuestos con `composite`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, reglas y datos de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos  

---

## Introducción

En la lección anterior aprendiste a describir código JavaScript y librerías mediante archivos `.d.ts`, paquetes `@types`, módulos ambientales y ampliaciones de módulos. Esas declaraciones permiten que un consumidor conozca el contrato estático de un módulo.

Ahora aparece un problema mayor: SiteOps Tracker empieza a dividirse en varias partes TypeScript relacionadas entre sí.

- un paquete de contratos compartidos;
- un núcleo de reglas de auditoría;
- una API Node.js;
- una aplicación React;
- un analizador de configuraciones;
- un SDK tipado.

Con un único `tsconfig.json`, TypeScript puede terminar tratando todo como un solo proyecto enorme. Esto hace más difícil expresar qué parte depende de cuál, aislar entornos distintos y reconstruir únicamente lo que cambió.

Los **Project References** convierten varios proyectos TypeScript pequeños en un grafo de dependencias explícito. El modo de build `tsc -b` usa ese grafo para compilar en orden y evitar trabajo innecesario.

La idea central de hoy es:

> Un import conecta módulos; una referencia de proyecto conecta unidades de compilación.

---

## Objetivo

Al terminar esta lección podrás:

1. explicar qué problema resuelven los Project References;
2. distinguir una dependencia de módulos de una dependencia entre proyectos;
3. configurar `references` y `composite` correctamente;
4. crear un `tsconfig.json` de solución;
5. compilar un grafo con `tsc -b` en el orden correcto;
6. explicar para qué sirven `.d.ts`, `.d.ts.map` y `.tsbuildinfo` dentro del build;
7. reconocer cuándo esta arquitectura aporta valor y cuándo añade complejidad innecesaria;
8. detectar errores frecuentes como ciclos, salidas obsoletas o archivos fuera de `include`;
9. relacionar el grafo de compilación con la arquitectura Full Stack de SiteOps Tracker;
10. explicar por qué esta configuración no sustituye la validación en runtime.

---

## 1. El problema: un solo proyecto empieza a mezclar responsabilidades

Imagina esta estructura inicial:

```text
siteops-tracker/
├── src/
│   ├── web/
│   ├── api/
│   ├── domain/
│   ├── database/
│   └── config-analyzer/
└── tsconfig.json
```

Al principio puede funcionar. Sin embargo, conforme crece el repositorio aparecen varios problemas.

### 1.1 Entornos incompatibles

React necesita tipos del navegador como `document` y `HTMLElement`. La API necesita tipos de Node.js como `process` y `Buffer`. Un paquete de contratos compartidos idealmente no debería depender de ninguno de esos entornos.

Un solo `tsconfig.json` puede terminar habilitando simultáneamente librerías y tipos que no corresponden a todos los módulos. Así, código del backend podría usar accidentalmente una API del navegador sin que el editor lo advierta de la forma esperada.

### 1.2 Dependencias arquitectónicas invisibles

Si todos los archivos pertenecen al mismo programa, técnicamente cualquier carpeta puede importar otra. Por ejemplo, el dominio podría terminar importando Express o el frontend podría importar directamente un Repository de PostgreSQL.

```ts
// Mala dirección arquitectónica:
// packages/domain/src/finding.ts
import type { Request } from "express";
```

El error no está en la sintaxis. El problema es que el dominio ahora depende de una tecnología de transporte.

### 1.3 Builds innecesariamente amplios

Un cambio interno en el analizador de configuraciones no debería obligar a reconstruir cada parte del sistema. En repositorios medianos o grandes, recompilar y volver a analizar todo aumenta el tiempo de feedback.

### 1.4 Contratos públicos poco claros

Cuando otro proyecto depende de una carpeta completa de archivos fuente, puede comenzar a importar detalles internos. Un límite de proyecto permite que el consumidor vea principalmente las declaraciones emitidas de la API pública.

---

## 2. Modelo mental: dos grafos distintos

Para comprender Project References debes separar dos relaciones.

### 2.1 Grafo de módulos

Se forma con `import` y `export` dentro del código:

```ts
import type { Finding } from "@siteops/contracts";
```

Este import indica que el módulo actual usa un símbolo de otro módulo.

### 2.2 Grafo de proyectos

Se forma con `references` en los archivos `tsconfig.json`:

```jsonc
{
  "references": [
    { "path": "../contracts" }
  ]
}
```

Esto le indica a TypeScript que el proyecto completo actual depende de la salida compilada del proyecto `contracts`.

### 2.3 No son intercambiables

Agregar una referencia no escribe imports por ti. Agregar un import tampoco garantiza que `tsc -b` conozca el orden entre dos proyectos.

| Relación | Se declara en | Responde a |
|---|---|---|
| Dependencia de módulos | archivos `.ts`/`.tsx` | “¿Qué símbolo usa este archivo?” |
| Dependencia de proyectos | `tsconfig.json` | “¿Qué proyecto debe construirse antes?” |
| Dependencia runtime | `package.json`, workspace, bundler o resolución de Node | “¿Cómo encontrará JavaScript ese paquete al ejecutarse?” |

Esta tercera fila es especialmente importante: **Project References no enlaza paquetes en runtime ni reescribe rutas de importación**.

---

## 3. Anatomía mínima de una referencia

Usaremos dos proyectos ficticios:

```text
packages/
├── contracts/
│   ├── src/index.ts
│   └── tsconfig.json
└── audit-core/
    ├── src/index.ts
    └── tsconfig.json
```

`audit-core` depende de `contracts`.

### 3.1 Proyecto referenciado: `contracts`

```jsonc
// packages/contracts/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "tsBuildInfoFile": "dist/contracts.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

### 3.2 Proyecto consumidor: `audit-core`

```jsonc
// packages/audit-core/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "tsBuildInfoFile": "dist/audit-core.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "references": [
    { "path": "../contracts" }
  ]
}
```

La propiedad `references` está al nivel raíz, no dentro de `compilerOptions`.

El `path` puede apuntar:

- a una carpeta que contiene `tsconfig.json`; o
- directamente a un archivo de configuración con otro nombre.

```jsonc
{
  "references": [
    { "path": "../contracts/tsconfig.build.json" }
  ]
}
```

---

## 4. Qué cambia al activar `composite`

`composite` marca un proyecto como una unidad que puede participar de forma predecible en un build compuesto.

Cuando está activo, TypeScript impone reglas adicionales.

### 4.1 La salida de declaraciones está disponible

Un consumidor de un proyecto referenciado usa su salida `.d.ts` como contrato estático. Por eso un proyecto referenciado debe poder producir declaraciones.

```text
packages/contracts/
├── src/index.ts
└── dist/
    ├── index.js
    ├── index.js.map
    ├── index.d.ts
    ├── index.d.ts.map
    └── contracts.tsbuildinfo
```

`composite` hace que `declaration` tenga valor predeterminado `true`. En esta lección lo escribimos explícitamente para que la intención sea visible.

### 4.2 Todos los archivos de implementación deben estar incluidos

Cada archivo `.ts` o `.tsx` que forme parte del proyecto debe coincidir con `include` o aparecer en `files`.

```jsonc
{
  "include": ["src/**/*.ts"]
}
```

Si agregas `scripts/generate.ts` y el proyecto termina incluyéndolo por otra ruta sin declararlo correctamente, TypeScript puede detener el build y señalar qué archivo falta. Esta restricción evita unidades de compilación ambiguas.

### 4.3 Cambia el valor predeterminado de `rootDir`

Si no declaras `rootDir`, en un proyecto `composite` su valor predeterminado pasa a ser la carpeta que contiene el `tsconfig.json`. En proyectos profesionales conviene escribirlo explícitamente cuando la salida esperada importa.

### 4.4 Se conserva información incremental

Los builds compuestos producen información que permite decidir si un proyecto está actualizado. Esa información se almacena en un archivo `.tsbuildinfo`.

```text
dist/contracts.tsbuildinfo
```

El archivo:

- pertenece al proceso de build;
- no lo usa JavaScript en runtime;
- no contiene validación de datos;
- puede eliminarse y regenerarse;
- normalmente se ignora en Git junto con otras salidas, según la estrategia del equipo.

No debes editarlo manualmente.

---

## 5. Qué consume realmente un proyecto dependiente

Supón este contrato:

```ts
// packages/contracts/src/index.ts
export type FindingStatus = "open" | "in_progress" | "resolved";

export interface FindingSummary {
  id: string;
  siteId: string;
  title: string;
  status: FindingStatus;
}
```

Después del build, TypeScript puede emitir:

```ts
// packages/contracts/dist/index.d.ts
export type FindingStatus = "open" | "in_progress" | "resolved";

export interface FindingSummary {
  id: string;
  siteId: string;
  title: string;
  status: FindingStatus;
}
```

El proyecto `audit-core` puede usar el contrato público:

```ts
// packages/audit-core/src/summarize-findings.ts
import type {
  FindingStatus,
  FindingSummary,
} from "@siteops/contracts";

export type FindingsByStatus = Record<FindingStatus, number>;

export function summarizeFindings(
  findings: readonly FindingSummary[],
): FindingsByStatus {
  const summary: FindingsByStatus = {
    open: 0,
    in_progress: 0,
    resolved: 0,
  };

  for (const finding of findings) {
    summary[finding.status] += 1;
  }

  return summary;
}
```

El import anterior presupone que el repositorio configura `@siteops/contracts` como paquete local mediante un workspace y que su manifiesto dirige los tipos a la salida correspondiente. Esa resolución de paquete es una responsabilidad distinta del Project Reference.

La referencia:

```jsonc
{
  "references": [{ "path": "../contracts" }]
}
```

sirve para que TypeScript entienda el orden de compilación y el límite entre proyectos. No sustituye al `package.json`, a los workspaces, a Node.js ni al bundler.

---

## 6. El `tsconfig.json` de solución

En la raíz puedes crear una configuración cuya única función sea describir el grafo completo.

```jsonc
// tsconfig.json
{
  "files": [],
  "references": [
    { "path": "./packages/contracts" },
    { "path": "./packages/audit-core" },
    { "path": "./apps/api" }
  ]
}
```

`files: []` indica que esta configuración no compila archivos propios. Es un punto de entrada para la solución.

No necesitas ordenar manualmente las referencias por dependencia. `tsc -b` analiza el grafo y construye primero lo necesario. Aun así, mantener una lista legible ayuda a las personas.

El grafo lógico del ejemplo es:

```text
contracts
    ↓
audit-core
    ↓
api
```

Una API podría depender de ambos proyectos de forma explícita:

```jsonc
// apps/api/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "tsBuildInfoFile": "dist/api.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "references": [
    { "path": "../../packages/contracts" },
    { "path": "../../packages/audit-core" }
  ]
}
```

---

## 7. Compartir opciones sin duplicarlas

Las referencias expresan dependencias; `extends` comparte configuración. Son mecanismos diferentes.

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Un proyecto puede extender esa base y declarar sus detalles:

```jsonc
// packages/contracts/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "tsBuildInfoFile": "dist/contracts.tsbuildinfo"
  },
  "include": ["src/**/*.ts"]
}
```

No pongas indiscriminadamente en la base opciones específicas del navegador, Node.js o Vitest. Cada proyecto debe describir su runtime real.

Por ejemplo:

- `apps/web` puede usar `lib: ["ES2022", "DOM", "DOM.Iterable"]`;
- `apps/api` puede cargar tipos de Node.js;
- `packages/contracts` puede mantenerse independiente de DOM, Express y PostgreSQL;
- un proyecto de tests puede declarar los tipos del runner de pruebas.

---

## 8. `tsc -b`: TypeScript como orquestador del build

La opción `--build`, abreviada `-b`, activa el modo de build compuesto.

```bash
npx tsc -b
```

Desde el `tsconfig.json` de solución, TypeScript:

1. descubre las referencias transitivas;
2. ordena los proyectos según sus dependencias;
3. determina cuáles están actualizados;
4. construye únicamente los que lo necesitan;
5. evita emitir salidas de un proyecto con errores.

Comandos útiles:

```bash
# Construir la solución actual
npx tsc -b

# Mostrar por qué cada proyecto se construye o se omite
npx tsc -b --verbose

# Mostrar qué haría sin escribir salidas
npx tsc -b --dry

# Reconstruir aunque TypeScript considere todo actualizado
npx tsc -b --force

# Vigilar cambios en el grafo
npx tsc -b --watch

# Eliminar las salidas conocidas por los proyectos
npx tsc -b --clean
```

`--clean` elimina salidas generadas; úsalo de forma consciente y no guardes archivos manuales dentro de los directorios de build.

También puedes construir un punto concreto:

```bash
npx tsc -b apps/api
```

TypeScript construirá antes sus dependencias si están desactualizadas.

### `tsc -p` no significa lo mismo

```bash
npx tsc -p apps/api/tsconfig.json
```

`-p` compila un proyecto seleccionado. No convierte al compilador en el orquestador completo del grafo. Si quieres que TypeScript determine y construya dependencias, usa `-b`.

---

## 9. Cuándo un proyecto está desactualizado

El modo build compara la información del proyecto, sus entradas, sus salidas y sus dependencias. No conviene memorizar cada detalle interno del algoritmo; importa comprender sus consecuencias.

### Cambio interno sin cambiar el contrato público

Si modificas una función privada de `contracts` pero la salida de declaraciones relevante para consumidores no cambia, TypeScript puede evitar trabajo en proyectos dependientes.

### Cambio en una declaración pública

Si agregas un nuevo estado:

```ts
export type FindingStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "resolved";
```

el archivo `.d.ts` cambia. Los consumidores deben volver a comprobarse. La función exhaustiva de `audit-core` ahora revelará una omisión útil:

```ts
const summary: Record<FindingStatus, number> = {
  open: 0,
  in_progress: 0,
  // Error: falta blocked
  resolved: 0,
};
```

El límite de proyecto no debilita el tipado; hace explícita la propagación de un cambio contractual.

---

## 10. `declarationMap`: navegación entre límites

Con `declarationMap: true`, TypeScript genera archivos `.d.ts.map` que relacionan las declaraciones emitidas con el código fuente original.

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true
  }
}
```

En editores compatibles, acciones como **Go to Definition** pueden llevarte desde un símbolo consumido hasta su fuente TypeScript, en lugar de dejarte únicamente en el `.d.ts` generado.

Es especialmente útil en un monorepo, aunque añade archivos de salida. Si publicas mapas de declaraciones, asegúrate de que las rutas y fuentes que requieren estén disponibles según tu estrategia de distribución.

---

## 11. La dirección de dependencias importa

Project References no decide qué arquitectura es correcta. Solo hace explícita la que configuras.

Una dirección razonable para SiteOps Tracker es:

```text
contracts ← audit-core ← api
     ↑                      
     └──────── web
```

- `contracts` no conoce React, Express ni PostgreSQL.
- `audit-core` depende de contratos y contiene reglas reutilizables.
- `api` depende del núcleo y adapta HTTP, persistencia y configuración.
- `web` consume contratos apropiados para HTTP, pero no importa Services ni Repositories del backend.

### Evita ciclos

Esto es incorrecto:

```text
contracts → audit-core → contracts
```

Si dos proyectos necesitan tipos comunes, extrae esos contratos hacia un proyecto de nivel inferior en lugar de crear referencias circulares.

Una buena pregunta de diseño es:

> ¿Este proyecto podría existir sin conocer los detalles tecnológicos del proyecto que está encima?

Si la respuesta es sí, la dirección probablemente va de la capa tecnológica hacia el núcleo, no al revés.

---

## 12. TypeScript sigue desapareciendo en runtime

Project References mejora el chequeo y el build. No transforma tipos en validadores.

Considera este código del frontend:

```ts
import type { FindingSummary } from "@siteops/contracts";

export async function loadFindings(): Promise<FindingSummary[]> {
  const response = await fetch("/api/findings");

  return (await response.json()) as FindingSummary[];
}
```

El `as FindingSummary[]` no revisa la respuesta. Si el servidor devuelve esto, TypeScript no lo impedirá en runtime:

```json
[
  {
    "id": 42,
    "siteId": null,
    "title": "Missing backup",
    "status": "finished"
  }
]
```

La alternativa segura comienza con `unknown` y valida en el límite:

```ts
import { z } from "zod";

const findingSummarySchema = z.object({
  id: z.string().min(1),
  siteId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["open", "in_progress", "resolved"]),
});

const findingSummaryListSchema = z.array(findingSummarySchema);

export type FindingSummary = z.infer<typeof findingSummarySchema>;

export async function loadFindings(): Promise<FindingSummary[]> {
  const response = await fetch("/api/findings");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  return findingSummaryListSchema.parse(data);
}
```

Observa la separación:

- `tsc -b` comprueba que los proyectos TypeScript respetan sus contratos;
- Zod comprueba que un valor real satisface el contrato en runtime;
- ninguno reemplaza al otro.

Esto aplica también a:

- formularios de React;
- cuerpos, parámetros y cabeceras HTTP;
- respuestas de APIs externas;
- archivos de configuración;
- variables de entorno;
- filas devueltas por PostgreSQL.

Un generic del driver de base de datos tampoco valida una fila real.

---

## 13. Relación con la arquitectura Full Stack

La arquitectura de ejecución y la arquitectura de compilación responden preguntas diferentes.

### Flujo runtime

```text
React
  → HTTP
  → Node.js
  → Router
  → Controller
  → Runtime Validation
  → Service
  → Repository
  → PostgreSQL
```

### Grafo de compilación posible

```text
contracts
  ├──→ web
  └──→ audit-core ──→ api
```

### React

Consume contratos de solicitudes y respuestas, y valida datos recibidos cuando cruzan el límite HTTP. No debe importar implementaciones del backend.

### HTTP

Transporta bytes y JSON. No transporta tipos TypeScript. Un `.d.ts` no viaja en la respuesta.

### Node.js y Router

Reciben valores desconocidos del exterior y dirigen la solicitud al controlador adecuado.

### Controller

Convierte la entrada externa en datos confiables mediante validación runtime. Solo después llama al Service.

### Runtime Validation

Protege el límite real. Puede vivir en un paquete de schemas compartidos si tanto cliente como servidor necesitan los mismos contratos ejecutables, evitando que el paquete dependa de Express o React.

### Service

Aplica casos de uso y reglas. Puede depender de contratos y puertos, no necesariamente de PostgreSQL.

### Repository

Adapta las operaciones del dominio a persistencia. La API puede referenciar un proyecto de infraestructura; el dominio no debería referenciar la API.

### PostgreSQL

Devuelve valores runtime. Sus resultados necesitan mapeo y, cuando la confianza lo exige, validación.

### Testing

Los tests pueden tener su propio `tsconfig` para separar tipos de Vitest y evitar que globals de prueba se filtren a producción.

### Docker

El build de una imagen puede ejecutar `tsc -b` en una fase de compilación y copiar solo las salidas necesarias a la imagen de runtime.

### CI/CD y Cloud

CI puede ejecutar un build limpio del grafo antes de pruebas y despliegue. Project References no reemplaza el pipeline: le proporciona una unidad de build comprobable.

---

## 14. Cuándo usar Project References

Son una buena opción cuando:

- el repositorio contiene varios paquetes o aplicaciones TypeScript;
- existen límites arquitectónicos claros;
- frontend, backend, tests y herramientas usan entornos distintos;
- varias aplicaciones consumen contratos o utilidades compartidos;
- el tiempo de compilación empieza a crecer;
- necesitas declaraciones para consumidores internos;
- deseas un build incremental coordinado por TypeScript;
- quieres detectar dependencias circulares o direcciones indebidas.

Ejemplos adecuados en tu ruta:

- SiteOps Tracker con `contracts`, `audit-core`, `api` y `web`;
- un SDK tipado separado de la API que consume;
- un analizador de configuraciones que reutiliza modelos compartidos;
- un repositorio de algoritmos dividido en librería y tests, si su tamaño lo justifica.

---

## 15. Cuándo evitarlo

No necesitas Project References automáticamente por usar TypeScript.

Evítalos o posponlos cuando:

- el proyecto es una aplicación pequeña con un solo entorno;
- no existen límites de paquete reales;
- el build actual es rápido y simple;
- el equipo todavía no tiene una razón clara para dividir el código;
- crear varios `tsconfig` solo duplicaría configuración;
- una herramienta externa ya administra el grafo y añadir otro sistema no aporta valor.

Separar prematuramente cada carpeta en un proyecto distinto aumenta mantenimiento. Una unidad de compilación debe representar una frontera significativa, no una preferencia estética.

---

## 16. Errores comunes y cómo razonarlos

### Error 1: olvidar `composite` en el proyecto referenciado

```jsonc
{
  "references": [{ "path": "../contracts" }]
}
```

Si `contracts` no está preparado como proyecto compuesto, TypeScript no puede tratar su salida de manera predecible.

**Corrección:** activa `composite` en el proyecto que otros referencian.

### Error 2: ejecutar solo `tsc -p`

El usuario espera que se construyan todas las dependencias, pero invoca un único proyecto.

**Corrección:** usa `tsc -b` cuando necesitas orquestación del grafo.

### Error 3: confundir `references` con resolución runtime

El build encuentra el orden, pero Node.js falla con `ERR_MODULE_NOT_FOUND`.

**Causa:** la referencia no crea un paquete instalable ni cambia el import emitido.

**Corrección:** configura correctamente workspaces, `package.json`, exports y resolución del runtime o bundler.

### Error 4: importar archivos fuente internos de otro proyecto

```ts
// Acoplamiento frágil
import type { InternalRow } from "../../contracts/src/internal/db-row.js";
```

Esto evita el contrato público y expone detalles internos.

**Corrección:** exporta intencionalmente la API pública y consúmela por el límite del paquete.

### Error 5: omitir archivos de `include`

Un archivo nuevo queda fuera del patrón declarado y el build compuesto lo reporta.

**Corrección:** revisa `rootDir`, `include`, `exclude` y la responsabilidad real del archivo.

### Error 6: crear una referencia circular

Dos proyectos intentan depender uno del otro.

**Corrección:** extrae contratos compartidos hacia un tercer proyecto inferior o redefine las responsabilidades.

### Error 7: compartir una base demasiado amplia

El paquete de dominio recibe accidentalmente `DOM`, globals de tests o tipos de Node.

**Corrección:** conserva en la base solo opciones verdaderamente comunes y configura cada entorno por separado.

### Error 8: confiar en una salida obsoleta

El editor o el runtime parece ver un contrato anterior.

**Diagnóstico:** ejecuta primero:

```bash
npx tsc -b --verbose
```

Si necesitas comprobar desde cero las salidas generadas:

```bash
npx tsc -b --clean
npx tsc -b
```

No conviertas `--force` o la limpieza completa en una solución automática para cada build; primero entiende por qué el grafo quedó desactualizado.

### Error 9: guardar código manual dentro de `dist`

`tsc -b --clean` puede eliminar salidas conocidas.

**Corrección:** trata `dist` como directorio generado.

### Error 10: creer que los contratos estáticos validan HTTP o PostgreSQL

Un proyecto puede compilar perfectamente y fallar con datos corruptos.

**Corrección:** valida datos externos en runtime y mantén la validación cerca del límite de confianza.

---

## 17. Diagnóstico paso a paso

Cuando un build compuesto falla, evita modificar opciones al azar.

### Paso 1: visualiza el grafo

Anota qué proyecto depende de cuál.

```text
contracts → audit-core → api
contracts → web
```

### Paso 2: verifica el proyecto referenciado

Comprueba:

- `composite: true`;
- `rootDir` y `outDir` coherentes;
- `include` completo;
- salida de declaraciones;
- ausencia de errores.

### Paso 3: usa salida detallada

```bash
npx tsc -b --verbose
```

Lee por qué TypeScript considera actualizado o desactualizado cada proyecto.

### Paso 4: separa error de tipos y error runtime

- Si `tsc` no encuentra tipos, revisa configuración, declaraciones y resolución.
- Si Node.js no encuentra el módulo al ejecutar, revisa el paquete y el runtime.
- Si un dato tiene forma incorrecta, revisa la validación runtime.

### Paso 5: limpia solo cuando sea útil

```bash
npx tsc -b --dry
npx tsc -b --clean
npx tsc -b
```

`--dry` permite observar antes de modificar salidas.

---

## 18. Ejemplo integrado: cambio de contrato en SiteOps Tracker

El paquete `contracts` define una acción correctiva:

```ts
// packages/contracts/src/corrective-action.ts
export type CorrectiveActionStatus =
  | "pending"
  | "assigned"
  | "completed";

export interface CorrectiveAction {
  id: string;
  findingId: string;
  description: string;
  status: CorrectiveActionStatus;
}
```

El núcleo de auditoría calcula si una acción sigue activa:

```ts
// packages/audit-core/src/is-active-action.ts
import type { CorrectiveAction } from "@siteops/contracts";

export function isActiveAction(action: CorrectiveAction): boolean {
  return action.status !== "completed";
}
```

La API usa el caso de uso:

```ts
// apps/api/src/controllers/list-active-actions-controller.ts
import { isActiveAction } from "@siteops/audit-core";
import type { CorrectiveAction } from "@siteops/contracts";

export function filterActiveActions(
  actions: readonly CorrectiveAction[],
): CorrectiveAction[] {
  return actions.filter(isActiveAction);
}
```

Ahora `contracts` añade un estado:

```ts
export type CorrectiveActionStatus =
  | "pending"
  | "assigned"
  | "blocked"
  | "completed";
```

El build compuesto detecta que el contrato público cambió y vuelve a comprobar consumidores. Sin embargo, TypeScript no puede decidir por sí solo si `blocked` debe contarse como activo. Esa es una regla de negocio que debes diseñar y probar.

Este punto es importante para entrevistas:

> El compilador propaga incompatibilidades estructurales; no inventa decisiones del dominio.

---

## 19. Ejercicio principal — Añadir el analizador de configuraciones al grafo

No se proporciona la solución completa. Tu objetivo es diseñar el nuevo límite y justificarlo.

### Escenario

SiteOps Tracker necesita un paquete ficticio `config-analyzer` que reciba texto ya cargado, detecte observaciones genéricas y devuelva resultados tipados. Debe depender de `contracts`, pero no de React, Express ni PostgreSQL.

Estructura inicial:

```text
packages/
├── contracts/
├── audit-core/
└── config-analyzer/
    └── src/
        └── index.ts
```

### Tu tarea

1. Crea conceptualmente `packages/config-analyzer/tsconfig.json`.
2. Activa las opciones necesarias para que sea un proyecto referenciable.
3. Agrega una referencia a `../contracts`.
4. Incluye únicamente `src/**/*.ts`.
5. Define una salida `dist` y un archivo de información incremental dentro de ella.
6. Añade `config-analyzer` al `tsconfig.json` de solución.
7. Escribe la firma tipada de esta función sin implementar todos sus detalles:

```ts
export function analyzeConfiguration(/* completa los tipos */) {
  // Implementación pendiente
}
```

El resultado debe modelar:

- un identificador de regla;
- una severidad `"low" | "medium" | "high"`;
- un mensaje;
- un número de línea opcional.

### Restricciones

- No uses `any`.
- El paquete no debe importar Express, React ni un driver de PostgreSQL.
- No importes rutas internas no exportadas de `contracts`.
- No uses una aserción para fingir que un valor externo ya fue validado.
- No agregues una referencia inversa desde `contracts` hacia `config-analyzer`.

### Pistas

1. `references` va fuera de `compilerOptions`.
2. El proyecto referenciado necesita `composite`.
3. Separa el tipo de entrada del hecho de leer un archivo. La lectura del sistema de archivos puede pertenecer a una capa Node superior.
4. Pregúntate si `line` ausente y `line: undefined` significarán lo mismo bajo `exactOptionalPropertyTypes`.
5. Ejecuta mentalmente `npx tsc -b --verbose`: ¿qué debería construirse primero?

### Entrega esperada

- el `tsconfig.json` del paquete;
- el cambio al `tsconfig.json` de solución;
- los tipos públicos;
- la firma de `analyzeConfiguration`;
- un párrafo explicando la dirección de dependencias.

---

## 20. Reto Full Stack — Diseñar un grafo sin filtrar infraestructura

### Escenario

Divide SiteOps Tracker en estas unidades:

```text
packages/contracts
packages/validation
packages/audit-core
apps/api
apps/web
```

El paquete `validation` contiene schemas Zod ejecutables para entradas HTTP compartidas. `audit-core` contiene reglas puras. `api` usa Express y PostgreSQL. `web` usa React.

### Tu reto

Diseña únicamente:

1. el grafo de referencias;
2. la lista de referencias de cada `tsconfig.json`;
3. qué entorno y tipos globales necesita cada proyecto;
4. dónde validar una respuesta HTTP recibida por React;
5. dónde convertir una fila de PostgreSQL a un modelo confiable;
6. qué comando usarías en CI para construir desde cero;
7. qué directorios generados excluirías del repositorio.

### Condiciones arquitectónicas

- `contracts` no puede depender de ningún otro proyecto de la lista;
- `validation` puede depender de `contracts`;
- `audit-core` puede depender de `contracts`, pero no de Express ni PostgreSQL;
- `api` puede depender de `validation` y `audit-core`;
- `web` puede depender de `validation` y contratos apropiados, pero no de `api`;
- no se permiten ciclos;
- los datos externos siguen siendo `unknown` hasta validarse.

### Preguntas guía

- ¿Conviene que `contracts` importe Zod, o que `validation` derive tipos a partir de schemas? Justifica una sola estrategia coherente.
- ¿Una referencia `web → api` representaría consumo HTTP o acoplamiento de código? ¿Por qué?
- ¿Qué salida pública necesita cada paquete para que sus consumidores no importen archivos internos?
- ¿Qué ocurre si cambias el schema de creación de hallazgos?

No implementes todavía Docker, CI/CD ni despliegue. En este reto solo debes dejar el grafo listo para que esas etapas tengan límites claros más adelante.

---

## 21. Preguntas de comprensión

Intenta responder sin volver a leer y luego comprueba tus ideas.

1. ¿Qué diferencia existe entre un `import` y una entrada en `references`?
2. ¿Por qué un proyecto referenciado necesita `composite`?
3. ¿Qué papel cumplen los archivos `.d.ts` en un build compuesto?
4. ¿Para qué sirve `.tsbuildinfo` y por qué no afecta al runtime?
5. ¿Por qué un `tsconfig.json` de solución suele usar `files: []`?
6. ¿Qué diferencia práctica hay entre `tsc -p` y `tsc -b`?
7. ¿Qué hace `declarationMap` en el editor?
8. ¿Project References configura automáticamente un workspace de paquetes?
9. ¿Por qué `web` no debería referenciar la implementación de `api` solo porque consume sus endpoints?
10. ¿Qué harías si dos proyectos necesitan referenciarse mutuamente?
11. ¿Por qué un build exitoso no demuestra que el JSON de una respuesta HTTP sea válido?
12. ¿Qué comando usarías para observar por qué TypeScript reconstruye un proyecto?

---

## 22. Relevancia para entrevistas técnicas

### Pregunta: ¿Qué son los Project References?

**Respuesta esperada:** son referencias entre configuraciones TypeScript que dividen un código base en proyectos más pequeños y expresan su grafo de dependencias. Junto con `composite` y `tsc -b`, permiten builds ordenados e incrementales y límites de compilación explícitos.

### Pregunta: ¿Qué hace `composite`?

**Respuesta esperada:** hace que la salida del proyecto sea predecible para consumidores y para el modo build. Exige que los archivos de implementación estén declarados por `include` o `files`, cambia el valor predeterminado de `rootDir` y habilita declaraciones por defecto.

### Pregunta: ¿Cuál es la diferencia entre `tsc -p` y `tsc -b`?

**Respuesta esperada:** `-p` compila un proyecto seleccionado; `-b` actúa como orquestador, descubre referencias, comprueba qué proyectos están actualizados y construye dependencias en orden.

### Pregunta: ¿Project References resuelve módulos en runtime?

**Respuesta esperada:** no. El grafo de compilación no sustituye la resolución de Node.js, un bundler, workspaces o las declaraciones de `package.json`.

### Pregunta: ¿Por qué emitir `.d.ts` entre proyectos?

**Respuesta esperada:** porque los consumidores necesitan el contrato público estático del proyecto referenciado sin incorporar todos sus archivos fuente como una sola unidad de compilación.

### Pregunta: ¿Cómo evitarías dependencias circulares?

**Respuesta esperada:** revisaría la dirección de capas y extraería contratos o abstracciones comunes hacia un proyecto inferior estable, en lugar de permitir referencias mutuas.

### Pregunta: ¿Project References elimina la necesidad de Zod?

**Respuesta esperada:** no. TypeScript y sus declaraciones desaparecen en runtime. HTTP, formularios, archivos, variables de entorno, APIs externas y PostgreSQL siguen requiriendo validación real.

### Respuesta breve de 30 segundos

> En un repositorio TypeScript con varias aplicaciones o paquetes, uso Project References para modelar dependencias entre unidades de compilación. Cada proyecto referenciable activa `composite` y emite declaraciones; un `tsconfig` de solución reúne el grafo y `tsc -b` construye solo lo desactualizado en el orden correcto. Esto mejora límites y tiempos de build, pero no configura el runtime ni valida datos externos.

---

## 23. Checklist profesional

Antes de dar por terminada una configuración compuesta, comprueba:

- [ ] Cada referencia representa una dependencia arquitectónica real.
- [ ] No existen ciclos.
- [ ] Cada proyecto referenciado usa `composite`.
- [ ] `include` o `files` cubre toda su implementación.
- [ ] `rootDir` y `outDir` son intencionales.
- [ ] Las declaraciones públicas se emiten correctamente.
- [ ] `declarationMap` está decidido conscientemente.
- [ ] `.tsbuildinfo` tiene una ubicación conocida.
- [ ] El `tsconfig` de solución usa `files: []` si no tiene fuentes propias.
- [ ] El build del grafo se ejecuta con `tsc -b`.
- [ ] Los imports runtime pueden resolverse fuera del compilador.
- [ ] Los paquetes no exponen rutas internas accidentalmente.
- [ ] Las opciones de DOM, Node y tests están aisladas por entorno.
- [ ] HTTP, archivos, variables de entorno y PostgreSQL se validan en runtime.

---

## 24. Resumen

- Project References conectan proyectos TypeScript, no solo archivos.
- `references` declara el grafo de unidades de compilación.
- `composite` hace predecible la salida y exige una definición completa de los archivos del proyecto.
- Los consumidores usan declaraciones del proyecto referenciado como contrato estático.
- `tsc -b` descubre dependencias, ordena el build y evita reconstruir trabajo innecesario.
- Un `tsconfig.json` de solución proporciona un punto de entrada común y suele usar `files: []`.
- `extends` comparte opciones; no expresa una dependencia entre proyectos.
- `.tsbuildinfo` pertenece al build incremental y no al runtime.
- `declarationMap` mejora la navegación desde declaraciones hacia las fuentes.
- Las referencias no crean workspaces, no reescriben imports y no configuran Node.js ni el bundler.
- Los límites de compilación deben respetar la dirección de la arquitectura.
- TypeScript sigue desapareciendo en runtime; los datos externos necesitan validación real.

---

## Referencias oficiales consultadas

- TypeScript Handbook — Project References: <https://www.typescriptlang.org/docs/handbook/project-references.html>
- TSConfig — `composite`: <https://www.typescriptlang.org/tsconfig/composite.html>
- TSConfig — `declarationMap`: <https://www.typescriptlang.org/tsconfig/declarationMap.html>
- TSConfig — `incremental`: <https://www.typescriptlang.org/tsconfig/incremental.html>
- TypeScript Handbook — Choosing Compiler Options: <https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options>

Consultadas el **29 de septiembre de 2026**.

---

# Próxima lección

**Lección 28 — Publicación de paquetes TypeScript: `package.json`, `types` y `exports`.**
