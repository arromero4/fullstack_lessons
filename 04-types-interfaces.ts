interface Dispositivo {
  id: number;
  hostname: string;
  ip: string;
  puerto: number;
  activo: boolean;
}

const router = {
  id: 1,
  hostname: "ctl-condesa-sw-1",
  ip: "192.168.1.1",
  puerto: 22,
  activo: true,
};

console.log(router);

const dispositivos: Dispositivo[] = [
  {
    id: 2,
    hostname: "ctl-condesa-sw-2",
    ip: "192.168.1.2",
    puerto: 22,
    activo: true,
  },
  {
    id: 3,
    hostname: "ctl-condesa-sw-3",
    ip: "192.168.1.3",
    puerto: 22,
    activo: true,
  },
  {
    id: 1,
    hostname: "ctl-condesa-sw-4",
    ip: "192.168.1.4",
    puerto: 22,
    activo: true,
  },
];

function imprimirDispositivo(dispositivo: Dispositivo):void{
  console.log(`${dispositivo.hostname} | ${dispositivo.ip} | ${dispositivo.activo}`)
}



for(let d of dispositivos){
  imprimirDispositivo(d)
}

