let dispotivo = {
  id: 1,
  hostname: "router-core-01",
  ip: "192.168.1.1",
  puerto: 22,
  activo: true,
};

dispotivo.activo = false;

console.log(`ID: ${dispotivo.id}
Hostname: ${dispotivo.hostname}
IP: ${dispotivo.ip}
Puerto: ${dispotivo.puerto}
Activo: ${dispotivo.activo}
  `);

let dispositivos = [
  {
    id: 1,
    hostname: "router-core-01",
    ip: "192.168.1.1",
    activo: true,
  },
    {
    id: 2,
    hostname: "router-core-02",
    ip: "192.168.1.2",
    activo: true,
  },
    {
    id: 3,
    hostname: "router-core-03",
    ip: "192.168.1.2",
    activo: false,
  },
];

for(let d of dispositivos){
  console.log(`${d.hostname} - ${d.ip} - activo=${d.activo}`)
}