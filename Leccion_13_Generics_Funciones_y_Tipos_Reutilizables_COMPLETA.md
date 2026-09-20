# Lección 13 — Generics: funciones y tipos reutilizables manteniendo información de tipos

**Duración objetivo:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Conexión Full Stack:** React + TypeScript, Node.js, APIs REST, Services, Repositories y SDKs tipados

## Introducción

En la Lección 12 trabajaste con `enum`, literal unions, `as const`, `Record` y dominios cerrados. Ahora resolveremos otro problema fundamental: **cómo escribir código reutilizable sin perder información de tipos**.

Si escribimos una función distinta para `string`, `number` y cada objeto, duplicamos lógica. Si usamos `any`, eliminamos la duplicación pero perdemos seguridad. Los **generics** permiten conservar ambas cosas:

```text
reutilización
+
seguridad de tipos
```

Serán esenciales para componentes React reutilizables, utilidades, respuestas de APIs, Services, Repositories, SDKs tipados, algoritmos y testing.

## 1. Objetivo

Al terminar podrás:

- explicar qué problema resuelven los generics;
- crear funciones, tipos e interfaces genéricas;
- comprender inferencia y argumentos genéricos explícitos;
- distinguir generics de `any`;
- utilizar varios parámetros de tipo;
- modelar respuestas de API reutilizables;
- reconocer cuándo un generic aporta valor y cuándo complica el código;
- conectarlos con React, Node.js, Services, Repositories y SDKs;
- recordar que un generic no valida datos externos en runtime.

## 2. El problema: reutilización sin perder tipos

```ts
function identidadString(valor: string): string {
  return valor;
}

function identidadNumero(valor: number): number {
  return valor;
}
```

La lógica es idéntica. Una mala solución sería:

```ts
function identidad(valor: any): any {
  return valor;
}
```

`any` elimina información. Queremos expresar:

> El tipo que entra está relacionado con el tipo que sale.

## 3. Primera función genérica

```ts
function identidad<T>(valor: T): T {
  return valor;
}
```

`T` es un **parámetro de tipo**: “el tipo que corresponda en esta llamada”.

```ts
const hostname = identidad("router-core-01");
const rutas = identidad(24);
```

La misma función trabaja con distintos tipos sin recurrir a `any`.

## 4. Cómo leer `<T>`

```ts
function identidad<T>(valor: T): T
```

Se lee:

> Esta función trabaja con un tipo `T`, recibe un valor de `T` y devuelve `T`.

```text
entrada T
↓
salida T
```

`T` es una convención. También verás nombres como:

```text
TData
TInput
TOutput
TKey
TValue
TResult
```

Cuando el papel del parámetro es específico, un nombre descriptivo suele ser mejor.

## 5. Generic vs `any`

Con `any`:

```text
entra algo
↓
se pierde información
↓
sale any
```

Con generic:

```text
entra T
↓
se conserva la relación
↓
sale T
```

Un generic no significa “acepta cualquier cosa y olvida el tipo”, sino “puede trabajar con distintos tipos manteniendo información sobre ellos”.

## 6. Obtener el primer elemento

```ts
function obtenerPrimero<T>(
  elementos: T[]
): T | undefined {
  return elementos[0];
}
```

Uso:

```ts
const primerHostname = obtenerPrimero([
  "router-core-01",
  "switch-access-01"
]);

const primeraVlan = obtenerPrimero([10, 20, 30]);
```

`undefined` es necesario porque el arreglo podría estar vacío.

## 7. Generic con objetos

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};

const dispositivos: Dispositivo[] = [
  {
    id: "dev-001",
    hostname: "router-core-01",
    ip: "10.0.0.1"
  }
];

const primero = obtenerPrimero(dispositivos);
```

El resultado conserva:

```text
Dispositivo | undefined
```

No necesitamos crear `obtenerPrimerString`, `obtenerPrimerNumero`, `obtenerPrimerDispositivo`, etc.

## 8. Inferencia de generics

```ts
function envolver<T>(valor: T): T[] {
  return [valor];
}

