import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Info,
  ListChecks,
  LockKeyhole,
  Route,
  Shield,
  Users,
} from "lucide-react";

import { listarRolesUseCase, gestionUsuariosUseCase } from "../../dependencies";

type Rol = {
  id_rol: number;
  nombre: string;
  descripcion?: string | null;
};

type Usuario = {
  id_usuario: number;
  id_rol: number;
};

type RolInformativo = {
  nombre: string;
  descripcion: string;
  modulos: string[];
  acciones: string[];
};

const ROLES_INFORMATIVOS: RolInformativo[] = [
  {
    nombre: "Administrador",
    descripcion:
      "Gestiona usuarios, catalogos, configuracion, seguridad y reportes administrativos del sistema.",
    modulos: [
      "Inicio del Administrador",
      "Gestion de Usuarios",
      "Roles / Permisos",
      "Catalogos",
      "Configuracion",
      "Reportes",
    ],
    acciones: [
      "Crear usuarios",
      "Editar perfiles",
      "Desactivar/reactivar usuarios",
      "Resetear contrasenas",
      "Eliminar usuarios sin relaciones",
      "Gestionar carreras",
      "Gestionar convocatorias",
      "Gestionar tipos de practica",
      "Editar configuracion del sistema",
    ],
  },
  {
    nombre: "Coordinador de Practicas",
    descripcion:
      "Da seguimiento academico a alumnos, asignaciones y procesos de practicas profesionales.",
    modulos: ["Alumnos", "Asignaciones", "Seguimiento academico", "Reportes academicos"],
    acciones: [
      "Revisar alumnos",
      "Gestionar asignaciones",
      "Dar seguimiento al proceso academico",
      "Consultar reportes del ?rea",
    ],
  },
  {
    nombre: "Coordinador de Unidades Receptoras",
    descripcion:
      "Gestiona empresas, solicitudes, expedientes, convenios, vacantes y padron empresarial.",
    modulos: [
      "Empresas",
      "Solicitudes de empresas",
      "Expedientes",
      "Convenios",
      "Vacantes",
      "Padron Empresarial",
    ],
    acciones: [
      "Revisar solicitudes de empresas",
      "Aprobar o rechazar empresas",
      "Revisar documentacion legal",
      "Gestionar convenios",
      "Revisar vacantes",
      "Liberar padron empresarial",
    ],
  },
  {
    nombre: "Asesor Interno",
    descripcion: "Da seguimiento a alumnos asignados durante sus practicas.",
    modulos: ["Mis alumnos", "Seguimiento", "Evaluaciones"],
    acciones: [
      "Consultar alumnos asignados",
      "Registrar observaciones",
      "Dar seguimiento academico",
      "Revisar avances del alumno",
    ],
  },
  {
    nombre: "Alumno",
    descripcion:
      "Consulta su proceso, sube documentos, selecciona empresas y da seguimiento a sus practicas.",
    modulos: ["Inicio del Alumno", "Documentos", "Padron Empresarial", "Seguimiento", "Descargas"],
    acciones: [
      "Subir documentos",
      "Consultar validaciones",
      "Seleccionar empresas",
      "Descargar formatos",
      "Revisar estado del proceso",
    ],
  },
  {
    nombre: "Unidad Receptora",
    descripcion: "Gestiona su documentacion, convenio, plan de trabajo y vacantes.",
    modulos: [
      "Inicio de la Unidad Receptora",
      "Documentacion legal",
      "Convenio",
      "Plan de trabajo",
      "Vacantes",
    ],
    acciones: [
      "Subir documentos legales",
      "Descargar/subir convenio",
      "Registrar plan de trabajo",
      "Crear vacantes",
      "Consultar estado de revisión",
    ],
  },
  {
    nombre: "Direccion",
    descripcion:
      "Consulta estadisticas, reportes y seguimiento institucional del proceso de practicas.",
    modulos: ["Inicio de Dirección", "Estadisticas", "Reportes", "Exportaciones"],
    acciones: [
      "Consultar estadisticas generales",
      "Filtrar informacion institucional",
      "Exportar reportes",
      "Revisar indicadores de alumnos, empresas y convenios",
    ],
  },
];

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buscarRolReal(roles: Rol[], nombre: string) {
  const nombreNormalizado = normalizar(nombre);
  return roles.find((rol) => normalizar(rol.nombre) === nombreNormalizado);
}

export function AdminRolesPermisos() {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    try {
      const [rolesData, usuariosData] = await Promise.all([
        listarRolesUseCase.execute(),
        gestionUsuariosUseCase.listar(),
      ]);

      setRoles(rolesData);
      setUsuarios(usuariosData);
    } catch (error) {
      console.error(error);
    }
  }

  function obtenerCantidadUsuarios(idRol?: number) {
    if (!idRol) return 0;
    return usuarios.filter((usuario) => usuario.id_rol === idRol).length;
  }

  const rolesVista = useMemo(
    () =>
      ROLES_INFORMATIVOS.map((info) => ({
        info,
        rolReal: buscarRolReal(roles, info.nombre),
      })),
    [roles]
  );

  const rolesRegistrados = rolesVista.filter(({ rolReal }) => rolReal).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Roles / Permisos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Consulta que puede ver y hacer cada tipo de usuario dentro del sistema.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[#1565c0] flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="font-bold text-[#0d2b5e]">Vista informativa</h2>
              <p className="text-sm text-[#0d2b5e] mt-1">
                Esta vista es informativa. Los permisos reales se controlan por rol desde el backend.
              </p>
              <p className="text-sm text-[#0d2b5e] mt-1">
                Para cambiar accesos reales se requiere modificar la logica de autorizacion del sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Shield className="w-6 h-6 text-[#1565c0] mb-2" />
              <div className="text-2xl font-bold text-[#0d2b5e]">{rolesRegistrados}</div>
              <div className="text-xs text-gray-500">Roles principales registrados</div>
            </div>
            <div>
              <Users className="w-6 h-6 text-green-600 mb-2" />
              <div className="text-2xl font-bold text-[#0d2b5e]">{usuarios.length}</div>
              <div className="text-xs text-gray-500">Usuarios en el sistema</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-5">
        {rolesVista.map(({ info, rolReal }) => {
          const usuariosRol = obtenerCantidadUsuarios(rolReal?.id_rol);
          const registrado = Boolean(rolReal);

          return (
            <section
              key={info.nombre}
              className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-lg text-[#0d2b5e]">
                      {rolReal?.nombre ?? info.nombre}
                    </h2>
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        registrado
                          ? "bg-green-50 text-green-700 border border-green-100"
                          : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                      }`}
                    >
                      {registrado ? "Registrado" : "No registrado"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">{info.descripcion}</p>
                </div>

                <LockKeyhole className="w-7 h-7 text-[#1565c0] flex-shrink-0" />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs">
                  {usuariosRol} usuarios
                </span>
                <span className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs">
                  Acceso por rol backend
                </span>
              </div>

              <div className="grid md:grid-cols-2 gap-5 mt-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Route className="w-4 h-4 text-[#1565c0]" />
                    <h3 className="font-bold text-sm text-[#0d2b5e]">Modulos</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {info.modulos.map((modulo) => (
                      <span
                        key={modulo}
                        className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1 rounded-full text-xs"
                      >
                        {modulo}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <ListChecks className="w-4 h-4 text-[#1565c0]" />
                    <h3 className="font-bold text-sm text-[#0d2b5e]">
                      Acciones principales
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {info.acciones.map((accion) => (
                      <div key={accion} className="flex items-start gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span>{accion}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
