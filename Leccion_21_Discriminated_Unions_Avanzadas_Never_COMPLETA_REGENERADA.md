# Lección 21 — Discriminated Unions avanzadas y exhaustividad con `never`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración estimada:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Ruta:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

---

## Introducción

Una **Discriminated Union** representa variantes mutuamente excluyentes mediante una propiedad común cuyo valor literal identifica cada variante.

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

La propiedad:

```ts
kind
```

es el discriminante.

La segunda parte de esta lección es la **exhaustividad** con `never`: hacer que TypeScript detecte cuando agregas un nuevo estado y olvidaste manejarlo.

---

# Objetivo

Al terminar podrás:

- diseñar discriminated unions robustas;
- elegir discriminantes claros;
- hacer narrowing con `switch`;
- modelar estados de React;
- modelar resultados de Services;
- modelar eventos de dominio;
- usar `never` para exhaustividad;
- crear `assertNever`;
- distinguir exhaustividad compile time de runtime validation;
- integrar Zod, Service, Controller y PostgreSQL;
- aplicar estos conceptos a SiteOps Tracker;
- explicar el tema en entrevistas.

---

# 1. Problema: estados imposibles

Modelo problemático:

```ts
type ApiResult = {
  loading: boolean;
  error?: string;
  data?: Device[];
};
```

Esto permite:

```ts
{
  loading: true,
  error: "Server error",
  data: []
}
```

Hay estados contradictorios.

Mejor:

```ts
type ApiResult =
  | {
      status: "loading";
    }
  | {
      status: "success";
      data: Device[];
    }
  | {
      status: "error";
      error: string;
    };
```

Cada estado contiene solo sus datos válidos.

# 2. Estados de dominio

Una aplicación Full Stack tiene muchos estados mutuamente excluyentes:

```text
request: idle/loading/success/error
auth: anonymous/authenticated/expired
audit: pending/in_progress/completed
job: queued/running/failed/completed
```

Múltiples booleanos suelen permitir combinaciones inválidas.

# 3. Anatomía

```ts
type PendingAudit = {
  status: "pending";
  id: string;
};

type RunningAudit = {
  status: "in_progress";
  id: string;
  technicianId: string;
};

type CompletedAudit = {
  status: "completed";
  id: string;
  technicianId: string;
  completedAt: Date;
};

type Audit =
  | PendingAudit
  | RunningAudit
  | CompletedAudit;
```

Discriminante:

```ts
status
```

Valores literales:

```text
pending
in_progress
completed
```

# 4. Narrowing con `if`

```ts
function printAudit(
  audit: Audit
) {
  if (
    audit.status ===
    "completed"
  ) {
    console.log(
      audit.completedAt
    );
  }
}
```

Dentro del bloque, `audit` es `CompletedAudit`.

# 5. Narrowing con `switch`

```ts
function describeAudit(
  audit: Audit
): string {
  switch (audit.status) {
    case "pending":
      return "Pending";

    case "in_progress":
      return "In progress";

    case "completed":
      return "Completed";
  }
}
```

Cada `case` hace narrowing.

# 6. Problema: nuevo estado

Agregamos:

```ts
type CancelledAudit = {
  status: "cancelled";
  id: string;
  reason: string;
};
```

y lo añadimos a `Audit`.

¿Cómo obligamos a actualizar los `switch` importantes?

Con `never`.

# 7. `never`

`never` representa valores que no deberían existir.

```ts
function fail(
  message: string
): never {
  throw new Error(message);
}
```

La función no completa normalmente.

# 8. Exhaustividad

```ts
function describeAudit(
  audit: Audit
): string {
  switch (audit.status) {
    case "pending":
      return "Pending";

    case "in_progress":
      return "In progress";

    case "completed":
      return "Completed";

    default: {
      const check:
        never = audit;

      return check;
    }
  }
}
```

Si todos los casos están cubiertos, en `default` no queda ningún tipo posible.

# 9. Si agregas `cancelled`

Si no agregas:

```ts
case "cancelled":
```

entonces en `default` todavía queda `CancelledAudit`.

Esto falla:

```ts
const check:
  never = audit;
```

El compilador te obliga a revisar el código.

# 10. `assertNever`

