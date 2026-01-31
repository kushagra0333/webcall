const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let nextClientId = 1;
const clients = new Map(); // ws -> { id, username, number, ip }
const speakers = new Map(); // ip -> ws (current speaker for that IP)

app.get('/', (req, res) => {
  res.send('WebCall WebSocket server running');
});

function getIp(req) {
  // Render/Proxies usually put the client IP in x-forwarded-for
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

function broadcastJSON(obj, targetIp, exceptWs) {
  const data = JSON.stringify(obj);
  for (const [ws, meta] of clients) {
    if (meta.ip === targetIp && ws !== exceptWs && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  }
}

wss.on('connection', (ws, req) => {
  const id = nextClientId++;
  const ip = getIp(req);
  
  clients.set(ws, { id, username: null, number: null, ip });
  console.log(`Client connected: ${id} from IP: ${ip}`);

  ws.on('message', (message, isBinary) => {
    const meta = clients.get(ws);
    if (!meta) return;

    if (isBinary) {
      // audio chunk - only relay if sender is current speaker for this IP group
      if (speakers.get(meta.ip) === ws) {
        for (const [other, otherMeta] of clients) {
          if (otherMeta.ip === meta.ip && other !== ws && other.readyState === WebSocket.OPEN) {
            other.send(message, { binary: true });
          }
        }
      }
      return;
    }

    let msg;
    try {
      msg = JSON.parse(message.toString());
    } catch (e) {
      console.warn('Invalid JSON from client', e);
      return;
    }

    if (msg.type === 'join') {
      meta.username = msg.username || 'Anonymous';
      meta.number = msg.number || '';
      
      // Broadcast client list ONLY to this IP group
      const groupClients = Array.from(clients.values())
        .filter(c => c.ip === meta.ip)
        .map(c => ({ id: c.id, username: c.username }));
        
      broadcastJSON({ type: 'clients', clients: groupClients }, meta.ip);
      
      // Also send current speaker status for this group
      const currentSpeakerWs = speakers.get(meta.ip);
      const currentSpeakerId = currentSpeakerWs ? clients.get(currentSpeakerWs)?.id : null;
      ws.send(JSON.stringify({ type: 'speaker', id: currentSpeakerId }));

      ws.send(JSON.stringify({ type: 'joined', id: meta.id }));
      return;
    }

    if (msg.type === 'request_talk') {
      const currentSpeaker = speakers.get(meta.ip);
      if (!currentSpeaker) {
        speakers.set(meta.ip, ws);
        ws.send(JSON.stringify({ type: 'talk_granted' }));
        broadcastJSON({ type: 'speaker', id: meta.id }, meta.ip, ws);
      } else {
        ws.send(JSON.stringify({ type: 'talk_denied' }));
      }
      return;
    }

    if (msg.type === 'release_talk') {
      if (speakers.get(meta.ip) === ws) {
        speakers.delete(meta.ip);
        broadcastJSON({ type: 'speaker', id: null }, meta.ip);
      }
      return;
    }
  });

  ws.on('close', () => {
    const meta = clients.get(ws);
    if (!meta) return;

    console.log(`Client disconnected: ${id}`);
    
    // If this client was the speaker for their IP, release it
    if (speakers.get(meta.ip) === ws) {
      speakers.delete(meta.ip);
      broadcastJSON({ type: 'speaker', id: null }, meta.ip);
    }

    clients.delete(ws);
    
    // Update client list for the group
    const groupClients = Array.from(clients.values())
      .filter(c => c.ip === meta.ip)
      .map(c => ({ id: c.id, username: c.username }));
      
    broadcastJSON({ type: 'clients', clients: groupClients }, meta.ip);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebCall server listening on ${PORT}`);
});
