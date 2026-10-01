import axios from 'axios';
import { storage } from './storage.js';

class NvidiaNimService {
  constructor() {
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    this.lastPrimaryFailureTime = 0;
    this.primaryCooldownMs = 600000; // 10 minutes circuit breaker cooldown
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
      const allDelivTags = deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ');
      const formattedPrice = Number(product.price || 15).toFixed(2).replace('.', ',');
      deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: ENTREGAR TUDO ANTES E COBRAR DEPOIS (OFERTA INVERTIDA)
   - NESTA OPERAÇÃO A ORDEM É 100% INVERTIDA: NÓS ENTREGAMOS TUDO, TUDO MESMO DE UMA VEZ SÓ!
   - REGRA SUPREMA: NUNCA DIGA "amostra" E NUNCA DIGA "vou te entregar o resto depois de pagar" OU "libero o restante após o pagamento"!
   - Não existe "resto para depois". Você já entrega o pacote completo com TODOS os materiais, atividades e PDFs de uma vez só!
   - REGRA 1 - LIBERAÇÃO DE TUDO IMEDIATAMENTE:
     * Assim que o lead mandar mensagem, responder ou demonstrar interesse/dúvida/dor, entregue TODOS os materiais agora mesmo com as tags:
       ${allDelivTags || '[ENVIAR_ARQUIVO: PRODUTO]'}
     * Diga com entusiasmo e carinho: "Olha, para te ajudar de verdade e você ver o quanto esse material é maravilhoso, eu já estou te entregando TUDO aqui agora! O pacote completo com todas as atividades e PDFs para o seu filho começar! Dá uma olhadinha 👇"
   - REGRA 2 - FECHAMENTO EMOCIONAL COM PIX DIRETO (SEM PEDIR PERMISSÃO):
     * Assim que os materiais forem entregues (ou quando o lead reagir/elogiar/agradecer):
     * NUNCA pergunte se ele quer a chave PIX! NUNCA peça autorização!
     * FAÇA O JOGO EMOCIONAL DE CONFIANÇA TOTAL:
       "Eu confiei em você de olhos fechados e já te entreguei TUDO de uma vez só antes mesmo de você pagar! Fiz isso de coração aberto porque vi o quanto você se preocupa e quer o melhor para o seu filho... ❤️
       Agora estou aqui de coração te pedindo pra fazer a sua parte e me ajudar com esse valor simbólico de apenas R$ ${formattedPrice}, que é o que mantém nosso projeto vivo. Segue a chave PIX para você fazer com calma no app do seu banco 👇"
     * Envie a chave PIX destacada e limpa para cópia:
       Chave PIX (${product.pixKeyType || 'Chave'}): ${product.pixKey || '88994892385'}
       Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
       Valor: R$ ${formattedPrice}
     * Coloque no final da mensagem um áudio [AUDIO: ...] afetuoso, humano e pausado com reticências (...) e quebras de linha naturais (sem nenhuma tag entre colchetes) reforçando a confiança e pedindo a contribuição.`;
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
      - JUNTO com o texto do PIX, envie um áudio curto e emotivo de 10 a 15 segundos reforçando a confiança e o pedido de contribuição.
   f) Espelhamento: Se o cliente mandar um áudio ou pedir áudio, SEMPRE responda com [AUDIO: ...] também!

   REGRAS OBRIGATÓRIAS DO ÁUDIO:
   - Formato rigoroso: [AUDIO: texto falado aqui] (dois pontos DENTRO dos colchetes, sem aspas, feche sempre com ']').
   - NUNCA escreva [Áudio]: "..." com dois pontos fora do colchete nem com aspas! Escreva sempre [AUDIO: texto falado].
   - NUNCA coloque emojis de música ou microfone (como 🎵, 🎶, 🎙️) sozinhos no texto escrito!
   - RITMO HUMANO, PAUSADO E QUEBRAS DE LINHA (FISH AUDIO):
     * O motor Fish Audio identifica e respeita automaticamente as quebras de linha (\n) e reticências (...) como pausas naturais de respiração humana!
     * É TERMINANTEMENTE PROIBIDO usar marcadores de emoção ou colchetes dentro do áudio (como [warm and calm], [empathetic], [moved], [grateful], [happy], [break], [long-break]). Escreva o texto falado de forma 100% limpa, pura e natural!
     * Para criar pausas naturais e uma fala calma, tranquila e pausada, quebre as frases em linhas separadas:
       [AUDIO: Oi! Tudo bem?
       Que bom falar com você!
       Olha... nosso material foi feito com todo amor e carinho para o seu filho...
       Dá uma olhadinha com calma no que te mandei, tá bom?]
   - DURAÇÃO E COMPLETUDE: A fala no áudio deve ter entre 2 e 4 frases completas (duração ideal de 15 a 25 segundos). NUNCA faça áudios telegráficos de 1 frase que soem cortados no meio! Desenvolva a ideia com carinho e termine a frase perfeitamente.
   - SEMPRE envie texto antes ou depois do [AUDIO: ...] anunciando o áudio e fazendo uma pergunta ou instrução direta para o cliente! O sistema enviará o texto E o áudio juntos.`;
      } else if (autoAudioMode === 'frequent_audio') {
        audioStrategySection = `3. ESTRATÉGIA ATIVA DE ÁUDIO (MODO FREQUENTE - 80%+ EM ÁUDIO):
   O cliente prefere atendimento quase 100% em áudio de voz!
   Quase todas as suas respostas devem conter a tag [AUDIO: texto falado], especialmente qualquer explicação de receitas, produtos ou dúvidas!
   A fala no áudio deve ser completa (2 a 4 frases, 15 a 25 segundos) com pausas naturais e reticências (...).
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
=== EXEMPLOS DO FORMATO EXATO ESPERADO (ÁUDIO COMPLETO + TEXTO CURTO) ===

Exemplo 1 (Quando o lead pede para explicar ou saber mais):
Claro! Te gravei um áudio explicando tudo com muito carinho 👇

[AUDIO: Oi! Tudo bem?
Que bom falar com você!
Então... nosso material foi feito com todo carinho para as crianças aprenderem inglês brincando...
São atividades bem ilustradas e práticas, que o seu filho nem percebe que está estudando!]

Você mesmo que vai acompanhar as atividades ou é pra alguém da sua família? 😊

Exemplo 2 (Fechamento Emocional com PIX após envio de TODOS os materiais):
Eu confiei em você de olhos fechados e já te entreguei todo o material completo antes mesmo de você pagar! Fiz isso de coração porque sei o quanto isso é importante pro futuro do seu filho... ❤️ Agora estou aqui de coração aberto te pedindo pra fazer a sua parte com essa contribuição simbólica de apenas R$ ${Number(product.price || 15).toFixed(2).replace('.', ',')}, que é o que mantém nosso trabalho de pé!

Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}
Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
Valor: R$ ${Number(product.price || 15).toFixed(2).replace('.', ',')}

[AUDIO: Olha...
eu fiz questão de te liberar todo o material antes...
porque confiei de verdade em você...
agora tô aqui de coração aberto te pedindo essa ajuda pra manter o projeto...
Pode fazer com calma no app do seu banco e me manda o comprovante aqui, tá bom?]

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

  // Call single NIM model with configurable timeout
  async callModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 12000) {
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
      timeout: timeoutMs
    });

    if (response.data && response.data.choices && response.data.choices[0]?.message?.content) {
      let content = response.data.choices[0].message.content.trim();
      // Anti-Leak: Strip any <think> tags, reasoning blocks or chain-of-thought headers
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      content = content.replace(/```(?:thought|thinking)[\s\S]*?```/gi, '').trim();
      content = content.replace(/^(?:thought|thinking):\s*[\s\S]*?\n\n/gi, '').trim();
      content = content.replace(/^Here's a thinking process:[\s\S]*?(?:\n\n|\n[A-Z0-9#*-])/i, '').trim();
      content = content.replace(/^Here's a thinking process:[\s\S]*/i, '').trim();

      if (content.length > 0) {
        return content;
      }
    }

    // NEVER return reasoning_content or internal thinking to WhatsApp!
    throw new Error('Modelo retornou conteúdo vazio ou apenas tokens de raciocínio interno.');
  }

  // Call OpenRouter tertiary fallback model (e.g. nvidia/nemotron-3.5-lightning:free)
  async callOpenRouterModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 18000) {
    if (!apiKey) {
      throw new Error(`OpenRouter API Key não configurada para o modelo ${model}`);
    }

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.95
    };

    const response = await axios.post(this.openRouterEndpoint, payload, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://zapix.ai',
        'X-Title': 'Zapix AI'
      },
      timeout: timeoutMs
    });

    if (response.data && response.data.choices && response.data.choices[0]?.message) {
      const choice = response.data.choices[0];
      let content = (choice.message.content || '').trim();

      // Anti-Leak: Strip any <think> tags, reasoning blocks or chain-of-thought headers
      content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      content = content.replace(/```(?:thought|thinking)[\s\S]*?```/gi, '').trim();
      content = content.replace(/^(?:thought|thinking):\s*[\s\S]*?\n\n/gi, '').trim();
      content = content.replace(/^Here's a thinking process:[\s\S]*?(?:\n\n|\n[A-Z0-9#*-])/i, '').trim();
      content = content.replace(/^Here's a thinking process:[\s\S]*/i, '').trim();

      if (content.length > 0) {
        return content;
      }
    }

    throw new Error('Modelo OpenRouter retornou conteúdo vazio ou apenas tokens de raciocínio interno.');
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

    // Contextual Phase Injection for Deliver-First Funnel
    const leadObj = storage.getLead(phone);
    const product = storage.getSettings().product || {};
    const deliverables = storage.getDeliverables();
    const deliveryStrategy = product.deliveryStrategy || 'require_payment';

    if (deliveryStrategy === 'deliver_first') {
      const messagesHistory = conversationHistory || [];
      const hasSentBefore = messagesHistory.some(m => m.fromMe && m.text && m.text.includes('📎 [Enviado]:'));
      const isUserAskingPix = /pix|pagar|pago|chave|valor|conta|manda.*pix|envia.*pix|passa.*pix|manda.*chave/i.test(userMessage || '');
      const hasSentDeliverable = leadObj?.deliverableSent === true || hasSentBefore || isUserAskingPix;
      const isPaid = leadObj?.stage === 'APROVADO' || leadObj?.lastReceiptStatus === 'APROVADO';
      const allDelivTags = deliverables.length > 0
        ? deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ')
        : '[ENVIAR_ARQUIVO: PRODUTO]';
      const formattedPrice = Number(product.price || 15).toFixed(2).replace('.', ',');

      if (isUserAskingPix) {
        messages.push({
          role: 'system',
          content: `[DIRETRIZ DE FECHAMENTO URGENTE - O CLIENTE PEDIU O PIX]:
O cliente está pedindo o PIX diretamente para pagar ("${userMessage}")!
REGRA ABSOLUTA: NÃO enrole, NÃO pergunte se ele quer o PIX e NÃO tente reenviar arquivos! Envie o PIX agora mesmo!
Estrutura OBRIGATÓRIA da sua resposta:
1. Uma frase curta e muito carinhosa agradecendo a ajuda e a confiança no projeto.
2. O bloco oficial da Chave PIX destacado e limpo para cópia:
Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}
Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
Valor: R$ ${formattedPrice}
3. Instrução para enviar o comprovante: "Assim que você fizer, me envia o comprovante aqui tá bom? ❤️"
4. [AUDIO: Muito obrigada mesmo pelo carinho e pela ajuda...
O PIX tá certinho aí no texto pra você...
faz com calma no app do seu banco e me manda o comprovante aqui tá bom?]`
        });
      } else if (!hasSentDeliverable) {
        messages.push({
          role: 'system',
          content: `[DIRETRIZ DE FUNIL - OFERTA INVERTIDA - FASE 1: LIBERAÇÃO DE TUDO DE UMA VEZ]:
Nesta operação a ordem é 100% invertida: NÓS ENTREGAMOS TUDO, TUDO MESMO DE UMA VEZ SÓ ANTES DE COBRAR!
É TERMINANTEMENTE PROIBIDO falar "amostra" ou dizer "vou te entregar o resto depois de pagar" / "libero o restante depois"! Não existe amostra nem nada para depois.
Você AINDA NÃO enviou os materiais para este lead!
LIBERE TODOS OS MATERIAIS AGORA MESMO com as tags:
${allDelivTags}
Diga com carinho e entusiasmo que você já está entregando todo o material completo com todas as atividades e PDFs para ele aproveitar com o filho agora mesmo!
NUNCA escreva os nomes das tags ou colchetes no texto visível para o cliente.`
        });
      } else if (!isPaid) {
        messages.push({
          role: 'system',
          content: `[DIRETRIZ DE FUNIL - OFERTA INVERTIDA - FASE 2: FECHAMENTO EMOCIONAL E ENVIO DO PIX]:
O cliente JÁ RECEBEU TUDO (todos os materiais e PDFs) antes de pagar!
NUNCA diga "amostra" e NUNCA diga "libero o restante após o pagamento", pois você JÁ ENTREGOU TUDO!
REGRA CRÍTICA: NÃO PERGUNTE SE ELE QUER A CHAVE PIX! NÃO PEÇA AUTORIZAÇÃO! ENVIE O PIX IMEDIATAMENTE NO TEXTO!
Você DEVE estruturar sua resposta exatamente assim:
1. Apelo emocional de confiança, reciprocidade e pedido de ajuda sincero:
   - Diga que confiou nele de olhos fechados e já entregou o material completo antes de qualquer pagamento, porque sentiu no coração que ele é uma pessoa do bem e quer o melhor para o futuro do filho.
   - Peça com carinho a contribuição simbólica de apenas R$ ${formattedPrice}, que é o que mantém o projeto vivo e de pé.
2. Bloco da Chave PIX destacado no texto, limpo e direto para cópia com 1 clique:
   Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}
   Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
   Valor: R$ ${formattedPrice}
