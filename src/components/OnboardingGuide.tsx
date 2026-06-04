import { useState, useEffect } from "react";
import { 
  Sparkles, 
  Gauge, 
  Wrench, 
  MapPin, 
  FileText, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  HelpCircle,
  Eye,
  Sliders
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface OnboardingGuideProps {
  vehiclesCount: number;
  activeScreen: string;
  setActiveScreen: (screen: "garaje" | "mantenimientos" | "talleres" | "documentos" | "perfil") => void;
  selectedVehicleId: string | null;
  setSelectedVehicleId: (id: string | null) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onHighlightSelector?: (selector: string | null) => void;
}

export default function OnboardingGuide({
  vehiclesCount,
  activeScreen,
  setActiveScreen,
  selectedVehicleId,
  setSelectedVehicleId,
  isOpen,
  setIsOpen,
  onHighlightSelector
}: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-trigger if a user registers their first vehicle and has not finished onboarding
  // Only triggers the very first time (it is saved in localStorage so replenishment/re-logins don't trigger it again automatically)
  useEffect(() => {
    const isCompleted = localStorage.getItem("simva_onboarding_completed");
    const isAutoShown = localStorage.getItem("simva_onboarding_auto_shown");
    if (vehiclesCount === 1 && !isCompleted && !isAutoShown) {
      // Small delay to let the UI settle
      const timer = setTimeout(() => {
        setIsOpen(true);
        setCurrentStep(0);
        localStorage.setItem("simva_onboarding_auto_shown", "true");
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [vehiclesCount, setIsOpen]);

  // If the guide is resetting from an external click, make sure the step is reset if the guide opens again
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen || vehiclesCount === 0) {
    return null;
  }

  const steps = [
    {
      title: "🚀 ¡Bienvenido a SIMVA!",
      icon: <Sparkles className="h-5 w-5 text-[#2ac1ff]" />,
      content: "Has registrado tu primer vehículo virtual. SIMVA calcula de forma predictiva la 'Línea de vida útil' basándose en tu kilometraje amortizado.",
      highlight: null,
      screen: "garaje",
      actionText: "Iniciar recorrido",
      prepare: () => {
        // Switch to principal view but make sure details screen is visible
        setActiveScreen("garaje");
      }
    },
    {
      title: "🎯 Calibrar Kilometraje",
      icon: <Gauge className="h-5 w-5 text-amber-400" />,
      content: "La clave de la predicción está en los KMs del odómetro. En el panel de telemetría de abajo, ingresa tus kilómetros actuales reales y presiona 'Calibrar KM'. ¡Hazlo cada pocas semanas!",
      highlight: "input[type='number']",
      screen: "garaje",
      actionText: "Entendido, ver tareas",
      prepare: () => {
        setActiveScreen("garaje");
        // We make sure a vehicle has been selected to show details
        const odometerInput = document.querySelector("input[type='number']");
        if (odometerInput) {
          odometerInput.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    {
      title: "🔧 Control de Repuestos y Tareas",
      icon: <Wrench className="h-5 w-5 text-emerald-400" />,
      content: "Desliza en tu móvil y verás el gestor de componentes. Indica cuándo realizaste un mantenimiento para reiniciar su vida útil o ver los intervalos sugeridos por la IA de SIMVA.",
      highlight: "#tracker-title",
      screen: "garaje",
      actionText: "Ver talleres y guantera",
      prepare: () => {
        setActiveScreen("garaje");
        const trackerTitle = document.getElementById("tracker-title");
        if (trackerTitle) {
          trackerTitle.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    },
    {
      title: "📂 Guantera y Talleres Cercanos",
      icon: <FileText className="h-5 w-5 text-purple-400" />,
      content: "Utiliza la pestaña 'Talleres' para ubicar talleres mecánicos geolocalizados para emergencias, y la 'Guantera Virtual' para guardar tus facturas, ITV, seguro y multas.",
      highlight: null,
      screen: "documentos",
      actionText: "Finalizar guía",
      prepare: () => {
        setActiveScreen("documentos");
      }
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const nextIdx = currentStep + 1;
      setCurrentStep(nextIdx);
      steps[nextIdx].prepare();
    } else {
      // Mark onboarding as completed
      localStorage.setItem("simva_onboarding_completed", "true");
      setIsOpen(false);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevIdx = currentStep - 1;
      setCurrentStep(prevIdx);
      steps[prevIdx].prepare();
    }
  };

  const handleSkip = () => {
    localStorage.setItem("simva_onboarding_completed", "true");
    setIsOpen(false);
  };

  const activeStepConfig = steps[currentStep];

  return (
    <AnimatePresence>
      <div className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-[350px] z-[100] outline-none">
        
        {/* Glow effect matching active step indicator status */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="glass-card rounded-2xl border-2 border-[#2ac1ff]/40 bg-[#0c0f13]/98 shadow-[0_15px_40px_rgba(42,193,255,0.25),0_0_20px_rgba(0,0,0,0.8)] backdrop-blur-2xl p-4 flex flex-col gap-3.5 relative text-left"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded bg-[#2ac1ff]/10">
                {activeStepConfig.icon}
              </div>
              <div>
                <span className="text-[9px] font-mono font-bold text-[#2ac1ff]/95 uppercase tracking-widest block leading-3">GUÍA DE INDUCCIÓN</span>
                <span className="text-[11px] font-mono text-gray-400">Paso {currentStep + 1} de {steps.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="text-on-surface-variant hover:text-white text-[9px] font-mono uppercase tracking-wider underline cursor-pointer"
              >
                No volver a ver
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/5 cursor-pointer"
                title="Cerrar guía temporalmente"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <h4 className="font-sans font-black text-white text-xs sm:text-sm uppercase tracking-tight">
              {activeStepConfig.title}
            </h4>
            <p className="text-[11.5px] sm:text-xs text-gray-300 leading-relaxed font-sans font-medium">
              {activeStepConfig.content}
            </p>
          </div>

          {/* Context trigger hint if active step belongs to different tab */}
          {activeScreen !== activeStepConfig.screen && (
            <div className="bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 rounded-lg p-2 text-[9px] font-mono text-[#2ac1ff] flex items-center justify-between gap-1">
              <span>Se requiere cambiar a pantalla principal...</span>
              <button
                type="button"
                onClick={() => {
                  setActiveScreen(activeStepConfig.screen as any);
                  activeStepConfig.prepare();
                }}
                className="px-2 py-0.5 bg-[#2ac1ff]/20 rounded font-black hover:bg-[#2ac1ff]/40 uppercase"
              >
                Ir ya
              </button>
            </div>
          )}

          {/* Footer Controllers */}
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <div className="flex gap-1">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-mono text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Atrás</span>
                </button>
              ) : (
                <div className="w-[50px]" />
              )}
            </div>

            {/* Step bubbles */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep 
                      ? "w-4 bg-[#2ac1ff] shadow-[0_0_8px_rgba(42,193,255,0.6)]" 
                      : idx < currentStep 
                        ? "w-1.5 bg-emerald-500" 
                        : "w-1.5 bg-white/20"
                  }`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleNext}
              className="py-1.5 px-3 bg-[#2ac1ff] hover:bg-[#2ac1ff]/85 text-black font-extrabold font-sans text-[10px] rounded-lg tracking-wider uppercase flex items-center gap-1 cursor-pointer active:scale-95 shadow-[0_0_15px_rgba(42,193,255,0.25)] transition-all"
            >
              <span>{activeStepConfig.actionText}</span>
              {currentStep < steps.length - 1 ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-black" />
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
