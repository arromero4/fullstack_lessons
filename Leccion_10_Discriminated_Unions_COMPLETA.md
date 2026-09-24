# Lección 10 — Discriminated Unions

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración objetivo:** 15–20 minutos.

En las últimas lecciones has trabajado con union types, narrowing, type guards y type predicates. Ahora vamos a combinar varias de esas ideas en uno de los patrones más potentes de TypeScript para modelar estados y variantes de dominio de forma segura: las **discriminated unions**.

Este patrón aparece constantemente en aplicaciones profesionales porque permite representar casos como:

```text
loading
success
error
```

o:

```text
router
switch
firewall
```

de una manera en la que **cada variante contiene exactamente las propiedades que le corresponden**.

Eso reduce estados imposibles, mejora el autocompletado y hace que TypeScript pueda comprobar que manejamos todos los casos relevantes.

---

## 1. Objetivo

Al terminar esta lección debes poder:

- explicar qué es una discriminated union;
- reconocer el papel de la propiedad discriminante;
- combinar literal types con union types;
- hacer narrowing usando un discriminante;
- evitar modelos con estados imposibles;
- entender por qué `boolean` + propiedades opcionales suele ser un modelo más débil;
- aplicar discriminated unions a estados de React;
- aplicarlas a resultados de Services y APIs;
- aplicarlas a SiteOps Tracker y al analizador de configuraciones;
- entender el patrón de exhaustive checking con `never`;
- diferenciar discriminated unions de runtime validation;
- explicar por qué el discriminante de TypeScript no valida automáticamente datos HTTP.

---

## 2. El problema: estados imposibles

Imagina que modelamos una petición HTTP así:

```ts
interface EstadoPeticion {
  loading: boolean;
  data?: string[];
  error?: string;
}
```

Parece razonable.

Pero este tipo permite representar:

```ts
const estado: EstadoPeticion = {
  loading: true,
  data: ["router-01"],
  error: "Falló la petición"
};
```

Ahora tenemos simultáneamente:

```text
loading = true
data presente
error presente
```

¿Eso tiene sentido?

Probablemente no.

El problema es que nuestra estructura permite combinaciones que el dominio realmente no debería aceptar.

---

## 3. Una primera aproximación con `status`

Podemos agregar un estado:

```ts
type Status =
  | "loading"
  | "success"
  | "error";

interface EstadoPeticion {
  status: Status;
  data?: string[];
  error?: string;
}
```

Esto mejora el modelo.

Pero todavía permite:

```ts
const estado: EstadoPeticion = {
  status: "success",
  error: "Algo falló"
};
```

TypeScript no sabe que:

```text
status = success
```

debería implicar:

```text
data existe
error no existe
```

Necesitamos relacionar cada estado con una estructura específica.

---

## 4. Separar cada variante

Podemos crear:

```ts
type LoadingState = {
  status: "loading";
};

type SuccessState = {
  status: "success";
  data: string[];
};

type ErrorState = {
  status: "error";
  error: string;
};
```

Ahora cada tipo representa un estado válido.

Después creamos:

```ts
type RequestState =
  | LoadingState
  | SuccessState
  | ErrorState;
```

Esto es una **discriminated union**.

---

## 5. ¿Por qué se llama discriminated union?

Porque todos los miembros comparten una propiedad común:

```ts
status
```

pero con valores literales diferentes:

```text
"loading"
"success"
"error"
```

Esa propiedad funciona como **discriminante**.

Visualmente:

```text
RequestState
│
├── status: "loading"
│
├── status: "success"
│
└── status: "error"
```

TypeScript puede observar el valor de:

```ts
estado.status
```

y saber exactamente qué variante tiene.

---

## 6. Narrowing automático por discriminante

Considera:

```ts
function renderState(
  state: RequestState
): string {
  if (state.status === "loading") {
    return "Cargando...";
  }

  if (state.status === "success") {
    return `Datos: ${state.data.join(", ")}`;
  }

  return `Error: ${state.error}`;
}
```

Dentro de:

```ts
state.status === "success"
```

TypeScript sabe:

```text
state
↓
SuccessState
```

Por eso permite:

```ts
state.data
```

sin comprobar manualmente si existe.

---

## 7. Esto evita propiedades opcionales innecesarias

Con el modelo anterior:

