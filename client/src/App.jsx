import { useState } from 'react';
import JoinScreen from './components/JoinScreen.jsx';
import UserList from './components/UserList.jsx';
import ScreenShare from './components/ScreenShare.jsx';
import Controls from './components/Controls.jsx';
import StatsOverlay from './components/StatsOverlay.jsx';
import { useScreenShare } from './hooks/useScreenShare.js';
import './App.css';

function MainRoom({ userName, isHost }) {
  const {
    connected,
    error,
    room,
    myId,
    localStream,
    remoteStream,
    remoteStreams,
    sharing,
    quality,
    audioMode,
    audioVolume,
    stats,
    startSharing,
    stopSharing,
    updateQuality,
    updateAudioMode,
    updateAudioVolume,
    setError,
  } = useScreenShare({ userName, isHost });

  const hostUser = room?.viewers?.find((u) => u.isHost);
  const shareLabel = isHost
    ? 'Sua tela'
    : hostUser?.sharing
      ? `Tela de ${hostUser.name}`
      : null;

  const shareStreams = [
    ...(localStream ? [{ id: 'local', stream: localStream, label: 'Sua tela', isLocal: true, sharing }] : []),
    ...Object.entries(remoteStreams).map(([peerId, stream]) => {
      const user = room?.viewers?.find((u) => u.id === peerId);
      return {
        id: peerId,
        stream,
        label: user ? `Tela de ${user.name}` : 'Tela compartilhada',
        isLocal: false,
        sharing: user?.sharing ?? true,
      };
    }).filter((item) => item.sharing),
  ];

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#5865f2" />
            <path d="M8 8h8v1.5H8V8zm0 2.5h8v1.5H8v-1.5zm0 2.5h5v1.5H8V13z" fill="white" />
          </svg>
          <span className="header-title">Screen Share</span>
          {isHost && <span className="host-badge">HOST</span>}
        </div>
        <div className="header-right">
          {isHost && room?.viewers && (
            <span className="header-info">
              {room.viewerCount}/{room.maxViewers} espectadores
            </span>
          )}
        </div>
      </header>

      <div className="app-body">
        <UserList
          users={room?.viewers ?? []}
          myId={myId}
          maxViewers={room?.maxViewers ?? 5}
          viewerCount={room?.viewerCount ?? 0}
        />

        <main className="main-content">
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button onClick={() => setError(null)}>✕</button>
            </div>
          )}

          <div className="share-container">
            {shareStreams.length > 0 ? (
              shareStreams.map((item) => (
                <ScreenShare
                  key={item.id}
                  stream={item.stream}
                  isLocal={item.isLocal}
                  label={item.label}
                  sharing={item.sharing}
                  audioVolume={audioVolume}
                />
              ))
            ) : (
              <ScreenShare
                stream={null}
                isLocal={isHost}
                label={shareLabel}
                sharing={isHost ? sharing : hostUser?.sharing}
                audioVolume={audioVolume}
              />
            )}
            {isHost && <StatsOverlay stats={stats} sharing={sharing} quality={quality} />}
          </div>

          <Controls
            isHost={isHost}
            sharing={sharing}
            connected={connected}
            quality={quality}
            audioMode={audioMode}
            audioVolume={audioVolume}
            onStartShare={startSharing}
            onStopShare={stopSharing}
            onQualityChange={updateQuality}
            onAudioModeChange={updateAudioMode}
            onAudioVolumeChange={updateAudioVolume}
          />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);

  if (!session) {
    return <JoinScreen onJoin={setSession} />;
  }

  return (
    <MainRoom
      userName={session.name}
      isHost={session.isHost}
    />
  );
}
