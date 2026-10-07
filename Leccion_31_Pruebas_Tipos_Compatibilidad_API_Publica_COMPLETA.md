# Lección 31 — Pruebas de tipos y compatibilidad de la API pública

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, datos, reglas y escenarios de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## Introducción

En la lección 30 aprendiste que una versión `MAJOR.MINOR.PATCH` debe describir el impacto real de un cambio sobre los consumidores. Sin embargo, clasificar un cambio manualmente no basta: también necesitas evidencia automática de que la API pública conserva las garantías prometidas.

Una prueba runtime puede confirmar que una función devuelve un objeto correcto. Aun así, esa prueba no detecta necesariamente que:

- una propiedad dejó de ser opcional;
- una función comenzó a devolver `any`;
- una unión perdió o ganó una variante;
- un parámetro cambió de `string` a `number`;
- un export público desapareció;
- un tipo interno quedó expuesto accidentalmente;
- el paquete publicado contiene declaraciones distintas de las que probaste en el código fuente.

Para esos casos existen las **pruebas de tipos**. Son pequeños programas TypeScript cuyo resultado esperado es compilar —o producir intencionalmente un error— bajo una configuración concreta.

La idea central de hoy es:

> Una API tipada no está protegida solo porque el proyecto compile; está protegida cuando pruebas explícitamente qué usos públicos deben compilar, cuáles deben rechazarse y qué superficie será publicada.

---

## Objetivo

Al terminar esta lección podrás:

1. distinguir una prueba de tipos de una prueba runtime;
2. explicar por qué `tsc --noEmit` puede funcionar como ejecutor básico de contratos estáticos;
3. escribir casos positivos que deben compilar;
4. escribir casos negativos con `@ts-expect-error`;
5. reconocer por qué `@ts-expect-error` es preferible a `@ts-ignore` para una expectativa verificable;
6. comprobar igualdad y asignabilidad entre tipos;
7. usar `satisfies` para probar un contrato sin perder inferencia útil;
8. introducir `expectTypeOf` y `assertType` de Vitest en archivos `*.test-d.ts`;
9. probar desde la entrada pública del paquete y no solo desde archivos internos;
10. separar compatibilidad de tipos, compatibilidad de empaquetado y comportamiento runtime;
11. diseñar una barrera de CI para cambios accidentales de la API pública;
12. relacionar estas verificaciones con React, HTTP, Node.js, validación runtime, Services, Repositories y PostgreSQL;
13. explicar la estrategia en una entrevista técnica.

---

## 1. El problema que resuelven las pruebas de tipos

SiteOps Tracker posee un paquete ficticio llamado `@siteops/audit-contracts`. React y el SDK consumen este contrato:

~~~ts
export type FindingPriority = "low" | "medium" | "high";

export type CreateFindingInput = {
  readonly siteId: string;
  readonly title: string;
  readonly priority: FindingPriority;
  readonly assignedTo?: string;
};

export type FindingResponse = {
  readonly id: string;
  readonly siteId: string;
  readonly title: string;
  readonly priority: FindingPriority;
  readonly status: "open" | "in_progress" | "resolved";
};

export function defineFinding(
  input: CreateFindingInput,
): CreateFindingInput {
  return input;
}
~~~

Una prueba runtime como esta verifica comportamiento:

~~~ts
import { describe, expect, it } from "vitest";
import { defineFinding } from "../src/index.js";

describe("defineFinding", () => {
  it("conserva el contenido recibido", () => {
    const result = defineFinding({
      siteId: "site-demo-01",
      title: "Inspect backup power",
      priority: "high",
    });

    expect(result.title).toBe("Inspect backup power");
  });
});
~~~

La prueba puede continuar pasando si alguien cambia accidentalmente el retorno a `any`:

~~~ts
export function defineFinding(
  input: CreateFindingInput,
): any {
  return input;
}
~~~

El valor runtime sigue teniendo `title`, pero el consumidor perdió autocompletado y seguridad estática. La prueba de valores no expresa esa regresión.

Una prueba de tipos sí puede exigir el retorno exacto:

~~~ts
import { expectTypeOf } from "vitest";
import {
  defineFinding,
  type CreateFindingInput,
} from "../src/index.js";

expectTypeOf(defineFinding)
  .returns
  .toEqualTypeOf<CreateFindingInput>();
~~~

Si el retorno se convierte en `any`, esta expectativa deja de representar el contrato deseado y la verificación debe fallar.

---

## 2. Por qué existen

TypeScript comprueba el programa que tiene delante. No recuerda por sí solo qué API prometiste ayer ni cuáles errores eran deliberados.

Las pruebas de tipos convierten esas expectativas en archivos versionados:

- **caso positivo:** este uso público debe compilar;
- **caso negativo:** este uso inválido debe producir un error;
- **relación de tipos:** este resultado debe ser igual o asignable a otro tipo;
- **superficie pública:** este símbolo debe poder importarse desde la entrada publicada;
- **regresión:** una corrección futura no debe volver a aceptar un uso inseguro.

