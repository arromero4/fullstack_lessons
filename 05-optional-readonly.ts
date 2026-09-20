interface Dispositivo {
  readonly id: number,
  hostname: string,
  ip: string,
  descripcion?: string,
  activo: boolean
}

const dispositivo1: Dispositivo = {
  id: 1,
  hostname: "ctl-valle-sw-1",
  ip: "192.168.1.1",
  descripcion: "fila 1, sala 101, rack 1",
  activo: true,
}

const dispositivo2: Dispositivo = {
  id: 1,
  hostname: "ctl-valle-sw-2",
  ip: "192.168.1.2",
  activo: true,
}

function imprimirDispositivo(
  dispositivo: Dispositivo
): void{
  if(dispositivo.descripcion !== undefined){
    console.log(`${dispositivo.hostname} | ${dispositivo.ip} | ${dispositivo.activo} | ${dispositivo.descripcion}`)
  }else{
    console.log(`${dispositivo.hostname} | ${dispositivo.ip} | ${dispositivo.activo} | Sin descripción`)
  }
}

// dispositivo1.id= 3

imprimirDispositivo(dispositivo1)
imprimirDispositivo(dispositivo2)
