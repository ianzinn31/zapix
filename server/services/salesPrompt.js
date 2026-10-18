// =============================================================================
// Sales Prompt Builder
// -----------------------------------------------------------------------------
// Builds the system prompt sent to the sales AI on every WhatsApp turn.
//
// Layout (order matters):
//   1. Static blocks  -> role, language, product, materials, payment, delivery,
//                        response format, conversation rules, operator notes
//   2. Dynamic blocks -> conversation state + focus for THIS reply (always last)
//
// Keeping the static prefix identical between turns lets providers cache it and
// puts the most relevant, turn-specific instruction closest to the generation.
// Each rule appears exactly once. No ALL CAPS shouting, no fixed scripts.
// =============================================================================

const COUNTRY_NAME_ES = {
  'México': 'México',
  'Colômbia': 'Colombia',
  'Argentina': 'Argentina',
  'Bolívia': 'Bolivia',
  'Paraguai': 'Paraguay',
  'Peru': 'Perú',
  'Chile': 'Chile',
  'Equador': 'Ecuador',
  'Venezuela': 'Venezuela',
  'Estados Unidos': 'Estados Unidos'
};

const SLANG_ES = {
  'México': 'tono mexicano cálido y cercano (ej.: "con todo gusto", "oye", "ahorita te cuento", "está padrísimo", "porfa")',
  'Colômbia': 'tono colombiano amable y respetuoso (ej.: "con mucho gusto", "chévere", "de una", "listo", "a la orden")',
  'Argentina': 'tono argentino cercano con voseo (ej.: "mirá", "te cuento", "dale", "fijate", "avisame")',
  'Chile': 'tono chileno amable y ágil',
  'Peru': 'tono peruano cordial y educado',
  'Bolívia': 'tono boliviano cálido y familiar',
  'Paraguai': 'tono paraguayo cercano y sencillo'
};

const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
const lines = (...items) => items.flat().filter(Boolean).join('\n');
const section = (title, body) => (clean(body) ? `# ${title}\n${clean(body)}` : '');

