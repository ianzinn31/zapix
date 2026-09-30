import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { storage } from './storage.js';

class AudioTranscriberService {
  constructor() {
    this.groqEndpoint = 'https://api.groq.com/openai/v1/audio/transcriptions';
  }

  // Transcribe audio buffer (WhatsApp .ogg / Opus) into Portuguese text using Groq Whisper-large-v3
  async transcribeBuffer(audioBuffer, filename = 'audio.ogg') {
    const config = storage.getSettings().transcription || {};
    const apiKey = (config.apiKey || process.env.GROQ_API_KEY || '').trim();

    if (!apiKey) {
      console.warn('[AudioTranscriber] GROQ_API_KEY não configurada. Áudio não será transcrito.');
      return {
        text: '',
        error: 'GROQ_API_KEY não configurada no sistema.'
      };
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return { text: '', error: 'Buffer de áudio vazio.' };
    }

    const model = config.model || 'whisper-large-v3';
    const language = config.language || 'pt';

    try {
      // Create FormData using Node.js native FormData and Blob
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
      formData.append('file', blob, filename);
      formData.append('model', model);
      formData.append('language', language);
      formData.append('response_format', 'json');
      formData.append('temperature', '0.0');

      const response = await axios.post(this.groqEndpoint, formData, {
        headers: {
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 25000 // 25s timeout
      });

      const transcribedText = response.data?.text ? response.data.text.trim() : '';

      if (transcribedText) {
        storage.addLog(
          'SUCCESS',
          `Áudio do cliente transcrito com sucesso via Groq (${model}): "${transcribedText.slice(0, 60)}${transcribedText.length > 60 ? '...' : ''}"`
        );
      }

      return {
        text: transcribedText,
        model,
        language
      };
    } catch (err) {
      const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error(`[AudioTranscriber Error]: ${errMsg}`);
      storage.addLog('WARNING', `Falha ao transcrever áudio via Groq: ${errMsg.slice(0, 100)}`);
      return {
        text: '',
        error: errMsg
      };
    }
  }

  // Transcribe audio file from disk
  async transcribeFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo de áudio não encontrado: ${filePath}`);
    }
    const buffer = fs.readFileSync(filePath);
    return this.transcribeBuffer(buffer, path.basename(filePath));
  }
}

export const audioTranscriber = new AudioTranscriberService();
