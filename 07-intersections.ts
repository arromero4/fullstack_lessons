type Identidad = {
  readonly id: number
}

type DatosRed = {
  hostname: string,
  ip: string,
}

type EstadoOperativo = {
  activo: boolean
}

type Dispositivo = Identidad & DatosRed & EstadoOperativo

const router = {
  id: 1,
  hostname: "ctl-ct-san-juan-rt-1",
  ip:"192.168.1.1",
  activo: true,
}

function imprimirDispositivo(
  dispositivo: Dispositivo
): void{
  console.log(`${dispositivo.id} | ${dispositivo.hostname} | ${dispositivo.ip} | activo=${dispositivo.activo}` )
}

imprimirDispositivo(router)