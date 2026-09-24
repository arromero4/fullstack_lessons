# Lección 9 — Type Predicates: Type Guards personalizados con `value is Type`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración objetivo:** 15–20 minutos.

En la Lección 8 aprendiste a hacer *narrowing* con comprobaciones que TypeScript ya entiende, como `typeof`, `in`, `instanceof`, igualdad y comprobaciones contra `null`. Ahora vamos a dar el siguiente paso: **encapsular algunas de esas comprobaciones en funciones reutilizables capaces de comunicarle a TypeScript qué tipo tiene un valor cuando la comprobación tiene éxito**.

Ese mecanismo se llama **type predicate** y se escribe con una forma como:

```ts
value is Type
```

Es especialmente útil cuando una condición de narrowing empieza a repetirse, cuando quieres expresar una regla de dominio con un nombre claro o cuando necesitas filtrar colecciones conservando información de tipos.

Hay una advertencia fundamental desde el principio: un type predicate es una **promesa que tu función le hace al compilador**. TypeScript no verifica que la implementación realmente demuestre todo lo que promete el predicado. Por eso un type guard personalizado mal implementado puede introducir una falsa sensación de seguridad.

---

## 1. Objetivo

Al terminar esta lección debes poder:

- explicar qué es un type predicate;
- escribir funciones con retornos como `value is Router`;
- entender cómo un type predicate participa en el narrowing;
- diferenciar un type guard incorporado de uno personalizado;
- reutilizar reglas de narrowing sin repetir condiciones;
- usar type predicates con `unknown`, unions y arrays;
- reconocer cuándo un type predicate es demasiado débil o peligroso;
- entender por qué `as` no sustituye una comprobación real;
- aplicar type predicates a SiteOps Tracker y al analizador de configuraciones;
- relacionarlos con React, Node.js, Services, Repositories y manejo de datos externos;
- distinguir claramente **type checking de TypeScript**, **type guards runtime** y **schema validation**.

---

## 2. El problema: repetir lógica de narrowing

Retomemos una unión parecida a la de la lección anterior:

```ts
type Router = {
  hostname: string;
  rutas: number;
};

type Switch = {
  hostname: string;
  vlans: number;
};

type Dispositivo = Router | Switch;
```

Podemos distinguir un router así:

```ts
function describirDispositivo(
  dispositivo: Dispositivo
): string {
  if ("rutas" in dispositivo) {
    return `${dispositivo.hostname} tiene ${dispositivo.rutas} rutas`;
  }

  return `${dispositivo.hostname} tiene ${dispositivo.vlans} VLANs`;
}
```

Esto funciona.

Pero imagina que necesitas reconocer routers en:

- una función que genera un reporte;
- otra que calcula estadísticas;
- otra que construye una respuesta HTTP;
- otra que filtra dispositivos;
- otra que prepara datos para React.

Podrías repetir:

```ts
"rutas" in dispositivo
```

en todas partes.

Eso no siempre es grave, pero si la regla de identificación crece o tiene significado de dominio, conviene encapsularla.

Queremos poder escribir algo como:

```ts
if (esRouter(dispositivo)) {
  console.log(dispositivo.rutas);
}
```

Y queremos que TypeScript comprenda que, dentro del `if`, `dispositivo` es un `Router`.

Ahí aparecen los **type predicates**.

---

## 3. Una función que devuelve `boolean` no siempre conserva el narrowing

Podríamos comenzar así:

```ts
function esRouter(
  dispositivo: Dispositivo
): boolean {
  return "rutas" in dispositivo;
}
```

La función ejecuta una comprobación real y devuelve `true` o `false`.

Conceptualmente:

```text
Dispositivo
 ↓
esRouter(...)
 ↓
boolean
```

Pero nuestro objetivo no es únicamente obtener un booleano.

También queremos comunicarle al sistema de tipos:

```text
si esta función devuelve true,
trata este valor como Router
```