// -----------------------------------------------------------------------------
// Payment block (only the method that applies to the lead's country)
// -----------------------------------------------------------------------------
export function buildPaymentLines({ lang, country, product = {}, xpagCharge = null }) {
  const p = product;

  if (country === 'Brasil' || lang === 'pt') {
    const method = p.paymentMethod || (p.pixKey ? 'both' : 'checkout');
    const pixKeyFormatted = clean(p.pixKey) ? `\`\`\`${clean(p.pixKey)}\`\`\`` : '```88994892385```';
    const pix = lines(
      `- PIX (${clean(p.pixKeyType) || 'chave'}): ${pixKeyFormatted} — Titular: ${clean(p.pixBeneficiary) || 'ian alves dos anjos'}`,
      clean(p.pixInstructions) ? `- Instruções: ${clean(p.pixInstructions)}` : '- Depois de pagar, o cliente envia o comprovante aqui para confirmação.'
    );
    const checkout = clean(p.checkoutUrl) ? `- Cartão / parcelado: ${clean(p.checkoutUrl)}` : '';

    if (method === 'pix') return pix;
    if (method === 'both') return lines(pix, checkout);
    return checkout || pix;
  }

  if (country === 'México') {
    return lines(
      '- SPEI automático (XPag): se genera una CLABE única para el cliente. La activación es automática al pagar; no hace falta enviar comprobante.',
      xpagCharge?.clabe ? `- CLABE ya generada para este cliente: \`\`\`${xpagCharge.clabe}\`\`\` (Banco: ${clean(xpagCharge.bankName) || 'STP'})` : '',
      clean(p.xpagInstructions) ? `- Instrucciones: ${clean(p.xpagInstructions)}` : ''
    );
  }

  if (country === 'Colômbia') {
    const nequiFormatted = clean(p.nequiNumber) ? `\`\`\`${clean(p.nequiNumber)}\`\`\`` : '(número no configurado)';
    return lines(
      `- Nequi / Bre-B: ${nequiFormatted}${clean(p.nequiBeneficiary) ? ` — Titular: ${clean(p.nequiBeneficiary)}` : ''}`,
      clean(p.nequiInstructions) ? `- Instrucciones: ${clean(p.nequiInstructions)}` : '- Después de pagar, el cliente envía el comprobante aquí para activar el acceso.'
    );
  }

  if (country === 'Bolívia') {
    return lines(
      `- QR Simple o transferencia: ${[
        clean(p.boliviaBankName) && `Banco ${clean(p.boliviaBankName)}`,
        clean(p.boliviaAccountNumber) && `Cuenta ${clean(p.boliviaAccountNumber)}`,
        clean(p.boliviaBeneficiary) && `Titular ${clean(p.boliviaBeneficiary)}`
      ].filter(Boolean).join(' — ') || '(datos no configurados)'}`,
      clean(p.boliviaQrUrl) ? `- QR: ${clean(p.boliviaQrUrl)}` : '',
      clean(p.boliviaInstructions) ? `- Instrucciones: ${clean(p.boliviaInstructions)}` : '- Después de pagar, el cliente envía el comprobante aquí.'
    );
  }

  if (country === 'Argentina' || country === 'Paraguai') {
    const aliasFormatted = clean(p.aliasKey) ? `\`\`\`${clean(p.aliasKey)}\`\`\`` : '(alias no configurado)';
    return lines(
      `- Transferencia por Alias: ${aliasFormatted}${clean(p.aliasBank) ? ` (Banco ${clean(p.aliasBank)})` : ''}${clean(p.aliasBeneficiary) ? ` — Titular: ${clean(p.aliasBeneficiary)}` : ''}`,
      clean(p.aliasInstructions) ? `- Instrucciones: ${clean(p.aliasInstructions)}` : '- Después de pagar, el cliente envía el comprobante aquí.'
    );
  }

  // Other countries: generic checkout / instructions
  return lines(
    clean(p.checkoutUrl) ? `- Link de pago: ${clean(p.checkoutUrl)}` : '',
    clean(p.paymentInstructions) ? `- Instrucciones: ${clean(p.paymentInstructions)}` : ''
  ) || '- Los datos de pago no están configurados para este país. Si el cliente quiere pagar, dile que en breve le compartes cómo hacerlo.';
}

// -----------------------------------------------------------------------------
// Materials block
// -----------------------------------------------------------------------------
function buildDeliverableLines(deliverables = [], lang = 'pt') {
  if (!deliverables.length) return '- Material digital completo → [ENVIAR_ARQUIVO: PRODUTO]';
  return deliverables.map((d) => {
    let desc = clean(d.description);
    if (lang !== 'pt') {
      desc = desc
        .replace(/atividades/gi, 'actividades')
        .replace(/crianças/gi, 'niños')
        .replace(/alfabetização/gi, 'alfabetización')
        .replace(/inglês/gi, 'inglés');
    }
    const type = clean(d.type).toUpperCase();
    return `- ${clean(d.name)}${type ? ` (${type})` : ''}${desc ? `: ${desc}` : ''} → [ENVIAR_ARQUIVO: ${d.tag}]`;
  }).join('\n');
}

// -----------------------------------------------------------------------------
// Static system prompt
// -----------------------------------------------------------------------------
export function buildSalesPrompt({
  lang = 'pt',
  country = 'Brasil',
  vars = {},
  locProd = {},
  product = {},
  deliverables = [],
  audioEnabled = true,
  xpagCharge = null,
  operatorInstructions = '',
  turnContext = ''
}) {
  const isPt = lang === 'pt';
  const guarantee = product.guaranteeDays || 7;
  const deliveryStrategy = product.deliveryStrategy || 'require_payment';
  const payment = buildPaymentLines({ lang, country, product, xpagCharge });
  const materials = buildDeliverableLines(deliverables, lang);
  const pitch = isPt ? clean(product.defaultAudioPitchText) : clean(locProd.defaultAudioPitchText);

  const blocks = isPt
    ? buildPortugueseBlocks({ vars, locProd, product, guarantee, deliveryStrategy, payment, materials, pitch, audioEnabled })
    : buildSpanishBlocks({ lang, country, vars, locProd, guarantee, deliveryStrategy, payment, materials, pitch, audioEnabled });

  const operatorTitle = isPt ? 'INSTRUÇÕES DO OPERADOR' : 'INSTRUCCIONES DEL OPERADOR';

  return [
    ...blocks,
    section(operatorTitle, operatorInstructions),
    clean(turnContext)
  ].filter(Boolean).join('\n\n') + '\n';
}

