# Lección 16 — Utility Types: `Partial`, `Required`, `Readonly`, `Pick` y `Omit`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración:** 15–20 minutos  
**Etapa:** TypeScript profundo  
**Ruta:** Full Stack Developer | React + TypeScript | Node.js | PostgreSQL | Testing | Docker

---

## Introducción

En la Lección 15 estudiaste `keyof`, `typeof` e Indexed Access Types. Ahora usarás esa base para **transformar tipos existentes sin duplicar contratos**.

Partiremos de un modelo como:

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
  activo: boolean;
  createdAt: Date;
};
```

En una aplicación real no todas las operaciones necesitan el mismo contrato. Crear un dispositivo, actualizarlo, mostrar un resumen y almacenar una fila son responsabilidades distintas. TypeScript incluye Utility Types para expresar esas transformaciones:

```text
Partial<T>
Required<T>
Readonly<T>
Pick<T, K>
Omit<T, K>
```

La idea central es:

```text
tipo base
→ transformación
→ contrato específico
→ operación concreta
```

Estos tipos son especialmente útiles en React, Services, Repositories, SDKs y tests, pero **desaparecen en runtime**. No validan HTTP, formularios, APIs externas, archivos, variables de entorno ni datos de una base de datos.

---

## 1. Objetivo

Al finalizar debes poder:

- explicar por qué existen los Utility Types;
- utilizar correctamente `Partial`, `Required`, `Readonly`, `Pick` y `Omit`;
- combinar Utility Types sin perder legibilidad;
- distinguir modelo de dominio, input de creación, input de actualización y respuesta;
- reconocer cuándo `Partial<T>` es demasiado permisivo;
- entender que `Readonly<T>` no congela objetos en runtime;
- entender que `Omit<T, K>` no elimina propiedades de un objeto real;
- conectar estos conceptos con React, Node.js, PostgreSQL y Testing;
- explicar su relevancia en una entrevista técnica.

---

## 2. El problema que resuelven

Considera:

```ts
type Auditoria = {
  id: string;
  sitio: string;
  responsable: string;
  estado: "pendiente" | "progreso" | "completada";
  observaciones: string;
};
```

Podríamos duplicar tipos manualmente:

```ts
type ActualizarAuditoria = {
  responsable?: string;
  estado?: "pendiente" | "progreso" | "completada";
  observaciones?: string;
};
```

Esto funciona, pero obliga a mantener contratos repetidos. Los Utility Types permiten **derivar** contratos cuando existe una relación real entre ellos.

---

## 3. `Partial<T>`

`Partial<T>` convierte todas las propiedades de `T` en opcionales.

```ts
type CambiosAuditoria = Partial<Auditoria>;
```

Conceptualmente:

```ts
type CambiosAuditoria = {
  id?: string;
  sitio?: string;
  responsable?: string;
  estado?: "pendiente" | "progreso" | "completada";
  observaciones?: string;
};
```

Ejemplo:

```ts
const cambios: Partial<Auditoria> = {
  responsable: "Andrés",
  estado: "progreso"
};
```

### ¿Cuándo usarlo?

Cuando una estructura realmente puede contener un subconjunto de propiedades: overrides de configuración, borradores, ciertos builders de tests o updates cuidadosamente delimitados.

### ¿Cuándo no?

No uses automáticamente:

```ts
type UpdateUserInput = Partial<User>;
```

si `User` contiene campos que nunca deben modificarse, como:

```text
id
passwordHash
createdAt
role
```

Una mejor estrategia es seleccionar primero los campos editables:

```ts
type EditableAuditFields =
  Pick<
    Auditoria,
    "responsable" | "estado" | "observaciones"
  >;

type UpdateAuditInput =
  Partial<EditableAuditFields>;
```

`Pick` define **qué puede cambiar** y `Partial` indica que en un PATCH **no tienen que llegar todos esos campos**.

---

## 4. `Required<T>`

`Required<T>` convierte todas las propiedades opcionales en obligatorias.

```ts
type AppConfig = {
  host?: string;
  port?: number;
  logging?: boolean;
};

type ResolvedConfig =
  Required<AppConfig>;
