# Lección 12 — Enums y cuándo preferir Literal Unions

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración objetivo:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Conexión:** React + HTTP + Node.js + validación runtime + Service + Repository + PostgreSQL

## Introducción

En la Lección 11 estudiaste `unknown`, `any` y `never`, y reforzaste una idea crítica: los tipos de TypeScript desaparecen al compilar. Ahora veremos cómo representar dominios que solo admiten un conjunto cerrado de valores, como estados de auditoría, roles, severidades o tipos de dispositivo.

Las dos herramientas principales de esta lección son `enum` y las **literal unions**. El objetivo no es memorizar sintaxis, sino aprender a elegir una representación que sea clara, mantenible y adecuada para contratos Full Stack.

## 1. Objetivo

Al terminar podrás:

- explicar qué problema resuelve `enum`;
- distinguir numeric enums de string enums;
- crear literal unions;
- decidir cuándo preferir literal unions;
- utilizar `as const` para derivar tipos desde valores;
- utilizar `Record` para exigir cobertura de un dominio cerrado;
- combinar estos conceptos con `never` y exhaustive checking;
- modelar estados para React y Node.js;
- explicar por qué estos tipos no validan HTTP en runtime;
- conectar el modelo con Zod y restricciones de PostgreSQL.

## 2. El problema: `string` puede ser demasiado amplio

```ts
function actualizarEstado(estado: string): void {
  console.log(`Nuevo estado: ${estado}`);
}
```

Esto permite:

```ts
actualizarEstado("pendiente");
actualizarEstado("banana");
```

Ambos son `string`, pero el dominio probablemente solo permite:

```text
pendiente
en_progreso
completada
cancelada
```

Necesitamos representar un **conjunto cerrado de valores**.

## 3. Solución con `enum`

```ts
enum EstadoAuditoria {
  Pendiente = "pendiente",
  EnProgreso = "en_progreso",
  Completada = "completada",
  Cancelada = "cancelada"
}

function actualizarEstado(
  estado: EstadoAuditoria
): void {
  console.log(`Nuevo estado: ${estado}`);
}

actualizarEstado(EstadoAuditoria.EnProgreso);
```

Un `enum` crea un conjunto nombrado de constantes relacionadas.

## 4. ¿Por qué existe `enum`?

Puede aportar:

- nombres semánticos;
- autocompletado;
- agrupación bajo un nombre común;
- una representación disponible en runtime;
- consistencia con APIs, código generado o codebases que ya lo usan.

Ejemplo:

```ts
enum RolUsuario {
  Admin = "admin",
  Auditor = "auditor",
  Viewer = "viewer"
}
```

Uso:

```ts
const rol = RolUsuario.Auditor;
```

## 5. String enums

```ts
enum TipoDispositivo {
  Router = "router",
  Switch = "switch",
  Firewall = "firewall"
}

type Dispositivo = {
  hostname: string;
  tipo: TipoDispositivo;
};

const router: Dispositivo = {
  hostname: "router-core-01",
  tipo: TipoDispositivo.Router
};
```

Los valores son legibles en logs y serialización:

```text
router
switch
firewall
```

## 6. Numeric enums

```ts
enum Prioridad {
  Baja,
  Media,
  Alta
}
```

Por defecto:

```text
Baja  → 0
Media → 1
Alta  → 2
```

Para muchos contratos web esto es menos descriptivo que:

```json
{ "prioridad": "alta" }
```

frente a:

```json
{ "prioridad": 2 }
```

Los numeric enums no están prohibidos, pero conviene preguntarse si el número aporta semántica suficiente al contrato.

## 7. Literal Unions

Podemos representar el mismo dominio sin `enum`:

```ts
type EstadoAuditoria =
  | "pendiente"
  | "en_progreso"
  | "completada"
  | "cancelada";
```

Uso:

```ts
function actualizarEstado(
  estado: EstadoAuditoria
): void {
  console.log(`Nuevo estado: ${estado}`);
}

actualizarEstado("pendiente");
```

Esto falla:

```ts
actualizarEstado("banana");
```

## 8. ¿Qué es un literal type?

