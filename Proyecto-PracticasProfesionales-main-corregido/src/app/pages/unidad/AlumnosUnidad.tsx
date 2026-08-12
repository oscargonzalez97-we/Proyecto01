import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle,
  Clock,
  Eye,
  FileText,
  Filter,
  Search,
  Star,
  Users,
} from "lucide-react";

import { gestionAlumnosUnidadUseCase } from "../../dependencies";
import type { AlumnoUnidad } from "../../../domain/unidad/AlumnoUnidad";

function obtenerIdEmpresaSesion(): number | null {
  const usuario = sessionStorage.getItem("usuario");
  if (!usuario) return null;
  try {
    const sesion = JSON.parse(usuario);
    const idEmpresa = sesion?.perfil?.id_empresa;
    return typeof idEmpresa === "number" ? idEmpresa : null;
  } catch {
    return null;
  }
}

function formatoFecha(fecha: string | null) {
  if (!fecha) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${fecha}T00:00:00`));
}

export function AlumnosUnidad() {
  const [alumnos, setAlumnos] = useState<AlumnoUnidad[]>([]);
  const [empresa, setEmpresa] = useState("");
  const [estadoEmpresa, setEstadoEmpresa] = useState("");
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cargarAlumnos();
  }, []);

  async function cargarAlumnos() {
    const idEmpresa = obtenerIdEmpresaSesion();
    if (!idEmpresa) {
      setError("No se encontro el perfil de empresa en la sesion actual.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const data = await gestionAlumnosUnidadUseCase.listar(idEmpresa);
      setAlumnos(data.alumnos);
      setEmpresa(data.empresa);
      setEstadoEmpresa(data.estado_empresa);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los alumnos asignados.");
    } finally {
      setCargando(false);
    }
  }

  const estadoColor: Record<string, string> = {
    Activo: "bg-blue-100 text-blue-700",
    "Por evaluar": "bg-yellow-100 text-yellow-700",
    Finalizado: "bg-green-100 text-green-700",
  };

  const alumnosFiltrados = useMemo(() => {
    const query = q.toLowerCase();
    return alumnos.filter((alumno) => {
      const coincideBusqueda =
        alumno.nombre.toLowerCase().includes(query) ||
        alumno.matricula.toLowerCase().includes(query) ||
        alumno.carrera.toLowerCase().includes(query) ||
        alumno.proyecto.toLowerCase().includes(query);
      const coincideFiltro = filtro === "todos" || alumno.estado === filtro;
      return coincideBusqueda && coincideFiltro;
    });
  }, [alumnos, q, filtro]);

  const resumen = {
    activos: alumnos.filter((alumno) => alumno.estado === "Activo").length,
    porEvaluar: alumnos.filter((alumno) => alumno.estado === "Por evaluar").length,
    horas: alumnos.reduce((acc, alumno) => acc + alumno.horas_aprobadas, 0),
    promedio:
      alumnos.length > 0
        ? Math.round(alumnos.reduce((acc, alumno) => acc + alumno.avance, 0) / alumnos.length)
        : 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">
          Alumnos en Practicas
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Seguimiento de alumnos asignados a la unidad receptora.
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-xl">
            Alumnos asignados a {empresa || "unidad receptora"}
          </div>
          <div className="text-blue-100 text-sm mt-1">
            {cargando ? "Cargando..." : `${alumnos.length} alumnos asignados`}
          </div>
        </div>

        <div className="bg-white/20 px-4 py-2 rounded-xl">
          <div className="text-white font-bold text-sm">
            {estadoEmpresa || "Sin estado"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { label: "Alumnos activos", value: resumen.activos, icon: Users, color: "bg-blue-50 text-blue-600" },
          { label: "Por evaluar", value: resumen.porEvaluar, icon: Star, color: "bg-yellow-50 text-yellow-600" },
          { label: "Horas aprobadas", value: resumen.horas.toLocaleString(), icon: Clock, color: "bg-orange-50 text-orange-600" },
          { label: "Avance promedio", value: `${resumen.promedio}%`, icon: CheckCircle, color: "bg-green-50 text-green-600" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mb-3`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-[#0d2b5e]">
              {cargando ? "..." : item.value}
            </div>
            <div className="text-gray-500 text-sm mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col lg:flex-row gap-4">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, matricula, carrera o proyecto..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1565c0]"
          />
        </label>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filtro}
            onChange={(event) => setFiltro(event.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1565c0]"
          >
            <option value="todos">Todos</option>
            <option value="Activo">Activo</option>
            <option value="Por evaluar">Por evaluar</option>
            <option value="Finalizado">Finalizado</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Lista de Alumnos Asignados</h3>
          <span className="ml-auto text-xs text-gray-400">
            {alumnosFiltrados.length} resultados
          </span>
        </div>

        {cargando ? (
          <div className="px-6 py-10 text-center text-sm text-gray-500">
            Cargando alumnos...
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {alumnosFiltrados.map((alumno) => (
              <div key={alumno.id_asignacion} className="px-6 py-5 hover:bg-gray-50">
                <div className="flex flex-col xl:flex-row xl:items-center gap-5">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="w-11 h-11 bg-[#e3f0ff] rounded-xl flex items-center justify-center text-[#1565c0] font-bold flex-shrink-0">
                      {alumno.nombre.charAt(0)}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-gray-800 text-sm">{alumno.nombre}</h4>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${estadoColor[alumno.estado] ?? "bg-gray-100 text-gray-600"}`}>
                          {alumno.estado}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        Matricula: {alumno.matricula} - {alumno.carrera}
                        {alumno.semestre ? ` - ${alumno.semestre} semestre` : ""}
                      </div>

                      <div className="text-xs text-[#1565c0] mt-1 font-medium">
                        Proyecto: {alumno.proyecto}
                      </div>

                      <div className="grid md:grid-cols-2 gap-3 mt-3">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <FileText className="w-4 h-4 text-[#1565c0]" />
                          Asesor: {alumno.asesor}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <CalendarDays className="w-4 h-4 text-[#1565c0]" />
                          Inicio: {formatoFecha(alumno.fecha_inicio)}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Avance de horas</span>
                          <span className="text-xs font-semibold text-[#1565c0]">
                            {alumno.horas_aprobadas}/{alumno.total_horas} hrs - {alumno.avance}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#1565c0] h-2 rounded-full"
                            style={{ width: `${Math.min(alumno.avance, 100)}%` }}
                          />
                        </div>
                        {alumno.horas_pendientes > 0 && (
                          <div className="text-xs text-orange-600 mt-2">
                            {alumno.horas_pendientes} horas pendientes por validar
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:flex-col xl:w-36">
                    <button className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0d2b5e] text-white rounded-lg text-xs font-semibold hover:bg-[#1565c0] transition-colors">
                      <Eye className="w-3.5 h-3.5" />
                      Ver perfil
                    </button>
                    <button className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors">
                      <Star className="w-3.5 h-3.5" />
                      Evaluar
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {alumnosFiltrados.length === 0 && (
              <div className="px-6 py-10 text-center">
                <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <div className="text-sm text-gray-500">
                  No se encontraron alumnos con los filtros seleccionados.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
