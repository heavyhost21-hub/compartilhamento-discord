import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { networkInterfaces } from 'os';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MAX_VIEWERS = 5;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  maxHttpBufferSize: 1e7,
  pingInterval: 10000,
  pingTimeout: 5000,
});

let hostId = null;
const viewers = new Map();

function getLocalIPs() {
  const ips = [];
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

function getRoomState() {
  return {
    hostId,
    hostSharing: hostId ? viewers.get(hostId)?.sharing ?? false : false,
    viewers: Array.from(viewers.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      isHost: id === hostId,
      sharing: data.sharing,
    })),
    maxViewers: MAX_VIEWERS,
    viewerCount: Array.from(viewers.keys()).filter((id) => id !== hostId).length,
  };
}

function broadcastRoom() {
  io.emit('room-update', getRoomState());
}

app.get('/api/info', (_req, res) => {
  res.json({
    port: PORT,
    ips: getLocalIPs(),
    maxViewers: MAX_VIEWERS,
    ...getRoomState(),
  });
});

app.use(express.static(join(__dirname, '../client/dist')));

app.get('*', (_req, res) => {
  const indexPath = join(__dirname, '../client/dist/index.html');
  res.sendFile(indexPath, (err) => {
    if (err) res.status(404).send('Build the client first: npm run build');
  });
});

io.on('connection', (socket) => {
  socket.on('join', ({ name, asHost }) => {
    const viewerCount = Array.from(viewers.keys()).filter((id) => id !== hostId).length;

    if (asHost) {
      if (hostId && hostId !== socket.id) {
        socket.emit('error', { message: 'Já existe um host na sala.' });
        return;
      }
      hostId = socket.id;
    } else {
      if (!hostId) {
        socket.emit('error', { message: 'Nenhum host disponível. Aguarde o host iniciar.' });
        return;
      }
      if (viewerCount >= MAX_VIEWERS) {
        socket.emit('error', { message: `Limite de ${MAX_VIEWERS} espectadores atingido.` });
        return;
      }
    }

    viewers.set(socket.id, {
      name: name?.trim() || `Usuário-${socket.id.slice(0, 4)}`,
      sharing: false,
    });

    socket.emit('joined', {
      id: socket.id,
      isHost: socket.id === hostId,
      ips: getLocalIPs(),
      port: PORT,
    });

    broadcastRoom();
  });

  socket.on('sharing-state', ({ sharing }) => {
    const user = viewers.get(socket.id);
    if (!user) return;
    user.sharing = sharing;
    broadcastRoom();
  });

  socket.on('signal', ({ targetId, signal }) => {
    io.to(targetId).emit('signal', {
      fromId: socket.id,
      signal,
    });
  });

  socket.on('request-offer', ({ hostId: requestedHostId }) => {
    if (requestedHostId && hostId) {
      io.to(hostId).emit('viewer-joined', { viewerId: socket.id });
    }
  });

  socket.on('disconnect', () => {
    const wasHost = socket.id === hostId;
    viewers.delete(socket.id);

    if (wasHost) {
      hostId = null;
      io.emit('host-left');
    }

    broadcastRoom();
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIPs();
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     Discord Share Clone — Servidor Local     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Porta: ${PORT}                                  ║`);
  console.log('║  Espectadores máximos: 5                     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Outros PCs conectam em:                     ║');
  ips.forEach((ip) => {
    console.log(`║  → http://${ip}:${PORT}`.padEnd(47) + '║');
  });
  if (ips.length === 0) {
    console.log('║  → http://localhost:3000                     ║');
  }
  console.log('╚══════════════════════════════════════════════╝\n');
});