Un tipo como:

```ts
string
```

representa muchos valores.

Un literal type:

```ts
type Exito = true;
```

representa exactamente:

```text
true
```

Otro ejemplo:

```ts
type MetodoHttp =
  | "GET"
  | "POST"
  | "PATCH"
  | "DELETE";
```

Aquí no aceptamos cualquier string, sino cuatro valores concretos.

## 9. Literal Union vs `string`

Menos preciso:

```ts
type Auditoria = {
  estado: string;
};
```

Más preciso:

```ts
type EstadoAuditoria =
  | "pendiente"
  | "en_progreso"
  | "completada"
  | "cancelada";

type Auditoria = {
  estado: EstadoAuditoria;
};
```

Ahora TypeScript detecta:

```ts
const auditoria: Auditoria = {
  estado: "terminadísima"
};
```

antes de ejecutar.

## 10. ¿Por qué suelen preferirse Literal Unions?

Para muchos valores sencillos y serializables ofrecen:

```text
sintaxis pequeña
composición natural
narrowing sencillo
excelente integración con discriminated unions
valores que coinciden directamente con JSON
buen autocompletado
exhaustive checking
```

Ejemplo React:

```ts
type EstadoUI =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: string[] }
  | { status: "error"; message: string };
```

## 11. `enum` vs Literal Union

Con enum:

```ts
enum Estado {
  Pendiente = "pendiente",
  Completada = "completada"
}

const estado = Estado.Pendiente;
```

Con literal union:

```ts
type Estado =
  | "pendiente"
  | "completada";

const estado: Estado = "pendiente";
```

Una regla práctica:

> Para conjuntos simples de valores serializables, considera primero una literal union. Usa `enum` cuando su constructo runtime, namespace o las convenciones del proyecto aporten valor concreto.

## 12. ¿Cuándo sí considerar `enum`?

Puede ser apropiado cuando:

- la codebase ya usa enums consistentemente;
- quieres constantes agrupadas bajo un namespace;
- interoperas con código generado;
- una API o librería establece ese patrón;
- el equipo ha elegido deliberadamente esa convención.

No se trata de declarar que `enum` sea “malo”, sino de elegir conscientemente.

## 13. `as const`: valores runtime + tipos precisos

```ts
const ESTADOS_AUDITORIA = [
  "pendiente",
  "en_progreso",
  "completada",
  "cancelada"
] as const;
```

Podemos derivar:

```ts
type EstadoAuditoria =
  (typeof ESTADOS_AUDITORIA)[number];
```

Conceptualmente produce:

```ts
type EstadoAuditoria =
  | "pendiente"
  | "en_progreso"
  | "completada"
  | "cancelada";
```

## 14. ¿Qué hace `as const`?

Sin:

```ts
const estados = [
  "pendiente",
  "completada"
];
```

TypeScript puede inferir `string[]`.

Con:

```ts
const estados = [
  "pendiente",
  "completada"
] as const;
```

conserva los literales de forma precisa y hace la estructura readonly.

Esto permite derivar tipos sin duplicar manualmente la lista.

## 15. Evitar fuentes de verdad duplicadas

Evita mantener por separado:

```ts
type Estado =
  | "pendiente"
  | "completada";
```

y:

```ts
const estados = [
  "pendiente",
  "completada"
];
```

si ambos siempre deben coincidir.

Podemos hacer:

```ts
const ESTADOS = [
  "pendiente",
  "completada"
] as const;

type Estado =
  (typeof ESTADOS)[number];
```

## 16. Objeto `as const`

También:

```ts
const EstadoAuditoria = {
  Pendiente: "pendiente",
  EnProgreso: "en_progreso",
  Completada: "completada",
  Cancelada: "cancelada"
} as const;

type EstadoAuditoria =
  typeof EstadoAuditoria[
    keyof typeof EstadoAuditoria
  ];
```

Esto proporciona una ergonomía similar a:

```ts
EstadoAuditoria.Pendiente
```

sin declarar un `enum`.

## 17. `keyof typeof` paso a paso

Dado:

```ts
const Estado = {
  Pendiente: "pendiente",
  Completada: "completada"
} as const;
```

`typeof Estado` describe el objeto.

`keyof typeof Estado` produce:

```text
"Pendiente" | "Completada"
```

Y:

```ts
typeof Estado[keyof typeof Estado]
```

obtiene los tipos de sus valores:

```text
"pendiente" | "completada"
```

Lo importante es comprender que TypeScript puede **derivar tipos desde valores existentes**.

## 18. SiteOps Tracker

```ts
type EstadoAuditoria =
  | "pendiente"
  | "en_progreso"
  | "completada"
  | "cancelada";

type Auditoria = {
  id: string;
  sitio: string;
  estado: EstadoAuditoria;
};

const auditoria: Auditoria = {
  id: "AUD-001",
  sitio: "GDCJ",
  estado: "en_progreso"
};
```

Ahora el dominio queda explícito.

## 19. Funciones tipadas con el dominio

```ts
function cambiarEstado(
  auditoria: Auditoria,
  nuevoEstado: EstadoAuditoria
): Auditoria {
  return {
    ...auditoria,
    estado: nuevoEstado
  };
}

const actualizada = cambiarEstado(
  auditoria,
  "completada"
);
```

Esto no compila:

```ts
cambiarEstado(auditoria, "cerrada");
```

## 20. Autocompletado como documentación

Cuando una función espera:

```ts
EstadoAuditoria
```

el editor conoce todas las opciones válidas.

Los tipos no solo previenen errores: también documentan el dominio y mejoran la experiencia de desarrollo.

## 21. `Record` para cubrir todos los valores

```ts
const ETIQUETAS_ESTADO:
  Record<EstadoAuditoria, string> = {
    pendiente: "Pendiente",
    en_progreso: "En progreso",
    completada: "Completada",
    cancelada: "Cancelada"
  };
```

Uso:

```ts
function obtenerEtiqueta(
  estado: EstadoAuditoria
): string {
  return ETIQUETAS_ESTADO[estado];
}
```

`Record<K, V>` expresa:

> Para cada clave de `K` debe existir un valor de tipo `V`.

Si agregamos un nuevo estado y olvidamos el mapping, TypeScript puede avisarnos.

## 22. Conexión con `never`

```ts
function assertNever(
  valor: never
): never {
  throw new Error(
    `Estado no manejado: ${valor}`
  );
}
```

```ts
function descripcionEstado(
  estado: EstadoAuditoria
): string {
  switch (estado) {
    case "pendiente":
      return "La auditoría aún no inicia";

    case "en_progreso":
      return "La auditoría está en ejecución";

    case "completada":
      return "La auditoría terminó";

    case "cancelada":
      return "La auditoría fue cancelada";

    default:
      return assertNever(estado);
  }
}
```

Si agregamos `"archivada"` a la union y olvidamos su `case`, el exhaustive check puede señalarlo.

## 23. Conexión con React

```ts
type BadgeEstadoProps = {
  estado: EstadoAuditoria;
};

function obtenerTextoBadge(
  estado: EstadoAuditoria
): string {
  return ETIQUETAS_ESTADO[estado];
}
```

Más adelante una prop React podrá utilizar el mismo contrato.

Esto es mejor que:

```ts
type BadgeEstadoProps = {
  estado: string;
};
```

porque `string` permitiría valores que no pertenecen al dominio.

## 24. Formularios React y runtime

Un `<select>` produce valores reales en runtime.

Aunque tengamos:

```ts
type EstadoAuditoria = ...
```

el navegador no conoce ese tipo.

TypeScript no transforma automáticamente un valor externo en un dato validado.

Esta idea será especialmente importante con formularios y Zod.

## 25. Conexión con HTTP

El frontend puede enviar:

```json
{
  "estado": "completada"
}
```

pero cualquier cliente también puede enviar:

```json
{
  "estado": "banana"
}
```

El tipo del backend no evita que esos bytes lleguen.

Por tanto:

```text
HTTP
↓
dato no confiable
↓
Runtime Validation
↓
EstadoAuditoria
```

