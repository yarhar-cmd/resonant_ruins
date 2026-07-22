import { Navigate, useSearchParams } from 'react-router-dom';
import { DungeonRunSession } from './DungeonRunPage';
import { getCounterfactualSandbox } from '../model/counterfactualSandbox';

export function ModelSandboxPage() {
  const [search] = useSearchParams();
  const sandbox = getCounterfactualSandbox(search.get('token'));
  if (!sandbox) return <Navigate to="/model-lab" replace />;
  return (
    <div className="model-sandbox-shell">
      <div className="model-sandbox-warning" role="status">
        <strong>Counterfactual Sandbox</strong>
        <span>
          This room was not originally played. Its outcome is not official research evidence.
        </span>
      </div>
      <DungeonRunSession
        initialRecord={sandbox.record}
        controllerOptions={{
          mode: 'sandbox',
          returnPath: '/model-lab',
          rewardOverride: sandbox.rewardOverride,
        }}
      />
    </div>
  );
}
