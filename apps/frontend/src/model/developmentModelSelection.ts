import type { ModelArtifact } from './artifactSchema';

let selectedDevelopmentArtifact: ModelArtifact | null = null;

export function selectDevelopmentShadowArtifact(artifact: ModelArtifact): void {
  if (artifact.status !== 'development') {
    throw new Error('Only development artifacts may be selected through Model Lab.');
  }
  selectedDevelopmentArtifact = artifact;
}

export function getDevelopmentShadowArtifact(): ModelArtifact | null {
  return selectedDevelopmentArtifact;
}

export function getPilotDevelopmentShadowArtifact(
  pilot: boolean,
  modelLabEnabled: boolean,
): ModelArtifact | null {
  return pilot && modelLabEnabled ? selectedDevelopmentArtifact : null;
}

export function clearDevelopmentShadowArtifact(): void {
  selectedDevelopmentArtifact = null;
}
