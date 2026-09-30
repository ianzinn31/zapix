# ⚡ Zapix AI - Agente Inteligente de Vendas para WhatsApp & Gestão de Métricas

O **Zapix AI** é uma plataforma completa e autônoma de atendimento, conversão de infoprodutos e fechamento de vendas no WhatsApp. Foi construído com foco em **altíssima conversão**, **segurança anti-banimento**, **áudios humanos realistas via Fish Audio (OpenCode)** e **inteligência artificial resiliente com Dual Fallback da NVIDIA NIM**.

Além disso, possui um **Dashboard Profissional** que permite acompanhar faturamento, gastos com anúncios (Meta Ads), ROAS, CAC, taxa de conversão e **ler/responder conversas ao vivo sem precisar abrir o WhatsApp no celular**.

---

## 🚀 Principais Funcionalidades

### 1. 🤖 IA com NVIDIA NIM via API & Fallback Automático Duplo
- Integração nativa com os modelos de ponta da NVIDIA NIM (ex: `meta/llama-3.3-70b-instruct`, `deepseek-ai/deepseek-r1`, `mistralai/mixtral-8x22b-instruct`).
- **Arquitetura de Contingência Dupla (Dual Fallback)**:
  - Se a API Primária sofrer oscilação, erro 429 (rate limit) ou lentidão, o sistema redireciona automaticamente para a API Secundária sem que o cliente perceba.
  - Alerta visual no dashboard indicando status da rota de IA.

### 2. 🎙️ Áudios Humanos com Fish Audio (OpenCode) & WhatsApp PTT
- Converte textos de persuasão e scripts de vendas em **áudios gravados como notas de voz nativas do WhatsApp (PTT)** com microfone verde e gráfico de ondas sonoras.
- Utiliza **FFmpeg** para codificar em formato **OGG Opus (48kHz, mono)**.
- Disparo inteligente por tag `[AUDIO: seu texto]` ou nos momentos de maior conversão (apresentação da oferta e boas-vindas).
- **Laboratório de Teste de Áudio no Dashboard**: gere e escute prévias antes de enviar.

### 3. 🛡️ Sistema Anti-Banimento e Simulação Humana Realista
- **Simulação de Digitação Variável**: calcula o tempo de digitação proporcional ao tamanho da mensagem (20ms a 45ms por caractere).
- **Tempo de Leitura/Pensamento**: intervalo aleatório antes de iniciar a resposta (simula humano lendo o WhatsApp).
- **Simulação de Presença no WhatsApp**:
  - Dispara `composing` ("digitando...") antes de mensagens de texto.
  - Dispara `recording` ("gravando áudio...") antes de notas de voz.
- **Divisão Natural em Balões**: quebra respostas longas em 2 a 3 mensagens curtas, imitando a escrita humana real.
- **Fila Sequencial por Lead**: impede disparos simultâneos que acionam filtros de spam.

### 4. 📎 Gestor de Entregáveis (PDFs e Imagens)
- Upload de e-books, amostras grátis, cronogramas em PDF e prints de prova social (resultados de alunos).
- A IA pode disparar entregáveis diretamente no momento certo da conversa via tags:
  - `[ENVIAR_ARQUIVO: GUIA_AMOSTRA]`
  - `[ENVIAR_IMAGEM: PROVA_SOCIAL]`

### 5. 💬 WhatsApp Live Chat (Sem Abrir o Celular)
- Visualizador completo de conversas em tempo real sincronizado via WebSockets (Socket.io).
- Reprodução de notas de voz e pré-visualização de mídias enviadas/recebidas.
- **Modo Takeover Humano**: botão liga/desliga para pausar a IA e assumir o atendimento manualmente a qualquer momento.
- Seletor de estágio do lead (`NOVO`, `EM CONVERSA`, `PITCH ENVIADO`, `CHECKOUT`, `APROVADO`).
- Botões de atalho rápido no chat: enviar áudio de pitch, link de checkout, PDF ou prova social com 1 clique.

