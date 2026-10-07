# Lección 33 — Quality gates reproducibles: integrar typecheck, lint, pruebas y build en scripts y CI

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, datos, reglas y escenarios de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo — cierre de la etapa  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## Introducción

En la lección 32 configuraste ESLint y typescript-eslint para detectar patrones que el compilador permite, como promesas flotantes y propagación insegura de `any`. Ahora falta convertir todas las comprobaciones del proyecto en una barrera reproducible.

Un proyecto puede funcionar en tu computadora y fallar al integrarse porque:

- alguien no ejecutó el type check;
- las pruebas quedaron en modo watch;
- un warning de ESLint se ignoró;
- `package.json` y `package-lock.json` no coinciden;
- el build real usa una configuración diferente;
- una declaración `.d.ts` no puede generarse;
- el código compila, pero un schema runtime no rechaza datos inválidos;
- CI usa otra versión de Node.js;
- un paso falla, pero el workflow continúa o no es obligatorio.

Una **quality gate** convierte una condición de calidad en una decisión binaria: el cambio puede avanzar o debe detenerse.

La idea central de hoy es:

> Los comandos locales, CI y el build deben verificar el mismo contrato mediante entradas reproducibles, códigos de salida confiables y pasos explícitos.

---

## Objetivo

Al terminar esta lección podrás:

1. definir qué es una quality gate y distinguirla de una recomendación;
2. identificar qué protege `typecheck`, `lint`, pruebas y build;
3. crear scripts npm pequeños y componibles;
4. usar `npm ci` y el lockfile para una instalación reproducible;
5. separar pruebas runtime de pruebas de tipos;
6. ejecutar Vitest una sola vez en automatización;
7. impedir que un build TypeScript publique artefactos con errores;
8. construir un comando `verify` compartido por desarrollo y CI;
9. crear un workflow mínimo de GitHub Actions para Node.js;
10. fijar una versión soportada de Node.js;
11. limitar permisos y cancelar ejecuciones obsoletas;
12. decidir cuándo ejecutar gates en serie o en paralelo;
13. comprender por qué coverage no equivale a calidad;
14. conservar validación runtime con Zod dentro de la barrera;
15. relacionar los gates con toda la arquitectura Full Stack;
16. explicar esta estrategia en una entrevista técnica.

---

## 1. El problema: “en mi máquina funciona” no es evidencia suficiente

Supón que el SDK de SiteOps Tracker contiene esta función:

