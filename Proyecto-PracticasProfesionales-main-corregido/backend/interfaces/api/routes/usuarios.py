from datetime import datetime
import secrets
import string

from app.services.auditoria_service import registrar_bitacora
from app.services.identidad_importacion_service import archivar_alumno
from fastapi import APIRouter, Depends,  HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from interfaces.api.schemas.usuario import UsuarioCreate, UsuarioEstadoUpdate, UsuarioResponse, UsuarioUpdate
from interfaces.api.schemas.usuario_perfil import UsuarioPerfilResponse, UsuarioPerfilUpdate
from infrastructure.database.dependencies import obtener_db
from infrastructure.email.email_service import (
    enviar_correo_reset_password,
    enviar_correo_usuario_creado,
    mostrar_password_temporal_en_respuesta,
)
from interfaces.api.service_factory import UsuarioService
from infrastructure.persistence.models.alumno import AlumnoModel
from infrastructure.persistence.models.bitacora_auditoria import BitacoraAuditoriaModel
from infrastructure.persistence.models.carrera import CarreraModel
from infrastructure.persistence.models.empresa import EmpresaModel
from infrastructure.persistence.models.evaluacion import EvaluacionModel
from infrastructure.persistence.models.incidencia_practica import IncidenciaPracticaModel
from infrastructure.persistence.models.notificacion import NotificacionModel
from infrastructure.persistence.models.observacion import ObservacionModel
from infrastructure.persistence.models.personal_interno import PersonalInternoModel
from infrastructure.persistence.models.responsable_empresa import ResponsableEmpresaModel
from infrastructure.persistence.models.rol import RolModel
from infrastructure.persistence.models.seleccion_empresa import SeleccionEmpresaModel
from infrastructure.persistence.models.solicitud_empresa import SolicitudEmpresaModel
from infrastructure.persistence.models.tipo_practica import TipoPracticaModel
from infrastructure.persistence.models.usuario import UsuarioModel
from infrastructure.security.auth_dependencies import obtener_usuario_actual, requerir_roles
from infrastructure.security.password import generar_password_hash


router = APIRouter(
    prefix="/usuarios",
    tags=["Usuarios"],
    dependencies=[Depends(requerir_roles(["Administrador"]))]
)

ROLES_CORREO_INSTITUCIONAL = {1, 2, 3, 4, 6, 7}
DOMINIO_INSTITUCIONAL = "@unach.mx"


def _obtener_usuario_model(db: Session, id_usuario: int):
    usuario = db.query(UsuarioModel).filter(
        UsuarioModel.id_usuario == id_usuario
    ).first()
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


def _perfil_tipo_por_rol(id_rol: int):
    return {
        1: "Alumno",
        2: "PersonalInterno",
        3: "PersonalInterno",
        4: "PersonalInterno",
        5: "Unidad Receptora",
        6: "PersonalInterno",
        7: "PersonalInterno",
    }.get(id_rol, "Sin perfil editable")


def _model_to_dict(model, campos):
    if model is None:
        return None
    return {campo: getattr(model, campo) for campo in campos}


def _limpiar_texto(valor):
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _usuario_perfil_base(usuario: UsuarioModel, tipo: str):
    nombre, apellido_paterno, apellido_materno, tipo_perfil, id_perfil = _datos_personales_usuario(usuario)
    return {
        "id_usuario": usuario.id_usuario,
        "correo": usuario.correo,
        "estado": usuario.estado,
        "rol": usuario.rol.nombre if usuario.rol else None,
        "tipo": tipo,
        "nombre": nombre,
        "apellido_paterno": apellido_paterno,
        "apellido_materno": apellido_materno,
        "tipo_perfil": tipo_perfil,
        "id_perfil": id_perfil,
    }


def _extraer_detalle_empresa(empresa: EmpresaModel | None, etiqueta: str):
    if empresa is None or not empresa.domicilio:
        return None
    prefijo = f"{etiqueta}:"
    for linea in empresa.domicilio.splitlines():
        texto = linea.strip()
        if texto.lower().startswith(prefijo.lower()):
            return texto[len(prefijo):].strip() or None
    return None


def _usuario_perfil_base_unidad(usuario: UsuarioModel, tipo: str, empresa: EmpresaModel | None):
    base = _usuario_perfil_base(usuario, tipo)
    return base


def _respuesta_perfil(tipo: str, usuario: dict, datos: dict | None):
    return {
        "tipo": tipo,
        "usuario": usuario,
        "perfil": datos,
        "datos": datos,
    }


def _generar_password_temporal(longitud: int = 12):
    caracteres = string.ascii_letters + string.digits + "!@#$%&*"
    return "".join(secrets.choice(caracteres) for _ in range(longitud))


def _validar_correo_disponible(db: Session, correo: str, id_usuario_actual: int):
    existente = (
        db.query(UsuarioModel)
        .filter(UsuarioModel.correo == correo)
        .filter(UsuarioModel.id_usuario != id_usuario_actual)
        .first()
    )
    if existente is not None:
        raise HTTPException(status_code=400, detail="El correo ya esta registrado")


