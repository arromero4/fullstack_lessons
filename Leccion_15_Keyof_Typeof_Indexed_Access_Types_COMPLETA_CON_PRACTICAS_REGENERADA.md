# Lección 15 — `keyof`, `typeof` e Indexed Access Types

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración estimada:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Ruta:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

---

## Introducción

En la Lección 14 trabajaste con **Generic Constraints** y apareció una expresión especialmente importante:

```ts
K extends keyof T
```

También utilizaste:

```ts
T[K]
```

Ahora vamos a estudiar esas herramientas directamente y a combinarlas con `typeof`.

Estas tres piezas permiten que TypeScript derive tipos a partir de otros tipos o de valores existentes:

```text
keyof
typeof
Indexed Access Types
```

La idea central es:

```text
valor existente
↓
typeof
↓
tipo derivado
↓
keyof
↓
claves válidas
↓
T[K]
↓
tipo de una propiedad concreta
```

Estas herramientas aparecerán después en React, APIs, SDKs, configuración, formularios, repositories y utilidades genéricas.

---

# 1. Objetivo

Al terminar esta lección debes poder:

- explicar qué problema resuelve `keyof`;
- obtener un union type de las propiedades de un objeto;
- explicar el uso de `typeof` dentro del sistema de tipos;
- derivar un tipo a partir de un valor existente;
- distinguir `typeof` de JavaScript y `typeof` de TypeScript;
- utilizar Indexed Access Types;
- comprender expresiones como `Dispositivo["hostname"]`;
- combinar `keyof`, `typeof` e indexed access;
- evitar duplicación innecesaria de tipos;
- construir helpers correctamente tipados;
- entender `typeof array[number]`;
- conectar estos conceptos con SiteOps Tracker, React, Node.js y un SDK;
- distinguir compile-time type information de runtime validation.

---

# 2. El problema: strings arbitrarios como propiedades

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
  activo: boolean;
};
```

Si hacemos:

```ts
type CampoDispositivo = string;
```

esto también sería válido:

```ts
const campo: CampoDispositivo =
  "propiedadInventada";
```

Pero nuestro dominio solo admite:

```text
id
hostname
ip
activo
```

Necesitamos restringir las claves conocidas.

---

# 3. `keyof`

```ts
type CampoDispositivo =
  keyof Dispositivo;
```

Conceptualmente:

```ts
type CampoDispositivo =
  | "id"
  | "hostname"
  | "ip"
  | "activo";
```

Válido:

```ts
const campo1:
  CampoDispositivo =
  "hostname";
```

Inválido:

```ts
const campo2:
  CampoDispositivo =
  "vlans";
```

---

# 4. ¿Qué problema resuelve `keyof`?

Sin `keyof` podríamos duplicar:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};

type CampoDispositivo =
  | "id"
  | "hostname"
  | "ip";
```

Si después agregamos:

```ts
modelo: string;
```

podríamos olvidar actualizar `CampoDispositivo`.

Con:

```ts
type CampoDispositivo =
  keyof Dispositivo;
```

la relación permanece sincronizada.

---

# 5. Primera aplicación práctica

```ts
function mostrarCampo(
  campo: keyof Dispositivo
): void {
  console.log(campo);
}

mostrarCampo("hostname");
mostrarCampo("ip");
```

Esto debe fallar:

```ts
mostrarCampo("serial");
```

---

# 6. `keyof` no obtiene valores

`keyof` trabaja en el sistema de tipos.

```ts
keyof Dispositivo
```

produce claves posibles:

```text
"id" | "hostname" | "ip" | "activo"
```

No recorre un objeto ni obtiene datos en runtime.

---

# 7. `typeof` en JavaScript

En runtime:

```ts
const hostname =
  "router-core-01";

console.log(
  typeof hostname
);
```

produce:

```text
"string"
```

También:

```ts
typeof 25
```

produce:

```text
"number"
```

Este es el `typeof` de JavaScript.

---

# 8. `typeof` en el sistema de tipos

TypeScript también permite:

```ts
const dispositivo = {
  id: "DEV-001",
  hostname: "router-core-01",
  ip: "10.0.0.1",
  activo: true
};

type Dispositivo =
  typeof dispositivo;
```