~~~ts
export async function createFinding(
  payload: unknown,
): Promise<void> {
  fetch("/api/findings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
~~~

El editor puede mostrar pocos problemas y una prueba manual puede parecer exitosa. Sin embargo:

- la promesa de `fetch` queda sin esperar;
- una respuesta `400` o `500` se ignora;
- `payload` no se valida;
- ninguna prueba demuestra la conducta;
- el build podría no incluir el archivo correcto;
- otro desarrollador puede instalar dependencias distintas.

Una sola herramienta no cubre toda la cadena.

La barrera mínima necesita preguntas independientes:

~~~text
¿Los tipos son válidos?                → typecheck
¿Se violan políticas estáticas?        → lint
¿El JavaScript se comporta bien?       → tests runtime
¿Los contratos tipados siguen firmes?  → type tests
¿Puede producirse el artefacto?        → build
¿Las dependencias son reproducibles?   → instalación congelada
~~~

Si cualquiera falla, el cambio todavía no está listo.

---

## 2. Qué convierte una comprobación en gate

Una comprobación se convierte en quality gate cuando cumple estas propiedades:

1. **Binaria:** termina con éxito o con un código de salida distinto de cero.
2. **Relevante:** protege un riesgo real del proyecto.
3. **Reproducible:** usa versiones y entradas controladas.
4. **Automática:** no depende de recordar un paso manual.
5. **Accionable:** el diagnóstico ayuda a localizar la causa.
6. **Obligatoria:** una rama protegida o la política del equipo impide ignorarla.
7. **Acotada:** no intenta demostrar propiedades que la herramienta no puede verificar.

Por ejemplo, `npm run lint` es solo una comprobación local si nadie está obligado a ejecutarla. Se vuelve gate cuando CI la ejecuta en cada pull request y el merge requiere que termine correctamente.

### Gate frente a métrica

Una cifra de coverage es una métrica. Solo se vuelve gate si existe un umbral que hace fallar el proceso.

Incluso entonces, 90 % de coverage no demuestra que las assertions sean correctas. El umbral evita una caída cuantitativa; la calidad de los casos continúa dependiendo del diseño de pruebas.

---

## 3. Responsabilidad exacta de cada gate

| Gate | Protege principalmente | No demuestra por sí solo |
| --- | --- | --- |
| `typecheck` | compatibilidad estática | valores reales de HTTP o PostgreSQL |
| `lint` | patrones y políticas del código | comportamiento ejecutado |
| type tests | contrato TypeScript público | implementación runtime |
| unit tests | unidades y reglas aisladas | integración completa |
| integration tests | colaboración con infraestructura | experiencia end-to-end |
| build | generación del artefacto | corrección funcional total |
| Docker build | imagen reproducible y ensamblada | salud de producción |
| validación Zod | forma del dato en runtime | persistencia o efectos posteriores |

Un gate fuerte no exagera lo que sabe.

### Regla esencial

Los tipos TypeScript desaparecen al generar JavaScript. Por eso estas fuentes siguen necesitando validación real:

- requests y responses HTTP;
- formularios;
- APIs externas;
- archivos;
- variables de entorno;
- mensajes y eventos;
- resultados de base de datos.

CI puede comprobar que existe un schema y ejecutar sus pruebas, pero el type checker no puede inspeccionar por adelantado el próximo payload recibido en producción.

---

## 4. Los scripts de `package.json` son la interfaz del proyecto

Evita colocar lógica distinta en documentación, CI y comandos personales. Define una interfaz estable en `package.json`:

~~~json
{
  "engines": {
    "node": ">=24 <25"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit --pretty false",
    "lint": "eslint . --max-warnings=0",
    "test:unit": "vitest run",
    "test:types": "vitest --run --typecheck.only",
    "test": "npm run test:types && npm run test:unit",
    "build": "tsc -p tsconfig.build.json",
    "verify": "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
~~~

### Por qué scripts pequeños

- puedes ejecutar una sola comprobación mientras corriges un error;
- CI muestra con claridad qué gate falló;
- el mismo nombre funciona en Windows, Linux y macOS mediante npm;
- cada comando posee una responsabilidad;
- `verify` compone la política completa sin duplicarla.

### Por qué no esconder todo en `build`

Un build monolítico puede fallar con un mensaje ambiguo. Separar `typecheck`, `lint`, pruebas y build hace visibles las fronteras:

- un error de tipos no parece un error de bundling;
- un test fallido no se confunde con emisión;
- un warning nuevo no desaparece entre cientos de líneas;
- cada gate puede medirse y optimizarse por separado.

---

## 5. Reproducibilidad: Node.js, dependencias y lockfile

### Fija una línea soportada de Node.js

Un archivo `.nvmrc` sencillo puede contener:

~~~text
24
~~~

Al 7 de octubre de 2026, Node.js 24 pertenece a una línea LTS soportada. Para un proyecto real, revisa periódicamente el calendario oficial y actualiza la versión de manera planificada.

El campo `engines` comunica el rango esperado, mientras `.nvmrc` ayuda a herramientas de desarrollo y puede alimentar CI. Si tu organización exige reproducibilidad exacta, fija también la versión minor y patch mediante su administrador de runtimes.

### Conserva `package-lock.json`

El lockfile registra el árbol resuelto de dependencias. Debe versionarse junto con `package.json`.

### Usa `npm ci` en automatización

~~~bash
npm ci
~~~

`npm ci` está diseñado para entornos automatizados:

- requiere un lockfile existente;
- falla si el lockfile no coincide con `package.json`;
- parte de una instalación limpia;
- no reescribe `package.json` ni `package-lock.json`.

En CI no conviene “arreglar” automáticamente un lockfile desactualizado. Esa inconsistencia debe corregirse y revisarse en el commit.

### Mismos flags, misma política

Si el árbol se generó con opciones que modifican la resolución, registra esas opciones a nivel de proyecto. Una instalación local y `npm ci` deben recibir la misma política.

---

## 6. Gate de tipos: comprobar sin emitir

El script:

~~~json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit --pretty false"
  }
}
~~~

responde si el proyecto satisface su configuración TypeScript sin generar JavaScript, source maps ni declaraciones.

### Ejemplo de error detectado

~~~ts
type FindingStatus =
  | "open"
  | "in_progress"
  | "resolved";

const status: FindingStatus = "archived";
~~~

### Por qué `--pretty false` en CI

La salida sin formato visual suele ser más fácil de almacenar y procesar en logs no interactivos. Localmente puedes mantener una variante con salida visual si lo prefieres.

### Monorepo con Project References

Cuando existan varios proyectos compuestos, el gate puede evolucionar a:

~~~bash
tsc -b --pretty false --stopBuildOnErrors
~~~

`--stopBuildOnErrors` evita construir proyectos dependientes después de un error ascendente. No cambies a build mode hasta que la estructura de referencias esté correctamente configurada.

---

## 7. Gate de lint: cero deuda nueva silenciosa

~~~json
{
  "scripts": {
    "lint": "eslint . --max-warnings=0"
  }
}
~~~

`--max-warnings=0` convierte cualquier warning en un resultado no exitoso.

Sin ese límite, esta configuración puede imprimir una advertencia y aun devolver éxito:

~~~js
export default [
  {
    rules: {
      "@typescript-eslint/no-floating-promises": "warn",
    },
  },
];
~~~

La decisión debe ser consciente:

- una regla `error` falla directamente;
- una regla `warn` también falla en CI gracias al umbral;
- una regla `off` queda fuera de la política.

No uses `eslint --fix` como gate principal. CI debería verificar el estado comprometido, no modificarlo en silencio.

---

## 8. Gate de pruebas runtime: una ejecución finita

Vitest usa watch mode en contextos interactivos. Para una automatización, expresa una sola ejecución:

~~~json
{
  "scripts": {
    "test:unit": "vitest run"
  }
}
~~~

### Ejemplo runtime con Zod

~~~ts
import { z } from "zod";

export const FindingSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(3),
  status: z.enum([
    "open",
    "in_progress",
    "resolved",
  ]),
}).strict();

