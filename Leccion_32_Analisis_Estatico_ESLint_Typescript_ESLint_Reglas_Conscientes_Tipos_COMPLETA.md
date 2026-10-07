# Lección 32 — Análisis estático con ESLint y typescript-eslint: reglas conscientes de tipos

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación completamente ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Su arquitectura objetivo usa React + TypeScript, HTTP, Node.js/Express + TypeScript, validación en runtime, Services, Repositories y PostgreSQL, seguida de Testing, Docker, CI/CD y Cloud. Todos los nombres, datos, reglas y escenarios de esta lección son genéricos y ficticios.

**Ruta:** Full Stack Developer con TypeScript  
**Etapa actual:** TypeScript profundo  
**Duración estimada:** 15–20 minutos de estudio guiado  
**Práctica adicional sugerida:** 30–45 minutos

---

## Introducción

En la lección 31 protegiste la API pública con pruebas de tipos: casos que deben compilar, usos que deben rechazarse y contratos que deben conservar su compatibilidad. Sin embargo, el compilador no impone todas las prácticas necesarias para mantener una aplicación segura.

Este código puede compilar y aun así contener un defecto serio:

~~~ts
async function createFinding(): Promise<void> {
  // Persiste un hallazgo ficticio.
}

createFinding();
~~~

La promesa queda sin `await`, `return` ni manejo de rechazo. TypeScript conoce su tipo, pero no exige por defecto que el programa la atienda.

Otro ejemplo:

~~~ts
const raw = '{"siteId":"site-demo-01"}';
const payload = JSON.parse(raw);

console.log(payload.siteId.toUpperCase());
~~~

`JSON.parse` produce `any` en sus tipos estándar. Ese `any` puede propagarse y desactivar comprobaciones importantes.

Aquí entra **ESLint** junto con **typescript-eslint**. ESLint aplica reglas de análisis estático; typescript-eslint permite comprender sintaxis TypeScript y, cuando se configura información de tipos, consultar el mismo conocimiento semántico que TypeScript construye sobre el proyecto.

La idea central de hoy es:

> TypeScript comprueba compatibilidad de tipos; el lint tipado detecta patrones peligrosos que el compilador permite; la validación runtime inspecciona los datos reales. Son capas complementarias, no sustitutas.

---

## Objetivo

Al terminar esta lección podrás:

1. distinguir compilación, linting, formateo, pruebas y validación runtime;
2. explicar por qué ESLint necesita typescript-eslint para analizar TypeScript;
3. diferenciar reglas sintácticas de reglas conscientes de tipos;
4. describir cómo `projectService` proporciona información del proyecto;
5. crear una configuración plana mediante `eslint.config.mjs`;
6. habilitar `recommendedTypeChecked` de forma gradual;
7. detectar promesas flotantes con `no-floating-promises`;
8. detectar promesas colocadas en contextos incorrectos con `no-misused-promises`;
9. evitar que `any` se propague desde una frontera externa;
10. aplicar validación Zod después de recibir un valor `unknown`;
11. diseñar scripts reproducibles de lint local y de CI;
12. limitar el lint a fuentes relevantes y excluir código generado;
13. reconocer errores comunes de configuración y rendimiento;
14. relacionar el análisis estático con React, HTTP, Node.js, Services, Repositories y PostgreSQL;
15. explicar la estrategia en una entrevista técnica.

---

## 1. El problema que resuelve el análisis estático

El compilador responde principalmente una pregunta:

> ¿Es este programa compatible con las reglas del sistema de tipos y con la configuración de TypeScript?

Un linter responde preguntas adicionales definidas como políticas del equipo:

- ¿quedó una promesa sin manejar?;
- ¿se usó una promesa como condición booleana?;
- ¿un `any` entró a una variable o propiedad confiable?;
- ¿se accedió a un miembro de un valor inseguro?;
- ¿se escribió un `switch` no exhaustivo?;
- ¿se dejó una directiva de supresión innecesaria?;
- ¿se importó desde una capa que debería permanecer privada?;

Observa este Service simplificado:

~~~ts
type Finding = {
  readonly id: string;
  readonly title: string;
};

interface FindingRepository {
  save(finding: Finding): Promise<void>;
}

class CreateFindingService {
  constructor(
    private readonly repository: FindingRepository,
  ) {}

  async execute(finding: Finding): Promise<void> {
    this.repository.save(finding);
  }
}
~~~

El método `execute` declara `Promise<void>` y el cuerpo es válido para el compilador. No obstante, `repository.save(finding)` queda flotando:

- `execute` podría resolverse antes de que termine la persistencia;
- un rechazo podría quedar sin manejar;
- el Controller podría responder `201` aunque PostgreSQL todavía no haya confirmado la operación.

Una regla consciente de tipos puede reconocer que `save` devuelve una promesa y reportar el problema.

Corrección:

~~~ts
class CreateFindingService {
  constructor(
    private readonly repository: FindingRepository,
  ) {}

  async execute(finding: Finding): Promise<void> {
    await this.repository.save(finding);
  }
}
~~~

Ahora la secuencia del caso de uso coincide con su intención.

---

## 2. Cinco herramientas, cinco responsabilidades

| Capa | Pregunta principal | Ejemplo |
| --- | --- | --- |
| TypeScript | ¿Los tipos son compatibles? | `tsc --noEmit` |
| ESLint | ¿El código viola una regla de calidad o seguridad? | Promesa sin manejar |
| Formateador | ¿El texto sigue un estilo mecánico? | Sangría, comillas, saltos |
| Pruebas | ¿El comportamiento observable es correcto? | Vitest verifica un error |
| Validación runtime | ¿El dato real cumple el contrato? | Zod analiza `request.body` |

