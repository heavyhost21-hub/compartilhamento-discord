import { useEffect, useRef, useState } from 'react';
import './ScreenShare.css';

export default function ScreenShare({ stream, isLocal, label, sharing, audioVolume = 1 }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      video.volume = audioVolume;
    }
    return () => {
      if (video) video.srcObject = null;
    };
  }, [stream, audioVolume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleMouseMove = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (isFullscreen) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  if (!stream && !sharing) {
    return (
      <div className="screen-share empty">
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <h2>Nenhuma tela compartilhada</h2>
          <p>{isLocal ? 'Clique em "Compartilhar Tela" para começar' : 'Aguardando o host compartilhar a tela...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`screen-share ${isFullscreen ? 'fullscreen' : ''}`}
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="share-video"
      />

      {label && (
        <div className={`share-label ${showControls ? 'visible' : ''}`}>
          <span className="live-badge">AO VIVO</span>
          <span>{label}</span>
        </div>
      )}

      <div className={`share-overlay-controls ${showControls ? 'visible' : ''}`}>
        <button className="overlay-btn" onClick={toggleFullscreen} title="Tela cheia">
          {isFullscreen ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