def _validar_correo_institucional(correo: str, id_rol: int):
    if id_rol in ROLES_CORREO_INSTITUCIONAL and not correo.lower().endswith(DOMINIO_INSTITUCIONAL):
        raise HTTPException(
            status_code=400,
            detail="El correo de alumnos y personal debe terminar en @unach.mx",
        )


def _datos_personales_usuario(usuario: UsuarioModel):
    if usuario.alumno:
        return (
            usuario.alumno.nombre,
            usuario.alumno.apellido_paterno,
            usuario.alumno.apellido_materno,
            "Alumno",
            usuario.alumno.id_alumno,
        )
    if usuario.personal_interno:
        return (
            usuario.personal_interno.nombre,
            usuario.personal_interno.apellido_paterno,
            usuario.personal_interno.apellido_materno,
            "PersonalInterno",
            usuario.personal_interno.id_personal,
        )
    if usuario.responsable_empresa:
        return (
            usuario.responsable_empresa.nombre,
            usuario.responsable_empresa.apellido_paterno,
            usuario.responsable_empresa.apellido_materno,
            "ResponsableEmpresa",
            usuario.responsable_empresa.id_responsable,
        )
    return None, None, None, "SinPerfil", None


def _validar_matricula_disponible(db: Session, matricula: str, id_alumno_actual: int):
    existente = (
        db.query(AlumnoModel)
        .filter(AlumnoModel.matricula == matricula)
        .filter(AlumnoModel.id_alumno != id_alumno_actual)
        .first()
    )
    if existente is not None:
        raise HTTPException(status_code=400, detail="La matricula ya esta registrada")


def _validar_rfc_disponible(db: Session, rfc: str | None, id_empresa_actual: int):
    if not rfc:
        return

    existente = (
        db.query(EmpresaModel)
        .filter(EmpresaModel.rfc == rfc)
        .filter(EmpresaModel.id_empresa != id_empresa_actual)
        .first()
    )
    if existente is not None:
        raise HTTPException(status_code=400, detail="El RFC ya esta registrado")


def _existe_relacion(db: Session, modelo, campo, valor):
    try:
        return db.query(modelo).filter(campo == valor).first() is not None
    except SQLAlchemyError:
        db.rollback()
        return False


def obtener_relaciones_usuario(db: Session, id_usuario: int):
    relaciones = []
    revisiones = [
        ("Alumno", AlumnoModel, AlumnoModel.id_usuario),
        ("Responsable de empresa", ResponsableEmpresaModel, ResponsableEmpresaModel.id_usuario),
        ("Personal interno", PersonalInternoModel, PersonalInternoModel.id_usuario),
        ("Bitacora de auditoria", BitacoraAuditoriaModel, BitacoraAuditoriaModel.id_usuario),
        ("Incidencias", IncidenciaPracticaModel, IncidenciaPracticaModel.id_usuario_reportante),
        ("Notificaciones", NotificacionModel, NotificacionModel.id_usuario),
        ("Solicitudes de empresa revisadas", SolicitudEmpresaModel, SolicitudEmpresaModel.revisada_por),
    ]

    for nombre, modelo, campo in revisiones:
        if _existe_relacion(db, modelo, campo, id_usuario):
            relaciones.append(nombre)

    return {
        "puede_eliminar": len(relaciones) == 0,
        "relaciones": relaciones,
    }



