# Lección 8 — Narrowing y Type Guards con `typeof`, `in` e `instanceof`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración objetivo:** 15–20 minutos.

Hoy entramos en uno de los mecanismos que más vas a usar cuando TypeScript te diga: “sé que este valor puede ser varias cosas, pero todavía no sé cuál”. La solución es **reducir el tipo paso a paso hasta llegar a una variante segura**.

---

## 1. Objetivo

Al terminar esta lección debes poder:

- entender por qué TypeScript necesita narrowing;
- usar `typeof`, `in` e `instanceof`;
- entender qué es un type guard;
- manejar `null`, propiedades opcionales y `unknown`;
- aplicar narrowing a React, Node.js, Services y Repositories;
- distinguir narrowing de runtime validation.

---

## 2. ¿Qué problema resuelve?

Considera:

```ts
function formatearId(
  id: string | number
): string {
  // ...
}
```

`id` puede ser:

```text
string
OR
number
```

Por eso TypeScript no permite directamente:

```ts
id.toUpperCase();
```

`number` no tiene `toUpperCase()`.

Necesitamos demostrar primero qué tipo tenemos.

---

## 3. ¿Qué es narrowing?

Antes:

```ts
let valor: string | number;
```

TypeScript ve:

```text
string | number
```

Pero:

```ts
if (typeof valor === "string") {
  // valor es string aquí
}
```

Dentro del bloque, TypeScript reduce:

```text
string | number
```

a:

```text
string
```

Ese proceso es **narrowing**.

---

## 4. Type Guard con `typeof`

```ts
function formatearId(
  id: string | number
): string {
  if (typeof id === "string") {
    return id.toUpperCase();
  }

  return id.toString();
}
```

Dentro de:

```ts
typeof id === "string"
```

TypeScript sabe que `id` es `string`.

Después de descartar ese caso, sabe que es `number`.

`typeof` funciona especialmente bien con primitivas:

```text
string
number
boolean
bigint
symbol
undefined
function
object
```

---

## 5. ⚠️ Cuidado con `null`

En JavaScript:

```ts
typeof null
```

devuelve:

```text
"object"
```

Por eso:

```ts
function procesar(
  valor: object | null
): void {
  if (
    typeof valor === "object" &&
    valor !== null
  ) {
    console.log("Objeto válido");
  }
}
```

La comprobación:

```ts
valor !== null
```

es esencial.

---

## 6. Type Guard con `in`

Supón:

```ts
type Router = {
  hostname: string;
  rutas: number;
};

type Switch = {
  hostname: string;
  vlans: number;
};
```

Podemos distinguirlos usando una propiedad exclusiva:

```ts
function describirDispositivo(
  dispositivo: Router | Switch
): string {
  if ("rutas" in dispositivo) {
    return `${dispositivo.hostname} tiene ${dispositivo.rutas} rutas`;
  }

  return `${dispositivo.hostname} tiene ${dispositivo.vlans} VLANs`;
}
```

Aquí:

```ts
"rutas" in dispositivo
```

reduce:

```text
Router | Switch
```

a:

```text
Router
```

---

## 7. Aplicación a SiteOps Tracker

```ts
type Router = {
  hostname: string;
  ip: string;
  rutas: number;
};

type Switch = {
  hostname: string;
  ip: string;
  vlans: number;
};

type DispositivoRed =
  | Router
  | Switch;
```

Podemos procesarlos:

```ts
function imprimirDetalle(
  dispositivo: DispositivoRed
): void {
  console.log(dispositivo.hostname);

  if ("rutas" in dispositivo) {
    console.log(
      `Rutas configuradas: ${dispositivo.rutas}`
    );

    return;
  }

  console.log(
    `VLANs configuradas: ${dispositivo.vlans}`
  );
}
```

---

## 8. Type Guard con `instanceof`

`instanceof` sirve cuando trabajamos con clases o constructores reales de JavaScript.

Ejemplo:

```ts
function formatearFecha(
  valor: string | Date
): string {
  if (valor instanceof Date) {
    return valor.toISOString();
  }

  return valor;
}
```

Dentro del `if`:

```ts
valor
```

es un:

```ts
Date
```

---

## 9. Manejo profesional de errores

Un patrón muy útil:

```ts
function imprimirError(
  error: unknown
): void {
  if (error instanceof Error) {
    console.log(error.message);
    return;
  }

  console.log("Error desconocido");
}
```

Flujo:

```text
unknown
 ↓
instanceof Error
 ↓
Error
 ↓
.message disponible
```

Esto es mejor que:

```ts
const errorReal = error as Error;
```

porque `as` no demuestra nada.

---

## 10. `typeof` vs `in` vs `instanceof`

Usa:

```ts
typeof
```