export type Finding = z.infer<typeof FindingSchema>;
~~~

~~~ts
import { describe, expect, it } from "vitest";
import { FindingSchema } from "./finding.js";

describe("FindingSchema", () => {
  it("rechaza un estado externo desconocido", () => {
    const result = FindingSchema.safeParse({
      id: "finding-demo-101",
      title: "Inspect backup power",
      status: "archived",
    });

    expect(result.success).toBe(false);
  });
});
~~~

El test ejecuta JavaScript. El tipo `Finding` por sí solo no puede rechazar ese objeto cuando llega desde la red.

---

## 9. Gate de pruebas de tipos

Un archivo `*.test-d.ts` protege la experiencia del consumidor:

~~~ts
import { expectTypeOf } from "vitest";
import {
  getFinding,
  type Finding,
} from "@siteops/sdk";

expectTypeOf(getFinding)
  .parameter(0)
  .toBeString();

expectTypeOf(getFinding)
  .returns
  .toEqualTypeOf<Promise<Finding>>();

// @ts-expect-error: el identificador debe ser string.
getFinding(101);
~~~

El script separado puede ser:

~~~json
{
  "scripts": {
    "test:types": "vitest --run --typecheck.only"
  }
}
~~~

Los type tests se analizan estáticamente; no ejecutan la petición HTTP. Por eso permanecen separados de los tests runtime.

---

## 10. Gate de build: comprobar el artefacto real

Un type check correcto no garantiza que el build emita los archivos esperados. Usa una configuración dedicada:

~~~json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": false,
    "noEmitOnError": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": [
    "dist",
    "tests",
    "test-d"
  ]
}
~~~

Y un script explícito:

~~~json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json"
  }
}
~~~

### Por qué `noEmitOnError`

Su intención es evitar que el compilador produzca output cuando reporta errores. Un pipeline no debe publicar artefactos parcialmente confiables.

### Qué revisar después del build

- existe `dist`;
- el entry point esperado fue emitido;
- las declaraciones `.d.ts` están presentes;
- los imports generados resuelven en Node.js;
- `package.json#exports` apunta a archivos existentes;
- no se incluyeron pruebas, secretos ni archivos privados.

El build gate protege el artefacto, no la lógica de negocio completa.

---

## 11. Componer un único comando de verificación

~~~json
{
  "scripts": {
    "verify": "npm run typecheck && npm run lint && npm run test && npm run build"
  }
}
~~~

El operador `&&` detiene la cadena cuando un comando devuelve un código no exitoso.

### Orden recomendado para un proyecto pequeño

~~~text
1. typecheck
2. lint
3. type tests
4. unit tests
5. build
~~~

Este orden no es universal. La regla útil es ejecutar primero checks rápidos y con diagnósticos claros, dejando los pasos costosos para después.

### Ventaja principal

La misma verificación funciona localmente:

~~~bash
npm run verify
~~~

y en CI:

~~~yaml
- run: npm run verify
~~~

CI no inventa una política paralela.

---

## 12. Workflow mínimo de GitHub Actions

Crea `.github/workflows/ci.yml`:

~~~yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@v6

      - name: Set up Node.js
        uses: actions/setup-node@v7
        with:
          node-version-file: .nvmrc
          cache: npm

      - name: Install locked dependencies
        run: npm ci

      - name: Run quality gates
        run: npm run verify
~~~

### Lectura paso a paso

1. `pull_request` verifica cambios antes de integrarlos.
2. `push` sobre `main` vuelve a comprobar el estado integrado.
3. `permissions: contents: read` limita el token a lo que este workflow necesita.
4. `concurrency` agrupa ejecuciones de la misma rama.
5. `cancel-in-progress` cancela una revisión obsoleta cuando llega un commit nuevo.
6. `checkout` obtiene el repositorio.
7. `setup-node` usa la versión declarada en `.nvmrc`.
8. `cache: npm` acelera descargas del gestor; no sustituye `npm ci`.
9. `npm ci` reconstruye dependencias desde el lockfile.
10. `npm run verify` ejecuta la misma política disponible localmente.