def _eliminar_registros_alumno(db: Session, id_usuario: int):
    alumno = db.query(AlumnoModel).filter(AlumnoModel.id_usuario == id_usuario).first()
    if alumno is None:
        raise HTTPException(status_code=404, detail="El perfil de alumno no existe.")

    parametros = {"id_usuario": id_usuario, "id_alumno": alumno.id_alumno}
    total_eliminados = 0

    def eliminar(sql: str):
        nonlocal total_eliminados
        resultado = db.execute(text(sql), parametros)
        if resultado.rowcount and resultado.rowcount > 0:
            total_eliminados += resultado.rowcount

    asignaciones_alumno = "SELECT id_asignacion FROM asignacion WHERE id_alumno = :id_alumno"
    expedientes_alumno = "SELECT id_expediente FROM expediente_alumno WHERE id_alumno = :id_alumno"
    documentos_alumno = (
        "SELECT id_documento_alumno FROM documento_alumno "
        f"WHERE id_expediente IN ({expedientes_alumno})"
    )

    # Documentos y observaciones del expediente.
    eliminar(
        "DELETE FROM observacion_documento_alumno "
        f"WHERE id_documento_alumno IN ({documentos_alumno})"
    )
    eliminar(
        "DELETE FROM documento_alumno "
        f"WHERE id_expediente IN ({expedientes_alumno})"
    )

    # Seguimiento, reportes, evaluaciones y cierre asociados a sus asignaciones.
    eliminar(
        "DELETE FROM evaluacion_alumno_empresa "
        f"WHERE id_alumno = :id_alumno OR id_asignacion IN ({asignaciones_alumno})"
    )
    eliminar(
        "DELETE FROM evaluacion_practica "
        f"WHERE id_asignacion IN ({asignaciones_alumno}) OR id_usuario_evaluador = :id_usuario"
    )
    eliminar("DELETE FROM horas_practica " f"WHERE id_asignacion IN ({asignaciones_alumno})")
    eliminar(
        "DELETE FROM incidencia_practica "
        f"WHERE id_asignacion IN ({asignaciones_alumno}) OR id_usuario_reportante = :id_usuario"
    )
    eliminar("DELETE FROM liberacion_practica " f"WHERE id_asignacion IN ({asignaciones_alumno})")
    eliminar("DELETE FROM reporte_practica " f"WHERE id_asignacion IN ({asignaciones_alumno})")

    # Proceso académico del alumno.
    eliminar("DELETE FROM expediente_alumno WHERE id_alumno = :id_alumno")
    eliminar("DELETE FROM seleccion_empresa WHERE id_alumno = :id_alumno")
    eliminar("DELETE FROM alumno_proceso_practica WHERE id_alumno = :id_alumno")
    eliminar("DELETE FROM asignacion WHERE id_alumno = :id_alumno")
    eliminar("DELETE FROM notificacion WHERE id_usuario = :id_usuario")
    eliminar("DELETE FROM observacion_documento_alumno WHERE id_usuario = :id_usuario")

    referencias_opcionales = [
        ("alumno_proceso_practica", "creado_por"),
        ("alumno_proceso_practica", "actualizado_por"),
        ("asignacion", "asignado_por"),
        ("bitacora_auditoria", "id_usuario"),
        ("documento_alumno", "revisado_por"),
        ("documento_empresa", "revisado_por"),
        ("documento_vacante", "revisado_por"),
        ("formato_documento_alumno", "subido_por"),
        ("formato_empresa", "subido_por"),
        ("formato_plan_trabajo_vacante", "subido_por"),
        ("horas_practica", "revisado_por"),
        ("incidencia_practica", "id_usuario_reportante"),
        ("liberacion_practica", "emitido_por"),
        ("participacion_empresa_convocatoria", "revisada_por"),
        ("reporte_practica", "revisado_por"),
        ("responsable_empresa", "id_usuario"),
        ("seleccion_empresa", "revisado_por"),
        ("solicitud_ampliacion_cupos_vacante", "revisada_por"),
        ("solicitud_empresa", "revisada_por"),
        ("vacante", "revisada_por"),
    ]
    for tabla, columna in referencias_opcionales:
        existe = db.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla AND COLUMN_NAME = :columna"
            ),
            {"tabla": tabla, "columna": columna},
        ).scalar()
        if existe:
            db.execute(
                text(f"UPDATE {tabla} SET {columna} = NULL WHERE {columna} = :id_usuario"),
                parametros,
            )

    eliminar("DELETE FROM alumno WHERE id_alumno = :id_alumno")
    return total_eliminados


def _eliminar_registros_usuario_no_alumno(db: Session, id_usuario: int):
    parametros = {"id_usuario": id_usuario}
    total_modificados = 0

    def ejecutar(sql: str):
        nonlocal total_modificados
        resultado = db.execute(text(sql), parametros)
        if resultado.rowcount and resultado.rowcount > 0:
            total_modificados += resultado.rowcount

    referencias_opcionales = [
        ("alumno_proceso_practica", "creado_por"),
        ("alumno_proceso_practica", "actualizado_por"),
        ("asignacion", "asignado_por"),
        ("bitacora_auditoria", "id_usuario"),
        ("documento_alumno", "revisado_por"),
        ("documento_empresa", "revisado_por"),
        ("documento_vacante", "revisado_por"),
        ("formato_documento_alumno", "subido_por"),
        ("formato_empresa", "subido_por"),
        ("formato_plan_trabajo_vacante", "subido_por"),
        ("horas_practica", "revisado_por"),
        ("incidencia_practica", "id_usuario_reportante"),
        ("liberacion_practica", "emitido_por"),
        ("participacion_empresa_convocatoria", "revisada_por"),
        ("reporte_practica", "revisado_por"),
        ("responsable_empresa", "id_usuario"),
        ("seleccion_empresa", "revisado_por"),
        ("solicitud_ampliacion_cupos_vacante", "revisada_por"),
        ("solicitud_empresa", "revisada_por"),
        ("vacante", "revisada_por"),
    ]
    for tabla, columna in referencias_opcionales:
        existe = db.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.COLUMNS "
                "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :tabla AND COLUMN_NAME = :columna"
            ),
            {"tabla": tabla, "columna": columna},
        ).scalar()
        if existe:
            ejecutar(f"UPDATE {tabla} SET {columna} = NULL WHERE {columna} = :id_usuario")

    id_personal = db.execute(
        text("SELECT id_personal FROM personal_interno WHERE id_usuario = :id_usuario"),
        parametros,
    ).scalar()
    if id_personal is not None:
        resultado = db.execute(
            text("UPDATE asignacion SET id_asesor = NULL WHERE id_asesor = :id_personal"),
            {"id_personal": id_personal},
        )
        if resultado.rowcount and resultado.rowcount > 0:
            total_modificados += resultado.rowcount

    ejecutar("DELETE FROM evaluacion_practica WHERE id_usuario_evaluador = :id_usuario")
    ejecutar("DELETE FROM observacion_documento_alumno WHERE id_usuario = :id_usuario")
    ejecutar("DELETE FROM notificacion WHERE id_usuario = :id_usuario")
    ejecutar("DELETE FROM personal_interno WHERE id_usuario = :id_usuario")
    return total_modificados


