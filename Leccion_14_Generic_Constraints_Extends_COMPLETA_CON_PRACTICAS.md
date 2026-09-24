# Lección 14 — Generic Constraints con `extends`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración estimada:** 15–20 minutos  
**Etapa de la ruta:** TypeScript profundo  
**Ruta principal:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

---

## Introducción

En la Lección 13 aprendiste que los **generics** permiten escribir código reutilizable sin perder información de tipos.

Ejemplo:

```ts
function identidad<T>(valor: T): T {
  return valor;
}
```

Esto funciona muy bien cuando no necesitamos asumir nada sobre `T`.

Pero ahora aparece un problema distinto. Supón que queremos acceder a una propiedad concreta:

```ts
function obtenerId<T>(elemento: T): string {
  return elemento.id;
}
```

TypeScript marca error porque `T` podría ser cualquier cosa: `number`, `string`, `boolean`, `Date`, `Dispositivo` o `Auditoria`. No existe garantía de que todos tengan `id`.

Aquí entran los **Generic Constraints**.

Un generic constraint nos permite decir:

> `T` puede variar, pero debe cumplir como mínimo cierta estructura.

La sintaxis más importante es:

```ts
T extends ...
```

Esto será muy útil para helpers reutilizables, algoritmos, React, Services, Repositories, SDKs, testing y analizadores.

---

# 1. Objetivo

Al terminar esta lección debes poder:

- explicar qué problema resuelve un generic constraint;
- comprender qué significa `T extends ...`;
- restringir un generic a una estructura mínima;
- mantener propiedades adicionales del tipo concreto;
- utilizar `keyof`;
- comprender `K extends keyof T`;
- comprender `T[K]`;
- combinar constraints con varios parámetros genéricos;
- reconocer cuándo un constraint aporta valor;
- evitar constraints innecesarios o demasiado amplios;
- distinguir compile-time type safety de runtime validation;
- aplicar constraints a SiteOps Tracker;
- aplicarlos al analizador de configuraciones;
- aplicarlos a helpers de Repository;
- visualizar su uso futuro en React;
- explicar el concepto en entrevista técnica.

---

# 2. El problema sin constraints

Considera:

```ts
function obtenerId<T>(
  elemento: T
): string {
  return elemento.id;
}
```

TypeScript no puede garantizar `elemento.id` porque `T` puede ser cualquier tipo.

El contrato es demasiado amplio.

---

# 3. Primera solución con `extends`

Podemos restringir `T`:

```ts
function obtenerId<
  T extends { id: string }
>(
  elemento: T
): string {
  return elemento.id;
}
```

Ahora TypeScript sabe:

```text
T
↓
puede variar
↓
pero debe contener
↓
id: string
```

Ejemplo válido:

```ts
const dispositivo = {
  id: "DEV-001",
  hostname: "router-core-01",
  ip: "10.0.0.1"
};

const id = obtenerId(dispositivo);
```

Ejemplo inválido:

```ts
obtenerId({
  hostname: "router-core-01"
});
```

Falta `id`.

---

# 4. ¿Qué significa `extends` aquí?

En:

```ts
T extends { id: string }
```

`extends` no significa necesariamente herencia de clases.

Aquí significa:

> `T` debe ser compatible con una estructura que contenga `id: string`.

Por ejemplo:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
};

type Auditoria = {
  id: string;
  sitio: string;
  completada: boolean;
};
```

Ambos cumplen:

```ts
{ id: string }
```

---

# 5. Constraint = contrato mínimo

Piensa en:

```ts
T extends { id: string }
```

como:

```text
T debe tener como mínimo:
└── id: string

T puede tener además:
├── hostname
├── ip
├── sitio
├── completada
├── estado
└── otras propiedades
```

La restricción no describe todo el objeto. Solo describe lo mínimo que la función necesita.

---

# 6. ¿Por qué no usar directamente `{ id: string }`?

Podríamos hacer:

```ts
function devolverElemento(
  elemento: { id: string }
): { id: string } {
  return elemento;
}
```

Pero el tipo de retorno solo conserva `id`.

Con un generic:

```ts
function devolverElemento<
  T extends { id: string }