TypeScript deriva conceptualmente:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
  activo: boolean;
};
```

---

# 9. ¿Por qué usar `typeof` en type position?

Si un valor ya es la fuente de verdad:

```ts
const configuracion = {
  retries: 3,
  timeoutMs: 5000,
  logging: true
};
```

podemos evitar duplicar:

```ts
type Configuracion =
  typeof configuracion;
```

Pero si el contrato de dominio es lo principal, puede ser mejor definir primero el tipo y luego crear valores que lo cumplan.

---

# 10. Combinar `keyof` y `typeof`

```ts
const estados = {
  pendiente: "Pendiente",
  progreso: "En progreso",
  completada: "Completada"
};

type Estado =
  keyof typeof estados;
```

Paso a paso:

```text
typeof estados
↓
{
  pendiente: string;
  progreso: string;
  completada: string;
}

keyof
↓
"pendiente"
| "progreso"
| "completada"
```

---

# 11. Aplicación a SiteOps Tracker

```ts
const etiquetasEstado = {
  pendiente: "Pendiente",
  progreso: "En progreso",
  completada: "Completada"
};

type EstadoAuditoria =
  keyof typeof etiquetasEstado;

type Auditoria = {
  id: string;
  sitio: string;
  estado: EstadoAuditoria;
};
```

Esto reduce duplicación.

---

# 12. `typeof` tampoco valida datos externos

Aunque exista:

```ts
type EstadoAuditoria =
  keyof typeof etiquetasEstado;
```

un cliente puede enviar:

```json
{
  "estado": "destruida"
}
```

El tipo no valida HTTP.

La entrada sigue requiriendo runtime validation.

---

# 13. Indexed Access Types

Dado:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  rutas: number;
  activo: boolean;
};
```

Podemos obtener el tipo de una propiedad:

```ts
type Hostname =
  Dispositivo["hostname"];
```

Resultado:

```text
string
```

También:

```ts
type CantidadRutas =
  Dispositivo["rutas"];
```

Resultado:

```text
number
```

Y:

```ts
type EstadoActivo =
  Dispositivo["activo"];
```

Resultado:

```text
boolean
```

---

# 14. ¿Por qué se llama Indexed Access Type?

La sintaxis se parece a:

```ts
objeto["hostname"]
```

pero en tipos:

```ts
Dispositivo["hostname"]
```

No obtiene el valor.

Obtiene el **tipo** asociado a esa propiedad.

---

# 15. Evitar duplicación

```ts
type Hallazgo = {
  id: string;
  severidad:
    | "baja"
    | "media"
    | "alta";
  descripcion: string;
};
```

Si `Hallazgo` es la fuente de verdad:

```ts
type Severidad =
  Hallazgo["severidad"];
```

Así no repetimos la unión.

---

# 16. Indexed Access con varias propiedades

```ts
type DatosBasicos =
  Dispositivo[
    "hostname" | "activo"
  ];
```

Resultado:

```text
string | boolean
```

Esto **no crea un objeto** con ambas propiedades.

Solo crea una unión de los tipos de esas propiedades.

---

# 17. `T[K]` en generics

Ahora podemos entender:

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

Conceptualmente:

```text
T
→ tipo del objeto

keyof T
→ claves posibles

K extends keyof T
→ K debe ser una clave válida

T[K]
→ tipo de esa propiedad
```

---

# 18. Inferencia completa

```ts
const router = {
  hostname: "router-core-01",
  rutas: 24,
  activo: true
};

const rutas =
  obtenerPropiedad(
    router,
    "rutas"
  );
```

TypeScript infiere:

```text
T → objeto router
K → "rutas"
T[K] → number
```

Por eso `rutas` es `number`.

---

# 19. Analizador de configuraciones

```ts
type InterfaceConfig = {
  name: string;
  description: string;
  enabled: boolean;
  vlan: number;
};
```

Podemos derivar:

```ts
type CampoInterface =
  keyof InterfaceConfig;
```

y:

```ts
type Vlan =
  InterfaceConfig["vlan"];
```

Resultado:

```text
CampoInterface
→ "name" | "description" | "enabled" | "vlan"

Vlan
→ number
```

---

# 20. `typeof` con arrays

```ts
const dispositivos = [
  {
    id: "DEV-001",
    hostname: "router-01"
  },
  {
    id: "DEV-002",
    hostname: "switch-01"
  }
];
```

Tipo del array:

```ts
type Dispositivos =
  typeof dispositivos;
```