```ts
interface EstadoPeticion {
  status: Status;
  data?: string[];
  error?: string;
}
```

cada vez que lees:

```ts
state.data
```

TypeScript debe considerar:

```ts
string[] | undefined
```

Con discriminated unions:

```ts
type SuccessState = {
  status: "success";
  data: string[];
};
```

dentro de la rama `success`:

```ts
state.data
```

es simplemente:

```ts
string[]
```

Eso hace que el contrato sea mucho más fuerte.

---

## 8. Regla práctica

Cuando una propiedad depende de otra propiedad, una discriminated union suele ser una buena candidata.

Ejemplo:

```text
si status = success
entonces data debe existir
```

y:

```text
si status = error
entonces error debe existir
```

Podemos representar esa relación directamente en el tipo.

---

## 9. Aplicación a SiteOps Tracker

Imagina varios tipos de dispositivos.

Podemos modelar:

```ts
type Router = {
  tipo: "router";
  hostname: string;
  rutas: number;
};

type Switch = {
  tipo: "switch";
  hostname: string;
  vlans: number;
};

type Firewall = {
  tipo: "firewall";
  hostname: string;
  reglas: number;
};
```

Después:

```ts
type Dispositivo =
  | Router
  | Switch
  | Firewall;
```

La propiedad:

```ts
tipo
```

es el discriminante.

---

## 10. Narrowing en SiteOps Tracker

Podemos hacer:

```ts
function describirDispositivo(
  dispositivo: Dispositivo
): string {
  if (dispositivo.tipo === "router") {
    return `${dispositivo.hostname} tiene ${dispositivo.rutas} rutas`;
  }

  if (dispositivo.tipo === "switch") {
    return `${dispositivo.hostname} tiene ${dispositivo.vlans} VLANs`;
  }

  return `${dispositivo.hostname} tiene ${dispositivo.reglas} reglas`;
}
```

TypeScript sabe en cada rama qué propiedades existen.

---

## 11. Mejor que distinguir usando `in`

En la Lección 8 podíamos hacer:

```ts
if ("rutas" in dispositivo)
```

Eso es válido.

Pero si el dominio ya tiene un campo como:

```ts
tipo: "router"
```

podemos escribir:

```ts
if (dispositivo.tipo === "router")
```

Esto suele ser más expresivo.

Compara:

```text
"rutas" in dispositivo
```

con:

```text
dispositivo.tipo === "router"
```

La segunda condición habla directamente en términos del dominio.

---

## 12. El discriminante debe ser común y literal

Para que el patrón funcione bien, todas las variantes deben compartir una propiedad con valores literales distintos.

Ejemplo correcto:

```ts
type Router = {
  tipo: "router";
  rutas: number;
};

type Switch = {
  tipo: "switch";
  vlans: number;
};
```

Ambos tienen:

```ts
tipo
```

pero los valores posibles son literales diferentes.

---

## 13. Un mal discriminante

Esto es más débil:

```ts
type Router = {
  tipo: string;
  rutas: number;
};

type Switch = {
  tipo: string;
  vlans: number;
};
```

Ahora TypeScript no puede distinguir las variantes usando:

```ts
tipo
```

porque ambos dicen:

```ts
string
```

No existen valores literales exclusivos.

---

## 14. Discriminated unions con `switch`

Este patrón combina especialmente bien con:

```ts
switch
```

Ejemplo:

```ts
function describirDispositivo(
  dispositivo: Dispositivo
): string {
  switch (dispositivo.tipo) {
    case "router":
      return `${dispositivo.hostname} tiene ${dispositivo.rutas} rutas`;

    case "switch":
      return `${dispositivo.hostname} tiene ${dispositivo.vlans} VLANs`;

    case "firewall":
      return `${dispositivo.hostname} tiene ${dispositivo.reglas} reglas`;
  }
}
```

Cada `case` produce narrowing automáticamente.

---

## 15. ¿Cuándo usar `if` y cuándo `switch`?

Para dos variantes, esto puede ser muy claro:

```ts
if (resultado.status === "success") {
}
```

Cuando tienes varias variantes:

```text
router
switch
firewall
access-point
```

un `switch` puede ser más legible.

No es una regla absoluta.

La decisión depende de claridad y complejidad.

---

## 16. Exhaustive checking

Aquí aparece una técnica profesional muy importante.

Supongamos:

