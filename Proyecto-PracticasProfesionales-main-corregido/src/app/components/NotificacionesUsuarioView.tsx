import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bell, Check, CheckCircle, Clock, Eye, Info, MessageSquare, X, XCircle } from "lucide-react";
import { gestionNotificacionesUseCase } from "../dependencies";
import type { Notificacion } from "../../domain/notificaciones/Notificacion";
import { normalizarTextoVisible } from "../../shared/utils/normalizarTextoVisible";

type Filtro = "todas" | "no_leidas";

type UsuarioSesion = {
  id_usuario?: number;
};

type Props = {
  titulo?: string;
  subtitulo?: string;
};

function obtenerIdUsuario() {
  const raw = sessionStorage.getItem("usuario");
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as UsuarioSesion).id_usuario ?? null;
  } catch {
    return null;
  }
}

function fechaCorta(fecha: string) {
  const value = new Date(fecha);
  if (Number.isNaN(value.getTime())) return fecha;
  return value.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function tipoVisual(notificacion: Notificacion) {
  const texto = normalizarTextoVisible(`${notificacion.titulo} ${notificacion.mensaje}`).toLowerCase();
  if (texto.includes("rechaz") || texto.includes("incidencia")) {
    return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-100" };
  }
  if (texto.includes("aprob") || texto.includes("liberacion") || texto.includes("emitida")) {
    return { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", border: "border-green-100" };
  }
  if (texto.includes("observ") || texto.includes("pendiente") || texto.includes("revisión")) {
    return { icon: AlertTriangle, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-100" };
  }
  return { icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" };
}

export function NotificacionesUsuarioView({ titulo = "Notificaciones", subtitulo = "Avisos y actividades recientes del sistema." }: Props) {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [seleccionada, setSeleccionada] = useState<Notificacion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const idUsuario = obtenerIdUsuario();

  async function cargar() {
    if (!idUsuario) {
      setError("No se encontró el usuario de la sesión actual.");
      setCargando(false);
      return;
    }
    try {
      setCargando(true);
      setError("");
      setNotificaciones(await gestionNotificacionesUseCase.listarPorUsuario(idUsuario));
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las notificaciones.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [idUsuario]); // eslint-disable-line react-hooks/exhaustive-deps -- cargar only reads the session user id.

  const noLeidas = notificaciones.filter((item) => !item.leida).length;
  const filtradas = useMemo(() => {
    return filtro === "no_leidas" ? notificaciones.filter((item) => !item.leida) : notificaciones;
  }, [filtro, notificaciones]);

  async function marcarLeida(notificacion: Notificacion) {
    if (notificacion.leida) return;
    setNotificaciones((actuales) =>
      actuales.map((item) => item.id_notificacion === notificacion.id_notificacion ? { ...item, leida: true } : item)
    );
    try {
      await gestionNotificacionesUseCase.marcarLeida(notificacion.id_notificacion);
      window.dispatchEvent(new Event("notificaciones:actualizadas"));
    } catch (err) {
      console.error(err);
      void cargar();
    }
  }

  async function marcarTodas() {
    if (!idUsuario) return;
    setNotificaciones((actuales) => actuales.map((item) => ({ ...item, leida: true })));
    try {
      await gestionNotificacionesUseCase.marcarTodas(idUsuario);
      window.dispatchEvent(new Event("notificaciones:actualizadas"));
    } catch (err) {
      console.error(err);
      void cargar();
    }
  }

  function abrirDetalle(notificacion: Notificacion) {
    setSeleccionada(notificacion);
    void marcarLeida(notificacion);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#0d2b5e]">{titulo}</h1>
          <p className="text-gray-500 text-sm mt-1">{subtitulo}</p>
        </div>

        {noLeidas > 0 && (
          <button onClick={marcarTodas} className="flex items-center gap-2 text-sm text-[#1565c0] hover:underline w-fit">
            <Check className="w-4 h-4" />
            Marcar todas como leídas
          </button>
        )}
      </div>

      {error && <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">{error}</div>}

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-blue-600 rounded-2xl p-5 text-white">
          <Bell className="w-6 h-6 mb-3 opacity-80" />
          <div className="text-2xl font-bold">{notificaciones.length}</div>
          <div className="text-white/80 text-sm">Total</div>
        </div>
        <div className="bg-yellow-500 rounded-2xl p-5 text-white">
          <AlertTriangle className="w-6 h-6 mb-3 opacity-80" />
          <div className="text-2xl font-bold">{noLeidas}</div>
          <div className="text-white/80 text-sm">Sin leer</div>
        </div>
        <div className="bg-green-600 rounded-2xl p-5 text-white">
          <CheckCircle className="w-6 h-6 mb-3 opacity-80" />
          <div className="text-2xl font-bold">{notificaciones.length - noLeidas}</div>
          <div className="text-white/80 text-sm">Leídas</div>
        </div>
      </div>

      <div className="flex gap-3">
        {[
          { k: "todas", l: "Todas" },
          { k: "no_leidas", l: `No leídas (${noLeidas})` },
        ].map((item) => (
          <button
            key={item.k}
            onClick={() => setFiltro(item.k as Filtro)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-colors ${filtro === item.k ? "bg-[#0d2b5e] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            {item.l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Actividad reciente</h3>
        </div>

        <div className="divide-y divide-gray-100">
          {cargando && <div className="p-10 text-center text-gray-400">Cargando notificaciones...</div>}
          {!cargando && filtradas.map((notificacion) => {
            const visual = tipoVisual(notificacion);
            const Icon = visual.icon;
            const tituloNormalizado = normalizarTextoVisible(notificacion.titulo);
            const mensajeNormalizado = normalizarTextoVisible(notificacion.mensaje);

            return (
              <div key={notificacion.id_notificacion} className={`p-5 hover:bg-gray-50 transition-colors ${!notificacion.leida ? "border-l-4 border-l-[#1565c0]" : ""}`}>
                <div className="flex gap-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${visual.bg} ${visual.border}`}>
                    <Icon className={`w-5 h-5 ${visual.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className={`font-semibold ${!notificacion.leida ? "text-[#0d2b5e]" : "text-gray-800"}`}>{tituloNormalizado}</h4>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{mensajeNormalizado}</p>
                      </div>
                      {!notificacion.leida && <span className="bg-[#1565c0] w-2 h-2 rounded-full flex-shrink-0 mt-2" />}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                      <div className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {fechaCorta(notificacion.fecha_envio)}
                      </div>

                      <div className="flex gap-3">
                        <button onClick={() => abrirDetalle(notificacion)} className="text-xs text-[#1565c0] hover:underline flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          Ver detalle
                        </button>
                        {!notificacion.leida && (
                          <button onClick={() => marcarLeida(notificacion)} className="text-xs text-[#1565c0] hover:underline">
                            Marcar como leída
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!cargando && filtradas.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <div>No hay notificaciones{filtro === "no_leidas" ? " sin leer" : ""}</div>
            </div>
          )}
        </div>
      </div>

      {seleccionada && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#0d2b5e]">Detalle de notificación</h2>
                <p className="text-sm text-gray-500 mt-1">{fechaCorta(seleccionada.fecha_envio)}</p>
              </div>
              <button onClick={() => setSeleccionada(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <div className="text-xs text-blue-500 font-semibold mb-2">Asunto</div>
                <div className="text-lg font-bold text-[#0d2b5e]">{normalizarTextoVisible(seleccionada.titulo)}</div>
              </div>

              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-sm font-bold text-[#0d2b5e] mb-3">
                  <MessageSquare className="w-5 h-5 text-[#1565c0]" />
                  Mensaje
                </div>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{normalizarTextoVisible(seleccionada.mensaje)}</p>
              </div>

              <div className="flex justify-end">
                <button onClick={() => setSeleccionada(null)} className="bg-[#0d2b5e] text-white rounded-xl px-5 py-2 text-sm font-semibold">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
