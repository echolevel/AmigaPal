class WaveformUpdater extends AudioWorkletProcessor {

  constructor() {
    super();
    this._updatedWave;
    this.port.onmessage = this.handleMessage_.bind(this);
  }

  handleMessage_(event) {
    console.log('Waveform update request received: ' + event.data.message);
  }

  process (inputs, outputs, parameters) {
    const output = outputs[0]
    output.forEach(channel => {
      for(let i = 0; i < channel.length; i++) {
        channel[i] = Math.random() * 2 - 1
      }
    })
    return true
  }
}

registerProcessor('waveform-updater', WaveformUpdater)
