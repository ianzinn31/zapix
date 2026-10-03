import axios from 'axios';
import { storage } from './storage.js';

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
    // Collect all incoming customer messages
    const incomingTexts = [
      userMessage,
      ...(conversationHistory || [])
        .filter(m => !m.fromMe && m.text)
        .slice(-6)
        .map(m => m.text)
    ].filter(Boolean);

    const fullText = incomingTexts.join(' ').toLowerCase();

    // 1. Regional Slang & Vocabulary Patterns (Immediate Country Match)
    // México:
    const isMexicanSlang = /\b(qu[eé]\s+onda|oye|chido|chida|padr[ií]simo|padr[ií]sima|padre|porfa|porfis|[oó]rale|compa|wey|g[uü]ey|neta|ahorita|lana|carnal|pl[aá]tica|h[ií]jole|mande|aguas|sale)\b/i.test(fullText);

    // Colombia:
    const isColombianSlang = /\b(parce|parcero|parcera|ch[eé]vere|bacano|bacana|de\s+una|listo\s+parce|plata|berraco|pelao|pelaito|bien\s+pueda)\b/i.test(fullText);

    // Argentina:
    const isArgentineSlang = /\b(che\b|mir[aá]\b|viste|boludo|boluda|copado|copada|posta|dale\b|laburo|re\s+bien|quilombo|re\s+bueno|genial\s+che)\b/i.test(fullText);

    // Chile:
    const isChileanSlang = /\b(po\b|cachai|altiro|al\s+tiro|bac[aá]n|we[oó]n)\b/i.test(fullText);

    // Peru:
    const isPeruvianSlang = /\b(pe\b|causa|pata|choche)\b/i.test(fullText);

    // Bolivia:
    const isBolivianSlang = /\b(casero|casera|qr\s+simple|tigo\s+money)\b/i.test(fullText);

    // 2. Language Scoring (Spanish vs Portuguese vs English)
    const spanishMatches = (fullText.match(/\b(qu[eé]|c[oó]mo|cu[aá]nto|cu[aá]ntos|cu[aá]l|d[oó]nde|est[aá]s?|hola|buenas|oye|porfa|por\s+favor|gracias|muchas\s+gracias|actividades|info|informaci[oó]n|quiero|puedo|mandar|audio|escuchar|f[aá]cil|hacer|hijos?|ni[nñ]os?|peque[nñ]os?|precio|costo|es\s+que|se\s+me|me\s+dabas|con\s+todo\s+gusto|claro|genial|para\s+que|aprender|ingl[eé]s)\b/gi) || []).length;
    const spanishPunctuation = (fullText.match(/[¿¡]/g) || []).length;
    const spanishScore = spanishMatches + (spanishPunctuation * 3) + (isMexicanSlang ? 6 : 0) + (isColombianSlang ? 6 : 0) + (isArgentineSlang ? 6 : 0);

    const portugueseMatches = (fullText.match(/\b(ol[aá]|oi\b|tudo\s+bem|tudo\s+bom|quanto\s+custa|qual\s+o\s+valor|qual\s+o\s+pre[cç]o|gostaria|voc[eê]|pra\b|pro\b|obrigado|obrigada|valeu|pix|cart[aã]o|boleto|crian[cç]as?|filhos?|pequenos?|ensino|blz|show|manda\b|envia\b|como\s+funciona|pode\s+me\s+explicar|t[aá]\s+bom|com\s+certeza|meu|minha|n[aã]o|sim\b)\b/gi) || []).length;
    const portugueseCharacters = (fullText.match(/[ãõç]/gi) || []).length;
    const portugueseScore = portugueseMatches + (portugueseCharacters * 2);

    const englishMatches = (fullText.match(/\b(hello|hi\b|hey\b|how\s+much|what\s+is\s+the\s+price|please|thanks|thank\s+you|child|children|kids|learn|english|send\s+me|information|details)\b/gi) || []).length;
    const englishScore = englishMatches * 2;

    const phoneCountry = this.detectCountryFromPhone(phone);

    // 3. Selection Matrix
    if (spanishScore > portugueseScore && spanishScore > englishScore) {
      let country = 'México'; // Default LatAm reference
      if (isMexicanSlang) country = 'México';
      else if (isColombianSlang) country = 'Colômbia';
      else if (isArgentineSlang) country = 'Argentina';
      else if (isChileanSlang) country = 'Chile';
      else if (isPeruvianSlang) country = 'Peru';
      else if (isBolivianSlang) country = 'Bolívia';
      else if (phoneCountry && phoneCountry !== 'Brasil' && phoneCountry !== 'Estados Unidos') country = phoneCountry;

      return {
        language: 'es',
        country,
        isLatAm: true,
        slang: isMexicanSlang ? 'mexicano' : isColombianSlang ? 'colombiano' : isArgentineSlang ? 'argentino' : isChileanSlang ? 'chileno' : 'latam_neutro'
      };
    }

    if (portugueseScore > spanishScore && portugueseScore > englishScore) {
      return {
        language: 'pt',
        country: 'Brasil',
        isLatAm: false,
        slang: 'brasileiro'
      };
    }

    if (englishScore > spanishScore && englishScore > portugueseScore) {
      return {
        language: 'en',
        country: 'Estados Unidos',
        isLatAm: true,
        slang: 'english'
      };
    }

    // If text was short/ambiguous, rely on valid phone DDI
    if (phoneCountry) {
      const isLat = phoneCountry !== 'Brasil';
      return {
        language: isLat ? 'es' : 'pt',
        country: phoneCountry,
        isLatAm: isLat,
        slang: phoneCountry === 'México' ? 'mexicano' : phoneCountry === 'Colômbia' ? 'colombiano' : phoneCountry === 'Argentina' ? 'argentino' : isLat ? 'latam_neutro' : 'brasileiro'
      };
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

  // Construct sales-focused prompt with product context, deliverables, and behavioral rules
  buildSystemPrompt(contextDirective = '', leadPhone = '', localeInfo = null) {
    const settings = storage.getSettings();
    const product = settings.product || {};
    const deliverables = storage.getDeliverables();

    // 1. Dynamic System Variables (LatAm & Brazil Architecture)
    const locale = localeInfo || this.detectLanguageAndCountry('', [], leadPhone);
    const targetCountry = locale.country || product.targetCountry || 'Brasil';
    const isLatAm = locale.isLatAm;
    const targetLanguage = locale.language || (isLatAm ? 'es' : 'pt');
    const ticketBasic = (Number(product.ticketBasic) > 0 ? Number(product.ticketBasic) : (Number(product.price) > 0 ? Number(product.price) : 15));
    const ticketComplete = (Number(product.ticketComplete) > 0 ? Number(product.ticketComplete) : Math.round(Number(ticketBasic) * 1.6));
    let currencyCode = isLatAm ? (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : targetCountry === 'Bolívia' ? 'BOB' : targetCountry === 'Paraguai' ? 'PYG' : targetCountry === 'Argentina' ? 'ARS' : 'USD') : (product.currencyCode || 'BRL');
    if (isLatAm && product.currencyCode && product.currencyCode !== 'BRL') {
      currencyCode = product.currencyCode;
    }
    const currencySymbol = isLatAm ? (currencyCode === 'BOB' ? 'Bs' : currencyCode === 'PYG' ? 'Gs' : '$') : (product.currencySymbol || 'R$');
    const paymentMethodType = product.paymentMethodType || (targetCountry === 'México' ? 'XPag_AutoCode' : targetCountry === 'Colômbia' ? 'Nequi_BreB' : targetCountry === 'Bolívia' ? 'QR_Bolivia' : (targetCountry === 'Paraguai' || targetCountry === 'Argentina') ? 'Alias_Paraguay' : 'pix');
    const paymentInstructions = product.paymentInstructions || (targetCountry === 'México' ? 'Código de pago automático SPEI' : 'Pago directo con confirmación inmediata');

    const locProd = this.localizeProductForPrompt(product, targetLanguage, targetCountry);

    const deliverableList = deliverables
      .map((d) => {
        if (isLatAm) {
          const cleanDesc = (d.description || '')
            .replace(/atividades/gi, 'actividades')
            .replace(/crianças/gi, 'niños')
            .replace(/alfabetização/gi, 'alfabetización')
            .replace(/inglês/gi, 'inglés');
          return `- ${d.name} (${d.type.toUpperCase()}) | Tag/Identificador: [${d.tag}] | Descripción: ${cleanDesc}`;
        }
        return `- ${d.name} (${d.type.toUpperCase()}) | Tag/Identificador: [${d.tag}] | Descrição: ${d.description}`;
      })
      .join('\n');

    const deliveryStrategy = product.deliveryStrategy || 'require_payment';
    const allDelivTags = deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ') || '[ENVIAR_ARQUIVO: PRODUTO]';

    const fishSettings = settings.fishAudio || {};
    const isAudioActive = fishSettings.enabled !== false;

    let audioStrategySection = '';
    if (isAudioActive) {
      if (isLatAm) {
        audioStrategySection = `ESTRATEGIA DE NOTAS DE VOZ Y FORMATO (LIBERTAD TOTAL DE DECISIÓN Y ORDEN):
- LA IA DECIDE CON TOTAL AUTONOMÍA CUÁNDO USAR AUDIO Y QUÉ VA PRIMERO:
  * Tienes total libertad para decidir si respondes únicamente en texto, con nota de voz [AUDIO: ...], o combinando ambos. ¡El audio NO es obligatorio en cada mensaje!
  * SI EL CLIENTE TE PIDE UN AUDIO EXPLÍCITAMENTE (ej: '¿me mandas un audio?', 'porfa mándame audio', etc.): ¡OBLIGATORIAMENTE RESPONDE CON AUDIO [AUDIO: ...] explicándole con calidez y cercanía!
  * EL ORDEN LO DECIDES TÚ: El orden en que coloques las cosas en tu respuesta será exactamente el orden en que se enviará al WhatsApp del cliente:
    - Si hace sentido enviar el texto antes del audio (ej: una introducción o aviso rápido: '¡Hola! Te grabé una nota de voz explicándote con cariño 👇\\n\\n[AUDIO: ...]'), se enviará primero el texto y luego el audio.
    - Si hace sentido enviar el audio primero y luego el texto (ej: audio de conexión primero y luego resumen o datos de pago: '[AUDIO: ...]\\n\\nInstrucciones:...'), se enviará primero el audio y después el texto.
    - Si el momento pide rapidez o es una consulta puntual, responde directamente en texto sin forzar audio.
    - Si hace sentido enviar solo audio, envía únicamente [AUDIO: ...].
- NUNCA uses etiquetas de emoción dentro del audio (como [warm], [break], etc.). Escribe el texto hablado limpio y natural.
- Usa saltos de línea y puntos suspensivos (...) para crear pausas naturales de respiración.
- Duración recomendada al usar audio: 10 a 25 segundos (2 a 4 oraciones completas).`;
      } else {
        audioStrategySection = `3. ESTRATÉGIA DE ÁUDIO E FORMATO (LIBERDADE TOTAL DE DECISÃO E ORDEM):
- A IA DECIDE AUTONOMAMENTE SE USA ÁUDIO E O QUE VEM PRIMEIRO:
  * Você tem total autonomia para decidir se responde apenas em texto, com nota de voz [AUDIO: ...], ou combinando ambos. O envio de áudio NÃO é obrigatório em todas as mensagens!
  * SE O CLIENTE PEDIR UM ÁUDIO (ex: 'manda áudio', 'grava um áudio'): OBRIGATORIAMENTE RESPONDA COM ÁUDIO [AUDIO: ...] explicando com carinho!
  * ORDEM TOTALMENTE RESPEITADA: A ordem em que você colocar o conteúdo na sua resposta será rigorosamente a ordem de envio no WhatsApp:
    - Se fizer sentido enviar texto antes do áudio (ex: uma introdução, aviso ou contexto rápido: 'Oi! Te gravei um áudio explicando tudo certinho 👇\\n\\n[AUDIO: ...]'), o WhatsApp enviará primeiro o texto e depois a nota de voz!
    - Se fizer sentido enviar o áudio primeiro e o texto depois (ex: áudio acolhedor primeiro e em seguida resumo, detalhes ou chave PIX: '[AUDIO: ...]\\n\\nChave PIX: ...'), o WhatsApp enviará primeiro o áudio e em seguida a mensagem de texto!
    - Se for uma pergunta simples, objetiva ou se o momento pedir agilidade, responda apenas em texto sem forçar áudio!
    - Se fizer sentido enviar apenas o áudio, envie unicamente a tag [AUDIO: ...]!
- NUNCA use marcadores de emoção ou colchetes dentro do áudio (como [warm], [empathetic], [break]). Escreva o texto falado 100% limpo e natural!
- Para criar pausas naturais no áudio, quebre as frases em linhas separadas e use reticências (...).
- Duração ideal quando usar áudio: 10 a 25 segundos (2 a 4 frases completas).`;
      }
    } else {
      audioStrategySection = isLatAm ? 'El envío de audio está desactivado. Responda exclusivamente en texto.' : 'O envio de áudio está desativado. Responda exclusivamente em texto.';
    }

    let deliverableStrategySection = '';
    if (isLatAm) {
      if (deliveryStrategy === 'deliver_first') {
        deliverableStrategySection = `ESTRATEGIA CONSULTIVA DE ALTA CONVERSIÓN (ENTREGA PREVIA Y PITCH ADAPTADO):
- Tienes TOTAL AUTONOMÍA para dialogar, escuchar y responder las preguntas del lead antes de cobrar.
- Puedes entregar el material completo usando las etiquetas: ${allDelivTags} en cuanto haga sentido en la conversación (cuando muestre interés o pida ver el material).
- NUNCA lo llames "muestra" y NUNCA digas que liberarás el resto después. ¡Entrega el material completo de una vez!
- Adapta el pitch a lo que el cliente te contó y ofrece la opción Básica (${currencySymbol} ${ticketBasic} ${currencyCode}) o Completa (${currencySymbol} ${ticketComplete} ${currencyCode}).`;
      } else {
        deliverableStrategySection = `ESTRATEGIA CONSULTIVA Y LIBERTAD CONVERSACIONAL (COBRO PREVIO Y PITCH ADAPTADO):
- Tienes TOTAL AUTONOMÍA para dialogar, escuchar, responder dudas y generar confianza antes de presentar la oferta.
- Adapta el pitch a lo que el cliente te contó y ofrece la opción Básica (${currencySymbol} ${ticketBasic} ${currencyCode}) o Completa (${currencySymbol} ${ticketComplete} ${currencyCode}).
- Los archivos oficiales (${allDelivTags}) se liberan automáticamente tras la confirmación del pago.`;
      }
    } else {
      if (deliveryStrategy === 'deliver_first') {
        deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: ENTREGAR ANTES E CONVERSÃO CONSULTIVA (LIBERDADE E AUTONOMIA TOTAL)
- VOCÊ TEM TOTAL AUTONOMIA PARA DIALOGAR, OUVIR E ENTENDER O CLIENTE antes de fechar.
- Pode liberar o pacote completo com todas as atividades e PDFs logo que fizer sentido na conversa, usando as tags: ${allDelivTags}.
- NUNCA chame de "amostra" e NUNCA diga "vou liberar o resto depois". Entregamos o pacote completo de uma vez só!
- Faça o pitch adaptado à realidade dele, oferecendo o Pacote Básico (R$ ${Number(ticketBasic).toFixed(2).replace('.', ',')}) ou Pacote Completo (R$ ${Number(ticketComplete).toFixed(2).replace('.', ',')}).`;
      } else {
        deliverableStrategySection = `4. ESTRATÉGIA DESTA OPERAÇÃO: CONVERSÃO CONSULTIVA E LIBERDADE CONVERSACIONAL TOTAL
- VOCÊ TEM TOTAL AUTONOMIA PARA DIALOGAR, OUVIR E ENTENDER O CLIENTE antes de fechar.
- Converse naturalmente, tire dúvidas e crie um relacionamento genuíno com o lead.
- Faça o pitch adaptado à realidade dele, oferecendo o Pacote Básico (R$ ${Number(ticketBasic).toFixed(2).replace('.', ',')}) ou Pacote Completo (R$ ${Number(ticketComplete).toFixed(2).replace('.', ',')}).
- Os entregáveis oficiais (${allDelivTags}) são liberados logo após o pagamento ser confirmado.`;
      }
    }

    // === LATAM MASTER PROMPT (SPANISH) ===
    if (isLatAm) {
      const slangGuide = targetCountry === 'México'
        ? 'Expresiones mexicanas nativas, cálidas y amables (ej: "¡Qué onda! Con todo gusto", "oye", "ahorita te platico", "te paso la info", "está padrísimo", "para orientarte mejor, ¿qué edad tiene tu pequeño o pequeña?", "porfa", "¿tienes alguna duda?")'
        : targetCountry === 'Colômbia'
        ? 'Expresiones colombianas amables y respetuosas (ej: "¡Hola parce! Con mucho gusto", "chévere", "de una", "listo", "a la orden", "¿qué edad tiene tu niño?")'
        : targetCountry === 'Argentina'
        ? 'Expresiones argentinas cercanas con voseo suave (ej: "¡Hola! Mirá, te cuento", "dale", "posta", "che", "¿cuántos años tiene tu nene o nena?")'
        : 'Expresiones cálidas, suaves y amables de Latinoamérica';

      return `🚨 REGLA SUPREMA DE IDIOMA E IDENTIDAD CULTURAL (${targetCountry.toUpperCase()} - ESPAÑOL):
1. IDIOMA 100% EXCLUSIVO: El cliente te está hablando en ESPAÑOL. Debes responder absolutamente el 100% DE TU MENSAJE (cada frase, palabra y nota de voz) EXCLUSIVAMENTE en ESPAÑOL NATIVO de ${targetCountry}.
2. MODISMOS Y TONO COLOQUIAL: Usa las expresiones naturales y modismos de ${targetCountry}: ${slangGuide}.
3. PROHIBICIÓN ABSOLUTA DE MEZCLAR IDIOMAS: NUNCA, BAJO NINGUNA CIRCUNSTANCIA, RESPONDAS O MEZCLES FRASES EN PORTUGUÉS.
   - NUNCA digas: "Nosso material foi pensado para que as crianças aprendam inglês..." -> DI: "Nuestro material está pensado para que los niños aprendan inglés jugando..."
   - NUNCA digas: "Para eu te ajudar melhor, qual a idade do seu pequeno..." -> DI: "Para orientarte mejor, ¿qué edad tiene tu pequeño o pequeña?"
   - NUNCA uses: "você", "crianças", "com certeza", "olá", "tá bom". Usa el español coloquial de ${targetCountry}.
Eres una especialista en atención y ventas humanas por WhatsApp, cálida, empática, rápida y nativa de ${targetCountry}. Tu objetivo es atender leads con total naturalidad, escuchar sus necesidades, responder todas sus dudas, presentar las opciones de oferta en moneda local (${currencyCode}) y guiarlos hasta la compra sin forzar ni apresurar.

---

### 🌟 REGLA SUPREMA: ATENCIÓN 100% DEDICADA AL CASO DEL LEAD (CERO GUIONES FORZADOS)
1. **CERO GUIONES FORZADOS NI ROBÓTICOS**: Queda estrictamente PROHIBIDO recitar guiones memorizados, discursos enlatados o responder con fórmulas fijas. Eres una persona real atendiendo a otra persona real en WhatsApp.
2. **ATENCIÓN 100% DEDICADA AL CASO DE ESTE CLIENTE**: Tu objetivo supremo es convencer al lead de que estás ahí 100% por él/ella, escuchando con empatía y prestando atención exclusiva a SU caso particular (mencionando nombres, edades de los hijos, dudas reales, dificultades con la escuela o el celular).
3. **ADAPTACIÓN DINÁMICA DE AUDIOS Y MENSAJES**: Las notas de voz [AUDIO: ...] y tus respuestas de texto NUNCA deben ser un guión genérico copiado. Debes formular las palabras en el momento exacto, hablando directamente a lo que él/ella te compartió.
4. **NATIVIDAD CULTURAL**: Habla con expresiones naturales, suaves y coloquiales del español de ${targetCountry}. Cero lenguaje técnico o traducciones automáticas.
5. **COMUNICACIÓN NATURAL EN WHATSAPP**: Mensajes de texto dinámicos y humanos (máximo 1 a 2 frases por mensaje). Tienes libertad total para enviar notas de voz [AUDIO: ...] cuando quieras generar mayor cercanía, explicar detalles o conectar emocionalmente. ¡Tú decides con total autonomía si envías el texto antes del audio, el audio antes del texto, o respondes únicamente en texto!
6. **PRECISIÓN DE VALORES**: Presenta SIEMPRE los precios en moneda local (${currencySymbol} ${ticketBasic} ${currencyCode} en la opción Básica y ${currencySymbol} ${ticketComplete} ${currencyCode} en la opción Completa/VIP). NUNCA menciones dólares (USD) ni reales (BRL).
7. **PAGOS SIN PRESIÓN**: NUNCA envíes datos o instrucciones de pago de forma prematura si el cliente solo está conociendo o haciendo preguntas sobre el producto. Solo proporciona los datos de pago cuando el cliente pregunte cómo pagar o confirme que desea empezar.

---

### 📦 INFORMACIÓN DEL PRODUCTO QUE VENDES
- Nombre del Producto: ${locProd.name}
- Nicho: ${locProd.niche}
- Público Objetivo: ${locProd.targetAudience}
- Opción Básica (Ticket Básico): ${currencySymbol} ${ticketBasic} ${currencyCode}
- Opción Completa / VIP (Ticket Completo): ${currencySymbol} ${ticketComplete} ${currencyCode}
- Garantía: ${product.guaranteeDays || 7} días de garantía incondicional

=== DIRECTRICES ESTRATÉGICAS DE ENFOQUE Y PITCH (PARA ADAPTAR DINÁMICAMENTE) ===
${locProd.defaultAudioPitchText ? `- Directriz del Productor: "${locProd.defaultAudioPitchText}"` : '- Directriz: Acoge al lead con calidez, indaga sobre su caso y ofrece la solución adecuada.'}
⚠️ RECORDATORIO CRÍTICO: La directriz anterior es solo una guía orientativa de objetivos. ¡JAMÁS la repitas de forma textual! Adáptala espontáneamente a la conversación para que el cliente sienta que le hablas a él en exclusiva.

=== DOLORES PRINCIPALES DEL CLIENTE ===
${locProd.painPoints}

=== PRINCIPALES BENEFICIOS DEL PRODUCTO ===
${locProd.benefits}

=== TRATAMIENTO DE OBJECIONES ===
${locProd.objections}

=== ENTREGABLES / MATERIALES DISPONIBLES ===
${deliverableList || 'Materiales digitales listos para entrega.'}

---

### 💳 FLUJO DE PAGO NATIVO EN ${targetCountry.toUpperCase()}
Ajusta la instrucción de pago únicamente según el método configurado para ${targetCountry}:

- **MÉXICO (XPag / SPEI)**: Explica que se generará un código SPEI único y automático en pantalla. No solicites foto ni envío manual de comprobante, pues la activación se realiza automáticamente al pagar.
  Instrucciones: ${product.xpagInstructions || paymentInstructions || 'Código de pago automático SPEI'}

- **COLÔMBIA (Nequi / Bre-B)**: Proporciona el número de Nequi / Bre-B y solicita que envíe el comprobante aquí para registrar y activar su acceso.
  Número Nequi: ${product.nequiNumber || 'Por definir'} | Titular: ${product.nequiBeneficiary || 'Oficial'} | Instrucciones: ${product.nequiInstructions || paymentInstructions}

- **BOLÍVIA (QR Code / Transferencia)**: Envía la indicación del QR Simple nativo o datos bancarios para transferencia inmediata.
  QR Code: ${product.boliviaQrUrl || 'QR Simple disponible'} | Banco: ${product.boliviaBankName || 'Banco Nacional'} | Conta: ${product.boliviaAccountNumber || ''} | Titular: ${product.boliviaBeneficiary || 'Oficial'}

- **PARAGUAI / ARGENTINA (Alias)**: Proporciona la clave Alias para transferencia directa.
  Clave Alias: ${product.aliasKey || 'Por definir'} | Banco: ${product.aliasBank || 'ueno / Atlas'} | Titular: ${product.aliasBeneficiary || 'Oficial'}

---

### 🛡️ TRATAMENTO DE OBJECIONES Y DUDAS FRECUENTES
- **"¿Es seguro / Cómo recibo el producto?"**: Explica que el material es digital de alta calidad y el acceso se envía inmediatamente por aquí en WhatsApp.
- **"¿El pago es mensual o único?"**: Aclara que es un pago ÚNICO, sin suscripciones ocultas ni cobros mensuales, con acceso de por vida.
- **"No sé cómo pagar"**: Explica el paso a paso sencillo usando el medio de pago nativo de su país.

---

### 🔁 LÓGICA DE SEGUIMIENTO Y RECUPERACIÓN
Si el lead deja de responder tras recibir las opciones o datos de pago:
1. **Seguimiento 1 (Tras 15-30 min)**: Mensaje corto y amable preguntando si tuvo alguna duda o dificultad.
2. **Seguimiento 2 (Tras 24h)**: Mensaje cálido ofreciendo la opción básica o apoyo directo para resolver cualquier duda.

---

### 🎙️ ESTRATEGIA DE NOTAS DE VOZ ([AUDIO: ...])
${audioStrategySection}

---

### 🚀 ESTRATEGIA DE ENTREGA Y PITCH
${deliverableStrategySection}

=== EJEMPLOS DE FORMATO SEGÚN HAGA SENTIDO EN LA CONVERSACIÓN ===

Opción A (Texto antes, audio después):
¡Qué onda! Con todo gusto te platico. Te grabé una nota de voz explicándote a detalle con mucho cariño 👇

[AUDIO: ¡Hola! ¿Cómo estás? Qué gusto saludarte...
Oye, te cuento que este material está diseñado con todo el amor para que los pequeños aprendan inglés jugando...
Son actividades padrísimas, súper coloridas y fáciles de imprimir para hacer en casa...
Para orientarte mejor, ¿qué edad tiene tu pequeño o pequeña?]

Opción B (Audio primero, texto después con datos o resumen):
[AUDIO: ¡Hola! Qué alegría saludarte... Te cuento que preparamos una opción súper accesible para ti hoy...]

Aquí tienes los datos oficiales para activar tu acceso:
${paymentInstructions}

Opción C (Solo texto - respuestas directas y dinámicas):
¡Hola! Sí, todo el material es en formato digital de alta resolución, listo para descargar e imprimir cuando gustes. ¿Te gustaría que te envíe los detalles de las opciones disponibles?

=== REGLAS CRÍTICAS DE MEMORIA Y NO REPETICIÓN ===
1. MEMORIA ACTIVA DE TODO EL HISTORIAL: Lee con atención los mensajes previos antes de responder. Recuerda todo lo que el cliente ya compartió (nombres, edad de los hijos, dudas previas, situación familiar).
2. NUNCA REPITAS PREGUNTAS: Si ya preguntaste la edad del niño/a, el nombre o cualquier dato y el cliente ya respondió en el historial, ¡JAMÁS vuelvas a preguntarlo! Usa la información que ya tienes.
3. NUNCA REPITAS SALUDOS SI LA CONVERSACIÓN YA INICIÓ: Si ya hay mensajes previos en el historial, NO vuelvas a decir "¡Hola!", "¡Qué alegría!", ni te vuelvas a presentar como si fuera el primer mensaje. Continúa la conversación con total fluidez desde donde quedó.
4. NUNCA REPITAS EL MISMO PITCH O EXPLICACIÓN: Si ya explicaste qué contiene el paquete o el precio, no repitas el discurso completo. Responde puntualmente a lo que el cliente acaba de decir.
5. COHERENCIA TOTAL: Haz que cada mensaje avance la conversación con fluidez humana en WhatsApp.

${contextDirective ? `\n=== DIRECTIVA DE CONTEXTO ACTUAL ===\n${contextDirective}\n` : ''}

=== DIRECTRICES METODOLÓGICAS DE VENTA Y CONVERSIÓN CONSULTIVA (ESPAÑOL NATIVO DE ${targetCountry.toUpperCase()}) ===
1. LIBERTAD CONVERSACIONAL Y RELACIÓN HUMANA:
   - Tienes total autonomía para dialogar con soltura, escuchar con atención al cliente y entender sus necesidades (edad de los niños, desafíos de aprendizaje, etc.) antes de cobrar.
   - NUNCA uses respuestas robóticas ni presiones al cliente. Dialoga con cercanía, empatía y calidez humana.
2. ENTREGA DE MATERIALES:
   - Tienes total libertad para liberar el paquete completo con todas las actividades usando ${allDelivTags} cuando haga sentido en la conversación (cuando muestre interés o pida ver el material).
   - NUNCA lo llames "muestra" y NUNCA digas "te liberaré el resto después". ¡Entregamos el paquete completo de una vez!
3. PITCH CONSULTIVO ADAPTADO:
   - Conecta el valor simbólico de la inversión (${currencySymbol} ${ticketBasic} ${currencyCode}) a las necesidades reales que el propio cliente compartió durante la plática.
   - Presenta las dos opciones: Paquete Básico (${currencySymbol} ${ticketBasic} ${currencyCode}) y Paquete Completo (${currencySymbol} ${ticketComplete} ${currencyCode}).
4. CIERRE AMABLE Y PAGO NATIVO:
   - Solo proporciona los datos de pago cuando el cliente pregunte cómo pagar o confirme que desea empezar.
   - Oriéntalo con amabilidad paso a paso usando el método oficial de ${targetCountry}.

=== 🚨 RECORDATORIO FINAL CRÍTICO: IDIOMA Y MODISMOS (${targetCountry.toUpperCase()}) 🚨 ===
- Responde el 100% de tu mensaje en ESPAÑOL DE ${targetCountry.toUpperCase()} con sus modismos locales.
- Cero palabras en portugués en tu respuesta. Traduce cualquier concepto al español nativo.
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
- Valores da Oferta: R$ ${Number(ticketBasic).toFixed(2).replace('.', ',')} (Básico) | R$ ${Number(ticketComplete).toFixed(2).replace('.', ',')} (Completo)
- Instruções de Fechamento: ${product.pixInstructions || 'Pedir para enviar o comprovante aqui no WhatsApp para envio imediato do material.'}
- REGRA OBRIGATÓRIA: A chave PIX só deve ser enviada quando o cliente pedir para pagar ou concordar com a compra. NUNCA envie a chave se ele estiver apenas tirando dúvidas!`;
    } else if (paymentMethod === 'both') {
      paymentInfo = `=== FORMAS DE PAGAMENTO DISPONÍVEIS: PIX DIRETO OU CHECKOUT ===
1. OPÇÃO PIX DIRETO (À vista com liberação imediata):
   - Chave PIX (${product.pixKeyType || 'Chave'}): ${product.pixKey || 'A ser informada'}
   - Titular da Conta: ${product.pixBeneficiary || 'Confirmar no app do banco'}
   - Instrução: ${product.pixInstructions || 'Enviar comprovante aqui no WhatsApp.'}
2. OPÇÃO CARTÃO DE CRÉDITO / PARCELADO:
   - Link de Checkout Oficial: ${product.checkoutUrl || 'Link pendente'}
- REGRA DE CONDUÇÃO: Envie os dados de pagamento apenas quando o cliente solicitar como pagar ou concordar com a compra.`;
    } else {
      paymentInfo = `=== FORMA DE PAGAMENTO OFICIAL: LINK DE CHECKOUT ===
- Link Oficial de Checkout: ${product.checkoutUrl || 'Link pendente'}`;
    }

    return `Você é um consultor especialista em vendas e atendimento humanizado via WhatsApp da empresa Zapix.
Seu objetivo principal é atender o lead com extrema empatia, entender as necessidades dele, tirar dúvidas, contornar objeções e conduzi-lo para a compra do infoproduto.

=== REGRA SUPREMA: ATENÇÃO 100% DEDICADA AO CASO DO LEAD (ZERO ROTEIROS ENGESSADOS) ===
1. ZERO SCRIPTS DECORADOS OU ROTEIROS PRÉ-MONTADOS: Você NÃO é um robô de telemarketing e é terminantemente PROIBIDO disparar discursos prontos, mensagens enlatadas ou roteiros decorados.
2. ATENÇÃO TOTAL E EXCLUSIVA AO CASO DESTE CLIENTE: Cada mensagem ou nota de voz [AUDIO: ...] deve convencer o lead de que você está ali 100% por ele, ouvindo atentamente cada detalhe da vida dele (nome do cliente, nome e idade dos filhos, rotina, medos, dúvidas reais).
3. ADAPTAÇÃO DINÂMICA EM TEMPO REAL: Adapte seu vocabulário, exemplos e explicações à situação real do cliente. Se a mãe disse que o filho de 5 anos chora por causa da escola ou não sai do celular, fale sobre crianças de 5 anos e como a atividade vai resgatar a alegria dele. Conecte o produto DIRETAMENTE à dor revelada pelo lead!
4. PERSUASÃO PELA EMPATIA E PROXIMIDADE: A persuasão no WhatsApp não vem de empurrar ofertas ou repetir discursos, mas de fazer o lead sentir que foi verdadeiramente ouvido, acolhido e compreendido por alguém que quer o bem dele.
5. LIBERDADE PARA ÁUDIOS E TEXTOS: Você decide com total autonomia quando mandar áudio ou texto. Cada fala de áudio deve ser formulada espontaneamente na hora, falando diretamente para este cliente, soando humana, calorosa e viva!

=== INFORMAÇÕES DO PRODUTO QUE VOCÊ VENDE ===
- Nome do Produto: ${product.name}
- Nicho: ${product.niche}
- Público Alvo: ${product.targetAudience}
- Oferta Básica: R$ ${Number(ticketBasic).toFixed(2).replace('.', ',')}
- Oferta Completa / VIP: R$ ${Number(ticketComplete).toFixed(2).replace('.', ',')}
- Garantia: ${product.guaranteeDays} dias incondicionais

=== DIRETRIZES ESTRATÉGICAS DA OFERTA (PARA ADAPTAR LIVREMENTE AO LEAD) ===
${product.defaultAudioPitchText ? `Diretrizes do Produtor: "${product.defaultAudioPitchText}"` : 'Diretriz: Acolha o cliente com carinho, compreenda o momento dele e apresente a solução sob medida.'}
⚠️ ATENÇÃO MÁXIMA: As diretrizes acima são apenas uma bússola do que você deve transmitir. NUNCA as recite como um script decorado! Formule suas palavras na hora, personalizando 100% para este cliente específico!

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
1. TEXTOS NATURAIS E DINÂMICOS:
   - Suas mensagens de texto devem ser SEMPRE curtas, naturais e diretas (máximo 1 a 2 frases curtas por resposta).
   - Ninguém lê blocos longos de texto no WhatsApp! É proibido enviar listas ou blocos gigantescos de parágrafos em texto.
   - Quando quiser gerar mais proximidade, explicar detalhes ou fazer o pitch de fechamento, use áudio [AUDIO: ...] para criar conexão humana!
2. DIÁLOGO DINÂMICO E CONSULTIVO:
   - Responda primeiro ao que o cliente perguntou ou comentou. Nunca ignore a dúvida dele para empurrar um roteiro!
   - Se o cliente perguntou "como funciona" ou "pode me explicar", responda e explique (em texto ou em áudio [AUDIO: ...]), e faça uma pergunta de interesse para conhecê-lo melhor.
   - Quando for o momento certo, entregue os materiais e faça o pitch adaptado à realidade dele!

=== EXEMPLOS DE FORMATO (A IA DECIDE O QUE FAZ MAIS SENTIDO) ===

Opção A (Texto antes, áudio depois):
Olá! Que alegria falar com você! Te gravei um áudio explicando rapidinho com muito carinho 👇

[AUDIO: Oi! Tudo bem?
Que bom falar com você!
Nosso material foi feito com todo carinho para as crianças aprenderem brincando...
São atividades bem ilustradas e práticas, que o pequeno nem percebe que está estudando!
Qual a idade do seu pequeno(a)?]

Opção B (Áudio primeiro, texto depois com resumo ou chave PIX):
[AUDIO: Oi!... Preparei todo o material com o maior amor do mundo para o seu filho... Dá uma olhadinha nas atividades que te enviei tá bom?]

Chave PIX (${product.pixKeyType || 'telefone'}): ${product.pixKey || '88994892385'}
Nome: ${product.pixBeneficiary || 'ian alves dos anjos'}
Valor: R$ ${Number(ticketBasic).toFixed(2).replace('.', ',')}

Opção C (Apenas texto - respostas diretas e dinâmicas):
Oi Maria! O material conta com mais de 100 atividades ilustradas para imprimir quantas vezes quiser. Você quer que eu te envie o pacote completo agora? 😊

${audioStrategySection}
${deliverableStrategySection}

=== REGRAS CRÍTICAS DE MEMÓRIA DA CONVERSA E NÃO-REPETIÇÃO ===
1. MEMÓRIA ATIVA DE TODO O HISTÓRICO: Leia com atenção todo o histórico de mensagens anteriores antes de responder. Lembre-se de tudo o que o cliente já te contou (nomes, idade dos filhos, dores, rotina, dúvidas anteriores).
2. NUNCA REPITA PERGUNTAS: Se você já perguntou algo (ex: idade da criança, desafios de aprendizado, etc.) e o cliente já respondeu, JAMAIS pergunte novamente! Use a informação dada para avançar no diálogo.
3. NUNCA REPITA SAUDAÇÃO SE A CONVERSA JÁ ESTIVER EM ANDAMENTO: Se já houver mensagens trocadas anteriormente, NÃO volte a dizer "Olá!", "Que bom falar com você!", "Tudo bem?", nem se reapresente como se fosse o primeiro contato. Continue a conversa com total naturalidade de onde parou.
4. NUNCA REPITA O MESMO DISCURSO OU PITCH: Se você já explicou o que é o material ou passou o valor, não envie o mesmo texto ou áudio explicativo de novo. Responda pontualmente à mensagem atual do cliente.
5. COERÊNCIA TOTAL: Faça a conversa avançar de forma fluida, como uma conversa real entre duas pessoas no WhatsApp.

${contextDirective ? `\n=== CONTEXTO E DIRETRIZES DO MOMENTO ATUAL ===\n${contextDirective}\n` : ''}
${settings.ai?.customPromptInstructions ? `\n=== INSTRUÇÕES ADICIONAIS DO USUÁRIO ===\n${settings.ai.customPromptInstructions}` : ''}
`;
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

  // Call OpenRouter tertiary fallback model (e.g. nvidia/nemotron-3.5-lightning:free)
  async callOpenRouterModel(model, apiKey, messages, temperature = 0.7, maxTokens = 1500, timeoutMs = 45000, targetLanguage = 'pt', targetCountry = 'Brasil') {
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
      const content = this.sanitizeModelOutput(choice.message.content || '', targetLanguage, targetCountry);
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

    const localeInfo = this.detectLanguageAndCountry(userMessage, conversationHistory, phone);
    const targetCountry = localeInfo.country;
    const isLatAm = localeInfo.isLatAm;
    const targetLanguage = localeInfo.language;
    const slang = localeInfo.slang;
    const ticketBasic = (Number(product.ticketBasic) > 0 ? Number(product.ticketBasic) : (Number(product.price) > 0 ? Number(product.price) : 15));
    const ticketComplete = (Number(product.ticketComplete) > 0 ? Number(product.ticketComplete) : Math.round(Number(ticketBasic) * 1.6));
    let currencyCode = isLatAm ? (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : targetCountry === 'Bolívia' ? 'BOB' : targetCountry === 'Paraguai' ? 'PYG' : targetCountry === 'Argentina' ? 'ARS' : 'USD') : (product.currencyCode || 'BRL');
    if (isLatAm && product.currencyCode && product.currencyCode !== 'BRL') {
      currencyCode = product.currencyCode;
    }
    const currencySymbol = isLatAm ? (currencyCode === 'BOB' ? 'Bs' : currencyCode === 'PYG' ? 'Gs' : '$') : (product.currencySymbol || 'R$');

    const formattedPrice = isLatAm ? `${currencySymbol} ${ticketBasic} ${currencyCode}` : `R$ ${ticketBasic.toFixed(2).replace('.', ',')}`;
    const formattedPriceComplete = isLatAm ? `${currencySymbol} ${ticketComplete} ${currencyCode}` : `R$ ${ticketComplete.toFixed(2).replace('.', ',')}`;

    const isReceiptAnalysis = (userMessage || '').includes('[COMPROVANTE DE PAGAMENTO ANALISADO]');
    const allDelivTags = deliverables.length > 0
      ? deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ')
      : '[ENVIAR_ARQUIVO: PRODUTO]';

    let contextDirective = '';

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

    // 0. Explicit request for Voice Note / Audio
    const isUserAskingForAudio = /(?:mandar?|enviar?|grabar?|puedes mandar|me podr[ií]as mandar|manda|envia)\s+(?:un\s+)?audio|escuchar\s+en\s+audio|audio\s+explicando|manda\s+(?:um\s+)?[aá]udio|grava\s+(?:um\s+)?[aá]udio|pode\s+mandar\s+[aá]udio/i.test(lowerUserMsg);

    // 1. Explicit request to pay / ask for payment coordinates
    const isExplicitPaymentRequest = /^(?:qual [eé] (?:o|a)|me (?:passa|manda|envia)|manda|envia|passa|quero|onde|como|pode mandar|favor mandar|p[aá]sa(?:me)?|dame|m[aá]nda(?:me)?|env[ií]a(?:me)?).*(?:pix|chave|link|dados.*pago|datos.*pago|cuenta|c[oó]digo|spei|nequi|alias|qr)/i.test(lowerUserMsg) ||
      /(?:como|onde|quero|posso|donde|c[oó]mo|quiero|puedo).*(?:pagar|transferir|abonar|cancelar|hacer el pago)/i.test(lowerUserMsg) ||
      /\b(?:chave\s*pix|manda\s*o\s*pix|passa\s*o\s*pix|envia\s*o\s*pix|qual\s*o\s*pix|dados\s*de\s*pago|datos\s*de\s*pago|pasa\s*el\s*spei|pasa\s*el\s*nequi|pasa\s*el\s*alias|dame\s*el\s*qr|como\s*pago|c[oó]mo\s*pago)\b/i.test(lowerUserMsg);

    // 2. Asking about price / value (NOT ready to pay yet, wants to understand the offer)
    const isAskingPrice = /(?:quanto\s*custa|qual\s*o\s*valor|qual\s*o\s*pre[çc]o|qual\s*valor|quanto\s*[eé]|pre[çc]o|cu[aá]nto\s*cuesta|qu[eé]\s*precio|cu[aá]nto\s*vale|precio|costo)\b/i.test(lowerUserMsg);

    // 3. Claiming already paid
    const isUserClaimingPaid = /já fiz|ja fiz|já paguei|ja paguei|fiz aqui|acabei de fazer|já transferi|ja transferi|mandei o pix|mandei o comprovante|pago|paguei|ta pago|tá pago|transferi|ya pagu[eé]|ya transfer[ií]|ya hice el pago|listo el pago|ya te envi[eé]|ya te deposit[eé]|comprobante/i.test(lowerUserMsg);

    // 4. Asking if these files are the definitive ones
    const isUserAskingIfTheseAreTheFiles = /achei q eram esses|achei que eram esses|são esses|sao esses|é esse|é essa|são essas|pode mandar|manda pfv|manda por favor|vai mandar|son estos|es este|es esta|son estas|puedes mandar|manda porfa|env[ií]amelos|me los mandas/i.test(lowerUserMsg);

    if (isUserAskingForAudio) {
      if (isLatAm) {
        contextDirective = `SITUACIÓN: El cliente solicitó explícitamente una nota de voz / audio ("${userMessage}").
- Responde con un saludo o frase corta y amable, OBLIGATORIAMENTE acompañada de una nota de voz con la etiqueta [AUDIO: ...].
- En la nota de voz, explícale las actividades y cómo los niños aprenden jugando con tus propias palabras, con tono cálido, humano y entusiasta en español de ${targetCountry}.
- Pregúntale la edad del pequeño/a o para quién serían las actividades para orientarlo mejor.`;
      } else {
        contextDirective = `SITUAÇÃO: O cliente pediu explicitamente que você envie um áudio ("${userMessage}").
- Responda com muito carinho gravando uma nota de voz com a tag [AUDIO: ...].
- Explique as atividades e como as crianças aprendem brincando com suas próprias palavras, tom acolhedor e humano.
- Pergunte a idade do pequeno(a) para orientá-lo melhor.`;
      }
    } else if (isReceiptAnalysis) {
      const isApprovedReceipt = userMessage.includes('Status: APROVADO');
      const isAgendadoReceipt = userMessage.includes('Status: AGENDADO');

      if (isApprovedReceipt) {
        if (isLatAm) {
          contextDirective = `SITUACIÓN: El cliente envió el comprobante y el pago fue 100% APROBADO y confirmado.
- ¡Agradece con gran cariño, gratitud y entusiasmo por su compra (${formattedPrice})!
- Si ya tiene los archivos, confírmale con alegría que ya los tiene en sus manos para aprovecharlos al máximo.
- Si la estrategia es require_payment, libera ahora los archivos: ${allDelivTags}.
- Incluye un [AUDIO: ...] cálido y dulce felicitándolo y dándole la bienvenida.`;
        } else {
          contextDirective = `SITUAÇÃO: O cliente enviou o comprovante de pagamento e o PIX foi 100% APROVADO e confirmado!
- Agradeça com imensa gratidão, carinho e entusiasmo pela adesão (${formattedPrice})!
- Se o cliente já recebeu os arquivos, confirme com alegria que ele já está com tudo em mãos para aproveitar.
- Se a estratégia for require_payment, libere os arquivos agora: ${allDelivTags}.
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
    } else if (isExplicitPaymentRequest) {
      // Cliente pediu EXPLICITAMENTE os dados de pagamento
      if (isLatAm) {
        let paymentMethodInstructionsText = '';
        if (targetCountry === 'México') {
          const existingCharge = storage.getXpagCharge(phone);
          const clabeInfo = existingCharge?.clabe
            ? `CLABE interbancaria única ya generada: ${existingCharge.clabe} (Banco: ${existingCharge.bankName || 'STP'})`
            : `${product.xpagInstructions || 'Código de pago automático SPEI'}`;
          paymentMethodInstructionsText = `- Explica que se generará el código SPEI único y automático en pantalla (${clabeInfo}).
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
- Presenta las dos opciones de forma clara: Ticket Básico (${formattedPrice}) o Ticket Completo (${formattedPriceComplete}).
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
    } else if (isAskingPrice && !hasPixBeenSent) {
      // Cliente perguntou o PREÇO / VALOR (não pediu chave de pagamento)
      if (isLatAm) {
        contextDirective = `SITUACIÓN: El cliente está preguntando el precio o costo del producto ("${userMessage}").
- Responde con total naturalidad y calidez.
- Presenta las opciones: Paquete Básico (${formattedPrice}) y Paquete Completo (${formattedPriceComplete}).
- Explica brevemente el valor o transformación que obtendrá.
- Haz una pregunta cercana para entender su objetivo o necesidad (ej: qué espera lograr o para quién es).
- NO envíes cuentas o códigos bancarios todavía; permite que el cliente dialogue y decida con tranquilidad.`;
      } else {
        contextDirective = `SITUAÇÃO: O cliente perguntou o preço ou valor do produto ("${userMessage}").
- Responda com simpatia e naturalidade.
- Apresente as opções: Pacote Básico (${formattedPrice}) e Pacote Completo (${formattedPriceComplete}).
- Destaque o benefício principal ou o que vem incluso.
- Faça uma pergunta de interesse para conhecê-lo melhor e manter a conversa fluindo de forma leve.
- NÃO envie a chave PIX ainda; converse e só envie dados de pagamento quando o cliente pedir ou confirmar que quer começar!`;
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
      // FLUXO UNIVERSAL COM LIBERDADE E AUTONOMIA TOTAL CONVERSACIONAL (LATAM & BRASIL)
      const totalHistoryCount = (conversationHistory || []).length;
      if (isLatAm) {
        const historyNotice = totalHistoryCount >= 2
          ? `\n- ANDAMIENTO DE LA CONVERSACIÓN: Ya existen ${totalHistoryCount} mensajes en el historial. NO saludes de nuevo, NO te presentes y NO repitas preguntas que el cliente ya respondió. Continúa directo en el tema.`
          : '';

        contextDirective = `SITUACIÓN ACTUAL DE LA ATENCIÓN:
Mensaje del cliente: "${userMessage}".

ESTADO DE LA CONVERSACIÓN:
- Materiales enviados anteriormente? ${hasSentDeliverable ? 'SÍ (ya entregados)' : 'NO (aún no enviados)'}
- Datos de pago enviados anteriormente? ${hasPixBeenSent ? 'SÍ (ya enviados)' : 'NO (aún no enviados)'}${historyNotice}

DIRECTRICES DE MÁXIMA AUTONOMÍA CONVERSACIONAL (OPERACIÓN GLOBAL):
1. RESPONDE PRIMERO AL CLIENTE: No ignores lo que dijo el lead. Responde directamente a su duda o comentario con calidez, empatía y cercanía real de WhatsApp en ${targetCountry}.
2. CERO GUIONES FORZADOS: Tienes total libertad para desenrolar la conversación, conversar como un ser humano y entender su necesidad real.
3. ENTREGA DE MATERIALES:
${deliveryStrategy === 'deliver_first'
  ? (hasSentDeliverable 
      ? '   - Los materiales ya fueron entregados anteriormente.' 
      : `   - Tienes total autonomía para entregar los materiales completos ahora usando las etiquetas: ${allDelivTags} si el cliente mostró interés o pidió verlos.`)
  : '   - Si la estrategia requiere pago previo, los materiales oficiales se enviarán tras la confirmación del pago.'}
4. PITCH CONSULTIVO ADAPTADO:
${hasPixBeenSent 
  ? '   - Los datos de pago ya fueron enviados. No presiones. Brinda espacio, responde dudas con amabilidad y solo reenvía los datos si el cliente lo solicita.' 
  : `   - Solo cuando sientas que es el momento oportuno (tras resolver dudas o cuando exprese entusiasmo), haz el pitch adaptado a lo que te contó y ofrece el paquete Básico (${formattedPrice}) o Completo (${formattedPriceComplete}).`}
5. TONO HUMANO, AUDIO Y ORDEN: Habla como una persona real en WhatsApp de ${targetCountry}. Tú decides con total libertad el orden: si envías texto antes del audio [AUDIO: ...], audio antes del texto, o respondes únicamente en texto según lo que sea más natural.`;
      } else {
        const historyNotice = totalHistoryCount >= 2
          ? `\n- ANDAMENTO DA CONVERSA: Já existem ${totalHistoryCount} mensagens trocadas neste atendimento. NÃO dê saudações, NÃO se reapresente e NÃO repita perguntas que o cliente já respondeu no histórico. Continue direto no assunto.`
          : '';

        contextDirective = `SITUAÇÃO ATUAL DO ATENDIMENTO:
Mensagem do cliente: "${userMessage}".

ESTADO DA CONVERSA:
- Materiais enviados anteriormente? ${hasSentDeliverable ? 'SIM (já entregues)' : 'NÃO (ainda não foram enviados)'}
- Chave PIX enviada anteriormente? ${hasPixBeenSent ? 'SIM (já enviada)' : 'NÃO (ainda não enviada)'}${historyNotice}

DIRETRIZES DE MÁXIMA AUTONOMÍA CONVERSACIONAL (OPERAÇÃO BRASIL):
1. RESPONDA PRIMEIRO AO CLIENTE: Não ignore o que o cliente disse! Se ele fez uma pergunta ou compartilhou algo sobre a rotina/desafios, responda com atenção e carinho genuíno.
2. ZERO ROTEIROS FORÇADOS: Você tem total liberdade e autonomia para desenrolar o diálogo de forma humana e espontânea.
3. ENTREGA DE MATERIAIS:
${deliveryStrategy === 'deliver_first'
  ? (hasSentDeliverable 
      ? '   - Os materiais já foram entregues anteriormente.' 
      : `   - Você tem autonomia para liberar todos os materiais agora usando as tags: ${allDelivTags} se o cliente demonstrou interesse ou pediu para ver.`)
  : '   - Se a operação for de cobrança prévia, os arquivos oficiais são liberados automaticamente após a confirmação do pagamento.'}
4. PITCH CONSULTIVO ADAPTADO:
${hasPixBeenSent 
  ? '   - A chave PIX já foi enviada anteriormente. NÃO force a barra nem fique cobrando. Dê espaço, responda dúvidas com gentileza e só reenvie se ele pedir.' 
  : `   - Quando você sentir que o momento é oportuno, faça o pitch adaptado à realidade que ele te contou e ofereça o Pacote Básico (${formattedPrice}) ou o Pacote Completo (${formattedPriceComplete}).`}
5. TOM HUMANO, ÁUDIO E ORDEM: Fale como uma pessoa real no WhatsApp. Você decide com total liberdade o que vem primeiro: se o texto antes e o áudio [AUDIO: ...] depois, se o áudio primeiro e o texto depois, ou se responde apenas em texto conforme fizer mais sentido no momento.`;
      }
    }

    const systemPrompt = this.buildSystemPrompt(contextDirective, phone, localeInfo);

    // Build context message array
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Take up to 60 messages from conversation history (guarantees complete dialogue memory without losing early details)
    const allHistory = (conversationHistory || []).slice(-60);

    // Smart context deduplication:
    // When incoming messages arrive via WhatsApp, the debouncer saves them in storage before calling generateResponse.
    // We detect if the trailing messages in history already represent userMessage to avoid duplicate turns.
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
      // Prior history up to the last assistant response
      const priorHistory = allHistory.slice(0, lastAssistantIdx + 1);
      for (const h of priorHistory) {
        const textContent = h.text || (h.type === 'audio' ? '🎵 [Áudio]' : h.type === 'image' ? '📷 [Imagem]' : '📎 [Arquivo]');
        messages.push({
          role: h.fromMe ? 'assistant' : 'user',
          content: textContent
        });
      }
      // Single clean consolidated user turn
      messages.push({ role: 'user', content: userMessage });
    } else {
      // Standard history addition
      for (const h of allHistory) {
        const textContent = h.text || (h.type === 'audio' ? '🎵 [Áudio]' : h.type === 'image' ? '📷 [Imagem]' : '📎 [Arquivo]');
        messages.push({
          role: h.fromMe ? 'assistant' : 'user',
          content: textContent
        });
      }
      // If userMessage is not yet at the end, append it
      if (userMessage && (messages.length === 1 || messages[messages.length - 1].content !== userMessage)) {
        messages.push({ role: 'user', content: userMessage });
      }
    }

    let responseText = null;
    let modelUsed = settings.primaryModel || 'z-ai/glm-5.3';

    // 1. Try Primary NVIDIA NIM Model (timeout: 180s = 3 min)
    try {
      const primaryKey = settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (primaryKey) {
        responseText = await this.callModel(
          settings.primaryModel || 'z-ai/glm-5.3',
          primaryKey,
          messages,
          settings.temperature ?? 0.7,
          settings.maxTokens || 1500,
          180000, // 180s (3 min) timeout before falling back to secondary model
          targetLanguage,
          targetCountry
        );
        // Primary succeeded - reset cooldown and ensure fallback state is inactive
        this.lastPrimaryFailureTime = 0;
        if (settings.isFallbackActive) {
          storage.updateSettings({ ai: { isFallbackActive: false, lastFallbackReason: null } });
          storage.addLog('INFO', `Modelo Primário NVIDIA NIM (${modelUsed}) restabelecido com sucesso.`);
        }
        return { text: responseText, modelUsed, fallbackTriggered: false, locale: localeInfo };
      }
    } catch (primaryErr) {
      this.lastPrimaryFailureTime = Date.now();
      console.warn(`[NVIDIA NIM Primary Error]: ${primaryErr.message}`);
      storage.addLog(
        'FALLBACK_TRIGGERED',
        `NVIDIA NIM Primário (${settings.primaryModel || 'z-ai/glm-5.3'}) não respondeu em 3 min (${primaryErr.message}). Ativando fallback secundário (${settings.fallbackModel || 'google/diffusiongemma-26b-a4b-it'}).`
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
          60000, // 60s fallback timeout
          targetLanguage,
          targetCountry
        );
        return { text: responseText, modelUsed, fallbackTriggered: true, fallbackTier: 'secondary_nvidia', locale: localeInfo };
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
          45000, // 45s timeout for OpenRouter
          targetLanguage,
          targetCountry
        );
        storage.addLog(
          'FALLBACK_TRIGGERED',
          `Modelos NVIDIA NIM indisponíveis. Resposta atendida com sucesso pelo 3º Fallback OpenRouter (${tertiaryModel}).`
        );
        return { text: responseText, modelUsed, fallbackTriggered: true, fallbackTier: 'tertiary_openrouter', locale: localeInfo };
      }
    } catch (tertiaryErr) {
      console.error(`[OpenRouter Tertiary Fallback Error]: ${tertiaryErr.message}`);
      storage.addLog(
        'ERROR',
        `Todas as 3 IAs falharam (NVIDIA Primário, NVIDIA Secundário e OpenRouter ${settings.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free'}): ${tertiaryErr.message}`
      );
    }

    // 4. Smart Rule-Based Engine Backup (if all 3 AI models failed or offline)
    const backupReply = this.generateOfflineSmartReply(userMessage, localeInfo);
    return {
      text: backupReply,
      modelUsed: 'offline-sales-fallback',
      fallbackTriggered: true,
      fallbackTier: 'offline_rules',
      locale: localeInfo
    };
  }

  // Backup sales responses when no API keys are provided or offline
  generateOfflineSmartReply(userMessage = '', localeInfo = null) {
    const text = (userMessage || '').toLowerCase();
    const product = storage.getSettings().product || {};
    const deliverables = storage.getDeliverables();
    const allTags = deliverables.map(d => `[ENVIAR_ARQUIVO: ${d.tag}]`).join(' ') || '[ENVIAR_ARQUIVO: PRODUTO]';
    const loc = localeInfo || this.detectLanguageAndCountry(userMessage);
    const targetCountry = loc.country || product.targetCountry || 'Brasil';
    const isLatAm = loc.isLatAm;
    const currencyCode = product.currencyCode || (targetCountry === 'México' ? 'MXN' : targetCountry === 'Colômbia' ? 'COP' : targetCountry === 'Bolívia' ? 'BOB' : targetCountry === 'Paraguai' ? 'PYG' : targetCountry === 'Argentina' ? 'ARS' : 'BRL');
    const currencySymbol = product.currencySymbol || (currencyCode === 'BRL' ? 'R$' : currencyCode === 'BOB' ? 'Bs' : currencyCode === 'PYG' ? 'Gs' : '$');
    const ticketBasic = Number(product.ticketBasic ?? product.price ?? 15);
    const ticketComplete = Number(product.ticketComplete ?? (ticketBasic * 1.6).toFixed(0));
    const formattedPrice = isLatAm ? `${currencySymbol} ${ticketBasic} ${currencyCode}` : `R$ ${ticketBasic.toFixed(2).replace('.', ',')}`;

    if (isLatAm) {
      if (product.deliveryStrategy === 'deliver_first') {
        if (text.includes('si') || text.includes('quiero') || text.includes('material') || text.includes('pdf') || text.includes('actividades') || text.includes('funciona')) {
          return `${allTags}\n¡Claro que sí! Te acabo de compartir el material completo para que lo puedas revisar y comenzar a disfrutarlo hoy mismo. Échale un vistazo y me cuentas qué tal 👇`;
        }
      }
      if (text.includes('precio') || text.includes('costo') || text.includes('cuanto') || text.includes('pagar')) {
        return `El programa completo está con una oportunidad especial: Paquete Básico por solo ${formattedPrice} o Paquete Completo por ${currencySymbol} ${ticketComplete} ${currencyCode}.\n\n¿Quieres que te comparta cómo acceder ahora mismo?`;
      }
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
    const primaryKey = aiConfig.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
    if (primaryKey) {
      try {
        rawReply = await this.callModel(
          aiConfig.primaryModel || 'z-ai/glm-5.3',
          primaryKey,
          messages,
          0.4,
          2200,
          90000,
          isEnglish ? 'en' : 'es',
          targetCountry
        );
      } catch (err) {
        console.warn(`[Localize Primary Model Error]: ${err.message}. Tentando fallback...`);
      }
    }

    if (!rawReply) {
      const openRouterKey = aiConfig.tertiaryApiKey || process.env.OPENROUTER_API_KEY || settings.fishAudio?.apiKey || settings.vision?.apiKey;
      rawReply = await this.callOpenRouterModel(
        aiConfig.tertiaryModel || 'nvidia/nemotron-3.5-lightning:free',
        openRouterKey,
        messages,
        0.4,
        2200,
        60000,
        isEnglish ? 'en' : 'es',
        targetCountry
      );
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

    // Try Primary NVIDIA NIM Model
    try {
      const primaryKey = settings.primaryApiKey || process.env.NVIDIA_NIM_PRIMARY_API_KEY;
      if (primaryKey) {
        const generated = await this.callModel(
          settings.primaryModel || 'z-ai/glm-5.3',
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
