import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/development-artifact-1.json';
import { approvedDefaultModel, createModelRegistry } from './modelRegistry';

describe('model registry', () => {
  it('keeps Official shadow unavailable when only a development fixture exists', () => {
    const registry = createModelRegistry([fixture]);
    expect(registry[0]).toMatchObject({ label: 'No model installed', availability: 'unavailable' });
    expect(registry[1]).toMatchObject({
      availability: 'available',
      artifact: { status: 'development', modelId: 'fixture-logistic-development-1' },
    });
    expect(approvedDefaultModel(registry)).toBeNull();
  });

  it('rejects status/source mismatches and multiple approved defaults', () => {
    expect(createModelRegistry([], [fixture])[1]).toMatchObject({ availability: 'incompatible' });
    const approved = { ...fixture, status: 'approved', modelId: 'model-1' };
    expect(approvedDefaultModel(createModelRegistry([], [approved, approved]))).toBeNull();
  });
});