Para expresar explícitamente esa relación podemos utilizar un type predicate.

---

## 4. Sintaxis de un type predicate

La sintaxis básica es:

```ts
function esRouter(
  dispositivo: Dispositivo
): dispositivo is Router {
  return "rutas" in dispositivo;
}
```

Observa el tipo de retorno:

```ts
dispositivo is Router
```

No estamos escribiendo:

```ts
: boolean
```

aunque en runtime la función sigue devolviendo un booleano.

Estamos diciendo además:

> Si `esRouter(dispositivo)` devuelve `true`, TypeScript puede tratar `dispositivo` como `Router` en esa rama del flujo.

Uso:

```ts
function imprimirDetalle(
  dispositivo: Dispositivo
): void {
  if (esRouter(dispositivo)) {
    console.log(dispositivo.rutas);
    return;
  }

  console.log(dispositivo.vlans);
}
```

Dentro del `if`:

```text
dispositivo
↓
Router
```

Después de descartar `Router`, en este caso:

```text
dispositivo
↓
Switch
```

---

## 5. ¿Qué significa exactamente `dispositivo is Router`?

Esta línea:

```ts
dispositivo is Router
```

no crea un nuevo objeto.

Tampoco convierte el objeto.

Tampoco agrega propiedades.

Tampoco valida mágicamente los datos.

Describe una relación entre:

```text
resultado booleano
+
tipo del parámetro
```

Podemos pensarlo así:

```text
esRouter(dispositivo) === true
                ↓
TypeScript acepta:
dispositivo es Router
```

En JavaScript compilado, el type predicate desaparece.

Lo que permanece es la comprobación runtime que escribiste dentro de la función.

---

## 6. Compile time vs runtime

Esta distinción es crítica.

Código TypeScript:

```ts
function esRouter(
  dispositivo: Dispositivo
): dispositivo is Router {
  return "rutas" in dispositivo;
}
```

La parte:

```ts
dispositivo is Router
```

pertenece al sistema de tipos.

Después de compilar, esa anotación desaparece.

La comprobación:

```ts
"rutas" in dispositivo
```

sí es JavaScript real y se ejecuta en runtime.

Conceptualmente:

```text
dispositivo is Router
        ↓
compile time
        ↓
desaparece
```

mientras:

```text
"rutas" in dispositivo
        ↓
runtime
        ↓
sí se ejecuta
```

Este patrón vuelve a reforzar una regla central de nuestra ruta:

> **Los tipos de TypeScript no existen como mecanismo de validación en producción.**

---

## 7. ¿Por qué existen los type predicates?

Principalmente para encapsular lógica de narrowing y hacerla reutilizable.

Sin type guard personalizado:

```ts
if ("rutas" in dispositivo) {
  // ...
}
```

Con type guard personalizado:

```ts
if (esRouter(dispositivo)) {
  // ...
}
```

La segunda versión puede expresar mejor la intención.

En vez de preguntar:

```text
¿el objeto tiene una propiedad llamada rutas?
```

el código pregunta:

```text
¿este dispositivo es un router?
```

Eso puede mejorar la legibilidad cuando la regla tiene significado en el dominio.

---

## 8. Cuándo usar un type predicate

Es una buena opción cuando:

- una misma comprobación de tipo se reutiliza;
- la comprobación tiene un significado de dominio;
- quieres aislar lógica de narrowing;
- trabajas con `unknown` y necesitas demostrar propiedades antes de usar un valor;
- filtras arrays y quieres conservar el tipo resultante;
- una condición inline se ha vuelto difícil de leer.

Ejemplo:

```ts
if (
  "rutas" in dispositivo &&
  dispositivo.rutas > 0
) {
  // ...
}
```

Si esa regla se repite y realmente significa algo concreto en tu dominio, puede merecer una función con nombre.

---

## 9. Cuándo NO usarlo

No necesitas crear una función para cada comprobación trivial.

