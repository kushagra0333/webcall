const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let nextClientId = 1;
const clients = new Map(); // ws -> { id, username, number }
let currentSpeaker = null; // ws

app.get('/', (req, res) => {
  res.send('WebCall WebSocket server running');
});

function broadcastJSON(obj, except) {
  const data = JSON.stringify(obj);
  for (const [ws] of clients) {
    if (ws !== except && ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

wss.on('connection', (ws, req) => {
  const id = nextClientId++;
  clients.set(ws, { id, username: null, number: null });
  console.log('Client connected', id);

  ws.on('message', (message, isBinary) => {
    if (isBinary) {
      // audio chunk - only relay if sender is current speaker
      if (ws === currentSpeaker) {
        for (const [other] of clients) {
          if (other !== ws && other.readyState === WebSocket.OPEN) {
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

    const meta = clients.get(ws);
    if (!meta) return;

    if (msg.type === 'join') {
      meta.username = msg.username || 'Anonymous';
      meta.number = msg.number || '';
      broadcastJSON({ type: 'clients', clients: Array.from(clients.values()).map(c => ({ id: c.id, username: c.username })) });
      ws.send(JSON.stringify({ type: 'joined', id: meta.id }));
      return;
    }

    if (msg.type === 'request_talk') {
      if (!currentSpeaker) {
        currentSpeaker = ws;
        ws.send(JSON.stringify({ type: 'talk_granted' }));
        broadcastJSON({ type: 'speaker', id: meta.id }, ws);
      } else {
        ws.send(JSON.stringify({ type: 'talk_denied' }));
      }
      return;
    }

    if (msg.type === 'release_talk') {
      if (ws === currentSpeaker) {
        currentSpeaker = null;
        broadcastJSON({ type: 'speaker', id: null });
      }
      return;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected', id);
    const wasSpeaker = ws === currentSpeaker;
    clients.delete(ws);
    if (wasSpeaker) {
      currentSpeaker = null;
      broadcastJSON({ type: 'speaker', id: null });
    }
    broadcastJSON({ type: 'clients', clients: Array.from(clients.values()).map(c => ({ id: c.id, username: c.username })) });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebCall server listening on ${PORT}`);
});
