# Lección 11 — `unknown`, `any` y `never`: diferencias, riesgos y uso profesional

**Duración objetivo:** 15–20 minutos.

En las lecciones anteriores trabajaste con **union types**, **narrowing**, **type guards**, **type predicates** y **discriminated unions**. Todos esos conceptos dependen de una pregunta fundamental:

> **¿Qué sabe realmente TypeScript sobre un valor en cada punto del programa?**

En esta lección vamos a estudiar tres tipos especiales que aparecen precisamente cuando la respuesta no es trivial:

```ts
unknown
any
never
```

Aunque los tres parecen “tipos raros”, representan ideas completamente distintas:

```text
unknown
→ tengo un valor, pero todavía no sé de forma segura qué es

any
→ TypeScript deja de comprobar gran parte de lo que hago con este valor

never
→ este valor no debería existir / esta ejecución no produce un valor normal
```

Comprenderlos es esencial para trabajar profesionalmente con TypeScript, especialmente en aplicaciones Full Stack donde existen fronteras externas como:

```text
HTTP
formularios
APIs externas
archivos
variables de entorno
errores
webhooks
mensajes
bases de datos
```

---

# 1. Objetivo

Al terminar esta lección debes poder:

- explicar con precisión qué representan `unknown`, `any` y `never`;
- distinguir `unknown` de `any`;
- entender por qué `unknown` obliga a hacer narrowing;
- reconocer cómo `any` puede propagar pérdida de seguridad;
- identificar usos legítimos y excepcionales de `any`;
- entender `never` en funciones que no terminan normalmente;
- usar `never` para exhaustive checking;
- relacionar `unknown` con datos externos y fronteras de confianza;
- explicar por qué TypeScript no valida datos en runtime;
- conectar estos tipos con React, Node.js, APIs REST, errores y PostgreSQL;
- entender cómo encajan dentro de la arquitectura:

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

---

# 2. El problema: TypeScript no siempre conoce el valor

Considera:

```ts
const hostname: string = "router-core-01";
```

Aquí TypeScript sabe exactamente que:

```text
hostname
↓
string
```

Por tanto:

```ts
hostname.toUpperCase();
```

es válido.

Pero en una aplicación real existen datos que no controlamos directamente:

```text
req.body
respuesta de fetch()
JSON.parse()
localStorage
process.env
archivos
webhooks
errores capturados
inputs de formularios
APIs de terceros
```

En esos puntos debemos preguntarnos:

> ¿Tenemos evidencia suficiente para afirmar qué tipo tiene el valor?

Aquí entra `unknown`.

---

# 3. `unknown`: “todavía no sé qué es”

```ts
let valor: unknown;
```

Podemos asignar:

```ts
valor = "router-core-01";
valor = 24;
valor = true;
valor = null;
valor = {
  hostname: "router-core-01"
};
```

Pero no podemos usar libremente:

```ts
valor.toUpperCase();
```

TypeScript lo rechaza porque no sabe todavía si `valor` es un `string`.

---

# 4. `unknown` obliga a demostrar el tipo

```ts
function imprimirValor(
  valor: unknown
): void {
  if (typeof valor === "string") {
    console.log(valor.toUpperCase());
  }
}
```

Antes:

```text
valor
↓
unknown
```

Dentro del `if`:

```text
valor
↓
string
```

La condición:

```ts
typeof valor === "string"
```

es una comprobación real en runtime.

---

# 5. `unknown` como frontera de confianza

```ts
function procesarBody(
  body: unknown
): void {
  // todavía no confiamos en body
}
```

Conceptualmente:

```text
Internet
↓
HTTP
↓
unknown
↓
validación runtime
↓
dato confiable
```

Antes de validar:

```ts
unknown
```

Después:

```ts
CrearDispositivoInput
```

---

# 6. Los tipos de TypeScript desaparecen en runtime

```ts
type CrearRouterInput = {
  hostname: string;
  rutas: number;
};
```

Aunque tengamos:

```ts
function crearRouter(
  input: CrearRouterInput
): void {
  console.log(input.hostname);
}
```

un cliente externo aún puede enviar:

```json
{
  "hostname": 500,
  "rutas": "muchas"
}
```

Al compilar:

```text
type CrearRouterInput
↓
desaparece
```

Por eso necesitamos **Runtime Validation**.

---

# 7. TypeScript type checking vs runtime validation

TypeScript:

```ts
type CrearDispositivoInput = {
  hostname: string;
  ip: string;
};
```

protege el código durante desarrollo.

Runtime validation comprueba el valor real.

```text
TypeScript
→ compile time

Zod
→ runtime
```

Trabajarán juntos.

---

# 8. `any`: desactivar parte de la protección

```ts
let valor: any;
```

Podemos hacer:

```ts
valor = "router-core-01";
valor = 24;
valor = null;

valor.toUpperCase();
valor.metodoQueNoExiste();
valor.rutas.total.calcular();
```

TypeScript deja de ayudarnos en muchos casos.

---

# 9. Ejemplo de bug con `any`

```ts
function procesar(
  valor: any
): string {
  return valor.hostname.toUpperCase();
}
```

Llamamos:

```ts
procesar({
  hostname: 500
});
```

En runtime algo equivalente a:

```ts
500.toUpperCase();
```

falla.

---

# 10. El mismo caso con `unknown`

```ts
function procesar(
  valor: unknown
): string {
  return valor.hostname.toUpperCase();
}
```

TypeScript marca error inmediatamente.

Eso nos obliga a demostrar:

```text
¿valor es objeto?
¿valor es null?
¿hostname existe?
¿hostname es string?
```

---

# 11. Diferencia esencial

```text
unknown
→ “no sé qué es; compruébalo antes de usarlo”

any
→ “deja de comprobar este valor”
```

Cuando genuinamente no conoces el tipo, normalmente `unknown` es preferible.

---

# 12. Ejemplo profesional con `unknown`

```ts
function obtenerHostname(
  valor: unknown
): string {
  if (
    typeof valor === "object" &&
    valor !== null &&
    "hostname" in valor &&
    typeof valor.hostname === "string"
  ) {
    return valor.hostname.toUpperCase();
  }

  return "HOSTNAME DESCONOCIDO";
}
```

Flujo:

```text
unknown
↓
object
↓
no null
↓
tiene hostname
↓
hostname es string
↓
uso seguro
```

---

# 13. ¿Está prohibido `any`?

No.

Puede aparecer en:

```text
migración desde JavaScript
librerías antiguas sin tipos
código legacy
integraciones extremadamente dinámicas
limitaciones específicas del sistema de tipos
```

Pero debe tratarse como un **escape hatch**, no como opción por defecto.

Regla práctica:

> Si puedes expresar el problema con un tipo concreto, `unknown` o un generic, evita `any`.

---

# 14. Propagación de `any`

```ts
const respuesta: any =
  obtenerRespuesta();

const dispositivo =
  respuesta.device;

const hostname =
  dispositivo.hostname;
```

El `any` puede propagarse:

```text
any
↓
otra variable
↓
otra propiedad
↓
otra función
↓
más pérdida de seguridad
```

---

# 15. `unknown` contiene el riesgo

```ts
const respuesta: unknown =
  obtenerRespuesta();
```

TypeScript impide:

```ts
respuesta.device;
```

hasta que validemos.

```text
dato externo
↓
unknown
↓
validación
──────────── frontera de confianza
↓
tipo conocido
↓
aplicación
```

---

# 16. Aplicación a Node.js

```text
POST /devices
```

Body:

```json
{
  "hostname": "router-core-01",
  "tipo": "router",
  "rutas": 24
}
```

Flujo:

```text
HTTP
↓
req.body
↓
dato no confiable
↓
Runtime Validation
↓
CrearDispositivoInput
↓
Service
```

---

# 17. `as` no reemplaza validación

```ts
const router =
  body as Router;
```

No ejecuta:

```text
typeof
in
instanceof
schema validation
```

Solo le pide al compilador que confíe en nosotros.

---

# 18. `unknown` y `JSON.parse`

```ts
const data: unknown =
  JSON.parse(texto);
```

Después:

```text
unknown
↓
runtime validation
↓
tipo de dominio
```

Para estructuras complejas usaremos Zod.

---

# 19. `unknown` en `catch`

JavaScript permite lanzar cualquier cosa:

