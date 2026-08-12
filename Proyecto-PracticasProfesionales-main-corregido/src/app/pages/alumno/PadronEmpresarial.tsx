import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  Mail,
  MapPin,
  Phone,
  Save,
  Search,
  X,
} from "lucide-react";

import { gestionPadronUseCase } from "../../dependencies";
import type {
  EmpresaAsignadaAlumno,
  SeleccionEmpresaAlumno,
  VacantePadron,
} from "../../../domain/alumno/Padron";
import { getApiErrorMessage } from "../../../shared/utils/apiError";

type EmpresaGrupo = {
  id_empresa: number;
  nombre: string;
  giro: string | null;
  domicilio: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  vacantes: VacantePadron[];
};

type ElegibilidadAcademica = {
  alumno?: {
    semestre: number | null;
    creditos_aprobados: number;
    periodo_practica?: string;
  };
  tipo_practica?: {
    nombre: string;
    semestre_requerido: number | null;
    creditos_minimos: number | null;
    horas_requeridas?: number | null;
    orden: number | null;
  } | null;
  regla_practica?: {
    periodo_requerido: number;
    creditos_minimos: number;
    horas_requeridas: number;
    origen_regla: "regla_practica_carrera" | "tipo_practica" | "sin_configurar";
    advertencia_regla?: string | null;
  } | null;
};

