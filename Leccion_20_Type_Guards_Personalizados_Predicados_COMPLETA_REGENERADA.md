# Lección 20 — Type Guards personalizados y funciones de predicado (`value is Type`)

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración estimada:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Ruta:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

---

## Introducción

Un **Type Guard** combina una comprobación runtime con información que permite a TypeScript hacer *narrowing*.

```ts
function isRouter(
  device: Device
): device is Router {
  return device.kind === "router";
}
```

La condición se ejecuta en JavaScript. El predicado `device is Router` pertenece al sistema de tipos y desaparece al compilar.

Esto conecta directamente con Full Stack: TypeScript puede refinar datos con contratos conocidos, pero HTTP, formularios, APIs externas, archivos, `process.env` y bases de datos siguen requiriendo validación real.

---

# Objetivo

Al finalizar podrás:

- explicar narrowing;
- crear Type Guards personalizados;
- utilizar `value is Type`;
- diferenciar boolean y type predicate;
- filtrar unions;
- trabajar con `unknown`;
- evitar guards inseguros;
- distinguir guard, assertion y Zod;
- aplicarlos a SiteOps Tracker, React, Node.js, SDKs y testing;
- ubicarlos correctamente en la arquitectura Full Stack;
- explicarlos en entrevistas.

---

# 1. Recordatorio: narrowing

```ts
function printValue(
  value: string | number
) {
  if (
    typeof value === "string"
  ) {
    console.log(
      value.toUpperCase()
    );
    return;
  }

  console.log(
    value.toFixed(2)
  );
}
```

Dentro del `if`, TypeScript conoce `string`. Después del `return`, conoce `number`.

# 2. Union de dispositivos

```ts
type Router = {
  kind: "router";
  hostname: string;
  routes: number;
};

type Switch = {
  kind: "switch";
  hostname: string;
  ports: number;
};

type Device =
  Router | Switch;
```

Narrowing inline:

```ts
if (device.kind === "router") {
  console.log(device.routes);
}
```

# 3. Boolean normal vs predicate

```ts
function checkRouter(
  device: Device
): boolean {
  return device.kind === "router";
}
```

vs:

```ts
function isRouter(
  device: Device
): device is Router {
  return device.kind === "router";
}
```

El segundo comunica a TypeScript qué tipo queda demostrado cuando retorna `true`.

# 4. Compile time + runtime

Se ejecuta:

```ts
device.kind === "router"
```

Desaparece:

```ts
device is Router
```

# 5. Un guard puede mentir

Esto es incorrecto:

```ts
function isRouter(
  device: Device
): device is Router {
  return true;
}
```

TypeScript confía en el contrato. Por eso un guard debe estar correctamente implementado y probado si es importante.

# 6. `Array.filter`

```ts
const devices:
  Device[] = [
    {
      kind: "router",
      hostname: "r1",
      routes: 20
    },
    {
      kind: "switch",
      hostname: "sw1",
      ports: 48
    }
  ];

const routers =
  devices.filter(isRouter);
```

`routers` puede inferirse como:

```ts
Router[]
```

# 7. SiteOps Tracker

```ts
type PendingAudit = {
  status: "pending";
  id: string;
  site: string;
};

type CompletedAudit = {
  status: "completed";
  id: string;
  site: string;
  completedAt: Date;
};

type Audit =
  PendingAudit
  | CompletedAudit;

function isCompletedAudit(
  audit: Audit
): audit is CompletedAudit {
  return audit.status === "completed";
}
```

# 8. `unknown`

```ts
function isString(
  value: unknown
): value is string {
  return typeof value === "string";
}
```

`unknown` obliga a obtener evidencia antes de operar.

# 9. Objetos desde runtime

Esto es insuficiente:

```ts
function isDevice(
  value: unknown
): value is Device {
  return typeof value === "object";
}
```

Porque `null`, arrays y objetos incompletos también cumplen esa condición.

# 10. `isRecord`

```ts
function isRecord(
  value: unknown
): value is Record<
  string,
  unknown
> {
  return (
    typeof value === "object" &&
    value !== null
  );
}
```

# 11. Guard manual pequeño

