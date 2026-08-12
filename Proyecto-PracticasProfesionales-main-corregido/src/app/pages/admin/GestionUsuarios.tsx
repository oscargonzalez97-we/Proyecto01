import { Fragment, useEffect, useState } from "react";
import { Users, Search, Plus, Edit2, Trash2, UserX, KeyRound, Download, Copy } from "lucide-react";
import { gestionUsuariosUseCase } from "../../dependencies";
import { apiClient } from "../../../infrastructure/api/apiClient";
import { obtenerCarreras, obtenerTiposPractica } from "../../../infrastructure/catalogos/catalogosApi";

type Usuario = {
  id_usuario: number;
  id_rol: number;
  rol?: string | null;
  nombre?: string | null;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  correo: string;
  estado: string;
  debe_cambiar_password?: boolean;
  tipo_perfil?: string;
  id_perfil?: number | null;
  puede_eliminar_definitivamente?: boolean;
  relaciones?: string[];
};

type ResetPasswordResultado = {
  correo: string;
  id_rol: number;
  debe_cambiar_password: boolean;
  password_temporal: string | null;
  mensaje: string;
  correo_enviado?: boolean;
  advertencia_correo?: string | null;
};

type PerfilEditable = Record<string, string | number | null>;

type CarreraCatalogo = {
  id_carrera: number;
  nombre: string;
  tipo_periodo?: string;
};

type TipoPracticaCatalogo = {
  id_tipo_practica: number;
  nombre: string;
};

const roles: Record<number, string> = {
  1: "Alumno",
  2: "Administrador",
  3: "Coordinador de Practicas",
  4: "Coordinador de Unidades Receptoras",
  5: "Unidad Receptora",
  6: "Asesor Interno",
  7: "Direccion",
};

function mensajeCorreoUsuario(
  accion: "creado" | "reset",
  correoEnviado?: boolean,
  advertencia?: string | null,
) {
  if (correoEnviado) {
    return accion === "creado"
      ? "Usuario creado y correo de acceso enviado."
      : "Contrasena restablecida y correo enviado.";
  }
  if (advertencia) {
    return accion === "creado"
      ? `Usuario creado. ${advertencia}`
      : `Contrasena restablecida. ${advertencia}`;
  }
  return accion === "creado"
    ? "Usuario creado, pero no se envi? correo."
    : "Contrasena restablecida, pero no se envi? correo.";
}

const rolC: Record<string, string> = {
  Alumno: "bg-blue-100 text-blue-700",
  Administrador: "bg-red-100 text-red-700",
  "Coordinador de Practicas": "bg-purple-100 text-purple-700",
  "Coordinador de Unidades Receptoras": "bg-indigo-100 text-indigo-700",
  "Unidad Receptora": "bg-green-100 text-green-700",
  "Asesor Interno": "bg-teal-100 text-teal-700",
  Direccion: "bg-orange-100 text-orange-700",
};

const ordenRoles = [2, 3, 4, 6, 7, 5, 1];

const rolGrupoC: Record<string, string> = {
  Alumno: "bg-blue-50 text-blue-800 border-blue-200",
  Administrador: "bg-red-50 text-red-800 border-red-200",
  "Coordinador de Practicas": "bg-purple-50 text-purple-800 border-purple-200",
  "Coordinador de Unidades Receptoras": "bg-indigo-50 text-indigo-800 border-indigo-200",
  "Unidad Receptora": "bg-green-50 text-green-800 border-green-200",
  "Asesor Interno": "bg-teal-50 text-teal-800 border-teal-200",
  Direccion: "bg-orange-50 text-orange-800 border-orange-200",
};

function extraerMensajeError(error: unknown, mensajeDefault: string) {
  if (typeof error !== "object" || error === null) return mensajeDefault;
  const response = (error as { response?: { data?: unknown } }).response;
  const data = response?.data;

  if (typeof data === "string") return data;
  if (typeof data !== "object" || data === null) return mensajeDefault;

  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const mensajes = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          const msg = (item as { msg?: unknown; message?: unknown }).msg ??
            (item as { message?: unknown }).message;
          return typeof msg === "string" ? msg : JSON.stringify(item);
        }
        return String(item);
      })
      .filter(Boolean);
    if (mensajes.length > 0) return mensajes.join("\n");
  }
  if (typeof detail === "object" && detail !== null) {
    const mensaje = (detail as { mensaje?: unknown; message?: unknown }).mensaje ??
      (detail as { message?: unknown }).message;
    if (typeof mensaje === "string") return mensaje;
    return JSON.stringify(detail);
  }

  const mensaje = (data as { mensaje?: unknown; message?: unknown }).mensaje ??
    (data as { message?: unknown }).message;
  return typeof mensaje === "string" ? mensaje : mensajeDefault;
}