function buildPortugueseBlocks({ vars, locProd, product, guarantee, deliveryStrategy, payment, materials, pitch, audioEnabled }) {
  const productName = clean(locProd.name) || clean(product.name) || vars.NOME_PRODUTO;

  return [
    section('PAPEL', `Você atende clientes no WhatsApp vendendo "${productName}"${clean(locProd.niche) ? ` (${clean(locProd.niche)})` : ''}. Converse como uma pessoa real: calorosa, atenta e objetiva. Seu objetivo é entender a situação do cliente, tirar as dúvidas dele e conduzi-lo à compra com naturalidade, sem pressão.`),

    section('IDIOMA E TOM', lines(
      '- Escreva sempre em português do Brasil, num tom informal e acolhedor de WhatsApp.',
      '- Use emojis com moderação (no máximo um por mensagem).'
    )),

    section('PRODUTO', lines(
      clean(locProd.targetAudience) ? `- Público-alvo: ${clean(locProd.targetAudience)}` : '',
      `- Opções: Pacote Básico ${vars.VALOR_BASICO} | Pacote Completo ${vars.VALOR_COMPLETO}`,
      `- Garantia: ${guarantee} dias, incondicional (reembolso total se não gostar).`,
      '- Formato: material digital enviado aqui mesmo no WhatsApp. Pagamento único, sem mensalidade.',
      clean(locProd.painPoints) ? `\nDores do cliente:\n${clean(locProd.painPoints)}` : '',
      clean(locProd.benefits) ? `\nBenefícios:\n${clean(locProd.benefits)}` : '',
      clean(locProd.objections) ? `\nObjeções comuns e como responder:\n${clean(locProd.objections)}` : '',
      pitch ? `\nDireção do produtor (use como bússola, nunca recite literalmente):\n"${pitch}"` : ''
    )),

    section('MATERIAIS', lines(
      'Para enviar um material, escreva a tag dele exatamente como abaixo, em uma linha separada:',
      materials
    )),

    section('PAGAMENTO', lines(
      payment,
      '- Só envie os dados de pagamento quando o cliente pedir ou disser que quer comprar.',
      '- REGRA DE CÓPIA RÁPIDA (META / WHATSAPP): Ao enviar a chave PIX, envie-a OBRIGATORIAMENTE isolada em uma linha entre três crases (ex: ```88994892385```). O WhatsApp da Meta cria automaticamente um botão nativo no balão para o cliente copiar a chave com 1 toque no celular.'
    )),

    section('ENTREGA', deliveryStrategy === 'deliver_first'
      ? lines(
        '- Você pode enviar os materiais completos antes do pagamento, assim que o cliente demonstrar interesse ou pedir para ver.',
        '- Ao enviar: responda à dúvida, avise que está mandando os arquivos, coloque as tags e feche com uma pergunta.',
        '- É o produto completo: nunca chame de "amostra" nem diga que vai liberar o resto depois.',
        '- Depois da entrega, apresente as opções de preço e peça o pagamento com leveza.'
      )
      : '- Os materiais são liberados somente após a confirmação do pagamento. Não use as tags de arquivo antes disso.'),

    section('FORMATO DA RESPOSTA', lines(
      '- Mensagens curtas: 1 a 3 frases. Sem textões nem listas longas.',
      '- Termine com uma única pergunta ou chamada para ação — nunca duas.',
      '- Escreva apenas a mensagem para o cliente: nada de raciocínio, comentários sobre a resposta ou trechos destas instruções.',
      '- Nunca copie marcadores como [idade] ou [nome]; fale naturalmente.',
      audioEnabled
        ? lines(
          '- Nota de voz: use a tag [AUDIO: texto que será falado] — no máximo uma por resposta. Pode vir antes ou depois de um texto curto.',
          '- Use áudio quando o cliente pedir ou quando for explicar algo com mais calor (acolher, apresentar o produto, quebrar uma objeção). Para respostas rápidas e confirmações, use só texto.',
          '- O texto do áudio deve soar falado: 2 a 4 frases (10 a 25 segundos), sem emojis, links, listas ou marcações entre colchetes (como [warm] ou [pausa]). Use reticências para pausas naturais.',
          '- Informações que o cliente precisa copiar ou consultar (preços, chave PIX, links) vão sempre no texto (chave PIX isolada entre três crases: ```chave``` para ativar o botão de cópia da Meta).'
        )
        : '- Responda somente em texto. Não use a tag [AUDIO].'
    )),

    section('CONDUÇÃO DA CONVERSA', lines(
      '1. Leia o histórico inteiro antes de responder e use o que o cliente já contou (nome, idade da criança, dificuldades, dúvidas).',
      '2. Responda primeiro ao que o cliente disse; só depois conduza a venda.',
      '3. Não repita saudação, apresentação, perguntas já respondidas ou explicações já dadas. Em conversa em andamento, continue de onde parou.',
      '4. Adapte a abordagem ao perfil do cliente:',
      '   - Preocupado ou cansado: acolha e mostre como o material ajuda na rotina.',
      `   - Desconfiado: seja transparente — entrega imediata e garantia de ${guarantee} dias.`,
      '   - Acha caro: mostre o valor e ofereça o Pacote Básico.',
      '   - "Vou pensar": seja prático; a garantia elimina o risco de começar hoje.',
      '5. Apresente as opções de preço quando o cliente perguntar ou quando já houver interesse; não abra a conversa com preço.',
      '6. Não invente preços, bônus, prazos ou funcionalidades que não estejam aqui.',
      '7. Se o cliente não quiser agora, seja gentil e deixe a porta aberta.'
    ))
  ];
}