Tipo de un elemento:

```ts
type Dispositivo =
  typeof dispositivos[number];
```

---

# 21. ¿Qué significa `[number]`?

Los arrays se indexan con números:

```ts
dispositivos[0]
dispositivos[1]
```

Por eso:

```ts
typeof dispositivos[number]
```

significa:

> Dame el tipo obtenido al indexar este array con un número.

---

# 22. Arrays constantes y `as const`

Sin `as const`:

```ts
const estados = [
  "pendiente",
  "progreso",
  "completada"
];
```

TypeScript puede inferir:

```text
string[]
```

Con:

```ts
const estados = [
  "pendiente",
  "progreso",
  "completada"
] as const;
```

podemos derivar:

```ts
type Estado =
  typeof estados[number];
```

Resultado:

```ts
type Estado =
  | "pendiente"
  | "progreso"
  | "completada";
```

---

# 23. `as const` vs assertion peligrosa

Esto:

```ts
respuesta as Dispositivo
```

puede mentir sobre datos externos.

En cambio:

```ts
const estado =
  "pendiente" as const;
```

preserva un literal conocido de nuestro propio código.

`as const` tampoco valida datos externos, pero su propósito es distinto: preservar literal types y readonly-ness.

---

# 24. Patrón para opciones internas

```ts
const severidades = [
  "baja",
  "media",
  "alta"
] as const;

type Severidad =
  typeof severidades[number];

type Hallazgo = {
  id: string;
  descripcion: string;
  severidad: Severidad;
};
```

Tenemos:

```text
lista runtime
+
tipo derivado
```

---

# 25. Conexión futura con Zod

TypeScript sigue operando principalmente en compile time.

Para HTTP:

```text
HTTP
↓
unknown
↓
Zod
↓
dato validado
↓
Service
```

Zod permitirá conectar validación runtime con inferencia de tipos.

---

# 26. SDK tipado

```ts
type Device = {
  id: string;
  hostname: string;
  createdAt: string;
};

type SortField =
  keyof Device;

function buildSortQuery(
  field: SortField
): string {
  return `sort=${field}`;
}
```

Válido:

```ts
buildSortQuery("hostname");
```

Inválido:

```ts
buildSortQuery("inventado");
```

---

# 27. Cuidado con SQL

`keyof` no protege contra SQL injection.

No debemos pensar:

```text
keyof T
=
seguridad SQL
```

Las consultas necesitan:

```text
parámetros
queries preparadas
bibliotecas seguras
validación runtime
```

---

# 28. Conexión con React

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
};

type TableProps<T> = {
  rows: T[];
  columns: Array<keyof T>;
};
```

Uso conceptual:

```ts
const columnas:
  Array<keyof Dispositivo> = [
    "hostname",
    "ip"
  ];
```

TypeScript rechaza columnas inexistentes.

---

# 29. Arquitectura Full Stack

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

`keyof`, `typeof` e indexed access conectan componentes con modelos sin duplicar nombres de propiedades.

## HTTP

Transporta datos reales, no tipos TypeScript.

## Node

Ejecuta JavaScript. Los tipos ya no existen como validadores.

## Router

Selecciona el handler según método y ruta.

## Controller

Traduce HTTP al caso de uso.

## Runtime Validation

Comprueba los datos externos. `keyof` no sustituye Zod.

## Service

Trabaja con datos confiables y reglas de negocio.

## Repository

Aísla PostgreSQL y no debe usar strings externos sin validación.

## PostgreSQL

Añade integridad persistente mediante tipos SQL, `NOT NULL`, `UNIQUE`, `CHECK`, foreign keys y transacciones.

## Testing

Comprueba comportamiento real, no solo compilación.

## Docker

Empaqueta runtime y dependencias.

## CI/CD

Automatiza lint, type checking, tests, build y deploy.

## Cloud

Ejecuta el sistema desplegado.

---

# 30. Cuándo usar `keyof`

Úsalo cuando:

- necesitas claves válidas de un tipo;
- quieres evitar strings arbitrarios;
- un helper accede dinámicamente a propiedades;
- quieres sincronizar opciones con un modelo;
- construyes APIs genéricas.

---

# 31. Cuándo usar `typeof`

Úsalo en type position cuando:

- un valor es la fuente de verdad;
- quieres evitar duplicar estructura;
- quieres derivar un tipo desde configuración interna;
- quieres combinarlo con `keyof`;
- quieres extraer tipos desde arrays constantes.

---

# 32. Cuándo usar Indexed Access Types

Úsalos cuando:

- necesitas reutilizar el tipo de una propiedad;
- quieres mantener tipos sincronizados;
- trabajas con generics como `T[K]`;
- quieres obtener el tipo de un elemento de array;
- quieres evitar repetir unions.

---

# 33. Errores comunes

## Usar `string` en vez de `keyof`

```ts
function leer(
  dispositivo: Dispositivo,
  campo: string
) {
  return dispositivo[campo];
}
```

`string` permite demasiado.

## Duplicar unions

```ts
type Severidad =
  "baja" | "media" | "alta";