const hostnames = envolver("router-core-01");
```

Normalmente TypeScript infiere `T` desde los argumentos, así que no es necesario escribir:

```ts
envolver<string>("router-core-01");
```

## 9. Generic explícito

A veces sí conviene proporcionar el tipo:

```ts
const listaDispositivos = envolver<Dispositivo>({
  id: "dev-001",
  hostname: "router-core-01",
  ip: "10.0.0.1"
});
```

También:

```ts
function crearLista<T>(): T[] {
  return [];
}

const lista = crearLista<Dispositivo>();
```

Aquí no existe un argumento del cual inferir `T`, así que especificarlo tiene sentido.

## 10. Tipos genéricos

Los generics también se usan en aliases:

```ts
type Caja<T> = {
  valor: T;
};

const hostname: Caja<string> = {
  valor: "router-core-01"
};

const rutas: Caja<number> = {
  valor: 24
};
```

La estructura permanece; cambia el tipo del contenido.

## 11. Respuesta genérica de API

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;
};
```

Para un dispositivo:

```ts
const respuesta: ApiResponse<Dispositivo> = {
  success: true,
  data: {
    id: "dev-001",
    hostname: "router-core-01",
    ip: "10.0.0.1"
  }
};
```

Para una lista:

```ts
const respuestaLista: ApiResponse<Dispositivo[]> = {
  success: true,
  data: [
    {
      id: "dev-001",
      hostname: "router-core-01",
      ip: "10.0.0.1"
    }
  ]
};
```

Podemos leer:

```text
Dispositivo
↓
Dispositivo[]
↓
ApiResponse<Dispositivo[]>
```

## 12. Interfaces genéricas

```ts
interface Repository<T> {
  obtenerTodos(): Promise<T[]>;
  obtenerPorId(
    id: string
  ): Promise<T | null>;
}
```

Podríamos especializar:

```ts
interface DispositivoRepository
  extends Repository<Dispositivo> {
  buscarPorHostname(
    hostname: string
  ): Promise<Dispositivo | null>;
}
```

Ahora `Repository<Dispositivo>` conecta el contrato genérico con la entidad concreta.

## 13. No abstraer demasiado pronto

Un Repository genérico puede parecer elegante, pero no siempre es la mejor arquitectura.

Distintos dominios pueden requerir operaciones distintas:

```text
DispositivoRepository
AuditoriaRepository
UsuarioRepository
```

Además:

- crear una entidad puede recibir un input distinto del tipo persistido;
- actualizar puede aceptar un subconjunto;
- borrar puede trabajar solo con un ID;
- algunas entidades tienen búsquedas específicas;
- algunas operaciones no existen en todos los dominios.

Regla profesional:

> Usa generics para expresar relaciones reales entre tipos, no solamente para reducir líneas de código.

## 14. Varios parámetros genéricos

```ts
function crearPar<TPrimero, TSegundo>(
  primero: TPrimero,
  segundo: TSegundo
): [TPrimero, TSegundo] {
  return [primero, segundo];
}

const resultado = crearPar(
  "router-core-01",
  24
);
```

Resultado conceptual:

```text
[string, number]
```

También:

```ts
type Operacion<TInput, TOutput> = {
  input: TInput;
  output: TOutput;
};
```

Input y output pueden ser distintos.

## 15. Generics con callbacks

```ts
function transformar<TInput, TOutput>(
  valor: TInput,
  transformador: (
    valor: TInput
  ) => TOutput
): TOutput {
  return transformador(valor);
}
```

Uso:

```ts
const longitud = transformar(
  "router-core-01",
  hostname => hostname.length
);
```

TypeScript conoce:

```text
hostname → string
resultado → number
```

Esta relación aparece en `map`, callbacks, React, promesas y pipelines de transformación.

## 16. Generics que ya utilizas

Cuando escribes:

```ts
const nombres: Array<string> = [];
```

`Array` es genérico.

También:

```ts
Promise<Dispositivo>
```

Y en la lección anterior utilizaste:

