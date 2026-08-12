export type UsuarioSesionAuth = {
  id_rol?: number;
  rol?: string | null;
  debe_cambiar_password?: boolean;
};

export function obtenerRutaInicioPorRol(nombre?: string | null, idRol?: number | null) {
  const rol = (nombre ?? "").toLowerCase();

  if (rol.includes("alumno") || idRol === 1) return "/alumno";
  if (rol.includes("admin") || idRol === 2) return "/admin";
  if (rol.includes("coordinador de unidades") || idRol === 4) return "/coord-unidades";
  if (rol.includes("coordinador") || idRol === 3) return "/coordinador";
  if (rol.includes("unidad") || rol.includes("empresa") || idRol === 5) return "/unidad";
  if (rol.includes("asesor") || rol.includes("docente") || idRol === 6) return "/asesor";
  if (rol.includes("direccion") || idRol === 7) return "/direccion";

  return "/login";
}

export function obtenerSesionGuardada(): UsuarioSesionAuth | null {
  const token = sessionStorage.getItem("token");
  const usuario = sessionStorage.getItem("usuario");
  if (!token || !usuario) return null;

  try {
    return JSON.parse(usuario);
  } catch {
    cerrarSesionLocal();
    return null;
  }
}

export function obtenerRutaInicioSesionGuardada() {
  const usuario = obtenerSesionGuardada();
  if (!usuario) return null;

  if (usuario.rol === "Alumno" && usuario.debe_cambiar_password === true) {
    return "/cambiar-password-inicial";
  }

  return obtenerRutaInicioPorRol(usuario.rol, usuario.id_rol);
}

export function cerrarSesionLocal() {
  sessionStorage.clear();
  localStorage.removeItem("token");
  localStorage.removeItem("usuario");
}