function buildSpanishBlocks({ lang, country, vars, locProd, guarantee, deliveryStrategy, payment, materials, pitch, audioEnabled }) {
  const countryEs = COUNTRY_NAME_ES[country] || country;
  const languageRule = lang === 'en'
    ? '- Responde siempre en inglés (English) natural y cálido, aunque estas instrucciones estén en español.'
    : `- Responde siempre y solamente en español de ${countryEs}, con ${SLANG_ES[country] || 'tono latinoamericano cálido y cercano'}.\n- Nunca uses palabras en portugués (como "você", "crianças", "com certeza", "tá bom").`;

  return [
    section('ROL', `Atiendes clientes por WhatsApp vendiendo "${clean(locProd.name) || vars.NOME_PRODUTO}"${clean(locProd.niche) ? ` (${clean(locProd.niche)})` : ''} en ${countryEs}. Conversa como una persona real: cálida, atenta y directa. Tu objetivo es entender la situación del cliente, resolver sus dudas y llevarlo a la compra con naturalidad, sin presión.`),

    section('IDIOMA Y TONO', lines(
      languageRule,
      '- Usa emojis con moderación (máximo uno por mensaje).'
    )),

    section('PRODUCTO', lines(
      clean(locProd.targetAudience) ? `- Público objetivo: ${clean(locProd.targetAudience)}` : '',
      `- Opciones: Paquete Básico ${vars.VALOR_BASICO} | Paquete Completo ${vars.VALOR_COMPLETO}`,
      '- Muestra los precios solo en esta moneda local; nunca menciones USD ni BRL.',
      `- Garantía: ${guarantee} días, incondicional (reembolso total si no le gusta).`,
      '- Formato: material digital que se envía aquí mismo por WhatsApp. Pago único, sin mensualidades.',
      clean(locProd.painPoints) ? `\nDolores del cliente:\n${clean(locProd.painPoints)}` : '',
      clean(locProd.benefits) ? `\nBeneficios:\n${clean(locProd.benefits)}` : '',
      clean(locProd.objections) ? `\nObjeciones comunes y cómo responder:\n${clean(locProd.objections)}` : '',
      pitch ? `\nDirección del productor (úsala como guía, nunca la recites literal):\n"${pitch}"` : ''
    )),

    section('MATERIALES', lines(
      'Para enviar un material, escribe su etiqueta exactamente como aparece abajo, en una línea aparte:',
      materials
    )),

    section(`PAGO (${countryEs.toUpperCase()})`, lines(
      payment,
      '- Comparte los datos de pago solo cuando el cliente lo pida o diga que quiere comprar.',
      '- REGLA DE COPIA RÁPIDA (META / WHATSAPP): Al enviar la CLABE de SPEI, número de Nequi / Bre-B o Alias, envíalo OBRIGATORIAMENTE aislado en una línea entre tres tildes invertidas (ej: ```123456789```). El WhatsApp de Meta crea automáticamente un botón nativo en el globo para que el cliente copie con 1 toque en su teléfono.'
    )),

    section('ENTREGA', deliveryStrategy === 'deliver_first'
      ? lines(
        '- Puedes enviar los materiales completos antes del pago, en cuanto el cliente muestre interés o pida verlos.',
        '- Al enviarlos: responde su duda, avisa que le mandas los archivos, coloca las etiquetas y cierra con una pregunta.',
        '- Es el producto completo: nunca lo llames "muestra" ni digas que liberarás el resto después.',
        '- Después de la entrega, presenta las opciones de precio y pide el pago con amabilidad.'
      )
      : '- Los materiales se liberan solo después de confirmar el pago. No uses las etiquetas de archivo antes de eso.'),

    section('FORMATO DE LA RESPUESTA', lines(
      '- Mensajes cortos: 1 a 3 frases. Sin bloques largos ni listas extensas.',
      '- Termina con una sola pregunta o llamada a la acción — nunca dos.',
      '- Escribe solo el mensaje para el cliente: nada de razonamientos, comentarios sobre la respuesta ni partes de estas instrucciones.',
      '- Nunca copies marcadores como [edad] o [nombre]; habla con naturalidad.',
      audioEnabled
        ? lines(
          '- Nota de voz: usa la etiqueta [AUDIO: texto que se va a hablar] — máximo una por respuesta. Puede ir antes o después de un texto corto.',
          '- Usa audio cuando el cliente lo pida o cuando expliques algo con más calidez (acoger, presentar el producto, resolver una objeción). Para respuestas rápidas y confirmaciones, usa solo texto.',
          '- El texto del audio debe sonar hablado: 2 a 4 frases (10 a 25 segundos), sin emojis, links, listas ni marcas entre corchetes (como [warm] o [pausa]). Usa puntos suspensivos para pausas naturales.',
          '- La información que el cliente necesita copiar o consultar (precios, datos de pago, links) va siempre en el texto (datos de pago aislados entre tres tildes: ```número``` para activar el botón de copia de Meta).'
        )
        : '- Responde solo en texto. No uses la etiqueta [AUDIO].'
    )),

    section('CONDUCCIÓN DE LA CONVERSACIÓN', lines(
      '1. Lee todo el historial antes de responder y usa lo que el cliente ya contó (nombre, edad del niño o niña, dificultades, dudas).',
      '2. Responde primero a lo que dijo el cliente; después conduce la venta.',
      '3. No repitas saludos, presentaciones, preguntas ya respondidas ni explicaciones ya dadas. Si la conversación ya empezó, sigue desde donde quedó.',
      '4. Adapta el enfoque al perfil del cliente:',
      '   - Preocupado o cansado: acógelo y muestra cómo el material ayuda en su rutina.',
      `   - Desconfiado: sé transparente — entrega inmediata y garantía de ${guarantee} días.`,
      '   - Le parece caro: muestra el valor y ofrece el Paquete Básico.',
      '   - "Lo voy a pensar": sé práctico; la garantía elimina el riesgo de empezar hoy.',
      '5. Presenta las opciones de precio cuando el cliente pregunte o cuando ya haya interés; no abras la conversación con el precio.',
      '6. No inventes precios, bonos, plazos ni funciones que no estén aquí.',
      '7. Si el cliente no quiere ahora, sé amable y deja la puerta abierta.'
    ))
  ];
}