Ninguna fila vuelve innecesarias las demás.

### Ejemplo concreto

~~~ts
type CreateFindingInput = {
  readonly siteId: string;
  readonly title: string;
};

function acceptInput(input: CreateFindingInput): void {
  console.log(input.title);
}

const externalValue = JSON.parse(
  '{"siteId":42,"title":false}',
);

acceptInput(externalValue);
~~~

El compilador puede aceptar la llamada porque `externalValue` es `any`. Un conjunto de reglas tipadas puede impedir la propagación insegura de `any`, pero tampoco demuestra por sí mismo qué contiene el texto JSON.

La solución completa empieza el dato como `unknown` y lo valida:

~~~ts
import { z } from "zod";

const CreateFindingInputSchema = z.object({
  siteId: z.string().trim().min(1),
  title: z.string().trim().min(3),
}).strict();

type CreateFindingInput = z.infer<
  typeof CreateFindingInputSchema
>;

const externalValue: unknown = JSON.parse(
  '{"siteId":"site-demo-01","title":"Inspect backup power"}',
);

const input: CreateFindingInput =
  CreateFindingInputSchema.parse(externalValue);
~~~

El reparto de responsabilidades es explícito:

1. `unknown` evita confianza prematura;
2. Zod inspecciona el valor en runtime;
3. `z.infer` mantiene alineado el tipo estático;
4. TypeScript protege el uso posterior;
5. ESLint evita patrones que reintroduzcan riesgos.

---

## 3. Cómo funciona ESLint con TypeScript

El flujo conceptual es:

~~~text
Archivo .ts o .tsx
        ↓
parser de typescript-eslint
        ↓
AST compatible con ESLint
        ↓
reglas sintácticas
        ↓ opcional
servicio de proyecto de TypeScript
        ↓
reglas conscientes de tipos
        ↓
diagnósticos y correcciones seguras disponibles
~~~

### ESLint

Coordina archivos, configuración, reglas, severidades, plugins, ignores y resultados.

### Parser de typescript-eslint

Convierte la sintaxis TypeScript en una representación que ESLint puede recorrer. Esto permite entender elementos como interfaces, tipos, assertions y anotaciones.

### Plugin de typescript-eslint

Aporta reglas diseñadas para TypeScript. Algunas solo necesitan el texto y el AST; otras consultan información semántica del proyecto.

### `projectService`

Solicita al servicio de TypeScript la información de tipos asociada con cada archivo. Así una regla puede saber que `repository.save()` devuelve `Promise<void>` aunque no exista la palabra `Promise` en la línea analizada.

Esta profundidad tiene un costo: el proyecto debe cargarse y analizarse. Por eso el lint tipado suele aproximarse al costo de una comprobación de tipos sobre los mismos archivos.

---

## 4. Reglas sintácticas frente a reglas conscientes de tipos

### Regla sintáctica

Puede decidir solo con la estructura del código:

~~~ts
let status = "open";
status = "resolved";
~~~

Una regla como `prefer-const` inspecciona si una variable se reasigna. No necesita saber el tipo completo de `status`.

### Regla consciente de tipos

Necesita resolver símbolos o tipos:

~~~ts
declare function saveFinding(): Promise<void>;

saveFinding();
~~~

Para reportar una promesa flotante, la regla debe saber qué retorna `saveFinding`. Esa información puede estar en otra declaración, en otro paquete o en un `.d.ts`.

### Consecuencia práctica

Esta configuración no basta para reglas tipadas:

