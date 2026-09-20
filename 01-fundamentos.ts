let auditoriaId: number
let hostname: string
let ip:string
let puerto:number
let latenciaMs: number
let dipositivoActivo: boolean

function mostrarDispositivo(hostname: string,
  ip:string,
  puerto:number,
  activo:boolean
){
  return (`${hostname} | ${ip}:${puerto} | Activo=${activo}`)
}

let dispositivo = mostrarDispositivo("SW-CORE-01", "192.168.10.1", 22, true)

console.log(dispositivo)