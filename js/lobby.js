/* Jodi Sync — Lobby, Welcome & Connected Room Module */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var ctx = null;

  function init(appContext) {
    ctx = appContext;
  }

  function getCtx() {
    return ctx || global.JodiContext || {};
  }

  /* Universal Header */
  function renderHeader() {
    return '<div class="garland"></div>' +
      '<header class="app-header">' +
      '<div class="brand-title">Jodi Sync <span class="brand-tag">Online</span></div>' +
      '<div class="header-actions">' +
      '<button class="icon-btn header-menu-btn" data-action="openSidebar" aria-label="Menu" title="Menu &amp; Settings">☰</button>' +
      '</div></header>';
  }

  // 1. Welcome / Name & Avatar Setup Screen
  function vWelcome() {
    var c = getCtx();
    var profile = c.profile || { name: '', avatar: '💖' };

    var avatars = ['💖', '✨', '🌹', '☕', '🎨', '🧿'];
    var avHtml = avatars.map(function (av) {
      return '<button class="avatar-opt ' + (profile.avatar === av ? 'active' : '') + '" data-action="pickAvatar" data-av="' + av + '">' + av + '</button>';
    }).join('');

    return '<section class="screen">' +
      renderHeader() +
      '<div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:14px;text-align:center">' +
      '<div style="font-size:48px">💞</div>' +
      '<h1 style="font-family:var(--font-display);font-size:clamp(28px, 7vw, 34px);color:var(--plum)">Aapka Naam Kya Hai?</h1>' +
      '<p style="color:var(--soft);font-weight:600;font-size:15px">Partner ke saath Two Minds, Scribble aur 3D Bike Race khelne ke liye naam likhein:</p>' +
      '<form id="welcomeForm" style="margin:0" onsubmit="event.preventDefault();">' +
      '<div class="card elevated">' +
      '<label style="display:block;text-align:left;font-size:12.5px;font-weight:800;color:var(--soft);margin-bottom:6px">AAPKA AVATAR CHUNEIN</label>' +
      '<div class="avatar-row">' + avHtml + '</div>' +
      '<input class="input-field" id="nameInput" placeholder="Aapka pyara naam..." value="' + esc(profile.name) + '" maxlength="14" autocomplete="off">' +
      '<div style="margin-top:14px">' +
      '<button class="btn primary" type="submit" data-action="saveName">Aage Badhein →</button>' +
      '</div></div></form></div></section>';
  }

  // 2. Room Lobby Screen (Create or Join Room)
  function vLobby() {
    var c = getCtx();
    var profile = c.profile || { name: 'Player', avatar: '💖' };
    var Net = c.Net || global.JodiNet;
    var netStatus = Net ? Net.getStatus() : 'disconnected';

    var statusBadge = netStatus === 'waiting'
      ? '<span class="live-pill" style="background:#FFF9EB;color:var(--plum);border-color:var(--genda)"><span class="dot-pulse" style="background:var(--genda)"></span> Room Taiyar Hai</span>'
      : '<span class="live-pill"><span class="dot-pulse"></span> Network Ready</span>';

    var waitingCardHtml = '';
    if (netStatus === 'waiting') {
      var code = Net.getRoomCode();
      waitingCardHtml = '<div class="room-code-card">' +
        '<div style="font-size:12.5px;font-weight:800;color:var(--soft);text-transform:uppercase">Partner ko ye Code Bhejo</div>' +
        '<div class="room-code-val">' + code + '</div>' +
        '<p style="font-size:13.5px;color:var(--soft);margin-bottom:10px">Partner phone par "Room Join Karo" mein ye code daalenge.</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;gap:8px">' +
        '<button class="btn gold sm" style="flex:1" data-action="copyCode" data-code="' + code + '">📋 Code Copy</button>' +
        '<button class="btn teal sm" style="flex:1" data-action="shareWhatsApp" data-code="' + code + '">📲 WhatsApp</button>' +
        '</div>' +
        '<button class="btn ghost sm" data-action="cancelRoom">Cancel Room</button>' +
        '</div></div>';
    }

    return '<section class="screen">' +
      renderHeader() +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div class="lobby-profile-pill" data-action="openSidebar" title="Menu &amp; Profile kholein">' +
      '<span style="font-size:22px">' + profile.avatar + '</span>' +
      '<b>' + esc(profile.name) + '</b>' +
      '<span style="font-size:12px;color:var(--soft)">⚙️</span>' +
      '</div>' +
      statusBadge +
      '</div>' +
      waitingCardHtml +
      (netStatus !== 'waiting'
        ? '<div style="display:flex;flex-direction:column;gap:12px;margin-top:6px">' +
          '<div class="card elevated" style="background:linear-gradient(135deg, #FFF9FC, #FFFFFF)">' +
          '<div style="font-size:34px;margin-bottom:4px">🏠</div>' +
          '<h2 style="font-family:var(--font-display);font-size:24px;color:var(--plum)">Naya Room Banao</h2>' +
          '<p style="color:var(--soft);font-size:14px;margin-bottom:12px">Aap host banenge. Code banega jo aap partner ko WhatsApp ya call par share karenge.</p>' +
          '<button class="btn primary" data-action="createRoom">Room Banao 🚀</button>' +
          '</div>' +
          '<div class="card elevated">' +
          '<div style="font-size:34px;margin-bottom:4px">🔑</div>' +
          '<h2 style="font-family:var(--font-display);font-size:24px;color:var(--plum)">Room Join Karo</h2>' +
          '<p style="color:var(--soft);font-size:14px;margin-bottom:12px">Partner ne code share kiya hai? Code daal kar unke room mein jud jao.</p>' +
          '<button class="btn alt" data-action="openJoinModal">Code Daalo 📲</button>' +
          '</div>' +
          '<div class="solo-arcade-entry" id="soloArcadeEntry">' +
          '<div class="solo-arcade-inner">' +
          '<div class="solo-arcade-left">' +
          '<span class="solo-arcade-glyph">🕹️</span>' +
          '<div>' +
          '<div class="solo-arcade-heading">Solo Play &amp; Check</div>' +
          '<div class="solo-arcade-sub">Akele Sabhi games try karo — partner ka wait nahi</div>' +
          '</div>' +
          '</div>' +
          '<button class="btn solo-arcade-btn" data-action="openSoloArcade">Try karo</button>' +
          '</div>' +
          '</div>' +
          '</div>'
        : '') +
      '</section>';
  }

  // 3. Connected Room Lobby (With Game Mode & Bike Selector)
  function vRoomReady() {
    var c = getCtx();
    var state = c.state;
    var profile = c.profile;
    var Net = c.Net || global.JodiNet;

    var myName = profile.name;
    var partnerName = Net.getPartnerName() || 'Partner';
    var myAvatar = profile.avatar;
    var partnerAvatar = Net.getPartnerAvatar() || '✨';
    var isHost = Net.isHostUser();
    var code = Net.getRoomCode();
    var latency = Net.getLatency();
    var ms = state.matchSettings;
    var mode = state.selectedGameMode;

    return '<section class="screen">' +
      renderHeader() +
      '<div style="text-align:center;margin-bottom:10px">' +
      '<span class="live-pill"><span class="dot-pulse"></span> Partner Connected • <span id="livePing">' + latency + 'ms</span></span>' +
      '</div>' +
      '<div class="card elevated" style="text-align:center;padding:16px 14px">' +
      '<h2 style="font-family:var(--font-display);font-size:24px;color:var(--plum);margin-bottom:2px">Dono Sync Ho Gaye! 💞</h2>' +
      '<p style="color:var(--soft);font-size:13.5px">Room Code: <b>' + code + '</b></p>' +
      '<div class="duo-row">' +
      '<div class="player-card is-me">' +
      '<span class="p-avatar">' + myAvatar + '</span>' +
      '<div class="p-name">' + esc(myName) + '</div>' +
      '<div class="p-role">' + (isHost ? 'Host' : 'Guest') + ' (Aap)</div>' +
      '</div>' +
      '<div class="player-card">' +
      '<span class="p-avatar">' + partnerAvatar + '</span>' +
      '<div class="p-name">' + esc(partnerName) + '</div>' +
      '<div class="p-role">Partner 🟢</div>' +
      '</div></div>' +

      // Game Mode Selection
      '<div class="settings-label" style="margin-top:10px"><span>🎮 Game Mode Chuno</span></div>' +
      '<div class="game-mode-grid">' +
      '<div class="game-mode-tile ' + (mode === 'twominds' ? 'active' : '') + '" data-action="setMode" data-mode="twominds">' +
      '<span class="gm-icon">🧩</span>' +
      '<div class="gm-title">Two Minds</div>' +
      '<div class="gm-desc">Co-op Puzzle</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'scribble' ? 'active' : '') + '" data-action="setMode" data-mode="scribble">' +
      '<span class="gm-icon">🎨</span>' +
      '<div class="gm-title">Scribble</div>' +
      '<div class="gm-desc">Draw &amp; Guess</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'race' ? 'active' : '') + '" data-action="setMode" data-mode="race">' +
      '<span class="gm-icon">🏍️</span>' +
      '<div class="gm-title">3D Race</div>' +
      '<div class="gm-desc">Curvy Track</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'ttt' ? 'active' : '') + '" data-action="setMode" data-mode="ttt">' +
      '<span class="gm-icon">⭕</span>' +
      '<div class="gm-title">X & O</div>' +
      '<div class="gm-desc">Tic-Tac-Toe</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'reaction' ? 'active' : '') + '" data-action="setMode" data-mode="reaction">' +
      '<span class="gm-icon">⚡</span>' +
      '<div class="gm-title">Reaction</div>' +
      '<div class="gm-desc">Speed Duel</div>' +
      '</div>' +
      '<div class="game-mode-tile ' + (mode === 'rps' ? 'active' : '') + '" data-action="setMode" data-mode="rps">' +
      '<span class="gm-icon">⚔️</span>' +
      '<div class="gm-title">RPS Battle</div>' +
      '<div class="gm-desc">Bluff &amp; Clash</div>' +
      '</div>' +
      '</div>' +

      // Mode-specific configuration
      (mode === 'twominds'
        ? '<div class="settings-section">' +
          '<div class="settings-label"><span>🧩 Puzzle Mode</span><small>' + (state.twoMindsSettings.mode || 'classic').toUpperCase() + '</small></div>' +
          '<div class="segment-group" style="flex-wrap:wrap">' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'classic' ? 'active' : '') + '" data-action="setTmMode" data-val="classic">Classic (10 Words)</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'speed' ? 'active' : '') + '" data-action="setTmMode" data-val="speed">Speed (30s)</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'sync' ? 'active' : '') + '" data-action="setTmMode" data-val="sync">Perfect Sync</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'hard' ? 'active' : '') + '" data-action="setTmMode" data-val="hard">Hard (Decoys)</button>' +
          '<button class="segment-btn ' + (state.twoMindsSettings.mode === 'daily' ? 'active' : '') + '" data-action="setTmMode" data-val="daily">Daily 📅</button>' +
          '</div>' +
          '<div class="settings-label"><span>⏱️ Timer Speed</span><small>' + state.twoMindsSettings.duration + 's per word</small></div>' +
          '<div class="segment-group">' +
          '<button class="segment-btn teal ' + (state.twoMindsSettings.duration === 60 ? 'active' : '') + '" data-action="setTmDuration" data-val="60">60s (Aaram Se)</button>' +
          '<button class="segment-btn teal ' + (state.twoMindsSettings.duration === 45 ? 'active' : '') + '" data-action="setTmDuration" data-val="45">45s (Normal)</button>' +
          '<button class="segment-btn teal ' + (state.twoMindsSettings.duration === 30 ? 'active' : '') + '" data-action="setTmDuration" data-val="30">30s (Rapid ⚡)</button>' +
          '</div></div>' +
          (isHost
            ? '<button class="btn primary" data-action="startTwoMindsMatch">Puzzles Shuru Karein 🧩💞</button>'
            : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host match shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
          )
        : (mode === 'scribble'
          ? '<div class="settings-section">' +
            '<div class="settings-label"><span>🎯 Kitne Words Chahiye?</span><small>' + ms.wordCount + ' Words</small></div>' +
            '<div class="segment-group">' +
            '<button class="segment-btn ' + (ms.wordCount === 5 ? 'active' : '') + '" data-action="setCount" data-val="5">5 Words</button>' +
            '<button class="segment-btn ' + (ms.wordCount === 10 ? 'active' : '') + '" data-action="setCount" data-val="10">10 Words</button>' +
            '<button class="segment-btn ' + (ms.wordCount === 15 ? 'active' : '') + '" data-action="setCount" data-val="15">15 Words</button>' +
            '</div>' +
            '<div class="settings-label"><span>🌐 Bhasha (Language)</span><small>' + (ms.language === 'hi' ? 'Hindi' : ms.language === 'en' ? 'English' : 'Mix') + '</small></div>' +
            '<div class="segment-group">' +
            '<button class="segment-btn teal ' + (ms.language === 'hi' ? 'active' : '') + '" data-action="setLang" data-val="hi">🇮🇳 Desi Hindi</button>' +
            '<button class="segment-btn teal ' + (ms.language === 'en' ? 'active' : '') + '" data-action="setLang" data-val="en">🇬🇧 English</button>' +
            '<button class="segment-btn teal ' + (ms.language === 'mix' ? 'active' : '') + '" data-action="setLang" data-val="mix">✨ Mix Dono</button>' +
            '</div></div>' +
            (isHost
              ? '<button class="btn primary" data-action="startMatch">Khelna Shuru Karein 🎨</button>'
              : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host match shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
            )
          : (mode === 'race'
            ? '<div class="settings-section">' +
              '<div class="settings-label"><span>🏍️ Apni Superbike Chuno</span><small>' + state.selectedBikeTheme.toUpperCase() + '</small></div>' +
              '<div class="bike-select-grid">' +
              '<div class="bike-card ' + (state.selectedBikeTheme === 'sport' ? 'active' : '') + '" data-action="pickBike" data-bike="sport">' +
              '<span class="bike-icon">🏁</span>' +
              '<div class="bike-name">Rani Neon Sport</div>' +
              '<div class="bike-tag">1000cc V4 MotoGP • Winglets</div>' +
              '<div class="bike-color-bar" style="background:linear-gradient(90deg, #D6246E, #FFB000)"></div>' +
              '</div>' +
              '<div class="bike-card ' + (state.selectedBikeTheme === 'bullet' ? 'active' : '') + '" data-action="pickBike" data-bike="bullet">' +
              '<span class="bike-icon">👑</span>' +
              '<div class="bike-name">Royal Bullet 350</div>' +
              '<div class="bike-tag">Heavy Cruiser • Chrome Thump</div>' +
              '<div class="bike-color-bar" style="background:linear-gradient(90deg, #1A1A1A, #D4AF37)"></div>' +
              '</div>' +
              '<div class="bike-card ' + (state.selectedBikeTheme === 'turbo' ? 'active' : '') + '" data-action="pickBike" data-bike="turbo">' +
              '<span class="bike-icon">⚡</span>' +
              '<div class="bike-name">Mor Teal Turbo</div>' +
              '<div class="bike-tag">Supercharged V4 • Cyber Beast</div>' +
              '<div class="bike-color-bar" style="background:linear-gradient(90deg, #0B7A7C, #38E1E4)"></div>' +
              '</div>' +
              '<div class="bike-card ' + (state.selectedBikeTheme === 'cafe' ? 'active' : '') + '" data-action="pickBike" data-bike="cafe">' +
              '<span class="bike-icon">☕</span>' +
              '<div class="bike-name">Kesar Cafe Racer</div>' +
              '<div class="bike-tag">650cc Twin • Neo-Retro Custom</div>' +
              '<div class="bike-color-bar" style="background:linear-gradient(90deg, #E65100, #FFD54F)"></div>' +
              '</div></div>' +
              '<p style="font-size:12px;color:var(--soft);margin-bottom:8px;font-weight:700">3D Real Physics • Procedural Curvy Track • Nitro Booster</p>' +
              '</div>' +
              (isHost
                ? '<button class="btn gold" data-action="startRace">Race Shuru Karein 🏍️💨</button>'
                : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host race shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
              )
            : (mode === 'reaction'
              ? '<div class="settings-section">' +
                '<div class="settings-label"><span>⏱️ Match Duration</span><small>' + ((state.reactionSettings && state.reactionSettings.duration) || 15) + 's</small></div>' +
                '<div class="segment-group">' +
                '<button class="segment-btn gold ' + (!state.reactionSettings || state.reactionSettings.duration === 15 ? 'active' : '') + '" data-action="setReactionDuration" data-val="15">15s (Rapid ⚡)</button>' +
                '<button class="segment-btn gold ' + (state.reactionSettings && state.reactionSettings.duration === 30 ? 'active' : '') + '" data-action="setReactionDuration" data-val="30">30s (Marathon ⏱️)</button>' +
                '</div>' +
                '<div class="settings-label"><span>⚠️ False Start Rule</span><small>' + (state.reactionSettings && state.reactionSettings.hardMode ? 'Hard (-1 Penalty)' : 'Standard (Opponent +1)') + '</small></div>' +
                '<div class="segment-group">' +
                '<button class="segment-btn teal ' + (!state.reactionSettings || !state.reactionSettings.hardMode ? 'active' : '') + '" data-action="setReactionHardMode" data-val="false">Standard (+1)</button>' +
                '<button class="segment-btn teal ' + (state.reactionSettings && state.reactionSettings.hardMode ? 'active' : '') + '" data-action="setReactionHardMode" data-val="true">Hard Mode (-1)</button>' +
                '</div></div>' +
                (isHost
                  ? '<button class="btn reaction-lobby-btn" data-action="startReactionMatch">Duel Shuru Karein ⚡🔥</button>'
                  : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host duel shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
                )
              : (mode === 'rps'
                ? '<div class="settings-section">' +
                  '<div class="settings-label"><span>⚔️ Match Format</span><small>First to ' + ((state.rpsSettings && state.rpsSettings.targetWins) || 3) + ' Wins</small></div>' +
                  '<div class="segment-group">' +
                  '<button class="segment-btn gold ' + (!state.rpsSettings || state.rpsSettings.targetWins === 3 ? 'active' : '') + '" data-action="setRPSTargetWins" data-val="3">Best of 5 (First to 3 ⚔️)</button>' +
                  '<button class="segment-btn gold ' + (state.rpsSettings && state.rpsSettings.targetWins === 5 ? 'active' : '') + '" data-action="setRPSTargetWins" data-val="5">Best of 9 (First to 5 👑)</button>' +
                  '</div>' +
                  '<p style="font-size:12px;color:var(--soft);margin-bottom:8px;font-weight:700">Simultaneous Reveal • Bluff Fake-outs • Power Throw &amp; Double Down</p>' +
                  '</div>' +
                  (isHost
                    ? '<button class="btn rps-lobby-btn" data-action="startRPSMatch">Battle Shuru Karein 🪨📄✂️</button>'
                    : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host battle shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
                  )
                : '<div class="settings-section" style="text-align:center">' +
                  '<div style="font-size:40px;margin-bottom:6px">⭕</div>' +
                  '<div style="font-family:var(--font-display);font-size:20px;color:var(--plum);margin-bottom:4px">X aur O — Tic-Tac-Toe</div>' +
                  '<p style="font-size:13px;color:var(--soft);margin-bottom:10px">Host → X (pehli chaal). Guest → O. Har round mein pehli chaal alternate hogi.</p>' +
                  '</div>' +
                  (isHost
                    ? '<button class="btn ttt-lobby-btn" data-action="startTTT">X &amp; O Shuru Karein ⭕✕</button>'
                    : '<div class="card" style="text-align:center;padding:10px;background:#FFF9EB;border-color:var(--genda)"><b>Host game shuru karenge ⏳</b><div style="font-size:12px;color:var(--soft)">Aapke partner start karenge...</div></div>'
                  )
              )
            )
          )
        )
      ) +
      '<div style="margin-top:8px">' +
      '<button class="btn ghost sm" data-action="leaveRoom">Room Se Niklo</button>' +
      '</div></div></section>';
  }

  global.JodiLobby = {
    init: init,
    renderHeader: renderHeader,
    vWelcome: vWelcome,
    vLobby: vLobby,
    vRoomReady: vRoomReady
  };
})(window);
