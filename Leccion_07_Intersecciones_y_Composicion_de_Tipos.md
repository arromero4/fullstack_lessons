# Lección 7 — Intersecciones (`&`) y composición de tipos en TypeScript

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Al terminar esta lección debes poder:

- entender qué problema resuelven las intersecciones;
- usar el operador `&` para combinar tipos;
- diferenciar una unión `|` de una intersección `&`;
- comprender cuándo una intersección produce un tipo útil;
- detectar conflictos entre propiedades incompatibles;
- decidir cuándo usar composición en lugar de crear tipos gigantes;
- conectar intersecciones con React, Node.js, servicios, repositories y modelos de dominio;
- recordar que una intersección de TypeScript no combina ni valida objetos en runtime.

---

## 2. El problema: duplicación de propiedades

```ts
type Identificable = {
  id: number;
};

type ConHostname = {
  hostname: string;
};
```

Podemos componer ambos contratos:

```ts
type Dispositivo =
  Identificable & ConHostname;
```

Esto significa:

```text
Identificable
AND
ConHostname
```

Por tanto:

```ts
const router: Dispositivo = {
  id: 1,
  hostname: "router-core-01"
};
```

debe cumplir ambos tipos.

---

## 3. Diferencia entre unión e intersección

Una unión:

```ts
type Id = string | number;
```

significa:

```text
string
OR
number
```

Una intersección:

```ts
type Dispositivo =
  Identificable & ConHostname;
```

significa:

```text
Identificable
AND
ConHostname
```

---

## 4. Aplicación a Bitácora de red

```ts
type Identidad = {
  readonly id: number;
};

type DatosRed = {
  hostname: string;
  ip: string;
};

type EstadoOperativo = {
  activo: boolean;
};

type Dispositivo =
  Identidad &
  DatosRed &
  EstadoOperativo;
```

Ejemplo:

```ts
const router: Dispositivo = {
  id: 1,
  hostname: "router-core-01",
  ip: "192.168.1.1",
  activo: true
};
```

---

## 5. Composición reutilizable

```ts
type EntidadBase = {
  readonly id: number;
  fechaCreacion: string;
  fechaActualizacion: string;
};

type Dispositivo =
  EntidadBase & {
    hostname: string;
    ip: string;
  };
```

La composición ayuda cuando las partes representan conceptos reales y reutilizables.

---

## 6. Cuándo NO usar composición

Evita fragmentar tipos sin una razón clara:

```ts
type Parte1 = {
  hostname: string;
};

type Parte2 = {
  ip: string;
};

type Parte3 = {
  activo: boolean;
};
```

Si esas partes no tienen significado propio, la abstracción no ayuda.

---

## 7. Conflictos de propiedades

```ts
type A = {
  id: number;
};

type B = {
  id: string;
};

type C = A & B;
```

`id` tendría que ser simultáneamente `number` y `string`.

Eso es incompatible y puede reducirse a `never`.

No deberías ocultar este problema con `as`; debes corregir el modelo.

---

## 8. `&` frente a `extends`

Con `interface`:

```ts
interface Dispositivo {
  id: number;
}

interface DispositivoRed extends Dispositivo {
  ip: string;
}
```

Con `type`:

```ts
type Dispositivo = {
  id: number;
};

type DispositivoRed =
  Dispositivo & {
    ip: string;
  };
```

Ambos permiten reutilización.

---

## 9. Relación con React

```ts
type BaseCardProps = {
  destacado?: boolean;
};

type Dispositivo = {
  id: number;
  hostname: string;
};

type DispositivoCardProps =
  BaseCardProps & {
    dispositivo: Dispositivo;
  };
```

Esto permite componer props sin duplicarlas.

---

## 10. Relación con Node.js

```ts
type CrearDispositivoInput = {
  hostname: string;
  ip: string;
};

type MetadatosCreacion = {
  creadoPor: number;
  fechaCreacion: string;
};

type CrearDispositivoCommand =
  CrearDispositivoInput &
  MetadatosCreacion;
```

El Service puede recibir información enriquecida por el backend.

---

## 11. Arquitectura: Input + contexto autenticado

```ts
type CrearDispositivoInput = {
  hostname: string;
  ip: string;
};

type ContextoUsuario = {
  usuarioId: number;
};

type CrearDispositivoCommand =
  CrearDispositivoInput &
  ContextoUsuario;
```

