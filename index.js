const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { GoogleGenAI } = require("@google/genai");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Variáveis de Ambiente (Configuradas no Render)
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN; 
const VERIFY_TOKEN = process.env.VERIFY_TOKEN; 
const GEMINI_KEY = process.env.GEMINI_KEY;

// Inicializa a IA (Gemini)
// Se a chave não existir, o app não quebra, mas a IA não responde.
const ai = GEMINI_KEY ? new GoogleGenAI({ apiKey: GEMINI_KEY }) : null;

// Rota de Teste (Para saber se o servidor está vivo)
app.get('/', (req, res) => {
  res.send('A Lúcia está acordada e pronta para vender! 🚀');
});

// 1. Verificação do Webhook (Exigência da Meta)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 2. Receber Mensagem do Cliente
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // Verifica se é um evento de mensagem do WhatsApp
  if (body.object) {
    if (
      body.entry && 
      body.entry[0].changes && 
      body.entry[0].changes[0].value.messages && 
      body.entry[0].changes[0].value.messages[0]
    ) {
      
      const msg = body.entry[0].changes[0].value.messages[0];
      const from = msg.from; // Número do cliente
      const msgType = msg.type;
      
      // Só processa se for texto (por enquanto)
      if(msgType === 'text') {
          const textBody = msg.text.body;
          console.log(`Mensagem de ${from}: ${textBody}`);

          try {
            if (!ai) throw new Error("Chave do Gemini não configurada.");

            // Cérebro da Lúcia (Prompt simplificado para o Backend)
            const modelId = "gemini-2.5-flash";
            const prompt = `
              Você é a Lúcia, uma vendedora simpática, brasileira e eficiente.
              Você vende o produto 'RejuveSkin'.
              Seja curta, use emojis e quebre objeções.
              Cliente disse: "${textBody}"
            `;
            
            const result = await ai.models.generateContent({
                model: modelId,
                contents: prompt
            });
            
            const respostaLucia = result.text || "Desculpe, não entendi.";

            // 3. Responder no WhatsApp
            await axios({
              method: 'POST',
              url: `https://graph.facebook.com/v17.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
              headers: { 
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 
                'Content-Type': 'application/json' 
              },
              data: {
                messaging_product: 'whatsapp',
                to: from,
                text: { body: respostaLucia }
              }
            });

          } catch (e) {
            console.error("Erro ao processar resposta:", e.message);
          }
      }
    }
    // Sempre retorna 200 para a Meta não bloquear o Webhook
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));