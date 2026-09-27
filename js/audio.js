/* Jodi Sync Audio & Tactile Synthesizer (Web Audio API) */
(function (global) {
  'use strict';

  var ctx = null;
  var isMuted = false;

  function getAudioContext() {
    if (!ctx) {
      var AudioContext = global.AudioContext || global.webkitAudioContext;
      if (AudioContext) {
        ctx = new AudioContext();
      }
    }
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
    return ctx;
  }

  function buzz(pattern) {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) {}
  }

  var AudioEngine = {
    init: function (muted) {
      isMuted = !!muted;
    },

    setMuted: function (mute) {
      isMuted = !!mute;
    },

    isMuted: function () {
      return isMuted;
    },

    toggleMuted: function () {
      isMuted = !isMuted;
      return isMuted;
    },

    buzz: buzz,

    // Bubbly pop synthesizer for chat messages, reactions and hints
    playPop: function () {
      buzz(10);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var osc = ac.createOscillator();
      var gain = ac.createGain();
      var now = ac.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(920, now + 0.05);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    },

    // Subtle button tap blip
    playTap: function () {
      buzz(12);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var osc = ac.createOscillator();
      var gain = ac.createGain();
      var now = ac.currentTime;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now);
      osc.stop(now + 0.04);
    },

    // Pleasant selection chime
    playChime: function () {
      buzz([15, 20]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      [523.25, 659.25].forEach(function (freq, i) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        var t = now + i * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.start(t);
        osc.stop(t + 0.16);
      });
    },

    // Celebratory 3-note harmonic match fanfare
    playMatch: function () {
      buzz([30, 40, 30]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      var notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach(function (freq, i) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        var t = now + i * 0.08;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.start(t);
        osc.stop(t + 0.35);
      });
    },

    // Playful descending "oops/miss" tone
    playMiss: function () {
      buzz(25);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      var osc = ac.createOscillator();
      var gain = ac.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(370, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.22);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    },

    // Crisp woodblock tick for countdowns
    playTick: function (isUrgent) {
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      var osc = ac.createOscillator();
      var gain = ac.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(isUrgent ? 1200 : 800, now);

      gain.gain.setValueAtTime(isUrgent ? 0.2 : 0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    },

    // Unlock / upgrade fanfare
    playUnlock: function () {
      buzz([40, 50, 40, 60]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      var arpeggio = [440, 554.37, 659.25, 880, 1108.73];
      arpeggio.forEach(function (freq, i) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        var t = now + i * 0.07;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.connect(gain);
        gain.connect(ac.destination);

        osc.start(t);
        osc.stop(t + 0.3);
      });
    },

    // Heavy metallic crash & impact for bike takedown
    playCrash: function () {
      buzz([100, 50, 150]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      var bufSize = Math.floor(ac.sampleRate * 0.35);
      var buffer = ac.createBuffer(1, bufSize, ac.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      var noise = ac.createBufferSource();
      noise.buffer = buffer;

      var filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(100, now + 0.3);

      var gain = ac.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);

      noise.start(now);
      noise.stop(now + 0.35);
    },

    // Quick Reaction Duel — Punchy Target Hit
    playHit: function () {
      buzz(16);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      var osc = ac.createOscillator();
      var gain = ac.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.06);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    },

    // Quick Reaction Duel — Bomb Explosion Penalty
    playBomb: function () {
      buzz([50, 40, 60]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      // Sub-bass thud
      var osc = ac.createOscillator();
      var oscGain = ac.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);
      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(oscGain);
      oscGain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.28);

      // Noise blast
      var bufSize = Math.floor(ac.sampleRate * 0.22);
      var buffer = ac.createBuffer(1, bufSize, ac.sampleRate);
      var data = buffer.getChannelData(0);
      for (var i = 0; i < bufSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      var noise = ac.createBufferSource();
      noise.buffer = buffer;
      var filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.22);
      var noiseGain = ac.createGain();
      noiseGain.gain.setValueAtTime(0.28, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ac.destination);
      noise.start(now);
      noise.stop(now + 0.22);
    },

    // Quick Reaction Duel — False Start Harsh Buzzer
    playFalseStart: function () {
      buzz([40, 50, 60]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      // Dual dissonant square/saw oscillators
      [145, 205].forEach(function (freq) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.22);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      });
    },

    // Quick Reaction Duel — Fast Rising Multi-Tone Streak Sparkle
    playStreak: function () {
      buzz([18, 25, 20]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      [660, 880, 1175, 1568].forEach(function (freq, i) {
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        var t = now + i * 0.05;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.16, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(t);
        osc.stop(t + 0.12);
      });
    },

    // Quick Reaction Duel — Frenzy Mode Warning Riser
    playFrenzySting: function () {
      buzz([30, 40, 50]);
      if (isMuted) return;
      var ac = getAudioContext();
      if (!ac) return;

      var now = ac.currentTime;
      var osc = ac.createOscillator();
      var gain = ac.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.25);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    }
  };

  // Unlock AudioContext on first touch / click
  var unlockAudio = function () {
    getAudioContext();
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
  };
  document.addEventListener('click', unlockAudio);
  document.addEventListener('touchstart', unlockAudio);

  global.JodiAudio = AudioEngine;
})(window);
