import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import {
  Award,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Clock3,
  ClipboardList,
  FileCheck,
  FileText,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  Star,
  User,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import logoInstitucional from "../../assets/Ocelote1.png";
import { NotificationCenter } from "../components/NotificationCenter";
import { cerrarSesionLocal } from "../routes/authSession";

type UsuarioSesion = {
  id_usuario?: number;
  id_rol?: number;
  nombre?: string;
  nombre_completo?: string;
  rol?: string | null;
  correo?: string;
};

type NavItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: number;
};

function obtenerUsuarioSesion(): UsuarioSesion | null {
  const usuario = localStorage.getItem("usuario");
  if (!usuario) return null;

  try {
    return JSON.parse(usuario);
  } catch {
    return null;
  }
}

function getNav(role: string): NavItem[] {
  if (role === "alumno") {
    return [
      { label: "Inicio del Alumno", icon: LayoutDashboard, path: "/alumno" },
      { label: "Documentacion", icon: FileText, path: "/alumno/documentos" },
      { label: "Padron Empresarial", icon: Building2, path: "/alumno/padron" },
      { label: "Mis Reportes", icon: ClipboardList, path: "/alumno/reportes" },
      { label: "Horas Acumuladas", icon: Clock3, path: "/alumno/horas" },
      { label: "Evaluacion Empresa", icon: Star, path: "/alumno/evaluacion" },
      { label: "Mi Liberacion", icon: Award, path: "/alumno/liberacion" },
      { label: "Notificaciones", icon: Bell, path: "/alumno/notificaciones" },
      { label: "Perfil", icon: User, path: "/alumno/perfil" },
    ];
  }

  if (role === "coordinador") {
    return [
      { label: "Inicio del Coordinador de Prácticas", icon: LayoutDashboard, path: "/coordinador" },
      { label: "Gestion de Alumnos", icon: Users, path: "/coordinador/alumnos" },
      { label: "Revisión de Documentos", icon: FileCheck, path: "/coordinador/documentos" },
      { label: "Asignaciones", icon: ClipboardList, path: "/coordinador/asignaciones" },
      { label: "Asignar Asesores", icon: UserCheck, path: "/coordinador/asesores" },
      { label: "Seguimiento", icon: Clock, path: "/coordinador/seguimiento" },
      { label: "Liberacion", icon: CheckCircle, path: "/coordinador/liberacion" },
      { label: "Notificaciones", icon: Bell, path: "/coordinador/notificaciones" },
    ];
  }

  if (role === "unidad") {
    return [
      { label: "Inicio de la Unidad Receptora", icon: LayoutDashboard, path: "/unidad" },
      { label: "Perfil Empresa", icon: Building2, path: "/unidad/perfil" },
      { label: "Plan de trabajo", icon: Briefcase, path: "/unidad/ofertas" },
      { label: "Alumnos", icon: Users, path: "/unidad/alumnos" },
      { label: "Convenios", icon: FileText, path: "/unidad/convenios" },
      { label: "Horas", icon: Clock, path: "/unidad/horas" },
      { label: "Evaluaciones", icon: Star, path: "/unidad/evaluaciones" },
    ];
  }

  if (role === "coord-unidades") {
    return [
      { label: "Inicio del Coordinador de Unidades Receptoras", icon: LayoutDashboard, path: "/coord-unidades" },
      { label: "Empresas", icon: Building2, path: "/coord-unidades/empresas" },
      { label: "Expedientes", icon: FileCheck, path: "/coord-unidades/empresas/expediente" },
      { label: "Convenios", icon: FileText, path: "/coord-unidades/convenios" },
      { label: "Vacantes", icon: Briefcase, path: "/coord-unidades/vacantes" },
      { label: "Padron Empresarial", icon: ClipboardList, path: "/coord-unidades/padron" },
      { label: "Notificaciones", icon: Bell, path: "/coord-unidades/notificaciones" },
    ];
  }

  if (role === "admin") {
    return [
      { label: "Inicio del Administrador", icon: LayoutDashboard, path: "/admin" },
      { label: "Gestion de Usuarios", icon: Users, path: "/admin/usuarios" },
      { label: "Roles y Permisos", icon: Shield, path: "/admin/roles" },
      { label: "Catalogos", icon: ClipboardList, path: "/admin/catalogos" },
      { label: "Reportes", icon: BarChart3, path: "/admin/reportes" },
      { label: "Bitacora", icon: History, path: "/admin/bitacora" },
      { label: "Configuracion", icon: Settings, path: "/admin/configuracion" },
    ];
  }

  if (role === "asesor") {
    return [
      { label: "Inicio del Asesor Interno", icon: LayoutDashboard, path: "/asesor" },
      { label: "Alumnos Asignados", icon: Users, path: "/asesor/alumnos" },
      { label: "Reportes", icon: BarChart3, path: "/asesor/reportes" },
      { label: "Evaluaciones", icon: Star, path: "/asesor/observaciones" },
      { label: "Notificaciones", icon: Bell, path: "/asesor/notificaciones" },
    ];
  }

  if (role === "direccion") {
    return [
      { label: "Inicio de Dirección", icon: LayoutDashboard, path: "/direccion" },
      { label: "Estadisticas", icon: BarChart3, path: "/direccion/estadisticas" },
      { label: "Reportes", icon: FileText, path: "/direccion/reportes" },
    ];
  }

  return [];
}

