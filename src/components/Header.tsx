import { Bell, Clock, AlertTriangle, AlertCircle, CheckCircle, ShieldAlert, Menu, HelpCircle } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { SimvaLogo } from "./SimvaLogo";

export interface NotificationItem {
  id: string;
  type: "warning" | "danger";
  message: string;
  vehicleName: string;
  taskName: string;
  timestampText: string;
}

interface HeaderProps {
  hasCar: boolean;
  carName?: string;
  notifications?: NotificationItem[];
  onMenuToggle?: () => void;
  onShowGuide?: () => void;
}

export default function Header({ hasCar, carName, notifications = [], onMenuToggle, onShowGuide }: HeaderProps) {
  const [time, setTime] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown if clicked outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const totalNotifs = notifications.length;
  const hasDanger = notifications.some((n) => n.type === "danger");
  const bellColorClass = totalNotifs > 0
    ? hasDanger 
      ? "text-red-500 hover:text-red-450 animate-bounce" 
      : "text-amber-500 hover:text-amber-450 animate-pulse"
    : "text-on-surface-variant hover:text-primary-fixed-dim";

  return (
    <header className="fixed top-0 left-0 w-full z-50 h-16 flex justify-between items-center px-6 bg-black/60 backdrop-blur-xl border-b border-white/10">
      <div className="flex items-center gap-2.5">
        {onMenuToggle && (
          <button 
            type="button" 
            onClick={onMenuToggle}
            className="md:hidden p-1.5 rounded-lg border border-white/10 text-white hover:bg-white/5 active:scale-95 transition-all cursor-pointer mr-1"
            title="Abrir Menú"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        )}
        <SimvaLogo className="h-6.5 w-6.5 shrink-0" />
        <h1 className="font-sans text-lg font-black tracking-widest text-white leading-none">SIMVA</h1>
        {hasCar && (
          <span className="hidden sm:inline-block ml-3 rounded-full bg-primary-fixed-dim/10 px-3 py-0.5 text-[10px] font-mono font-bold uppercase text-primary-fixed-dim border border-primary-fixed-dim/20">
            {carName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 relative" ref={dropdownRef}>
        {/* Realtime Clock */}
        <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
          <Clock className="h-3.5 w-3.5 text-primary-fixed-dim" />
          <span>{time}</span>
        </div>

        {/* Onboarding Guide Trigger button */}
        {hasCar && onShowGuide && (
          <button
            type="button"
            onClick={onShowGuide}
            className="p-1.5 rounded-lg border border-transparent hover:border-[#2ac1ff]/20 bg-transparent hover:bg-[#2ac1ff]/5 text-on-surface-variant hover:text-[#2ac1ff] transition-all cursor-pointer flex items-center justify-center shrink-0"
            title="Guía de Inicio SIMVA"
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
        )}

        {/* Notifications Bell and Dropdown Container */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            className={`relative p-1.5 rounded-lg border transition-all cursor-pointer ${bellColorClass} ${
              totalNotifs > 0 
                ? hasDanger 
                  ? "border-red-500/20 bg-red-500/5 shadow-[0_0_10px_rgba(239,68,68,0.15)]" 
                  : "border-amber-500/20 bg-amber-500/5 shadow-[0_0_10px_rgba(245,158,11,0.15)]"
                : "border-transparent hover:bg-white/5"
            }`}
            title="Notificaciones de Desgaste"
          >
            <Bell className="h-4.5 w-4.5" />
            
            {totalNotifs > 0 && (
              <span className={`absolute -top-1 -right-1 h-4 w-4 rounded-full text-[9px] font-mono font-black border text-white flex items-center justify-center shadow-md ${
                hasDanger ? "bg-red-500 border-red-400 animate-pulse" : "bg-amber-500 border-amber-400"
              }`}>
                {totalNotifs}
              </span>
            )}
          </button>

          {/* Interactive Absolute Popover dropdown panel */}
          {showDropdown && (
            <div className="absolute right-0 mt-2.5 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#11141a]/95 backdrop-blur-2xl shadow-[0_15px_45px_rgba(0,0,0,0.8),0_0_20px_rgba(42,193,255,0.05)] text-left select-none overflow-hidden z-50 animate-fade-in-up">
              {/* Dropdown Header */}
              <div className="px-4 py-3 border-b border-white/5 bg-white/2 flex items-center justify-between">
                <span className="font-mono text-[9px] font-extrabold text-[#2ac1ff] uppercase tracking-widest">
                  Centro de Alertas SIMVA
                </span>
                <span className="font-mono text-[8px] text-on-surface-variant uppercase">
                  Frecuencia de Diagnóstico Activa
                </span>
              </div>

              {/* Dropdown Body */}
              <div className="max-h-80 overflow-y-auto divide-y divide-white/5">
                {totalNotifs === 0 ? (
                  <div className="p-6 text-center space-y-2">
                    <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto opacity-75 animate-bounce" />
                    <h4 className="font-sans font-extrabold text-xs text-white uppercase tracking-tight">Sistemas Nominales</h4>
                    <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed max-w-[240px] mx-auto">
                      SIMVA no ha detectado anomalías leves o urgentes en ningún vehículo registrado. ¡Buen viaje!
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="p-3.5 hover:bg-white/2 transition-colors space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`font-mono text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                          item.type === "danger" 
                            ? "bg-red-500/15 text-red-400 border border-red-500/20" 
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                        }`}>
                          {item.type === "danger" ? "Urgente" : "Leve"}
                        </span>
                        
                        <div className="flex items-center gap-1 text-[8.5px] font-mono text-on-surface-variant">
                          <span>{item.timestampText}</span>
                          <span className="h-1 w-1 rounded-full bg-white/20" />
                          <span className="text-[#2ac1ff] font-bold uppercase">{item.vehicleName}</span>
                        </div>
                      </div>

                      <p className="text-xs text-gray-250 leading-relaxed font-sans font-medium">
                        {item.message}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              <div className="bg-black/40 px-4 py-2.5 text-center border-t border-white/5">
                <p className="text-[9px] font-mono text-on-surface-variant uppercase tracking-wider">
                  Monitoreo de desgaste en tiempo real
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

