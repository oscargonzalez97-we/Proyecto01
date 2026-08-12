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
  Database,
  Download,
  Eye,
  FileText,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

import type { DireccionIndicadoresResponse } from "../../../domain/direccion/DireccionIndicadores";
import {
  descargarDireccionPdf,
  obtenerIndicadoresDireccion,
} from "../../../infrastructure/direccion/direccionApi";

const COLORES_GRAFICAS = [
  "#1565c0",
  "#d4af37",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#7c3aed",
  "#64748b",
];

type Icono = ComponentType<{ className?: string }>;

function formatearNumero(valor: number | undefined | null) {
  return Number(valor ?? 0).toLocaleString("es-MX");
}

export function DireccionDashboard() {
  const [datos, setDatos] = useState<DireccionIndicadoresResponse | null>(null);
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
      await descargarDireccionPdf();
    } catch (err) {
      console.error({
        endpoint: "/direccion/reportes/exportar",
        error: err,
      });
      setError("No se pudo generar el PDF de Dirección.");
    } finally {
      setExportando(false);
    }
  }

  const resumen = datos?.resumen;

  const alumnosTotal = resumen?.alumnos ?? 0;
  const alumnosAsignados = resumen?.alumnos_asignados ?? 0;
  const avanceGeneral = alumnosTotal > 0 ? Math.round((alumnosAsignados / alumnosTotal) * 100) : 0;

  const estadoData = useMemo(
    () =>
      (datos?.alumnos_por_estado ?? []).map((item, index) => ({
        name: item.nombre || "Sin estado",
        value: item.total ?? 0,
        color: COLORES_GRAFICAS[index % COLORES_GRAFICAS.length],
      })),
    [datos],
  );

  const alumnosPorCarrera = useMemo(() => datos?.alumnos_por_carrera ?? [], [datos]);
  const horasPorMes = useMemo(() => datos?.horas_por_mes ?? [], [datos]);
  const conveniosData = useMemo(() => datos?.convenios_por_estado ?? [], [datos]);

  const totalConvenios = useMemo(
    () => conveniosData.reduce((acc, item) => acc + (item.total ?? 0), 0),
    [conveniosData],
  );

  const puedeExportar = Boolean(datos) && !cargando && !error && !exportando;

  const tarjetas: Array<{
    titulo: string;
    valor: string | number;
    detalle: string;
    icono: Icono;
    tono: "blue" | "green" | "amber" | "violet" | "slate";
  }> = [
    {
      titulo: "Alumnos registrados",
      valor: formatearNumero(resumen?.alumnos),
      detalle: "Total institucional",
      icono: Users,
      tono: "blue",
    },
    {
      titulo: "En proceso",
      valor: formatearNumero(resumen?.alumnos_en_proceso),
      detalle: "Alumnos activos",
      icono: Clock,
      tono: "amber",
    },
    {
      titulo: "Empresas activas",
      valor: formatearNumero(resumen?.empresas_activas),
      detalle: "Unidades receptoras",
      icono: Building2,
      tono: "green",
    },
    {
      titulo: "Convenios vigentes",
      valor: formatearNumero(resumen?.convenios_vigentes),
      detalle: "Convenios activos",
      icono: FileText,
      tono: "violet",
    },
    {
      titulo: "Avance de asignación",
      valor: `${avanceGeneral}%`,
      detalle: `${formatearNumero(alumnosAsignados)} asignados`,
      icono: TrendingUp,
      tono: "slate",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d2b5e] via-[#123d7a] to-[#1565c0] text-white shadow-lg">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 left-20 h-56 w-56 rounded-full bg-[#d4af37]/20" />

        <div className="relative p-6 lg:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                <Eye className="h-3.5 w-3.5" />
                Resumen de prácticas profesionales
              </div>

              <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
                Inicio de Dirección
              </h1>

              <p className="mt-2 text-sm leading-6 text-blue-100">
                Avance general del programa para Dirección y Secretaría. Aquí se visualizan indicadores
                generales de alumnos, empresas, convenios y avance institucional.
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs text-blue-100">
                <span className="rounded-full bg-white/10 px-3 py-1">
                  Actualizado: {datos?.contexto?.fecha_actualizacion ?? "Sin actualizar"}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1">
                  Solo lectura
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void cargar()}
                disabled={cargando}
                className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
                Actualizar
              </button>

              <button
                onClick={() => void exportarPdf()}
                disabled={!puedeExportar}
                className="inline-flex items-center gap-2 rounded-xl bg-[#d4af37] px-4 py-2 text-xs font-bold text-[#0d2b5e] shadow-sm transition hover:bg-[#e2bf4a] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exportando ? "Generando..." : "Exportar PDF"}
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-blue-100">
                    Avance general de asignación
                  </p>
                  <p className="mt-2 text-4xl font-black">{avanceGeneral}%</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <TrendingUp className="h-8 w-8 text-[#d4af37]" />
                </div>
              </div>

              <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[#d4af37] transition-all"
                  style={{ width: `${Math.min(100, avanceGeneral)}%` }}
                />
              </div>

              <p className="mt-3 text-xs text-blue-100">
                {formatearNumero(alumnosAsignados)} de {formatearNumero(alumnosTotal)} alumnos
                cuentan con asignación registrada.
              </p>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm font-semibold text-blue-100">Seguimientos prioritarios</p>

              <div className="mt-4 space-y-3">
                <MiniIndicador
                  label="Convenios por vencer"
                  value={resumen?.convenios_por_vencer ?? 0}
                  icono={AlertTriangle}
                />
                <MiniIndicador
                  label="Alumnos sin asignación"
                  value={resumen?.alumnos_sin_asignacion ?? 0}
                  icono={Clock}
                />
                <MiniIndicador
                  label="Vacantes publicadas"
                  value={resumen?.vacantes_publicadas ?? 0}
                  icono={CheckCircle2}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tarjetas.map((tarjeta) => (
          <KpiCard key={tarjeta.titulo} {...tarjeta} cargando={cargando} />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Alumnos por carrera"
          subtitle="Distribución institucional por programa académico."
        >
          {cargando ? (
            <SkeletonChart />
          ) : alumnosPorCarrera.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={alumnosPorCarrera} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis
                  type="category"
                  dataKey="carrera"
                  width={150}
                  tick={{ fontSize: 11, fill: "#475569" }}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatearNumero(Number(value)), "Alumnos"]}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e5e7eb",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="alumnos" fill="#1565c0" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState text="No hay alumnos por carrera para mostrar." />
          )}
        </ChartCard>

        <ChartCard
          title="Estado general de alumnos"
          subtitle="Situación actual del proceso de prácticas."
        >
          {cargando ? (
            <SkeletonChart />
          ) : estadoData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={estadoData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={52}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {estadoData.map((item, index) => (
                      <Cell key={`${item.name}-${index}`} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: unknown) => [formatearNumero(Number(value)), "Total"]}
                    contentStyle={{
                      borderRadius: 12,
                      borderColor: "#e5e7eb",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {estadoData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-[#0d2b5e]">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState text="No hay estados de alumnos para mostrar." />
          )}
        </ChartCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Horas registradas por mes"
          subtitle="Tendencia mensual de horas reportadas."
        >
          {cargando ? (
            <SkeletonChart />
          ) : horasPorMes.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={horasPorMes} margin={{ left: 5, right: 20, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip
                  formatter={(value: unknown) => [`${formatearNumero(Number(value))} hrs`, "Horas"]}
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "#e5e7eb",
                    fontSize: 12,
                  }}
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

        <ChartCard
          title="Estado de convenios"
          subtitle="Seguimiento institucional de convenios."
          footer={
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 h-5 w-5 text-gray-500" />
                <p className="text-xs leading-5 text-gray-500">
                  Esta vista consulta indicadores reales y no modifica registros del sistema.
                </p>
              </div>
            </div>
          }
        >
          {cargando ? (
            <div className="space-y-4">
              <SkeletonLine />
              <SkeletonLine />
              <SkeletonLine />
            </div>
          ) : conveniosData.length > 0 ? (
            <div className="space-y-5">
              {conveniosData.map((convenio, index) => {
                const porcentaje =
                  totalConvenios > 0 ? Math.round(((convenio.total ?? 0) / totalConvenios) * 100) : 0;

                return (
                  <div key={convenio.nombre || index}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: COLORES_GRAFICAS[index % COLORES_GRAFICAS.length],
                          }}
                        />
                        <span className="font-medium text-gray-700">
                          {convenio.nombre || "Sin estado"}
                        </span>
                      </div>

                      <span className="font-bold text-[#0d2b5e]">
                        {formatearNumero(convenio.total)}
                      </span>
                    </div>

                    <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, porcentaje)}%`,
                          backgroundColor: COLORES_GRAFICAS[index % COLORES_GRAFICAS.length],
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
  tono: "blue" | "green" | "amber" | "violet" | "slate";
  cargando: boolean;
}) {
  const estilos = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    green: "bg-green-50 text-green-700 border-green-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
  };

  return (
    <div className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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

function MiniIndicador({
  label,
  value,
  icono: Icono,
}: {
  label: string;
  value: number;
  icono: Icono;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/10 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icono className="h-4 w-4 text-[#d4af37]" />
        <span className="text-xs text-blue-100">{label}</span>
      </div>

      <span className="text-sm font-black text-white">{formatearNumero(value)}</span>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h3 className="text-base font-bold text-[#0d2b5e]">{title}</h3>
        {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
      </div>

      {children}

      {footer && <div className="mt-5">{footer}</div>}
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