No sustituyen al compilador. Lo usan deliberadamente como motor de prueba.

Tampoco sustituyen las pruebas runtime. El compilador no procesa una petición HTTP real, no consulta PostgreSQL y no ejecuta un schema Zod.

---

## 3. Cuatro verificaciones diferentes

| Verificación | Pregunta que responde | Herramienta típica |
| --- | --- | --- |
| Type check general | ¿El código completo respeta sus tipos? | `tsc --noEmit` |
| Prueba de tipos | ¿Estos usos concretos deben compilar o fallar? | `tsc`, `@ts-expect-error`, Vitest typecheck |
| Revisión de API pública | ¿Cambió la superficie declarada que publicamos? | `.d.ts`, reporte de API, revisión de diff |
| Prueba runtime | ¿El JavaScript y los datos reales se comportan bien? | Vitest, integración, E2E |

Una estrategia profesional combina las cuatro. Pasar una no demuestra automáticamente las demás.

---

## 4. Base mínima: usar `tsc --noEmit`

`noEmit` pide a TypeScript comprobar el proyecto sin producir JavaScript ni declaraciones. Esto permite tratar la compilación de fixtures como una prueba.

Una estructura pequeña puede ser:

~~~text
packages/audit-contracts/
├── src/
│   └── index.ts
├── test-d/
│   ├── public-api.positive.ts
│   └── public-api.negative.ts
├── tsconfig.json
├── tsconfig.type-tests.json
└── package.json
~~~

Configuración dedicada:

~~~json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true
  },
  "include": [
    "src/**/*.ts",
    "test-d/**/*.ts"
  ]
}
~~~

Script del paquete:

~~~json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test:types": "tsc -p tsconfig.type-tests.json"
  }
}
~~~

La configuración separada tiene dos ventajas:

1. incluye los fixtures de tipos sin mezclarlos con el build publicado;
2. puede aplicar opciones estrictas explícitas y reproducibles.

No combines `noEmit` con `emitDeclarationOnly` en el mismo propósito. Una configuración comprueba sin emitir; otra configuración de build genera las declaraciones que consumirán otros paquetes.

---

## 5. Caso positivo: demostrar qué debe compilar

Un caso positivo imita a un consumidor válido:

~~~ts
// test-d/public-api.positive.ts
import {
  defineFinding,
  type CreateFindingInput,
  type FindingPriority,
} from "../src/index.js";

const input = {
  siteId: "site-demo-01",
  title: "Inspect backup power",
  priority: "high",
} satisfies CreateFindingInput;

const result = defineFinding(input);

const priority: FindingPriority = result.priority;

void priority;
~~~

Este archivo documenta que:

- `assignedTo` continúa siendo opcional;
- `"high"` sigue siendo una prioridad válida;
- `defineFinding` acepta el input público;
- el resultado conserva una prioridad compatible con `FindingPriority`.

### ¿Por qué usar `satisfies`?

Una anotación cambia el tipo visible de la variable al contrato declarado:

~~~ts
const annotated: CreateFindingInput = {
  siteId: "site-demo-01",
  title: "Inspect backup power",
  priority: "high",
};
~~~

`satisfies` comprueba compatibilidad pero conserva información más específica del valor:

~~~ts
const checked = {
  siteId: "site-demo-01",
  title: "Inspect backup power",
  priority: "high",
} satisfies CreateFindingInput;

// El tipo inferido de checked.priority conserva el literal "high".
~~~

Esto resulta útil para probar que un objeto cumple la API sin borrar inferencia que también deseas inspeccionar.

---

## 6. Caso negativo: demostrar qué debe rechazarse

Una API también promete rechazar usos inseguros:

~~~ts
// test-d/public-api.negative.ts
import { defineFinding } from "../src/index.js";

defineFinding({
  siteId: "site-demo-01",
  title: "Inspect backup power",
  // @ts-expect-error: priority solo acepta low, medium o high.
  priority: "urgent",
});

// @ts-expect-error: siteId es obligatorio.
defineFinding({
  title: "Inspect backup power",
  priority: "high",
});

defineFinding({
  siteId: "site-demo-01",
  title: "Inspect backup power",
  priority: "high",
  // @ts-expect-error: assignedTo debe ser string cuando está presente.
  assignedTo: 42,
});
~~~

`@ts-expect-error` significa: **la siguiente línea debe producir un error de TypeScript**.

Si una modificación hace que la línea deje de fallar, el compilador informa que la directiva ya no se utiliza. Así, una relajación accidental del contrato se vuelve visible.

### `@ts-expect-error` frente a `@ts-ignore`

`@ts-ignore` silencia el error exista o no. Por eso puede permanecer ocultando nada después de un cambio.

`@ts-expect-error` verifica la existencia del error esperado. Para pruebas negativas es normalmente la opción adecuada.

### Limitación importante

La directiva confirma que existe **algún** error en la siguiente línea, no que sea exactamente el error que imaginabas. Este caso puede dar un falso positivo:

~~~ts
// @ts-expect-error: esperamos que assignedTo rechace number.
defineFindng({ assignedTo: 42 });
~~~