Esto:

```ts
if (typeof valor === "string") {
  return valor.toUpperCase();
}
```

es perfectamente claro.

Crear:

```ts
function esString(
  valor: string | number
): valor is string {
  return typeof valor === "string";
}
```

puede ser innecesario si solo se utiliza una vez y no aporta significado adicional.

La abstracción debe reducir complejidad, no aumentarla.

---

## 10. Type predicate con `unknown`

Ahora viene un caso especialmente importante.

Supongamos:

```ts
function esString(
  valor: unknown
): valor is string {
  return typeof valor === "string";
}
```

Uso:

```ts
function imprimirValor(
  valor: unknown
): void {
  if (esString(valor)) {
    console.log(valor.toUpperCase());
    return;
  }

  console.log("No es un string");
}
```

Antes:

```text
valor
↓
unknown
```

Después de:

```ts
esString(valor)
```

en la rama verdadera:

```text
valor
↓
string
```

Esto demuestra cómo un type predicate puede ayudarnos a atravesar una frontera desde `unknown` hacia un tipo más específico.

---

## 11. Pero `unknown` no significa automáticamente “dato validado”

Supón que recibes:

```ts
const body: unknown = obtenerDatosExternos();
```

Puedes comprobar manualmente algunas cosas.

Pero un objeto de producción podría necesitar validar:

```text
hostname
ip
tipo
estado
modelo
ubicacion
puerto
fecha
```

Escribir toda esa validación manualmente es posible, pero rápidamente se vuelve extensa y difícil de mantener.

Por eso distinguiremos:

```text
Type Predicate
→ narrowing reutilizable

Zod
→ validación estructurada de contratos externos
```

Los type predicates son útiles, pero **no vamos a reconstruir manualmente una biblioteca de schema validation**.

---

## 12. Un type guard de objetos requiere cuidado

Imagina que queremos comprobar si un `unknown` parece ser un router.

Primero necesitamos saber que tenemos un objeto no nulo.

Una función auxiliar podría ser:

```ts
function esObjeto(
  valor: unknown
): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null
  );
}
```

Aquí usamos:

```ts
Record<string, unknown>
```

para representar un objeto cuyas claves son strings y cuyos valores todavía no consideramos confiables.

Después podríamos comenzar otra comprobación:

```ts
function tieneHostname(
  valor: unknown
): valor is { hostname: string } {
  return (
    esObjeto(valor) &&
    "hostname" in valor &&
    typeof valor.hostname === "string"
  );
}
```

Observa algo importante:

```text
unknown
 ↓
esObjeto
 ↓
Record<string, unknown>
 ↓
"hostname" in valor
 ↓
comprobamos typeof
 ↓
hostname: string
```

El narrowing ocurre por etapas.

---

## 13. Un type predicate puede mentir ⚠️

Esta es probablemente la parte más importante de la lección.

Considera:

```ts
type Router = {
  hostname: string;
  rutas: number;
};
```

Ahora alguien escribe:

```ts
function esRouter(
  valor: unknown
): valor is Router {
  return true;
}
```

TypeScript permite usar la firma como promesa de tipo.

Pero la implementación es falsa.

Entonces:

```ts
const dato: unknown = {
  mensaje: "hola"
};

if (esRouter(dato)) {
  console.log(dato.hostname.toUpperCase());
}
```

TypeScript puede creer que `dato.hostname` existe.

En runtime, eso puede fallar.

Por eso:

> Un type predicate **no demuestra por sí solo que la implementación sea correcta**.

La calidad del narrowing depende de que la condición runtime realmente corresponda al tipo prometido.

---

## 14. Otro type guard demasiado débil

Supón:

```ts
type Router = {
  hostname: string;
  rutas: number;
};
```

Y escribes:

```ts
function esRouter(
  valor: unknown
): valor is Router {
  return (
    typeof valor === "object" &&
    valor !== null &&
    "hostname" in valor
  );
}
```

