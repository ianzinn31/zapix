import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { storage, AUDIO_CACHE_DIR } from './storage.js';

const execFileAsync = promisify(execFile);

class FishAudioService {
  constructor() {
    this.openRouterUrl = 'https://openrouter.ai/api/v1/audio/speech';
    this.directFishUrl = 'https://api.fish.audio/v1/tts';
  }

  // Format text to induce natural breathing pauses, paragraph breaks, and relaxed human tempo in TTS
  formatSpeechCadence(text) {
    if (!text || typeof text !== 'string') return '';
    let formatted = text
      // Remove emojis which can confuse TTS engines or sound robotic
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{2B05}\u{2B06}\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}]/gu, '')
      // Convert double line breaks / paragraph breaks into audible breathing pauses with ellipsis
      .replace(/\n\s*\n+/g, ' ... ... ')
      // Convert single line breaks to pause commas
      .replace(/\n+/g, ', ')
      // Ensure space and breathing pause after punctuation
      .replace(/([?!])\s+(?=[A-ZÀ-Úa-zà-ú0-9])/g, '$1 ... ')
      // Clean duplicate consecutive dots to 3
      .replace(/\.{4,}/g, '...')
      // Clean multiple spaces
      .replace(/\s{2,}/g, ' ')
      .trim();

    return formatted;
  }

  // Convert any audio (mp3, wav) to WhatsApp PTT Opus Ogg format using local ffmpeg
  async convertToWhatsAppOpus(inputPath, outputPath, customSpeed = null) {
    try {
      const config = storage.getSettings().fishAudio || {};
      const speed = customSpeed || config.speed || 0.92;
      const validSpeed = (typeof speed === 'number' && speed >= 0.7 && speed <= 1.5) ? speed : 0.92;

      const args = [
        '-y',
        '-i', inputPath,
        '-filter:a', `atempo=${validSpeed.toFixed(2)}`,
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-vbr', 'on',
        '-compression_level', '10',
        '-ar', '48000',
        '-ac', '1',
        outputPath
      ];

      await execFileAsync('ffmpeg', args);
      return outputPath;
    } catch (err) {
      console.error('Error converting audio with ffmpeg:', err);
      throw err;
    }
  }

  // Extract real audio waveform envelope (64 bytes, 0-100 values) for WhatsApp PTT visualization
  async extractWaveform(filePath, samplesCount = 64) {
    try {
      const { stdout } = await execFileAsync('ffmpeg', [
        '-i', filePath,
        '-ac', '1',
        '-ar', '8000',
        '-f', 's16le',
        '-'
      ], { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 });

      const totalSamples = Math.floor(stdout.length / 2);
      if (totalSamples === 0) {
        return this.generateNaturalWaveformFallback(samplesCount);
      }

      const blockSize = Math.floor(totalSamples / samplesCount);
      const waveform = new Uint8Array(samplesCount);

      let maxPeak = 0;
      const rawPeaks = new Float32Array(samplesCount);

      for (let i = 0; i < samplesCount; i++) {
        const start = i * blockSize * 2;
        const end = (i === samplesCount - 1) ? stdout.length : (i + 1) * blockSize * 2;
        let sum = 0;
        let count = 0;
        let peak = 0;

        for (let offset = start; offset < end; offset += 2) {
          if (offset + 1 < stdout.length) {
            const val = Math.abs(stdout.readInt16LE(offset));
            if (val > peak) peak = val;
            sum += val;
            count++;
          }
        }

        const avg = count > 0 ? (sum / count) : 0;
        const blended = (peak * 0.7) + (avg * 0.3);
        rawPeaks[i] = blended;
        if (blended > maxPeak) maxPeak = blended;
      }

      const scale = maxPeak > 0 ? (100 / maxPeak) : 1;
      for (let i = 0; i < samplesCount; i++) {
        const normalized = Math.round(rawPeaks[i] * scale);
        // Ensure values between 2 and 100 for clean visual peaks in WhatsApp
        waveform[i] = Math.min(100, Math.max(2, normalized));
      }

      return waveform;
    } catch (err) {
      console.warn('Could not extract waveform from audio with ffmpeg, using natural speech curve fallback:', err.message);
      return this.generateNaturalWaveformFallback(samplesCount);
    }
  }

  // Generate realistic human vocal waveform (silences, rising and falling intonations)
  generateNaturalWaveformFallback(samplesCount = 64) {
    const waveform = new Uint8Array(samplesCount);
    for (let i = 0; i < samplesCount; i++) {
      const progress = i / samplesCount;
      const envelope = Math.sin(progress * Math.PI);
      const variation = Math.sin(progress * Math.PI * 6) * 0.3 + 0.7;
      const noise = (Math.random() * 0.3) + 0.7;
      const val = Math.round(envelope * variation * noise * 85);
      waveform[i] = Math.min(100, Math.max(3, val));
    }
    return waveform;
  }

  // Generate speech audio from text using OpenRouter (fish-audio/s2.1-pro-free:free)
  async generateSpeech(text, customModel = null, customVoiceId = null) {
    const config = storage.getSettings().fishAudio;
    const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || process.env.FISH_AUDIO_API_KEY;
    const model = customModel || config.model || 'fish-audio/s2.1-pro-free:free';
    const voiceId = customVoiceId || config.voiceId || process.env.FISH_AUDIO_VOICE_ID || '7f92f8afb8ec43bf81429cc1c9199cb1';

    if (!text || text.trim().length === 0) {
      throw new Error('Texto para conversão em áudio não fornecido.');
    }

    const speechText = this.formatSpeechCadence(text);
    const speechSpeed = config.speed || 0.92;

    const filePrefix = `fish_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const tempMp3Path = path.join(AUDIO_CACHE_DIR, `${filePrefix}.mp3`);
    const finalOggPath = path.join(AUDIO_CACHE_DIR, `${filePrefix}.ogg`);

    // 1. Try OpenRouter with Fish Audio model
    if (apiKey) {
      try {
        const payload = {
          model: model.trim(),
          input: speechText,
          response_format: 'mp3'
        };

        if (voiceId && voiceId.trim()) {
          payload.voice = voiceId.trim();
        }

        const response = await axios.post(this.openRouterUrl, payload, {
          headers: {
            Authorization: `Bearer ${apiKey.trim()}`,
            'HTTP-Referer': 'https://zapix.ai',
            'X-Title': 'Zapix AI Closer',
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 30000 // 30s timeout
        });

        fs.writeFileSync(tempMp3Path, Buffer.from(response.data));

        // Convert MP3 to WhatsApp native Opus PTT with natural human tempo
        await this.convertToWhatsAppOpus(tempMp3Path, finalOggPath, speechSpeed);

        const durationSec = Math.max(Math.ceil(text.length / 13), 3);
        const waveform = await this.extractWaveform(finalOggPath);

        return {
          oggPath: finalOggPath,
          audioUrl: `/audio/${path.basename(finalOggPath)}`,
          durationSec,
          waveform,
          filename: path.basename(finalOggPath),
          provider: 'openrouter',
          model,
          voiceId: voiceId.trim()
        };
      } catch (openRouterErr) {
        const errMsg = openRouterErr.response?.data?.toString() || openRouterErr.message;
        console.warn(`[OpenRouter Fish Audio Error]: ${errMsg}`);
        storage.addLog(
          'WARNING',
          `OpenRouter (${model}) falhou: ${errMsg.slice(0, 100)}. Tentando rota direta ou fallback sintetizado.`
        );

        // 2. Try direct Fish Audio if it was a direct API key (starts with 'fa_' or 32 hex)
        if (apiKey.startsWith('fa_') || !apiKey.startsWith('sk-or-')) {
          try {
            const directPayload = {
              text: speechText,
              reference_id: voiceId.trim(),
              format: 'mp3'
            };
            const directRes = await axios.post(this.directFishUrl, directPayload, {
              headers: {
                Authorization: `Bearer ${apiKey.trim()}`,
                'Content-Type': 'application/json'
              },
              responseType: 'arraybuffer',
              timeout: 25000
            });
            fs.writeFileSync(tempMp3Path, Buffer.from(directRes.data));
            await this.convertToWhatsAppOpus(tempMp3Path, finalOggPath, speechSpeed);
            const durationSec = Math.max(Math.ceil(text.length / 13), 3);
            const waveform = await this.extractWaveform(finalOggPath);
            return {
              oggPath: finalOggPath,
              audioUrl: `/audio/${path.basename(finalOggPath)}`,
              durationSec,
              waveform,
              filename: path.basename(finalOggPath),
              provider: 'fish-audio-direct'
            };
          } catch (directErr) {
            console.warn(`[Direct Fish Audio Error]: ${directErr.message}`);
          }
        }
      }
    }

    // 3. Fallback: Generate a clean tone audio using ffmpeg so WhatsApp audio functionality still works for testing
    try {
      const durationSec = Math.max(Math.min(Math.ceil(text.length / 16), 15), 3);
      const toneArgs = [
        '-y',
        '-f', 'lavfi',
        '-i', `sine=frequency=440:duration=${durationSec}`,
        '-af', 'volume=0.2',
        '-c:a', 'libopus',
        '-b:a', '32k',
        '-ar', '48000',
        '-ac', '1',
        finalOggPath
      ];
      await execFileAsync('ffmpeg', toneArgs);
      const waveform = await this.extractWaveform(finalOggPath);

      return {
        oggPath: finalOggPath,
        audioUrl: `/audio/${path.basename(finalOggPath)}`,
        durationSec,
        waveform,
        filename: path.basename(finalOggPath),
        isSynthetic: true,
        model
      };
    } catch (fallbackErr) {
      console.error('Audio generation fallback failed:', fallbackErr);
      throw fallbackErr;
    }
  }
}

export const fishAudio = new FishAudioService();
