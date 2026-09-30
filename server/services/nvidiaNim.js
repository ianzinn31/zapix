import axios from 'axios';
import { storage } from './storage.js';

class NvidiaNimService {
  constructor() {
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
  }

  // Construct sales-focused prompt with product context, deliverables, and behavioral rules
  buildSystemPrompt() {
    const settings = storage.getSettings();
    const product = settings.product;
    const deliverables = storage.getDeliverables();

    const deliverableList = deliverables
      .map((d) => `- ${d.name} (${d.type.toUpperCase()}) | Tag/Identificador: [${d.tag}] | Descrição: ${d.description}`)
      .join('\n');

    const objectionsList = (product.objections || [])
      .map((o) => `- Objeção "${o.trigger}": ${o.response}`)
      .join('\n');

    const painPointsList = (product.mainPainPoints || []).map((p) => `- ${p}`).join('\n');
    const benefitsList = (product.mainBenefits || []).map((b) => `- ${b}`).join('\n');

    return `Você é um consultor especialista em vendas e atendimento humanizado via WhatsApp da empresa Zapix.
Seu objetivo principal é atender o lead com extrema empatia, entender as necessidades dele, tirar dúvidas, contornar objeções e conduzi-lo para a compra do infoproduto.

=== INFORMAÇÕES DO PRODUTO QUE VOCÊ VENDE ===
- Nome do Produto: ${product.name}
- Nicho: ${product.niche}
- Público Alvo: ${product.targetAudience}
- Preço da Oferta: R$ ${Number(product.price).toFixed(2)} (${product.currency})
- Link Oficial de Checkout: ${product.checkoutUrl}
- Garantia: ${product.guaranteeDays} dias incondicionais

=== DORES PRINCIPAIS DO CLIENTE ===
${painPointsList || '- Busca uma nova fonte de renda rápida'}

=== PRINCIPAIS BENEFÍCIOS DO PRODUTO ===
${benefitsList || '- Acesso imediato, prático e validado'}

=== TRATAMENTO DE OBJEÇÕES ===
${objectionsList || '- Se achar caro, destaque o parcelamento e retorno rápido.'}

=== ENTREGÁVEIS / MATERIAIS DE APOIO DISPONÍVEIS ===
${deliverableList || 'Nenhum entregável cadastrado no momento.'}

=== DIRETRIZES DE COMUNICAÇÃO NO WHATSAPP ===
1. Responda como uma pessoa real no WhatsApp: Seja amigável, direto, use pontuação natural e tom caloroso. Evite textos gigantescos acadêmicos.
2. Não fale tudo de uma vez. Faça perguntas de engajamento no final para manter a conversa fluindo (ex: "Você já tentou vender na internet antes ou tá começando agora?").
3. QUANDO ENVIAR ÁUDIO (FISH AUDIO):
   Se você quiser enviar uma resposta ou parte dela em áudio de voz para gerar conexão profunda (especialmente na apresentação da oferta ou contorno de objeção), use a tag:
   [AUDIO: texto exato que será falado no áudio]
   Exemplo:
   [AUDIO: Opa! Tudo bem? Vi que você tem interesse no método. Gravei esse áudio pra te explicar rapidinho como funciona.]
4. QUANDO ENVIAR ENTREGÁVEL (PDF OU IMAGEM):
   Se o cliente pedir o produto, amostra, prova social ou confirmar que comprou/pagou (ex: "paguei", "pode enviar"), envie uma mensagem calorosa de boas-vindas e acione a tag do entregável cadastrado:
   [ENVIAR_ARQUIVO: TAG_DO_ARQUIVO]
   Exemplo:
   [ENVIAR_ARQUIVO: ${deliverables[0]?.tag || 'PROVA_SOCIAL'}]
   O sistema interceptará essa tag automaticamente e despachará o arquivo PDF/imagem real diretamente no WhatsApp do cliente.
5. QUANDO APRESENTAR O CHECKOUT:
   Sempre que o cliente demonstrar intenção de compra ou pedir o link, envie o link oficial: ${product.checkoutUrl} com uma chamada para ação clara.

${settings.ai.customPromptInstructions ? `\n=== INSTRUÇÕES ADICIONAIS DO USUÁRIO ===\n${settings.ai.customPromptInstructions}` : ''}
`;
  }

  // Call single NIM model with timeout
  async callModel(model, apiKey, messages, temperature = 0.7, maxTokens = 600) {
    if (!apiKey) {
      throw new Error(`API Key não configurada para o modelo ${model}`);
    }

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.95
    };

