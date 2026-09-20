# Lección 18 — Conditional Types en TypeScript

**Duración estimada:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Ruta:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

---

## Introducción

Después de Mapped Types, el siguiente paso son los **Conditional Types**. Permiten seleccionar un tipo u otro en función de una relación de asignabilidad:

```ts
T extends U ? X : Y
```

Se lee como:

```text
si T es asignable a U → X
si no → Y
```

Esta condición ocurre exclusivamente en el sistema de tipos. No ejecuta un `if` en JavaScript y desaparece al compilar.

Los Conditional Types son especialmente útiles para transformar tipos genéricos, filtrar unions, extraer información con `infer`, construir SDKs tipados y entender Utility Types avanzados.

Pero no validan datos externos. HTTP, formularios, APIs externas, archivos, variables de entorno y PostgreSQL siguen siendo fronteras runtime.

---

# Objetivo

Al terminar podrás:

- escribir `T extends U ? X : Y`;
- entender `extends` como comprobación de asignabilidad;
- diferenciar compile time de runtime;
- comprender Distributive Conditional Types;
- usar `never` para filtrar unions;
- evitar distribución cuando sea necesario;
- usar `infer` de forma introductoria;
- entender `Exclude`, `Extract`, `NonNullable`, `ReturnType` y `Awaited`;
- aplicar Conditional Types a Bitácora de red, React, Node.js y SDKs;
- explicar por qué Zod sigue siendo necesario;
- responder preguntas de entrevista técnica.

---

# 1. Primer Conditional Type

```ts
type IsString<T> =
  T extends string
    ? true
    : false;
```

```ts
type A = IsString<string>; // true
type B = IsString<number>; // false
```

El compilador decide el tipo resultante.

# 2. `extends` en este contexto

En un generic constraint:

```ts
function getId<
  T extends { id: string }
>(value: T) {
  return value.id;
}
```

`extends` restringe `T`.

En un Conditional Type:

```ts
type HasId<T> =
  T extends { id: string }
    ? true
    : false;
```

pregunta si `T` es asignable a esa estructura.

```ts
type Device = {
  id: string;
  hostname: string;
};

type Draft = {
  hostname: string;
};

type A = HasId<Device>; // true
type B = HasId<Draft>;  // false
```

# 3. Structural typing

```ts
type HasHostname<T> =
  T extends { hostname: string }
    ? "network-device"
    : "other";
```

```ts
type Router = {
  hostname: string;
  routes: number;
};

type Result =
  HasHostname<Router>;
// "network-device"
```

TypeScript compara estructura, no el nombre nominal del tipo.

# 4. No es runtime

Esto:

```ts
type IsString<T> =
  T extends string
    ? true
    : false;
```

no genera un `if` JavaScript.

Si HTTP manda:

```json
{
  "hostname": 123
}
```

ningún Conditional Type lo rechaza.

# 5. Conditional Types + Generics

```ts
type ApiResult<T> =
  T extends void
    ? { success: true }
    : {
        success: true;
        data: T;
      };
```

```ts
type DeleteResult =
  ApiResult<void>;

type DeviceResult =
  ApiResult<Device>;
```

Esto evita duplicación estática.

# 6. Distributive Conditional Types

```ts
type ToArray<T> =
  T extends unknown
    ? T[]
    : never;
```

```ts
type Result =
  ToArray<string | number>;
```

Resultado:

```ts
string[] | number[]
```

TypeScript distribuye la condición sobre cada miembro de la union.

# 7. Diferencia importante

```ts
string[] | number[]
```

no es igual a:

```ts
(string | number)[]
```

El primero representa un array de strings o uno de numbers. El segundo permite mezclar ambos.

# 8. Filtrar una union con `never`

```ts
type OnlyStrings<T> =
  T extends string
    ? T
    : never;
```

```ts
type Values =
  "router"
  | 10
  | "switch"
  | false;

type StringsOnly =
  OnlyStrings<Values>;
```

Resultado:

