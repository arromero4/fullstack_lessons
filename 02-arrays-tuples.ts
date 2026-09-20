let dispositivos: string[] = [
  "router-core-01",
  "switch-core-01",
  "firewall-01",
];

dispositivos.push("access-point-01");
for (let s of dispositivos) {
  console.log(s);
}

let latencias: number[] = [12, 20, 7, 35];
let res: number = 0;
for (let i = 0; i < latencias.length; i++) {
  res += latencias[i];
}
let promedio = res / latencias.length;
console.log(`Latencia promedio: ${promedio} ms`);

const conexion: [string, number, boolean] = ["192.168.1.1", 22, true];

const [ip, puerto, activo ] = conexion
console.log(`${ip}:${puerto} | Estado: ${activo}`)