### 6. 📊 Dashboard de Métricas, Vendas & Meta Ads
- **KPIs em Tempo Real**: Faturamento Aprovado, Quantidade de Vendas, Gasto com Meta Ads, Taxa de Conversão, CAC Médio e ROAS.
- **Funil de Vendas Visual**: acompanhe a evolução dos leads da primeira mensagem até a conversão.
- **Gráfico de Receita dos Últimos 7 Dias**.
- **Sincronização com Meta Ads**: puxe gastos da conta de anúncios pela Graph API ou ajuste manualmente.
- **Webhooks Prontos**: receba notificações instantâneas de pagamento de plataformas como **Kiwify**, **Hotmart**, **PerfectPay** e **Cakto**.

---

## 🛠️ Tecnologias Utilizadas

- **Backend**: Node.js v24 (ESM), Express 5, Socket.io, Multer, Axios, Pino.
- **WhatsApp Engine**: `@whiskeysockets/baileys` (Conexão direta WebSocket Multi-Device).
- **Áudio Processing**: `ffmpeg` com codec `libopus` nativo.
- **Frontend**: React 18, Vite, Lucide Icons, Canvas Confetti.
- **Estilo**: CSS Vanilla moderno com Glassmorphism, paleta HSL Tailwind Dark, Google Fonts Inter e Outfit.

---

## 📦 Como Instalar e Rodar

### 1. Clonar ou Acessar a Pasta do Projeto
```bash
cd "atendimento IA zapix"
```

### 2. Instalar Dependências (se ainda não instaladas)
```bash
npm install
cd client && npm install && cd ..
```

### 3. Rodar o Sistema Completo
Para desenvolvimento com hot-reload automático do frontend e backend:
```bash
npm run dev
```

Ou para rodar o servidor em produção:
```bash
npm run build
npm start
```

### 4. Acessar o Dashboard
Abra no seu navegador:
- **Painel Principal**: [http://localhost:5173](http://localhost:5173) (ou `http://localhost:3001`)

---

## ⚙️ Configuração das Chaves de API

Você pode configurar suas chaves diretamente nas abas de configuração do Dashboard ou criando um arquivo `.env` na raiz:

```env
PORT=3001

# NVIDIA NIM - Obtenha em https://build.nvidia.com
NVIDIA_NIM_PRIMARY_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NVIDIA_NIM_FALLBACK_API_KEY=nvapi-yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy

# Fish Audio - Obtenha em https://fish.audio
FISH_AUDIO_API_KEY=fa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FISH_AUDIO_VOICE_ID=7f92f8afb8ec43bf81429cc1c9199cb1

# Meta Ads (Opcional)
META_ACCESS_TOKEN=EAABxxxxxxxxxxxxxxxxxxxxxxx
META_AD_ACCOUNT_ID=act_1234567890
```

---

## 📲 Conectando o WhatsApp

1. No topo do Dashboard, clique no botão **"Conectar WhatsApp"**.
2. O sistema iniciará a sessão Baileys e gerará o **QR Code** na tela.
3. No WhatsApp do celular, vá em:
   `Configurações > Aparelhos Conectados > Conectar um Aparelho`
4. Aponte a câmera para o QR Code no dashboard.
5. Pronto! O indicador mudará para **"Zap Conectado"** e o robô estará apto a vender.

---

## 🔗 Configuração dos Webhooks de Vendas

Copie os links abaixo e adicione na sua plataforma de pagamento:

| Plataforma | URL do Webhook | Evento Recomendado |
| :--- | :--- | :--- |
| **Kiwify** | `http://SEU_DOMINIO/webhooks/kiwify` | Pedido Pago / Order Approved |
| **Hotmart** | `http://SEU_DOMINIO/webhooks/hotmart` | Compra Aprovada |
| **PerfectPay** | `http://SEU_DOMINIO/webhooks/perfectpay` | Status Aprovado (código 2) |
| **Genérico** | `http://SEU_DOMINIO/webhooks/generic` | Envio de JSON com `phone` e `amount` |

---

## 🧪 Testes e Simulações Rápidas

No painel superior do Dashboard você encontra botões dedicados para testar todo o ecossistema sem precisar gastar dinheiro real ou conectar telefones:
- **⚡ Simular Lead**: simula um potencial cliente enviando perguntas no WhatsApp.
- **💰 Simular Venda**: simula uma compra aprovada de R$ 97 com animação de confetes e atualização automática de faturamento, ROAS e CAC.
- **🎙️ Laboratório de Áudio**: teste qualquer texto e escute como fica a nota de voz do WhatsApp.