3. No final, coloque um áudio emocionante com tom humano e pausado com reticências (...) e quebras de linha:
   [AUDIO: Olha...
   eu confiei de verdade em você e te entreguei tudo antes...
   agora tô aqui de coração te pedindo pra fazer a sua parte...
   faz com calma no app do seu banco e me manda o comprovante aqui, tá bom?]`
        });
      }
    }

    let responseText = null;
    let modelUsed = settings.primaryModel || 'z-ai/glm-5.3-flash';

    const isPrimaryInCooldown = (Date.now() - this.lastPrimaryFailureTime) < this.primaryCooldownMs;

    // 1. Try Primary NVIDIA NIM Model (if not in circuit breaker cooldown)
    if (!isPrimaryInCooldown) {
      try {
        const primaryKey = settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
        if (primaryKey) {
          responseText = await this.callModel(
            settings.primaryModel || 'z-ai/glm-5.3-flash',
            primaryKey,
            messages,
            settings.temperature ?? 0.7,
            settings.maxTokens || 1500,
            7000 // 7s primary timeout for rapid fallback
          );
          // Primary succeeded - reset cooldown and ensure fallback state is inactive
          this.lastPrimaryFailureTime = 0;
          if (settings.isFallbackActive) {
            storage.updateSettings({ ai: { isFallbackActive: false, lastFallbackReason: null } });
            storage.addLog('INFO', `Modelo Primário NVIDIA NIM (${modelUsed}) restabelecido com sucesso.`);
          }
          return { text: responseText, modelUsed, fallbackTriggered: false };
        }
      } catch (primaryErr) {
        this.lastPrimaryFailureTime = Date.now();
        console.warn(`[NVIDIA NIM Primary Error]: ${primaryErr.message}`);
        storage.addLog(
          'FALLBACK_TRIGGERED',
          `NVIDIA NIM Primário (${settings.primaryModel || 'z-ai/glm-5.3-flash'}) instável (${primaryErr.message}). Circuito de proteção ativado por 10 min: usando fallback (${settings.fallbackModel || 'google/diffusiongemma-26b-a4b-it'}).`
        );
        storage.updateSettings({
          ai: {
            isFallbackActive: true,
            lastFallbackReason: primaryErr.message
          }
        });
      }
    } else {
      console.log(`[NVIDIA NIM Circuit Breaker] Primário em cooldown temporário. Roteando direto para fallback rápido.`);
    }

    // 2. Try Fallback NVIDIA NIM Model (google/diffusiongemma-26b-a4b-it)
    try {
      const fallbackKey = settings.fallbackApiKey || process.env.NVIDIA_NIM_FALLBACK_API_KEY || settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      const fallbackModel = settings.fallbackModel || 'google/diffusiongemma-26b-a4b-it';
      if (fallbackKey && fallbackModel) {
        modelUsed = fallbackModel;
        responseText = await this.callModel(
          fallbackModel,
          fallbackKey,
          messages,
          settings.temperature ?? 0.7,
          settings.maxTokens || 1500,
          15000 // 15s fallback timeout
        );
        return { text: responseText, modelUsed, fallbackTriggered: true, fallbackTier: 'secondary_nvidia' };
      }
    } catch (fallbackErr) {
      console.error(`[NVIDIA NIM Fallback Error]: ${fallbackErr.message}`);
      storage.addLog(
        'WARNING',
        `NVIDIA NIM Secundário falhou (${fallbackErr.message}). Acionando 3º Fallback via OpenRouter (${settings.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free'}).`
      );
    }

    // 3. Try Tertiary Fallback: OpenRouter (nvidia/nemotron-3.5-lightning:free)
    try {
      const allSettings = storage.getSettings();
      const tertiaryKey = settings.tertiaryApiKey || process.env.OPENROUTER_API_KEY || allSettings.fishAudio?.apiKey || allSettings.vision?.apiKey;
      const tertiaryModel = settings.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free';
      if (tertiaryKey && tertiaryModel) {
        modelUsed = tertiaryModel;
        responseText = await this.callOpenRouterModel(
          tertiaryModel,
          tertiaryKey,
          messages,
          settings.temperature ?? 0.7,
          settings.maxTokens || 1500,
          18000 // 18s timeout for OpenRouter
        );
        storage.addLog(
          'FALLBACK_TRIGGERED',
          `Modelos NVIDIA NIM indisponíveis. Resposta atendida com sucesso pelo 3º Fallback OpenRouter (${tertiaryModel}).`
        );
        return { text: responseText, modelUsed, fallbackTriggered: true, fallbackTier: 'tertiary_openrouter' };
      }
    } catch (tertiaryErr) {
      console.error(`[OpenRouter Tertiary Fallback Error]: ${tertiaryErr.message}`);
      storage.addLog(
        'ERROR',
        `Todas as 3 IAs falharam (NVIDIA Primário, NVIDIA Secundário e OpenRouter ${settings.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free'}): ${tertiaryErr.message}`
      );
    }

    // 4. Smart Rule-Based Engine Backup (if all 3 AI models failed or offline)
    const backupReply = this.generateOfflineSmartReply(userMessage);
    return {
      text: backupReply,
      modelUsed: 'offline-sales-fallback',
      fallbackTriggered: true,
      fallbackTier: 'offline_rules'
    };
  }

  // Backup sales responses when no API keys are provided or offline
  generateOfflineSmartReply(userMessage = '') {
    const text = (userMessage || '').toLowerCase();
    const product = storage.getSettings().product || {};
    const deliverables = storage.getDeliverables();
    const allTags = deliverables.map((d) => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ');
    const formattedPrice = Number(product.price || 15).toFixed(2).replace('.', ',');

    if (product.deliveryStrategy === 'deliver_first') {
      if (
        text.includes('sim') ||
        text.includes('quero') ||
        text.includes('material') ||
        text.includes('pdf') ||
        text.includes('atividades') ||
        text.includes('como funciona')
      ) {
        return `${allTags || '[ENVIAR_ARQUIVO: PRODUTO]'}\nClaro! Estou te enviando o material completo agora mesmo com todas as atividades e PDFs para você já aproveitar com o seu filho! Dá uma olhadinha e depois me diz o que achou, tá bom? 😊`;
      }
      if (
        text.includes('lindo') ||
        text.includes('gostei') ||
        text.includes('maravilha') ||
        text.includes('obrigad') ||
        text.includes('adorei') ||
        text.includes('que lindo')
      ) {
        return `Fico muito feliz que tenha gostado! ❤️ Eu confiei em você de olhos fechados e já te entreguei tudo antes mesmo de você pagar, porque sei o quanto isso é importante para o futuro do seu filho...\n\nAgora estou aqui de coração te pedindo pra fazer a sua parte e me ajudar com essa contribuição simbólica de apenas R$ ${formattedPrice}, que é o que mantém nosso trabalho de pé!\n\nChave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}\nNome: ${product.pixBeneficiary || 'ian alves dos anjos'}\nValor: R$ ${formattedPrice}\n\n[AUDIO: Oi!... Fiz questão de te mandar todo o material antes... porque confiei de olhos fechados em você... Dá uma olhadinha na chave PIX que te mandei e assim que você fizer me envia o comprovante aqui tá bom? Um abraço grande!]`;
      }
    }

    if (text.includes('preço') || text.includes('quanto custa') || text.includes('valor')) {
      return `O investimento no ${product.name} está em condição especial hoje por apenas R$ ${formattedPrice}!\n\nVocê tem acesso completo a todo o passo a passo com garantia incondicional de ${product.guaranteeDays} dias.\n\nQuer garantir sua vaga com esse valor promocional agora? É só acessar: ${product.checkoutUrl}`;
    }

    if (text.includes('link') || text.includes('comprar') || text.includes('quero') || text.includes('pix')) {
      return `Maravilha! Você pode garantir seu acesso imediatamente pelo link oficial:\n👉 ${product.checkoutUrl}\n\nAssim que o pagamento for confirmado, você já recebe o acesso no seu e-mail e no WhatsApp! Se tiver qualquer dúvida durante o processo, só me avisar aqui.`;
    }

    if (text.includes('funciona') || text.includes('resultado') || text.includes('prova')) {
      return `[ENVIAR_IMAGEM: PROVA_SOCIAL]\nSim, funciona com certeza! Temos alunos de todas as idades aplicando o método passo a passo.\n\nDá uma olhada nesses resultados acima! O que você mais busca no momento com o método?`;
    }

    return `Olá! Que bom falar com você! 😊\n\nSou do time de atendimento do ${product.name}. Vi que você se interessou pelo nosso material.\n\nComo posso te ajudar hoje?`;
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
          settings.primaryModel || 'z-ai/glm-5.3-flash',
          primaryKey,
          messages,
          0.7,
          500,
          10000 // 10s timeout
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
          settings.fallbackModel || 'google/diffusiongemma-26b-a4b-it',
          fallbackKey,
          messages,
          0.7,
          500,
          12000 // 12s timeout
        );
        if (generated && generated.length > 5) {
          return generated.replace(/["'“”«»]/g, '').trim();
        }
      }
    } catch (e2) {
      console.warn('[NVIDIA NIM Remarketing Fallback Error]:', e2.message);
    }

    // Tertiary OpenRouter Model (nvidia/nemotron-3.5-lightning:free)
    try {
      const allSettings = storage.getSettings();
      const tertiaryKey = settings.tertiaryApiKey || process.env.OPENROUTER_API_KEY || allSettings.fishAudio?.apiKey || allSettings.vision?.apiKey;
      const tertiaryModel = settings.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free';
      if (tertiaryKey && tertiaryModel) {
        const generated = await this.callOpenRouterModel(
          tertiaryModel,
          tertiaryKey,
          messages,
          0.7,
          1200,
          15000 // 15s timeout
        );
        if (generated && generated.length > 5) {
          return generated.replace(/["'“”«»]/g, '').trim();
        }
      }
    } catch (e3) {
      console.warn('[OpenRouter Remarketing Tertiary Error]:', e3.message);
    }

    return null;
  }
}

export const nvidiaNim = new NvidiaNimService();