def _es_administrador(usuario: UsuarioModel):
    return usuario.rol is not None and usuario.rol.nombre == "Administrador"


def _contar_administradores_activos(db: Session):
    return (
        db.query(UsuarioModel)
        .join(RolModel, RolModel.id_rol == UsuarioModel.id_rol)
        .filter(RolModel.nombre == "Administrador")
        .filter(UsuarioModel.estado == "Activo")
        .count()
    )


def _validar_no_es_ultimo_admin_activo(
    db: Session,
    usuario: UsuarioModel,
    mensaje: str,
):
    if usuario.estado == "Activo" and _es_administrador(usuario):
        admins_activos = _contar_administradores_activos(db)
        if admins_activos <= 1:
            raise HTTPException(status_code=409, detail=mensaje)


def _serializar_usuario(usuario: UsuarioModel, db: Session):
    relaciones = obtener_relaciones_usuario(db, usuario.id_usuario)
    nombre, apellido_paterno, apellido_materno, tipo_perfil, id_perfil = _datos_personales_usuario(usuario)
    return {
        "id_usuario": usuario.id_usuario,
        "id_rol": usuario.id_rol,
        "rol": usuario.rol.nombre if usuario.rol else None,
        "nombre": nombre,
        "apellido_paterno": apellido_paterno,
        "apellido_materno": apellido_materno,
        "correo": usuario.correo,
        "estado": usuario.estado,
        "debe_cambiar_password": bool(usuario.debe_cambiar_password),
        "tipo_perfil": tipo_perfil,
        "id_perfil": id_perfil,
        "puede_eliminar_definitivamente": True,
        "relaciones": relaciones["relaciones"],
    }


def _nombre_usuario(usuario: UsuarioModel):
    nombre, apellido_paterno, apellido_materno, _, _ = _datos_personales_usuario(usuario)
    return " ".join(parte for parte in [nombre, apellido_paterno, apellido_materno] if parte) or usuario.correo


def _nombre_rol(usuario: UsuarioModel):
    return usuario.rol.nombre if usuario.rol else f"Rol {usuario.id_rol}"


def _enviar_credenciales_admin(
    db: Session,
    usuario: UsuarioModel,
    password_temporal: str,
    usuario_actual: UsuarioModel,
    accion: str,
    mensaje_fallo: str,
):
    if usuario.estado == "Inactivo":
        registrar_bitacora(
            db,
            usuario_actual.id_usuario,
            "correo_deshabilitado",
            "usuarios",
            f"No se enviaron credenciales al usuario inactivo {usuario.correo}.",
            "usuario",
            usuario.id_usuario,
        )
        return False, "El usuario esta inactivo. No se envi? correo."

    resultado = (
        enviar_correo_reset_password(
            destinatario=usuario.correo,
            nombre=_nombre_usuario(usuario),
            correo_acceso=usuario.correo,
            password_temporal=password_temporal,
            rol=_nombre_rol(usuario),
        )
        if "reset" in accion.lower()
        else enviar_correo_usuario_creado(
            destinatario=usuario.correo,
            nombre=_nombre_usuario(usuario),
            correo_acceso=usuario.correo,
            password_temporal=password_temporal,
            rol=_nombre_rol(usuario),
        )
    )

    if resultado.enviado:
        registrar_bitacora(
            db,
            usuario_actual.id_usuario,
            "envio_correo_reset_password" if "reset" in accion.lower() else "envio_correo_usuario_creado",
            "usuarios",
            f"Se enviaron credenciales de acceso al usuario {usuario.correo}.",
            "usuario",
            usuario.id_usuario,
        )
        return True, None

    accion_bitacora = "correo_deshabilitado" if "deshabilitado" in (resultado.error or "").lower() else "error_envio_correo"
    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        accion_bitacora,
        "usuarios",
        f"No se pudieron enviar credenciales de acceso al usuario {usuario.correo}: {resultado.error}.",
        "usuario",
        usuario.id_usuario,
    )
    return False, resultado.advertencia or mensaje_fallo


