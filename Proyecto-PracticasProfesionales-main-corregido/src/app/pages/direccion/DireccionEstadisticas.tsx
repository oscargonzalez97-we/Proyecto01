import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FilterX,
  Gauge,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

import type { DireccionIndicadoresResponse } from "../../../domain/direccion/DireccionIndicadores";
import {
  descargarDireccionPdf,
  obtenerIndicadoresDireccion,
} from "../../../infrastructure/direccion/direccionApi";

const COLORES = ["#1565c0", "#d4af37", "#22c55e", "#f97316", "#ef4444", "#7c3aed", "#64748b"];

type Icono = ComponentType<{ className?: string }>;

function numero(valor: number | undefined | null) {
  return Number(valor ?? 0).toLocaleString("es-MX");
}

export function DireccionEstadisticas() {
  const [datos, setDatos] = useState<DireccionIndicadoresResponse | null>(null);
  const [carrera, setCarrera] = useState("Todas");
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      setError("");
      setDatos(await obtenerIndicadoresDireccion());
    } catch (err) {
      console.error({
        endpoint: "/direccion/indicadores",
        error: err,
      });
      setError("No se pudieron cargar los datos de Dirección.");
    } finally {
      setCargando(false);
    }
  }

  async function exportarPdf() {
    try {
      setExportando(true);
      setError("");
      await descargarDireccionPdf({
        carrera: carrera === "Todas" ? "todos" : carrera,
      });
    } catch (err) {
      console.error({
        endpoint: "/direccion/reportes/exportar",
        error: err,
      });
      setError("No se pudo generar el PDF de estadísticas de Dirección.");
    } finally {
      setExportando(false);
    }
  }

  const resumen = datos?.resumen;

  const carreras = useMemo(
    () => ["Todas", ...new Set((datos?.alumnos_por_carrera ?? []).map((item) => item.carrera))],
    [datos],
  );

  const alumnosCarrera = useMemo(
    () =>
      (datos?.alumnos_por_carrera ?? []).filter(
        (item) => carrera === "Todas" || item.carrera === carrera,
      ),
    [datos, carrera],
  );

  const totalAlumnosCarrera = useMemo(
    () => alumnosCarrera.reduce((acc, item) => acc + (item.alumnos ?? 0), 0),
    [alumnosCarrera],
  );

  const carreraMayorParticipacion = useMemo(() => {
    const ordenadas = [...alumnosCarrera].sort((a, b) => (b.alumnos ?? 0) - (a.alumnos ?? 0));
    return ordenadas[0];
  }, [alumnosCarrera]);

  const vacantes = useMemo(
    () =>
      (datos?.vacantes_por_estado ?? []).map((item, index) => ({
        name: item.nombre || "Sin estado",
        value: item.total ?? 0,
        color: COLORES[index % COLORES.length],
      })),
    [datos],
  );

  const convenios = useMemo(() => datos?.convenios_por_estado ?? [], [datos]);

  const totalConvenios = useMemo(
    () => convenios.reduce((acc, item) => acc + (item.total ?? 0), 0),
    [convenios],
  );

  const horasPorMes = useMemo(() => datos?.horas_por_mes ?? [], [datos]);
  const totalHoras = useMemo(
    () => horasPorMes.reduce((acc, item) => acc + (item.horas ?? 0), 0),
    [horasPorMes],
  );

  const alumnos = resumen?.alumnos ?? 0;
  const asignados = resumen?.alumnos_asignados ?? 0;
  const sinAsignacion = resumen?.alumnos_sin_asignacion ?? 0;
  const avance = alumnos > 0 ? Math.round((asignados / alumnos) * 100) : 0;

  const puedeExportar = Boolean(datos) && !cargando && !error && !exportando;

  const kpis: Array<{
    titulo: string;
    valor: string | number;
    detalle: string;
    icono: Icono;
    tono: "blue" | "green" | "amber" | "red" | "violet" | "slate";
  }> = [
    {
      titulo: "Total alumnos",
      valor: numero(resumen?.alumnos),
      detalle: "Registrados en el sistema",
      icono: Users,
      tono: "blue",
    },
    {
      titulo: "En proceso",
      valor: numero(resumen?.alumnos_en_proceso),
      detalle: "Con trámite activo",
      icono: Clock,
      tono: "amber",
    },
    {
      titulo: "Asignados",
      valor: numero(resumen?.alumnos_asignados),
      detalle: "Con empresa asignada",
      icono: CheckCircle2,
      tono: "green",
    },
    {
      titulo: "Sin asignación",
      valor: numero(resumen?.alumnos_sin_asignacion),
      detalle: "Requieren seguimiento",
      icono: AlertTriangle,
      tono: "red",
    },
    {
      titulo: "Avance",
      valor: `${avance}%`,
      detalle: "Asignación institucional",
      icono: Gauge,
      tono: "violet",
    },
    {
      titulo: "Empresas activas",
      valor: numero(resumen?.empresas_activas),
      detalle: "Unidades receptoras",
      icono: Building2,
      tono: "blue",
    },
    {
      titulo: "Convenios vigentes",
      valor: numero(resumen?.convenios_vigentes),
      detalle: "Convenios activos",
      icono: FileText,
      tono: "green",
    },
    {
      titulo: "Por vencer",
      valor: numero(resumen?.convenios_por_vencer),
      detalle: "Convenios en alerta",
      icono: AlertTriangle,
      tono: "amber",
    },
    {
      titulo: "Vacantes publicadas",
      valor: numero(resumen?.vacantes_publicadas),
      detalle: "Disponibles en padrón",
      icono: CheckCircle2,
      tono: "slate",
    },
    {
      titulo: "Incidencias abiertas",
      valor: numero(resumen?.incidencias_abiertas),
      detalle: "Pendientes de atención",
      icono: AlertTriangle,
      tono: "red",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#1565c0]">
              <TrendingUp className="h-3.5 w-3.5" />
              Análisis institucional
            </div>

            <h1 className="text-2xl font-black tracking-tight text-[#0d2b5e] lg:text-3xl">
              Estadísticas Detalladas de Dirección
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              Avance general del programa de prácticas profesionales por carrera, asignación,
              convenios, vacantes, incidencias y convocatorias.
            </p>

            <p className="mt-3 text-xs text-gray-400">
              Actualizado: {datos?.contexto?.fecha_actualizacion ?? "Sin actualizar"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void cargar()}
              disabled={cargando}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-bold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
              Actualizar
            </button>

            <button
              onClick={() => void exportarPdf()}
              disabled={!puedeExportar}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0d2b5e] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#1565c0] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              {exportando ? "Generando..." : "Exportar PDF"}
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-gray-400">
              Filtrar por carrera
            </label>

            <select
              value={carrera}
              onChange={(e) => setCarrera(e.target.value)}
              disabled={cargando}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-[#1565c0] focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carreras.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setCarrera("Todas")}
            disabled={carrera === "Todas" || cargando}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FilterX className="h-4 w-4" />
            Limpiar filtro
          </button>

          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm">
            <p className="text-xs text-gray-400">Filtro actual</p>
            <p className="font-bold text-[#0d2b5e]">{carrera}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <KpiCard key={item.titulo} {...item} cargando={cargando} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ExecutiveCard
          title="Avance de asignación"
          value={`${avance}%`}
          description={`${numero(asignados)} de ${numero(alumnos)} alumnos cuentan con asignación.`}
          icono={Gauge}
          color="blue"
        >
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-blue-100">
            <div
              className="h-full rounded-full bg-[#1565c0] transition-all"
              style={{ width: `${Math.min(100, avance)}%` }}
            />
          </div>
        </ExecutiveCard>

        <ExecutiveCard
          title="Carrera con mayor participación"
          value={carreraMayorParticipacion?.carrera ?? "Sin datos"}
          description={`${numero(carreraMayorParticipacion?.alumnos)} alumnos registrados en el filtro actual.`}
          icono={Users}
          color="gold"
        />

        <ExecutiveCard
          title="Seguimiento requerido"
          value={numero(sinAsignacion)}
          description="Alumnos sin asignación registrada dentro del proceso."
          icono={AlertTriangle}
          color={sinAsignacion > 0 ? "red" : "green"}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Alumnos por carrera" subtitle="Comparativo de alumnos registrados por carrera.">
          {cargando ? (
            <SkeletonChart />
          ) : alumnosCarrera.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={alumnosCarrera} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="carrera" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value: unknown) => [numero(Number(value)), "Alumnos"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb", fontSize: 12 }}
                />
                <Bar dataKey="alumnos" fill="#1565c0" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No hay alumnos por carrera para mostrar." />
          )}
        </ChartCard>

        <ChartCard title="Vacantes por estado" subtitle="Distribución de vacantes según su situación actual.">
          {cargando ? (
            <SkeletonChart />
          ) : vacantes.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={vacantes}
                    cx="50%"
                    cy="50%"
                    outerRadius={88}
                    innerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {vacantes.map((item, index) => (
                      <Cell key={`${item.name}-${index}`} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => [numero(Number(value)), "Vacantes"]}
                    contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb", fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <Legend data={vacantes} />
            </>
          ) : (
            <EmptyState text="No hay vacantes para mostrar." />
          )}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Horas por mes" subtitle={`Total acumulado: ${numero(totalHoras)} horas.`}>
          {cargando ? (
            <SkeletonChart />
          ) : horasPorMes.length > 0 ? (
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={horasPorMes} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value: unknown) => [`${numero(Number(value))} hrs`, "Horas"]}
                  contentStyle={{ borderRadius: 12, borderColor: "#e5e7eb", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="horas"
                  stroke="#1565c0"
                  strokeWidth={3}
                  dot={{ fill: "#1565c0", r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No hay horas registradas por mes." />
          )}
        </ChartCard>

        <ChartCard title="Convenios por estado" subtitle={`Total registrado: ${numero(totalConvenios)} convenios.`}>
          {cargando ? (
            <div className="space-y-4">
              <SkeletonLine />
              <SkeletonLine />
              <SkeletonLine />
            </div>
          ) : convenios.length > 0 ? (
            <div className="space-y-5">
              {convenios.map((item, index) => {
                const porcentaje =
                  totalConvenios > 0 ? Math.round(((item.total ?? 0) / totalConvenios) * 100) : 0;

                return (
                  <div key={item.nombre || index}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">{item.nombre || "Sin estado"}</span>
                      <span className="font-bold text-[#0d2b5e]">{numero(item.total)}</span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, porcentaje)}%`,
                          backgroundColor: COLORES[index % COLORES.length],
                        }}
                      />
                    </div>

                    <p className="mt-1 text-right text-[11px] text-gray-400">{porcentaje}%</p>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState text="No hay convenios para mostrar." />
          )}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <TableCard title="Resumen por carrera" subtitle="Detalle del filtro institucional seleccionado.">
          {cargando ? (
            <TableSkeleton />
          ) : alumnosCarrera.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Carrera</th>
                  <th className="px-4 py-3 text-right">Alumnos</th>
                  <th className="px-4 py-3 text-right">Participación</th>
                </tr>
              </thead>
              <tbody>
                {alumnosCarrera.map((row) => {
                  const porcentaje =
                    totalAlumnosCarrera > 0 ? Math.round(((row.alumnos ?? 0) / totalAlumnosCarrera) * 100) : 0;

                  return (
                    <tr key={row.carrera} className="border-b last:border-0">
                      <td className="px-4 py-3 font-semibold text-[#0d2b5e]">{row.carrera}</td>
                      <td className="px-4 py-3 text-right text-gray-700">{numero(row.alumnos)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#1565c0]">{porcentaje}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <EmptyTable text="No hay carreras para mostrar." />
          )}
        </TableCard>

        <TableCard title="Convocatorias registradas" subtitle="Seguimiento general por convocatoria.">
          {cargando ? (
            <TableSkeleton />
          ) : (datos?.convocatorias ?? []).length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Convocatoria</th>
                  <th className="px-4 py-3">Periodo</th>
                  <th className="px-4 py-3 text-right">Alumnos</th>
                  <th className="px-4 py-3 text-right">Empresas</th>
                  <th className="px-4 py-3 text-right">Incidencias</th>
                </tr>
              </thead>
              <tbody>
                {(datos?.convocatorias ?? []).map((row) => (
                  <tr key={`${row.convocatoria}-${row.periodo}`} className="border-b last:border-0">
                    <td className="px-4 py-3 font-semibold text-[#0d2b5e]">{row.convocatoria}</td>
                    <td className="px-4 py-3 text-gray-600">{row.periodo}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{numero(row.alumnos)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{numero(row.empresas)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{numero(row.incidencias)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyTable text="No hay convocatorias registradas." />
          )}
        </TableCard>
      </section>
    </div>
  );
}

function KpiCard({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono,
  cargando,
}: {
  titulo: string;
  valor: string | number;
  detalle: string;
  icono: Icono;
  tono: "blue" | "green" | "amber" | "red" | "violet" | "slate";
  cargando: boolean;
}) {
  const estilos = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    red: "bg-red-50 text-red-700 border-red-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          {cargando ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
          ) : (
            <p className="text-2xl font-black text-[#0d2b5e]">{valor}</p>
          )}
          <p className="mt-1 text-sm font-semibold text-gray-700">{titulo}</p>
          <p className="mt-1 text-xs text-gray-400">{detalle}</p>
        </div>

        <div className={`rounded-2xl border p-3 ${estilos[tono]}`}>
          <Icono className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ExecutiveCard({
  title,
  value,
  description,
  icono: Icono,
  color,
  children,
}: {
  title: string;
  value: string | number;
  description: string;
  icono: Icono;
  color: "blue" | "gold" | "red" | "green";
  children?: ReactNode;
}) {
  const estilos = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    gold: "bg-yellow-50 text-yellow-700 border-yellow-100",
    red: "bg-red-50 text-red-700 border-red-100",
    green: "bg-green-50 text-green-700 border-green-100",
  };

  return (
    <div className={`rounded-3xl border p-5 ${estilos[color]}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold">{title}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
          <p className="mt-2 text-xs opacity-80">{description}</p>
        </div>

        <Icono className="h-6 w-6 opacity-80" />
      </div>

      {children}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-bold text-[#0d2b5e]">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function TableCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-5">
        <h3 className="font-bold text-[#0d2b5e]">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function Legend({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {data.map((item) => (
        <div
          key={item.name}
          className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-gray-600">{item.name}</span>
          </div>
          <span className="text-xs font-bold text-[#0d2b5e]">{numero(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function EmptyTable({ text }: { text: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center px-6 py-10 text-center">
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="flex h-[260px] items-end gap-3 rounded-2xl bg-gray-50 p-5">
      {[55, 75, 45, 90, 62, 35].map((height, index) => (
        <div
          key={index}
          className="flex-1 animate-pulse rounded-t-xl bg-gray-200"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function SkeletonLine() {
  return (
    <div className="space-y-2">
      <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
      <div className="h-3 w-full animate-pulse rounded-full bg-gray-100" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3 p-5">
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine />
      <SkeletonLine />
    </div>
  );
}