Aquí el error podría ser que `defineFindng` está mal escrito. Reduce ese riesgo mediante:

- casos positivos que importen y usen el mismo símbolo;
- ejemplos pequeños con una sola causa de error;
- descripciones claras;
- revisión del diagnóstico cuando creas la prueba;
- una prueba runtime separada si también importa el comportamiento.

---

## 7. Probar asignabilidad sin una librería adicional

Puedes expresar relaciones entre tipos con tipos auxiliares:

~~~ts
type Extends<From, To> = [From] extends [To]
  ? true
  : false;

type Expect<T extends true> = T;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;
~~~

Ahora comprueba un resultado:

~~~ts
import {
  defineFinding,
  type CreateFindingInput,
} from "../src/index.js";

type ActualReturn = ReturnType<typeof defineFinding>;

const returnIsExact: Expect<
  Equal<ActualReturn, CreateFindingInput>
> = true;

void returnIsExact;
~~~

Si el retorno deja de coincidir, `Expect<false>` viola la restricción `T extends true`.

### Igualdad no es lo mismo que asignabilidad

Estas dos preguntas son diferentes:

1. ¿`A` y `B` son exactamente equivalentes para esta utilidad?
2. ¿Un valor `A` puede usarse donde se espera `B`?

En una API estructural, muchas pruebas necesitan asignabilidad y no igualdad exacta. Probar igualdad en todas partes vuelve frágil la suite frente a detalles que no rompen al consumidor.

También debes tratar estas utilidades como herramientas limitadas: tipos como `any`, sobrecargas, genéricos complejos y algunas intersecciones pueden producir resultados poco intuitivos. Una API crítica merece fixtures de consumidor además de trucos puramente tipados.

---

## 8. La dirección de compatibilidad importa

Supón una versión anterior y una actual:

~~~ts
type PreviousCreateInput = {
  readonly siteId: string;
  readonly title: string;
};

type CurrentCreateInput = {
  readonly siteId: string;
  readonly title: string;
  readonly description?: string;
};
~~~

Para conservar llamadas antiguas, un input anterior debe seguir siendo aceptado por el contrato actual:

~~~ts
const oldInputStillWorks: Expect<
  Extends<PreviousCreateInput, CurrentCreateInput>
> = true;

void oldInputStillWorks;
~~~

La dirección es:

> input anterior → parámetro actual

Para una salida ocurre lo contrario. El valor nuevo debe poder utilizarse donde el consumidor esperaba la salida anterior:

~~~ts
type PreviousResponse = {
  readonly status: "open" | "resolved";
};

type CurrentResponse = {
  readonly status: "open" | "resolved";
};

const newOutputStillFitsOldConsumer: Expect<
  Extends<CurrentResponse, PreviousResponse>
> = true;

void newOutputStillFitsOldConsumer;
~~~

La dirección es:

> resultado actual → expectativa anterior

Si `CurrentResponse` comienza a producir `"archived"`, deja de ser asignable a `PreviousResponse`. Un `switch` exhaustivo anterior no conoce esa variante.

Esta distinción evita una equivocación frecuente: ejecutar siempre `Old extends New` sin preguntarse quién produce y quién consume el dato.

---

## 9. Introducción a pruebas de tipos con Vitest

Vitest permite escribir archivos `*.test-d.ts` y usar `expectTypeOf` o `assertType`. Esos archivos se analizan estáticamente; no se ejecutan como pruebas JavaScript normales.

Ejemplo:

~~~ts
// test-d/public-api.test-d.ts
import { assertType, expectTypeOf } from "vitest";
import {
  defineFinding,
  type CreateFindingInput,
  type FindingResponse,
} from "../src/index.js";

expectTypeOf(defineFinding)
  .parameter(0)
  .toEqualTypeOf<CreateFindingInput>();

expectTypeOf(defineFinding)
  .returns
  .toEqualTypeOf<CreateFindingInput>();

declare const response: FindingResponse;

expectTypeOf(response.id).toBeString();
expectTypeOf(response.status)
  .toEqualTypeOf<"open" | "in_progress" | "resolved">();

assertType<CreateFindingInput>({
  siteId: "site-demo-01",
  title: "Inspect backup power",
  priority: "medium",
});

assertType<CreateFindingInput>({
  siteId: "site-demo-01",
  title: "Inspect backup power",
  // @ts-expect-error: priority no admite un número.
  priority: 1,
});
~~~

Script mínimo:

~~~json
{
  "scripts": {
    "test:types": "vitest --run --typecheck"
  }
}
~~~

Ventajas frente a utilidades caseras:

- las intenciones suelen leerse mejor;
- puedes inspeccionar parámetros, retornos y propiedades;
- la salida de error intenta señalar el tipo esperado y el actual;
- encaja con una futura suite Vitest del monorepo.

No confundas esta integración con pruebas runtime: el archivo `.test-d.ts` no demuestra que una función sea ejecutable, lance un error o procese JSON correctamente.

---

## 10. Prueba la entrada pública, no solamente `src`

