import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Briefcase,
  CalendarDays,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  Star,
  Users,
} from "lucide-react";

import type { UnidadDashboardResponse } from "../../../domain/unidad/UnidadDashboard";
import { obtenerDashboardUnidad } from "../../../infrastructure/unidad/unidadDashboardApi";

export function UnidadDashboard() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState<UnidadDashboardResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      setError("");
      setDatos(await obtenerDashboardUnidad());
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la página de inicio de la unidad receptora.");
    } finally {
      setCargando(false);
    }
  }

  const empresa = datos?.empresa;
  const resumen = datos?.resumen;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">
          Inicio de la Unidad Receptora
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {empresa?.nombre_empresa ?? "Unidad receptora"} - {empresa?.estado_empresa ?? "Sin estado"}
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      <div className={`${empresa?.estado_empresa === "Activa" ? "bg-gradient-to-r from-green-600 to-green-500" : "bg-gradient-to-r from-orange-500 to-orange-400"} rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="font-bold text-xl">
            {empresa?.estado_empresa === "Activa" ? "Empresa activa" : "Empresa en seguimiento"}
          </div>
          <div className="text-white/80 text-sm mt-1">
            {datos?.convenios[0]
              ? `Convenio ${datos.convenios[0].estado_convenio} hasta: ${datos.convenios[0].fecha_fin}`
              : "Sin convenio registrado"}
          </div>
        </div>

        <div className="bg-white/20 px-4 py-2 rounded-xl">
          <div className="text-white font-bold text-sm">{empresa?.estado_empresa ?? "SIN ESTADO"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { l: "Alumnos activos", v: resumen?.alumnos_activos ?? 0, I: Users, c: "bg-blue-50 text-blue-600" },
          { l: "Planes de trabajo", v: resumen?.planes_trabajo ?? 0, I: Briefcase, c: "bg-purple-50 text-purple-600" },
          { l: "Convenios vigentes", v: resumen?.convenios_vigentes ?? 0, I: FileText, c: "bg-green-50 text-green-600" },
          { l: "Horas aprobadas", v: resumen?.horas_registradas ?? 0, I: Clock, c: "bg-orange-50 text-orange-600" },
        ].map((w) => (
          <div key={w.l} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className={`w-10 h-10 ${w.c} rounded-xl flex items-center justify-center mb-3`}>
              <w.I className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-[#0d2b5e]">{cargando ? "..." : w.v}</div>
            <div className="text-gray-500 text-sm mt-0.5">{w.l}</div>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[#0d2b5e]">Alumnos en practicas</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-semibold">
              {datos?.alumnos.length ?? 0} activos
            </span>
          </div>

          <div className="space-y-3">
            {(datos?.alumnos ?? []).map((alumno) => (
              <div key={alumno.id_asignacion} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-medium text-sm text-gray-800">{alumno.nombre}</div>
                    <div className="text-xs text-gray-400">{alumno.carrera}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {alumno.horas_aprobadas}/{alumno.total_horas} hrs
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-[#1565c0] h-2 rounded-full" style={{ width: `${Math.min(100, alumno.avance)}%` }} />
                </div>
              </div>
            ))}
            {!cargando && (datos?.alumnos ?? []).length === 0 && (
              <div className="text-sm text-gray-500">No hay alumnos activos asignados a esta unidad.</div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-[#0d2b5e] mb-4">Evaluaciones pendientes</h3>

            <div className="space-y-3">
              {(datos?.evaluaciones_pendientes ?? []).map((alumno) => (
                <div key={alumno.id_asignacion} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm text-gray-700">{alumno.nombre}</span>
                  </div>
                  <button onClick={() => navigate("/unidad/evaluaciones")} className="text-xs bg-[#0d2b5e] text-white px-3 py-1.5 rounded-lg hover:bg-[#1565c0] font-medium">
                    Evaluar
                  </button>
                </div>
              ))}
              {!cargando && (datos?.evaluaciones_pendientes ?? []).length === 0 && (
                <div className="text-sm text-gray-500">No hay evaluaciones pendientes.</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-[#0d2b5e] mb-4">Acciones rapidas</h3>
            <div className="space-y-2">
              {[
                { l: "Actualizar perfil de empresa", p: "/unidad/perfil" },
                { l: "Gestionar plan de trabajo", p: "/unidad/ofertas" },
                { l: "Ver convenios", p: "/unidad/convenios" },
              ].map((i) => (
                <button key={i.l} onClick={() => navigate(i.p)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-blue-50 group transition-colors">
                  <span className="text-sm text-gray-700 group-hover:text-[#1565c0]">{i.l}</span>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#1565c0]" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-[#0d2b5e] mb-4">Planes de trabajo</h3>
          <div className="space-y-3">
            {(datos?.vacantes ?? []).map((vacante) => (
              <div key={vacante.id_vacante} className="p-4 rounded-xl border border-gray-100 hover:bg-gray-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-sm text-gray-800">{vacante.titulo}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {vacante.tipo_practica ?? "Sin tipo de practica"} · {vacante.periodo ?? "Sin periodo"} · {vacante.cupos} cupo(s)
                    </div>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${vacante.estado_vacante === "Activa" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {vacante.estado_vacante}
                  </span>
                </div>
              </div>
            ))}
            {!cargando && (datos?.vacantes ?? []).length === 0 && (
              <div className="text-sm text-gray-500">No hay planes de trabajo registrados.</div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-[#0d2b5e] mb-4">Proximas actividades</h3>
          <div className="space-y-3">
            {[
              {
                titulo: `${resumen?.evaluaciones_pendientes ?? 0} evaluacion(es) pendientes`,
                fecha: "Captura final de desempeno",
                color: "bg-green-50 text-green-700",
              },
              {
                titulo: `${datos?.convenios.length ?? 0} convenio(s) registrados`,
                fecha: datos?.convenios[0]?.fecha_fin ? `Vencimiento mas cercano: ${datos.convenios[0].fecha_fin}` : "Sin fecha registrada",
                color: "bg-blue-50 text-blue-700",
              },
              {
                titulo: `${datos?.vacantes.length ?? 0} plan(es) de trabajo`,
                fecha: "Revisión de cupos y vacantes",
                color: "bg-orange-50 text-orange-700",
              },
            ].map((a) => (
              <div key={a.titulo} className={`p-4 rounded-xl flex items-center gap-3 ${a.color}`}>
                <CalendarDays className="w-5 h-5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-sm">{a.titulo}</div>
                  <div className="text-xs opacity-80 mt-0.5">{a.fecha}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-[#0d2b5e] mb-4">Estado general del proceso</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { titulo: "Alumnos vinculados", desc: `${resumen?.alumnos_activos ?? 0} asignaciones activas en esta unidad.` },
            { titulo: "Planes registrados", desc: `${resumen?.planes_trabajo ?? 0} planes de trabajo en el sistema.` },
            { titulo: "Evaluaciones", desc: `${resumen?.evaluaciones_pendientes ?? 0} evaluaciones pendientes de captura.` },
          ].map((item) => (
            <div key={item.titulo} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <CheckCircle className="w-5 h-5 text-green-600 mb-2" />
              <div className="font-semibold text-sm text-gray-800">{item.titulo}</div>
              <div className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
