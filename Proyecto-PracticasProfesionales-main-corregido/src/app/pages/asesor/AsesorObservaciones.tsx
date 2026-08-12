import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  GraduationCap,
  MessageSquare,
  Save,
  Search,
  Star,
  Users,
} from "lucide-react";

import { gestionAsesorUseCase } from "../../dependencies";
import type {
  AlumnoEvaluacionAsesor,
  EvaluacionesAsesorResponse,
} from "../../../domain/asesor/Asesor";

import type { StatCard } from "../../../shared/types/ui";
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

export function AsesorObservaciones() {
  const [datos, setDatos] = useState<EvaluacionesAsesorResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionado, setSeleccionado] = useState<AlumnoEvaluacionAsesor | null>(null);
  const [calificacion, setCalificacion] = useState(90);
  const [comentarios, setComentarios] = useState("");

  const idAsesor = obtenerIdAsesorSesion();

  useEffect(() => {
    void cargar();
  }, [idAsesor]); // eslint-disable-line react-hooks/exhaustive-deps -- cargar only reads the current advisor id.

  async function cargar() {
    if (!idAsesor) {
      setError("No se encontro el perfil de asesor en la sesion actual.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const respuesta = await gestionAsesorUseCase.listarEvaluaciones(idAsesor);
      setDatos(respuesta);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las evaluaciones del asesor.");
    } finally {
      setCargando(false);
    }
  }

  const alumnos = useMemo(() => {
    const q = busqueda.toLowerCase();
    return (datos?.alumnos ?? []).filter((alumno) =>
      [alumno.alumno, alumno.matricula ?? "", alumno.carrera, alumno.empresa]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [busqueda, datos]);

  function abrirEvaluacion(alumno: AlumnoEvaluacionAsesor) {
    setSeleccionado(alumno);
    setCalificacion(alumno.evaluacion?.calificacion ?? 90);
    setComentarios(alumno.evaluacion?.comentarios ?? "");
  }

  async function guardarEvaluacion(event: FormEvent) {
    event.preventDefault();
    if (!idAsesor || !seleccionado) return;

    try {
      setGuardando(seleccionado.id_asignacion);
      setError("");
      await gestionAsesorUseCase.guardarEvaluacion(idAsesor, {
        id_asignacion: seleccionado.id_asignacion,
        calificacion,
        comentarios: comentarios.trim() || undefined,
      });
      setSeleccionado(null);
      setComentarios("");
      await cargar();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la evaluacion del asesor.");
    } finally {
      setGuardando(null);
    }
  }

  const resumen = datos?.resumen ?? {
    total: 0,
    evaluados: 0,
    pendientes: 0,
    bloqueados: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">evaluacion del asesor</h1>
        <p className="text-gray-500 text-sm mt-1">
          Registra la evaluacion academica de los alumnos asignados cuando sus reportes esten listos.
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {([
          ["Total alumnos", resumen.total, Users],
          ["Evaluados", resumen.evaluados, CheckCircle2],
          ["Pendientes", resumen.pendientes, FileText],
          ["Bloqueados", resumen.bloqueados, AlertTriangle],
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
        <div className="border rounded-xl px-3 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="outline-none text-sm w-full"
            placeholder="Buscar alumno, matricula, carrera o empresa..."
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Star className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Alumnos por evaluar</h3>
          <span className="ml-auto text-xs text-gray-400">{alumnos.length} registros</span>
        </div>

        <div className="divide-y divide-gray-100">
          {cargando && (
            <div className="p-10 text-center text-gray-400">Cargando evaluaciones...</div>
          )}

          {!cargando &&
            alumnos.map((alumno) => (
              <div key={alumno.id_asignacion} className="p-5 hover:bg-gray-50">
                <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#1565c0] flex items-center justify-center font-bold">
                      {alumno.alumno.charAt(0)}
                    </div>

                    <div>
                      <h4 className="font-bold text-[#0d2b5e]">{alumno.alumno}</h4>
                      <p className="text-sm text-gray-500 mt-1">
                        {alumno.matricula ?? "Sin matricula"} · {alumno.carrera}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">{alumno.empresa}</p>

                      <div className="grid md:grid-cols-3 gap-3 mt-4">
                        <div className="border rounded-xl px-3 py-2">
                          <div className="text-xs text-gray-500">Horas aprobadas</div>
                          <div className="font-bold text-[#0d2b5e]">{alumno.horas_aprobadas}/480</div>
                        </div>
                        <div className="border rounded-xl px-3 py-2">
                          <div className="text-xs text-gray-500">Reportes pendientes</div>
                          <div className="font-bold text-[#0d2b5e]">{alumno.reportes_pendientes}</div>
                        </div>
                        <div className="border rounded-xl px-3 py-2">
                          <div className="text-xs text-gray-500">Reportes rechazados</div>
                          <div className="font-bold text-[#0d2b5e]">{alumno.reportes_rechazados}</div>
                        </div>
                      </div>

                      {alumno.evaluacion && (
                        <div className="mt-4 bg-green-50 border border-green-100 rounded-xl p-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                            <CheckCircle2 className="w-4 h-4" />
                            Evaluado con {alumno.evaluacion.calificacion}/100
                          </div>
                          <p className="text-xs text-green-700 mt-1">
                            Fecha: {formatearFecha(alumno.evaluacion.fecha_evaluacion)}
                          </p>
                          {alumno.evaluacion.comentarios && (
                            <p className="text-sm text-green-800 mt-3 whitespace-pre-line">
                              {alumno.evaluacion.comentarios}
                            </p>
                          )}
                        </div>
                      )}

                      {!alumno.puede_evaluar && (
                        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-700 mt-0.5" />
                          <p className="text-xs text-yellow-700">{alumno.motivo_bloqueo}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => abrirEvaluacion(alumno)}
                    disabled={!alumno.puede_evaluar || guardando === alumno.id_asignacion}
                    className="bg-[#1565c0] text-white rounded-xl px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <GraduationCap className="w-4 h-4" />
                    {alumno.evaluacion ? "Actualizar evaluacion" : "Evaluar"}
                  </button>
                </div>
              </div>
            ))}

          {!cargando && alumnos.length === 0 && (
            <div className="p-10 text-center text-gray-400">
              No se encontraron alumnos asignados.
            </div>
          )}
        </div>
      </div>

      {seleccionado && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={guardarEvaluacion}
            className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 w-full max-w-xl"
          >
            <h3 className="font-bold text-[#0d2b5e]">Evaluar alumno</h3>
            <p className="text-sm text-gray-500 mt-1">
              {seleccionado.alumno} · {seleccionado.empresa}
            </p>

            <label className="block mt-5">
              <span className="text-sm font-semibold text-gray-600">Calificacion</span>
              <input
                type="number"
                min={0}
                max={100}
                value={calificacion}
                onChange={(event) => setCalificacion(Number(event.target.value))}
                className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
              />
            </label>

            <label className="block mt-4">
              <span className="text-sm font-semibold text-gray-600">Comentarios</span>
              <textarea
                value={comentarios}
                onChange={(event) => setComentarios(event.target.value)}
                rows={5}
                placeholder="Describe el desempeno academico, cumplimiento de reportes y observaciones finales..."
                className="mt-2 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-blue-200"
              />
            </label>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4 flex gap-3">
              <MessageSquare className="w-5 h-5 text-[#1565c0] mt-0.5" />
              <p className="text-sm text-[#0d2b5e]">
                Esta evaluacion sera requisito para liberar al alumno al cierre del proceso.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setSeleccionado(null)}
                className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando === seleccionado.id_asignacion}
                className="bg-[#1565c0] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {guardando === seleccionado.id_asignacion ? "Guardando..." : "Guardar evaluacion"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
