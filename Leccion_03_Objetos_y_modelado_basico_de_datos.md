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