```

si esa misma unión ya vive dentro de `Hallazgo`, puede derivarse.

## Confundir `typeof`

Runtime:

```ts
typeof valor
```

Type-level:

```ts
type T = typeof valor;
```

No son exactamente la misma operación.

## Creer que `keyof` valida HTTP

```text
?sort=hostname
```

sigue siendo entrada externa.

## Usar assertions para “arreglar” tipos

```ts
const sort =
  req.query.sort
  as keyof Device;
```

Eso no valida nada.

---

# 34. EJERCICIO PRINCIPAL / PRÁCTICA 1 — `keyof` en SiteOps Tracker

Define:

```ts
type Auditoria = {
  id: string;
  sitio: string;
  estado:
    | "pendiente"
    | "progreso"
    | "completada";
  responsable: string;
};
```

Crea:

```ts
type CampoAuditoria =
  keyof Auditoria;
```

Declara variables válidas para:

```text
id
sitio
estado
responsable
```

Luego intenta:

```text
fechaCierre
```

sin agregarla a `Auditoria`.

### Explica

¿Por qué TypeScript rechaza esa asignación?

---

# 35. PRÁCTICA 2 — `typeof`

Crea:

```ts
const configuracionAuditoria = {
  maxHallazgos: 100,
  permitirEdicion: true,
  prefijo: "AUD"
};
```

Deriva:

```ts
type ConfiguracionAuditoria =
  typeof configuracionAuditoria;
```

Después crea otra variable que cumpla ese tipo.

### Restricciones

No dupliques manualmente el tipo.

No uses `any`.

---

# 36. PRÁCTICA 3 — Indexed Access Types

```ts
type Hallazgo = {
  id: string;
  descripcion: string;
  severidad:
    | "baja"
    | "media"
    | "alta";
  resuelto: boolean;
};
```

Deriva:

```ts
type Severidad =
  Hallazgo["severidad"];

type EstadoResolucion =
  Hallazgo["resuelto"];
```

Crea valores válidos.

Después intenta:

```ts
const severidad:
  Severidad =
  "critica";
```

y analiza el error.

---

# 37. PRÁCTICA 4 — `keyof` + generic

Implementa:

```ts
function obtenerValor<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): T[K] {
  // tu implementación
}
```

Pruébala con:

```ts
const switchRed = {
  hostname: "switch-access-01",
  vlans: 12,
  activo: true
};
```

Obtén:

```text
hostname
vlans
activo
```

### Pista

JavaScript ya permite:

```ts
objeto[clave]
```

Tu trabajo es expresar correctamente la relación de tipos.

---

# 38. PRÁCTICA 5 — Array + `as const`

```ts
const estadosAuditoria = [
  "pendiente",
  "progreso",
  "completada"
] as const;
```

Deriva:

```ts
type EstadoAuditoria =
  typeof estadosAuditoria[number];
```

Crea tres valores válidos.

Luego prueba:

```ts
const estado:
  EstadoAuditoria =
  "cancelada";
```

y explica por qué falla.

---

# 39. RETO — React + TypeScript

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
  activo: boolean;
};

type TablaProps<T> = {
  rows: T[];
  columns: Array<keyof T>;
};
```

Crea:

```ts
const tablaDispositivos:
  TablaProps<Dispositivo>
```

con dos dispositivos y columnas:

```text
hostname
ip
activo
```

Intenta agregar:

```text
modelo
```

sin agregarlo a `Dispositivo`.

### Explica

1. ¿Qué protege `keyof T`?
2. ¿Qué error evita?
3. ¿Qué seguirá necesitando validación si `rows` llega desde HTTP?

