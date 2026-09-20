# Lección 17 — Mapped Types en TypeScript

**Duración:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Ruta:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

## Introducción

En la Lección 16 estudiaste `Partial`, `Required`, `Readonly`, `Pick` y `Omit`. Ahora veremos la idea general que permite transformar sistemáticamente las propiedades de un tipo: **Mapped Types**.

La estructura fundamental es:

```ts
type Transform<T> = {
  [P in keyof T]: T[P];
};
```

La idea es:

```text
tipo original
↓
keyof T
↓
claves conocidas
↓
[P in keyof T]
↓
transformación de cada propiedad
↓
nuevo tipo
```

Esto conecta directamente con `keyof`, Indexed Access Types, Generics y Utility Types.

---

# 1. Objetivo

Al finalizar debes poder:

- explicar qué problema resuelven los Mapped Types;
- comprender `[P in keyof T]`;
- explicar qué representa `P`;
- usar `T[P]` para conservar el tipo original de cada propiedad;
- agregar y eliminar `?` y `readonly`;
- comprender cómo `Partial`, `Required` y `Readonly` se relacionan con mapped types;
- transformar tipos de propiedades;
- reconocer key remapping con `as`;
- aplicar mapped types a React, Node.js, Bitácora de red, SDKs y testing;
- distinguir claramente compile-time type transformation de runtime validation.

---

# 2. El problema que resuelven

Supón:

```ts
type Device = {
  hostname: string;
  ip: string;
  active: boolean;
};
```

Necesitas un tipo que indique si cada campo fue modificado:

```ts
type DeviceChanges = {
  hostname: boolean;
  ip: boolean;
  active: boolean;
};
```

Esto duplica las claves.

Si mañana agregas:

```ts
location: string;
```

también tendrías que actualizar `DeviceChanges`.

Queremos expresar:

> Para cada propiedad de `Device`, crea una propiedad con el mismo nombre y tipo `boolean`.

---

# 3. Primer Mapped Type

```ts
type Flags<T> = {
  [P in keyof T]: boolean;
};
```

Uso:

```ts
type DeviceFlags =
  Flags<Device>;
```

Resultado conceptual:

```ts
type DeviceFlags = {
  hostname: boolean;
  ip: boolean;
  active: boolean;
};
```

---

# 4. Descomponiendo `[P in keyof T]`

```ts
type Flags<T> = {
  [P in keyof T]: boolean;
};
```

Paso a paso:

```text
T
→ tipo recibido

keyof T
→ unión de claves

P in keyof T
→ recorrer esas claves en el sistema de tipos

[P in keyof T]
→ crear una propiedad por cada clave

boolean
→ tipo del valor de cada nueva propiedad
```

Si:

```ts
keyof Device
```

es:

```text
"hostname" | "ip" | "active"
```

entonces `P` representa cada una de esas claves durante la transformación.

---

# 5. `P` no es un loop JavaScript

`P` existe solo en el sistema de tipos.

No hay un `for` runtime.

Esto:

```ts
[P in keyof T]
```

es compile-time.

Después de compilar, desaparece.

---

# 6. Preservar el tipo original con `T[P]`

```ts
type Copy<T> = {
  [P in keyof T]: T[P];
};
```

Para:

```ts
type Device = {
  hostname: string;
  active: boolean;
};
```

obtenemos conceptualmente:

```ts
type DeviceCopy = {
  hostname: string;
  active: boolean;
};
```

`T[P]` es un Indexed Access Type.

---

# 7. Conexión con `T[K]`

En la lección anterior viste:

```ts
function obtenerPropiedad<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): T[K] {
  return objeto[clave];
}
```

Mapped Types usan la misma idea:

```ts
type Copy<T> = {
  [P in keyof T]: T[P];
};
```

Diferencia:

```text
generic function
→ relaciona valores y tipos

mapped type
→ transforma tipos
```

---

# 8. Nuestro propio `Partial`

