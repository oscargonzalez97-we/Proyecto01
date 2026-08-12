import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Lock,
  MessageSquare,
  Upload,
  XCircle,
} from "lucide-react";

import { gestionReportesAlumnoUseCase } from "../../dependencies";
import type {
  EspacioReporteAlumno,
  EstadoReporteAlumno,
  ReportesAlumnoResponse,
  SubirReporteAlumnoInput,
  TipoReporteAlumno,
} from "../../../domain/alumno/ReporteAlumno";
import { getApiErrorMessage } from "../../../shared/utils/apiError";

import type { ColoredStatCard } from "../../../shared/types/ui";
type UsuarioSesion = {
  perfil?: {
    id_alumno?: number;
  };
};

const estadoColor: Record<EstadoReporteAlumno, string> = {
  Aprobado: "bg-green-100 text-green-700",
  Pendiente: "bg-yellow-100 text-yellow-700",
  Rechazado: "bg-red-100 text-red-700",
};
const MAX_DOCUMENTO_BYTES = 2 * 1024 * 1024;
const ACCEPT_DOCUMENTOS = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const FORMATOS_PREDETERMINADOS: Record<TipoReporteAlumno, { href: string; nombreArchivo: string; etiqueta: string }> = {
  Parcial: {
    href: import.meta.env.BASE_URL + "documentos/reportes/guia-informe-parcial-practicas-profesionales.pdf",
    nombreArchivo: "guia-informe-parcial-practicas-profesionales.pdf",
    etiqueta: "Descargar guía del informe parcial",
  },
  Final: {
    href: import.meta.env.BASE_URL + "documentos/reportes/guia-informe-final-practicas-profesionales.pdf",
    nombreArchivo: "guia-informe-final-practicas-profesionales.pdf",
    etiqueta: "Descargar guía del informe final",
  },
};

function esArchivoDocumentoPermitido(archivo: File) {
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(archivo.type) ||
    /\.(pdf|jpe?g|png|webp)$/i.test(archivo.name);
}