## 26. Zod y Literal Unions

Más adelante podremos crear algo conceptualmente como:

```ts
const EstadoAuditoriaSchema =
  z.enum([
    "pendiente",
    "en_progreso",
    "completada",
    "cancelada"
  ]);
```

Entonces:

```text
req.body
↓
unknown
↓
Zod
↓
EstadoAuditoria válido
```

TypeScript protege compile time; Zod valida runtime.

## 27. Error: assertion como falsa validación

No hagas esto con datos HTTP no validados:

```ts
const estado =
  req.body.estado as EstadoAuditoria;
```

`as` no comprueba el valor real.

No convierte `"banana"` en un estado válido.

Solo cambia lo que el compilador supone.

## 28. Service con tipos confiables

Después de validar:

```ts
type CambiarEstadoInput = {
  auditoriaId: string;
  estado: EstadoAuditoria;
};

function cambiarEstadoAuditoria(
  input: CambiarEstadoInput
): void {
  console.log(
    `${input.auditoriaId}: ${input.estado}`
  );
}
```

El Service debería recibir datos ya estructuralmente válidos y concentrarse en reglas de negocio.

## 29. Repository

```ts
interface AuditoriaRepository {
  actualizarEstado(
    id: string,
    estado: EstadoAuditoria
  ): Promise<void>;
}
```

El Repository traduce operaciones del dominio a persistencia.

No debería interpretar `req.body` ni decidir códigos HTTP.

## 30. PostgreSQL también necesita garantías

El tipo TypeScript:

```ts
estado: EstadoAuditoria
```

no crea restricciones automáticamente en PostgreSQL.

Podemos tener una restricción como:

```sql
CHECK (
  estado IN (
    'pendiente',
    'en_progreso',
    'completada',
    'cancelada'
  )
)
```

Así la integridad persiste incluso si otro proceso escribe directamente en la base.

## 31. Defensa por capas

```text
React
↓
UX limita opciones
↓
HTTP
↓
Zod valida runtime
↓
Service recibe EstadoAuditoria
↓
Repository persiste
↓
PostgreSQL aplica constraints
```

Cada capa resuelve un problema distinto.

## 32. Arquitectura Full Stack

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

**React:** presenta y captura datos.  
**HTTP:** transporta datos; no transporta tipos TypeScript.  
**Node:** ejecuta JavaScript en runtime.  
**Router:** selecciona el handler según método y ruta.  
**Controller:** adapta HTTP al caso de uso.  
**Runtime Validation:** convierte datos no confiables en inputs validados.  
**Service:** aplica reglas de negocio.  
**Repository:** aísla persistencia.  
**PostgreSQL:** almacena datos y aplica integridad persistente.

## 33. Cuándo usar Literal Unions

Son excelentes para dominios cerrados como:

```ts
type Rol =
  | "admin"
  | "editor"
  | "viewer";

type Severidad =
  | "low"
  | "medium"
  | "high"
  | "critical";

type MetodoHttp =
  | "GET"
  | "POST"
  | "PATCH"
  | "DELETE";
```

## 34. Cuándo NO usar Literal Unions

No las uses para dominios realmente abiertos.

Mala idea:

```ts
type Hostname =
  | "router-01"
  | "router-02"
  | "router-03";
```

si pueden existir miles de hostnames.

Ahí:

```ts
type Hostname = string;
```

puede ser correcto.

Pregunta clave:

> ¿El conjunto de valores es realmente cerrado y conocido?

## 35. Errores comunes

### Usar `string` para todo

```ts
type Usuario = {
  rol: string;
};
```

pierde información si solo existen tres roles.

### Creer que la union valida HTTP

```ts
type Estado = "activo" | "inactivo";
```

no rechaza por sí sola un payload runtime.

### Usar `as` para silenciar al compilador

```ts
req.body.estado as EstadoAuditoria
```

no valida.

### Duplicar fuentes de verdad

Mantener una union y una lista separada puede causar desincronización. `as const` puede ayudar.

### Elegir numeric enum sin considerar el contrato

Un `2` suele comunicar menos que `"alta"` en JSON, logs y debugging.

