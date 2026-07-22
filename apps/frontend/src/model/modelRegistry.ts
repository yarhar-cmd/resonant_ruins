import type { ModelArtifact } from './artifactSchema';
import { ModelArtifactSchema } from './artifactSchema';

export interface ModelRegistryEntry {
  id: string;
  label: string;
  availability: 'unavailable' | 'available' | 'incompatible';
  artifact: ModelArtifact | null;
  reason: string;
}

export function createModelRegistry(
  developmentArtifacts: readonly unknown[] = [],
  approvedArtifacts: readonly unknown[] = [],
): ModelRegistryEntry[] {
  const entries: ModelRegistryEntry[] = [
    {
      id: 'none',
      label: 'No model installed',
      availability: 'unavailable',
      artifact: null,
      reason: 'No approved compatible model is installed.',
    },
  ];
  for (const [source, artifacts] of [
    ['development', developmentArtifacts],
    ['approved', approvedArtifacts],
  ] as const) {
    for (const value of artifacts) {
      const parsed = ModelArtifactSchema.safeParse(value);
      entries.push(
        parsed.success && parsed.data.status === source
          ? {
              id: parsed.data.artifactId,
              label: `${parsed.data.modelId} · ${parsed.data.modelVersion}`,
              availability: 'available',
              artifact: parsed.data,
              reason:
                source === 'development'
                  ? 'Synthetic development artifact; explicit local or Preview selection required.'
                  : 'Manually approved compatible artifact.',
            }
          : {
              id:
                value && typeof value === 'object'
                  ? String((value as Record<string, unknown>).artifactId ?? 'invalid-artifact')
                  : 'invalid-artifact',
              label: 'Incompatible artifact',
              availability: 'incompatible',
              artifact: null,
              reason: 'Artifact schema, status, or compatibility validation failed.',
            },
      );
    }
  }
  return entries;
}

export function approvedDefaultModel(entries: readonly ModelRegistryEntry[]): ModelArtifact | null {
  const approved = entries.filter(
    (entry) => entry.availability === 'available' && entry.artifact?.status === 'approved',
  );
  return approved.length === 1 ? approved[0]!.artifact : null;
}