```ts
throw new Error("falló");
throw "falló";
throw { codigo: 500 };
```

Por eso:

```ts
try {
  // operación
} catch (error: unknown) {
  if (error instanceof Error) {
    console.log(error.message);
  }
}
```

---

# 20. Helper seguro de errores

```ts
function obtenerMensajeError(
  error: unknown
): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Error desconocido";
}
```

Útil en:

```text
Controllers
Services
API clients
logging
procesamiento de archivos
```

---

# 21. Aplicación a Bitácora de red

```ts
const contenido: unknown =
  JSON.parse(texto);
```

No:

```ts
const dispositivos =
  contenido as Dispositivo[];
```

Flujo correcto:

```text
archivo
↓
JSON.parse
↓
unknown
↓
Runtime Validation
↓
Dispositivo[]
↓
Service
↓
Repository
↓
PostgreSQL
```

---

# 22. `never`: concepto distinto

`never` no significa “no sé qué es”.

Eso es `unknown`.

Tampoco significa “ignora el type checking”.

Eso se parece a `any`.

`never` significa:

> No existe un valor válido que pueda aparecer aquí.

---

# 23. Funciones que siempre lanzan

```ts
function lanzarError(
  mensaje: string
): never {
  throw new Error(mensaje);
}
```

Nunca produce un valor normal.

---

# 24. Funciones que nunca terminan

```ts
function ejecutarSiempre(): never {
  while (true) {
    console.log("Ejecutando...");
  }
}
```

Nunca llega a un retorno normal.

---

# 25. `never` vs `void`

```ts
function registrar(
  mensaje: string
): void {
  console.log(mensaje);
}
```

Termina normalmente.

En cambio:

```ts
function fallar(
  mensaje: string
): never {
  throw new Error(mensaje);
}
```

no termina normalmente.

```text
void
→ termina normalmente, sin valor útil

never
→ no llega a una terminación normal
```

---

# 26. `never` con discriminated unions

```ts
type Resultado =
  | {
      status: "success";
      data: string[];
    }
  | {
      status: "error";
      error: string;
    };
```

```ts
function assertNever(
  valor: never
): never {
  throw new Error(
    `Caso no manejado: ${JSON.stringify(valor)}`
  );
}
```

```ts
function procesarResultado(
  resultado: Resultado
): string {
  switch (resultado.status) {
    case "success":
      return resultado.data.join(", ");

    case "error":
      return resultado.error;

    default:
      return assertNever(resultado);
  }
}
```

Si todos los casos fueron manejados:

```text
resultado
↓
never
```

---

# 27. Agregar una nueva variante

```ts
type Resultado =
  | {
      status: "success";
      data: string[];
    }
  | {
      status: "error";
      error: string;
    }
  | {
      status: "loading";
    };
```

Si olvidamos:

```ts
case "loading":
```

`assertNever(resultado)` genera error porque `resultado` todavía podría ser `loading`.

---

# 28. `never` después del narrowing

```ts
function procesar(
  valor: string | number
): void {
  if (typeof valor === "string") {
    console.log(valor.toUpperCase());
    return;
  }

  if (typeof valor === "number") {
    console.log(valor.toFixed(2));
    return;
  }

  // no quedan variantes válidas
}
```

Conceptualmente, las posibilidades se agotaron.

---

# 29. `never` como intersección imposible

```ts
type A = {
  id: string;
};

type B = {
  id: number;
};

type C = A & B;
```

`id` tendría que ser:

```text
string
AND
number
```

Eso es imposible, por lo que puede reducirse a `never`.

---

# 30. Relación con React

`unknown` puede aparecer cerca de:

```text
errores
respuestas externas
JSON
integraciones
```

Ejemplo:

```ts
async function cargarDatos(): Promise<void> {
  try {
    // petición
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}
```

`never` ayuda con exhaustive checking de estados como:

```text
idle
loading
success
error
```

---

# 31. Relación con Node.js

Node tiene muchas fronteras:

```text
req.body
req.params
req.query
process.env
fs.readFile
APIs externas
webhooks
mensajes
errores
```

Patrón profesional:

```text
unknown
↓
Runtime Validation
↓
tipo concreto
```

---

# 32. Relación con PostgreSQL

TypeScript protege el código.