## 36. Ejercicio principal — SiteOps Tracker

Crea:

```text
12-enums-literal-unions.ts
```

Define:

```ts
type SeveridadHallazgo =
  | "baja"
  | "media"
  | "alta"
  | "critica";
```

Después:

```ts
type Hallazgo = {
  id: string;
  descripcion: string;
  severidad: SeveridadHallazgo;
};
```

Implementa:

```ts
function describirHallazgo(
  hallazgo: Hallazgo
): string
```

Debe producir algo como:

```text
H-001 | critica | Uplink principal sin redundancia
```

No uses `any`, `as` ni `enum`.

### Pistas

Necesitas:

```ts
hallazgo.id
hallazgo.severidad
hallazgo.descripcion
```

Puedes utilizar template literals.

Después intenta:

```ts
const hallazgo: Hallazgo = {
  id: "H-002",
  descripcion: "Prueba",
  severidad: "urgente"
};
```

y analiza el error.

## 37. Segundo ejercicio — `Record`

Usa:

```ts
type SeveridadHallazgo =
  | "baja"
  | "media"
  | "alta"
  | "critica";
```

Crea:

```ts
const PRIORIDAD:
  Record<SeveridadHallazgo, number>
```

con:

```text
baja    → 1
media   → 2
alta    → 3
critica → 4
```

Después implementa:

```ts
function obtenerPrioridad(
  severidad: SeveridadHallazgo
): number
```

utilizando `PRIORIDAD`.

Agrega temporalmente `"informativa"` a la union y observa qué ocurre con el `Record`.

## 38. 🔥 Reto Full Stack — resultado del Service

Define primero:

```ts
type EstadoAuditoria =
  | "pendiente"
  | "en_progreso"
  | "completada"
  | "cancelada";
```

Después:

```ts
type CambiarEstadoResult =
  | {
      status: "updated";
      auditoriaId: string;
    }
  | {
      status: "not_found";
      auditoriaId: string;
    }
  | {
      status: "invalid_transition";
      from: EstadoAuditoria;
      to: EstadoAuditoria;
    };
```

Crea:

```ts
function mapearStatusHttp(
  resultado: CambiarEstadoResult
): number
```

Reglas:

```text
updated            → 200
not_found          → 404
invalid_transition → 409
```

Usa `switch` y `assertNever`.

No uses `any`.

## 39. Reto de reglas de negocio

Diseña:

```ts
function puedeCambiarEstado(
  actual: EstadoAuditoria,
  siguiente: EstadoAuditoria
): boolean
```

Piensa en transiciones como:

```text
pendiente → en_progreso
en_progreso → completada
en_progreso → cancelada
```

y una posiblemente inválida:

```text
completada → pendiente
```

No necesitas una solución sofisticada.

Pregunta arquitectónica:

> ¿Dónde pertenece esta regla?

Respuesta conceptual:

```text
Service
```

porque es una regla de negocio, no una preocupación HTTP.

## 40. Reto React

Modela:

```ts
type FiltroEstado =
  | "todos"
  | EstadoAuditoria;

type FiltroAuditoriasProps = {
  valor: FiltroEstado;
  onChange: (
    nuevoEstado: FiltroEstado
  ) => void;
};
```

Explica por qué este contrato es más preciso que:

```ts
type FiltroAuditoriasProps = {
  valor: string;
  onChange: (valor: string) => void;
};
```

No construyas todavía el componente completo.

## 41. Preguntas de comprensión

1. ¿Qué problema resuelve un `enum`?
2. ¿Qué diferencia existe entre numeric enum y string enum?
3. ¿Por qué un string enum suele ser más legible en JSON?
4. ¿Qué es un literal type?
5. ¿Qué es una literal union?
6. ¿Qué diferencia existe entre `string` y `"pendiente" | "completada"`?
7. ¿Por qué una literal union funciona bien para estados?
8. ¿Cuándo considerarías utilizar `enum`?
9. ¿Qué significa que un dominio sea cerrado?
10. ¿Qué hace `as const`?
11. ¿Cómo puede `as const` reducir duplicación?
12. ¿Qué significa `Record<EstadoAuditoria, string>`?
13. ¿Qué ventaja aporta `Record` cuando agregas una variante?
14. ¿Cómo se relaciona `never` con estos estados?
15. ¿Por qué una literal union no valida HTTP?
16. ¿Por qué `as EstadoAuditoria` no es runtime validation?
17. ¿Qué capa debe validar un estado recibido por HTTP?
18. ¿Qué capa debe decidir si una transición es válida?
19. ¿Qué responsabilidad tiene el Repository?
20. ¿Qué garantía adicional puede imponer PostgreSQL?

