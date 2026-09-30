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

    const deliveryStrategy = product.deliveryStrategy || 'require_payment';

    let deliverableStrategySection = '';
    if (deliveryStrategy === 'deliver_first') {
      deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: ENTREGAR ANTES E COBRAR DEPOIS (ISCA DE VALOR)
   - Nesta operação, seu objetivo é encantar o cliente entregando o material ANTECIPADAMENTE!
   - Quando o cliente demonstrar interesse ou pedir as receitas/material, envie IMEDIATAMENTE usando a tag do entregável:
     [ENVIAR_ARQUIVO: ${deliverables[0]?.tag || 'PRODUTO'}]
   - Após enviar, demonstre carinho, pergunte o que ele achou e conduza para o fechamento/cobrança oficial (PIX ou checkout) para liberar os bônus, acompanhamento ou pacote completo.
   - Caso o cliente envie um agendamento de PIX na cobrança posterior, oriente com simpatia que precisa ser o PIX compensado na hora.`;
    } else if (deliveryStrategy === 'per_deliverable') {
      deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: LIBERAÇÃO HÍBRIDA POR ENTREGÁVEL
   - Entregáveis de Amostra/Isca Gratuita (sem exigência de pagamento): Você pode e DEVE enviar antes do pagamento para gerar encantamento:
${deliverables.filter(d => d.requirePayment === false).map(d => `     * [ENVIAR_ARQUIVO: ${d.tag}] (${d.name})`).join('\n') || '     (Nenhum entregável gratuito cadastrado)'}
   - Entregáveis do Produto Pago: NUNCA envie antes do pagamento verificado com status APROVADO:
${deliverables.filter(d => d.requirePayment !== false).map(d => `     * [ENVIAR_ARQUIVO: ${d.tag}] (${d.name})`).join('\n') || '     (Nenhum entregável pago cadastrado)'}
   - Se o cliente enviar agendamento de PIX, nunca libere os arquivos pagos.`;
    } else {
      deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: COBRAR PRIMEIRO, ENTREGAR DEPOIS (PADRÃO SEGURO ANTIFRAUDE)
   - O entregável do produto principal SÓ DEVE SER LIBERADO após o cliente efetuar o pagamento imediato e o comprovante for verificado com status APROVADO.
   - SE O COMPROVANTE FOR AGENDAMENTO (Status: AGENDADO):
     * NUNCA envie a tag de entregável nem libere o material! O dinheiro ainda NÃO caiu na conta!
     * Explique com simpatia e clareza: "Vi o comprovante que você enviou, mas ele é um agendamento de PIX (programado para depois) e a transferência ainda não foi realizada. Como nosso envio é imediato, precisamos do PIX feito na hora. Você consegue entrar no seu app do banco, cancelar o agendamento e fazer a transferência normal na hora? Assim que fizer, seu acesso é liberado imediatamente!"
     * Se o cliente insistir ("eu já paguei", "libera logo"), repita educadamente que o sistema só faz a liberação com a transferência imediata compensada.
   - SE O COMPROVANTE FOR CONFIRMADO (Status: APROVADO):
     * Agradeça calorosamente, comemore a decisão dele e acione a tag do entregável para envio imediato:
       [ENVIAR_ARQUIVO: ${deliverables[0]?.tag || 'PRODUTO'}]
   - Se o cliente apenas disser em texto que pagou SEM ter enviado comprovante ou se o comprovante estiver agendado, NÃO acione tags de entregável. Peça com gentileza o comprovante do PIX imediato.`;
    }

    const fishSettings = settings.fishAudio || {};
    const autoAudioMode = fishSettings.autoAudioMode || 'hybrid_high_conversion';
    const isAudioActive = fishSettings.enabled !== false;

    let audioStrategySection = '';
    if (isAudioActive) {
      if (autoAudioMode === 'hybrid_high_conversion') {
        audioStrategySection = `3. ESTRATÉGIA ATIVA DE ÁUDIO (MODO HÍBRIDO DE ALTA CONVERSÃO - OBRIGATÓRIO):
   Você DEVE mesclar ativamente mensagens de texto curtas e áudios de voz [AUDIO: ...] ao longo da conversa. Não espere o cliente pedir!
   Envie a tag [AUDIO: fala do áudio aqui] com frequência nos seguintes momentos cruciais:
   a) Explicações e Apresentação do Produto/Receitas (REGRA DE OURO):
      - Se o cliente pedir para explicar melhor ("como funciona?", "me explica?", "quais receitas vêm?", "o que tem no material?"), É PROIBIDO MANDAR TEXTÃO NO WHATSAPP!
      - Você DEVE explicar em ÁUDIO [AUDIO: ...] de 15 a 30 segundos, com voz amigável, espontânea e empolgada, citando os pontos mais gostosos/práticos.
      - No texto escrito, mande apenas 1 frase curta e amigável acompanhando o áudio (ex: "Gravei um áudio aqui te explicando tudo rapidinho! 👆").
   b) Acolhimento & Conexão: Ao ouvir a situação pessoal, dores ou objetivos do cliente, responda com calor humano e empatia em áudio (10 a 15 segundos).
   c) Quebra de Objeções & Insegurança: Dúvidas sobre o funcionamento, medo de não conseguir aplicar ou garantia de 7 dias devem ser explicadas em áudio para transmitir máxima confiança, autoridade e calma.
   d) Apresentação da Oferta & Desconto: Apresente o valor especial e os bônus falando em áudio com entusiasmo de quem quer ajudar.
   e) Fechamento / Envio do PIX:
      - Escreva a chave PIX no texto limpo (para facilitar a cópia com 1 clique no celular).
      - JUNTO com o texto do PIX, envie um áudio curto de 8 a 12 segundos:
        [AUDIO: Prontinho! Te mandei a chave pix aqui no texto, pode fazer com calma no app do seu banco que eu já tô aqui de plantão pra liberar seu acesso na hora que você mandar o comprovante!]
   f) Espelhamento: Se o cliente mandar um áudio ou pedir áudio, SEMPRE responda com [AUDIO: ...] também!

   REGRAS OBRIGATÓRIAS DO ÁUDIO:
   - Formato rigoroso: [AUDIO: texto falado aqui] (dois pontos DENTRO dos colchetes, sem aspas, feche sempre com ']').
   - NUNCA escreva [Áudio]: "..." com dois pontos fora do colchete nem com aspas! Escreva sempre [AUDIO: texto falado].
   - A fala no áudio deve ser curta, espontânea, brasileira e natural (1 a 3 frases no máximo), sem emojis, sem links e sem asteriscos.
   - Você pode enviar texto antes ou depois de [AUDIO: ...]! O sistema enviará a mensagem de texto E o áudio de voz na mesma interação!`;
      } else if (autoAudioMode === 'frequent_audio') {
        audioStrategySection = `3. ESTRATÉGIA ATIVA DE ÁUDIO (MODO FREQUENTE - 80%+ EM ÁUDIO):
   O cliente prefere atendimento quase 100% em áudio de voz!
   Quase todas as suas respostas devem conter a tag [AUDIO: texto falado], especialmente qualquer explicação de receitas, produtos ou dúvidas!
   Use texto apenas para enviar links, chaves PIX ou dados que o cliente precise copiar e colar, e fale todo o restante através de [AUDIO: ...].`;
      } else if (autoAudioMode === 'pitch_and_welcome') {
        audioStrategySection = `3. ESTRATÉGIA DE ÁUDIO (BOAS-VINDAS E PITCH):
   Envie áudio de voz [AUDIO: ...] na primeira mensagem de recepção/boas-vindas e no momento de apresentar o valor promocional da oferta, além de quando o cliente solicitar áudio.`;
      } else if (autoAudioMode === 'pitch_only') {
        audioStrategySection = `3. ESTRATÉGIA DE ÁUDIO (APENAS PITCH E FECHAMENTO):
   Envie áudio de voz [AUDIO: ...] apenas no momento em que você apresentar o preço, desconto ou chave PIX, além de quando o cliente solicitar áudio.`;
      } else if (autoAudioMode === 'mirror_only') {
        audioStrategySection = `3. ESTRATÉGIA DE ÁUDIO (ESPELHAMENTO):
   Apenas envie áudio [AUDIO: ...] se o cliente enviar um áudio para você ou pedir explicitamente para você mandar áudio.`;
      } else {
        audioStrategySection = `3. ESTRATÉGIA DE ÁUDIO:
   Não envie tags de áudio nesta conversa. Responda exclusivamente em texto.`;
      }
    } else {
      audioStrategySection = `3. ESTRATÉGIA DE ÁUDIO:
   O envio de áudio está desativado. Responda exclusivamente em texto.`;
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
1. REGRA SUPREMA - ZERO TEXTÃO NO WHATSAPP:
   - Suas mensagens de texto devem ser SEMPRE curtas, naturais e diretas (máximo 1 a 2 frases curtas por resposta).
   - Ninguém lê blocos longos de texto no WhatsApp! É terminantemente proibido enviar listas com 4, 5 ou 6 parágrafos explicativos em texto.
   - SE FOR EXPLICAR ALGO LONGO OU DETALHADO, FAÇA EM ÁUDIO [AUDIO: ...]! O áudio gera 10x mais conexão, autoridade e conversão.
2. DIÁLOGO DINÂMICO (NUNCA MONÓLOGO):
   - Não tente falar tudo de uma vez. Nunca cuspa explicação + preço + chave PIX + arquivo na mesma mensagem se o cliente apenas pediu uma explicação!
   - Se o cliente perguntou "como funciona" ou "pode me explicar", explique no áudio [AUDIO: ...], mande 1 frase em texto e termine perguntando algo sobre ele (ex: "Você mesmo que vai fazer as receitas ou é pra alguém da sua família?").
   - Espere o cliente interagir para então fazer o pitch e enviar o PIX!
${audioStrategySection}
${deliverableStrategySection}
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
  async callModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1000) {
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
      timeout: 35000 // 35s timeout
    });

    if (response.data && response.data.choices && response.data.choices[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }

    if (response.data?.choices?.[0]?.message?.reasoning_content) {
      return response.data.choices[0].message.reasoning_content.trim();
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
    let modelUsed = settings.primaryModel || 'deepseek-ai/deepseek-v4.1-flash';

    // 1. Try Primary NVIDIA NIM Model
    try {
      const primaryKey = settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (primaryKey) {
        responseText = await this.callModel(
          settings.primaryModel || 'deepseek-ai/deepseek-v4.1-flash',
          primaryKey,
          messages,
          settings.temperature ?? 0.7,
          settings.maxTokens || 1000
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
        `NVIDIA NIM Primário (${settings.primaryModel}) falhou: ${primaryErr.message}. Ativando Fallback para (${settings.fallbackModel || 'deepseek-ai/deepseek-v4.1-flash'}).`
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
      const fallbackModel = settings.fallbackModel || 'deepseek-ai/deepseek-v4.1-flash';
      if (fallbackKey && fallbackModel) {
        modelUsed = fallbackModel;
        responseText = await this.callModel(
          fallbackModel,
          fallbackKey,
          messages,
          settings.temperature ?? 0.7,
          settings.maxTokens || 1000
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

    return `Olá! Que bom falar com você! 😊\n\nSou do time de atendimento do ${product.name}. Vi que você se interessou pelo nosso método prático de renda com IA.\n\nMe conta: você já tem alguma experiência ou está começando do absoluto zero?`;
  }

  // Generate spoken remarketing script tailored dynamically to the lead's exact conversation history
  async generateRemarketingSpeech(instruction, lead, product, conversationHistory = []) {
    const settings = storage.getSettings().ai;
    const leadFirstName = (lead.name || '').split(' ')[0] || '';
    const cleanLeadName = /^[0-9+() -]+$/.test(leadFirstName) ? '' : leadFirstName;

    // Build context from recent messages so the audio is 100% personalized to what they actually discussed
    const recentMessages = (conversationHistory || []).slice(-8).map(m => {
      const sender = m.fromMe ? 'Atendente' : (cleanLeadName || 'Cliente');
      return `${sender}: ${m.text || '[mídia/áudio]'}`;
    }).join('\n');

    const systemPrompt = `Você é um atendente humanizado brasileiro enviando uma mensagem de voz curta e espontânea (áudio WhatsApp) para reengajar um cliente que parou de responder.