def _crear_perfil_usuario_admin(db: Session, usuario: UsuarioModel, datos: UsuarioCreate):
    nombre = _limpiar_texto(datos.nombre)
    apellido_paterno = _limpiar_texto(datos.apellido_paterno)
    apellido_materno = _limpiar_texto(datos.apellido_materno)
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio")

    if usuario.id_rol == 1:
        nombre_completo = " ".join(
            parte for parte in [nombre, apellido_paterno, apellido_materno] if parte
        )
        if datos.id_carrera is None:
            raise HTTPException(status_code=400, detail="La carrera es obligatoria para Alumno")
        carrera = db.query(CarreraModel).filter(CarreraModel.id_carrera == datos.id_carrera).first()
        if carrera is None:
            raise HTTPException(status_code=400, detail="La carrera seleccionada no existe")
        if not _limpiar_texto(datos.matricula):
            raise HTTPException(status_code=400, detail="La matricula es obligatoria para Alumno")
        if datos.semestre is None:
            raise HTTPException(status_code=400, detail="El semestre es obligatorio para Alumno")
        if datos.id_tipo_practica is not None:
            tipo = db.query(TipoPracticaModel).filter(TipoPracticaModel.id_tipo_practica == datos.id_tipo_practica).first()
            if tipo is None:
                raise HTTPException(status_code=400, detail="El tipo de practica seleccionado no existe")

        alumno = AlumnoModel(
            id_usuario=usuario.id_usuario,
            nombre=nombre_completo,
            apellido_paterno=None,
            apellido_materno=None,
            matricula=_limpiar_texto(datos.matricula),
            id_carrera=datos.id_carrera,
            semestre=datos.semestre,
            grupo=_limpiar_texto(datos.grupo),
            creditos_aprobados=datos.creditos_aprobados or 0,
            id_tipo_practica=datos.id_tipo_practica,
            periodo_practica=datos.periodo_practica or carrera.tipo_periodo,
            telefono=_limpiar_texto(datos.telefono),
            estado_alumno="Activo",
        )
        db.add(alumno)
        db.commit()
        db.refresh(usuario)
        return

    if usuario.id_rol in (2, 3, 4, 6, 7):
        if not apellido_paterno:
            raise HTTPException(status_code=400, detail="El apellido paterno es obligatorio")
        personal = PersonalInternoModel(
            id_usuario=usuario.id_usuario,
            nombre=nombre,
            apellido_paterno=apellido_paterno,
            apellido_materno=apellido_materno,
            departamento=_limpiar_texto(datos.departamento),
            cargo=_limpiar_texto(datos.cargo),
            telefono=_limpiar_texto(datos.telefono),
        )
        db.add(personal)
        db.commit()
        db.refresh(usuario)
        return

    if usuario.id_rol == 5:
        raise HTTPException(
            status_code=400,
            detail="La Unidad Receptora se crea desde la aceptacion de solicitud de empresa.",
        )


@router.get(
    "/",
    response_model=list[UsuarioResponse]
)
def listar_usuarios(
    db: Session = Depends(obtener_db)
):
    return [_serializar_usuario(usuario, db) for usuario in UsuarioService(db).listar()]


@router.get("/{id_usuario}", response_model=UsuarioResponse)
def obtener_usuario(
    id_usuario: int,
    db: Session = Depends(obtener_db)
):
    usuario = UsuarioService(db).obtener_por_id(id_usuario)

    if usuario is None:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado"
        )

    return _serializar_usuario(usuario, db)


@router.get("/{id_usuario}/perfil", response_model=UsuarioPerfilResponse)
def obtener_perfil_usuario(
    id_usuario: int,
    db: Session = Depends(obtener_db)
):
    usuario = _obtener_usuario_model(db, id_usuario)
    tipo = _perfil_tipo_por_rol(usuario.id_rol)

    if usuario.id_rol == 1:
        datos = _model_to_dict(
            usuario.alumno,
            [
                "id_alumno",
                "id_usuario",
                "nombre",
                "apellido_paterno",
                "apellido_materno",
                "id_carrera",
                "id_tipo_practica",
                "matricula",
                "semestre",
                "grupo",
                "creditos_aprobados",
                "periodo_practica",
                "telefono",
                "estado_alumno",
            ],
        )
        return _respuesta_perfil(tipo, _usuario_perfil_base(usuario, tipo), datos)

    if usuario.id_rol in (2, 3, 4, 6, 7):
        datos = _model_to_dict(
            usuario.personal_interno,
            [
                "id_personal",
                "id_usuario",
                "nombre",
                "apellido_paterno",
                "apellido_materno",
                "departamento",
                "cargo",
                "telefono",
            ],
        )
        return _respuesta_perfil(tipo, _usuario_perfil_base(usuario, tipo), datos)

    if usuario.id_rol == 5:
        responsable = usuario.responsable_empresa
        empresa = responsable.empresa if responsable is not None else None
        datos = _model_to_dict(
            responsable,
            [
                "id_responsable",
                "id_usuario",
                "id_empresa",
                "nombre",
                "apellido_paterno",
                "apellido_materno",
                "cargo",
                "telefono",
                "correo",
            ],
        )
        if datos is not None and empresa is not None:
            datos["cargo"] = datos.get("cargo") or _extraer_detalle_empresa(empresa, "Cargo")
            datos["telefono"] = datos.get("telefono") or empresa.telefono
            datos.update(
                {
                    "nombre_empresa": empresa.nombre_empresa,
                    "rfc": empresa.rfc,
                    "giro": empresa.giro,
                    "domicilio": empresa.domicilio,
                    "telefono_empresa": empresa.telefono,
                    "correo_contacto": empresa.correo_contacto,
                    "estado_empresa": empresa.estado_empresa,
                    "tipo_tramite": empresa.tipo_tramite,
                }
            )

        return _respuesta_perfil(tipo, _usuario_perfil_base_unidad(usuario, tipo, empresa), datos)

    return _respuesta_perfil(tipo, _usuario_perfil_base(usuario, tipo), None)


