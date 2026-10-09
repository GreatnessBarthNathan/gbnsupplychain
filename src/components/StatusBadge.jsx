import { stageLabel } from '../api';

export default function StatusBadge({ stage }) {
  return <span className={`status-badge status-${stage.replace(/_/g, '-')}`}>{stageLabel(stage)}</span>;
}
