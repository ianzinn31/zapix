import { storage } from './storage.js';

class AntiBanService {
  constructor() {
    this.leadQueues = new Map(); // phone -> Promise chain
    this.messageHistory = new Map(); // phone -> timestamps array
  }

  // Calculate realistic typing delay based on message length
  calculateTypingDelay(text = '') {
    const config = storage.getSettings().antiBan;
    const length = text.length;

    // Base thinking delay (human reads the incoming message)
    const baseThinking = Math.floor(
      Math.random() * (config.maxThinkingDelay - config.minThinkingDelay) + config.minThinkingDelay
    );

    // Typing delay per character
    const charDelayRate =
      Math.random() * (config.charDelayMax - config.charDelayMin) + config.charDelayMin;
    const typingTime = Math.floor(length * charDelayRate);

    // Total realistic delay, capped to avoid excessive waiting
    const totalDelay = Math.min(baseThinking + typingTime, 12000);
    return {
      baseThinking,
      typingTime,
      totalDelay
    };
  }

  // Calculate realistic recording delay for voice note
  calculateAudioRecordingDelay(audioDurationSec = 5) {
    const config = storage.getSettings().antiBan;
    // Human picks up phone, presses mic button, speaks
    const thinkingDelay = Math.floor(
      Math.random() * (config.maxThinkingDelay - config.minThinkingDelay) + config.minThinkingDelay
    );
    const recordingDelay = Math.min(Math.max(audioDurationSec * 1000, 2500), 15000);
    return {
      thinkingDelay,
      recordingDelay,
      totalDelay: thinkingDelay + recordingDelay
    };
  }

  // Split text into natural conversational WhatsApp bubbles
  splitIntoNaturalBubbles(fullText) {
    const config = storage.getSettings().antiBan;
    if (!config.splitBubbles || !fullText) {
      return [fullText.trim()];
    }

    // First break by double newlines or paragraph breaks
    const rawParagraphs = fullText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const bubbles = [];

    for (const paragraph of rawParagraphs) {
      if (paragraph.length <= config.maxCharsPerBubble) {
        bubbles.push(paragraph);
      } else {
        // Break long paragraph by punctuation (. ! ?), protecting decimal numbers like 15.00 or 15,00
        const sentences = paragraph.match(/(?:[^.!?]+|\d+[.,]\d+)+[.!?]+(?:\s+|$)|.+$/g) || [paragraph];
        let currentBubble = '';

        for (const sentence of sentences) {
          if ((currentBubble + sentence).length <= config.maxCharsPerBubble) {
            currentBubble += sentence;
          } else {
            if (currentBubble.trim()) {
              bubbles.push(currentBubble.trim());
            }
            currentBubble = sentence;
          }
        }
        if (currentBubble.trim()) {
          bubbles.push(currentBubble.trim());
        }
      }
    }

    // Filter out useless bubbles (e.g. standalone audio emoji markers like 🎵, blank/punctuation remnants)
    const validBubbles = bubbles
      .map((b) => b.trim())
      .filter((b) => {
        const clean = b.replace(/[\s\n\r\t.,!?;:🎵🎶🎙️🎤🎧🔊🔈\-_*~]/g, '');
        return clean.length > 0;
      });

    return validBubbles.length > 0 ? validBubbles : (fullText.trim() ? [fullText.trim()] : []);
  }

  // Queue message action sequentially per contact to prevent collisions and rate violations
  async enqueueForLead(phone, actionFn) {
    if (!this.leadQueues.has(phone)) {
      this.leadQueues.set(phone, Promise.resolve());
    }

    const currentPromise = this.leadQueues.get(phone);
    const nextPromise = currentPromise
      .then(async () => {
        return await actionFn();
      })
      .catch((err) => {
        console.error(`AntiBan queue error for ${phone}:`, err);
      });

    this.leadQueues.set(phone, nextPromise);
    return nextPromise;
  }

  // Sleep utility with optional AbortSignal for human interruption
  sleep(ms, signal = null) {
    return new Promise((resolve) => {
      if (signal?.aborted) return resolve();
      const timer = setTimeout(resolve, ms);
      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true }
        );
      }
    });
  }
}

export const antiBan = new AntiBanService();