>(
  elemento: T
): T {
  return elemento;
}
```

Si entra:

```ts
const dispositivo = {
  id: "DEV-001",
  hostname: "router-core-01",
  ip: "10.0.0.1"
};
```

el resultado conserva `id`, `hostname` e `ip`.

La idea es:

```text
constraint
→ limita

generic
→ conserva
```

---

# 7. Aplicación a SiteOps Tracker

```ts
type Auditoria = {
  id: string;
  sitio: string;
  completada: boolean;
};

type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};

function buscarPorId<
  T extends { id: string }
>(
  elementos: T[],
  id: string
): T | undefined {
  return elementos.find(
    elemento => elemento.id === id
  );
}
```

La misma función puede trabajar con `Auditoria[]` y `Dispositivo[]` y conservar el tipo correcto.

---

# 8. Ejemplo con `Auditoria[]`

```ts
const auditorias: Auditoria[] = [
  {
    id: "AUD-001",
    sitio: "GDCJ",
    completada: false
  },
  {
    id: "AUD-002",
    sitio: "GDMY",
    completada: true
  }
];

const auditoria =
  buscarPorId(
    auditorias,
    "AUD-002"
  );
```

TypeScript infiere:

```text
Auditoria | undefined
```

Por eso puedes usar:

```ts
auditoria?.sitio;
auditoria?.completada;
```

---

# 9. Ejemplo con `Dispositivo[]`

```ts
const dispositivos: Dispositivo[] = [
  {
    id: "DEV-001",
    hostname: "router-core-01",
    ip: "10.0.0.1"
  }
];

const dispositivo =
  buscarPorId(
    dispositivos,
    "DEV-001"
  );
```

TypeScript conserva:

```text
Dispositivo | undefined
```

---

# 10. Ejemplo que debe fallar

```ts
const numeros = [1, 2, 3];

buscarPorId(
  numeros,
  "1"
);
```

Esto debe fallar porque `number` no cumple `{ id: string }`.

---

# 11. Constraint con un tipo nombrado

```ts
type ConId = {
  id: string;
};

function buscarPorId<
  T extends ConId
>(
  elementos: T[],
  id: string
): T | undefined {
  return elementos.find(
    elemento => elemento.id === id
  );
}
```

Puede ser más legible si reutilizas la misma restricción varias veces.

---

# 12. Constraint con `length`

```ts
type ConLongitud = {
  length: number;
};

function describirLongitud<
  T extends ConLongitud
>(
  valor: T
): string {
  return `Longitud: ${valor.length}`;
}
```

Funciona con:

```ts
describirLongitud(
  "router-core-01"
);
```

También:

```ts
describirLongitud([
  "router",
  "switch"
]);
```

Pero no con:

```ts
describirLongitud(42);
```

---

# 13. Structural Typing

TypeScript utiliza principalmente **structural typing**.

Un objeto no necesita declarar explícitamente `implements ConId` para cumplir el contrato.

Por ejemplo:

```ts
const equipo = {
  id: "DEV-001",
  hostname: "router-core-01"
};
```

Su estructura ya contiene `id: string`, por eso satisface el constraint.

---

# 14. El siguiente problema: claves dinámicas

Supón:

```ts
const dispositivo = {
  id: "DEV-001",
  hostname: "router-core-01",
  ip: "10.0.0.1"
};
```

Queremos permitir:

```ts
obtenerPropiedad(
  dispositivo,
  "hostname"
);
```

pero impedir:

```ts
obtenerPropiedad(
  dispositivo,
  "propiedadInventada"
);
```

Aquí aparece `keyof`.

---

# 15. `keyof`

Dado:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};
```

Esto:

```ts
keyof Dispositivo
```

produce conceptualmente:

```text
"id" | "hostname" | "ip"
```

`keyof` obtiene las claves conocidas de un tipo.

---

# 16. Generic constraint con `keyof`

```ts
function obtenerPropiedad<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): T[K] {
  return objeto[clave];
}
```

Tenemos:

```text
T
→ tipo del objeto

K
→ una clave válida de T

T[K]
→ tipo del valor de esa propiedad
```

---

