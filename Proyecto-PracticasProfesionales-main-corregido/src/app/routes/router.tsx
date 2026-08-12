/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { createBrowserRouter, Navigate, Outlet, useNavigate } from "react-router";

import { LandingPage } from "../pages/landing/LandingPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { MainLayout } from "../layouts/MainLayout";
import { ProtectedRoute } from "./ProtectedRoute";
import { cambiarPasswordInicial } from "../../infrastructure/auth/authApi";
import { obtenerRutaInicioPorRol, obtenerRutaInicioSesionGuardada } from "./authSession";
import { getApiErrorMessage } from "../../shared/utils/apiError";

// Alumno
import { AlumnoDashboard } from "../pages/alumno/AlumnoDashboard";
import { AlumnoPerfil } from "../pages/alumno/AlumnoPerfil";
import { PadronEmpresarial } from "../pages/alumno/PadronEmpresarial";
import { HorasAcumuladas } from "../pages/alumno/HorasAcumuladas";
import { EvaluacionEmpresa } from "../pages/alumno/EvaluacionEmpresa";
import { AlumnoNotificaciones } from "../pages/alumno/AlumnoNotificaciones";
import { CargaDocumentos } from "../pages/alumno/CargaDocumentos";
import { AlumnoReportes } from "../pages/alumno/AlumnoReportes";
import { AlumnoLiberacion } from "../pages/alumno/AlumnoLiberacion";

// Otras páginas para admin, coordinador, etc. se agregarían aquí
// Coordinador
import { CoordinadorDashboard } from "../pages/coordinador/CoordinadorDashboard";
import { GestionAlumnos } from "../pages/coordinador/GestionAlumnos";
import { RevisionDocumentos } from "../pages/coordinador/RevisionDocumentos";
import { CoordinadorAsignaciones } from "../pages/coordinador/CoordinadorAsignaciones";
import { AsignarAsesores } from "../pages/coordinador/AsignarAsesores";
import { CoordinadorSeguimiento } from "../pages/coordinador/CoordinadorSeguimiento";
import { CoordinadorLiberacion } from "../pages/coordinador/CoordinadorLiberacion";
import { CoordinadorNotificaciones } from "../pages/coordinador/CoordinadorNotificaciones";

// Unidad
import { UnidadDashboard } from "../pages/unidad/UnidadDashboard";
import { RegistroEmpresa } from "../pages/unidad/RegistroEmpresa";
import { PerfilEmpresa } from "../pages/unidad/PerfilEmpresa";
import { PlanTrabajo } from "../pages/unidad/PlanTrabajo";
import { AlumnosUnidad } from "../pages/unidad/AlumnosUnidad";
import { ConveniosUnidad } from "../pages/unidad/ConveniosUnidad";
import { HorasUnidad } from "../pages/unidad/HorasUnidad";
import { EvaluacionesUnidad } from "../pages/unidad/EvaluacionesUnidad";

// Coord. Unidades
import { CoordUnidadesDashboard } from "../pages/coord-unidades/CoordUnidadesDashboard";
import { ValidacionEmpresas } from "../pages/coord-unidades/ValidacionEmpresas";
import { GestionConvenios } from "../pages/coord-unidades/GestionConvenios";
import { ExpedienteEmpresa } from "../pages/coord-unidades/ExpedienteEmpresa";
import { GestionVacantes } from "../pages/coord-unidades/GestionVacantes";
import { PadronEmpresarial as PadronEmpresarialCoord } from "../pages/coord-unidades/PadronEmpresarial";
import { NotificacionesCoordUnidades } from "../pages/coord-unidades/NotificacionesCoordUnidades";

// Admin
import { AdminDashboard } from "../pages/admin/AdminDashboard";
import { GestionUsuarios } from "../pages/admin/GestionUsuarios";
import { AdminRolesPermisos } from "../pages/admin/AdminRolesPermisos";
import { AdminCatalogos } from "../pages/admin/AdminCatalogos";
import { AdminReportes } from "../pages/admin/AdminReportes";
import { AdminBitacora } from "../pages/admin/AdminBitacora";
import { AdminConfiguracion } from "../pages/admin/AdminConfiguracion";

