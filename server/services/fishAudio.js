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

  // Convert any audio (mp3, wav) to WhatsApp PTT Opus Ogg format using local ffmpeg
  async convertToWhatsAppOpus(inputPath, outputPath) {
    try {
      const args = [
        '-y',
        '-i', inputPath,
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

  // Generate speech audio from text using OpenRouter (fish-audio/s2.1-pro-free:free)
  async generateSpeech(text, customModel = null, customVoiceId = null) {
    const config = storage.getSettings().fishAudio;
    const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || process.env.FISH_AUDIO_API_KEY;
    const model = customModel || config.model || 'fish-audio/s2.1-pro-free:free';
    const voiceId = customVoiceId || config.voiceId || process.env.FISH_AUDIO_VOICE_ID || '7f92f8afb8ec43bf81429cc1c9199cb1';

    if (!text || text.trim().length === 0) {
      throw new Error('Texto para conversão em áudio não fornecido.');
    }

    const filePrefix = `fish_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const tempMp3Path = path.join(AUDIO_CACHE_DIR, `${filePrefix}.mp3`);
    const finalOggPath = path.join(AUDIO_CACHE_DIR, `${filePrefix}.ogg`);

    // 1. Try OpenRouter with Fish Audio model
    if (apiKey) {
      try {
        const payload = {
          model: model.trim(),
          input: text.trim(),
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

        // Convert MP3 to WhatsApp native Opus PTT
        await this.convertToWhatsAppOpus(tempMp3Path, finalOggPath);

        const durationSec = Math.max(Math.ceil(text.length / 15), 3);

        return {
          oggPath: finalOggPath,
          audioUrl: `/audio/${path.basename(finalOggPath)}`,
          durationSec,
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
              text: text.trim(),
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
            await this.convertToWhatsAppOpus(tempMp3Path, finalOggPath);
            const durationSec = Math.max(Math.ceil(text.length / 15), 3);
            return {
              oggPath: finalOggPath,
              audioUrl: `/audio/${path.basename(finalOggPath)}`,
              durationSec,
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

      return {
        oggPath: finalOggPath,
        audioUrl: `/audio/${path.basename(finalOggPath)}`,
        durationSec,
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
