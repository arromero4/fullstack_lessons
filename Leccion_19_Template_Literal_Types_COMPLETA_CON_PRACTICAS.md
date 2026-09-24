# Lección 19 — Template Literal Types en TypeScript

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración estimada:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Ruta:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

---

## Introducción

Los **Template Literal Types** permiten construir strings tipados mediante una sintaxis parecida a los template literals de JavaScript.

```ts
type Environment =
  "dev" | "test" | "prod";

type ConfigKey =
  `app:${Environment}`;
```

Resultado:

```ts
"app:dev"
| "app:test"
| "app:prod"
```

Son útiles para eventos, claves, rutas internas, SDKs y convenciones de nombres.

Pero existen solo en compile time. No validan strings provenientes de HTTP, formularios, APIs externas, archivos, variables de entorno ni PostgreSQL.

---

# Objetivo

Al terminar podrás:

- crear Template Literal Types;
- combinar unions;
- usar `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`;
- combinarlos con `keyof`;
- combinarlos con Mapped Types;
- usar key remapping;
- aplicarlos a React, Node.js, SDKs y tus proyectos;
- evitar explosión combinatoria;
- distinguir forma estática de validación runtime;
- explicar el concepto en entrevista.

---

# 1. Problema que resuelven

```ts
type Entity =
  "audit" | "device";

type Action =
  "created"
  | "updated"
  | "deleted";
```

En lugar de escribir seis strings manualmente:

```ts
type EventName =
  `${Entity}:${Action}`;
```

produce todas las combinaciones.

# 2. Runtime vs compile time

JavaScript:

```ts
const hostname =
  "router-core-01";

const label =
  `device:${hostname}`;
```

`label` es un valor runtime.

TypeScript:

```ts
type DeviceKind =
  "router" | "switch";

type DeviceLabel =
  `device:${DeviceKind}`;
```

`DeviceLabel` es un tipo y desaparece al compilar.

# 3. Combinar unions

```ts
type Resource =
  "device" | "audit";

type Operation =
  "create" | "read" | "update";

type Permission =
  `${Resource}:${Operation}`;
```

TypeScript genera el producto de combinaciones.

Esto reduce typos y mejora autocomplete cuando existe una convención estable.

# 4. Primer ejemplo práctico

```ts
type DeviceEvent =
  "created"
  | "updated"
  | "deleted";

type DeviceEventName =
  `device:${DeviceEvent}`;

function emit(
  event: DeviceEventName
) {
  console.log(event);
}
```

Válido:

```ts
emit("device:created");
```

Inválido:

```ts
emit("device:create");
```

# 5. No valida strings externos

Esto:

```ts
const event =
  req.body.event
    as DeviceEventName;
```

es inseguro.

La assertion no inspecciona runtime.

Un cliente aún puede mandar:

```json
{
  "event": "device:explode"
}
```

Necesitas runtime validation.

# 6. Intrinsic String Manipulation Types

TypeScript incluye:

```text
Uppercase<T>
Lowercase<T>
Capitalize<T>
Uncapitalize<T>
```

Ejemplo:

```ts
type Method =
  "get" | "post";

type HttpMethod =
  Uppercase<Method>;
```

Resultado:

```ts
"GET" | "POST"
```

# 7. `Capitalize`

```ts
type Entity =
  "device" | "audit";

type ServiceName =
  `${Capitalize<Entity>}Service`;
```

Resultado:

```ts
"DeviceService"
| "AuditService"
```

# 8. `Lowercase` y `Uncapitalize`

```ts
type Method =
  "GET" | "POST" | "DELETE";

type LowerMethod =
  Lowercase<Method>;
```

Resultado:

```ts
"get" | "post" | "delete"
```

```ts
type Name =
  "Device" | "Audit";

type VariableName =
  Uncapitalize<Name>;
```

Resultado:

```ts
"device" | "audit"
```

# 9. Template Literal Types + `keyof`

```ts
type Device = {
  hostname: string;
  ip: string;
  active: boolean;
};

type ChangeEvent =
  `${string & keyof Device}Changed`;
```

Resultado:

```ts
"hostnameChanged"
| "ipChanged"
| "activeChanged"
```

# 10. ¿Por qué `string & keyof T`?

`keyof T` puede incluir claves `string`, `number` o `symbol`.

Los Template Literal Types necesitan valores compatibles con interpolación.

Por eso en generics verás:

```ts
string & keyof T
```

# 11. Versión genérica