```ts
Record<EstadoAuditoria, string>
```

`Record<K, V>` recibe dos parámetros genéricos:

```text
K → claves
V → valores
```

## 17. `Promise<T>`

En backend utilizarás constantemente:

```ts
async function obtenerDispositivo():
  Promise<Dispositivo | null> {
  return null;
}
```

Aquí:

```text
T = Dispositivo | null
```

Los generics ya forman parte del ecosistema que estás utilizando.

## 18. Generics y React

Más adelante podremos crear componentes reutilizables:

```ts
type ListaProps<T> = {
  items: T[];
  renderItem: (
    item: T
  ) => React.ReactNode;
};
```

El mismo componente podría trabajar con:

```text
Dispositivo[]
Auditoria[]
Usuario[]
```

sin convertir los elementos en `any`.

Todavía no construiremos el componente completo porque seguimos en TypeScript profundo.

## 19. Generics y SDK tipado

Uno de tus proyectos será un SDK tipado para una API.

Podríamos tener:

```ts
type SdkResponse<T> = {
  data: T;
  requestId: string;
};

async function obtenerRecurso<T>(
  url: string
): Promise<SdkResponse<T>> {
  throw new Error("Pendiente");
}
```

Pero aquí aparece una advertencia crítica.

## 20. Un generic NO valida una API externa

Supón:

```ts
const respuesta =
  await obtenerRecurso<Dispositivo>(
    "/devices/dev-001"
  );
```

Escribir `<Dispositivo>` no obliga al servidor remoto a devolver un `Dispositivo`.

Todavía podría devolver:

```json
{
  "hostname": 500
}
```

El generic solo participa en el sistema de tipos de TypeScript.

No inspecciona los bytes recibidos.

## 21. TypeScript vs runtime validation

Para una API externa queremos:

```text
HTTP
↓
JSON real
↓
unknown
↓
Zod
↓
Dispositivo validado
```

El generic y Zod resuelven problemas diferentes.

Nunca debes razonar:

```text
“tiene <T>, por tanto fue validado”
```

Eso es falso.

## 22. Datos externos que siguen necesitando validación

Aunque utilicemos generics, continúan siendo fronteras runtime:

```text
HTTP
formularios
APIs externas
archivos
variables de entorno
webhooks
mensajes
JSON
bases de datos
```

Los tipos de TypeScript, incluidos los parámetros genéricos, desaparecen al compilar.

## 23. Arquitectura Full Stack

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

### React

Los generics permiten crear componentes, hooks y helpers reutilizables manteniendo tipos específicos.

### HTTP

Transporta datos reales. Los generics no viajan por HTTP.

### Node

Ejecuta JavaScript. Los parámetros genéricos de TypeScript ya fueron eliminados.

### Router

Relaciona método y ruta con un handler.

### Controller

Adapta HTTP hacia el caso de uso.

### Runtime Validation

Valida datos externos reales y los transforma en inputs confiables.

### Service

Aplica reglas de negocio sobre datos ya validados.

### Repository

Puede utilizar abstracciones genéricas cuando expresen relaciones reales, pero sin borrar conceptos del dominio.

### PostgreSQL

No conoce generics TypeScript. Necesita tipos SQL, constraints y reglas reales de integridad.

## 24. Bitácora de red: resultado genérico

```ts
type Resultado<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };
```

Uso:

```ts
type Auditoria = {
  id: string;
  sitio: string;
};

function buscarAuditoria(
  id: string
): Resultado<Auditoria> {
  if (id === "") {
    return {
      success: false,
      error: "ID inválido"
    };
  }

  return {
    success: true,
    data: {
      id,
      sitio: "GDCJ"
    }
  };
}
```

## 25. Generic + discriminated union

El ejemplo anterior combina:

```text
generic
+
discriminated union
+
narrowing
```

Podemos consumirlo así:

```ts
function imprimirResultado(
  resultado: Resultado<Auditoria>
): void {
  if (resultado.success) {
    console.log(resultado.data.sitio);
    return;
  }

  console.error(resultado.error);
}
```