# 17. Ejemplo paso a paso

```ts
const router = {
  hostname: "router-core-01",
  rutas: 24,
  activo: true
};
```

```ts
const hostname =
  obtenerPropiedad(
    router,
    "hostname"
  );
```

Resultado:

```text
string
```

```ts
const rutas =
  obtenerPropiedad(
    router,
    "rutas"
  );
```

Resultado:

```text
number
```

```ts
const activo =
  obtenerPropiedad(
    router,
    "activo"
  );
```

Resultado:

```text
boolean
```

---

# 18. Clave inválida

```ts
obtenerPropiedad(
  router,
  "vlans"
);
```

Debe fallar porque `"vlans"` no pertenece a `keyof typeof router`.

---

# 19. `T[K]`

`T[K]` es un **Indexed Access Type**.

Ejemplo:

```text
T = Dispositivo
K = "hostname"

T[K]
↓
Dispositivo["hostname"]
↓
string
```

Otro:

```text
T = Dispositivo
K = "rutas"

T[K]
↓
number
```

---

# 20. Ventaja frente a `any`

Versión insegura:

```ts
function obtenerPropiedad(
  objeto: any,
  clave: string
): any {
  return objeto[clave];
}
```

Permite propiedades inventadas y pierde el tipo del resultado.

Con `K extends keyof T` obtenemos:

```text
clave válida
+
retorno correcto
+
autocompletado
+
seguridad
```

---

# 21. Analizador de configuraciones de red

```ts
type InterfaceConfig = {
  name: string;
  description: string;
  enabled: boolean;
};

function leerCampo<
  T,
  K extends keyof T
>(
  config: T,
  campo: K
): T[K] {
  return config[campo];
}
```

Ejemplo:

```ts
const interfaz:
  InterfaceConfig = {
    name:
      "GigabitEthernet0/1",
    description:
      "Uplink principal",
    enabled: true
  };
```

```ts
const enabled =
  leerCampo(
    interfaz,
    "enabled"
  );
```

TypeScript sabe:

```text
enabled → boolean
```

---

# 22. Conexión con React

Podemos diseñar una lista reutilizable:

```ts
type ListaProps<
  T,
  K extends keyof T
> = {
  items: T[];
  keyField: K;
};
```

Para:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};
```

podemos escribir:

```ts
const props:
  ListaProps<
    Dispositivo,
    "id"
  > = {
    items: [],
    keyField: "id"
  };
```

Pero una clave inexistente debe ser rechazada.

---

# 23. Conexión con Repository

```ts
type EntidadConId = {
  id: string;
};

function indexarPorId<
  T extends EntidadConId
>(
  entidades: T[]
): Map<string, T> {
  const resultado =
    new Map<string, T>();

  for (
    const entidad
    of entidades
  ) {
    resultado.set(
      entidad.id,
      entidad
    );
  }

  return resultado;
}
```

Esto funciona con distintas entidades que tengan `id`.

---

# 24. Cuidado con abstraer demasiado

Podríamos intentar:

```ts
interface Repository<
  T extends { id: string }
> {
  findById(
    id: string
  ): Promise<T | null>;

  save(
    entity: T
  ): Promise<T>;
}
```

Pero debemos preguntar:

```text
¿todos los dominios
realmente comparten
estas operaciones?
```

`Usuario`, `Dispositivo`, `Auditoria` y `Hallazgo` pueden requerir contratos distintos.

No abstraigas solo porque TypeScript lo permite.

---

# 25. Constraint NO significa validación runtime

```ts
function procesar<
  T extends { id: string }
>(
  valor: T
): void {
  console.log(valor.id);
}
```

El constraint existe en TypeScript.

Después de compilar, `T`, `extends` y `{ id: string }` desaparecen como información de tipos.

Por tanto:

```text
Generic Constraint
≠
Runtime Validation
```

---

# 26. Datos HTTP

Un cliente puede enviar:

```json
{
  "id": 500,
  "hostname": false
}
```

No debemos hacer:

```ts
const dispositivo =
  req.body as Dispositivo;