```ts
function assertNever(
  value: never
): never {
  throw new Error(
    `Unexpected value: ${String(value)}`
  );
}
```

Uso:

```ts
function describeAudit(
  audit: Audit
): string {
  switch (audit.status) {
    case "pending":
      return "Pending";

    case "in_progress":
      return "In progress";

    case "completed":
      return "Completed";

    default:
      return assertNever(audit);
  }
}
```

# 11. `never` no valida HTTP

Un cliente puede enviar:

```json
{
  "status": "corrupted"
}
```

aunque tu union solo permita:

```text
pending
completed
```

La exhaustividad ayuda después de que el dato ha sido validado y convertido en una union confiable.

Flujo:

```text
HTTP
↓
runtime validation
↓
trusted union
↓
exhaustive switch
```

# 12. Zod + discriminated union

Conceptualmente:

```ts
const AuditSchema =
  z.discriminatedUnion(
    "status",
    [
      PendingAuditSchema,
      RunningAuditSchema,
      CompletedAuditSchema
    ]
  );
```

Zod valida runtime.

TypeScript hace narrowing y exhaustividad compile time.

# 13. SiteOps Tracker

```ts
type Audit =
  | {
      status: "pending";
      id: string;
      siteId: string;
    }
  | {
      status: "in_progress";
      id: string;
      siteId: string;
      technicianId: string;
      startedAt: Date;
    }
  | {
      status: "completed";
      id: string;
      siteId: string;
      technicianId: string;
      startedAt: Date;
      completedAt: Date;
      findings: string[];
    };
```

Un audit pending no necesita:

```ts
completedAt?: Date;
```

La propiedad simplemente no existe en esa variante.

Eso evita estados imposibles.

# 14. Transiciones de estado

```text
pending
↓
in_progress
↓
completed
```

No todas las transiciones son válidas.

La union modela estados.

El Service hace cumplir reglas de transición.

# 15. Service y reglas

```ts
function completeAudit(
  audit: Audit,
  completedAt: Date
): CompletedAudit {
  if (
    audit.status !==
    "in_progress"
  ) {
    throw new Error(
      "Only an in-progress audit can be completed"
    );
  }

  return {
    ...audit,
    status: "completed",
    completedAt,
    findings: []
  };
}
```

La regla es runtime business logic.

# 16. React: estados de carga

```ts
type DeviceQueryState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
    }
  | {
      status: "success";
      devices: Device[];
    }
  | {
      status: "error";
      message: string;
    };
```

Evita boolean flags contradictorios.

# 17. Render exhaustivo en React

```tsx
function DevicePanel({
  state
}: {
  state: DeviceQueryState;
}) {
  switch (state.status) {
    case "idle":
      return <p>Ready</p>;

    case "loading":
      return <p>Loading...</p>;

    case "success":
      return (
        <DeviceList
          devices={state.devices}
        />
      );

    case "error":
      return <p>{state.message}</p>;

    default:
      return assertNever(state);
  }
}
```

Si agregas `refreshing`, el compilador obliga a revisar este código.

# 18. Reducers

```ts
type DeviceAction =
  | {
      type: "device/added";
      payload: Device;
    }
  | {
      type: "device/removed";
      payload: {
        id: string;
      };
    }
  | {
      type:
        "device/statusChanged";
      payload: {
        id: string;
        active: boolean;
      };
    };
```

Cada action tiene el payload apropiado.

# 19. Node.js: resultados de Service

```ts
type CreateDeviceResult =
  | {
      type: "created";
      device: Device;
    }
  | {
      type:
        "duplicate_hostname";
      hostname: string;
    }
  | {
      type:
        "site_not_found";
      siteId: string;
    };
```

El Controller puede mapear:

```text
created → 201
duplicate_hostname → 409
site_not_found → 404
```

# 20. ¿Por qué Service no debe devolver HTTP?

El Service debe conocer dominio:

```text
duplicate hostname
site not found
already completed
```

El Controller conoce:

```text
201
404
409
422
```

Así mantenemos separación entre dominio y transporte.

# 21. Repository

```ts
interface DeviceRepository {
  findById(
    id: string
  ): Promise<Device | null>;
}
```

