/* Jodi Sync — Rock Paper Scissors Battle Core Engine & Mind-Game Model
 * SOLID Architecture:
 * - Single Responsibility: Pure game rules, round resolution, combo tracking, special-moves state, and mind-game AI.
 * - Open/Closed: Specials, moves, and win matrices defined as extensible data tables.
 * - Dependency Inversion: Pure JavaScript model without DOM references.
 * Exposes: window.JodiRPSEngine
 */
(function (global) {
  'use strict';

  var MOVES = {
    rock: {
      id: 'rock',
      name: 'Rock',
      hindiName: 'Patthar',
      glyph: '🪨',
      beats: 'scissors',
      losesTo: 'paper',
      color: '#FFB000',
      actionVerb: 'SMASHES'
    },
    paper: {
      id: 'paper',
      name: 'Paper',
      hindiName: 'Kagaz',
      glyph: '📄',
      beats: 'rock',
      losesTo: 'scissors',
      color: '#38E1E4',
      actionVerb: 'COVERS'
    },
    scissors: {
      id: 'scissors',
      name: 'Scissors',
      hindiName: 'Kainchi',
      glyph: '✂️',
      beats: 'paper',
      losesTo: 'rock',
      color: '#FF5C9A',
      actionVerb: 'CUTS'
    }
  };

  var SPECIALS = {
    powerThrow: {
      id: 'powerThrow',
      name: 'Power Throw',
      glyph: '💥',
      desc: 'Giant impact attack animation on reveal (Super Clash)!',
      charges: 1
    },
    doubleDown: {
      id: 'doubleDown',
      name: 'Double Down',
      glyph: '⚡',
      desc: 'Win round = +2 points! High risk, high reward.',
      charges: 1
    },
    mystery: {
      id: 'mystery',
      name: 'Mystery Bluff',
      glyph: '🎭',
      desc: 'Hides choice behind dark smoke until final reveal!',
      charges: 1
    },
    rewind: {
      id: 'rewind',
      name: 'Rewind',
      glyph: '🔄',
      desc: 'Cinematic instant replay of the previous clash!',
      charges: 1
    }
  };

  function createGame(options) {
    var opts = options || {};
    var targetWins = Math.max(2, Math.min(5, opts.targetWins || 3)); // Default First to 3 Wins (Best of 5)

    return {
      id: 'rps_' + Date.now(),
      targetWins: targetWins,
      isSolo: !!opts.isSolo,
      
      // Players
      p1: {
        id: 'p1',
        name: opts.p1Name || 'Player 1',
        avatar: opts.p1Avatar || '💖',
        color: '#D6246E',
        score: 0,
        currentMove: null,
        activeSpecial: null,
        specials: {
          powerThrow: 1,
          doubleDown: 1,
          mystery: 1
        },
        streak: 0,
        maxStreak: 0,
        moveHistory: []
      },
      p2: {
        id: 'p2',
        name: opts.p2Name || (opts.isSolo ? 'AI Mind 🤖' : 'Partner'),
        avatar: opts.p2Avatar || (opts.isSolo ? '🧠' : '✨'),
        color: '#0B7A7C',
        score: 0,
        currentMove: null,
        activeSpecial: null,
        specials: {
          powerThrow: 1,
          doubleDown: 1,
          mystery: 1
        },
        streak: 0,
        maxStreak: 0,
        moveHistory: []
      },

      // Round flow: 'COUNTDOWN' | 'LOCKED' | 'FAKEOUT' | 'REVEAL' | 'RESULT' | 'FINISHED'
      state: 'COUNTDOWN',
      roundNumber: 1,
      countdownSec: 3,

      // Round resolution data
      lastRoundResult: null, // { winner: 'p1'|'p2'|'draw', p1Move, p2Move, text, isDoubleDown, isPowerThrow }
      roundsHistory: [],
      
      // Match finish
      winner: null,
      isDraw: false
    };
  }

  /**
   * Evaluates winner between two moves
   * Returns: 'p1' | 'p2' | 'draw'
   */
  function evaluateWinner(p1Move, p2Move) {
    if (!p1Move || !p2Move) return 'draw';
    if (p1Move === p2Move) return 'draw';

    var m1 = MOVES[p1Move];
    if (m1 && m1.beats === p2Move) {
      return 'p1';
    }
    return 'p2';
  }

  /**
   * Resolves the current round given moves and active specials
   */
  function resolveRound(game) {
    var p1 = game.p1;
    var p2 = game.p2;

    var move1 = p1.currentMove || pickRandomMove();
    var move2 = p2.currentMove || pickRandomMove();

    p1.currentMove = move1;
    p2.currentMove = move2;

    p1.moveHistory.push(move1);
    p2.moveHistory.push(move2);

    var winnerKey = evaluateWinner(move1, move2);
    var isP1Double = p1.activeSpecial === 'doubleDown';
    var isP2Double = p2.activeSpecial === 'doubleDown';
    var isPowerThrow = p1.activeSpecial === 'powerThrow' || p2.activeSpecial === 'powerThrow';

    var ptsAwarded = 1;
    var resultText = '';

    if (winnerKey === 'draw') {
      p1.streak = 0;
      p2.streak = 0;
      resultText = '🤝 Barabar! Dono ne ' + MOVES[move1].glyph + ' chuna!';
    } else if (winnerKey === 'p1') {
      ptsAwarded = isP1Double ? 2 : 1;
      p1.score += ptsAwarded;
      p1.streak += 1;
      p2.streak = 0;
      if (p1.streak > p1.maxStreak) p1.maxStreak = p1.streak;

      var v1 = MOVES[move1];
      var v2 = MOVES[move2];
      resultText = v1.glyph + ' ' + v1.actionVerb + ' ' + v2.glyph + '! ' + p1.name + ' wins' + (ptsAwarded > 1 ? ' (+2 PTS)!' : '!');
    } else {
      ptsAwarded = isP2Double ? 2 : 1;
      p2.score += ptsAwarded;
      p2.streak += 1;
      p1.streak = 0;
      if (p2.streak > p2.maxStreak) p2.maxStreak = p2.streak;

      var w1 = MOVES[move2];
      var w2 = MOVES[move1];
      resultText = w1.glyph + ' ' + w1.actionVerb + ' ' + w2.glyph + '! ' + p2.name + ' wins' + (ptsAwarded > 1 ? ' (+2 PTS)!' : '!');
    }

    var roundSummary = {
      roundNumber: game.roundNumber,
      winner: winnerKey,
      ptsAwarded: ptsAwarded,
      p1Move: move1,
      p2Move: move2,
      p1Special: p1.activeSpecial,
      p2Special: p2.activeSpecial,
      isPowerThrow: isPowerThrow,
      isDoubleDown: (winnerKey === 'p1' && isP1Double) || (winnerKey === 'p2' && isP2Double),
      text: resultText,
      p1Score: p1.score,
      p2Score: p2.score
    };

    game.lastRoundResult = roundSummary;
    game.roundsHistory.push(roundSummary);

    // Consume activated specials
    if (p1.activeSpecial) p1.activeSpecial = null;
    if (p2.activeSpecial) p2.activeSpecial = null;

    // Check match decider condition
    if (p1.score >= game.targetWins) {
      game.state = 'FINISHED';
      game.winner = 'p1';
    } else if (p2.score >= game.targetWins) {
      game.state = 'FINISHED';
      game.winner = 'p2';
    } else {
      game.state = 'RESULT';
    }

    return roundSummary;
  }

  function pickRandomMove() {
    var keys = ['rock', 'paper', 'scissors'];
    return keys[Math.floor(Math.random() * keys.length)];
  }

  /**
   * Advanced Psychological AI for Solo Mode:
   * - Recognizes player's habitual bias (e.g. favoring Rock, repeating wins, switching after loss).
   * - Plays counter or unexpected bluffs.
   */
  function decideAiMove(game) {
    var p1 = game.p1;
    var p2 = game.p2;
    var history = p1.moveHistory;

    // 1. First round: slight statistical human bias towards Rock
    if (!history || history.length === 0) {
      // 55% chance AI chooses Paper to counter initial Rock
      return Math.random() < 0.55 ? 'paper' : pickRandomMove();
    }

    var lastRound = game.lastRoundResult;
    var lastPlayerMove = history[history.length - 1];

    // 2. Win-Stay / Lose-Shift Psychology:
    // If player won last round, they are 60% likely to repeat winning move.
    // If player lost last round, they are 70% likely to switch to the move that beat them.
    if (lastRound) {
      if (lastRound.winner === 'p1') {
        // Player won: expect them to repeat move -> AI counters with move beating lastPlayerMove
        if (Math.random() < 0.65) {
          return MOVES[lastPlayerMove].losesTo;
        }
      } else if (lastRound.winner === 'p2') {
        // Player lost: they expect AI to repeat -> player shifts to counter AI's winning move.
        // AI anticipates this shift and counters player's counter!
        var aiWinningMove = lastRound.p2Move;
        var expectedPlayerCounter = MOVES[aiWinningMove].losesTo;
        if (Math.random() < 0.60) {
          return MOVES[expectedPlayerCounter].losesTo;
        }
      }
    }

    // 3. Fallback: 40% random unpredictability
    return pickRandomMove();
  }

  /**
   * AI Special ability decision
   */
  function decideAiSpecial(game) {
    var p2 = game.p2;
    if (!p2.specials) return null;

    // Trailing in match: Activate Double Down!
    if (game.p1.score > p2.score && p2.specials.doubleDown > 0 && Math.random() < 0.45) {
      p2.specials.doubleDown -= 1;
      p2.activeSpecial = 'doubleDown';
      return 'doubleDown';
    }

    // Power Throw activation on match point
    if (p2.score === game.targetWins - 1 && p2.specials.powerThrow > 0 && Math.random() < 0.50) {
      p2.specials.powerThrow -= 1;
      p2.activeSpecial = 'powerThrow';
      return 'powerThrow';
    }

    // Occasional mystery bluff
    if (p2.specials.mystery > 0 && Math.random() < 0.25) {
      p2.specials.mystery -= 1;
      p2.activeSpecial = 'mystery';
      return 'mystery';
    }

    return null;
  }

  global.JodiRPSEngine = {
    MOVES: MOVES,
    SPECIALS: SPECIALS,
    createGame: createGame,
    evaluateWinner: evaluateWinner,
    resolveRound: resolveRound,
    decideAiMove: decideAiMove,
    decideAiSpecial: decideAiSpecial,
    pickRandomMove: pickRandomMove
  };

})(window);