function esNumeroValido(valor: string) {
  if (valor.trim() === "") return false;
  const numero = Number(valor);
  return Number.isFinite(numero);
}

export function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<Usuario | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<"Todos" | "Activo" | "Inactivo">("Todos");
  const [perfilTipo, setPerfilTipo] = useState("");
  const [perfilEditar, setPerfilEditar] = useState<PerfilEditable>({});
  const [cargandoPerfil, setCargandoPerfil] = useState(false);
  const [resetResultado, setResetResultado] = useState<ResetPasswordResultado | null>(null);
  const [carreras, setCarreras] = useState<CarreraCatalogo[]>([]);
  const [tiposPractica, setTiposPractica] = useState<TipoPracticaCatalogo[]>([]);

  const [nuevoUsuario, setNuevoUsuario] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    correo: "",
    password: "",
    id_rol: 4,
    id_carrera: "",
    id_tipo_practica: "",
    matricula: "",
    semestre: "",
    grupo: "",
    creditos_aprobados: "",
    periodo_practica: "",
    departamento: "",
    cargo: "",
    telefono: "",
  });

  useEffect(() => {
    cargarUsuarios();
    cargarCatalogosPerfil();
  }, []);

  async function cargarUsuarios() {
    const data = await gestionUsuariosUseCase.listar();
    setUsuarios(data);
  }

  async function cargarCatalogosPerfil() {
    try {
      const [carrerasData, tiposData] = await Promise.all([
        obtenerCarreras(),
        obtenerTiposPractica(),
      ]);
      setCarreras(carrerasData);
      setTiposPractica(tiposData);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCrearUsuario() {
    try {
      const errores: string[] = [];
      const esAlumno = Number(nuevoUsuario.id_rol) === 1;

      if (!nuevoUsuario.nombre.trim()) errores.push("El nombre es obligatorio.");
      if (!esAlumno && !nuevoUsuario.apellido_paterno.trim()) errores.push("El apellido paterno es obligatorio.");
      if (!nuevoUsuario.correo.trim()) errores.push("El correo es obligatorio.");
      if (!nuevoUsuario.password.trim()) errores.push("La contraseña es obligatoria.");

      if (esAlumno) {
        if (carreras.length === 0) errores.push("No hay carreras activas. Primero registra una carrera en Catálogos.");
        if (tiposPractica.length === 0) errores.push("No hay tipos de práctica activos. Primero registra un tipo de práctica en Catálogos.");
        if (!nuevoUsuario.matricula.trim()) errores.push("La matrícula es obligatoria para Alumno.");
        if (!nuevoUsuario.id_carrera) errores.push("La carrera es obligatoria para Alumno.");
        if (!nuevoUsuario.id_tipo_practica) errores.push("El tipo de práctica es obligatorio para Alumno.");
        if (!esNumeroValido(nuevoUsuario.semestre)) errores.push("El semestre debe ser un número válido.");
        if (!nuevoUsuario.grupo.trim()) errores.push("El grupo es obligatorio para Alumno.");
        if (!esNumeroValido(nuevoUsuario.creditos_aprobados)) errores.push("Los créditos aprobados deben ser un número válido.");
      }

      if (errores.length > 0) {
        alert(errores.join("\n"));
        return;
      }

      const carreraSeleccionada = carreras.find(
        (carrera) => carrera.id_carrera === Number(nuevoUsuario.id_carrera),
      ) as (CarreraCatalogo & { tipo_periodo?: string }) | undefined;

      const respuesta = await gestionUsuariosUseCase.crear({
        ...nuevoUsuario,
        id_rol: Number(nuevoUsuario.id_rol),
        id_carrera: nuevoUsuario.id_carrera ? Number(nuevoUsuario.id_carrera) : null,
        id_tipo_practica: nuevoUsuario.id_tipo_practica ? Number(nuevoUsuario.id_tipo_practica) : null,
        semestre: nuevoUsuario.semestre ? Number(nuevoUsuario.semestre) : null,
        creditos_aprobados: nuevoUsuario.creditos_aprobados ? Number(nuevoUsuario.creditos_aprobados) : 0,
        periodo_practica: nuevoUsuario.periodo_practica || carreraSeleccionada?.tipo_periodo || "",
      });

      setShowCreate(false);

      setNuevoUsuario({
        nombre: "",
        apellido_paterno: "",
        apellido_materno: "",
        correo: "",
        password: "",
        id_rol: 4,
        id_carrera: "",
        id_tipo_practica: "",
        matricula: "",
        semestre: "",
        grupo: "",
        creditos_aprobados: "",
        periodo_practica: "",
        departamento: "",
        cargo: "",
        telefono: "",
      });

      await cargarUsuarios();
      alert(mensajeCorreoUsuario("creado", respuesta.correo_enviado, respuesta.advertencia_correo));
    } catch (error) {
      console.error(error);
      alert(extraerMensajeError(error, "Error al crear usuario"));
    }
  }

  async function handleCambiarEstado(usuario: Usuario) {
    const esActivo = usuario.estado === "Activo";
    const confirmar = window.confirm(
      esActivo
        ? "Este usuario sera desactivado y no podra iniciar sesion. Sus registros historicos se conservaran. Deseas continuar?"
        : "Este usuario volvera a estar activo y podra iniciar sesion con su contrasena actual. Deseas continuar?"
    );

    if (!confirmar) return;

    try {
      await gestionUsuariosUseCase.cambiarEstado(usuario.id_usuario);
      await cargarUsuarios();
    } catch (error) {
      console.error(error);
      alert(extraerMensajeError(error, "Error al cambiar estado"));
    }
  }

  async function handleEliminarDefinitivamente(usuario: Usuario) {
    const confirmar = window.confirm(
      usuario.id_rol === 1
        ? (
            "Se eliminara definitivamente al alumno y todos sus registros asociados: "
            + "documentos, asignaciones, horas, reportes, evaluaciones y notificaciones. "
            + "La operacion se realizara en una sola transaccion y no se puede deshacer. Deseas continuar?"
          )
        : (
            "Se eliminara definitivamente este usuario y su perfil. "
            + "Las referencias de revision se desvincularan y sus notificaciones, evaluaciones u observaciones propias se eliminaran. "
            + "Esta accion no se puede deshacer. Deseas continuar?"
          )
    );

    if (!confirmar) return;

    try {
      await gestionUsuariosUseCase.eliminarDefinitivamente(usuario.id_usuario);
      await cargarUsuarios();
    } catch (error) {
      console.error(error);
      alert(extraerMensajeError(error, "Error al eliminar definitivamente el usuario"));
    }
  }

  async function abrirEdicion(usuarioBase: Usuario) {
    setUsuarioEditar({ ...usuarioBase });
    setPerfilTipo("");
    setPerfilEditar({});
    setShowEdit(true);

    try {
      setCargandoPerfil(true);
      const perfil = await gestionUsuariosUseCase.obtenerPerfil(usuarioBase.id_usuario);
      const datosPerfil = (perfil.datos ?? {}) as PerfilEditable;
      setPerfilTipo(perfil.tipo);
      setUsuarioEditar({
        ...usuarioBase,
        nombre: typeof datosPerfil.nombre === "string" ? datosPerfil.nombre : usuarioBase.nombre,
        apellido_paterno: typeof datosPerfil.apellido_paterno === "string" ? datosPerfil.apellido_paterno : usuarioBase.apellido_paterno,
        apellido_materno: typeof datosPerfil.apellido_materno === "string" ? datosPerfil.apellido_materno : usuarioBase.apellido_materno,
        correo: perfil.usuario?.correo ?? usuarioBase.correo,
        estado: perfil.usuario?.estado ?? usuarioBase.estado,
      });
      setPerfilEditar(datosPerfil);
    } catch (error) {
      console.error(error);
      setPerfilTipo("Sin perfil editable");
    } finally {
      setCargandoPerfil(false);
    }
  }

  async function handleResetPassword(usuario: Usuario) {
    const confirmar = window.confirm(`Deseas resetear la contrasena de ${usuario.correo}?`);
    if (!confirmar) return;

    try {
      const response = await apiClient.post<ResetPasswordResultado>(
        `/usuarios/${usuario.id_usuario}/reset-password`
      );
      if (response.data.correo_enviado) {
        alert(mensajeCorreoUsuario("reset", true));
      } else {
        setResetResultado(response.data);
        if (!response.data.password_temporal) {
          alert(mensajeCorreoUsuario("reset", false, response.data.advertencia_correo));
        }
      }
      await cargarUsuarios();
    } catch (error) {
      console.error(error);
      alert(extraerMensajeError(error, "Error al resetear contrasena"));
    }
  }

  function descargarCredencialReset() {
    if (!resetResultado?.password_temporal) return;
    const contenido = [
      "correo,password_temporal",
      `"${resetResultado.correo}","${resetResultado.password_temporal}"`,
    ].join("\n");
    const blob = new Blob([contenido], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "credencial_temporal.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function cerrarResetPassword() {
    setResetResultado((actual) =>
      actual ? { ...actual, password_temporal: null } : null
    );
    setResetResultado(null);
  }

  async function handleActualizarUsuario() {
    if (!usuarioEditar) return;

    try {
      await gestionUsuariosUseCase.actualizarPerfil(usuarioEditar.id_usuario, {
        nombre: usuarioEditar.nombre,
        apellido_paterno: usuarioEditar.apellido_paterno ?? "",
        apellido_materno: usuarioEditar.apellido_materno ?? "",
        correo: usuarioEditar.correo,
        ...normalizarPerfilParaGuardar(usuarioEditar.id_rol, perfilEditar),
      });

      setShowEdit(false);
      setUsuarioEditar(null);
      await cargarUsuarios();
      alert("Perfil actualizado correctamente.");
    } catch (error) {
      console.error(error);
      alert(extraerMensajeError(error, "Error al actualizar perfil"));
    }
  }

  const filtrados = usuarios
    .filter((u) => {
      const nombreCompleto = `${u.nombre} ${u.apellido_paterno ?? ""} ${
        u.apellido_materno ?? ""
      }`;

      const rol = roles[u.id_rol] ?? "Sin rol";

      const coincideBusqueda =
        nombreCompleto.toLowerCase().includes(q.toLowerCase()) ||
        u.correo.toLowerCase().includes(q.toLowerCase()) ||
        rol.toLowerCase().includes(q.toLowerCase());

      return (filtroEstado === "Todos" || u.estado === filtroEstado) && coincideBusqueda;
    })
    .sort((a, b) => {
      const posicionRolA = ordenRoles.indexOf(a.id_rol);
      const posicionRolB = ordenRoles.indexOf(b.id_rol);
      const ordenRolA = posicionRolA === -1 ? ordenRoles.length : posicionRolA;
      const ordenRolB = posicionRolB === -1 ? ordenRoles.length : posicionRolB;
      if (ordenRolA !== ordenRolB) return ordenRolA - ordenRolB;

      const nombreA = `${a.nombre ?? ""} ${a.apellido_paterno ?? ""} ${a.apellido_materno ?? ""}`.trim();
      const nombreB = `${b.nombre ?? ""} ${b.apellido_paterno ?? ""} ${b.apellido_materno ?? ""}`.trim();
      return (
        nombreA.localeCompare(nombreB, "es", { sensitivity: "base" }) ||
        a.correo.localeCompare(b.correo, "es", { sensitivity: "base" })
      );
    });

  function perfilEsEditable(idRol: number) {
    return [1, 3, 4, 5, 6].includes(idRol);
  }

  function setCampoPerfil(campo: string, valor: string | number | null) {
    setPerfilEditar((actual) => ({
      ...actual,
      [campo]: valor,
    }));
  }

  function numeroONulo(valor: unknown) {
    if (valor === "" || valor === null || valor === undefined) return null;
    const numero = Number(valor);
    return Number.isNaN(numero) ? null : numero;
  }

  function texto(valor: unknown) {
    return typeof valor === "string" || typeof valor === "number"
      ? String(valor)
      : "";
  }

  function normalizarPerfilParaGuardar(idRol: number, perfil: PerfilEditable) {
    if (idRol === 1) {
      return {
        id_carrera: numeroONulo(perfil.id_carrera),
        matricula: texto(perfil.matricula),
        semestre: numeroONulo(perfil.semestre),
        grupo: texto(perfil.grupo),
        id_tipo_practica: numeroONulo(perfil.id_tipo_practica),
        creditos_aprobados: numeroONulo(perfil.creditos_aprobados),
      };
    }

    if (idRol === 3 || idRol === 4) {
      return {
        area: texto(perfil.area),
        departamento: texto(perfil.departamento),
      };
    }

    if (idRol === 5) {
      return {
        cargo: texto(perfil.cargo),
        telefono: texto(perfil.telefono),
      };
    }

    if (idRol === 6) {
      return {
        departamento: texto(perfil.departamento),
      };
    }

    return {};
  }

  function renderInputPerfil(
    label: string,
    campo: string,
    type: "text" | "number" = "text"
  ) {
    return (
      <label className="block">
        <span className="block text-xs font-semibold text-gray-500 mb-1">
          {label}
        </span>
        <input
          type={type}
          value={texto(perfilEditar[campo])}
          onChange={(e) =>
            setCampoPerfil(
              campo,
              type === "number" ? numeroONulo(e.target.value) : e.target.value
            )
          }
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
        />
      </label>
    );
  }

  function renderSelectPerfil(
    label: string,
    campo: string,
    opciones: Array<{ value: number; label: string }>
  ) {
    return (
      <label className="block">
        <span className="block text-xs font-semibold text-gray-500 mb-1">
          {label}
        </span>
        <select
          value={texto(perfilEditar[campo])}
          onChange={(e) => setCampoPerfil(campo, numeroONulo(e.target.value))}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm bg-white"
        >
          <option value="">Selecciona...</option>
          {opciones.map((opcion) => (
            <option key={opcion.value} value={opcion.value}>
              {opcion.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  function renderCamposPerfil() {
    if (!usuarioEditar) return null;

    if (cargandoPerfil) {
      return (
        <div className="text-sm text-gray-500">
          Cargando datos del perfil...
        </div>
      );
    }

    if (!perfilEsEditable(usuarioEditar.id_rol)) {
      return (
        <div className="text-sm text-gray-500">
          Este rol solo tiene datos generales de acceso.
        </div>
      );
    }

    if (usuarioEditar.id_rol === 1) {
      return (
        <div className="grid sm:grid-cols-2 gap-4">
          {renderSelectPerfil(
            "Carrera",
            "id_carrera",
            carreras.map((carrera) => ({
              value: carrera.id_carrera,
              label: carrera.nombre,
            }))
          )}
          {renderInputPerfil("Matrícula", "matricula")}
          {renderInputPerfil("Semestre", "semestre", "number")}
          {renderInputPerfil("Grupo", "grupo")}
          {renderSelectPerfil(
            "Tipo de práctica",
            "id_tipo_practica",
            tiposPractica.map((tipo) => ({
              value: tipo.id_tipo_practica,
              label: tipo.nombre,
            }))
          )}
          {renderInputPerfil("Créditos aprobados", "creditos_aprobados", "number")}
        </div>
      );
    }

    if (usuarioEditar.id_rol === 3 || usuarioEditar.id_rol === 4) {
      return (
        <div className="grid sm:grid-cols-2 gap-4">
          {renderInputPerfil("Área", "?rea")}
          {renderInputPerfil("Departamento", "departamento")}
        </div>
      );
    }

    if (usuarioEditar.id_rol === 5) {
      return (
        <div className="space-y-5">
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
              Responsable
            </h5>
            <div className="grid sm:grid-cols-2 gap-4">
              {renderInputPerfil("Cargo del responsable", "cargo")}
              {renderInputPerfil("Teléfono del responsable", "telefono")}
            </div>
          </div>

          <div>
            <h5 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
              Empresa asociada
            </h5>
            <div className="grid sm:grid-cols-2 gap-3 rounded-xl bg-gray-50 border border-gray-200 p-4 text-sm">
              <div>
                <div className="text-xs font-semibold text-gray-500">Empresa</div>
                <div className="font-semibold text-[#0d2b5e]">{texto(perfilEditar.nombre_empresa) || "Sin empresa"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500">RFC</div>
                <div className="font-semibold text-[#0d2b5e]">{texto(perfilEditar.rfc) || "Sin RFC"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500">Correo de contacto</div>
                <div className="font-semibold text-[#0d2b5e] break-all">{texto(perfilEditar.correo_contacto) || "Sin correo"}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500">Estado de empresa</div>
                <div className="font-semibold text-[#0d2b5e]">{texto(perfilEditar.estado_empresa) || "Sin estado"}</div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-gray-50 border border-gray-200 p-3 text-xs text-gray-500">
              La empresa, RFC, convenio, documentos, vacantes y padrón se administran desde sus flujos correspondientes.
            </div>
          </div>
        </div>
      );
    }

    if (usuarioEditar.id_rol === 6) {
      return (
        <div className="grid sm:grid-cols-2 gap-4">
          {renderInputPerfil("Departamento", "departamento")}
        </div>
      );
    }

    return null;
  }

  function etiquetaNombreGeneral(usuario: Usuario) {
    if (usuario.id_rol === 1) return "Nombre completo";
    return usuario.id_rol === 5 ? "Nombre del responsable" : "Nombre";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0d2b5e]">
            Gestión de Usuarios
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {usuarios.length} usuarios en el sistema
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#0d2b5e] text-white rounded-xl text-sm font-semibold hover:bg-[#1565c0] transition-colors shadow"
        >
          <Plus className="w-4 h-4" />
          Crear Usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
        <div className="grid md:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

            <input
              type="text"
              placeholder="Buscar usuario, correo o rol..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#1565c0]"
            />
          </div>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as "Todos" | "Activo" | "Inactivo")}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-600"
          >
            <option value="Todos">Todos</option>
            <option value="Activo">Activos</option>
            <option value="Inactivo">Inactivos</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#1565c0]" />

          <h3 className="font-bold text-[#0d2b5e]">
            Directorio de Usuarios
          </h3>

          <span className="ml-auto text-xs text-gray-400">
            {filtrados.length} resultados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {["Nombre", "Correo", "Rol", "Estado", "Acciones"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {filtrados.map((u, index) => {
                const nombreBase = u.nombre ?? "Sin nombre";
                const nombreCompleto = `${nombreBase} ${
                  u.apellido_paterno ?? ""
                } ${u.apellido_materno ?? ""}`.trim();

                const rol = roles[u.id_rol] ?? "Sin rol";
                const estadoActivo = u.estado === "Activo";
                const puedeEliminar = Boolean(u.puede_eliminar_definitivamente);
                const relaciones = u.relaciones ?? [];
                const iniciaGrupo = index === 0 || filtrados[index - 1].id_rol !== u.id_rol;
                const cantidadEnGrupo = filtrados.filter((usuario) => usuario.id_rol === u.id_rol).length;
                const colorGrupo = rolGrupoC[rol] || "bg-gray-50 text-gray-700 border-gray-200";

                return (
                  <Fragment key={u.id_usuario}>
                    {iniciaGrupo && (
                      <tr>
                        <td colSpan={5} className={`px-6 py-3 border-y ${colorGrupo}`}>
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-bold">{rol}</span>
                            <span className="ml-auto text-xs font-semibold opacity-70">
                              {cantidadEnGrupo} {cantidadEnGrupo === 1 ? "usuario" : "usuarios"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${rolC[rol] || "bg-gray-100 text-gray-600"}`}>
                          {nombreBase.charAt(0)}
                        </div>

                        <span className="text-sm font-medium text-gray-800">
                          {nombreCompleto}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-500">
                      {u.correo}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          rolC[rol] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {rol}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-semibold ${
                          estadoActivo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            estadoActivo ? "bg-green-500" : "bg-gray-400"
                          }`}
                        />

                        {estadoActivo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => abrirEdicion(u)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg inline-flex items-center gap-1"
                          title="Editar perfil"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Editar perfil
                        </button>

                        <button
                          onClick={() => handleCambiarEstado(u)}
                          className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"
                          title={estadoActivo ? "Desactivar usuario" : "Reactivar usuario"}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleResetPassword(u)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Resetear contrasena"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleEliminarDefinitivamente(u)}
                          disabled={!puedeEliminar}
                          className={`p-1.5 rounded-lg ${
                            puedeEliminar
                              ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                              : "text-gray-300 cursor-not-allowed"
                          }`}
                          title={
                            puedeEliminar
                              ? "Eliminar definitivamente"
                              : `Este usuario tiene registros asociados. Solo puede desactivarse.${relaciones.length ? ` Relaciones: ${relaciones.join(", ")}` : ""}`
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#0d2b5e] mb-6">
              Crear Nuevo Usuario
            </h3>

            <div className="space-y-4">
              <input
                type="text"
                placeholder={nuevoUsuario.id_rol === 1 ? "Nombre completo" : "Nombre"}
                value={nuevoUsuario.nombre}
                onChange={(e) =>
                  setNuevoUsuario({
                    ...nuevoUsuario,
                    nombre: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
              />

              {nuevoUsuario.id_rol !== 1 && (
                <>
                  <input
                    type="text"
                    placeholder="Apellido paterno"
                    value={nuevoUsuario.apellido_paterno}
                    onChange={(e) =>
                      setNuevoUsuario({
                        ...nuevoUsuario,
                        apellido_paterno: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                  />

                  <input
                    type="text"
                    placeholder="Apellido materno"
                    value={nuevoUsuario.apellido_materno}
                    onChange={(e) =>
                      setNuevoUsuario({
                        ...nuevoUsuario,
                        apellido_materno: e.target.value,
                      })
                    }
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                  />
                </>
              )}

              <input
                type="email"
                placeholder="Correo institucional"
                value={nuevoUsuario.correo}
                onChange={(e) =>
                  setNuevoUsuario({
                    ...nuevoUsuario,
                    correo: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
              />

              <input
                type="password"
                placeholder="Contraseña"
                value={nuevoUsuario.password}
                onChange={(e) =>
                  setNuevoUsuario({
                    ...nuevoUsuario,
                    password: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
              />

              <select
                value={nuevoUsuario.id_rol}
                onChange={(e) =>
                  setNuevoUsuario({
                    ...nuevoUsuario,
                    id_rol: Number(e.target.value),
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm bg-white"
              >
                {Object.entries(roles).map(([id, nombre]) => (
                  <option key={id} value={id}>
                    {nombre}
                  </option>
                ))}
              </select>

              {nuevoUsuario.id_rol === 1 && (
                <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                  <select
                    value={nuevoUsuario.id_carrera}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, id_carrera: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm bg-white"
                  >
                    <option value="">Selecciona carrera</option>
                    {carreras.map((carrera) => (
                      <option key={carrera.id_carrera} value={carrera.id_carrera}>
                        {carrera.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Matricula"
                    value={nuevoUsuario.matricula}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, matricula: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Semestre"
                      value={nuevoUsuario.semestre}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, semestre: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Grupo"
                      value={nuevoUsuario.grupo}
                      onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, grupo: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                    />
                  </div>
                  <select
                    value={nuevoUsuario.id_tipo_practica}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, id_tipo_practica: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm bg-white"
                  >
                    <option value="">Tipo de practica sin asignar</option>
                    {tiposPractica.map((tipo) => (
                      <option key={tipo.id_tipo_practica} value={tipo.id_tipo_practica}>
                        {tipo.nombre}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Creditos aprobados"
                    value={nuevoUsuario.creditos_aprobados}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, creditos_aprobados: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                  />
                </div>
              )}

              {[2, 3, 4, 6, 7].includes(nuevoUsuario.id_rol) && (
                <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <input
                    type="text"
                    placeholder="Departamento"
                    value={nuevoUsuario.departamento}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, departamento: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Cargo"
                    value={nuevoUsuario.cargo}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, cargo: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Telefono"
                    value={nuevoUsuario.telefono}
                    onChange={(e) => setNuevoUsuario({ ...nuevoUsuario, telefono: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCrearUsuario}
                className="flex-1 py-2.5 bg-[#0d2b5e] text-white rounded-xl text-sm font-bold hover:bg-[#1565c0]"
              >
                Crear Usuario
              </button>

              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && usuarioEditar && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#0d2b5e] mb-2">
              Editar perfil
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Este formulario edita los datos del perfil. La contrasena, estado y permisos se administran desde acciones separadas.
            </p>

            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
                <div>
                  <div className="text-xs font-semibold text-gray-500">Correo</div>
                  <div className="font-semibold text-[#0d2b5e] break-all">{usuarioEditar.correo}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500">Rol</div>
                  <div className="font-semibold text-[#0d2b5e]">{roles[usuarioEditar.id_rol] ?? "Sin rol"}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-gray-500">Estado</div>
                  <div className="font-semibold text-[#0d2b5e]">{usuarioEditar.estado}</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-bold text-[#0d2b5e] mb-3">
                  Datos generales
                </h4>
              </div>

              <label className="block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">
                  {etiquetaNombreGeneral(usuarioEditar)}
                </span>
              <input
                type="text"
                value={usuarioEditar.nombre ?? ""}
                onChange={(e) =>
                  setUsuarioEditar({
                    ...usuarioEditar,
                    nombre: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
              />
              </label>

              {usuarioEditar.id_rol !== 1 && (
                <>
                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1">Apellido paterno</span>
                    <input
                      type="text"
                      value={usuarioEditar.apellido_paterno ?? ""}
                      onChange={(e) =>
                        setUsuarioEditar({
                          ...usuarioEditar,
                          apellido_paterno: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-semibold text-gray-500 mb-1">Apellido materno</span>
                    <input
                      type="text"
                      value={usuarioEditar.apellido_materno ?? ""}
                      onChange={(e) =>
                        setUsuarioEditar({
                          ...usuarioEditar,
                          apellido_materno: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
                    />
                  </label>
                </>
              )}

              <label className="block">
                <span className="block text-xs font-semibold text-gray-500 mb-1">Correo</span>
              <input
                type="email"
                value={usuarioEditar.correo}
                onChange={(e) =>
                  setUsuarioEditar({
                    ...usuarioEditar,
                    correo: e.target.value,
                  })
                }
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm"
              />
              </label>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-[#0d2b5e]">
                    Datos de {perfilTipo || roles[usuarioEditar.id_rol]}
                  </h4>
                  <span className="text-xs text-gray-400">
                    Cambian según el rol
                  </span>
                </div>
                {renderCamposPerfil()}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleActualizarUsuario}
                className="flex-1 py-2.5 bg-[#0d2b5e] text-white rounded-xl text-sm font-bold hover:bg-[#1565c0]"
              >
                Guardar Cambios
              </button>

              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {resetResultado && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={cerrarResetPassword}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-xl text-[#0d2b5e] mb-3">
              Contrasena temporal
            </h3>
            <p className="text-sm text-gray-500">
              {resetResultado.password_temporal
                ? "Guarda esta contrasena ahora. No podra consultarse despues."
                : "La contrasena temporal fue generada, pero no se muestra en esta respuesta."}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Por seguridad, usa el correo enviado o habilita la visualizacion solo en QA/local.
            </p>

            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-xs text-gray-500">Correo</div>
              <div className="font-semibold text-[#0d2b5e]">{resetResultado.correo}</div>
              <div className="text-xs text-gray-500 mt-3">Contrasena temporal</div>
              <div className="font-mono font-bold text-lg text-[#0d2b5e]">
                {resetResultado.password_temporal ?? "No se muestra por seguridad"}
              </div>
            </div>

            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-[#0d2b5e]">
              {resetResultado.id_rol === 1
                ? "Este alumno debera cambiar la contrasena al iniciar sesion."
                : "Este usuario debera cambiar la contrasena al iniciar sesion."}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => resetResultado.password_temporal && navigator.clipboard?.writeText(resetResultado.password_temporal)}
                disabled={!resetResultado.password_temporal}
                className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Copy className="w-4 h-4" />
                Copiar
              </button>
              <button
                onClick={descargarCredencialReset}
                disabled={!resetResultado.password_temporal}
                className="flex-1 py-2.5 bg-[#0d2b5e] text-white rounded-xl text-sm font-bold hover:bg-[#1565c0] flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <Download className="w-4 h-4" />
                Descargar
              </button>
            </div>

            <button
              onClick={cerrarResetPassword}
              className="mt-3 w-full py-2.5 border-2 border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
