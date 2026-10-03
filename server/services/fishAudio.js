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

  // Format text for natural cadence: strips emojis & emotion tags, preserves line breaks for natural Fish Audio pauses
  formatSpeechCadence(text) {
    if (!text || typeof text !== 'string') return '';
    let formatted = text
      // Remove emojis which can confuse TTS engines or sound robotic
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{2B05}\u{2B06}\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}]/gu, '')
      // Strip any bracket tags or emotion markers (e.g. [warm and calm], [break], [long-break], etc.)
      .replace(/\[[^\]]*\]/g, '')
      // Normalize ellipses to 3 dots
      .replace(/\.{4,}/g, '...');

    // Clean extra horizontal spaces per line while PRESERVING line breaks (\n)
    formatted = formatted
      .split('\n')
      .map(line => line.replace(/[^\S\r\n]+/g, ' ').trim())
      .filter(Boolean)
      .join('\n');

    return formatted.trim();
  }

  // Convert any audio (mp3, wav) to WhatsApp PTT Opus Ogg format using local ffmpeg
  async convertToWhatsAppOpus(inputPath, outputPath, customSpeed = null) {
    try {
      const config = storage.getSettings().fishAudio || {};
      const speed = customSpeed || config.speed || 0.85;
      const validSpeed = (typeof speed === 'number' && speed >= 0.65 && speed <= 1.5) ? speed : 0.85;

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

  // Resolve voice dynamically based on lead phone DDI, target country, or spoken language
  resolveVoice(context = {}) {
    const settings = storage.getSettings();
    const config = settings.fishAudio || {};
    const regionalVoices = config.regionalVoices || {};
    const defaultVoiceId = config.voiceId || process.env.FISH_AUDIO_VOICE_ID || '7f92f8afb8ec43bf81429cc1c9199cb1';

    // 1. Explicit voice ID passed
    if (context.customVoiceId && String(context.customVoiceId).trim()) {
      return {
        voiceId: String(context.customVoiceId).trim(),
        country: 'Personalizado',
        language: 'Manual',
        key: 'custom',
        reason: 'Voice ID explicitamente selecionado'
      };
    }

    const text = context.text || '';

    // 2. Explicit voice/accent directive tag in LLM response text
    // E.g.: [VOZ: es-MX], [VOICE: Mexico], [VOICE_ID: 7f92...]
    const voiceTagMatch = text.match(/\[\s*(?:VOZ|VOICE|ACCENT)\s*:\s*([^\]]+)\]/i);
    if (voiceTagMatch) {
      const tagVal = voiceTagMatch[1].trim();
      for (const [key, voiceData] of Object.entries(regionalVoices)) {
        if (
          key.toLowerCase() === tagVal.toLowerCase() ||
          voiceData.country.toLowerCase() === tagVal.toLowerCase() ||
          (voiceData.language && voiceData.language.toLowerCase().includes(tagVal.toLowerCase()))
        ) {
          if (voiceData.voiceId && voiceData.voiceId.trim()) {
            return {
              voiceId: voiceData.voiceId.trim(),
              country: voiceData.country,
              language: voiceData.language,
              key,
              reason: `Etiqueta de voz [${tagVal}] detectada no texto da IA`
            };
          }
        }
      }
      if (tagVal.length > 10 && !tagVal.includes(' ')) {
        return {
          voiceId: tagVal,
          country: 'Tag Direta',
          language: 'Auto',
          key: 'direct_tag',
          reason: `Tag direta de Voice ID [${tagVal}] detectada`
        };
      }
    }

    // 3. Resolve by Lead Phone Number DDI (Country Code)
    const phone = String(context.phone || '').replace(/[^0-9]/g, '');
    if (phone) {
      const ddiMap = [
        { ddi: '55', key: 'pt-BR' },  // Brasil
        { ddi: '52', key: 'es-MX' },  // México
        { ddi: '57', key: 'es-CO' },  // Colômbia
        { ddi: '54', key: 'es-AR' },  // Argentina
        { ddi: '591', key: 'es-BO' }, // Bolívia
        { ddi: '595', key: 'es-PY' }, // Paraguai
        { ddi: '51', key: 'es-PE' },  // Peru
        { ddi: '56', key: 'es-CL' },  // Chile
        { ddi: '593', key: 'es-419' },// Equador -> LatAm
        { ddi: '58', key: 'es-419' }, // Venezuela -> LatAm
        { ddi: '502', key: 'es-419' },// Guatemala -> LatAm
        { ddi: '504', key: 'es-419' },// Honduras -> LatAm
        { ddi: '503', key: 'es-419' },// El Salvador -> LatAm
        { ddi: '505', key: 'es-419' },// Nicarágua -> LatAm
        { ddi: '506', key: 'es-419' },// Costa Rica -> LatAm
        { ddi: '507', key: 'es-419' },// Panamá -> LatAm
        { ddi: '598', key: 'es-AR' }, // Uruguai -> Rioplatense
        { ddi: '1', key: 'en-US' },   // EUA / Canadá
        { ddi: '34', key: 'es-419' }, // Espanha
        { ddi: '351', key: 'pt-BR' }  // Portugal
      ];

      // Sort by longest DDI first so 591 matches before 59
      ddiMap.sort((a, b) => b.ddi.length - a.ddi.length);

      for (const item of ddiMap) {
        if (phone.startsWith(item.ddi)) {
          const regional = regionalVoices[item.key];
          if (regional && regional.voiceId && regional.voiceId.trim()) {
            return {
              voiceId: regional.voiceId.trim(),
              country: regional.country,
              language: regional.language,
              key: item.key,
              reason: `DDI +${item.ddi} detectado no WhatsApp (${phone})`
            };
          }
          // If country-specific voice is blank, check if it's Spanish and fallback to es-419 (LatAm Geral)
          if (item.key.startsWith('es-') && regionalVoices['es-419']?.voiceId?.trim()) {
            return {
              voiceId: regionalVoices['es-419'].voiceId.trim(),
              country: regionalVoices['es-419'].country,
              language: regionalVoices['es-419'].language,
              key: 'es-419',
              reason: `DDI +${item.ddi} (hispano) -> Fallback para LatAm Geral (es-419)`
            };
          }
        }
      }
    }

    // 4. Resolve by Target Country (configured in product or lead)
    const targetCountry = context.targetCountry || settings.product?.targetCountry;
    if (targetCountry) {
      const countryMap = {
        'Brasil': 'pt-BR',
        'México': 'es-MX',
        'Mexico': 'es-MX',
        'Colômbia': 'es-CO',
        'Colombia': 'es-CO',
        'Argentina': 'es-AR',
        'Bolívia': 'es-BO',
        'Bolivia': 'es-BO',
        'Paraguai': 'es-PY',
        'Paraguay': 'es-PY',
        'Peru': 'es-PE',
        'Perú': 'es-PE',
        'Chile': 'es-CL',
        'LatAm': 'es-419',
        'Global': 'en-US'
      };

      const key = countryMap[targetCountry];
      if (key && regionalVoices[key]?.voiceId?.trim()) {
        return {
          voiceId: regionalVoices[key].voiceId.trim(),
          country: regionalVoices[key].country,
          language: regionalVoices[key].language,
          key,
          reason: `País alvo da oferta configurado: ${targetCountry}`
        };
      }
    }

    // 5. Automatic Language & Dialect Detection from Speech Text
    if (text) {
      const lower = text.toLowerCase();
      const spanishMatches = (lower.match(/\b(hola|cómo|gracias|bueno|material|actividades|para|estás|dinero|cuenta|pago|claro|saludo|hijo|niño|pequeño|semana)\b/g) || []).length;
      const ptMatches = (lower.match(/\b(olá|opa|tudo bem|obrigado|obrigada|você|criança|filho|atividades|estudo|semana|gente|pra|pro|focar)\b/g) || []).length;
      const enMatches = (lower.match(/\b(hello|hi|thanks|thank you|kids|welcome|great|activities|learning)\b/g) || []).length;

      if (enMatches > spanishMatches && enMatches > ptMatches && regionalVoices['en-US']?.voiceId?.trim()) {
        return {
          voiceId: regionalVoices['en-US'].voiceId.trim(),
          country: regionalVoices['en-US'].country,
          language: regionalVoices['en-US'].language,
          key: 'en-US',
          reason: 'Idioma inglês detectado pelo vocabulário da fala'
        };
      }

      if (spanishMatches > ptMatches) {
        if (/\b(ahorita|órale|chido|padre|platicar|spei)\b/.test(lower) && regionalVoices['es-MX']?.voiceId?.trim()) {
          return {
            voiceId: regionalVoices['es-MX'].voiceId.trim(),
            country: regionalVoices['es-MX'].country,
            language: regionalVoices['es-MX'].language,
            key: 'es-MX',
            reason: 'Dialeto mexicano detectado pelo vocabulário'
          };
        }
        if (/\b(nequi|bre-b|chévere|parce|con gusto)\b/.test(lower) && regionalVoices['es-CO']?.voiceId?.trim()) {
          return {
            voiceId: regionalVoices['es-CO'].voiceId.trim(),
            country: regionalVoices['es-CO'].country,
            language: regionalVoices['es-CO'].language,
            key: 'es-CO',
            reason: 'Dialeto colombiano detectado pelo vocabulário'
          };
        }
        if (/\b(che|vos|tenés|podés|alias)\b/.test(lower) && regionalVoices['es-AR']?.voiceId?.trim()) {
          return {
            voiceId: regionalVoices['es-AR'].voiceId.trim(),
            country: regionalVoices['es-AR'].country,
            language: regionalVoices['es-AR'].language,
            key: 'es-AR',
            reason: 'Dialeto argentino detectado pelo vocabulário'
          };
        }
        if (regionalVoices['es-419']?.voiceId?.trim()) {
          return {
            voiceId: regionalVoices['es-419'].voiceId.trim(),
            country: regionalVoices['es-419'].country,
            language: regionalVoices['es-419'].language,
            key: 'es-419',
            reason: 'Espanhol detectado pelo vocabulário -> LatAm Geral (es-419)'
          };
        }
      }

      if (ptMatches > 0 && regionalVoices['pt-BR']?.voiceId?.trim()) {
        return {
          voiceId: regionalVoices['pt-BR'].voiceId.trim(),
          country: regionalVoices['pt-BR'].country,
          language: regionalVoices['pt-BR'].language,
          key: 'pt-BR',
          reason: 'Português do Brasil detectado pelo vocabulário'
        };
      }
    }

    // 6. Global Fallback Voice
    return {
      voiceId: defaultVoiceId,
      country: 'Padrão Geral',
      language: 'Fallback',
      key: 'default',
      reason: 'Voz padrão geral configurada'
    };
  }

  // Generate speech audio from text using OpenRouter (fish-audio/s2.1-pro-free:free)
  async generateSpeech(text, customModel = null, customVoiceId = null, leadContext = null) {
    const settings = storage.getSettings();
    const config = settings.fishAudio || {};
    const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || process.env.FISH_AUDIO_API_KEY;
    const model = customModel || config.model || 'fish-audio/s2.1-pro-free:free';

    // Normalize context object
    const contextObj = typeof leadContext === 'string'
      ? { phone: leadContext, text, customVoiceId }
      : { ...(leadContext || {}), text, customVoiceId };

    const resolved = this.resolveVoice(contextObj);
    const voiceId = resolved.voiceId;

    console.log(`[Fish Audio AI] Voz selecionada: ${resolved.country} (${resolved.language}) -> ID: ${voiceId} [${resolved.reason}]`);

    if (!text || text.trim().length === 0) {
      throw new Error('Texto para conversão em áudio não fornecido.');
    }

    const speechText = this.formatSpeechCadence(text);
    const speechSpeed = config.speed || 0.88;

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
          voiceId: voiceId.trim(),
          detectedCountry: resolved.country,
          detectedLanguage: resolved.language,
          resolutionReason: resolved.reason,
          regionalKey: resolved.key
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