Para casos simples no hace falta crear una union discriminada gigantesca.

La abstracción debe aportar claridad.

# 22. PostgreSQL

Si `status` solo debe admitir valores concretos, PostgreSQL también debe proteger la persistencia.

Conceptualmente:

```sql
CHECK (
  status IN (
    'pending',
    'in_progress',
    'completed'
  )
)
```

TypeScript no protege escrituras hechas por otro proceso.

# 23. Agregar un nuevo estado

Si agregas:

```text
cancelled
```

debes revisar:

```text
TypeScript union
Zod schema
Service transitions
Controller mapping
React rendering
tests
PostgreSQL constraint
migration
API documentation
```

Un cambio de dominio atraviesa capas.

# 24. API REST y Date

JSON transporta strings, no objetos `Date`.

```ts
completedAt: Date;
```

en dominio no significa que el wire format sea `Date`.

Puede llegar:

```json
{
  "completedAt":
    "2026-09-15T10:00:00Z"
}
```

Necesitas validación y transformación runtime.

# 25. Analizador de configuraciones

```ts
type ConfigToken =
  | {
      kind: "interface";
      name: string;
    }
  | {
      kind: "description";
      value: string;
    }
  | {
      kind: "ip_address";
      value: string;
      mask: string;
    }
  | {
      kind: "shutdown";
    };
```

Un `switch` exhaustivo ayuda a mantener parser y consumidores alineados.

# 26. SDK: eventos

```ts
type SdkEvent =
  | {
      type: "request:start";
      url: string;
    }
  | {
      type:
        "request:success";
      url: string;
      status: number;
    }
  | {
      type: "request:error";
      url: string;
      error: Error;
    };
```

Un listener central puede manejar exhaustivamente.

# 27. Testing

TypeScript comprueba cobertura de variantes conocidas.

Vitest comprueba comportamiento runtime.

Un `switch` puede ser exhaustivo y aun retornar valores incorrectos.

# 28. `void` vs `never`

```ts
function log(): void {
  console.log("x");
}
```

Completa normalmente.

```ts
function fail(): never {
  throw new Error("x");
}
```

No completa normalmente.

# 29. `never` en unions

```ts
string | never
```

se simplifica a:

```ts
string
```

Esto también explica cómo Conditional Types filtran unions.

# 30. Relación con Type Guards

Un guard reduce:

```text
A | B | C
```

a una variante.

Un `switch` exhaustivo sigue reduciendo hasta:

```text
ninguna posibilidad
```

Ese punto se representa con `never`.

# 31. Autenticación futura

```ts
type AuthState =
  | {
      status:
        "anonymous";
    }
  | {
      status:
        "authenticated";
      user: User;
    }
  | {
      status:
        "expired";
      reason: string;
    };
```

Pero el tipo no autentica a nadie.

Antes necesitas verificar token, signature, expiration, claims e identity.

# 32. Errores de dominio vs errores técnicos

Puedes modelar errores esperados con unions.

Pero fallos inesperados como una conexión perdida a PostgreSQL pueden requerir logging, 500, observability y quizá retry.

No conviertas todo en una union enorme.

# 33. Cuándo usar discriminated unions

Úsalas cuando:

- hay variantes mutuamente excluyentes;
- cada variante tiene datos diferentes;
- modelas estados de UI;
- modelas eventos;
- modelas workflows;
- modelas resultados de negocio;
- necesitas exhaustividad.

# 34. Cuándo NO usarlas

Evítalas cuando:

- solo existe una estructura simple;
- una propiedad opcional es realmente opcional;
- crear muchas variantes complica sin beneficio;
- una librería ya resuelve el estado;
- intentas representar cada excepción técnica.

# 35. Buen discriminante

Buenos nombres:

```text
status
kind
type
state
```

Debe ser común, literal, estable y claro.

# 36. Boolean como discriminante

Puede ser válido:

```ts
type Result<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    };
```

Pero si aparecerán más estados, un string discriminant puede escalar mejor.

# 37. Propiedades opcionales legítimas

Esto es correcto:

```ts
type Device = {
  hostname: string;
  description?: string;
};
```

`description` realmente puede estar ausente.

El problema es usar opcionales para representar variantes mutuamente excluyentes.

