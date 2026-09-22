# Lección 2 — Arrays y tuplas en TypeScript

**Duración objetivo:** 15–20 minutos.

## 1. Objetivo

Debes poder:

- crear arrays correctamente tipados;
- entender la inferencia en arrays;
- diferenciar `string[]` y `Array<string>`;
- entender qué problema resuelven las tuplas;
- saber cuándo una tupla es apropiada;
- conectar arrays con React, Node.js y PostgreSQL;
- recordar que una estructura TypeScript no valida datos externos en runtime.

---

## 2. Arrays

```ts
const ips = [
  "192.168.1.1",
  "192.168.1.2",
  "192.168.1.3"
];
```

TypeScript infiere:

```ts
string[]
```

Esto es válido:

```ts
ips.push("192.168.1.4");
```

Esto no:

```ts
ips.push(8080);
```

---

## 3. Tipado explícito

```ts
const puertos: number[] = [22, 80, 443];
```

También:

```ts
const puertos: Array<number> = [22, 80, 443];
```

Normalmente usaremos:

```ts
number[]
string[]
boolean[]
```

---

## 4. Arrays vacíos

Conviene indicar el tipo cuando sabes qué contendrá:

```ts
const errores: string[] = [];
```

---

## 5. Arrays con objetos

```ts
const auditorias = [
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

TypeScript infiere una estructura común para sus elementos.

---

## 6. Tuplas

Una tupla modela posiciones con tipos específicos:

```ts
const resultado: [boolean, string] = [
  true,
  "Conexión exitosa"
];
```

Posición 0:

```ts
boolean
```

Posición 1:

```ts
string
```

---

## 7. Array vs tupla

Array:

```ts
const puertos: number[] = [22, 80, 443];
```

Representa:

> una colección de números.

Tupla:

```ts
const servidor: [string, number] = [
  "192.168.1.10",
  443
];
```

Representa:

> una estructura fija donde cada posición tiene significado.

---

## 8. Desestructuración

```ts
const conexion: [string, number] = [
  "192.168.1.20",
  443
];

const [ip, puerto] = conexion;
```

TypeScript infiere:

```ts
ip: string
puerto: number
```

---

## 9. `const` no vuelve inmutable al array

```ts
const puertos = [22, 80, 443];

puertos.push(8080);
```

es válido.

`const` evita reasignar la variable completa, no modificar el contenido.

---

## 10. Arrays heterogéneos

```ts
const valores = [
  "router-01",
  22,
  true
];
```

TypeScript puede inferir:

```ts
(string | number | boolean)[]
```

Eso **no** es lo mismo que una tupla:

```ts
const valores: [string, number, boolean] = [
  "router-01",
  22,
  true
];
```

---

## 11. Relación con React

```tsx
const dispositivos = [
  "router-01",
  "switch-01",
  "firewall-01"
];

return (
  <ul>
    {dispositivos.map((dispositivo) => (
      <li key={dispositivo}>
        {dispositivo}
      </li>
    ))}
  </ul>
);
```

Flujo típico:

```text
API
 ↓
array de dispositivos
 ↓
estado de React
 ↓
.map()
 ↓
componentes renderizados
```

---

## 12. Relación con Node.js y PostgreSQL

Una consulta SQL:

```sql
SELECT *
FROM dispositivos;
```

puede terminar conceptualmente en:

```ts
Dispositivo[]
```

dentro del backend.

---

## 13. Runtime validation

Aunque escribamos:

```ts
string[]
```

una API podría enviarnos:

```json
[
  "router-01",
  500,
  false
]
```

Por eso:

```text
HTTP
 ↓
unknown data
 ↓
Runtime Validation
 ↓
string[]
```

---

## 14. Ejercicio

Archivo:

```text
02-arrays-tuples.ts
```

Parte 1:

- Crea un array `dispositivos`.
- Agrega `access-point-01` con `push()`.
- Recorre con `for...of`.

Parte 2:

- Crea `latencias = [12, 20, 7, 35]`.
- Calcula suma.
- Calcula promedio.

Parte 3:

Crea una tupla:

```ts
[string, number, boolean]
```

que represente:

```text
IP
puerto
activo
```

y usa desestructuración.

---

## 15. Reto

Crea:

```ts
function obtenerEstadoConexion(
  ip: string,
  puerto: number,
  latencia: number
): [boolean, string]
```

Regla:

```text
latencia <= 100 -> saludable
```

Debes devolver una tupla con:

```text
boolean
mensaje
```

---

## 16. Entrevista técnica

Pregunta:

> What is the difference between an array and a tuple in TypeScript?

Respuesta conceptual:

> An array represents a collection of values with a shared element type, while a tuple represents a fixed positional structure.

---

## 17. Resumen

```text
Array
 ↓
colección
```

```text
Tuple
 ↓
estructura fija por posiciones
```

```text
TypeScript type
!=
runtime validation
```

**Próxima lección:** Objetos.

---