Esta composición es muy común en TypeScript profesional.

## 26. Cuándo usar generics

Son apropiados cuando existe una relación real entre tipos:

```text
entrada y salida relacionadas
contenedor reutilizable
respuesta con distintos datos
callback TInput → TOutput
colecciones
Repository dependiente de entidad
SDK reutilizable
componentes React
helpers de testing
algoritmos
```

Pregunta útil:

> ¿Necesito conservar información sobre el tipo que recibe esta abstracción?

## 27. Cuándo NO usarlos

Esto es innecesario:

```ts
function obtenerHostname<T>(
  hostname: string
): string {
  return hostname;
}
```

`T` no participa.

Mejor:

```ts
function obtenerHostname(
  hostname: string
): string {
  return hostname;
}
```

Tampoco reemplaces tipos concretos por generics sin motivo:

```ts
function crearUsuario<TNombre, TEmail>(
  nombre: TNombre,
  email: TEmail
) {}
```

Si el dominio exige strings:

```ts
function crearUsuario(
  nombre: string,
  email: string
) {}
```

es más preciso.

## 28. Error común: generic desconectado

```ts
function imprimir<T>(
  mensaje: string
): void {
  console.log(mensaje);
}
```

`T` no aporta nada.

Un parámetro genérico debe representar una relación significativa.

## 29. Error común: `any` dentro del generic

Malo:

```ts
function obtenerPrimero<T>(
  elementos: any[]
): T {
  return elementos[0];
}
```

La relación está rota.

Mejor:

```ts
function obtenerPrimero<T>(
  elementos: T[]
): T | undefined {
  return elementos[0];
}
```

## 30. Error común: fabricar `T` con assertion

```ts
function crear<T>(): T {
  return {} as T;
}
```

Esta función promete poder crear cualquier `T` sin saber qué propiedades necesita.

Por ejemplo:

```ts
type Usuario = {
  id: string;
  email: string;
};
```

`{}` no cumple realmente ese contrato.

Los generics no deben utilizarse para hacer promesas que la implementación no puede cumplir.

## 31. Error común: creer que `T` existe en runtime

```ts
function procesar<T>(valor: T): void {
  // ...
}
```

Después de compilar, `T` no existe como objeto runtime.

Para inspeccionar valores reales necesitamos:

```text
typeof
instanceof
in
type guards
Zod
otros validadores runtime
```

## 32. Ejercicio principal — función genérica

Crea:

```text
13-generics.ts
```

Implementa:

```ts
function obtenerUltimo<T>(
  elementos: T[]
): T | undefined
```

Debe devolver el último elemento.

Prueba con:

```ts
const hostnames = [
  "router-core-01",
  "switch-access-01",
  "firewall-edge-01"
];

const vlans = [10, 20, 30];
```

No uses:

```text
any
unknown
as
```

### Pistas

La última posición se relaciona con:

```text
length - 1
```

Piensa qué ocurre cuando el arreglo está vacío y por qué el retorno incluye `undefined`.

Después observa qué tipo infiere TypeScript en cada llamada.

## 33. Segundo ejercicio — contenedor genérico

Define:

```ts
type ResultadoOperacion<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: string;
    };
```

Después:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
};
```

Implementa:

```ts
function buscarDispositivo(
  id: string
): ResultadoOperacion<Dispositivo>
```

Reglas:

- `id` vacío → error;
- cualquier otro valor → dispositivo de prueba.

Consume el resultado usando narrowing por `success`.

No uses `any` ni assertions.

## 34. 🔥 Reto — Bitácora de red

Define:

```ts
type Auditoria = {
  id: string;
  sitio: string;
  completada: boolean;
};
```

Implementa:

```ts
function buscarPorId<
  T extends { id: string }
>(
  elementos: T[],
  id: string
): T | undefined
```

Este reto introduce ligeramente la próxima lección: **generic constraints**.

La función debe funcionar con:

```text
Auditoria[]
Dispositivo[]
```

No profundices todavía en `extends`; observa qué requisito impone sobre `T`.

## 35. 🔥 Reto Full Stack — API Response

```ts
type ApiSuccess<T> = {
  success: true;
  data: T;
};