```ts
"router" | "switch"
```

`never` elimina miembros no deseados.

# 9. Bitácora de red

```ts
type Router = {
  kind: "router";
  hostname: string;
};

type Switch = {
  kind: "switch";
  hostname: string;
};

type User = {
  kind: "user";
  username: string;
};

type Entity =
  Router | Switch | User;

type NetworkEntity<T> =
  T extends { hostname: string }
    ? T
    : never;

type Devices =
  NetworkEntity<Entity>;
```

Resultado:

```ts
Router | Switch
```

# 10. Evitar distribución

```ts
type ToArrayNonDistributed<T> =
  [T] extends [unknown]
    ? T[]
    : never;
```

```ts
type Result =
  ToArrayNonDistributed<
    string | number
  >;
```

Resultado:

```ts
(string | number)[]
```

Regla:

```text
T extends U → puede distribuir
[T] extends [U] → evita distribución
```

# 11. Introducción a `infer`

```ts
type ElementType<T> =
  T extends Array<infer U>
    ? U
    : T;
```

```ts
type A = ElementType<string[]>; // string
type B = ElementType<number[]>; // number
```

`infer U` captura el tipo interno.

# 12. Promise

```ts
type UnwrapPromise<T> =
  T extends Promise<infer U>
    ? U
    : T;
```

```ts
type A =
  UnwrapPromise<
    Promise<string>
  >;
// string
```

En producción preferirás `Awaited<T>` cuando resuelva el caso.

# 13. Retorno de función

```ts
type MyReturnType<T> =
  T extends (
    ...args: never[]
  ) => infer R
    ? R
    : never;
```

```ts
function createDevice() {
  return {
    id: "dev-1",
    hostname: "router-01"
  };
}

type CreatedDevice =
  MyReturnType<
    typeof createDevice
  >;
```

TypeScript ya ofrece `ReturnType<T>`.

# 14. `Exclude`

```ts
type MyExclude<T, U> =
  T extends U
    ? never
    : T;
```

```ts
type Status =
  "pending"
  | "completed"
  | "cancelled";

type ActiveStatus =
  MyExclude<
    Status,
    "cancelled"
  >;
```

Resultado:

```ts
"pending" | "completed"
```

# 15. `Extract`

```ts
type MyExtract<T, U> =
  T extends U
    ? T
    : never;
```

```ts
type Values =
  string | number | boolean;

type Text =
  MyExtract<Values, string>;
```

Resultado:

```ts
string
```

# 16. `NonNullable`

```ts
type MyNonNullable<T> =
  T extends null | undefined
    ? never
    : T;
```

```ts
type MaybeHostname =
  string
  | null
  | undefined;

type Hostname =
  MyNonNullable<
    MaybeHostname
  >;
```

Resultado:

```ts
string
```

# 17. React + TypeScript

```ts
type FieldValue<T> =
  T extends boolean
    ? {
        control: "checkbox";
        value: boolean;
      }
    : T extends number
      ? {
          control: "number";
          value: number;
        }
      : {
          control: "text";
          value: T;
        };
```

Puede ser útil en formularios genéricos, pero no crees abstracciones complejas sin beneficio real.

# 18. Node.js + TypeScript

```ts
type ServiceResult<T> =
  T extends void
    ? { success: true }
    : {
        success: true;
        value: T;
      };
```

El tipo describe contratos compile time. La implementación runtime sigue necesitando tests.

# 19. SDK tipado

```ts
type ApiResponse<T> =
  T extends void
    ? { ok: true }
    : {
        ok: true;
        data: T;
      };
```

Una respuesta real de `response.json()` sigue siendo runtime data y puede requerir validación.

# 20. Analizador de configuraciones

```ts
type ConfigValueKind<T> =
  T extends string
    ? "text"
    : T extends number
      ? "numeric"
      : T extends boolean
        ? "boolean"
        : "unsupported";
```

Clasifica tipos estáticos. No parsea archivos reales.

