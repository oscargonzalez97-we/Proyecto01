import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  FileText,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import type { CoordUnidadesDashboardResponse } from "../../../domain/coord-unidades/CoordUnidadesDashboard";
import { obtenerDashboardCoordUnidades } from "../../../infrastructure/coord-unidades/coordUnidadesDashboardApi";

interface TarjetaResumen {
  label: string;
  description: string;
  value: number;
  icon: LucideIcon;
  iconClass: string;
  iconContainerClass: string;
  accentClass: string;
}

interface AccesoRapido {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  path: string;
  iconClass: string;
  iconContainerClass: string;
}

export function CoordUnidadesDashboard() {
  const navigate = useNavigate();

  const [datos, setDatos] =
    useState<CoordUnidadesDashboardResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void cargar();
  }, []);

  async function cargar() {
    try {
      setCargando(true);
      setError("");
      setDatos(await obtenerDashboardCoordUnidades());
    } catch (err) {
      console.error(err);
      setError(
        "No se pudo cargar la información de inicio. Intenta nuevamente.",
      );
    } finally {
      setCargando(false);
    }
  }

  const resumen = datos?.resumen;
  const pipeline = datos?.pipeline ?? [];
  const actividad = datos?.actividad ?? [];
  const alertas = datos?.alertas ?? [];

  const tarjetas: TarjetaResumen[] = [
    {
      label: "Solicitudes recibidas",
      description: "Empresas pendientes de revisión",
      value:
        resumen?.solicitudes_nuevas ??
        resumen?.empresas_pendientes ??
        0,
      icon: Building2,
      iconClass: "text-amber-700",
      iconContainerClass: "bg-amber-50 ring-amber-100",
      accentClass: "bg-amber-500",
    },
    {
      label: "Documentos pendientes",
      description: "Archivos por validar",
      value: resumen?.documentos_pendientes ?? 0,
      icon: FileText,
      iconClass: "text-blue-700",
      iconContainerClass: "bg-blue-50 ring-blue-100",
      accentClass: "bg-blue-600",
    },
    {
      label: "Vacantes en pre-padrón",
      description: "Pendientes de publicación",
      value: resumen?.vacantes_prepadron ?? 0,
      icon: BriefcaseBusiness,
      iconClass: "text-violet-700",
      iconContainerClass: "bg-violet-50 ring-violet-100",
      accentClass: "bg-violet-600",
    },
    {
      label: "Vacantes publicadas",
      description: "Disponibles para alumnos",
      value: resumen?.vacantes_activas ?? 0,
      icon: ClipboardList,
      iconClass: "text-emerald-700",
      iconContainerClass: "bg-emerald-50 ring-emerald-100",
      accentClass: "bg-emerald-600",
    },
  ];

  const accesosRapidos: AccesoRapido[] = [
    {
      title: "Revisar empresas",
      subtitle: "Solicitudes de registro",
      icon: Building2,
      path: "/coord-unidades/empresas",
      iconClass: "text-[#0d2b5e]",
      iconContainerClass: "bg-blue-50",
    },
    {
      title: "Expedientes",
      subtitle: "Documentación empresarial",
      icon: FileCheck2,
      path: "/coord-unidades/empresas/expediente",
      iconClass: "text-blue-700",
      iconContainerClass: "bg-blue-50",
    },
    {
      title: "Gestionar convenios",
      subtitle: "Vigencias y renovaciones",
      icon: ShieldCheck,
      path: "/coord-unidades/convenios",
      iconClass: "text-indigo-700",
      iconContainerClass: "bg-indigo-50",
    },
    {
      title: "Revisar vacantes",
      subtitle: "Planes de trabajo",
      icon: BriefcaseBusiness,
      path: "/coord-unidades/vacantes",
      iconClass: "text-violet-700",
      iconContainerClass: "bg-violet-50",
    },
    {
      title: "Padrón empresarial",
      subtitle: "Empresas en revisión y publicadas",
      icon: ClipboardList,
      path: "/coord-unidades/padron",
      iconClass: "text-emerald-700",
      iconContainerClass: "bg-emerald-50",
    },
  ];

  return (
    <div className="min-h-full bg-slate-50/70">
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Encabezado */}
        <section className="relative overflow-hidden rounded-3xl bg-[#0d2b5e] px-6 py-7 text-white shadow-sm sm:px-8 sm:py-8">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-28 right-28 h-56 w-56 rounded-full bg-[#d6a72c]/10" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15 sm:flex">
                <LayoutDashboard className="h-6 w-6 text-[#f0c85a]" />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                  Coordinación de Unidades Receptoras
                </p>

                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Panel de seguimiento
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100/80">
                  Supervisa solicitudes, documentación, convenios, vacantes y
                  publicación del padrón empresarial.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void cargar()}
              disabled={cargando}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`}
              />
              Actualizar información
            </button>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold">No fue posible cargar la información de inicio</p>
              <p className="mt-0.5 text-red-600">{error}</p>
            </div>

            <button
              type="button"
              onClick={() => void cargar()}
              className="shrink-0 font-semibold hover:underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Resumen */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {tarjetas.map((item) => (
            <article
              key={item.label}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div
                className={`absolute inset-x-0 top-0 h-1 ${item.accentClass}`}
              />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-600">
                    {item.label}
                  </p>

                  {cargando ? (
                    <div className="mt-3 h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
                  ) : (
                    <p className="mt-2 text-3xl font-bold tracking-tight text-[#0d2b5e]">
                      {item.value}
                    </p>
                  )}

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {item.description}
                  </p>
                </div>

                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${item.iconContainerClass}`}
                >
                  <item.icon className={`h-5 w-5 ${item.iconClass}`} />
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.75fr)]">
          {/* Flujo */}
          <article className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0d2b5e]">
                  Flujo de incorporación
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Estado actual del proceso de registro de empresas.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/coord-unidades/empresas")}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1565c0] transition hover:text-[#0d2b5e]"
              >
                Ver empresas
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              {cargando ? (
                <div className="space-y-5">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="flex gap-4">
                      <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-100" />
                      <div className="flex-1">
                        <div className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : pipeline.length > 0 ? (
                <div className="space-y-1">
                  {pipeline.map((item, index) => {
                    const esUltimo = index === pipeline.length - 1;

                    return (
                      <div
                        key={`${item.etapa}-${index}`}
                        className="relative flex gap-4"
                      >
                        {!esUltimo && (
                          <div className="absolute bottom-0 left-[21px] top-11 w-px bg-slate-200" />
                        )}

                        <div className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0d2b5e] text-sm font-bold text-white shadow-sm">
                          {index + 1}
                        </div>

                        <div className="mb-4 flex-1 rounded-2xl border border-slate-200 bg-slate-50/50 px-5 py-4 transition hover:border-blue-200 hover:bg-blue-50/30">
                          <div className="flex items-center justify-between gap-5">
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0d2b5e]">
                                {item.etapa}
                              </p>
                              <p className="mt-1 text-sm leading-5 text-slate-500">
                                {item.detalle}
                              </p>
                            </div>

                            <div className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-white px-3 text-lg font-bold text-[#0d2b5e] ring-1 ring-slate-200">
                              {item.cantidad}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Sin procesos pendientes"
                  description="No hay información registrada en el flujo de incorporación."
                />
              )}
            </div>
          </article>

          {/* Columna lateral */}
          <div className="space-y-6">
            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
                    <Bell className="h-4.5 w-4.5 text-[#1565c0]" />
                  </div>

                  <div>
                    <h2 className="font-bold text-[#0d2b5e]">
                      Actividad reciente
                    </h2>
                    <p className="text-xs text-slate-400">
                      Últimos movimientos registrados
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-[330px] space-y-2 overflow-y-auto p-4">
                {cargando ? (
                  [1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="h-20 animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))
                ) : actividad.length > 0 ? (
                  actividad.map((item) => (
                    <div
                      key={item.id_bitacora}
                      className="rounded-2xl border border-slate-100 px-4 py-3.5 transition hover:border-blue-100 hover:bg-blue-50/30"
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#d6a72c]" />

                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-5 text-slate-700">
                            {item.texto}
                          </p>

                          {item.detalle && (
                            <p className="mt-1 text-xs leading-5 text-slate-400">
                              {item.detalle}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={Bell}
                    title="Sin actividad"
                    description="Todavía no hay movimientos recientes."
                    compact
                  />
                )}
              </div>
            </article>

            <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50">
                  <AlertCircle className="h-4.5 w-4.5 text-amber-700" />
                </div>

                <div>
                  <h2 className="font-bold text-[#0d2b5e]">
                    Alertas pendientes
                  </h2>
                  <p className="text-xs text-slate-400">
                    Elementos que requieren atención
                  </p>
                </div>
              </div>

              <div className="space-y-2 p-4">
                {cargando ? (
                  [1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-16 animate-pulse rounded-2xl bg-slate-100"
                    />
                  ))
                ) : alertas.length > 0 ? (
                  alertas.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3.5"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <p className="text-sm leading-5 text-amber-900">
                        {item}
                      </p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={CheckCircle2}
                    title="Todo en orden"
                    description="No hay alertas pendientes."
                    compact
                  />
                )}
              </div>
            </article>
          </div>
        </section>

        {/* Accesos rápidos */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0d2b5e]">
                Accesos rápidos
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ingresa directamente a las principales funciones del módulo.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {accesosRapidos.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => navigate(item.path)}
                className="group flex min-h-36 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${item.iconContainerClass}`}
                  >
                    <item.icon className={`h-5 w-5 ${item.iconClass}`} />
                  </div>

                  <ArrowUpRight className="h-4 w-4 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1565c0]" />
                </div>

                <div className="mt-5">
                  <p className="font-bold text-[#0d2b5e]">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {item.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
}

function EmptyState({
  icon: Icon,
  title,
  description,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "px-4 py-8" : "px-6 py-14"
      }`}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100">
        <Icon className="h-5 w-5 text-slate-400" />
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-400">
        {description}
      </p>
    </div>
  );
}