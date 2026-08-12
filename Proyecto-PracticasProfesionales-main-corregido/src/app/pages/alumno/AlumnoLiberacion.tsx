import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Download, FileText, XCircle } from "lucide-react";
import { gestionLiberacionUseCase } from "../../dependencies";
import type { AlumnoLiberacion as AlumnoLiberacionData } from "../../../domain/coordinador/Liberacion";
import { getApiErrorMessage } from "../../../shared/utils/apiError";


type UsuarioSesion = { perfil?: { id_alumno?: number } };

const requisitoLabel: Record<string, string> = {
  expediente_aprobado: "Expediente aprobado",
  horas_completas: "Horas completas",
  reportes_aprobados: "Reportes aprobados",
  evaluacion_docente: "Evaluacion docente",
  evaluacion_empresa: "Evaluacion de empresa a alumno",
  evaluacion_alumno_empresa: "Tu evaluacion a la empresa",
  incidencias_cerradas: "Incidencias cerradas",
};

function obtenerIdAlumno() {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as UsuarioSesion).perfil?.id_alumno ?? null;
  } catch {
    return null;
  }
}

export function AlumnoLiberacion() {
  const [alumno, setAlumno] = useState<AlumnoLiberacionData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const idAlumno = obtenerIdAlumno();

  useEffect(() => {
    async function cargar() {
      if (!idAlumno) {
        setError("No se encontro el perfil de alumno en la sesion actual.");
        setCargando(false);
        return;
      }
      try {
        setError("");
        setCargando(true);
        const data = await gestionLiberacionUseCase.obtenerAlumno(idAlumno);
        setAlumno(data.alumno);
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar tu liberacion.");
      } finally {
        setCargando(false);
      }
    }
    void cargar();
  }, [idAlumno]);

  async function descargarLiberacion(idLiberacion: number) {
    try {
      setError("");
      const blob = await gestionLiberacionUseCase.descargarDocumento(idLiberacion);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo descargar la constancia."));
    }
  }

  if (cargando) {
    return <div className="bg-white rounded-2xl border p-10 text-center text-gray-500">Cargando liberacion...</div>;
  }

  if (!alumno) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
        <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-[#0d2b5e]">Aun no tienes asignacion activa</h1>
        <p className="text-sm text-gray-500 mt-2">{error || "Cuando tengas empresa asignada podras consultar aqui tu liberacion."}</p>
      </div>
    );
  }

  const estado = alumno.liberacion
    ? "Liberacion emitida"
    : alumno.listo_liberacion
      ? "Lista para liberacion"
      : "En proceso";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Mi Liberacion</h1>
        <p className="text-gray-500 text-sm mt-1">Consulta los requisitos finales de tus practicas profesionales.</p>
      </div>

      {error && <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">{error}</div>}

      <div className="bg-gradient-to-r from-[#0d2b5e] to-[#1565c0] rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="text-blue-200 text-sm">Estado final</div>
          <div className="font-bold text-xl mt-1">{estado}</div>
          <div className="text-blue-200 text-sm mt-1">{alumno.empresa} - {alumno.vacante}</div>
        </div>
        <span className={`px-4 py-2 rounded-xl font-bold text-sm ${alumno.liberacion ? "bg-green-100 text-green-700" : alumno.listo_liberacion ? "bg-yellow-100 text-yellow-700" : "bg-white/20 text-white"}`}>
          {alumno.estado_alumno}
        </span>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border p-5"><p className="text-sm text-gray-500">Horas</p><p className="text-2xl font-bold text-[#0d2b5e]">{alumno.horas_aprobadas}/{alumno.horas_meta}</p></div>
        <div className="bg-white rounded-2xl border p-5"><p className="text-sm text-gray-500">Reportes pendientes</p><p className="text-2xl font-bold text-[#0d2b5e]">{alumno.reportes_pendientes}</p></div>
        <div className="bg-white rounded-2xl border p-5"><p className="text-sm text-gray-500">Reportes rechazados</p><p className="text-2xl font-bold text-[#0d2b5e]">{alumno.reportes_rechazados}</p></div>
        <div className="bg-white rounded-2xl border p-5"><p className="text-sm text-gray-500">Incidencias abiertas</p><p className="text-2xl font-bold text-[#0d2b5e]">{alumno.incidencias_abiertas}</p></div>
      </div>

      {alumno.advertencia_regla && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {alumno.advertencia_regla}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-[#0d2b5e] mb-4">Requisitos de liberacion</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(alumno.requisitos).map(([clave, ok]) => (
            <div key={clave} className={`border rounded-xl px-3 py-3 flex items-center gap-2 ${ok ? "bg-green-50 border-green-100" : "bg-orange-50 border-orange-100"}`}>
              {ok ? <CheckCircle className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-orange-600" />}
              <span className={`text-sm ${ok ? "text-green-700" : "text-orange-700"}`}>{requisitoLabel[clave] ?? clave}</span>
            </div>
          ))}
        </div>
      </div>

      {alumno.liberacion ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="font-bold text-green-800">Liberacion emitida</h3>
              <p className="text-sm text-green-700 mt-1">Fecha: {alumno.liberacion.fecha_liberacion ?? "Sin fecha"}</p>
              <p className="text-sm text-green-700 mt-1">Documento: {alumno.liberacion.documento_nombre ?? "Sin archivo"}</p>
            </div>
            <button
              onClick={() => descargarLiberacion(alumno.liberacion!.id_liberacion)}
              disabled={!alumno.liberacion.documento_url}
              className={`rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-2 ${alumno.liberacion.documento_url ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500 pointer-events-none"}`}
            >
              <Download className="w-4 h-4" />
              Descargar constancia
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-700 mt-0.5" />
          <div>
            <h3 className="font-bold text-yellow-800">Aun no se emite tu liberacion</h3>
            <p className="text-sm text-yellow-700 mt-1">
              {alumno.listo_liberacion
                ? "Ya cumples los requisitos. Coordinacion debe emitir la liberacion."
                : `Faltan ${alumno.faltantes.length} requisito(s) para liberar tus practicas.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
