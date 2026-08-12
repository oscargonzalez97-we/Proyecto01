import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  MessageSquare,
  RotateCcw,
  Search,
  Send,
  User,
  X,
  XCircle,
} from "lucide-react";

import { gestionAsesorUseCase } from "../../dependencies";
import type {
  EstadoReporteAsesor,
  ReporteAsesor,
  ResumenReportesAsesor,
} from "../../../domain/asesor/Asesor";

import { getApiErrorMessage } from "../../../shared/utils/apiError";
import type { StatCard } from "../../../shared/types/ui";
const RESUMEN_INICIAL: ResumenReportesAsesor = {
  total: 0,
  pendientes: 0,
  aprobados: 0,
  rechazados: 0,
};

const estadoColor: Record<EstadoReporteAsesor, string> = {
  Pendiente: "bg-yellow-100 text-yellow-700",
  Aprobado: "bg-green-100 text-green-700",
  Rechazado: "bg-red-100 text-red-700",
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

function formatearFecha(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${fecha}T00:00:00`));
}

export function AsesorReportes() {
  const [reportes, setReportes] = useState<ReporteAsesor[]>([]);
  const [resumen, setResumen] = useState<ResumenReportesAsesor>(RESUMEN_INICIAL);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState<EstadoReporteAsesor | "Todos">("Todos");
  const [empresa, setEmpresa] = useState("Todas");
  const [rechazando, setRechazando] = useState<ReporteAsesor | null>(null);
  const [aprobando, setAprobando] = useState<ReporteAsesor | null>(null);
  const [calificacion, setCalificacion] = useState(90);
  const [observacion, setObservacion] = useState("");
  const [procesando, setProcesando] = useState<number | null>(null);

  const idAsesor = obtenerIdAsesorSesion();

  useEffect(() => {
    void cargarReportes();
  }, [idAsesor]); // eslint-disable-line react-hooks/exhaustive-deps -- cargarReportes only reads the current advisor id.

  async function cargarReportes() {
    if (!idAsesor) {
      setError("No se encontro el perfil de asesor en la sesion actual.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const data = await gestionAsesorUseCase.listarReportes(idAsesor);
      setReportes(data.reportes);
      setResumen(data.resumen);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar los reportes asignados al asesor.");
    } finally {
      setCargando(false);
    }
  }

  const empresas = useMemo(
    () => [...new Set(reportes.map((reporte) => reporte.empresa))],
    [reportes],
  );

  const filtrados = useMemo(() => {
    return reportes.filter((reporte) => {
      const q = busqueda.toLowerCase();
      const texto = [
        reporte.alumno,
        reporte.matricula ?? "",
        reporte.empresa,
        reporte.carrera,
        reporte.titulo,
      ]
        .join(" ")
        .toLowerCase();

      const coincideBusqueda = texto.includes(q);
      const coincideEstado = estado === "Todos" || reporte.estado === estado;
      const coincideEmpresa = empresa === "Todas" || reporte.empresa === empresa;

      return coincideBusqueda && coincideEstado && coincideEmpresa;
    });
  }, [busqueda, empresa, estado, reportes]);

  const limpiarFiltros = () => {
    setBusqueda("");
    setEstado("Todos");
    setEmpresa("Todas");
  };

  const cambiarEstado = async (
    reporte: ReporteAsesor,
    nuevoEstado: Exclude<EstadoReporteAsesor, "Pendiente">,
    nota?: string,
    notaCalificacion?: number,
  ) => {
    if (!idAsesor) return;

    try {
      setProcesando(reporte.id_reporte);
      setError("");
      await gestionAsesorUseCase.cambiarEstadoReporte(
        idAsesor,
        reporte.id_reporte,
        nuevoEstado,
        nota,
        notaCalificacion,
      );
      await cargarReportes();
      setRechazando(null);
      setAprobando(null);
      setObservacion("");
    } catch (err) {
      console.error(err);
      setError("No se pudo actualizar el reporte.");
    } finally {
      setProcesando(null);
    }
  };

  async function abrirReporte(idReporte: number) {
    try {
      setError("");
      const blob = await gestionAsesorUseCase.descargarReporte(idReporte);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo abrir el reporte."));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Reportes de Alumnos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Revision academica de reportes y evidencias entregadas por los alumnos asignados.
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {([
          ["Pendientes", resumen.pendientes, AlertTriangle],
          ["Aprobados", resumen.aprobados, CheckCircle2],
          ["Rechazados", resumen.rechazados, XCircle],
          ["Total reportes", resumen.total, FileText],
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
            <h3 className="font-bold text-[#0d2b5e] text-sm">Filtros de reportes</h3>
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
              placeholder="Buscar alumno, empresa, matricula o reporte..."
            />
          </div>

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoReporteAsesor | "Todos")}
            className="border rounded-xl px-3 py-2 text-sm bg-white"
          >
            <option>Todos</option>
            <option>Pendiente</option>
            <option>Aprobado</option>
            <option>Rechazado</option>
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
            Cargando reportes...
          </div>
        )}

        {!cargando &&
          filtrados.map((reporte) => {
            return (
              <div
                key={reporte.id_reporte}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
              >
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-[#0d2b5e]">{reporte.titulo}</h3>
                        {reporte.tipo_reporte && (
                          <span className="bg-blue-50 text-[#1565c0] rounded-full px-2.5 py-1 text-[11px] font-bold">
                            {reporte.tipo_reporte}
                          </span>
                        )}
                      </div>

                    <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {reporte.alumno}
                      </span>

                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {reporte.empresa}
                      </span>
                    </div>

                    <p className="text-xs text-gray-400 mt-1">
                      {reporte.matricula ?? "Sin matricula"} · {reporte.carrera} · Entregado:{" "}
                      {formatearFecha(reporte.fecha_entrega)}
                    </p>
                    <p className="text-xs text-[#0d2b5e] font-semibold mt-1 break-all">
                      Archivo: {reporte.archivo}
                    </p>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                      estadoColor[reporte.estado]
                    }`}
                  >
                    {reporte.estado}
                  </span>
                </div>

                {reporte.calificacion !== null && (
                  <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
                    <strong>Calificacion: {reporte.calificacion}/100</strong>
                    {reporte.observacion_asesor && <p className="mt-1 whitespace-pre-line">{reporte.observacion_asesor}</p>}
                  </div>
                )}
                {reporte.estado === "Rechazado" && reporte.observacion_asesor && (
                  <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
                    <strong>Correcciones solicitadas</strong>
                    <p className="mt-1 whitespace-pre-line">{reporte.observacion_asesor}</p>
                  </div>
                )}

                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-[#1565c0] mt-0.5" />
                    <p className="text-sm text-gray-600 whitespace-pre-line">
                      {reporte.descripcion || "Sin descripcion registrada."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    onClick={() => abrirReporte(reporte.id_reporte)}
                    className="border border-blue-200 text-[#1565c0] rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    Ver reporte
                  </button>

                  {reporte.estado !== "Aprobado" && (
                    <button
                      onClick={() => {
                        setAprobando(reporte);
                        setCalificacion(reporte.calificacion ?? 90);
                        setObservacion(reporte.observacion_asesor ?? "");
                      }}
                      disabled={procesando === reporte.id_reporte}
                      className="bg-green-600 text-white rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Aprobar
                    </button>
                  )}

                  {reporte.estado !== "Rechazado" && (
                    <button
                      onClick={() => {
                        setRechazando(reporte);
                        setObservacion("");
                      }}
                      disabled={procesando === reporte.id_reporte}
                      className="border border-orange-200 text-orange-600 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Solicitar correccion
                    </button>
                  )}
                </div>
              </div>
            );
          })}

        {!cargando && filtrados.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
            No se encontraron reportes con los filtros seleccionados.
          </div>
        )}
      </div>

      {aprobando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-md">
            <h3 className="font-bold text-[#0d2b5e]">Calificar y aprobar reporte</h3>
            <p className="text-sm text-gray-500 mt-1">{aprobando.titulo} - {aprobando.alumno}</p>
            <label className="block mt-5 text-sm font-semibold text-gray-600">Calificacion (0 a 100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={calificacion}
              onChange={(e) => setCalificacion(Number(e.target.value))}
              className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2"
            />
            <label className="block mt-4 text-sm font-semibold text-gray-600">Retroalimentacion opcional</label>
            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={3}
              className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 resize-none"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAprobando(null)} className="border rounded-xl px-4 py-2 text-sm">Cancelar</button>
              <button
                onClick={() => cambiarEstado(aprobando, "Aprobado", observacion, calificacion)}
                disabled={calificacion < 0 || calificacion > 100 || procesando === aprobando.id_reporte}
                className="bg-green-600 text-white rounded-xl px-4 py-2 text-sm disabled:opacity-50"
              >
                Guardar calificacion
              </button>
            </div>
          </div>
        </div>
      )}

      {rechazando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-bold text-[#0d2b5e]">Solicitar correccion</h3>
                <p className="text-sm text-gray-500 mt-1">
La observacion se guardara en el reporte y llegara como notificacion al alumno.
                </p>
              </div>

              <button
                onClick={() => setRechazando(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-600">
              <strong>{rechazando.titulo}</strong> · {rechazando.alumno}
            </div>

            <textarea
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              rows={4}
              placeholder="Indica que debe corregir el alumno..."
              className="mt-4 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-orange-300"
            />

            <div className="flex flex-wrap gap-2 justify-end mt-4">
              <button
                onClick={() => setRechazando(null)}
                className="border border-gray-300 text-gray-600 rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Cancelar
              </button>

              <button
                onClick={() => cambiarEstado(rechazando, "Rechazado", observacion)}
                disabled={!observacion.trim() || procesando === rechazando.id_reporte}
                className="bg-orange-600 text-white rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
                Enviar correccion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