PostgreSQL protege datos persistidos con restricciones reales.

```ts
type Usuario = {
  email: string;
};
```

no crea automáticamente:

```sql
NOT NULL
UNIQUE
CHECK
FOREIGN KEY
```

Por tanto:

```text
TypeScript
≠
runtime guarantees
≠
database constraints
```

---

# 33. Arquitectura Full Stack completa

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

## React

Trabaja con tipos en frontend, pero formularios y respuestas externas requieren cuidado.

## HTTP

Es una frontera de confianza.

TypeScript no viaja por HTTP.

Viajan:

```text
JSON
strings
bytes
headers
status codes
```

## Node

Recibe datos reales en runtime.

## Router

Asocia método + ruta con un handler.

## Controller

Traduce HTTP hacia un caso de uso.

## Runtime Validation

Convierte:

```text
unknown
↓
validated input
```

Aquí usaremos Zod.

## Service

Recibe datos ya confiables y aplica reglas de negocio.

## Repository

Aísla persistencia.

## PostgreSQL

Aplica almacenamiento y restricciones reales.

---

# 34. ¿Dónde debería aparecer `unknown`?

Principalmente cerca de fronteras:

```text
API client
Controller
validation boundary
file parser
environment loader
error handling
external integration
```

Después de validar:

```text
unknown
↓
tipo específico
```

no queremos seguir propagando `unknown`.

---

# 35. ¿Dónde debería aparecer `any`?

Idealmente, muy poco.

Si aparece, debemos saber por qué:

```text
legacy
migración temporal
librería sin tipos
interoperabilidad dinámica
```

Estrategia:

```text
integración insegura
↓
adaptador pequeño
↓
normalización / validación
↓
API interna tipada
```

---

# 36. ¿Dónde debería aparecer `never`?

Usos típicos:

```text
funciones que siempre lanzan
funciones que nunca terminan
exhaustive checking
casos imposibles
narrowing agotado
```

---

# 37. Comparación completa

| Tipo | Significado conceptual | Nivel de seguridad | Uso típico |
|---|---|---|---|
| `unknown` | No sabemos todavía qué tipo es | Alto si hacemos narrowing | Datos externos, errores, parsing |
| `any` | TypeScript deja de comprobar gran parte del valor | Bajo | Escape hatch, legacy |
| `never` | No existe un valor válido aquí | Muy específico | Exhaustiveness, throw, flujo imposible |

Regla rápida:

```text
unknown
→ comprueba antes de usar

any
→ TypeScript deja de ayudarte

never
→ este caso no debería existir
```

---

# 38. Error común: cambiar `unknown` por `any`

```ts
function procesar(
  valor: unknown
): void {
  console.log(valor.hostname);
}
```

TypeScript marca error.

Mala solución:

```ts
function procesar(
  valor: any
): void {
  console.log(valor.hostname);
}
```

El error desaparece del editor, pero el riesgo sigue ahí.

---

# 39. Error común: usar `as` como validación

```ts
const router =
  body as Router;
```

No valida:

```text
hostname
rutas
tipo
```

Solo cambia lo que TypeScript cree.

---

# 40. Error común: validar demasiado tarde

Mal:

```text
HTTP
↓
Controller
↓
Service
↓
Repository
↓
validación
```

Mejor:

```text
HTTP
↓
Controller
↓
Runtime Validation
↓
Service
↓
Repository
```

---

# 41. Error común: confundir `never` con `void`

```ts
function log(): void {
  console.log("hola");
}
```

No es `never`.

Esto sí:

```ts
function fail(): never {
  throw new Error("falló");
}
```

---

# 42. Error común: propagar `unknown`

Mala arquitectura:

```ts
function controller(
  input: unknown
): unknown {
  return service(input);
}

function service(
  input: unknown
): unknown {
  return repository(input);
}
```

Si ya validamos, debemos usar tipos concretos:

```ts
function service(
  input: CrearDispositivoInput
) {
  // ...
}
```

---

# 43. Ejercicio principal — `unknown` vs `any`

Crea:

```text
11-unknown-any-never.ts
```

Define:

```ts
type Router = {
  hostname: string;
  rutas: number;
};
```

Crea:

```ts
function obtenerHostname(
  valor: unknown
): string
```

