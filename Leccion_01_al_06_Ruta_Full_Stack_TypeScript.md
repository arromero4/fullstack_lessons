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

# Lección 2 — Arrays y tuplas en TypeScript

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Debes poder:

- crear arrays correctamente tipados;
- entender la inferencia en arrays;
- diferenciar `string[]` y `Array<string>`;
- entender qué problema resuelven las tuplas;
- saber cuándo una tupla es apropiada;
- conectar arrays con React, Node.js y PostgreSQL;
- recordar que una estructura TypeScript no valida datos externos en runtime.

---

## 2. Arrays

```ts
const ips = [
  "192.168.1.1",
  "192.168.1.2",
  "192.168.1.3"
];
```

TypeScript infiere:

```ts
string[]
```

Esto es válido:

```ts
ips.push("192.168.1.4");
```

Esto no:

```ts
ips.push(8080);
```

---

## 3. Tipado explícito

```ts
const puertos: number[] = [22, 80, 443];
```

También:

```ts
const puertos: Array<number> = [22, 80, 443];
```

Normalmente usaremos:

```ts
number[]
string[]
boolean[]
```

---

## 4. Arrays vacíos

Conviene indicar el tipo cuando sabes qué contendrá:

```ts
const errores: string[] = [];
```

---

## 5. Arrays con objetos

```ts
const auditorias = [
  {
    id: 1,
    hostname: "router-01",
    activo: true
  },
  {
    id: 2,
    hostname: "switch-01",
    activo: false
  }
];
```

TypeScript infiere una estructura común para sus elementos.

---

## 6. Tuplas

Una tupla modela posiciones con tipos específicos:

```ts
const resultado: [boolean, string] = [
  true,
  "Conexión exitosa"
];
```

Posición 0:

```ts
boolean
```

Posición 1:

```ts
string
```

---

## 7. Array vs tupla

Array:

```ts
const puertos: number[] = [22, 80, 443];
```

Representa:

> una colección de números.

Tupla:

```ts
const servidor: [string, number] = [
  "192.168.1.10",
  443
];
```

Representa:

> una estructura fija donde cada posición tiene significado.

---

## 8. Desestructuración

```ts
const conexion: [string, number] = [
  "192.168.1.20",
  443
];

const [ip, puerto] = conexion;
```

TypeScript infiere:

```ts
ip: string
puerto: number
```

---

## 9. `const` no vuelve inmutable al array

```ts
const puertos = [22, 80, 443];

puertos.push(8080);
```

es válido.

`const` evita reasignar la variable completa, no modificar el contenido.

---

## 10. Arrays heterogéneos

```ts
const valores = [
  "router-01",
  22,
  true
];
```

TypeScript puede inferir:

```ts
(string | number | boolean)[]
```

Eso **no** es lo mismo que una tupla:

```ts
const valores: [string, number, boolean] = [
  "router-01",
  22,
  true
];
```

---

## 11. Relación con React

```tsx
const dispositivos = [
  "router-01",
  "switch-01",
  "firewall-01"
];

return (
  <ul>
    {dispositivos.map((dispositivo) => (
      <li key={dispositivo}>
        {dispositivo}
      </li>
    ))}
  </ul>
);
```

Flujo típico:

```text
API
 ↓
array de dispositivos
 ↓
estado de React
 ↓
.map()
 ↓
componentes renderizados
```

---

## 12. Relación con Node.js y PostgreSQL

Una consulta SQL:

```sql
SELECT *
FROM dispositivos;
```

puede terminar conceptualmente en:

```ts
Dispositivo[]
```

dentro del backend.

---

## 13. Runtime validation

Aunque escribamos:

```ts
string[]
```

una API podría enviarnos:

```json
[
  "router-01",
  500,
  false
]
```

Por eso:

```text
HTTP
 ↓
unknown data
 ↓
Runtime Validation
 ↓
string[]
```

---

## 14. Ejercicio

Archivo:

```text
02-arrays-tuples.ts
```

Parte 1:

- Crea un array `dispositivos`.
- Agrega `access-point-01` con `push()`.
- Recorre con `for...of`.

Parte 2:

- Crea `latencias = [12, 20, 7, 35]`.
- Calcula suma.
- Calcula promedio.

Parte 3:

Crea una tupla:

```ts
[string, number, boolean]
```

que represente:

```text
IP
puerto
activo
```

y usa desestructuración.

---

## 15. Reto

Crea:

```ts
function obtenerEstadoConexion(
  ip: string,
  puerto: number,
  latencia: number
): [boolean, string]
```

Regla:

```text
latencia <= 100 -> saludable
```

Debes devolver una tupla con:

```text
boolean
mensaje
```

---

## 16. Entrevista técnica

Pregunta:

> What is the difference between an array and a tuple in TypeScript?

Respuesta conceptual:

> An array represents a collection of values with a shared element type, while a tuple represents a fixed positional structure.

---

## 17. Resumen

```text
Array
 ↓
colección
```