// -----------------------------------------------------------------------------
// Turn situation detection (what is the client doing right now?)
// -----------------------------------------------------------------------------
export function detectTurnSituation(userMessage = '', { isPaid = false, hasPaymentBeenSent = false } = {}) {
  const raw = userMessage || '';
  const msg = raw.toLowerCase();

  if (/(?:mandar?|enviar?|grabar?|puedes mandar|me podr[ií]as mandar|manda|envia)\s+(?:un\s+)?audio|escuchar\s+en\s+audio|audio\s+explicando|manda\s+(?:um\s+)?[aá]udio|grava\s+(?:um\s+)?[aá]udio|pode\s+mandar\s+[aá]udio/i.test(msg)) {
    return 'audio_request';
  }

  if (raw.includes('[COMPROVANTE DE PAGAMENTO ANALISADO]')) {
    if (raw.includes('Status: APROVADO')) return 'receipt_approved';
    if (raw.includes('Status: AGENDADO')) return 'receipt_scheduled';
    return 'receipt_invalid';
  }

  if (isPaid) return 'paid';

  const isPaymentRequest =
    /^(?:qual [eé] (?:o|a)|me (?:passa|manda|envia)|manda|envia|passa|quero|onde|como|pode mandar|favor mandar|p[aá]sa(?:me)?|dame|m[aá]nda(?:me)?|env[ií]a(?:me)?).*(?:pix|chave|link|dados.*pago|datos.*pago|cuenta|c[oó]digo|spei|nequi|alias|qr)/i.test(msg) ||
    /(?:como|onde|quero|posso|donde|c[oó]mo|quiero|puedo).*(?:pagar|transferir|abonar|cancelar|hacer el pago)/i.test(msg) ||
    /\b(?:chave\s*pix|manda\s*o\s*pix|passa\s*o\s*pix|envia\s*o\s*pix|qual\s*o\s*pix|dados\s*de\s*pago|datos\s*de\s*pago|pasa\s*el\s*spei|pasa\s*el\s*nequi|pasa\s*el\s*alias|dame\s*el\s*qr|como\s*pago|c[oó]mo\s*pago)\b/i.test(msg);
  if (isPaymentRequest) return 'payment_request';

  const isAskingPrice = /(?:quanto\s*custa|qual\s*o\s*valor|qual\s*o\s*pre[çc]o|qual\s*valor|quanto\s*[eé]|pre[çc]o|cu[aá]nto\s*cuesta|qu[eé]\s*precio|cu[aá]nto\s*vale|precio|costo)\b/i.test(msg);
  if (isAskingPrice && !hasPaymentBeenSent) return 'price_question';

  if (/já fiz|ja fiz|já paguei|ja paguei|fiz aqui|acabei de fazer|já transferi|ja transferi|mandei o pix|mandei o comprovante|pago|paguei|ta pago|tá pago|transferi|ya pagu[eé]|ya transfer[ií]|ya hice el pago|listo el pago|ya te envi[eé]|ya te deposit[eé]|comprobante/i.test(msg)) {
    return 'claims_paid';
  }

  if (/achei q eram esses|achei que eram esses|são esses|sao esses|é esse|é essa|são essas|pode mandar|manda pfv|manda por favor|vai mandar|son estos|es este|es esta|son estas|puedes mandar|manda porfa|env[ií]amelos|me los mandas/i.test(msg)) {
    return 'files_question';
  }

  return 'general';
}