```

Tampoco debemos asumir que:

```ts
procesar<Dispositivo>(
  req.body
);
```

valida algo.

El flujo profesional será:

```text
HTTP
↓
unknown
↓
Zod
↓
Dispositivo validado
↓
Service
```

---

# 27. TypeScript vs Zod

TypeScript:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
};
```

protege código durante desarrollo.

Zod comprobará el valor real en runtime.

```text
TypeScript
→ compile-time

Zod
→ runtime
```

---

# 28. Arquitectura Full Stack

La arquitectura objetivo continúa siendo:

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
↓
Testing
↓
Docker
↓
CI/CD
↓
Cloud
```

## React

Generics y constraints permiten crear componentes, hooks, listas, tablas, selects y helpers reutilizables sin perder tipos.

## HTTP

Transporta datos reales. No transporta `T`, `extends`, `keyof`, interfaces ni aliases de TypeScript.

## Node

Ejecuta JavaScript. Las anotaciones TypeScript ya fueron eliminadas.

## Router

Relaciona método y ruta con el handler correspondiente.

## Controller

Adapta datos HTTP al caso de uso.

## Runtime Validation

Comprueba estructura, tipos reales y valores permitidos antes de confiar en la información. Aquí utilizaremos Zod.

## Service

Aplica reglas de negocio sobre datos ya validados.

## Repository

Aísla persistencia. Puede usar helpers genéricos, pero no debe borrar diferencias importantes del dominio.

## PostgreSQL

Protege datos mediante tipos SQL, `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY` y transacciones.

## Testing

Verificará reglas, contratos, integraciones y flujos.

## Docker

Empaquetará runtime y dependencias.

## CI/CD

Automatizará lint, type checking, tests, build y deploy.

## Cloud

Ejecutará el sistema en infraestructura real.

---

# 29. Cuándo usar Generic Constraints

Son adecuados cuando:

- una función realmente trabaja con varios tipos;
- necesita una estructura mínima;
- quieres conservar el tipo concreto;
- una clave debe existir realmente;
- quieres relacionar parámetros genéricos.

Ejemplos:

```ts
T extends {
  id: string;
}
```

```ts
T extends {
  length: number;
}
```

```ts
K extends keyof T
```

---

# 30. Cuándo NO usarlos

Si una función pertenece exclusivamente a un dominio:

```ts
function cerrarAuditoria(
  auditoria: Auditoria
): Auditoria {
  return auditoria;
}
```

no necesitas convertirla artificialmente en un generic.

---

# 31. Error común: constraint demasiado débil

```ts
function obtenerId<
  T extends object
>(
  elemento: T
) {
  return elemento.id;
}
```

`object` no garantiza `id`.

Mejor:

```ts
T extends {
  id: string;
}
```

---

# 32. Error común: constraint demasiado fuerte

Si el helper solo necesita `id`, no exijas una entidad completa con fechas, owner y otras propiedades.

Principio:

> Exige el mínimo contrato necesario.

---

# 33. Error común: introducir `any`

Malo:

```ts
function obtenerCampo<
  T extends object
>(
  objeto: T,
  clave: any
): any {
  return (
    objeto as any
  )[clave];
}
```

Mejor:

```ts
function obtenerCampo<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): T[K] {
  return objeto[clave];
}
```

---

# 34. Error común: creer que `extends` valida JSON

Esto:

```ts
T extends {
  id: string;
}
```

NO valida runtime.

Esto:

```ts
respuesta as T
```

tampoco.

---

# 35. Error común: generic innecesario

```ts
function sumar<
  T extends number
>(
  a: T,
  b: T
): number {
  return a + b;
}
```

Probablemente basta:

```ts
function sumar(
  a: number,
  b: number
): number {
  return a + b;
}
```

---

# 36. EJERCICIO PRINCIPAL / PRÁCTICA 1 — Buscar por ID

Crea:

```text
14-generic-constraints.ts
```

Primero:

```ts
type ConId = {
  id: string;
};
```

Implementa:

```ts
function encontrarPorId<
  T extends ConId
>(
  elementos: T[],
  id: string
): T | undefined
```

## Requisitos

Crea:

```ts
type Auditoria = {
  id: string;
  sitio: string;
  estado:
    | "pendiente"
    | "completada";
};
```

También:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};
```

