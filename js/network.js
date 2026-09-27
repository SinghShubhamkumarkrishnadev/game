/* Jodi Sync - Production-Grade WebRTC P2P Networking & Auto-Reconnection Engine */
(function (global) {
  'use strict';

  var SESSION_STORAGE_KEY = 'jodisync_net_session';

  // Comprehensive STUN & free TURN servers for high-resilience NAT traversal
  // (Critical for Indian mobile carriers: Jio, Airtel, Vi with Symmetric CGNAT)
  var ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Free OpenRelay TURN servers for NAT traversal on symmetric mobile firewalls
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelay',
      credential: 'openrelay'
    }
  ];

  var PEER_CONFIG = {
    debug: 1,
    pingInterval: 5000,
    config: {
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 2,
      sdpSemantics: 'unified-plan'
    }
  };

  var CONN_OPTIONS = {
    reliable: true,
    serialization: 'json'
  };

  var EPHEMERAL_TYPES = {
    'PING': true,
    'PONG': true,
    'RACE_SYNC': true
  };

  // Internal State
  var peer = null;
  var conn = null;
  var eventListeners = {};
  var connectionStatus = 'disconnected'; // 'disconnected' | 'creating' | 'joining' | 'waiting' | 'connected' | 'reconnecting'
  var activeRoomCode = null;
  var isHost = false;
  var partnerName = '';
  var partnerAvatar = '✨';
  var myName = '';
  var myAvatar = '💖';
  var heartbeatTimer = null;
  var lastPingTime = 0;
  var lastLatencyMs = 28;
  var lastHeardTime = 0;
  var manualLeave = false;
  var outboxQueue = [];
  var reconnectGraceTimer = null;
  var reconnectSecondsLeft = 20;
  var reconnectAttempts = 0;
  var isReconnectingActive = false;
  var reconnectBackoffTimer = null;
  var joinAttempts = 0;
  var maxJoinAttempts = 4;
  var joinRetryTimer = null;
  var stateProviderFn = null;
  var stateConsumerFn = null;

  // Session Persistence Helpers
  function saveSession() {
    try {
      if (!activeRoomCode) return;
      var data = {
        roomCode: activeRoomCode,
        isHost: isHost,
        myName: myName,
        myAvatar: myAvatar,
        partnerName: partnerName,
        partnerAvatar: partnerAvatar,
        timestamp: Date.now()
      };
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {}
  }

  function getSavedSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      // Valid for 10 minutes
      if (Date.now() - data.timestamp < 600000) {
        return data;
      }
      clearSession();
    } catch (e) {}
    return null;
  }

  // Room Code Generator & Normalizer
  function generateRoomCode() {
    var num = Math.floor(1000 + Math.random() * 9000);
    return 'JODI-' + num;
  }

  function normalizeRoomCode(input) {
    var raw = String(input || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!raw) return '';
    // E.g. "4821" -> "JODI-4821"
    if (/^\d{4}$/.test(raw)) {
      return 'JODI-' + raw;
    }
    // E.g. "JODI4821" -> "JODI-4821"
    if (/^JODI\d{4}$/.test(raw)) {
      return 'JODI-' + raw.slice(4);
    }
    return raw;
  }

  function getHostPeerId(roomCode) {
    var clean = normalizeRoomCode(roomCode).toLowerCase().replace(/[^a-z0-9]/g, '');
    return 'jodisync-' + clean;
  }

  // Event Dispatcher
  function emit(type, data) {
    var list = eventListeners[type] || [];
    for (var i = 0; i < list.length; i++) {
      try {
        list[i](data);
      } catch (e) {
        console.error('[JodiNet] Listener error on ' + type, e);
      }
    }
  }

  function on(type, fn) {
    if (!eventListeners[type]) eventListeners[type] = [];
    eventListeners[type].push(fn);
  }

  function off(type, fn) {
    if (!eventListeners[type]) return;
    eventListeners[type] = eventListeners[type].filter(function (f) { return f !== fn; });
  }

  // Message Send & Outbox Queue
  function send(type, payload, options) {
    var opts = options || {};
    var isEphemeral = opts.ephemeral || !!EPHEMERAL_TYPES[type];

    // High buffer backpressure relief
    if (conn && conn.dataChannel && conn.dataChannel.bufferedAmount > 65536) {
      if (isEphemeral) return false;
    }

    var packet = {
      type: type,
      payload: payload,
      ts: Date.now()
    };

    if (conn && conn.open) {
      try {
        conn.send(packet);
        return true;
      } catch (e) {
        console.warn('[JodiNet] Send failed for ' + type, e);
      }
    }

    // Queue non-ephemeral state-critical messages when buffering/reconnecting
    if (!isEphemeral && (connectionStatus === 'reconnecting' || connectionStatus === 'joining' || connectionStatus === 'waiting' || (conn && !conn.open))) {
      if (outboxQueue.length < 80) {
        outboxQueue.push(packet);
      }
    }
    return false;
  }

  function flushOutbox() {
    if (!conn || !conn.open || outboxQueue.length === 0) return;
    console.log('[JodiNet] Flushing ' + outboxQueue.length + ' queued outbox messages');
    var queue = outboxQueue.slice();
    outboxQueue = [];
    for (var i = 0; i < queue.length; i++) {
      try {
        conn.send(queue[i]);
      } catch (e) {
        console.warn('[JodiNet] Error flushing queued packet ' + queue[i].type, e);
      }
    }
  }

  // Heartbeat & Latency Engine
  function startHeartbeat() {
    stopHeartbeat();
    lastHeardTime = Date.now();
    heartbeatTimer = setInterval(function () {
      if (conn && conn.open) {
        lastPingTime = Date.now();
        send('PING', { t: lastPingTime }, { ephemeral: true });

        var silentDuration = Date.now() - lastHeardTime;
        // Unstable link warning (> 5s of silence)
        if (silentDuration > 5000 && silentDuration <= 9500 && connectionStatus === 'connected') {
          emit('networkSlow', { latency: lastLatencyMs, duration: silentDuration });
        }
        // Link dead (> 9.5s of silence) -> Trigger Auto Reconnect
        if (silentDuration > 9500 && connectionStatus === 'connected' && !manualLeave) {
          console.warn('[JodiNet] Partner silent for ' + silentDuration + 'ms. Reconnecting...');
          triggerAutoReconnect('Heartbeat timeout');
        }
      }
    }, 2200);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  // State Sync Send
  function sendStateSync() {
    if (!conn || !conn.open) return;
    if (typeof stateProviderFn === 'function') {
      try {
        var snapshot = stateProviderFn();
        if (snapshot) {
          send('STATE_SYNC', snapshot, { priority: true });
        }
      } catch (err) {
        console.error('[JodiNet] State provider error:', err);
      }
    }
  }

  // Connection Setup & Underlying WebRTC Hooks
  function setupConnection(c) {
    if (conn && conn !== c) {
      try { conn.close(); } catch (e) {}
    }
    conn = c;

    // Monitor underlying RTCPeerConnection if accessible
    try {
      if (conn.peerConnection) {
        var pc = conn.peerConnection;
        pc.oniceconnectionstatechange = function () {
          var state = pc.iceConnectionState;
          if (state === 'disconnected') {
            if (connectionStatus === 'connected') {
              emit('networkSlow', { reason: 'ice-disconnected', latency: lastLatencyMs });
            }
          } else if (state === 'failed') {
            if (!manualLeave && connectionStatus === 'connected') {
              triggerAutoReconnect('ICE failed');
            }
          }
        };

        pc.onconnectionstatechange = function () {
          var s = pc.connectionState;
          if ((s === 'failed' || s === 'disconnected') && !manualLeave && connectionStatus === 'connected') {
            triggerAutoReconnect('PeerConnection ' + s);
          }
        };
      }
    } catch (err) {
      console.warn('[JodiNet] Error hooking RTCPeerConnection:', err);
    }

    conn.on('open', function () {
      var wasReconnecting = isReconnectingActive || connectionStatus === 'reconnecting';
      stopReconnectGrace();
      connectionStatus = 'connected';
      lastHeardTime = Date.now();
      startHeartbeat();
      saveSession();

      // Handshake immediately
      send('HANDSHAKE', {
        name: myName,
        avatar: myAvatar,
        isHost: isHost,
        roomCode: activeRoomCode,
        isReconnect: wasReconnecting
      }, { priority: true });

      // Flush any queued packets
      flushOutbox();

      emit('statusChange', connectionStatus);

      if (wasReconnecting) {
        emit('reconnected', {
          partnerName: partnerName,
          partnerAvatar: partnerAvatar,
          isHost: isHost,
          roomCode: activeRoomCode
        });
        // If guest reconnected, request state sync
        if (!isHost) {
          send('REQUEST_STATE_SYNC', {}, { priority: true });
        }
      }
    });

    conn.on('data', function (msg) {
      if (!msg || !msg.type) return;
      lastHeardTime = Date.now();

      if (msg.type === 'PING') {
        send('PONG', { t: msg.payload ? msg.payload.t : Date.now() }, { ephemeral: true });
      } else if (msg.type === 'PONG') {
        if (msg.payload && msg.payload.t) {
          var rtt = Date.now() - msg.payload.t;
          lastLatencyMs = Math.max(8, rtt);
          var quality = lastLatencyMs < 120 ? 'good' : (lastLatencyMs < 280 ? 'fair' : 'poor');
          emit('latencyUpdate', { ms: lastLatencyMs, quality: quality });
        }
      } else if (msg.type === 'HANDSHAKE') {
        partnerName = msg.payload.name || partnerName || 'Partner';
        partnerAvatar = msg.payload.avatar || partnerAvatar || '✨';
        saveSession();
        var wasPartnerReconnect = !!msg.payload.isReconnect;
        emit('connected', {
          partnerName: partnerName,
          partnerAvatar: partnerAvatar,
          isHost: isHost,
          roomCode: activeRoomCode,
          isReconnect: wasPartnerReconnect
        });
        if (isHost && wasPartnerReconnect) {
          sendStateSync();
        }
      } else if (msg.type === 'REQUEST_STATE_SYNC') {
        if (isHost) {
          sendStateSync();
        }
      } else if (msg.type === 'STATE_SYNC') {
        if (typeof stateConsumerFn === 'function' && msg.payload) {
          try {
            stateConsumerFn(msg.payload);
          } catch (err) {
            console.error('[JodiNet] Error applying state sync:', err);
          }
        }
      } else {
        emit(msg.type, msg.payload);
      }
    });

    conn.on('close', function () {
      if (manualLeave) {
        stopHeartbeat();
        connectionStatus = 'disconnected';
        emit('statusChange', connectionStatus);
      } else if (connectionStatus === 'connected' || connectionStatus === 'reconnecting') {
        triggerAutoReconnect('DataConnection closed unexpectedly');
      }
    });

    conn.on('error', function (err) {
      console.warn('[JodiNet] Connection error:', err);
      if (!manualLeave && connectionStatus === 'connected') {
        triggerAutoReconnect('DataConnection error');
      }
    });
  }

  // Auto-Reconnection & Grace Period System
  function stopReconnectGrace() {
    isReconnectingActive = false;
    if (reconnectGraceTimer) {
      clearInterval(reconnectGraceTimer);
      reconnectGraceTimer = null;
    }
    if (reconnectBackoffTimer) {
      clearTimeout(reconnectBackoffTimer);
      reconnectBackoffTimer = null;
    }
  }

  function triggerAutoReconnect(reason) {
    if (manualLeave) return;
    if (isReconnectingActive && connectionStatus === 'reconnecting') return;
    if (!activeRoomCode) return;

    console.log('[JodiNet] Starting auto-reconnect cycle. Reason:', reason);
    isReconnectingActive = true;
    connectionStatus = 'reconnecting';
    reconnectAttempts = 0;
    reconnectSecondsLeft = 20; // 20s grace period

    emit('statusChange', connectionStatus);
    emit('reconnecting', {
      secondsLeft: reconnectSecondsLeft,
      maxSeconds: 20,
      attempt: reconnectAttempts + 1
    });

    if (reconnectGraceTimer) clearInterval(reconnectGraceTimer);
    reconnectGraceTimer = setInterval(function () {
      reconnectSecondsLeft--;
      if (reconnectSecondsLeft <= 0) {
        stopReconnectGrace();
        connectionStatus = 'disconnected';
        emit('reconnectFailed', { roomCode: activeRoomCode });
        emit('partnerDisconnected');
        emit('statusChange', connectionStatus);
      } else {
        emit('reconnecting', {
          secondsLeft: reconnectSecondsLeft,
          maxSeconds: 20,
          attempt: reconnectAttempts + 1
        });
      }
    }, 1000);

    performReconnectStep();
  }

  function performReconnectStep() {
    if (!isReconnectingActive || manualLeave || !activeRoomCode) return;
    reconnectAttempts++;

    console.log('[JodiNet] Reconnect step #' + reconnectAttempts + ' for room ' + activeRoomCode);

    // If signaling broker peer disconnected, reconnect signaling
    if (peer && peer.disconnected && !peer.destroyed) {
      try {
        peer.reconnect();
      } catch (e) {
        console.warn('[JodiNet] Error reconnecting peer to broker:', e);
      }
    }

    if (isHost) {
      // Host: ensure peer is valid and listening
      if (!peer || peer.destroyed) {
        initHostPeer();
      }
      // Host waits for guest to connect, retries signaling check every 3s
      if (reconnectSecondsLeft > 2) {
        reconnectBackoffTimer = setTimeout(performReconnectStep, 3000);
      }
    } else {
      // Guest: attempt to connect to host peer ID
      var hostPeerId = getHostPeerId(activeRoomCode);
      if (!peer || peer.destroyed) {
        try {
          peer = new Peer(null, PEER_CONFIG);
          setupPeerCommon(peer);
          peer.on('open', function () {
            if (!isReconnectingActive) return;
            var c = peer.connect(hostPeerId, CONN_OPTIONS);
            setupConnection(c);
          });
        } catch (e) {
          console.warn('[JodiNet] Error creating guest peer during reconnect:', e);
        }
      } else if (!peer.disconnected) {
        try {
          var c = peer.connect(hostPeerId, CONN_OPTIONS);
          setupConnection(c);
        } catch (e) {
          console.warn('[JodiNet] Error connecting to host during reconnect:', e);
        }
      }

      // Schedule next attempt with exponential backoff if not connected
      var delay = Math.min(5000, 1500 * Math.pow(1.3, Math.min(reconnectAttempts, 5)));
      if (reconnectSecondsLeft > 3) {
        reconnectBackoffTimer = setTimeout(performReconnectStep, delay);
      }
    }
  }

  function setupPeerCommon(p) {
    p.on('disconnected', function () {
      console.warn('[JodiNet] Peer disconnected from signaling server. Auto-reconnecting...');
      if (!manualLeave && p && !p.destroyed) {
        try {
          p.reconnect();
        } catch (e) {}
      }
    });

    p.on('error', function (err) {
      console.warn('[JodiNet] Peer broker error:', err);
      if (err.type === 'peer-unavailable') {
        if (connectionStatus === 'joining' && joinAttempts < maxJoinAttempts) {
          joinAttempts++;
          console.log('[JodiNet] Host not available yet. Retrying in 1.4s (' + joinAttempts + '/' + maxJoinAttempts + ')...');
          clearTimeout(joinRetryTimer);
          joinRetryTimer = setTimeout(function () {
            if (connectionStatus === 'joining' && peer && !peer.destroyed) {
              var hostPeerId = getHostPeerId(activeRoomCode);
              var c = peer.connect(hostPeerId, CONN_OPTIONS);
              setupConnection(c);
            }
          }, 1400);
          return;
        }
      }
      if (err.type === 'unavailable-id') {
        if (connectionStatus === 'creating') {
          // If room ID busy, re-roll a fresh 4-digit code
          activeRoomCode = generateRoomCode();
          initHostPeer();
          return;
        }
      }
      emit('error', err);
    });
  }

  function initHostPeer(callback) {
    var peerId = getHostPeerId(activeRoomCode);
    try {
      peer = new Peer(peerId, PEER_CONFIG);
      setupPeerCommon(peer);

      peer.on('open', function () {
        if (connectionStatus === 'creating') {
          connectionStatus = 'waiting';
          emit('statusChange', connectionStatus);
          emit('roomCreated', { roomCode: activeRoomCode });
          saveSession();
          if (callback) callback(null, activeRoomCode);
        }
      });

      peer.on('connection', function (c) {
        setupConnection(c);
      });
    } catch (e) {
      if (callback) callback(e);
    }
  }

  // Public API: Create Room (Host)
  function createRoom(name, avatar, callback) {
    leaveRoom();
    manualLeave = false;
    myName = name || 'Host';
    myAvatar = avatar || '💖';
    isHost = true;
    activeRoomCode = generateRoomCode();

    connectionStatus = 'creating';
    emit('statusChange', connectionStatus);

    if (typeof Peer === 'undefined') {
      if (callback) callback(new Error('PeerJS not loaded. Check internet connection.'));
      return;
    }

    initHostPeer(callback);
  }

  // Public API: Join Room (Guest)
  function joinRoom(roomCode, name, avatar, callback) {
    leaveRoom();
    manualLeave = false;
    myName = name || 'Partner';
    myAvatar = avatar || '✨';
    isHost = false;
    activeRoomCode = normalizeRoomCode(roomCode);
    joinAttempts = 0;

    var hostPeerId = getHostPeerId(activeRoomCode);

    connectionStatus = 'joining';
    emit('statusChange', connectionStatus);

    if (typeof Peer === 'undefined') {
      if (callback) callback(new Error('PeerJS not loaded. Check internet connection.'));
      return;
    }

    try {
      peer = new Peer(null, PEER_CONFIG);
      setupPeerCommon(peer);

      peer.on('open', function () {
        if (connectionStatus !== 'joining') return;
        var c = peer.connect(hostPeerId, CONN_OPTIONS);
        setupConnection(c);
        if (callback) callback(null, activeRoomCode);
      });
    } catch (e) {
      if (callback) callback(e);
    }
  }

  // Public API: Manual Reconnect (Retry button)
  function reconnect() {
    manualLeave = false;
    if (activeRoomCode) {
      triggerAutoReconnect('Manual user reconnect requested');
    }
  }

  // Public API: Leave Room (Intentional)
  function leaveRoom() {
    manualLeave = true;
    stopReconnectGrace();
    stopHeartbeat();
    clearTimeout(joinRetryTimer);
    clearTimeout(reconnectBackoffTimer);
    clearSession();
    outboxQueue = [];

    if (conn) {
      try { conn.close(); } catch (e) {}
      conn = null;
    }
    if (peer) {
      try { peer.destroy(); } catch (e) {}
      peer = null;
    }

    connectionStatus = 'disconnected';
    activeRoomCode = null;
    isHost = false;
    partnerName = '';
    partnerAvatar = '✨';
    emit('statusChange', connectionStatus);
  }

  // Mobile Lifecycle & Visibility Handlers
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      // Returning to app: check connection status
      if (connectionStatus === 'connected' && conn) {
        var silent = Date.now() - lastHeardTime;
        if (silent > 3500) {
          send('PING', { t: Date.now() }, { ephemeral: true });
        }
        if (silent > 10000 && !manualLeave) {
          triggerAutoReconnect('Visibility wake heartbeat expired');
        }
      } else if (connectionStatus === 'reconnecting' && !manualLeave) {
        performReconnectStep();
      }
    }
  });

  window.addEventListener('online', function () {
    emit('online');
    if ((connectionStatus === 'reconnecting' || connectionStatus === 'disconnected') && activeRoomCode && !manualLeave) {
      console.log('[JodiNet] Browser back online. Resuming auto-reconnect...');
      performReconnectStep();
    }
  });

  window.addEventListener('offline', function () {
    emit('offline');
    emit('networkSlow', { reason: 'offline' });
  });

  // Export Production Engine
  global.JodiNet = {
    on: on,
    off: off,
    emit: emit,
    send: send,
    createRoom: createRoom,
    joinRoom: joinRoom,
    reconnect: reconnect,
    leaveRoom: leaveRoom,
    cancelRoom: leaveRoom,
    normalizeRoomCode: normalizeRoomCode,
    getStatus: function () { return connectionStatus; },
    getRoomCode: function () { return activeRoomCode; },
    isHostUser: function () { return isHost; },
    getMyName: function () { return myName; },
    getMyAvatar: function () { return myAvatar; },
    getPartnerName: function () { return partnerName; },
    getPartnerAvatar: function () { return partnerAvatar; },
    getLatency: function () { return lastLatencyMs; },
    getQuality: function () {
      return lastLatencyMs < 120 ? 'good' : (lastLatencyMs < 280 ? 'fair' : 'poor');
    },
    isReconnecting: function () { return connectionStatus === 'reconnecting'; },
    getReconnectSecondsLeft: function () { return reconnectSecondsLeft; },
    registerStateProvider: function (fn) { stateProviderFn = fn; },
    registerStateConsumer: function (fn) { stateConsumerFn = fn; },
    getSavedSession: getSavedSession
  };
})(window);
