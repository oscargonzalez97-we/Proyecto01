import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Briefcase,
  CheckCircle,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileText,
  Lock,
  Plus,
  Search,
  Send,
  X,
} from "lucide-react";

import { gestionVacantesUnidadUseCase } from "../../dependencies";
import { apiClient } from "../../../infrastructure/api/apiClient";
import { getApiErrorMessage } from "../../../shared/utils/apiError";
import type {
  ConvocatoriaBasica,
  ConvocatoriaDisponibleUnidad,
  CrearVacanteUnidadInput,
  VacanteUnidad,
  VacantesUnidadResponse,
} from "../../../domain/unidad/VacanteUnidad";

import type { ColoredStatCard } from "../../../shared/types/ui";
type TipoPractica = {
  id_tipo_practica: number;
  nombre: string;
  horas_requeridas: number;
  activo: boolean;
};

type Carrera = {
  id_carrera: number;
  nombre: string;
  tipo_periodo?: "Semestral" | "Cuatrimestral";
  estado?: string;
};

type VacanteForm = Omit<CrearVacanteUnidadInput, "tipos_practica"> & {
  aplica_todas_carreras: boolean;
  ids_carrera: number[];
  tipos_practica: Array<{ id_tipo_practica: number; cupos: number }>;
};

type UsuarioSesion = {
  perfil?: {
    id_empresa?: number;
  };
};

function obtenerIdEmpresa() {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;

  try {
    const usuario = JSON.parse(raw) as UsuarioSesion;
    return usuario.perfil?.id_empresa ?? null;
  } catch {
    return null;
  }
}

function textoTramite(tipo?: string | null) {
  return tipo === "Vinculacion" ? "vinculación" : tipo === "Convenio" ? "convenio" : "trámite";
}

function estadoVacanteTexto(estado: string) {
  const etiquetas: Record<string, string> = {
    Pendiente: "Pendiente de revisión",
    "Con observaciones": "Con observaciones",
    PrePadron: "En pre-padrón",
    Activa: "Publicada",
    Rechazada: "Rechazada",
    Cerrada: "Cerrada",
  };
  return etiquetas[estado] ?? estado;
}

function estadoVacanteClase(estado: string) {
  const clases: Record<string, string> = {
    Pendiente: "bg-yellow-100 text-yellow-700",
    "Con observaciones": "bg-orange-100 text-orange-700",
    PrePadron: "bg-blue-100 text-blue-700",
    Activa: "bg-green-100 text-green-700",
    Rechazada: "bg-red-100 text-red-700",
    Cerrada: "bg-gray-100 text-gray-600",
  };
  return clases[estado] ?? "bg-gray-100 text-gray-600";
}

function estadoPasoClase(listo: boolean) {
  return listo ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-800 border-yellow-200";
}

function obtenerMensajePlanTrabajoError(error: unknown, mensajeDefault: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (Array.isArray(detail)) {
      const campoArchivo = detail.some((item) => {
        const loc = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : undefined;
        return loc === "archivo";
      });
      if (campoArchivo) return "Debes seleccionar el Plan de Trabajo lleno.";
    }
  }
  return getApiErrorMessage(error, mensajeDefault);
}

function descargarArchivoBlob(blob: Blob, nombreArchivo: string) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo || "plan_trabajo.pdf";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function obtenerMensajeDescarga(error: unknown, mensajeDefault: string) {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const contenido = JSON.parse(await error.response.data.text()) as { detail?: unknown };
      if (typeof contenido.detail === "string") return contenido.detail;
    } catch {
      return mensajeDefault;
    }
  }
  return getApiErrorMessage(error, mensajeDefault);
}