```text
Tuple
 ↓
estructura fija por posiciones
```

```text
TypeScript type
!=
runtime validation
```

**Próxima lección:** Objetos.

---

# Lección 3 — Objetos y modelado básico de datos

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Debes comprender:

- cómo TypeScript infiere la estructura de objetos;
- qué significa la `shape` de un objeto;
- cómo acceder y modificar propiedades;
- cómo trabajar con objetos anidados;
- por qué los objetos son mejores que las tuplas para entidades complejas;
- cómo se conectan con React, Node.js y PostgreSQL;
- por qué un objeto tipado no está automáticamente validado en runtime.

---

## 2. Objetos frente a tuplas

Tupla:

```ts
const dispositivo: [string, string, number, boolean] = [
  "router-core-01",
  "192.168.1.1",
  22,
  true
];
```

Objeto:

```ts
const dispositivo = {
  hostname: "router-core-01",
  ip: "192.168.1.1",
  puerto: 22,
  activo: true
};
```

Esto es más descriptivo:

```ts
dispositivo.puerto
```

que:

```ts
dispositivo[2]
```

---

## 3. Inferencia de objetos

```ts
const servidor = {
  hostname: "api-prod-01",
  puerto: 443,
  disponible: true
};
```

TypeScript infiere aproximadamente:

```ts
{
  hostname: string;
  puerto: number;
  disponible: boolean;
}
```

---

## 4. Object shape

La `shape` de un objeto es su estructura esperada.

Ejemplo:

```ts
{
  hostname: string;
  ip: string;
  puerto: number;
}
```

---

## 5. Tipado explícito

```ts
const servidor: {
  hostname: string;
  puerto: number;
  disponible: boolean;
} = {
  hostname: "api-prod-01",
  puerto: 443,
  disponible: true
};
```

Más adelante veremos cómo evitar repetir estos tipos usando `type` e `interface`.

---

## 6. Dot notation y bracket notation

```ts
servidor.hostname
```

y:

```ts
servidor["hostname"]
```

Normalmente preferiremos dot notation cuando conocemos la propiedad.

---

## 7. Objetos anidados

```ts
const auditoria = {
  id: 1,
  dispositivo: {
    hostname: "router-core-01",
    ip: "10.0.0.1"
  },
  resultado: {
    latenciaMs: 12,
    disponible: true
  }
};
```

Acceso:

```ts
auditoria.dispositivo.hostname;
auditoria.resultado.latenciaMs;
```

---

## 8. Arrays de objetos

```ts
const dispositivos = [
  {
    id: 1,
    hostname: "router-01",
    activo: true
  },
  {
    id: 2,
    hostname: "switch-01",
    activo: false
  }
];
```

---

## 9. Funciones que reciben objetos

```ts
function mostrarDispositivo(
  dispositivo: {
    hostname: string;
    ip: string;
    activo: boolean;
  }
): void {
  console.log(dispositivo.hostname);
}
```

---

## 10. Objetos y backend

En lugar de:

```ts
service.crear(
  "router-01",
  "10.0.0.1",
  true,
  22,
  12,
  "Cisco"
);
```

preferiremos:

```ts
service.crear({
  hostname: "router-01",
  ip: "10.0.0.1",
  activo: true,
  puerto: 22,
  latenciaMs: 12,
  fabricante: "Cisco"
});
```

---

## 11. PostgreSQL

Una fila:

```text
1 | router-01 | 10.0.0.1 | true
```

puede transformarse en:

```ts
{
  id: 1,
  hostname: "router-01",
  ip: "10.0.0.1",
  activo: true
}
```

---

## 12. TypeScript no valida runtime

Una API puede enviar:

```json
{
  "hostname": 1234,
  "puerto": "SSH"
}
```

Aunque nuestro tipo diga otra cosa.

Por eso:

```text
Object type
!=
Runtime validation
```

---

## 13. Ejercicio

Archivo:

```text
03-objects.ts
```

Parte 1:

Crea:

```ts
const dispositivo = {
  id: 1,
  hostname: "router-core-01",
  ip: "192.168.1.1",
  puerto: 22,
  activo: true
};
```

Parte 2:

Modifica:

```ts
dispositivo.activo
```

a `false`.

Parte 3:

Crea un array de tres dispositivos y recórrelo con `for...of`.

Restricciones:

- No usar `interface`
- No usar `type`
- No usar `class`
- No usar `any`
- No usar `as`

---

## 14. Reto

Modela:

```text
auditoria
├── id
├── fecha
├── dispositivo
│   ├── hostname
│   └── ip
└── resultado
    ├── latenciaMs
    ├── disponible
    └── mensaje
```

Luego crea:

```ts
imprimirAuditoria(...)
```

---

## 15. Entrevista técnica

Debes poder explicar:

> TypeScript checks object compatibility structurally, based on the properties and their types.

También:

> I prefer objects over tuples for domain entities because named properties improve readability and maintainability.

---

## 16. Resumen