```ts
type Dispositivo =
  | Router
  | Switch
  | Firewall;
```

Creamos:

```ts
function assertNever(
  valor: never
): never {
  throw new Error(
    `Caso no manejado: ${JSON.stringify(valor)}`
  );
}
```

Y usamos:

```ts
function describirDispositivo(
  dispositivo: Dispositivo
): string {
  switch (dispositivo.tipo) {
    case "router":
      return `${dispositivo.hostname} tiene ${dispositivo.rutas} rutas`;

    case "switch":
      return `${dispositivo.hostname} tiene ${dispositivo.vlans} VLANs`;

    case "firewall":
      return `${dispositivo.hostname} tiene ${dispositivo.reglas} reglas`;

    default:
      return assertNever(dispositivo);
  }
}
```

Si hemos manejado todas las variantes, TypeScript reduce:

```ts
dispositivo
```

a:

```ts
never
```

en `default`.

---

## 17. ¿Qué aporta `never` aquí?

`never` representa un valor que no debería existir en ese punto.

Conceptualmente:

```text
router
switch
firewall
↓
todos manejados
↓
no quedan variantes
↓
never
```

Esto permite detectar cuando agregamos una nueva variante y olvidamos actualizar una función.

---

## 18. Ejemplo: agregamos un Access Point

Imagina que luego agregamos:

```ts
type AccessPoint = {
  tipo: "access-point";
  hostname: string;
  clientes: number;
};
```

Y modificamos:

```ts
type Dispositivo =
  | Router
  | Switch
  | Firewall
  | AccessPoint;
```

Pero olvidamos agregar:

```ts
case "access-point":
```

Entonces:

```ts
assertNever(dispositivo)
```

puede generar un error de TypeScript porque:

```text
dispositivo
```

ya no es `never`.

Todavía podría ser:

```text
AccessPoint
```

Esto nos avisa de que falta manejar una variante.

---

## 19. Por qué esto es útil en aplicaciones grandes

Imagina que tienes una unión con:

```text
pending
approved
rejected
cancelled
```

y mañana agregas:

```text
expired
```

El exhaustive checking puede ayudarte a localizar funciones donde todavía no manejaste:

```text
expired
```

Eso reduce errores cuando el dominio evoluciona.

---

## 20. React: estado de una petición

Este es uno de los usos más comunes.

Podemos definir:

```ts
type IdleState = {
  status: "idle";
};

type LoadingState = {
  status: "loading";
};

type SuccessState<T> = {
  status: "success";
  data: T;
};

type ErrorState = {
  status: "error";
  error: string;
};
```

Después:

```ts
type AsyncState<T> =
  | IdleState
  | LoadingState
  | SuccessState<T>
  | ErrorState;
```

Aparece aquí:

```ts
<T>
```

que pertenece a generics.

Todavía no vamos a profundizar en generics; por ahora observa que permite reutilizar el patrón con diferentes tipos de datos.

---

## 21. Ejemplo conceptual en React

Para dispositivos:

```ts
type EstadoDispositivos =
  AsyncState<Dispositivo[]>;
```

Podríamos tener:

```ts
const state: EstadoDispositivos = {
  status: "success",
  data: []
};
```

Y renderizar:

```tsx
function ListaDispositivos(
  state: EstadoDispositivos
) {
  if (state.status === "loading") {
    return <p>Cargando...</p>;
  }

  if (state.status === "error") {
    return <p>{state.error}</p>;
  }

  if (state.status === "success") {
    return (
      <ul>
        {state.data.map((dispositivo) => (
          <li key={dispositivo.hostname}>
            {dispositivo.hostname}
          </li>
        ))}
      </ul>
    );
  }

  return <p>Sin iniciar</p>;
}
```

Fíjate en lo que ganamos:

```text
loading
→ no hay data

error
→ error obligatorio

success
→ data obligatoria
```

No necesitamos llenar todo de propiedades opcionales.

---

## 22. Comparación con un estado débil de React

Modelo débil:

```ts
type Estado = {
  loading: boolean;
  data?: Dispositivo[];
  error?: string;
};
```

Podría permitir:

```ts
{
  loading: false,
  data: [...],
  error: "Error"
}
```

Modelo fuerte:

```ts
type Estado =
  | {
      status: "loading";
    }
  | {
      status: "success";
      data: Dispositivo[];
    }
  | {
      status: "error";
      error: string;
    };
```

