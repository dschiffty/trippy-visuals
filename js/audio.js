export class AudioCapture {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.isCapturing = false;
    this.onStop = null;
    this.frequencyData = null;
    this.timeDomainData = null;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    // We only need audio — stop the video track
    this.stream.getVideoTracks().forEach((t) => t.stop());

    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length === 0) {
      this.stream.getTracks().forEach((t) => t.stop());
      throw new Error('No audio track. Check "Share audio" when selecting your screen.');
    }

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    this.source.connect(this.analyser);

    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeDomainData = new Uint8Array(this.analyser.fftSize);

    this.isCapturing = true;

    // Handle user ending the share
    audioTracks[0].addEventListener('ended', () => {
      this.stop();
      if (this.onStop) this.onStop();
    });
  }

  getFrequencyData() {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  getTimeDomainData() {
    if (!this.analyser) return null;
    this.analyser.getByteTimeDomainData(this.timeDomainData);
    return this.timeDomainData;
  }

  stop() {
    this.isCapturing = false;
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }
}