Seu objetivo é analisar o histórico da conversa recente e falar um áudio 100% sob medida para essa pessoa, soando totalmente natural, acolhedor e pessoal.

Regras Obrigatórias:
1. Responda APENAS com o texto exato que será falado em voz alta no áudio (sem aspas, sem [AUDIO:], sem emojis, sem links, sem asteriscos).
2. Conecte de forma sutil com o que foi conversado anteriormente (se o cliente mencionou uma dor, dúvida, se pediu PIX, se queria desconto, etc.).
3. O tom deve ser ultra-natural, brasileiro, empático e direto (entre 1 e 3 frases curtas no máximo, ideal para um áudio de WhatsApp de 10 a 18 segundos).
4. Cumprimente pelo primeiro nome (${cleanLeadName || 'Oi, tudo bem?'}) se souber.
5. Contexto do Produto: "${product.name || 'nosso produto'}", Preço R$ ${Number(product.price || 0).toFixed(2)}.`;

    const userPrompt = `Histórico recente da conversa com este cliente:
${recentMessages || 'Nenhum histórico recente.'}

Instrução desta etapa de recuperação: ${instruction}
Nome do lead: ${cleanLeadName || 'amigo(a)'}

Gere agora o texto exato falado para ser gravado em áudio sob medida para este lead:`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    // Try Primary NVIDIA NIM Model
    try {
      const primaryKey = settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (primaryKey) {
        const generated = await this.callModel(
          settings.primaryModel || 'deepseek-ai/deepseek-v4.1-flash',
          primaryKey,
          messages,
          0.7,
          600
        );
        if (generated && generated.length > 5) {
          return generated.replace(/["'“”«»]/g, '').trim();
        }
      }
    } catch (e) {
      console.warn('[NVIDIA NIM Remarketing Primary Error]:', e.message);
    }

    // Fallback NVIDIA NIM Model
    try {
      const fallbackKey = settings.fallbackApiKey || process.env.NVIDIA_NIM_FALLBACK_API_KEY || settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (fallbackKey) {
        const generated = await this.callModel(
          settings.fallbackModel || 'deepseek-ai/deepseek-v4.1-flash',
          fallbackKey,
          messages,
          0.7,
          600
        );
        if (generated && generated.length > 5) {
          return generated.replace(/["'“”«»]/g, '').trim();
        }
      }
    } catch (e2) {
      console.warn('[NVIDIA NIM Remarketing Fallback Error]:', e2.message);
    }

    return null;
  }
}

export const nvidiaNim = new NvidiaNimService();