```ts
type DeviceSummary = {
  hostname: string;
  active: boolean;
};

function isDeviceSummary(
  value: unknown
): value is DeviceSummary {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.hostname === "string" &&
    typeof value.active === "boolean"
  );
}
```

Este guard sí ejecuta comprobaciones runtime.

# 12. Por qué Zod será importante

Para objetos grandes o anidados, mantener guards manuales se vuelve costoso.

Conceptualmente:

```ts
const DeviceSchema =
  z.object({
    id: z.string(),
    hostname: z.string(),
    status:
      z.enum([
        "online",
        "offline"
      ]),
    interfaces:
      z.array(
        z.object({
          name: z.string(),
          ip:
            z.string()
              .nullable()
        })
      )
  });
```

# 13. Type Guard vs Zod

Usa Type Guards para:

- unions conocidas;
- checks pequeños;
- discriminated unions;
- `filter`;
- nullish values.

Usa Zod para:

- HTTP;
- formularios;
- APIs externas;
- variables de entorno;
- archivos;
- objetos complejos;
- errores de validación detallados.

# 14. Assertions no validan

```ts
const body =
  req.body
    as CreateDeviceInput;
```

No inspecciona runtime.

Si llega:

```json
{
  "hostname": 123
}
```

la assertion no hace nada.

# 15. Arquitectura Full Stack

```text
React
↓
HTTP
↓
Node
↓
Router
↓
Controller
↓
Runtime Validation
↓
Service
↓
Repository
↓
PostgreSQL
↓
Testing
↓
Docker
↓
CI/CD
↓
Cloud
```

**React:** unions y estado.  
**HTTP:** frontera no confiable.  
**Node:** runtime JS.  
**Router:** selecciona handler.  
**Controller:** adapta HTTP.  
**Runtime Validation:** comprueba valores.  
**Service:** reglas de negocio.  
**Repository:** persistencia.  
**PostgreSQL:** integridad.  
**Testing:** comportamiento.  
**Docker:** entorno.  
**CI/CD:** automatización.  
**Cloud:** despliegue.

# 16. Controller + validation

```ts
async function createDeviceController(
  req: Request,
  res: Response
) {
  const result =
    CreateDeviceSchema
      .safeParse(req.body);

  if (!result.success) {
    return res
      .status(400)
      .json({
        error:
          "Invalid request"
      });
  }

  const device =
    await createDeviceService(
      result.data
    );

  return res
    .status(201)
    .json(device);
}
```

# 17. React + Type Guards

```ts
type LoadState =
  | {
      status: "loading";
    }
  | {
      status: "success";
      data: Device[];
    }
  | {
      status: "error";
      message: string;
    };
```

Si solo usas `state.status === "success"` una vez, quizá no necesites un guard separado. Extráelo cuando haya reutilización o lógica más compleja.

# 18. SDK tipado

```ts
async function getDevice(
  id: string
): Promise<Device> {
  const response =
    await fetch(
      `/devices/${id}`
    );

  const json:
    unknown =
      await response.json();

  const result =
    DeviceSchema
      .safeParse(json);

  if (!result.success) {
    throw new Error(
      "Invalid API response"
    );
  }

  return result.data;
}
```

La firma `Promise<Device>` no valida por sí sola una respuesta externa.

# 19. Analizador de configuraciones

```ts
type ParsedLine =
  | {
      kind: "interface";
      name: string;
    }
  | {
      kind: "description";
      text: string;
    }
  | {
      kind: "unknown";
      raw: string;
    };
```

Después del parser puedes usar guards para filtrar tipos específicos.

El texto crudo no debe tiparse directamente como `ParsedLine[]`.

# 20. `in`

```ts
function isRouter(
  device:
    Router | Switch
): device is Router {
  return (
    "routes" in device
  );
}
```

Funciona si esa propiedad distingue realmente los tipos.

# 21. `instanceof`

```ts
class NetworkError
  extends Error {}

try {
  await operation();
} catch (error: unknown) {
  if (
    error instanceof
      NetworkError
  ) {
    console.error(
      error.message
    );
  }
}
```

# 22. Nullish guard

```ts
function isDefined<T>(
  value:
    T | null | undefined
): value is T {
  return (
    value !== null &&
    value !== undefined
  );
}
```