function normalizarRol(raw?: string | null) {
  const rol = (raw ?? "").toLowerCase();

  if (rol.includes("alumno")) return "alumno";
  if (rol.includes("coordinador de unidades")) return "coord-unidades";
  if (rol.includes("coordinador")) return "coordinador";
  if (rol.includes("unidad") || rol.includes("empresa")) return "unidad";
  if (rol.includes("admin")) return "admin";
  if (rol.includes("asesor") || rol.includes("docente")) return "asesor";
  if (rol.includes("direccion")) return "direccion";

  return null;
}

function getRoleInfo(pathname: string, usuario: UsuarioSesion | null) {
  const rolSesion = normalizarRol(usuario?.rol);

  if (pathname.startsWith("/alumno")) {
    return { role: "alumno", label: "Alumno", subtitle: usuario?.rol ?? "Alumno" };
  }
  if (pathname.startsWith("/coordinador")) {
    return { role: "coordinador", label: "Coordinador de Practicas", subtitle: usuario?.rol ?? "Coordinacion" };
  }
  if (pathname.startsWith("/unidad")) {
    return { role: "unidad", label: "Unidad Receptora", subtitle: usuario?.rol ?? "Empresa asociada" };
  }
  if (pathname.startsWith("/coord-unidades")) {
    return { role: "coord-unidades", label: "Coord. Unidades Receptoras", subtitle: usuario?.rol ?? "Unidades receptoras" };
  }
  if (pathname.startsWith("/admin")) {
    return { role: "admin", label: "Administrador", subtitle: usuario?.rol ?? "Administracion general" };
  }
  if (pathname.startsWith("/asesor")) {
    return { role: "asesor", label: "Asesor Interno", subtitle: usuario?.rol ?? "Asesoria academica" };
  }
  if (pathname.startsWith("/direccion")) {
    return { role: "direccion", label: "Direccion", subtitle: usuario?.rol ?? "Solo lectura" };
  }

  return {
    role: rolSesion ?? "alumno",
    label: usuario?.rol ?? "Usuario",
    subtitle: usuario?.rol ?? "",
  };
}

export function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const usuarioSesion = obtenerUsuarioSesion();
  const { role, label, subtitle } = getRoleInfo(location.pathname, usuarioSesion);
  const displayName =
    usuarioSesion?.nombre_completo || usuarioSesion?.nombre || usuarioSesion?.correo || "Usuario";
  const displaySubtitle = usuarioSesion?.rol || subtitle;
  const navItems = getNav(role);
  const breadcrumb = navItems.find((n) => n.path === location.pathname)?.label || "Inicio";
  function cerrarSesion() {
    cerrarSesionLocal();
    navigate("/login", { replace: true });
  }

  function irAInicioPublico() {
    cerrarSesionLocal();
    setMobileOpen(false);
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-full bg-[#0d2b5e] z-30 flex flex-col transition-all duration-300 ${collapsed ? "w-14" : "w-56"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className={`flex items-center gap-3 px-3 py-3 border-b border-white/10 ${collapsed ? "justify-center" : ""}`}>
          <div className="w-12 h-12 bg-[#0d2b5e] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={logoInstitucional} alt="UNACH" className="w-full h-full object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-white font-bold text-sm">UNACH</div>
              <div className="text-blue-300 text-xs">Practicas Profesionales</div>
            </div>
          )}
        </div>

        {!collapsed && (
          <div className="px-2.5 py-1.5 border-b border-white/10">
            <div className="bg-white/10 rounded-xl px-2.5 py-1.5">
              <div className="text-white font-semibold text-xs">{displayName}</div>
              <div className="text-blue-300 text-xs mt-0.5">{label}</div>
            </div>
          </div>
        )}

        <nav className="flex-1 py-2 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors group relative ${active ? "bg-white/20 text-white" : "text-blue-200 hover:bg-white/10 hover:text-white"} ${collapsed ? "justify-center" : ""}`}
              >
                {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full" />}
                <item.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-white" : "text-blue-300 group-hover:text-white"}`} />
                {!collapsed && (
                  <>
                    <span className="text-xs font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {collapsed && item.badge && (
                  <span className="absolute top-2 right-2 bg-red-500 w-2 h-2 rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 space-y-1">
          <button
            onClick={irAInicioPublico}
            className={`w-full flex items-center gap-3 px-2.5 py-2 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <Home className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Inicio</span>}
          </button>
          <button
            onClick={cerrarSesion}
            className={`w-full flex items-center gap-3 px-2.5 py-2 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span className="text-xs">Cerrar Sesion</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`hidden lg:flex w-full items-center gap-3 px-2.5 py-2 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors ${collapsed ? "justify-center" : ""}`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span className="text-xs">Colapsar</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? "lg:ml-14" : "lg:ml-56"}`}>
        <header className="bg-white border-b border-gray-200 px-5 py-3 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
          <button className="lg:hidden text-gray-500" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-500 flex-1">
            <span className="text-[#1565c0] font-semibold">{label}</span>
            <ChevronDown className="w-3 h-3 -rotate-90" />
            <span className="text-gray-700 font-medium">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationCenter role={role} idUsuario={usuarioSesion?.id_usuario} />
            <div className={role !== "admin" ? "flex items-center gap-2.5 pl-3 border-l border-gray-200" : "flex items-center gap-2.5"}>
              <div className="w-8 h-8 bg-[#0d2b5e] rounded-xl flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-semibold text-gray-800">{displayName}</div>
                <div className="text-[11px] text-gray-400">{displaySubtitle}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-5 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