No construyas JSX todavía.

---

# 40. RETO — SDK tipado

```ts
type ApiDevice = {
  id: string;
  hostname: string;
  createdAt: string;
  status:
    | "online"
    | "offline";
};

type SortField =
  keyof ApiDevice;
```

Diseña:

```ts
function crearSortParam(
  campo: SortField
): string
```

Debe producir:

```text
sort=hostname
```

### Preguntas

1. ¿Por qué es mejor que cualquier `string`?
2. ¿Impide que un cliente HTTP envíe `sort=hack`?
3. ¿Dónde validarías ese query parameter?
4. ¿Qué pasa si agregas `location` a `ApiDevice`?

---

# 41. RETO — Analizador de configuraciones

```ts
const tiposInterfaz = [
  "ethernet",
  "loopback",
  "vlan",
  "tunnel"
] as const;
```

Deriva:

```ts
type TipoInterfaz =
  typeof tiposInterfaz[number];
```

Después:

```ts
type Interfaz = {
  nombre: string;
  tipo: TipoInterfaz;
  activa: boolean;
};
```

Deriva:

```ts
type CampoInterfaz =
  keyof Interfaz;

type EstadoInterfaz =
  Interfaz["activa"];
```

### Objetivo

Conectar:

```text
typeof
+
[number]
+
keyof
+
indexed access
```

---

# 42. RETO DE ARQUITECTURA

Supón:

```http
GET /api/devices?sort=hostname
```

Y:

```ts
type Device = {
  id: string;
  hostname: string;
  status:
    | "online"
    | "offline";
};

type SortField =
  keyof Device;
```

Analiza:

```text
React
↓
HTTP
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

Responde:

1. ¿Cuándo `sort` deja de ser entrada no confiable?
2. ¿Por qué `keyof Device` no valida HTTP?
3. ¿Qué debe comprobar Zod?
4. ¿Qué debe recibir el Service?
5. ¿Debe el Repository concatenar cualquier string en SQL?
6. ¿Qué garantías añade PostgreSQL?
7. ¿Qué comprueba TypeScript y qué comprueba runtime validation?

---

# 43. Relación con tus proyectos

## SiteOps Tracker

Puedes derivar campos válidos, estados y tipos de propiedades sin duplicar contratos.

## Repositorio de algoritmos

Generics e indexed access ayudan a mantener relaciones precisas entre entrada y salida.

## Analizador de configuraciones

`keyof` limita campos válidos y `T[K]` conserva el tipo seleccionado.

## SDK tipado

Puedes limitar `sort`, `fields` y filtros al conjunto conocido por el SDK.

## API REST Node.js + TypeScript + PostgreSQL

Los tipos ayudan internamente; Zod valida inputs reales.

## React + TypeScript

Podrás construir tablas, formularios y componentes genéricos sin `any`.

---

# 44. Preguntas de comprensión

1. ¿Qué produce conceptualmente `keyof Dispositivo`?
2. ¿Por qué `keyof` es mejor que `string` para propiedades conocidas?
3. ¿Qué problema de mantenimiento evita?
4. ¿Qué hace `typeof` en JavaScript runtime?
5. ¿Qué hace `typeof` en type position?
6. ¿Cuándo conviene derivar un tipo desde un valor?
7. ¿Cuándo conviene definir primero el tipo de dominio?
8. ¿Qué significa `keyof typeof objeto`?
9. ¿Qué representa `Dispositivo["hostname"]`?
10. ¿Qué es un Indexed Access Type?
11. ¿Qué significa `T[K]`?
12. ¿Por qué `K extends keyof T` es importante?
13. ¿Qué significa `typeof array[number]`?
14. ¿Qué efecto tiene `as const`?
15. ¿Cómo obtienes una unión desde un array constante?
16. ¿`as const` valida datos externos?
17. ¿`keyof` valida query params HTTP?
18. ¿Por qué los tipos desaparecen en runtime?
19. ¿Qué responsabilidad tendrá Zod?
20. ¿Por qué TypeScript no sustituye seguridad SQL?
21. ¿Cómo usarías `keyof` en una tabla React?
22. ¿Cómo usarías `keyof` en un SDK?
23. ¿Cómo usarías indexed access en SiteOps Tracker?
24. ¿Qué riesgo tiene duplicar unions?
25. ¿Cómo explicarías estos conceptos en entrevista?

---

# 45. Relevancia para entrevistas

## What does `keyof` do in TypeScript?

> `keyof` produces a union of the known property keys of a type. For example, if a `Device` type has `id`, `hostname`, and `status`, then `keyof Device` represents `"id" | "hostname" | "status"`.

## What is `typeof` used for in a TypeScript type position?

> It lets me derive a static type from an existing value. This is useful when the value is the source of truth and I want to avoid duplicating its structure manually.

## What is an indexed access type?

> An indexed access type retrieves the type of a property from another type. For example, `Device["hostname"]` returns the type of the `hostname` property.

## Explain `K extends keyof T` and `T[K]`.

> `K extends keyof T` restricts `K` to valid keys of `T`, while `T[K]` represents the type associated with that key. Together they allow a generic property accessor to preserve the exact return type.

## Does `keyof` validate external input?

> No. `keyof` is compile-time information. External data from HTTP, forms, files, APIs or environment variables must still be validated at runtime.

---

# 46. Cómo explicarlo con tu portafolio

Sobre SiteOps Tracker:

> In SiteOps Tracker, my fictional infrastructure-audit portfolio application, I use `keyof` to represent valid fields of models such as devices or audits, and indexed access types to reuse the exact type of a property without duplicating it.

Sobre el analizador:

> In my configuration analyzer, a generic helper can use `K extends keyof T` so only valid configuration fields can be selected, while `T[K]` preserves whether the selected field is a string, number or boolean.

Sobre Full Stack:

> I use these TypeScript features to keep internal contracts synchronized, but I do not treat them as runtime validation. HTTP input is still untrusted and must be validated before it reaches business logic or persistence.

---

# 47. Code review: errores que debes detectar

## Caso 1

```ts
type Campo = string;
```

si solo deberían aceptarse propiedades de `Dispositivo`.

## Caso 2

Duplicar manualmente una unión que ya existe en una propiedad.

## Caso 3

```ts
function leer<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): any {
  return objeto[clave];
}
```

`T[K]` preserva el tipo; `any` lo destruye.

## Caso 4

```ts
const sort =
  req.query.sort
  as keyof Device;
