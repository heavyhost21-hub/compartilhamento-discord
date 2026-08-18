import { useState } from 'react';
import './JoinScreen.css';

export default function JoinScreen({ onJoin }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState(null);
  const [hostAddress, setHostAddress] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !mode) return;

    if (mode === 'viewer' && hostAddress.trim()) {
      const url = new URL(window.location.href);
      const [host, port] = hostAddress.trim().replace(/^https?:\/\//, '').split(':');
      url.searchParams.set('host', host);
      if (port) url.searchParams.set('port', port);
      window.history.replaceState({}, '', url);
    }

    onJoin({ name: name.trim(), isHost: mode === 'host' });
  };

  return (
    <div className="join-screen">
      <div className="join-card">
        <div className="join-logo">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="12" fill="#5865f2" />
            <path
              d="M8 7.5h8v1.5H8V7.5zm0 3h8v1.5H8v-1.5zm0 3h5.5v1.5H8V13.5z"
              fill="white"
            />
            <path
              d="M6 5h12a1 1 0 011 1v12a1 1 0 01-1 1H6a1 1 0 01-1-1V6a1 1 0 011-1z"
              stroke="white"
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>

        <h1>Screen Share Local</h1>
        <p className="join-subtitle">Compartilhamento de tela em tempo real na sua rede</p>

        <form onSubmit={handleSubmit}>
          <label className="join-label">Seu nome</label>
          <input
            className="join-input"
            type="text"
            placeholder="Como os outros vão te ver"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            autoFocus
          />

          <label className="join-label">Modo de conexão</label>
          <div className="mode-selector">
            <button
              type="button"
              className={`mode-btn ${mode === 'host' ? 'active' : ''}`}
              onClick={() => setMode('host')}
            >
              <span className="mode-icon">🖥️</span>
              <span className="mode-title">Host</span>
              <span className="mode-desc">Compartilhar minha tela</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === 'viewer' ? 'active' : ''}`}
              onClick={() => setMode('viewer')}
            >
              <span className="mode-icon">👁️</span>
              <span className="mode-title">Espectador</span>
              <span className="mode-desc">Assistir a tela do host</span>
            </button>
          </div>

          {mode === 'viewer' && import.meta.env.DEV && (
            <>
              <label className="join-label">Endereço do host</label>
              <input
                className="join-input"
                type="text"
                placeholder="192.168.1.100:3000"
                value={hostAddress}
                onChange={(e) => setHostAddress(e.target.value)}
              />
              <p className="join-hint">Só necessário no modo desenvolvimento</p>
            </>
          )}

          {mode === 'viewer' && !import.meta.env.DEV && (
            <p className="join-hint viewer-connect-hint">
              Você já está conectando ao host correto pelo endereço da barra do navegador.
            </p>
          )}

          <button
            type="submit"
            className="join-submit"
            disabled={!name.trim() || !mode}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