Debe:

1. comprobar que `valor` es objeto;
2. comprobar que no es `null`;
3. comprobar que contiene `hostname`;
4. comprobar que `hostname` es `string`;
5. devolver hostname en mayúsculas.

Si no:

```text
HOSTNAME INVÁLIDO
```

No uses:

```ts
any
as
```

---

# 44. Pruebas manuales

```ts
console.log(
  obtenerHostname({
    hostname: "router-core-01",
    rutas: 24
  })
);
```

Esperado:

```text
ROUTER-CORE-01
```

Después:

```ts
console.log(
  obtenerHostname({
    hostname: 500
  })
);
```

Esperado:

```text
HOSTNAME INVÁLIDO
```

También prueba:

```ts
obtenerHostname(null);
obtenerHostname("router");
obtenerHostname(42);
obtenerHostname(true);
```

---

# 45. Ejercicio — errores seguros

Crea:

```ts
function obtenerMensajeError(
  error: unknown
): string
```

Reglas:

- `Error` → `error.message`;
- `string` → devuelve el string;
- cualquier otro valor → `"Error desconocido"`.

Prueba:

```ts
new Error("Base de datos no disponible")
```

```ts
"Timeout"
```

```ts
{
  codigo: 500
}
```

No uses `any`.

---

# 46. 🔥 Reto — importación para Bitácora de red

```ts
const archivo: unknown = {
  hostname: "router-core-01",
  rutas: 24
};
```

Crea:

```ts
function esRouter(
  valor: unknown
): valor is Router
```

Debe verificar:

```text
objeto
no null
hostname existe
hostname es string
rutas existe
rutas es number
```

Después:

```ts
function importarRouter(
  valor: unknown
): string
```

Flujo:

```text
unknown
↓
esRouter
↓
Router
↓
resultado
```

Si es válido:

```text
Router router-core-01 listo para importar
```

Si no:

```text
Archivo inválido
```

No uses `any` ni `as`.

---

# 47. 🔥 Reto Full Stack — Service y Controller

```ts
type CrearDispositivoResult =
  | {
      status: "created";
      hostname: string;
    }
  | {
      status: "duplicate";
      hostname: string;
    };
```

Crea:

```ts
function assertNever(
  valor: never
): never
```

Después:

```ts
function mapearResultadoHttp(
  resultado: CrearDispositivoResult
): number
```

Reglas:

```text
created
→ 201

duplicate
→ 409
```

Usa `switch` y exhaustive checking.

Después agrega temporalmente:

```ts
{
  status: "forbidden";
}
```

sin agregar el nuevo `case`.

Observa el error.

Luego agrega:

```text
forbidden
→ 403
```

---

# 48. 🔥 Reto arquitectónico

Explica este flujo:

```text
POST /devices
↓
req.body
↓
unknown
↓
Runtime Validation
↓
CrearDispositivoInput
↓
DeviceService.create(...)
↓
DeviceRepository.save(...)
↓
PostgreSQL
```

Debes poder responder:

1. ¿Por qué `req.body` no es confiable?
2. ¿Qué desaparece cuando TypeScript compila?
3. ¿Qué capa debe validar la estructura real?
4. ¿Por qué el Service debe recibir `CrearDispositivoInput` y no `unknown`?
5. ¿Qué responsabilidad tiene el Repository?
6. ¿Qué garantías adicionales puede imponer PostgreSQL?

---

# 49. Preguntas de comprensión

1. ¿Qué significa `unknown`?
2. ¿Por qué puedes asignar muchos valores a `unknown` pero no usarlos libremente?
3. ¿Qué necesitas hacer antes de usar un `unknown` como `string`?
4. ¿Cuál es la diferencia principal entre `unknown` y `any`?
5. ¿Por qué `any` puede esconder bugs?
6. ¿Cómo se propaga `any`?
7. ¿Cuándo puede ser legítimo usar `any`?
8. ¿Por qué `unknown` es apropiado para fronteras externas?
9. ¿Por qué `as Router` no valida un request HTTP?
10. ¿Qué ocurre con los tipos al compilar?
11. ¿Por qué un body HTTP requiere runtime validation?
12. ¿Qué papel tendrá Zod?
13. ¿Qué representa `never`?
14. ¿Cuál es la diferencia entre `void` y `never`?
15. ¿Por qué una función que siempre lanza puede devolver `never`?
16. ¿Cómo se usa `never` para exhaustive checking?
17. ¿Qué ocurre al agregar una variante nueva a una discriminated union?
18. ¿Dónde debería aparecer `unknown` en una arquitectura Full Stack?
19. ¿Por qué no queremos propagar `unknown` después de validar?
20. ¿Qué capa debe traducir resultados del Service a HTTP?

