/* Jodi Sync — Solo Arcade Module
 * Single Responsibility: Renders the solo practice / preview screen.
 * Depends on: appContext (JodiContext) injected via init().
 * Exposes: JodiSoloArcade.init, JodiSoloArcade.vArcade
 */
(function (global) {
  'use strict';

  var ctx = null;

  /** Bootstrap with shared app context */
  function init(appContext) {
    ctx = appContext;
  }

  function getCtx() {
    return ctx || global.JodiContext || {};
  }

  /**
   * Game card definition — data object, not markup.
   * Keeps the view function thin and the data easy to extend.
   */
  var GAME_CARDS = [
    {
      id: 'reaction',
      icon: '⚡',
      title: 'Quick Reaction Duel',
      tagline: 'Pure speed aur reflex — kaun faster hai?',
      desc: 'Screen par achanak target aayega — jo sabse pehle tap karega point uska! False start se bacho, bombs se door raho aur AI Reflex bot ko harao.',
      action: 'soloPlayReaction',
      btnClass: 'gold',
      btnLabel: 'Reflex Duel Solo Khelo ⚡',
      badgeText: 'Reflex AI',
      badgeStyle: 'background:#FFF8E6;color:#B37D00;border-color:var(--genda)'
    },
    {
      id: 'ttt',
      icon: '⭕',
      title: 'X aur O — Tic-Tac-Toe',
      tagline: 'Classic wooden board — drag karke jeeto',
      desc: 'Asli wooden board par X ya O drag karo aur jeeto. Minimax AI se khelo aur apni strategy test karo partner ke saath khelne se pehle.',
      action: 'soloPlayTTT',
      btnClass: 'ttt-arcade-btn',
      btnLabel: 'X & O Solo Khelo',
      badgeText: 'AI ke saath',
      badgeStyle: 'background:#F5EEFF;color:var(--plum);border-color:var(--plum)'
    },
    {
      id: 'twominds',
      icon: '🧩',
      title: 'Two Minds, One Word',
      tagline: 'Hint ke saath word solve karo akele',
      desc: 'Dono taraf ke clues tum sambhalo — AI Partner tumhare saath board par tiles lagayega. Real gameplay ka pura feel, real partner ke bina.',
      action: 'soloPlayTwoMinds',
      btnClass: 'primary',
      btnLabel: 'Two Minds Solo Khelo',
      badgeText: 'AI Partner',
      badgeStyle: 'background:#FFF9FC;color:var(--rani);border-color:var(--rani)'
    },
    {
      id: 'scribble',
      icon: '🎨',
      title: 'Jodi Scribble',
      tagline: 'Draw karo ya guess karo — tum decide karo',
      desc: 'Drawer ya Guesser — dono roles akele try karo. Word reveal hoga, drawing bano ya guess karo bina kisi ke wait kiye.',
      action: 'soloPlayScribble',
      btnClass: 'teal',
      btnLabel: 'Scribble Solo Khelo',
      badgeText: 'Practice Mode',
      badgeStyle: 'background:#F0FAFA;color:var(--mor);border-color:var(--mor)'
    },
    {
      id: 'race',
      icon: '🏍\uFE0F',
      title: '3D Bike Race',
      tagline: 'AI racer ke khilaaf test drive',
      desc: 'Tilt steer, nitro aur takedown — sab try karo ek AI opponent ke saath. Real race mechanics, zero pressure.',
      action: 'soloPlayRace',
      btnClass: 'gold',
      btnLabel: 'Race Solo Khelo',
      badgeText: 'AI Racer',
      badgeStyle: 'background:#FFFBF0;color:#8A5B00;border-color:var(--genda)'
    }
  ];

  /** Render a single game card as HTML string */
  function renderGameCard(card) {
    return '<div class="arcade-game-card" id="soloCard-' + card.id + '">' +
      '<div class="arcade-card-header">' +
        '<span class="arcade-card-icon">' + card.icon + '</span>' +
        '<div class="arcade-card-meta">' +
          '<div class="arcade-card-title">' + card.title + '</div>' +
          '<div class="arcade-card-tagline">' + card.tagline + '</div>' +
        '</div>' +
        '<span class="arcade-badge" style="' + card.badgeStyle + '">' + card.badgeText + '</span>' +
      '</div>' +
      '<p class="arcade-card-desc">' + card.desc + '</p>' +
      '<button class="btn ' + card.btnClass + ' arcade-play-btn" data-action="' + card.action + '">' +
        card.btnLabel +
      '</button>' +
    '</div>';
  }

  /** Render the full Solo Arcade screen */
  function vArcade() {
    var c = getCtx();
    var profile = c.profile || { avatar: '💖' };
    var Lobby = global.JodiLobby;
    var headerHtml = Lobby ? Lobby.renderHeader() : '';

    var cardsHtml = GAME_CARDS.map(renderGameCard).join('');

    return '<section class="screen">' +
      headerHtml +

      '<div class="arcade-back-row">' +
        '<button class="btn ghost sm arcade-back-btn" data-action="closeArcade">← Wapas Lobby</button>' +
      '</div>' +

      '<div class="arcade-hero">' +
        '<div class="arcade-hero-badge">' + profile.avatar + '</div>' +
        '<h1 class="arcade-hero-title">Solo Play &amp; Check</h1>' +
        '<p class="arcade-hero-sub">Partner aaye bina bhi khelo — tino games akele try karo aur feel lo kaunsa tumhe pasand hai.</p>' +
      '</div>' +

      '<div class="arcade-cards-list">' +
        cardsHtml +
      '</div>' +

      '<div class="arcade-footer-nudge">' +
        '<span>Sab theek lag raha hai? Phir partner ko invite karo 💞</span>' +
        '<button class="btn ghost sm" data-action="closeArcade" style="margin-top:10px">Partner ke saath khelein 🚀</button>' +
      '</div>' +

    '</section>';
  }

  global.JodiSoloArcade = {
    init: init,
    vArcade: vArcade
  };

})(window);
