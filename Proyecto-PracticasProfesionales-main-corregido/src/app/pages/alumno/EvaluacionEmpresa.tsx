import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AlertTriangle, Building2, CheckCircle2, Lock, MessageSquare, Send, Star } from "lucide-react";
import { gestionSeguimientoPracticasUseCase } from "../../dependencies";
import type {
  PlantillaEvaluacionAlumnoEmpresa,
  PrioridadIncidencia,
  SeguimientoAlumnoResponse,
} from "../../../domain/seguimiento/SeguimientoPracticas";

type UsuarioSesion = { perfil?: { id_alumno?: number } };

function obtenerIdAlumno() {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as UsuarioSesion).perfil?.id_alumno ?? null;
  } catch {
    return null;
  }
}

export function EvaluacionEmpresa() {
  const [datos, setDatos] = useState<SeguimientoAlumnoResponse | null>(null);
  const [plantilla, setPlantilla] = useState<PlantillaEvaluacionAlumnoEmpresa>({
    preguntas: [],
    respuestas: [],
    incidencias_sugeridas: [],
  });
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [calificacion, setCalificacion] = useState(90);
  const [respuestas, setRespuestas] = useState<Record<string, string>>({});
  const [incidencias, setIncidencias] = useState<string[]>([]);
  const [comentarios, setComentarios] = useState("");
  const [tipoIncidencia, setTipoIncidencia] = useState("Seguimiento");
  const [prioridad, setPrioridad] = useState<PrioridadIncidencia>("Media");
  const [descripcionIncidencia, setDescripcionIncidencia] = useState("");
  const [confirmandoIncidencia, setConfirmandoIncidencia] = useState(false);
  const [segundosConfirmacion, setSegundosConfirmacion] = useState(0);
  const idAlumno = obtenerIdAlumno();

  async function cargar() {
    if (!idAlumno) {
      setError("No se encontro el perfil de alumno en la sesion actual.");
      setCargando(false);
      return;
    }
    try {
      setError("");
      setCargando(true);
      const [data, plantillaData] = await Promise.all([
        gestionSeguimientoPracticasUseCase.obtenerAlumno(idAlumno),
        gestionSeguimientoPracticasUseCase.obtenerPlantillaEvaluacionAlumnoEmpresa(),
      ]);
      setDatos(data);
      setPlantilla(plantillaData);
      if (data.evaluacion_empresa) {
        setCalificacion(data.evaluacion_empresa.calificacion);
        setRespuestas(data.evaluacion_empresa.respuestas);
        setIncidencias(data.evaluacion_empresa.incidencias_detectadas);
        setComentarios(data.evaluacion_empresa.comentarios ?? "");
      }
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el seguimiento.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [idAlumno]); // eslint-disable-line react-hooks/exhaustive-deps -- cargar only reads the current student id.

  useEffect(() => {
    if (!confirmandoIncidencia || segundosConfirmacion <= 0) return;

    const timer = window.setTimeout(() => {
      setSegundosConfirmacion((segundos) => segundos - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [confirmandoIncidencia, segundosConfirmacion]);

  async function enviarEvaluacion(event: FormEvent) {
    event.preventDefault();
    if (!idAlumno) return;
    try {
      setGuardando(true);
      await gestionSeguimientoPracticasUseCase.guardarEvaluacionAlumnoEmpresa(idAlumno, {
        calificacion,
        respuestas,
        incidencias_detectadas: incidencias,
        comentarios: comentarios || undefined,
      });
      await cargar();
    } catch (err) {
      console.error(err);
      setError("No se pudo guardar la evaluacion. Debes estar en cierre de practicas.");
    } finally {
      setGuardando(false);
    }
  }

  async function enviarIncidencia(event: FormEvent) {
    event.preventDefault();
    if (!idAlumno || !descripcionIncidencia.trim()) return;

    if (!confirmandoIncidencia) {
      setConfirmandoIncidencia(true);
      setSegundosConfirmacion(5);
      return;
    }

    if (segundosConfirmacion > 0) return;

    try {
      setGuardando(true);
      await gestionSeguimientoPracticasUseCase.crearIncidenciaAlumno(idAlumno, {
        tipo_incidencia: tipoIncidencia,
        prioridad,
        descripcion: descripcionIncidencia,
      });
      setDescripcionIncidencia("");
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

  if (cargando) return <div className="bg-white rounded-2xl border p-10 text-center text-gray-500">Cargando evaluacion...</div>;

  if (datos && !datos.asignacion) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0d2b5e]">Evaluacion de Empresa</h1>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-10 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7 text-[#1565c0]" />
          </div>
          <h2 className="text-xl font-bold text-[#0d2b5e] mt-4">Sin empresa asignada</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Evaluacion de Empresa</h1>
        <p className="text-gray-500 text-sm mt-1">Evalua a tu unidad receptora al cierre y registra incidencias durante tus practicas.</p>
      </div>

      {error && <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">{error}</div>}

      <div className="bg-[#0d2b5e] rounded-2xl p-6 text-white flex items-center gap-4">
        <Building2 className="w-10 h-10 text-blue-200" />
        <div>
          <h2 className="text-xl font-bold">{datos?.asignacion?.empresa ?? "Sin empresa asignada"}</h2>
          <p className="text-blue-200 text-sm">{datos?.asignacion?.vacante ?? "Sin proyecto"}</p>
        </div>
      </div>

      {!datos?.cierre?.puede_evaluar && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-700 mt-0.5" />
          <p className="text-sm text-yellow-700">{datos?.cierre?.motivo_bloqueo ?? "La evaluacion final aun no esta disponible."}</p>
        </div>
      )}

      <form onSubmit={enviarEvaluacion} className={`rounded-2xl border shadow-sm p-6 space-y-5 ${datos?.cierre?.puede_evaluar ? "bg-white border-gray-200" : "bg-amber-50/70 border-amber-300 border-l-4"}`}>
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Evaluacion final alumno a empresa</h3>
        </div>

        {!datos?.cierre?.puede_evaluar && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-100 p-3 text-sm font-semibold text-amber-800">
            <Lock className="h-4 w-4" /> Formulario inhabilitado hasta completar los requisitos indicados arriba.
          </div>
        )}

        <fieldset disabled={!datos?.cierre?.puede_evaluar} className="space-y-5 disabled:cursor-not-allowed">
        <label className="block">
          <span className="text-sm font-semibold text-gray-600">Calificacion general</span>
          <input type="number" min={0} max={100} value={calificacion} onChange={(e) => setCalificacion(Number(e.target.value))} className="mt-2 w-full border rounded-xl px-3 py-2 text-sm disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/70" />
        </label>

        {plantilla.preguntas.map((pregunta) => (
          <label key={pregunta.id} className="block">
            <span className="text-sm font-semibold text-gray-600">{pregunta.texto}</span>
            <select value={respuestas[pregunta.texto] ?? ""} onChange={(e) => setRespuestas({ ...respuestas, [pregunta.texto]: e.target.value })} className="mt-2 w-full border rounded-xl px-3 py-2 text-sm bg-white disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/70">
              <option value="">Selecciona una respuesta</option>
              {plantilla.respuestas.map((respuesta) => (
                <option key={respuesta}>{respuesta}</option>
              ))}
            </select>
          </label>
        ))}

        <div>
          <span className="text-sm font-semibold text-gray-600">
            Incidencias detectadas <span className="font-normal text-gray-400">(opcional)</span>
          </span>
          <p className="mt-1 text-xs text-gray-400">Si no detectaste ninguna incidencia, deja todas las opciones sin seleccionar.</p>
          <div className="grid md:grid-cols-2 gap-3 mt-2">
            {plantilla.incidencias_sugeridas.map((item) => (
              <label key={item} className="flex items-center gap-3 border rounded-xl p-3 text-sm has-[:disabled]:border-amber-200 has-[:disabled]:bg-amber-100/70 has-[:disabled]:text-amber-800">
                <input type="checkbox" checked={incidencias.includes(item)} onChange={() => setIncidencias(incidencias.includes(item) ? incidencias.filter((x) => x !== item) : [...incidencias, item])} />
                {item}
              </label>
            ))}
          </div>
        </div>

        <textarea value={comentarios} onChange={(e) => setComentarios(e.target.value)} rows={4} placeholder="Comentarios finales sobre la empresa..." className="w-full border rounded-xl p-3 text-sm disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/70" />

        <button disabled={!datos?.cierre?.puede_evaluar || guardando} className="bg-[#1565c0] text-white rounded-xl px-5 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
          <Send className="w-4 h-4" />
          {guardando ? "Guardando..." : "Enviar evaluacion"}
        </button>
        </fieldset>
      </form>

      <form onSubmit={enviarIncidencia} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-orange-600" />
          <h3 className="font-bold text-[#0d2b5e]">Registrar queja o incidencia</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <input value={tipoIncidencia} onChange={(e) => setTipoIncidencia(e.target.value)} className="border rounded-xl px-3 py-2 text-sm" placeholder="Tipo de incidencia" />
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value as PrioridadIncidencia)} className="border rounded-xl px-3 py-2 text-sm bg-white">
            <option>Baja</option>
            <option>Media</option>
            <option>Alta</option>
          </select>
        </div>
        <textarea
          value={descripcionIncidencia}
          onChange={(e) => {
            setDescripcionIncidencia(e.target.value);
            setConfirmandoIncidencia(false);
            setSegundosConfirmacion(0);
          }}
          required
          rows={4}
          className="w-full border rounded-xl p-3 text-sm"
          placeholder="Describe la situacion..."
        />
        {confirmandoIncidencia && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
            {segundosConfirmacion > 0
              ? `Espera ${segundosConfirmacion} segundo(s) para confirmar el envi?.`
              : "Confirma si realmente quieres enviar esta incidencia."}
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            disabled={guardando || !descripcionIncidencia.trim() || (confirmandoIncidencia && segundosConfirmacion > 0)}
            className="bg-orange-600 text-white rounded-xl px-5 py-2 text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <AlertTriangle className="w-4 h-4" />
            {guardando
              ? "Enviando..."
              : confirmandoIncidencia
                ? segundosConfirmacion > 0
                  ? `Confirmar en ${segundosConfirmacion}s`
                  : "Confirmar envi?"
                : "Registrar incidencia"}
          </button>
          {confirmandoIncidencia && (
            <button
              type="button"
              onClick={() => {
                setConfirmandoIncidencia(false);
                setSegundosConfirmacion(0);
              }}
              className="border border-gray-200 text-gray-600 rounded-xl px-5 py-2 text-sm font-semibold"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-[#0d2b5e] mb-4">Incidencias registradas</h3>
        <div className="space-y-3">
          {datos?.incidencias.map((item) => (
            <div key={item.id_incidencia} className="border rounded-xl p-4">
              <div className="flex justify-between gap-3">
                <p className="font-semibold text-[#0d2b5e]">{item.tipo_incidencia}</p>
                <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{item.estado}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{item.descripcion}</p>
              {item.respuesta_coordinacion && <p className="text-sm text-green-700 mt-2">Respuesta: {item.respuesta_coordinacion}</p>}
            </div>
          ))}
          {datos?.incidencias.length === 0 && <p className="text-sm text-gray-400">No hay incidencias registradas.</p>}
        </div>
      </div>

      {datos?.evaluacion_empresa && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-700 mt-0.5" />
          <p className="text-sm text-green-700">Evaluacion final enviada con calificacion {datos.evaluacion_empresa.calificacion}/100.</p>
        </div>
      )}
    </div>
  );
}
