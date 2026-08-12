import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Filter,
  Search,
  XCircle,
} from "lucide-react";
import { gestionHorasUnidadUseCase } from "../../dependencies";
import type { EstadoHoraUnidad, HoraUnidad, HorasUnidadResponse } from "../../../domain/unidad/HorasUnidad";

type UsuarioSesion = {
  perfil?: {
    id_empresa?: number;
  };
};

const estadoColor: Record<EstadoHoraUnidad, string> = {
  Pendiente: "bg-yellow-100 text-yellow-700",
  Aprobada: "bg-green-100 text-green-700",
  Rechazada: "bg-red-100 text-red-700",
};

function obtenerIdEmpresa(): number | null {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;

  try {
    const usuario = JSON.parse(raw) as UsuarioSesion;
    return usuario.perfil?.id_empresa ?? null;
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

export function HorasUnidad() {
  const [datos, setDatos] = useState<HorasUnidadResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<EstadoHoraUnidad | "todos">("todos");
  const [procesando, setProcesando] = useState<number | null>(null);
  const [rechazando, setRechazando] = useState<HoraUnidad | null>(null);
  const [observaciones, setObservaciones] = useState("");

  const idEmpresa = obtenerIdEmpresa();

  const cargar = async () => {
    if (!idEmpresa) {
      setError("No se encontro la empresa asociada a esta sesion.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError(null);
      const respuesta = await gestionHorasUnidadUseCase.listar(idEmpresa);
      setDatos(respuesta);
    } catch {
      setError("No se pudieron cargar los registros de horas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [idEmpresa]); // eslint-disable-line react-hooks/exhaustive-deps -- cargar only reads the current company id.

  const registrosFiltrados = useMemo(() => {
    const registros = datos?.horas ?? [];
    return registros.filter((registro) => {
      const texto = [
        registro.alumno,
        registro.matricula,
        registro.carrera,
        registro.proyecto,
        registro.actividad,
      ]
        .join(" ")
        .toLowerCase();
      const coincideBusqueda = texto.includes(q.toLowerCase());
      const coincideEstado = filtro === "todos" || registro.estado === filtro;
      return coincideBusqueda && coincideEstado;
    });
  }, [datos, filtro, q]);

  const cambiarEstado = async (
    registro: HoraUnidad,
    estado: Exclude<EstadoHoraUnidad, "Pendiente">,
    nota?: string,
  ) => {
    if (!idEmpresa) return;

    try {
      setProcesando(registro.id_horas);
      await gestionHorasUnidadUseCase.cambiarEstado(idEmpresa, registro.id_horas, estado, nota);
      await cargar();
      setRechazando(null);
      setObservaciones("");
    } catch {
      setError("No se pudo actualizar el estado del registro.");
    } finally {
      setProcesando(null);
    }
  };

  const resumen = datos?.resumen;
  const horasTotales = datos?.horas.reduce((total, registro) => total + registro.horas, 0) ?? 0;

  if (cargando) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-500">
        Cargando registros de horas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Registro de Horas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Revisa y valida las horas registradas por los alumnos asignados a tu unidad receptora.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="bg-gradient-to-r from-orange-600 to-orange-500 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-xl">Control de horas de practicas profesionales</div>
          <div className="text-orange-100 text-sm mt-1">
            {datos?.empresa ?? "Unidad receptora"} · registros capturados por alumnos asignados
          </div>
        </div>

        <div className="bg-white/20 px-4 py-2 rounded-xl">
          <div className="text-white font-bold text-sm">{horasTotales.toLocaleString()} HORAS</div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          {
            label: "Registros",
            value: resumen?.total_registros ?? 0,
            icon: FileText,
            color: "bg-blue-50 text-blue-600",
          },
          {
            label: "Pendientes",
            value: resumen?.pendientes ?? 0,
            icon: Clock,
            color: "bg-yellow-50 text-yellow-600",
          },
          {
            label: "Aprobadas",
            value: resumen?.aprobadas ?? 0,
            icon: CheckCircle,
            color: "bg-green-50 text-green-600",
          },
          {
            label: "Rechazadas",
            value: resumen?.rechazadas ?? 0,
            icon: XCircle,
            color: "bg-red-50 text-red-600",
          },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className={`w-10 h-10 ${item.color} rounded-xl flex items-center justify-center mb-3`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-[#0d2b5e]">{item.value}</div>
            <div className="text-gray-500 text-sm mt-0.5">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por alumno, matricula, carrera, proyecto o actividad..."
            value={q}
            onChange={(event) => setQ(event.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1565c0]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filtro}
            onChange={(event) => setFiltro(event.target.value as EstadoHoraUnidad | "todos")}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#1565c0]"
          >
            <option value="todos">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Aprobada">Aprobada</option>
            <option value="Rechazada">Rechazada</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Horas por revisar</h3>
          <span className="ml-auto text-xs text-gray-400">{registrosFiltrados.length} resultados</span>
        </div>

        <div className="divide-y divide-gray-100">
          {registrosFiltrados.map((registro) => (
            <div key={registro.id_horas} className="px-6 py-5 hover:bg-gray-50">
              <div className="flex flex-col xl:flex-row xl:items-start gap-5">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-bold text-gray-800 text-sm">{registro.alumno}</h4>
                    <span className={`text-xs px-3 py-1 rounded-full font-semibold ${estadoColor[registro.estado]}`}>
                      {registro.estado}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    Matricula: {registro.matricula} · {registro.carrera}
                  </div>

                  <div className="text-xs text-[#1565c0] mt-1 font-medium">Proyecto: {registro.proyecto}</div>

                  <div className="grid md:grid-cols-3 gap-3 mt-3 text-xs text-gray-500">
                    <div>Fecha: {formatearFecha(registro.fecha)}</div>
                    <div>Horas: {registro.horas}</div>
                    <div>Registro: {registro.fecha_registro ? formatearFecha(registro.fecha_registro.slice(0, 10)) : "Sin fecha"}</div>
                  </div>

                  <div className="mt-4 bg-gray-50 border border-gray-100 rounded-xl p-4">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Actividad realizada</div>
                    <p className="text-sm text-gray-700 leading-relaxed">{registro.actividad}</p>
                  </div>

                  {registro.observaciones && (
                    <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                      Observaciones: {registro.observaciones}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 xl:flex-col xl:w-40">
                  {registro.estado === "Pendiente" ? (
                    <>
                      <button
                        onClick={() => cambiarEstado(registro, "Aprobada")}
                        disabled={procesando === registro.id_horas}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-60 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Aprobar
                      </button>

                      <button
                        onClick={() => {
                          setRechazando(registro);
                          setObservaciones("");
                        }}
                        disabled={procesando === registro.id_horas}
                        className="flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-60 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 bg-gray-100 rounded-lg px-4 py-2 text-center">
                      Revisado
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {registrosFiltrados.length === 0 && (
            <div className="px-6 py-10 text-center">
              <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm text-gray-500">No hay registros de horas con los filtros seleccionados.</div>
            </div>
          )}
        </div>
      </div>

      {rechazando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-lg">
            <h3 className="font-bold text-[#0d2b5e]">Rechazar registro de horas</h3>
            <p className="text-sm text-gray-500 mt-1">
              Agrega una observacion para que el alumno sepa que debe corregir.
            </p>

            <textarea
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
              rows={4}
              className="mt-4 w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#1565c0]"
              placeholder="Ej. La actividad no coincide con el periodo reportado."
            />

            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setRechazando(null)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => cambiarEstado(rechazando, "Rechazada", observaciones)}
                disabled={!observaciones.trim() || procesando === rechazando.id_horas}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                Confirmar rechazo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