function obtenerIdAlumno() {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;

  try {
    const usuario = JSON.parse(raw) as UsuarioSesion;
    return usuario.perfil?.id_alumno ?? null;
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

function archivoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function AlumnoReportes() {
  const [datos, setDatos] = useState<ReportesAlumnoResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [subiendo, setSubiendo] = useState<TipoReporteAlumno | null>(null);
  const [error, setError] = useState("");
  const [descripciones, setDescripciones] = useState<Partial<Record<TipoReporteAlumno, string>>>({});
  const [archivos, setArchivos] = useState<Partial<Record<TipoReporteAlumno, File>>>({});

  const idAlumno = obtenerIdAlumno();

  useEffect(() => {
    void cargarReportes();
  }, [idAlumno]); // eslint-disable-line react-hooks/exhaustive-deps -- cargarReportes only reads the current student id.

  async function cargarReportes() {
    if (!idAlumno) {
      setError("No se encontro el perfil de alumno en la sesion actual.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const respuesta = await gestionReportesAlumnoUseCase.listar(idAlumno);
      setDatos(respuesta);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar tus reportes.");
    } finally {
      setCargando(false);
    }
  }

  const seleccionarArchivo =
    (tipo: TipoReporteAlumno) => (event: ChangeEvent<HTMLInputElement>) => {
      setArchivos((actual) => ({
        ...actual,
        [tipo]: event.target.files?.[0] ?? undefined,
      }));
    };

  const subirReporte = async (espacio: EspacioReporteAlumno) => {
    const archivo = archivos[espacio.tipo_reporte];
    if (!idAlumno || !archivo || !espacio.puede_enviar) return;
    if (archivo.size > MAX_DOCUMENTO_BYTES) {
      setError("El archivo excede el límite máximo de 2 MB.");
      return;
    }
    if (!esArchivoDocumentoPermitido(archivo)) {
      setError("Tipo de archivo no permitido.");
      return;
    }

    try {
      setSubiendo(espacio.tipo_reporte);
      setError("");
      const contenido = await archivoABase64(archivo);
      const payload: SubirReporteAlumnoInput = {
        tipo_reporte: espacio.tipo_reporte,
        descripcion: descripciones[espacio.tipo_reporte]?.trim() || undefined,
        nombre_archivo: archivo.name,
        contenido_base64: contenido,
        mime_type: archivo.type || "application/pdf",
      };
      await gestionReportesAlumnoUseCase.subir(idAlumno, payload);
      setArchivos((actual) => ({ ...actual, [espacio.tipo_reporte]: undefined }));
      setDescripciones((actual) => ({ ...actual, [espacio.tipo_reporte]: "" }));
      await cargarReportes();
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo subir el reporte."));
    } finally {
      setSubiendo(null);
    }
  };

  async function abrirReporte(idReporte: number) {
    try {
      setError("");
      const blob = await gestionReportesAlumnoUseCase.descargar(idReporte);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo abrir el reporte."));
    }
  }

  const resumen = datos?.resumen ?? {
    total: 0,
    pendientes: 0,
    aprobados: 0,
    rechazados: 0,
  };
  const espacios = useMemo(() => datos?.espacios ?? [], [datos?.espacios]);
  const horasActuales = datos?.horas_actuales ?? 0;
  const horasMeta = datos?.horas_meta ?? 0;
  const progresoHoras = horasMeta > 0
    ? Math.min(Math.round((horasActuales / horasMeta) * 100), 100)
    : 0;

  const entregadosControlados = useMemo(
    () => espacios.filter((espacio) => espacio.reporte !== null).length,
    [espacios],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Mis Reportes</h1>
        <p className="text-gray-500 text-sm mt-1">
          Entrega el reporte parcial a mitad de tus horas y el final al cerrar practicas.
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      {datos?.advertencia_regla && (
    <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
    {datos.advertencia_regla}
    </div>
      )}
      {cargando ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
          Cargando reportes...
        </div>
      ) : (
        <>
          <div className="bg-[#0d2b5e] rounded-xl p-5 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {datos?.asignacion?.empresa ?? "Sin empresa asignada"}
                </h2>
                <p className="text-blue-200 text-sm mt-1">
                  {datos?.asignacion?.vacante ?? "Completa las fases iniciales para iniciar reportes"}
                </p>
              </div>

              <div className="min-w-[240px]">
                <div className="flex justify-between text-xs text-blue-100 mb-1">
                  <span>Horas aprobadas</span>
                  <span>
                    {horasActuales} / {horasMeta}
                  </span>
                </div>
                <div className="bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white h-2 rounded-full"
                    style={{ width: `${progresoHoras}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {!datos?.puede_subir && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex gap-3">
              <Lock className="w-5 h-5 text-yellow-700 mt-0.5" />
              <div>
                <div className="font-bold text-yellow-800 text-sm">Reportes bloqueados</div>
                <p className="text-yellow-700 text-sm mt-1">
                  {datos?.motivo_bloqueo ??
                    "Primero debes terminar las fases iniciales del proceso."}
                </p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-4 gap-3">
            {([
              ["Espacios", `${entregadosControlados}/2`, FileText, "bg-blue-600"],
              ["Aprobados", resumen.aprobados, CheckCircle2, "bg-green-600"],
              ["En revisión", resumen.pendientes, Clock, "bg-yellow-500"],
              ["Rechazados", resumen.rechazados, XCircle, "bg-red-500"],
            ] satisfies ColoredStatCard[]).map(([tituloCard, valor, Icon]) => (
              <div key={tituloCard} className="rounded-xl border border-gray-200 bg-white p-4">
                <Icon className="w-6 h-6 mb-2 text-gray-600" />
                <div className="text-xl font-bold text-[#0d2b5e]">{valor}</div>
                <div className="text-gray-500 text-xs">{tituloCard}</div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {espacios.map((espacio) => {
              const reporte = espacio.reporte;
              const archivo = archivos[espacio.tipo_reporte];
              const bloqueado = !espacio.puede_enviar;
              const esAprobado = reporte?.estado === "Aprobado";
              const formatoPredeterminado = FORMATOS_PREDETERMINADOS[espacio.tipo_reporte];

              return (
                <div
                  key={espacio.tipo_reporte}
                  className={`rounded-xl border shadow-sm overflow-hidden transition-colors ${
                    espacio.desbloqueado ? "bg-white border-gray-200" : "bg-amber-50/70 border-amber-300 border-l-4"
                  }`}
                >
                  <div className="p-5 border-b border-gray-100 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        espacio.desbloqueado ? "bg-blue-50 text-[#1565c0]" : "bg-amber-100 text-amber-700"
                      }`}>
                        {espacio.desbloqueado ? <FileText className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-[#0d2b5e]">{espacio.titulo}</h3>
                        <p className="text-sm text-gray-500 mt-1">{espacio.descripcion}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Requisito: {espacio.horas_requeridas} horas aprobadas.
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${
                        reporte ? estadoColor[reporte.estado] : espacio.desbloqueado ? "bg-blue-100 text-[#1565c0]" : "bg-amber-100 text-amber-800 ring-1 ring-amber-300"
                      }`}
                    >
                      {reporte?.estado ?? (espacio.desbloqueado ? "Disponible" : "Bloqueado")}
                    </span>
                  </div>

                  <div className="p-5 grid lg:grid-cols-[1fr_360px] gap-4">
                    <div className="space-y-3">
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#0d2b5e]">
                          Formato predeterminado
                        </div>
                        <a
                          href={formatoPredeterminado.href}
                          download={formatoPredeterminado.nombreArchivo}
                          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1565c0] bg-white px-4 py-2 text-sm font-semibold text-[#1565c0] transition-colors hover:bg-[#1565c0] hover:text-white"
                        >
                          <Download className="h-4 w-4" />
                          {formatoPredeterminado.etiqueta}
                        </a>
                        <p className="mt-2 text-[11px] text-blue-700">
                          Puedes descargar esta guía en cualquier momento para preparar tu entrega.
                        </p>
                      </div>
                      {reporte ? (
                        <>
                          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                            <div className="text-xs font-bold text-[#1565c0] uppercase mb-2">
                              Archivo enviado
                            </div>
                            <div className="flex items-start gap-2 text-[#0d2b5e]">
                              <FileText className="w-4 h-4 mt-0.5" />
                              <div>
                                <div className="font-bold break-all">{reporte.archivo}</div>
                                <div className="text-xs text-blue-700 mt-1">
                                  Fecha de carga: {formatearFecha(reporte.fecha_entrega)}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
                            <MessageSquare className="w-5 h-5 text-[#1565c0] mt-0.5" />
                            <p className="text-sm text-gray-600 whitespace-pre-line">{reporte.descripcion || "Sin descripcion registrada."}</p>
                          </div>
                          {reporte.calificacion !== null && <p className="text-sm font-bold text-green-700">Calificacion del asesor: {reporte.calificacion}/100</p>}
                          {reporte.observacion_asesor && (
                            <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                              <strong>{reporte.estado === "Rechazado" ? "Correcciones solicitadas" : "Retroalimentacion del asesor"}</strong>
                              <p className="mt-1 whitespace-pre-line">{reporte.observacion_asesor}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-500">
                          Aun no has enviado este reporte.
                        </div>
                      )}

                      {espacio.motivo_bloqueo && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex gap-2 text-sm text-yellow-700">
                          <AlertTriangle className="w-4 h-4 mt-0.5" />
                          <span>{espacio.motivo_bloqueo}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      {reporte && (
                        <button
                          onClick={() => abrirReporte(reporte.id_reporte)}
                          className="w-full bg-[#1565c0] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2"
                        >
                          <Eye className="w-4 h-4" />
                          Ver reporte
                        </button>
                      )}

                      {!esAprobado && (
                        <>
                          <textarea
                            value={descripciones[espacio.tipo_reporte] ?? ""}
                            onChange={(event) =>
                              setDescripciones((actual) => ({
                                ...actual,
                                [espacio.tipo_reporte]: event.target.value,
                              }))
                            }
                            disabled={bloqueado}
                            rows={3}
                            placeholder="Comentario opcional para tu asesor"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-[#1565c0] disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/70 disabled:text-amber-800"
                          />

                          <label className="block">
                            <span className="sr-only">Archivo PDF</span>
                            <input
                              type="file"
                              accept={ACCEPT_DOCUMENTOS}
                              onChange={seleccionarArchivo(espacio.tipo_reporte)}
                              disabled={bloqueado}
                              className="w-full text-sm text-gray-500 file:mr-3 file:rounded-lg file:border-0 file:bg-[#1565c0] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white disabled:cursor-not-allowed disabled:rounded-lg disabled:bg-amber-100/70 disabled:p-2 disabled:text-amber-800 disabled:file:bg-amber-200 disabled:file:text-amber-700"
                            />
                          </label>

                          {archivo && (
                            <div className="text-xs text-[#0d2b5e] font-semibold break-all">
                              Seleccionado: {archivo.name}
                            </div>
                          )}
                          <div className="text-[11px] text-gray-500">Máximo 2 MB por archivo.</div>

                          <button
                            onClick={() => subirReporte(espacio)}
                            disabled={bloqueado || !archivo || subiendo === espacio.tipo_reporte}
                            className="w-full bg-[#0d2b5e] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-amber-200 disabled:text-amber-800"
                          >
                            <Upload className="w-4 h-4" />
                            {subiendo === espacio.tipo_reporte
                              ? "Subiendo..."
                              : reporte?.estado === "Rechazado"
                                ? "Enviar correccion"
                                : "Enviar reporte"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