```text
Object
 ↓
propiedades con nombres
 ↓
modelado de entidades
```

```text
Object type
!=
runtime validation
```

**Próxima lección:** `type` e `interface`.

---

# Lección 4 — `type` e `interface`

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Debes poder:

- entender por qué repetir tipos inline es un problema;
- crear aliases con `type`;
- crear contratos con `interface`;
- conocer similitudes y diferencias;
- reutilizar contratos en variables, arrays y funciones;
- modelar entidades de Bitácora de red;
- recordar que ni `type` ni `interface` validan runtime.

---

## 2. Repetición de tipos inline

Esto funciona:

```ts
const dispositivo: {
  id: number;
  hostname: string;
  ip: string;
  activo: boolean;
} = {
  id: 1,
  hostname: "router-core-01",
  ip: "192.168.1.1",
  activo: true
};
```

Pero repetir esa estructura en muchas funciones es difícil de mantener.

---

## 3. `type`

```ts
type Dispositivo = {
  id: number;
  hostname: string;
  ip: string;
  activo: boolean;
};
```

Uso:

```ts
const router: Dispositivo = {
  id: 1,
  hostname: "router-core-01",
  ip: "192.168.1.1",
  activo: true
};
```

---

## 4. `interface`

```ts
interface Dispositivo {
  id: number;
  hostname: string;
  ip: string;
  activo: boolean;
}
```

También puede reutilizarse en variables y funciones.

---

## 5. `type` es más general

```ts
type Id = string | number;
```

También:

```ts
type Coordenada = [number, number];
```

Y:

```ts
type EstadoServidor =
  | "online"
  | "offline"
  | "maintenance";
```

---

## 6. `interface` y objetos

```ts
interface Auditoria {
  id: number;
  fecha: string;
  resultado: string;
}
```

También puede definir contratos implementados por clases.

Ejemplo futuro:

```ts
interface Logger {
  log(mensaje: string): void;
}
```

---

## 7. Arrays tipados

```ts
const dispositivos: Dispositivo[] = [
  {
    id: 1,
    hostname: "router-01",
    ip: "10.0.0.1",
    activo: true
  }
];
```

---

## 8. Composición de modelos

```ts
interface Dispositivo {
  id: number;
  hostname: string;
  ip: string;
  activo: boolean;
}

interface ResultadoAuditoria {
  latenciaMs: number;
  disponible: boolean;
  mensaje: string;
}

interface Auditoria {
  id: number;
  fecha: string;
  dispositivo: Dispositivo;
  resultado: ResultadoAuditoria;
}
```

---

## 9. `extends`

```ts
interface Dispositivo {
  id: number;
  hostname: string;
}

interface DispositivoRed extends Dispositivo {
  ip: string;
  puerto: number;
}
```

---

## 10. Intersecciones con `type`

```ts
type Dispositivo = {
  id: number;
  hostname: string;
};

type DatosRed = {
  ip: string;
  puerto: number;
};

type DispositivoRed =
  Dispositivo & DatosRed;
```

Estudiaremos `&` formalmente más adelante.

---

## 11. Declaration merging

```ts
interface Usuario {
  id: number;
}

interface Usuario {
  nombre: string;
}
```

TypeScript combina ambas declaraciones.

Con `type`, redeclarar el mismo alias produce error.

---

## 12. Regla práctica

Usa `interface` con frecuencia para:

- objetos;
- entidades;
- props;
- contratos de clases.

Usa `type` cuando necesites:

- uniones;
- tuplas;
- aliases primitivos;
- tipos compuestos.

No existe una regla absoluta.

---

## 13. Runtime

Esto:

```ts
interface CrearDispositivoRequest {
  hostname: string;
  ip: string;
  puerto: number;
}
```

no valida un JSON HTTP.

La interface desaparece en runtime.

---

## 14. Ejercicio

Archivo:

```text
04-types-interfaces.ts
```

Define:

```ts
interface Dispositivo
```

con:

```text
id
hostname
ip
puerto
activo
```

Después:

```ts
const dispositivos: Dispositivo[]
```

y una función:

```ts
function imprimirDispositivo(
  dispositivo: Dispositivo
): void
```

---

## 15. Reto

Define:

```text
Dispositivo
ResultadoAuditoria
Auditoria
```

y una función:

```ts
function imprimirAuditoria(
  auditoria: Auditoria
): void
```

---

## 16. Entrevista técnica

Pregunta:

> What is the difference between `type` and `interface` in TypeScript?

Respuesta conceptual:

> Both can describe object shapes. Interfaces are specialized for object contracts and support extension and declaration merging. Type aliases are more general and can also represent unions, tuples, primitives and other composite types.

---

## 17. Resumen

```text
type
 ↓
alias general
```

```text
interface
 ↓
contrato de objeto
```

```text
type/interface
 ↓
compile time
```

```text
runtime data
 ↓
necesita validación
```

**Próxima lección:** Propiedades opcionales y `readonly`.

---

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