// -----------------------------------------------------------------------------
// Dynamic turn context: conversation state + focus for this reply
// -----------------------------------------------------------------------------
export function buildTurnContext({
  lang = 'pt',
  country = 'Brasil',
  situation = 'general',
  vars = {},
  deliveryStrategy = 'require_payment',
  allTags = '',
  state = {}
}) {
  const isPt = lang === 'pt';
  const { historyCount = 0, materialsSent = false, paymentSent = false, isPaid = false } = state;
  const yes = isPt ? 'sim' : 'sí';
  const no = isPt ? 'não' : 'no';
  const b = (v) => (v ? yes : no);
  const prices = isPt
    ? `Básico ${vars.VALOR_BASICO} ou Completo ${vars.VALOR_COMPLETO}`
    : `Básico ${vars.VALOR_BASICO} o Completo ${vars.VALOR_COMPLETO}`;

  const stateBlock = isPt
    ? lines(
      `- Histórico: ${historyCount} mensagens (${historyCount >= 2 ? 'conversa em andamento — não cumprimente de novo' : 'primeiro contato'})`,
      `- Materiais já enviados: ${b(materialsSent)}`,
      `- Dados de pagamento já enviados: ${b(paymentSent)}`,
      `- Pagamento confirmado: ${b(isPaid)}`
    )
    : lines(
      `- Historial: ${historyCount} mensajes (${historyCount >= 2 ? 'conversación en curso — no vuelvas a saludar' : 'primer contacto'})`,
      `- Materiales ya enviados: ${b(materialsSent)}`,
      `- Datos de pago ya enviados: ${b(paymentSent)}`,
      `- Pago confirmado: ${b(isPaid)}`
    );

  const focusPt = {
    audio_request: 'O cliente pediu um áudio. Responda com uma nota de voz [AUDIO: ...] falando diretamente sobre o que ele perguntou ou contou (pode acompanhar uma frase curta de texto).',
    receipt_approved: `Pagamento confirmado pelo comprovante. Agradeça com carinho e dê as boas-vindas. ${materialsSent
      ? 'O cliente já tem os materiais: diga que ele já pode aproveitar tudo e não fale em enviar arquivos.'
      : `Envie agora todos os materiais: ${allTags}`}`,
    receipt_scheduled: 'O comprovante é de um agendamento: o valor ainda não foi debitado. Explique com gentileza, peça para cancelar o agendamento no app do banco e fazer a transferência na hora, e reenvie os dados de pagamento.',
    receipt_invalid: 'O comprovante enviado tem uma divergência (detalhes na mensagem do cliente). Explique com respeito e reenvie os dados oficiais de pagamento.',
    paid: 'O cliente já pagou e está com o acesso confirmado. Responda às dúvidas dele com atenção; se perguntar dos materiais, confirme que são os que já foram enviados. Não tente vender de novo.',
    payment_request: `O cliente quer pagar. Se ainda não escolheu, confirme a opção (${prices}). Envie no texto os dados da seção PAGAMENTO (com a chave PIX isolada entre três crases: \`\`\`chave\`\`\` para o WhatsApp gerar o botão de cópia rápida) e diga o próximo passo (enviar o comprovante).`,
    price_question: `O cliente perguntou o preço. Informe as duas opções (${prices}), destaque em uma frase o principal benefício e faça uma pergunta para entender o que ele procura. Ainda não envie dados de pagamento.`,
    claims_paid: 'O cliente diz que já pagou. Agradeça e peça o comprovante aqui na conversa para confirmar.',
    files_question: 'O cliente pergunta se os materiais enviados são os definitivos. Confirme que sim: são os materiais completos, prontos para usar.'
  };

  const focusEs = {
    audio_request: 'El cliente pidió un audio. Responde con una nota de voz [AUDIO: ...] hablando directamente de lo que preguntó o contó (puede ir con una frase corta de texto).',
    receipt_approved: `Pago confirmado por el comprobante. Agradece con cariño y dale la bienvenida. ${materialsSent
      ? 'El cliente ya tiene los materiales: dile que ya puede disfrutarlos y no hables de enviar archivos.'
      : `Envía ahora todos los materiales: ${allTags}`}`,
    receipt_scheduled: 'El comprobante es de un pago programado: el monto aún no se debitó. Explícalo con amabilidad, pídele que cancele la programación en su app bancaria y haga la transferencia inmediata, y reenvía los datos de pago.',
    receipt_invalid: 'El comprobante enviado tiene una inconsistencia (detalles en el mensaje del cliente). Explícalo con respeto y reenvía los datos oficiales de pago.',
    paid: 'El cliente ya pagó y su acceso está confirmado. Responde sus dudas con atención; si pregunta por los materiales, confirma que son los que ya se enviaron. No intentes venderle de nuevo.',
    payment_request: `El cliente quiere pagar. Si aún no eligió, confirma la opción (${prices}). Envía en el texto los datos de la sección PAGO (con la CLABE o Nequi/Bre-B entre tres tildes invertidas: \`\`\`código\`\`\` para que WhatsApp genere el botón de copiar rápido) y explica el siguiente paso${country === 'México' ? ' (la activación es automática al pagar)' : ' (enviar el comprobante)'}.`,
    price_question: `El cliente preguntó el precio. Indica las dos opciones (${prices}), destaca en una frase el beneficio principal y haz una pregunta para entender qué busca. Todavía no envíes datos de pago.`,
    claims_paid: country === 'México'
      ? 'El cliente dice que ya pagó. Agradece; con SPEI la confirmación es automática. Si aún no aparece confirmado, pídele el comprobante aquí.'
      : 'El cliente dice que ya pagó. Agradece y pídele el comprobante aquí en la conversación para confirmarlo.',
    files_question: 'El cliente pregunta si los materiales enviados son los definitivos. Confirma que sí: son los materiales completos, listos para usar.'
  };

  let focus = (isPt ? focusPt : focusEs)[situation];

  if (!focus) {
    // General turn: derive a short hint from the funnel state
    if (isPaid) {
      focus = isPt ? focusPt.paid : focusEs.paid;
    } else if (paymentSent) {
      focus = isPt
        ? 'Os dados de pagamento já foram enviados. Não insista: tire as dúvidas e só reenvie os dados se o cliente pedir.'
        : 'Los datos de pago ya fueron enviados. No insistas: resuelve dudas y solo reenvía los datos si el cliente lo pide.';
    } else if (deliveryStrategy === 'deliver_first' && !materialsSent) {
      focus = isPt
        ? 'Responda ao cliente. Se ele demonstrou interesse ou pediu para ver o material, você já pode enviar os materiais.'
        : 'Responde al cliente. Si mostró interés o pidió ver el material, ya puedes enviar los materiales.';
    } else if (materialsSent) {
      focus = isPt
        ? 'Os materiais já foram enviados. Responda ao cliente e, quando fizer sentido, pergunte o que ele achou e apresente as opções de preço.'
        : 'Los materiales ya fueron enviados. Responde al cliente y, cuando tenga sentido, pregúntale qué le parecieron y presenta las opciones de precio.';
    } else {
      focus = isPt
        ? 'Responda ao cliente e avance a conversa com naturalidade. Quando ele mostrar interesse, apresente as opções de preço.'
        : 'Responde al cliente y avanza la conversación con naturalidad. Cuando muestre interés, presenta las opciones de precio.';
    }
  }

  return [
    section(isPt ? 'ESTADO DA CONVERSA' : 'ESTADO DE LA CONVERSACIÓN', stateBlock),
    section(isPt ? 'FOCO DESTA RESPOSTA' : 'ENFOQUE DE ESTA RESPUESTA', focus)
  ].join('\n\n');
}