Esta importación verifica un archivo interno:

~~~ts
import type { FindingResponse } from "../src/models/finding.js";
~~~

Pero el consumidor no instala tu estructura `src`. Importa el paquete:

~~~ts
import type { FindingResponse } from "@siteops/audit-contracts";
~~~

Probar el entry point público ayuda a detectar:

- un símbolo no reexportado desde `index.ts`;
- una ruta ausente en `package.json#exports`;
- declaraciones que no llegan al paquete;
- dependencias de tipos que no están disponibles para el consumidor;
- imports internos que funcionan en el monorepo pero no después de publicar.

Una prueba negativa también puede proteger límites:

~~~ts
// @ts-expect-error: FindingRow es un detalle del Repository.
import type { FindingRow } from "@siteops/audit-contracts";
~~~

Sin embargo, importar el nombre del paquete desde el propio workspace puede resolverse mediante aliases y ocultar problemas de empaquetado. La verificación más fuerte es instalar el tarball generado en un consumidor aislado y ejecutar allí `tsc --noEmit`.

---

## 11. Las declaraciones emitidas son parte del producto

Con `declaration: true`, TypeScript genera archivos `.d.ts` que describen la API externa del módulo.

Configuración de build separada:

~~~json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationMap": true,
    "outDir": "./dist/types"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["test-d", "tests"]
}
~~~

Una liberación debería comprobar al menos:

1. que las declaraciones pueden generarse;
2. que el entry point público referencia las declaraciones correctas;
3. que el tarball contiene los archivos necesarios;
4. que un consumidor limpio puede importar el paquete;
5. que el diff de la API pública fue revisado.

No revises únicamente el source diff. Una inferencia modificada puede cambiar el `.d.ts` emitido aunque nadie haya editado una interface explícita.

---

## 12. Reporte de API y revisión de cambios

En paquetes maduros, una herramienta de análisis puede seguir los exports desde el entry point y producir un reporte revisable. API Extractor, por ejemplo, puede generar:

- un reporte de la API pública;
- un rollup de declaraciones `.d.ts`;
- un modelo para documentación.

Flujo conceptual:

~~~text
src TypeScript
      ↓
tsc genera .d.ts
      ↓
analizador recorre exports públicos
      ↓
reporte versionado de API
      ↓
CI detecta un cambio no aprobado
~~~

Un reporte no decide por ti si el cambio es `major`, `minor` o `patch`. Hace visible la diferencia para que la revises con las reglas de compatibilidad de la lección 30.

Tampoco reemplaza los fixtures: un diff puede mostrar que cambió una firma, mientras que un fixture demuestra cómo afecta a una llamada real del consumidor.

---

## 13. Un consumidor aislado cierra la brecha de empaquetado

El monorepo puede ofrecer accesos que no existirán para otra persona:

- paths de `tsconfig`;
- referencias directas a `src`;
- dependencias instaladas en la raíz;
- archivos no incluidos en el tarball;
- versiones enlazadas por el workspace.

Por eso una verificación de publicación puede seguir estos pasos:

~~~text
1. Construir el paquete.
2. Crear el tarball que se publicaría.
3. Crear un proyecto consumidor temporal y vacío.
4. Instalar únicamente el tarball y sus dependencias declaradas.
5. Copiar fixtures que importen el nombre público.
6. Ejecutar tsc --noEmit.
7. Ejecutar una prueba runtime mínima del JavaScript exportado.
~~~

La prueba de tipos protege el contrato estático. La prueba runtime mínima confirma que el export también existe cuando Node ejecuta el paquete.

---

## 14. La validación runtime continúa siendo obligatoria

Los tipos TypeScript desaparecen al generar JavaScript. Este código no valida una petición HTTP:

~~~ts
const body = request.body as CreateFindingInput;
~~~

Solo le ordena al compilador confiar en el programador.

En la frontera HTTP, el dato debe comenzar como `unknown` y validarse realmente:

~~~ts
import { z } from "zod";

export const CreateFindingInputSchema = z.object({
  siteId: z.string().trim().min(1),
  title: z.string().trim().min(3),
  priority: z.enum(["low", "medium", "high"]),
  assignedTo: z.string().trim().min(1).optional(),
}).strict();

export type CreateFindingInput = z.infer<
  typeof CreateFindingInputSchema
>;

export function parseCreateFindingInput(
  payload: unknown,
): CreateFindingInput {
  return CreateFindingInputSchema.parse(payload);
}
~~~

Prueba de tipos:

~~~ts
import { expectTypeOf } from "vitest";
import {
  parseCreateFindingInput,
  type CreateFindingInput,
} from "../src/index.js";

expectTypeOf(parseCreateFindingInput)
  .parameter(0)
  .toBeUnknown();

expectTypeOf(parseCreateFindingInput)
  .returns
  .toEqualTypeOf<CreateFindingInput>();
~~~

Prueba runtime independiente:

~~~ts
import { describe, expect, it } from "vitest";
import { CreateFindingInputSchema } from "../src/index.js";