Eso solo demuestra que existe una propiedad llamada `hostname`.

No demuestra:

```text
hostname es string
rutas existe
rutas es number
```

Por tanto, el predicado promete más de lo que realmente comprueba.

Ese es un bug de diseño.

---

## 15. Una comprobación manual más consistente

Podríamos escribir:

```ts
type Router = {
  hostname: string;
  rutas: number;
};

function esRouter(
  valor: unknown
): valor is Router {
  if (
    typeof valor !== "object" ||
    valor === null
  ) {
    return false;
  }

  if (
    !("hostname" in valor) ||
    typeof valor.hostname !== "string"
  ) {
    return false;
  }

  if (
    !("rutas" in valor) ||
    typeof valor.rutas !== "number"
  ) {
    return false;
  }

  return true;
}
```

Ahora la implementación comprueba las propiedades que promete.

Pero observa cuánto código aparece para un objeto muy pequeño.

Eso nos prepara para entender por qué más adelante usaremos Zod para fronteras externas.

---

## 16. Aplicación al analizador de configuraciones de red

Imagina que tu analizador procesa líneas previamente clasificadas:

```ts
type LineaHostname = {
  tipo: "hostname";
  valor: string;
};

type LineaInterface = {
  tipo: "interface";
  nombre: string;
};

type LineaConfiguracion =
  | LineaHostname
  | LineaInterface;
```

Podemos crear:

```ts
function esLineaHostname(
  linea: LineaConfiguracion
): linea is LineaHostname {
  return linea.tipo === "hostname";
}
```

Uso:

```ts
function procesarLinea(
  linea: LineaConfiguracion
): void {
  if (esLineaHostname(linea)) {
    console.log(
      `Hostname detectado: ${linea.valor}`
    );
    return;
  }

  console.log(
    `Interfaz detectada: ${linea.nombre}`
  );
}
```

Aquí el type predicate expresa una regla de dominio clara:

```text
esLineaHostname
```

---

## 17. Type predicates y discriminantes

En el ejemplo anterior usamos:

```ts
linea.tipo === "hostname"
```

Ese campo:

```ts
tipo
```

funciona como **discriminante**.

Todavía no vamos a desarrollar completamente las *discriminated unions*; tendrán su propia lección.

Por ahora quédate con esta idea:

```text
propiedad común
+
valor literal diferente
=
forma muy segura de distinguir variantes
```

El type predicate puede encapsular esa comprobación.

---

## 18. Type predicates con arrays

Aquí aparece un uso muy práctico.

Tenemos:

```ts
type Router = {
  hostname: string;
  rutas: number;
};

type Switch = {
  hostname: string;
  vlans: number;
};

type Dispositivo = Router | Switch;
```

Y:

```ts
const dispositivos: Dispositivo[] = [
  {
    hostname: "router-core-01",
    rutas: 24
  },
  {
    hostname: "switch-core-01",
    vlans: 12
  },
  {
    hostname: "router-edge-01",
    rutas: 8
  }
];
```

Creamos:

```ts
function esRouter(
  dispositivo: Dispositivo
): dispositivo is Router {
  return "rutas" in dispositivo;
}
```

Ahora:

```ts
const routers = dispositivos.filter(esRouter);
```

TypeScript puede inferir:

```ts
routers
```

como:

```ts
Router[]
```

Esto es muy útil.

---

## 19. ¿Por qué `Router[]` importa?

Porque después:

```ts
routers.forEach((router) => {
  console.log(router.rutas);
});
```

No necesitamos volver a preguntar si cada elemento es un router.

El filtrado ya redujo la colección.

Conceptualmente:

```text
Dispositivo[]
 ↓
filter(esRouter)
 ↓
Router[]
```

Este patrón aparecerá mucho en transformación de datos.

---

## 20. Aplicación a SiteOps Tracker

Supón que una vista necesita mostrar únicamente routers.

