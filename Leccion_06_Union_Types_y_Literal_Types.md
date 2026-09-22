# Lección 6 — Union Types y Literal Types

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Debes comprender:

- qué es una union type;
- cómo funciona `|`;
- qué son los literal types;
- por qué son mejores que `string` en ciertos contratos;
- cómo modelar estados;
- por qué las uniones requieren narrowing;
- cómo usar estos conceptos en React, Node.js y APIs;
- por qué una unión sigue sin validar runtime.

---

## 2. El problema de tipos demasiado amplios

Esto:

```ts
interface Dispositivo {
  hostname: string;
  estado: string;
}
```

permite:

```ts
estado: "banana"
```

aunque el dominio solo permita ciertos valores.

---

## 3. Literal types

```ts
type EstadoOnline = "online";
```

Solo permite:

```ts
"online"
```

---

## 4. Union literals

```ts
type EstadoDispositivo =
  | "online"
  | "offline"
  | "maintenance";
```

Ahora:

```ts
let estado: EstadoDispositivo = "online";
```

es válido, pero:

```ts
estado = "banana";
```

no.

---

## 5. Uniones con tipos diferentes

```ts
let identificador: string | number;
```

Puede contener:

```ts
identificador = 10;
identificador = "USR-100";
```

pero no:

```ts
identificador = true;
```

---

## 6. Narrowing básico

Esto no es válido:

```ts
function normalizarId(
  id: string | number
): string {
  return id.toUpperCase();
}
```

porque `id` podría ser `number`.

Solución:

```ts
function normalizarId(
  id: string | number
): string {
  if (typeof id === "string") {
    return id.toUpperCase();
  }

  return id.toString();
}
```

---

## 7. Literal numbers

```ts
type NivelPrioridad = 1 | 2 | 3;
```

---

## 8. Estados de dominio

```ts
type EstadoAuditoria =
  | "pending"
  | "running"
  | "completed"
  | "failed";
```

---

## 9. Estados de React

```ts
type EstadoCarga =
  | "idle"
  | "loading"
  | "success"
  | "error";
```

Más adelante:

```ts
const [status, setStatus] =
  useState<EstadoCarga>("idle");
```

---

## 10. Backend

```ts
type EstadoUsuario =
  | "active"
  | "suspended"
  | "deleted";
```

---

## 11. APIs

```ts
type ApiStatus =
  | "success"
  | "error";
```

Esto mejora el contrato, pero no valida JSON real.

---

## 12. Runtime validation

Una API aún puede enviar:

```json
{
  "estado": "broken-ish"
}
```

Por eso:

```text
TypeScript union
 ↓
compile time
```

```text
Zod schema
 ↓
runtime
```

---

## 13. Union con `null`

Ejemplo futuro:

```ts
function buscarUsuario(
  id: number
): Usuario | null {
  // ...
}
```

---

## 14. No abuses de uniones enormes

Evita:

```ts
type Valor =
  | string
  | number
  | boolean
  | null
  | undefined;
```

si no representa un concepto real del dominio.

---

## 15. Autocompletado y contratos

```ts
type MetodoHttp =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE";
```

Esto mejora autocompletado y restringe valores válidos.

---

## 16. Estados imposibles

Una estructura como:

```ts
interface Peticion {
  cargando: boolean;
  error: string | null;
  datos: string[] | null;
}
```

puede representar combinaciones inconsistentes.

Más adelante resolveremos esto mejor con **discriminated unions**.

---

## 17. Ejercicio

Archivo:

```text
06-unions-literals.ts
```

Define:

```ts
type EstadoDispositivo =
  | "online"
  | "offline"
  | "maintenance";
```

Después:

```ts
interface Dispositivo {
  readonly id: number;
  hostname: string;
  estado: EstadoDispositivo;
}
```

Crea tres dispositivos, uno con cada estado.

---

## 18. Reto

Define:

```ts
type EstadoAuditoria =
  | "pending"
  | "running"
  | "completed"
  | "failed";
```

Después:

```ts
interface Auditoria {
  readonly id: number;
  estado: EstadoAuditoria;
  mensaje?: string;
}
```

Crea:

```ts
function actualizarEstado(
  auditoria: Auditoria,
  nuevoEstado: EstadoAuditoria
): void
```

---

## 19. Reto adicional de narrowing

```ts
function formatearId(
  id: string | number
): string
```

Reglas:

- si es `string`, devolver en mayúsculas;
- si es `number`, convertir a string.

---

## 20. Entrevista técnica

Pregunta:

> What is a union type in TypeScript?

Respuesta conceptual:

> A union type represents a value that can be one of several possible types. TypeScript requires narrowing before using operations that are only valid for one member of the union.

Pregunta:

> Why use string literal unions instead of `string`?

Respuesta conceptual:

> They model a finite set of valid domain values, improve autocomplete and prevent invalid states at compile time.

---

## 21. Resumen

```text
Union
 ↓
varias posibilidades
```

```text
Literal type
 ↓
valor específico
```

```text
Narrowing
 ↓
reducir una unión a un tipo concreto
```

```text
TypeScript union
!=
runtime validation
```

**Próxima lección:** Intersecciones (`&`) y composición de tipos.

---

# Roadmap general

1. TypeScript profundo.
2. React profesional con TypeScript.
3. Node.js profesional con TypeScript.
4. PostgreSQL y SQL.
5. Validación de datos en runtime.
6. Testing.
7. Docker.
8. CI/CD.
9. Cloud.
10. Algoritmos e entrevistas técnicas usando TypeScript.
11. Proyecto Full Stack completo.
12. C#/.NET como segunda especialización.

---

# Arquitectura objetivo

```text
React + TypeScript
        ↓
       HTTP
        ↓
Node.js + TypeScript
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
```

Después:

```text
        Testing
           +
        Docker
           +
         CI/CD
           +
         Cloud
```

---

# Principio fundamental de toda la ruta

```text
TypeScript type checking
!=
Runtime validation
```

Los tipos de TypeScript desaparecen durante la compilación.

Datos provenientes de:

- HTTP
- formularios
- APIs externas
- archivos
- variables de entorno
- bases de datos

deben ser tratados como datos potencialmente no confiables hasta haberlos validado en runtime.

Más adelante incorporaremos **Zod** para cubrir esa responsabilidad.
