import { useState, useEffect, FormEvent } from "react";
import { 
  CarProfile, 
  MaintenanceTask, 
  TaskTracking 
} from "./types";
import Header from "./components/Header";
import CarProfileForm from "./components/CarProfileForm";
import TaskTracker from "./components/TaskTracker";
import EmptyState from "./components/EmptyState";
import { AlertTriangle, CheckCircle, Car, LayoutGrid, PlusCircle, User, Gauge, LogOut } from "lucide-react";

// Firebase integration
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, getDocs, setDoc, collection, writeBatch } from "firebase/firestore";
import AuthScreen from "./components/AuthScreen";

export default function App() {
  const [carProfile, setCarProfile] = useState<CarProfile | null>(null);
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [tracking, setTracking] = useState<TaskTracking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  
  // Firebase authentication state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Selected visual view screen (registrar, garaje or perfil)
  const [activeScreen, setActiveScreen] = useState<"registrar" | "garaje" | "perfil">("registrar");

  // Helper function to sync Profile to Cloud
  const saveProfileToFirestore = async (uid: string, profile: CarProfile) => {
    const pathForWrite = `users/${uid}/car/profile`;
    try {
      await setDoc(doc(db, "users", uid, "car", "profile"), profile);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathForWrite);
    }
  };

  // Helper function to sync Tasks to Cloud
  const saveTasksToFirestore = async (uid: string, tasksList: MaintenanceTask[]) => {
    const pathForWrite = `users/${uid}/tasks`;
    try {
      const batch = writeBatch(db);
      const tasksSnap = await getDocs(collection(db, "users", uid, "tasks"));
      tasksSnap.forEach((d) => {
        batch.delete(d.ref);
      });
      tasksList.forEach((t) => {
        batch.set(doc(db, "users", uid, "tasks", t.id), t);
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathForWrite);
    }
  };

  // Helper function to sync Tracking to Cloud
  const saveTrackingToFirestore = async (uid: string, trackingList: TaskTracking[]) => {
    const pathForWrite = `users/${uid}/tracking`;
    try {
      const batch = writeBatch(db);
      const trackingSnap = await getDocs(collection(db, "users", uid, "tracking"));
      trackingSnap.forEach((d) => {
        batch.delete(d.ref);
      });
      trackingList.forEach((tr) => {
        batch.set(doc(db, "users", uid, "tracking", tr.id), tr);
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathForWrite);
    }
  };

  // Handle Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsLoading(true);
        setError(null);
        try {
          // Initialize/Ensure User Profile document
          await setDoc(
            doc(db, "users", user.uid),
            { userId: user.uid, email: user.email || "" },
            { merge: true }
          );

          // Get Car info
          const carDoc = await getDoc(doc(db, "users", user.uid, "car", "profile"));
          let fetchedCar: CarProfile | null = null;
          if (carDoc.exists()) {
            fetchedCar = carDoc.data() as CarProfile;
            setCarProfile(fetchedCar);
          } else {
            setCarProfile(null);
          }

          // Get custom and general tasks
          const tasksSnap = await getDocs(collection(db, "users", user.uid, "tasks"));
          const loadedTasks: MaintenanceTask[] = [];
          tasksSnap.forEach((d) => {
            loadedTasks.push(d.data() as MaintenanceTask);
          });
          setTasks(loadedTasks);

          // Get task logs
          const trackingSnap = await getDocs(collection(db, "users", user.uid, "tracking"));
          const loadedTracking: TaskTracking[] = [];
          trackingSnap.forEach((d) => {
            loadedTracking.push(d.data() as TaskTracking);
          });
          setTracking(loadedTracking);

          if (fetchedCar) {
            setActiveScreen("garaje");
          } else {
            setActiveScreen("registrar");
          }
        } catch (err: any) {
          console.error("Error loading profile from Firestore:", err);
          setError("Incompatibilidad al leer datos sincronizados. Operando en modo local.");

          // Local storage recovery backup
          const storedCar = localStorage.getItem("automoto_profile");
          const storedTasks = localStorage.getItem("automoto_tasks");
          const storedTrack = localStorage.getItem("automoto_tracking");
          if (storedCar) setCarProfile(JSON.parse(storedCar));
          if (storedTasks) setTasks(JSON.parse(storedTasks));
          if (storedTrack) setTracking(JSON.parse(storedTrack));
        } finally {
          setIsLoading(false);
        }
      } else {
        // Logged out safely
        setCarProfile(null);
        setTasks([]);
        setTracking([]);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Save profile & fetch Maintenance plan and initialize the wear levels
  const handleSaveProfile = async (
    profile: CarProfile, 
    shouldFetch: boolean,
    lastMaintMonths?: number,
    lastMaintKm?: number
  ) => {
    setCarProfile(profile);
    localStorage.setItem("automoto_profile", JSON.stringify(profile));
    setInfoMessage(null);
    setError(null);

    // If fetched, load recommended tasks
    if (shouldFetch) {
      setIsLoading(true);
      try {
        const response = await fetch("/api/maintenance-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            makeModel: profile.makeModel,
            fuelType: profile.fuelType,
            year: profile.year,
          }),
        });

        if (!response.ok) {
          throw new Error("Respuesta de red errónea al consultar con el servidor backend.");
        }

        const data = await response.json();

        // Incorporate unique client ids for safe key mapping
        const processedTasks = (data.plan || []).map((t: any, idx: number) => ({
          id: `task-${idx}-${Date.now()}`,
          tarea: t.tarea,
          cada_km: Number(t.cada_km) || 0,
          cada_meses: Number(t.cada_meses) || 0,
        }));

        setTasks(processedTasks);
        localStorage.setItem("automoto_tasks", JSON.stringify(processedTasks));

        // Compute pre-loaded history completes instantly so user gets realistic wear!
        let initialTracking: TaskTracking[] = [];
        if (lastMaintKm !== undefined && lastMaintKm > 0) {
          const maintDate = new Date();
          maintDate.setMonth(maintDate.getMonth() - (lastMaintMonths || 6));
          const lastCompletedDate = maintDate.toISOString().split("T")[0];

          initialTracking = processedTasks.map((t: any) => {
            // Apply last intervention to all basic tasks under 60k km
            if (t.cada_km && t.cada_km <= 60000 && lastMaintKm <= profile.currentKm) {
              return {
                id: t.id,
                lastCompletedKm: lastMaintKm,
                lastCompletedDate: lastCompletedDate
              };
            }
            return null;
          }).filter(Boolean) as TaskTracking[];
        }

        setTracking(initialTracking);
        localStorage.setItem("automoto_tracking", JSON.stringify(initialTracking));

        // Store configuration and plan on Firestore Cloud
        if (currentUser) {
          await saveProfileToFirestore(currentUser.uid, profile);
          await saveTasksToFirestore(currentUser.uid, processedTasks);
          await saveTrackingToFirestore(currentUser.uid, initialTracking);
        }

        if (data.isFallback || data.message) {
          setInfoMessage(data.message || "Se han aplicado los estándares de la industria automotriz recomendados.");
        } else {
          setInfoMessage("¡Felicidades! Plan de mantenimiento oficial obtenido con éxito mediante Gemini IA.");
        }

        // Navigate automatically to Pantalla B: Garaje / Estado
        setActiveScreen("garaje");
      } catch (err: any) {
        console.error("Error fetching recommended maintenance schedule:", err);
        setError("Fallo de red al consultar con el servidor. Se emplearán datos recomendados estándar.");
        
        // Load some local industry defaults immediately so the screen is never empty
        const defaultTasks = getIndustryFallbackPlan(profile.fuelType).map((t: any, idx: number) => ({
          id: `task-fallback-${idx}-${Date.now()}`,
          tarea: t.tarea,
          cada_km: t.cada_km,
          cada_meses: t.cada_meses,
        }));
        setTasks(defaultTasks);
        localStorage.setItem("automoto_tasks", JSON.stringify(defaultTasks));

        // Setup custom completion logs for fallback default plan too
        let initialTracking: TaskTracking[] = [];
        if (lastMaintKm !== undefined && lastMaintKm > 0) {
          const maintDate = new Date();
          maintDate.setMonth(maintDate.getMonth() - (lastMaintMonths || 6));
          const lastCompletedDate = maintDate.toISOString().split("T")[0];

          initialTracking = defaultTasks.map((t: any) => {
            if (t.cada_km && t.cada_km <= 60000 && lastMaintKm <= profile.currentKm) {
              return {
                id: t.id,
                lastCompletedKm: lastMaintKm,
                lastCompletedDate: lastCompletedDate
              };
            }
            return null;
          }).filter(Boolean) as TaskTracking[];
        }
        setTracking(initialTracking);
        localStorage.setItem("automoto_tracking", JSON.stringify(initialTracking));

        if (currentUser) {
          await saveProfileToFirestore(currentUser.uid, profile);
          await saveTasksToFirestore(currentUser.uid, defaultTasks);
          await saveTrackingToFirestore(currentUser.uid, initialTracking);
        }

        setActiveScreen("garaje");
      } finally {
        setIsLoading(false);
      }
    } else {
      setInfoMessage("Lectura del odómetro guardada correctamente.");
      
      let initialTracking: TaskTracking[] = [];
      // Auto-reinitialize logs if they edited the vehicle settings manually
      if (lastMaintKm !== undefined && lastMaintKm > 0 && tasks.length > 0) {
        const maintDate = new Date();
        maintDate.setMonth(maintDate.getMonth() - (lastMaintMonths || 6));
        const lastCompletedDate = maintDate.toISOString().split("T")[0];

        initialTracking = tasks.map((t: any) => {
          if (t.cada_km && t.cada_km <= 60000 && lastMaintKm <= profile.currentKm) {
            return {
              id: t.id,
              lastCompletedKm: lastMaintKm,
              lastCompletedDate: lastCompletedDate
            };
          }
          return null;
        }).filter(Boolean) as TaskTracking[];
        setTracking(initialTracking);
        localStorage.setItem("automoto_tracking", JSON.stringify(initialTracking));
      }

      if (currentUser) {
        await saveProfileToFirestore(currentUser.uid, profile);
        if (lastMaintKm !== undefined && lastMaintKm > 0 && tasks.length > 0) {
          await saveTrackingToFirestore(currentUser.uid, initialTracking);
        }
      }

      // Navigate to Garaje tab
      setActiveScreen("garaje");
      setTimeout(() => setInfoMessage(null), 3500);
    }
  };

  // Safe standard fallback in client-side as well in case of network failures
  function getIndustryFallbackPlan(fuelType: string) {
    const common = [
      { tarea: "Cambio de líquido de frenos", cada_km: 60000, cada_meses: 24 },
      { tarea: "Revisión de pastillas y discos de freno", cada_km: 30000, cada_meses: 12 },
      { tarea: "Cambio de filtro del habitáculo (antipolen)", cada_km: 15000, cada_meses: 12 },
      { tarea: "Revisión de nivel de anticongelante", cada_km: 20000, cada_meses: 12 }
    ];
    const typeLower = (fuelType || "Gasolina").toLowerCase();
    if (typeLower.includes("electric") || typeLower.includes("eléctric")) {
      return [
        { tarea: "Rotación y calibración de neumáticos", cada_km: 10000, cada_meses: 12 },
        { tarea: "Cambio de filtro de aire del habitáculo", cada_km: 20000, cada_meses: 12 },
        ...common.slice(0, 2),
        { tarea: "Inspección de batería de alta tensión", cada_km: 30000, cada_meses: 24 }
      ];
    } else if (typeLower.includes("diesel") || typeLower.includes("diésel")) {
      return [
        { tarea: "Cambio de aceite de motor y filtro", cada_km: 15000, cada_meses: 12 },
        { tarea: "Reemplazo de filtro de combustible (diésel)", cada_km: 30500, cada_meses: 24 },
        { tarea: "Cambio de filtro de aire", cada_km: 30000, cada_meses: 24 },
        ...common
      ];
    } else {
      return [
        { tarea: "Cambio de aceite de motor y filtro", cada_km: 15000, cada_meses: 12 },
        { tarea: "Reemplazo de filtro de aire de motor", cada_km: 30000, cada_meses: 24 },
        ...common,
        { tarea: "Cambio de bujías de encendido", cada_km: 60000, cada_meses: 48 }
      ];
    }
  }

  // Update completions log
  const handleUpdateTracking = async (newTrack: TaskTracking[]) => {
    setTracking(newTrack);
    localStorage.setItem("automoto_tracking", JSON.stringify(newTrack));
    if (currentUser) {
      await saveTrackingToFirestore(currentUser.uid, newTrack);
    }
  };

  // Update tasks locally (add custom/delete)
  const handleUpdateTasks = async (newTasks: MaintenanceTask[]) => {
    setTasks(newTasks);
    localStorage.setItem("automoto_tasks", JSON.stringify(newTasks));
    if (currentUser) {
      await saveTasksToFirestore(currentUser.uid, newTasks);
    }
  };

  // Complete reset to generic/empty state
  const handleResetAll = async () => {
    if (window.confirm("¿Estás seguro de que deseas limpiar la información actual de tu coche y empezar de nuevo?")) {
      setCarProfile(null);
      setTasks([]);
      setTracking([]);
      setError(null);
      setInfoMessage(null);
      setActiveScreen("registrar");
      
      localStorage.removeItem("automoto_profile");
      localStorage.removeItem("automoto_tasks");
      localStorage.removeItem("automoto_tracking");

      if (currentUser) {
        setIsLoading(true);
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, "users", currentUser.uid, "car", "profile"));
          
          const tasksSnap = await getDocs(collection(db, "users", currentUser.uid, "tasks"));
          tasksSnap.forEach((d) => batch.delete(d.ref));

          const trackingSnap = await getDocs(collection(db, "users", currentUser.uid, "tracking"));
          trackingSnap.forEach((d) => batch.delete(d.ref));

          await batch.commit();
          setInfoMessage("¡Métricas SIMVA restablecidas con éxito en la nube!");
          setTimeout(() => setInfoMessage(null), 3000);
        } catch (err) {
          console.error("Error clearing Firebase collections on reset:", err);
          setError("Error al restablecer los datos del servidor.");
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  // Helper inside render for Quick Odometer calibration
  const [newOdo, setNewOdo] = useState("");
  useEffect(() => {
    if (carProfile) {
      setNewOdo(carProfile.currentKm.toString());
    }
  }, [carProfile]);

  const handleUpdateOdometer = async (e: FormEvent) => {
    e.preventDefault();
    if (!carProfile) return;
    const val = Number(newOdo);
    if (isNaN(val) || val < 0) {
      setError("Por favor, introduce un kilometraje válido superior a 0.");
      return;
    }
    const updated = {
      ...carProfile,
      currentKm: val
    };
    setCarProfile(updated);
    localStorage.setItem("automoto_profile", JSON.stringify(updated));
    setInfoMessage("¡Telemetría calibrada con éxito! Distancia de conducción de la unidad actualizada.");
    
    if (currentUser) {
      await saveProfileToFirestore(currentUser.uid, updated);
    }
    
    setTimeout(() => setInfoMessage(null), 3500);
  };

  if (authChecking) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-white p-6">
        <Car className="h-10 w-10 text-primary-fixed-dim animate-bounce mb-4" />
        <h2 className="font-sans text-lg font-black tracking-widest uppercase">SIMVA</h2>
        <div className="flex gap-1 items-center mt-2 font-mono text-[9px] uppercase text-primary-fixed-dim/70 tracking-widest select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-fixed-dim animate-ping" />
          <span>INICIALIZANDO TELEMETRÍA CENTRAL...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans antialiased text-white pt-24 pb-32">
      {/* Premium Dashboard Header */}
      <Header hasCar={!!carProfile} carName={carProfile?.makeModel} />

      {/* Main container */}
      <main className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6">
        
        {/* Unauthenticated Mode Auth Trigger */}
        {!currentUser ? (
          <AuthScreen onAuthSuccess={() => {}} />
        ) : (
          <>
            {/* Dynamic Warning Notification / Info Bar */}
            {(error || infoMessage) && (
              <div className="mb-6 animate-fade-in max-w-2xl mx-auto">
                {error ? (
                  <div className="flex items-center gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-xs font-semibold text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                    <span>{infoMessage}</span>
                  </div>
                )}
              </div>
            )}

            {/* Dynamic Display of active screen */}
            <div className="mx-auto max-w-2xl">
              {activeScreen === "registrar" && (
                <div className="animate-fade-in flex flex-col gap-6">
                  <CarProfileForm 
                    onSave={handleSaveProfile} 
                    isLoading={isLoading} 
                    currentProfile={carProfile}
                  />
                </div>
              )}

              {activeScreen === "garaje" && (
                <div className="animate-fade-in flex flex-col gap-6">
                  {carProfile ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#1e232d] border border-white/5 p-4 rounded-xl shadow-lg text-left">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-lg bg-primary-fixed-dim/10 border border-primary-fixed-dim/30 text-primary-fixed-dim">
                            <Car className="h-6 w-6" />
                          </div>
                          <div className="text-left">
                            <h2 className="font-sans font-bold text-lg text-white uppercase">
                              {carProfile.makeModel}
                            </h2>
                            <p className="text-xs text-on-surface-variant font-mono mt-0.5">
                              {carProfile.fuelType} · {carProfile.year} · Uso: {carProfile.monthlyKm.toLocaleString("es-ES")} km/mes
                            </p>
                          </div>
                        </div>
                        <button
                          id="edit-current-car-profile"
                          onClick={() => setActiveScreen("registrar")}
                          className="text-xs font-mono font-bold text-primary-fixed-dim hover:underline self-start sm:self-center cursor-pointer uppercase tracking-wider"
                        >
                          Editar Coche
                        </button>
                      </div>

                      <TaskTracker
                        tasks={tasks}
                        tracking={tracking}
                        car={carProfile}
                        onUpdateTracking={handleUpdateTracking}
                        onUpdateTasks={handleUpdateTasks}
                        onResetAll={handleResetAll}
                      />
                    </>
                  ) : (
                    <EmptyState />
                  )}
                </div>
              )}

              {activeScreen === "perfil" && (
                <div className="animate-fade-in space-y-6 text-left">
                  {/* Profile Header */}
                  <header className="mb-2">
                    <h2 className="font-sans text-2xl font-bold text-white tracking-tight mb-1">
                      Perfil de Telemetría
                    </h2>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Información de tu nodo SIMVA y herramientas de calibración en la nube.
                    </p>
                  </header>

                  {/* Driver Card */}
                  <section className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-primary-fixed-dim/20 border border-primary-fixed-dim/40 flex items-center justify-center text-primary-fixed-dim font-bold text-base shadow-[0_0_15px_rgba(0,221,221,0.2)]">
                        {currentUser.email ? currentUser.email[0].toUpperCase() : "U"}
                      </div>
                      <div>
                        <h3 className="text-white font-sans font-bold text-sm">Operador Principal</h3>
                        <p className="font-mono text-[9px] text-primary-fixed-dim uppercase tracking-wider">
                          {currentUser.email}
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          ID: {currentUser.uid.slice(0, 12)}... · SIMVA Nube Conectado
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => signOut(auth)}
                      type="button"
                      className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-200 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5 self-start sm:self-center"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar Sesión</span>
                    </button>

                    <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[9px] font-mono text-emerald-400 font-bold hidden sm:block">
                      CLOUD_OK
                    </div>
                  </section>

                  {/* Stats Grid */}
                  <section className="grid grid-cols-3 gap-3">
                    <div className="glass-card p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                      <span className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">ODÓMETRO</span>
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {carProfile ? `${carProfile.currentKm.toLocaleString("es-ES")} km` : "--"}
                      </span>
                    </div>
                    
                    <div className="glass-card p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                      <span className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">PLAN RECOM</span>
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {tasks.length} Tareas
                      </span>
                    </div>

                    <div className="glass-card p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                      <span className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">HISTORIAL</span>
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {tracking.length} Logs
                      </span>
                    </div>
                  </section>

                  {/* Quick Odometer Calibration */}
                  {carProfile && (
                    <section className="glass-card p-4 rounded-xl border border-white/10 space-y-3.5">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary-fixed-dim" />
                        <span className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                          Calibración Manual de Telemetría
                        </span>
                      </div>

                      <form onSubmit={handleUpdateOdometer} className="flex gap-2.5 items-end">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="font-mono text-[9px] font-bold text-on-surface-variant">KILÓMETROS DEL SENSOR</label>
                          <input
                            type="number"
                            min={0}
                            value={newOdo}
                            onChange={(e) => setNewOdo(e.target.value)}
                            className="w-full bg-black border border-outline-variant rounded-lg p-2.5 text-xs text-white font-mono focus:border-primary-fixed-dim"
                          />
                        </div>
                        <button
                          type="submit"
                          className="py-2.5 px-4 bg-primary-fixed-dim text-black font-semibold font-mono text-[11px] rounded-lg hover:bg-white active:scale-95 transition-all cursor-pointer h-[38px] uppercase tracking-wider shrink-0"
                        >
                          Calibrar
                        </button>
                      </form>
                    </section>
                  )}

                  {/* Reset zone */}
                  <section className="glass-card p-4 rounded-xl border border-red-500/10 bg-red-500/5 space-y-3">
                    <div className="space-y-0.5">
                      <h4 className="text-red-400 font-sans font-bold text-xs uppercase tracking-wider">Zona de Peligro</h4>
                      <p className="text-[11px] text-on-surface-variant">
                        Esto restablecerá de fábrica el dispositivo SIMVA borrando todos los registros guardados de la nube y del navegador.
                      </p>
                    </div>
                    <button
                      onClick={handleResetAll}
                      className="py-2.5 px-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                    >
                      Restablecer
                    </button>
                  </section>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* PERSISTENT BOTTOM NAVIGATION BAR */}
      {currentUser && (
        <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 py-4 bg-[#1e232d]/90 backdrop-blur-xl border-t border-white/5 rounded-t-2xl shadow-[0_-5px_25px_rgba(0,0,0,0.5)]">
          <button
            onClick={() => setActiveScreen("garaje")}
            className={`flex flex-col items-center justify-center py-1 px-4 gap-1 transition-all rounded-xl cursor-pointer ${
              activeScreen === "garaje"
                ? "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(0,221,221,0.5)] scale-105 font-bold"
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
            <span className="font-mono text-[9px] tracking-widest font-bold uppercase mt-0.5">Garaje</span>
          </button>

          <button
            onClick={() => setActiveScreen("registrar")}
            className={`flex flex-col items-center justify-center py-1 px-4 gap-1 transition-all rounded-xl cursor-pointer ${
              activeScreen === "registrar"
                ? "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(0,221,221,0.5)] scale-105 font-bold"
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            <PlusCircle className="h-5 w-5" />
            <span className="font-mono text-[9px] tracking-widest font-bold uppercase mt-0.5">Registrar</span>
          </button>

          <button
            onClick={() => setActiveScreen("perfil")}
            className={`flex flex-col items-center justify-center py-1 px-4 gap-1 transition-all rounded-xl cursor-pointer ${
              activeScreen === "perfil"
                ? "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(0,221,221,0.5)] scale-105 font-bold"
                : "text-on-surface-variant hover:text-white"
            }`}
          >
            <User className="h-5 w-5" />
            <span className="font-mono text-[9px] tracking-widest font-bold uppercase mt-0.5">Perfil</span>
          </button>
        </nav>
      )}
    </div>
  );
}