```ts
type MyPartial<T> = {
  [P in keyof T]?: T[P];
};
```

El `?` convierte cada propiedad en opcional.

Para:

```ts
type Device = {
  hostname: string;
  ip: string;
};
```

obtenemos:

```ts
type PartialDevice = {
  hostname?: string;
  ip?: string;
};
```

En producción usa normalmente:

```ts
Partial<Device>
```

El objetivo aquí es comprender el mecanismo.

---

# 9. Nuestro propio `Readonly`

```ts
type MyReadonly<T> = {
  readonly [P in keyof T]: T[P];
};
```

Resultado conceptual:

```ts
type ProtectedDevice = {
  readonly hostname: string;
  readonly ip: string;
};
```

Nuevamente, en producción normalmente usarás `Readonly<T>`.

---

# 10. Eliminar `?` con `-?`

```ts
type Complete<T> = {
  [P in keyof T]-?: T[P];
};
```

Si:

```ts
type DraftConfig = {
  host?: string;
  port?: number;
};
```

entonces:

```ts
type ResolvedConfig =
  Complete<DraftConfig>;
```

produce propiedades obligatorias.

Esto conecta con `Required<T>`.

---

# 11. Eliminar `readonly`

```ts
type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};
```

Para:

```ts
type ReadonlyDevice = {
  readonly hostname: string;
  readonly ip: string;
};
```

produce:

```ts
type EditableDevice = {
  hostname: string;
  ip: string;
};
```

---

# 12. Modificadores disponibles

Mapped Types permiten:

```text
readonly
+readonly
-readonly

?
+?
-?
```

Los prefijos `-` eliminan modificadores existentes.

---

# 13. Transformar el tipo de todos los valores

```ts
type Nullable<T> = {
  [P in keyof T]:
    T[P] | null;
};
```

Para:

```ts
type Device = {
  hostname: string;
  active: boolean;
};
```

produce:

```ts
type NullableDevice = {
  hostname: string | null;
  active: boolean | null;
};
```

---

# 14. Caso útil: errores de formulario

```ts
type FormErrors<T> = {
  [P in keyof T]?: string;
};
```

Para:

```ts
type DeviceForm = {
  hostname: string;
  ip: string;
  location: string;
};
```

obtenemos:

```ts
type DeviceFormErrors = {
  hostname?: string;
  ip?: string;
  location?: string;
};
```

Esto es especialmente útil en React.

---

# 15. React + TypeScript

```ts
type AuditForm = {
  site: string;
  assignee: string;
  notes: string;
};

type FieldErrors<T> = {
  [P in keyof T]?: string;
};

type AuditFormErrors =
  FieldErrors<AuditForm>;
```

Podemos escribir:

```ts
const errors: AuditFormErrors = {
  site: "Site is required"
};
```

Pero esto falla:

```ts
const errors: AuditFormErrors = {
  inventedField: "Invalid"
};
```

---

# 16. Runtime validation sigue siendo necesaria

Aunque el tipo de errores esté bien definido, un formulario HTML produce valores reales.

```text
input.value
→ string runtime
```

TypeScript no garantiza que una IP sea válida ni que un campo cumpla reglas del negocio.

Más adelante:

```text
React form
↓
Zod
↓
datos válidos
```

cuando sea apropiado.

---

# 17. Bitácora de red: dirty fields

```ts
type Audit = {
  site: string;
  assignee: string;
  status:
    | "pending"
    | "in_progress"
    | "completed";
};

type DirtyFields<T> = {
  [P in keyof T]: boolean;
};

type AuditDirtyFields =
  DirtyFields<Audit>;
```

Resultado:

```ts
type AuditDirtyFields = {
  site: boolean;
  assignee: boolean;
  status: boolean;
};
```

---

# 18. Analizador de configuraciones

```ts
type InterfaceConfig = {
  description: string;
  vlan: number;
  enabled: boolean;
};

type ConfigSource<T> = {
  [P in keyof T]:
    | "default"
    | "file"
    | "environment";
};
```