principalmente para primitivas.

Ejemplo:

```ts
typeof valor === "string"
```

Usa:

```ts
in
```

para distinguir objetos mediante propiedades:

```ts
"rutas" in dispositivo
```

Usa:

```ts
instanceof
```

para instancias reales:

```ts
fecha instanceof Date
error instanceof Error
```

---

## 11. Narrowing mediante igualdad

También ocurre aquí:

```ts
type Estado =
  | "loading"
  | "success"
  | "error";
```

```ts
function mostrarEstado(
  estado: Estado
): string {
  if (estado === "loading") {
    return "Cargando...";
  }

  if (estado === "success") {
    return "Completado";
  }

  return "Error";
}
```

Cada comparación reduce las posibilidades.

---

## 12. Narrowing con `null`

Un Repository puede devolver:

```ts
Dispositivo | null
```

porque quizá PostgreSQL no encuentre ningún registro.

Ejemplo:

```ts
function imprimirDispositivo(
  dispositivo: Dispositivo | null
): void {
  if (dispositivo === null) {
    console.log("Dispositivo no encontrado");
    return;
  }

  console.log(dispositivo.hostname);
}
```

Después del:

```ts
return;
```

TypeScript sabe que:

```ts
dispositivo
```

ya no es `null`.

Este patrón de **early return** será muy importante.

---

## 13. Propiedades opcionales

Recuerda:

```ts
interface Dispositivo {
  descripcion?: string;
}
```

Al leer:

```ts
dispositivo.descripcion
```

el tipo es conceptualmente:

```ts
string | undefined
```

Podemos comprobar:

```ts
if (
  dispositivo.descripcion !== undefined
) {
  console.log(
    dispositivo.descripcion.toUpperCase()
  );
}
```

---

## 14. Truthiness narrowing

También verás:

```ts
if (dispositivo.descripcion) {
  console.log(
    dispositivo.descripcion.toUpperCase()
  );
}
```

Pero cuidado: esto también elimina el string vacío:

```text
""
```

porque es falsy.

Si `""` puede ser válido, es más preciso comprobar:

```ts
descripcion !== undefined
```

---

## 15. Interfaces y `instanceof`

Esto es muy importante.

```ts
interface Usuario {
  nombre: string;
}
```

No puedes hacer:

```ts
usuario instanceof Usuario
```

¿Por qué?

Porque:

```text
interface Usuario
```

**desaparece al compilar TypeScript**.

No existe como constructor en runtime.

En cambio:

```ts
class Usuario {}
```

sí genera una clase JavaScript real y puede utilizarse con `instanceof`.

---

## 16. Narrowing NO sustituye runtime validation

Supongamos que tenemos:

```ts
function procesar(
  valor: string | number
): void {
  if (typeof valor === "string") {
    console.log(valor.toUpperCase());
  }
}
```

Aquí estamos refinando un valor cuyo tipo ya conocemos.

Pero un request HTTP:

```ts
const body = req.body;
```

viene del mundo exterior.

Es incorrecto pensar que esto valida:

```ts
const body: CrearDispositivoInput =
  req.body;
```

No lo hace.

---

## 17. Narrowing vs Zod

Más adelante tendremos:

```text
HTTP
 ↓
unknown / datos externos
 ↓
Zod
 ↓
datos validados
 ↓
Service
```

Type guards nos ayudan a razonar sobre tipos durante el flujo del programa.

Zod valida contratos completos provenientes del exterior.

Por eso:

```text
Type Guard
!=
Schema Validation
```

---

## 18. Relación con React

Imagina:

```ts
type EstadoCarga =
  | "idle"
  | "loading"
  | "success"
  | "error";
```

Más adelante podrás escribir:

```tsx
if (estado === "loading") {
  return <p>Cargando...</p>;
}

if (estado === "error") {
  return <p>Ocurrió un error</p>;
}
```

Cada condición reduce el tipo.

Esto será todavía más potente cuando lleguemos a **discriminated unions**.

---

## 19. Relación con Service y Repository

Supongamos:

```text
Repository
 ↓
Dispositivo | null
```

El Service decide:

```text
¿hay dispositivo?
```

Si no:

```text
error
```

Si sí:

```text
continuar reglas de negocio
```

Arquitectónicamente:

```text
Repository
 ↓
Dispositivo | null
 ↓
Service
 ↓
narrowing
 ↓
Dispositivo
```

---

## 20. Arquitectura Full Stack

Seguimos construyendo esta arquitectura:

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
```

El narrowing aparece en varias partes:

```text
React
→ estados de UI

Controller
→ valores ya validados

Service
→ Dispositivo | null

Repository
→ resultados opcionales