describe("CreateFindingInputSchema", () => {
  it("rechaza una prioridad externa desconocida", () => {
    const result = CreateFindingInputSchema.safeParse({
      siteId: "site-demo-01",
      title: "Inspect backup power",
      priority: "urgent",
    });

    expect(result.success).toBe(false);
  });
});
~~~

Necesitas ambas:

- la primera protege la firma para desarrolladores TypeScript;
- la segunda protege la aplicación frente a datos reales.

La misma regla aplica a formularios, APIs externas, archivos, variables de entorno y resultados de PostgreSQL: todos requieren validación o conversión runtime en su frontera.

---

## 15. Qué conviene probar

Prioriza contratos que tengan consumidores o lógica tipada no trivial:

- funciones exportadas;
- tipos y uniones públicas;
- generics de un SDK;
- inferencia de helpers reutilizables;
- props de componentes compartidos;
- respuestas y errores tipados del SDK;
- schemas que producen tipos inferidos;
- subpaths públicos de un paquete;
- regresiones donde un tipo se volvió demasiado amplio;
- compatibilidad entre una versión anterior y la actual.

Ejemplos útiles para otros proyectos de la ruta:

- el repositorio de algoritmos conserva el tipo genérico de un resultado;
- el analizador de configuraciones devuelve una unión discriminada exhaustiva;
- el SDK tipado conserva el response asociado a cada endpoint;
- la API REST mantiene separados `CreateFindingInput`, modelo de dominio y `FindingRow`;
- un componente React compartido exige las props correctas sin exportar detalles internos.

---

## 16. Cuándo evitar o limitar estas pruebas

Evita convertir cada inferencia interna en un contrato congelado.

No suele aportar valor:

- probar el tipo obvio de una constante privada;
- duplicar miles de diagnósticos que ya cubre el type check general;
- exigir igualdad exacta cuando solo importa asignabilidad;
- guardar snapshots enormes sin revisar su significado;
- probar detalles internos que quieres poder refactorizar;
- usar pruebas de tipos para afirmar comportamiento runtime;
- conservar errores deliberados con `@ts-ignore` sin una expectativa verificable.

Una buena prueba protege intención pública, no implementación accidental.

---

## 17. Errores comunes y su causa

### Error 1 — Creer que “el proyecto compila” prueba la API pública

El proyecto solo demuestra que sus consumidores actuales compilan. Puede faltar un uso válido que tu suite nunca representa.

### Error 2 — Probar desde un archivo interno

Una importación desde `src` no comprueba `exports`, el tarball ni las declaraciones publicadas.

### Error 3 — Usar únicamente casos positivos

También debes proteger qué usos inválidos deben continuar rechazándose.

### Error 4 — Usar `@ts-ignore` para pruebas negativas

No falla cuando desaparece el error; por eso la expectativa puede quedar obsoleta silenciosamente.

### Error 5 — Colocar `@ts-expect-error` sobre una línea con varias causas

La directiva acepta cualquier diagnóstico de esa línea y puede ocultar un error distinto.

### Error 6 — Probar siempre igualdad exacta

La API puede seguir siendo compatible aunque el tipo inferido cambie de una forma asignable y segura.

### Error 7 — Invertir la dirección de asignabilidad

Inputs y outputs se comparan desde perspectivas distintas. Primero identifica productor y consumidor.

### Error 8 — Confiar solo en un reporte `.d.ts`

Las declaraciones no verifican JavaScript, reglas Zod, HTTP, errores runtime ni contenido real del paquete.

### Error 9 — Confiar solo en Vitest runtime

Un test de valores puede pasar aunque un retorno se haya ampliado a `any`.

### Error 10 — Probar la fuente pero no el artefacto

El paquete publicado puede omitir archivos, declarar rutas incorrectas o resolver dependencias por accidente dentro del monorepo.

### Error 11 — Usar assertions como validación

`payload as FindingResponse` no inspecciona un solo byte del payload.

### Error 12 — Exponer tipos de PostgreSQL

Si `FindingRow` llega al contrato público, una migración de columnas puede romper React y el SDK sin necesidad.

---

## 18. Relación explícita con la arquitectura Full Stack

~~~text
React
  ↓ usa SDK y contratos públicos
HTTP
  ↓ transporta JSON sin tipos TypeScript
Node → Router → Controller
  ↓ recibe unknown y coordina la frontera
Runtime Validation
  ↓ convierte datos válidos a un tipo confiable
Service
  ↓ aplica casos de uso sobre modelos estables
Repository
  ↓ traduce dominio y persistencia
PostgreSQL
  ↓ almacena filas y restricciones reales
Testing → Docker → CI/CD → Cloud
  protege compilación, ejecución y entrega
~~~

### React

Las pruebas de tipos comprueban props, funciones del SDK y estados discriminados que el frontend consume. No deberían acoplar componentes a filas de base de datos.

### HTTP

HTTP transporta bytes y JSON. Una interface no viaja por la red. El response debe validarse si procede de una frontera no confiable.

### Node, Router y Controller

