/* Jodi Sync — Quick Reaction Duel Core Engine & Timing Model
 * SOLID Architecture:
 * - Single Responsibility: Pure game rules, random delay generator, target lifecycle, scoring, and reflex AI.
 * - Open/Closed: Target types and phase thresholds are configurable data structures.
 * - Liskov Substitution: Both Human and AI trigger identical tap/miss/false-start actions.
 * - Dependency Inversion: Pure JavaScript domain model with zero DOM references.
 * Exposes: window.JodiReactionEngine
 */
(function (global) {
  'use strict';

  var TARGET_CONFIG = {
    normal: {
      type: 'normal',
      name: 'Normal',
      glyph: '🎯',
      points: 1,
      size: 72,
      lifespan: { normal: 1250, fast: 1000, frenzy: 850 },
      color: '#FFB000',
      description: 'Standard target — tap first!'
    },
    lightning: {
      type: 'lightning',
      name: 'Lightning',
      glyph: '⚡',
      points: 2,
      size: 68,
      lifespan: { normal: 750, fast: 600, frenzy: 480 },
      color: '#FFE600',
      description: 'Flash fast — bonus points!'
    },
    bomb: {
      type: 'bomb',
      name: 'Bomb',
      glyph: '💣',
      points: -1,
      size: 72,
      lifespan: { normal: 1150, fast: 950, frenzy: 800 },
      color: '#FF3B30',
      description: 'Trap! Do not touch!'
    },
    moving: {
      type: 'moving',
      name: 'Drifter',
      glyph: '🌀',
      points: 1, // +2 in frenzy
      size: 70,
      lifespan: { normal: 1400, fast: 1150, frenzy: 950 },
      color: '#0B7A7C',
      description: 'Drifting across screen!'
    },
    tiny: {
      type: 'tiny',
      name: 'Precision',
      glyph: '🎯',
      points: 2,
      size: 44,
      lifespan: { normal: 1200, fast: 1000, frenzy: 850 },
      color: '#D6246E',
      description: 'Tiny target — sharp aim needed!'
    }
  };

  /**
   * Weights per phase for target selection
   */
  var PHASE_WEIGHTS = {
    normal: [
      { type: 'normal', weight: 80 },
      { type: 'moving', weight: 10 },
      { type: 'tiny', weight: 10 }
    ],
    fast: [
      { type: 'normal', weight: 45 },
      { type: 'lightning', weight: 25 },
      { type: 'moving', weight: 15 },
      { type: 'tiny', weight: 10 },
      { type: 'bomb', weight: 5 }
    ],
    frenzy: [
      { type: 'lightning', weight: 30 },
      { type: 'bomb', weight: 25 },
      { type: 'moving', weight: 20 },
      { type: 'tiny', weight: 15 },
      { type: 'normal', weight: 10 }
    ]
  };

  function randomRange(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickWeightedTarget(phase) {
    var pool = PHASE_WEIGHTS[phase] || PHASE_WEIGHTS.normal;
    var totalWeight = pool.reduce(function (sum, item) { return sum + item.weight; }, 0);
    var rand = Math.random() * totalWeight;
    var running = 0;
    for (var i = 0; i < pool.length; i++) {
      running += pool[i].weight;
      if (rand <= running) {
        return pool[i].type;
      }
    }
    return 'normal';
  }

  /**
   * Creates a fresh game instance
   */
  function createGame(options) {
    var opts = options || {};
    var duration = Math.max(10, Math.min(60, opts.duration || 15)); // default 15s

    return {
      id: 'reaction_' + Date.now(),
      duration: duration,
      remainingMs: duration * 1000,
      hardMode: !!opts.hardMode,
      isSolo: !!opts.isSolo,
      
      // Players
      p1: {
        id: 'p1',
        name: opts.p1Name || 'Player 1',
        avatar: opts.p1Avatar || '💖',
        color: '#D6246E',
        score: 0,
        streak: 0,
        maxStreak: 0,
        hits: 0,
        bombsHit: 0,
        falseStarts: 0,
        fastestMs: null,
        reactionTimes: []
      },
      p2: {
        id: 'p2',
        name: opts.p2Name || (opts.isSolo ? 'AI Reflex 🤖' : 'Partner'),
        avatar: opts.p2Avatar || (opts.isSolo ? '⚡' : '✨'),
        color: '#0B7A7C',
        score: 0,
        streak: 0,
        maxStreak: 0,
        hits: 0,
        bombsHit: 0,
        falseStarts: 0,
        fastestMs: null,
        reactionTimes: []
      },

      // Flow state: 'COUNTDOWN' | 'WAITING' | 'TARGET_ACTIVE' | 'RESOLVED' | 'FINISHED'
      state: 'COUNTDOWN',
      countdownSec: 3,
      currentPhase: 'normal', // 'normal' | 'fast' | 'frenzy'
      roundNumber: 0,
      
      // Active target & callout
      currentTarget: null,
      callout: null, // { type, text, player, pts }
      
      // Timestamps
      matchStartedAt: null,
      targetSpawnedAt: null,
      
      // Winners / summary on finish
      winner: null,
      isDraw: false
    };
  }

  /**
   * Spawns a random target within safe arena percentage bounds (15% to 85%)
   */
  function generateTarget(phase, targetIdOverride) {
    var type = pickWeightedTarget(phase);
    var cfg = TARGET_CONFIG[type];
    var id = targetIdOverride || ('tgt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5));

    // Clamp coordinates safely within center arena
    var x = randomRange(16, 84);
    var y = randomRange(18, 80);

    // Drifting trajectory for moving targets
    var angle = Math.random() * Math.PI * 2;
    var speed = phase === 'frenzy' ? 24 : 16;
    var vx = Math.cos(angle) * speed;
    var vy = Math.sin(angle) * speed;

    var points = cfg.points;
    if (type === 'moving' && phase === 'frenzy') {
      points = 2; // Bonus in Frenzy!
    }

    var lifespan = cfg.lifespan[phase] || cfg.lifespan.normal;

    return {
      id: id,
      type: type,
      name: cfg.name,
      glyph: cfg.glyph,
      points: points,
      size: cfg.size,
      color: cfg.color,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      lifespan: lifespan,
      spawnedAt: Date.now()
    };
  }

  /**
   * Computes the current intensity band based on match progress
   */
  function calculatePhase(remainingMs, totalDurationSec) {
    var totalMs = totalDurationSec * 1000;
    var progress = 1 - (remainingMs / totalMs); // 0.0 to 1.0

    if (progress < 0.40) {
      return 'normal';
    } else if (progress < 0.70) {
      return 'fast';
    } else {
      return 'frenzy';
    }
  }

  /**
   * Random delay before next target spawn: 500ms - 1800ms
   */
  function getRandomSpawnDelay(phase) {
    if (phase === 'frenzy') {
      return randomRange(400, 1100);
    } else if (phase === 'fast') {
      return randomRange(500, 1400);
    }
    return randomRange(650, 1800);
  }

  /**
   * Handles false start by a player
   * Default: Opponent gets +1 point, false-starter gets 0
   * Hard mode: Opponent gets +1 point, false-starter gets -1 point
   */
  function processFalseStart(game, playerKey) {
    var falseStarter = game[playerKey];
    var opponentKey = playerKey === 'p1' ? 'p2' : 'p1';
    var opponent = game[opponentKey];

    if (!falseStarter || !opponent) return null;

    falseStarter.falseStarts += 1;
    falseStarter.streak = 0;

    var penalty = 0;
    if (game.hardMode) {
      falseStarter.score = Math.max(-99, falseStarter.score - 1);
      penalty = -1;
    }

    // Award point to opponent
    opponent.score += 1;

    game.callout = {
      type: 'FALSE_START',
      player: playerKey,
      opponent: opponentKey,
      penalty: penalty,
      text: '⚠️ ' + falseStarter.name + ' FALSE START! ' + opponent.name + ' +1'
    };

    return game.callout;
  }

  /**
   * Handles target tap
   */
  function processTargetTap(game, playerKey, targetId, tapTimestamp) {
    var player = game[playerKey];
    var target = game.currentTarget;
    if (!player || !target || target.id !== targetId) return null;

    var now = tapTimestamp || Date.now();
    var reactionMs = Math.max(10, now - target.spawnedAt);

    if (target.type === 'bomb') {
      // Bomb clicked: penalty!
      player.bombsHit += 1;
      player.streak = 0;
      player.score = Math.max(-99, player.score - 1);

      game.callout = {
        type: 'BOMB',
        player: playerKey,
        targetType: 'bomb',
        points: -1,
        reactionMs: reactionMs,
        text: '💣 ' + player.name + ' clicked Bomb! -1'
      };
      return game.callout;
    }

    // Positive target clicked
    player.hits += 1;
    player.streak += 1;
    if (player.streak > player.maxStreak) {
      player.maxStreak = player.streak;
    }

    // Reaction time metrics
    player.reactionTimes.push(reactionMs);
    if (player.fastestMs === null || reactionMs < player.fastestMs) {
      player.fastestMs = reactionMs;
    }

    // Points calculation (with modest bonus for high streak >= 5)
    var earnedPoints = target.points;
    var streakBonus = (player.streak === 5) ? 1 : 0;
    player.score += (earnedPoints + streakBonus);

    game.callout = {
      type: 'HIT',
      player: playerKey,
      targetType: target.type,
      points: earnedPoints + streakBonus,
      streak: player.streak,
      streakBonus: streakBonus,
      reactionMs: reactionMs,
      text: '⚡ ' + player.name + ' +' + (earnedPoints + streakBonus) + ' (' + reactionMs + 'ms)'
    };

    return game.callout;
  }

  /**
   * Finalizes the match and determines winner
   */
  function finalizeMatch(game) {
    game.state = 'FINISHED';
    game.currentTarget = null;
    game.remainingMs = 0;

    if (game.p1.score > game.p2.score) {
      game.winner = 'p1';
      game.isDraw = false;
    } else if (game.p2.score > game.p1.score) {
      game.winner = 'p2';
      game.isDraw = false;
    } else {
      game.winner = null;
      game.isDraw = true;
    }

    return game;
  }

  /**
   * Compute average reaction time
   */
  function getAverageReaction(times) {
    if (!times || times.length === 0) return 0;
    var sum = times.reduce(function (a, b) { return a + b; }, 0);
    return Math.round(sum / times.length);
  }

  /**
   * AI reaction simulation for solo play
   * Simulates realistic human reflex curve with phase adaptation
   */
  function getAiReactionDecision(phase, targetType) {
    if (targetType === 'bomb') {
      // 90% chance AI recognizes and avoids bomb
      var mistake = Math.random() < 0.10;
      if (mistake) {
        return {
          willTap: true,
          delayMs: randomRange(350, 600)
        };
      }
      return { willTap: false, delayMs: 0 };
    }

    // Reflex timing based on phase
    var minMs = 380;
    var maxMs = 540;
    if (phase === 'fast') {
      minMs = 300;
      maxMs = 430;
    } else if (phase === 'frenzy') {
      minMs = 240;
      maxMs = 360;
    }

    return {
      willTap: true,
      delayMs: randomRange(minMs, maxMs)
    };
  }

  /**
   * Public interface
   */
  global.JodiReactionEngine = {
    TARGET_CONFIG: TARGET_CONFIG,
    createGame: createGame,
    generateTarget: generateTarget,
    calculatePhase: calculatePhase,
    getRandomSpawnDelay: getRandomSpawnDelay,
    processFalseStart: processFalseStart,
    processTargetTap: processTargetTap,
    finalizeMatch: finalizeMatch,
    getAverageReaction: getAverageReaction,
    getAiReactionDecision: getAiReactionDecision
  };

})(window);