// Asesor
import { AsesorDashboard } from "../pages/asesor/AsesorDashboard";
import { AlumnosAsignados } from "../pages/asesor/AlumnosAsignados";
import { AsesorReportes } from "../pages/asesor/AsesorReportes";
import { AsesorObservaciones } from "../pages/asesor/AsesorObservaciones";
import { AsesorNotificaciones } from "../pages/asesor/AsesorNotificaciones";

// Dirección
import { DireccionDashboard } from "../pages/direccion/DireccionDashboard";
import { DireccionEstadisticas } from "../pages/direccion/DireccionEstadisticas";
import { DireccionReportes } from "../pages/direccion/DireccionReportes";

function PublicOnlyRoute() {
  const rutaSesion = obtenerRutaInicioSesionGuardada();
  if (rutaSesion) {
    return <Navigate to={rutaSesion} replace />;
  }
  return <Outlet />;
}

function CambiarPasswordInicialPage() {
  const navigate = useNavigate();
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const usuario = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("usuario") ?? "null");
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (!usuario) {
      navigate("/login", { replace: true });
      return;
    }

    const ruta = obtenerRutaInicioPorRol(usuario.rol, usuario.id_rol);
    if (usuario.rol !== "Alumno" || usuario.debe_cambiar_password !== true) {
      navigate(ruta, { replace: true });
    }
  }, [navigate, usuario]);

  async function guardarPassword() {
    if (!passwordActual || !passwordNueva || !confirmarPassword) {
      setError("Completa los tres campos de contraseña.");
      return;
    }

    if (passwordNueva.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (passwordNueva !== confirmarPassword) {
      setError("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      await cambiarPasswordInicial({
        password_actual: passwordActual,
        password_nueva: passwordNueva,
        confirmar_password: confirmarPassword,
      });

      const usuarioActualizado = {
        ...usuario,
        debe_cambiar_password: false,
      };
      sessionStorage.setItem("usuario", JSON.stringify(usuarioActualizado));
      setMensaje("Contrasena actualizada correctamente.");
      navigate(obtenerRutaInicioPorRol(usuario.rol, usuario.id_rol), { replace: true });
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo cambiar la contraseña."));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7fb] flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm max-w-md w-full p-8">
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Cambiar contrasena</h1>
        <p className="text-sm text-gray-500 mt-2">
          Como alumno, debes cambiar la contrasena temporal antes de continuar.
        </p>

        <div className="space-y-4 mt-6">
          <input
            type="password"
            autoComplete="current-password"
            value={passwordActual}
            onChange={(event) => setPasswordActual(event.target.value)}
            placeholder="Contrasena temporal"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
          />
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={passwordNueva}
            onChange={(event) => setPasswordNueva(event.target.value)}
            placeholder="Nueva contrasena"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
          />
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmarPassword}
            onChange={(event) => setConfirmarPassword(event.target.value)}
            placeholder="Confirmar nueva contrasena"
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
          />
          <p className="text-xs text-gray-500">
            La nueva contraseña debe tener al menos 8 caracteres.
          </p>
        </div>

        {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">{error}</div>}
        {mensaje && <div className="mt-4 bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm">{mensaje}</div>}

        <button
          onClick={guardarPassword}
          disabled={guardando}
          className="mt-6 w-full py-3 bg-[#0d2b5e] text-white rounded-xl text-sm font-bold disabled:opacity-60"
        >
          {guardando ? "Guardando..." : "Guardar nueva contrasena"}
        </button>
      </div>
    </div>
  );
}


export const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: "/",
        element: <LandingPage />,
      },
      {
        path: "/login",
        element: <LoginPage />,
      },
      {
        path: "/registro-empresa",
        element: <RegistroEmpresa />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/cambiar-password-inicial",
        element: <CambiarPasswordInicialPage />,
      },
    ],
  },

