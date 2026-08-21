/**
 * Convert a browser recording into 16 kHz mono WAV.
 *
 * WHY THIS EXISTS
 * ---------------
 * `MediaRecorder` gives you whatever the browser feels like: Chrome and Edge
 * produce `audio/webm;codecs=opus`, Safari produces `audio/mp4`. Google's
 * documented list of audio formats the Gemini API accepts is WAV, MP3, AIFF,
 * AAC, OGG Vorbis and FLAC — webm is not on it.
 *
 * Rather than send a container that may or may not be accepted and discover the
 * problem in front of a user, we decode the recording and re-encode it as WAV,
 * which is unambiguously supported. No dependency: the Web Audio API decodes
 * whatever the browser could record, and a WAV header is 44 bytes of
 * bookkeeping.
 *
 * 16 kHz mono is chosen because Gemini downsamples audio to 16 Kbps and mixes
 * multi-channel input to one channel anyway. Sending anything richer wastes
 * upload for no gain, and speech at 16 kHz is the telephony standard for good
 * reason. A 20-second complaint lands around 640 KB, comfortably inside the
 * inline request limit.
 */

/** What Gemini downsamples to regardless, so there is nothing to gain above it. */
const TARGET_SAMPLE_RATE = 16_000;

export interface WavConversion {
  blob: Blob;
  durationSeconds: number;
  sampleRate: number;
}

/**
 * Decode `input` and re-encode it as 16 kHz mono WAV.
 *
 * Throws if the browser cannot decode the recording, which the caller should
 * treat as "transcription unavailable, type it instead" rather than a hard error.
 */
export async function toMonoWav16k(input: Blob): Promise<WavConversion> {
  const arrayBuffer = await input.arrayBuffer();

  // A plain AudioContext decodes to the device rate; OfflineAudioContext lets us
  // resample during rendering, so no manual interpolation is needed.
  const AudioCtx: typeof AudioContext =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) throw new Error('Web Audio API is unavailable in this browser.');

  const decodeCtx = new AudioCtx();
  let decoded: AudioBuffer;
  try {
    // Safari historically needs the callback form; the promise form is standard
    // and supported everywhere we care about.
    decoded = await decodeCtx.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    // Release the hardware context promptly; we only needed it to decode.
    void decodeCtx.close();
  }

  const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();

  const samples = rendered.getChannelData(0);
  return {
    blob: encodeWav(samples, TARGET_SAMPLE_RATE),
    durationSeconds: rendered.duration,
    sampleRate: TARGET_SAMPLE_RATE,
  };
}

/**
 * Wrap float samples in a 16-bit PCM WAV container.
 *
 * Canonical 44-byte RIFF header followed by little-endian signed 16-bit samples.
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // size of everything after this field
  writeAscii(8, 'WAVE');

  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk length
  view.setUint16(20, 1, true); // 1 = uncompressed PCM
  view.setUint16(22, 1, true); // channels
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true); // bits per sample

  writeAscii(36, 'data');
  view.setUint32(40, dataSize, true);

  // Float [-1, 1] to signed 16-bit. Clamp first: decoded audio can exceed the
  // nominal range slightly, and wrapping would turn a loud peak into a click.
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/** Base64-encode a blob without the `data:` URI prefix. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  // Chunked to avoid blowing the argument limit on String.fromCharCode for
  // larger recordings.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