Esto genera un campo de origen por cada propiedad.

---

# 19. SDK tipado

```ts
type Device = {
  hostname: string;
  status:
    | "online"
    | "offline";
  location: string;
};

type Filter<T> = {
  [P in keyof T]?:
    T[P];
};

type DeviceFilter =
  Filter<Device>;
```

Esto describe filtros posibles en compile time.

No valida query parameters reales recibidos por HTTP.

---

# 20. Key Remapping con `as`

Mapped Types también pueden cambiar nombres de claves.

```ts
type Getters<T> = {
  [P in keyof T as
    `get${Capitalize<string & P>}`]:
      () => T[P];
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
type DeviceGetters = {
  getHostname: () => string;
  getActive: () => boolean;
};
```

No necesitas memorizar esta sintaxis todavía. Debes reconocer que los mapped types también pueden transformar nombres de claves.

---

# 21. Filtrar claves con `never`

```ts
type RemoveId<T> = {
  [P in keyof T as
    P extends "id"
      ? never
      : P
  ]: T[P];
};
```

Para:

```ts
type Device = {
  id: string;
  hostname: string;
  ip: string;
};
```

produce:

```ts
type DeviceWithoutId = {
  hostname: string;
  ip: string;
};
```

En producción normalmente usarías:

```ts
Omit<Device, "id">
```

---

# 22. ¿Por qué existen los Utility Types?

Ahora puedes ver que `Partial`, `Required`, `Readonly`, `Pick` y `Omit` son abstracciones construidas a partir de capacidades más generales del sistema de tipos, incluyendo mapped types, `keyof` y otras herramientas avanzadas.

La idea importante no es memorizar implementaciones internas, sino entender la familia de transformaciones.

---

# 23. Cuándo crear un Mapped Type propio

Tiene sentido cuando existe una transformación reusable del dominio.

Ejemplo:

```ts
type ValidationErrors<T> = {
  [P in keyof T]?:
    string[];
};
```

Otro:

```ts
type ChangeTracker<T> = {
  [P in keyof T]: {
    previous: T[P];
    current: T[P];
  };
};
```

---

# 24. Ejemplo profesional: Change Tracker

```ts
type Device = {
  hostname: string;
  active: boolean;
};

type ChangeTracker<T> = {
  [P in keyof T]: {
    previous: T[P];
    current: T[P];
  };
};

type DeviceChanges =
  ChangeTracker<Device>;
```

Resultado:

```ts
type DeviceChanges = {
  hostname: {
    previous: string;
    current: string;
  };

  active: {
    previous: boolean;
    current: boolean;
  };
};
```

Esto puede servir en Bitácora de red para registrar cambios antes de persistirlos.

---

# 25. Cuándo NO usar Mapped Types

Evítalos si:

- un tipo explícito pequeño comunica mejor;
- no existe una relación real con el tipo base;
- la abstracción es difícil de leer;
- un Utility Type estándar resuelve el problema;
- estás intentando forzar que frontend, backend y SQL compartan exactamente el mismo modelo;
- en realidad necesitas validación runtime.

---

# 26. Mapped Type vs DTO explícito

```ts
type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};
```

Podrías crear:

```ts
type PublicUser =
  Omit<User, "passwordHash">;
```

Pero una respuesta HTTP quizá requiera:

```ts
type UserResponse = {
  id: string;
  email: string;
  createdAt: string;
};
```

Aquí:

```text
Date del dominio
≠
string JSON
```

Un DTO explícito puede ser mejor.

---

# 27. Node.js + TypeScript

```ts
type DevicePatch = {
  hostname: string;
  ip: string;
  status:
    | "online"
    | "offline";
};

type PatchFields<T> = {
  [P in keyof T]?:
    T[P];
};

type UpdateDeviceInput =
  PatchFields<DevicePatch>;
```

Pero esto sería incorrecto:

```ts
const input =
  req.body as UpdateDeviceInput;
```

Una assertion no valida datos.

---

# 28. Runtime Validation con Zod

La frontera profesional será:

```text
req.body
↓
dato no confiable
↓
Zod
↓
parse / safeParse
↓
dato validado
↓
Service
```

Los mapped types pertenecen al compile time.

Zod pertenece al runtime.

---

# 29. PostgreSQL

Mapped Types no sustituyen:

```sql
NOT NULL
UNIQUE
CHECK
FOREIGN KEY
```

TypeScript protege el desarrollo.

PostgreSQL protege integridad persistida.

---

# 30. Arquitectura Full Stack

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

## React

Mapped Types ayudan con errores, dirty fields, estados de formulario y estructuras derivadas.

## HTTP

Transporta datos reales, no tipos.

## Node

Ejecuta JavaScript; los mapped types desaparecieron.

## Router

Selecciona el handler.

## Controller

Adapta HTTP.

## Runtime Validation

Valida inputs reales.

## Service

Aplica reglas de negocio.

## Repository

Aísla persistencia.

## PostgreSQL

Aplica constraints y transacciones.

## Testing

Comprueba comportamiento runtime.

## Docker

Empaqueta aplicación y dependencias.

## CI/CD

Automatiza calidad, tests, build y deploy.

## Cloud

Ejecuta el sistema desplegado.

---

# 31. Errores comunes

## Error 1

Pensar que:

```ts
[P in keyof T]
```

es un loop JavaScript.

No lo es.

## Error 2

Confundir:

```ts
T[P]
```

con acceso runtime.

Es un Indexed Access Type.

## Error 3

Reinventar `Partial<T>` o `Readonly<T>` en producción sin necesidad.

## Error 4

Crear mapped types tan complejos que ocultan el dominio.

## Error 5

Pensar que mapped types validan HTTP.

## Error 6

Forzar DTO, dominio y persistencia a compartir siempre exactamente el mismo modelo.

## Error 7

Usar:

```ts
req.body as UpdateDeviceInput
```

como falsa validación.

---

# PRÁCTICAS

## Práctica 1 — Primer Mapped Type

Parte de:

```ts
type Device = {
  hostname: string;
  ip: string;
  active: boolean;
};
```

Crea:

```ts
type BooleanFlags<T> = {
  // tu código
};
```

Resultado esperado:

```ts
type DeviceFlags = {
  hostname: boolean;
  ip: boolean;
  active: boolean;
};
```

### Pistas

Necesitas:

```text
keyof T
[P in ...]
```

No uses `any`.

No escribas las propiedades manualmente.

---

## Práctica 2 — Preservar tipos

Implementa:

```ts
type Clone<T> = {
  // tu código
};
```

Para:

```ts
type Audit = {
  site: string;
  attempts: number;
  completed: boolean;
};
```

debe conservar exactamente:

```text
site → string
attempts → number
completed → boolean
```

### Pista

Necesitas:

```ts
T[P]
```

---

## Práctica 3 — Tu propio `Partial`

Implementa:

```ts
type MyPartial<T> = {
  // tu código
};
```

Prueba:

```ts
type Device = {
  hostname: string;
  ip: string;
};

const changes:
  MyPartial<Device> = {
    hostname: "router-core-02"
  };
```

### Pregunta

¿Qué símbolo convierte una propiedad mapeada en opcional?

Compara tu resultado con:

```ts
Partial<Device>
```

---

## Práctica 4 — Tu propio `Readonly`

Implementa:

```ts
type MyReadonly<T> = {
  // tu código
};
```

Después:

```ts
type Config = {
  apiUrl: string;
  timeout: number;
};

const config:
  MyReadonly<Config> = {
    apiUrl: "https://api.example.com",
    timeout: 5000
  };
```

Intenta:

```ts
config.timeout = 10000;
```

Explica:

1. por qué falla compile time;
2. por qué no equivale a `Object.freeze`;
3. qué ocurre al compilar.

---

## Práctica 5 — Eliminar opcionalidad

```ts
type DraftConfig = {
  host?: string;
  port?: number;
  logging?: boolean;
};
```

Implementa:

```ts
type Complete<T> = {
  // tu código
};
```

Debe eliminar `?`.

### Pista

Usa:

```text
-?
```

---

## Práctica 6 — Nullable

Implementa:

```ts
type Nullable<T> = {
  // tu código
};
```

Para:

```ts
type Device = {
  hostname: string;
  active: boolean;
};
```

resultado esperado:

```ts
type NullableDevice = {
  hostname: string | null;
  active: boolean | null;
};
```

Explica por qué `T[P] | null` conserva el tipo original.

---

# EJERCICIO PRINCIPAL — Bitácora de red

Parte de:

```ts
type Audit = {
  site: string;
  assignee: string;
  status:
    | "pending"
    | "in_progress"
    | "completed";
  notes: string;
};
```

Construye:

```ts
type DirtyFields<T> = {
  // tu código
};
```

Cada campo debe convertirse a `boolean`.

Después:

```ts
type FieldErrors<T> = {
  // tu código
};
```

Cada propiedad debe:

- conservar su nombre;
- ser opcional;
- contener `string[]`.

Debes poder representar:

```ts
const dirty:
  DirtyFields<Audit> = {
    site: false,
    assignee: true,
    status: true,
    notes: false
  };
```

y:

```ts
const errors:
  FieldErrors<Audit> = {
    assignee: [
      "Assignee is required"
    ]
  };
```

### Restricciones

No uses `any`, `unknown` ni assertions.

No escribas manualmente las claves.

### Pistas

Para `DirtyFields`:

```text
[P in keyof T]
```

Para `FieldErrors` agrega:

```text
?
```

No se incluye la solución completa.

---

# RETO 1 — React + TypeScript

```ts
type DeviceForm = {
  hostname: string;
  ip: string;
  location: string;
};
```

Diseña:

```ts
type FormState<T> = ...
```

para que cada propiedad contenga:

```ts
{
  value: T[P];
  touched: boolean;
  error?: string;
}
```

Responde:

1. ¿por qué usar `T[P]`?
2. ¿qué se perdería usando `string` para todos?
3. ¿qué pasaría con un campo boolean?
4. ¿esto valida `input.value`?
5. ¿qué hará runtime validation?

No construyas JSX todavía.

---

# RETO 2 — Node.js + API REST

```ts
type DevicePatchFields = {
  hostname: string;
  ip: string;
  status:
    | "online"
    | "offline";
};
```

Diseña:

```ts
type PatchInput<T> = ...
```

que haga opcionales todos los campos preservando tipos.

Compara con:

```ts
Partial<DevicePatchFields>
```

Responde:

1. ¿cuál usarías en producción?
2. ¿por qué?
3. ¿qué valor educativo tiene crear `PatchInput`?
4. ¿impide que Postman envíe `"status": "broken"`?
5. ¿qué capa valida?
6. ¿qué recibe el Service?

---

# RETO 3 — Analizador de configuraciones

```ts
type NetworkConfig = {
  hostname: string;
  managementVlan: number;
  sshEnabled: boolean;
};
```

Construye:

```ts
type ChangeTracker<T> = ...
```

para que cada campo tenga:

```ts
{
  previous: T[P];
  current: T[P];
}
```

El objetivo es preservar automáticamente `string`, `number` o `boolean` según la propiedad.

---

# RETO 4 — SDK tipado

```ts
type ApiDevice = {
  hostname: string;
  status:
    | "online"
    | "offline";
  location: string;
};
```

Diseña:

```ts
type QueryFilter<T> = ...
```

que permita opcionalmente un valor del mismo tipo para cada propiedad.

Responde:

1. ¿en qué se parece a `Partial<T>`?
2. ¿siempre debe permitirse filtrar por todas las propiedades?
3. ¿qué harías si `id` no debe ser filtrable?
4. ¿usarías `Pick` antes?
5. ¿qué debe validar el servidor?

---

# RETO 5 — PostgreSQL + Arquitectura

Analiza:

```text
React form
↓
HTTP POST
↓
Node
↓
Router
↓
Controller
↓
Zod
↓
Service
↓
Repository
↓
PostgreSQL
```

Responde:

1. ¿puede un mapped type impedir JSON mal formado?
2. ¿qué hace Zod?
3. ¿qué reglas pertenecen al Service?
4. ¿qué hace el Repository?
5. ¿qué constraints puede tener PostgreSQL?
6. ¿por qué necesitamos TypeScript y runtime validation?
7. ¿por qué PostgreSQL sigue necesitando constraints?

---

# RETO 6 — Testing

```ts
type TestOverrides<T> = {
  [P in keyof T]?:
    T[P];
};
```

Con:

```ts
type Device = {
  id: string;
  hostname: string;
  active: boolean;
};
```

diseña conceptualmente:

```ts
function buildDevice(
  overrides:
    TestOverrides<Device> = {}
): Device
```

Responde:

1. ¿qué relación tiene con `Partial<T>`?
2. ¿por qué el parámetro puede ser parcial?
3. ¿por qué el retorno debe ser completo?
4. ¿qué defaults necesita?
5. ¿qué comprobaría Vitest?
6. ¿un tipo sustituye un test?

---

# Relación explícita con tus proyectos

## Bitácora de red

Mapped Types pueden derivar:

```text
dirty fields
errores de formulario
historial de cambios
estado de campos
```

sin duplicar propiedades.

## Repositorio de algoritmos

No son la técnica principal para algoritmos, pero fortalecen TypeScript avanzado y pueden aparecer en entrevistas.

## Analizador de configuraciones

Permiten mapear cada propiedad a su valor anterior, nuevo valor, origen o errores.

## SDK tipado

Permiten construir filtros y helpers manteniendo relaciones con contratos del SDK.

## API REST Node.js + PostgreSQL

Sirven para contratos internos, pero no sustituyen Zod, Service ni constraints SQL.

## Aplicación Full Stack

Permiten derivar estructuras UI sin obligar a que frontend, dominio, HTTP y PostgreSQL compartan exactamente el mismo modelo.

---

# TypeScript Type Checking vs Runtime Validation

Un mapped type como:

```ts
type DeviceErrors = {
  [P in keyof Device]?:
    string[];
};
```

solo existe en compile time.

Un cliente externo puede enviar:

```json
{
  "hostname": 123,
  "status": "destroyed"
}
```

Por eso:

```text
TypeScript
→ confianza durante desarrollo

Zod
→ validación runtime

Service
→ reglas de negocio

Repository
→ acceso a persistencia

PostgreSQL
→ integridad persistente
```

---

# Preguntas de comprensión

1. ¿Qué problema resuelve un Mapped Type?
2. ¿Qué significa `[P in keyof T]`?
3. ¿Qué representa `P`?
4. ¿Existe `P` en runtime?
5. ¿Qué hace `T[P]`?
6. ¿Cómo se relaciona con Indexed Access Types?
7. ¿Cómo implementarías conceptualmente `Partial<T>`?
8. ¿Qué significa `?` en una propiedad mapeada?
9. ¿Qué hace `-?`?
10. ¿Qué hace `readonly`?
11. ¿Qué hace `-readonly`?
12. ¿Cómo transformarías todas las propiedades a `boolean`?
13. ¿Cómo preservarías el tipo original?
14. ¿Qué es key remapping?
15. ¿Qué papel cumple `as`?
16. ¿Cómo puede `never` eliminar una clave?
17. ¿Cuándo crearías un mapped type propio?
18. ¿Cuándo usarías un Utility Type estándar?
19. ¿Por qué no conviene sobreabstraer?
20. ¿Cómo aplicarías mapped types en React?
21. ¿Cómo los aplicarías a Bitácora de red?
22. ¿Cómo los aplicarías al analizador?
23. ¿Mapped Types validan HTTP?
24. ¿Qué responsabilidad tendrá Zod?
25. ¿Qué responsabilidad tiene PostgreSQL?
26. ¿Por qué un DTO HTTP puede diferir del dominio?
27. ¿Qué ocurre con los tipos al compilar?
28. ¿Qué diferencia hay entre compile-time safety y runtime safety?
29. ¿Cómo explicarías Mapped Types en una entrevista?