```

Resultado conceptual:

```ts
type ResolvedConfig = {
  host: string;
  port: number;
  logging: boolean;
};
```

Esto puede representar una configuración **después** de resolver defaults.

```text
configuración parcial
→ aplicar defaults en runtime
→ configuración completa
```

### Importante

`Required<T>` no crea valores.

Esto:

```ts
type ResolvedConfig =
  Required<AppConfig>;
```

no asigna automáticamente:

```text
host = localhost
port = 3000
```

El código runtime debe hacerlo.

---

## 5. Variables de entorno: `Required` no valida

Nunca concluyas que:

```ts
type Env = Required<Environment>;
```

hace seguro:

```ts
process.env
```

Las variables de entorno son datos runtime. Más adelante el flujo correcto será:

```text
process.env
→ Zod
→ configuración validada
→ aplicación
```

TypeScript type checking y runtime validation resuelven problemas diferentes.

---

## 6. `Readonly<T>`

`Readonly<T>` marca todas las propiedades de primer nivel como readonly.

```ts
type Config = {
  apiUrl: string;
  timeout: number;
};

type ReadonlyConfig =
  Readonly<Config>;

const config: ReadonlyConfig = {
  apiUrl: "https://api.example.com",
  timeout: 5000
};
```

Esto debe fallar:

```ts
config.timeout = 10000;
```

### ¿Por qué existe?

Permite expresar que una operación debe **consultar**, no modificar, un objeto.

Es útil en:

- configuración;
- parámetros que no deben mutarse;
- ciertos contratos de React;
- datos compartidos.

### `Readonly` no es inmutabilidad runtime

No ejecuta:

```ts
Object.freeze(config);
```

Después de compilar, `Readonly<T>` desaparece.

Además, `Readonly<T>` estándar es **shallow**, no una transformación recursiva profunda.

---

## 7. `Pick<T, K>`

`Pick` selecciona propiedades concretas de un tipo.

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
  activo: boolean;
  createdAt: Date;
};

type ResumenDispositivo =
  Pick<
    Dispositivo,
    "hostname" | "ip"
  >;
```

Resultado:

```ts
type ResumenDispositivo = {
  hostname: string;
  ip: string;
};
```

La Lección 15 conecta directamente aquí: las claves seleccionadas deben pertenecer a `keyof Dispositivo`.

Esto falla:

```ts
type Invalido =
  Pick<Dispositivo, "hostname" | "inventada">;
```

### Cuándo usar `Pick`

Cuando el contrato derivado representa un subconjunto estable y significativo:

- props específicas;
- campos editables;
- vistas resumidas;
- inputs internos;
- parámetros de una función.

---

## 8. `Omit<T, K>`

`Omit` conserva todo excepto las propiedades indicadas.

```ts
type CreateDeviceInput =
  Omit<
    Dispositivo,
    "id" | "createdAt"
  >;
```

Resultado conceptual:

```ts
type CreateDeviceInput = {
  hostname: string;
  ip: string;
  activo: boolean;
};
```

Esto encaja cuando `id` y `createdAt` son generados por backend/base de datos y no pertenecen al input de creación.

---

## 9. `Pick` vs `Omit`

Si necesitas pocas propiedades, `Pick` suele comunicar mejor:

```ts
type PublicUser =
  Pick<User, "id" | "name">;
```

Si necesitas casi todas excepto unas pocas:

```ts
type SafeUser =
  Omit<User, "passwordHash">;
```

La elección no es solo técnica. Debe expresar la intención del contrato.

---

## 10. `Omit` NO sanitiza objetos runtime

Supón:

```ts
type User = {
  id: string;
  email: string;
  passwordHash: string;
};

type PublicUser =
  Omit<User, "passwordHash">;
```

`PublicUser` no elimina físicamente `passwordHash` de un objeto JavaScript.

Si PostgreSQL devuelve:

```js
{
  id: "USR-001",
  email: "user@example.com",
  passwordHash: "SECRET"
}
```

el secreto sigue existiendo en runtime.

Debes construir realmente una respuesta segura, por ejemplo seleccionando explícitamente campos antes de serializar.

Regla:

```text
Omit
→ describe un tipo

código runtime
→ elimina/selecciona datos reales
```

---

## 11. Modelo de dominio vs DTO

Empieza a separar estos conceptos:

```text
modelo de dominio
≠
Create DTO
≠
Update DTO
≠
respuesta pública
≠
fila de PostgreSQL
```

Ejemplo:

```ts
type Device = {
  id: string;
  hostname: string;
  ip: string;
  createdAt: Date;
};

type CreateDeviceInput =
  Omit<Device, "id" | "createdAt">;
```

Esta derivación puede ser razonable inicialmente. Pero si el contrato HTTP y el dominio divergen, es mejor crear tipos independientes con nombres claros.

No derives un DTO solo para ahorrar líneas.

---

## 12. Combinar Utility Types

```ts
type EditableDeviceFields =
  Pick<
    Device,
    "hostname" | "ip"
  >;

type UpdateDeviceInput =
  Partial<EditableDeviceFields>;
```

Resultado:

```ts
type UpdateDeviceInput = {
  hostname?: string;
  ip?: string;
};
```

También podría escribirse:

```ts
type UpdateDeviceInput =
  Partial<
    Pick<
      Device,
      "hostname" | "ip"
    >
  >;
```

La primera versión puede ser más legible cuando `EditableDeviceFields` tiene significado propio.

---

## 13. Aplicación a SiteOps Tracker

```ts
type Auditoria = {
  id: string;
  sitio: string;
  responsable: string;
  estado: "pendiente" | "progreso" | "completada";
  observaciones: string;
  createdAt: Date;
};

type CamposEditablesAuditoria =
  Pick<
    Auditoria,
    "responsable" | "estado" | "observaciones"
  >;

type UpdateAuditoriaInput =
  Partial<CamposEditablesAuditoria>;

type CreateAuditoriaInput =
  Omit<Auditoria, "id" | "createdAt">;
```

Cada contrato representa una operación diferente.

---

## 14. Los tipos desaparecen en runtime

Un cliente puede enviar:

```json
{
  "id": 999,
  "estado": "destruida"
}
```

aunque tengas:

```ts
type UpdateAuditoriaInput =
  Partial<
    Pick<
      Auditoria,
      "estado" | "observaciones"
    >
  >;
```

El flujo correcto será:

```text
HTTP
→ dato no confiable
→ Zod
→ dato validado
→ Service
```

No hagas:

```ts
const input =
  req.body as UpdateAuditoriaInput;
```

Eso es una assertion, no validación.

---

## 15. React + TypeScript

```ts
type Device = {
  id: string;
  hostname: string;
  ip: string;
  status: "online" | "offline";
};
```

Un componente que solo muestra hostname y status podría recibir:

```ts
type DeviceCardProps =
  Pick<Device, "hostname" | "status">;
```

Esto limita el contrato del componente.

Pero no derives props del modelo backend por costumbre. Si la UI tiene un contrato independiente, puede ser mejor:

```ts
type StatusBadgeProps = {
  label: string;
  isOnline: boolean;
};
```

Deriva tipos solo cuando existe una relación conceptual real.

---

## 16. Node.js + Service + Repository

Un Service podría recibir:

```ts
type UpdateDeviceInput =
  Partial<
    Pick<
      Device,
      "hostname" | "ip"
    >
  >;

async function updateDevice(
  id: string,
  input: UpdateDeviceInput
) {
  // reglas de negocio
}
```

Pero `input` debe llegar **después** de runtime validation.

El Repository puede tener un contrato de persistencia distinto. No asumas que:

```text
HTTP DTO
=
modelo de dominio
=
fila SQL
```

El Service puede transformar datos antes de enviarlos al Repository.

---

## 17. PostgreSQL

TypeScript:

```ts
type Device = {
  hostname: string;
};
```

no sustituye:

```sql
hostname TEXT NOT NULL UNIQUE
```

PostgreSQL aporta garantías persistentes como:

```text
tipos SQL
NOT NULL
UNIQUE
CHECK
FOREIGN KEY
transacciones
```

Cada capa protege una responsabilidad distinta.

---

## 18. Testing

`Partial<T>` es útil para fixture builders:

```ts
function buildDevice(
  overrides: Partial<Device> = {}
): Device {
  // defaults válidos + overrides
}
```

Un test podría pedir:

```ts
const device =
  buildDevice({
    hostname: "router-test-01"
  });
```

El input puede ser parcial, pero el builder debe devolver un `Device` completo.

Este patrón será útil cuando lleguemos a Vitest.

---

## 19. Arquitectura Full Stack

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

### React

Usa contratos precisos para props, formularios y estado.

### HTTP

