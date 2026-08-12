import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  AlertCircle,
  CheckCircle,
  Download,
  FileText,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";

import { gestionDocumentacionEmpresaUseCase } from "../../dependencies";
import type { DocumentacionEmpresaResponse, RequisitoEmpresa } from "../../../domain/empresa/DocumentacionEmpresa";
import { getApiErrorMessage } from "../../../shared/utils/apiError";
import { abrirVistaPreviaArchivo } from "../../../shared/utils/filePreview";

import type { ColoredStatCard } from "../../../shared/types/ui";
type UsuarioSesion = {
  perfil?: {
    id_empresa?: number;
  };
};

const estadoColor: Record<string, string> = {
  Aprobado: "bg-green-100 text-green-700",
  Pendiente: "bg-yellow-100 text-yellow-700",
  "En revisión": "bg-yellow-100 text-yellow-700",
  "En revision": "bg-yellow-100 text-yellow-700",
  Rechazado: "bg-red-100 text-red-700",
  Observado: "bg-orange-100 text-orange-700",
  "Con observaciones": "bg-orange-100 text-orange-700",
  Faltante: "bg-gray-100 text-gray-600",
};
const MAX_DOCUMENTO_BYTES = 2 * 1024 * 1024;
const ACCEPT_DOCUMENTOS = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

