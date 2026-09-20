type EstadoDispositivo =
  | "online"
  | "offline"
  | "maintenance";

  interface Dispositivo {
    readonly id: number,
    hostname: string,
    estado: EstadoDispositivo
  }

  const disp1: Dispositivo = {
    id: 1,
    hostname: "oad-cuicuilco-rt-1",
    estado: "online"
  }

   const disp2: Dispositivo = {
    id: 2,
    hostname: "oad-cuicuilco-sw-1",
    estado: "offline"
  }

   const disp3: Dispositivo = {
    id: 3,
    hostname: "oad-cuicuilco-sw-2",
    estado: "maintenance"
  }

