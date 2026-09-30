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

    const paymentMethod = product.paymentMethod || (product.pixKey ? 'both' : 'checkout');

    let paymentInfo = '';
    if (paymentMethod === 'pix') {
      paymentInfo = `=== FORMA DE PAGAMENTO OFICIAL: PIX DIRETO ===
- Tipo de Fechamento: Exclusivamente via PIX direto nesta conversa.
- Chave PIX (${product.pixKeyType || 'Chave'}): ${product.pixKey || 'A ser informada'}
- Nome do Titular/Beneficiário: ${product.pixBeneficiary || 'Confirmar no app do banco'}
- Valor da Oferta: R$ ${Number(product.price).toFixed(2)} (${product.currency || 'BRL'})
- Instruções de Fechamento: ${product.pixInstructions || 'Pedir para enviar o comprovante aqui no WhatsApp para envio imediato do material.'}
- REGRA OBRIGATÓRIA: Quando o cliente pedir para pagar, demonstrar intenção de fechar ou pedir o PIX, envie a chave PIX de forma clara e destacada em uma linha separada para ele conseguir copiar facilmente no celular. Peça que envie o print do comprovante aqui para liberação imediata.`;
    } else if (paymentMethod === 'both') {
      paymentInfo = `=== FORMAS DE PAGAMENTO DISPONÍVEIS: PIX DIRETO OU CHECKOUT ===
1. OPÇÃO PIX DIRETO (À vista com liberação imediata):
   - Chave PIX (${product.pixKeyType || 'Chave'}): ${product.pixKey || 'A ser informada'}
   - Titular da Conta: ${product.pixBeneficiary || 'Confirmar no app do banco'}
   - Instrução: ${product.pixInstructions || 'Enviar comprovante aqui no WhatsApp.'}
2. OPÇÃO CARTÃO DE CRÉDITO / PARCELADO:
   - Link de Checkout Oficial: ${product.checkoutUrl || 'Link pendente'}
- REGRA DE CONDUÇÃO: Se o cliente preferir pagar no PIX ou à vista, forneça a chave PIX limpa para cópia e peça o comprovante. Se ele preferir parcelar no cartão de crédito, forneça o link de checkout!`;
    } else {
      paymentInfo = `=== FORMA DE PAGAMENTO OFICIAL: LINK DE CHECKOUT ===
- Link Oficial de Checkout: ${product.checkoutUrl || 'Link pendente'}
- REGRA OBRIGATÓRIA: Sempre que o cliente demonstrar intenção de compra ou pedir o link, envie o link oficial com uma chamada clara para ação.`;
    }

    return `Você é um consultor especialista em vendas e atendimento humanizado via WhatsApp da empresa Zapix.
Seu objetivo principal é atender o lead com extrema empatia, entender as necessidades dele, tirar dúvidas, contornar objeções e conduzi-lo para a compra do infoproduto.

=== INFORMAÇÕES DO PRODUTO QUE VOCÊ VENDE ===
- Nome do Produto: ${product.name}
- Nicho: ${product.niche}
- Público Alvo: ${product.targetAudience}
- Preço da Oferta: R$ ${Number(product.price).toFixed(2)} (${product.currency})
- Garantia: ${product.guaranteeDays} dias incondicionais

${paymentInfo}

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
   ATENÇÃO:
   - Use rigorosamente o formato [AUDIO: texto] sem acento na palavra AUDIO.
   - NÃO use aspas ao redor do texto dentro da tag.
   - SEMPRE feche com colchete ']'.
   Exemplo:
   [AUDIO: Opa! Tudo bem? Vi que você tem interesse no método. Gravei esse áudio pra te explicar rapidinho como funciona.]
4. QUANDO ENVIAR ENTREGÁVEL (PDF OU IMAGEM) E REGRAS ANTIFRAUDE DE PIX:
   - VALIDAÇÃO DE COMPROVANTES: O sistema Zapix analisa automaticamente qualquer imagem ou documento de comprovante enviado pelo lead e adiciona a análise na conversa.
   - SE O COMPROVANTE FOR AGENDAMENTO (Status: AGENDADO):
     * NUNCA envie a tag de entregável nem libere o material! O dinheiro ainda NÃO caiu na conta!
     * Explique com simpatia e clareza: "Vi o comprovante que você enviou, mas ele é um agendamento de PIX (programado para depois) e a transferência ainda não foi realizada. Como nosso envio é imediato, precisamos do PIX feito na hora. Você consegue entrar no seu app do banco, cancelar o agendamento e fazer a transferência normal na hora? Assim que fizer, seu acesso é liberado imediatamente!"
     * Se o cliente insistir ("eu já paguei", "libera logo"), repita educadamente que o sistema só faz a liberação com a transferência imediata compensada.
   - SE O COMPROVANTE FOR FALSO, VALOR INCORRETO OU DESTINATÁRIO DIFERENTE:
     * NUNCA libere o produto! Explique a divergência com respeito e envie a chave PIX correta.
   - SE O COMPROVANTE FOR CONFIRMADO (Status: APROVADO):
     * Agradeça calorosamente, comemore a decisão dele e acione a tag do entregável para envio imediato:
       [ENVIAR_ARQUIVO: ${deliverables[0]?.tag || 'PRODUTO'}]
   - Se o cliente apenas disser em texto que pagou SEM ter enviado comprovante ou se o comprovante estiver agendado, NÃO acione tags de entregável. Peça com gentileza o comprovante do PIX imediato.
5. FECHAMENTO E COBRANÇA:
   ${paymentMethod === 'pix' 
      ? 'Apresente a chave PIX destacada, informe o valor oficial e solicite o comprovante aqui na conversa para liberação do acesso.'
      : paymentMethod === 'both'
      ? 'Dê as duas alternativas: envie a chave PIX para quem prefere PIX à vista, e o link de checkout para quem deseja parcelar no cartão.'
      : 'Envie o link oficial de checkout e instrua os passos para pagamento.'}

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