type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiResponse<T> =
  | ApiSuccess<T>
  | ApiError;
```

Define:

```ts
type Auditoria = {
  id: string;
  sitio: string;
};
```

Crea:

```ts
function procesarRespuesta(
  respuesta:
    ApiResponse<Auditoria[]>
): string
```

Si hay éxito:

```text
Auditorías recibidas: N
```

Si hay error:

```text
CODE: mensaje
```

No uses `any`.

## 36. Reto React

Diseña:

```ts
type ListaProps<T> = {
  items: T[];
  obtenerKey: (
    item: T
  ) => string;
  obtenerTexto: (
    item: T
  ) => string;
};
```

Después crea:

```ts
const propsDispositivos:
  ListaProps<Dispositivo>
```

`obtenerKey` debe devolver `id` y `obtenerTexto` debe devolver `hostname`.

Objetivo: comprender cómo un futuro componente reutilizable conserva el tipo específico de sus elementos.

## 37. Reto arquitectónico

Analiza:

```text
GET /devices
↓
Controller
↓
Service
↓
Repository
↓
PostgreSQL
```

Supón que el Service devuelve:

```ts
Promise<
  ResultadoOperacion<Dispositivo[]>
>
```

Responde:

1. ¿Qué representa `T` en `ResultadoOperacion<T>`?
2. ¿Qué tipo tiene `data` en el caso exitoso?
3. ¿Por qué es mejor que `data: any`?
4. ¿El generic valida filas de PostgreSQL?
5. ¿El generic valida una respuesta HTTP externa?
6. ¿Dónde necesitamos runtime validation?
7. ¿Por qué el Controller no debería “validar” con `as`?

## 38. Relación con Testing

Más adelante veremos helpers genéricos y APIs genéricas de testing.

Conceptualmente:

```ts
function crearFixture<T>(
  valor: T
): T {
  return valor;
}
```

Pero la regla será la misma:

> El generic debe preservar una relación real y no ocultar datos mal tipados.

## 39. Relación con el SDK tipado

Los generics serán una pieza central del SDK:

```text
request
↓
runtime validation
↓
ApiResponse<T>
```

Una implementación profesional no debe limitarse a:

```ts
return json as T;
```

porque eso confunde assertion con validación runtime.

## 40. Relación con el repositorio de algoritmos

Los generics permiten escribir algoritmos reutilizables sobre:

```text
number[]
string[]
objetos[]
```

sin perder el tipo de los elementos.

Ejemplo conceptual:

```ts
function intercambiar<T>(
  elementos: T[],
  i: number,
  j: number
): void {
  const temporal = elementos[i];
  const destino = elementos[j];

  if (
    temporal === undefined ||
    destino === undefined
  ) {
    return;
  }

  elementos[i] = destino;
  elementos[j] = temporal;
}
```

## 41. Relación con el analizador de configuraciones

Podrías utilizar:

```ts
type ParseResult<T> =
  | {
      success: true;
      value: T;
    }
  | {
      success: false;
      reason: string;
    };