Transporta valores reales. No transporta `Partial`, `Pick`, interfaces ni aliases.

### Node

Ejecuta JavaScript; los Utility Types desaparecieron.

### Router

Relaciona método/ruta con el handler.

### Controller

Extrae `params`, `query` y `body` y coordina la entrada HTTP.

### Runtime Validation

Zod comprobará estructura y valores reales antes de confiar en ellos.

### Service

Aplica reglas de negocio sobre datos ya validados.

### Repository

Aísla la persistencia y traduce operaciones hacia PostgreSQL.

### PostgreSQL

Mantiene integridad persistente mediante constraints y transacciones.

### Testing

Comprueba comportamiento real de funciones, capas e integraciones.

### Docker

Empaqueta runtime y dependencias.

### CI/CD

Automatiza lint, type checking, tests, build y despliegue.

### Cloud

Ejecuta la aplicación profesionalmente desplegada.

---

## 20. Errores comunes

### Error 1 — `Partial<Entity>` para cualquier PATCH

```ts
type UpdateUser =
  Partial<User>;
```

Puede habilitar campos que nunca deberían editarse.

### Error 2 — creer que `Required` crea datos

No crea defaults ni valida `process.env`.

### Error 3 — creer que `Readonly` congela runtime

No ejecuta `Object.freeze()` y es shallow.

### Error 4 — creer que `Omit` elimina secretos

No modifica objetos reales.

### Error 5 — tipos ilegibles

No encadenes Utility Types sin necesidad si nombres intermedios comunican mejor la intención.

### Error 6 — derivar todo del modelo principal

Un DTO puede tener reglas independientes. La reutilización no debe crear acoplamiento accidental.

---

# PRÁCTICAS

## Práctica 1 — `Partial`

```ts
type Dispositivo = {
  id: string;
  hostname: string;
  ip: string;
  activo: boolean;
};

type CambiosDispositivo =
  Partial<Dispositivo>;
```

Crea:

1. un cambio solo de `hostname`;
2. un cambio de `ip` y `activo`;
3. un objeto vacío.

Explica por qué los tres cumplen el contrato.

No uses `any` ni assertions.

---

## Práctica 2 — `Required`

```ts
type OpcionesConexion = {
  host?: string;
  port?: number;
  ssl?: boolean;
};

type ConexionResuelta =
  Required<OpcionesConexion>;
```

Crea una variable válida. Después elimina una propiedad y observa el error.

Explica por qué `Required` no puede verificar `process.env`.

---

## Práctica 3 — `Readonly`

```ts
type ConfiguracionApp = {
  apiUrl: string;
  timeout: number;
};

type ConfiguracionProtegida =
  Readonly<ConfiguracionApp>;
```

Crea una variable e intenta:

```ts
config.timeout = 10000;
```

Explica:

1. por qué TypeScript lo rechaza;
2. qué ocurre después de compilar;
3. por qué no equivale a `Object.freeze()`.

---

## Práctica 4 — `Pick`

```ts
type Auditoria = {
  id: string;
  sitio: string;
  responsable: string;
  estado: "pendiente" | "progreso" | "completada";
  observaciones: string;
};

type ResumenAuditoria =
  Pick<Auditoria, "sitio" | "estado">;
```

Crea un objeto válido y explica por qué `Pick` mantiene la relación con `Auditoria`.

---

## Práctica 5 — `Omit`

```ts
type DeviceRecord = {
  id: string;
  hostname: string;
  ip: string;
  createdAt: Date;
};

type CreateDeviceInput =
  Omit<DeviceRecord, "id" | "createdAt">;
```

Crea un input válido y explica por qué `id` y `createdAt` pueden ser responsabilidad del backend/DB.

---

## Práctica 6 — `Pick` + `Partial`

```ts
type CamposEditablesAuditoria =
  Pick<
    Auditoria,
    "responsable" | "estado" | "observaciones"
  >;

type UpdateAuditoriaInput =
  Partial<CamposEditablesAuditoria>;
```

Crea dos updates válidos. Luego intenta modificar `id` o `sitio`.

Explica:

```text
Pick
→ qué puede cambiar

Partial
→ cuánto debe venir
```

---

# EJERCICIO PRINCIPAL — SiteOps Tracker

```ts
type Hallazgo = {
  id: string;
  auditoriaId: string;
  descripcion: string;
  severidad: "baja" | "media" | "alta";
  resuelto: boolean;
  createdAt: Date;
};
```

