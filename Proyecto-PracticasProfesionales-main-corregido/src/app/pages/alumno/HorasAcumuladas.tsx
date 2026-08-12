import { useEffect, useMemo, useState } from "react";
import { Calendar, Clock, Lock, Plus, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { gestionHorasAlumnoUseCase } from "../../dependencies";
import type { HorasAlumnoResponse } from "../../../domain/alumno/HorasAlumno";
import { getApiErrorMessage } from "../../../shared/utils/apiError";

function obtenerIdAlumnoSesion(): number | null {
  const usuario = sessionStorage.getItem("usuario");
  if (!usuario) return null;
  try {
    const sesion = JSON.parse(usuario);
    const idAlumno = sesion?.perfil?.id_alumno;
    return typeof idAlumno === "number" ? idAlumno : null;
  } catch {
    return null;
  }
}

function estadoClass(estado: string) {
  if (estado === "Aprobada") return "bg-green-100 text-green-700";
  if (estado === "Rechazada") return "bg-red-100 text-red-700";
  return "bg-yellow-100 text-yellow-700";
}

export function HorasAcumuladas() {
  const [data, setData] = useState<HorasAlumnoResponse | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState("8");
  const [actividad, setActividad] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const idAlumno = obtenerIdAlumnoSesion();

  useEffect(() => {
    void cargarHoras();
  }, [idAlumno]); // eslint-disable-line react-hooks/exhaustive-deps -- cargarHoras only reads the current student id.

  async function cargarHoras() {
    if (!idAlumno) {
      setError("No se encontro el perfil de alumno en la sesion actual.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const response = await gestionHorasAlumnoUseCase.listar(idAlumno);
      setData(response);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar tus horas.");
    } finally {
      setCargando(false);
    }
  }

  async function registrarHoras() {
    if (!idAlumno) return;
    if (!actividad.trim()) {
      alert("Describe la actividad realizada.");
      return;
    }

    try {
      setGuardando(true);
      await gestionHorasAlumnoUseCase.crear(idAlumno, {
        fecha,
        horas_realizadas: Number(horas),
        actividad,
      });
      setActividad("");
      setHoras("8");
      await cargarHoras();
    } catch (err: unknown) {
      console.error(err);
      alert(getApiErrorMessage(err, "No se pudo registrar la actividad."));
    } finally {
      setGuardando(false);
    }
  }

  const resumen = data?.resumen ?? {
    total_meta: 0,
    aprobadas: 0,
    pendientes: 0,
    rechazadas: 0,
    progreso: 0,
    origen_regla: "sin_configurar" as const,
    advertencia_regla: null,
  };

  const restantes = Math.max(resumen.total_meta - resumen.aprobadas, 0);

  const semanas = useMemo(() => data?.semanas ?? [], [data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Horas Acumuladas</h1>
        <p className="text-gray-500 text-sm mt-1">
          Registra actividades y consulta el avance validado por tu unidad receptora.
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      {resumen.advertencia_regla && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {resumen.advertencia_regla}
        </div>
      )}

      <div className="bg-[#0d2b5e] rounded-2xl p-6 text-white">
        <h2 className="text-lg font-bold">
          {data?.asignacion?.empresa ?? "Sin asignacion activa"}
        </h2>
        <p className="text-blue-100 text-sm mt-1">
          {data?.asignacion?.vacante ?? "Necesitas una asignacion activa para registrar horas."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
        {[
          { v: resumen.aprobadas, l: "Horas aprobadas", I: Clock, bg: "bg-[#e3f0ff]", tc: "text-[#1565c0]", vc: "text-[#0d2b5e]" },
          { v: resumen.pendientes, l: "Pendientes", I: Calendar, bg: "bg-yellow-50", tc: "text-yellow-600", vc: "text-yellow-600" },
          { v: restantes, l: "Horas restantes", I: TrendingUp, bg: "bg-orange-50", tc: "text-orange-500", vc: "text-orange-600" },
          { v: `${resumen.progreso}%`, l: "Progreso", I: Calendar, bg: "bg-green-50", tc: "text-green-600", vc: "text-green-600" },
        ].map((item) => (
          <div key={item.l} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 text-center">
            <div className="w-12 h-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center mx-auto mb-3">
              <item.I className="w-6 h-6 text-gray-600" />
            </div>
            <div className="text-3xl font-bold text-[#0d2b5e]">
              {cargando ? "..." : item.v}
            </div>
            <div className="text-gray-500 text-sm mt-1">{item.l}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[#0d2b5e]">Progreso Total</h3>
          <span className="text-sm text-gray-500">
            {resumen.aprobadas}/{resumen.total_meta} horas aprobadas
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
          <div
            className="bg-gradient-to-r from-[#1565c0] to-[#1976d2] h-6 rounded-full flex items-center justify-end pr-3"
            style={{ width: `${Math.min(resumen.progreso, 100)}%` }}
          >
            <span className="text-white text-xs font-bold">{resumen.progreso}%</span>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm p-6 ${data?.asignacion ? "bg-white border-gray-200" : "bg-amber-50 border-amber-300 border-l-4"}`}>
        <h3 className="font-bold text-[#0d2b5e] mb-1">Registrar actividad</h3>
        {!data?.asignacion && (
          <p className="mb-4 flex items-center gap-2 text-sm font-medium text-amber-800">
            <Lock className="h-4 w-4" /> Esta seccion se habilitara cuando tengas una empresa asignada.
          </p>
        )}
        <div className="grid md:grid-cols-[160px_120px_1fr_auto] gap-3">
          <input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="border rounded-xl px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/70 disabled:text-amber-800"
            disabled={!data?.asignacion}
          />
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={horas}
            onChange={(event) => setHoras(event.target.value)}
            className="border rounded-xl px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/70 disabled:text-amber-800"
            disabled={!data?.asignacion}
          />
          <input
            value={actividad}
            onChange={(event) => setActividad(event.target.value)}
            className="border rounded-xl px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:border-amber-200 disabled:bg-amber-100/70 disabled:text-amber-800"
            placeholder="Actividad realizada..."
            disabled={!data?.asignacion}
          />
          <button
            onClick={registrarHoras}
            disabled={guardando || !data?.asignacion}
            className="bg-[#1565c0] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-amber-200 disabled:text-amber-800"
          >
            <Plus className="w-4 h-4" />
            {guardando ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-bold text-[#0d2b5e] mb-5">Horas por Semana</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={semanas}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="semana" tick={{ fontSize: 12, fill: "#9ca3af" }} />
            <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb" }} />
            <Bar dataKey="horas" fill="#1565c0" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-[#0d2b5e]">Registro de Actividades</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {(data?.horas ?? []).map((registro) => (
            <div key={registro.id_horas} className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-gray-800">{registro.actividad}</div>
                <div className="text-xs text-gray-400 mt-1">{registro.fecha}</div>
                {registro.observaciones && (
                  <div className="text-xs text-red-600 mt-1">{registro.observaciones}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${estadoClass(registro.estado_horas)}`}>
                  {registro.estado_horas}
                </span>
                <div className="bg-[#e3f0ff] text-[#1565c0] text-sm font-bold px-4 py-1.5 rounded-xl">
                  {registro.horas_realizadas} hrs
                </div>
              </div>
            </div>
          ))}

          {!cargando && (data?.horas ?? []).length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              Aun no hay actividades registradas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