Ahora los estados válidos están explícitamente representados.

---

## 23. Principio: hacer estados inválidos difíciles de representar

Este es un principio de diseño muy valioso:

> **Make invalid states unrepresentable.**

La idea es diseñar tipos de forma que ciertos errores no puedan expresarse fácilmente.

En lugar de:

```text
muchas propiedades opcionales
+
combinaciones ambiguas
```

buscamos:

```text
cada variante
=
estado válido específico
```

---

## 24. Node.js: resultados de Service

Una operación de negocio puede devolver:

```ts
type CrearDispositivoResult =
  | {
      status: "created";
      dispositivo: Dispositivo;
    }
  | {
      status: "duplicate";
      hostname: string;
    }
  | {
      status: "forbidden";
    };
```

El Controller podría recibir ese resultado y traducirlo a HTTP.

Por ejemplo:

```text
created
→ HTTP 201

duplicate
→ HTTP 409

forbidden
→ HTTP 403
```

Esto mantiene separado:

```text
Service
→ resultado de negocio

Controller
→ protocolo HTTP
```

---

## 25. ¿Por qué no devolver directamente códigos HTTP desde el Service?

Podríamos hacer:

```ts
return {
  statusCode: 409
};
```

pero entonces el Service empezaría a conocer detalles del protocolo HTTP.

Nuestra arquitectura busca:

```text
Service
→ reglas de negocio

Controller
→ traducción HTTP
```

Por eso un resultado como:

```ts
status: "duplicate"
```

puede ser más apropiado dentro del dominio.

El Controller decide:

```text
duplicate
↓
409 Conflict
```

---

## 26. Ejemplo Controller → Service

Service:

```ts
type CrearDispositivoResult =
  | {
      status: "created";
      dispositivo: Dispositivo;
    }
  | {
      status: "duplicate";
      hostname: string;
    };
```

Controller conceptual:

```ts
const resultado =
  await service.crear(input);

switch (resultado.status) {
  case "created":
    return response.status(201).json(
      resultado.dispositivo
    );

  case "duplicate":
    return response.status(409).json({
      error: `Ya existe ${resultado.hostname}`
    });
}
```

El Service no sabe nada de:

```text
201
409
JSON
Express Response
```

Eso corresponde al Controller.

---

## 27. Arquitectura completa

Seguimos construyendo:

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

Ahora observa dónde pueden aparecer discriminated unions:

```text
React
→ estados de UI

Controller
→ interpretar resultados del Service

Service
→ resultados de casos de uso

Domain
→ variantes de entidades

Parser
→ variantes de tokens o líneas

Error handling
→ diferentes categorías de error
```

---

## 28. Analizador de configuraciones de red

Este patrón encaja especialmente bien en tu analizador.

Podríamos modelar:

```ts
type HostnameCommand = {
  tipo: "hostname";
  hostname: string;
};

type InterfaceCommand = {
  tipo: "interface";
  interfaz: string;
};

type DescriptionCommand = {
  tipo: "description";
  descripcion: string;
};

type ConfigCommand =
  | HostnameCommand
  | InterfaceCommand
  | DescriptionCommand;
```

Después:

```ts
function procesarComando(
  comando: ConfigCommand
): void {
  switch (comando.tipo) {
    case "hostname":
      console.log(
        `Hostname: ${comando.hostname}`
      );
      break;

    case "interface":
      console.log(
        `Interfaz: ${comando.interfaz}`
      );
      break;

    case "description":
      console.log(
        `Descripción: ${comando.descripcion}`
      );
      break;
  }
}
```

Cada variante tiene solo las propiedades relevantes.

---

## 29. API responses

También podrías modelar respuestas internas:

```ts
type ApiSuccess<T> = {
  status: "success";
  data: T;
};

type ApiError = {
  status: "error";
  error: {
    code: string;
    message: string;
  };
};

type ApiResult<T> =
  | ApiSuccess<T>
  | ApiError;
```

De nuevo aparece `<T>`, que estudiaremos formalmente cuando lleguemos a generics.

Por ahora quédate con el patrón conceptual.

---

## 30. TypeScript sigue sin validar HTTP

Esto es crítico.

Supón que tenemos:

```ts
type ApiResult =
  | {
      status: "success";
      data: string[];
    }
  | {
      status: "error";
      error: string;
    };
```