@router.put("/{id_usuario}/perfil", response_model=UsuarioPerfilResponse)
def actualizar_perfil_usuario(
    id_usuario: int,
    datos: UsuarioPerfilUpdate,
    db: Session = Depends(obtener_db),
    usuario_actual: UsuarioModel = Depends(obtener_usuario_actual),
):
    usuario = _obtener_usuario_model(db, id_usuario)
    payload = datos.model_dump(exclude_unset=True)

    if "correo" in payload:
        correo = _limpiar_texto(payload["correo"])
        if not correo:
            raise HTTPException(status_code=400, detail="El correo es obligatorio")
        _validar_correo_institucional(correo, usuario.id_rol)
        _validar_correo_disponible(db, correo, id_usuario)
        usuario.correo = correo

    if usuario.id_rol == 1:
        perfil = usuario.alumno
        if perfil is None:
            raise HTTPException(
                status_code=400,
                detail="Este usuario no tiene un perfil asociado. Revisa su creacion o usa la opcion correspondiente para completar el perfil.",
            )

        if any(campo in payload for campo in ["nombre", "apellido_paterno", "apellido_materno"]):
            nombre = _limpiar_texto(payload.get("nombre", perfil.nombre))
            if not nombre:
                raise HTTPException(status_code=400, detail="El nombre es obligatorio")
            perfil.nombre = " ".join(
                parte
                for parte in [
                    nombre,
                    _limpiar_texto(payload.get("apellido_paterno")),
                    _limpiar_texto(payload.get("apellido_materno")),
                ]
                if parte
            )
            perfil.apellido_paterno = None
            perfil.apellido_materno = None

        if "matricula" in payload:
            matricula = _limpiar_texto(payload["matricula"])
            if not matricula:
                raise HTTPException(status_code=400, detail="La matricula es obligatoria")
            _validar_matricula_disponible(db, matricula, perfil.id_alumno)
            payload["matricula"] = matricula

        if "id_carrera" in payload:
            if payload["id_carrera"] is None:
                raise HTTPException(status_code=400, detail="La carrera seleccionada no existe")
            carrera = db.query(CarreraModel).filter(CarreraModel.id_carrera == payload["id_carrera"]).first()
            if carrera is None:
                raise HTTPException(status_code=400, detail="La carrera seleccionada no existe")

        if "id_tipo_practica" in payload:
            if payload["id_tipo_practica"] is None:
                raise HTTPException(status_code=400, detail="El tipo de practica seleccionado no existe")
            tipo_practica = (
                db.query(TipoPracticaModel)
                .filter(TipoPracticaModel.id_tipo_practica == payload["id_tipo_practica"])
                .first()
            )
            if tipo_practica is None:
                raise HTTPException(status_code=400, detail="El tipo de practica seleccionado no existe")

        for campo in [
            "id_carrera",
            "id_tipo_practica",
            "matricula",
            "semestre",
            "grupo",
            "creditos_aprobados",
            "periodo_practica",
            "telefono",
        ]:
            if campo in payload:
                setattr(perfil, campo, payload[campo])

    elif usuario.id_rol in (2, 3, 4, 6, 7):
        perfil = usuario.personal_interno
        if perfil is None:
            raise HTTPException(
                status_code=400,
                detail="Este usuario no tiene un perfil asociado. Revisa su creacion o usa la opcion correspondiente para completar el perfil.",
            )

        for campo in ["nombre", "apellido_paterno"]:
            if campo in payload:
                valor = _limpiar_texto(payload[campo])
                if not valor:
                    raise HTTPException(status_code=400, detail=f"{campo} es obligatorio")
                setattr(perfil, campo, valor)
        if "apellido_materno" in payload:
            perfil.apellido_materno = _limpiar_texto(payload["apellido_materno"])

        for campo in ["departamento", "cargo", "telefono"]:
            if campo in payload:
                setattr(perfil, campo, _limpiar_texto(payload[campo]))

    elif usuario.id_rol == 5:
        perfil = usuario.responsable_empresa
        if perfil is None:
            raise HTTPException(
                status_code=400,
                detail="Este usuario no tiene un perfil asociado. Revisa su creacion o usa la opcion correspondiente para completar el perfil.",
            )

        for campo in ["nombre", "apellido_paterno"]:
            if campo in payload:
                valor = _limpiar_texto(payload[campo])
                if not valor:
                    raise HTTPException(status_code=400, detail=f"{campo} es obligatorio")
                setattr(perfil, campo, valor)
        if "apellido_materno" in payload:
            perfil.apellido_materno = _limpiar_texto(payload["apellido_materno"])

        for campo in ["cargo", "telefono", "correo"]:
            if campo in payload:
                setattr(perfil, campo, _limpiar_texto(payload[campo]))

    db.commit()
    db.refresh(usuario)
    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        "Editar perfil",
        "usuarios",
        f"Admin edito el perfil del usuario {usuario.correo}",
        "usuario",
        usuario.id_usuario,
    )
    return obtener_perfil_usuario(id_usuario, db)