```ts
type ChangeEvent<T> =
  `${string & keyof T}Changed`;
```

Si el modelo cambia, el tipo derivado también.

# 12. Conexión con Mapped Types

```ts
type Getters<T> = {
  [P in keyof T as
    `get${Capitalize<string & P>}`]:
      () => T[P];
};
```

Aquí:

- `keyof` obtiene claves;
- Mapped Type las recorre;
- Template Literal Type crea nombres;
- `Capitalize` transforma strings;
- `T[P]` conserva el tipo.

# 13. Setters

```ts
type Setters<T> = {
  [P in keyof T as
    `set${Capitalize<string & P>}`]:
      (value: T[P]) => void;
};
```

Para:

```ts
type Device = {
  hostname: string;
  active: boolean;
};
```

produce conceptualmente:

```ts
type DeviceSetters = {
  setHostname:
    (value: string) => void;

  setActive:
    (value: boolean) => void;
};
```

# 14. SiteOps Tracker

```ts
type Audit = {
  site: string;
  status:
    | "pending"
    | "completed";
  assignee: string;
};

type AuditFieldEvent =
  `${string & keyof Audit}Changed`;
```

Resultado:

```text
siteChanged
statusChanged
assigneeChanged
```

Esto puede servir para eventos internos del frontend.

# 15. SDK tipado

```ts
type Resource =
  "devices" | "audits";

type Method =
  "GET" | "POST";

type EndpointKey =
  `${Method} /${Resource}`;
```

Resultado:

```text
GET /devices
GET /audits
POST /devices
POST /audits
```

Puede indexar definiciones internas de endpoints.

# 16. REST paths

```ts
type Resource =
  "devices" | "audits";

type CollectionPath =
  `/${Resource}`;

type ResourcePath =
  `/${Resource}/${string}`;
```

Esto restringe forma estática, no semántica runtime.

# 17. IDs tipados

```ts
type DeviceId =
  `dev-${string}`;
```

Puede detectar:

```ts
const id:
  DeviceId =
  "router-123";
```

si el literal está escrito en el código.

Pero no valida:

```ts
req.params.id
```

No uses:

```ts
req.params.id as DeviceId
```

como sustituto de validación.

# 18. Node.js + Express

```ts
router.get(
  "/devices/:id",
  getDeviceController
);
```

La ruta es configuración runtime de Express.

Un Template Literal Type no registra rutas.

Puede ayudar en wrappers o SDKs tipados.

# 19. Analizador de configuraciones

```ts
type Section =
  "interface" | "router";

type Property =
  "description" | "enabled";

type ConfigKey =
  `${Section}.${Property}`;
```

Resultado:

```text
interface.description
interface.enabled
router.description
router.enabled
```

Pero un archivo leído con:

```ts
await fs.readFile(...)
```

sigue siendo un string runtime que debe parsearse.

# 20. Variables de entorno

```ts
type Service =
  "database" | "redis";

type ServiceUrlKey =
  `${Uppercase<Service>}_URL`;
```

Resultado:

```text
DATABASE_URL
REDIS_URL
```

Pero:

```ts
process.env.DATABASE_URL
```

puede ser `undefined`, vacío o inválido.

Necesita runtime validation.

# 21. PostgreSQL y filtros

```ts
type DeviceColumn =
  "hostname" | "status";

type Direction =
  "asc" | "desc";

type SortExpression =
  `${DeviceColumn}:${Direction}`;
```

Puede modelar una API de filtros.

Pero un query parameter sigue siendo runtime data y debe validarse antes de usarse en SQL.

# 22. Seguridad SQL

Nunca hagas:

```text
query param
→ concatenar directamente en ORDER BY
```

solo porque exista un tipo TypeScript.

El flujo seguro:

```text
HTTP query
↓
runtime validation
↓
whitelist
↓
Repository
↓
safe SQL
```

# 23. React + TypeScript

```ts
type FormField =
  "hostname"
  | "ip"
  | "location";

type FormEvent =
  `${FormField}Changed`;
```

Puede ayudar en reducers o event buses.

Para estado simple, setters explícitos pueden ser más claros.

# 24. Testing

```ts
type TestLayer =
  "unit"
  | "integration"
  | "e2e";

type TestName =
  `${TestLayer}:${string}`;
```

Impone una convención de nombres, pero Vitest es quien ejecuta tests reales.

# 25. Docker