El backend o frontend podría partir de:

```ts
Dispositivo[]
```

y obtener:

```ts
Router[]
```

con:

```ts
const routers =
  dispositivos.filter(esRouter);
```

Después React podría renderizar:

```tsx
{routers.map((router) => (
  <li key={router.hostname}>
    {router.hostname} — {router.rutas} rutas
  </li>
))}
```

La UI recibe un conjunto ya reducido.

Esto evita comprobaciones repetidas dentro del render.

---

## 21. Relación con React

Supón que un componente recibe:

```ts
type Resultado =
  | Dispositivo
  | null;
```

Podríamos tener:

```ts
function esDispositivo(
  valor: Resultado
): valor is Dispositivo {
  return valor !== null;
}
```

Después:

```tsx
if (!esDispositivo(resultado)) {
  return <p>No encontrado</p>;
}

return (
  <p>{resultado.hostname}</p>
);
```

Aquí el guard encapsula la regla:

```text
resultado !== null
```

Aunque en este caso concreto una comprobación inline también sería perfectamente razonable.

La pregunta siempre es:

> ¿La función mejora realmente la claridad o reutilización?

---

## 22. Relación con Node.js

Imagina un Service:

```ts
type ResultadoRepository =
  | Dispositivo
  | null;
```

Podríamos escribir:

```ts
function existeDispositivo(
  dispositivo: ResultadoRepository
): dispositivo is Dispositivo {
  return dispositivo !== null;
}
```

Y usar:

```ts
const dispositivo =
  await repository.findById(id);

if (!existeDispositivo(dispositivo)) {
  throw new Error(
    "Dispositivo no encontrado"
  );
}

console.log(dispositivo.hostname);
```

Pero nuevamente: para una sola comprobación `!== null`, probablemente el guard sea innecesario.

No queremos crear abstracciones ceremoniales.

---

## 23. Type predicate vs `as`

Compara estas dos aproximaciones.

### Assertion

```ts
const router = dispositivo as Router;
```

Esto significa aproximadamente:

```text
“TypeScript, confía en mí.”
```

No ejecuta una comprobación.

### Type guard

```ts
if (esRouter(dispositivo)) {
  console.log(dispositivo.rutas);
}
```

Aquí existe una condición runtime.

Conceptualmente:

```text
as
→ afirmación del programador

type guard
→ comprobación runtime + información para TypeScript
```

Siempre que puedas demostrar el tipo de manera segura, es preferible hacerlo en lugar de forzar una assertion.

---

## 24. Type predicate vs Zod

Esta comparación será central en backend.

### Type predicate

Ejemplo:

```ts
function esString(
  valor: unknown
): valor is string {
  return typeof valor === "string";
}
```

Excelente para:

- narrowing pequeño;
- reglas reutilizables;
- comprobaciones de dominio;
- arrays;
- control flow.

### Zod

Más adelante escribiremos esquemas conceptualmente parecidos a:

```ts
const crearDispositivoSchema = z.object({
  hostname: z.string(),
  ip: z.string()
});
```

Zod está diseñado para validar estructuras externas completas.

Por ejemplo:

```text
HTTP body
variables de entorno
archivo JSON
API externa
formularios
```

La idea será:

```text
unknown
 ↓
Zod
 ↓
dato validado
 ↓
TypeScript
```

---

## 25. La frontera de confianza

En una aplicación profesional conviene pensar en **trust boundaries**.

Antes de validar:

```text
Internet
 ↓
HTTP
 ↓
datos no confiables
```

Después de runtime validation:

```text
Controller
 ↓
datos validados
 ↓
Service
```

El Service no debería estar continuamente preguntando:

```text
¿hostname realmente es string?
¿ip realmente existe?
```

La capa de validación debe garantizar el contrato antes de que los datos entren a la lógica de negocio.

---

## 26. Arquitectura Full Stack

Seguimos construyendo mentalmente:

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