@router.post(
    "/",
    response_model=UsuarioResponse
)
def crear_usuario(
    usuario: UsuarioCreate,
    db: Session = Depends(obtener_db),
    usuario_actual: UsuarioModel = Depends(obtener_usuario_actual),
):
    if usuario.id_rol == 5:
        raise HTTPException(
            status_code=400,
            detail="La Unidad Receptora se crea desde la aceptacion de solicitud de empresa.",
        )
    nuevo_usuario = UsuarioService(db).crear(usuario)
    _crear_perfil_usuario_admin(db, nuevo_usuario, usuario)
    correo_enviado, advertencia_correo = _enviar_credenciales_admin(
        db,
        nuevo_usuario,
        usuario.password,
        usuario_actual,
        "Enviar credenciales",
        "La cuenta fue creada, pero no se pudo enviar el correo de acceso.",
    )
    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        "Crear usuario",
        "usuarios",
        f"Admin creo el usuario {nuevo_usuario.correo}",
        "usuario",
        nuevo_usuario.id_usuario,
    )
    respuesta = _serializar_usuario(nuevo_usuario, db)
    respuesta["correo_enviado"] = correo_enviado
    respuesta["advertencia_correo"] = advertencia_correo
    return respuesta


@router.post("/{id_usuario}/reset-password")
def resetear_password_usuario(
    id_usuario: int,
    db: Session = Depends(obtener_db),
    usuario_actual: UsuarioModel = Depends(obtener_usuario_actual),
):
    usuario = _obtener_usuario_model(db, id_usuario)
    if usuario.estado == "Inactivo":
        raise HTTPException(status_code=400, detail="No se puede resetear la contrasena de un usuario inactivo")
    password_temporal = _generar_password_temporal()
    usuario.password_hash = generar_password_hash(password_temporal)
    usuario.debe_cambiar_password = True
    usuario.fecha_reset_password = datetime.utcnow()
    db.commit()
    db.refresh(usuario)
    correo_enviado, advertencia_correo = _enviar_credenciales_admin(
        db,
        usuario,
        password_temporal,
        usuario_actual,
        "Enviar reset de contrasena",
        "La contrasena fue reseteada, pero no se pudo enviar el correo de acceso.",
    )
    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        "Resetear contrasena",
        "usuarios",
        f"Admin reseteo contrasena del usuario {usuario.correo}",
        "usuario",
        usuario.id_usuario,
    )

    return {
        "correo": usuario.correo,
        "id_rol": usuario.id_rol,
        "debe_cambiar_password": bool(usuario.debe_cambiar_password),
        "password_temporal": password_temporal if mostrar_password_temporal_en_respuesta() else None,
        "correo_enviado": correo_enviado,
        "advertencia_correo": advertencia_correo,
        "mensaje": "Guarda esta contrasena ahora. No podra consultarse despues."
    }

@router.patch("/{id_usuario}/estado", response_model=UsuarioResponse)
def cambiar_estado_usuario(
    id_usuario: int,
    datos: UsuarioEstadoUpdate | None = None,
    db: Session = Depends(obtener_db),
    usuario_actual: UsuarioModel = Depends(obtener_usuario_actual),
):
    usuario = _obtener_usuario_model(db, id_usuario)
    nuevo_estado = datos.estado if datos is not None else ("Inactivo" if usuario.estado == "Activo" else "Activo")

    if nuevo_estado not in {"Activo", "Inactivo"}:
        raise HTTPException(status_code=400, detail="Estado no permitido")

    if usuario.id_usuario == usuario_actual.id_usuario and nuevo_estado == "Inactivo":
        raise HTTPException(
            status_code=400,
            detail="No puedes desactivar tu propio usuario mientras estas en sesion.",
        )

    if nuevo_estado == "Inactivo":
        _validar_no_es_ultimo_admin_activo(
            db,
            usuario,
            "No puedes desactivar este usuario porque es el unico Administrador activo del sistema.",
        )

    usuario.estado = nuevo_estado
    db.commit()
    db.refresh(usuario)
    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        "Reactivar usuario" if nuevo_estado == "Activo" else "Desactivar usuario",
        "usuarios",
        f"Admin cambio el estado del usuario {usuario.correo} a {nuevo_estado}",
        "usuario",
        usuario.id_usuario,
    )
    return _serializar_usuario(usuario, db)