export function PlanTrabajo() {
  const [datos, setDatos] = useState<VacantesUnidadResponse | null>(null);
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaBasica[]>([]);
  const [convocatoriasDisponibles, setConvocatoriasDisponibles] = useState<ConvocatoriaDisponibleUnidad[]>([]);
  const [tiposPractica, setTiposPractica] = useState<TipoPractica[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mostrarModalConvocatorias, setMostrarModalConvocatorias] = useState(false);
  const [vacanteAmpliacion, setVacanteAmpliacion] = useState<VacanteUnidad | null>(null);
  const [vacanteDetalle, setVacanteDetalle] = useState<VacanteUnidad | null>(null);
  const [vacanteEditando, setVacanteEditando] = useState<VacanteUnidad | null>(null);
  const [archivoPlanTrabajo, setArchivoPlanTrabajo] = useState<File | null>(null);
  const [ampliacionForm, setAmpliacionForm] = useState({
    detalles: [] as Array<{ id_tipo_practica: number; cupos_solicitados: number }>,
    motivo: "",
  });
  const [form, setForm] = useState<VacanteForm>({
    id_convocatoria: 0,
    titulo: "",
    descripcion: "",
    actividades: "",
    requisitos: "",
    cupos: 1,
    aplica_todas_carreras: true,
    ids_carrera: [],
    tipos_practica: [],
  });

  const idEmpresa = obtenerIdEmpresa() ?? 0;

  useEffect(() => {
    void cargar();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- el endpoint /me resuelve la empresa desde el token.

  async function cargar() {
    try {
      setCargando(true);
      setError("");
      const vacantesData = await gestionVacantesUnidadUseCase.listar(idEmpresa);
      setDatos(vacantesData);
      const [convocatoriasData, convocatoriasDisponiblesData, tiposData, carrerasData] = await Promise.all([
        gestionVacantesUnidadUseCase.listarConvocatorias(),
        gestionVacantesUnidadUseCase.listarConvocatoriasDisponibles(),
        apiClient.get<TipoPractica[]>("/unidad/catalogos/tipos-practica"),
        apiClient.get<Carrera[]>("/unidad/catalogos/carreras"),
      ]);
      const convocatoriasActivas = convocatoriasData.filter((convocatoria) => convocatoria.estado === "Activa");
      setConvocatorias(convocatoriasActivas);
      setConvocatoriasDisponibles(convocatoriasDisponiblesData);
      setTiposPractica(tiposData.data);
      setCarreras(carrerasData.data.filter((carrera) => carrera.estado !== "Inactiva"));
      setForm((actual) => ({
        ...actual,
        id_convocatoria:
          actual.id_convocatoria ||
          vacantesData.convocatoria_disponible?.id_convocatoria ||
          0,
        tipos_practica:
          actual.tipos_practica.length > 0 || !tiposData.data[0]
            ? actual.tipos_practica
            : [{ id_tipo_practica: tiposData.data[0].id_tipo_practica, cupos: 1 }],
      }));
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No fue posible cargar las vacantes. Verifica que tu usuario esté vinculado a una empresa."));
    } finally {
      setCargando(false);
    }
  }

  async function crearVacante(event: FormEvent) {
    event.preventDefault();
    if (!vacanteEditando && !datos?.empresa.puede_capturar_vacantes) {
      setError(motivoVacante);
      return;
    }
    if (form.tipos_practica.length === 0) {
      setError("Selecciona al menos un tipo de práctica.");
      return;
    }
    if (!form.aplica_todas_carreras && form.ids_carrera.length === 0) {
      setError("Selecciona al menos una carrera o marca Todas las carreras.");
      return;
    }
    if (cuposExcedidos) {
      setError("El máximo inicial permitido es de 3 cupos. Para solicitar más, envía una solicitud de ampliación a Coordinación de Unidades.");
      return;
    }
    if (!archivoPlanTrabajo && !vacanteEditando?.plan_trabajo) {
      setError("Debes subir el Plan de Trabajo antes de enviar la vacante.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      setMensaje("");
      const payload = {
        ...form,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion?.trim() || undefined,
        actividades: form.actividades?.trim() || undefined,
        requisitos: form.requisitos?.trim() || undefined,
        cupos: cuposIniciales,
        tipos_practica: form.tipos_practica.map((tipo) => ({
          id_tipo_practica: Number(tipo.id_tipo_practica),
          cupos: Number(tipo.cupos),
        })),
      };
      const vacante = vacanteEditando
        ? await gestionVacantesUnidadUseCase.editar(vacanteEditando.id_vacante, payload)
        : await gestionVacantesUnidadUseCase.crear(idEmpresa, payload);
      const subioPlanTrabajo = Boolean(archivoPlanTrabajo);
      if (archivoPlanTrabajo) {
        await gestionVacantesUnidadUseCase.subirPlanTrabajo(vacante.id_vacante, archivoPlanTrabajo);
      }
      await gestionVacantesUnidadUseCase.reenviar(vacante.id_vacante);
      setMostrarFormulario(false);
      setVacanteEditando(null);
      setArchivoPlanTrabajo(null);
      setForm({
        id_convocatoria: form.id_convocatoria,
        titulo: "",
        descripcion: "",
        actividades: "",
        requisitos: "",
        cupos: 1,
        aplica_todas_carreras: true,
        ids_carrera: [],
        tipos_practica: tiposPractica[0] ? [{ id_tipo_practica: tiposPractica[0].id_tipo_practica, cupos: 1 }] : [],
      });
      await cargar();
      setMensaje(subioPlanTrabajo ? "Plan de Trabajo subido correctamente." : "Vacante guardada correctamente.");
    } catch (err) {
      console.error(err);
      setError(obtenerMensajePlanTrabajoError(err, "No se pudo crear la vacante."));
    } finally {
      setGuardando(false);
    }
  }

  async function solicitarParticipacion() {
    setMostrarModalConvocatorias(true);
  }

  async function seleccionarConvocatoria(convocatoria: ConvocatoriaDisponibleUnidad) {
    if (convocatoria.participacion?.estado === "Rechazada") {
      setError(convocatoria.motivo_bloqueo ?? "La inscripción fue rechazada para esta convocatoria.");
      return;
    }
    if (convocatoria.vacante) {
      setForm((actual) => ({ ...actual, id_convocatoria: convocatoria.id_convocatoria }));
      setMostrarModalConvocatorias(false);
      return;
    }
    if (!convocatoria.puede_seleccionar) {
      setError(convocatoria.motivo_bloqueo ?? "No se puede seleccionar esta convocatoria.");
      return;
    }

    if (!form.id_convocatoria) {
      setForm((actual) => ({ ...actual, id_convocatoria: convocatoria.id_convocatoria }));
    }
    try {
      setGuardando(true);
      setError("");
      await gestionVacantesUnidadUseCase.solicitarParticipacion(convocatoria.id_convocatoria);
      setForm((actual) => ({ ...actual, id_convocatoria: convocatoria.id_convocatoria }));
      setMostrarModalConvocatorias(false);
      await cargar();
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo seleccionar la convocatoria."));
    } finally {
      setGuardando(false);
    }
  }

  async function enviarSolicitudAmpliacion(event: FormEvent) {
    event.preventDefault();
    if (!vacanteAmpliacion) return;
    const detalles = ampliacionForm.detalles
      .map((detalle) => ({ ...detalle, cupos_solicitados: Number(detalle.cupos_solicitados || 0) }))
      .filter((detalle) => detalle.cupos_solicitados > 0);
    if (detalles.length === 0) {
      setError("Indica al menos un cupo adicional para un tipo de practica.");
      return;
    }
    if (!ampliacionForm.motivo.trim()) {
      setError("Ingresa el motivo de la solicitud.");
      return;
    }

    try {
      setGuardando(true);
      setError("");
      await apiClient.post(`/unidad/vacantes/${vacanteAmpliacion.id_vacante}/solicitar-ampliacion-cupos`, {
        motivo: ampliacionForm.motivo.trim(),
        detalles,
      });
      setVacanteAmpliacion(null);
      setAmpliacionForm({ detalles: [], motivo: "" });
      await cargar();
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo solicitar la ampliacion de cupos."));
    } finally {
      setGuardando(false);
    }
  }

  const vacantesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase();
    return (datos?.vacantes ?? []).filter((vacante) =>
      [vacante.titulo, vacante.periodo ?? "", vacante.tipo_practica ?? "", vacante.descripcion ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [busqueda, datos]);

  const total = datos?.vacantes.length ?? 0;
  const enRevision = datos?.vacantes.filter((vacante) => vacante.estado_vacante === "Pendiente" || vacante.estado_vacante === "Con observaciones").length ?? 0;
  const prepadron = datos?.vacantes.filter((vacante) => vacante.estado_vacante === "PrePadron").length ?? 0;
  const publicadas = datos?.vacantes.filter((vacante) => vacante.estado_vacante === "Activa").length ?? 0;
  const puedeCrearVacante = datos?.empresa.puede_crear_vacante ?? datos?.empresa.puede_capturar_vacantes ?? false;
  const puedeSeleccionarConvocatoria = Boolean(datos?.empresa.documentacion_legal_aprobada && datos?.empresa.tramite_vigente);
  const tramite = textoTramite(datos?.empresa.tipo_tramite);
  const motivoVacante = datos?.empresa.motivo_bloqueo_vacante ?? datos?.empresa.motivo_bloqueo ?? "No disponible en este momento.";
  const cuposIniciales = form.tipos_practica.reduce((total, tipo) => total + Number(tipo.cupos || 0), 0);
  const cuposConfiguradosAntesDeEditar = vacanteEditando?.tipos_practica?.reduce(
    (totalTipos, tipo) => totalTipos + Number(tipo.cupos || 0),
    0,
  ) ?? 0;
  const limiteCuposFormulario = Math.max(3, cuposConfiguradosAntesDeEditar);
  const cuposExcedidos = cuposIniciales > limiteCuposFormulario;
  const convocatoriaSeleccionada =
    convocatoriasDisponibles.find((convocatoria) => convocatoria.id_convocatoria === form.id_convocatoria) ??
    convocatorias.find((convocatoria) => convocatoria.id_convocatoria === form.id_convocatoria) ??
    datos?.convocatoria_disponible ??
    null;
  const carrerasCompatibles = convocatoriaSeleccionada
    ? carreras.filter((carrera) => carrera.tipo_periodo === convocatoriaSeleccionada.tipo_periodo)
    : [];
  const erroresFormulario = [
    !form.titulo.trim() ? "Título del proyecto" : null,
    !form.id_convocatoria ? "Convocatoria" : null,
    form.tipos_practica.length === 0 ? "Al menos un tipo de práctica" : null,
    cuposIniciales < 1 ? "Al menos un cupo" : null,
    cuposExcedidos ? "Máximo 3 cupos iniciales" : null,
    !convocatoriaSeleccionada ? "Selecciona una convocatoria para ver carreras compatibles" : null,
    convocatoriaSeleccionada && carrerasCompatibles.length === 0 ? "No hay carreras compatibles con esta convocatoria" : null,
    !form.aplica_todas_carreras && form.ids_carrera.length === 0 ? "Carrera compatible o seleccionar todas las carreras compatibles" : null,
    !archivoPlanTrabajo && !vacanteEditando?.plan_trabajo ? "Plan de Trabajo lleno" : null,
  ].filter(Boolean) as string[];
  const vacanteConvocatoriaSeleccionada = datos?.vacantes.find((vacante) => vacante.id_convocatoria === form.id_convocatoria) ?? null;

  useEffect(() => {
    if (!convocatoriaSeleccionada) return;
    const compatibles = new Set(carrerasCompatibles.map((carrera) => carrera.id_carrera));
    setForm((actual) => ({
      ...actual,
      ids_carrera: actual.ids_carrera.filter((idCarrera) => compatibles.has(idCarrera)),
    }));
  }, [convocatoriaSeleccionada?.id_convocatoria, carreras.length]); // eslint-disable-line react-hooks/exhaustive-deps -- solo limpia selecciones incompatibles.

  function abrirNuevaVacante() {
    if (puedeCrearVacante) {
      setMostrarFormulario((actual) => !actual);
      return;
    }
    if (puedeSeleccionarConvocatoria) {
      setMostrarModalConvocatorias(true);
      return;
    }
    setError(motivoVacante);
  }

  function abrirModalAmpliacion(vacante: VacanteUnidad) {
    const tipos = vacante.tipos_practica ?? [];
    setVacanteAmpliacion(vacante);
    setAmpliacionForm({
      detalles: tipos.map((tipo) => ({ id_tipo_practica: tipo.id_tipo_practica, cupos_solicitados: 0 })),
      motivo: "",
    });
  }

  async function abrirDetalleVacante(vacante: VacanteUnidad) {
    try {
      setGuardando(true);
      setError("");
      const detalle = await gestionVacantesUnidadUseCase.obtenerDetalle(vacante.id_vacante);
      setVacanteDetalle(detalle);
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No fue posible cargar el detalle de la vacante."));
    } finally {
      setGuardando(false);
    }
  }

  function editarVacante(vacante: VacanteUnidad) {
    setVacanteEditando(vacante);
    setArchivoPlanTrabajo(null);
    setForm({
      id_convocatoria: vacante.id_convocatoria,
      titulo: vacante.titulo,
      descripcion: vacante.descripcion ?? "",
      actividades: vacante.actividades ?? "",
      requisitos: vacante.requisitos ?? "",
      cupos: vacante.cupos,
      aplica_todas_carreras: vacante.aplica_todas_carreras ?? true,
      ids_carrera: vacante.carreras?.map((carrera) => carrera.id_carrera) ?? [],
      tipos_practica: (vacante.tipos_practica ?? []).map((tipo) => ({
        id_tipo_practica: tipo.id_tipo_practica,
        cupos: tipo.cupos,
      })),
    });
    setMostrarFormulario(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reenviarVacante(vacante: VacanteUnidad) {
    try {
      setGuardando(true);
      setError("");
      await gestionVacantesUnidadUseCase.reenviar(vacante.id_vacante);
      await cargar();
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo reenviar la vacante."));
    } finally {
      setGuardando(false);
    }
  }

  async function descargarPlanTrabajo(vacante: VacanteUnidad) {
    try {
      const { data } = await apiClient.get(`/unidad/vacantes/${vacante.id_vacante}/plan-trabajo/archivo`, { responseType: "blob" });
      descargarArchivoBlob(data, vacante.plan_trabajo?.nombre_archivo ?? "plan_trabajo.pdf");
    } catch (err) {
      console.error(err);
      setError(await obtenerMensajeDescarga(err, "No fue posible descargar el Plan de Trabajo."));
    }
  }

  async function descargarFormatoPlanTrabajo() {
    try {
      const formato = vacanteEditando?.formato_plan_trabajo ?? (form.id_convocatoria ? await gestionVacantesUnidadUseCase.obtenerFormatoPlanTrabajo(form.id_convocatoria) : null);
      if (!formato) {
        setError("No hay formato oficial de Plan de Trabajo disponible para esta convocatoria.");
        return;
      }
      const { data } = await apiClient.get(`/unidad/vacantes/formatos-plan-trabajo/${formato.id_formato_plan}/archivo`, { responseType: "blob" });
      descargarArchivoBlob(data, formato.nombre_archivo);
    } catch (err) {
      console.error(err);
      setError(await obtenerMensajeDescarga(err, "No fue posible descargar el formato oficial."));
    }
  }

  function formatoFecha(fecha?: string | null) {
    if (!fecha) return "Sin fecha";
    return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function alternarTipoPractica(idTipoPractica: number) {
    setForm((actual) => {
      const existe = actual.tipos_practica.some((tipo) => tipo.id_tipo_practica === idTipoPractica);
      return {
        ...actual,
        tipos_practica: existe
          ? actual.tipos_practica.filter((tipo) => tipo.id_tipo_practica !== idTipoPractica)
          : [...actual.tipos_practica, { id_tipo_practica: idTipoPractica, cupos: 1 }],
      };
    });
  }

  function actualizarCuposTipo(idTipoPractica: number, cupos: number) {
    setForm((actual) => ({
      ...actual,
      tipos_practica: actual.tipos_practica.map((tipo) =>
        tipo.id_tipo_practica === idTipoPractica ? { ...tipo, cupos } : tipo,
      ),
    }));
  }

  function alternarCarrera(idCarrera: number) {
    setForm((actual) => ({
      ...actual,
      ids_carrera: actual.ids_carrera.includes(idCarrera)
        ? actual.ids_carrera.filter((id) => id !== idCarrera)
        : [...actual.ids_carrera, idCarrera],
    }));
  }

  if (cargando) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-500">
        Cargando ofertas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Ofertas y vacantes</h1>
        <p className="text-gray-500 text-sm mt-1">
          Selecciona una convocatoria y captura la vacante que Coordinación revisará para el padrón.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {mensaje && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          {mensaje}
        </div>
      )}

      {mostrarModalConvocatorias && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-5xl max-h-[86vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0d2b5e]">Seleccionar convocatoria</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Elige la convocatoria en la que deseas registrar tu vacante.
                </p>
              </div>
              <button
                onClick={() => setMostrarModalConvocatorias(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {(["Empresas", "Próxima"] as const).map((grupo) => {
                const items = convocatoriasDisponibles.filter((convocatoria) => convocatoria.etapa_actual === grupo);
                return (
                  <section key={grupo}>
                    <h3 className="font-bold text-[#0d2b5e] text-sm mb-3">
                      {grupo === "Empresas" ? "Convocatorias activas" : "Convocatorias próximas"}
                    </h3>
                    {items.length === 0 ? (
                      <div className="border border-dashed rounded-xl p-4 text-sm text-gray-400">
                        No hay convocatorias en esta sección.
                      </div>
                    ) : (
                      <div className="grid md:grid-cols-2 gap-4">
                        {items.map((convocatoria) => (
                          <div key={convocatoria.id_convocatoria} className="border border-gray-200 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-bold text-[#0d2b5e]">{convocatoria.nombre}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {convocatoria.tipo_periodo} · {convocatoria.estado} · {convocatoria.etapa_actual}
                                </div>
                              </div>
                              <div className="flex flex-wrap justify-end gap-1">
                                {convocatoria.participacion && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700">
                                    {convocatoria.participacion.estado === "Pendiente" ? "Registrada" : convocatoria.participacion.estado}
                                  </span>
                                )}
                                {convocatoria.vacante && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                                    Vacante registrada
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs text-gray-600">
                              <div className="bg-gray-50 rounded-lg p-3">
                                <div className="font-semibold text-gray-500">Periodo operativo</div>
                                <div>{formatoFecha(convocatoria.fecha_inicio_general)} - {formatoFecha(convocatoria.fecha_cierre_general)}</div>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-3">
                                <div className="font-semibold text-gray-500">Periodo empresas</div>
                                <div>{formatoFecha(convocatoria.fecha_inicio_empresas)} - {formatoFecha(convocatoria.fecha_cierre_empresas)}</div>
                              </div>
                            </div>
                            {convocatoria.motivo_bloqueo && !convocatoria.participacion && (
                              <div className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-lg p-2">
                                {convocatoria.motivo_bloqueo}
                              </div>
                            )}
                            <div className="flex justify-end gap-2 mt-4">
                              <button
                                type="button"
                                className="border border-gray-200 text-gray-600 rounded-lg px-3 py-2 text-xs font-semibold"
                              >
                                Ver fechas
                              </button>
                              <button
                                type="button"
                                disabled={guardando === true || Boolean(convocatoria.vacante) || convocatoria.participacion?.estado === "Rechazada" || !convocatoria.puede_seleccionar}
                                onClick={() => seleccionarConvocatoria(convocatoria)}
                                className="bg-[#1565c0] text-white rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50"
                              >
                                {convocatoria.participacion ? "Usar convocatoria" : "Seleccionar convocatoria"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {vacanteAmpliacion && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <form onSubmit={enviarSolicitudAmpliacion} className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0d2b5e]">Solicitud de ampliación de cupos</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Puedes solicitar más cupos para esta vacante. Coordinación de Unidades revisará la solicitud.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVacanteAmpliacion(null)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                title="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-[#0d2b5e]">
                Vacante: <span className="font-semibold">{vacanteAmpliacion.titulo}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-700">Indica los cupos adicionales por tipo de practica.</div>
                <div className="space-y-2 mt-2">
                  {(vacanteAmpliacion.tipos_practica?.length
                    ? vacanteAmpliacion.tipos_practica
                    : [{ id_tipo_practica: vacanteAmpliacion.id_tipo_practica, nombre: vacanteAmpliacion.tipo_practica, cupos: vacanteAmpliacion.cupos, cupos_usados: 0, cupos_disponibles: vacanteAmpliacion.cupos }]
                  ).map((tipo) => {
                    const detalle = ampliacionForm.detalles.find((item) => item.id_tipo_practica === tipo.id_tipo_practica);
                    return (
                      <div key={tipo.id_tipo_practica} className="grid grid-cols-[1fr_90px] gap-3 border rounded-xl p-3">
                        <div>
                          <div className="text-sm font-bold text-[#0d2b5e]">{tipo.nombre ?? "Tipo de practica"}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {tipo.cupos} actuales ? {tipo.cupos_usados ?? 0} usados ? {tipo.cupos_disponibles ?? tipo.cupos} disponibles
                          </div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          value={detalle?.cupos_solicitados ?? 0}
                          onChange={(event) =>
                            setAmpliacionForm({
                              ...ampliacionForm,
                              detalles: ampliacionForm.detalles.map((item) =>
                                item.id_tipo_practica === tipo.id_tipo_practica
                                  ? { ...item, cupos_solicitados: Math.max(0, Number(event.target.value || 0)) }
                                  : item,
                              ),
                            })
                          }
                          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1565c0]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Motivo</span>
                <textarea
                  value={ampliacionForm.motivo}
                  onChange={(event) => setAmpliacionForm({ ...ampliacionForm, motivo: event.target.value })}
                  rows={4}
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-[#1565c0]"
                  placeholder="Explica por qué la empresa puede recibir más alumnos."
                  required
                />
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setVacanteAmpliacion(null)}
                className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="bg-[#1565c0] text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {guardando ? "Enviando..." : "Solicitar más cupos"}
              </button>
            </div>
          </form>
        </div>
      )}

      {vacanteDetalle && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0d2b5e]">Detalle de la vacante</h2>
                <p className="text-sm text-gray-500 mt-1">{vacanteDetalle.convocatoria ?? "Sin convocatoria"} · {vacanteDetalle.periodo ?? "Sin periodo"}</p>
              </div>
              <button onClick={() => setVacanteDetalle(null)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[#0d2b5e] text-lg">{vacanteDetalle.titulo}</h3>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${estadoVacanteClase(vacanteDetalle.estado_vacante)}`}>
                    {estadoVacanteTexto(vacanteDetalle.estado_vacante)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{vacanteDetalle.descripcion ?? "Sin descripción registrada."}</p>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <div className="border rounded-xl p-3">
                  <div className="text-xs text-gray-500">Carreras destino</div>
                  <div className="text-sm font-semibold text-[#0d2b5e] mt-1">
                    {vacanteDetalle.aplica_todas_carreras ? "Todas las carreras" : vacanteDetalle.carreras?.map((carrera) => carrera.nombre).join(", ") || "Sin carreras"}
                  </div>
                </div>
                <div className="border rounded-xl p-3">
                  <div className="text-xs text-gray-500">Cupos totales</div>
                  <div className="text-sm font-semibold text-[#0d2b5e] mt-1">{vacanteDetalle.cupos}</div>
                </div>
                <div className="border rounded-xl p-3">
                  <div className="text-xs text-gray-500">Fecha revisión</div>
                  <div className="text-sm font-semibold text-[#0d2b5e] mt-1">{formatoFecha(vacanteDetalle.fecha_revision)}</div>
                </div>
              </div>

              <div className="border rounded-xl p-4">
                <div className="text-sm font-bold text-[#0d2b5e]">Tipos de práctica y cupos</div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                  {(vacanteDetalle.tipos_practica ?? []).map((tipo) => (
                    <div key={tipo.id_tipo_practica} className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-800">
                      <div className="font-semibold">{tipo.nombre ?? "Tipo de práctica"}</div>
                      <div className="text-xs mt-1">
                        {tipo.cupos} cupos · {tipo.cupos_usados ?? 0} usados · {tipo.cupos_disponibles ?? tipo.cupos} disponibles
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                {vacanteDetalle.actividades && (
                  <div className="border rounded-xl p-4">
                    <div className="text-xs font-semibold text-gray-500">Actividades</div>
                    <p className="text-sm text-gray-600 mt-1">{vacanteDetalle.actividades}</p>
                  </div>
                )}
                {vacanteDetalle.requisitos && (
                  <div className="border rounded-xl p-4">
                    <div className="text-xs font-semibold text-gray-500">Requisitos</div>
                    <p className="text-sm text-gray-600 mt-1">{vacanteDetalle.requisitos}</p>
                  </div>
                )}
              </div>

              <div className="border rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[#0d2b5e]">Plan de Trabajo</div>
                    <p className="text-xs text-gray-500 mt-1">
                      {vacanteDetalle.plan_trabajo
                        ? `${vacanteDetalle.plan_trabajo.nombre_archivo} · ${vacanteDetalle.plan_trabajo.estado_documento}`
                        : "No se ha subido Plan de Trabajo."}
                    </p>
                  </div>
                  {vacanteDetalle.plan_trabajo && (
                    <button
                      type="button"
                      onClick={() => descargarPlanTrabajo(vacanteDetalle)}
                      className="flex items-center justify-center gap-2 border border-[#1565c0] text-[#1565c0] rounded-xl px-4 py-2 text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar
                    </button>
                  )}
                </div>
              </div>

              {vacanteDetalle.observaciones && (
                <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-sm text-yellow-800">
                  <div className="font-bold">Observaciones de Coordinación</div>
                  <p className="mt-1">{vacanteDetalle.observaciones}</p>
                </div>
              )}

              {(vacanteDetalle.solicitudes_ampliacion ?? []).length > 0 && (
                <div className="border rounded-xl p-4">
                  <div className="text-sm font-bold text-[#0d2b5e]">Solicitudes de ampliación</div>
                  <div className="space-y-2 mt-3">
                    {vacanteDetalle.solicitudes_ampliacion?.map((solicitud) => (
                      <div key={solicitud.id_solicitud_ampliacion} className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-3">
                        {solicitud.cupos_solicitados} cupos · {solicitud.estado} · {solicitud.motivo}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <div>
            <div className="font-bold text-xl text-[#0d2b5e]">{datos?.empresa.nombre_empresa ?? "Unidad receptora"}</div>
            <p className="text-sm text-gray-500 mt-1">
              Estado institucional: {datos?.empresa.estado_empresa ?? "Sin estado"} · Trámite: {datos?.empresa.tipo_tramite ?? "Sin definir"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!puedeCrearVacante && !puedeSeleccionarConvocatoria}
              onClick={abrirNuevaVacante}
              title={puedeCrearVacante ? "Capturar una nueva vacante." : "Selecciona una convocatoria para registrar tu vacante."}
              className="bg-[#0d2b5e] px-4 py-2 rounded-xl text-white font-bold text-sm flex items-center gap-2 hover:bg-[#1565c0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              {form.id_convocatoria ? "Nueva vacante" : "Seleccionar convocatoria"}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mt-5">
          {[
            {
              titulo: "Documentación legal",
              estado: datos?.empresa.estado_documentacion_legal ?? (datos?.empresa.documentacion_legal_aprobada ? "Aprobada" : "Pendiente"),
              listo: Boolean(datos?.empresa.documentacion_legal_aprobada),
              mensaje: datos?.empresa.documentacion_legal_aprobada
                ? "Documentación legal aprobada."
                : "Sube y completa tu documentación legal para continuar.",
            },
            {
              titulo: datos?.empresa.tipo_tramite === "Vinculacion" ? "Vinculación" : "Convenio",
              estado: datos?.empresa.estado_tramite ?? (datos?.empresa.tramite_vigente ? "Vigente" : "Pendiente"),
              listo: Boolean(datos?.empresa.tramite_vigente),
              mensaje: datos?.empresa.tramite_vigente
                ? `${datos?.empresa.tipo_tramite === "Vinculacion" ? "Vinculación aprobada" : "Convenio vigente"}.`
                : `Tu ${tramite} todavía no está ${datos?.empresa.tipo_tramite === "Vinculacion" ? "aprobada" : "vigente"}.`,
            },
            {
              titulo: "Convocatoria",
              estado: convocatoriaSeleccionada?.nombre ?? "Sin seleccionar",
              listo: Boolean(convocatoriaSeleccionada),
              mensaje: convocatoriaSeleccionada
                ? `Etapa: ${"etapa_actual" in convocatoriaSeleccionada ? convocatoriaSeleccionada.etapa_actual : "Empresas"}.`
                : "Selecciona una convocatoria para registrar tu vacante.",
            },
            {
              titulo: "Vacantes",
              estado: vacanteConvocatoriaSeleccionada ? estadoVacanteTexto(vacanteConvocatoriaSeleccionada.estado_vacante) : total > 0 ? `${total} registradas` : "Sin vacante",
              listo: Boolean(vacanteConvocatoriaSeleccionada),
              mensaje: vacanteConvocatoriaSeleccionada
                ? "La vacante será revisada por Coordinación de Unidades."
                : "Captura tu vacante para enviarla a revisión.",
            },
          ].map((paso) => (
            <div key={paso.titulo} className={`border rounded-xl p-4 ${estadoPasoClase(paso.listo)}`}>
              <div className="text-xs font-semibold opacity-80">{paso.titulo}</div>
              <div className="font-bold text-sm mt-1">{paso.estado}</div>
              <p className="text-xs mt-2 leading-snug">{paso.mensaje}</p>
            </div>
          ))}
        </div>
      </section>

      {puedeCrearVacante && !vacanteConvocatoriaSeleccionada ? (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-700 mt-0.5" />
          <div>
            <div className="font-semibold text-green-800 text-sm">Puedes capturar vacantes</div>
            <div className="text-green-700 text-sm mt-1">
              Selecciona o confirma una convocatoria y registra tu vacante; quedará pendiente de revisión por Coordinación.
            </div>
          </div>
        </div>
      ) : vacanteConvocatoriaSeleccionada ? (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
          <ClipboardList className="w-5 h-5 text-blue-700 mt-0.5" />
          <div>
            <div className="font-semibold text-blue-800 text-sm">Vacante registrada</div>
            <div className="text-blue-700 text-sm mt-1">
              Estado: {estadoVacanteTexto(vacanteConvocatoriaSeleccionada.estado_vacante)}.
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5 flex items-start gap-3">
          <Lock className="w-5 h-5 text-yellow-700 mt-0.5" />
          <div>
            <div className="font-semibold text-yellow-800 text-sm">
              {puedeSeleccionarConvocatoria ? "Selecciona una convocatoria" : "Requisitos pendientes"}
            </div>
            <div className="text-yellow-700 text-sm mt-1">
              {motivoVacante}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {([
          ["Vacantes registradas", total, Briefcase, "bg-blue-50 text-blue-600"],
          ["En revisión", enRevision, AlertTriangle, "bg-yellow-50 text-yellow-700"],
          ["En pre-padrón", prepadron, ClipboardList, "bg-indigo-50 text-indigo-600"],
          ["Publicadas", publicadas, CheckCircle, "bg-green-50 text-green-600"],
        ] satisfies ColoredStatCard[]).map(([label, value, Icon, color]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-[#0d2b5e]">{value}</div>
            <div className="text-gray-500 text-sm mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {mostrarFormulario && (puedeCrearVacante || vacanteEditando) && (
        <form onSubmit={crearVacante} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="font-bold text-[#0d2b5e] mb-4">{vacanteEditando ? "Editar vacante" : "Nueva vacante"}</h3>
          {vacanteEditando?.estado_vacante === "Rechazada" && (
            <div className="mb-4 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">
              Vacante rechazada. Puedes corregir la información y reenviarla a revisión.
            </div>
          )}
          {vacanteEditando?.estado_vacante === "Con observaciones" && (
            <div className="mb-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm text-yellow-800">
              Vacante con observaciones. Corrige la información solicitada y reenvíala.
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-4">
            <input
              value={form.titulo}
              onChange={(event) => setForm({ ...form, titulo: event.target.value })}
              required
              placeholder="Título del proyecto"
              className="border rounded-xl px-3 py-2 text-sm outline-none focus:border-[#1565c0]"
            />

            <div className="border rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-700">
              <div className="text-xs text-gray-500">Convocatoria seleccionada</div>
              <div className="font-semibold text-[#0d2b5e]">
                {convocatoriaSeleccionada ? `${convocatoriaSeleccionada.nombre} (${convocatoriaSeleccionada.tipo_periodo})` : "Sin convocatoria"}
              </div>
            </div>

            <div className="md:col-span-2 border rounded-xl p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-[#0d2b5e]">Tipos de práctica y cupos</div>
                  <p className="text-xs text-gray-500">Puedes registrar hasta 3 cupos iniciales. Si necesitas más, primero crea la vacante y luego solicita ampliación.</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${cuposExcedidos ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                  Cupos iniciales: {cuposIniciales} / 3
                </span>
              </div>
              <div className="grid md:grid-cols-3 gap-3 mt-4">
                {tiposPractica.map((tipo) => {
                  const seleccionado = form.tipos_practica.find((item) => item.id_tipo_practica === tipo.id_tipo_practica);
                  return (
                    <label key={tipo.id_tipo_practica} className="border rounded-xl p-3 text-sm flex flex-col gap-3">
                      <span className="flex items-center gap-2 font-semibold text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(seleccionado)}
                          onChange={() => alternarTipoPractica(tipo.id_tipo_practica)}
                        />
                        {tipo.nombre}
                      </span>
                      {seleccionado && (
                        <input
                          type="number"
                          min={1}
                          value={seleccionado.cupos}
                          onChange={(event) => actualizarCuposTipo(tipo.id_tipo_practica, Number(event.target.value))}
                          className="border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#1565c0]"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              {cuposExcedidos && (
                <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  El máximo inicial permitido es de 3 cupos. Para solicitar más, envía una solicitud de ampliación a Coordinación de Unidades.
                </div>
              )}
            </div>

            <div className="md:col-span-2 border rounded-xl p-4">
              <label className="flex items-center gap-2 text-sm font-bold text-[#0d2b5e]">
                <input
                  type="checkbox"
                  checked={form.aplica_todas_carreras}
                  onChange={(event) => setForm({ ...form, aplica_todas_carreras: event.target.checked, ids_carrera: [] })}
                />
                Todas las carreras compatibles
              </label>
              <p className="text-xs text-gray-500 mt-1">
                {!convocatoriaSeleccionada
                  ? "Selecciona una convocatoria para ver las carreras compatibles."
                  : form.aplica_todas_carreras
                    ? `La vacante sera visible para carreras activas ${convocatoriaSeleccionada.tipo_periodo.toLowerCase()}s.`
                    : `Se mostraran unicamente carreras ${convocatoriaSeleccionada.tipo_periodo.toLowerCase()}s.`}
              </p>
              {!form.aplica_todas_carreras && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                  {!convocatoriaSeleccionada && (
                    <div className="sm:col-span-2 lg:col-span-3 text-xs text-gray-500 border rounded-lg px-3 py-2">
                      Selecciona una convocatoria para ver las carreras compatibles.
                    </div>
                  )}
                  {convocatoriaSeleccionada && carrerasCompatibles.length === 0 && (
                    <div className="sm:col-span-2 lg:col-span-3 text-xs text-red-600 border border-red-100 bg-red-50 rounded-lg px-3 py-2">
                      No hay carreras compatibles con esta convocatoria.
                    </div>
                  )}
                  {carrerasCompatibles.map((carrera) => (
                    <label key={carrera.id_carrera} className="border rounded-lg px-3 py-2 text-xs flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={form.ids_carrera.includes(carrera.id_carrera)}
                        onChange={() => alternarCarrera(carrera.id_carrera)}
                      />
                      {carrera.nombre}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 border rounded-xl p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-[#1565c0] mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-bold text-[#0d2b5e]">Plan de Trabajo</div>
                  <p className="text-xs text-gray-500 mt-1">
                    Descarga el formato institucional, complétalo y súbelo para enviar tu vacante a revisión.
                  </p>
                  <button
                    type="button"
                    onClick={descargarFormatoPlanTrabajo}
                    className="mt-3 inline-flex items-center gap-2 border border-[#1565c0] text-[#1565c0] rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar formato
                  </button>
                  {vacanteEditando?.plan_trabajo && !archivoPlanTrabajo && (
                    <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                      Plan actual: {vacanteEditando.plan_trabajo.nombre_archivo}
                    </div>
                  )}
                  <label className="mt-3 block">
                    <span className="text-xs font-semibold text-gray-600">Plan de Trabajo lleno</span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(event) => setArchivoPlanTrabajo(event.target.files?.[0] ?? null)}
                      className="mt-1 block w-full text-sm"
                    />
                  </label>
                  {archivoPlanTrabajo && (
                    <div className="mt-2 text-xs text-[#0d2b5e] bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                      Archivo seleccionado: {archivoPlanTrabajo.name}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <textarea
              value={form.descripcion}
              onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
              placeholder="Descripción de la vacante"
              rows={3}
              className="md:col-span-2 border rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-[#1565c0]"
            />
            <textarea
              value={form.actividades}
              onChange={(event) => setForm({ ...form, actividades: event.target.value })}
              placeholder="Actividades"
              rows={3}
              className="border rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-[#1565c0]"
            />
            <textarea
              value={form.requisitos}
              onChange={(event) => setForm({ ...form, requisitos: event.target.value })}
              placeholder="Requisitos"
              rows={3}
              className="border rounded-xl px-3 py-2 text-sm outline-none resize-none focus:border-[#1565c0]"
            />
          </div>

          {erroresFormulario.length > 0 && (
            <div className="mt-5 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-sm text-yellow-800">
              <div className="font-semibold">No se puede guardar porque falta:</div>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                {erroresFormulario.map((mensaje) => (
                  <li key={mensaje}>{mensaje}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-5">
            <button
              type="button"
              onClick={() => {
                setMostrarFormulario(false);
                setVacanteEditando(null);
                setArchivoPlanTrabajo(null);
              }}
              className="border border-gray-200 text-gray-600 rounded-xl px-4 py-2 text-sm font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando || erroresFormulario.length > 0}
              className="bg-[#1565c0] text-white rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {guardando ? "Guardando..." : vacanteEditando ? "Guardar y reenviar a revisión" : "Crear y enviar a revisión"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="border rounded-xl px-3 py-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            className="outline-none text-sm w-full"
            placeholder="Buscar por proyecto, convocatoria, periodo o tipo de práctica..."
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Vacantes registradas</h3>
        </div>

        <div className="divide-y divide-gray-100">
          {vacantesFiltradas.map((vacante: VacanteUnidad) => {
            const tiposVacante = vacante.tipos_practica ?? [];
            const tieneAmpliacionPendiente = (vacante.solicitudes_ampliacion ?? []).some((solicitud) => solicitud.estado === "Pendiente");
            const puedeSolicitarAmpliacion =
              ["Pendiente", "PrePadron", "Activa"].includes(vacante.estado_vacante) &&
              !tieneAmpliacionPendiente;
            const puedeCorregir = ["Rechazada", "Con observaciones", "Pendiente"].includes(vacante.estado_vacante);
            const puedeReenviar = ["Rechazada", "Con observaciones"].includes(vacante.estado_vacante);

            return (
            <div key={vacante.id_vacante} className="px-6 py-5 hover:bg-gray-50">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="font-bold text-gray-800 text-sm">{vacante.titulo}</h4>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-semibold ${estadoVacanteClase(vacante.estado_vacante)}`}
                    >
                      {estadoVacanteTexto(vacante.estado_vacante)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 mt-0.5">
                    {[vacante.convocatoria ?? `Convocatoria #${vacante.id_convocatoria}`, vacante.periodo ?? "Periodo por convocatoria"].join(" · ")}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {tiposVacante.map((tipo) => (
                      <span key={tipo.id_tipo_practica} className="text-xs bg-blue-50 text-blue-700 rounded-full px-3 py-1">
                        {tipo.nombre ?? "Tipo de práctica"}: {tipo.cupos} cupo{tipo.cupos === 1 ? "" : "s"}
                        {typeof tipo.cupos_disponibles === "number" ? ` · ${tipo.cupos_disponibles} disp.` : ""}
                      </span>
                    ))}
                    <span className="text-xs bg-gray-100 text-gray-700 rounded-full px-3 py-1">
                      {vacante.aplica_todas_carreras
                        ? "Todas las carreras"
                        : (vacante.carreras?.map((carrera) => carrera.nombre).join(", ") || "Carreras específicas")}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mt-3">
                    {vacante.descripcion ?? "Sin descripción registrada."}
                  </p>

                  {(vacante.actividades || vacante.requisitos) && (
                    <div className="grid md:grid-cols-2 gap-3 mt-4">
                      {vacante.actividades && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                          <div className="text-xs font-semibold text-gray-500">Actividades</div>
                          <p className="text-sm text-gray-600 mt-1">{vacante.actividades}</p>
                        </div>
                      )}
                      {vacante.requisitos && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                          <div className="text-xs font-semibold text-gray-500">Requisitos</div>
                          <p className="text-sm text-gray-600 mt-1">{vacante.requisitos}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid sm:grid-cols-3 gap-3 mt-4">
                    <div className="border rounded-xl p-3">
                      <div className="text-xs text-gray-500">Cupos totales</div>
                      <div className="font-bold text-[#0d2b5e]">
                        {(vacante.tipos_practica ?? []).reduce((totalTipos, tipo) => totalTipos + tipo.cupos, 0)}
                      </div>
                    </div>
                    <div className="border rounded-xl p-3">
                      <div className="text-xs text-gray-500">Periodo</div>
                      <div className="font-bold text-[#0d2b5e]">{vacante.periodo ?? "Sin periodo"}</div>
                    </div>
                    <div className="border rounded-xl p-3">
                      <div className="text-xs text-gray-500">Estado</div>
                      <div className="font-bold text-[#0d2b5e]">{estadoVacanteTexto(vacante.estado_vacante)}</div>
                    </div>
                  </div>
                  {vacante.observaciones && (
                    <div className="mt-3 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2">
                      Observaciones de Coordinación: {vacante.observaciones}
                    </div>
                  )}
                  <div className={`mt-3 text-xs rounded-xl px-3 py-2 border ${vacante.plan_trabajo ? "text-green-700 bg-green-50 border-green-100" : "text-red-700 bg-red-50 border-red-100"}`}>
                    Plan de Trabajo: {vacante.plan_trabajo ? vacante.plan_trabajo.nombre_archivo : "Pendiente de subir"}
                  </div>
                  {tieneAmpliacionPendiente && (
                    <div className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                      Ampliación pendiente de revisión por Coordinación de Unidades.
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2 md:min-w-44">
                  {puedeCorregir && (
                    <button
                      type="button"
                      onClick={() => editarVacante(vacante)}
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar vacante
                    </button>
                  )}
                  {puedeReenviar && vacante.plan_trabajo && (
                    <button
                      type="button"
                      onClick={() => reenviarVacante(vacante)}
                      disabled={guardando}
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-green-200 text-green-700 rounded-lg text-xs font-semibold hover:bg-green-50 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Reenviar a revisión
                    </button>
                  )}
                  {puedeSolicitarAmpliacion && (
                    <button
                      type="button"
                      onClick={() => abrirModalAmpliacion(vacante)}
                      className="flex items-center justify-center gap-2 px-4 py-2 border border-[#1565c0] text-[#1565c0] rounded-lg text-xs font-semibold hover:bg-blue-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Solicitar más cupos
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirDetalleVacante(vacante)}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-[#0d2b5e] text-white rounded-lg text-xs font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Detalle
                  </button>
                </div>
              </div>
            </div>
            );
          })}

          {vacantesFiltradas.length === 0 && (
            <div className="px-6 py-10 text-center">
              <Briefcase className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-sm text-gray-500">No hay vacantes registradas.</div>
              <div className="text-xs text-gray-400 mt-1">
                {puedeCrearVacante
                  ? "Puedes registrar una nueva vacante desde el botón superior."
                  : puedeSeleccionarConvocatoria
                    ? "Selecciona una convocatoria desde el botón superior."
                    : "Completa los requisitos institucionales para registrar una vacante."}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