Los números de versión de las actions cambian con el tiempo. Revisa la documentación y la política de seguridad del repositorio. Para mayor estabilidad y seguridad, una organización puede exigir referencias por SHA completo en lugar de etiquetas mayores.

---

## 13. Gate obligatorio y protección de rama

El workflow puede terminar correctamente y aun ser ignorado si el repositorio permite merge sin él.

Para que sea gate real, configura la rama principal para exigir el check `verify` antes del merge.

### Resultado deseado

~~~text
Pull request
    ↓
CI / verify
    ├── typecheck
    ├── lint
    ├── type tests
    ├── unit tests
    └── build
    ↓
Solo si todo pasa → merge permitido
~~~

No conviertas el deployment en sustituto de CI. Primero verifica el cambio; después decide si se despliega.

---

## 14. Serie frente a paralelismo

### Un solo job secuencial

Ventajas:

- configuración pequeña;
- una sola instalación;
- fácil reproducción con `npm run verify`;
- suficiente para un portafolio o repositorio mediano.

Desventaja:

- un test lento impide aprovechar varios runners;
- el build espera aunque lint y pruebas sean independientes.

### Jobs paralelos

Un pipeline mayor puede separar:

~~~text
               ┌─ typecheck ─┐
install/source ├─ lint ───────┼─ build/package
               └─ tests ─────┘
~~~

Pero cada job aislado necesita preparar el repositorio y las dependencias, o consumir artefactos cuidadosamente versionados.

### Regla práctica

Empieza con un job claro. Paraleliza después de medir, no por estética. Una configuración compleja puede costar más tiempo de arranque que el que ahorra.

---

## 15. Coverage: señal útil, garantía limitada

Vitest puede generar coverage con V8 o Istanbul:

~~~json
{
  "scripts": {
    "test:coverage": "vitest run --coverage"
  }
}
~~~

Un umbral puede impedir que la cobertura caiga accidentalmente. Sin embargo:

- una línea ejecutada puede no tener assertions útiles;
- 100 % de líneas no cubre todas las combinaciones;
- coverage no valida accesibilidad, seguridad ni rendimiento;
- aumentar el porcentaje con tests triviales crea falsa confianza.

En SiteOps Tracker prioriza casos significativos:

- Zod rechaza un payload inválido;
- el Service no persiste cuando falla la validación;
- el Repository mapea correctamente una fila;
- el SDK transforma errores HTTP;
- React presenta estados de carga y error.

La etapa de Testing profundizará en unitarias, integración y E2E. Aquí basta comprender cómo incluirlas como gates diferenciados.

---

## 16. Caché, artefactos y diagnósticos

### Caché

Una caché acelera trabajo repetido, pero no debe convertirse en una entrada oculta.

Buenas propiedades:

- clave derivada del sistema operativo y lockfile;
- invalidación cuando cambian dependencias;
- instalación reproducible aunque la caché esté vacía;
- nunca tratar `node_modules` antiguo como evidencia de corrección.

### Artefactos

Puede ser útil conservar:

- reportes de pruebas;
- coverage;
- logs de integración;
- `dist` validado;
- resultados E2E y capturas cuando existan.

No subas secretos, `.env`, credenciales o dumps con datos sensibles.

### Diagnósticos

Un buen gate responde:

- qué comando falló;
- qué archivo o test causó el error;
- cuál era la expectativa;
- cómo reproducirlo localmente.

`npm run verify` debe ser el primer comando de reproducción documentado.

---

## 17. Validación runtime dentro de la barrera

Considera este Controller ficticio:

~~~ts
import { z } from "zod";

const CreateFindingInputSchema = z.object({
  siteId: z.string().trim().min(1),
  title: z.string().trim().min(3),
  priority: z.enum(["low", "medium", "high"]),
}).strict();

type CreateFindingInput = z.infer<
  typeof CreateFindingInputSchema
>;

interface CreateFindingService {
  execute(
    input: CreateFindingInput,
  ): Promise<{ readonly id: string }>;
}

export function createFindingController(
  service: CreateFindingService,
) {
  return async (body: unknown) => {
    const input = CreateFindingInputSchema.parse(body);
    return service.execute(input);
  };
}
~~~

El gate de tipos verifica que el Service reciba `CreateFindingInput`. El gate de lint comprueba que la promesa se devuelva. El test runtime debe demostrar que el schema rechaza datos incorrectos.

~~~ts
import { describe, expect, it, vi } from "vitest";

describe("createFindingController", () => {
  it("no llama al Service con un body inválido", async () => {
    const execute = vi.fn();
    const controller = createFindingController({ execute });

    await expect(
      controller({
        siteId: "site-demo-01",
        title: "x",
        priority: "urgent",
      }),
    ).rejects.toBeInstanceOf(z.ZodError);

    expect(execute).not.toHaveBeenCalled();
  });
});
~~~

Así CI no “valida el próximo request”; verifica que el código de validación siga comportándose como debe.

---

## 18. Cuándo utilizar quality gates