# 21. PostgreSQL

```ts
type NullableField<T> =
  null extends T
    ? "nullable"
    : "required";
```

Esto no crea `NOT NULL`, `CHECK`, `UNIQUE` ni foreign keys.

# 22. Runtime validation con Zod

Frontera correcta:

```text
req.body
↓
dato no confiable
↓
Zod
↓
safeParse / parse
↓
dato validado
↓
Service
```

Una assertion como:

```ts
const body =
  req.body as CreateDeviceInput;
```

no valida nada.

# 23. Arquitectura Full Stack

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

**React:** UI y estado.  
**HTTP:** transporte no confiable.  
**Node:** runtime JavaScript.  
**Router:** selecciona endpoint.  
**Controller:** adapta HTTP.  
**Runtime Validation:** valida valores reales.  
**Service:** aplica negocio.  
**Repository:** abstrae persistencia.  
**PostgreSQL:** protege integridad.  
**Testing:** verifica comportamiento.  
**Docker:** empaqueta runtime.  
**CI/CD:** automatiza calidad y despliegue.  
**Cloud:** ejecuta el sistema real.

# 24. Cuándo usar Conditional Types

Úsalos cuando:

- un tipo depende realmente de otro;
- necesitas filtrar unions;
- necesitas extraer un tipo interno;
- construyes SDKs o librerías;
- una transformación genérica mejora claridad.

# 25. Cuándo NO usarlos

Evítalos cuando:

- una union explícita basta;
- un tipo simple comunica mejor;
- existe un Utility Type estándar;
- intentas replicar lógica runtime;
- produces condiciones anidadas ilegibles.

# 26. Errores comunes

1. Pensar que `extends` ejecuta lógica runtime.
2. Olvidar distribución.
3. Confundir `string[] | number[]` con `(string | number)[]`.
4. Abusar de condicionales anidados.
5. Reinventar Utility Types.
6. Usar assertions como validación.
7. Confundir compile-time safety con runtime safety.

---

# PRÁCTICAS

## Práctica 1 — `IsNumber`

Implementa:

```ts
type IsNumber<T> =
  // tu código
```

Debe producir `true` para `number` y `false` para `string`.

### Pista

```ts
T extends number
  ? ...
  : ...
```

## Práctica 2 — Detectar hostname

Implementa:

```ts
type HasHostname<T> =
  // tu código
```

Prueba con un `Router` que tenga `hostname` y una `Person` que no.

Explica cómo participa structural typing.

## Práctica 3 — Filtrar union

```ts
type Value =
  string | number | boolean;
```

Implementa:

```ts
type OnlyNumbers<T> =
  // tu código
```

Resultado esperado:

```ts
number
```

## Práctica 4 — Excluir estado

```ts
type AuditStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";
```

Crea:

```ts
type ExcludeCancelled<T> =
  // tu código
```

No uses `Exclude` en la primera versión.

## Práctica 5 — Extraer elemento

Completa:

```ts
type ArrayElement<T> =
  T extends Array<infer U>
    ? // ...
    : // ...
```

Explica qué representa `U`.

## Práctica 6 — Promise

Completa:

```ts
type PromiseValue<T> =
  T extends Promise<infer U>
    ? // ...
    : // ...
```

Después compara conceptualmente con `Awaited<T>`.

---

# EJERCICIO PRINCIPAL — Bitácora de red

```ts
type AuditCreated = {
  type: "created";
  auditId: string;
};

type AuditAssigned = {
  type: "assigned";
  auditId: string;
  technicianId: string;
};

type AuditCompleted = {
  type: "completed";
  auditId: string;
  completedAt: Date;
};

type AuditEvent =
  | AuditCreated
  | AuditAssigned
  | AuditCompleted;
```

Implementa:

```ts
type EventsWithTechnician<T> =
  // tu código
```

Debe conservar únicamente el miembro con `technicianId: string`.

### Restricciones

No uses `any`, `Extract` ni assertions.