## 42. Relevancia para entrevistas

**Pregunta: What is the difference between an enum and a union of string literals in TypeScript?**

> Both can represent a closed set of allowed values. String literal unions are lightweight and compose naturally with TypeScript's type system, especially with narrowing and discriminated unions. Enums provide a named runtime construct and namespace-like access to members. For simple serializable domain values, I usually consider a literal union first, while enums can still be appropriate depending on the codebase, generated code, API requirements, or team conventions.

**Pregunta: Would a string literal union validate an API payload at runtime?**

> No. TypeScript types are erased during compilation. I still need runtime validation, for example with Zod, before treating an HTTP payload as a trusted domain type.

**Pregunta: Why not just use `string` for a status field?**

> If the domain has a closed set of valid states, using `string` loses useful information. A literal union lets the compiler catch invalid values, improves autocomplete, documents the domain, and makes exhaustive handling possible.

## 43. Cómo explicarlo usando SiteOps Tracker

> In SiteOps Tracker, my fictional infrastructure-audit portfolio application, fields such as audit status and finding severity have a closed set of valid values, so I model them with string literal unions instead of plain strings. This improves autocomplete and compile-time safety and also lets me use exhaustive checks. Because these values can arrive through HTTP or imported files, I still validate them at runtime before passing them into the service layer.

Esta explicación demuestra simultáneamente:

```text
TypeScript
domain modeling
runtime validation
backend architecture
```

## 44. Relación con tus proyectos

### SiteOps Tracker

Literal unions pueden representar:

```text
estado de auditoría
severidad de hallazgo
tipo de dispositivo
estado de revisión
```

### Repositorio de algoritmos

Pueden modelar operaciones o estrategias cuando el conjunto sea cerrado.

### Analizador de configuraciones de red

Por ejemplo:

```ts
type TipoLinea =
  | "interface"
  | "route"
  | "vlan"
  | "unknown";
```

### SDK tipado para una API

Pueden representar:

```text
status
event type
resource type
HTTP method
```

### API REST Node.js + TypeScript + PostgreSQL

Los utilizaremos después de validar datos externos.

### Aplicación Full Stack React

Serán útiles para:

```text
props
estado UI
filtros
acciones
resultados
```

## 45. Resumen

Un dominio cerrado no debería modelarse automáticamente como `string`.

Podemos utilizar:

```ts
enum Estado {
  // ...
}
```

o:

```ts
type Estado =
  | "..."
  | "...";
```

Para muchos valores simples y serializables, las literal unions son especialmente naturales porque:

```text
son ligeras
se componen bien
funcionan con narrowing
funcionan con discriminated unions
son legibles en JSON
permiten exhaustive checking
```

`enum` sigue siendo válido cuando sus características aportan valor o cuando forma parte de las convenciones del proyecto.

También aprendiste:

```ts
const VALORES = [
  "a",
  "b",
  "c"
] as const;

type Valor =
  (typeof VALORES)[number];
```

y:

```ts
Record<Union, Tipo>
```

para exigir cobertura de todos los valores.

En Full Stack:

```text
Literal Union
→ contrato compile-time

Zod
→ validación runtime

PostgreSQL constraint
→ integridad persistida
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

Los tipos de TypeScript desaparecen en runtime. HTTP, formularios, APIs externas, archivos, variables de entorno y bases de datos requieren garantías reales en las capas correspondientes.

## Próxima lección

**Lección 13 — Generics: funciones y tipos reutilizables manteniendo información de tipos.**
