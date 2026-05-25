import { useState, FormEvent } from "react";
import { 
  Wrench, 
  Trash2, 
  AlertTriangle, 
  Plus, 
  Calendar, 
  History, 
  Timer, 
  X,
  Printer, 
  Gauge, 
  RotateCcw,
  Droplet,
  Disc,
  Wind,
  Battery,
  Zap,
  Thermometer,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { MaintenanceTask, TaskTracking, CarProfile } from "../types";

interface TaskTrackerProps {
  tasks: MaintenanceTask[];
  tracking: TaskTracking[];
  car: CarProfile;
  onUpdateTracking: (trackingList: TaskTracking[]) => void;
  onUpdateTasks: (taskList: MaintenanceTask[]) => void;
  onResetAll: () => void;
}

export default function TaskTracker({
  tasks,
  tracking,
  car,
  onUpdateTracking,
  onUpdateTasks,
  onResetAll
}: TaskTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTarea, setNewTarea] = useState("");
  const [newCadaKm, setNewCadaKm] = useState<number>(15000);
  const [newCadaMeses, setNewCadaMeses] = useState<number>(12);

  // States for logging completions manually
  const [activeLogTaskId, setActiveLogTaskId] = useState<string | null>(null);
  const [logKm, setLogKm] = useState<number>(car.currentKm);
  const [logDate, setLogDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Helper to get tracking state for a single task
  const getTaskTracking = (taskId: string) => {
    return tracking.find((t) => t.id === taskId);
  };

  // Icon chooser helper based on keywords
  const getTaskIcon = (tarea: string) => {
    const text = (tarea || "").toLowerCase();
    
    if (text.includes("aceite") || text.includes("filtro de motor") || text.includes("lubricante") || text.includes("motor")) {
      return <Droplet className="h-5 w-5 text-emerald-400 neon-glow-green animate-pulse" />;
    }
    if (text.includes("freno") || text.includes("pastilla") || text.includes("disco") || text.includes("líquido de frenos")) {
      return <Disc className="h-5 w-5 text-red-400 neon-glow-red" />;
    }
    if (text.includes("aire") || text.includes("habitáculo") || text.includes("antipolen") || text.includes("climatiz") || text.includes("a/c")) {
      return <Wind className="h-5 w-5 text-sky-450" />;
    }
    if (text.includes("batería") || text.includes("eléctrico") || text.includes("test de diagnost") || text.includes("alta tensión")) {
      return <Battery className="h-5 w-5 text-purple-400" />;
    }
    if (text.includes("bujía") || text.includes("encendido") || text.includes("fuego") || text.includes("calentador")) {
      return <Zap className="h-5 w-5 text-amber-400 neon-glow-amber" />;
    }
    if (text.includes("refrigerante") || text.includes("anticongelante") || text.includes("radiador") || text.includes("temperatura")) {
      return <Thermometer className="h-5 w-5 text-orange-400 animate-pulse" />;
    }
    if (text.includes("rueda") || text.includes("neumático") || text.includes("rotación") || text.includes("dirección") || text.includes("alineación")) {
      return <Disc className="h-5 w-5 text-cyan-400" />;
    }
    if (text.includes("correa") || text.includes("distribución") || text.includes("alternador") || text.includes("accesorio") || text.includes("cadena")) {
      return <RefreshCw className="h-5 w-5 text-pink-400" />;
    }
    if (text.includes("limpieza") || text.includes("lavado") || text.includes("escobillas") || text.includes("limpiaparabrisas") || text.includes("aditivo")) {
      return <Sparkles className="h-5 w-5 text-yellow-300" />;
    }
    
    return <Wrench className="h-5 w-5 text-primary-300" />;
  };

  // Compute prediction alerts and the exact wear percentage elapsed
  const computeAlertAndWear = (task: MaintenanceTask) => {
    const track = getTaskTracking(task.id);
    const odometro = car.currentKm;
    
    // Determine last completion mileage
    const lastDoneKm = track?.lastCompletedKm !== undefined ? track.lastCompletedKm : 0;
    
    // Determine kilometers elapsed since last registered service
    const kmElapsed = Math.max(0, odometro - lastDoneKm);
    
    // Calculate custom wear percentage representing how much interval is consumed
    let wearPercentage = 0;
    if (task.cada_km > 0) {
      if (track?.lastCompletedKm !== undefined) {
        wearPercentage = Math.min(100, Math.max(0, (kmElapsed / task.cada_km) * 100));
      } else {
        // Standard cyclic estimation based on overall odometer if not logged
        const currentCycleElapsed = odometro % task.cada_km;
        wearPercentage = Math.min(100, Math.max(0, (currentCycleElapsed / task.cada_km) * 100));
      }
    } else if (task.cada_meses > 0 && track?.lastCompletedDate) {
      // Time-based fallback wear calculation
      const lastDate = new Date(track.lastCompletedDate);
      const today = new Date();
      const diffYears = today.getFullYear() - lastDate.getFullYear();
      const diffMonths = today.getMonth() - lastDate.getMonth();
      const elapsedMonths = Math.max(0, diffYears * 12 + diffMonths);
      wearPercentage = Math.min(100, Math.max(0, (elapsedMonths / task.cada_meses) * 100));
    } else if (task.cada_meses > 0) {
      // Time-base estimate without logs (e.g. 1 year task, assume midpoint to avoid 0)
      wearPercentage = 50;
    }

    // Solve for remaining parameters
    let nextDueKm = 0;
    let kmRemaining = 0;

    if (task.cada_km > 0) {
      if (track && track.lastCompletedKm !== undefined) {
        nextDueKm = track.lastCompletedKm + task.cada_km;
      } else {
        nextDueKm = Math.ceil((odometro + 1) / task.cada_km) * task.cada_km;
      }
      kmRemaining = nextDueKm - odometro;
    } else {
      kmRemaining = Infinity;
    }

    let monthsRemaining = Infinity;
    if (task.cada_meses > 0) {
      if (track && track.lastCompletedDate) {
        const lastDate = new Date(track.lastCompletedDate);
        const today = new Date();
        const diffYears = today.getFullYear() - lastDate.getFullYear();
        const diffMonths = today.getMonth() - lastDate.getMonth();
        const elapsedMonths = diffYears * 12 + diffMonths;
        monthsRemaining = Math.max(0, task.cada_meses - elapsedMonths);
      } else {
        if (kmRemaining !== Infinity) {
          const monthlyUsage = car.monthlyKm > 0 ? car.monthlyKm : 1000;
          monthsRemaining = kmRemaining / monthlyUsage;
        } else {
          monthsRemaining = task.cada_meses;
        }
      }
    }

    // Always represent the months remaining as a clean rounded whole integer
    const roundedMonthsRemaining = Math.max(0, Math.round(monthsRemaining));

    // Determine status rating and warn user based on coordinates:
    // - Less than 4000 km target -> RED (Peligro)
    // - Between 4000 km and 6000 km target -> AMBER (Precaución)
    // - Above 6000 km -> GREEN / OK
    let statusColor: "danger" | "warning" | "ok" = "ok";
    let message = "";

    if (task.cada_km > 0) {
      if (kmRemaining < 4000) {
        statusColor = "danger";
        message = `¡Atención! Restan menos de 4.000 km (${kmRemaining.toLocaleString("es-ES")} km) para el recambio.`;
      } else if (kmRemaining <= 6000) {
        statusColor = "warning";
        message = `¡Precaución! Rango de advertencia (restan ${kmRemaining.toLocaleString("es-ES")} km).`;
      } else {
        statusColor = "ok";
        message = "Funcionamiento correcto y seguro (más de 6.000 km restantes).";
      }
    } else {
      // Time-only task backup rules
      if (roundedMonthsRemaining <= 1) {
        statusColor = "danger";
        message = "¡Atención! Expiración temporal inminente (un mes o menos).";
      } else if (roundedMonthsRemaining <= 2) {
        statusColor = "warning";
        message = "Fase de control preventivo ámber (2 meses restantes).";
      } else {
        statusColor = "ok";
        message = "Plazo de conservación en verde.";
      }
    }

    return {
      wearPercentage: Math.max(1, Math.round(wearPercentage)),
      statusColor,
      message,
      kmRemaining,
      monthsRemaining: roundedMonthsRemaining,
      lastDoneKm
    };
  };

  // Perform quick task completion at current mileage
  const handleQuickComplete = (taskId: string) => {
    const updated = [...tracking];
    const index = updated.findIndex((t) => t.id === taskId);
    const newVal = {
      id: taskId,
      lastCompletedKm: car.currentKm,
      lastCompletedDate: new Date().toISOString().split("T")[0]
    };

    if (index !== -1) {
      updated[index] = newVal;
    } else {
      updated.push(newVal);
    }
    onUpdateTracking(updated);
  };

  // Initiate custom completion logger dialog
  const openCompleteModal = (taskId: string) => {
    setActiveLogTaskId(taskId);
    setLogKm(car.currentKm);
    setLogDate(new Date().toISOString().split("T")[0]);
  };

  // Save manual completion details
  const handleSaveCompletion = (e: FormEvent) => {
    e.preventDefault();
    if (!activeLogTaskId) return;

    const updated = [...tracking];
    const index = updated.findIndex((t) => t.id === activeLogTaskId);
    const newVal = {
      id: activeLogTaskId,
      lastCompletedKm: Number(logKm),
      lastCompletedDate: logDate
    };

    if (index !== -1) {
      updated[index] = newVal;
    } else {
      updated.push(newVal);
    }
    onUpdateTracking(updated);
    setActiveLogTaskId(null);
  };

  // Add a user-defined custom maintenance task
  const handleAddCustomTask = (e: FormEvent) => {
    e.preventDefault();
    if (!newTarea.trim()) return;

    const newTask: MaintenanceTask = {
      id: `custom-${Date.now()}`,
      tarea: newTarea.trim(),
      cada_km: Number(newCadaKm),
      cada_meses: Math.round(Number(newCadaMeses)),
      isCustom: true
    };

    onUpdateTasks([...tasks, newTask]);
    setNewTarea("");
    setNewCadaKm(15000);
    setNewCadaMeses(12);
    setShowAddForm(false);
  };

  // Delete an individual task from current plan
  const handleDeleteTask = (taskId: string) => {
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    const updatedCol = tracking.filter((t) => t.id !== taskId);
    onUpdateTasks(updatedTasks);
    onUpdateTracking(updatedCol);
  };

  // Trigger browser print layout stylesheet
  const handlePrint = () => {
    window.print();
  };

  // Compute status arrays for metrics
  const calculatedTasks = tasks.map(t => ({ task: t, metrics: computeAlertAndWear(t) }));
  const criticalCount = calculatedTasks.filter(item => item.metrics.statusColor === "danger").length;
  const warningCount = calculatedTasks.filter(item => item.metrics.statusColor === "warning").length;

  return (
    <div className="flex flex-col gap-6 font-sans">
      
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Metric 1: Fleet Odometer with Neon Blue */}
        <div className="garage-panel flex items-center justify-between rounded-xl px-5 py-4 border-l-4 border-accent-gold shadow-[0_0_15px_rgba(0,210,255,0.08)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-primary-400">LECTURA ODOMETER</span>
            <span className="font-mono text-2xl font-black text-white mt-1 uppercase tracking-tight">
              {car.currentKm.toLocaleString("es-ES")} <span className="text-xs text-accent-gold font-bold neon-glow-blue">KM</span>
            </span>
          </div>
          <Gauge className="h-8 w-8 text-accent-gold animate-pulse" />
        </div>

        {/* Metric 2: Warning Alerts (🟡 Cuidado / Atenciones en Rango 4000km - 6000km) */}
        <div className="garage-panel flex items-center justify-between rounded-xl px-5 py-4 border-l-4 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.05)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-amber-500">ADVERTENCIA (4K - 6K KM)</span>
            <span className="font-mono text-2xl font-black text-amber-400 mt-1 uppercase tracking-tight">
              {warningCount} <span className="text-xs text-amber-500 font-sans font-medium">Tareas</span>
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-amber-500 rounded-full blur-md opacity-40 animate-ping h-8 w-8" />
            <AlertTriangle className="h-8 w-8 text-amber-500 relative" />
          </div>
        </div>

        {/* Metric 3: Critical alerts Overdue (🔴 Peligro inmediato! <4000km) */}
        <div className="garage-panel flex items-center justify-between rounded-xl px-5 py-4 border-l-4 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <div className="flex flex-col">
            <span className="font-mono text-[10px] uppercase tracking-wider text-red-550">PELIGRO CRÍTICO (&lt;4K KM)</span>
            <span className="font-mono text-2xl font-black text-red-400 mt-1 uppercase tracking-tight">
              {criticalCount} <span className="text-xs text-red-500 font-sans font-medium">Urgentes</span>
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-red-500 rounded-full blur-md opacity-50 animate-pulse h-8 w-8" />
            <div className="h-8 w-8 bg-red-950/40 rounded-full flex items-center justify-center border border-red-500 text-red-400 font-mono text-xs font-bold leading-none animate-pulse">
              !
            </div>
          </div>
        </div>
      </div>

      {/* Global Alerts Summary */}
      {(criticalCount > 0 || warningCount > 0) && (
        <div className="rounded-xl bg-red-950/30 border border-red-900/40 p-5 flex items-start gap-3.5 shadow-[0_0_20px_rgba(239,68,68,0.05)]">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5 animate-bounce" />
          <div className="flex flex-col gap-1 text-left">
            <h4 className="font-display font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-amber-400 text-sm tracking-wide uppercase">
              REPORTE DE DIAGNÓSTICO EN ESTILO SEMÁFORO
            </h4>
            <div className="text-xs text-primary-300 space-y-1.5 mt-1 font-sans">
              {criticalCount > 0 && (
                <p>• Alarma de <span className="text-red-400 font-bold uppercase underline">Rojo Peligro (&lt; 4.000 km disponibles):</span> Tienes <strong className="text-red-400 font-extrabold">{criticalCount} repuestos o tareas críticas</strong> en estado terminal con urgencia de visita al taller mecánico.</p>
              )}
              {warningCount > 0 && (
                <p>• Aviso en <span className="text-amber-400 font-bold uppercase">Ámbar (Entre 4.000 km y 6.000 km restantes):</span> Tienes <strong className="text-amber-400 font-extrabold">{warningCount} elementos preventivos</strong> entrando en vida de desgaste de seguridad.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Control Actions Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-primary-950/40 p-3.5 rounded-xl border border-primary-900">
        <div className="flex items-center gap-2">
          <Wrench className="h-4.5 w-4.5 text-accent-gold" />
          <h3 className="font-display text-sm font-bold text-white uppercase tracking-wider">
            Línea de Vida y Desgaste de Repuestos
          </h3>
          <span className="rounded bg-primary-800 px-2.5 py-0.5 font-mono text-[11px] font-bold text-accent-gold">
            {tasks.length} piezas
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            id="print-plan-btn"
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg border border-primary-800 bg-primary-950/40 px-3 py-1.5 font-sans text-xs font-semibold text-primary-300 hover:bg-primary-900 hover:text-white transition-all cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Imprimir Ficha</span>
          </button>

          <button
            id="clear-all-data-btn"
            type="button"
            onClick={onResetAll}
            className="flex items-center gap-1.5 rounded-lg border border-red-900/30 bg-red-950/10 px-3 py-1.5 font-sans text-xs font-semibold text-red-400 hover:bg-red-950/40 transition-all cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Limpiar Datos</span>
          </button>

          <button
            id="toggle-add-form-btn"
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 rounded-lg bg-accent-gold hover:bg-cyan-400 px-3 py-1.5 font-sans text-xs font-black text-primary-950 shadow-[0_0_15px_rgba(0,210,255,0.2)] transition-all active:scale-98 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[3]" />
            <span>+ Personalizar Plan</span>
          </button>
        </div>
      </div>

      {/* Add Custom Task Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddCustomTask}
          className="garage-panel rounded-xl p-5 border-dashed border-accent-gold/40 flex flex-col gap-4 animate-fade-in"
        >
          <div className="flex justify-between items-center border-b border-primary-800 pb-2">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-accent-gold">
              Agregar Elemento a la Lista de Recambios
            </span>
            <button
              id="close-add-form-btn"
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-primary-500 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-primary-300 uppercase tracking-widest">
                Nombre de la pieza o servicio
              </label>
              <input
                id="custom-task-name"
                type="text"
                required
                placeholder="Ej: Tensor de distribución, Líquido refrigerante..."
                value={newTarea}
                onChange={(e) => setNewTarea(e.target.value)}
                className="rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-xs font-medium text-white outline-none focus:border-accent-gold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-primary-300 uppercase tracking-widest">
                Cada cuántos Kilómetros (0 si no aplica)
              </label>
              <input
                id="custom-task-km"
                type="number"
                min={0}
                value={newCadaKm}
                onChange={(e) => setNewCadaKm(Number(e.target.value))}
                className="rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-xs font-mono text-white outline-none focus:border-accent-gold"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-primary-300 uppercase tracking-widest">
                Cada cuántos meses (0 si no aplica)
              </label>
              <input
                id="custom-task-months"
                type="number"
                min={0}
                value={newCadaMeses}
                onChange={(e) => setNewCadaMeses(Number(e.target.value))}
                className="rounded-lg border border-primary-800 bg-primary-950 px-3 py-2 text-xs font-mono text-white outline-none focus:border-accent-gold"
              />
            </div>
          </div>

          <button
            id="submit-custom-task"
            type="submit"
            className="mt-1 self-end rounded bg-primary-900 hover:bg-primary-800 text-white font-mono text-[10px] font-bold px-4 py-2 border border-primary-700 hover:border-accent-gold transition-all uppercase tracking-wider cursor-pointer"
          >
            Insertar en Ficha
          </button>
        </form>
      )}

      {/* Tasks listing (Bento styled cards with progress bars and Semáforo indicators) */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {tasks.map((task) => {
          const { 
            wearPercentage, 
            statusColor, 
            message, 
            kmRemaining, 
            monthsRemaining 
          } = computeAlertAndWear(task);
          
          const track = getTaskTracking(task.id);
          const formattedMonthsRemaining = Math.max(0, Math.round(Number(monthsRemaining)));
          const formattedIntervalMonths = Math.max(0, Math.round(Number(task.cada_meses)));

          return (
            <div
              id={`task-card-${task.id}`}
              key={task.id}
              className={`garage-panel rounded-2xl p-5 md:p-6 border-l-4 flex flex-col justify-between gap-5 transition-all hover:translate-y-[-2px] ${
                statusColor === "danger"
                  ? "border-l-red-500 shadow-[0_5px_15px_rgba(239,68,68,0.1)] bg-red-950/20"
                  : statusColor === "warning"
                  ? "border-l-amber-500 shadow-[0_5px_15px_rgba(245,158,11,0.1)] bg-amber-950/20"
                  : "border-l-emerald-500 shadow-[0_5px_15px_rgba(16,185,129,0.1)] bg-emerald-950/20"
              }`}
            >
              <div>
                
                {/* Header: Title + Icon + traffic light semaphore */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-3">
                    {/* Clean contextual icon inside vibrant circle */}
                    <div className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
                      statusColor === "danger"
                        ? "bg-red-500/10 border-red-500/30"
                        : statusColor === "warning"
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-emerald-500/10 border-emerald-500/30"
                    }`}>
                      {getTaskIcon(task.tarea)}
                    </div>
                    
                    <div className="text-left">
                      <h4 className="font-display text-sm md:text-base font-extrabold text-white leading-tight">
                        {task.tarea}
                      </h4>
                      <p className="font-mono text-[9px] text-primary-450 mt-1 uppercase tracking-widest">
                        {task.isCustom ? "Ajuste Personalizado" : "Recomendado Fabricante"}
                      </p>
                    </div>
                  </div>

                  {/* 🚦 Estilo SEMÁFORO (Traffic Light LED Panel) */}
                  <div className="flex items-center gap-1.5 rounded-lg bg-[#11151f] p-1.5 border border-primary-800 shadow-inner shrink-0" title="Semáforo de estado">
                    {/* Red light (Danger / <4000km) */}
                    <div className={`h-3 w-3 rounded-full transition-all duration-300 ${
                      statusColor === "danger" 
                        ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse" 
                        : "bg-red-950/45 border border-red-900/40"
                    }`} />
                    
                    {/* Yellow light (Precaución / 4000km - 6000km) */}
                    <div className={`h-3 w-3 rounded-full transition-all duration-300 ${
                      statusColor === "warning" 
                        ? "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,1)] animate-pulse" 
                        : "bg-amber-950/45 border border-amber-900/40"
                    }`} />

                    {/* Green light (OK / >6000km) */}
                    <div className={`h-3 w-3 rounded-full transition-all duration-300 ${
                      statusColor === "ok" 
                        ? "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,1)]" 
                        : "bg-emerald-950/45 border border-emerald-900/40"
                    }`} />
                  </div>
                </div>

                {/* Required Cycle Metric Intervals */}
                <div className="mt-4 flex items-center justify-between border-b border-primary-800/60 pb-2.5 font-mono text-[11px] md:text-xs text-primary-400">
                  <span className="flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5 text-accent-gold" />
                    <span>Intervalo de cambio:</span>
                  </span>
                  <span className="font-extrabold text-white">
                    {task.cada_km > 0 ? `${task.cada_km.toLocaleString("es-ES")} KM` : ""}
                    {task.cada_km > 0 && task.cada_meses > 0 ? " o " : ""}
                    {task.cada_meses > 0 ? `${formattedIntervalMonths} meses` : ""}
                  </span>
                </div>

                {/* 📊 BARRA DE DESGASTE KILÓMETRO A KILÓMETRO con tonos Neón */}
                <div className="mt-4 flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs font-mono">
                    <span className="text-primary-400 uppercase tracking-wider text-[9px] font-bold">Consumo de vida útil</span>
                    <span className={`font-black tracking-tight ${
                      statusColor === "danger"
                        ? "text-red-450 neon-glow-red"
                        : statusColor === "warning"
                        ? "text-amber-450 neon-glow-amber"
                        : "text-emerald-450 neon-glow-green"
                    }`}>
                      {wearPercentage}%
                    </span>
                  </div>

                  {/* Progress track */}
                  <div className="w-full bg-primary-950 h-3 rounded-full overflow-hidden border border-primary-900 p-[1px]">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 relative ${
                        statusColor === "danger"
                          ? "bg-gradient-to-r from-red-650 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                          : statusColor === "warning"
                          ? "bg-gradient-to-r from-amber-650 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]"
                          : "bg-gradient-to-r from-emerald-650 to-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                      }`}
                      style={{ width: `${wearPercentage}%` }}
                    />
                  </div>
                  
                  {/* Status subtitle helper */}
                  <div className="text-[10px] text-left">
                    {statusColor === "danger" ? (
                      <span className="text-red-400 font-semibold">• Semáforo Rojo (<strong className="font-black">&lt;4.500 km</strong>). Requiere sustitución inmediata.</span>
                    ) : statusColor === "warning" ? (
                      <span className="text-amber-400 font-semibold">• Semáforo Ámbar (<strong className="font-semibold">4.000 - 6.000 km</strong>). Inspeccionar pronto.</span>
                    ) : (
                      <span className="text-emerald-400 font-semibold">• Semáforo Verde (<strong className="font-semibold">&gt;6.000 km</strong>). Kilometraje de viaje seguro.</span>
                    )}
                  </div>
                </div>

                {/* Calculations for remaining targets (Timeline items con meses redondos) */}
                <div className="mt-4 grid grid-cols-2 gap-3 bg-[#11151e] p-3 rounded-xl border border-primary-850">
                  <div className="flex flex-col text-left">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-primary-400">Restan Kilómetros</span>
                    {task.cada_km > 0 ? (
                      <span className={`font-mono text-xs md:text-sm font-bold mt-0.5 ${
                        kmRemaining < 4000 ? "text-red-400 font-black animate-pulse" : kmRemaining <= 6000 ? "text-amber-400" : "text-white"
                      }`}>
                        {kmRemaining <= 0 
                          ? `Excedido por ${Math.abs(kmRemaining).toLocaleString("es-ES")} km` 
                          : `${kmRemaining.toLocaleString("es-ES")} km`
                        }
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-primary-500 mt-0.5">No aplica</span>
                    )}
                  </div>

                  <div className="flex flex-col border-l border-primary-800/80 pl-3 md:pl-3.5 text-left">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-primary-400">Restan Meses (Redondo)</span>
                    {task.cada_meses > 0 ? (
                      <span className={`font-mono text-xs md:text-sm font-bold mt-0.5 ${
                        formattedMonthsRemaining <= 1 ? "text-red-450 font-black" : formattedMonthsRemaining <= 2 ? "text-amber-400" : "text-white"
                      }`}>
                        {formattedMonthsRemaining <= 0 
                          ? "Caducado" 
                          : `${formattedMonthsRemaining} meses`
                        }
                      </span>
                    ) : (
                      <span className="font-mono text-xs text-primary-500 mt-0.5">No aplica</span>
                    )}
                  </div>
                </div>

                {/* History tracker of last changed */}
                <div className="mt-3.5 flex items-center gap-1.5 bg-[#141924]/80 rounded-lg px-3 py-2 border border-primary-850 font-mono text-[9px] md:text-[10px] text-primary-400 text-left">
                  <History className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                  {track && (track.lastCompletedKm !== undefined || track.lastCompletedDate) ? (
                    <span className="leading-tight">
                      Último cambio realizado el{" "}
                      {track.lastCompletedDate 
                        ? new Date(track.lastCompletedDate).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
                        : ""
                      }{" "}
                      a los {track.lastCompletedKm?.toLocaleString("es-ES") || 0} KM
                    </span>
                  ) : (
                    <span className="italic text-primary-500 leading-tight">Sin historial previo. Se asume calibrado del vehículo inicial.</span>
                  )}
                </div>

              </div>

              {/* Action Operations */}
              <div className="flex flex-wrap items-center gap-2 border-t border-primary-900 pt-3">
                <button
                  id={`quick-done-${task.id}`}
                  type="button"
                  onClick={() => handleQuickComplete(task.id)}
                  className="flex-1 rounded-lg bg-primary-900/80 hover:bg-primary-800 text-white font-sans text-xs font-extrabold py-2 border border-primary-800 hover:border-accent-gold transition-all active:scale-95 text-center cursor-pointer uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  Cambio Hecho ({car.currentKm.toLocaleString("es-ES")} km)
                </button>

                <button
                  id={`manual-done-btn-${task.id}`}
                  type="button"
                  onClick={() => openCompleteModal(task.id)}
                  className="rounded-lg bg-primary-950 hover:bg-primary-900 p-2 border border-primary-800 hover:border-accent-gold transition-colors cursor-pointer"
                  title="Registrar con diferente kilometraje u otra fecha"
                >
                  <Calendar className="h-4 w-4 text-accent-gold animate-bounce" />
                </button>

                <button
                  id={`delete-task-${task.id}`}
                  type="button"
                  onClick={() => handleDeleteTask(task.id)}
                  className="rounded-lg bg-primary-950 hover:bg-red-950/20 p-2 border border-primary-850 hover:border-red-900/40 text-primary-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Eliminar pieza del plan"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Completion Register Overlay */}
      {activeLogTaskId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <form
            onSubmit={handleSaveCompletion}
            className="garage-panel w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4 border border-primary-800"
          >
            <div className="flex justify-between items-center border-b border-primary-900 pb-3">
              <h4 className="font-display font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                <Wrench className="h-4 w-4 text-accent-gold" /> REGISTRAR RECAMBIO MANUAL
              </h4>
              <button
                id="close-manual-modal"
                type="button"
                onClick={() => setActiveLogTaskId(null)}
                className="text-primary-500 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-primary-400 leading-relaxed font-sans mt-1 text-left">
              Guarda el kilometraje preciso y la fecha del servicio anterior. Esto recalculará instantáneamente la barra de desgaste actual del coche.
            </p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-300">
                  Lectura del odómetro en ese momento:
                </label>
                <div className="relative">
                  <input
                    id="modal-log-km"
                    type="number"
                    required
                    min={0}
                    value={logKm}
                    onChange={(e) => setLogKm(Number(e.target.value))}
                    className="w-full rounded-lg border border-primary-800 bg-primary-950 pl-3 pr-10 py-2.5 text-xs font-mono text-white outline-none focus:border-accent-gold"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-accent-gold font-mono">
                    KM
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary-300">
                  Fecha de la intervención:
                </label>
                <input
                  id="modal-log-date"
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full rounded-lg border border-primary-800 bg-primary-950 px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-accent-gold"
                />
              </div>
            </div>

            <div className="mt-3 flex justify-end gap-2.5 text-xs">
              <button
                id="cancel-modal-btn"
                type="button"
                onClick={() => setActiveLogTaskId(null)}
                className="rounded-lg border border-primary-edit hover:bg-primary-900 px-4 py-2 text-primary-300 transition-colors font-semibold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                id="submit-modal-btn"
                type="submit"
                className="rounded-lg bg-accent-gold hover:bg-cyan-400 text-primary-950 font-sans font-black px-5 py-2 transition-all shadow-[0_0_15px_rgba(0,210,255,0.2)] cursor-pointer uppercase tracking-wider"
              >
                Guardar Log de Taller
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
