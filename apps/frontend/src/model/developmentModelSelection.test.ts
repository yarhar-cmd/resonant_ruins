import { afterEach, describe, expect, it } from 'vitest';
import developmentArtifactValue from './__fixtures__/development-artifact-1.json';
import { ModelArtifactSchema } from './artifactSchema';
import {
  clearDevelopmentShadowArtifact,
  getPilotDevelopmentShadowArtifact,
  selectDevelopmentShadowArtifact,
} from './developmentModelSelection';

const fixture = ModelArtifactSchema.parse(developmentArtifactValue);

describe('explicit development model selection', () => {
  afterEach(clearDevelopmentShadowArtifact);

  it('makes the fixture available only to Pilot runs in a Model Lab build', () => {
    selectDevelopmentShadowArtifact(fixture);
    expect(getPilotDevelopmentShadowArtifact(true, true)?.artifactId).toBe(fixture.artifactId);
    expect(getPilotDevelopmentShadowArtifact(false, true)).toBeNull();
    expect(getPilotDevelopmentShadowArtifact(true, false)).toBeNull();
  });
});
