import axios from 'axios';
import { storage } from './storage.js';

class NvidiaNimService {
  constructor() {
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    this.lastPrimaryFailureTime = 0;
    this.primaryCooldownMs = 0; // Disabled: primary model is always attempted
  }

  // Construct sales-focused prompt with product context, deliverables, and behavioral rules
  buildSystemPrompt(contextDirective = '') {
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
      deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: ENTREGAR ANTES E CONVERSÃO CONSULTIVA (LIBERDADE E AUTONOMIA TOTAL)
   - VOCÊ TEM TOTAL AUTONOMIA PARA DIALOGAR, OUVIR E ENTENDER O CLIENTE:
     * Não aja como um robô que segue um roteiro fixo ou que força a venda a qualquer custo. Converse de verdade com o lead!
     * Ouça com atenção o que ele disser (idade da criança, dores, dificuldades, rotina) e responda com genuíno interesse, empatia e carinho.
   - ENTREGA GENEROSA DOS MATERIAIS COMPLETOS:
     * Você pode liberar o pacote completo com todas as atividades e PDFs logo que fizer sentido na conversa (quando ele demonstrar interesse, perguntar sobre o material, contar sobre a criança ou pedir para ver), usando as tags:
       ${allDelivTags || '[ENVIAR_ARQUIVO: PRODUTO]'}
     * Diga com entusiasmo e carinho que já separou e está entregando tudo para ele já poder olhar e aplicar com a criança hoje mesmo.
     * NUNCA chame de "amostra" e NUNCA diga "vou liberar o resto depois". Entregamos o pacote completo de uma vez só!
   - PITCH ADAPTADO E FECHAMENTO HUMANIZADO:
     * NUNCA faça chantagem emocional, não force a barra e não use frases apelativas de culpa. Respeite o lead como um ser humano inteligente!
     * Crie um pitch personalizado e adaptado para a situação que o cliente te contou (ex: adaptado à idade do filho dele, à dificuldade escolar que ele mencionou, aos objetivos que ele tem).
     * Explique que para cobrir os custos e manter vivo esse projeto de criação contínua de atividades, pedimos uma contribuição simbólica de apenas R$ ${formattedPrice}.
     * Quando for a hora oportuna do fechamento, apresente a chave PIX de forma clara e limpa no texto:
       Chave PIX (${product.pixKeyType || 'Chave'}): ${product.pixKey || '88994892385'}
       Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
       Valor: R$ ${formattedPrice}
     * Use áudios de voz [AUDIO: ...] com tom afetuoso, humano e pausado para se conectar com o lead e fazer o convite à contribuição.`;
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

=== LIBERDADE CONVERSACIONAL E AUTONOMIA TOTAL ===
- Você NÃO é um robô de respostas pré-programadas e NÃO deve seguir roteiros rígidos.
- Tenha autonomia total para desenrolar o diálogo, entender o momento do lead, responder às perguntas reais que ele fizer e criar um relacionamento genuíno.
- Cada cliente é único: adapte suas respostas e seu pitch de acordo com o que o cliente compartilhar com você!

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
2. DIÁLOGO DINÂMICO E CONSULTIVO:
   - Responda primeiro ao que o cliente perguntou ou comentou. Nunca ignore a dúvida dele para empurrar um roteiro!
   - Se o cliente perguntou "como funciona" ou "pode me explicar", responda e explique (em áudio [AUDIO: ...] se for mais longo), mande 1 frase em texto e faça uma pergunta de interesse para conhecê-lo melhor.
   - Quando for o momento certo, entregue os materiais e faça o pitch adaptado à realidade dele!

=== EXEMPLOS DO FORMATO ESPERADO (ÁUDIO COMPLETO + TEXTO CURTO) ===

Exemplo 1 (Primeiro contato do lead querendo saber mais):
Olá! Que alegria falar com você! Te gravei um áudio explicando rapidinho com muito carinho 👇

[AUDIO: Oi! Tudo bem?
Que bom falar com você!
Nosso material foi feito com todo carinho para as crianças aprenderem inglês brincando...
São atividades bem ilustradas e práticas, que o pequeno nem percebe que está estudando!
Qual a idade do seu pequeno(a)?]

Qual a idade do seu pequeno(a)? 😊

Exemplo 2 (Apresentação dos materiais e Pitch Adaptado com PIX):
Olha, já separei e te mandei o pacote completo aqui em cima para você ver como é lindo! Dá uma olhadinha 👇

[ENVIAR_ARQUIVO: ATIVIDADES_INGLES]

Para ajudar a manter esse projeto de pé e continuarmos criando novos materiais, a gente pede uma contribuição simbólica de apenas R$ ${Number(product.price || 15).toFixed(2).replace('.', ',')}. Vou deixar a chave PIX aqui:

Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}
Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
Valor: R$ ${Number(product.price || 15).toFixed(2).replace('.', ',')}

[AUDIO: Oi! Tudo bem?
Olha, já te mandei todo o material aqui em cima com muito carinho...
Dá uma olhadinha com calma nas atividades...
Tenho certeza que o seu pequeno vai se divertir muito aprendendo!
Se puder nos ajudar com essa contribuição simbólica, agradeço de coração!]

${audioStrategySection}
${deliverableStrategySection}
5. FECHAMENTO E COBRANÇA:
   ${paymentMethod === 'pix' 
      ? 'Apresente a chave PIX destacada, informe o valor oficial e solicite o comprovante aqui na conversa para liberação do acesso.'
      : paymentMethod === 'both'
      ? 'Dê as duas alternativas: envie a chave PIX para quem prefere PIX à vista, e o link de checkout para quem deseja parcelar no cartão.'
      : 'Envie o link oficial de checkout e instrua os passos para pagamento.'}

${contextDirective ? `\n=== CONTEXTO E DIRETRIZES DO MOMENTO ATUAL ===\n${contextDirective}\n` : ''}
${settings.ai.customPromptInstructions ? `\n=== INSTRUÇÕES ADICIONAIS DO USUÁRIO ===\n${settings.ai.customPromptInstructions}` : ''}
`;
  }

