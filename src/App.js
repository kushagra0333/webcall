import React, { useEffect, useRef, useState } from 'react';
import './App.css';

function App() {
  const [username, setUsername] = useState('');
  const [number, setNumber] = useState('');
  const [serverUrl, setServerUrl] = useState('wss://webcall-91wi.onrender.com');
  const [connected, setConnected] = useState(false);
  const [clients, setClients] = useState([]);
  const [speakerId, setSpeakerId] = useState(null);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  function connect() {
    if (!username) {
      alert('Please enter a username');
      return;
    }
    const ws = new WebSocket(serverUrl);
    ws.binaryType = 'blob';
    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'join', username, number }));
    };

    ws.onmessage = async (ev) => {
      if (typeof ev.data === 'string') {
        let msg = {};
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type === 'clients') setClients(msg.clients || []);
        if (msg.type === 'speaker') setSpeakerId(msg.id || null);
        if (msg.type === 'talk_granted') {
          startRecording();
        }
        if (msg.type === 'talk_denied') {
          alert('Someone else is speaking. Try later.');
        }
        return;
      }

      // binary audio blob received
      const blob = ev.data;
      playAudioBlob(blob);
    };

    ws.onclose = () => {
      setConnected(false);
      setClients([]);
      setSpeakerId(null);
    };

    wsRef.current = ws;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }
      };

      recorder.start(250);
    } catch (e) {
      console.error('Unable to start recording', e);
    }
  }

  function stopRecordingAndRelease() {
    const r = mediaRecorderRef.current;
    if (r && r.state !== 'inactive') {
      r.stop();
      mediaRecorderRef.current = null;
    }
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'release_talk' }));
    }
  }

  function requestTalk() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'request_talk' }));
  }

  function playAudioBlob(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play().catch(() => {
      // Autoplay may be blocked; user interactions required
    });
    audio.onended = () => URL.revokeObjectURL(url);
  }

  return (
    <div className="App" style={{ padding: 20 }}>
      <h2>WebCall — Push-to-Talk over Local WiFi (WebSocket)</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Username: </label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} />
        <label style={{ marginLeft: 12 }}>Number: </label>
        <input value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Server WebSocket URL: </label>
        <input style={{ width: 300 }} value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
        <button onClick={connect} disabled={connected} style={{ marginLeft: 8 }}>Connect</button>
        <span style={{ marginLeft: 12 }}>{connected ? 'Connected' : 'Not connected'}</span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Clients:</strong> {clients.map(c => c.username).join(', ') || '—'}
      </div>

      <div style={{ marginBottom: 12 }}>
        <strong>Current speaker:</strong> {speakerId ? (clients.find(c => c.id === speakerId)?.username || speakerId) : 'None'}
      </div>

      <div>
        <button
          onMouseDown={() => { requestTalk(); }}
          onMouseUp={() => { stopRecordingAndRelease(); }}
          onTouchStart={(e) => { e.preventDefault(); requestTalk(); }}
          onTouchEnd={(e) => { e.preventDefault(); stopRecordingAndRelease(); }}
          disabled={!connected}
          style={{ padding: '12px 20px', fontSize: 16 }}
        >
          Hold to Talk
        </button>
      </div>

      <p style={{ marginTop: 18, color: '#666' }}>
        Notes: Both participants should connect to the same server (on the same WiFi network). The server relays audio chunks via WebSocket (TCP). Only one person may speak at a time.
      </p>
    </div>
  );
}

export default App;
