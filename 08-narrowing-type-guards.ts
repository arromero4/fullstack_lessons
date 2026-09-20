function formatearValor(
  valor: string | number
): string{
  let res: string | number
  if(typeof valor === "string"){
    res = valor.toUpperCase()
  }else{
    res = valor.toFixed(2)
  }
  return `El valor es ${res}`

} 
console.log(formatearValor("router"));
console.log(formatearValor(24.5678));

type Router = {
  hostname: string;
  rutas: number;
};

type Switch = {
  hostname: string;
  vlans: number;
};


function describirDispositivo(
  dispositivo: Router | Switch): string{

  if("rutas" in dispositivo){
    return `${dispositivo.hostname} tiene ${dispositivo.rutas} rutas`
  }else if("vlans" in dispositivo){
    return `${dispositivo.hostname} tiene ${dispositivo.vlans} VLANs`
  }
  return "Dispositivo desconocido"
  }

const router = describirDispositivo({ 
  hostname: "router-core-01", 
  rutas: 24,
 })



const switch1 = describirDispositivo({
   hostname: "switch-core-01", 
   vlans: 12 
  })

  console.log(router);
console.log(switch1);


function formatearFecha(
  valor: string | Date
): string{
  if(valor instanceof Date){
    return valor.toISOString()
  }

  return valor
}

console.log(formatearFecha(new Date()));
console.log(formatearFecha("2026-08-26"));