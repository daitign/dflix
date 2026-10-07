import { isMaintenanceActive, isTvBypass } from './maintenance/maintenanceConfig';
import { renderMaintenance } from './maintenance/renderMaintenance';

/**
 * EMERGENCY LOW-USAGE MAINTENANCE MODE INTERCEPTION
 * 
 * 1. Checks if maintenance is active and if the visitor is NOT an authorized TV application.
 * 2. If active for normal web: renders ultra-lightweight standalone maintenance shell.
 *    The main application, React, CSS, TMDB, Supabase, and catalog NEVER boot or import.
 * 3. If TV visitor or after October 15, 2026: dynamically imports bootstrap.tsx and loads the app.
 */
if (isMaintenanceActive() && !isTvBypass()) {
  const root = document.getElementById('root');
  renderMaintenance(root || document.body);
} else {
  import('./bootstrap');
}