```

Y especializar:

```text
ParseResult<InterfaceConfig>
ParseResult<RouteConfig>
ParseResult<VlanConfig>
```

La estructura se reutiliza mientras el contenido conserva su tipo.

## 42. Preguntas de comprensión

1. ¿Qué problema resuelven los generics?
2. ¿Qué representa `<T>`?
3. ¿Por qué un generic no es equivalente a `any`?
4. ¿Qué relación expresa `(valor: T): T`?
5. ¿Cómo infiere TypeScript un parámetro genérico?
6. ¿Cuándo conviene proporcionar `<Tipo>` explícitamente?
7. ¿Qué representa `Caja<string>`?
8. ¿Qué representa `ApiResponse<Dispositivo[]>`?
9. ¿Puede un tipo genérico tener varios parámetros?
10. ¿Qué expresa `transformar<TInput, TOutput>`?
11. ¿Por qué `Array<string>` es un generic?
12. ¿Qué significa `Promise<Dispositivo | null>`?
13. ¿Por qué `Record<K, V>` también es genérico?
14. ¿Qué ventaja ofrecen en componentes React?
15. ¿Qué ventaja ofrecen en un SDK?
16. ¿Por qué `<Dispositivo>` no valida HTTP?
17. ¿Qué ocurre con `T` al compilar?
18. ¿Cuándo un generic es innecesario?
19. ¿Por qué no conviene abstraer Repositories demasiado pronto?
20. ¿Por qué `return {} as T` puede ser inseguro?

## 43. Relevancia para entrevistas

**What are generics in TypeScript?**

> Generics let me write reusable code while preserving relationships between types. Instead of using `any` and losing type information, I can introduce a type parameter such as `T` and use it across parameters, return values, callbacks or data structures.

**What is the difference between a generic and `any`?**

> `any` largely disables type checking for a value, while a generic preserves information about the actual type and lets the compiler enforce relationships involving that type.

**When would you use generics?**

> I use generics when the same abstraction genuinely operates over different types and the relationship between those types matters—for example reusable collections, API result wrappers, typed callbacks, React components, repositories or SDK utilities.

**Does a generic API helper validate the server response?**

> No. TypeScript generics exist only at compile time. External data still needs runtime validation before I trust it as a domain type.

## 44. Cómo explicarlo con tu portafolio

Sobre Bitácora de red:

> In my network audit application, I use generics for reusable structures such as operation results and typed helpers. For example, a `Result<T>` can represent either a successful operation containing a specific domain type or an error. This lets me reuse the result structure without losing information about whether the data is a device, audit or collection.

Sobre el SDK:

> In a typed API SDK, generics are useful for preserving the response type across reusable request infrastructure. However, I don't treat the generic as runtime validation. The HTTP response is still untrusted data, so I validate it before exposing the typed result.

## 45. Relación con tus proyectos

### Bitácora de red

Resultados y helpers reutilizables para auditorías, dispositivos y hallazgos.

### Repositorio de algoritmos

Algoritmos sobre `T[]` sin perder el tipo de los elementos.

### Analizador de configuraciones

`ParseResult<T>` para distintos tipos de configuración.

### SDK tipado

Infraestructura reusable de request/response combinada después con runtime validation.

### API REST Node.js + TypeScript + PostgreSQL

Contratos de resultados y, cuando sea útil, abstracciones de Repository.

### Aplicación React Full Stack

Props, componentes, hooks y utilidades reutilizables.

## 46. Resumen

Los generics combinan:

```text
reutilización
+
información de tipos
```

Forma básica:

```ts
function identidad<T>(
  valor: T
): T {
  return valor;
}
```

Expresa:

```text
entrada T
↓
salida T
```

A diferencia de `any`, el generic conserva información.

Pueden utilizarse en:

```text
funciones
types
interfaces
callbacks
Promises
Arrays
Records
resultados
Repositories
componentes React
SDKs
algoritmos
testing
```

Ejemplos clave:

```ts
type Caja<T> = {
  valor: T;
};
```

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;
};
```

```ts
function obtenerPrimero<T>(
  elementos: T[]
): T | undefined {
  return elementos[0];
}
```

También podemos relacionar varios tipos:

```ts
<TInput, TOutput>
```

No uses generics por apariencia de sofisticación. Pregunta:

> ¿Existe una relación real entre tipos que necesito preservar?

La arquitectura continúa:

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

Un generic describe relaciones de tipos, pero **no valida datos reales**. Los parámetros genéricos desaparecen al compilar, igual que los demás tipos de TypeScript.

Por eso HTTP, formularios, APIs externas, archivos, variables de entorno y datos provenientes de bases de datos siguen necesitando validación o garantías runtime en las capas correspondientes.

## Próxima lección

**Lección 14 — Generic Constraints con `extends`.**