El Router elige el handler y el Controller recibe datos externos. Una prueba de tipos puede proteger la firma del Controller, pero solo la validación runtime decide si `request.body` es aceptable.

### Runtime Validation

Zod u otra estrategia equivalente inspecciona el valor real. Las pruebas runtime cubren aceptación y rechazo; las pruebas de tipos cubren el tipo inferido y la firma pública del parser.

### Service

El Service debería recibir modelos ya validados. Sus puertos públicos pueden tener pruebas de asignabilidad sin depender de Express.

### Repository

El Repository aísla SQL y mapea `FindingRow` a dominio. Sus tipos internos no deberían aparecer en el paquete de contratos públicos.

### PostgreSQL

Constraints, tipos SQL y datos existentes actúan en runtime. Un type test no prueba una migración ni una consulta real.

### Testing

Aquí distingues type tests, unit tests, integration tests y E2E. Cada nivel responde una pregunta diferente.

### Docker

Un contenedor reproducible debe instalar y compilar las mismas versiones de TypeScript y dependencias que CI. Aun así, construir la imagen no reemplaza los fixtures de consumidor.

### CI/CD

CI puede ejecutar type check, pruebas de tipos, emisión de `.d.ts`, revisión de API, pruebas runtime y verificación del tarball antes de publicar o desplegar.

### Cloud

Cloud ejecuta JavaScript y procesa datos reales; los tipos ya desaparecieron. Las verificaciones estáticas reducen errores antes del despliegue, mientras validación, pruebas, observabilidad y controles de datos protegen la ejecución.

---

## 19. Pipeline gradual recomendado

Para el paquete ficticio de contratos:

~~~json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test:types": "vitest --run --typecheck",
    "build:types": "tsc -p tsconfig.build.json",
    "test:runtime": "vitest run"
  }
}
~~~

Orden conceptual de CI:

~~~text
1. Instalar con lockfile.
2. Ejecutar typecheck general.
3. Ejecutar fixtures y pruebas de tipos.
4. Ejecutar pruebas runtime.
5. Generar declaraciones.
6. Revisar cambios de API pública.
7. Empaquetar.
8. Instalar el tarball en un consumidor aislado.
9. Compilar y ejecutar la prueba mínima del consumidor.
~~~

No necesitas adoptar todas las herramientas el primer día. Empieza con `tsc --noEmit`, casos positivos y `@ts-expect-error`; añade reportes y consumidores aislados cuando el paquete ya tenga consumidores reales.

---

## 20. Ejercicio — Proteger el contrato del SDK

### Escenario

El SDK ficticio exporta:

~~~ts
export type ApiError =
  | { readonly kind: "validation"; readonly issues: readonly string[] }
  | { readonly kind: "not_found"; readonly resourceId: string }
  | { readonly kind: "network"; readonly retryable: boolean };

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApiError };

export type FindingSummary = {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "in_progress" | "resolved";
};

export declare function getFinding(
  id: string,
): Promise<Result<FindingSummary>>;
~~~

### Tu tarea

Crea un archivo `get-finding.test-d.ts` que compruebe:

1. que `getFinding` recibe exactamente un `string`;
2. que retorna `Promise<Result<FindingSummary>>`;
3. que una llamada con `number` es rechazada;
4. que `result.value` solo es accesible cuando `result.ok === true`;
5. que `result.error` solo es accesible cuando `result.ok === false`;
6. que `"urgent"` no es un `FindingSummary["status"]` válido;
7. que los tres casos de `ApiError` pueden estrecharse por `kind`;
8. que un objeto válido puede usar `satisfies FindingSummary` sin perder su literal de `status`;
9. que ningún fixture importe desde una ruta interna de `src`;
10. que el archivo se ejecute mediante el script `test:types`.

### Restricciones

- No uses `any`.
- No uses `@ts-ignore`.
- No uses assertions `as` para forzar el resultado.
- Cada `@ts-expect-error` debe tener una única causa probable.
- No escribas una prueba runtime dentro del archivo `.test-d.ts`.
- No cambies la API para hacer que la prueba sea más fácil.

### Pistas

1. Usa `Parameters<typeof getFinding>` para inspeccionar parámetros.
2. Usa `ReturnType<typeof getFinding>` para inspeccionar el retorno.
3. `Awaited<T>` permite observar el valor resuelto de una promesa.
4. Puedes usar `expectTypeOf`, `assertType` o las utilidades `Equal` y `Expect`.
5. Coloca el comentario negativo inmediatamente antes de la línea que debe fallar.
6. Para comprobar narrowing, escribe una función pequeña que reciba el resultado resuelto.
7. Ejecuta primero el fixture correcto; después modifica temporalmente una firma para confirmar que la prueba realmente detecta la regresión.

### Entrega esperada

- un archivo de prueba de tipos completo;
- un `tsconfig` o configuración Vitest que lo incluya;
- el script de ejecución;
- una explicación de qué protege cada expectativa;
- una nota sobre lo que todavía necesita una prueba runtime.

No se incluye la solución completa: el objetivo es que construyas y compruebes las expectativas.

---

