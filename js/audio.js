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