@router.delete("/{id_usuario}")
def eliminar_usuario(
    id_usuario: int,
    db: Session = Depends(obtener_db),
    usuario_actual: UsuarioModel = Depends(obtener_usuario_actual),
):
    usuario = _obtener_usuario_model(db, id_usuario)

    if usuario.id_usuario == usuario_actual.id_usuario:
        raise HTTPException(
            status_code=400,
            detail="No puedes desactivar tu propio usuario mientras estas en sesion.",
        )

    if usuario.estado == "Inactivo":
        return {"mensaje": "El usuario ya estaba inactivo."}

    _validar_no_es_ultimo_admin_activo(
        db,
        usuario,
        "No puedes desactivar este usuario porque es el unico Administrador activo del sistema.",
    )

    usuario.estado = "Inactivo"
    db.commit()
    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        "Desactivar usuario",
        "usuarios",
        f"Admin desactivo el usuario {usuario.correo}",
        "usuario",
        usuario.id_usuario,
    )
    return {"mensaje": "Usuario desactivado correctamente."}


@router.delete("/{id_usuario}/definitivo")
def eliminar_usuario_definitivamente(
    id_usuario: int,
    db: Session = Depends(obtener_db),
    usuario_actual: UsuarioModel = Depends(obtener_usuario_actual),
):
    usuario = _obtener_usuario_model(db, id_usuario)

    if usuario.id_usuario == usuario_actual.id_usuario:
        raise HTTPException(
            status_code=400,
            detail="No puedes eliminar definitivamente tu propio usuario.",
        )

    _validar_no_es_ultimo_admin_activo(
        db,
        usuario,
        "No puedes eliminar este usuario porque es el unico Administrador activo del sistema.",
    )

    correo = usuario.correo
    if usuario.id_rol == 1:
        try:
            alumno = db.query(AlumnoModel).filter(AlumnoModel.id_usuario == id_usuario).first()
            if alumno is None:
                raise HTTPException(status_code=404, detail="El perfil de alumno no existe.")
            archivar_alumno(db, alumno, usuario.correo)
            registros_eliminados = _eliminar_registros_alumno(db, id_usuario)
            db.query(UsuarioModel).filter(
                UsuarioModel.id_usuario == id_usuario
            ).delete(synchronize_session=False)
            db.commit()
        except HTTPException:
            db.rollback()
            raise
        except SQLAlchemyError as error:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=(
                    "No se pudo eliminar al alumno de forma segura. "
                    "La transaccion fue revertida y no se realizo ningun cambio."
                ),
            ) from error

        registrar_bitacora(
            db,
            usuario_actual.id_usuario,
            "Eliminar alumno con registros",
            "usuarios",
            f"Admin elimino al alumno de prueba {correo} y {registros_eliminados} registros asociados.",
            "usuario",
            id_usuario,
        )
        return {
            "mensaje": "Alumno y registros asociados eliminados correctamente.",
            "registros_eliminados": registros_eliminados,
        }

    try:
        registros_modificados = _eliminar_registros_usuario_no_alumno(db, id_usuario)
        db.query(UsuarioModel).filter(
            UsuarioModel.id_usuario == id_usuario
        ).delete(synchronize_session=False)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=(
                "No se pudo eliminar el usuario de forma segura. "
                "La transaccion fue revertida y no se realizo ningun cambio."
            ),
        ) from error

    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        "Eliminar usuario definitivo",
        "usuarios",
        (
            f"Admin elimino definitivamente el usuario {correo} y "
            f"desvinculo o elimino {registros_modificados} registros asociados."
        ),
        "usuario",
        id_usuario,
    )
    return {
        "mensaje": "Usuario eliminado definitivamente.",
        "registros_modificados": registros_modificados,
    }

@router.put("/{id_usuario}", response_model=UsuarioResponse)
def actualizar_usuario(
    id_usuario: int,
    datos: UsuarioUpdate,
    db: Session = Depends(obtener_db),
    usuario_actual: UsuarioModel = Depends(obtener_usuario_actual),
):
    usuario = UsuarioService(db).actualizar(id_usuario, datos)

    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    registrar_bitacora(
        db,
        usuario_actual.id_usuario,
        "Editar usuario",
        "usuarios",
        f"Admin edito datos generales del usuario {usuario.correo}",
        "usuario",
        usuario.id_usuario,
    )
    return _serializar_usuario(usuario, db)
