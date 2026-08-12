import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Building2,
  Calendar,
  GraduationCap,
  Mail,
  School,
  User,
  UserCheck,
} from "lucide-react";

import { gestionConfiguracionUseCase, gestionSeguimientoPracticasUseCase } from "../../dependencies";
import type { AuthSession } from "../../../domain/auth/AuthSession";
import type { ConfiguracionSistema } from "../../../domain/configuracion/ConfiguracionSistema";
import type { SeguimientoAlumnoResponse } from "../../../domain/seguimiento/SeguimientoPracticas";

function obtenerSesion(): AuthSession | null {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function texto(valor: unknown, fallback = "No registrado") {
  if (valor === null || valor === undefined || valor === "") return fallback;
  return String(valor);
}

export function AlumnoPerfil() {
  const [sesion] = useState(() => obtenerSesion());
  const [configuracion, setConfiguracion] = useState<ConfiguracionSistema | null>(null);
  const [seguimiento, setSeguimiento] = useState<SeguimientoAlumnoResponse | null>(null);

  useEffect(() => {
    gestionConfiguracionUseCase.obtener().then(setConfiguracion).catch(console.error);
    gestionSeguimientoPracticasUseCase.obtenerAlumno(0).then(setSeguimiento).catch(console.error);
  }, []);

  const perfil = (sesion?.perfil ?? {}) as Record<string, unknown>;
  const asignacion = seguimiento?.asignacion;
  const cierre = seguimiento?.cierre;

  const nombre = sesion?.nombre_completo || sesion?.nombre || "Alumno";
  const carrera = texto(perfil.carrera ?? asignacion?.carrera, "Carrera no registrada");
  const matricula = texto(perfil.matricula, "Sin matricula");
  const semestre = texto(perfil.semestre, "Sin semestre");
  const grupo = texto(perfil.grupo, "Sin grupo");
  const estadoAlumno = texto(perfil.estado_alumno, "Activo");
  const periodo = configuracion?.convocatoria_nombre ?? "Sin convocatoria principal";

  const estadoPracticas = useMemo(() => {
    if (!asignacion) return "Sin asignacion";
    if (cierre?.puede_evaluar) return "Lista para evaluacion final";
    return "En seguimiento";
  }, [asignacion, cierre]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Mi Perfil</h1>
        <p className="text-gray-500 text-sm mt-1">
          Informacion personal, academica y estado actual dentro del programa de practicas profesionales.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-[#0d2b5e] flex items-center justify-center text-white">
              <User className="w-12 h-12" />
            </div>

            <h2 className="mt-4 text-xl font-bold text-[#0d2b5e]">{nombre}</h2>
            <p className="text-gray-500 text-sm">{carrera}</p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#1565c0]" />
              <span className="text-sm">{texto(sesion?.correo, "Sin correo")}</span>
            </div>

            <div className="flex items-center gap-3">
              <GraduationCap className="w-4 h-4 text-[#1565c0]" />
              <span className="text-sm">Matricula: {matricula}</span>
            </div>

            <div className="flex items-center gap-3">
              <School className="w-4 h-4 text-[#1565c0]" />
              <span className="text-sm">{configuracion?.escuela_facultad ?? "Escuela no configurada"}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-[#0d2b5e] mb-4">Informacion Academica</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Carrera</p>
                <p className="font-medium">{carrera}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Semestre / Grupo</p>
                <p className="font-medium">
                  {semestre} / {grupo}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500">Estado academico</p>
                <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs">
                  {estadoAlumno}
                </span>
              </div>

              <div>
                <p className="text-xs text-gray-500">Rol</p>
                <p className="font-medium">{sesion?.rol ?? "Alumno"}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-[#0d2b5e] mb-4">Informacion de Practicas</h3>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-[#1565c0]" />
                <div>
                  <p className="text-xs text-gray-500">Empresa Asignada</p>
                  <p className="font-medium">{asignacion?.empresa ?? "Pendiente de asignacion"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <UserCheck className="w-5 h-5 text-[#1565c0]" />
                <div>
                  <p className="text-xs text-gray-500">Vacante</p>
                  <p className="font-medium">{asignacion?.vacante ?? "No asignada"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-[#1565c0]" />
                <div>
                  <p className="text-xs text-gray-500">Periodo</p>
                  <p className="font-medium">{periodo}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500">Estado</p>
                <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs">
                  {estadoPracticas}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-[#0d2b5e] mb-4">Estado General</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <BadgeCheck className="w-5 h-5 text-green-600" />
                <span>Cuenta institucional activa</span>
              </div>

              <div className="flex items-center gap-3">
                <BadgeCheck className="w-5 h-5 text-green-600" />
                <span>{asignacion ? "Practicas asignadas" : "Pendiente de asignacion de practicas"}</span>
              </div>

              <div className="flex items-center gap-3">
                <BadgeCheck className="w-5 h-5 text-green-600" />
                <span>
                  {seguimiento?.incidencias.length
                    ? `${seguimiento.incidencias.length} incidencia(s) registradas`
                    : "Sin incidencias registradas"}
                </span>
              </div>
            </div>

            <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-[#0d2b5e]">
                {asignacion
                  ? `Actualmente cursas practicas en ${asignacion.empresa}. Revisa reportes, horas y evaluacion final segun avance del periodo.`
                  : "Actualmente te encuentras en espera de asignacion de empresa receptora para iniciar el proceso de practicas profesionales."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
