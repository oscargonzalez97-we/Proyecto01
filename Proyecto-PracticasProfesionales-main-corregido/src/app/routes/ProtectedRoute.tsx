import { Navigate, Outlet, useLocation } from "react-router";
import { cerrarSesionLocal, obtenerRutaInicioPorRol } from "./authSession";

interface ProtectedRouteProps {
  allowedRoles?: number[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const token = sessionStorage.getItem("token");
  const usuarioGuardado = sessionStorage.getItem("usuario");

  if (!token || !usuarioGuardado) {
    cerrarSesionLocal();
    return <Navigate to="/login" replace />;
  }

  let usuario;
  try {
    usuario = JSON.parse(usuarioGuardado);
  } catch {
    cerrarSesionLocal();
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(usuario.id_rol)
  ) {
    return <Navigate to={obtenerRutaInicioPorRol(usuario.rol, usuario.id_rol)} replace />;
  }

  const cambioObligatorioAlumno =
    usuario.rol === "Alumno" && usuario.debe_cambiar_password === true;

  if (
    cambioObligatorioAlumno &&
    location.pathname !== "/cambiar-password-inicial"
  ) {
    return <Navigate to="/cambiar-password-inicial" replace />;
  }

  return <Outlet />;
}