```ts
type Environment =
  "dev" | "test" | "prod";

type ImageTag =
  `siteops-api:${Environment}`;
```

Resultado:

```text
siteops-api:dev
siteops-api:test
siteops-api:prod
```

Docker no conoce este tipo.

# 26. CI/CD

```ts
type Stage =
  "lint"
  | "test"
  | "build"
  | "deploy";

type JobName =
  `ci:${Stage}`;
```

Puede servir en tooling TypeScript.

GitHub Actions ejecuta configuración runtime/YAML independiente.

# 27. Explosión combinatoria

```ts
type A =
  "a" | "b" | "c";

type B =
  "1" | "2" | "3";

type C =
  "x" | "y" | "z";

type Combined =
  `${A}-${B}-${C}`;
```

Unions grandes generan muchas combinaciones.

No intentes modelar cada string posible.

A veces `string` + runtime validation es mejor.

# 28. Conditional Types + Template Literal Types

```ts
type EventFor<T> =
  T extends "device"
    ? `device:${"created" | "deleted"}`
    : T extends "audit"
      ? `audit:${"created" | "completed"}`
      : never;
```

Puede ser útil, pero evita tipos anidados ilegibles.

# 29. SDK avanzado

```ts
type ResourceMap = {
  devices: Device;
  audits: Audit;
};

type ClientMethods<T> = {
  [K in keyof T as
    `get${Capitalize<string & K>}`]:
      () => Promise<T[K][]>;
};
```

Conceptualmente genera métodos como `getDevices()` y `getAudits()`.

Pero `fetch().json()` sigue siendo dato externo.

# 30. Runtime validation con Zod

Template Literal Types no sustituyen schemas.

Ejemplo conceptual:

```ts
const DeviceEventSchema =
  z.enum([
    "device:created",
    "device:updated",
    "device:deleted"
  ]);
```

El schema sí inspecciona runtime.

# 31. Arquitectura Full Stack

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

Template Literal Types ayudan con contratos internos.

No reemplazan ninguna frontera runtime.

# 32. Cuándo usarlos

Úsalos cuando:

- existe una convención estable;
- mejoran autocomplete;
- previenen typos;
- construyes SDKs;
- derivas nombres desde `keyof`;
- modelas eventos internos;
- key remapping aporta valor.

# 33. Cuándo NO usarlos

Evítalos cuando:

- strings son arbitrarios;
- el problema real es runtime validation;
- la union es enorme;
- una union explícita es más clara;
- eventos de dominio merecen nombres explícitos;
- solo quieres demostrar sofisticación.

# 34. Errores comunes

1. Confundir runtime y compile time.
2. Creer que `${string}` valida semántica.
3. Usar assertions como validación.
4. Generar demasiadas combinaciones.
5. Derivar eventos sin significado real.
6. Construir APIs demasiado genéricas.
7. Confundir autocomplete con runtime safety.
8. Confiar en tipos del SDK para validar responses.
9. Usar strings HTTP directamente en SQL.

---

# PRÁCTICAS

## Práctica 1 — Prefijo simple

```ts
type DeviceKind =
  "router" | "switch";
```

Crea:

```ts
type DeviceLabel =
  // tu código
```

Resultado:

```text
device:router
device:switch
```

## Práctica 2 — Combinar unions

```ts
type Resource =
  "device" | "audit";

type Action =
  "create" | "delete";
```

Crea `Permission` con las cuatro combinaciones.

## Práctica 3 — HTTP Methods

```ts
type Method =
  "get" | "post" | "delete";
```

Crea `UpperMethod`.

Pista:

```ts
Uppercase<...>
```

## Práctica 4 — Cambios de propiedades

```ts
type Device = {
  hostname: string;
  ip: string;
  active: boolean;
};
```

Construye `DeviceChangeEvent` con:

```text
hostnameChanged
ipChanged
activeChanged
```

## Práctica 5 — ID tipado

Crea:

```ts
type DeviceId =
  // tu código
```

que acepte `dev-123` y rechace un literal `router-123`.

Explica por qué no basta para validar `req.params.id`.

## Práctica 6 — Getters

```ts
type Audit = {
  site: string;
  completed: boolean;
};
```

Completa un Mapped Type que produzca:

```text
getSite(): string
getCompleted(): boolean
```

Combina Mapped Type, `keyof`, `Capitalize`, Template Literal Type y `T[K]`.

---

# EJERCICIO PRINCIPAL — SiteOps Tracker