Úsalos desde el inicio cuando el repositorio:

- recibe pull requests;
- produce una aplicación o paquete;
- comparte contratos TypeScript;
- construye frontend y backend;
- ejecuta migraciones;
- genera una imagen Docker;
- se despliega a Cloud;
- tiene más de una persona o más de un entorno;
- forma parte de tu portafolio profesional.

Incluso trabajando solo, CI detecta dependencias implícitas de tu computadora y demuestra disciplina de ingeniería.

---

## 19. Cuándo evitar o posponer un gate específico

No conviertas cada idea en requisito inmediato.

Puedes posponer:

- E2E si todavía no existe un flujo completo;
- PostgreSQL de integración si aún no hay Repository concreto;
- Docker build si no existe Dockerfile;
- matrices de múltiples sistemas operativos sin requisito real;
- coverage estricto durante una migración inicial;
- publicación de paquetes antes de tener un consumidor.

No debes posponer indefinidamente los gates básicos de una base TypeScript:

- instalación reproducible;
- typecheck;
- lint;
- pruebas relevantes;
- build.

La estrategia correcta es incremental: empieza pequeño, pero haz obligatorio lo que ya declaraste.

---

## 20. Errores comunes y su causa

### Error 1 — Usar `npm install` en CI sin necesidad

Puede modificar el lockfile o aceptar diferencias que deberían fallar. Para una instalación congelada usa `npm ci`.

### Error 2 — No versionar `package-lock.json`

Cada entorno puede resolver árboles distintos y la caché pierde una clave confiable.

### Error 3 — Ejecutar `vitest` sin `run`

Puede iniciar watch mode en desarrollo. Expresa una ejecución finita para automatización.

### Error 4 — Tratar build como sinónimo de typecheck

El bundler puede transpilar sin comprobar todos los tipos. Conserva un gate TypeScript explícito.

### Error 5 — Tratar typecheck como build

`--noEmit` no demuestra que el artefacto real pueda generarse ni que sus exports existan.

### Error 6 — Permitir warnings ilimitados

La deuda crece aunque el check aparezca verde. Define el umbral deseado.

### Error 7 — Duplicar comandos dentro del YAML

La política local y CI divergen. Invoca scripts del proyecto.

### Error 8 — Usar una versión Node.js EOL

Pierdes correcciones y compatibilidad del ecosistema. Usa una línea LTS soportada y planifica upgrades.

### Error 9 — Confiar en la caché como instalación

La caché es una optimización. Una ejecución desde cero debe seguir funcionando.

### Error 10 — Continuar después de un error crítico

Opciones como `continue-on-error` pueden volver decorativo un gate. Úsalas solo para experimentos deliberadamente no bloqueantes.

### Error 11 — Medir solo coverage

Un porcentaje alto con assertions débiles no protege comportamiento importante.

### Error 12 — Ejecutar todos los gates costosos primero

El feedback se vuelve lento. Ordena por costo y claridad o paraleliza después de medir.

### Error 13 — Dar permisos de escritura a CI sin necesidad

Un workflow de verificación normalmente solo necesita leer el repositorio.

### Error 14 — Introducir secretos en pull requests

Los checks de código no deberían depender de credenciales de producción. Diseña entornos de prueba aislados.

### Error 15 — Creer que CI valida datos futuros

CI ejecuta fixtures conocidos. La aplicación todavía necesita schemas, constraints, autenticación, manejo de errores y observabilidad runtime.

---

## 21. Relación explícita con la arquitectura Full Stack

~~~text
React
  ↓ build, lint, componentes y pruebas
HTTP
  ↓ contratos y fixtures de responses
Node → Router → Controller
  ↓ handlers, promesas y errores
Runtime Validation
  ↓ schemas Zod y tests de rechazo
Service
  ↓ reglas de negocio unitarias
Repository
  ↓ integración y mapeo
PostgreSQL
  ↓ constraints y pruebas con infraestructura
Testing → Docker → CI/CD → Cloud
  ↓ gates antes de empaquetar y desplegar
~~~

### React

El build verifica TSX, imports y producción del bundle. Testing Library comprobará interacción y accesibilidad en su etapa. Los responses del SDK siguen requiriendo validación runtime.

### HTTP

Los fixtures prueban status, body y errores conocidos. Los tipos no viajan por HTTP.

### Node, Router y Controller

Typecheck protege firmas; lint protege promesas; tests demuestran que errores y validación recorren el flujo esperado.

### Runtime Validation

Zod convierte `unknown` en un valor confiable o produce un error. Los gates ejecutan casos válidos e inválidos.

### Service

Las pruebas unitarias protegen decisiones de negocio sin acoplarlas a Express o PostgreSQL.

### Repository

Las pruebas de integración comprueban consultas, mapeos y transacciones. No deben confundirse con unit tests.

### PostgreSQL

Constraints y migraciones existen en runtime. Un futuro job de integración levantará una instancia desechable; no usará producción.

