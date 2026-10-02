import axios from 'axios';
import { createRequire } from 'module';
import { storage } from './storage.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

class VisionService {
  constructor() {
    this.openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    this.nvidiaNimEndpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  // Extract JSON from model response safely
  extractJson(text) {
    if (!text) return null;
    try {
      // Direct JSON parse
      return JSON.parse(text);
    } catch (_) {
      // Remove code fences ```json ... ```
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch (e) {
          console.warn('[VisionService] Failed to parse regex matched JSON:', e.message);
        }
      }
    }
    return null;
  }

  // Normalize and guard against false AGENDADO classifications caused by model training cutoffs
  normalizeResult(parsedJson, brDate, brYear) {
    if (!parsedJson) return null;

    if (parsedJson.status === 'AGENDADO' && parsedJson.reason) {
      const reasonLower = parsedJson.reason.toLowerCase();
      const mentionsFutureDate = reasonLower.includes('data futura') || reasonLower.includes('futuro') || reasonLower.includes('ano futuro');
      const mentionsToday = reasonLower.includes(brDate) || reasonLower.includes(String(brYear));

      // If the model claimed it's a future date, but the date mentioned is today's date or current year:
      if (mentionsFutureDate && mentionsToday) {
        console.log(`[VisionService] Auto-corrigindo falso positivo de AGENDADO: modelo considerou ${brDate} como data futura.`);
        parsedJson.status = 'APROVADO';
        parsedJson.shouldReleaseProduct = true;
        parsedJson.reason = `Pagamento PIX confirmado e efetivado com sucesso na data de hoje (${brDate}).`;
        parsedJson.customerExplanation = 'Pagamento confirmado com sucesso!';
      }
    }

    return parsedJson;
  }