No uses `filter(Boolean)` si `0`, `false` o `""` pueden ser valores válidos.

# 23. Error handling profesional

```ts
function getErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return "Unknown error";
}
```

# 24. PostgreSQL

Una interfaz como:

```ts
interface DeviceRepository {
  findById(
    id: string
  ): Promise<Device | null>;
}
```

define expectativa compile time, pero no demuestra por sí sola que SQL, schema real y migrations coincidan.

Necesitas:

```text
TypeScript
+
schema SQL
+
constraints
+
migrations
+
integration tests
```

# 25. Testing de guards

Casos útiles:

```text
null
undefined
string
number
array
{}
objeto incompleto
propiedad incorrecta
objeto válido
```

Un guard contiene lógica runtime y puede fallar.

# 26. Cuándo usar Type Guards

Úsalos cuando:

- reutilizas una comprobación;
- mejora legibilidad;
- refinas unions;
- trabajas con `unknown` y un check pequeño;
- filtras arrays;
- tienes un discriminante claro.

# 27. Cuándo NO usarlos

Evítalos cuando:

- `typeof` inline basta;
- un discriminante inline es más claro;
- duplicarías un schema complejo;
- necesitas mensajes de validación;
- la condición no demuestra realmente el tipo;
- escondes una assertion insegura.

# 28. Errores comunes

1. Guard que devuelve `true` sin evidencia.
2. Assertion en lugar de validación.
3. `any` en vez de `unknown`.
4. Olvidar `null`.
5. Duplicar schemas grandes manualmente.
6. Crear guards innecesarios.
7. Confiar ciegamente en tipos de HTTP/DB.
8. No probar guards importantes.

---

# PRÁCTICAS

## Práctica 1 — `isString`

Implementa:

```ts
function isString(
  value: unknown
): value is string {
  // tu código
}
```

Prueba mentalmente:

```text
"router" → true
10       → false
null     → false
{}       → false
```

## Práctica 2 — Router vs Switch

```ts
type Router = {
  kind: "router";
  hostname: string;
  routes: number;
};

type Switch = {
  kind: "switch";
  hostname: string;
  ports: number;
};

type Device =
  Router | Switch;
```

Implementa `isRouter`. No uses `any` ni assertions.

## Práctica 3 — Filtrar routers

```ts
const routers =
  devices.filter(
    // tu código
  );
```

Objetivo:

```ts
Router[]
```

Explica por qué `filter` entiende el predicate.

## Práctica 4 — Eliminar nullish

Implementa:

```ts
function isDefined<T>(
  value:
    T | null | undefined
): value is T {
  // tu código
}
```

## Práctica 5 — Objeto desde `unknown`

```ts
type DeviceSummary = {
  hostname: string;
  active: boolean;
};
```

Implementa `isDeviceSummary`.

Debe comprobar objeto, no null, `hostname` string y `active` boolean.

## Práctica 6 — Error handling

Implementa:

```ts
function getErrorMessage(
  error: unknown
): string {
  // tu código
}
```

Si es `Error`, retorna `message`. Si no, `"Unknown error"`.

---

# EJERCICIO PRINCIPAL — SiteOps Tracker

```ts
type PendingAudit = {
  status: "pending";
  id: string;
  site: string;
};

type InProgressAudit = {
  status: "in_progress";
  id: string;
  site: string;
  technicianId: string;
};

type CompletedAudit = {
  status: "completed";
  id: string;
  site: string;
  technicianId: string;
  completedAt: Date;
};

type Audit =
  | PendingAudit
  | InProgressAudit
  | CompletedAudit;
```

Implementa:

```ts
function isCompletedAudit(
  audit: Audit
): audit is CompletedAudit {
  // tu solución
}
```

Después:

```ts
const completedAudits =
  audits.filter(
    isCompletedAudit
  );
```

Explica discriminante, narrowing, tipo del array y por qué esto difiere de recibir `unknown` por HTTP.

No uses `any`, assertions ni Zod.

---

# RETO 1 — React + TypeScript

Modela un guard `isSuccessState` para una union con `loading`, `success` y `error`.

Explica cuándo aporta valor y cuándo un `if` inline sería suficiente.

# RETO 2 — Node.js + Zod