### Testing

Unitarias, integración y E2E responden preguntas diferentes. La ruta las profundizará por etapas.

### Docker

El Docker build debe ocurrir después de gates básicos o reutilizar un artefacto ya verificado. La imagen no corrige código defectuoso.

### CI/CD

CI comprueba cada cambio. CD solo promueve un commit que ya pasó gates y controles del entorno.

### Cloud

El despliegue necesita además health checks, logs, métricas, secretos y rollback. Un CI verde es condición previa, no garantía absoluta de operación.

---

## 22. Ejemplo integrado: contrato de verificación de SiteOps Tracker

### Estructura inicial

~~~text
siteops-tracker/
├── src/
├── tests/
├── test-d/
├── eslint.config.mjs
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── package.json
├── package-lock.json
├── .nvmrc
└── .github/
    └── workflows/
        └── ci.yml
~~~

### Contrato de la barrera

~~~ts
type GateName =
  | "typecheck"
  | "lint"
  | "type-tests"
  | "unit-tests"
  | "build";

type GateResult =
  | {
      readonly name: GateName;
      readonly ok: true;
      readonly durationMs: number;
    }
  | {
      readonly name: GateName;
      readonly ok: false;
      readonly durationMs: number;
      readonly summary: string;
    };

export function canMerge(
  results: readonly GateResult[],
): boolean {
  return (
    results.length > 0 &&
    results.every((result) => result.ok)
  );
}
~~~

Este modelo es didáctico: GitHub Actions usa códigos de salida y checks reales. La unión discriminada ayuda a explicar que una falla debe conservar información accionable.

### Prueba del concepto

~~~ts
import { describe, expect, it } from "vitest";
import { canMerge } from "./gate-result.js";

describe("canMerge", () => {
  it("rechaza el cambio si falla un gate", () => {
    expect(
      canMerge([
        {
          name: "typecheck",
          ok: true,
          durationMs: 820,
        },
        {
          name: "unit-tests",
          ok: false,
          durationMs: 1_420,
          summary: "Schema accepted an unknown status",
        },
      ]),
    ).toBe(false);
  });
});
~~~

El ejemplo conecta el concepto de gate con discriminated unions, `readonly`, pruebas runtime y una decisión explícita.

---

## 23. Ejercicio — Diseñar la barrera local

### Estado inicial

Recibes este `package.json` incompleto:

~~~json
{
  "scripts": {
    "test": "vitest",
    "lint": "eslint .",
    "build": "tsc",
    "verify": "npm run lint && npm test"
  }
}
~~~

Y este código:

~~~ts
export async function loadSite(
  siteId: string,
) {
  const response = await fetch(`/api/sites/${siteId}`);
  return response.json();
}
~~~

### Tu tarea

Propón los cambios necesarios para que:

1. exista un gate de TypeScript sin emisión;
2. ESLint falle con cualquier warning;
3. Vitest haga una sola ejecución;
4. las pruebas de tipos tengan un script distinguible;
5. el build use `tsconfig.build.json`;
6. el build no emita ante errores;
7. `verify` incluya todos los gates;
8. `response.json()` no propague `any`;
9. exista un schema Zod para el response;
10. exista un test runtime para una respuesta inválida;
11. exista un type test del retorno del SDK;
12. Node.js y el lockfile formen parte del contrato reproducible.

### Restricciones

- No uses `any`.
- No uses `as Site` para sustituir validación.
- No uses `--force` para ocultar dependencias incompatibles.
- No desactives warnings globalmente.
- No copies los comandos completos dentro del workflow.
- No incluyas una solución completa en la entrega inicial.

### Pistas

1. Usa `tsc --noEmit` para el gate estático.
2. Revisa `--max-warnings=0`.
3. `vitest run` no queda esperando cambios.
4. El JSON externo debe asignarse a `unknown` antes de validarse.
5. El schema puede producir el tipo mediante `z.infer`.
6. `verify` debe llamar scripts pequeños.
7. Ejecuta localmente desde una instalación limpia antes de escribir YAML.

### Entrega esperada

- scripts corregidos;
- `tsconfig.build.json`;
- schema y tipo inferido;
- un test runtime;
- un type test;
- una explicación de qué riesgo protege cada gate.

No se incluye la solución completa: el objetivo es que diseñes la barrera y justifiques su orden.

---

## 24. Reto Full Stack — Pipeline gradual del monorepo

### Escenario

El proyecto ficticio evoluciona a:

~~~text
apps/web          React + TypeScript
apps/api          Node.js + Express + TypeScript
packages/contracts Zod y tipos públicos
packages/sdk      cliente HTTP tipado
packages/config-analyzer analizador de archivos
packages/algorithms repositorio de ejercicios TypeScript
~~~

### Tu reto

Diseña, sin implementar todavía toda la infraestructura, un pipeline que incluya:

1. una versión LTS de Node.js compartida;
2. instalación con lockfile;
3. typecheck de todos los proyectos;
4. lint tipado;
5. type tests de contratos y SDK;
6. unit tests de Services y algoritmos;
7. tests runtime de schemas Zod;
8. build de paquetes, API y frontend;
9. verificación de exports públicos;
10. un job futuro de integración con PostgreSQL desechable;
11. un Docker build después de la verificación;
12. gates requeridos antes del merge;
13. permisos mínimos del workflow;
14. cancelación de ejecuciones obsoletas;
15. una política de caché derivada del lockfile;
16. artefactos de diagnóstico sin secretos;
17. separación entre CI y deployment;
18. una estrategia de paralelismo basada en medición;
19. un tiempo máximo por job;
20. un procedimiento local para reproducir cualquier falla.

### Condiciones

- React no importa tipos internos del Repository.
- El SDK valida responses HTTP reales.
- El Controller valida requests antes del Service.
- El Service no conoce Express.
- El Repository no entrega filas PostgreSQL al frontend.
- Los tests de integración no usan producción.
- Docker no sustituye typecheck, lint ni tests.
- Un deployment nunca comienza desde un commit que omitió gates.

### Pregunta de diseño

Si `typecheck` y `build` pasan, pero el test Zod demuestra que el SDK acepta `status: "archived"`, ¿debería permitirse el merge?

Explica qué contrato runtime falló, por qué TypeScript no podía detectarlo y en qué gate debe quedar representada la regresión.

---

## 25. Preguntas de comprensión

Responde sin consultar y después verifica tus ideas.

1. ¿Qué diferencia existe entre una comprobación y un gate?
2. ¿Qué propiedades hacen reproducible a un gate?
3. ¿Por qué conviene mantener scripts pequeños?
4. ¿Qué protege `tsc --noEmit`?
5. ¿Qué no protege `tsc --noEmit`?
6. ¿Por qué `--max-warnings=0` cambia el resultado del lint?
7. ¿Por qué CI debe usar `vitest run`?
8. ¿Qué diferencia existe entre un unit test y un type test?
9. ¿Por qué el build sigue siendo necesario después del typecheck?
10. ¿Qué aporta `noEmitOnError`?
11. ¿Qué problema detecta `npm ci` entre manifiesto y lockfile?
12. ¿Por qué debe versionarse `package-lock.json`?
13. ¿Qué relación existe entre `.nvmrc` y `setup-node`?
14. ¿Por qué la caché no sustituye una instalación limpia?
15. ¿Qué hace `permissions: contents: read`?
16. ¿Qué beneficio aporta `cancel-in-progress`?
17. ¿Cuándo conviene un solo job secuencial?
18. ¿Cuándo puede ayudar el paralelismo?
19. ¿Por qué coverage no demuestra calidad completa?
20. ¿Cómo prueba CI la validación runtime?
21. ¿Por qué TypeScript no valida el siguiente payload HTTP?
22. ¿Qué gate corresponde a un Repository PostgreSQL?
23. ¿Qué condición convierte un check de CI en requisito de merge?
24. ¿Por qué CI y CD deben permanecer conceptualmente separados?
25. ¿Cuál es el comando único para reproducir la barrera local?

---

## 26. Relevancia para entrevistas técnicas

### Pregunta: ¿Qué es una quality gate?

Es una comprobación automática y obligatoria que debe pasar antes de que un cambio avance. Tiene una condición clara de éxito, entradas reproducibles y un diagnóstico accionable.

### Pregunta: ¿Por qué ejecutas typecheck y build?

El typecheck verifica el programa sin emitir. El build comprueba que la configuración de producción puede generar el artefacto, incluidas declaraciones, imports y outputs esperados.

### Pregunta: ¿Por qué usar `npm ci` en CI?

Porque instala desde el lockfile, falla si no coincide con `package.json`, parte de un estado limpio y no reescribe los manifiestos. Eso reduce diferencias entre ejecuciones.

### Pregunta: ¿Cómo evitas que CI diverja del entorno local?

Centralizo los comandos en scripts npm, fijo la línea de Node.js, versiono el lockfile y hago que CI invoque el mismo `npm run verify` que puede ejecutar cualquier desarrollador.

### Pregunta: ¿CI reemplaza la validación runtime?

No. CI puede ejecutar tests de los schemas, pero los datos reales siguen llegando después del despliegue. Cada frontera HTTP, archivo, entorno o base de datos debe validar o mapear el valor en runtime.

### Pregunta: ¿Qué paralelizarías?

Después de medir, podría ejecutar typecheck, lint y tests en jobs independientes si su duración justifica instalaciones separadas. Mantendría build o packaging dependiente de los gates requeridos.

### Respuesta breve de 30 segundos

