# Lección 5 — Propiedades opcionales y `readonly`

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Debes comprender:

- qué significa una propiedad opcional;
- cómo funciona `?`;
- por qué una propiedad opcional puede ser `undefined`;
- cuándo una propiedad debe ser opcional;
- qué problema resuelve `readonly`;
- la diferencia entre `const` y `readonly`;
- cómo modelar input vs entidad almacenada;
- por qué estas características tampoco validan runtime.

---

## 2. Propiedades opcionales

```ts
interface Dispositivo {
  id: number;
  hostname: string;
  ip: string;
  descripcion?: string;
}
```

Esto permite crear un objeto sin `descripcion`.

---

## 3. Tipo al leer una propiedad opcional

```ts
descripcion?: string;
```

implica conceptualmente:

```ts
string | undefined
```

Por eso esto puede fallar:

```ts
dispositivo.descripcion.toUpperCase();
```

---

## 4. Comprobación básica

```ts
if (dispositivo.descripcion !== undefined) {
  console.log(
    dispositivo.descripcion.toUpperCase()
  );
}
```

Esto introduce la idea de **narrowing**.

---

## 5. Valor por defecto

```ts
console.log(
  dispositivo.descripcion ?? "Sin descripción"
);
```

---

## 6. No conviertas todo en opcional

Mal:

```ts
interface Usuario {
  id?: number;
  nombre?: string;
  email?: string;
  activo?: boolean;
}
```

si todos esos campos son realmente obligatorios.

La opcionalidad debe representar el dominio real.

---

## 7. Input vs entidad persistida

Input:

```ts
interface CrearDispositivo {
  hostname: string;
  ip: string;
  descripcion?: string;
}
```

Entidad completa:

```ts
interface Dispositivo {
  id: number;
  hostname: string;
  ip: string;
  descripcion?: string;
  fechaCreacion: string;
}
```

---

## 8. `readonly`

```ts
interface Dispositivo {
  readonly id: number;
  hostname: string;
}
```

Esto evita:

```ts
router.id = 2;
```

pero permite:

```ts
router.hostname = "router-core-01";
```

---

## 9. `const` vs `readonly`

```text
const
 ↓
no reasignes la variable
```

```text
readonly
 ↓
no reasignes esta propiedad
```

---

## 10. `readonly` es shallow

```ts
interface Dispositivo {
  readonly configuracion: {
    puerto: number;
  };
}
```

Esto puede impedir reemplazar `configuracion`, pero no necesariamente cambiar:

```ts
dispositivo.configuracion.puerto
```

---

## 11. PostgreSQL

Un `id` generado por base de datos puede modelarse como:

```ts
readonly id: number;
```

Pero `readonly` no modifica PostgreSQL ni protege la base de datos.

Es una restricción de TypeScript.

---

## 12. React

Props opcionales:

```ts
interface ButtonProps {
  texto: string;
  disabled?: boolean;
}
```

---

## 13. Backend

Input:

```ts
interface CrearDispositivoInput {
  hostname: string;
  ip: string;
  descripcion?: string;
}
```

Entidad:

```ts
interface Dispositivo {
  readonly id: number;
  hostname: string;
  ip: string;
  descripcion?: string;
}
```

---

## 14. Ejercicio

Archivo:

```text
05-optional-readonly.ts
```

Define:

```ts
interface Dispositivo
```

con:

```text
id          -> readonly number
hostname    -> string
ip          -> string
descripcion -> opcional string
activo      -> boolean
```

Crea dos dispositivos, uno con descripción y otro sin ella.

---

## 15. Reto

Define:

```ts
interface CrearDispositivoInput
```

y:

```ts
interface Dispositivo
```

Después crea:

```ts
function crearDispositivo(
  input: CrearDispositivoInput,
  id: number
): Dispositivo
```

Regla:

```text
activo comienza siempre en true
```

---

## 16. Entrevista técnica

Pregunta:

> What's the difference between `const` and `readonly` in TypeScript?

Respuesta conceptual:

> `const` prevents reassignment of a variable binding, while `readonly` prevents reassignment of a property through the TypeScript type system.

---

## 17. Resumen

```text
?
 ↓
propiedad puede faltar
```

```text
readonly
 ↓
propiedad no debe reasignarse
```

```text
CrearDispositivoInput
!=
Dispositivo
```

**Próxima lección:** Union types y literal types.

---