Crea dos auditorías y dos dispositivos. Después busca una auditoría y un dispositivo.

## Restricciones

No uses:

```text
any
as
unknown
```

## Pistas

Puedes utilizar:

```ts
Array.prototype.find()
```

Gracias al constraint, TypeScript sabe que `elemento.id` existe.

El retorno incluye `undefined` porque `find()` puede no encontrar nada.

## Qué debes observar

Con auditorías:

```text
Auditoria | undefined
```

Con dispositivos:

```text
Dispositivo | undefined
```

Ese es el objetivo:

```text
reutilización
+
tipo específico preservado
```

---

# 37. PRÁCTICA 2 — `keyof`

Implementa:

```ts
function leerPropiedad<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): T[K]
```

Usa:

```ts
const router = {
  hostname:
    "router-core-01",
  ip:
    "10.0.0.1",
  rutas:
    24,
  activo:
    true
};
```

Haz llamadas para:

```text
hostname
rutas
activo
```

Debes identificar:

```text
hostname → string
rutas     → number
activo    → boolean
```

Después intenta:

```ts
leerPropiedad(
  router,
  "vlans"
);
```

y analiza el error.

---

# 38. PRÁCTICA 3 — Analizador de configuraciones

Define:

```ts
type InterfaceConfig = {
  name: string;
  description: string;
  enabled: boolean;
};
```

Crea:

```ts
const interfaz:
  InterfaceConfig = {
    name:
      "GigabitEthernet0/1",
    description:
      "Uplink principal",
    enabled:
      true
  };
```

Reutiliza `leerPropiedad()` para obtener `name`, `description` y `enabled`.

Comprueba que TypeScript mantiene:

```text
string
string
boolean
```

respectivamente.

---

# 39. RETO 1 — React genérico

Diseña:

```ts
type ListaProps<
  T,
  K extends keyof T
> = {
  items: T[];
  keyField: K;
  renderText:
    (item: T) => string;
};
```

Usa:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};
```

Crea:

```ts
const listaDispositivos:
  ListaProps<
    Dispositivo,
    "id"
  >
```

con `items`, `keyField` y `renderText`.

Después intenta usar `serialNumber` como `keyField` sin agregarlo al tipo.

Explica por qué TypeScript lo rechaza.

No construyas JSX todavía.

---

# 40. RETO 2 — Repository / Node.js

Define:

```ts
type Entidad = {
  id: string;
};
```

Implementa:

```ts
function crearIndice<
  T extends Entidad
>(
  elementos: T[]
): Map<string, T>
```

La función debe producir:

```text
Map
├── key   → id
└── value → elemento completo
```

Prueba con `Auditoria[]` y `Dispositivo[]`.

Responde:

1. ¿Por qué `T` necesita `id`?
2. ¿Por qué `Map<string, T>` conserva la entidad concreta?
3. ¿Qué perderías usando `Map<string, any>`?
4. ¿Esta función valida datos HTTP?
5. ¿Qué capa debería validar antes?

---

# 41. RETO 3 — Arquitectura Full Stack

Considera:

```text
PATCH
/audits/AUD-001
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

Payload:

```json
{
  "estado":
    "completada"
}
```

Responde:

1. ¿Puede `T extends object` validar este JSON?
2. ¿Puede `as CambiarEstadoInput` validarlo?
3. ¿Qué responsabilidad tiene Zod?
4. ¿Qué responsabilidad tiene el Service?
5. ¿Qué responsabilidad tiene el Repository?
6. ¿Qué garantía puede aplicar PostgreSQL?
7. ¿En qué lugar sí podría ser útil un generic constraint?

---

# 42. RETO 4 — Diseñar una abstracción mínima

Imagina:

```ts
type Hallazgo = {
  id: string;
  descripcion: string;
  severidad:
    | "baja"
    | "media"
    | "alta";
};
```

Quieres reutilizar `encontrarPorId()`.

Pregunta:

```text
¿debes modificar
el constraint?
```

Analiza si `Hallazgo` ya satisface `ConId`.

Tu respuesta debe explicar por qué no es necesario conocer todas las propiedades del tipo.

