import React, { useState } from "react";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "firebase/auth";
import { auth } from "../firebase";
import { AlertTriangle, Key, Mail, ChevronRight, Copy, Check } from "lucide-react";

function UnauthorizedDomainError() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.hostname);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Clipboard copy failed", e);
    }
  };

  return (
    <div className="space-y-2 text-left">
      <p className="font-bold text-white">¡Dominio No Autorizado para Google Auth!</p>
      <p className="text-[11px] leading-relaxed text-red-300">
        El inicio con Google requiere que el dominio actual del simulador esté registrado en tus dominios autorizados de Firebase.
      </p>
      <div className="bg-black/45 p-3 rounded-lg border border-white/5 space-y-2 mt-1">
        <p className="font-mono text-[9px] text-primary-fixed-dim uppercase tracking-wider">PASOS DE AUTORIZACIÓN:</p>
        <ol className="list-decimal list-inside space-y-1 text-[11px] text-gray-300">
          <li>
            Ve al panel de tu proyecto en{" "}
            <a 
              href="https://console.firebase.google.com/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-primary-fixed-dim underline hover:text-white inline-flex items-center gap-0.5"
            >
              Firebase Console
            </a>.
          </li>
          <li>Ve a <strong>Authentication</strong> &rarr; pestaña <strong>Settings</strong> &rarr; sección <strong>Authorized Domains</strong>.</li>
          <li>Presiona <strong>Add Domain</strong> y pega el dominio del simulador:</li>
        </ol>
        
        <div className="flex items-center justify-between gap-2 mt-2 bg-black/80 px-2.5 py-1.5 rounded border border-white/10 overflow-hidden">
          <span className="font-mono text-[10.5px] text-emerald-400 font-bold truncate select-all">
            {window.location.hostname}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded  bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-gray-400 hover:text-white shrink-0 cursor-pointer flex items-center gap-1 text-[10px] font-mono"
            title="Copiar Dominio"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>
      <p className="text-[10px] text-on-surface-variant">
        * Nota: Puedes seguir utilizando el registro tradicional por <strong>Correo y Contraseña</strong> arriba de forma inmediata sin configurar dominios.
      </p>
    </div>
  );
}

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);

  // Translate Firebase errors to Spanish user-friendly messages
  const getErrorMessage = (errCode: string): React.ReactNode => {
    const code = String(errCode).toLowerCase();
    
    if (code.includes("unauthorized-domain") || code.includes("unauthorized_domain")) {
      return <UnauthorizedDomainError />;
    }

    switch (errCode) {
      case "auth/invalid-email":
        return "El correo electrónico introducido no es válido.";
      case "auth/user-disabled":
        return "Esta cuenta de usuario ha sido inhabilitada.";
      case "auth/user-not-found":
        return "No existe ninguna cuenta con este correo electrónico.";
      case "auth/wrong-password":
        return "La contraseña es incorrecta.";
      case "auth/email-already-in-use":
        return "Ya existe una cuenta con este correo electrónico.";
      case "auth/weak-password":
        return "La contraseña debe tener al menos 6 caracteres.";
      case "auth/invalid-credential":
        return "Credenciales incorrectas o caducadas. Comprueba los datos.";
      case "auth/popup-closed-by-user":
        return "La ventana de inicio con Google se ha cerrado antes de finalizar.";
      default:
        return "Ocurrió un error inesperado al autenticar en el servidor.";
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onAuthSuccess();
    } catch (err: any) {
      console.error("Email auth error:", err);
      setError(getErrorMessage(err.code || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError(null);
    setLoading(true);
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
      onAuthSuccess();
    } catch (err: any) {
      console.error("Google auth error:", err);
      setError(getErrorMessage(err.code || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in py-8 px-4">
      {/* SIMVA Logo Header */}
      <div className="text-center mb-8">
        <h1 className="font-sans text-3xl font-black text-white tracking-widest uppercase">
          SIMVA
        </h1>
        <p className="font-mono text-[9px] text-primary-fixed-dim uppercase tracking-wider mt-1">
          SISTEMA DE MONITOREO VEHICULAR ACTIVO
        </p>
        <p className="text-xs text-on-surface-variant mt-2 max-w-xs mx-auto">
          Gestiona el mantenimiento predictivo de tu vehículo sincronizado en la nube.
        </p>
      </div>

      {/* Auth Card */}
      <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-xl space-y-6">
        
        {/* Toggle Mode Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 shadow-inner">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setError(null);
            }}
            className={`flex-1 text-center py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all ${
              isLogin 
                ? "bg-primary-fixed-dim text-black shadow-lg" 
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setError(null);
            }}
            className={`flex-1 text-center py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all ${
              !isLogin 
                ? "bg-primary-fixed-dim text-black shadow-lg" 
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Display Error Message */}
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3.5 text-xs text-red-400">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">{error}</div>
            </div>
          </div>
        )}

        {/* Auth form */}
        <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
          
          {/* Email input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              CORREO ELECTRÓNICO
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full bg-black border border-outline-variant rounded-lg py-2.5 pl-10 pr-3.5 text-sm text-white focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all"
              />
            </div>
          </div>

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
              CONTRASEÑA
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant">
                <Key className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black border border-outline-variant rounded-lg py-2.5 pl-10 pr-3.5 text-sm text-white focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-fixed-dim hover:bg-white text-black font-semibold font-mono text-xs uppercase tracking-widest rounded-lg transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{loading ? "Procesando..." : isLogin ? "Acceder al Garaje" : "Registrar Dispositivo"}</span>
            {!loading && <ChevronRight className="h-4 w-4" />}
          </button>
        </form>

        {/* Separator */}
        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-white/5"></div>
          <span className="flex-shrink mx-4 font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">
            O TAMBIÉN
          </span>
          <div className="flex-grow border-t border-white/5"></div>
        </div>

        {/* Google sign-in */}
        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-3 bg-black hover:bg-white/5 border border-white/10 text-white font-semibold font-mono text-xs uppercase tracking-widest rounded-lg transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2.5"
        >
          {/* Custom SVG Google Icon */}
          <svg className="h-4 w-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
          </svg>
          <span>Iniciar con Google</span>
        </button>
      </div>
    </div>
  );
}