Diseña:

```text
CreateHallazgoInput
UpdateHallazgoInput
HallazgoResumen
```

Reglas:

- creación no recibe `id`;
- creación no recibe `createdAt`;
- actualización solo permite `descripcion`, `severidad` y `resuelto`;
- los campos de actualización son opcionales;
- resumen solo contiene `id`, `descripcion`, `severidad` y `resuelto`.

Utiliza `Omit`, `Pick` y `Partial`.

No uses `any` y no escribas los tres contratos completamente a mano.

### Pistas

Para creación, piensa qué excluir. Para actualización, piensa qué campos son editables y si todos deben venir en un PATCH. Para resumen, piensa qué seleccionar.

No se incluye la solución completa.

---

# RETO 1 — React + TypeScript

```ts
type Device = {
  id: string;
  hostname: string;
  ip: string;
  status: "online" | "offline";
  lastSeen: Date;
};
```

Diseña las props de `DeviceCard`, que solo necesita `hostname`, `status` y `lastSeen`, usando `Pick`.

Después diseña el estado parcial de `EditableDeviceForm`, que solo edita `hostname` e `ip`, usando `Pick` + `Partial`.

Responde:

1. ¿por qué el componente no necesita `id`?
2. ¿qué ventaja tiene limitar las props?
3. ¿`Pick` valida datos de una API?
4. ¿dónde debe ocurrir runtime validation?

---

# RETO 2 — Node.js + REST

Diseña:

```http
PATCH /api/devices/:id
```

Solo pueden modificarse:

```text
hostname
ip
status
```

Diseña `UpdateDeviceInput`.

Explica:

```text
req.body
↓
Runtime Validation
↓
UpdateDeviceInput confiable
↓
Service
↓
Repository
```

Responde:

1. ¿por qué `Partial<Device>` es demasiado amplio?
2. ¿qué combinación expresa mejor los campos editables?
3. ¿TypeScript impide que Postman envíe `createdAt`?
4. ¿qué capa rechaza valores inválidos?
5. ¿qué recibe el Service?

---

# RETO 3 — PostgreSQL y seguridad

```ts
type User = {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

type PublicUser =
  Omit<User, "passwordHash">;
```

Analiza una fila real que todavía contiene `passwordHash`.

Responde:

1. ¿`PublicUser` elimina `passwordHash` del objeto runtime?
2. ¿es seguro enviar la fila directamente como JSON?
3. ¿qué código runtime necesitas para producir una respuesta segura?
4. ¿qué test escribirías para verificar que nunca se expone el hash?

---

# RETO 4 — Testing

Diseña conceptualmente:

```ts
function buildDevice(
  overrides: Partial<Device> = {}
): Device {
  // defaults válidos + overrides
}
```

Responde:

1. ¿por qué `Partial<Device>` es útil como parámetro?
2. ¿por qué el retorno debe ser `Device`?
3. ¿qué defaults necesita?
4. ¿qué ocurre si un override viola una regla de negocio?
5. ¿el builder reemplaza tests de validación?

---

# RETO 5 — Arquitectura Full Stack

Analiza:

```text
React
↓
PATCH /api/audits/:id
↓
Router
↓
Controller
↓
Zod
↓
Service
↓
Repository
↓
PostgreSQL
```

Con:

```ts
type EditableAuditFields =
  Pick<
    Auditoria,
    "responsable" | "estado" | "observaciones"
  >;

type UpdateAuditInput =
  Partial<EditableAuditFields>;
```

Responde:

1. ¿qué protege `Pick` en compile time?
2. ¿qué aporta `Partial`?
3. ¿React puede enviar campos inválidos por HTTP?
4. ¿qué debe hacer Zod?
5. ¿por qué el Service no recibe `req.body` directamente?
6. ¿qué reglas pertenecen al Service?
7. ¿qué responsabilidad tiene el Repository?
8. ¿qué constraints puede aplicar PostgreSQL?
9. ¿qué debería verificar un test de integración?

---

# Relación explícita con tus proyectos