Presenta UI, captura interacción y administra estado del cliente.

### HTTP

Es la frontera de comunicación. Los datos que viajan por ella no adquieren seguridad de tipos solo porque ambos proyectos estén escritos en TypeScript.

### Node

Ejecuta el backend.

### Router

Relaciona:

```text
método + URL
```

con un handler.

Ejemplo futuro:

```text
POST /devices
```

### Controller

Traduce la petición HTTP hacia una operación de aplicación y construye la respuesta HTTP.

### Runtime Validation

Comprueba que los datos externos realmente tengan la estructura esperada.

Aquí usaremos Zod.

### Service

Implementa reglas y casos de uso.

Ejemplo:

```text
crear dispositivo
```

### Repository

Aísla el acceso a persistencia.

Ejemplo:

```text
findById
save
findAll
```

### PostgreSQL

Persiste los datos.

Los type predicates pueden aparecer en distintas capas, pero **no reemplazan ninguna de estas responsabilidades**.

---

## 27. ¿Dónde encajan los type predicates en esa arquitectura?

Algunos ejemplos:

```text
React
→ filtrar variantes de datos para renderizar

Controller
→ narrowing auxiliar de valores ya inspeccionados

Service
→ distinguir resultados o variantes del dominio

Repository
→ trabajar con resultados opcionales

Parser
→ clasificar estructuras internas

Error handling
→ unknown → Error
```

Pero para:

```text
req.body
process.env
respuesta de API externa
archivo JSON
```

la estrategia principal será:

```text
runtime schema validation
```

no una colección improvisada de assertions.

---

## 28. Ejercicio principal — Type predicate para SiteOps Tracker

Crea:

```text
09-type-predicates.ts
```

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

type Dispositivo =
  | Router
  | Switch;
```

### Parte 1

Crea:

```ts
function esRouter(
  dispositivo: Dispositivo
): dispositivo is Router
```

La función debe identificar un router usando una propiedad diferenciadora.

Pista:

```ts
"rutas" in dispositivo
```

### Parte 2

Crea:

```ts
function obtenerDescripcion(
  dispositivo: Dispositivo
): string
```

Usa:

```ts
esRouter(dispositivo)
```

Si es router, devuelve:

```text
router-core-01 | 24 rutas
```

Si es switch:

```text
switch-core-01 | 12 VLANs
```

No uses:

```ts
as Router
as Switch
any
```

---

## 29. Ejercicio con arrays

Usa:

```ts
const dispositivos: Dispositivo[] = [
  {
    hostname: "router-core-01",
    rutas: 24
  },
  {
    hostname: "switch-core-01",
    vlans: 12
  },
  {
    hostname: "router-edge-01",
    rutas: 8
  }
];
```

Obtén:

```ts
const routers = // ...
```

utilizando:

```ts
filter
```

y tu función:

```ts
esRouter
```

Después recorre `routers` e imprime:

```text
router-core-01 | 24 rutas
router-edge-01 | 8 rutas
```

Observa en VS Code qué tipo infiere TypeScript para:

```ts
routers
```

Tu objetivo es comprobar que termine siendo:

```ts
Router[]
```

---

## 30. 🔥 Reto — Validar una estructura `unknown`

Ahora subimos ligeramente la dificultad.

Crea:

```ts
function esRouterDesconocido(
  valor: unknown
): valor is Router
```

Debe devolver `true` únicamente si puede comprobar que:

```text
valor es un objeto
valor no es null
hostname existe
hostname es string
rutas existe
rutas es number
```

No uses:

```ts
as
any
```

Pistas:

```ts
typeof valor === "object"
```

```ts
valor !== null
```

```ts
"hostname" in valor
```

```ts
typeof valor.hostname === "string"
```

No te doy la función completa: quiero que construyas el narrowing paso a paso.

---

## 31. 🔥 Reto Full Stack — frontera HTTP simulada

Simula un dato que llegó desde una API:

```ts
const body: unknown = {
  hostname: "router-core-01",
  rutas: 24
};
```

Tu flujo debe ser:

```text
body: unknown
 ↓