  // Anti-Leak & Meta-Commentary Sanitizer: Guarantees zero system instructions, CoT or developer notes leak to WhatsApp
  sanitizeModelOutput(rawText) {
    if (!rawText || typeof rawText !== 'string') return '';
    let content = rawText.trim();

    // 1. Strip think / reasoning blocks
    content = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    content = content.replace(/```(?:thought|thinking)[\s\S]*?```/gi, '').trim();
    content = content.replace(/^(?:thought|thinking):\s*[\s\S]*?\n\n/gi, '').trim();
    content = content.replace(/^Here's a thinking process:[\s\S]*?(?:\n\n|\n[A-Z0-9#*-])/i, '').trim();
    content = content.replace(/^Here's a thinking process:[\s\S]*/i, '').trim();

    // 2. Strip English Chain-of-Thought / Prompt Analysis (e.g. reasoning leaks from Nemotron)
    if (/^(?:The user wants|The user is asking|\*\*Analysis of the Request:\*\*|Analysis of the Request:|Let's analyze the request|Looking at the prompt|My Task:|The user provided)/i.test(content)) {
      const messageBlockMatch = content.match(/(?:Message text:|The text block:?|Output:?|Template:?)\s*\n+([\s\S]+)$/i);
      if (messageBlockMatch) {
        content = messageBlockMatch[1].trim();
      } else {
        const portugueseStartMatch = content.match(/(?:[A-ZÀ-Ú][a-zà-ú]+[\s\S]*?\[AUDIO:[\s\S]*?\]|\[AUDIO:[\s\S]*?\])/i);
        if (portugueseStartMatch) {
          content = portugueseStartMatch[0].trim();
        }
      }
    }

    // 3. Strip AI assistant meta-commentary (talking to programmer/operator instead of the customer)
    content = content.replace(/^(?:Entendi(?:\s+perfeitamente)?|Com certeza|Claro que sim|Claro|Perfeito|Certo)[!,.]?\s*(?:Aqui está|Segue|Abaixo está|Veja|vou te mandar|essa é a resposta)[\s\S]*?:(?:\n+|\s+)/i, '').trim();
    content = content.replace(/^(?:Aqui está a resposta|Aqui está a mensagem|Segue a mensagem|Segue o texto que você deve enviar)[\s\S]*?:(?:\n+|\s+)/i, '').trim();
    content = content.replace(/\n+(?:Essa resposta segue rigorosamente|Espero que ajude|Qualquer dúvida estou à disposição|Se precisar de mais alguma coisa|Como posso te ajudar agora\?|Já tem algum lead aguardando)[\s\S]*?$/i, '').trim();

    // 4. Strip any leaked internal prompt headers, tags or rules
    content = content.replace(/\[\s*(?:DIRETRIZ|FASE|REGRA|INSTRUÇÃO|ATENÇÃO|ESTRUTURA|COMO RESPONDER|CONTEXTO|SITUAÇÃO)[^\]]*\]:?/gi, '').trim();
    content = content.replace(/^[-•◆*]?\s*(?:DIRETRIZ DE FUNIL|OFERTA INVERTIDA|FECHAMENTO EMOCIONAL|LIBERAÇÃO DE TUDO|CONEXÃO INICIAL|DIRETRIZ MÁXIMA|INSTRUÇÃO DO MOMENTO|SITUAÇÃO ATUAL)[\s\S]*?(?:\n|$)/gmi, '').trim();
    content = content.replace(/^O cliente JÁ RECEBEU TUDO[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^NUNCA diga ["'“]amostra["'”]?[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^NUNCA diga [*_]?libero o restante[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^REGRA (?:CRÍTICA|SUPREMA|ABSOLUTA):[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^ATENÇÃO (?:MÁXIMA|SUPREMA|ABSOLUTA):[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^Sua mensagem DEVE seguir rigorosamente esta estrutura:?[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^ESTRUTURA OBRIGATÓRIA DA SUA RESPOSTA:?[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^Como agir conforme a análise:?[^\n]*\n?/gmi, '').trim();

    return content.trim();
  }

  // Call single NIM model with configurable timeout (default 180s = 3 minutes)
  async callModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 180000) {
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
      const content = this.sanitizeModelOutput(response.data.choices[0].message.content);
      if (content.length > 0) {
        return content;
      }
    }

    // NEVER return reasoning_content or internal thinking to WhatsApp!
    throw new Error('Modelo retornou conteúdo vazio ou apenas tokens de raciocínio interno.');
  }

  // Call OpenRouter tertiary fallback model (e.g. nvidia/nemotron-3.5-lightning:free)
  async callOpenRouterModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 45000) {
    if (!apiKey) {
      throw new Error(`OpenRouter API Key não configurada para o modelo ${model}`);
    }

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: 0.95,
      reasoning: { max_tokens: 0 } // Disable reasoning tokens so raw CoT is not dumped as plain text
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
      const content = this.sanitizeModelOutput(choice.message.content || '');
      if (content.length > 0) {
        return content;
      }
    }

    throw new Error('Modelo OpenRouter retornou conteúdo vazio ou apenas tokens de raciocínio interno.');
  }

  // Generate sales response with automatic primary -> secondary fallback
  async generateResponse(phone, userMessage, conversationHistory = []) {
    const settings = storage.getSettings().ai;

    // Contextual Phase Calculation for Deliver-First and Receipt Analysis
    const leadObj = storage.getLead(phone);
    const product = storage.getSettings().product || {};
    const deliverables = storage.getDeliverables();
    const deliveryStrategy = product.deliveryStrategy || 'require_payment';

    const isReceiptAnalysis = (userMessage || '').includes('[COMPROVANTE DE PAGAMENTO ANALISADO]');
    const formattedPrice = Number(product.price || 15).toFixed(2).replace('.', ',');
    const allDelivTags = deliverables.length > 0
      ? deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ')
      : '[ENVIAR_ARQUIVO: PRODUTO]';

    let contextDirective = '';

    if (deliveryStrategy === 'deliver_first') {
      const messagesHistory = conversationHistory || [];
      const userIncomingMsgs = messagesHistory.filter(m => !m.fromMe);
      const hasSentBefore = messagesHistory.some(m => m.fromMe && m.text && m.text.includes('📎 [Enviado]:'));
      const isUserAskingPix = /pix|pagar|pago|chave|valor|quanto custa|conta|manda.*pix|envia.*pix|passa.*pix|manda.*chave/i.test(userMessage || '');
      const hasSentDeliverable = leadObj?.deliverableSent === true || leadObj?.stage === 'ENTREGUE' || leadObj?.stage === 'PIX_ENVIADO' || hasSentBefore;
      const isPaid = leadObj?.stage === 'APROVADO' || leadObj?.lastReceiptStatus === 'APROVADO';

      const hasAlreadySentPixInHistory = messagesHistory.some((m) => m.fromMe && m.text && (
        (product.pixKey && m.text.includes(product.pixKey)) ||
        m.text.includes('Chave PIX') ||
        m.text.includes('Copiar Chave PIX')
      ));
      const hasPixBeenSent = hasAlreadySentPixInHistory || leadObj?.stage === 'PIX_ENVIADO';

      const lowerUserMsg = (userMessage || '').toLowerCase();
      const isUserClaimingPaid = /já fiz|ja fiz|já paguei|ja paguei|fiz aqui|acabei de fazer|já transferi|ja transferi|mandei o pix|mandei o comprovante|pago|paguei|ta pago|tá pago|transferi/i.test(lowerUserMsg);
      const isUserAskingIfTheseAreTheFiles = /achei q eram esses|achei que eram esses|são esses|sao esses|é esse|é essa|são essas|pode mandar|manda pfv|manda por favor|vai mandar/i.test(lowerUserMsg);

      if (isReceiptAnalysis) {
        const isApprovedReceipt = userMessage.includes('Status: APROVADO');
        const isAgendadoReceipt = userMessage.includes('Status: AGENDADO');

        if (isApprovedReceipt) {
          contextDirective = `SITUAÇÃO: O cliente enviou o comprovante de pagamento e o PIX foi 100% APROVADO e confirmado!
- Agradeça com imensa gratidão, carinho e entusiasmo pela contribuição de R$ ${formattedPrice}!
- Se o cliente já recebeu os arquivos, confirme com alegria que ele já está com tudo em mãos para aproveitar com o pequeno.
- Coloque um [AUDIO: ...] doce e carinhoso agradecendo de coração pela ajuda e desejando momentos maravilhosos para a família!`;
        } else if (isAgendadoReceipt) {
          contextDirective = `SITUAÇÃO: O cliente enviou um comprovante, mas ele foi identificado como AGENDAMENTO (o valor ainda não foi debitado).
- Explique com muita delicadeza, carinho e gentileza que no app do banco a operação ficou programada como um agendamento futuro.
- Peça com simpatia para ele entrar no aplicativo do banco, cancelar o agendamento e fazer a transferência imediata na hora para concluir a contribuição de R$ ${formattedPrice}.
- Envie a Chave PIX oficial limpa (${product.pixKeyType || 'telefone'}: ${product.pixKey || '88994892385'} - ${product.pixBeneficiary || 'ian alves dos anjos'} - R$ ${formattedPrice}).
- Coloque um [AUDIO: ...] acolhedor e calmo explicando o agendamento sem constranger o cliente.`;
        } else {
          contextDirective = `SITUAÇÃO: O comprovante enviado pelo cliente apresentou divergência:
${userMessage}
- Explique com carinho e respeito a divergência e informe a chave oficial de contribuição.`;
        }
      } else if (isPaid) {
        contextDirective = `SITUAÇÃO: O cliente já realizou a contribuição e o pagamento está 100% CONFIRMADO e APROVADO!
Mensagem do cliente: "${userMessage}".
- O cliente já é um apoiador confirmado. Responda com carinho e atenção às dúvidas ou agradecimentos dele.
- Se ele perguntar dos materiais, confirme que são aqueles que você já enviou lá em cima e que ele já pode baixar e usar.
- Mantenha tom prestativo e amigável.`;
      } else if (isUserAskingPix) {
        contextDirective = `SITUAÇÃO: O cliente pediu o PIX diretamente ou perguntou como pagar ("${userMessage}").
- Agradeça a gentileza e confiança!
- Envie a Chave PIX oficial limpa no texto:
  Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}
  Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
  Valor: R$ ${formattedPrice}
- Peça para enviar o comprovante após a transferência.
- Coloque um [AUDIO: ...] curto agradecendo a ajuda e a confiança.`;
      } else if (isUserClaimingPaid) {
        contextDirective = `SITUAÇÃO: O cliente avisou que já realizou o pagamento ou PIX ("${userMessage}").
- Agradeça com muito carinho a contribuição!
- Peça com gentileza para ele enviar o comprovante aqui na conversa para você confirmar no sistema.`;
      } else if (isUserAskingIfTheseAreTheFiles) {
        contextDirective = `SITUAÇÃO: O cliente está em dúvida se os materiais enviados anteriormente lá em cima são os definitivos ("${userMessage}").
- Esclareça com total carinho, clareza e segurança: Sim! São exatamente aqueles arquivos e apostilas em PDF que você já enviou!
- Explique que todo o material já foi entregue para ele, já pode abrir, baixar e aplicar hoje mesmo.`;
      } else {
        // FLUXO CONVERSACIONAL COM LIBERDADE E AUTONOMIA TOTAL
        contextDirective = `SITUAÇÃO ATUAL DO ATENDIMENTO:
Mensagem do cliente: "${userMessage}".

STATUS DO FUNIL:
- Materiais enviados anteriormente? ${hasSentDeliverable ? 'SIM (já entregues)' : 'NÃO (ainda não foram enviados)'}
- Chave PIX enviada anteriormente? ${hasPixBeenSent ? 'SIM (já enviada)' : 'NÃO (ainda não enviada)'}

DIRETRIZES DE AUTONOMIA E CONVERSÃO:
1. RESPONDA PRIMEIRO AO CLIENTE: Não ignore o que o cliente disse! Se ele fez uma pergunta, tirou uma dúvida ou compartilhou algo sobre o filho/rotina, responda com atenção e carinho genuíno.
2. ENTREGA DE MATERIAIS (${hasSentDeliverable ? 'JÁ FEITA' : 'DISPONÍVEL'}):
${hasSentDeliverable 
  ? '   - Os materiais já foram enviados anteriormente. Não precisa enviar as tags de arquivo de novo, a não ser que o cliente peça.' 
  : `   - Você tem autonomia para liberar todos os materiais agora usando as tags: ${allDelivTags}. Se o cliente demonstrou interesse, pediu para ver, ou se o momento da conversa pede para mostrar valor prático, entregue os arquivos com entusiasmo!`}
3. PITCH E FECHAMENTO (${hasPixBeenSent ? 'PIX JÁ ENVIADO' : 'MOMENTO DO PITCH'}):
${hasPixBeenSent 
  ? '   - A chave PIX já foi enviada anteriormente. NÃO force a barra nem fique cobrando repetidamente. Dê espaço, responda eventuais dúvidas com gentileza e só reenvie a chave PIX se o cliente pedir.' 
  : `   - Quando você sentir que o momento é oportuno (ex: após entregar os materiais, responder as dúvidas dele ou quando ele elogiar/demonstrar encanto), faça o pitch adaptado à realidade que ele te contou e convide-o a apoiar o projeto com a contribuição simbólica de R$ ${formattedPrice} via PIX (Chave ${product.pixKeyType || 'telefone'}: ${product.pixKey || '88994892385'}).`}
4. TOM HUMANO: Fale como uma pessoa real no WhatsApp — acolhedora, espontânea, simpática e persuasiva, usando [AUDIO: ...] nos momentos de explicação, empatia ou pitch.`;
      }
    } else {
      // ESTRATÉGIA PADRÃO: require_payment / per_deliverable
      if (isReceiptAnalysis) {
        contextDirective = `SITUAÇÃO: O cliente enviou um comprovante de pagamento que foi inspecionado por visão computacional:
${userMessage}

Como agir conforme a análise:
- SE O STATUS FOR "AGENDADO":
  NÃO libere produtos nem confirme o pagamento! O dinheiro AINDA NÃO caiu na conta!
  Explique com carinho e gentileza que é um agendamento futuro e peça para cancelar no app do banco e fazer a transferência normal na hora para liberação imediata.
  Envie a Chave PIX oficial (${product.pixKeyType || 'telefone'}: ${product.pixKey || '88994892385'} - ${product.pixBeneficiary || 'ian alves dos anjos'} - R$ ${formattedPrice}).
  Coloque [AUDIO: ...] doce e compreensivo explicando o agendamento.
- SE O STATUS FOR "APROVADO":
  Comemore e agradeça de coração! Acione a liberação: ${allDelivTags}.
  Coloque [AUDIO: ...] caloroso de parabéns!
- SE FOR "VALOR_INCORRETO" OU "DESTINATARIO_INCORRETO":
  Explique com respeito a divergência e informe o valor/chave correto.`;
      }
    }

    const systemPrompt = this.buildSystemPrompt(contextDirective);

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

    // Add the current incoming message as the final message
    if (userMessage && (!recentHistory.length || recentHistory[recentHistory.length - 1].text !== userMessage)) {
      messages.push({ role: 'user', content: userMessage });
    }

    let responseText = null;
    let modelUsed = settings.primaryModel || 'z-ai/glm-5.3-flash';

    // 1. Try Primary NVIDIA NIM Model (timeout: 180s = 3 min)
    try {
      const primaryKey = settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (primaryKey) {
        responseText = await this.callModel(
          settings.primaryModel || 'z-ai/glm-5.3-flash',
          primaryKey,
          messages,
          settings.temperature ?? 0.7,
          settings.maxTokens || 1500,
          180000 // 180s (3 min) timeout before falling back to secondary model
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
        `NVIDIA NIM Primário (${settings.primaryModel || 'z-ai/glm-5.3-flash'}) não respondeu em 3 min (${primaryErr.message}). Ativando fallback secundário (${settings.fallbackModel || 'google/diffusiongemma-26b-a4b-it'}).`
      );
      storage.updateSettings({
        ai: {
          isFallbackActive: true,
          lastFallbackReason: primaryErr.message
        }
      });
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
          60000 // 60s fallback timeout
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
          45000 // 45s timeout for OpenRouter
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
        return `Fico muito feliz que tenha gostado! ❤️ Fiz questão de te mandar o material completo para você já ver o quanto vai ajudar no desenvolvimento dele!\n\nPara manter nosso projeto vivo e continuarmos criando novos materiais, a gente pede uma contribuição simbólica de apenas R$ ${formattedPrice}.\n\nChave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}\nNome: ${product.pixBeneficiary || 'ian alves dos anjos'}\nValor: R$ ${formattedPrice}\n\n[AUDIO: Oi!... Te mandei as atividades completas com muito carinho... Dá uma olhadinha na chave PIX e quando fizer me manda o comprovante aqui tá bom? Um abraço grande!]`;
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
          60000 // 60s (1 min) timeout
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