---

# 43. Relación con el repositorio de algoritmos

Los constraints permiten escribir algoritmos genéricos que exigen una capacidad concreta.

```text
algoritmo
↓
trabaja con T
↓
T debe cumplir
una estructura mínima
↓
el tipo concreto
se conserva
```

Esto es más seguro que utilizar `any[]`.

---

# 44. Relación con el SDK tipado

Los SDKs pueden tener recursos que comparten `id` o `metadata`.

Los constraints pueden expresar esas relaciones.

Pero recuerda:

```text
API externa
↓
datos no confiables
↓
runtime validation
↓
recurso tipado
```

El constraint empieza a ser útil después de establecer confianza.

---

# 45. Relación con Testing

Más adelante podremos crear helpers como:

```ts
function obtenerIdFixture<
  T extends {
    id: string;
  }
>(
  fixture: T
): string {
  return fixture.id;
}
```

Pero los tests también deben evitar:

```ts
{} as T
```

porque puede crear fixtures imposibles.

---

# 46. Errores de code review

## Caso 1

```ts
function buscar<T>(
  item: T
) {
  return item.id;
}
```

Problema:

```text
T no garantiza id
```

## Caso 2

```ts
function buscar<
  T extends object
>(
  item: T
) {
  return item.id;
}
```

Problema:

```text
object tampoco
garantiza id
```

## Caso 3

```ts
function leer<
  T,
  K extends keyof T
>(
  item: T,
  key: K
): any {
  return item[key];
}
```

Problema:

```text
any destruye
la información
```

Mejor:

```ts
T[K]
```

## Caso 4

```ts
const body =
  req.body
  as Dispositivo;
```

Problema:

```text
assertion
≠
validación
```

## Caso 5

```ts
function procesar<
  T extends Dispositivo
>(
  dispositivo: T
): T {
  return dispositivo;
}
```

Pregunta:

```text
¿el generic
aporta algo?
```

Si no, usa el tipo concreto.

---

# 47. Checklist mental

Antes de crear un constraint, pregunta:

```text
1. ¿La operación funciona
   con varios tipos?

2. ¿Qué estructura mínima
   necesita?

3. ¿Necesito conservar
   el tipo concreto?

4. ¿El constraint
   es demasiado amplio?

5. ¿Exige más propiedades
   de las necesarias?

6. ¿Estoy usando any?

7. ¿Estoy usando
   assertions innecesarias?

8. ¿Estoy confundiendo
   compile time
   con runtime?

9. ¿Los datos externos
   fueron validados?
```

---

# 48. Preguntas de comprensión

1. ¿Qué problema resuelve un generic constraint?
2. ¿Qué significa `T extends { id: string }`?
3. ¿`extends` implica necesariamente herencia?
4. ¿Qué diferencia existe entre usar `{ id: string }` directamente y retornar `T`?
5. ¿Por qué el generic conserva propiedades adicionales?
6. ¿Qué significa pedir el contrato mínimo?
7. ¿Qué es structural typing?
8. ¿Qué produce `keyof Dispositivo`?
9. ¿Qué significa `K extends keyof T`?
10. ¿Qué representa `T[K]`?
11. ¿Por qué una clave inexistente es rechazada?
12. ¿Qué ventaja tiene frente a `clave: string`?
13. ¿Cuándo usarías `T extends { length: number }`?
14. ¿Qué es un constraint demasiado débil?
15. ¿Qué es un constraint demasiado fuerte?
16. ¿Por qué los generics innecesarios pueden empeorar el código?
17. ¿Un generic constraint existe en runtime?
18. ¿Puede validar `req.body`?
19. ¿Por qué `as T` no valida?
20. ¿Qué papel tendrá Zod?
21. ¿Cómo aplicarías constraints en React?
22. ¿Cómo aplicarías constraints en un Repository?
23. ¿Por qué no todos los Repositories deberían ser universales?
24. ¿Cómo aplicarías `keyof` en el analizador de configuraciones?
25. ¿Qué relación existe entre `T`, `K` y `T[K]`?

---

# 49. Relevancia para entrevistas

## What is a generic constraint in TypeScript?