# 38. Runtime Validation otra vez

Un WebSocket puede mandar:

```json
{
  "type":
    "device.destroyUniverse"
}
```

aunque la union TypeScript no lo permita.

Necesitas:

```text
payload externo
↓
runtime validation
↓
trusted union
↓
exhaustive switch
```

# 39. Arquitectura Full Stack

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

**React:** estados y reducers.  
**HTTP:** transporte sin tipos.  
**Node:** runtime.  
**Router:** endpoint.  
**Controller:** dominio ↔ HTTP.  
**Runtime Validation:** valida discriminantes y estructuras.  
**Service:** transiciones de negocio.  
**Repository:** persistencia.  
**PostgreSQL:** constraints.  
**Testing:** comportamiento.  
**Docker:** runtime reproducible.  
**CI/CD:** typecheck y tests.  
**Cloud:** ejecución real.

# 40. Errores comunes

1. Boolean flags contradictorios.
2. Propiedades opcionales para simular estados.
3. Discriminante sin literal types.
4. Discriminante ambiguo.
5. `switch` no exhaustivo.
6. Creer que `never` valida HTTP.
7. `default` que oculta nuevos estados.
8. Códigos HTTP dentro del dominio sin necesidad.
9. Confundir error de negocio con fallo técnico.
10. Olvidar Zod/DB al agregar estados.
11. Creer que exhaustividad reemplaza tests.
12. Tipar JSON externo directamente.
13. Abusar de variantes.
14. Usar assertions para silenciar casos.

---

# PRÁCTICAS

## Práctica 1 — Estado de conexión

Modela:

```text
disconnected
connecting
connected
```

`connected` debe tener:

```ts
connectedAt: Date;
```

No uses opcionales para simular variantes.

## Práctica 2 — `switch`

Implementa:

```ts
function describeConnection(
  state: ConnectionState
): string {
  // tu código
}
```

Usa `switch`.

## Práctica 3 — Exhaustividad

Agrega:

```ts
function assertNever(
  value: never
): never {
  throw new Error(
    "Unexpected state"
  );
}
```

Úsala en `default`.

Luego agrega `reconnecting` sin actualizar el `switch` y explica el error.

## Práctica 4 — Resultado de Service

Modela:

```text
deleted
not_found
protected_device
```

con discriminante `type`.

Cada variante debe tener solo los datos necesarios.

## Práctica 5 — Controller mapping

Mapea:

```text
deleted → 204
not_found → 404
protected_device → 409
```

Incluye exhaustividad.

Explica por qué HTTP pertenece al Controller.

## Práctica 6 — React

Modela:

```text
idle
loading
success
error
```

`success` lleva `devices: Device[]`.

`error` lleva `message: string`.

Diseña un `switch` exhaustivo.

---

# EJERCICIO PRINCIPAL — SiteOps Tracker

Diseña `Audit` con:

### pending

```text
id
siteId
createdAt
```

### in_progress

```text
id
siteId
createdAt
technicianId
startedAt
```

### completed

```text
id
siteId
createdAt
technicianId
startedAt
completedAt
findings
```

### cancelled

```text
id
siteId
createdAt
cancelledAt
reason
```

Después implementa:

```ts
function getAuditSummary(
  audit: Audit
): string {
  // tu solución
}
```

Usa `switch` + `assertNever`.

### Restricciones

No uses `any`, assertions ni opcionales para mezclar estados.

### Preguntas

1. ¿Cuál es el discriminante?
2. ¿Qué estados imposibles evita?
3. ¿Qué ocurre si agregas `paused`?
4. ¿Por qué todavía necesitas Zod si viene de HTTP?
5. ¿Qué debería proteger PostgreSQL?
6. ¿Qué transiciones controla Service?

No se incluye solución completa.

---

# RETO 1 — React + reducer

Modela acciones:

```text
audit/selected
audit/cleared
audit/statusChanged
```

Cada acción debe tener solo su payload.

Diseña un reducer exhaustivo.

# RETO 2 — Node.js + Service

Diseña:

```text
started
not_found
already_started
already_completed
```

como resultado de `StartAuditResult`.

El Service no debe retornar códigos HTTP.