---

# Relevancia para entrevistas

## What is a mapped type in TypeScript?

> A mapped type creates a new type by iterating over a set of property keys, commonly `keyof T`, and transforming each property in a consistent way.

## What does `[P in keyof T]` mean?

> It means that `P` iterates over every known key of `T` in the type system, allowing a new property to be generated for each key.

## Why is `T[P]` important?

> `T[P]` retrieves the original type associated with property `P`, so the mapped type can preserve or transform each property's type precisely.

## How is `Partial<T>` related to mapped types?

> Conceptually, `Partial<T>` maps over each property of `T`, preserves the property type and makes it optional.

## Do mapped types exist at runtime?

> No. They are erased during compilation and cannot validate HTTP payloads, files, environment variables or database results.

## When would you create a custom mapped type?

> I would create one when the domain has a reusable type-level transformation, such as field-level errors or change tracking. I prefer built-in utility types when they already express the requirement clearly.

---

# Cómo explicarlo con tu portafolio

Sobre Bitácora de red:

> In my network audit application, mapped types can derive structures such as field-level validation errors or change tracking directly from audit models, reducing duplicated property names while preserving type safety.

Sobre el analizador:

> In my network configuration analyzer, I can map every configuration property to previous and current values. Using `T[P]` preserves whether each field is a string, number or boolean.

Sobre Full Stack:

> I use mapped types for compile-time transformations, but runtime trust remains separate. HTTP data is validated before entering the service layer, and PostgreSQL still enforces persistent constraints.

---

# Checklist de code review

```text
1. ¿Existe una transformación real y reusable?
2. ¿Podría usar un Utility Type estándar?
3. ¿[P in keyof T] representa correctamente las claves?
4. ¿Necesito preservar T[P]?
5. ¿Estoy manejando ? / readonly correctamente?
6. ¿El resultado sigue siendo legible?
7. ¿Estoy acoplando DTO, dominio y persistencia?
8. ¿Estoy intentando resolver runtime validation con tipos?
9. ¿Los datos externos pasan por Zod?
10. ¿PostgreSQL conserva sus propias garantías?
```

---

# Resumen

Los Mapped Types transforman sistemáticamente propiedades:

```ts
type Transform<T> = {
  [P in keyof T]:
    T[P];
};
```

Piezas:

```text
keyof T
→ claves conocidas

P in keyof T
→ recorrer claves en compile time

T[P]
→ tipo de la propiedad actual
```

Podemos agregar opcionalidad:

```ts
type Optional<T> = {
  [P in keyof T]?:
    T[P];
};
```

eliminarla:

```ts
type RequiredAgain<T> = {
  [P in keyof T]-?:
    T[P];
};
```

hacer readonly:

```ts
type Immutable<T> = {
  readonly [P in keyof T]:
    T[P];
};
```

o transformar valores:

```ts
type Flags<T> = {
  [P in keyof T]:
    boolean;
};
```

Mapped Types explican parte del poder detrás de los Utility Types y son útiles en React, Node.js, SDKs y herramientas de dominio.

Pero:

```text
Mapped Types
→ compile time

HTTP
formularios
APIs externas
archivos
variables de entorno
PostgreSQL
→ runtime
```

Por eso seguimos usando:

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

---

# Próxima lección

**Lección 18 — Conditional Types.**