```

Assertion no es validación.

## Caso 5

Concatenar directamente un campo HTTP en SQL porque existe un tipo `keyof`.

Compile-time type safety no reemplaza seguridad runtime.

---

# 48. Checklist mental

```text
1. ¿Cuál es la fuente de verdad?
2. ¿Estoy duplicando nombres de propiedades?
3. ¿Puedo usar keyof?
4. ¿Conviene derivar un tipo con typeof?
5. ¿Necesito el tipo de una propiedad?
6. ¿Puedo usar T[K]?
7. ¿Estoy preservando información?
8. ¿Estoy introduciendo any?
9. ¿Estoy confundiendo compile time con runtime?
10. ¿Los datos externos fueron validados?
```

---

# 49. Resumen

`keyof` obtiene claves conocidas:

```ts
type Campo =
  keyof Dispositivo;
```

`typeof` en type position deriva un tipo desde un valor:

```ts
const config = {
  retries: 3,
  logging: true
};

type Config =
  typeof config;
```

Podemos combinarlos:

```ts
type Estado =
  keyof typeof etiquetasEstado;
```

Indexed Access Types extraen tipos de propiedades:

```ts
type Hostname =
  Dispositivo["hostname"];
```

Y explican:

```ts
T[K]
```

en helpers genéricos:

```ts
function obtenerValor<
  T,
  K extends keyof T
>(
  objeto: T,
  clave: K
): T[K] {
  return objeto[clave];
}
```

Con arrays constantes:

```ts
const estados = [
  "pendiente",
  "progreso",
  "completada"
] as const;

type Estado =
  typeof estados[number];
```

podemos derivar una unión de literales.

Estas herramientas ayudan a mantener contratos sincronizados y evitar `any`, pero pertenecen al sistema de tipos de TypeScript.

La regla fundamental continúa:

```text
TypeScript
↓
compile-time safety

datos externos
↓
runtime validation
```

HTTP, formularios, APIs externas, archivos, variables de entorno y bases de datos requieren validación o garantías reales.

Arquitectura objetivo:

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

---

# Próxima lección

**Lección 16 — Utility Types: `Partial`, `Required`, `Readonly`, `Pick` y `Omit`.**