```ts
type Audit = {
  site: string;
  assignee: string;
  status:
    | "pending"
    | "in_progress"
    | "completed";
};
```

Construye:

```ts
type FieldEvents<T> =
  // tu código
```

Resultado:

```text
audit:site:changed
audit:assignee:changed
audit:status:changed
```

### Restricciones

No uses `any`, assertions ni enumeres manualmente propiedades.

### Pistas

- `keyof T`;
- restringe claves a strings;
- interpola dentro del Template Literal Type.

No se incluye solución completa.

---

# RETO 1 — React + TypeScript

Diseña `FormEvent<T>` para producir:

```text
hostnameChanged
ipChanged
activeChanged
```

Explica qué typos detecta y por qué eventos externos aún requieren validación.

# RETO 2 — Node.js + REST

Construye `EndpointKey` a partir de:

```text
Resource = devices | audits
Method = GET | POST
```

Explica por qué esto no registra rutas en Express y qué responsabilidades conservan Router, Controller, Runtime Validation y Service.

# RETO 3 — SDK tipado

Dado `ResourceMap`, diseña `ApiGetters<T>` para producir métodos `getDevice()` y `getAudit()`.

Explica por qué `Promise<Device>` no valida una respuesta JSON real.

# RETO 4 — Analizador de configuraciones

Crea `ConfigKey` a partir de `Section` y `Property`.

Explica por qué `fs.readFile()` necesita parsing y validación.

# RETO 5 — PostgreSQL + filtros

Construye `SortExpression` a partir de `SortableColumn` y `Direction`.

Explica el flujo seguro hacia SQL y por qué no debes concatenar directamente query params.

# RETO 6 — Testing + Runtime Safety

```ts
type Environment =
  "dev" | "test" | "prod";

type ImageTag =
  `siteops-api:${Environment}`;
```

Compara un literal conocido con `process.env.IMAGE_TAG`.

Diseña casos de Vitest para `parseImageTag()`.

---

# Relación explícita con tus proyectos

**SiteOps Tracker:** eventos tipados y convenciones internas.  
**Repositorio de algoritmos:** profundiza TypeScript sin sustituir lógica runtime.  
**Analizador:** claves normalizadas, parser separado.  
**SDK tipado:** métodos y endpoint keys derivados.  
**API REST:** contratos estáticos sin sustituir Zod/Service/DB.  
**Full Stack:** contratos precisos con fronteras runtime separadas.

---

# Preguntas de comprensión

1. ¿Qué es un Template Literal Type?
2. ¿Cómo difiere del template literal JavaScript?
3. ¿Qué ocurre al interpolar unions?
4. ¿Qué hacen `Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`?
5. ¿Cómo se combinan con `keyof`?
6. ¿Por qué aparece `string & keyof T`?
7. ¿Cómo se combinan con Mapped Types?
8. ¿Qué es key remapping?
9. ¿Cómo generarías getters?
10. ¿Por qué `dev-${string}` no valida HTTP?
11. ¿Por qué Zod sigue siendo necesario?
12. ¿Qué riesgo tienen unions grandes?
13. ¿Cómo los usarías en SDKs?
14. ¿Cómo los usarías en SiteOps Tracker?
15. ¿Cómo se relacionan con SQL seguro?

---

# Relevancia para entrevistas

**What is a Template Literal Type in TypeScript?**

> A Template Literal Type builds string literal types by interpolating other literal types or unions using syntax similar to JavaScript template literals.

**What happens when unions are interpolated?**

> TypeScript generates the possible combinations of the union members.

**How do they work with `keyof`?**

> You can derive string patterns from known object keys, such as `${string & keyof T}Changed`.

**What are intrinsic string manipulation types?**

> `Uppercase`, `Lowercase`, `Capitalize`, and `Uncapitalize`.

**Do Template Literal Types validate runtime strings?**

> No. They disappear during compilation. External strings still need runtime validation.

---

# Resumen

Template Literal Types construyen string literal types:

```ts
type Action =
  "create" | "delete";

type Event =
  `device:${Action}`;
```

Pueden combinarse con unions, `keyof`, Mapped Types, Conditional Types, Indexed Access Types y utilidades de strings.

Pero:

```text
Template Literal Types
→ compile time
→ desaparecen

HTTP / formularios / APIs / archivos /
env / PostgreSQL
→ runtime
→ requieren validación
```

---

# Próxima lección

**Lección 20 — Type Guards personalizados y funciones de predicado (`value is Type`).**