## 21. Reto Full Stack — Contrato estático y frontera runtime

### Escenario

SiteOps Tracker añadirá `listFindings(siteId)` al SDK. El flujo será:

~~~text
React → SDK → HTTP → Node/Express → Controller
      → Runtime Validation → Service → Repository → PostgreSQL
~~~

El response externo propuesto es:

~~~json
{
  "items": [
    {
      "id": "finding-demo-101",
      "title": "Inspect backup power",
      "status": "open"
    }
  ],
  "nextCursor": null
}
~~~

### Tu reto

Diseña una verificación pequeña pero completa que incluya:

1. un schema Zod para el response HTTP;
2. el tipo inferido desde ese schema;
3. una función `parseListFindingsResponse(payload: unknown)`;
4. una función pública del SDK con retorno tipado;
5. un caso positivo de type test;
6. al menos tres casos negativos con `@ts-expect-error`;
7. una expectativa sobre el tipo resuelto de la promesa;
8. una prueba runtime que rechace un status desconocido;
9. una prueba runtime que rechace un item sin `id`;
10. un adapter entre response HTTP y modelo usado por React si sus formas difieren;
11. una regla que impida exportar `FindingRow`;
12. una lista del contenido esperado del tarball;
13. un fixture que importe únicamente desde `@siteops/sdk`;
14. una propuesta de pasos para CI;
15. una clasificación SemVer si `nextCursor` pasa de opcional a obligatorio.

### Condiciones

- Todo `response.json()` comienza como `unknown`.
- TypeScript no se presenta como validación de red.
- El Controller no pasa `request.body` sin validar al Service.
- El Service no conoce Express.
- El Repository no exporta filas al SDK.
- PostgreSQL no se trata como fuente automáticamente confiable del response público.
- Debes distinguir pruebas estáticas y runtime por nombre y ubicación.
- No se requiere implementar React, Express ni PostgreSQL completos.

### Pregunta de diseño

Si el type test pasa pero el schema Zod rechaza un fixture válido de la versión anterior, ¿el cambio es compatible? Explica qué contrato falló, qué clase de prueba lo detecta y cómo afectaría la versión del paquete.

---

## 22. Preguntas de comprensión

Responde sin consultar y después verifica tus ideas.

1. ¿Qué diferencia existe entre type check general y prueba de tipos?
2. ¿Qué expresa un caso positivo?
3. ¿Qué expresa un caso negativo?
4. ¿Por qué `@ts-expect-error` es más verificable que `@ts-ignore`?
5. ¿Qué falso positivo puede ocurrir con `@ts-expect-error`?
6. ¿Qué conserva `satisfies` que una anotación puede ensanchar?
7. ¿Cuándo necesitas igualdad exacta y cuándo basta asignabilidad?
8. ¿Cuál es la dirección correcta para comprobar compatibilidad de inputs?
9. ¿Cuál es la dirección correcta para comprobar compatibilidad de outputs?
10. ¿Qué hace Vitest con un archivo `*.test-d.ts`?
11. ¿Por qué un type test no demuestra comportamiento runtime?
12. ¿Por qué debes probar el entry point público?
13. ¿Qué problema puede ocultar un alias del monorepo?
14. ¿Qué información ofrece un `.d.ts` emitido?
15. ¿Qué valor aporta un reporte de API?
16. ¿Por qué conviene instalar el tarball en un consumidor aislado?
17. ¿Por qué `request.body as Input` no valida HTTP?
18. ¿Qué deben comprobar por separado una prueba de tipos y una prueba Zod?
19. ¿Por qué `FindingRow` no debería ser parte del contrato público?
20. ¿Qué pasos mínimos colocarías en CI para un paquete tipado?

---

## 23. Relevancia para entrevistas técnicas

### Pregunta: ¿Qué es una prueba de tipos?

Es un fixture TypeScript que usa el compilador para verificar que ciertos usos públicos compilan, que otros producen errores y que las relaciones de tipos esperadas se mantienen.

### Pregunta: ¿Por qué no basta con ejecutar `tsc` sobre la aplicación?

Porque solo cubre los usos actualmente presentes. Una prueba de tipos documenta explícitamente la API que quieres conservar, incluidos casos negativos y consumidores representativos.

### Pregunta: ¿Cuándo usarías `@ts-expect-error`?

En un caso donde el error de TypeScript es el comportamiento esperado, especialmente una prueba negativa. Si el error desaparece, la directiva no utilizada hace fallar la verificación.

### Pregunta: ¿Qué diferencia hay entre un type test y un test runtime?

El primero se analiza durante compilación y protege firmas o asignabilidad. El segundo ejecuta JavaScript y protege valores, efectos, errores y validación de datos reales.

### Pregunta: ¿Cómo comprobarías compatibilidad de una librería?

Probaría casos positivos y negativos desde su entry point, compararía la API declarada, generaría `.d.ts`, empaquetaría el artefacto, lo instalaría en un consumidor aislado y ejecutaría pruebas runtime del comportamiento público.

### Pregunta: ¿Por qué importa la dirección de asignabilidad?