Explica cómo Controller los mapearía.

# RETO 3 — Zod

Diseña conceptualmente:

```ts
z.discriminatedUnion(
  "status",
  [...]
)
```

para `pending`, `in_progress`, `completed`, `cancelled`.

Explica:

```text
Zod → runtime
TypeScript → compile time
never → exhaustividad
```

# RETO 4 — PostgreSQL

Con:

```sql
status TEXT NOT NULL
```

analiza por qué todavía podría almacenarse `"banana"`.

Propón conceptualmente una restricción SQL.

Explica qué cambia al agregar `cancelled`.

# RETO 5 — Analizador de configuraciones

Modela:

```text
interface
description
ip_address
shutdown
unknown
```

como `ConfigToken`.

Diseña un `switch` exhaustivo.

Explica por qué `fs.readFile()` no produce directamente `ConfigToken[]`.

# RETO 6 — Testing

Para:

```ts
completeAudit(audit)
```

diseña tests para:

```text
pending
in_progress
completed
cancelled
```

Explica qué detecta TypeScript y qué detecta Vitest.

---

# Relación explícita con tus proyectos

## SiteOps Tracker

Estados de auditoría son un caso natural de discriminated unions.

## Repositorio de algoritmos

Fortalece comprensión del type system, sin sustituir complejidad algorítmica.

## Analizador

Tokens y nodos del parser pueden ser unions discriminadas.

## SDK

Eventos y respuestas pueden exponerse como unions después de runtime validation.

## API REST

Service retorna resultados de dominio; Controller los traduce a HTTP.

## Full Stack

Un nuevo estado puede impactar React, API, validación, Service, DB, migrations y tests.

---

# Preguntas de comprensión

1. ¿Qué es una discriminated union?
2. ¿Qué requisitos debe cumplir el discriminante?
3. ¿Por qué literal types importan?
4. ¿Qué problema tienen múltiples booleanos?
5. ¿Qué es un estado imposible?
6. ¿Cómo hace narrowing un `switch`?
7. ¿Qué representa `never`?
8. ¿Qué hace `assertNever`?
9. ¿Qué ocurre al agregar una variante?
10. ¿`never` valida HTTP?
11. ¿Dónde entra Zod?
12. ¿Cómo se complementan Zod y `never`?
13. ¿Cómo modelarías estados de React?
14. ¿Cómo modelarías acciones de reducer?
15. ¿Cómo modelarías resultados de Service?
16. ¿Por qué Controller traduce dominio a HTTP?
17. ¿Qué protege PostgreSQL?
18. ¿Qué diferencia hay entre `void` y `never`?
19. ¿Por qué tests siguen siendo necesarios?
20. ¿Cómo aplicarías esto en SiteOps Tracker?

---

# Relevancia para entrevistas

**What is a discriminated union in TypeScript?**

> A discriminated union is a union of object types that share a common property whose literal value uniquely identifies each variant.

**Why are they useful?**

> They model mutually exclusive states, enable precise narrowing and reduce invalid state combinations.

**What does `never` represent?**

> It represents values that cannot occur. After exhaustive narrowing, the remaining value can be `never`.

**How do you perform an exhaustive check?**

> A common pattern is to pass the remaining value to an `assertNever` function. If a new union member is not handled, TypeScript reports an error.

**Does exhaustiveness validate runtime input?**

> No. External data must be validated before it is treated as a trusted discriminated union.

**How do Zod and discriminated unions work together?**

> Zod validates external runtime data; TypeScript then provides narrowing and exhaustive compile-time checks.

---

# Resumen

Discriminated unions modelan variantes válidas:

```ts
type Result =
  | {
      status: "success";
      data: Device[];
    }
  | {
      status: "error";
      message: string;
    };
```

`switch` hace narrowing.

`never` verifica exhaustividad:

```ts
function assertNever(
  value: never
): never {
  throw new Error(
    "Unexpected value"
  );
}
```

Patrón profesional:

```text
external runtime data
↓
Zod/runtime validation
↓
trusted discriminated union
↓
exhaustive switch
↓
Service/UI logic
```

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

**Lección 22 — Exhaustividad práctica, `satisfies` y contratos seguros de configuración.**
