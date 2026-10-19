import { getPlatformConfig, VehicleOption } from '../data/platformConfig';

// Owners think in "how many guests fit", not Sedan/SUV, so seats lead every vehicle label.
// Labels, seats and which classes are bookable come from the admin's settings.
export const vehicleLabel = (type?: string | null): string =>
  getPlatformConfig().vehicles.find((v) => v.value === type)?.label || type || '';

/** Bookable vehicle classes, in the admin's order. */
export const vehicleOptions = (): VehicleOption[] => getPlatformConfig().vehicles;