~~~js
export default [
  {
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
];
~~~

La regla necesita que el parser pueda encontrar el proyecto TypeScript. Más adelante configuraremos `projectService: true`.

---

## 5. Instalación mínima

En la raíz del workspace ficticio de SiteOps Tracker:

~~~bash
npm install --save-dev eslint @eslint/js typescript typescript-eslint
~~~

Responsabilidad de cada dependencia:

| Paquete | Responsabilidad |
| --- | --- |
| `eslint` | motor y CLI de lint |
| `@eslint/js` | configuración recomendada de reglas JavaScript base |
| `typescript` | compilador y servicio de tipos |
| `typescript-eslint` | parser, plugin y configuraciones para TypeScript |

Zod se instala como dependencia runtime del paquete que valida datos:

~~~bash
npm install zod
~~~

No copies números de versión desde una lección sin revisarlos. El proyecto real debe fijar versiones compatibles en `package.json` y conservar su lockfile.

---

## 6. Configuración plana con información de tipos

Crea `eslint.config.mjs` en la raíz:

~~~js
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/*.generated.ts",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },
);
~~~

### Lectura paso a paso

1. `defineConfig` ayuda a expresar una configuración plana.
2. `ignores` excluye artefactos generados y dependencias.
3. `files` limita este bloque a archivos TypeScript.
4. `js.configs.recommended` activa una base de reglas JavaScript.
5. `recommendedTypeChecked` añade reglas recomendadas que utilizan información de tipos.
6. `projectService: true` permite localizar la configuración TypeScript correspondiente a cada archivo.
7. `tsconfigRootDir` hace explícita la raíz desde la que se resuelve la configuración.
8. `rules` documenta las políticas críticas que el equipo quiere hacer visibles, incluso si alguna ya forma parte del preset.

### ¿Por qué usar Flat Config?

La configuración plana usa archivos `eslint.config.*` y exporta objetos o arreglos de configuración. Permite definir con claridad qué reglas aplican a cada grupo de archivos, qué se ignora y cómo se combinan los presets.

### Nota sobre Node.js

`import.meta.dirname` requiere un runtime moderno. Si el runtime elegido no lo soporta, calcula la ruta desde `import.meta.url` con las utilidades estándar de Node o utiliza una configuración compatible con tu versión. La versión de Node debe fijarse y comprobarse en desarrollo, CI y Docker.

---

## 7. Scripts reproducibles

Agrega scripts claros a `package.json`:

~~~json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "test": "vitest run",
    "verify": "npm run typecheck && npm run lint && npm run test"
  }
}
~~~

### Intención de cada script

- `typecheck`: verifica tipos sin emitir JavaScript.
- `lint`: falla si existe un error o una advertencia.
- `lint:fix`: aplica únicamente correcciones que las reglas declaran como automatizables.
- `test`: ejecuta comportamiento runtime.
- `verify`: compone una barrera local sencilla.

No ejecutes `lint:fix` ciegamente sobre una migración grande. Revisa el diff, porque una corrección sintácticamente válida puede no representar la intención de negocio.

---

## 8. Regla clave: `no-floating-promises`

Una promesa flotante es una promesa creada sin una estrategia visible de finalización o manejo.

### Problema en un Controller

~~~ts
type Response = {
  status(code: number): Response;
  json(body: unknown): void;
};

interface CreateFindingService {
  execute(input: unknown): Promise<{ readonly id: string }>;
}

function createController(
  service: CreateFindingService,
) {
  return (requestBody: unknown, response: Response): void => {
    service.execute(requestBody);
    response.status(201).json({ created: true });
  };
}
~~~

El response sale antes de obtener el resultado. Además, el rechazo de `execute` no se conecta con el manejo HTTP.

### Corrección conceptual

~~~ts
function createController(
  service: CreateFindingService,
) {
  return async (
    requestBody: unknown,
    response: Response,
  ): Promise<void> => {
    const result = await service.execute(requestBody);

    response.status(201).json({
      id: result.id,
    });
  };
}
~~~

La promesa ahora forma parte explícita del flujo.

### Formas habituales de atender una promesa

Según el contexto, una promesa puede:

- esperarse con `await`;
- devolverse al llamador;
- encadenarse con manejo de rechazo;
- agregarse mediante `Promise.all`, `Promise.allSettled` u otra estrategia;
- marcarse deliberadamente con `void` cuando se acepta una tarea separada.

### `void` no maneja el rechazo

Esto expresa que no esperarás la promesa:

~~~ts
void publishAuditEvent();
~~~

Pero no evita un rechazo no manejado. Para una tarea intencionalmente desacoplada, conserva observabilidad:

~~~ts
type Logger = {
  error(
    context: Readonly<Record<string, unknown>>,
    message: string,
  ): void;
};

declare const logger: Logger;
declare function publishAuditEvent(): Promise<void>;

void publishAuditEvent().catch((error: unknown) => {
  logger.error(
    { error },
    "Could not publish the audit event",
  );
});
~~~

La decisión ya no es accidental: el código declara que la operación no bloquea el response y registra su fallo.

---

## 9. Regla clave: `no-misused-promises`

Esta regla detecta promesas utilizadas en lugares que no están diseñados para recibirlas correctamente.

### Error: `forEach` con callback asíncrono

~~~ts
declare function syncFinding(id: string): Promise<void>;

const findingIds = [
  "finding-demo-101",
  "finding-demo-102",
];

findingIds.forEach(async (id) => {
  await syncFinding(id);
});
~~~

`forEach` no espera las promesas devueltas por su callback. El bloque exterior termina sin representar el trabajo completo.

### Corrección paralela

~~~ts
await Promise.all(
  findingIds.map(async (id) => {
    await syncFinding(id);
  }),
);
~~~

Versión más compacta:

~~~ts
await Promise.all(
  findingIds.map((id) => syncFinding(id)),
);
~~~

### Corrección secuencial

~~~ts
for (const id of findingIds) {
  await syncFinding(id);
}
~~~

La elección depende del negocio:

- usa concurrencia cuando las operaciones pueden ejecutarse simultáneamente y el sistema soporta la carga;
- usa secuencia cuando importa el orden, existe un límite de tasa o una operación depende de la anterior.

### Error: promesa como condición

~~~ts
declare function findingExists(id: string): Promise<boolean>;

if (findingExists("finding-demo-101")) {
  console.log("Finding exists");
}
~~~

El objeto `Promise` es truthy; no representa todavía el booleano resuelto.

Corrección:

~~~ts
if (await findingExists("finding-demo-101")) {
  console.log("Finding exists");
}
~~~

---

## 10. React: handlers asíncronos sin ocultar errores

Sin profundizar todavía en la etapa de React, observa una frontera frecuente:

~~~tsx
type Props = {
  readonly save: () => Promise<void>;
};

export function SaveButton({ save }: Props) {
  return (
    <button onClick={save}>
      Save
    </button>
  );
}
~~~

El evento espera conceptualmente un callback que retorna `void`, pero `save` retorna una promesa. Dependiendo de la configuración, `no-misused-promises` puede advertir que el rechazo no está atendido.

Una adaptación explícita:

~~~tsx
type Props = {
  readonly save: () => Promise<void>;
  readonly reportError: (error: unknown) => void;
};

export function SaveButton({
  save,
  reportError,
}: Props) {
  const handleClick = (): void => {
    void save().catch((error: unknown) => {
      reportError(error);
    });
  };

  return (
    <button onClick={handleClick}>
      Save
    </button>
  );
}
~~~

En una aplicación real también representarías estados `idle`, `submitting`, `success` y `error`. La regla no diseña la experiencia de usuario; solo ayuda a impedir que la promesa desaparezca silenciosamente.

No desactives globalmente la regla solo porque un framework use callbacks `void`. Primero adapta el límite o configura una excepción estrecha y documentada.

---

## 11. La familia de reglas `no-unsafe-*`

El preset tipado puede detectar propagación de `any` mediante reglas como:

- `no-unsafe-assignment`;
- `no-unsafe-argument`;
- `no-unsafe-call`;
- `no-unsafe-member-access`;
- `no-unsafe-return`.

### Problema desde JSON

~~~ts
const payload = JSON.parse(rawBody);

return createFindingService.execute(payload);
~~~

`payload` puede contaminar todo el caso de uso porque `any` es asignable a casi todo.

### Frontera correcta

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

function parseCreateFindingInput(
  rawBody: string,
): CreateFindingInput {
  const json: unknown = JSON.parse(rawBody);
  return CreateFindingInputSchema.parse(json);
}
~~~

El linter ayuda a evitar que `any` avance. Zod decide si el valor real es válido. TypeScript protege `CreateFindingInput` después del parseo.

### Las fuentes que siempre deben tratarse como fronteras runtime

- `request.body`, parámetros y headers HTTP;
- respuestas de APIs externas;
- formularios y almacenamiento del navegador;
- contenido de archivos;
- variables de entorno;
- mensajes de colas o eventos;
- filas de PostgreSQL recibidas mediante un driver;
- JSON serializado o cacheado.

Aunque una librería declare tipos, el sistema externo puede contener datos inesperados. La confianza debe ganarse mediante validación, normalización o mapeo en la frontera adecuada.

---

## 12. ESLint no sustituye la validación runtime

Este código puede satisfacer el lint:

~~~ts
const body: unknown = request.body;

const input = body as CreateFindingInput;
~~~

La assertion `as` no inspecciona el valor. Dependiendo de tus reglas, incluso podría reportarse como assertion insegura, pero el principio no cambia: ningún tipo TypeScript sobrevive automáticamente a HTTP.

La secuencia correcta es:

~~~ts
const body: unknown = request.body;
const input = CreateFindingInputSchema.parse(body);

await createFindingService.execute(input);
~~~

Y necesita una prueba runtime:

~~~ts
import { describe, expect, it } from "vitest";

describe("CreateFindingInputSchema", () => {
  it("rechaza una prioridad desconocida", () => {
    const result = CreateFindingInputSchema.safeParse({
      siteId: "site-demo-01",
      title: "Inspect backup power",
      priority: "urgent",
    });

    expect(result.success).toBe(false);
  });
});
~~~

El lint evita patrones estáticos conocidos; la prueba ejecuta JavaScript; Zod valida el valor real.

---

## 13. `projectService` en un monorepo

SiteOps Tracker puede evolucionar hacia esta estructura:

~~~text
siteops-tracker/
├── apps/
│   ├── api/
│   │   └── tsconfig.json
│   └── web/
│       └── tsconfig.json
├── packages/
│   ├── contracts/
│   │   └── tsconfig.json
│   └── sdk/
│       └── tsconfig.json
├── eslint.config.mjs
├── package.json
└── tsconfig.json
~~~

Con `projectService`, cada archivo puede asociarse con el proyecto TypeScript que le corresponde. Esto reduce la necesidad de mantener un `tsconfig.eslint.json` paralelo solo para lint.

### Regla de diseño

Un archivo de fuente debería pertenecer al `tsconfig` correcto. Si ESLint informa que no encuentra información de proyecto, revisa primero:

1. si el archivo está incluido por el `tsconfig` esperado;
2. si ejecutas ESLint desde la raíz correcta;
3. si `tsconfigRootDir` apunta a esa raíz;
4. si estás intentando aplicar reglas tipadas a scripts fuera del proyecto;
5. si un artefacto generado debió ignorarse.

No amplíes `include` a `**/*` como reacción automática. Podrías incorporar `dist`, cobertura, archivos temporales y otros contenidos que aumentan el tiempo y la memoria.

---

## 14. Adopción gradual y sostenible

Activar reglas tipadas en una base existente puede revelar muchos problemas. Trátalo como una migración de calidad.

### Paso 1 — Establece la línea base

Ejecuta por separado:

~~~bash
npm run typecheck
npm run lint
~~~

Si ambos son lentos, investiga primero el proyecto TypeScript: el lint tipado depende de su análisis.

### Paso 2 — Clasifica diagnósticos

Agrupa los hallazgos:

- promesas sin manejar;
- `any` procedente de fronteras;
- assertions inseguras;
- reglas de estilo;
- archivos fuera del proyecto;
- falsos positivos causados por tipos incorrectos de una dependencia.

### Paso 3 — Corrige causas, no mensajes

Si diez errores nacen en `JSON.parse`, define una frontera `unknown` y un parser runtime. No añadas diez assertions.

### Paso 4 — Usa excepciones pequeñas

Cuando una excepción sea legítima, limita su alcance y explica el motivo:

~~~ts
// La librería externa requiere una llamada sin await y expone
// el rechazo mediante el callback registrado debajo.
// eslint-disable-next-line @typescript-eslint/no-floating-promises -- integración documentada
legacyClient.start();
~~~

Antes de aceptar la excepción, confirma que la afirmación sea cierta. Un comentario no convierte en segura una operación.

### Paso 5 — Cierra la barrera de CI

Cuando la línea base esté limpia, usa:

~~~bash
eslint . --max-warnings=0
~~~

Así un warning nuevo no se vuelve deuda silenciosa.

---

## 15. Cuándo utilizar reglas conscientes de tipos

Son especialmente valiosas en:

- Controllers y handlers asíncronos;
- Services que coordinan persistencia o APIs;
- Repositories basados en promesas;
- SDKs que procesan responses externos;
- componentes React con eventos asíncronos;
- paquetes de contratos compartidos;
- utilidades genéricas con operaciones complejas;
- analizadores de archivos y configuraciones;
- scripts de migración o automatización;
- código donde `any` puede cruzar capas.

También funcionan como documentación ejecutable: muestran qué patrones el equipo considera inseguros.

---

## 16. Cuándo evitar o limitar su aplicación

No fuerces reglas tipadas indiscriminadamente sobre:

- archivos generados;
- `dist`, cobertura y artefactos de build;
- código de terceros o vendorizado;
- fixtures deliberadamente inválidos cuando otra herramienta ya controla su propósito;
- scripts JavaScript que no pertenecen a ningún proyecto TypeScript, salvo que los configures de forma específica;
- un repositorio enorme sin medir primero costo y alcance.

Tampoco actives el preset más estricto únicamente porque su nombre suena mejor. `strictTypeChecked` es más opinado que `recommendedTypeChecked`; adopta reglas según el dominio, experiencia del equipo y capacidad real de corregirlas.

El objetivo no es maximizar el número de reglas. Es reducir defectos con una política comprensible y mantenible.

---

## 17. Errores comunes y su causa

### Error 1 — Creer que ESLint reemplaza `tsc`

El linter no constituye por sí solo una comprobación completa del programa ni genera artefactos. Conserva un script de `typecheck` separado.

### Error 2 — Activar reglas tipadas sin información de proyecto

Reglas como `no-floating-promises` necesitan conocer tipos. Configura `projectService` o la alternativa deliberada que corresponda.

### Error 3 — Lintar archivos generados

Produce ruido, lentitud y correcciones que se perderán en la siguiente generación. Ignóralos.

### Error 4 — Usar `void` como si fuera `catch`

`void promise` expresa que ignoras su valor; no atiende automáticamente un rechazo.

### Error 5 — Desactivar una regla para todo el repositorio

Una incompatibilidad localizada con React o una librería no justifica perder protección en Services y Repositories.

### Error 6 — Convertir `any` a un tipo con `as`

La assertion solo silencia al sistema estático. Los datos externos siguen sin validarse.

### Error 7 — Ejecutar `forEach(async () => ...)`

`forEach` no agrega ni espera las promesas. Usa `Promise.all` o `for...of` según la concurrencia necesaria.

### Error 8 — Usar una promesa como booleano

La promesa es un objeto truthy. Debes esperar su resultado.

### Error 9 — Mezclar estilo y seguridad sin prioridad

Una migración puede atascarse corrigiendo comillas mientras siguen existiendo promesas no manejadas. Prioriza reglas de corrección.

### Error 10 — Usar includes excesivamente amplios

El servicio de tipos puede cargar más archivos de los necesarios. Limita fuentes y excluye artefactos.

### Error 11 — Añadir `eslint-disable` sin explicación

La excepción queda sin contexto y puede sobrevivir después de desaparecer su causa.

### Error 12 — Confiar en `--fix` sin revisar el diff

Las correcciones automatizadas reducen trabajo mecánico, pero no comprenden todas las reglas de negocio.

### Error 13 — Duplicar reglas base y reglas de extensión

Para ciertas comprobaciones TypeScript, el plugin reemplaza una regla base porque entiende sintaxis adicional. Usa los presets recomendados y evita diagnósticos duplicados.

### Error 14 — Tratar PostgreSQL como una fuente estáticamente confiable

Los tipos del driver describen expectativas; no sustituyen constraints, migraciones, conversión y pruebas de integración.

---

## 18. Relación explícita con la arquitectura Full Stack

~~~text
React
  ↓ usa handlers y SDK tipados
HTTP
  ↓ transporta datos sin tipos TypeScript
Node → Router → Controller
  ↓ coordina promesas y recibe unknown
Runtime Validation
  ↓ verifica valores reales
Service
  ↓ ejecuta el caso de uso
Repository
  ↓ espera consultas y mapea resultados
PostgreSQL
  ↓ aplica restricciones y persiste datos
Testing → Docker → CI/CD → Cloud
  verifica y reproduce la entrega
~~~

### React

El lint tipado detecta handlers asíncronos conectados a callbacks `void`, promesas ignoradas y `any` que entra desde responses o formularios. React todavía necesita estados de carga y error, además de pruebas con Testing Library en su etapa correspondiente.

### HTTP

HTTP no transporta interfaces TypeScript. El SDK debe tratar `response.json()` como una frontera desconocida y validarla antes de devolver datos confiables.

### Node, Router y Controller

El Router selecciona el handler. El Controller espera Services, propaga errores al mecanismo HTTP correspondiente y valida inputs externos antes de usarlos. Las reglas de promesas ayudan a conservar esa secuencia.

### Runtime Validation

Zod inspecciona `request.body`, params, query, configuración y responses. ESLint puede empujar el código hacia `unknown`, pero no ejecuta el schema.

### Service

El Service recibe modelos validados y coordina operaciones. Debe esperar persistencia cuando el éxito del caso de uso depende de ella.

### Repository

El Repository espera el driver, transforma errores técnicos y mapea filas hacia dominio. Una consulta flotante puede producir respuestas prematuras o rechazos fuera del manejo esperado.

### PostgreSQL

Constraints y transacciones protegen datos runtime. El lint no prueba SQL, migraciones ni concurrencia; para eso se requieren pruebas de integración.

### Testing

Vitest comprueba comportamiento. Los type tests protegen contratos. El lint encuentra patrones estáticos. Cada herramienta debe tener un script y una responsabilidad distinguible.

### Docker

La imagen debe instalar las mismas versiones bloqueadas y ejecutar, cuando corresponda, la barrera de verificación antes de producir el artefacto final.

### CI/CD

CI ejecuta `typecheck`, `lint`, pruebas, build y verificaciones del paquete. El orden exacto puede optimizarse, pero ningún paso debería quedar implícito.

### Cloud

Cloud ejecuta JavaScript. Los tipos y el lint ya terminaron su trabajo antes del despliegue; validación runtime, logs, métricas y manejo de errores siguen siendo obligatorios.

---

## 19. Ejemplo integrado de SiteOps Tracker

### Contrato y schema

~~~ts
import { z } from "zod";

export const CreateCorrectiveActionSchema = z.object({
  findingId: z.string().trim().min(1),
  description: z.string().trim().min(5),
  ownerId: z.string().trim().min(1),
}).strict();

export type CreateCorrectiveActionInput = z.infer<
  typeof CreateCorrectiveActionSchema
>;
~~~

### Repository

~~~ts
export type CorrectiveAction = {
  readonly id: string;
  readonly findingId: string;
  readonly description: string;
  readonly ownerId: string;
};

export interface CorrectiveActionRepository {
  insert(
    action: CorrectiveAction,
  ): Promise<void>;
}
~~~

### Service

~~~ts
export class CreateCorrectiveActionService {
  constructor(
    private readonly repository:
      CorrectiveActionRepository,
  ) {}

  async execute(
    input: CreateCorrectiveActionInput,
  ): Promise<CorrectiveAction> {
    const action: CorrectiveAction = {
      id: crypto.randomUUID(),
      findingId: input.findingId,
      description: input.description,
      ownerId: input.ownerId,
    };

    await this.repository.insert(action);

    return action;
  }
}
~~~

### Controller independiente del framework

~~~ts
type JsonResponse = {
  readonly status: number;
  readonly body: unknown;
};

export function createCorrectiveActionController(
  service: CreateCorrectiveActionService,
) {
  return async (
    body: unknown,
  ): Promise<JsonResponse> => {
    const input =
      CreateCorrectiveActionSchema.parse(body);

    const action = await service.execute(input);

    return {
      status: 201,
      body: action,
    };
  };
}
~~~

Este diseño permite que las herramientas colaboren:

- TypeScript comprueba firmas y capas;
- ESLint exige atender las promesas;
- Zod valida `body` en runtime;
- Vitest puede probar aceptación, rechazo y coordinación;
- el adapter Express puede traducir `JsonResponse` a la respuesta HTTP;
- el Repository concreto puede probarse contra PostgreSQL en integración.

---

## 20. Ejercicio — Corregir una cadena de riesgos estáticos

### Escenario

El SDK ficticio recibe un response HTTP y registra su uso:

~~~ts
type FindingSummary = {
  readonly id: string;
  readonly title: string;
  readonly status: "open" | "in_progress" | "resolved";
};

interface AuditLogger {
  write(message: string): Promise<void>;
}

declare const auditLogger: AuditLogger;

export async function getFinding(
  id: string,
): Promise<FindingSummary> {
  const response = await fetch(`/api/findings/${id}`);
  const body = await response.json();

  auditLogger.write(`Loaded ${body.id}`);

  return body;
}
~~~

### Tu tarea

Refactoriza el archivo para que:

1. el response JSON se trate inicialmente como `unknown`;
2. exista un schema Zod para `FindingSummary`;
3. el tipo TypeScript se infiera desde el schema;
4. el código compruebe `response.ok` antes de procesar el body;
5. el SDK no retorne un `any`;
6. la escritura de auditoría tenga una política explícita: esperada o desacoplada;
7. ningún rechazo quede sin estrategia visible;
8. `no-floating-promises`, `no-misused-promises` y las reglas `no-unsafe-*` relevantes queden satisfechas;
9. exista una prueba runtime que rechace un status desconocido;
10. exista una prueba de tipos que confirme el retorno `Promise<FindingSummary>`.

### Restricciones

- No uses `any`.
- No uses `@ts-ignore`.
- No conviertas el body con `as FindingSummary`.
- No desactives reglas globalmente.
- No ocultes errores con un `catch` vacío.
- No escribas la solución completa dentro de la configuración ESLint.

### Pistas

1. Anota el resultado de `response.json()` como `unknown`.
2. Usa `FindingSummarySchema.parse` o `safeParse` según la estrategia de errores del SDK.
3. Si la auditoría es parte del éxito, usa `await`.
4. Si no debe bloquear, usa `void` junto con un `.catch` observable.
5. Una respuesta HTTP no exitosa merece un error propio antes del parseo del contrato exitoso.
6. Para la prueba de tipos puedes utilizar `expectTypeOf` en un archivo `*.test-d.ts`.
7. Para la prueba runtime, pasa un objeto cuyo `status` sea `"archived"`.

### Entrega esperada

- implementación refactorizada;
- schema y tipo inferido;
- decisión documentada sobre la auditoría;
- una prueba runtime;
- una prueba de tipos;
- una explicación breve de qué detecta cada herramienta.

No se incluye la solución completa: el objetivo es que identifiques y corrijas cada frontera.

---

## 21. Reto Full Stack — Configuración tipada del monorepo

### Escenario

El monorepo ficticio contiene:

~~~text
apps/web       React + TypeScript
apps/api       Node.js + Express + TypeScript
packages/sdk   cliente HTTP tipado
packages/contracts schemas y contratos públicos
~~~

### Tu reto

Diseña una propuesta que incluya:

1. un `eslint.config.mjs` raíz;
2. ignores para `dist`, cobertura y archivos generados;
3. alcance de archivos `ts`, `tsx`, `mts` y `cts`;
4. `recommendedTypeChecked` y `projectService`;
5. una decisión justificada sobre `strictTypeChecked`;
6. reglas de promesas para API, SDK y React;
7. una adaptación estrecha para handlers React;
8. prevención de propagación de `any` desde HTTP;
9. schemas Zod para request y response;
10. un script `lint` con cero warnings permitidos;
11. un script `typecheck` separado;
12. pruebas de tipos para el SDK;
13. pruebas runtime para los schemas;
14. una prueba de integración del Repository con PostgreSQL;
15. un orden propuesto para CI;
16. una explicación de qué puede ejecutarse en paralelo;
17. una estrategia para introducir reglas en código existente;
18. un criterio para permitir una supresión localizada;
19. una medición inicial de duración de `tsc` y del lint tipado;
20. una verificación de que Docker usa el lockfile y la versión esperada de Node.

### Condiciones

- Los tipos TypeScript nunca se presentan como validación runtime.
- `response.json()` y `request.body` comienzan como datos no confiables.
- El Service no conoce Express.
- El Repository no exporta filas PostgreSQL al frontend.
- Las promesas de persistencia no quedan flotando.
- No se exige implementar todavía toda la aplicación.
- Las excepciones se justifican por línea o por un grupo estrecho de archivos.

### Pregunta de diseño

Si `npm run typecheck` pasa, pero `no-floating-promises` reporta que el Controller no espera al Service, ¿cuál herramienta está equivocada?

Explica por qué ambas pueden estar funcionando correctamente, qué riesgo identifica el linter y qué prueba runtime añadirías para demostrar el orden esperado de respuesta y persistencia.

---

## 22. Preguntas de comprensión

Responde sin consultar y después verifica tus ideas.

1. ¿Qué diferencia principal existe entre `tsc` y ESLint?
2. ¿Qué aporta typescript-eslint?
3. ¿Qué puede decidir una regla sintáctica sin información de tipos?
4. ¿Por qué `no-floating-promises` necesita conocer el tipo de retorno?
5. ¿Qué hace `projectService`?
6. ¿Por qué el lint tipado puede ser más lento que el lint sintáctico?
7. ¿Qué aporta `recommendedTypeChecked`?
8. ¿Por qué conviene conservar `typecheck` como script separado?
9. ¿Qué cuatro estrategias visibles pueden atender una promesa?
10. ¿Por qué `void promise` no equivale a manejar un rechazo?
11. ¿Qué problema tiene `forEach(async () => ...)`?
12. ¿Cuándo elegirías `Promise.all` y cuándo `for...of`?
13. ¿Qué ocurre al usar una promesa directamente en un `if`?
14. ¿Por qué `JSON.parse` puede propagar `any`?
15. ¿Cómo interrumpes esa propagación sin mentir con una assertion?
16. ¿Por qué Zod sigue siendo necesario aunque el lint quede limpio?
17. ¿Qué archivos deberían ignorarse normalmente?
18. ¿Por qué un `include: ["**/*"]` puede perjudicar rendimiento?
19. ¿Cuándo es aceptable una supresión de ESLint?
20. ¿Qué comprobarías si un archivo no encuentra información de proyecto?
21. ¿Por qué no debes activar todas las reglas estrictas sin evaluación?
22. ¿Cómo protege el lint tipado a React?
23. ¿Cómo protege el lint tipado a un Controller Node.js?
24. ¿Qué responsabilidad conserva PostgreSQL que ESLint no puede cubrir?
25. ¿Qué pasos pondrías en una barrera de CI?

---

## 23. Relevancia para entrevistas técnicas

### Pregunta: ¿Cuál es la diferencia entre TypeScript y ESLint?

TypeScript comprueba el programa mediante su sistema de tipos. ESLint aplica reglas configurables sobre patrones del código. Con typescript-eslint, algunas reglas también consultan información de tipos y detectan riesgos que el compilador permite, como promesas sin manejar.

### Pregunta: ¿Qué es typed linting?

Es el lint que utiliza información semántica del proyecto TypeScript, no solo la sintaxis del archivo. Permite saber qué retorna una función, de dónde proviene un símbolo y si un valor es `any`, una promesa u otro tipo relevante para una regla.

### Pregunta: ¿Por qué no basta con `tsc --noEmit`?

Porque el compilador no impone todas las políticas de calidad. Una llamada que devuelve una promesa puede quedar sin esperar y aun compilar. El lint tipado complementa el type check con reglas más específicas.

### Pregunta: ¿ESLint valida una petición HTTP?

No. Puede advertir que el dato es `any` o que se usa sin seguridad, pero no inspecciona el payload recibido. La frontera necesita validación runtime, por ejemplo con Zod, y pruebas sobre valores reales.

### Pregunta: ¿Cómo manejarías una promesa que no debe bloquear?

Haría explícita la decisión y conservaría el manejo de errores. Por ejemplo, usaría `void` sobre una promesa que termina en `.catch`, registrando o encaminando el error. No usaría `void` como sustituto de observabilidad.

### Pregunta: ¿Cómo habilitarías reglas conscientes de tipos?

Usaría la configuración plana de ESLint, un preset como `recommendedTypeChecked` y configuraría el parser con `projectService: true`. Después limitaría archivos e ignores, mediría rendimiento y añadiría los scripts a CI.

### Respuesta breve de 30 segundos

> I use TypeScript, typed ESLint rules, runtime validation, and tests as separate quality layers. TypeScript checks assignability, while typescript-eslint can detect semantic risks such as floating Promises or unsafe `any` propagation. At external boundaries, values still start as `unknown` and are validated with a runtime schema because types disappear from the generated JavaScript. In CI, I run type checking, linting, tests, and the build as explicit reproducible steps.

---

## 24. Checklist profesional

Antes de considerar estable la configuración de lint, comprueba:

- [ ] Existe un archivo `eslint.config.*` en una raíz conocida.
- [ ] Las dependencias de ESLint y typescript-eslint están fijadas en el lockfile.
- [ ] Los archivos TypeScript tienen un bloque `files` explícito.
- [ ] Los artefactos generados están ignorados.
- [ ] El preset seleccionado coincide con la experiencia del equipo.
- [ ] Las reglas tipadas tienen acceso a información de proyecto.
- [ ] `projectService` encuentra el `tsconfig` correcto.
- [ ] `tsconfigRootDir` se resuelve desde la raíz esperada.
- [ ] Existe un script `typecheck` separado.
- [ ] Existe un script `lint` reproducible.
- [ ] CI no acepta warnings nuevos silenciosamente.
- [ ] Las promesas críticas se esperan o devuelven.
- [ ] Las tareas desacopladas manejan y observan sus rechazos.
- [ ] No existen callbacks `forEach` asíncronos accidentales.
- [ ] Las condiciones no usan promesas sin `await`.
- [ ] `any` no cruza fronteras hacia el dominio.
- [ ] HTTP, formularios, archivos, entorno y base de datos se tratan como datos runtime.
- [ ] Los schemas Zod poseen pruebas de aceptación y rechazo.
- [ ] Las assertions no sustituyen la validación.
- [ ] Las supresiones son pequeñas, justificadas y revisables.
- [ ] `--fix` se acompaña de revisión de cambios.
- [ ] Se ha medido el tiempo de `tsc` y del lint tipado.
- [ ] Los includes no cargan directorios innecesarios.
- [ ] React, API, SDK y paquetes comparten una política coherente.
- [ ] Docker y CI usan versiones reproducibles.

---

## 25. Resumen

- TypeScript y ESLint responden preguntas distintas.
- ESLint coordina reglas; typescript-eslint permite analizar sintaxis y tipos TypeScript.
- Las reglas sintácticas solo necesitan el AST.
- Las reglas conscientes de tipos consultan información semántica del proyecto.
- `projectService: true` es la opción recomendada para proporcionar esa información en la configuración moderna.
- `recommendedTypeChecked` añade reglas recomendadas que necesitan tipos.
- El lint tipado cuesta más porque TypeScript debe analizar el proyecto.
- `no-floating-promises` detecta promesas sin estrategia visible.
- Una promesa puede esperarse, devolverse, encadenarse o desacoplarse deliberadamente.
- `void` no maneja por sí mismo un rechazo.
- `no-misused-promises` detecta promesas usadas en lugares inadecuados.
- `forEach(async () => ...)` no representa la finalización de sus callbacks.
- `Promise.all` expresa concurrencia; `for...of` expresa secuencia.
- Una promesa usada en un `if` es un objeto truthy, no su booleano resuelto.
- Las reglas `no-unsafe-*` ayudan a impedir la propagación de `any`.
- Un dato externo debe comenzar como `unknown` y validarse en runtime.
- Zod inspecciona valores; TypeScript y ESLint no reemplazan esa inspección.
- Los tipos desaparecen al generar JavaScript.
- React necesita adaptar handlers asíncronos y representar errores.
- Controllers y Services deben esperar las operaciones de las que depende su éxito.
- Repositories deben atender promesas del driver y aislar filas PostgreSQL.
- PostgreSQL necesita constraints y pruebas de integración reales.
- Los archivos generados, dependencias y cobertura deben quedar fuera del lint.
- Las reglas se adoptan gradualmente, corrigiendo causas y no solo mensajes.
- Las supresiones legítimas deben ser estrechas y explicadas.
- `typecheck`, `lint`, pruebas y build deben permanecer como verificaciones explícitas.
- CI y Docker deben usar versiones bloqueadas y reproducibles.

---

## Referencias oficiales consultadas

- [typescript-eslint — Linting with Type Information](https://typescript-eslint.io/getting-started/typed-linting/)
- [typescript-eslint — Shared Configs](https://typescript-eslint.io/users/configs/)
- [typescript-eslint — `no-floating-promises`](https://typescript-eslint.io/rules/no-floating-promises/)
- [typescript-eslint — `no-misused-promises`](https://typescript-eslint.io/rules/no-misused-promises/)
- [typescript-eslint — Typed Linting Performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance/)
- [ESLint — Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files)
- [ESLint — Configure Rules](https://eslint.org/docs/latest/use/configure/rules)
- [Zod — Defining Schemas](https://zod.dev/api)

Consultadas el **6 de octubre de 2026**.

---

# Próxima lección

**Lección 33 — Quality gates reproducibles: integrar typecheck, lint, pruebas y build en scripts y CI.**
