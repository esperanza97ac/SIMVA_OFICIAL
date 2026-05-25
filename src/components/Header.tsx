import { Car, Bell, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface HeaderProps {
  hasCar: boolean;
  carName?: string;
}

export default function Header({ hasCar, carName }: HeaderProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-50 h-16 flex justify-between items-center px-6 bg-black/60 backdrop-blur-xl border-b border-white/10">
      <div className="flex items-center gap-2">
        <Car className="h-5 w-5 text-primary-fixed-dim" />
        <h1 className="font-sans text-xl font-bold tracking-tighter text-white">SIMVA</h1>
        {hasCar && (
          <span className="hidden sm:inline-block ml-3 rounded-full bg-primary-fixed-dim/10 px-3 py-0.5 text-[10px] font-mono font-bold uppercase text-primary-fixed-dim border border-primary-fixed-dim/20">
            {carName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Realtime Clock */}
        <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-on-surface-variant">
          <Clock className="h-3.5 w-3.5 text-primary-fixed-dim" />
          <span>{time}</span>
        </div>

        {/* Database indicator */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Telemetría Conectada</span>
        </div>

        {/* Notifications */}
        <button 
          type="button"
          className="relative text-on-surface-variant hover:text-primary-fixed-dim transition-colors cursor-pointer"
          title="Notificaciones de Desgaste"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 bg-red-500 rounded-full animate-pulse" />
        </button>
      </div>
    </header>
  );
}

