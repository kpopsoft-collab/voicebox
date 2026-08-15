/**
 * Audio trimming and waveform extraction utilities using Web Audio API.
 */

/**
 * Encode an AudioBuffer to a standard WAV File.
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  let sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit precision

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

/**
 * Trim an audio File between startTime and endTime (in seconds).
 * Returns a new WAV File.
 */
export async function trimAudioFile(
  file: File,
  startTime: number,
  endTime: number,
): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const startSec = Math.max(0, startTime);
  const endSec = Math.min(decodedBuffer.duration, endTime);
  const durationSec = Math.max(0.1, endSec - startSec);
  
  const startOffset = Math.floor(startSec * decodedBuffer.sampleRate);
  const endOffset = Math.floor(endSec * decodedBuffer.sampleRate);
  const frameCount = endOffset - startOffset;
  
  const trimmedBuffer = audioContext.createBuffer(
    decodedBuffer.numberOfChannels,
    frameCount,
    decodedBuffer.sampleRate,
  );
  
  for (let channel = 0; channel < decodedBuffer.numberOfChannels; channel++) {
    const srcData = decodedBuffer.getChannelData(channel);
    const destData = trimmedBuffer.getChannelData(channel);
    destData.set(srcData.subarray(startOffset, endOffset));
  }
  
  await audioContext.close();
  
  const blob = audioBufferToWavBlob(trimmedBuffer);
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const newFileName = `${baseName}_trimmed_${Math.round(durationSec)}s.wav`;
  
  return new File([blob], newFileName, { type: 'audio/wav' });
}

/**
 * Extract normalized waveform peaks from an audio File for canvas/SVG visualization.
 */
export async function getAudioWaveformData(
  file: File,
  samplesCount = 2000,
): Promise<{ peaks: number[]; duration: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  const rawData = decodedBuffer.getChannelData(0); // Use first channel
  const totalSamples = rawData.length;
  const count = Math.min(samplesCount, Math.max(120, totalSamples));
  const blockSize = Math.max(1, Math.floor(totalSamples / count));
  const peaks: number[] = [];
  
  for (let i = 0; i < count; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(rawData[j] || 0);
      if (val > max) max = val;
    }
    peaks.push(max);
  }
  
  // Normalize peaks between 0.05 and 1.0
  const maxPeak = Math.max(...peaks, 0.001);
  const normalizedPeaks = peaks.map((p) => Math.max(0.06, p / maxPeak));
  
  const duration = decodedBuffer.duration;
  await audioContext.close();
  
  return { peaks: normalizedPeaks, duration };
}
