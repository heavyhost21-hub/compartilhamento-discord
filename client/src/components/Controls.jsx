import { QUALITY_PRESETS } from '../utils/webrtc.js';
import './Controls.css';

export default function Controls({
  isHost,
  sharing,
  connected,
  quality,
  audioMode,
  audioVolume,
  onStartShare,
  onStopShare,
  onQualityChange,
  onAudioModeChange,
  onAudioVolumeChange,
}) {
  return (
    <div className="controls-bar">
      <div className="controls-left">
        {isHost && (
          <>
            {!sharing ? (
              <button className="control-btn share-btn" onClick={onStartShare} disabled={!connected}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 18c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" />
                </svg>
                Compartilhar Tela
              </button>
            ) : (
              <button className="control-btn stop-btn" onClick={onStopShare}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                Parar Compartilhamento
              </button>
            )}

            <div className="quality-selector">
              <label htmlFor="quality">Qualidade</label>
              <select
                id="quality"
                value={quality}
                onChange={(e) => onQualityChange(e.target.value)}
                disabled={!connected}
              >
                {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.label}</option>
                ))}
              </select>
            </div>

            <div className="quality-selector audio-selector">
              <label htmlFor="audio-mode">Áudio</label>
              <select
                id="audio-mode"
                value={audioMode}
                onChange={(e) => onAudioModeChange(e.target.value)}
                disabled={!connected}
              >
                <option value="none">Sem áudio</option>
                <option value="mic">Microfone</option>
              </select>
            </div>

            <div className="quality-selector volume-selector">
              <label htmlFor="volume">Volume</label>
              <input
                id="volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={audioVolume}
                onChange={(e) => onAudioVolumeChange(Number(e.target.value))}
                disabled={!connected || audioMode === 'none'}
              />
            </div>
          </>
        )}

        {!isHost && (
          <span className="viewer-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
            </svg>
            Modo espectador
          </span>
        )}
      </div>

      <div className="controls-right">
        <div className={`connection-status ${connected ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {connected ? 'Conectado' : 'Desconectado'}
        </div>
      </div>
    </div>
  );
}
