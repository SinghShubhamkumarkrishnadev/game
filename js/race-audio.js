/* Jodi Race - Motorcycle Audio Synthesizer Engine */
(function (global) {
  'use strict';

  var engineAudio = {
    ctx: null,
    osc1: null,
    osc2: null,
    gain: null,

    init: function () {
      try {
        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.osc1 = this.ctx.createOscillator();
        this.osc2 = this.ctx.createOscillator();
        this.gain = this.ctx.createGain();

        this.osc1.type = 'sawtooth';
        this.osc2.type = 'triangle';

        this.osc1.frequency.setValueAtTime(45, this.ctx.currentTime);
        this.osc2.frequency.setValueAtTime(90, this.ctx.currentTime);

        this.gain.gain.setValueAtTime(0.001, this.ctx.currentTime);

        this.osc1.connect(this.gain);
        this.osc2.connect(this.gain);
        this.gain.connect(this.ctx.destination);

        this.osc1.start();
        this.osc2.start();
      } catch (e) {}
    },

    setRPM: function (speedRatio, isAccelerating) {
      if (!this.ctx || !this.gain) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(function () {});
      }
      var now = this.ctx.currentTime;
      var baseFreq = 40 + speedRatio * 180;
      this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.05);
      this.osc2.frequency.setTargetAtTime(baseFreq * 2, now, 0.05);

      var volume = isAccelerating ? (0.04 + speedRatio * 0.06) : (0.02 + speedRatio * 0.03);
      if (window.JodiAudio && window.JodiAudio.isMuted()) {
        volume = 0;
      }
      this.gain.gain.setTargetAtTime(volume, now, 0.05);
    },

    stop: function () {
      if (this.gain && this.ctx) {
        this.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      }
    }
  };

  global.JodiRaceAudio = engineAudio;
})(window);