function obtenerIdAlumnoSesion() {
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

function cuposDisponibles(vacante: VacantePadron) {
  return Math.max(vacante.cupos - vacante.cupos_usados, 0);
}

export function PadronEmpresarial() {
  const [vacantes, setVacantes] = useState<VacantePadron[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<number[]>([]);
  const [solicitudes, setSolicitudes] = useState<SeleccionEmpresaAlumno[]>([]);
  const [detalle, setDetalle] = useState<EmpresaGrupo | null>(null);
  const [puedeSeleccionar, setPuedeSeleccionar] = useState(false);
  const [motivoBloqueo, setMotivoBloqueo] = useState<string | null>(null);
  const [elegibilidad, setElegibilidad] = useState<ElegibilidadAcademica | null>(null);
  const [estadoExpediente, setEstadoExpediente] = useState<string | null>(null);
  const [hayPadronPublicado, setHayPadronPublicado] = useState(false);
  const [empresaAsignada, setEmpresaAsignada] = useState<EmpresaAsignadaAlumno | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const requisitoPractica = elegibilidad?.regla_practica;

  useEffect(() => {
    void cargarPadron();
  }, []);

  async function cargarPadron() {
    const idAlumno = obtenerIdAlumnoSesion();
    if (!idAlumno) {
      setError("No se encontro el perfil de alumno en la sesion actual.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const data = await gestionPadronUseCase.obtener(idAlumno);
      setPuedeSeleccionar(data.puede_seleccionar);
      setMotivoBloqueo(data.motivo_bloqueo);
      setElegibilidad({
        alumno: data.alumno,
        tipo_practica: data.tipo_practica,
        regla_practica: data.regla_practica,
      });
      setEstadoExpediente(data.estado_expediente);
      setHayPadronPublicado(data.hay_padron_publicado);
      setEmpresaAsignada(data.empresa_asignada);
      setVacantes(data.vacantes);
      setSolicitudes(data.selecciones);
      const ordenadas = [...data.selecciones]
        .filter((seleccion) => seleccion.estado_seleccion !== "Rechazada" && seleccion.id_vacante)
        .sort((a, b) => a.prioridad - b.prioridad)
        .map((seleccion) => seleccion.id_vacante as number);
      setSeleccionadas(ordenadas);
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo cargar el padron empresarial."));
    } finally {
      setCargando(false);
    }
  }

  const empresas = useMemo<EmpresaGrupo[]>(() => {
    const mapa = new Map<number, EmpresaGrupo>();
    for (const vacante of vacantes) {
      const empresa = mapa.get(vacante.id_empresa) ?? {
        id_empresa: vacante.id_empresa,
        nombre: vacante.empresa,
        giro: vacante.giro,
        domicilio: vacante.domicilio,
        correo_contacto: vacante.correo_contacto,
        telefono: vacante.telefono,
        vacantes: [],
      };
      empresa.vacantes.push(vacante);
      mapa.set(vacante.id_empresa, empresa);
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [vacantes]);

  const solicitudesPorVacante = useMemo(
    () =>
      solicitudes.reduce<Record<number, SeleccionEmpresaAlumno>>((acc, solicitud) => {
        if (solicitud.id_vacante) acc[solicitud.id_vacante] = solicitud;
        return acc;
      }, {}),
    [solicitudes],
  );

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return empresas.filter((empresa) =>
      empresa.nombre.toLowerCase().includes(q) ||
      (empresa.giro ?? "").toLowerCase().includes(q) ||
      empresa.vacantes.some((vacante) =>
        [
          vacante.titulo,
          vacante.convocatoria ?? "",
          vacante.tipo_practica ?? "",
          vacante.actividades ?? "",
          vacante.requisitos ?? "",
        ].some((texto) => texto.toLowerCase().includes(q)),
      ),
    );
  }, [empresas, busqueda]);

  function toggleVacante(idVacante: number) {
    if (!puedeSeleccionar) return;
    if (seleccionadas.includes(idVacante)) {
      setSeleccionadas(seleccionadas.filter((id) => id !== idVacante));
      return;
    }

    const vacante = vacantes.find((item) => item.id_vacante === idVacante);
    if (!vacante || cuposDisponibles(vacante) <= 0 || seleccionadas.length >= 2) return;
    setSeleccionadas([...seleccionadas, idVacante]);
  }

  async function guardarPreferencias() {
    const idAlumno = obtenerIdAlumnoSesion();
    if (!idAlumno) {
      alert("No se encontro el perfil de alumno.");
      return;
    }
    if (seleccionadas.length === 0) {
      alert("Selecciona al menos una vacante.");
      return;
    }
    if (!puedeSeleccionar) {
      alert(motivoBloqueo ?? "Tu expediente debe estar aprobado antes de seleccionar vacante.");
      return;
    }

    try {
      setGuardando(true);
      await gestionPadronUseCase.guardarPreferencias(
        idAlumno,
        seleccionadas.map((idVacante, index) => ({
          id_vacante: idVacante,
          prioridad: index + 1,
        })),
        seleccionadas[0] ?? null,
      );
      alert("Selección guardada correctamente.");
      await cargarPadron();
    } catch (err) {
      console.error(err);
      alert(getApiErrorMessage(err, "No se pudieron guardar las preferencias."));
    } finally {
      setGuardando(false);
    }
  }

  const opciones = seleccionadas
    .map((id) => vacantes.find((vacante) => vacante.id_vacante === id))
    .filter(Boolean) as VacantePadron[];
  const mensajePadronVacio =
    puedeSeleccionar && vacantes.length === 0
      ? (
          hayPadronPublicado
            ? "No hay vacantes disponibles compatibles con tu carrera y tipo de práctica."
            : "El padrón aún no ha sido publicado por Coordinación de Unidades Receptoras."
        )
      : "No hay vacantes disponibles con los filtros seleccionados.";

  if (!cargando && empresaAsignada) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0d2b5e]">Padron Empresarial</h1>
          <p className="text-gray-500 text-sm mt-1">Consulta la informacion de tu unidad receptora asignada.</p>
        </div>

        {empresaAsignada ? (
          <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="bg-[#0d2b5e] px-6 py-7 text-white flex items-start gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-blue-200 text-sm">Ya estas asignado a la empresa</p>
                <h2 className="text-2xl font-bold mt-1">{empresaAsignada.nombre}</h2>
                <p className="text-blue-100 text-sm mt-2">{empresaAsignada.giro ?? "Giro empresarial no registrado"}</p>
              </div>
            </div>

            <div className="p-6 grid sm:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-gray-500 text-sm">
                  <Briefcase className="w-4 h-4 text-[#1565c0]" />
                  Vacante asignada
                </div>
                <p className="font-semibold text-[#0d2b5e] mt-2">{empresaAsignada.vacante ?? "No registrada"}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {[empresaAsignada.convocatoria, empresaAsignada.tipo_practica, empresaAsignada.periodo]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              <InfoEmpresa icon={<MapPin className="w-4 h-4 text-[#1565c0]" />} titulo="Domicilio" valor={empresaAsignada.domicilio} />
              <InfoEmpresa icon={<Mail className="w-4 h-4 text-[#1565c0]" />} titulo="Correo de contacto" valor={empresaAsignada.correo_contacto} />
              <InfoEmpresa icon={<Phone className="w-4 h-4 text-[#1565c0]" />} titulo="Telefono" valor={empresaAsignada.telefono} />

              <div className="sm:col-span-2 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-green-700 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  Asignacion confirmada el{" "}
                  <span className="font-semibold">
                    {new Intl.DateTimeFormat("es-MX", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    }).format(new Date(`${empresaAsignada.fecha_asignacion}T00:00:00`))}
                  </span>
                </p>
              </div>
            </div>
          </section>
        ) : (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
            <h2 className="font-semibold text-orange-800">Asignacion en proceso</h2>
            <p className="text-sm text-orange-700 mt-1">Tu estado figura como asignado, pero aun no esta disponible la informacion de la empresa.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Padron Empresarial</h1>
        <p className="text-gray-500 text-sm mt-1">Consulta vacantes activas y selecciona hasta 2 opciones para tus prácticas profesionales.</p>
      </div>

      {error && <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">{error}</div>}

      <div className="bg-[#0d2b5e] rounded-2xl p-6 text-white">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h2 className="text-xl font-bold">Vacantes autorizadas</h2>
            <p className="text-blue-200 text-sm mt-1">Aparecen solo vacantes activas compatibles con tu periodo y tipo de practica.</p>
          </div>
          <span className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-semibold w-fit">
            {cargando ? "Cargando..." : `${vacantes.length} vacantes disponibles`}
          </span>
        </div>
      </div>

      {!puedeSeleccionar && !cargando && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-orange-700 text-sm">Proceso no disponible</div>
            <div className="text-orange-700 text-xs mt-1">{motivoBloqueo}</div>
            {estadoExpediente && !motivoBloqueo?.includes("Estado actual:") && (
              <div className="text-orange-700 text-xs mt-1">Estado documental: {estadoExpediente}.</div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 text-xs">
              <DatoElegibilidad titulo="Tipo de practica" valor={elegibilidad?.tipo_practica?.nombre ?? "Sin asignar"} />
              <DatoElegibilidad titulo="Periodo" valor={elegibilidad?.alumno?.periodo_practica ?? "Sin registrar"} />
              <DatoElegibilidad
                titulo={elegibilidad?.alumno?.periodo_practica === "Cuatrimestral" ? "Tu cuatrimestre actual" : "Tu semestre actual"}
                valor={String(elegibilidad?.alumno?.semestre ?? "Sin registrar")}
              />
              <DatoElegibilidad
                titulo="Creditos"
                valor={`${elegibilidad?.alumno?.creditos_aprobados ?? 0} / ${requisitoPractica?.creditos_minimos ?? elegibilidad?.tipo_practica?.creditos_minimos ?? 0}`}
              />
              <DatoElegibilidad
                titulo={elegibilidad?.alumno?.periodo_practica === "Cuatrimestral" ? "Cuatrimestre requerido" : "Semestre requerido"}
                valor={String(requisitoPractica?.periodo_requerido ?? elegibilidad?.tipo_practica?.semestre_requerido ?? "Sin configurar")}
              />
              <DatoElegibilidad titulo="Horas requeridas" valor={String(requisitoPractica?.horas_requeridas ?? elegibilidad?.tipo_practica?.horas_requeridas ?? "Sin configurar")} />
            </div>
            {requisitoPractica?.advertencia_regla && (
              <div className="text-xs text-orange-700 mt-3">{requisitoPractica.advertencia_regla}</div>
            )}
          </div>
        </div>
      )}

      {puedeSeleccionar && requisitoPractica?.advertencia_regla && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-xs text-orange-700">
          {requisitoPractica.advertencia_regla}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="border rounded-xl px-3 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="outline-none text-sm w-full"
            placeholder="Buscar empresa, vacante, convocatoria o tipo de practica..."
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid md:grid-cols-2 gap-5">
          {cargando && (
            <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
              Cargando padron empresarial...
            </div>
          )}

          {!cargando &&
            filtradas.map((empresa) => (
              <EmpresaCard
                key={empresa.id_empresa}
                empresa={empresa}
                puedeSeleccionar={puedeSeleccionar}
                seleccionadas={seleccionadas}
                solicitudesPorVacante={solicitudesPorVacante}
                onToggle={toggleVacante}
                onDetalle={() => setDetalle(empresa)}
              />
            ))}

          {!cargando && filtradas.length === 0 && (
            <div className="md:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
              {mensajePadronVacio}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-24">
            <h3 className="font-bold text-[#0d2b5e] mb-2">Mis opciones</h3>
            <p className="text-sm text-gray-500 mb-5">Selecciona hasta 2 vacantes en orden de preferencia.</p>

            <div className="space-y-3">
              {[0, 1].map((i) => {
                const vacante = opciones[i];
                return (
                  <div key={i} className="border rounded-xl p-4 flex items-center gap-3 bg-white">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold bg-blue-50 text-[#1565c0]">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1565c0]">
                        {i === 0 ? "Primera opción" : "Segunda opción"}
                      </p>
                      {vacante ? (
                        <>
                          <p className="font-semibold text-[#0d2b5e] text-sm">{vacante.titulo}</p>
                          <p className="text-xs text-gray-500">{vacante.empresa}</p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">{i === 0 ? "Primera opción" : "Segunda opción"}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={guardarPreferencias}
              disabled={guardando || seleccionadas.length === 0 || seleccionadas.length > 2 || !puedeSeleccionar}
              className="mt-5 w-full bg-[#1565c0] text-white rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {guardando ? "Guardando..." : "Guardar preferencias"}
            </button>
          </div>
        </div>
      </div>

      {detalle && (
        <DetalleEmpresa
          empresa={detalle}
          seleccionadas={seleccionadas}
          puedeSeleccionar={puedeSeleccionar}
          onClose={() => setDetalle(null)}
          onToggle={toggleVacante}
        />
      )}
    </div>
  );
}

function InfoEmpresa({ icon, titulo, valor }: { icon: ReactNode; titulo: string; valor: string | null }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        {icon}
        {titulo}
      </div>
      <p className="font-semibold text-[#0d2b5e] mt-2 break-words">{valor ?? "No registrado"}</p>
    </div>
  );
}

function DatoElegibilidad({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white border border-orange-100 rounded-xl p-3">
      <div className="text-gray-500">{titulo}</div>
      <div className="font-semibold text-[#0d2b5e]">{valor}</div>
    </div>
  );
}

function EmpresaCard({
  empresa,
  puedeSeleccionar,
  seleccionadas,
  solicitudesPorVacante,
  onToggle,
  onDetalle,
}: {
  empresa: EmpresaGrupo;
  puedeSeleccionar: boolean;
  seleccionadas: number[];
  solicitudesPorVacante: Record<number, SeleccionEmpresaAlumno>;
  onToggle: (idVacante: number) => void;
  onDetalle: () => void;
}) {
  const espacios = empresa.vacantes.reduce((total, vacante) => total + cuposDisponibles(vacante), 0);
  return (
    <div className="rounded-2xl border shadow-sm p-6 bg-white border-gray-200">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-[#0d2b5e]">{empresa.nombre}</h3>
          <p className="text-sm text-gray-500 mt-1">{empresa.giro ?? "Sin giro registrado"}</p>
        </div>
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">{espacios} cupos</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <div className="border rounded-xl p-3 bg-white/70">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <MapPin className="w-4 h-4" />
            Ubicacion
          </div>
          <p className="font-semibold text-[#0d2b5e] mt-1">{empresa.domicilio ?? "No registrada"}</p>
        </div>
        <div className="border rounded-xl p-3 bg-white/70">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Briefcase className="w-4 h-4" />
            Vacantes
          </div>
          <p className="font-semibold text-[#0d2b5e] mt-1">{empresa.vacantes.length}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {empresa.vacantes.map((vacante) => {
          const selected = seleccionadas.includes(vacante.id_vacante);
          const solicitud = solicitudesPorVacante[vacante.id_vacante];
          const sinCupo = cuposDisponibles(vacante) <= 0;
          const disabled = !puedeSeleccionar || (!selected && (sinCupo || seleccionadas.length >= 2));
          return (
            <div key={vacante.id_vacante} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#0d2b5e]">{vacante.titulo}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {[vacante.convocatoria, vacante.tipo_practica, vacante.periodo].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                  {cuposDisponibles(vacante)} / {vacante.cupos}
                </span>
              </div>
              {solicitud && (
                <div className="mt-2 text-xs text-yellow-700">Solicitud {solicitud.estado_seleccion}</div>
              )}
              <button
                disabled={disabled}
                onClick={() => onToggle(vacante.id_vacante)}
                className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1 ${
                  selected
                    ? "border border-red-200 text-red-600"
                    : disabled
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-[#1565c0] text-white"
                }`}
              >
                {selected ? <X className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                {selected ? "Quitar" : sinCupo ? "Sin cupo" : "Seleccionar"}
              </button>
            </div>
          );
        })}
      </div>

      <button onClick={onDetalle} className="mt-5 border border-blue-200 text-[#1565c0] rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-1">
        <Eye className="w-3 h-3" />
        Ver detalles
      </button>
    </div>
  );
}

function DetalleEmpresa({
  empresa,
  seleccionadas,
  puedeSeleccionar,
  onClose,
  onToggle,
}: {
  empresa: EmpresaGrupo;
  seleccionadas: number[];
  puedeSeleccionar: boolean;
  onClose: () => void;
  onToggle: (idVacante: number) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-[#0d2b5e]">{empresa.nombre}</h3>
            <p className="text-sm text-gray-500 mt-1">{empresa.giro ?? "Sin giro registrado"}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-5">
          <InfoEmpresa icon={<MapPin className="w-4 h-4 text-[#1565c0]" />} titulo="Ubicacion" valor={empresa.domicilio} />
          <InfoEmpresa icon={<Mail className="w-4 h-4 text-[#1565c0]" />} titulo="Contacto" valor={empresa.correo_contacto ?? empresa.telefono} />
        </div>

        <div className="mt-5">
          <h4 className="font-bold text-[#0d2b5e]">Vacantes disponibles</h4>
          <div className="space-y-3 mt-3">
            {empresa.vacantes.map((vacante) => {
              const selected = seleccionadas.includes(vacante.id_vacante);
              const disabled = !puedeSeleccionar || (!selected && (cuposDisponibles(vacante) <= 0 || seleccionadas.length >= 2));
              return (
                <div key={vacante.id_vacante} className="border rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[#0d2b5e]">{vacante.titulo}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {[vacante.convocatoria, vacante.tipo_practica, vacante.periodo].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                      {cuposDisponibles(vacante)} cupos
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">{vacante.descripcion ?? "Sin descripcion registrada."}</p>
                  {vacante.actividades && <p className="text-xs text-gray-500 mt-2">Actividades: {vacante.actividades}</p>}
                  {vacante.requisitos && <p className="text-xs text-gray-500 mt-2">Requisitos: {vacante.requisitos}</p>}
                  <button
                    onClick={() => onToggle(vacante.id_vacante)}
                    disabled={disabled}
                    className="mt-4 bg-[#1565c0] text-white rounded-xl px-3 py-2 text-xs font-semibold disabled:bg-gray-300"
                  >
                    {selected ? "Quitar de mis opciones" : "Seleccionar vacante"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