function esArchivoDocumentoPermitido(archivo: File) {
  return ["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(archivo.type) ||
    /\.(pdf|jpe?g|png|webp)$/i.test(archivo.name);
}

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

function archivoABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function esRequisitoConvenio(requisito: RequisitoEmpresa) {
  if (requisito.etapa === "Convenio") return true;
  const texto = `${requisito.nombre} ${requisito.descripcion ?? ""}`.toLowerCase();
  return texto.includes("convenio") || texto.includes("carta compromiso");
}

function esDocumentacionLegal(requisito: RequisitoEmpresa) {
  if (requisito.etapa) return requisito.etapa === "Documentacion";
  return !esRequisitoConvenio(requisito);
}

export function ConveniosUnidad() {
  const [datos, setDatos] = useState<DocumentacionEmpresaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [subiendo, setSubiendo] = useState<number | null>(null);

  const idEmpresa = obtenerIdEmpresa();

  useEffect(() => {
    void cargar();
  }, [idEmpresa]); // eslint-disable-line react-hooks/exhaustive-deps -- cargar only reads the current company id.

  async function cargar() {
    if (!idEmpresa) {
      setError("No se encontro la empresa asociada a esta sesion.");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError("");
      const respuesta = await gestionDocumentacionEmpresaUseCase.listarEmpresa(idEmpresa);
      setDatos(respuesta);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar la documentacion de la empresa.");
    } finally {
      setCargando(false);
    }
  }

  async function subirDocumento(requisito: RequisitoEmpresa, event: ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    if (!archivo || !idEmpresa) return;
    if (archivo.size > MAX_DOCUMENTO_BYTES) {
      setError("El archivo excede el límite máximo de 2 MB.");
      event.target.value = "";
      return;
    }
    if (!esArchivoDocumentoPermitido(archivo)) {
      setError("Tipo de archivo no permitido.");
      event.target.value = "";
      return;
    }

    try {
      setSubiendo(requisito.id_tipo_documento_empresa);
      setError("");
      const contenido = await archivoABase64(archivo);
      await gestionDocumentacionEmpresaUseCase.subirDocumento(idEmpresa, {
        id_tipo_documento_empresa: requisito.id_tipo_documento_empresa,
        nombre_archivo: archivo.name,
        contenido_base64: contenido,
        mime_type: archivo.type || null,
      });
      await cargar();
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo subir el documento."));
    } finally {
      setSubiendo(null);
      event.target.value = "";
    }
  }

  async function abrirFormato(idFormatoEmpresa: number, nombreArchivo?: string | null) {
    try {
      setError("");
      const blob = await gestionDocumentacionEmpresaUseCase.descargarFormato(idFormatoEmpresa);
      abrirVistaPreviaArchivo(blob, nombreArchivo ?? "formato_empresa.pdf");
    } catch (err) {
      console.error(err);
      setError(getApiErrorMessage(err, "No se pudo descargar el formato."));
    }
  }

  if (cargando) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center text-gray-500">
        Cargando documentacion empresarial...
      </div>
    );
  }

  const resumen = datos?.resumen;
  const documentacionLegal = datos?.documentos.filter(esDocumentacionLegal) ?? [];
  const requisitosConvenio = datos?.documentos.filter(esRequisitoConvenio) ?? [];
  const legalesObligatorios = documentacionLegal.filter(
    (requisito) => requisito.activo !== false && requisito.obligatorio,
  );
  const documentacionLegalAprobada =
    legalesObligatorios.length > 0 &&
    legalesObligatorios.every((requisito) => requisito.documento?.estado_documento === "Aprobado");

  function renderRequisito(requisito: RequisitoEmpresa, bloqueado = false) {
    const estado = requisito.documento?.estado_documento ?? "Faltante";
    const esperandoCorreccion = ["Rechazado", "Observado", "Con observaciones"].includes(estado);
    const observaciones = requisito.documento?.observaciones?.trim() || "";
    return (
      <div key={requisito.id_tipo_documento_empresa} className={`px-6 py-5 ${bloqueado ? "opacity-60" : "hover:bg-gray-50"}`}>
        <div className="flex flex-col xl:flex-row xl:items-start gap-5">
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-bold text-gray-800 text-sm">{requisito.nombre}</h4>
              <span className={`text-xs px-3 py-1 rounded-full font-semibold ${estadoColor[estado]}`}>
                {esperandoCorreccion ? "Esperando corrección" : estado}
              </span>
            </div>

            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">Indicaciones</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                {requisito.descripcion ?? "Documento requerido para el expediente de la empresa."}
              </p>
            </div>

            {esperandoCorreccion && (
              <div className="mt-3 text-xs text-orange-800 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                <p className="font-semibold">Esperando corrección</p>
                <p className="mt-1">Reemplaza el archivo para enviarlo nuevamente a revisión.</p>
                <p className="font-semibold mt-2">Observaciones de Coordinación</p>
                <p className="mt-1 whitespace-pre-wrap">{observaciones || "Sin observaciones registradas"}</p>
              </div>
            )}

            {esRequisitoConvenio(requisito) && (
              <div className="mt-3 text-xs text-green-700 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
                Este documento define la vigencia del convenio. Cuando coordinacion lo apruebe,
                quedara registrado como convenio vigente de la empresa.
              </div>
            )}

            <div className="text-xs text-gray-400 mt-3">
              Archivo actual: {requisito.documento?.nombre_archivo ?? "Sin documento cargado"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 xl:flex-col xl:w-48">
            {requisito.formato ? (
              <button
                onClick={() => abrirFormato(requisito.formato!.id_formato_empresa, requisito.formato!.nombre_archivo)}
                disabled={bloqueado}
                className="flex items-center justify-center gap-2 px-4 py-2 border border-blue-200 text-[#1565c0] rounded-lg text-xs font-semibold hover:bg-blue-50 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar formato
              </button>
            ) : (
              <div className="px-4 py-2 border border-gray-200 text-gray-500 rounded-lg text-xs text-center">
                {requisito.requiere_formato ? "Formato pendiente" : "No requiere formato"}
              </div>
            )}

            <label className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold ${bloqueado ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-[#0d2b5e] text-white hover:bg-[#1565c0] cursor-pointer"}`}>
              <Upload className="w-3.5 h-3.5" />
              {subiendo === requisito.id_tipo_documento_empresa
                ? "Subiendo..."
                : esperandoCorreccion
                  ? "Subir corrección"
                  : requisito.documento
                    ? "Reemplazar archivo"
                    : "Subir archivo"}
              <input
                type="file"
                accept={ACCEPT_DOCUMENTOS}
                className="hidden"
                disabled={bloqueado || subiendo === requisito.id_tipo_documento_empresa}
                onChange={(event) => subirDocumento(requisito, event)}
              />
            </label>
            <div className="text-[11px] text-gray-500 text-center">Máximo 2 MB por archivo.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {datos?.clasificacion_pendiente && (
        <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-4 text-sm">
          {datos.mensaje_clasificacion}
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-[#0d2b5e]">Documentacion de Alta</h1>
        <p className="text-gray-500 text-sm mt-1">
          Descarga formatos institucionales y carga los documentos requeridos para validar la unidad receptora.
        </p>
      </div>

      {error && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
          {error}
        </div>
      )}

      <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-2xl p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="font-bold text-xl">{datos?.empresa.nombre_empresa ?? "Empresa"}</div>
          <div className="text-green-100 text-sm mt-1">
            RFC: {datos?.empresa.rfc ?? "Sin RFC"} · Estado: {datos?.empresa.estado_empresa ?? "Pendiente"}
          </div>
        </div>

        <div className="bg-white/20 px-4 py-2 rounded-xl flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" />
          <div className="text-white font-bold text-sm">
            {datos?.empresa.estado_empresa === "Activa" ? "PADRON ACTIVO" : "EN VALIDACION"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {([
          ["Aprobados", resumen?.aprobados ?? 0, CheckCircle, "bg-green-50 text-green-600"],
          ["Pendientes", resumen?.pendientes ?? 0, AlertCircle, "bg-yellow-50 text-yellow-600"],
          ["Rechazados", resumen?.rechazados ?? 0, XCircle, "bg-red-50 text-red-600"],
          ["Faltantes", resumen?.faltantes ?? 0, FileText, "bg-gray-50 text-gray-600"],
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


      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Documentacion legal</h3>
        </div>

        <div className="divide-y divide-gray-100">
          {documentacionLegal.map((requisito) => renderRequisito(requisito))}
          {documentacionLegal.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400">No hay documentacion legal configurada.</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#1565c0]" />
          <h3 className="font-bold text-[#0d2b5e]">Convenio</h3>
        </div>

        {!documentacionLegalAprobada && (
          <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 text-sm text-[#0d2b5e]">
            El convenio se habilitara cuando Coordinacion apruebe tu documentacion legal.
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {requisitosConvenio.map((requisito) => renderRequisito(requisito, !documentacionLegalAprobada))}
          {requisitosConvenio.length === 0 && (
            <div className="px-6 py-8 text-center text-sm text-gray-400">No hay requisito de convenio configurado.</div>
          )}
        </div>
      </div>
    </div>
  );
}
