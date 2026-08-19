import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  QUALITY_PRESETS,
  applySenderParameters,
  collectConnectionStats,
  createPeerConnection,
  getAdaptivePreset,
  getOptimizedDisplayMedia,
  getServerUrl,
} from '../utils/webrtc.js';

export function useScreenShare({ userName, isHost }) {
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const qualityRef = useRef('auto');
  const statsIntervalRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [room, setRoom] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [sharing, setSharing] = useState(false);
  const [quality, setQuality] = useState('auto');
  const [audioMode, setAudioMode] = useState('none');
  const [audioVolume, setAudioVolume] = useState(1);
  const [stats, setStats] = useState(null);
  const [myId, setMyId] = useState(null);

  const audioModeRef = useRef('none');
  const audioVolumeRef = useRef(1);
  const myIdRef = useRef(null);
  const roomRef = useRef(null);

  qualityRef.current = quality;
  audioModeRef.current = audioMode;
  audioVolumeRef.current = audioVolume;

  const syncRemoteStreamForPeer = useCallback((peerId, stream) => {
    setRemoteStreams((current) => {
      const next = { ...current };
      if (stream) {
        next[peerId] = stream;
      } else {
        delete next[peerId];
      }
      return next;
    });
  }, []);

  const handleSignalRef = useRef(null);

  const cleanupPeer = useCallback((peerId) => {
    const pc = peerConnectionsRef.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerId);
    }
    syncRemoteStreamForPeer(peerId, null);
  }, [syncRemoteStreamForPeer]);

  const cleanupAllPeers = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteStreams({});
  }, []);

  const addLocalTracks = useCallback((pc) => {
    if (!localStreamRef.current) return;
    const existingTracks = new Set(pc.getSenders().map((sender) => sender.track).filter(Boolean));
    localStreamRef.current.getTracks().forEach((track) => {
      if (existingTracks.has(track)) return;
      const sender = pc.addTrack(track, localStreamRef.current);
      if (track.kind === 'video') {
        applySenderParameters(sender, getAdaptivePreset(qualityRef.current, {}));
      }
    });
  }, []);

  const createPeer = useCallback((peerId) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = createPeerConnection();
    peerConnectionsRef.current.set(peerId, pc);
    addLocalTracks(pc);

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
        syncRemoteStreamForPeer(peerId, stream);
      }
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('signal', {
          targetId: peerId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') cleanupPeer(peerId);
    };
    return pc;
  }, [addLocalTracks, cleanupPeer, syncRemoteStreamForPeer]);

  const initiatePeer = useCallback(async (peerId) => {
    if (!myIdRef.current || myIdRef.current > peerId) return;
    const pc = createPeer(peerId);
    if (pc.signalingState !== 'stable') return;
    const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
    await pc.setLocalDescription(offer);
    socketRef.current?.emit('signal', {
      targetId: peerId,
      signal: { type: 'offer', sdp: offer.sdp },
    });
  }, [createPeer]);

  const handleSignal = useCallback(async (fromId, signal) => {
    let pc = createPeer(fromId);

    if (signal.type === 'offer') {
      if (pc.signalingState !== 'stable') {
        cleanupPeer(fromId);
        pc = createPeer(fromId);
      }
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
      addLocalTracks(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('signal', {
        targetId: fromId,
        signal: { type: 'answer', sdp: answer.sdp },
      });
      return;
    }

    if (signal.type === 'answer' && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
    }
    if (signal.type === 'candidate' && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }, [addLocalTracks, cleanupPeer, createPeer]);

  handleSignalRef.current = handleSignal;

  const syncPeers = useCallback((roomState) => {
    roomRef.current = roomState;
    const participantIds = new Set((roomState.viewers ?? []).map((user) => user.id));
    participantIds.delete(myIdRef.current);

    peerConnectionsRef.current.forEach((_pc, peerId) => {
      if (!participantIds.has(peerId)) cleanupPeer(peerId);
    });
    participantIds.forEach((peerId) => {
      createPeer(peerId);
      initiatePeer(peerId);
    });
  }, [cleanupPeer, createPeer, initiatePeer]);

  const stopSharing = useCallback(() => {
    const previousStream = localStreamRef.current;
    if (!previousStream) return;

    peerConnectionsRef.current.forEach(async (pc, peerId) => {
      previousStream.getTracks().forEach((track) => {
        const sender = pc.getSenders().find((candidate) => candidate.track === track);
        if (sender) pc.removeTrack(sender);
      });

      if (pc.signalingState === 'stable') {
        const offer = await pc.createOffer({ offerToReceiveAudio: false, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('signal', {
          targetId: peerId,
          signal: { type: 'offer', sdp: offer.sdp },
        });
      }
    });

    previousStream.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setSharing(false);
    socketRef.current?.emit('sharing-state', { sharing: false });
  }, []);

  const startSharing = useCallback(async () => {
    try {
      setError(null);
      const preset = QUALITY_PRESETS[qualityRef.current] ?? QUALITY_PRESETS.auto;
      const stream = await getOptimizedDisplayMedia(preset, { audioMode: audioModeRef.current });

      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopSharing();
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      setSharing(true);
      socketRef.current?.emit('sharing-state', { sharing: true });
      (roomRef.current?.viewers ?? [])
        .filter((user) => user.id !== myIdRef.current)
        .forEach((user) => {
          const pc = createPeer(user.id);
          addLocalTracks(pc);
          initiatePeer(user.id);
        });
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        setError('Não foi possível capturar a tela. Verifique as permissões.');
      }
    }
  }, [addLocalTracks, createPeer, initiatePeer, stopSharing]);

  const updateQuality = useCallback(async (newQuality) => {
    setQuality(newQuality);
    qualityRef.current = newQuality;

    if (!localStreamRef.current) return;

    const preset = getAdaptivePreset(newQuality, stats ?? {});

    peerConnectionsRef.current.forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'video') {
          applySenderParameters(sender, preset);
        }
      });
    });

    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.contentHint = preset.contentHint;
    }
  }, [stats]);

  useEffect(() => {
    const socket = io(getServerUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join', { name: userName, asHost: isHost });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('joined', (data) => {
      setMyId(data.id);
      myIdRef.current = data.id;
    });

    socket.on('room-update', (roomState) => {
      setRoom(roomState);
      syncPeers(roomState);
    });

    socket.on('error', ({ message }) => {
      setError(message);
    });

    socket.on('signal', ({ fromId, signal }) => {
      handleSignalRef.current(fromId, signal);
    });

    socket.on('host-left', () => {
      setRemoteStream(null);
      setRemoteStreams({});
      cleanupAllPeers();
      setError('O host desconectou.');
    });

    return () => {
      stopSharing();
      cleanupAllPeers();
      socket.disconnect();
    };
  }, [cleanupAllPeers, isHost, stopSharing, syncPeers, userName]);

  useEffect(() => {
    if (!sharing || !isHost) return;

    statsIntervalRef.current = setInterval(async () => {
      const allStats = [];
      for (const pc of peerConnectionsRef.current.values()) {
        const s = await collectConnectionStats(pc);
        allStats.push(s);
      }

      if (allStats.length === 0) return;

      const avg = allStats.reduce(
        (acc, s) => ({
          bitrate: acc.bitrate + s.bitrate,
          packetsLost: Math.max(acc.packetsLost, s.packetsLost),
          framesPerSecond: Math.min(acc.framesPerSecond || 999, s.framesPerSecond || 999),
          frameWidth: Math.max(acc.frameWidth, s.frameWidth),
          frameHeight: Math.max(acc.frameHeight, s.frameHeight),
          roundTripTime: Math.max(acc.roundTripTime, s.roundTripTime),
        }),
        { bitrate: 0, packetsLost: 0, framesPerSecond: 0, frameWidth: 0, frameHeight: 0, roundTripTime: 0 },
      );

      setStats(avg);

      if (qualityRef.current === 'auto') {
        const adaptivePreset = getAdaptivePreset('auto', avg);
        peerConnectionsRef.current.forEach((pc) => {
          pc.getSenders().forEach((sender) => {
            if (sender.track?.kind === 'video') {
              applySenderParameters(sender, adaptivePreset);
            }
          });
        });
      }
    }, 2000);

    return () => clearInterval(statsIntervalRef.current);
  }, [sharing, isHost]);

  const updateAudioMode = useCallback((mode) => {
    setAudioMode(mode);
    audioModeRef.current = mode;
  }, []);

  const updateAudioVolume = useCallback((volume) => {
    const value = Number(volume);
    const safeVolume = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
    setAudioVolume(safeVolume);
    audioVolumeRef.current = safeVolume;
  }, []);

  return {
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
  };
}