> A generic constraint limits the types that can be used with a generic while preserving the concrete type. For example, `T extends { id: string }` means the function can work with different types, but every accepted type must have a string `id`.

## Why use a generic constraint instead of a concrete type?

> A concrete type is appropriate when an operation belongs to one domain. A generic constraint is useful when the same operation genuinely applies to multiple types that share a minimum structure and I want to preserve each concrete type.

## What does `K extends keyof T` mean?

> It means `K` can only be one of the known property keys of `T`. This lets me build typed property accessors while preventing invalid property names.

## Do generic constraints validate runtime data?

> No. Generic constraints are compile-time TypeScript constructs and disappear after compilation. Data from HTTP, forms, files, environment variables or external APIs still requires runtime validation, for example with Zod.

---

# 50. Cómo explicarlo con tu portafolio

Sobre **SiteOps Tracker**:

> In my network audit project, audits, devices and findings can share structural properties such as an `id`. When a helper is genuinely reusable, I can use a generic constraint such as `T extends { id: string }`. This lets the helper access the ID safely while preserving whether the concrete result is an Audit or a Device.

Sobre el **SDK tipado**:

> In a typed SDK, generic constraints can restrict reusable utilities to resources that expose required properties. However, I keep compile-time constraints separate from runtime validation because an API response is untrusted until it has been validated.

Sobre arquitectura:

> I use TypeScript generics inside trusted application code to express relationships between types. At external boundaries, I validate runtime values first and only then pass typed data into services and repositories.

---

# 51. Relación con tus proyectos

## SiteOps Tracker

Aplicaciones posibles:

```text
buscar por ID
indexar entidades
helpers compartidos
tablas genéricas
filtros
```

## Repositorio de algoritmos

Los constraints permiten escribir algoritmos reutilizables sin utilizar `any`.

## Analizador de configuraciones

`K extends keyof T` puede ayudarte a seleccionar campos válidos de `InterfaceConfig`, `RouteConfig` o `VlanConfig`.

## SDK tipado

Podrás crear helpers para recursos con ID, recursos con metadata y respuestas genéricas, sin olvidar runtime validation.

## API REST

Los datos externos se validarán primero. Después, el código interno podrá usar generics y constraints con seguridad.

## React Full Stack

Más adelante aparecerán en tablas, listas, selects, hooks y componentes reutilizables.

## Testing

Servirán para helpers reutilizables con contratos seguros.

---

# 52. Resumen

Un generic normal:

```ts
function identidad<T>(
  valor: T
): T {
  return valor;
}
```

permite que `T` varíe.

Un generic constraint agrega un requisito:

```ts
function obtenerId<
  T extends {
    id: string;
  }
>(
  valor: T
): string {
  return valor.id;
}
```

Esto significa:

```text
T puede variar
+
T debe cumplir
un contrato mínimo
```

El generic conserva el tipo concreto.

Por eso:

```ts
function buscarPorId<
  T extends {
    id: string;
  }
>(
  elementos: T[],
  id: string
): T | undefined
```

puede devolver `Auditoria`, `Dispositivo` o `Hallazgo` según el tipo recibido.

También aprendiste `keyof T` para obtener claves válidas y `K extends keyof T` para restringir una clave.

Finalmente, `T[K]` preserva el tipo de esa propiedad.

Ejemplo:

```ts
function obtenerPropiedad<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): T[K] {
  return objeto[clave];
}
```

Los constraints sirven para helpers, algoritmos, React, Services, Repositories, SDKs, testing y analizadores, pero solo cuando existe una abstracción real.

La separación crítica es:

```text
Generic Constraint
→ compile-time safety

Zod
→ runtime validation
```

Los tipos TypeScript desaparecen en runtime. HTTP, formularios, APIs externas, archivos, variables de entorno y bases de datos requieren validación o garantías reales.

Nuestra arquitectura continúa:

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
↓
Testing
↓
Docker
↓
CI/CD
↓
Cloud
```

Los generic constraints mejoran nuestro código interno, pero no sustituyen ninguna de estas capas.

---

# Próxima lección

**Lección 15 — `keyof`, `typeof` e Indexed Access Types.**