    const response = await axios.post(this.endpoint, payload, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      timeout: 25000 // 25s timeout
    });

    if (response.data && response.data.choices && response.data.choices[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }

    throw new Error('Resposta vazia ou inválida da API NVIDIA NIM');
  }

  // Generate sales response with automatic primary -> secondary fallback
  async generateResponse(phone, userMessage, conversationHistory = []) {
    const settings = storage.getSettings().ai;
    const systemPrompt = this.buildSystemPrompt();

    // Build context message array
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add recent history (up to last 10 messages)
    const recentHistory = conversationHistory.slice(-10);
    for (const h of recentHistory) {
      messages.push({
        role: h.fromMe ? 'assistant' : 'user',
        content: h.text || ''
      });
    }

    // Add the current incoming message if not already included
    if (userMessage && (!recentHistory.length || recentHistory[recentHistory.length - 1].text !== userMessage)) {
      messages.push({ role: 'user', content: userMessage });
    }

    let responseText = null;
    let modelUsed = settings.primaryModel || 'meta/llama-3.2-11b-vision-instruct';

    // 1. Try Primary NVIDIA NIM Model
    try {
      const primaryKey = settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (primaryKey) {
        responseText = await this.callModel(
          settings.primaryModel || 'meta/llama-3.2-11b-vision-instruct',
          primaryKey,
          messages,
          settings.temperature,
          settings.maxTokens
        );
        // Primary succeeded - ensure fallback state is marked inactive
        if (settings.isFallbackActive) {
          storage.updateSettings({ ai: { isFallbackActive: false, lastFallbackReason: null } });
          storage.addLog('INFO', `Modelo Primário NVIDIA NIM (${modelUsed}) operando normalmente.`);
        }
        return { text: responseText, modelUsed, fallbackTriggered: false };
      }
    } catch (primaryErr) {
      console.warn(`[NVIDIA NIM Primary Error]: ${primaryErr.message}`);
      storage.addLog(
        'FALLBACK_TRIGGERED',
        `NVIDIA NIM Primário (${settings.primaryModel}) falhou: ${primaryErr.message}. Ativando Fallback para (${settings.fallbackModel || 'meta/llama-3.2-11b-vision-instruct'}).`
      );
      storage.updateSettings({
        ai: {
          isFallbackActive: true,
          lastFallbackReason: primaryErr.message
        }
      });
    }

    // 2. Try Fallback NVIDIA NIM Model
    try {
      const fallbackKey = settings.fallbackApiKey || process.env.NVIDIA_NIM_FALLBACK_API_KEY || settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      const fallbackModel = settings.fallbackModel || 'meta/llama-3.2-11b-vision-instruct';
      if (fallbackKey && fallbackModel) {
        modelUsed = fallbackModel;
        responseText = await this.callModel(
          fallbackModel,
          fallbackKey,
          messages,
          settings.temperature,
          settings.maxTokens
        );
        return { text: responseText, modelUsed, fallbackTriggered: true };
      }
    } catch (fallbackErr) {
      console.error(`[NVIDIA NIM Fallback Error]: ${fallbackErr.message}`);
      storage.addLog(
        'ERROR',
        `Ambos os modelos NVIDIA NIM falharam! Erro no fallback: ${fallbackErr.message}`
      );
    }

    // 3. Smart Rule-Based Engine Backup (if both keys are missing or offline during demo)
    const backupReply = this.generateOfflineSmartReply(userMessage);
    return {
      text: backupReply,
      modelUsed: 'offline-sales-fallback',
      fallbackTriggered: true
    };
  }

  // Backup sales responses when no API keys are provided or offline
  generateOfflineSmartReply(userMessage = '') {
    const text = (userMessage || '').toLowerCase();
    const product = storage.getSettings().product;

    if (text.includes('preço') || text.includes('quanto custa') || text.includes('valor')) {
      return `O investimento no ${product.name} está em condição especial hoje por apenas R$ ${Number(product.price).toFixed(2)}!\n\nVocê tem acesso completo a todo o passo a passo com garantia incondicional de ${product.guaranteeDays} dias.\n\nQuer garantir sua vaga com esse valor promocional agora? É só acessar: ${product.checkoutUrl}`;
    }

    if (text.includes('link') || text.includes('comprar') || text.includes('quero') || text.includes('pix')) {
      return `Maravilha! Você pode garantir seu acesso imediatamente pelo link oficial:\n👉 ${product.checkoutUrl}\n\nAssim que o pagamento for confirmado, você já recebe o acesso no seu e-mail e no WhatsApp! Se tiver qualquer dúvida durante o processo, só me avisar aqui.`;
    }

    if (text.includes('funciona') || text.includes('resultado') || text.includes('prova')) {
      return `[ENVIAR_IMAGEM: PROVA_SOCIAL]\nSim, funciona com certeza! Temos alunos de todas as idades aplicando o método passo a passo.\n\nDá uma olhada nesses resultados acima! O que você mais busca no momento com o método?`;
    }

    if (text.includes('amostra') || text.includes('gratis') || text.includes('pdf') || text.includes('material')) {
      return `[ENVIAR_ARQUIVO: GUIA_AMOSTRA]\nCom certeza! Acabei de te mandar o guia em PDF com os primeiros passos para você dar uma olhada.\n\nDepois que ler me fala aqui o que achou!`;
    }

    // Default conversational greeting
    return `Olá! Que bom falar com você! 😊\n\nSou do time de atendimento do ${product.name}. Vi que você se interessou pelo nosso método prático de renda com IA.\n\nMe conta: você já tem alguma experiência ou está começando do absoluto zero?`;
  }
}

export const nvidiaNim = new NvidiaNimService();