{
  element: <ProtectedRoute allowedRoles={[1]} />,
  children: [
    {
      path: "/alumno",
      element: <MainLayout />,
      children: [
        {
          index: true,
          element: <AlumnoDashboard />,
        },
        {
          path: "perfil",
          element: <AlumnoPerfil />,
        },
        {
          path: "documentos",
          element: <CargaDocumentos />,
        },
        {
          path: "padron",
          element: <PadronEmpresarial />,
        },
        {
          path: "horas",
          element: <HorasAcumuladas />,
        },
        {
          path: "evaluacion",
          element: <EvaluacionEmpresa />,
        },
        {
          path: "notificaciones",
          element: <AlumnoNotificaciones />,
        },
        {
          path: "reportes",
          element: <AlumnoReportes />,
        },
        {
          path: "liberacion",
          element: <AlumnoLiberacion />,
        },
      ],
    },
  ],
},

// Coordinador
{
  element: <ProtectedRoute allowedRoles={[3]} />,
  children: [
    {
      path: "/coordinador",
      element: <MainLayout />,
      children: [
        { index: true, element: <CoordinadorDashboard /> },
        { path: "alumnos", element: <GestionAlumnos /> },
        { path: "documentos", element: <RevisionDocumentos /> },
        { path: "asignaciones", element: <CoordinadorAsignaciones /> },
        { path: "asesores", element: <AsignarAsesores /> },
        { path: "seguimiento", element: <CoordinadorSeguimiento /> },
        { path: "liberacion", element: <CoordinadorLiberacion /> },
        { path: "notificaciones", element: <CoordinadorNotificaciones /> },
      ],
    },
  ],
},

// Unidad Receptora
{
  element: <ProtectedRoute allowedRoles={[5]} />,
  children: [
    {
      path: "/unidad",
      element: <MainLayout />,
      children: [
        { index: true, element: <UnidadDashboard /> },
        { path: "perfil", element: <PerfilEmpresa /> },
        { path: "ofertas", element: <PlanTrabajo /> },
        { path: "alumnos", element: <AlumnosUnidad /> },
        { path: "convenios", element: <ConveniosUnidad /> },
        { path: "horas", element: <HorasUnidad /> },
        { path: "evaluaciones", element: <EvaluacionesUnidad /> },
      ],
    },
  ],
},

// Coordinador de Unidades
{
  element: <ProtectedRoute allowedRoles={[4]} />,
  children: [
    {
      path: "/coord-unidades",
      element: <MainLayout />,
      children: [
        { index: true, element: <CoordUnidadesDashboard /> },
        { path: "empresas", element: <ValidacionEmpresas /> },
        { path: "empresas/expediente", element: <ExpedienteEmpresa /> },
        { path: "empresas/:idEmpresa/expediente", element: <ExpedienteEmpresa /> },
        { path: "convenios", element: <GestionConvenios /> },
        { path: "vacantes", element: <GestionVacantes /> },
        { path: "padron", element: <PadronEmpresarialCoord /> },
        { path: "notificaciones", element: <NotificacionesCoordUnidades /> },
      ],
    },
  ],
},

// Administrador
{
  element: <ProtectedRoute allowedRoles={[2]} />,
  children: [
    {
      path: "/admin",
      element: <MainLayout />,
      children: [
        { index: true, element: <AdminDashboard /> },
        { path: "usuarios", element: <GestionUsuarios /> },
        { path: "roles", element: <AdminRolesPermisos /> },
        { path: "catalogos", element: <AdminCatalogos /> },
        { path: "reportes", element: <AdminReportes /> },
        { path: "bitacora", element: <AdminBitacora /> },
        { path: "configuracion", element: <AdminConfiguracion /> },
      ],
    },
  ],
},

// Asesor
{
  element: <ProtectedRoute allowedRoles={[6]} />,
  children: [
    {
      path: "/asesor",
      element: <MainLayout />,
      children: [
        { index: true, element: <AsesorDashboard /> },
        { path: "alumnos", element: <AlumnosAsignados /> },
        { path: "reportes", element: <AsesorReportes /> },
        { path: "observaciones", element: <AsesorObservaciones /> },
        { path: "notificaciones", element: <AsesorNotificaciones /> },
      ],
    },
  ],
},

// Dirección
{
  element: <ProtectedRoute allowedRoles={[7]} />,
  children: [
    {
      path: "/direccion",
      element: <MainLayout />,
      children: [
        { index: true, element: <DireccionDashboard /> },
        { path: "estadisticas", element: <DireccionEstadisticas /> },
        { path: "reportes", element: <DireccionReportes /> },
      ],
    },
  ],
},


] );