esRouterDesconocido(body)
 ↓
Router
 ↓
función de dominio
```

Crea:

```ts
function procesarRouter(
  router: Router
): string
```

que devuelva:

```text
Procesando router-core-01 con 24 rutas
```

Solo puedes llamar a `procesarRouter(body)` después de que el guard haya demostrado que el valor es `Router`.

Después cambia `body` manualmente por:

```ts
const body: unknown = {
  hostname: 500,
  rutas: "muchas"
};
```

y comprueba que tu guard devuelva `false`.

Este ejercicio simula una frontera externa, pero recuerda: cuando construyamos la API real, para contratos HTTP completos utilizaremos Zod.

---

## 32. Errores comunes

### Error 1 — Confundir el predicate con una conversión

```ts
valor is Router
```

no transforma `valor`.

Solo informa a TypeScript sobre el resultado de una comprobación.

### Error 2 — Escribir un guard que siempre devuelve `true`

```ts
function esRouter(
  valor: unknown
): valor is Router {
  return true;
}
```

Esto destruye la confianza del sistema de tipos.

### Error 3 — Comprobar menos de lo que prometes

Si prometes:

```ts
valor is Router
```

pero solo compruebas:

```ts
"hostname" in valor
```

no has demostrado que el objeto cumpla todo `Router`.

### Error 4 — Usar `as` dentro del guard para evitar el narrowing

Evita convertir el ejercicio en:

```ts
const router = valor as Router;
```

La idea es demostrar el tipo mediante condiciones reales.

### Error 5 — Crear guards para todo

No conviertas:

```ts
typeof valor === "string"
```

en una función separada si no mejora reutilización o claridad.

### Error 6 — Creer que TypeScript valida HTTP

Una firma como:

```ts
function crear(
  input: CrearDispositivoInput
)
```

solo protege llamadas que TypeScript puede analizar.

No impide que un cliente externo envíe JSON incorrecto.

### Error 7 — Usar guards manuales complejos donde corresponde un schema

Si estás escribiendo decenas de comprobaciones para cada request HTTP, probablemente necesitas una herramienta de runtime validation.

En nuestra ruta esa herramienta será Zod.

---

## 33. Preguntas de comprensión

1. ¿Qué es un type predicate?
2. ¿Qué significa `dispositivo is Router`?
3. ¿La expresión `value is Type` existe en JavaScript después de compilar?
4. ¿Qué parte de un type guard sí se ejecuta en runtime?
5. ¿Por qué una función `boolean` y una función con type predicate no comunican exactamente la misma intención al sistema de tipos?
6. ¿Cuándo conviene extraer un guard personalizado?
7. ¿Cuándo una comprobación inline es mejor?
8. ¿Por qué un type predicate puede “mentirle” a TypeScript?
9. ¿Qué problema tiene un guard que comprueba solo `hostname` pero promete `Router`?
10. ¿Qué ventaja obtenemos al usar `filter(esRouter)`?
11. ¿Qué tipo debería inferirse para el resultado de filtrar únicamente routers?
12. ¿Qué diferencia existe entre `as Router` y `esRouter(valor)`?
13. ¿Por qué `unknown` es una entrada apropiada para datos cuya estructura todavía no conocemos?
14. ¿Un type predicate reemplaza Zod?
15. ¿En qué punto de `React → HTTP → Node → Router → Controller → Runtime Validation → Service → Repository → PostgreSQL` debemos establecer la confianza sobre un body HTTP?
16. ¿Por qué el Service debería recibir datos ya validados?
17. ¿Qué ocurre con interfaces, aliases y type predicates al compilar a JavaScript?
18. ¿Qué riesgo introduce un type guard incorrectamente implementado?

---

## 34. Relevancia para entrevista técnica

Una pregunta frecuente es:

> **What is a type predicate in TypeScript?**

Una buena respuesta conceptual:

> A type predicate is a return type such as `value is SomeType` used by a custom type guard. When the function returns true, TypeScript can narrow the checked value to that type within the corresponding control-flow branch.

También pueden preguntarte:

> **What's the difference between a type assertion and a type guard?**

Respuesta conceptual:

> A type assertion tells the compiler to treat a value as a specific type without performing runtime validation. A type guard performs a runtime check and allows TypeScript to narrow the value based on that check.

Otra importante:

> **Are custom type guards always safe?**

Respuesta:

> No. TypeScript trusts the type predicate declared by the function, so the implementation must actually verify the conditions required by the promised type. An incorrect guard can make unsafe data appear type-safe.

Y una pregunta muy relacionada con backend:

> **Would you use custom type guards instead of schema validation for an HTTP request body?**

Respuesta conceptual:

> Custom type guards can validate simple values, but for complete external contracts I would normally use runtime schema validation, such as Zod, because TypeScript types are erased at runtime and external data cannot be trusted.

---

## 35. Cómo explicarlo en una entrevista con tu proyecto

Podrías explicar un caso de SiteOps Tracker así:

> In SiteOps Tracker, my fictional infrastructure-audit portfolio application, a device can be represented by different variants such as routers and switches. I can use a custom type guard with a type predicate to identify a router and let TypeScript narrow the union safely. This is useful when filtering or processing already modeled domain data. For external HTTP payloads, however, I would validate the complete request at runtime before passing it to the service layer.

Esta respuesta demuestra que entiendes dos cosas diferentes:

```text
TypeScript control-flow safety
```

y:

```text
runtime trust boundaries
```

Esa distinción es mucho más importante que simplemente memorizar la sintaxis `is`.

---

## 36. Relación con tus proyectos

### SiteOps Tracker

Podrás distinguir variantes de dispositivos y filtrar colecciones de forma segura.

### Repositorio de algoritmos en TypeScript

Los type predicates pueden ayudarte cuando un algoritmo procesa unions o estructuras heterogéneas.

### Analizador de configuraciones de red

Serán especialmente útiles para reconocer estructuras internas después de clasificar líneas o tokens.

### SDK tipado para una API

Ayudarán a manejar resultados que pueden adoptar distintas formas, aunque las respuestas externas seguirán necesitando validación runtime cuando no sean confiables.

### API REST Node.js + TypeScript + PostgreSQL

Los usarás como herramienta de narrowing, pero los requests HTTP completos pasarán por una capa de runtime validation.

### Aplicación Full Stack

React podrá trabajar con datos ya tipados y usar guards para distinguir estados o variantes sin recurrir a `as`.

---

## 37. Resumen

Un type predicate tiene esta forma:

```ts
function esRouter(
  dispositivo: Dispositivo
): dispositivo is Router {
  return "rutas" in dispositivo;
}
```

Su propósito es conectar:

```text
comprobación runtime
+
narrowing de TypeScript
```

Cuando devuelve `true`:

```text
Dispositivo
 ↓
Router
```

También puede utilizarse con:

```text
unknown
arrays
filter
unions
parsers
errores
variantes de dominio
```

Pero la regla más importante es:

```text
type predicate
=
promesa al compilador
```

Por eso la implementación debe comprobar realmente aquello que promete.

Recuerda además:

```text
as Router
→ no valida

esRouter(valor)
→ ejecuta una comprobación

Zod
→ valida contratos externos completos
```

Y nuestra frontera Full Stack sigue siendo:

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

Los tipos de TypeScript, incluyendo:

```text
type
interface
value is Type
```

desaparecen al compilar.

Los datos externos siguen siendo no confiables hasta que una comprobación runtime real establezca el contrato.

---

## Próxima lección

**Lección 10 — Discriminated Unions.**
