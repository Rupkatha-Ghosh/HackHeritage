import { createOrcaPlan, getRunnableTasks } from '../server/services/agenticPlanner.ts';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const fishingPlan = createOrcaPlan('Find the best potential fishing zone near Goa with chlorophyll and SST');
const fishingTasks = new Map(fishingPlan.tasks.map(task => [task.id, task]));

assert(fishingTasks.get('pfz')?.enabled === true, 'Fishing/PFZ query must enable PFZ task.');
assert(fishingTasks.get('pfz')?.dependsOn.includes('risk') === true, 'PFZ must depend on marine risk.');
assert(fishingTasks.get('pfz')?.dependsOn.includes('gis') === true, 'Fishing PFZ task must consume GIS/geofence reasoning when GIS is enabled.');
assert(fishingTasks.get('synthesis')?.dependsOn.includes('pfz') === true, 'Synthesis must consume PFZ output.');
assert(fishingPlan.intent === 'potential_fishing_zone_intelligence', 'PFZ query should receive PFZ-specific intent.');

const initialRunnable = getRunnableTasks(fishingPlan).map(task => task.id).sort();
assert(initialRunnable.length === 1 && initialRunnable[0] === 'resolve_location_time', 'Only location/time resolution should be runnable initially.');

const safetyPlan = createOrcaPlan('Is it safe to venture tomorrow morning?', 'en');
const safetyPfz = safetyPlan.tasks.find(task => task.id === 'pfz');
assert(safetyPfz?.enabled === false, 'Pure safety query should not run PFZ unless requested.');

console.log('ORCA-X agentic PFZ planning tests passed:', {
  fishingPfzEnabled: fishingTasks.get('pfz')?.enabled,
  pfzDependencies: fishingTasks.get('pfz')?.dependsOn,
  synthesisIncludesPfz: fishingTasks.get('synthesis')?.dependsOn.includes('pfz'),
  initialRunnable,
  safetyPfzEnabled: safetyPfz?.enabled,
});