Una API externa podría enviar:

```json
{
  "status": "success",
  "error": 123
}
```

Nuestro tipo no evita que ese JSON llegue.

Escribir:

```ts
const result: ApiResult =
  await response.json();
```

no convierte mágicamente el JSON en datos confiables.

---

## 31. Discriminated union vs runtime validation

La separación es:

```text
Discriminated Union
↓
describe estados válidos
para TypeScript
```

Mientras:

```text
Zod
↓
comprueba que el valor real
cumple el contrato
```

En una frontera HTTP:

```text
JSON desconocido
 ↓
Zod
 ↓
dato validado
 ↓
Discriminated Union
 ↓
narrowing seguro
```

Esta combinación será muy potente.

---

## 32. Un ejemplo conceptual con Zod

Más adelante podríamos tener algo parecido a:

```ts
const routerSchema = z.object({
  tipo: z.literal("router"),
  hostname: z.string(),
  rutas: z.number()
});

const switchSchema = z.object({
  tipo: z.literal("switch"),
  hostname: z.string(),
  vlans: z.number()
});
```

Y una unión discriminada de Zod.

No necesitamos aprender esa API todavía.

Lo importante es entender la arquitectura:

```text
Runtime schema
→ valida el dato

TypeScript union
→ permite trabajar con él de forma segura
```

---

## 33. Discriminated unions vs type predicates

En la Lección 9 vimos:

```ts
function esRouter(
  dispositivo: Dispositivo
): dispositivo is Router
```

Con una discriminated union podemos hacer directamente:

```ts
if (dispositivo.tipo === "router") {
}
```

Entonces, ¿los predicates ya no sirven?

Sí sirven.

Pero si el dominio ya tiene un discriminante explícito, muchas veces no necesitamos escribir un custom guard para algo tan sencillo.

Podemos reservar los type predicates para casos donde:

- la regla es más compleja;
- la comprobación se reutiliza;
- no existe un discriminante conveniente;
- trabajamos con `unknown`.

---

## 34. Cuándo usar discriminated unions

Son excelentes para:

- estados de UI;
- resultados de operaciones;
- eventos;
- comandos;
- variantes de entidades;
- parsers;
- errores tipados;
- workflows;
- estados de máquinas;
- respuestas internas de Services.

---

## 35. Cuándo NO usarlas

No conviertas cada objeto del sistema en una unión.

Si tienes:

```ts
type Usuario = {
  id: number;
  nombre: string;
};
```

y no existen variantes reales, una discriminated union no aporta nada.

Tampoco necesitas crear discriminantes artificiales si un objeto simplemente tiene una estructura estable.

Úsalas cuando haya:

```text
varias variantes legítimas
+
propiedades dependientes de la variante
```

---

## 36. Error común: usar muchas propiedades opcionales

Mal modelado:

```ts
type Evento = {
  tipo: "login" | "logout" | "error";
  usuarioId?: number;
  mensaje?: string;
};
```

¿Qué propiedades corresponden a cada estado?

No está claro.

Podría ser mejor:

```ts
type LoginEvent = {
  tipo: "login";
  usuarioId: number;
};

type LogoutEvent = {
  tipo: "logout";
  usuarioId: number;
};

type ErrorEvent = {
  tipo: "error";
  mensaje: string;
};

type Evento =
  | LoginEvent
  | LogoutEvent
  | ErrorEvent;
```

Ahora el contrato es explícito.

---

## 37. Error común: discriminante no literal

Esto:

```ts
type Router = {
  tipo: string;
  rutas: number;
};
```

pierde gran parte del beneficio.

Mejor:

```ts
type Router = {
  tipo: "router";
  rutas: number;
};
```

---

## 38. Error común: usar `as` para saltarse variantes

No hagas:

```ts
const router =
  dispositivo as Router;
```

si realmente necesitas comprobar qué variante tienes.

Si ya existe:

```ts
tipo
```

usa narrowing:

```ts
if (dispositivo.tipo === "router") {
}
```

---

## 39. Error común: olvidar actualizar un `switch`

Si agregas una variante nueva:

```ts
tipo: "access-point"
```

y olvidas modificar funciones existentes, puedes introducir bugs.

El patrón:

```ts
assertNever(...)
```

ayuda a detectar esos casos durante desarrollo.

---