---

# 50. Relevancia para entrevistas

> **What is the difference between `any` and `unknown` in TypeScript?**

Respuesta:

> Both can represent values whose concrete type is not known in advance, but `any` largely disables type checking for that value, while `unknown` requires me to narrow or validate the value before I can use it safely. For untrusted external data, I prefer `unknown`.

> **When would you use `never`?**

Respuesta:

> `never` represents values that should never occur. It is useful for functions that never return normally, such as functions that always throw, and for exhaustive checking of discriminated unions.

> **Does TypeScript validate an HTTP request body?**

Respuesta:

> No. TypeScript types are erased during compilation. An HTTP payload exists only at runtime, so I need runtime validation before passing the data into trusted application layers.

> **Why use Zod if you already have TypeScript?**

Respuesta:

> TypeScript protects the code during development, while Zod validates actual runtime values. I use runtime schemas at trust boundaries such as HTTP requests, environment variables, files and external APIs, then let TypeScript work with the validated result.

---

# 51. Cómo explicarlo usando tu proyecto

Sobre Bitácora de red:

> In my network audit application, external inputs such as HTTP payloads or imported files are treated as untrusted data. I use `unknown` to represent values whose structure has not been established yet. After runtime validation, the service layer receives concrete domain types instead of repeatedly checking the same structure.

Sobre `any`:

> I avoid `any` in application code because it can propagate through the codebase and effectively disable useful compiler checks. If I have to use it for a legacy integration, I isolate it behind a small adapter and expose a safe typed interface to the rest of the application.

Sobre `never`:

> I use `never` for exhaustive checking of discriminated unions. When the domain gains a new state, the compiler can identify switch statements that still need to handle it.

---

# 52. Relación con tus proyectos

## Bitácora de red

`unknown` será importante en:

```text
importaciones
HTTP
formularios
errores
```

`never` será útil para resultados exhaustivos.

## Repositorio de algoritmos

Te ayudará a distinguir cuándo necesitas un generic en vez de recurrir a `any`.

## Analizador de configuraciones de red

Los archivos comienzan como datos externos:

```text
texto externo
↓
validación / parsing
↓
estructura tipada
```

## SDK tipado para una API

Las interfaces no validan automáticamente respuestas externas.

## API REST Node.js + TypeScript + PostgreSQL

Patrón:

```text
HTTP
↓
unknown
↓
Zod
↓
DTO/input tipado
↓
Service
↓
Repository
↓
PostgreSQL
```

## Aplicación Full Stack React

React trabajará con tipos seguros, pero HTTP sigue siendo una frontera runtime.

---

# 53. Resumen

## `unknown`

```text
Tengo un valor,
pero todavía no sé de forma segura qué es.
```

Obliga a:

```text
narrowing
o
runtime validation
```

## `any`

```text
TypeScript deja de comprobar gran parte
de lo que hacemos con este valor.
```

Debe mantenerse aislado.

## `never`

```text
Este valor no debería existir.
```

Sirve para:

```text
funciones que siempre lanzan
flujos que nunca terminan
exhaustive checking
casos imposibles
```

Comparación:

```text
unknown
→ seguridad antes de usar

any
→ escape del sistema de tipos

never
→ imposibilidad
```

En la arquitectura:

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

el patrón profesional es:

```text
frontera externa
↓
unknown
↓
validación runtime
↓
tipo concreto
↓
lógica de negocio
```

Recuerda:

> **Los tipos de TypeScript desaparecen al compilar. HTTP, formularios, APIs externas, archivos, variables de entorno y otras fuentes externas requieren validación real en runtime.**

---

# Próxima lección

**Lección 12 — Enums y cuándo preferir Literal Unions.**
