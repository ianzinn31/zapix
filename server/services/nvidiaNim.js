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
    const product = settings.product || {};
    const deliverables = storage.getDeliverables();

    // 1. Dynamic System Variables (LatAm & Brazil Architecture)
    const targetCountry = product.targetCountry || 'Brasil';
    const isLatAm = targetCountry !== 'Brasil';
    const currencyCode = product.currencyCode || (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : targetCountry === 'Bolívia' ? 'BOB' : targetCountry === 'Paraguai' ? 'PYG' : targetCountry === 'Argentina' ? 'ARS' : 'BRL');
    const currencySymbol = product.currencySymbol || (currencyCode === 'BRL' ? 'R$' : currencyCode === 'BOB' ? 'Bs' : currencyCode === 'PYG' ? 'Gs' : '$');
    const ticketBasic = product.ticketBasic ?? product.price ?? 15;
    const ticketComplete = product.ticketComplete ?? (Number(ticketBasic) * 1.6).toFixed(0);
    const paymentMethodType = product.paymentMethodType || (targetCountry === 'México' ? 'XPag_AutoCode' : targetCountry === 'Colômbia' ? 'Nequi_BreB' : targetCountry === 'Bolívia' ? 'QR_Bolivia' : (targetCountry === 'Paraguai' || targetCountry === 'Argentina') ? 'Alias_Paraguay' : 'pix');
    const paymentInstructions = product.paymentInstructions || (targetCountry === 'México' ? 'Código de pago automático SPEI' : 'Pago directo con confirmación inmediata');
    const voiceAccentId = product.voiceAccentId || (targetCountry === 'México' ? 'es_MX_native_01' : targetCountry === 'Colômbia' ? 'es_CO_native_01' : targetCountry === 'Argentina' ? 'es_AR_native_01' : targetCountry === 'Bolívia' ? 'es_BO_native_01' : 'pt_BR_native_01');

    const deliverableList = deliverables
      .map((d) => `- ${d.name} (${d.type.toUpperCase()}) | Tag/Identificador: [${d.tag}] | Descrição: ${d.description}`)
      .join('\n');

    const objectionsList = (product.objections || [])
      .map((o) => `- Objeção "${o.trigger}": ${o.response}`)
      .join('\n');

    const painPointsList = (product.mainPainPoints || []).map((p) => `- ${p}`).join('\n');
    const benefitsList = (product.mainBenefits || []).map((b) => `- ${b}`).join('\n');

    const deliveryStrategy = product.deliveryStrategy || 'require_payment';
    const allDelivTags = deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ') || '[ENVIAR_ARQUIVO: PRODUTO]';

    const fishSettings = settings.fishAudio || {};
    const autoAudioMode = fishSettings.autoAudioMode || 'hybrid_high_conversion';
    const isAudioActive = fishSettings.enabled !== false;

    let audioStrategySection = '';
    if (isAudioActive) {
      if (isLatAm) {
        audioStrategySection = `REGLAS DE AUDIO (FISH AUDIO - ACENTO NATIVO ${targetCountry} [${voiceAccentId}]):
- Envíe la etiqueta [AUDIO: texto hablado aquí] frecuentemente para explicar, conectar o presentar la oferta.
- NO use corchetes ni etiquetas de emoción dentro del audio (como [warm], [break], etc.). Escriba el texto limpio.
- Use saltos de línea y puntos suspensivos (...) para crear pausas naturales de respiración.
- Duración recomendada: 15 a 25 segundos (2 a 4 oraciones completas).
- En el texto de WhatsApp, envíe solo 1 oración corta acompañando el audio (ej: "¡Te grabé un audio explicándote todo rapidito! 👆").`;
      } else {
        audioStrategySection = `3. ESTRATÉGIA ATIVA DE ÁUDIO (MODO HÍBRIDO DE ALTA CONVERSÃO - OBRIGATÓRIO):
Você DEVE mesclar ativamente mensagens de texto curtas e áudios de voz [AUDIO: ...] ao longo da conversa. Não espere o cliente pedir!
Envie a tag [AUDIO: fala do áudio aqui] com frequência nos momentos cruciais (explicações, acolhimento, quebra de objeções e pitch).
- Formato rigoroso: [AUDIO: texto falado aqui].
- NUNCA use marcadores de emoção ou colchetes dentro do áudio (como [warm], [empathetic], [break]). Escreva o texto falado 100% limpo e natural!
- Para criar pausas naturais, quebre as frases em linhas separadas e use reticências (...).
- Duração ideal: 15 a 25 segundos (2 a 4 frases completas).`;
      }
    } else {
      audioStrategySection = isLatAm ? 'El envío de audio está desactivado. Responda exclusivamente en texto.' : 'O envio de áudio está desativado. Responda exclusivamente em texto.';
    }

    let deliverableStrategySection = '';
    if (isLatAm) {
      if (deliveryStrategy === 'deliver_first') {
        deliverableStrategySection = `ESTRATEGIA CONSULTIVA DE ALTA CONVERSIÓN (ENTREGA PREVIA Y PITCH ADAPTADO):
- Tiene TOTAL AUTONOMÍA para dialogar, escuchar y responder las preguntas del lead antes de cobrar.
- Puede entregar el material completo usando las etiquetas: ${allDelivTags} en cuanto haga sentido en la conversación.
- NUNCA lo llame "muestra" y NUNCA diga que liberará el resto después. ¡Entregue el material completo!
- Adapte el pitch a lo que el cliente le contó y ofrezca la opción Básica (${currencySymbol} ${ticketBasic} ${currencyCode}) o Completa (${currencySymbol} ${ticketComplete} ${currencyCode}).`;
      } else {
        deliverableStrategySection = `ESTRATEGIA DE SEGURIDAD:
- Solo libere las etiquetas de producto ${allDelivTags} después de confirmar el pago aprobado del cliente.`;
      }
    } else {
      if (deliveryStrategy === 'deliver_first') {
        deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: ENTREGAR ANTES E CONVERSÃO CONSULTIVA (LIBERDADE E AUTONOMIA TOTAL)
- VOCÊ TEM TOTAL AUTONOMIA PARA DIALOGAR, OUVIR E ENTENDER O CLIENTE antes de fechar.
- Pode liberar o pacote completo com todas as atividades e PDFs logo que fizer sentido na conversa, usando as tags: ${allDelivTags}.
- NUNCA chame de "amostra" e NUNCA diga "vou liberar o resto depois". Entregamos o pacote completo de uma vez só!
- Faça o pitch adaptado à realidade dele, oferecendo o Pacote Básico (R$ ${Number(ticketBasic).toFixed(2).replace('.', ',')}) ou Pacote Completo (R$ ${Number(ticketComplete).toFixed(2).replace('.', ',')}).`;
      } else {
        deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: COBRAR PRIMEIRO, ENTREGAR DEPOIS (PADRÃO SEGURO ANTIFRAUDE)
- O entregável do produto principal SÓ DEVE SER LIBERADO após o cliente efetuar o pagamento e o comprovante for verificado com status APROVADO: ${allDelivTags}.`;
      }
    }

    // === LATAM MASTER PROMPT (SPANISH) ===
    if (isLatAm) {
      return `Você é uma assistente de vendas humana, extremamente empática, rápida e nativa do país ${targetCountry}. Seu objetivo é atender leads no WhatsApp, tirar dúvidas sobre o produto digital, apresentar as opções de oferta na moeda local (${currencyCode}) e guiar o cliente até a finalização do pagamento.

---

### 🎯 REGRAS DE COMPORTAMENTO E TOM DE VOZ
1. **NATIVIDADE CULTURAL**: Você NUNCA deve parecer um robô ou tradutor automático. Use a linguagem, expressões suaves e o tom coloquial do espanhol de ${targetCountry}.
2. **RESPOSTAS AGILIZADAS E HUMANIZADAS**: Escreva mensagens curtas e diretas (estilo conversa real de WhatsApp - máximo 1 a 2 frases curtas por resposta de texto). Evite parágrafos longos ou linguagem formal de e-mail.
3. **PRECISÃO DE VALORES**: Apresente SEMPRE os valores na moeda local (${currencySymbol} ${ticketBasic} ${currencyCode} ou ${currencySymbol} ${ticketComplete} ${currencyCode}). NUNCA mencione dólares (USD) ou reais (BRL).
4. **FORMATO DE MÍDIA / ÁUDIO**: Sempre que precisar enviar uma explicação mais detalhada ou gerar conexão, formate a resposta para acionar o envio de áudio nativo configurado na plataforma ([AUDIO: texto a ser falado aqui]).
5. **AUTONOMIA TOTAL E PITCH CONSULTIVO**: Você tem total autonomia para dialogar com o lead, entender o momento dele, responder às dúvidas e criar relacionamento antes de cobrar.

---

### 📦 INFORMAÇÕES DO PRODUTO QUE VOCÊ VENDE
- Nome do Produto: ${product.name || 'Programa Digital'}
- Nicho: ${product.niche || 'Educação / Desenvolvimento'}
- Público Alvo: ${product.targetAudience || 'Interessados'}
- Oferta Básica (Ticket Básico): ${currencySymbol} ${ticketBasic} ${currencyCode}
- Oferta Completa / VIP (Ticket Completo): ${currencySymbol} ${ticketComplete} ${currencyCode}
- Garantia: ${product.guaranteeDays || 7} dias incondicionais

=== DORES PRINCIPAIS DO CLIENTE ===
${painPointsList || '- Busca uma transformação rápida e prática'}

=== PRINCIPAIS BENEFÍCIOS DO PRODUTO ===
${benefitsList || '- Acesso imediato, material validado e suporte'}

=== TRATAMENTO DE OBJEÇÕES ===
${objectionsList || '- Se achar caro, compare com o benefício e destaque a acessibilidade do pacote básico.'}

=== ENTREGÁVEIS / MATERIAIS DE APOIO DISPONÍVEIS ===
${deliverableList || 'Nenhum entregável cadastrado no momento.'}

---

### 💳 FLUXO DE PAGAMENTO POR PAÍS DE DESTINO
Ajuste a orientação de pagamento estritamente de acordo com o método configurado para ${targetCountry}:

- **MÉXICO (XPag / SPEI)**: Explique ao cliente que um código/chave de pagamento único e automático será gerado na tela. Não solicite foto ou envio manual de comprovante, pois a aprovação é liberada automaticamente assim que o pagamento for realizado.
  Instruções / Código: ${product.xpagInstructions || paymentInstructions || 'Código de pago automático SPEI'}

- **COLÔMBIA (Nequi / Bre-B)**: Forneça a chave/número do Nequi ou Bre-B e oriente o cliente a realizar a transferência bancária local.
  Número Nequi: ${product.nequiNumber || 'Por definir'} | Titular: ${product.nequiBeneficiary || 'Oficial'} | Instruções: ${product.nequiInstructions || paymentInstructions}

- **BOLÍVIA (QR Code / Transferência)**: Envie a imagem do QR Code nativo ou os dados bancários diretos (BRA/BF) para pagamento imediato.
  QR Code: ${product.boliviaQrUrl || 'QR Simple disponível'} | Banco: ${product.boliviaBankName || 'Banco Nacional'} | Conta: ${product.boliviaAccountNumber || ''} | Titular: ${product.boliviaBeneficiary || 'Oficial'}

- **PARAGUAI / ARGENTINA (Alias)**: Forneça a chave Alias (bancos nativos como ueno, Atlas, Itaú ou Banco Familiar) para transferência direta.
  Chave Alias: ${product.aliasKey || 'Por definir'} | Banco: ${product.aliasBank || 'ueno / Atlas'} | Titular: ${product.aliasBeneficiary || 'Oficial'}

---

### 🛡️ TRATAMENTO DE OBJEÇÕES E DÚVIDAS FREQUENTES
- **"É seguro / Como recebo o produto?"**: Explique que o material é em formato digital (PDF interativo de alta qualidade/aplicativo) e o acesso é enviado imediatamente aqui no WhatsApp assim que o pagamento for confirmado.
- **"O pagamento é mensal ou único?"**: Reforce que é um pagamento ÚNICO, sem assinaturas ocultas nem cobranças mensais, com acesso vitalício.
- **"Não sei como pagar"**: Dê o passo a passo simplificado usando o meio de pagamento nativo do país (ex: como colar a chave no app do banco ou usar o QR Code).

---

### 🔁 LÓGICA DE FOLLOW-UP E RECUPERAÇÃO
Se o lead parar de responder após receber o link ou os dados de pagamento:
1. **Acompanhamento 1 (Após 15-30 min)**: Mande uma mensagem curta perguntando se ele conseguiu gerar o código ou se teve alguma dúvida no aplicativo do banco.
2. **Acompanhamento 2 (Após 24h)**: Ofereça a condição especial do pacote básico ou suporte direto para concluir o acesso antes que a vaga seja encerrada.

---

### 🎙️ REGRAS DO MOTOR DE ÁUDIO ([AUDIO: ...])
${audioStrategySection}

---

### 🚀 ESTRATÉGIA DE ENTREGA E FECHAMENTO
${deliverableStrategySection}

=== EXEMPLO DE RESPOSTA NO WHATSAPP (${targetCountry}) ===
¡Hola! Qué alegría saludarte. Te grabé un audio explicándote rapidito con mucho cariño 👇

[AUDIO: ¡Hola! ¿Cómo estás?
Qué gusto saludarte...
Te cuento que este material está diseñado con todo el amor para que logres los mejores resultados desde la primera semana...
¿Tienes alguna duda o quieres que te cuente cómo empezar?]

¿Tienes alguna duda o quieres que te cuente cómo empezar? 😊

${contextDirective ? `\n=== CONTEXTO E DIRETRIZES DO MOMENTO ATUAL ===\n${contextDirective}\n` : ''}
${settings.ai?.customPromptInstructions ? `\n=== INSTRUÇÕES ADICIONAIS DO USUÁRIO ===\n${settings.ai.customPromptInstructions}` : ''}
`;
    }

    // === BRAZIL SYSTEM PROMPT (PORTUGUESE) ===
    const paymentMethod = product.paymentMethod || (product.pixKey ? 'both' : 'checkout');
    let paymentInfo = '';
    if (paymentMethod === 'pix') {
      paymentInfo = `=== FORMA DE PAGAMENTO OFICIAL: PIX DIRETO ===
- Tipo de Fechamento: Exclusivamente via PIX direto nesta conversa.
- Chave PIX (${product.pixKeyType || 'Chave'}): ${product.pixKey || 'A ser informada'}
- Nome do Titular/Beneficiário: ${product.pixBeneficiary || 'Confirmar no app do banco'}
- Valores da Oferta: R$ ${Number(ticketBasic).toFixed(2)} (Básico) | R$ ${Number(ticketComplete).toFixed(2)} (Completo)
- Instruções de Fechamento: ${product.pixInstructions || 'Pedir para enviar o comprovante aqui no WhatsApp para envio imediato do material.'}
- REGRA OBRIGATÓRIA: Quando o cliente pedir para pagar ou pedir o PIX, envie a chave PIX de forma clara e limpa em uma linha separada para ele conseguir copiar facilmente no celular.`;
    } else if (paymentMethod === 'both') {
      paymentInfo = `=== FORMAS DE PAGAMENTO DISPONÍVEIS: PIX DIRETO OU CHECKOUT ===
1. OPÇÃO PIX DIRETO (À vista com liberação imediata):
   - Chave PIX (${product.pixKeyType || 'Chave'}): ${product.pixKey || 'A ser informada'}
   - Titular da Conta: ${product.pixBeneficiary || 'Confirmar no app do banco'}
   - Instrução: ${product.pixInstructions || 'Enviar comprovante aqui no WhatsApp.'}
2. OPÇÃO CARTÃO DE CRÉDITO / PARCELADO:
   - Link de Checkout Oficial: ${product.checkoutUrl || 'Link pendente'}
- REGRA DE CONDUÇÃO: Se o cliente preferir pagar no PIX ou à vista, forneça a chave PIX limpa para cópia e peça o comprovante. Se preferir parcelar no cartão, forneça o link de checkout!`;
    } else {
      paymentInfo = `=== FORMA DE PAGAMENTO OFICIAL: LINK DE CHECKOUT ===
- Link Oficial de Checkout: ${product.checkoutUrl || 'Link pendente'}`;
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
- Oferta Básica: R$ ${Number(ticketBasic).toFixed(2).replace('.', ',')}
- Oferta Completa / VIP: R$ ${Number(ticketComplete).toFixed(2).replace('.', ',')}
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
Nosso material foi feito com todo carinho para as crianças aprenderem brincando...
São atividades bem ilustradas e práticas, que o pequeno nem percebe que está estudando!
Qual a idade do seu pequeno(a)?]

