import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  LogIn,
} from "lucide-react";

import logoInstitucional from "../../../assets/Logo1.png";
import { loginUseCase } from "../../dependencies";
import { getApiErrorMessage } from "../../../shared/utils/apiError";
import { obtenerRutaInicioPorRol, obtenerRutaInicioSesionGuardada } from "../../routes/authSession";

export function LoginPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const rutaSesion = obtenerRutaInicioSesionGuardada();
    if (rutaSesion) {
      navigate(rutaSesion, { replace: true });
      return;
    }
  }, [navigate]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await loginUseCase.execute({
        correo: email,
        password,
      });

      localStorage.removeItem("token");
      localStorage.removeItem("usuario");
      sessionStorage.setItem("token", response.access_token);
      sessionStorage.setItem("usuario", JSON.stringify(response));
      sessionStorage.setItem(
        "notificaciones:mostrar-al-iniciar",
        String(response.id_usuario),
      );

      if (response.rol === "Alumno" && response.debe_cambiar_password === true) {
        navigate("/cambiar-password-inicial", { replace: true });
        return;
      }

      const ruta = obtenerRutaInicioPorRol(response.rol, response.id_rol);

      navigate(ruta, { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, "Correo o contrasena incorrectos"));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d2b5e] via-[#1565c0] to-[#1976d2] flex flex-col">
      <div className="px-6 py-5 flex items-center justify-between">
        <button
          onClick={() => {
            const rutaSesion = obtenerRutaInicioSesionGuardada();
            navigate(rutaSesion ?? "/", { replace: Boolean(rutaSesion) });
          }}
          className="flex items-center gap-2 text-white/80 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Regresar
        </button>

        <div className="flex items-center gap-2 text-white">
          <div className="w-14 h-14 bg-white rounded-lg overflow-hidden">
            <img
              src={logoInstitucional}
              alt="UNACH"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-bold text-sm">UNACH - Practicas Profesionales</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-[#0d2b5e] px-8 py-8 text-center">
              <div className="w-28 h-28 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 overflow-hidden">
                <img
                  src={logoInstitucional}
                  alt="UNACH"
                  className="w-full h-full object-contain"
                />
              </div>

              <h1 className="text-white font-bold text-2xl">Iniciar Sesion</h1>

              <p className="text-blue-200 text-sm mt-1">
                Sistema Integral de Practicas Profesionales
              </p>
            </div>

            <div className="px-8 py-8">
              {!showRecovery ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Correo Institucional
                    </label>

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="usuario@unach.mx"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#1565c0] text-sm transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contrasena
                    </label>

                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#1565c0] text-sm pr-12 transition-colors"
                      />

                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="w-full py-3.5 bg-[#0d2b5e] text-white rounded-xl font-bold hover:bg-[#1565c0] transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                  >
                    <LogIn className="w-5 h-5" />
                    {loading ? "Ingresando..." : "Iniciar Sesion"}
                  </button>

                  <button
                    onClick={() => setShowRecovery(true)}
                    className="w-full text-center text-sm text-[#1565c0] hover:underline"
                  >
                    Olvidaste tu contrasena?
                  </button>

                  <div className="border-t border-gray-100 pt-4 text-center">
                    <span className="text-sm text-gray-500">
                      Problemas de acceso? Contacta a tu coordinador.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="text-center">
                    <h2 className="font-bold text-xl text-[#0d2b5e]">
                      Recuperar Contrasena
                    </h2>

                    <p className="text-gray-500 text-sm mt-1">
                      Ingresa tu correo institucional para recibir un enlace de recuperacion.
                    </p>
                  </div>

                  {!recoverySent ? (
                    <>
                      <input
                        type="email"
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                        placeholder="usuario@unach.mx"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#1565c0] text-sm"
                      />

                      <button
                        onClick={() => setRecoverySent(true)}
                        className="w-full py-3 bg-[#1565c0] text-white rounded-xl font-bold hover:bg-[#1976d2] transition-colors"
                      >
                        Enviar Enlace
                      </button>
                    </>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <div className="text-green-700 font-semibold text-sm">
                        Correo enviado
                      </div>

                      <div className="text-green-600 text-xs mt-1">
                        Revisa tu bandeja de entrada.
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowRecovery(false);
                      setRecoverySent(false);
                    }}
                    className="w-full text-center text-sm text-gray-500 hover:text-gray-700"
                  >
                    Volver al inicio de sesion
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