# 40. 🧪 Ejercicio — Dispositivos de SiteOps Tracker

Crea:

```text
10-discriminated-unions.ts
```

Define:

```ts
type Router = {
  tipo: "router";
  hostname: string;
  rutas: number;
};

type Switch = {
  tipo: "switch";
  hostname: string;
  vlans: number;
};

type Firewall = {
  tipo: "firewall";
  hostname: string;
  reglas: number;
};

type Dispositivo =
  | Router
  | Switch
  | Firewall;
```

Crea:

```ts
function describirDispositivo(
  dispositivo: Dispositivo
): string
```

Usa:

```ts
switch (dispositivo.tipo)
```

Resultados esperados:

```text
router-core-01 | 24 rutas
```

```text
switch-core-01 | 12 VLANs
```

```text
firewall-edge-01 | 80 reglas
```

No uses:

```ts
as
any
```

---

## 41. Parte 2 — Crear datos

Crea al menos:

```ts
const router: Router
const switchCore: Switch
const firewall: Firewall
```

Después:

```ts
const dispositivos: Dispositivo[]
```

Recorre el array y usa:

```ts
describirDispositivo(...)
```

para imprimir todos.

---

# 42. 🔥 Reto — Estado de una petición React

Modela:

```text
idle
loading
success
error
```

como una discriminated union.

Requisitos conceptuales:

### `idle`

Solo:

```ts
status: "idle"
```

### `loading`

Solo:

```ts
status: "loading"
```

### `success`

Debe contener:

```text
status
data
```

donde `data` sea:

```ts
Dispositivo[]
```

### `error`

Debe contener:

```text
status
error
```

donde `error` sea:

```ts
string
```

Después crea:

```ts
function obtenerMensajeEstado(
  estado: EstadoDispositivos
): string
```

Debe devolver mensajes diferentes según la variante.

No uses propiedades opcionales para resolverlo.

---

# 43. 🔥 Reto Full Stack — Resultado de Service

Modela el resultado de crear un dispositivo.

Debe tener tres posibilidades:

```text
created
duplicate
forbidden
```

### Created

Debe contener:

```text
status: "created"
dispositivo
```

### Duplicate

Debe contener:

```text
status: "duplicate"
hostname
```

### Forbidden

Solo necesita:

```text
status: "forbidden"
```

Después crea:

```ts
function mapearResultadoAHttp(
  resultado: CrearDispositivoResult
): number
```

Reglas:

```text
created
→ 201

duplicate
→ 409

forbidden
→ 403
```

La función debe usar narrowing mediante el discriminante.

Este reto conecta directamente:

```text
Service
→ Controller
→ HTTP
```

---

# 44. 🔥 Reto adicional — Exhaustive checking

Crea:

```ts
function assertNever(
  valor: never
): never
```

Después úsala en:

```ts
mapearResultadoAHttp(...)
```

dentro de un:

```ts
default
```

Cuando funcione, agrega temporalmente una nueva variante:

```ts
{
  status: "validation-error";
}
```

a:

```ts
CrearDispositivoResult
```

pero no agregues el nuevo `case`.

Observa qué error produce TypeScript.

Después elimina la variante temporal.

El objetivo es entender cómo `never` puede detectar casos no manejados.

---

## 45. Preguntas de comprensión

1. ¿Qué es una discriminated union?
2. ¿Qué función cumple el discriminante?
3. ¿Por qué el discriminante suele ser un literal type?
4. ¿Qué problema tiene `status: string` frente a `status: "success"`?
5. ¿Por qué un modelo con muchas propiedades opcionales puede permitir estados inválidos?
6. ¿Qué gana TypeScript cuando escribimos `state.status === "success"`?
7. ¿Qué ventaja tiene una discriminated union frente a `loading: boolean`, `data?` y `error?`?
8. ¿Por qué este patrón funciona bien con `switch`?
9. ¿Qué significa exhaustive checking?
10. ¿Qué representa `never` cuando todos los casos ya fueron manejados?
11. ¿Qué ocurre si agregamos una nueva variante y olvidamos actualizar un `switch` con `assertNever`?
12. ¿Por qué un Service puede devolver `created | duplicate | forbidden` en lugar de códigos HTTP?
13. ¿Qué capa debe convertir `duplicate` en HTTP 409?
14. ¿Las discriminated unions validan JSON recibido desde una API?
15. ¿Qué papel tendrá Zod antes de confiar en un discriminante recibido por HTTP?
16. ¿Cuándo preferirías un custom type predicate frente a comprobar directamente un discriminante?
17. ¿Qué significa el principio “Make invalid states unrepresentable”?
18. ¿Dónde usarías discriminated unions dentro de una aplicación React?
19. ¿Dónde podrían usarse dentro de Node.js?
20. ¿Cómo aplicarías este patrón a un parser de configuraciones de red?

