import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Award, Bell, ChevronRight, Clock, FileText, Star } from "lucide-react";
import { gestionHorasAlumnoUseCase, gestionLiberacionUseCase } from "../../dependencies";
import type { AlumnoLiberacion } from "../../../domain/coordinador/Liberacion";

type UsuarioSesion = {
  nombre_completo?: string;
  nombre?: string;
  perfil?: {
    id_alumno?: number;
  };
};

function obtenerSesion() {
  const raw = localStorage.getItem("usuario");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UsuarioSesion;
  } catch {
    return null;
  }
}

export function AlumnoDashboard() {
  const navigate = useNavigate();
  const [liberacion, setLiberacion] = useState<AlumnoLiberacion | null>(null);
  const [horas, setHoras] = useState({ aprobadas: 0, meta: 480, progreso: 0 });
  const [cargando, setCargando] = useState(true);
  const sesion = obtenerSesion();
  const idAlumno = sesion?.perfil?.id_alumno ?? null;

  useEffect(() => {
    async function cargar() {
      if (!idAlumno) {
        setCargando(false);
        return;
      }
      try {
        const [horasData, liberacionData] = await Promise.all([
          gestionHorasAlumnoUseCase.listar(idAlumno),
          gestionLiberacionUseCase.obtenerAlumno(idAlumno),
        ]);
        setHoras({
          aprobadas: horasData.resumen.aprobadas,
          meta: horasData.resumen.total_meta,
          progreso: horasData.resumen.progreso,
        });
        setLiberacion(liberacionData.alumno);
      } catch (err) {
        console.error(err);
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, [idAlumno]);

  const nombre = sesion?.nombre_completo || sesion?.nombre || "Alumno";
  const estado = liberacion?.liberacion
    ? "Liberado"
    : liberacion?.listo_liberacion
      ? "Listo para liberacion"
      : liberacion
        ? "En proceso"
        : "Sin asignacion";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Inicio del Alumno</h1>
        <p className="text-gray-500 text-sm mt-1">Bienvenid@, {nombre}</p>
      </div>

      <div className="bg-gradient-to-r from-[#0d2b5e] to-[#1565c0] rounded-2xl p-6 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="text-blue-200 text-sm mb-1">Estado de tu proceso</div>
          <div className="font-bold text-xl">{estado}</div>
          <div className="text-blue-200 text-sm mt-1">
            {liberacion ? `${liberacion.empresa} - ${liberacion.vacante}` : "Aun no tienes empresa asignada"}
          </div>
        </div>
        <button
          onClick={() => navigate("/alumno/liberacion")}
          className="bg-white/20 text-white px-4 py-2 rounded-xl font-bold text-sm flex-shrink-0"
        >
          Ver liberacion
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          {
            l: "Estado General",
            v: estado,
            d: cargando ? "Cargando..." : "Proceso actualizado",
            bg: "bg-blue-50",
            tc: "text-blue-600",
          },
          {
            l: "Horas Aprobadas",
            v: `${horas.aprobadas} / ${horas.meta}`,
            d: `${horas.progreso}% completado`,
            bg: "bg-green-50",
            tc: "text-green-600",
          },
          {
            l: "Requisitos Faltantes",
            v: `${liberacion?.faltantes.length ?? 0}`,
            d: liberacion?.listo_liberacion ? "Listo para liberar" : "Pendientes de cierre",
            bg: "bg-orange-50",
            tc: "text-orange-600",
          },
          {
            l: "Liberacion",
            v: liberacion?.liberacion ? "Emitida" : "Pendiente",
            d: liberacion?.liberacion?.fecha_liberacion ?? "Sin fecha",
            bg: "bg-purple-50",
            tc: "text-purple-600",
          },
        ].map((w) => (
          <div key={w.l} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className={`w-10 h-10 ${w.bg} rounded-xl flex items-center justify-center mb-3`}>
              <div className={`w-4 h-4 rounded-full ${w.tc.replace("text-", "bg-")}`} />
            </div>
            <div className="text-2xl font-bold text-[#0d2b5e]">{w.v}</div>
            <div className="text-gray-500 text-sm mt-0.5">{w.l}</div>
            <div className="text-xs text-gray-400 mt-1">{w.d}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#0d2b5e]">Progreso de Horas Practicadas</h3>
          <span className="text-sm text-gray-500">{horas.aprobadas} de {horas.meta} horas</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
          <div className="bg-gradient-to-r from-[#1565c0] to-[#1976d2] h-4 rounded-full" style={{ width: `${horas.progreso}%` }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>0 hrs</span>
          <span className="text-[#1565c0] font-semibold">{horas.progreso}% completado</span>
          <span>{horas.meta} hrs</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-[#0d2b5e] mb-4">Accesos Rapidos</h3>
        <div className="space-y-3">
          {[
            { l: "Carga de Documentos", I: FileText, p: "/alumno/documentos", s: "Expediente" },
            { l: "Horas Acumuladas", I: Clock, p: "/alumno/horas", s: `${horas.aprobadas} hrs` },
            { l: "Evaluacion Empresa", I: Star, p: "/alumno/evaluacion", s: "Cierre" },
            { l: "Mi Liberacion", I: Award, p: "/alumno/liberacion", s: liberacion?.liberacion ? "Emitida" : "Pendiente" },
            { l: "Notificaciones", I: Bell, p: "/alumno/notificaciones", s: "Avisos" },
          ].map((item) => (
            <button key={item.l} onClick={() => navigate(item.p)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group">
              <div className="w-9 h-9 bg-[#e3f0ff] rounded-lg flex items-center justify-center">
                <item.I className="w-4 h-4 text-[#1565c0]" />
              </div>
              <span className="text-sm font-medium text-gray-700 flex-1 text-left">{item.l}</span>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-100 text-blue-700">{item.s}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