### Pistas

- opera directamente sobre `T`;
- comprueba estructura;
- conserva `T` si cumple;
- usa `never` si no;
- aprovecha distribución.

No se incluye solución completa.

---

# RETO 1 — React + TypeScript

Diseña `InputConfig<T>` para que `boolean` produzca checkbox, `number` control numérico y `string` control de texto.

Explica si ocurre runtime, qué pasa con unions y cómo validarías el valor real del formulario.

# RETO 2 — Node.js + REST

Diseña:

```ts
type ControllerResponse<T> =
  // tu código
```

Reglas:

```text
void → { status: 204 }
otro T → { status: 200; body: T }
```

Explica por qué esto no obliga a Express a comportarse correctamente.

# RETO 3 — SDK tipado

Dado un `ApiOperation` con propiedad `response`, diseña un Conditional Type que extraiga el tipo de `response` usando `infer`.

# RETO 4 — Analizador de configuraciones

Filtra `null` de:

```ts
type ConfigValue =
  string | number | boolean | null;
```

mediante `never`.

Explica por qué esto no valida un archivo real.

# RETO 5 — Runtime Validation

Un cliente envía:

```json
{
  "hostname": 100,
  "status": "destroyed"
}
```

Explica por qué ningún Conditional Type rechaza ese JSON por sí solo.

Describe:

```text
HTTP
→ Controller
→ Zod
→ Service
→ Repository
→ PostgreSQL
```

# RETO 6 — Testing

Diseña conceptualmente `SuccessData<T>` para extraer `data` solo de miembros que tengan esa propiedad.

Explica distribución, `infer`, `never` y qué test runtime seguirías necesitando.

---

# Relación explícita con tus proyectos

**Bitácora de red:** filtrar unions de eventos.  
**Repositorio de algoritmos:** profundizar el type system sin sustituir complejidad algorítmica.  
**Analizador:** clasificar tipos estáticos; parser runtime por separado.  
**SDK:** relacionar operaciones y responses.  
**API REST:** contratos internos sin sustituir Zod/DB.  
**Full Stack:** precisión estática con fronteras runtime separadas.

---

# Preguntas de comprensión

1. ¿Cuál es la sintaxis de un Conditional Type?
2. ¿Qué significa `extends`?
3. ¿Ejecuta JavaScript?
4. ¿Qué es distribución?
5. ¿Cómo filtra `never`?
6. ¿Cómo evitas distribución?
7. ¿Qué hace `infer`?
8. ¿Cómo extraerías un elemento de array?
9. ¿Qué hace `Exclude`?
10. ¿Qué hace `Extract`?
11. ¿Qué hace `NonNullable`?
12. ¿Cuándo crearías un Conditional Type?
13. ¿Cuándo preferirías un Utility Type?
14. ¿Validan HTTP?
15. ¿Qué papel tiene Zod?

---

# Relevancia para entrevistas

**What is a conditional type in TypeScript?**

> A conditional type selects one type or another based on whether a type is assignable to another type. Its basic syntax is `T extends U ? X : Y`.

**What is a distributive conditional type?**

> When the condition operates directly on a generic type parameter that receives a union, TypeScript distributes it over each union member.

**What is `infer`?**

> `infer` captures a type from a matched generic structure, such as an array element, function return type or Promise value.

**How can you prevent distribution?**

> Wrap both sides of the comparison in tuples, for example `[T] extends [U]`.

**Do Conditional Types validate runtime data?**

> No. They disappear during compilation. External values still require runtime validation.

---

# Resumen

Conditional Type:

```ts
T extends U ? X : Y
```

Con unions puede distribuirse.

`never` permite filtrar miembros.

`infer` permite extraer tipos internos.

Pero:

```text
Conditional Types
→ compile time
→ desaparecen

HTTP / formularios / APIs / archivos /
env / PostgreSQL
→ runtime
→ necesitan validación real
```

---

# Próxima lección

**Lección 19 — Template Literal Types.**
