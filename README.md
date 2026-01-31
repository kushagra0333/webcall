# WebCall — Push-to-Talk over Local WiFi

This project provides a simple web-based push-to-talk voice communication system that relays audio between clients using a WebSocket (TCP) server. It asks for a username and phone number before connecting, enforces one-speaker-at-a-time, and streams short audio chunks while the user holds the "Hold to Talk" button.

## How it works

- The Node.js server (`server/index.js`) accepts WebSocket connections and keeps track of connected clients.
- Each client sends a `join` message with `username` and `number` on connect.
- When a client requests to speak (`request_talk`), the server grants talk permission if nobody else is speaking. The speaking client then records audio using `MediaRecorder` and sends short audio blobs via WebSocket (binary frames).
- The server relays binary audio frames to the other connected clients.
- When the speaker releases talk (`release_talk`) or disconnects, the server clears the speaker and allows others to request speaking.

This uses WebSocket over TCP to satisfy the TCP requirement; browsers cannot open raw TCP sockets, so WebSocket is used as a TCP-based transport.

## Files added/changed

- `server/index.js` — Node WebSocket server and simple status route
- `src/App.js` — React frontend UI: username/number input, connect, push-to-talk button
- `package.json` — added `express` and `ws` dependencies and the `start:server` script

## Requirements

- Node.js 14+ and npm
- Two machines (or browser tabs) on the same local network (WiFi) that can reach the server host and port
- A browser that supports `MediaRecorder` (most modern browsers)

## Running locally (development)

1. Install dependencies in the project root:

```bash
npm install
```

2. Start the WebSocket server (in one terminal):

```bash
npm run start:server
```

By default the server listens on port `3001`.

3. Start the React development site (in another terminal):

```bash
npm start
```

4. Open the React app in two different browsers or two devices on the same WiFi.

5. In each client, set a `Username` and `Number`, set the WebSocket URL (for example `ws://192.168.1.10:3001` where `192.168.1.10` is the machine running the server), then click `Connect`.

6. Use the `Hold to Talk` button to speak. Only one person can speak at a time. Press and hold to transmit; release to stop and let others speak.

## Notes & limitations

- Browsers do not support raw TCP sockets; WebSocket (which runs over TCP) is used instead.
- Audio is sent as short `MediaRecorder` blobs (e.g., `audio/webm`), which are played back on receipt. This is a simple relay approach and not optimized for low-latency streaming compared to WebRTC.
- Network reliability, NAT traversal, and scaling are not addressed — this is intended for LAN/local WiFi use only.
- Autoplay policies in browsers may require a user gesture before playback works. The UI is designed to be interactive to help with that.

## Troubleshooting

- If you cannot connect from another device, ensure the server machine firewall allows inbound connections on port `3001` and both devices are on the same network.
- If audio does not play, try interacting with the page (click) first to unlock audio playback.

---

If you want, I can:
- Add a small server-side static file host so the React build can be served from the same server,
- Add a `start:all` script that runs both server and client together with `concurrently`, or
- Improve audio playback queuing for smoother streaming.

Which of those would you like next?
# webcall
