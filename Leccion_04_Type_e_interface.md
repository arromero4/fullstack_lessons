# Lección 4 — `type` e `interface`

> **Proyecto transversal de portafolio — SiteOps Tracker:** aplicación ficticia para auditar infraestructura TI en distintas sedes, registrar activos, hallazgos, estados, responsables, acciones correctivas e historial. Arquitectura Full Stack objetivo: React + TypeScript, Node.js/Express + TypeScript, PostgreSQL, Testing y Docker. Todos los nombres, datos y escenarios son ficticios.


**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Debes poder:

- entender por qué repetir tipos inline es un problema;
- crear aliases con `type`;
- crear contratos con `interface`;
- conocer similitudes y diferencias;
- reutilizar contratos en variables, arrays y funciones;
- modelar entidades de SiteOps Tracker;
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