Flujo:

```text
React
 ↓
HTTP
 ↓
Router
 ↓
Controller
 ↓
Runtime Validation
 ↓
CrearDispositivoInput
       +
Contexto autenticado
       ↓
CrearDispositivoCommand
       ↓
Service
       ↓
Repository
       ↓
PostgreSQL
```

---

## 12. `&` NO combina objetos en runtime

```ts
type C = A & B;
```

solo compone tipos.

Para combinar valores reales:

```ts
const combinado = {
  ...objetoA,
  ...objetoB
};
```

Entonces:

```text
A & B
↓
compile time
```

mientras:

```text
{ ...a, ...b }
↓
runtime
```

---

## 13. Runtime validation sigue siendo necesaria

Una intersección no valida datos HTTP.

Aunque esperemos:

```ts
type CrearDispositivoInput = {
  hostname: string;
  ip: string;
};
```

el cliente todavía puede enviar tipos incorrectos.

Por eso:

```text
HTTP
 ↓
datos no confiables
 ↓
Runtime Validation
 ↓
datos confiables
```

---

## 14. Ejercicio

Crea:

```text
07-intersections.ts
```

Define:

```ts
type Identidad = {
  readonly id: number;
};

type DatosRed = {
  hostname: string;
  ip: string;
};

type EstadoOperativo = {
  activo: boolean;
};
```

Después:

```ts
type Dispositivo =
  Identidad &
  DatosRed &
  EstadoOperativo;
```

Crea un `router` correctamente tipado.

Después crea:

```ts
function imprimirDispositivo(
  dispositivo: Dispositivo
): void
```

Debe imprimir:

```text
#1 | router-core-01 | 10.0.0.1 | activo=true
```

No uses `any` ni `as`.

---

## 15. Reto — Command del Service

Define:

```ts
type CrearDispositivoInput = {
  hostname: string;
  ip: string;
};

type ContextoUsuario = {
  usuarioId: number;
};

type CrearDispositivoCommand =
  CrearDispositivoInput &
  ContextoUsuario;
```

Crea:

```ts
function procesarCreacion(
  command: CrearDispositivoCommand
): void
```

Debe imprimir algo parecido a:

```text
Usuario 15 crea router-core-01 (10.0.0.1)
```

---

## 16. Reto adicional — Detectar un conflicto

```ts
type RegistroDb = {
  id: number;
};

type RegistroApi = {
  id: string;
};

type Registro =
  RegistroDb & RegistroApi;
```

Intenta crear un valor `Registro`.

Explica por qué `id` no puede cumplir ambos contratos.

No uses `as`.

---

## 17. Preguntas de comprensión

1. ¿Qué significa `A & B`?
2. ¿Qué diferencia existe entre `A | B` y `A & B`?
3. Si `A` requiere `id` y `B` requiere `hostname`, ¿qué debe tener `A & B`?
4. ¿Qué ocurre si dos tipos intersectados definen una propiedad incompatible?
5. ¿`A & B` combina objetos JavaScript durante runtime?
6. ¿Qué diferencia existe entre una intersección y `{ ...a, ...b }`?
7. ¿Una intersección valida un body HTTP?
8. ¿Por qué puede ser útil combinar un input validado con contexto autenticado?

---

## 18. Entrevista técnica

> What is an intersection type in TypeScript?

Respuesta conceptual:

> An intersection type combines multiple type requirements. A value of `A & B` must satisfy both `A` and `B`.

> What is the difference between a union and an intersection?

> A union represents alternatives, while an intersection combines requirements.

> Does `A & B` merge JavaScript objects at runtime?

> No. It only composes types at compile time. Runtime merging requires actual JavaScript logic such as object spread.

---

## 19. Resumen

```ts
type C = A & B;
```

significa:

```text
C cumple A
Y
C cumple B
```

Mientras:

```ts
A | B
```

significa:

```text
A
O
B
```

En backend:

```text
Input validado
       +
Contexto autenticado
       ↓
Command del Service
```

Regla crítica:

```text
TypeScript &
!=
JavaScript object spread
!=
runtime validation
```

---

## Próxima lección

**Lección 8 — Narrowing y Type Guards con `typeof`, `in` e `instanceof`.**