Porque una API consume inputs y produce outputs. Para llamadas antiguas, el input anterior debe ser aceptado por el parámetro actual; para resultados, el output actual debe caber en la expectativa anterior.

### Respuesta breve de 30 segundos

> I protect a TypeScript public API at several levels. I use consumer-style fixtures for valid calls, `@ts-expect-error` for invalid calls, and type assertions for parameters and return values. I also review emitted declarations and compile an isolated consumer against the packed artifact. These checks do not replace runtime tests: HTTP and database data still require real validation, such as Zod schemas, because TypeScript types are erased at runtime.

---

## 24. Checklist profesional

Antes de considerar protegida una API tipada, comprueba:

- [ ] Los tests importan desde el entry point público.
- [ ] Existe al menos un caso positivo representativo.
- [ ] Los usos inseguros importantes tienen casos negativos.
- [ ] Se usa `@ts-expect-error`, no un silencio indefinido con `@ts-ignore`.
- [ ] Cada expectativa negativa tiene una sola causa probable.
- [ ] Los parámetros y retornos críticos están verificados.
- [ ] La suite distingue igualdad de asignabilidad.
- [ ] La dirección input/output está documentada.
- [ ] No se congelan detalles internos innecesarios.
- [ ] Los fixtures están incluidos en la configuración de typecheck.
- [ ] Los archivos de type tests no se confunden con pruebas runtime.
- [ ] Las declaraciones `.d.ts` se generan correctamente.
- [ ] El diff de la API pública se revisa.
- [ ] `package.json#exports` y `types` apuntan a artefactos reales.
- [ ] El tarball contiene JavaScript y declaraciones necesarios.
- [ ] Un consumidor aislado puede instalar e importar el paquete.
- [ ] Hay una prueba runtime mínima del export público.
- [ ] Los payloads HTTP comienzan como `unknown`.
- [ ] Los schemas validan datos reales.
- [ ] No se usan assertions para sustituir validación.
- [ ] Los tipos de filas PostgreSQL permanecen internos.
- [ ] CI ejecuta las verificaciones antes de publicar.
- [ ] Los cambios detectados se clasifican con SemVer.

---

## 25. Resumen

- Una prueba runtime puede pasar aunque la API TypeScript se degrade.
- Un type check general no recuerda por sí solo todas las promesas públicas.
- Las pruebas de tipos convierten usos válidos e inválidos en fixtures versionados.
- `tsc --noEmit` es una base sencilla para ejecutar contratos estáticos.
- Un caso positivo demuestra qué debe compilar.
- `@ts-expect-error` demuestra que una línea debe seguir fallando.
- `@ts-ignore` no avisa cuando el error desaparece.
- `@ts-expect-error` puede dar falsos positivos si la línea falla por otra causa.
- `satisfies` comprueba compatibilidad y conserva inferencia específica.
- Igualdad y asignabilidad responden preguntas diferentes.
- La dirección de compatibilidad depende de quién consume y quién produce.
- Para inputs, el uso anterior debe ser aceptado por el contrato actual.
- Para outputs, el resultado actual debe caber en la expectativa anterior.
- Vitest ofrece `expectTypeOf` y `assertType` para archivos `*.test-d.ts`.
- Los type tests de Vitest se analizan estáticamente; no ejecutan el comportamiento.
- Probar `src` no equivale a probar el paquete publicado.
- Los `.d.ts` emitidos forman parte del producto consumido.
- Un reporte de API hace visible el cambio, pero no decide SemVer por ti.
- Un consumidor aislado detecta errores que el monorepo puede ocultar.
- Los tipos TypeScript desaparecen en runtime.
- HTTP, formularios, APIs externas, archivos, variables de entorno y PostgreSQL requieren validación real.
- Zod protege valores runtime; una prueba de tipos protege la firma inferida o publicada.
- React, SDK, API, Service, Repository y PostgreSQL deben conservar límites claros.
- CI debe combinar verificación estática, artefactos publicados y pruebas runtime.

---

## Referencias oficiales consultadas

- TypeScript 3.9 Release Notes — `@ts-expect-error`: <https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html#ts-expect-error-comments>
- TypeScript TSConfig — `noEmit`: <https://www.typescriptlang.org/tsconfig/noEmit.html>
- TypeScript TSConfig — `declaration`: <https://www.typescriptlang.org/tsconfig/declaration.html>
- TypeScript TSConfig — `emitDeclarationOnly`: <https://www.typescriptlang.org/tsconfig/emitDeclarationOnly.html>
- TypeScript Handbook — Type Compatibility: <https://www.typescriptlang.org/docs/handbook/type-compatibility.html>
- Vitest Guide — Testing Types: <https://vitest.dev/guide/testing-types.html>
- API Extractor — What is API Extractor?: <https://api-extractor.com/pages/overview/intro/>
- Zod — Defining schemas: <https://zod.dev/api>

Consultadas el **5 de octubre de 2026**.

---

# Próxima lección

**Lección 32 — Análisis estático con ESLint y typescript-eslint: reglas conscientes de tipos.**