**SiteOps Tracker:** inputs de creación/actualización, resúmenes y fixtures.  
**Repositorio de algoritmos:** refuerza transformación de tipos y `keyof`.  
**Analizador:** configuración parcial/resuelta y subconjuntos de campos.  
**SDK tipado:** Create/Update/Public contracts sin `any`.  
**API REST:** Utility Types describen contratos internos; Zod valida runtime.  
**React Full Stack:** contratos precisos sin asumir que frontend, dominio y DB comparten exactamente el mismo tipo.

---

# Preguntas de comprensión

1. ¿Qué problema resuelven los Utility Types?
2. ¿Qué transforma `Partial<T>`?
3. ¿Cuándo `Partial<Entity>` es demasiado permisivo?
4. ¿Qué hace `Required<T>`?
5. ¿`Required` crea valores?
6. ¿Por qué `process.env` requiere runtime validation?
7. ¿Qué hace `Readonly<T>`?
8. ¿Equivale a `Object.freeze()`?
9. ¿Es shallow o deep?
10. ¿Qué hace `Pick<T, K>`?
11. ¿Cómo se relaciona con `keyof`?
12. ¿Qué hace `Omit<T, K>`?
13. ¿Cuándo elegir `Pick` frente a `Omit`?
14. ¿`Omit` elimina propiedades runtime?
15. ¿Por qué no basta para ocultar `passwordHash`?
16. ¿Qué diferencia hay entre dominio y DTO?
17. ¿Por qué Create DTO puede no incluir `id`?
18. ¿Por qué Update DTO puede usar `Partial<Pick<...>>`?
19. ¿Cómo aplicarías `Pick` en React?
20. ¿Cómo aplicarías `Partial` en Testing?
21. ¿Qué debe validar Zod?
22. ¿Qué garantiza PostgreSQL que TypeScript no garantiza?
23. ¿Por qué Utility Types desaparecen en runtime?

---

# Relevancia para entrevistas

**What does `Partial<T>` do?**

> `Partial<T>` creates a new type where every property of `T` is optional. I use it only when the operation is genuinely partial.

**What is the difference between `Pick` and `Omit`?**

> `Pick<T, K>` keeps selected keys, while `Omit<T, K>` keeps everything except selected keys.

**Does `Readonly<T>` make an object immutable at runtime?**

> No. It is a shallow compile-time restriction and does not automatically call `Object.freeze()`.

**Can `Omit<User, "passwordHash">` protect an API response?**

> Not by itself. The application must construct a runtime object that actually excludes the sensitive field.

**Does `Required<T>` validate environment variables?**

> No. Environment variables require runtime validation.

---

# Cómo explicarlo con tu portafolio

> In SiteOps Tracker, my fictional infrastructure-audit portfolio application, I use utility types to derive operation-specific contracts. For example, an audit update can use `Partial<Pick<Audit, "status" | "assignee" | "notes">>`, which keeps immutable fields such as the ID outside the update contract.

> I keep TypeScript DTOs separate from runtime trust. HTTP payloads are validated before they enter the service layer.

> I do not rely on `Omit` to remove sensitive properties at runtime; response mapping and tests must ensure secrets are not serialized.

---

# Checklist de code review

```text
1. ¿Existe una relación real entre base y derivado?
2. ¿Partial permite campos indebidos?
3. ¿Pick comunica mejor lo permitido?
4. ¿Omit comunica mejor lo excluido?
5. ¿Estoy acoplando un DTO al dominio?
6. ¿Confundo Readonly con runtime immutability?
7. ¿Creo que Omit sanitiza objetos?
8. ¿Creo que Required valida externos?
9. ¿El tipo se volvió ilegible?
10. ¿Dónde ocurre runtime validation?
```

---

# Resumen

`Partial<T>` hace propiedades opcionales.  
`Required<T>` las hace obligatorias.  
`Readonly<T>` impide mutaciones en compile time.  
`Pick<T, K>` selecciona propiedades.  
`Omit<T, K>` excluye propiedades.

Una combinación muy útil para PATCH es:

```ts
type EditableFields =
  Pick<Device, "hostname" | "ip">;

type UpdateDeviceInput =
  Partial<EditableFields>;
```

Pero la transformación debe representar reglas reales del caso de uso.

```text
TypeScript types
→ desaparecen al compilar
```

Por eso Utility Types no validan HTTP, formularios, APIs externas, archivos, variables de entorno ni datos de PostgreSQL.

La arquitectura profesional mantiene responsabilidades separadas:

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

**Lección 17 — Mapped Types.**