---

## 46. Relevancia para entrevista técnica

Una pregunta común:

> **What is a discriminated union in TypeScript?**

Una respuesta sólida:

> A discriminated union is a union of object types that share a common property with distinct literal values. TypeScript can use that property to narrow the union safely and expose the properties associated with each variant.

Otra pregunta:

> **Why are discriminated unions useful for UI state?**

Respuesta conceptual:

> They allow each UI state to define exactly the data it requires. For example, a success state can require data while an error state requires an error message, which prevents invalid combinations and reduces optional-property checks.

Otra:

> **What is exhaustive checking?**

Respuesta:

> Exhaustive checking ensures that every member of a union has been handled. A common pattern uses `never` in the default branch of a switch so that adding a new union member produces a compile-time error until the new case is handled.

Otra muy importante:

> **Do discriminated unions validate API responses at runtime?**

Respuesta:

> No. They provide compile-time modeling and narrowing. External data still requires runtime validation before it can be trusted.

---

## 47. Cómo explicarlo usando tu proyecto

Podrías decir en una entrevista:

> In SiteOps Tracker, my fictional infrastructure-audit portfolio application, I can model different network devices as a discriminated union using a `tipo` field. Routers, switches, and firewalls can each expose only the properties that belong to that device type. When I check the discriminator, TypeScript narrows the object automatically. I can also use exhaustive checking so that if I later add another device type, the compiler helps me find logic that must be updated.

Y para React:

> I also use the same pattern for asynchronous UI state. Instead of combining a loading boolean with optional data and error properties, I model idle, loading, success, and error as separate variants. This prevents inconsistent states such as having success data and an error at the same time.

Eso demuestra que entiendes el patrón tanto a nivel sintáctico como arquitectónico.

---

## 48. Relación con tus proyectos

### SiteOps Tracker

Puedes modelar:

```text
router
switch
firewall
access-point
```

como variantes seguras.

### Repositorio de algoritmos

Las discriminated unions pueden modelar nodos, tokens, operaciones o resultados con diferentes formas.

### Analizador de configuraciones de red

Es uno de los mejores casos de uso.

Puedes representar:

```text
hostname command
interface command
description command
ip command
```

como variantes distintas de un parser.

### SDK tipado para una API

Puedes representar respuestas:

```text
success
error
rate-limit
unauthorized
```

aunque los datos externos deben validarse antes.

### API REST Node.js + TypeScript + PostgreSQL

Puedes representar resultados de casos de uso:

```text
created
duplicate
not-found
forbidden
```

y dejar que el Controller traduzca esos resultados a HTTP.

### Aplicación Full Stack React

Puedes usar discriminated unions para:

```text
idle
loading
success
error
```

sin llenar el estado de propiedades opcionales.

---

## 49. Resumen

Una discriminated union combina:

```text
union types
+
literal types
+
narrowing
```

Ejemplo:

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

El discriminante:

```ts
status
```

permite:

```ts
if (resultado.status === "success") {
  resultado.data;
}
```

sin assertions.

El patrón ayuda a:

```text
evitar estados inválidos
reducir propiedades opcionales
mejorar autocompletado
hacer narrowing automático
manejar variantes de dominio
hacer exhaustive checking
```

Y recuerda:

```text
Discriminated Union
→ modela estados válidos

Zod
→ valida datos reales

Service
→ reglas de negocio

Controller
→ HTTP
```

La arquitectura sigue siendo:

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

Los discriminantes de TypeScript desaparecen como información de tipos al compilar.

Si el discriminante proviene de:

```text
HTTP
formularios
API externa
archivo
variables de entorno
base de datos
```

debe existir una validación runtime que confirme que el valor real pertenece a las variantes permitidas.

---

## Próxima lección

**Lección 11 — `unknown`, `any` y `never`: diferencias, riesgos y uso profesional.**
