import { Sliders, Search, Sparkles, Bell } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary-800 bg-primary-950/20 px-6 py-12 text-center">
      {/* Icon cluster */}
      <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary-900 border border-primary-700 text-accent-gold shadow-lg shadow-accent-gold/5">
        <Sparkles className="h-8 w-8 animate-pulse" />
      </div>

      <h3 className="font-display text-xl font-bold uppercase tracking-wider text-white">
        Tu Garaje Virtual de Mantenimiento está vacío
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-primary-400">
        Configura tu coche en el panel lateral o carga uno de nuestros ejemplos listos para probar el sistema de alertas tempranas de repuesto.
      </p>

      {/* Interactive explanations */}
      <div className="mt-8 grid max-w-2xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
        {/* Step 1 */}
        <div className="rounded-lg bg-primary-950/60 border border-primary-900 p-4">
          <div className="flex items-center gap-2 text-accent-gold mb-2">
            <Sliders className="h-4 w-4" />
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white">Configura</h4>
          </div>
          <p className="text-xs text-primary-400">
            Anota tu modelo, kilometraje actual (odometer) y el uso mensual estimado para calibrar las métricas de tu coche.
          </p>
        </div>

        {/* Step 2 */}
        <div className="rounded-lg bg-primary-950/60 border border-primary-900 p-4">
          <div className="flex items-center gap-2 text-accent-gold mb-2">
            <Search className="h-4 w-4" />
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white">Generación IA</h4>
          </div>
          <p className="text-xs text-primary-400">
            Gemini recupera los intervalos de manual oficiales o aplica el estándar recomendado de fábrica para tu motorización.
          </p>
        </div>

        {/* Step 3 */}
        <div className="rounded-lg bg-primary-950/60 border border-primary-900 p-4">
          <div className="flex items-center gap-2 text-accent-gold mb-2">
            <Bell className="h-4 w-4" />
            <h4 className="font-display text-xs font-bold uppercase tracking-widest text-white">Monitorea</h4>
          </div>
          <p className="text-xs text-primary-400">
            Diferencia cada tarea con alertas de advertencia activas cuando queden menos de 500 km para prevenir fallos mecánicos.
          </p>
        </div>
      </div>
    </div>
  );
}
