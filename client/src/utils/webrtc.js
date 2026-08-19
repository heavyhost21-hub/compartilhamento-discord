export const QUALITY_PRESETS = {
  auto: {
    label: 'Automático',
    maxBitrate: 12_000_000,
    maxFramerate: 60,
    scaleResolutionDownBy: 1,
    contentHint: 'motion',
  },
  source: {
    label: 'Qualidade da fonte',
    maxBitrate: 20_000_000,
    maxFramerate: 60,
    scaleResolutionDownBy: 1,
    contentHint: 'detail',
  },
  high: {
    label: 'Alta (1080p60)',
    maxBitrate: 8_000_000,
    maxFramerate: 60,
    scaleResolutionDownBy: 1,
    contentHint: 'motion',
  },
  medium: {
    label: 'Média (1080p30)',
    maxBitrate: 4_000_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1,
    contentHint: 'motion',
  },
  low: {
    label: 'Baixa (720p30)',
    maxBitrate: 2_000_000,
    maxFramerate: 30,
    scaleResolutionDownBy: 1.5,
    contentHint: 'motion',
  },
};

export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function createPeerConnection() {
  const pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    iceCandidatePoolSize: 4,
  });
  return pc;
}

export function mergeMediaStreams(...streams) {
  const merged = new MediaStream();
  streams.filter(Boolean).forEach((stream) => {
    stream.getTracks().forEach((track) => merged.addTrack(track));
  });
  return merged;
}

export async function getOptimizedDisplayMedia(preset = QUALITY_PRESETS.auto, { audioMode = 'none' } = {}) {
  const includeMicAudio = audioMode === 'mic';

  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: 'always',
      frameRate: { ideal: preset.maxFramerate, max: preset.maxFramerate },
      width: { ideal: 1920, max: 3840 },
      height: { ideal: 1080, max: 2160 },
    },
    audio: false,
    preferCurrentTab: false,
    selfBrowserSurface: 'exclude',
    systemAudio: 'exclude',
    surfaceSwitching: 'include',
    monitorTypeSurfaces: 'include',
  });

  const videoTrack = stream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.contentHint = preset.contentHint;
  }

  if (!includeMicAudio) return stream;

  const micStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });

  return mergeMediaStreams(stream, micStream);
}

export async function applySenderParameters(sender, preset) {
  if (!sender) return;

  const params = sender.getParameters();
  if (!params.encodings?.length) {
    params.encodings = [{}];
  }

  params.encodings[0] = {
    ...params.encodings[0],
    maxBitrate: preset.maxBitrate,
    maxFramerate: preset.maxFramerate,
    scaleResolutionDownBy: preset.scaleResolutionDownBy,
    priority: 'high',
    networkPriority: 'high',
  };

  params.degradationPreference = 'maintain-framerate';

  try {
    await sender.setParameters(params);
  } catch {
    /* browser may reject some params */
  }
}

export async function collectConnectionStats(pc) {
  const stats = await pc.getStats();
  let result = {
    bitrate: 0,
    packetsLost: 0,
    framesPerSecond: 0,
    frameWidth: 0,
    frameHeight: 0,
    jitter: 0,
    roundTripTime: 0,
  };

  stats.forEach((report) => {
    if (report.type === 'outbound-rtp' && report.kind === 'video') {
      result.bitrate = report.bytesSent ? Math.round((report.bytesSent * 8) / 1000) : 0;
      result.framesPerSecond = report.framesPerSecond ?? 0;
      result.frameWidth = report.frameWidth ?? 0;
      result.frameHeight = report.frameHeight ?? 0;
      result.packetsLost = report.packetsLost ?? 0;
    }
    if (report.type === 'inbound-rtp' && report.kind === 'video') {
      result.framesPerSecond = report.framesPerSecond ?? result.framesPerSecond;
      result.frameWidth = report.frameWidth ?? result.frameWidth;
      result.frameHeight = report.frameHeight ?? result.frameHeight;
      result.jitter = report.jitter ?? 0;
      result.packetsLost = report.packetsLost ?? result.packetsLost;
    }
    if (report.type === 'candidate-pair' && report.state === 'succeeded') {
      result.roundTripTime = (report.currentRoundTripTime ?? 0) * 1000;
    }
  });

  return result;
}

export function getAdaptivePreset(currentPreset, stats) {
  if (currentPreset !== 'auto') return QUALITY_PRESETS[currentPreset];

  const { framesPerSecond, packetsLost, roundTripTime } = stats;

  if (packetsLost > 50 || roundTripTime > 200) {
    return QUALITY_PRESETS.low;
  }
  if (packetsLost > 20 || roundTripTime > 100 || framesPerSecond < 20) {
    return QUALITY_PRESETS.medium;
  }
  return QUALITY_PRESETS.high;
}

export function formatBitrate(kbps) {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(1)} Mbps`;
  return `${kbps} Kbps`;
}

export function getServerUrl() {
  const params = new URLSearchParams(window.location.search);
  const host = params.get('host') || window.location.hostname;
  const port = params.get('port') || (import.meta.env.DEV ? '3000' : window.location.port || '3000');
  
  // Use WSS em HTTPS (Render), WS em HTTP (localhost)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = window.location.protocol === 'https:' 
    ? `${protocol}//${host}` // Sem porta em produção (Render usa 443)
    : `http://${host}:${port}`; // Com porta em localhost
  
  return url;
}