Qual a idade do seu pequeno(a)? 😊

${audioStrategySection}
${deliverableStrategySection}

${contextDirective ? `\n=== CONTEXTO E DIRETRIZES DO MOMENTO ATUAL ===\n${contextDirective}\n` : ''}
${settings.ai?.customPromptInstructions ? `\n=== INSTRUÇÕES ADICIONAIS DO USUÁRIO ===\n${settings.ai.customPromptInstructions}` : ''}
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

    const targetCountry = product.targetCountry || 'Brasil';
    const isLatAm = targetCountry !== 'Brasil';
    const currencyCode = product.currencyCode || (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : targetCountry === 'Bolívia' ? 'BOB' : targetCountry === 'Paraguai' ? 'PYG' : targetCountry === 'Argentina' ? 'ARS' : 'BRL');
    const currencySymbol = product.currencySymbol || (currencyCode === 'BRL' ? 'R$' : currencyCode === 'BOB' ? 'Bs' : currencyCode === 'PYG' ? 'Gs' : '$');
    const ticketBasic = Number(product.ticketBasic ?? product.price ?? 15);
    const ticketComplete = Number(product.ticketComplete ?? (ticketBasic * 1.6).toFixed(0));

    const formattedPrice = isLatAm ? `${currencySymbol} ${ticketBasic} ${currencyCode}` : `R$ ${ticketBasic.toFixed(2).replace('.', ',')}`;
    const formattedPriceComplete = isLatAm ? `${currencySymbol} ${ticketComplete} ${currencyCode}` : `R$ ${ticketComplete.toFixed(2).replace('.', ',')}`;

    const isReceiptAnalysis = (userMessage || '').includes('[COMPROVANTE DE PAGAMENTO ANALISADO]');
    const allDelivTags = deliverables.length > 0
      ? deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ')
      : '[ENVIAR_ARQUIVO: PRODUTO]';

    let contextDirective = '';

    if (deliveryStrategy === 'deliver_first') {
      const messagesHistory = conversationHistory || [];
      const hasSentBefore = messagesHistory.some(m => m.fromMe && m.text && m.text.includes('📎 [Enviado]:'));
      const hasSentDeliverable = leadObj?.deliverableSent === true || leadObj?.stage === 'ENTREGUE' || leadObj?.stage === 'PIX_ENVIADO' || hasSentBefore;
      const isPaid = leadObj?.stage === 'APROVADO' || leadObj?.lastReceiptStatus === 'APROVADO';

      const hasAlreadySentPixInHistory = messagesHistory.some((m) => m.fromMe && m.text && (
        (product.pixKey && m.text.includes(product.pixKey)) ||
        (product.nequiNumber && m.text.includes(product.nequiNumber)) ||
        (product.aliasKey && m.text.includes(product.aliasKey)) ||
        m.text.includes('Chave PIX') ||
        m.text.includes('SPEI') ||
        m.text.includes('Nequi') ||
        m.text.includes('Alias')
      ));
      const hasPixBeenSent = hasAlreadySentPixInHistory || leadObj?.stage === 'PIX_ENVIADO';

      const lowerUserMsg = (userMessage || '').toLowerCase();
      const isUserAskingPayment = /pix|pagar|pago|chave|valor|quanto custa|conta|manda.*pix|envia.*pix|passa.*pix|manda.*chave|precio|costo|cu[aá]nto cuesta|transferir|m[eé]todo.*pago|datos.*pago|spei|nequi|alias|qr|c[oó]mo pago/i.test(lowerUserMsg);
      const isUserClaimingPaid = /já fiz|ja fiz|já paguei|ja paguei|fiz aqui|acabei de fazer|já transferi|ja transferi|mandei o pix|mandei o comprovante|pago|paguei|ta pago|tá pago|transferi|ya pagu[eé]|ya transfer[ií]|ya hice el pago|listo el pago|ya te envi[eé]|ya te deposit[eé]|comprobante/i.test(lowerUserMsg);
      const isUserAskingIfTheseAreTheFiles = /achei q eram esses|achei que eram esses|são esses|sao esses|é esse|é essa|são essas|pode mandar|manda pfv|manda por favor|vai mandar|son estos|es este|es esta|son estas|puedes mandar|manda porfa|env[ií]amelos|me los mandas/i.test(lowerUserMsg);

      if (isReceiptAnalysis) {
        const isApprovedReceipt = userMessage.includes('Status: APROVADO');
        const isAgendadoReceipt = userMessage.includes('Status: AGENDADO');

        if (isApprovedReceipt) {
          if (isLatAm) {
            contextDirective = `SITUACIÓN: El cliente envió el comprobante y el pago fue 100% APROBADO y confirmado.
- ¡Agradece con gran cariño, gratitud y entusiasmo por su compra (${formattedPrice})!
- Si ya tiene los archivos, confírmale con alegría que ya los tiene en sus manos para aprovecharlos al máximo.
- Incluye un [AUDIO: ...] cálido y dulce felicitándolo y dándole la bienvenida.`;
          } else {
            contextDirective = `SITUAÇÃO: O cliente enviou o comprovante de pagamento e o PIX foi 100% APROVADO e confirmado!
- Agradeça com imensa gratidão, carinho e entusiasmo pela adesão (${formattedPrice})!
- Se o cliente já recebeu os arquivos, confirme com alegria que ele já está com tudo em mãos para aproveitar.
- Coloque um [AUDIO: ...] doce e carinhoso agradecendo de coração pela ajuda e desejando momentos maravilhosos!`;
          }
        } else if (isAgendadoReceipt) {
          if (isLatAm) {
            contextDirective = `SITUACIÓN: El comprobante enviado fue identificado como PAGO PROGRAMADO / AGENDADO (el valor aún no ha sido debitado).
- Explica con amabilidad y sutileza que en la aplicación bancaria la transferencia quedó programada para una fecha posterior.
- Pídele que cancele la programación y efectúe la transferencia inmediata para habilitar su acceso de inmediato (${formattedPrice}).
- Envía las instrucciones del método de pago oficial.
- Incluye un [AUDIO: ...] comprensivo y paciente.`;
          } else {
            contextDirective = `SITUAÇÃO: O cliente enviou um comprovante, mas ele foi identificado como AGENDAMENTO (o valor ainda não foi debitado).
- Explique com muita delicadeza, carinho e gentileza que no app do banco a operação ficou programada como um agendamento futuro.
- Peça com simpatia para ele entrar no aplicativo do banco, cancelar o agendamento e fazer a transferência imediata na hora para concluir (${formattedPrice}).
- Envie a Chave PIX oficial limpa (${product.pixKeyType || 'telefone'}: ${product.pixKey || '88994892385'} - ${product.pixBeneficiary || 'ian alves dos anjos'} - ${formattedPrice}).
- Coloque um [AUDIO: ...] acolhedor e calmo explicando o agendamento sem constranger o cliente.`;
          }
        } else {
          contextDirective = isLatAm
            ? `SITUACIÓN: El comprobante enviado presentó divergencia:\n${userMessage}\n- Explica con respeto la observación e indica las opciones oficiales de pago.`
            : `SITUAÇÃO: O comprovante enviado pelo cliente apresentou divergência:\n${userMessage}\n- Explique com carinho e respeito a divergência e informe a chave oficial de contribuição.`;
        }
      } else if (isPaid) {
        if (isLatAm) {
          contextDirective = `SITUACIÓN: El cliente ya pagó y su acceso está 100% CONFIRMADO y APROBADO.
Mensaje del cliente: "${userMessage}".
- Responde con atención y cariño a sus preguntas.
- Si pregunta por los materiales, confirma que son los entregados arriba y que ya puede descargarlos y usarlos.`;
        } else {
          contextDirective = `SITUAÇÃO: O cliente já realizou a contribuição e o pagamento está 100% CONFIRMADO e APROVADO!
Mensagem do cliente: "${userMessage}".
- Responda com carinho e atenção às dúvidas ou agradecimentos dele.
- Se ele perguntar dos materiais, confirme que são aqueles que você já enviou lá em cima e que ele já pode baixar e usar.`;
        }
      } else if (isUserAskingPayment) {
        if (isLatAm) {
          let paymentMethodInstructionsText = '';
          if (targetCountry === 'México') {
            paymentMethodInstructionsText = `- Explica que se generará el código SPEI único y automático en pantalla (${product.xpagInstructions || 'Código de pago automático SPEI'}).
- No solicites comprobante manual, pues la activación es 100% automática al pagar.`;
          } else if (targetCountry === 'Colômbia') {
            paymentMethodInstructionsText = `- Envía el número Nequi / Bre-B: ${product.nequiNumber || 'Por definir'} (Titular: ${product.nequiBeneficiary || 'Oficial'}).
- Pídele que envíe el comprobante aquí para liberar el acceso inmediato.`;
          } else if (targetCountry === 'Bolívia') {
            paymentMethodInstructionsText = `- Envía los datos de pago: ${product.boliviaBankName || 'Banco'} - Cuenta: ${product.boliviaAccountNumber || ''} (Titular: ${product.boliviaBeneficiary || 'Oficial'}) o menciona el QR Simple disponible.`;
          } else {
            paymentMethodInstructionsText = `- Envía la clave Alias: ${product.aliasKey || 'Por definir'} (Banco: ${product.aliasBank || 'ueno / Atlas'} - Titular: ${product.aliasBeneficiary || 'Oficial'}).`;
          }

          contextDirective = `SITUACIÓN: El cliente solicitó cómo pagar o los datos de pago ("${userMessage}").
- Agradece la confianza y amabilidad.
- Presenta las dos opciones: Ticket Básico (${formattedPrice}) o Ticket Completo (${formattedPriceComplete}).
${paymentMethodInstructionsText}
- Incluye un [AUDIO: ...] corto guiándolo con cercanía y calidez.`;
        } else {
          contextDirective = `SITUAÇÃO: O cliente pediu o PIX diretamente ou perguntou como pagar ("${userMessage}").
- Agradeça a gentileza e confiança!
- Apresente as opções: Ticket Básico (${formattedPrice}) ou Ticket Completo (${formattedPriceComplete}).
- Envie a Chave PIX oficial limpa no texto:
  Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}
  Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
  Valor: ${formattedPrice} (Básico) ou ${formattedPriceComplete} (Completo)
- Peça para enviar o comprovante após a transferência.
- Coloque um [AUDIO: ...] curto agradecendo a ajuda e a confiança.`;
        }
      } else if (isUserClaimingPaid) {
        contextDirective = isLatAm
          ? `SITUACIÓN: El cliente indicó que ya realizó el pago ("${userMessage}").
- Agradece con calidez y pídele amablemente que envíe el comprobante aquí para registrarlo en el sistema (en México vía SPEI/XPag se aprobará automáticamente).`
          : `SITUAÇÃO: O cliente avisou que já realizou o pagamento ou PIX ("${userMessage}").
- Agradeça com muito carinho e peça para enviar o comprovante aqui na conversa para confirmação imediata.`;
      } else if (isUserAskingIfTheseAreTheFiles) {
        contextDirective = isLatAm
          ? `SITUACIÓN: El cliente pregunta si los materiales enviados arriba son los definitivos ("${userMessage}").
- Aclárale con entusiasmo y cariño: ¡Sí! Son exactamente esos materiales completos en PDF que ya le enviaste para empezar hoy mismo.`
          : `SITUAÇÃO: O cliente está em dúvida se os materiais enviados anteriormente lá em cima são os definitivos ("${userMessage}").
- Esclareça com total carinho e segurança: Sim! São exatamente aqueles arquivos que você já enviou prontos para usar!`;
      } else {
        // FLUXO CONVERSACIONAL COM LIBERDADE E AUTONOMIA TOTAL
        if (isLatAm) {
          contextDirective = `SITUACIÓN ACTUAL DE LA ATENCIÓN:
Mensaje del cliente: "${userMessage}".

ESTADO DEL EMBUDO:
- Materiales enviados anteriormente? ${hasSentDeliverable ? 'SÍ (ya entregados)' : 'NO (aún no enviados)'}
- Datos de pago enviados anteriormente? ${hasPixBeenSent ? 'SÍ (ya enviados)' : 'NO (aún no enviados)'}

DIRECTRICES DE AUTONOMÍA Y CONVERSIÓN:
1. RESPONDE PRIMERO AL CLIENTE: No ignores lo que dijo el lead. Responde con calidez, empatía y cercanía real de WhatsApp en ${targetCountry}.
2. ENTREGA DE MATERIALES (${hasSentDeliverable ? 'YA REALIZADA' : 'DISPONIBLE'}):
${hasSentDeliverable 
  ? '   - Los materiales ya fueron enviados anteriormente. No necesitas enviar las etiquetas de archivo de nuevo, a menos que el cliente lo solicite.' 
  : `   - Tienes total autonomía para entregar los materiales completos ahora usando las etiquetas: ${allDelivTags}. Si el cliente demostró interés, preguntó o pidió ver el material, ¡entrégalo con entusiasmo!`}
3. PITCH Y CIERRE (${hasPixBeenSent ? 'DATOS DE PAGO YA ENVIADOS' : 'MOMENTO DEL PITCH'}):
${hasPixBeenSent 
  ? '   - Los datos de pago ya fueron enviados anteriormente. No presiones ni cobres repetidamente. Brinda espacio, responde dudas con amabilidad y solo reenvía los datos si el cliente lo solicita.' 
  : `   - Cuando sientas que el momento es oportuno (tras entregar los materiales, responder dudas o cuando exprese entusiasmo), haz el pitch adaptado a lo que te contó y ofrece el paquete Básico (${formattedPrice}) o Completo (${formattedPriceComplete}).`}
4. TONO HUMANO: Habla como una persona real en WhatsApp de ${targetCountry} — empática, rápida y persuasiva, usando [AUDIO: ...] en momentos de explicación, conexión o pitch.`;
        } else {
          contextDirective = `SITUAÇÃO ATUAL DO ATENDIMENTO:
Mensagem do cliente: "${userMessage}".

STATUS DO FUNIL:
- Materiais enviados anteriormente? ${hasSentDeliverable ? 'SIM (já entregues)' : 'NÃO (ainda não foram enviados)'}
- Chave PIX enviada anteriormente? ${hasPixBeenSent ? 'SIM (já enviada)' : 'NÃO (ainda não enviada)'}

DIRETRIZES DE AUTONOMIA E CONVERSÃO:
1. RESPONDA PRIMEIRO AO CLIENTE: Não ignore o que o cliente disse! Se ele fez uma pergunta ou compartilhou algo sobre o filho/rotina, responda com atenção e carinho genuíno.
2. ENTREGA DE MATERIAIS (${hasSentDeliverable ? 'JÁ FEITA' : 'DISPONÍVEL'}):
${hasSentDeliverable 
  ? '   - Os materiais já foram enviados anteriormente. Não precisa enviar as tags de arquivo de novo, a não ser que o cliente peça.' 
  : `   - Você tem autonomia para liberar todos os materiais agora usando as tags: ${allDelivTags}. Se o cliente demonstrou interesse, pediu para ver, ou se o momento da conversa pede para mostrar valor prático, entregue os arquivos com entusiasmo!`}
3. PITCH E FECHAMENTO (${hasPixBeenSent ? 'PIX JÁ ENVIADO' : 'MOMENTO DO PITCH'}):
${hasPixBeenSent 
  ? '   - A chave PIX já foi enviada anteriormente. NÃO force a barra nem fique cobrando repetidamente. Dê espaço, responda eventuais dúvidas com gentileza e só reenvie a chave PIX se o cliente pedir.' 
  : `   - Quando você sentir que o momento é oportuno, faça o pitch adaptado à realidade que ele te contou e ofereça o Pacote Básico (${formattedPrice}) ou o Pacote Completo (${formattedPriceComplete}) via PIX (Chave ${product.pixKeyType || 'telefone'}: ${product.pixKey || '88994892385'}).`}
4. TOM HUMANO: Fale como uma pessoa real no WhatsApp — acolhedora, espontânea, simpática e persuasiva, usando [AUDIO: ...] nos momentos de explicação, empatia ou pitch.`;
        }
      }
    } else {
      // ESTRATÉGIA PADRÃO: require_payment / per_deliverable
      if (isReceiptAnalysis) {
        if (isLatAm) {
          contextDirective = `SITUACIÓN: Comprobante inspeccionado por visión artificial:
${userMessage}
- Si el status es "APROVADO": Agradece con alegría y libera el acceso: ${allDelivTags}.
- Si el status es "AGENDADO": Explica que es un pago programado y pide que realice la transferencia inmediata para liberar su producto.`;
        } else {
          contextDirective = `SITUAÇÃO: O cliente enviou um comprovante de pagamento que foi inspecionado por visão computacional:
${userMessage}
Como agir conforme a análise:
- SE O STATUS FOR "AGENDADO":
  NÃO libere produtos nem confirme o pagamento! O dinheiro AINDA NÃO caiu na conta!
  Explique com carinho e gentileza que é um agendamento futuro e peça para cancelar no app do banco e fazer a transferência normal na hora para liberação imediata (${formattedPrice}).
  Envie a Chave PIX oficial (${product.pixKeyType || 'telefone'}: ${product.pixKey || '88994892385'} - ${product.pixBeneficiary || 'ian alves dos anjos'} - ${formattedPrice}).
  Coloque [AUDIO: ...] doce e compreensivo explicando o agendamento.
- SE O STATUS FOR "APROVADO":
  Comemore e agradeça de coração! Acione a liberação: ${allDelivTags}.
  Coloque [AUDIO: ...] caloroso de parabéns!
- SE FOR "VALOR_INCORRETO" OU "DESTINATARIO_INCORRETO":
  Explique com respeito a divergência e informe o valor/chave correto.`;
        }
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
    const targetCountry = product.targetCountry || 'Brasil';
    const isLatAm = targetCountry !== 'Brasil';
    const currencyCode = product.currencyCode || (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : targetCountry === 'Bolívia' ? 'BOB' : targetCountry === 'Paraguai' ? 'PYG' : targetCountry === 'Argentina' ? 'ARS' : 'BRL');
    const currencySymbol = product.currencySymbol || (currencyCode === 'BRL' ? 'R$' : currencyCode === 'BOB' ? 'Bs' : currencyCode === 'PYG' ? 'Gs' : '$');
    const ticketBasic = Number(product.ticketBasic ?? product.price ?? 15);
    const ticketComplete = Number(product.ticketComplete ?? (ticketBasic * 1.6).toFixed(0));
    const formattedPrice = isLatAm ? `${currencySymbol} ${ticketBasic} ${currencyCode}` : `R$ ${ticketBasic.toFixed(2).replace('.', ',')}`;

    if (isLatAm) {
      if (product.deliveryStrategy === 'deliver_first') {
        if (text.includes('si') || text.includes('quiero') || text.includes('material') || text.includes('pdf') || text.includes('actividades') || text.includes('funciona')) {
          return `${allTags || '[ENVIAR_ARQUIVO: PRODUTO]'}\n¡Claro que sí! Te acabo de compartir el material completo para que lo puedas revisar y comenzar a disfrutarlo hoy mismo. Échale un vistazo y me cuentas qué tal 👇`;
        }
      }
      if (text.includes('precio') || text.includes('costo') || text.includes('cuanto') || text.includes('pagar')) {
        return `El programa completo está con una oportunidad especial: Paquete Básico por solo ${formattedPrice} o Paquete Completo por ${currencySymbol} ${ticketComplete} ${currencyCode}.\n\n¿Quieres que te comparta cómo acceder ahora mismo?`;
      }
      return `¡Hola! Qué alegría saludarte. 😊\n\nSoy del equipo de atención de ${product.name || 'nuestro programa'}. Cuéntame, ¿en qué te puedo ayudar hoy?`;
    }

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
        return `Fico muito feliz que tenha gostado! ❤️ Fiz questão de te mandar o material completo para você já ver o quanto vai ajudar no desenvolvimento dele!\n\nPara manter nosso projeto vivo e continuarmos criando novos materiais, a gente pede uma contribuição simbólica de apenas ${formattedPrice}.\n\nChave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}\nNome: ${product.pixBeneficiary || 'ian alves dos anjos'}\nValor: ${formattedPrice}\n\n[AUDIO: Oi!... Te mandei as atividades completas com muito carinho... Dá uma olhadinha na chave PIX e quando fizer me manda o comprovante aqui tá bom? Um abraço grande!]`;
      }
    }

    if (text.includes('preço') || text.includes('quanto custa') || text.includes('valor')) {
      return `O investimento no ${product.name} está em condição especial hoje por apenas ${formattedPrice} (Básico) ou ${currencySymbol} ${ticketComplete} (Completo)!\n\nVocê tem acesso completo a todo o passo a passo com garantia incondicional de ${product.guaranteeDays || 7} dias.\n\nQuer garantir sua vaga com esse valor promocional agora? É só acessar: ${product.checkoutUrl || 'link oficial'}`;
    }

    if (text.includes('link') || text.includes('comprar') || text.includes('quero') || text.includes('pix')) {
      return `Maravilha! Você pode garantir seu acesso imediatamente pelo link oficial:\n👉 ${product.checkoutUrl || 'link oficial'}\n\nAssim que o pagamento for confirmado, você já recebe o acesso no seu e-mail e no WhatsApp! Se tiver qualquer dúvida durante o processo, só me avisar aqui.`;
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
