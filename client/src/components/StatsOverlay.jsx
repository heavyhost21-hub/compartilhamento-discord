import { formatBitrate } from '../utils/webrtc.js';
import './StatsOverlay.css';

export default function StatsOverlay({ stats, sharing, quality }) {
  if (!sharing || !stats) return null;

  return (
    <div className="stats-overlay">
      <div className="stats-row">
        <span className="stats-label">Resolução</span>
        <span className="stats-value">
          {stats.frameWidth && stats.frameHeight
            ? `${stats.frameWidth}×${stats.frameHeight}`
            : '—'}
        </span>
      </div>
      <div className="stats-row">
        <span className="stats-label">FPS</span>
        <span className="stats-value">{stats.framesPerSecond?.toFixed(0) ?? '—'}</span>
      </div>
      <div className="stats-row">
        <span className="stats-label">Bitrate</span>
        <span className="stats-value">{formatBitrate(stats.bitrate)}</span>
      </div>
      <div className="stats-row">
        <span className="stats-label">Latência</span>
        <span className="stats-value">{stats.roundTripTime?.toFixed(0) ?? '—'} ms</span>
      </div>
      <div className="stats-row">
        <span className="stats-label">Perda</span>
        <span className={`stats-value ${stats.packetsLost > 20 ? 'warn' : ''}`}>
          {stats.packetsLost ?? 0} pkts
        </span>
      </div>
      <div className="stats-row">
        <span className="stats-label">Modo</span>
        <span className="stats-value">{quality === 'auto' ? 'Adaptativo' : quality}</span>
      </div>
    </div>
  );
}
