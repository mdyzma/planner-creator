import type { FormatId, PlannerProject, PrintProfile } from '@planner/schema';
import { defaultPrintSettings, iso838TwoHole } from '@planner/schema';

/** Page count multiple each print profile needs so no sheet side is left over. */
export function padToForProfile(profile: PrintProfile): 1 | 2 | 4 {
  switch (profile) {
    case 'home-a5-2up':
    case 'home-booklet':
      return 4;
    default:
      return 2;
  }
}

/**
 * Switches a project between A4 and A5 (§1, acceptance criterion 3). Layout reflows because
 * templates use flow layout; only format-bound print settings change.
 */
export function withFormat(project: PlannerProject, format: FormatId): PlannerProject {
  if (project.format === format) return project;
  const binding = project.print.binding;
  const profile = project.print.profile;
  const margins = project.print.margins;
  const oldDefaults = defaultPrintSettings(project.format).margins;
  const untouchedMargins = (Object.keys(oldDefaults) as (keyof typeof oldDefaults)[]).every(
    (k) => margins[k] === oldDefaults[k],
  );
  return {
    ...project,
    format,
    generation: { ...project.generation, format },
    print: {
      ...project.print,
      // Default margins follow the format; customised margins are kept.
      margins: untouchedMargins ? defaultPrintSettings(format).margins : margins,
      // Swap between the two home defaults; leave deliberate choices alone.
      profile:
        format === 'A5' && profile === 'home-duplex'
          ? 'home-a5-2up'
          : format === 'A4' && (profile === 'home-a5-2up' || profile === 'home-a5-native')
            ? 'home-duplex'
            : profile,
      binding:
        binding.kind === 'ring' && binding.preset === 'iso838-2hole'
          ? { ...iso838TwoHole(format), punchGuides: binding.punchGuides }
          : binding,
    },
  };
}
