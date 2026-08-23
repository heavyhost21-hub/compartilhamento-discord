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
  const pendingCandidatesRef = useRef(new Map());
  const remoteMediaStreamsRef = useRef(new Map());
  const makingOfferRef = useRef(new Map());
  const negotiationPendingRef = useRef(new Set());
  const initiatePeerRef = useRef(null);
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
    pendingCandidatesRef.current.delete(peerId);
    remoteMediaStreamsRef.current.delete(peerId);
    makingOfferRef.current.delete(peerId);
    negotiationPendingRef.current.delete(peerId);
    syncRemoteStreamForPeer(peerId, null);
  }, [syncRemoteStreamForPeer]);

  const cleanupAllPeers = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    setRemoteStreams({});
  }, []);

  const addLocalTracks = useCallback((pc) => {
    if (!localStreamRef.current) return;
    for (const kind of ['video', 'audio']) {
      const track = localStreamRef.current.getTracks().find((candidate) => candidate.kind === kind);
      const transceiver = pc.getTransceivers().find((candidate) => candidate.receiver.track.kind === kind);
      if (!track || !transceiver) continue;
      transceiver.direction = 'sendrecv';
      transceiver.sender.replaceTrack(track);
      if (kind === 'video') {
        applySenderParameters(transceiver.sender, getAdaptivePreset(qualityRef.current, {}));
      }
    }
  }, []);

  const createPeer = useCallback((peerId) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const pc = createPeerConnection();
    peerConnectionsRef.current.set(peerId, pc);
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    addLocalTracks(pc);

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? remoteMediaStreamsRef.current.get(peerId) ?? new MediaStream();
      if (!event.streams[0] && !stream.getTracks().includes(event.track)) stream.addTrack(event.track);
      remoteMediaStreamsRef.current.set(peerId, stream);
      setRemoteStream(stream);
      syncRemoteStreamForPeer(peerId, stream);
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
    pc.onnegotiationneeded = () => {
      initiatePeerRef.current?.(peerId);
    };
    return pc;
  }, [addLocalTracks, cleanupPeer, syncRemoteStreamForPeer]);

  const initiatePeer = useCallback(async (peerId) => {
    const pc = createPeer(peerId);
    if (pc.signalingState !== 'stable' || makingOfferRef.current.get(peerId)) {
      negotiationPendingRef.current.add(peerId);
      return;
    }
    makingOfferRef.current.set(peerId, true);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('signal', {
        targetId: peerId,
        signal: { type: 'offer', sdp: offer.sdp },
      });
    } finally {
      makingOfferRef.current.set(peerId, false);
      if (negotiationPendingRef.current.has(peerId) && pc.signalingState === 'stable') {
        negotiationPendingRef.current.delete(peerId);
        queueMicrotask(() => initiatePeerRef.current?.(peerId));
      }
    }
  }, [createPeer]);

  initiatePeerRef.current = initiatePeer;

  const handleSignal = useCallback(async (fromId, signal) => {
    let pc = createPeer(fromId);

    if (signal.type === 'offer') {
      const isPolite = myIdRef.current > fromId;
      const offerCollision = makingOfferRef.current.get(fromId) || pc.signalingState !== 'stable';
      if (offerCollision && !isPolite) return;
      if (offerCollision && isPolite && pc.signalingState === 'have-local-offer') {
        await pc.setLocalDescription({ type: 'rollback' });
      } else if (pc.signalingState !== 'stable') {
        cleanupPeer(fromId);
        pc = createPeer(fromId);
      }
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));
      addLocalTracks(pc);
      const pendingCandidates = pendingCandidatesRef.current.get(fromId) ?? [];
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(fromId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current?.emit('signal', {
        targetId: fromId,
        signal: { type: 'answer', sdp: answer.sdp },
      });
      return;
    }

    if (signal.type === 'answer') {
      if (pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));
      const pendingCandidates = pendingCandidatesRef.current.get(fromId) ?? [];
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(fromId);
      if (negotiationPendingRef.current.has(fromId)) {
        negotiationPendingRef.current.delete(fromId);
        queueMicrotask(() => initiatePeerRef.current?.(fromId));
      }
    }
    if (signal.type === 'candidate' && pc.remoteDescription) {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } else if (signal.type === 'candidate') {
      const pendingCandidates = pendingCandidatesRef.current.get(fromId) ?? [];
      pendingCandidates.push(signal.candidate);
      pendingCandidatesRef.current.set(fromId, pendingCandidates);
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
        const transceiver = pc.getTransceivers().find((candidate) => candidate.sender.track === track);
        if (transceiver) {
          transceiver.sender.replaceTrack(null);
          transceiver.direction = 'recvonly';
        }
      });

      if (pc.signalingState === 'stable') {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
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
