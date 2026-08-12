import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  Users,
  X,
} from "lucide-react";

import { gestionAsesorUseCase } from "../../dependencies";
import type { AlumnoAsignadoAsesor, ResumenAsesor } from "../../../domain/asesor/Asesor";

import type { StatCard } from "../../../shared/types/ui";
const estadoColor: Record<string, string> = {
  "En seguimiento": "bg-blue-100 text-blue-700",
  "Con observaciones": "bg-orange-100 text-orange-700",
  "Listo para cierre": "bg-green-100 text-green-700",
};

const RESUMEN_INICIAL: ResumenAsesor = {
  total: 0,
  pendientes: 0,
  observaciones: 0,
  cierre: 0,
};

function obtenerIdAsesorSesion() {
  const usuario = sessionStorage.getItem("usuario");
  if (!usuario) return null;

  try {
    const sesion = JSON.parse(usuario);
    const idAsesor = sesion?.perfil?.id_personal;
    return typeof idAsesor === "number" ? idAsesor : null;
  } catch {
    return null;
  }
}

export function AlumnosAsignados() {
  const [alumnos, setAlumnos] = useState<AlumnoAsignadoAsesor[]>([]);
  const [resumen, setResumen] = useState<ResumenAsesor>(RESUMEN_INICIAL);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [empresa, setEmpresa] = useState("Todas");
  const [observacionAbierta, setObservacionAbierta] = useState<number | null>(null);
  const [tipoObservacion, setTipoObservacion] = useState<Record<number, string>>({});
  const [textoObservacion, setTextoObservacion] = useState<Record<number, string>>({});
  const [asuntoOtro, setAsuntoOtro] = useState<Record<number, string>>({});

  useEffect(() => {
    cargarAlumnos();
  }, []);

  async function cargarAlumnos() {
    const idAsesor = obtenerIdAsesorSesion();
    if (!idAsesor) {
      setError("No se encontró el perfil de asesor en la sesión actual.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const data = await gestionAsesorUseCase.listarAlumnos(idAsesor);
      setAlumnos(data.alumnos);
      setResumen(data.resumen);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los alumnos asignados.");
    } finally {
      setCargando(false);
    }
  }

  const empresas = useMemo(
    () => [...new Set(alumnos.map((a) => a.empresa))],
    [alumnos]
  );

  const filtrados = useMemo(() => {
    return alumnos.filter((a) => {
      const q = busqueda.toLowerCase();
      const coincideBusqueda =
        a.nombre.toLowerCase().includes(q) ||
        a.carrera.toLowerCase().includes(q) ||
        a.empresa.toLowerCase().includes(q) ||
        (a.matricula ?? "").toLowerCase().includes(q);

      const coincideEstado = estado === "Todos" || a.estado === estado;
      const coincideEmpresa = empresa === "Todas" || a.empresa === empresa;

      return coincideBusqueda && coincideEstado && coincideEmpresa;
    });
  }, [alumnos, busqueda, estado, empresa]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setEstado("Todos");
    setEmpresa("Todas");
  };

  const progreso = (actual: number, meta: number) =>
    meta > 0 ? Math.min(Math.round((actual / meta) * 100), 100) : 0;

  const enviarObservacion = (alumno: AlumnoAsignadoAsesor) => {
    alert(`Observación registrada para ${alumno.nombre}`);
    setObservacionAbierta(null);
    setTipoObservacion((actual) => ({ ...actual, [alumno.id_asignacion]: "" }));
    setTextoObservacion((actual) => ({ ...actual, [alumno.id_asignacion]: "" }));
    setAsuntoOtro((actual) => ({ ...actual, [alumno.id_asignacion]: "" }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Alumnos Asignados</h1>
        <p className="text-gray-500 text-sm mt-1">
          Seguimiento académico de alumnos asignados al asesor interno.
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {([
          ["Total asignados", resumen.total, Users],
          ["Reportes pendientes", resumen.pendientes, FileText],
          ["Con observaciones", resumen.observaciones, AlertTriangle],
          ["Listos para cierre", resumen.cierre, CheckCircle2],
        ] satisfies StatCard[]).map(([titulo, valor, Icon]) => (
          <div
            key={titulo}
            className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3"
          >
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold text-[#0d2b5e]">{valor}</div>
              <div className="text-xs text-gray-500">{titulo}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1565c0]" />
            <h3 className="font-bold text-[#0d2b5e] text-sm">
              Filtros de seguimiento
            </h3>
          </div>

          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#1565c0]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpiar filtros
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="border rounded-xl px-3 py-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="outline-none text-sm w-full"
              placeholder="Buscar alumno, matrícula, carrera o empresa..."
            />
          </div>

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option>Todos</option>
            <option>En seguimiento</option>
            <option>Con observaciones</option>
            <option>Listo para cierre</option>
          </select>

          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="border rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option>Todas</option>
            {empresas.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {cargando && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
            Cargando alumnos asignados...
          </div>
        )}

        {!cargando &&
          filtrados.map((alumno) => {
            const avanceHoras = progreso(alumno.horas_actuales, alumno.horas_meta);
            const avanceReportes = progreso(
              alumno.reportes_entregados,
              alumno.reportes_meta
            );
            const alertaHoras =
              avanceHoras < 50 && alumno.estado !== "Listo para cierre";
            const observacionId = alumno.id_asignacion;

            return (
              <div
                key={alumno.id_asignacion}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
              >
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-[#0d2b5e]">{alumno.nombre}</h3>

                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <GraduationCap className="w-4 h-4" />
                        {alumno.carrera}
                      </span>

                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {alumno.empresa}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                      estadoColor[alumno.estado] ?? "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {alumno.estado}
                  </span>
                </div>

                {alertaHoras && (
                  <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                    <p className="text-xs text-orange-700">
                      El alumno presenta bajo avance de horas. Se recomienda registrar observación o revisar su situación.
                    </p>
                  </div>
                )}

                <div className="grid md:grid-cols-3 gap-4 mt-5">
                  <div className="border rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-4 h-4" />
                      Horas registradas
                    </div>

                    <p className="font-bold text-[#0d2b5e] mt-2">
                      {alumno.horas_actuales}/{alumno.horas_meta}
                    </p>

                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-[#1565c0] rounded-full"
                        style={{ width: `${avanceHoras}%` }}
                      />
                    </div>
                  </div>

                  <div className="border rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <FileText className="w-4 h-4" />
                      Reportes entregados
                    </div>

                    <p className="font-bold text-[#0d2b5e] mt-2">
                      {alumno.reportes_entregados}/{alumno.reportes_meta}
                    </p>

                    <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-2 bg-green-500 rounded-full"
                        style={{ width: `${avanceReportes}%` }}
                      />
                    </div>
                  </div>

                  <div className="border rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MessageSquare className="w-4 h-4" />
                      Último reporte
                    </div>
                    <p className="font-bold text-[#0d2b5e] mt-2">
                      {alumno.ultimo_reporte}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button className="border border-blue-200 text-[#1565c0] rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2">
                    <Eye className="w-4 h-4" />
                    Ver expediente
                  </button>

                  <button className="border border-purple-200 text-purple-600 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Revisar reportes
                  </button>

                  <button
                    onClick={() =>
                      setObservacionAbierta(
                        observacionAbierta === observacionId ? null : observacionId
                      )
                    }
                    className="border border-orange-200 text-orange-600 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Registrar observación
                  </button>
                </div>

                {observacionAbierta === observacionId && (
                  <div className="mt-5 bg-orange-50 border border-orange-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-[#0d2b5e]">
                        Registrar observación para {alumno.nombre}
                      </h4>

                      <button
                        onClick={() => setObservacionAbierta(null)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-semibold text-gray-600">
                          Tipo de observación
                        </label>

                        <select
                          value={tipoObservacion[observacionId] || ""}
                          onChange={(e) =>
                            setTipoObservacion({
                              ...tipoObservacion,
                              [observacionId]: e.target.value,
                            })
                          }
                          className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                        >
                          <option value="">Selecciona una opción</option>
                          <option value="Pocas horas">Pocas horas registradas</option>
                          <option value="Falta de reporte">Falta de reporte</option>
                          <option value="Reporte con correcciones">
                            Reporte con correcciones
                          </option>
                          <option value="Incidencia académica">
                            Incidencia académica
                          </option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>

                      {tipoObservacion[observacionId] === "Otro" && (
                        <div>
                          <label className="text-sm font-semibold text-gray-600">
                            Asunto
                          </label>

                          <input
                            type="text"
                            value={asuntoOtro[observacionId] || ""}
                            onChange={(e) =>
                              setAsuntoOtro({
                                ...asuntoOtro,
                                [observacionId]: e.target.value,
                              })
                            }
                            placeholder="Asunto de la observación..."
                            className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-300"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <label className="text-sm font-semibold text-gray-600">
                        Comentario
                      </label>

                      <textarea
                        value={textoObservacion[observacionId] || ""}
                        onChange={(e) =>
                          setTextoObservacion({
                            ...textoObservacion,
                            [observacionId]: e.target.value,
                          })
                        }
                        rows={4}
                        placeholder="Describe la observación académica o seguimiento requerido..."
                        className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-orange-300"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 justify-end mt-4">
                      <button
                        onClick={() => setObservacionAbierta(null)}
                        className="border border-gray-300 text-gray-600 rounded-xl px-4 py-2 text-xs font-semibold"
                      >
                        Cancelar
                      </button>

                      <button
                        onClick={() => enviarObservacion(alumno)}
                        disabled={
                          !tipoObservacion[observacionId] ||
                          !textoObservacion[observacionId]?.trim()
                        }
                        className="bg-orange-600 text-white rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                        Enviar observación
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {!cargando && filtrados.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
            No se encontraron alumnos con los filtros seleccionados.
          </div>
        )}
      </div>
    </div>
  );
}
