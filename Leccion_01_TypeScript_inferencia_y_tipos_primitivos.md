# Ruta Full Stack Developer con TypeScript

**Objetivo profesional:**  
Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

**Prioridad:** TypeScript como lenguaje base de toda la ruta.

---

# Lección 1 — TypeScript, inferencia de tipos y tipos primitivos

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Al terminar esta lección debes poder explicar:

1. Qué problema intenta resolver TypeScript.
2. Qué significa que TypeScript sea un sistema de tipos estático.
3. Qué es la inferencia de tipos.
4. Cuáles son los tipos primitivos principales.
5. Cuándo conviene escribir un tipo explícitamente.
6. Por qué los tipos desaparecen en runtime.
7. Por qué TypeScript no valida automáticamente datos provenientes del exterior.

---

## 2. ¿Qué problema resuelve TypeScript?

JavaScript permite hacer esto:

```javascript
let puerto = 3000;

puerto = "tres mil";
```

JavaScript no considera esto un error sintáctico.

TypeScript, en cambio:

```ts
let puerto = 3000;

puerto = "tres mil";
```

detectará:

```text
Type 'string' is not assignable to type 'number'
```

Porque TypeScript había inferido que `puerto` debía ser un `number`.

---

## 3. Inferencia de tipos

```ts
let puerto = 3000;
```

TypeScript deduce automáticamente:

```ts
puerto: number
```

Por eso:

```ts
puerto = 8080;
```

es válido, pero:

```ts
puerto = "8080";
```

no lo es.

---

## 4. ¿Hay que escribir siempre el tipo?

No.

Esto es válido:

```ts
const nombre: string = "Carlos";
const edad: number = 35;
const activo: boolean = true;
```

Pero normalmente basta con:

```ts
const nombre = "Carlos";
const edad = 35;
const activo = true;
```

Regla práctica:

> Permite que TypeScript infiera cuando el tipo sea obvio. Anota explícitamente cuando el tipo aporte información útil.

---

## 5. Tipos primitivos principales

### `string`

```ts
let hostname: string = "router-core-01";
```

### `number`

```ts
let puerto: number = 443;
let latencia: number = 12.5;
```

### `boolean`

```ts
let disponible: boolean = true;
```

### `undefined`

```ts
let resultado: string | undefined;
```

### `null`

```ts
let fechaEliminacion: Date | null = null;
```

### `bigint`

```ts
const numeroGrande = 9007199254740993n;
```

### `symbol`

```ts
const id = Symbol("id");
```

---

## 6. Funciones y tipos de retorno

```ts
function calcularTotal(
  precio: number,
  cantidad: number
): number {
  return precio * cantidad;
}
```

La firma establece un contrato claro:

```text
number + number -> number
```

---

## 7. Concepto crítico: TypeScript desaparece en runtime

Escribimos:

```ts
function sumar(
  a: number,
  b: number
): number {
  return a + b;
}
```

Pero el JavaScript ejecutado será conceptualmente:

```js
function sumar(a, b) {
  return a + b;
}
```

Los tipos desaparecieron.

Por eso:

```text
TypeScript type checking
!=
runtime validation
```

---

## 8. Datos externos

Si una API espera:

```json
{
  "puerto": 443
}
```

un cliente podría enviar:

```json
{
  "puerto": "hola"
}
```

o incluso:

```json
{
  "banana": true
}
```

TypeScript no puede impedir que esos datos lleguen.

Más adelante usaremos validación real en runtime, por ejemplo con **Zod**.

---

## 9. `as` no valida

Esto:

```ts
const puerto = valor as number;
```

no convierte ni valida el valor.

Solo le dice al compilador:

> Confía en mí.

Por eso no debemos usar `as` para silenciar errores sin entender el riesgo.

---

## 10. Relación con Full Stack

```text
TypeScript
  ↓
React props / state
  ↓
Node services
  ↓
PostgreSQL models
```

También:

```text
HTTP
  ↓
Runtime Validation
  ↓
Service
```

---

## 11. Ejercicio

Crea:

```text
01-fundamentos.ts
```

Variables:

```text
auditoriaId
hostname
ip
puerto
latenciaMs
dispositivoActivo
```

Valores sugeridos:

```text
auditoriaId       1
hostname          SW-CORE-01
ip                192.168.10.1
puerto            22
latenciaMs        12.5
dispositivoActivo true
```

Salida:

```text
Auditoría: 1
Dispositivo: SW-CORE-01
IP: 192.168.10.1
Puerto: 22
Latencia: 12.5 ms
Activo: true
```

Restricciones:

- No usar `interface`
- No usar `type`
- No usar `class`
- No usar `any`
- No usar `as`

---

## 12. Reto

Crea:

```ts
mostrarDispositivo(...)
```

Debe recibir:

```text
hostname
ip
puerto
activo
```

y mostrar:

```text
SW-CORE-01 | 192.168.10.1:22 | activo=true
```

---

## 13. Preguntas de comprensión

1. ¿Por qué `let hostname = "router-01"` no necesita `: string`?
2. ¿Por qué TypeScript rechaza asignar `"HTTPS"` a una variable inferida como `number`?
3. ¿El tipo `number` existe cuando Node.js ejecuta el JavaScript?
4. ¿TypeScript puede impedir por sí solo que un cliente HTTP envíe datos inválidos?
5. ¿Cuál es la diferencia entre type checking y runtime validation?

---

## 14. Entrevista técnica

Pregunta posible:

> What does TypeScript provide on top of JavaScript?

Debes poder explicar:

> TypeScript provides static type checking during development, but its types are erased at runtime, so external data still needs runtime validation.

---

## 15. Resumen

```text
TypeScript analiza tipos
antes de ejecutar el programa
```

```text
Los tipos desaparecen en runtime
```

```text
Datos externos
  ↓
necesitan validación real
```

**Próxima lección:** Arrays y tuplas.

---

