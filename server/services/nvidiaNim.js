import axios from 'axios';
import { storage } from './storage.js';
import { buildSalesPrompt, buildTurnContext, detectTurnSituation } from './salesPrompt.js';

class NvidiaNimService {
  constructor() {
    this.endpoint = 'https://integrate.api.nvidia.com/v1/chat/completions';
    this.openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
    this.lastPrimaryFailureTime = 0;
    this.primaryCooldownMs = 0; // Disabled: primary model is always attempted
  }

  detectCountryFromPhone(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/[^0-9]/g, '');
    if (!clean) return null;
    // WhatsApp Privacy LIDs are 15-digit internal identifiers (e.g. 167297666814095), NOT international phone numbers!
    if (clean.length > 13 && (clean.startsWith('1') || clean.startsWith('2'))) {
      return null;
    }
    if (clean.startsWith('55')) return 'Brasil';
    if (clean.startsWith('52')) return 'México';
    if (clean.startsWith('57')) return 'Colômbia';
    if (clean.startsWith('54')) return 'Argentina';
    if (clean.startsWith('591')) return 'Bolívia';
    if (clean.startsWith('595')) return 'Paraguai';
    if (clean.startsWith('51')) return 'Peru';
    if (clean.startsWith('56')) return 'Chile';
    if (clean.startsWith('593')) return 'Equador';
    if (clean.startsWith('58')) return 'Venezuela';
    if (clean.startsWith('1') && clean.length <= 11) return 'Estados Unidos';
    return null;
  }

  // Real-time Language, Dialect & Slang Detection from customer messages & conversation history
  detectLanguageAndCountry(userMessage = '', conversationHistory = [], phone = '') {
    const phoneCountry = this.detectCountryFromPhone(phone);

    const historyArr = Array.isArray(conversationHistory) ? conversationHistory : [];
    const incomingTexts = [
      userMessage,
      ...historyArr
        .filter(m => m && !m.fromMe && m.text)
        .slice(-6)
        .map(m => m.text)
    ].filter(Boolean);

    const fullText = incomingTexts.join(' ');
    // Normalize diacritics (remove accents) for reliable regex matching
    const normText = fullText.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // 1. Regional Slang & Vocabulary Patterns (Immediate Country Match)
    const isMexicanSlang = /\b(que onda|oye|chido|chida|padrisimo|padrisima|padre|porfa|porfis|orale|compa|wey|guey|neta|ahorita|lana|carnal|platica|hijole|mande|aguas|sale)\b/i.test(normText);
    const isColombianSlang = /\b(parce|parcero|parcera|chevere|bacano|bacana|de una|listo parce|plata|berraco|pelao|pelaito|bien pueda)\b/i.test(normText);
    const isArgentineSlang = /\b(che\b|mira\b|viste|boludo|boluda|copado|copada|posta|dale\b|laburo|re bien|quilombo|re bueno|genial che)\b/i.test(normText);
    const isChileanSlang = /\b(po\b|cachai|altiro|al tiro|bacan|weon)\b/i.test(normText);
    const isPeruvianSlang = /\b(pe\b|causa|pata|choche)\b/i.test(normText);
    const isBolivianSlang = /\b(casero|casera|qr simple|tigo money)\b/i.test(normText);

    // 2. Language Scoring with distinct vocabularies (exclude shared words like 'como', 'que', 'audio', 'info', 'claro', 'aprender')
    // Distinct Portuguese (normalized):
    const ptPatterns = /\b(ola|oi|voce|voces|tudo bem|tudo bom|obrigad[ao]|valeu|pix|cartao|boleto|crianc[as]|filh[os]|pequen[os]|adivinhou|adivinhar|ensino|blz|show|manda|envia|como funciona|pode me explicar|ta bom|com certeza|meu|minha|nao|sim|quero|posso|quanto custa|qual o valor|muito caro|reais|bom dia|boa tarde|boa noite|gostaria|preco|apostila|atividades|achei|nossa)\b/gi;
    const ptScore = (normText.match(ptPatterns) || []).length;

    // Distinct Spanish (normalized):
    const esPatterns = /\b(hola|buenas|oye|porfa|por favor|gracias|muchas gracias|quiero|puedo|mandar|escuchar|hacer|hij[os]|nin[os]|pequen[os]|precio|costo|es que|se me|con todo gusto|usted|ustedes|donde|cuando|cuanto cuesta|cual es|que onda|chido|padrisimo|orale|wey|neta|ahorita|parce|chevere|de una|viste|boludo|copado|posta|dale)\b/gi;
    const esPunctuation = (fullText.match(/[¿¡]/g) || []).length;
    const esScore = (normText.match(esPatterns) || []).length + (esPunctuation * 3) + (isMexicanSlang ? 6 : 0) + (isColombianSlang ? 6 : 0) + (isArgentineSlang ? 6 : 0);

    const enPatterns = /\b(hello|hi\b|hey\b|how much|what is the price|please|thanks|thank you|child|children|kids|learn|english|send me|information|details)\b/gi;
    const enScore = (normText.match(enPatterns) || []).length * 2;

    // 3. Selection Matrix with Phone Country Priority
    // If phone DDI is clearly Brazil (+55):
    if (phoneCountry === 'Brasil') {
      // For a Brazilian number (+55), ONLY switch to Spanish if explicit, overwhelming Spanish indicators are present
      if (esScore >= 3 && esScore > ptScore * 2 && (esPunctuation > 0 || isMexicanSlang || isColombianSlang || isArgentineSlang)) {
        return { language: 'es', country: 'México', isLatAm: true, slang: 'latam_neutro' };
      }
      return { language: 'pt', country: 'Brasil', isLatAm: false, slang: 'brasileiro' };
    }

    // If phone DDI is LatAm (+52, +57, +54, etc.):
    if (phoneCountry && phoneCountry !== 'Brasil' && phoneCountry !== 'Estados Unidos') {
      if (ptScore >= 3 && ptScore > esScore * 2) {
        return { language: 'pt', country: 'Brasil', isLatAm: false, slang: 'brasileiro' };
      }
      return {
        language: 'es',
        country: phoneCountry,
        isLatAm: true,
        slang: phoneCountry === 'México' ? 'mexicano' : phoneCountry === 'Colômbia' ? 'colombiano' : phoneCountry === 'Argentina' ? 'argentino' : 'latam_neutro'
      };
    }

    if (phoneCountry === 'Estados Unidos') {
      return { language: 'en', country: 'Estados Unidos', isLatAm: true, slang: 'english' };
    }

    // If phone country unknown (e.g. LID or web test): rely on text scores
    if (esScore > ptScore && esScore > enScore) {
      let country = 'México';
      if (isMexicanSlang) country = 'México';
      else if (isColombianSlang) country = 'Colômbia';
      else if (isArgentineSlang) country = 'Argentina';
      else if (isChileanSlang) country = 'Chile';
      else if (isPeruvianSlang) country = 'Peru';
      else if (isBolivianSlang) country = 'Bolívia';
      return {
        language: 'es',
        country,
        isLatAm: true,
        slang: isMexicanSlang ? 'mexicano' : isColombianSlang ? 'colombiano' : isArgentineSlang ? 'argentino' : 'latam_neutro'
      };
    }

    if (ptScore > esScore && ptScore > enScore) {
      return { language: 'pt', country: 'Brasil', isLatAm: false, slang: 'brasileiro' };
    }

    if (enScore > esScore && enScore > ptScore) {
      return { language: 'en', country: 'Estados Unidos', isLatAm: true, slang: 'english' };
    }

    // Default fallback to settings product targetCountry
    const settings = storage.getSettings();
    const defaultCountry = settings.product?.targetCountry || 'Brasil';
    const isLat = defaultCountry !== 'Brasil';
    return {
      language: isLat ? 'es' : 'pt',
      country: defaultCountry,
      isLatAm: isLat,
      slang: defaultCountry === 'México' ? 'mexicano' : defaultCountry === 'Colômbia' ? 'colombiano' : defaultCountry === 'Argentina' ? 'argentino' : isLat ? 'latam_neutro' : 'brasileiro'
    };
  }

  // Localize common Portuguese product descriptors to Spanish for the prompt context
  localizeProductForPrompt(product, targetLanguage = 'es', targetCountry = 'México') {
    // 1. Direct use of dedicated localized offer if previously generated/saved for this country
    const savedLocalized = product.localizedOffers?.[targetCountry] || storage.getLocalizedOffer(targetCountry);
    if (savedLocalized && savedLocalized.name) {
      const painPoints = (savedLocalized.mainPainPoints || [])
        .map(p => `- ${p.trim()}`)
        .join('\n');
      const benefits = (savedLocalized.mainBenefits || [])
        .map(b => `- ${b.trim()}`)
        .join('\n');
      const objections = (savedLocalized.objections || [])
        .map(o => `- Objeción "${o.trigger}": ${o.response}`)
        .join('\n');

      return {
        name: savedLocalized.name,
        niche: savedLocalized.niche || product.niche || '',
        targetAudience: savedLocalized.targetAudience || product.targetAudience || '',
        painPoints: painPoints || '- Busca una solución interactiva y lúdica para sus hijos',
        benefits: benefits || '- Actividades didácticas de alta calidad listas para imprimir',
        objections: objections || '- Si menciona el precio, destaca el valor simbólico de la inversión.',
        defaultAudioPitchText: savedLocalized.defaultAudioPitchText || ''
      };
    }

    if (targetLanguage !== 'es') {
      return {
        name: product.name || '',
        niche: product.niche || '',
        targetAudience: product.targetAudience || '',
        painPoints: (product.mainPainPoints || []).map(p => `- ${p}`).join('\n'),
        benefits: (product.mainBenefits || []).map(b => `- ${b}`).join('\n'),
        objections: (product.objections || []).map(o => `- Objeção "${o.trigger}": ${o.response}`).join('\n')
      };
    }

    const localizeText = (txt) => {
      if (!txt) return '';
      return String(txt)
        .replace(/pais e professores que se preocupam com o futuro profissional dos seus filhos que precisarão saber inglês,?\s*crianças que tem dificuldades com a escola\.?/gi, 'padres de familia y docentes preocupados por el futuro de sus hijos, para que dominen el inglés desde pequeños de forma fácil y divertida, y niños que tienen dificultades con los métodos tradicionales de la escuela')
        .replace(/atividades para crianças aprenderem inglês brincando/gi, 'Actividades lúdicas e interactivas para que los niños aprendan inglés jugando')
        .replace(/crianças falam inglês nas primeiras semanas/gi, 'los niños empiezan a hablar sus primeras palabras y frases en inglés desde las primeras semanas')
        .replace(/crianças aprendam inglês/gi, 'los niños aprendan inglés jugando')
        .replace(/crianças que não sabem inglês/gi, 'niños que aún no dominan el inglés')
        .replace(/crianças atrasadas/gi, 'niños que tienen rezago o dificultad en la escuela')
        .replace(/crianças com dificuldades/gi, 'niños con dificultades de aprendizaje')
        .replace(/futuro dos filhos/gi, 'preocupación por el futuro educativo y profesional de sus hijos')
        .replace(/faceis de aplicar|fáceis de aplicar/gi, 'actividades súper fáciles y prácticas para imprimir y aplicar en casa')
        .replace(/atividades interativas/gi, 'actividades 100% didácticas, ilustradas, interactivas y coloridas')
        .replace(/pais e professores/gi, 'padres y maestros')
        .replace(/escola tradicional/gi, 'escuela tradicional')
        .replace(/educação e desenvolvimento/gi, 'Educación y Desarrollo Infantil')
        .replace(/alfabetização/gi, 'alfabetización y desarrollo infantil')
        .replace(/se preocupam com/gi, 'se preocupan por')
        .replace(/futuro profissional/gi, 'futuro profesional')
        .replace(/dos seus/gi, 'de sus')
        .replace(/precisarão saber/gi, 'necesitarán saber')
        .replace(/tem dificuldades/gi, 'tienen dificultades')
        .replace(/com a escola/gi, 'con la escuela')
        .replace(/dificuldades/gi, 'dificultades')
        .replace(/escola/gi, 'escuela')
        .replace(/atividades/gi, 'actividades')
        .replace(/crianças/gi, 'niños')
        .replace(/criança/gi, 'niño(a)')
        .replace(/filhos/gi, 'hijos')
        .replace(/filho/gi, 'hijo');
    };

    const painPoints = (product.mainPainPoints || [])
      .map(p => `- ${localizeText(p)}`)
      .join('\n');

    const benefits = (product.mainBenefits || [])
      .map(b => `- ${localizeText(b)}`)
      .join('\n');

    const objections = (product.objections || [])
      .map(o => `- Objeción "${localizeText(o.trigger)}": ${localizeText(o.response)}`)
      .join('\n');

    return {
      name: localizeText(product.name || 'Programa Educativo de Inglés Infantil'),
      niche: localizeText(product.niche || 'Educación Infantil'),
      targetAudience: localizeText(product.targetAudience || 'Padres de familia interesados en el aprendizaje de sus hijos'),
      painPoints: painPoints || '- Busca una solución divertida, práctica y efectiva para sus hijos',
      benefits: benefits || '- Actividades didácticas interactivas para aprender inglés jugando',
      objections: objections || '- Si menciona el precio, resalta la transformación y la accesibilidad de la inversión.'
    };
  }

  // Default Master Boss Prompt Templates for rapid loading and total control
  getDefaultPromptTemplates() {
    return {
      pt: `Você é um consultor especialista e mestre em atendimento consultivo e vendas persuasivas no WhatsApp para {{NOME_PRODUTO}} no {{PAIS}}.
Seu objetivo principal é criar conexão humana genuína, entender as necessidades do cliente e fechar a venda de forma acolhedora e altamente persuasiva.

=== DADOS DA OFERTA E PRODUTO ===
- Produto: {{NOME_PRODUTO}}
- Nicho: {{NICHO}}
- Público-Alvo: {{PUBLICO_ALVO}}
- Pacote Básico: {{VALOR_BASICO}}
- Pacote Completo: {{VALOR_COMPLETO}}
- Forma de Pagamento: {{METODO_PAGAMENTO}}
- Instruções de Pagamento: {{PAGAMENTO_INFO}}
- Garantia Incondicional: {{DIAS_GARANTIA}}

=== ENTREGÁVEIS E MATERIAIS ===
{{ENTREGAVEIS}}
Tags para liberação dos arquivos: {{TAGS_ARQUIVOS}}

=== DORES E TRANSFORMAÇÃO DO CLIENTE ===
Dores comuns:
{{DORES}}

Benefícios principais:
{{BENEFICIOS}}

Resolução de objeções:
{{OBJECOES}}

=== ESTRATÉGIA DE ÁUDIO NO WHATSAPP ===
{{DIRETRIZ_AUDIO}}
- Para enviar áudio, utilize a tag [AUDIO: texto do áudio limpo].
- Grave áudio quando o cliente falar de dúvidas sobre os filhos, rotina ou pedir áudio explicitamente.
- NUNCA use marcadores técnicos dentro do áudio como [warm], [break] ou reticências exageradas.

=== ESTRATÉGIA DE ENTREGA E CONVERSÃO ===
{{DIRETRIZ_ENTREGA}}

=== REGRAS DE MEMÓRIA E ATENDIMENTO HUMANO ===
{{HISTORICO_MEMORIA}}
- NUNCA repita saudações ("Olá!", "Tudo bem?") se a conversa já estiver em andamento.
- NUNCA repita perguntas que o cliente já respondeu no histórico.
- Responda primeiro à pergunta do lead antes de apresentar ofertas.
- NUNCA termine uma mensagem em tópicos ou preços soltos sem fazer uma pergunta calorosa passando a bola para o cliente.

=== DIRETRIZES DO MOMENTO ATUAL ===
{{DIRETRIZ_CONTEXTO}}`,

      es: `Eres un asesor experto de élite en atención consultiva y cierre de ventas persuasivas por WhatsApp para {{NOME_PRODUTO}} en {{PAIS}}.
Tu objetivo primordial es generar una conexión humana real, empatizar con las necesidades del cliente y cerrar la venta con calidez y máxima persuasión.

=== DATOS DE LA OFERTA Y PRODUCTO ===
- Producto: {{NOME_PRODUTO}}
- Nicho: {{NICHO}}
- Público Objetivo: {{PUBLICO_ALVO}}
- Paquete Básico: {{VALOR_BASICO}}
- Paquete Completo: {{VALOR_COMPLETO}}
- Método de Pago: {{METODO_PAGAMENTO}}
- Instrucciones de Pago: {{PAGAMENTO_INFO}}
- Garantía: {{DIAS_GARANTIA}}

=== MATERIALES Y ENTREGABLES ===
{{ENTREGAVEIS}}
Etiquetas para enviar archivos: {{TAGS_ARQUIVOS}}

=== DESAFÍOS Y BENEFICIOS ===
Desafíos del cliente:
{{DORES}}

Beneficios principales:
{{BENEFICIOS}}

Resolución de objeciones:
{{OBJECOES}}

=== ESTRATEGIA DE NOTAS DE VOZ POR WHATSAPP ===
{{DIRETRIZ_AUDIO}}
- Para enviar nota de voz, usa la etiqueta [AUDIO: texto hablado limpio].
- Envía audio cuando el cliente comparta la edad de sus hijos, dificultades de aprendizaje o pida audio.
- NUNCA uses etiquetas técnicas como [warm] dentro del audio.

=== ESTRATEGIA DE ENTREGA Y CONVERSIÓN ===
{{DIRETRIZ_ENTREGA}}

=== REGLAS CRÍTICAS DE MEMORIA Y ATENCIÓN HUMANA ===
{{HISTORICO_MEMORIA}}
- NUNCA repitas saludos ("¡Hola!", "¿Cómo estás?") si la conversación ya está activa.
- NUNCA repitas preguntas que el cliente ya respondió en el historial.
- Responde primero a la pregunta del lead antes de presentar la oferta.
- NUNCA termines un mensaje con viñetas o precios sueltos sin hacer una pregunta cercana que invite al cliente a responder.

=== SITUACIÓN Y DIRECTRICES DEL MOMENTO ACTUAL ===
{{DIRETRIZ_CONTEXTO}}`,

      en: `You are an expert sales consultant and consultative closing specialist on WhatsApp for {{NOME_PRODUTO}} in {{PAIS}}.
Your primary goal is to build genuine human connection, understand customer needs, and close sales smoothly.

=== OFFER & PRODUCT DETAILS ===
- Product: {{NOME_PRODUTO}}
- Niche: {{NICHO}}
- Target Audience: {{PUBLICO_ALVO}}
- Basic Package: {{VALOR_BASICO}}
- Complete Package: {{VALOR_COMPLETO}}
- Payment Method: {{METODO_PAGAMENTO}}
- Payment Details: {{PAGAMENTO_INFO}}
- Guarantee: {{DIAS_GARANTIA}}

=== DELIVERABLES & MATERIALS ===
{{ENTREGAVEIS}}
File tags to send materials: {{TAGS_ARQUIVOS}}

=== PAIN POINTS & BENEFITS ===
Customer Challenges:
{{DORES}}

Main Benefits:
{{BENEFICIOS}}

Objections:
{{OBJECOES}}

=== WHATSAPP VOICE NOTE STRATEGY ===
{{DIRETRIZ_AUDIO}}
- Use [AUDIO: clean voice note text] to send voice messages.
- Golden moments for voice notes: when they share specific challenges or explicitly ask for voice.
- NEVER use brackets or emotion tags like [warm] inside voice notes.

=== MEMORY & CONVERSATIONAL RULES ===
{{HISTORICO_MEMORIA}}
- NEVER repeat greetings ("Hello!", "How are you?") if the conversation is already in progress.
- NEVER repeat questions the customer has already answered.
- Always address the customer's question first.
- NEVER end a message without an engaging question passing the conversational turn to the client.

=== CURRENT CONTEXT ===
{{DIRETRIZ_CONTEXTO}}`,

      countries: {
        'Brasil': '',
        'México': `Eres un asesor comercial mexicano nativo de élite en WhatsApp para {{NOME_PRODUTO}} en México.
Usa expresiones mexicanas cálidas, amables y cercanas (ej: "¡Qué onda! Con todo gusto", "oye", "ahorita te platico", "te paso la info", "está padrísimo", "para orientarte mejor, ¿qué edad tiene tu pequeño o pequeña?", "porfa").

=== DATOS DE LA OFERTA (MÉXICO) ===
- Producto: {{NOME_PRODUTO}}
- Paquete Básico: {{VALOR_BASICO}}
- Paquete Completo: {{VALOR_COMPLETO}}
- Método de Pago: {{METODO_PAGAMENTO}}
- Instrucciones: {{PAGAMENTO_INFO}}
- Garantía: {{DIAS_GARANTIA}}

=== MATERIALES Y ENTREGABLES ===
{{ENTREGAVEIS}}
Etiquetas de archivos: {{TAGS_ARQUIVOS}}

=== ESTRATEGIA DE NOTAS DE VOZ ===
{{DIRETRIZ_AUDIO}}
- Graba nota de voz con [AUDIO: texto hablado mexicano limpio].

=== REGLAS DE MEMORIA Y CIERRE ===
{{HISTORICO_MEMORIA}}
- NUNCA repitas saludos si la conversación ya está abierta.
- Cierra siempre con una pregunta amable pasando la pelota al cliente.

=== CONTEXTO ACTUAL ===
{{DIRETRIZ_CONTEXTO}}`,

        'Colômbia': `Eres un asesor comercial colombiano nativo de élite en WhatsApp para {{NOME_PRODUTO}} en Colombia.
Usa expresiones colombianas amables, educadas y respetuosas (ej: "¡Hola! Con mucho gusto", "chévere", "de una", "listo", "a la orden", "¿qué edad tiene tu niño(a)?").

=== DATOS DE LA OFERTA (COLOMBIA) ===
- Producto: {{NOME_PRODUTO}}
- Paquete Básico: {{VALOR_BASICO}}
- Paquete Completo: {{VALOR_COMPLETO}}
- Método de Pago: {{METODO_PAGAMENTO}} (Nequi / Bre-B)
- Instrucciones: {{PAGAMENTO_INFO}}
- Garantía: {{DIAS_GARANTIA}}

=== MATERIALES Y ENTREGABLES ===
{{ENTREGAVEIS}}
Etiquetas de archivos: {{TAGS_ARQUIVOS}}

=== ESTRATEGIA DE NOTAS DE VOZ ===
{{DIRETRIZ_AUDIO}}
- Graba nota de voz con [AUDIO: texto hablado colombiano cálido y amable].

=== REGLAS DE MEMORIA Y CIERRE ===
{{HISTORICO_MEMORIA}}
- Cierra siempre con una pregunta empática pasando la pelota al cliente.

=== CONTEXTO ACTUAL ===
{{DIRETRIZ_CONTEXTO}}`,

        'Argentina': `Sos un asesor comercial argentino de élite en WhatsApp para {{NOME_PRODUTO}} en Argentina.
Usa expresiones argentinas naturales, fluidas y empáticas (voseo respetuoso, "¡Hola! ¿Cómo estás?", "te cuento", "te paso la info", "fijate", "cualquier duda avisame").

=== DATOS DE LA OFERTA (ARGENTINA) ===
- Producto: {{NOME_PRODUTO}}
- Paquete Básico: {{VALOR_BASICO}}
- Paquete Completo: {{VALOR_COMPLETO}}
- Método de Pago: {{METODO_PAGAMENTO}} (Alias / Transferencia)
- Instrucciones: {{PAGAMENTO_INFO}}
- Garantía: {{DIAS_GARANTIA}}

=== MATERIALES Y ENTREGABLES ===
{{ENTREGAVEIS}}
Etiquetas de archivos: {{TAGS_ARQUIVOS}}

=== ESTRATEGIA DE AUDIO Y CIERRE ===
{{DIRETRIZ_AUDIO}}
- Usa [AUDIO: texto hablado argentino fluido].
- Cierra siempre con una pregunta que invite a responder.

=== CONTEXTO ACTUAL ===
{{DIRETRIZ_CONTEXTO}}`,

        'Bolívia': '',
        'Paraguai': '',
        'Peru': '',
        'Chile': '',
        'Estados Unidos': ''
      }
    };
  }

  // Extract and format all dynamic template variables for system prompts
  buildPromptVariables(leadPhone = '', localeInfo = null, contextDirective = '') {
    const settings = storage.getSettings();
    const product = settings.product || {};
    const deliverables = storage.getDeliverables();

    const locale = localeInfo || this.detectLanguageAndCountry('', [], leadPhone);
    const targetCountry = locale.country || product.targetCountry || 'Brasil';
    const isLatAm = locale.isLatAm;
    const targetLanguage = locale.language || (isLatAm ? 'es' : 'pt');

    // Resolve country-specific pricing
    const countryPrices = product.countryPrices || {};
    const specificCountryPrice = countryPrices[targetCountry] || storage.getCountryPrice(targetCountry);
    const localizedOffer = product.localizedOffers?.[targetCountry] || storage.getLocalizedOffer(targetCountry);

    let resolvedTicketBasic = 0;
    let resolvedTicketComplete = 0;

    if (specificCountryPrice && (specificCountryPrice.ticketBasic > 0 || specificCountryPrice.ticketComplete > 0)) {
      resolvedTicketBasic = Number(specificCountryPrice.ticketBasic) || 0;
      resolvedTicketComplete = Number(specificCountryPrice.ticketComplete) || Math.round(resolvedTicketBasic * 1.6);
    } else if (localizedOffer && (localizedOffer.ticketBasic > 0 || localizedOffer.ticketComplete > 0)) {
      resolvedTicketBasic = Number(localizedOffer.ticketBasic) || 0;
      resolvedTicketComplete = Number(localizedOffer.ticketComplete) || Math.round(resolvedTicketBasic * 1.6);
    } else if (targetCountry === 'Brasil') {
      resolvedTicketBasic = Number(product.ticketBasic) || Number(product.price) || 15;
      resolvedTicketComplete = Number(product.ticketComplete) || 37;
    } else {
      const presetDefaults = {
        'México': { basic: 150, complete: 250 },
        'Colômbia': { basic: 45000, complete: 75000 },
        'Argentina': { basic: 15000, complete: 25000 },
        'Bolívia': { basic: 70, complete: 120 },
        'Paraguai': { basic: 120000, complete: 200000 },
        'Estados Unidos': { basic: 15, complete: 27 }
      };
      const def = presetDefaults[targetCountry] || { basic: 15, complete: 27 };
      resolvedTicketBasic = def.basic;
      resolvedTicketComplete = def.complete;
    }

    let currencyCode = isLatAm
      ? (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : targetCountry === 'Bolívia' ? 'BOB' : targetCountry === 'Paraguai' ? 'PYG' : targetCountry === 'Argentina' ? 'ARS' : 'USD')
      : (product.currencyCode || 'BRL');
    if (specificCountryPrice?.currencyCode) {
      currencyCode = specificCountryPrice.currencyCode;
    } else if (isLatAm && product.currencyCode && product.currencyCode !== 'BRL') {
      currencyCode = product.currencyCode;
    }

    const currencySymbol = specificCountryPrice?.currencySymbol || (isLatAm ? (currencyCode === 'BOB' ? 'Bs' : currencyCode === 'PYG' ? 'Gs' : '$') : (product.currencySymbol || 'R$'));

    // Format prices nicely
    let formattedTicketBasic = '';
    let formattedTicketComplete = '';
    if (targetCountry === 'Brasil' || targetLanguage === 'pt') {
      formattedTicketBasic = `R$ ${Number(resolvedTicketBasic).toFixed(2).replace('.', ',')}`;
      formattedTicketComplete = `R$ ${Number(resolvedTicketComplete).toFixed(2).replace('.', ',')}`;
    } else if (targetCountry === 'Colômbia') {
      formattedTicketBasic = `$ ${Number(resolvedTicketBasic).toLocaleString('es-CO')} COP`;
      formattedTicketComplete = `$ ${Number(resolvedTicketComplete).toLocaleString('es-CO')} COP`;
    } else if (targetCountry === 'Argentina') {
      formattedTicketBasic = `$ ${Number(resolvedTicketBasic).toLocaleString('es-AR')} ARS`;
      formattedTicketComplete = `$ ${Number(resolvedTicketComplete).toLocaleString('es-AR')} ARS`;
    } else if (targetCountry === 'México') {
      formattedTicketBasic = `$ ${resolvedTicketBasic} MXN`;
      formattedTicketComplete = `$ ${resolvedTicketComplete} MXN`;
    } else {
      formattedTicketBasic = `${currencySymbol} ${resolvedTicketBasic} ${currencyCode}`;
      formattedTicketComplete = `${currencySymbol} ${resolvedTicketComplete} ${currencyCode}`;
    }

    // Deliverables
    const deliverableList = deliverables
      .map((d) => {
        if (isLatAm) {
          const cleanDesc = (d.description || '')
            .replace(/atividades/gi, 'actividades')
            .replace(/crianças/gi, 'niños')
            .replace(/alfabetização/gi, 'alfabetización')
            .replace(/inglês/gi, 'inglés');
          return `- ${d.name} (${d.type.toUpperCase()}) | Tag: [${d.tag}] | Descripción: ${cleanDesc}`;
        }
        return `- ${d.name} (${d.type.toUpperCase()}) | Tag: [${d.tag}] | Descrição: ${d.description}`;
      })
      .join('\n') || '- Material Digital Completo | Tag: [PRODUTO]';

    const allDelivTags = deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ') || '[ENVIAR_ARQUIVO: PRODUTO]';

    // Payment details
    let paymentMethodName = 'PIX';
    let paymentInfoDetails = '';
    if (targetCountry === 'México') {
      paymentMethodName = 'SPEI Automático (XPag)';
      paymentInfoDetails = `Transferencia interbancaria SPEI / CLABE única. Activación 100% automática tras la transferencia.`;
    } else if (targetCountry === 'Colômbia') {
      paymentMethodName = 'Nequi / Bre-B';
      paymentInfoDetails = `Número Nequi: ${product.nequiNumber || 'Consulte'} (Titular: ${product.nequiBeneficiary || 'Oficial'}). Solicite comprobante para liberar acceso.`;
    } else if (targetCountry === 'Bolívia') {
      paymentMethodName = 'QR Simple / Banco';
      paymentInfoDetails = `Banco: ${product.boliviaBankName || ''} - Cuenta: ${product.boliviaAccountNumber || ''} (Titular: ${product.boliviaBeneficiary || 'Oficial'}).`;
    } else if (targetCountry === 'Argentina' || targetCountry === 'Paraguai') {
      paymentMethodName = 'Alias / Transferencia';
      paymentInfoDetails = `Clave Alias: ${product.aliasKey || 'Consulte'} (Banco: ${product.aliasBank || ''} - Titular: ${product.aliasBeneficiary || 'Oficial'}).`;
    } else {
      paymentMethodName = 'PIX';
      paymentInfoDetails = `Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'} | Titular: ${product.pixBeneficiary || 'ian alves dos anjos'}. Enviar comprovante para confirmação.`;
    }

    const deliveryStrategy = product.deliveryStrategy || 'require_payment';
    const deliveryGuideline = deliveryStrategy === 'deliver_first'
      ? (isLatAm ? 'Entregar el material completo primero con las etiquetas de archivos y cobrar después.' : 'Entregar o material completo primeiro com as tags de arquivos e cobrar depois.')
      : (isLatAm ? 'Cobro previo: los materiales oficiales se liberan automáticamente tras el pago.' : 'Cobrança prévia: os materiais oficiais são liberados automaticamente após a confirmação do pagamento.');

    const audioGuideline = isLatAm
      ? 'Prioriza notas de voz [AUDIO: ...] de 15 a 25 segundos para generar conexión humana y confianza. NUNCA uses marcadores como [warm] dentro del audio.'
      : 'Priorize notas de voz [AUDIO: ...] de 15 a 25 segundos para gerar conexão humana e confiança. NUNCA use marcadores como [warm] dentro do áudio.';

    return {
      NOME_PRODUTO: product.name || 'Material Educativo',
      NICHO: product.niche || 'Educação Infantil',
      PUBLICO_ALVO: product.targetAudience || 'Mães e pais',
      PAIS: targetCountry,
      IDIOMA: targetLanguage,
      VALOR_BASICO: formattedTicketBasic,
      VALOR_COMPLETO: formattedTicketComplete,
      VALOR_BASICO_NUM: String(resolvedTicketBasic),
      VALOR_COMPLETO_NUM: String(resolvedTicketComplete),
      MOEDA: currencyCode,
      SIMBOLO_MOEDA: currencySymbol,
      METODO_PAGAMENTO: paymentMethodName,
      PAGAMENTO_INFO: paymentInfoDetails,
      ENTREGAVEIS: deliverableList,
      TAGS_ARQUIVOS: allDelivTags,
      DIRETRIZ_AUDIO: audioGuideline,
      DIRETRIZ_ENTREGA: deliveryGuideline,
      DIRETRIZ_CONTEXTO: contextDirective || '',
      DORES: Array.isArray(product.mainPainPoints) && product.mainPainPoints.length ? product.mainPainPoints.join('\n- ') : 'Dificuldades no aprendizado, excesso de telas, falta de tempo',
      BENEFICIOS: Array.isArray(product.mainBenefits) && product.mainBenefits.length ? product.mainBenefits.join('\n- ') : 'Material prático, desenvolvimento cognitivo lúdico, economia de tempo',
      OBJECOES: Array.isArray(product.objections) && product.objections.length
        ? product.objections.map(o => typeof o === 'string' ? o : `${o.question || o.trigger || ''}: ${o.answer || o.response || ''}`).join('\n')
        : 'É seguro? Sim, 100% confiável com garantia e suporte imediato.',
      DIAS_GARANTIA: `${product.guaranteeDays || 7} dias`,
      HISTORICO_MEMORIA: isLatAm
        ? 'Lee atentamente todo el historial de la conversación. Nunca repitas preguntas ya respondidas ni te vuelvas a presentar en conversaciones activas.'
        : 'Leia atentamente todo o histórico da conversa. Nunca repita perguntas já respondidas nem se reapresente em conversas ativas.'
    };
  }

  // Interpolate both {{KEY}} and {KEY} dynamic tags in system prompt
  interpolatePromptVariables(template = '', variables = {}) {
    if (!template || typeof template !== 'string') return '';
    let result = template;

    // Harmonize common aliases (English / Portuguese)
    const allVars = {
      ...variables,
      TARGET_COUNTRY: variables.PAIS || '',
      CURRENCY_CODE: variables.MOEDA || '',
      CURRENCY_SYMBOL: variables.SIMBOLO_MOEDA || '',
      TICKET_BASIC: variables.VALOR_BASICO_NUM || variables.VALOR_BASICO || '',
      TICKET_COMPLETE: variables.VALOR_COMPLETO_NUM || variables.VALOR_COMPLETO || '',
      PRODUCT_NAME: variables.NOME_PRODUTO || '',
      PAYMENT_METHOD: variables.METODO_PAGAMENTO || '',
      PAYMENT_INFO: variables.PAGAMENTO_INFO || ''
    };

    for (const [key, val] of Object.entries(allVars)) {
      const safeVal = val !== undefined && val !== null ? String(val) : '';
      const regexDouble = new RegExp(`\\{\\{${key}\\}\\}`, 'gi');
      const regexSingle = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regexDouble, safeVal).replace(regexSingle, safeVal);
    }
    return result;
  }

  // Render a live preview of what will be sent to the model with all variables resolved
  renderPromptPreview({ language = 'pt', country = 'Brasil', phone = '', customTemplate = null, contextDirective = '' } = {}) {
    const settings = storage.getSettings();
    const sysPrompts = settings.ai?.systemPrompts || {};
    const localeInfo = {
      country: country || 'Brasil',
      language: language || (country === 'Brasil' ? 'pt' : (country === 'Estados Unidos' ? 'en' : 'es')),
      isLatAm: country !== 'Brasil' && country !== 'Estados Unidos'
    };

    const variables = this.buildPromptVariables(phone, localeInfo, contextDirective);

    // Smart engine without an explicit template: show exactly what the model receives
    if (!customTemplate && sysPrompts.mode !== 'custom') {
      const sampleContext = contextDirective || buildTurnContext({
        lang: this.resolvePromptLanguage(localeInfo),
        country: localeInfo.country,
        situation: 'general',
        vars: variables,
        deliveryStrategy: settings.product?.deliveryStrategy || 'require_payment',
        state: { historyCount: 0 }
      });
      const finalPrompt = this.buildSystemPrompt(sampleContext, phone, localeInfo);
      return {
        finalPrompt,
        template: null,
        variables,
        mode: sysPrompts.mode || 'smart_engine',
        country,
        language,
        wordCount: finalPrompt.trim().split(/\s+/).filter(Boolean).length,
        charCount: finalPrompt.length,
        estimatedTokens: Math.ceil(finalPrompt.length / 4)
      };
    }

    // Pick template
    let template = customTemplate || this.pickCustomTemplate(sysPrompts, country, localeInfo.language, localeInfo.isLatAm);

    // If still no custom template, fall back to default template for preview
    if (!template) {
      const defaults = this.getDefaultPromptTemplates();
      if (defaults.countries?.[country]) {
        template = defaults.countries[country];
      } else if (language === 'en') {
        template = defaults.en;
      } else if (localeInfo.isLatAm) {
        template = defaults.es;
      } else {
        template = defaults.pt;
      }
    }

    let finalPrompt = this.interpolatePromptVariables(template, variables);

    if (contextDirective && !template.includes('DIRETRIZ_CONTEXTO')) {
      finalPrompt += `\n\n=== CONTEXTO E DIRETRIZES DO MOMENTO ATUAL ===\n${contextDirective}\n`;
    }

    if (settings.ai?.customPromptInstructions) {
      finalPrompt += `\n\n=== INSTRUÇÕES ADICIONAIS DO USUÁRIO ===\n${settings.ai.customPromptInstructions}\n`;
    }

    const wordCount = finalPrompt.trim().split(/\s+/).filter(Boolean).length;
    const charCount = finalPrompt.length;
    const estimatedTokens = Math.ceil(charCount / 4);

    return {
      finalPrompt,
      template,
      variables,
      mode: sysPrompts.mode || 'smart_engine',
      country,
      language,
      wordCount,
      charCount,
      estimatedTokens
    };
  }

  // Prompt language for instructions: 'pt' (Brasil), 'es' (LatAm) or 'en'
  resolvePromptLanguage(locale = {}) {
    if (locale.language === 'en') return 'en';
    return locale.isLatAm ? 'es' : 'pt';
  }

  // Pick the operator's custom template for this country/language (custom mode)
  pickCustomTemplate(sysPrompts = {}, country = 'Brasil', language = 'pt', isLatAm = false) {
    const pick = (t) => (t && String(t).trim()) || null;
    return pick(sysPrompts.countries?.[country])
      || (language === 'en' ? pick(sysPrompts.en) : null)
      || (isLatAm ? pick(sysPrompts.es) : null)
      || (!isLatAm && language === 'pt' ? pick(sysPrompts.pt) : null);
  }

  // Build the system prompt sent to the sales AI.
  // turnContext = dynamic block (conversation state + focus for this reply), always appended last.
  buildSystemPrompt(turnContext = '', leadPhone = '', localeInfo = null) {
    const settings = storage.getSettings();
    const product = settings.product || {};
    const sysPrompts = settings.ai?.systemPrompts || {};

    const locale = localeInfo || this.detectLanguageAndCountry('', [], leadPhone);
    const targetCountry = locale.country || product.targetCountry || 'Brasil';
    const isLatAm = locale.isLatAm;
    const targetLanguage = locale.language || (isLatAm ? 'es' : 'pt');
    const variables = this.buildPromptVariables(leadPhone, locale, turnContext);

    const operatorInstructions = settings.ai?.customPromptInstructions
      ? this.interpolatePromptVariables(settings.ai.customPromptInstructions, variables).trim()
      : '';

    // Custom template mode: operator-defined template with {{VARIABLES}}
    if (sysPrompts.mode === 'custom') {
      const customTemplate = this.pickCustomTemplate(sysPrompts, targetCountry, targetLanguage, isLatAm);
      if (customTemplate) {
        let rendered = this.interpolatePromptVariables(customTemplate, variables);
        if (turnContext && !customTemplate.includes('DIRETRIZ_CONTEXTO')) {
          rendered += `\n\n${turnContext}\n`;
        }
        if (operatorInstructions) {
          rendered += `\n\n# INSTRUÇÕES ADICIONAIS DO OPERADOR\n${operatorInstructions}\n`;
        }
        return rendered;
      }
    }

    // Smart engine (default)
    return buildSalesPrompt({
      lang: this.resolvePromptLanguage(locale),
      country: targetCountry,
      vars: variables,
      locProd: this.localizeProductForPrompt(product, targetLanguage, targetCountry),
      product,
      deliverables: storage.getDeliverables(),
      audioEnabled: settings.fishAudio?.enabled !== false,
      xpagCharge: targetCountry === 'México' && leadPhone ? storage.getXpagCharge(leadPhone) : null,
      operatorInstructions,
      turnContext
    });
  }

  // Anti-Leak & Meta-Commentary Sanitizer: Guarantees zero system instructions, CoT or developer notes leak to WhatsApp
  sanitizeModelOutput(rawText, targetLanguage = 'pt', targetCountry = 'Brasil') {
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
        const langStartMatch = content.match(/(?:[A-ZÀ-Ú¡¿][a-zà-ú]+[\s\S]*?\[AUDIO:[\s\S]*?\]|\[AUDIO:[\s\S]*?\])/i);
        if (langStartMatch) {
          content = langStartMatch[0].trim();
        }
      }
    }

    // 3. Strip AI assistant meta-commentary (talking to programmer/operator instead of the customer)
    content = content.replace(/^(?:Entendi(?:\s+perfeitamente)?|Com certeza|Claro que sim|Claro|Perfeito|Certo|Entendido)[!,.]?\s*(?:Aqui está|Segue|Abaixo está|Veja|vou te mandar|essa é a resposta|aquí está)[\s\S]*?:(?:\n+|\s+)/i, '').trim();
    content = content.replace(/^(?:Aqui está a resposta|Aqui está a mensagem|Segue a mensagem|Segue o texto que você deve enviar|Aquí tienes la respuesta|Aquí está el mensaje)[\s\S]*?:(?:\n+|\s+)/i, '').trim();
    content = content.replace(/\n+(?:Essa resposta segue rigorosamente|Espero que ajude|Qualquer dúvida estou à disposição|Se precisar de mais alguma coisa|Como posso te ajudar agora\?|Já tem algum lead aguardando)[\s\S]*?$/i, '').trim();

    // 4. Strip any leaked internal prompt headers, tags or rules
    content = content.replace(/\[\s*(?:DIRETRIZ|FASE|REGRA|INSTRUÇÃO|ATENÇÃO|ESTRUTURA|COMO RESPONDER|CONTEXTO|SITUAÇÃO|DIRECTIVA|REGLA|INSTRUCCIÓN|ATENCIÓN)[^\]]*\]:?/gi, '').trim();
    content = content.replace(/^[-•◆*]?\s*(?:DIRETRIZ DE FUNIL|OFERTA INVERTIDA|FECHAMENTO EMOCIONAL|LIBERAÇÃO DE TUDO|CONEXÃO INICIAL|DIRETRIZ MÁXIMA|INSTRUÇÃO DO MOMENTO|SITUAÇÃO ATUAL|DIRECTIVA DE CONTEXTO|REGLA SUPREMA)[\s\S]*?(?:\n|$)/gmi, '').trim();
    content = content.replace(/^O cliente JÁ RECEBEU TUDO[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^NUNCA diga ["'“]amostra["'”]?[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^NUNCA diga [*_]?libero o restante[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^REGRA (?:CRÍTICA|SUPREMA|ABSOLUTA):[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^ATENÇÃO (?:MÁXIMA|SUPREMA|ABSOLUTA):[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^Sua mensagem DEVE seguir rigorosamente esta estrutura:?[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^ESTRUTURA OBRIGATÓRIA DA SUA RESPOSTA:?[^\n]*\n?/gmi, '').trim();
    content = content.replace(/^Como agir conforme a análise:?[^\n]*\n?/gmi, '').trim();
    content = content.replace(/\[\s*(?:idade|edad|anos?|años?|nome|nombre|meses)\s*\]/gi, '').replace(/[ ]{2,}/g, ' ').trim();

    // 5. Emergency Language Firewall: If targetLanguage is Spanish ('es'), convert any leaked Portuguese product phrasing to native Spanish
    if (targetLanguage === 'es') {
      content = content
        .replace(/nosso material foi pensado para que as crianças aprendam inglês de forma muito leve, sem aquela pressão de escola tradicional\.?/gi, 'Nuestro material está pensado para que los pequeños aprendan inglés jugando de forma súper divertida, sin la presión de la escuela tradicional.')
        .replace(/são atividades super interativas e coloridas que você pode imprimir e aplicar em casa mesmo\.?/gi, 'Son actividades súper interactivas y coloridas que puedes imprimir y realizar en casa mismo.')
        .replace(/a ideia é que elas aprendam brincando e já comecem a falar algumas palavras nas primeiras semanas!?/gi, '¡La idea es que aprendan jugando y ya comiencen a decir sus primeras palabras en inglés desde las primeras semanas!')
        .replace(/para eu te ajudar melhor, qual a idade do seu pequeno ou da pequena\??/gi, 'Para orientarte mejor, ¿qué edad tiene tu pequeño o pequeña?')
        .replace(/qual a idade do seu pequeno ou da pequena\??/gi, '¿Qué edad tiene tu pequeño o pequeña?')
        .replace(/qual a idade do seu pequeno\??/gi, '¿Qué edad tiene tu pequeño?')
        .replace(/qual a idade da sua pequena\??/gi, '¿Qué edad tiene tu pequeña?')
        .replace(/\bnosso material\b/gi, 'nuestro material')
        .replace(/\bnossa proposta\b/gi, 'nuestra propuesta')
        .replace(/\bnossos materiais\b/gi, 'nuestros materiales')
        .replace(/\bpara as crianças\b/gi, 'para los niños')
        .replace(/\bas crianças\b/gi, 'los niños')
        .replace(/\bcrianças\b/gi, 'niños')
        .replace(/\bcriança\b/gi, 'niño(a)')
        .replace(/\bfilhos\b/gi, 'hijos')
        .replace(/\bfilho\b/gi, 'hijo')
        .replace(/\bpequenos\b/gi, 'pequeños')
        .replace(/\bpequeno\b/gi, 'pequeño')
        .replace(/\bpequena\b/gi, 'pequeña')
        .replace(/\baprenderem brincando\b/gi, 'aprendan jugando')
        .replace(/\baprender brincando\b/gi, 'aprender jugando')
        .replace(/\bcom certeza\b/gi, '¡claro que sí!')
        .replace(/\bvocê pode\b/gi, 'puedes')
        .replace(/\bvocê prefere\b/gi, 'prefieres')
        .replace(/\bvocê quer\b/gi, 'quieres')
        .replace(/\bvocê\b/gi, 'tú')
        .replace(/\bvocês\b/gi, 'ustedes')
        .replace(/\bpra você\b/gi, 'para ti')
        .replace(/\bpara você\b/gi, 'para ti')
        .replace(/\bqual o valor\b/gi, 'cuál es el costo')
        .replace(/\bquanto custa\b/gi, 'cuánto cuesta')
        .replace(/\btá bom\??/gi, '¿te parece?')
        .replace(/\btudo bem\??/gi, '¿cómo estás?')
        .replace(/\bdá uma olhadinha\b/gi, 'échale un vistazo')
        .replace(/\bum abraço\b/gi, 'un abrazo grande');
    }

    return content.trim();
  }

  // Call single NIM model with configurable timeout (default 180s = 3 minutes)
  async callModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 180000, targetLanguage = 'pt', targetCountry = 'Brasil') {
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
      const content = this.sanitizeModelOutput(response.data.choices[0].message.content, targetLanguage, targetCountry);
      if (content.length > 0) {
        return content;
      }
    }

    // NEVER return reasoning_content or internal thinking to WhatsApp!
    throw new Error('Modelo retornou conteúdo vazio ou apenas tokens de raciocínio interno.');
  }

  // Call OpenRouter model (e.g. google/gemini-3.8-flash, nvidia/nemotron-3.5-lightning:free)
  async callOpenRouterModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 45000, targetLanguage = 'pt', targetCountry = 'Brasil') {
    if (!apiKey) {
      throw new Error(`OpenRouter API Key não configurada para o modelo ${model}`);
    }

    const isGemini = String(model).toLowerCase().includes('gemini');
    // WhatsApp replies should be concise (max 600-800 tokens), also prevents OpenRouter credit check 402 errors on low balance
    const safeMaxTokens = Math.min(Number(maxTokens) || 600, 800);

    const payload = {
      model,
      messages,
      temperature,
      max_tokens: safeMaxTokens,
      top_p: 0.95
    };

    // For reasoning-capable models (e.g. Gemini 3.8 Flash), cap reasoning tokens to maximize speed & credit efficiency
    // OpenRouter rejects calls if both reasoning.effort and reasoning.max_tokens or reasoning_effort are sent together.
    if (isGemini || String(model).includes('flash') || String(model).includes('reasoning')) {
      payload.reasoning = { max_tokens: 50 };
    }

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
      const content = this.sanitizeModelOutput(choice.message.content || '', targetLanguage, targetCountry);
      if (content.length > 0) {
        return content;
      }
    }

    throw new Error('Modelo OpenRouter retornou conteúdo vazio ou apenas tokens de raciocínio interno.');
  }

  // Helper to format messages for Google's native Gemini generateContent API
  formatGeminiNativePayload(messages, temperature = 0.7, maxTokens = 1500) {
    let systemText = '';
    const rawTurns = [];

    for (const msg of messages || []) {
      const text = (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '')).trim();
      if (!text) continue;

      if (msg.role === 'system') {
        systemText = systemText ? `${systemText}\n\n${text}` : text;
      } else if (msg.role === 'user') {
        rawTurns.push({ role: 'user', text });
      } else if (msg.role === 'assistant' || msg.role === 'model') {
        rawTurns.push({ role: 'model', text });
      }
    }

    // Google Gemini Native API rules:
    // 1. Roles must strictly alternate: user -> model -> user -> model
    // 2. Conversation history must begin with 'user'
    const consolidatedTurns = [];
    for (const turn of rawTurns) {
      if (consolidatedTurns.length === 0) {
        if (turn.role === 'model') {
          consolidatedTurns.push({ role: 'user', text: 'Olá' });
        }
        consolidatedTurns.push({ ...turn });
      } else {
        const lastTurn = consolidatedTurns[consolidatedTurns.length - 1];
        if (lastTurn.role === turn.role) {
          // Merge consecutive same-role turns into a single turn to avoid HTTP 400 alternating error
          lastTurn.text = `${lastTurn.text}\n${turn.text}`;
        } else {
          consolidatedTurns.push({ ...turn });
        }
      }
    }

    if (consolidatedTurns.length === 0) {
      consolidatedTurns.push({ role: 'user', text: 'Olá' });
    }

    const contents = consolidatedTurns.map(t => ({
      role: t.role,
      parts: [{ text: t.text }]
    }));

    const payload = {
      contents,
      generationConfig: {
        temperature: Math.max(0, Math.min(2, Number(temperature) || 0.7)),
        maxOutputTokens: Math.max(100, Math.min(8192, Number(maxTokens) || 1500))
      }
    };

    if (systemText) {
      payload.systemInstruction = {
        parts: [{ text: systemText }]
      };
    }

    return payload;
  }
  // Direct Azure AI Foundry Project / Model Inference API call
  async callAzureFoundry({
    endpoint,
    model,
    apiKey,
    messages,
    temperature = 0.7,
    maxTokens = 1500,
    timeoutMs = 60000,
    targetLanguage = 'pt',
    targetCountry = 'Brasil'
  }) {
    const cleanKey = (
      apiKey ||
      storage.getSettings().ai?.primaryApiKey ||
      process.env.AZURE_AI_API_KEY ||
      process.env.AZURE_OPENAI_API_KEY ||
      ''
    ).trim();

    if (!cleanKey) {
      throw new Error(`Azure AI Foundry API Key não configurada! Insira sua chave no painel de configurações de IA.`);
    }

    const rawEndpoint = (
      endpoint ||
      storage.getSettings().ai?.primaryEndpoint ||
      storage.getSettings().ai?.azureEndpoint ||
      process.env.AZURE_AI_FOUNDRY_URL ||
      'https://agoravai.services.ai.azure.com/api/projects/proj-default'
    ).trim().replace(/\/+$/, '');

    const cleanModel = String(model || 'gpt-4o').replace(/^azure\//i, '').trim();

    // Candidate routes for Azure AI Foundry
    const candidateUrls = [];

    // 1. Project route (e.g. https://<res>.services.ai.azure.com/api/projects/<proj>/openai/v1/chat/completions)
    if (rawEndpoint.includes('/api/projects/')) {
      candidateUrls.push(`${rawEndpoint}/openai/v1/chat/completions`);
      candidateUrls.push(`${rawEndpoint}/chat/completions`);
    }

    if (rawEndpoint.endsWith('/chat/completions')) {
      candidateUrls.unshift(rawEndpoint);
    } else if (rawEndpoint.endsWith('/openai/v1')) {
      candidateUrls.unshift(`${rawEndpoint}/chat/completions`);
    }

    // 2. Resource base routes (e.g. https://agoravai.services.ai.azure.com)
    const resourceBase = rawEndpoint.split('/api/projects')[0];
    if (resourceBase && resourceBase !== rawEndpoint) {
      candidateUrls.push(`${resourceBase}/models/chat/completions?api-version=2024-05-01-preview`);
      candidateUrls.push(`${resourceBase}/openai/deployments/${cleanModel}/chat/completions?api-version=2024-05-01-preview`);
      candidateUrls.push(`${resourceBase}/openai/v1/chat/completions`);
    }

    const uniqueUrls = [...new Set(candidateUrls)];

    const formattedMessages = (messages || []).map(m => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
    }));

    const openAiPayload = {
      model: cleanModel,
      messages: formattedMessages,
      temperature: Math.max(0, Math.min(2, Number(temperature) || 0.7)),
      max_tokens: Number(maxTokens) || 1500
    };

    const headers = {
      'Content-Type': 'application/json',
      'api-key': cleanKey,
      'Authorization': `Bearer ${cleanKey}`
    };

    let lastError = null;

    for (const targetUrl of uniqueUrls) {
      try {
        const response = await axios.post(targetUrl, openAiPayload, {
          headers,
          timeout: timeoutMs
        });

        if (response.data?.choices && response.data.choices[0]?.message?.content) {
          const raw = response.data.choices[0].message.content;
          const text = typeof raw === 'string'
            ? raw
            : (Array.isArray(raw) ? raw.map(p => p.text || '').join('') : String(raw || ''));
          if (text && text.trim().length > 0) {
            return this.sanitizeModelOutput(text.trim(), targetLanguage, targetCountry);
          }
        }

        if (response.data?.message?.content) {
          return this.sanitizeModelOutput(response.data.message.content, targetLanguage, targetCountry);
        }
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const errMsg = err.response?.data?.error?.message || err.response?.data?.message || err.message;
        console.warn(`[Azure Foundry (${targetUrl}) - status ${status}]: ${errMsg}`);

        if (status === 401 || status === 403) {
          throw new Error(`Chave do Azure AI Foundry inválida ou não autorizada: ${errMsg}`);
        }

        if (status === 400 && (String(errMsg).toLowerCase().includes('model') || String(errMsg).toLowerCase().includes('deployment'))) {
          throw new Error(`Modelo/Deployment do Azure AI Foundry (${cleanModel}) não encontrado: ${errMsg}`);
        }

        continue;
      }
    }

    const finalErrMsg = lastError?.response?.data?.error?.message ||
                        lastError?.response?.data?.message ||
                        lastError?.message ||
                        'Falha na chamada à API do Azure AI Foundry';
    throw new Error(`Azure AI Foundry Direto erro: ${finalErrMsg}`);
  }

  // Direct Google Gemini API call (Native Generative Language API + OpenAI-compatible backup)
  async callGoogleGeminiDirect(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 60000, targetLanguage = 'pt', targetCountry = 'Brasil') {
    const cleanKey = (apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!cleanKey) {
      throw new Error(`Google Gemini API Key não configurada! Insira sua chave (AIza... ou AQ...) no painel de configurações de IA.`);
    }

    const requestedModel = String(model || 'gemini-3.8-flash').replace(/^google\//i, '').trim();

    // Priority candidate models for Google Gemini Direct (verified active in Google AI Studio)
    const candidateModels = [
      requestedModel,
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash'
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let lastError = null;

    // 1. Try Native Google Generative Language API (Official, resilient and direct)
    for (const mod of candidateModels) {
      try {
        const payload = this.formatGeminiNativePayload(messages, temperature, maxTokens);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${encodeURIComponent(cleanKey)}`;

        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          timeout: timeoutMs
        });

        if (response.data && response.data.candidates && response.data.candidates[0]?.content?.parts) {
          const parts = response.data.candidates[0].content.parts;
          const textParts = parts.filter(p => p.text && !p.thought).map(p => p.text);
          const rawText = textParts.join('').trim() || parts.map(p => p.text || '').join('').trim();
          if (rawText && rawText.length > 0) {
            return this.sanitizeModelOutput(rawText, targetLanguage, targetCountry);
          }
        }
      } catch (nativeErr) {
        lastError = nativeErr;
        const status = nativeErr.response?.status;
        const errData = nativeErr.response?.data;
        const errMsg = errData?.error?.message || nativeErr.message;
        console.warn(`[Google Gemini Nativo (${mod}) - status ${status}]: ${errMsg}`);

        // If API key is rejected as invalid, abort immediately to show user
        if (status === 400 && (String(errMsg).toLowerCase().includes('api key not valid') || String(errMsg).toLowerCase().includes('pass a valid api key') || String(errMsg).toLowerCase().includes('api_key_invalid'))) {
          throw new Error(`Chave do Google Gemini inválida: ${errMsg}`);
        }

        // On 404, 503 (high demand) or 400 (unsupported model in this tier), continue to next candidate model
        continue;
      }
    }

    // 2. Try Google OpenAI-compatible endpoint with both Bearer and x-goog-api-key
    for (const mod of candidateModels) {
      try {
        const openAiPayload = {
          model: mod,
          messages: (messages || []).map(m => ({
            role: m.role === 'model' ? 'assistant' : m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')
          })),
          temperature: Math.max(0, Math.min(2, Number(temperature) || 0.7)),
          max_tokens: Number(maxTokens) || 1500
        };

        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions?key=${encodeURIComponent(cleanKey)}`,
          openAiPayload,
          {
            headers: {
              Authorization: `Bearer ${cleanKey}`,
              'x-goog-api-key': cleanKey,
              'Content-Type': 'application/json'
            },
            timeout: timeoutMs
          }
        );

        if (response.data && response.data.choices && response.data.choices[0]?.message?.content) {
          const content = this.sanitizeModelOutput(response.data.choices[0].message.content, targetLanguage, targetCountry);
          if (content && content.length > 0) {
            return content;
          }
        }
      } catch (openAiErr) {
        lastError = openAiErr;
        const status = openAiErr.response?.status;
        const errMsg = openAiErr.response?.data?.[0]?.error?.message || openAiErr.response?.data?.error?.message || openAiErr.message;
        console.warn(`[Google Gemini OpenAI (${mod}) - status ${status}]: ${errMsg}`);

        if (status === 400 && (String(errMsg).toLowerCase().includes('api key not valid') || String(errMsg).toLowerCase().includes('pass a valid api key'))) {
          throw new Error(`Chave do Google Gemini inválida: ${errMsg}`);
        }
      }
    }

    const finalErrMsg = lastError?.response?.data?.error?.message ||
                        lastError?.response?.data?.[0]?.error?.message ||
                        lastError?.message ||
                        'Falha na chamada direta à API do Google Gemini';
    throw new Error(`Google Gemini Direto erro: ${finalErrMsg}`);
  }

  // Universal Model Dispatcher
  async callAnyModel({
    model,
    apiKey,
    endpoint,
    messages,
    temperature = 0.7,
    maxTokens = 1500,
    timeoutMs = 60000,
    targetLanguage = 'pt',
    targetCountry = 'Brasil',
    tierName = 'primary'
  }) {
    const allSettings = storage.getSettings();
    const aiConfig = allSettings.ai || {};
    const cleanModel = (model || aiConfig.primaryModel || 'gpt-4o').trim();

    // Check providers
    const isGoogle = cleanModel.toLowerCase().includes('gemini') || cleanModel.startsWith('google/');
    const isOpenRouter = tierName === 'tertiary' || cleanModel.endsWith(':free') || (apiKey && apiKey.startsWith('sk-or-'));
    const isNvidiaNim = tierName === 'fallback' || cleanModel.startsWith('z-ai/') || cleanModel.startsWith('nvidia/') || (apiKey && apiKey.startsWith('nvapi-'));

    // 1. Primary Model: ALWAYS Azure AI Foundry
    if (tierName === 'primary' || cleanModel.startsWith('azure/') || (!isGoogle && !isOpenRouter && !isNvidiaNim)) {
      const azureKey = (
        apiKey ||
        aiConfig.primaryApiKey ||
        process.env.AZURE_AI_API_KEY ||
        process.env.AZURE_OPENAI_API_KEY ||
        ''
      ).trim();

      const azureEndpoint = (
        endpoint ||
        aiConfig.primaryEndpoint ||
        aiConfig.azureEndpoint ||
        process.env.AZURE_AI_FOUNDRY_URL ||
        'https://agoravai.services.ai.azure.com/api/projects/proj-default'
      ).trim();

      return await this.callAzureFoundry({
        endpoint: azureEndpoint,
        model: cleanModel,
        apiKey: azureKey,
        messages,
        temperature,
        maxTokens,
        timeoutMs,
        targetLanguage,
        targetCountry
      });
    }

    // Google Gemini Direct
    if (isGoogle) {
      const googleKey = (
        apiKey ||
        aiConfig.primaryApiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        ''
      ).trim();

      return await this.callGoogleGeminiDirect(
        cleanModel,
        googleKey,
        messages,
        temperature,
        maxTokens,
        timeoutMs,
        targetLanguage,
        targetCountry
      );
    }

    // 2. Tertiary Model: OpenRouter
    if (isOpenRouter) {
      const openRouterKey = (
        (apiKey && apiKey.startsWith('sk-or-') ? apiKey : null) ||
        aiConfig.tertiaryApiKey ||
        process.env.OPENROUTER_API_KEY ||
        allSettings.fishAudio?.apiKey ||
        allSettings.vision?.apiKey
      )?.trim();

      if (!openRouterKey) {
        throw new Error(`OpenRouter API Key necessária para o modelo ${cleanModel}. Configure em Configurações de IA.`);
      }

      return await this.callOpenRouterModel(
        cleanModel,
        openRouterKey,
        messages,
        temperature,
        maxTokens,
        timeoutMs,
        targetLanguage,
        targetCountry
      );
    }

    // 3. Secondary / Fallback Model: NVIDIA NIM
    const nvidiaKey = (
      (apiKey && !apiKey.startsWith('sk-or-') && !apiKey.startsWith('AIza') ? apiKey : null) ||
      aiConfig.fallbackApiKey ||
      aiConfig.primaryApiKey ||
      process.env.NVIDIA_NIM_PRIMARY_API_KEY ||
      process.env.NVIDIA_NIM_FALLBACK_API_KEY
    )?.trim();

    if (!nvidiaKey) {
      throw new Error(`NVIDIA NIM API Key necessária para o modelo ${cleanModel}.`);
    }

    return await this.callModel(
      cleanModel,
      nvidiaKey,
      messages,
      temperature,
      maxTokens,
      timeoutMs,
      targetLanguage,
      targetCountry
    );
  }

  // Smart Unified Model Caller: Routes dynamically based on API key prefix and provider type
  async callConfiguredTier({ model, apiKey, endpoint, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 60000, targetLanguage = 'pt', targetCountry = 'Brasil', tierName = null }) {
    if (!apiKey) throw new Error('API Key não configurada.');
    const cleanKey = String(apiKey).trim();
    const cleanModel = String(model || '').trim();

    const isGoogleModel = cleanModel.startsWith('google/') || cleanModel.toLowerCase().includes('gemini');
    const isGoogleKey = cleanKey.startsWith('AIza');
    const isNvidiaKey = cleanKey.startsWith('nvapi-');
    const isOpenRouterKey = cleanKey.startsWith('sk-or-') || cleanModel.endsWith(':free');

    // 1. Azure AI Foundry (Primary default or generic keys)
    if (tierName === 'primary' || (!isGoogleModel && !isGoogleKey && !isNvidiaKey && !isOpenRouterKey)) {
      const azureEndpoint = (endpoint || storage.getSettings().ai?.primaryEndpoint || process.env.AZURE_AI_FOUNDRY_URL || 'https://agoravai.services.ai.azure.com/api/projects/proj-default').trim();
      return await this.callAzureFoundry({
        endpoint: azureEndpoint,
        model: cleanModel || 'gpt-4o',
        apiKey: cleanKey,
        messages,
        temperature,
        maxTokens,
        timeoutMs,
        targetLanguage,
        targetCountry
      });
    }

    // 2. Google Gemini models
    if (isGoogleModel || isGoogleKey) {
      if (cleanKey.startsWith('AIza')) {
        return await this.callGoogleGeminiDirect(cleanModel, cleanKey, messages, temperature, maxTokens, timeoutMs, targetLanguage, targetCountry);
      }
      const openRouterKey = cleanKey.startsWith('sk-or-')
        ? cleanKey
        : (storage.getSettings().ai?.tertiaryApiKey || process.env.OPENROUTER_API_KEY || storage.getSettings().fishAudio?.apiKey || '').trim();
      if (openRouterKey && openRouterKey.startsWith('sk-or-')) {
        return await this.callOpenRouterModel(cleanModel, openRouterKey, messages, temperature, maxTokens, Math.min(timeoutMs, 45000), targetLanguage, targetCountry);
      }
      return await this.callGoogleGeminiDirect(cleanModel, cleanKey, messages, temperature, maxTokens, timeoutMs, targetLanguage, targetCountry);
    }

    // 3. OpenRouter models or keys
    if (isOpenRouterKey) {
      return await this.callOpenRouterModel(cleanModel, cleanKey, messages, temperature, maxTokens, Math.min(timeoutMs, 45000), targetLanguage, targetCountry);
    }

    // 4. NVIDIA NIM (nvapi-...)
    if (isNvidiaKey) {
      return await this.callModel(cleanModel, cleanKey, messages, temperature, maxTokens, timeoutMs, targetLanguage, targetCountry);
    }

    // Default: try Azure Foundry first, then NIM
    try {
      const azureEndpoint = (endpoint || storage.getSettings().ai?.primaryEndpoint || 'https://agoravai.services.ai.azure.com/api/projects/proj-default').trim();
      return await this.callAzureFoundry({
        endpoint: azureEndpoint,
        model: cleanModel || 'gpt-4o',
        apiKey: cleanKey,
        messages,
        temperature,
        maxTokens,
        timeoutMs,
        targetLanguage,
        targetCountry
      });
    } catch {
      return await this.callModel(cleanModel, cleanKey, messages, temperature, maxTokens, timeoutMs, targetLanguage, targetCountry);
    }
  }

  // Generate sales response with automatic primary -> secondary fallback
  async generateResponse(phone, userMessage, conversationHistory = []) {
    const settings = storage.getSettings().ai;
    const product = storage.getSettings().product || {};
    const deliverables = storage.getDeliverables();
    const leadObj = storage.getLead(phone);

    const localeInfo = this.detectLanguageAndCountry(userMessage, conversationHistory, phone);
    const targetCountry = localeInfo.country;
    const targetLanguage = localeInfo.language;

    // Conversation state (derived from history)
    const history = conversationHistory || [];
    const materialsSent = history.some(m => m.fromMe && m.text && (
      m.text.includes('📎 [Enviado]:') ||
      m.text.includes('📎 [Arquivo]:') ||
      m.text.includes('📎 [Documento]:')
    ));
    const paymentSent = history.some(m => m.fromMe && m.text && (
      (product.pixKey && m.text.includes(product.pixKey)) ||
      (product.nequiNumber && m.text.includes(product.nequiNumber)) ||
      (product.aliasKey && m.text.includes(product.aliasKey)) ||
      /Chave PIX|TRANSFERENCIA SPEI|CLABE:|DATOS OFICIALES|SPEI|Nequi|Alias/.test(m.text)
    ));
    const isPaid = leadObj?.stage === 'APROVADO' || leadObj?.lastReceiptStatus === 'APROVADO';

    // Turn-specific context: state + focus for this reply (goes at the end of the system prompt)
    const situation = detectTurnSituation(userMessage, { isPaid, hasPaymentBeenSent: paymentSent });
    const vars = this.buildPromptVariables(phone, localeInfo);
    const allTags = deliverables.length > 0
      ? deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ')
      : '[ENVIAR_ARQUIVO: PRODUTO]';

    const turnContext = buildTurnContext({
      lang: this.resolvePromptLanguage(localeInfo),
      country: targetCountry,
      situation,
      vars,
      deliveryStrategy: product.deliveryStrategy || 'require_payment',
      allTags,
      state: { historyCount: history.length, materialsSent, paymentSent, isPaid }
    });

    const systemPrompt = this.buildSystemPrompt(turnContext, phone, localeInfo);

    // Build context message array
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Take up to 60 messages from conversation history (guarantees complete dialogue memory without losing early details)
    const allHistory = (conversationHistory || []).slice(-60);

    // Smart context deduplication:
    let lastAssistantIdx = -1;
    for (let i = allHistory.length - 1; i >= 0; i--) {
      if (allHistory[i].fromMe) {
        lastAssistantIdx = i;
        break;
      }
    }

    const trailingUserMsgs = allHistory.slice(lastAssistantIdx + 1);
    const trailingUserText = trailingUserMsgs.map(m => (m.text || '').trim()).filter(Boolean).join('\n');

    if (trailingUserMsgs.length > 0 && userMessage && (
      trailingUserText === userMessage.trim() ||
      trailingUserMsgs.some(m => (m.text || '').trim() === userMessage.trim()) ||
      userMessage.trim().includes(trailingUserText)
    )) {
      const priorHistory = allHistory.slice(0, lastAssistantIdx + 1);
      for (const h of priorHistory) {
        const textContent = h.text || (h.type === 'audio' ? '🎵 [Áudio]' : h.type === 'image' ? '📷 [Imagem]' : '📎 [Arquivo]');
        messages.push({
          role: h.fromMe ? 'assistant' : 'user',
          content: textContent
        });
      }
      messages.push({ role: 'user', content: userMessage });
    } else {
      for (const h of allHistory) {
        const textContent = h.text || (h.type === 'audio' ? '🎵 [Áudio]' : h.type === 'image' ? '📷 [Imagem]' : '📎 [Arquivo]');
        messages.push({
          role: h.fromMe ? 'assistant' : 'user',
          content: textContent
        });
      }
      if (userMessage && (messages.length === 1 || messages[messages.length - 1].content !== userMessage)) {
        messages.push({ role: 'user', content: userMessage });
      }
    }

    let responseText = null;
    let modelUsed = settings.primaryModel || 'gpt-4o';

    // 1. Try Primary Model (Azure AI Foundry)
    try {
      const primaryModel = settings.primaryModel || 'gpt-4o';
      const primaryKey = (settings.primaryApiKey || process.env.AZURE_AI_API_KEY || process.env.AZURE_OPENAI_API_KEY || '').trim();
      const primaryEndpoint = (settings.primaryEndpoint || process.env.AZURE_AI_FOUNDRY_URL || 'https://agoravai.services.ai.azure.com/api/projects/proj-default').trim();
      modelUsed = primaryModel;

      if (!primaryKey) {
        throw new Error('Chave de API do Azure AI Foundry (Primário) não configurada no painel de configurações.');
      }

      responseText = await this.callConfiguredTier({
        model: primaryModel,
        apiKey: primaryKey,
        endpoint: primaryEndpoint,
        messages,
        temperature: settings.temperature ?? 0.7,
        maxTokens: settings.maxTokens || 1500,
        timeoutMs: 60000,
        targetLanguage,
        targetCountry,
        tierName: 'primary'
      });

      this.lastPrimaryFailureTime = 0;
      if (settings.isFallbackActive) {
        storage.updateSettings({ ai: { isFallbackActive: false, lastFallbackReason: null } });
        storage.addLog('INFO', `Modelo Primário (${modelUsed}) restabelecido com sucesso.`);
      }
      return { text: responseText, modelUsed, fallbackTriggered: false, locale: localeInfo };
    } catch (primaryErr) {
      this.lastPrimaryFailureTime = Date.now();
      console.warn(`[AI Primary Error (${modelUsed})]: ${primaryErr.message}`);
      storage.addLog(
        'FALLBACK_TRIGGERED',
        `Modelo Primário (${modelUsed}) falhou (${primaryErr.message}). Acionando fallback secundário.`
      );
      storage.updateSettings({
        ai: {
          isFallbackActive: true,
          lastFallbackReason: primaryErr.message
        }
      });
    }

    // 2. Try Fallback Model
    try {
      const fallbackModel = settings.fallbackModel || 'nvidia/nemotron-3.5-super-vl-120b-a12b';
      const fallbackKey = (settings.fallbackApiKey || process.env.NVIDIA_NIM_FALLBACK_API_KEY || process.env.NVIDIA_NIM_PRIMARY_API_KEY || '').trim();
      
      if (fallbackKey) {
        modelUsed = fallbackModel;
        responseText = await this.callConfiguredTier({
          model: fallbackModel,
          apiKey: fallbackKey,
          messages,
          temperature: settings.temperature ?? 0.7,
          maxTokens: settings.maxTokens || 1500,
          timeoutMs: 60000,
          targetLanguage,
          targetCountry
        });
        return { text: responseText, modelUsed, fallbackTriggered: true, fallbackTier: 'secondary_fallback', locale: localeInfo };
      }
    } catch (fallbackErr) {
      console.error(`[AI Fallback Error]: ${fallbackErr.message}`);
      storage.addLog(
        'WARNING',
        `Modelo Secundário falhou (${fallbackErr.message}). Acionando 3º Fallback.`
      );
    }

    // 3. Try Tertiary Fallback
    try {
      const tertiaryKey = (settings.tertiaryApiKey || process.env.OPENROUTER_API_KEY || storage.getSettings().fishAudio?.apiKey || '').trim();
      const tertiaryModel = settings.tertiaryModel || 'google/gemini-2.5-flash';
      if (tertiaryKey && tertiaryModel) {
        modelUsed = tertiaryModel;
        responseText = await this.callConfiguredTier({
          model: tertiaryModel,
          apiKey: tertiaryKey,
          messages,
          temperature: settings.temperature ?? 0.7,
          maxTokens: settings.maxTokens || 1500,
          timeoutMs: 45000,
          targetLanguage,
          targetCountry
        });
        storage.addLog(
          'FALLBACK_TRIGGERED',
          `Modelos anteriores indisponíveis. Resposta atendida com sucesso pelo 3º Fallback (${tertiaryModel}).`
        );
        return { text: responseText, modelUsed, fallbackTriggered: true, fallbackTier: 'tertiary_openrouter', locale: localeInfo };
      }
    } catch (tertiaryErr) {
      console.error(`[AI Tertiary Fallback Error]: ${tertiaryErr.message}`);
      storage.addLog(
        'ERROR',
        `Todas as 3 IAs falharam: ${tertiaryErr.message}`
      );
    }

    // 4. Smart Rule-Based Engine Backup (if all 3 AI models failed or offline)
    const backupReply = this.generateOfflineSmartReply(userMessage, localeInfo, conversationHistory);
    return {
      text: backupReply,
      modelUsed: 'offline-sales-fallback',
      fallbackTriggered: true,
      fallbackTier: 'offline_rules',
      locale: localeInfo
    };
  }

  // Backup sales responses when no API keys are provided or offline
  generateOfflineSmartReply(userMessage = '', localeInfo = null, conversationHistory = []) {
    const text = (userMessage || '').toLowerCase();
    const product = storage.getSettings().product || {};
    const deliverables = storage.getDeliverables();
    const allTags = deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ') || '[ENVIAR_ARQUIVO: PRODUTO]';
    const loc = localeInfo || this.detectLanguageAndCountry(userMessage);
    const targetCountry = loc.country || product.targetCountry || 'Brasil';
    const isLatAm = loc.isLatAm;
    const currencyCode = isLatAm ? (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : 'USD') : 'BRL';
    const currencySymbol = isLatAm ? '$' : 'R$';
    const ticketBasic = Number(product.ticketBasic ?? product.price ?? 15);
    const ticketComplete = Number(product.ticketComplete ?? Math.round(ticketBasic * 1.6));
    const formattedPrice = isLatAm ? `${currencySymbol} ${ticketBasic} ${currencyCode}` : `R$ ${ticketBasic.toFixed(2).replace('.', ',')}`;

    const isOngoing = (conversationHistory || []).length > 0;

    // Price objection handling
    if (/caro|muito caro|reais|sem dinheiro|apertado|no tengo dinero|muy caro/.test(text)) {
      if (isLatAm) {
        return `¡Te entiendo perfectamente! Por eso mismo dejamos la opción del Paquete Básico por solo ${formattedPrice}, que es una inversión súper accesible para que tu pequeño comience hoy mismo a disfrutar los materiales. ¿Te gustaría aprovechar esta opción básica?`;
      }
      return `Te entendo perfeitamente! Justamente por isso preparamos o Pacote Básico por apenas ${formattedPrice}, que é um valor bem simbólico de contribuição para você já começar hoje com as atividades completas. O que acha de aproveitar por esse valor?`;
    }

    if (isLatAm) {
      if (product.deliveryStrategy === 'deliver_first') {
        if (text.includes('si') || text.includes('quiero') || text.includes('material') || text.includes('pdf') || text.includes('actividades') || text.includes('funciona')) {
          return `${allTags}\n¡Claro que sí! Te acabo de compartir el material completo para que lo puedas revisar y comenzar a disfrutarlo hoy mismo. Échale un vistazo y me cuentas qué tal 👇`;
        }
      }
      if (text.includes('precio') || text.includes('costo') || text.includes('cuanto') || text.includes('pagar')) {
        return `El programa completo está con una oportunidad especial: Paquete Básico por solo ${formattedPrice} o Paquete Completo por ${currencySymbol} ${ticketComplete} ${currencyCode}.\n\n¿Quieres que te comparta cómo acceder ahora mismo?`;
      }
      if (isOngoing) {
        return `¡Entendido! Puedes contar conmigo. Cuéntame, ¿tienes alguna duda específica sobre las actividades o te gustaría que te explique más a detalle?`;
      }
      return `¡Hola! Qué gusto saludarte. Vi que te interesó nuestro material educativo. ¿Qué edad tiene tu pequeño o pequeña para orientarte mejor?`;
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
        return `Fico muito feliz que tenha gostado! ❤️ Fiz questão de te mandar o material completo para você já ver o quanto vai ajudar no desenvolvimento dele!\n\nPara manter nosso projeto vivo e continuarmos criando novos materiais, a gente pede uma contribuição simbólica de apenas ${formattedPrice}.\n\nChave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}\nNome: ${product.pixBeneficiary || 'ian alves dos anjos'}\nValor: ${formattedPrice}`;
      }
    }

    if (text.includes('preço') || text.includes('quanto custa') || text.includes('valor')) {
      return `O investimento no ${product.name} está em condição especial hoje: Pacote Básico por apenas ${formattedPrice} ou Pacote Completo por R$ ${ticketComplete.toFixed(2).replace('.', ',')}!\n\nQual dessas opções você prefere para o seu pequeno?`;
    }

    if (text.includes('link') || text.includes('comprar') || text.includes('quero') || text.includes('pix')) {
      return `Maravilha! Você pode fazer o PIX diretamente pela chave (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'} - ${product.pixBeneficiary || 'ian alves dos anjos'} no valor de ${formattedPrice}.\n\nAssim que fizer, só mandar o comprovante aqui para confirmação imediata!`;
    }

    if (text.includes('funciona') || text.includes('resultado') || text.includes('prova')) {
      return `[ENVIAR_IMAGEM: PROVA_SOCIAL]\nSim, funciona com certeza! Temos alunos de todas as idades aplicando o método passo a passo.\n\nDá uma olhada nesses resultados acima! O que você mais busca no momento com o método?`;
    }

    // Ongoing conversation fallback: NEVER restart with a greeting!
    if (isOngoing) {
      return `Entendi perfeitamente! Fica tranquilo(a). Me conta, ficou alguma dúvida sobre as atividades ou em que mais posso te orientar? 😊`;
    }

    return `Olá! Que bom falar com você! 😊\n\nSou do time de atendimento do ${product.name}. Vi que você se interessou pelo nosso material.\n\nComo posso te ajudar hoje?`;
  }

  // AI-Powered One-Click Cultural Offer Localizer for Global Operations
  async localizeOfferWithAi(targetCountry, customBaseProduct = null) {
    const settings = storage.getSettings();
    const product = customBaseProduct || settings.product || {};
    const aiConfig = settings.ai || {};

    const countryPres = {
      'México': {
        currency: 'MXN',
        symbol: '$',
        defaultBasic: 150,
        defaultComplete: 250,
        slangTone: 'Español nativo de México, cálido, familiar y cercano. Usa modismos mexicanos sutiles y acogedores como "papás y mamás", "peques/chiquitines", "padrísimo", "chido", "oye", "qué onda", "a detalle", "pantallas y celulares".'
      },
      'Colômbia': {
        currency: 'COP',
        symbol: '$',
        defaultBasic: 45000,
        defaultComplete: 75000,
        slangTone: 'Español nativo de Colombia, respetuoso, dulce y cercano. Usa expresiones colombianas como "parce", "chévere", "de una", "a la orden", "niños y niñas", "aprender jugando".'
      },
      'Argentina': {
        currency: 'ARS',
        symbol: '$',
        defaultBasic: 15000,
        defaultComplete: 25000,
        slangTone: 'Español rioplatense de Argentina con voseo suave y natural. Usa modismos como "los nenes y nenas", "mirá", "posta", "dale", "re lindo", "re fácil".'
      },
      'Bolívia': {
        currency: 'BOB',
        symbol: 'Bs',
        defaultBasic: 70,
        defaultComplete: 120,
        slangTone: 'Español cálido y amable de Bolivia. Tono empático, directo y familiar.'
      },
      'Paraguai': {
        currency: 'PYG',
        symbol: 'Gs',
        defaultBasic: 120000,
        defaultComplete: 200000,
        slangTone: 'Español de Paraguay, cercano, cálido y sencillo.'
      },
      'Chile': {
        currency: 'CLP',
        symbol: '$',
        defaultBasic: 9900,
        defaultComplete: 16900,
        slangTone: 'Español de Chile, ágil, amable y cercano.'
      },
      'Peru': {
        currency: 'PEN',
        symbol: 'S/',
        defaultBasic: 35,
        defaultComplete: 59,
        slangTone: 'Español de Perú, muy educado, cordial y acogedor.'
      },
      'Estados Unidos': {
        currency: 'USD',
        symbol: '$',
        defaultBasic: 15,
        defaultComplete: 27,
        slangTone: 'Native American English. Warm, encouraging, persuasive, parent-friendly tone. Use expressions like "kiddos", "screen time", "print-and-go", "fun learning".'
      }
    };

    const targetInfo = countryPres[targetCountry] || {
      currency: 'USD',
      symbol: '$',
      defaultBasic: 15,
      defaultComplete: 27,
      slangTone: `Español nativo y coloquial de ${targetCountry}.`
    };

    const isEnglish = targetCountry === 'Estados Unidos' || String(targetCountry).toLowerCase().includes('english');

    const systemPrompt = `Você é o maior especialista mundial em Copywriting Internacional, Psicologia de Vendas e Localização Cultural para WhatsApp.
Sua missão é pegar uma oferta de infoproduto escrita em Português do Brasil e traduzi-la/adaptá-la culturalmente para o país de destino: ${targetCountry}.

CRITÉRIOS OBRIGATÓRIOS:
1. NÃO faça tradução robótica literal! Adapte as dores, os desejos e as expressões para a realidade cultural e os modismos locais de ${targetCountry}.
2. Tom e gírias locais: ${targetInfo.slangTone}
3. Moeda e Valores: Moeda oficial ${targetInfo.currency} (${targetInfo.symbol}). Sugira Ticket Básico (${targetInfo.defaultBasic}) e Ticket Completo (${targetInfo.defaultComplete}).
4. ZERO ROTEIROS ENGESSADOS: No campo "defaultAudioPitchText", NÃO escreva um script decorado para ser lido igual! Escreva diretrizes estratégicas de abordagem com acolhimento, gírias e argumentos de ${targetCountry}, para que a IA use como bússola e formule áudios e mensagens 100% personalizados ao caso e história de cada lead.
5. Responda ESTRITAMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown, apenas o JSON puro, com a seguinte estrutura exata:
{
  "name": "Nome do produto adaptado",
  "niche": "Nicho adaptado",
  "targetAudience": "Público-alvo com vocabulário local",
  "mainPainPoints": ["Dor 1 adaptada", "Dor 2 adaptada", "Dor 3 adaptada"],
  "mainBenefits": ["Benefício 1 adaptado", "Benefício 2 adaptado", "Benefício 3 adaptado"],
  "objections": [
    {
      "trigger": "Objeção comum do cliente na gíria local",
      "response": "Resposta altamente persuasiva com modismos locais quebrando a objeção"
    }
  ],
  "defaultAudioPitchText": "Diretrizes de abordagem e tom acolhedor com gírias de ${targetCountry} para orientar a IA a criar áudios dinâmicos sob medida para o caso de cada cliente",
  "ticketBasic": ${targetInfo.defaultBasic},
  "ticketComplete": ${targetInfo.defaultComplete},
  "currency": "${targetInfo.currency}",
  "currencyCode": "${targetInfo.currency}",
  "currencySymbol": "${targetInfo.symbol}"
}`;

    const userContent = `Aqui está a oferta base em Português para você localizar para ${targetCountry}:
- Nome do Produto: ${product.name || 'Atividades Infantis'}
- Nicho: ${product.niche || 'Educação Infantil'}
- Público Alvo: ${product.targetAudience || 'Mães e pais de crianças'}
- Dores Principais: ${(product.mainPainPoints || []).join(' | ') || 'Criança no celular, falta de foco'}
- Benefícios Principais: ${(product.mainBenefits || []).join(' | ') || 'Aprende brincando, atividades para imprimir'}
- Quebra de Objeções: ${(product.objections || []).map(o => `${o.trigger} => ${o.response}`).join(' | ') || 'Preço e segurança'}
- Roteiro de Áudio Base: ${product.defaultAudioPitchText || 'Oi! Preparei com muito carinho o material para o seu pequeno...'}
- Preço Base: R$ ${product.price || product.ticketBasic || 15}

Gere o JSON localizado para ${targetCountry}.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ];

    let rawReply = '';
    const targetModel = aiConfig.primaryModel || 'gpt-4o';
    const primaryKey = aiConfig.primaryApiKey || process.env.AZURE_AI_API_KEY || process.env.AZURE_OPENAI_API_KEY || (targetModel.includes('gemini') || targetModel.startsWith('google/') ? (aiConfig.tertiaryApiKey || process.env.OPENROUTER_API_KEY || settings.fishAudio?.apiKey) : process.env.NVIDIA_NIM_PRIMARY_API_KEY);
    if (primaryKey) {
      try {
        rawReply = await this.callAnyModel({
          model: targetModel,
          apiKey: primaryKey,
          endpoint: aiConfig.primaryEndpoint,
          messages,
          temperature: 0.4,
          maxTokens: 2200,
          timeoutMs: 60000,
          targetLanguage: isEnglish ? 'en' : 'es',
          targetCountry,
          tierName: 'primary'
        });
      } catch (err) {
        console.warn(`[Localize Primary Model Error]: ${err.message}. Tentando fallback...`);
      }
    }

    if (!rawReply) {
      const fallbackModel = aiConfig.fallbackModel || aiConfig.tertiaryModel || 'google/diffusiongemma-26b-a4b-it';
      const fallbackKey = aiConfig.fallbackApiKey || aiConfig.tertiaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY || process.env.OPENROUTER_API_KEY;
      rawReply = await this.callAnyModel({
        model: fallbackModel,
        apiKey: fallbackKey,
        messages,
        temperature: 0.4,
        maxTokens: 2200,
        timeoutMs: 60000,
        targetLanguage: isEnglish ? 'en' : 'es',
        targetCountry,
        tierName: 'fallback'
      });
    }

    let cleanJsonStr = rawReply.trim();
    if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
    }

    const firstBrace = cleanJsonStr.indexOf('{');
    const lastBrace = cleanJsonStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleanJsonStr = cleanJsonStr.slice(firstBrace, lastBrace + 1);
    }

    const parsedData = JSON.parse(cleanJsonStr);
    const saved = storage.saveLocalizedOffer(targetCountry, parsedData);
    return saved;
  }

  // Generate spoken remarketing script tailored dynamically to the lead's exact conversation history
  async generateRemarketingSpeech(instruction, lead, product, conversationHistory = []) {
    const settings = storage.getSettings().ai;
    const allSettings = storage.getSettings();
    const leadFirstName = (lead.name || '').split(' ')[0] || '';
    const cleanLeadName = /^[0-9+() -]+$/.test(leadFirstName) ? '' : leadFirstName;

    // Build context from recent messages so the audio is 100% personalized to what they actually discussed (up to 30 messages)
    const recentMessages = (conversationHistory || []).slice(-30).map(m => {
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

    // Try Primary Model (Azure AI Foundry / Universal)
    try {
      const primaryModel = settings.primaryModel || 'gpt-4o';
      const isGeminiOrOpenRouter = primaryModel.startsWith('google/') || primaryModel.toLowerCase().includes('gemini');
      const primaryKey = settings.primaryApiKey || process.env.AZURE_AI_API_KEY || process.env.AZURE_OPENAI_API_KEY || (isGeminiOrOpenRouter ? (settings.tertiaryApiKey || process.env.OPENROUTER_API_KEY || allSettings.fishAudio?.apiKey) : process.env.NVIDIA_NIM_PRIMARY_API_KEY);
      
      if (primaryKey || isGeminiOrOpenRouter) {
        const generated = await this.callAnyModel({
          model: primaryModel,
          apiKey: primaryKey,
          endpoint: settings.primaryEndpoint,
          messages,
          temperature: 0.7,
          maxTokens: 500,
          timeoutMs: 45000,
          tierName: 'primary'
        });
        if (generated && generated.length > 5) {
          return generated.replace(/["'“”«»]/g, '').trim();
        }
      }
    } catch (e) {
      console.warn('[AI Remarketing Primary Error]:', e.message);
    }

    // Fallback Model
    try {
      const fallbackModel = settings.fallbackModel || 'google/diffusiongemma-26b-a4b-it';
      const fallbackKey = settings.fallbackApiKey || process.env.NVIDIA_NIM_FALLBACK_API_KEY || settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (fallbackKey) {
        const generated = await this.callAnyModel({
          model: fallbackModel,
          apiKey: fallbackKey,
          messages,
          temperature: 0.7,
          maxTokens: 500,
          timeoutMs: 20000
        });
        if (generated && generated.length > 5) {
          return generated.replace(/["'“”«»]/g, '').trim();
        }
      }
    } catch (e2) {
      console.warn('[AI Remarketing Fallback Error]:', e2.message);
    }

    // Tertiary OpenRouter Model
    try {
      const tertiaryKey = settings.tertiaryApiKey || process.env.OPENROUTER_API_KEY || allSettings.fishAudio?.apiKey || allSettings.vision?.apiKey;
      const tertiaryModel = settings.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free';
      if (tertiaryKey && tertiaryModel) {
        const generated = await this.callAnyModel({
          model: tertiaryModel,
          apiKey: tertiaryKey,
          messages,
          temperature: 0.7,
          maxTokens: 500,
          timeoutMs: 20000
        });
        if (generated && generated.length > 5) {
          return generated.replace(/["'“”«»]/g, '').trim();
        }
      }
    } catch (e3) {
      console.warn('[AI Remarketing Tertiary Error]:', e3.message);
    }

    return null;
  }
}

export const nvidiaNim = new NvidiaNimService();
