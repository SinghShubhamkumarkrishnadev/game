/* Jodi Scribble - Production-Grade WebRTC P2P Networking Engine */
(function (global) {
  'use strict';

  var peer = null;
  var conn = null;
  var eventListeners = {};
  var connectionStatus = 'disconnected'; // 'disconnected' | 'creating' | 'joining' | 'connected'
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

  function generateRoomCode() {
    var num = Math.floor(1000 + Math.random() * 9000);
    return 'JODI-' + num;
  }

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

  function send(type, payload) {
    if (conn && conn.open) {
      try {
        conn.send({ type: type, payload: payload, ts: Date.now() });
      } catch (e) {
        console.warn('[JodiNet] Send failed for ' + type, e);
      }
    }
  }

  function startHeartbeat() {
    stopHeartbeat();
    lastHeardTime = Date.now();
    heartbeatTimer = setInterval(function () {
      if (conn && conn.open) {
        lastPingTime = Date.now();
        send('PING', { t: lastPingTime });

        // Check if partner went silent
        if (Date.now() - lastHeardTime > 9000 && connectionStatus === 'connected') {
          emit('connectionLurking', { latency: lastLatencyMs });
        }
      }
    }, 2500);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function setupConnection(c) {
    conn = c;

    conn.on('open', function () {
      connectionStatus = 'connected';
      lastHeardTime = Date.now();
      startHeartbeat();

      // Handshake immediately
      send('HANDSHAKE', {
        name: myName,
        avatar: myAvatar,
        isHost: isHost,
        roomCode: activeRoomCode
      });

      emit('statusChange', connectionStatus);
    });

    conn.on('data', function (msg) {
      if (!msg || !msg.type) return;
      lastHeardTime = Date.now();

      if (msg.type === 'PING') {
        send('PONG', { t: msg.payload ? msg.payload.t : Date.now() });
      } else if (msg.type === 'PONG') {
        if (msg.payload && msg.payload.t) {
          lastLatencyMs = Math.max(8, Date.now() - msg.payload.t);
          emit('latencyUpdate', { ms: lastLatencyMs });
        }
      } else if (msg.type === 'HANDSHAKE') {
        partnerName = msg.payload.name || 'Partner';
        partnerAvatar = msg.payload.avatar || '✨';
        emit('connected', {
          partnerName: partnerName,
          partnerAvatar: partnerAvatar,
          isHost: isHost,
          roomCode: activeRoomCode
        });
      } else {
        emit(msg.type, msg.payload);
      }
    });

    conn.on('close', function () {
      stopHeartbeat();
      connectionStatus = 'disconnected';
      emit('partnerDisconnected');
      emit('statusChange', connectionStatus);
    });

    conn.on('error', function (err) {
      console.warn('[JodiNet] Connection error', err);
      emit('error', err);
    });
  }

  function createRoom(name, avatar, callback) {
    leaveRoom();
    myName = name || 'Host';
    myAvatar = avatar || '💖';
    isHost = true;
    activeRoomCode = generateRoomCode();
    var peerId = 'jodisync-' + activeRoomCode.toLowerCase().replace(/[^a-z0-9]/g, '');

    connectionStatus = 'creating';
    emit('statusChange', connectionStatus);

    if (typeof Peer === 'undefined') {
      if (callback) callback(new Error('PeerJS not loaded. Check internet connection.'));
      return;
    }

    try {
      peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });
    } catch (e) {
      if (callback) callback(e);
      return;
    }

    peer.on('open', function () {
      connectionStatus = 'waiting';
      emit('statusChange', connectionStatus);
      emit('roomCreated', { roomCode: activeRoomCode });
      if (callback) callback(null, activeRoomCode);
    });

    peer.on('connection', function (c) {
      setupConnection(c);
    });

    peer.on('error', function (err) {
      console.warn('[JodiNet] Peer error during create:', err);
      if (err.type === 'unavailable-id') {
        // Retry with another fresh code
        createRoom(name, avatar, callback);
      } else {
        emit('error', err);
        if (callback) callback(err);
      }
    });
  }

  function joinRoom(roomCode, name, avatar, callback) {
    leaveRoom();
    myName = name || 'Partner';
    myAvatar = avatar || '✨';
    isHost = false;
    activeRoomCode = roomCode.trim().toUpperCase();
    var hostPeerId = 'jodisync-' + activeRoomCode.toLowerCase().replace(/[^a-z0-9]/g, '');

    connectionStatus = 'joining';
    emit('statusChange', connectionStatus);

    if (typeof Peer === 'undefined') {
      if (callback) callback(new Error('PeerJS not loaded. Check internet connection.'));
      return;
    }

    try {
      peer = new Peer(null, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });
    } catch (e) {
      if (callback) callback(e);
      return;
    }

    peer.on('open', function () {
      var c = peer.connect(hostPeerId, { reliable: true });
      setupConnection(c);
      if (callback) callback(null, activeRoomCode);
    });

    peer.on('error', function (err) {
      console.warn('[JodiNet] Peer error during join:', err);
      emit('error', err);
      if (callback) callback(err);
    });
  }

  function leaveRoom() {
    stopHeartbeat();
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

  global.JodiNet = {
    on: on,
    off: off,
    emit: emit,
    send: send,
    createRoom: createRoom,
    joinRoom: joinRoom,
    leaveRoom: leaveRoom,
    getStatus: function () { return connectionStatus; },
    getRoomCode: function () { return activeRoomCode; },
    isHostUser: function () { return isHost; },
    getMyName: function () { return myName; },
    getMyAvatar: function () { return myAvatar; },
    getPartnerName: function () { return partnerName; },
    getPartnerAvatar: function () { return partnerAvatar; },
    getLatency: function () { return lastLatencyMs; }
  };
})(window);
