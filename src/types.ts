export type FuelType = "Gasolina" | "Diésel" | "Híbrido" | "Eléctrico";
export type VehicleType = "Coche" | "Moto";

export interface CarProfile {
  id?: string; // Support possible multiple or clear single identification
  vehicleType?: VehicleType;
  makeModel: string;
  fuelType: FuelType;
  year: number;
  currentKm: number;
  monthlyKm: number;
  vin?: string;
  registrationDate?: string; // Optional date for time predictions
}

export interface MaintenanceTask {
  id: string; // generated client-side for stable React mapping
  tarea: string;
  cada_km: number;
  cada_meses: number;
  isCustom?: boolean;
}

export interface TaskTracking {
  id: string; // task ID refers to MaintenanceTask.id
  lastCompletedKm?: number; // kilometer when last done
  lastCompletedDate?: string; // date when last done
}

export interface AlertInfo {
  taskId: string;
  isAlert: boolean;
  type: "warning" | "danger" | "ok";
  message: string;
  kmRemaining: number;
  monthsRemaining: number;
}
