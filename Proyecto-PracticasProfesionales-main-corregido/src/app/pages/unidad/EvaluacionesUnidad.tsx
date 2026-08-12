import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, CheckCircle, MessageSquare, Save, Search, Star, Users } from "lucide-react";
import { gestionSeguimientoPracticasUseCase } from "../../dependencies";
import type { PrioridadIncidencia, SeguimientoUnidadAlumno, SeguimientoUnidadResponse } from "../../../domain/seguimiento/SeguimientoPracticas";

import type { ColoredStatCard } from "../../../shared/types/ui";
type UsuarioSesion = { perfil?: { id_empresa?: number } };

function obtenerIdEmpresa() {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as UsuarioSesion).perfil?.id_empresa ?? null;
  } catch {
    return null;
  }
}

export function EvaluacionesUnidad() {
  const [datos, setDatos] = useState<SeguimientoUnidadResponse | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [evaluando, setEvaluando] = useState<SeguimientoUnidadAlumno | null>(null);
  const [incidenciaAlumno, setIncidenciaAlumno] = useState<SeguimientoUnidadAlumno | null>(null);
  const [calificacion, setCalificacion] = useState(90);
  const [comentarios, setComentarios] = useState("");
  const [tipoIncidencia, setTipoIncidencia] = useState("Desempeno");
  const [prioridad, setPrioridad] = useState<PrioridadIncidencia>("Media");
  const [descripcion, setDescripcion] = useState("");
  const [confirmandoIncidencia, setConfirmandoIncidencia] = useState(false);
  const [segundosConfirmacion, setSegundosConfirmacion] = useState(0);
  const idEmpresa = obtenerIdEmpresa();

  async function cargar() {
    if (!idEmpresa) {
      setError("No se encontro la empresa asociada a esta sesion.");
      setCargando(false);
      return;
    }
    try {
      setCargando(true);
      setError("");
      setDatos(await gestionSeguimientoPracticasUseCase.obtenerUnidad(idEmpresa));
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las evaluaciones.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [idEmpresa]); // eslint-disable-line react-hooks/exhaustive-deps -- cargar only reads the current company id.

  useEffect(() => {
    if (!confirmandoIncidencia || segundosConfirmacion <= 0) return;

    const timer = window.setTimeout(() => {
      setSegundosConfirmacion((segundos) => segundos - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [confirmandoIncidencia, segundosConfirmacion]);

  const alumnos = useMemo(() => {
    const texto = q.toLowerCase();
    return (datos?.alumnos ?? []).filter((a) =>
      [a.alumno, a.matricula ?? "", a.carrera, a.vacante].join(" ").toLowerCase().includes(texto),
    );
  }, [datos, q]);

  function abrirEvaluacion(alumno: SeguimientoUnidadAlumno) {
    setEvaluando(alumno);
    setCalificacion(alumno.evaluacion_alumno?.calificacion ?? 90);
    setComentarios(alumno.evaluacion_alumno?.comentarios ?? "");
  }

  function abrirIncidencia(alumno: SeguimientoUnidadAlumno) {
    setIncidenciaAlumno(alumno);
    setConfirmandoIncidencia(false);
    setSegundosConfirmacion(0);
  }

  async function guardarEvaluacion(event: FormEvent) {
    event.preventDefault();
    if (!idEmpresa || !evaluando) return;
    try {
      setGuardando(true);
      await gestionSeguimientoPracticasUseCase.guardarEvaluacionEmpresaAlumno(idEmpresa, {
        id_asignacion: evaluando.id_asignacion,
        calificacion,
        comentarios: comentarios || undefined,
      });
      setEvaluando(null);
      await cargar();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la evaluacion. El alumno debe estar en cierre de practicas.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarIncidencia(event: FormEvent) {
    event.preventDefault();
    if (!idEmpresa || !incidenciaAlumno || !descripcion.trim()) return;

    if (!confirmandoIncidencia) {
      setConfirmandoIncidencia(true);
      setSegundosConfirmacion(5);
      return;
    }

    if (segundosConfirmacion > 0) return;

    try {
      setGuardando(true);
      await gestionSeguimientoPracticasUseCase.crearIncidenciaEmpresa(idEmpresa, incidenciaAlumno.id_asignacion, {
        tipo_incidencia: tipoIncidencia,
        prioridad,
        descripcion,
      });
      setIncidenciaAlumno(null);
      setDescripcion("");
      setConfirmandoIncidencia(false);
      setSegundosConfirmacion(0);
      await cargar();
    } catch (err) {
      console.error(err);
      setError("No se pudo registrar la incidencia.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) return <div className="bg-white rounded-2xl border p-10 text-center text-gray-500">Cargando evaluaciones...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Evaluaciones e Incidencias</h1>
        <p className="text-gray-500 text-sm mt-1">Evalua alumnos al cierre y reporta incidencias durante sus practicas.</p>
      </div>
      {error && <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">{error}</div>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {([
          ["Alumnos", datos?.resumen.total ?? 0, Users, "bg-blue-50 text-blue-600"],
          ["Evaluados", datos?.resumen.evaluados ?? 0, CheckCircle, "bg-green-50 text-green-600"],
          ["Pendientes", datos?.resumen.pendientes ?? 0, Star, "bg-yellow-50 text-yellow-600"],
          ["Incidencias", datos?.alumnos.reduce((s, a) => s + a.incidencias, 0) ?? 0, AlertTriangle, "bg-orange-50 text-orange-600"],
        ] satisfies ColoredStatCard[]).map(([label, value, Icon, color]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}><Icon className="w-5 h-5" /></div>
            <div className="text-2xl font-bold text-[#0d2b5e]">{value}</div>
            <div className="text-gray-500 text-sm mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="border rounded-xl px-3 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} className="outline-none text-sm w-full" placeholder="Buscar alumno, matricula o proyecto..." />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-gray-100">
          {alumnos.map((alumno) => (
            <div key={alumno.id_asignacion} className="p-5 hover:bg-gray-50">
              <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                <div>
                  <h4 className="font-bold text-[#0d2b5e]">{alumno.alumno}</h4>
                  <p className="text-sm text-gray-500 mt-1">{alumno.matricula ?? "Sin matricula"} · {alumno.carrera}</p>
                  <p className="text-sm text-gray-500 mt-1">{alumno.vacante}</p>
                  <div className="grid md:grid-cols-4 gap-3 mt-4">
                    <div className="border rounded-xl px-3 py-2"><div className="text-xs text-gray-500">Horas</div><div className="font-bold">{alumno.horas_aprobadas}/480</div></div>
                    <div className="border rounded-xl px-3 py-2"><div className="text-xs text-gray-500">Reportes pendientes</div><div className="font-bold">{alumno.reportes_pendientes}</div></div>
                    <div className="border rounded-xl px-3 py-2"><div className="text-xs text-gray-500">Reportes rechazados</div><div className="font-bold">{alumno.reportes_rechazados}</div></div>
                    <div className="border rounded-xl px-3 py-2"><div className="text-xs text-gray-500">Incidencias</div><div className="font-bold">{alumno.incidencias}</div></div>
                  </div>
                  {alumno.evaluacion_alumno && <p className="text-sm text-green-700 mt-3">Evaluado con {alumno.evaluacion_alumno.calificacion}/100.</p>}
                  {!alumno.puede_evaluar && <p className="text-xs text-yellow-700 mt-3">{alumno.motivo_bloqueo}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => abrirEvaluacion(alumno)} disabled={!alumno.puede_evaluar} className="bg-[#1565c0] text-white rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-50"><Star className="inline w-4 h-4 mr-1" /> Evaluar</button>
                  <button onClick={() => abrirIncidencia(alumno)} className="border border-orange-200 text-orange-600 rounded-xl px-4 py-2 text-xs font-semibold"><MessageSquare className="inline w-4 h-4 mr-1" /> Queja</button>
                </div>
              </div>
            </div>
          ))}
          {alumnos.length === 0 && <div className="p-10 text-center text-gray-400">No hay alumnos asignados.</div>}
        </div>
      </div>

      {evaluando && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <form onSubmit={guardarEvaluacion} className="bg-white rounded-2xl p-6 w-full max-w-xl">
            <h3 className="font-bold text-[#0d2b5e]">Evaluar alumno</h3>
            <p className="text-sm text-gray-500 mt-1">{evaluando.alumno}</p>
            <input type="number" min={0} max={100} value={calificacion} onChange={(e) => setCalificacion(Number(e.target.value))} className="mt-4 w-full border rounded-xl px-3 py-2 text-sm" />
            <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={5} className="mt-4 w-full border rounded-xl p-3 text-sm" placeholder="Comentarios sobre puntualidad, responsabilidad, desempeno y cumplimiento..." />
            <div className="flex justify-end gap-3 mt-5">
              <button type="button" onClick={() => setEvaluando(null)} className="border rounded-xl px-4 py-2 text-sm">Cancelar</button>
              <button disabled={guardando} className="bg-[#1565c0] text-white rounded-xl px-4 py-2 text-sm flex items-center gap-2"><Save className="w-4 h-4" /> Guardar</button>
            </div>
          </form>
        </div>
      )}

      {incidenciaAlumno && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <form onSubmit={guardarIncidencia} className="bg-white rounded-2xl p-6 w-full max-w-xl">
            <h3 className="font-bold text-[#0d2b5e]">Registrar queja/incidencia</h3>
            <p className="text-sm text-gray-500 mt-1">{incidenciaAlumno.alumno}</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <input value={tipoIncidencia} onChange={(e) => setTipoIncidencia(e.target.value)} className="border rounded-xl px-3 py-2 text-sm" />
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadIncidencia)} className="border rounded-xl px-3 py-2 text-sm bg-white"><option>Baja</option><option>Media</option><option>Alta</option></select>
            </div>
            <textarea
              value={descripcion}
              onChange={(e) => {
                setDescripcion(e.target.value);
                setConfirmandoIncidencia(false);
                setSegundosConfirmacion(0);
              }}
              required
              rows={5}
              className="mt-4 w-full border rounded-xl p-3 text-sm"
              placeholder="Describe la situacion..."
            />
            {confirmandoIncidencia && (
              <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
                {segundosConfirmacion > 0
                  ? `Espera ${segundosConfirmacion} segundo(s) para confirmar el envi?.`
                  : "Confirma si realmente quieres enviar esta incidencia."}
              </div>
            )}
            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => {
                  setIncidenciaAlumno(null);
                  setConfirmandoIncidencia(false);
                  setSegundosConfirmacion(0);
                }}
                className="border rounded-xl px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                disabled={guardando || !descripcion.trim() || (confirmandoIncidencia && segundosConfirmacion > 0)}
                className="bg-orange-600 text-white rounded-xl px-4 py-2 text-sm disabled:opacity-50"
              >
                {guardando
                  ? "Enviando..."
                  : confirmandoIncidencia
                    ? segundosConfirmacion > 0
                      ? `Confirmar en ${segundosConfirmacion}s`
                      : "Confirmar envi?"
                    : "Registrar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