  // Analyze media buffer (Image or PDF)
  async analyzeMedia(buffer, mimetype = 'image/jpeg', meta = {}) {
    const settings = storage.getSettings();
    const product = settings.product || {};
    const expectedPrice = Number(product.price || 0);
    const expectedPixKey = product.pixKey || '88994892385';
    const expectedBeneficiary = product.pixBeneficiary || 'Ian Alves dos Anjos';

    const now = new Date();
    const brDate = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(now);
    const brYear = now.getFullYear();

    const isPdf = mimetype === 'application/pdf' || mimetype.includes('pdf');

    let pdfExtractedText = '';
    if (isPdf) {
      try {
        const parsed = await pdfParse(buffer);
        pdfExtractedText = (parsed.text || '').trim();
      } catch (pdfErr) {
        console.warn('[VisionService] pdf-parse error (might be scanned PDF):', pdfErr.message);
      }
    }

    // Build specialized prompt for Brazilian bank PIX & receipt validation
    const systemPrompt = `Você é um perito antifraude e validador bancário especializado em pagamentos PIX no Brasil para e-commerce.
Seu trabalho é analisar comprovantes enviados por clientes no WhatsApp para identificar se o pagamento foi REALMENTE efetuado ou se é uma tentativa de golpe, agendamento, valor divergente ou documento falso.

=== DADOS OFICIAIS DO PRODUTO E CONTA ===
- Nome do Produto: ${product.name || 'Produto Digital'}
- Valor Oficial Esperado: R$ ${expectedPrice.toFixed(2)}
- Chave PIX Oficial: ${expectedPixKey} (Pode aparecer no comprovante com ou sem código do país +55, ex: +55${expectedPixKey} ou ${expectedPixKey}, ou formatada. Ambas são corretas!)
- Titular / Beneficiário Oficial: ${expectedBeneficiary}

=== DATA ATUAL DO SISTEMA (HOJE) ===
- DATA DE HOJE: ${brDate} (Ano corrente: ${brYear})
- ATENÇÃO SUPREMA SOBRE DATAS: A data de hoje é EXATAMENTE ${brDate}.
- Comprovantes de hoje (${brDate} ou ano ${brYear}) NÃO SÃO AGENDAMENTOS FUTUROS! São pagamentos realizados hoje em tempo real!
- NUNCA classifique um comprovante como "AGENDADO" alegando que ${brDate} ou o ano ${brYear} é uma "data futura"!

=== REGRAS DE ANÁLISE RIGOROSA ===
1. STATUS POSSÍVEIS:
   - "APROVADO": Comprovante de transferência/pagamento PIX REAL de banco brasileiro (Banco do Brasil, Nubank, Itaú, Bradesco, Inter, Caixa, Mercado Pago, Santander, Sicredi, etc.) contendo títulos como "Comprovante de Pagamento PIX", "Comprovante de Transferência PIX", "Comprovante PIX", "Transferência Concluída", ou com autenticação bancária, ID da transação (código E...), SISBB ou código de controle, emitido na data de hoje (${brDate}) ou recente, com valor e destinatário compatíveis.
   - "AGENDADO": DEVE SER USADO EXCLUSIVAMENTE SE o documento contiver explicitamente termos de agendamento NÃO liquidado, como "Comprovante de agendamento", "Transferência agendada", "Agendado para [data posterior a hoje]", "Atenção: este documento é apenas um comprovante de agendamento e não garante a efetivação". Se o documento NÃO contiver esses avisos de agendamento e tiver sido emitido hoje (${brDate}), ele é APROVADO!
   - "VALOR_INCORRETO": É um comprovante efetivado, mas com valor menor do que o valor do produto (ex: enviou R$ 10 em vez de R$ ${expectedPrice.toFixed(2)}).
   - "DESTINATARIO_INCORRETO": Comprovante enviado para outra pessoa/chave diferente da oficial.
   - "FALSO_OU_ADULTERADO": Imagem com fontes desalinhadas, rascunho de tela sem confirmação, ou montagem.
   - "NAO_E_COMPROVANTE": Imagem aleatória (foto de produto, selfie, áudio, meme, etc.).

2. DIRETRIZ DE SEGURANÇA:
   - shouldReleaseProduct deve ser TRUE se status for "APROVADO". Se for "AGENDADO", deve ser FALSE.

Você DEVE responder EXCLUSIVAMENTE em formato JSON puro, sem markdown adicional:
{
  "isBankReceipt": boolean,
  "status": "APROVADO" | "AGENDADO" | "VALOR_INCORRETO" | "DESTINATARIO_INCORRETO" | "FALSO_OU_ADULTERADO" | "NAO_E_COMPROVANTE",
  "bank": string | null,
  "amount": number | null,
  "recipient": string | null,
  "beneficiary": string | null,
  "scheduledDate": string | null,
  "shouldReleaseProduct": boolean,
  "reason": string,
  "customerExplanation": string
}`;

    // 1. If PDF has extracted text, analyze with text model first (very fast)
    if (pdfExtractedText && pdfExtractedText.length > 30) {
      try {
        const textResult = await this.analyzeTextReceipt(pdfExtractedText, systemPrompt);
        if (textResult) {
          storage.addLog(
            textResult.shouldReleaseProduct ? 'SUCCESS' : 'WARNING',
            `[Vision PDF] Análise do documento de ${meta.phone || 'cliente'}: Status ${textResult.status} | Valor R$ ${textResult.amount || 'N/A'}`
          );
          return textResult;
        }
      } catch (err) {
        console.warn('[VisionService] Text analysis from PDF failed, falling back to vision model:', err.message);
      }
    }

    // 2. Vision Model Analysis (OpenRouter Google Gemini 2.5 Flash -> fallback to NVIDIA NIM Vision)
    const base64Data = buffer.toString('base64');
    const dataUri = `data:${mimetype};base64,${base64Data}`;

    // Try Primary: OpenRouter google/gemini-2.5-flash
    const openRouterKey = process.env.OPENROUTER_API_KEY || settings.vision?.apiKey;
    if (openRouterKey) {
      try {
        const res = await axios.post(
          this.openRouterEndpoint,
          {
            model: settings.vision?.model || 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Analise detalhadamente esta imagem/documento e retorne apenas o JSON de validação de pagamento.'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: dataUri }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 600
          },
          {
            headers: {
              Authorization: `Bearer ${openRouterKey.trim()}`,
              'Content-Type': 'application/json'
            },
            timeout: 25000
          }
        );

        const content = res.data?.choices?.[0]?.message?.content;
        const parsedJson = this.normalizeResult(this.extractJson(content), brDate, brYear);
        if (parsedJson) {
          storage.addLog(
            parsedJson.shouldReleaseProduct ? 'SUCCESS' : 'WARNING',
            `[Vision AI] Comprovante de ${meta.phone || 'cliente'}: Status ${parsedJson.status} (${parsedJson.bank || 'Banco'}) | Motivo: ${parsedJson.reason}`
          );
          return parsedJson;
        }
      } catch (orErr) {
        console.error('[VisionService OpenRouter Error]:', orErr.response?.data || orErr.message);
        storage.addLog('WARNING', `Vision OpenRouter falhou: ${orErr.message}. Tentando fallback NVIDIA NIM.`);
      }
    }

    // Fallback: NVIDIA NIM meta/llama-3.2-11b-vision-instruct
    const nvidiaKey = process.env.NVIDIA_NIM_PRIMARY_API_KEY || settings.ai?.primaryApiKey;
    if (nvidiaKey) {
      try {
        const res = await axios.post(
          this.nvidiaNimEndpoint,
          {
            model: settings.vision?.fallbackModel || 'meta/llama-3.2-11b-vision-instruct',
            messages: [
              { role: 'system', content: systemPrompt },
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Analise este comprovante e retorne o JSON de validação bancária.'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: dataUri }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 600
          },
          {
            headers: {
              Authorization: `Bearer ${nvidiaKey.trim()}`,
              'Content-Type': 'application/json'
            },
            timeout: 25000
          }
        );

        const content = res.data?.choices?.[0]?.message?.content;
        const parsedJson = this.normalizeResult(this.extractJson(content), brDate, brYear);
        if (parsedJson) {
          storage.addLog(
            parsedJson.shouldReleaseProduct ? 'SUCCESS' : 'WARNING',
            `[Vision NVIDIA Fallback] Comprovante de ${meta.phone || 'cliente'}: Status ${parsedJson.status} | Motivo: ${parsedJson.reason}`
          );
          return parsedJson;
        }
      } catch (nimErr) {
        console.error('[VisionService NVIDIA Fallback Error]:', nimErr.response?.data || nimErr.message);
      }
    }

    // Heuristic fallback if offline or API quota exhausted
    return {
      isBankReceipt: true,
      status: 'AGENDADO',
      bank: null,
      amount: null,
      shouldReleaseProduct: false,
      reason: 'Não foi possível validar automaticamente com precisão total. Por segurança, o produto não foi liberado.',
      customerExplanation: 'Recebi seu comprovante, mas estamos passando por uma verificação manual de segurança no sistema. Assim que nosso setor financeiro validar a compensação, o material será liberado para você!'
    };
  }

  // Analyze text extracted from a PDF
  async analyzeTextReceipt(text, systemPrompt) {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) return null;

    const res = await axios.post(
      this.openRouterEndpoint,
      {
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Texto extraído do documento PDF bancário:\n"""\n${text}\n"""\nRetorne exclusivamente o JSON de validação.`
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      },
      {
        headers: {
          Authorization: `Bearer ${openRouterKey.trim()}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const content = res.data?.choices?.[0]?.message?.content;
    return this.extractJson(content);
  }
}

export const visionService = new VisionService();