> I keep quality checks as small package scripts and compose them into one reproducible `verify` command. CI installs from the lockfile with `npm ci`, uses a supported Node.js version, and runs type checking, typed linting, type tests, runtime tests, and the production build. TypeScript still does not validate external data, so HTTP and database boundaries use runtime schemas with dedicated tests. The CI check is required before merge, and deployment only consumes a commit that passed those gates.

---

## 27. Checklist profesional

Antes de considerar lista la barrera, comprueba:

- [ ] Node.js usa una línea LTS soportada.
- [ ] La versión esperada está declarada para desarrollo y CI.
- [ ] `package-lock.json` está versionado.
- [ ] CI instala con `npm ci`.
- [ ] Los flags de resolución son consistentes.
- [ ] Existe un script `typecheck` sin emisión.
- [ ] Existe un script `lint` con política de warnings.
- [ ] Las pruebas runtime usan una ejecución finita.
- [ ] Las pruebas de tipos están identificadas por separado.
- [ ] El build usa configuración propia.
- [ ] El build no publica output ante errores.
- [ ] `verify` compone todos los gates obligatorios.
- [ ] El comando local y el comando de CI son iguales.
- [ ] Los payloads externos empiezan como `unknown`.
- [ ] Zod valida requests y responses relevantes.
- [ ] Los schemas poseen tests válidos e inválidos.
- [ ] Typecheck no se presenta como validación runtime.
- [ ] La caché depende del lockfile.
- [ ] Una caché vacía no rompe el pipeline.
- [ ] Los permisos del token son mínimos.
- [ ] Las ejecuciones obsoletas pueden cancelarse.
- [ ] Cada job tiene un límite de tiempo razonable.
- [ ] El check es obligatorio antes del merge.
- [ ] Los artefactos no incluyen secretos.
- [ ] CI y deployment son etapas distintas.
- [ ] Existe una forma local de reproducir cada falla.
- [ ] El paralelismo se basa en mediciones.
- [ ] Docker ocurre después de comprobar el código.
- [ ] PostgreSQL de integración nunca apunta a producción.

---

## 28. Resumen

- Una quality gate bloquea el avance cuando una condición requerida falla.
- Un gate debe ser binario, reproducible, automático, accionable y obligatorio.
- Typecheck, lint, type tests, tests runtime y build protegen riesgos diferentes.
- Los tipos TypeScript desaparecen en runtime.
- HTTP, formularios, archivos, entorno y PostgreSQL requieren validación real.
- Zod inspecciona valores; CI ejecuta pruebas de esa inspección.
- Los scripts npm forman la interfaz estable del proyecto.
- Los scripts pequeños facilitan diagnóstico y composición.
- `npm run verify` evita duplicar políticas entre desarrollo y CI.
- `npm ci` exige un lockfile coherente y no lo reescribe.
- La versión de Node.js debe pertenecer a una línea soportada.
- `tsc --noEmit` comprueba tipos sin construir artefactos.
- ESLint con cero warnings permitidos evita deuda silenciosa.
- `vitest run` representa una ejecución finita.
- Los type tests no sustituyen tests runtime.
- El build demuestra que puede generarse el artefacto real.
- `noEmitOnError` evita output TypeScript ante diagnósticos.
- Una rama protegida convierte el check en requisito real de merge.
- Los permisos mínimos reducen el alcance del token de CI.
- La concurrencia puede cancelar revisiones obsoletas.
- La caché optimiza; no sustituye reproducibilidad.
- Coverage es una señal, no una prueba completa de calidad.
- Empieza con un job claro y paraleliza después de medir.
- Docker y Cloud consumen resultados verificados; no corrigen fallas previas.
- CI verde es una condición necesaria, no una garantía total de producción.

---

## Referencias oficiales consultadas

- [npm Docs — `npm ci`](https://docs.npmjs.com/cli/commands/npm-ci/)
- [npm Docs — `npm run`](https://docs.npmjs.com/cli/commands/npm-run/)
- [TypeScript — `noEmit`](https://www.typescriptlang.org/tsconfig/noEmit.html)
- [TypeScript — `noEmitOnError`](https://www.typescriptlang.org/tsconfig/noEmitOnError.html)
- [TypeScript — `stopBuildOnErrors`](https://www.typescriptlang.org/tsconfig/stopBuildOnErrors.html)
- [ESLint — Command Line Interface](https://eslint.org/docs/latest/use/command-line-interface)
- [Vitest — Command Line Interface](https://vitest.dev/guide/cli)
- [Vitest — Testing Types](https://vitest.dev/guide/testing-types)
- [Vitest — Coverage](https://vitest.dev/guide/coverage)
- [GitHub Docs — Building and testing Node.js](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [GitHub Docs — Workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- [GitHub Docs — Concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency)
- [Node.js — Release schedule and status](https://nodejs.org/en/about/previous-releases)
- [Zod — Defining schemas](https://zod.dev/api)

Consultadas el **7 de octubre de 2026**.

---

# Próxima lección

**Lección 34 — React con TypeScript: JSX, componentes funcionales y props tipadas.**