Compara:

```ts
req.body as CreateDeviceInput
```

con:

```ts
CreateDeviceSchema.safeParse(
  req.body
)
```

Explica cuál valida, qué pasa si `hostname` es `123`, por qué Zod va antes del Service y por qué el Service debería recibir datos confiables.

# RETO 3 — Analizador de configuraciones

Crea un guard para conservar solo líneas `interface` dentro de `ParsedLine`.

Explica por qué el parser debe actuar antes.

# RETO 4 — SDK tipado

Compara Type Guard manual vs Zod schema para una respuesta compleja.

Evalúa mantenimiento, mensajes de error, anidación y reutilización.

# RETO 5 — PostgreSQL + Repository

Analiza:

```ts
interface DeviceRepository {
  findById(
    id: string
  ): Promise<Device | null>;
}
```

Explica qué garantiza TypeScript y qué siguen garantizando schema SQL, migrations, constraints y tests de integración.

# RETO 6 — Testing con Vitest

Diseña casos para `isDeviceSummary`:

```text
null
undefined
"router"
10
[]
{}
{ hostname: "r1" }
{ hostname: "r1", active: "yes" }
{ hostname: "r1", active: true }
```

Clasifica cada uno como `true` o `false`.

---

# Relación explícita con tus proyectos

**SiteOps Tracker:** guards para estados de auditoría y filtros.  
**Repositorio de algoritmos:** narrowing seguro sin confundirlo con complejidad algorítmica.  
**Analizador:** parser → union controlada → guards.  
**SDK:** validar respuestas externas antes de exponer tipos confiables.  
**API REST:** Controller valida, Service recibe datos confiables, Repository persiste.  
**Full Stack:** React usa unions y guards; HTTP rompe garantías estáticas y requiere restablecer confianza runtime.

---

# Preguntas de comprensión

1. ¿Qué significa narrowing?
2. ¿Qué es un Type Guard?
3. ¿Qué significa `value is Device`?
4. ¿Qué parte se ejecuta runtime?
5. ¿Qué parte desaparece?
6. ¿Puede un guard mentir?
7. ¿Qué diferencia hay entre boolean y predicate?
8. ¿Por qué `filter` se beneficia?
9. ¿Por qué `unknown` es útil?
10. ¿Por qué `typeof value === "object"` no basta?
11. ¿Qué problema tiene `null`?
12. ¿Cuándo usarías `in`?
13. ¿Cuándo usarías `instanceof`?
14. ¿Por qué una assertion no valida?
15. ¿Cuándo preferirías Zod?
16. ¿Qué responsabilidad tiene Runtime Validation?
17. ¿Qué responsabilidad tiene Service?
18. ¿Qué responsabilidad tiene Repository?
19. ¿Qué garantiza PostgreSQL?
20. ¿Por qué probar guards?

---

# Relevancia para entrevistas

**What is a type guard in TypeScript?**

> A type guard is a runtime check that lets TypeScript narrow a value from a broader type to a more specific type.

**What is a user-defined type predicate?**

> It is a return type such as `value is Device`. When the function returns true, TypeScript narrows that parameter to the specified type.

**What is the difference between `unknown` and `any`?**

> `unknown` requires narrowing before type-specific operations, while `any` largely disables type checking.

**Can a custom type guard be wrong?**

> Yes. TypeScript trusts the predicate signature, so the implementation must provide sufficient runtime evidence.

**Do Type Guards replace Zod?**

> No. Guards are good for small checks and known unions; runtime schemas are generally better for complex external data.

---

# Resumen

Un Type Guard:

```ts
function isRouter(
  device: Device
): device is Router {
  return device.kind === "router";
}
```

combina:

```text
runtime check
+
compile-time narrowing
```

Pero para fronteras complejas:

```text
HTTP
formularios
APIs externas
archivos
env
```

Zod suele ser más apropiado.

Arquitectura:

```text
React
→ HTTP
→ Node
→ Router
→ Controller
→ Runtime Validation
→ Service
→ Repository
→ PostgreSQL
→ Testing
→ Docker
→ CI/CD
→ Cloud
```

---

# Próxima lección

**Lección 21 — Discriminated Unions avanzadas y exhaustividad con `never`.**
