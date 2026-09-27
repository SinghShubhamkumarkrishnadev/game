/* Jodi Sync — Modals, Drawers & PWA Install Engine */
(function (global) {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var esc = function (s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  function renderModal(app) {
    var state = app.state;
    var profile = app.profile;
    var Audio = global.JodiAudio;

    var m = $('#modal');
    if (!m) return;

    if (!state.modal) {
      m.className = '';
      m.innerHTML = '';
      return;
    }

    if (state.modal === 'confirm_exit_race') {
      m.innerHTML = '<div class="modal-sheet" style="text-align:center">' +
        '<div style="font-size:38px;margin-bottom:6px">🏍️💨</div>' +
        '<h2 style="font-family:var(--font-display);font-size:22px;color:var(--plum);margin-bottom:6px">Race Chhodein?</h2>' +
        '<p style="color:var(--soft);font-size:13.5px;margin-bottom:14px;line-height:1.4">Kya aap 3D race chhodkar bahar jaana chahte hain?</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button type="button" class="btn bad" data-action="confirmExitRace">Haan, Race Chhodo 🚪</button>' +
        '<button type="button" class="btn ghost" data-action="closeModal">Nahi, Race Karte Raho 🏍️</button>' +
        '</div></div>';
      m.className = 'on';
      return;
    } else if (state.modal === 'confirm_exit_scribble') {
      m.innerHTML = '<div class="modal-sheet" style="text-align:center">' +
        '<div style="font-size:38px;margin-bottom:6px">🚪</div>' +
        '<h2 style="font-family:var(--font-display);font-size:22px;color:var(--plum);margin-bottom:6px">Game Chhodein?</h2>' +
        '<p style="color:var(--soft);font-size:13.5px;margin-bottom:14px;line-height:1.4">Kya aap match chhodkar bahar jaana chahte hain? Partner ko bhi pata chal jayega ki aap chale gaye.</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button type="button" class="btn bad" data-action="confirmExitScribble">Haan, Game Chhodo 🚪</button>' +
        '<button type="button" class="btn ghost" data-action="closeModal">Nahi, Khelte Raho 🎮</button>' +
        '</div></div>';
      m.className = 'on';
      return;
    } else if (state.modal === 'partner_left_scribble') {
      var pName = esc(state.partnerLeftName || 'Partner');
      m.innerHTML = '<div class="modal-sheet" style="text-align:center">' +
        '<div style="font-size:42px;margin-bottom:6px">⚠️</div>' +
        '<h2 style="font-family:var(--font-display);font-size:22px;color:var(--plum);margin-bottom:6px">Partner Offline Ho Gaye!</h2>' +
        '<p style="color:var(--soft);font-size:14px;margin-bottom:6px">Aapke partner <b>' + pName + '</b> abhi online ya active nahi hain.</p>' +
        '<div style="background:var(--surface2);border:1.5px dashed var(--line);border-radius:var(--radius-sm);padding:8px 10px;font-size:12.5px;color:var(--soft);margin-bottom:14px;line-height:1.4">' +
        'Shayad unka network toot gaya ya unhone game exit kar diya. Intezar karne ki zaroorat nahi hai!' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button type="button" class="btn primary" data-action="continueSoloAfterPartnerLeft">🎨 Solo Practice Khelte Raho</button>' +
        '<button type="button" class="btn alt" data-action="exitToLobbyAfterPartnerLeft">🏠 Main Lobby Me Jao</button>' +
        '<button type="button" class="btn ghost sm" data-action="createNewRoomAfterPartnerLeft">🔁 Naya Room Banao</button>' +
        '</div></div>';
      m.className = 'on';
      return;
    }

    if (state.modal === 'join') {
      m.innerHTML = '<div class="modal-sheet">' +
        '<h2 style="font-family:var(--font-display);font-size:22px;color:var(--plum);margin-bottom:4px">Room Code Daalo</h2>' +
        '<p style="color:var(--soft);font-size:13.5px;margin-bottom:12px">Partner ne jo 4-digit code bheja hai wo yahan likho:</p>' +
        '<input class="input-field" id="joinInput" maxlength="10" placeholder="e.g. JODI-4821" value="' + esc(state.joinCodeInput) + '" style="font-size:20px;text-align:center;letter-spacing:0.08em;font-weight:800;text-transform:uppercase" autofocus>' +
        '<div style="display:flex;gap:10px;margin-top:12px">' +
        '<button type="button" class="btn ghost" style="flex:1" data-action="closeModal">Cancel</button>' +
        '<button type="button" class="btn primary" style="flex:1" data-action="submitJoin">Connect 🚀</button>' +
        '</div></div>';
      m.className = 'on';
    } else if (state.modal === 'guide') {
      var tab = state.guideTab || 'twominds';
      var contentHtml = '';
      if (tab === 'twominds') {
        contentHtml = '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Do Dil, Alag Jankari (USP)</div>' +
          '<div class="guide-step-desc">Player A ko category aur pehli aadhi clues milti hain. Player B ko word length aur doosri aadhi clues milti hain! Akele koi solve nahi kar sakta.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">Chat &amp; 1-Tap Quick Messages</div>' +
          '<div class="guide-step-desc">"I have this letter", "Try my letter", ya in-game chat se apne clues ek doosre ko batayein aur word milkar guess karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">Shared Board Par Letters Rakhein</div>' +
          '<div class="guide-step-desc">Apne rack ke letters par tap karke shared slots me rakhein. Player A ke letters pink aur Player B ke teal me aate hain!</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">4</span>' +
          '<div><div class="guide-step-title">Ask Partner &amp; Hints</div>' +
          '<div class="guide-step-desc">Agar phans jao to 3 <b>"Ask Partner"</b> tokens se partner se letter maangein ya <b>"Hint"</b> se pehla akshar unlock karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card" style="border-color:var(--genda);background:#FFF9EB">' +
          '<span class="guide-num" style="background:var(--genda);color:#000">🔥</span>' +
          '<div><div class="guide-step-title" style="color:#000">Team Score &amp; SYNC Combos</div>' +
          '<div class="guide-step-desc" style="color:#2A1240">Lagaatar sahi solve karne par <b class="guide-highlight">🔥 2X, 3X TEAM SYNC</b> multiplier milta hai! Koi single winner nahi — Jodi hi ek team hai!</div></div>' +
          '</div>';
      } else if (tab === 'scribble') {
        contentHtml = '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Room Banao ya Join Karo</div>' +
          '<div class="guide-step-desc">Ek partner <b>Room Banao</b> dabayega aur code share karega. Doosra <b>Room Join Karo</b> me code daal kar connect hoga.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">Bari-Bari Draw &amp; Guess</div>' +
          '<div class="guide-step-desc">Turn 1 me pehla partner draw karega aur doosra guess karega. Agle turn me automatically roles swap ho jayengi!</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">Guesser Ko Clue Hint &amp; Category</div>' +
          '<div class="guide-step-desc">Guess karne wale ko Category, Difficulty aur ek mazedaar <span class="guide-highlight">Hint Clue</span> milta hai! Drawer ko sirf word banana hota hai.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">4</span>' +
          '<div><div class="guide-step-title">Scoring System</div>' +
          '<div class="guide-step-desc">Sahi guess karne par Guesser ko <b class="guide-highlight">+25 Points</b> aur Drawer ko <b style="color:var(--mor)">+15 Points</b> milte hain!</div></div>' +
          '</div>';
      } else if (tab === 'race') {
        contentHtml = '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Apni 3D Superbike Chuno</div>' +
          '<div class="guide-step-desc">Royal Bullet, Neon Sport, Teal Turbo, ya Cafe Racer — dono partner lobby me apni-apni manpasand 3D bike select karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">Steering, Gas &amp; Nitro Boost</div>' +
          '<div class="guide-step-desc">Left/Right steer buttons, Gas dabakar speed pakdein aur <b>⚡ Nitro</b> se super thrust lein!</div></div>' +
          '</div>' +
          '<div class="guide-step-card" style="border-color:var(--genda);background:#FFF9EB">' +
          '<span class="guide-num" style="background:var(--genda);color:#000">💥</span>' +
          '<div><div class="guide-step-title" style="color:#000">Thokne Ka Feature (Takedown +50 PTS)</div>' +
          '<div class="guide-step-desc" style="color:#2A1240">Agar aap speed me partner ki bike ko thokte hain, to aapko <b class="guide-highlight">+50 PTS</b> aur instant Nitro milta hai! Partner crash ho kar 1.8s me auto-respawn hoga.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">3 Laps &amp; Podium Finish</div>' +
          '<div class="guide-step-desc">3 Laps complete karke sabse pehle finish arch cross karne wale ko <b class="guide-highlight">+100 PTS Finish Bonus</b> aur 🥇 Trophy milti hai!</div></div>' +
          '</div>';
      } else if (tab === 'install') {
        contentHtml = '<div class="guide-badge-box">📲 <span>Ye game ek <b>Progressive Web App (PWA)</b> hai — bina App Store ke direct install hota hai!</span></div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">1</span>' +
          '<div><div class="guide-step-title">Android / Chrome Me Install</div>' +
          '<div class="guide-step-desc">Screen ke upar <b>"Install 🚀"</b> banner par click karein. Direct phone ki home screen par app icon ban jayega.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">2</span>' +
          '<div><div class="guide-step-title">iPhone / Safari Me Install</div>' +
          '<div class="guide-step-desc">Safari ke bottom bar par <b>Share button (⎋)</b> dabayein, scroll karke <b>"Add to Home Screen (➕)"</b> par click karein.</div></div>' +
          '</div>' +
          '<div class="guide-step-card">' +
          '<span class="guide-num">3</span>' +
          '<div><div class="guide-step-title">Automatic Updates</div>' +
          '<div class="guide-step-desc">Jab bhi game update hota hai, app background me automatically update ho jati hai aur refresh ho jati hai.</div></div>' +
          '</div>';
      }

      m.innerHTML = '<div class="modal-sheet guide-sheet">' +
        '<div class="guide-header">' +
        '<div class="guide-title"><span>📖</span> Khelne Ka Tareeka</div>' +
        '<button type="button" class="pwa-dismiss-btn" data-action="closeGuide" style="color:var(--plum);font-size:20px">✕</button>' +
        '</div>' +
        '<div class="guide-tabs">' +
        '<button type="button" class="guide-tab-btn ' + (tab === 'twominds' ? 'active' : '') + '" data-action="setGuideTab" data-tab="twominds">🧩 Two Minds</button>' +
        '<button type="button" class="guide-tab-btn ' + (tab === 'scribble' ? 'active' : '') + '" data-action="setGuideTab" data-tab="scribble">🎨 Scribble</button>' +
        '<button type="button" class="guide-tab-btn ' + (tab === 'race' ? 'active' : '') + '" data-action="setGuideTab" data-tab="race">🏍️ 3D Race</button>' +
        '<button type="button" class="guide-tab-btn ' + (tab === 'install' ? 'active' : '') + '" data-action="setGuideTab" data-tab="install">📲 Install</button>' +
        '</div>' +
        '<div class="guide-content-scroll">' + contentHtml + '</div>' +
        '<div style="margin-top:14px">' +
        '<button type="button" class="btn primary" data-action="closeGuide">Samajh Gaya, Chalo Khele! 🚀</button>' +
        '</div>' +
        '</div>';
      m.className = 'on';
    } else if (state.modal === 'install_help') {
      var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      m.innerHTML = '<div class="modal-sheet install-modal-sheet">' +
        '<div class="guide-header">' +
        '<div class="guide-title"><span>📲</span> Jodi Sync Install Karein</div>' +
        '<button type="button" class="pwa-dismiss-btn" data-action="closeModal" style="color:var(--plum);font-size:20px">✕</button>' +
        '</div>' +
        '<div class="install-prompt-body">' +
        (isIos
          ? '<div class="install-device-card">' +
            '<div class="inst-platform-badge" style="background:#0B7A7C">🍎 iPhone / Safari</div>' +
            '<div class="inst-lead">iPhone me direct install karne ke aasan steps:</div>' +
            '<div class="inst-step-list">' +
            '<div class="inst-step-item"><span class="inst-step-num">1</span><div>Safari screen ke bottom me <b>Share button (⎋)</b> par tap karein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">2</span><div>Options ko scroll karein aur <b>"Add to Home Screen (➕)"</b> chunein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">3</span><div>Upar right me <b>"Add"</b> dabayein — app home screen par aa jayegi!</div></div>' +
            '</div></div>'
          : '<div class="install-device-card">' +
            '<div class="inst-platform-badge">🤖 Android / Chrome Phone</div>' +
            '<div class="inst-lead">Chrome browser me direct install karne ke liye:</div>' +
            '<div class="inst-step-list">' +
            '<div class="inst-step-item"><span class="inst-step-num">1</span><div>Chrome browser ke upar right side me <b>3 Dots (⋮)</b> menu dabayein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">2</span><div>Menu me <b>"Install app"</b> ya <b>"Add to Home screen"</b> par tap karein.</div></div>' +
            '<div class="inst-step-item"><span class="inst-step-num">3</span><div>Popup me <b>"Install"</b> confirm karein — app seedhe download ho jayegi!</div></div>' +
            '</div></div>' +
            '<div class="guide-badge-box">' +
            '<span>💡 <b>Pehle se Install hai?</b> Agar aapne pehle install kar rakha hai, to aapke phone ki home screen par <b>"Jodi Sync"</b> icon pehle se maujood hai — wahan se kholein!</span>' +
            '</div>'
        ) +
        '<div style="display:flex;gap:8px;margin-top:14px">' +
        '<button type="button" class="btn gold" style="flex:1" data-action="retryNativeInstall">Dubara Try Karein 🚀</button>' +
        '<button type="button" class="btn ghost" style="flex:1" data-action="closeModal">Theek Hai 👍</button>' +
        '</div></div></div>';
      m.className = 'on';
    } else if (state.modal === 'settings' || state.modal === 'sidebar') {
      var isMuted = Audio.isMuted();
      var avs = ['💖', '🪔', '🦁', '👑', '🌸', '⚡', '🏍️', '🦋', '🌹', '🐯', '🍫', '🧸'];
      var avHtml = '';
      for (var a = 0; a < avs.length; a++) {
        var isCur = (profile.avatar === avs[a]);
        avHtml += '<button type="button" class="settings-av-btn ' + (isCur ? 'active' : '') + '" data-action="settingsPickAvatar" data-av="' + avs[a] + '">' + avs[a] + '</button>';
      }

      // Clean, focused Sidebar with only necessary sections: Profile, Sound, Guide, Invite & Install
      m.innerHTML = '<aside class="settings-drawer" role="dialog" aria-label="Jodi Settings">' +
        // Drawer Header
        '<div class="settings-drawer-header">' +
        '<div class="settings-drawer-title"><span>⚙️</span> Jodi Menu</div>' +
        '<button type="button" class="drawer-close-btn" data-action="closeModal" aria-label="Close Menu">✕</button>' +
        '</div>' +

        // Drawer Content Scroll
        '<div class="settings-drawer-scroll">' +

        // Section 1: Profile & Name Change
        '<div class="settings-card">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">👤</span>' +
        '<div><div class="sch-title">Aapka Profile</div><div class="sch-desc">Apna naam aur avatar badlein</div></div>' +
        '</div>' +
        '<div class="settings-profile-row">' +
        '<span class="settings-profile-badge">' + profile.avatar + '</span>' +
        '<input class="input-field" id="settingsNameInput" maxlength="20" placeholder="Apna naam daalein" value="' + esc(profile.name) + '">' +
        '</div>' +
        '<div class="settings-av-grid">' + avHtml + '</div>' +
        '<button type="button" class="btn primary sm" style="width:100%;margin-top:10px" data-action="saveSettingsProfile">💾 Naam Save Karein</button>' +
        '</div>' +

        // Section: Solo 3D Race Mode (AI Demo / Practice)
        '<div class="settings-card" style="background:#FFFBF3;border-color:var(--genda)">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">🏍️</span>' +
        '<div><div class="sch-title">Solo 3D Race Mode</div><div class="sch-desc">AI racer ke khilaaf test drive karein</div></div>' +
        '</div>' +
        '<button type="button" class="btn gold sm" style="width:100%" data-action="soloPracticeRace">Play Solo Race 🏁</button>' +
        '</div>' +

        // Section 2: Sound & Audio Toggle
        '<div class="settings-card">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">' + (isMuted ? '🔇' : '🔊') + '</span>' +
        '<div><div class="sch-title">Awaaz (Sound Effects)</div><div class="sch-desc">Game music aur audio effects</div></div>' +
        '</div>' +
        '<div class="settings-toggle-row">' +
        '<span>Sound: <b>' + (isMuted ? 'Muted 🔇' : 'On 🔊') + '</b></span>' +
        '<button type="button" class="btn ' + (isMuted ? 'gold' : 'alt') + ' sm" data-action="settingsToggleSound">' +
        (isMuted ? 'Unmute 🔊' : 'Mute 🔇') +
        '</button>' +
        '</div>' +
        '</div>' +

        // Section 3: User Guide & Rules
        '<div class="settings-card">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">📖</span>' +
        '<div><div class="sch-title">Khelne Ka Tareeka</div><div class="sch-desc">Rules &amp; tips sabhi games ke liye</div></div>' +
        '</div>' +
        '<button type="button" class="btn alt sm" style="width:100%" data-action="openGuideFromSettings">📖 User Guide Kholein</button>' +
        '</div>' +

        // Section 4: App Install (PWA)
        '<div class="settings-card" style="background:#FFF9FC;border-color:var(--rani)">' +
        '<div class="settings-card-header">' +
        '<span class="sch-icon">📲</span>' +
        '<div><div class="sch-title">Direct App Install</div><div class="sch-desc">Bina App Store phone par icon banayein</div></div>' +
        '</div>' +
        '<button type="button" class="btn gold sm" style="width:100%" data-action="installPwa">📲 Jodi Sync Install Karein</button>' +
        '</div>' +

        // Version Footer Tag
        '<div class="settings-version-tag">Jodi Sync • Handcrafted with 💖 for Couples</div>' +
        '</div>' +
        '</aside>';

      m.className = 'drawer-mode on';
    } else {
      m.className = '';
      m.innerHTML = '';
    }
  }

  function updatePwaBannerVisibility() {
    var banner = $('#pwaInstallBanner');
    if (!banner) return;
    try {
      if (localStorage.getItem('jodi_pwa_dismissed')) {
        banner.style.display = 'none';
        return;
      }
    } catch (e) {}

    var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    if (isStandalone) {
      banner.style.display = 'none';
    } else {
      banner.style.display = 'flex';
    }
  }

  global.JodiModals = {
    render: renderModal,
    updatePwaBannerVisibility: updatePwaBannerVisibility
  };
})(window);