Error handling
→ unknown → Error
```

Runtime Validation sigue siendo una capa independiente.

---

## 21. 🧪 Ejercicio

Crea:

```text
08-narrowing-type-guards.ts
```

### Parte 1 — `typeof`

Crea:

```ts
function formatearValor(
  valor: string | number
): string
```

Reglas:

- `string` → devolver en mayúsculas;
- `number` → devolver `valor.toFixed(2)`.

No uses:

```ts
as
```

---

### Parte 2 — `in`

Define:

```ts
type Router = {
  hostname: string;
  rutas: number;
};

type Switch = {
  hostname: string;
  vlans: number;
};
```

Después:

```ts
function describirDispositivo(
  dispositivo: Router | Switch
): string
```

Para Router:

```text
router-core-01 tiene 24 rutas
```

Para Switch:

```text
switch-core-01 tiene 12 VLANs
```

Pista:

```ts
"rutas" in dispositivo
```

---

### Parte 3 — `instanceof`

Crea:

```ts
function formatearFecha(
  valor: string | Date
): string
```

Si recibe `Date`, utiliza:

```ts
valor.toISOString()
```

Si recibe `string`, devuelve el texto original.

---

## 22. 🔥 Reto — Resultado de búsqueda

Define:

```ts
interface Dispositivo {
  readonly id: number;
  hostname: string;
  ip: string;
}
```

Después crea:

```ts
function obtenerHostname(
  dispositivo: Dispositivo | null
): string
```

Reglas:

```text
null
→ "Dispositivo no encontrado"

Dispositivo
→ hostname en mayúsculas
```

Intenta usar **early return**.

No te doy la solución completa.

---

## 23. 🔥 Reto adicional — Errores seguros

Crea:

```ts
function obtenerMensajeError(
  error: unknown
): string
```

Reglas:

Si:

```ts
error instanceof Error
```

devuelve:

```ts
error.message
```

De lo contrario:

```text
"Error desconocido"
```

No uses:

```ts
as Error
```

---

## 24. Errores comunes

No hagas:

```ts
valor.toUpperCase();
```

si:

```ts
valor: string | number
```

sin narrow primero.

No olvides:

```ts
typeof null === "object"
```

No uses:

```ts
"hostname" in dispositivo
```

para diferenciar `Router` y `Switch` si ambos tienen `hostname`.

Y no intentes:

```ts
usuario instanceof Usuario
```

si `Usuario` es una `interface`.

---

## 25. Preguntas de comprensión

1. ¿Qué significa narrowing?
2. ¿Por qué `string | number` no permite directamente `toUpperCase()`?
3. ¿Cuándo usarías `typeof`?
4. ¿Cuándo usarías `in`?
5. ¿Cuándo usarías `instanceof`?
6. ¿Qué devuelve `typeof null`?
7. ¿Por qué una interface no puede usarse directamente con `instanceof`?
8. ¿Qué ventaja tiene un early return?
9. ¿Qué diferencia existe entre `descripcion !== undefined` y `if (descripcion)`?
10. ¿Narrowing sustituye runtime validation?
11. ¿Por qué `unknown` combina bien con type guards?
12. ¿Qué capa debería validar datos HTTP antes de enviarlos al Service?

---

## 26. 🎯 Entrevista técnica

Pregunta:

> What is narrowing in TypeScript?

Respuesta conceptual:

> Narrowing is the process by which TypeScript reduces a broader type to a more specific type based on runtime checks such as `typeof`, `in`, equality checks or `instanceof`.

Otra:

> What is a type guard?

Respuesta:

> A type guard is a runtime condition that provides enough information for TypeScript to refine a value's type inside a particular control-flow branch.

Otra:

> What's the difference between `typeof`, `in`, and `instanceof`?

Respuesta conceptual:

> `typeof` is typically used with primitive values, `in` distinguishes objects by their properties, and `instanceof` checks instances created through constructors or classes.

Y una muy importante:

> Can I use `instanceof` with an interface?

Respuesta:

> No. Interfaces are erased at runtime.

---

## 27. Resumen

El flujo fundamental de hoy:

```text
tipo amplio
 ↓
runtime check
 ↓
tipo específico
```

Las herramientas principales:

```text
typeof
→ primitivas

in
→ propiedades de objetos

instanceof
→ clases y constructores
```

Los tipos e interfaces:

```text
desaparecen en runtime
```

Pero:

```text
typeof
in
instanceof
```

sí son operaciones JavaScript reales.

Aun así:

```text
narrowing
!=
schema validation completa
```

Los datos de HTTP, formularios, APIs externas, archivos, variables de entorno y bases de datos seguirán necesitando validación explícita.

---

## Próxima lección

**Lección 9 — Type Predicates: crear tus propios Type Guards con `value is Type`.**
