// Import library yang dibutuhkan
import TelegramBot from 'node-telegram-bot-api';
import axios from 'axios';
import fs from 'fs';

// Fungsi untuk membaca database
function readDatabase() {
  try {
    const data = fs.readFileSync('database.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Gagal membaca database:', error);
    return {};
  }
}

// Fungsi untuk menulis ke database
function writeDatabase(data) {
  try {
    fs.writeFileSync('database.json', JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Gagal menulis ke database:', error);
  }
}

// Token API Telegram
const TELEGRAM_TOKEN = '7689822872:AAH8E2Nl73aeznNpwJdZ_qwGkD7C-Tl2loQ'; // Ganti dengan token bot Telegram Anda
const API_KEY = 'rizkii'; // Ganti dengan API Key BetaBotz Anda

// Inisialisasi bot Telegram
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Menu kue
const menu = [
  { name: 'Cookies Bake Choco', price: 10000, size: '2x3' },
  { name: 'Bake Susshi Shaka', price: 10000, size: '2x3' },
  { name: 'Matoa Cake', price: 10000, size: '2x3' },
];

// Fungsi untuk memproses pesan dengan BetaBotz API
async function handleAIResponse(userMessage, chatId) {
  console.log('Pesan pengguna:', userMessage); // Log pesan pengguna

  // Ambil percakapan sebelumnya dari database
  const db = readDatabase();
  const chatHistory = db[chatId]?.chatsAndResponseBotSaved || [];

  // Gabungkan percakapan sebelumnya dan pesan baru dari pengguna
  const messages = [
    { role: 'system', content: 'Kamu adalah Customer Service RizzCake, kamu adalah Bot yang bisa membantu customer!' },
    { role: 'assistant', content: `Tugasmu adalah menjawab pertanyaan customer dan membantu mereka memesan kue sesuai kebutuhan mereka. Menu kue kita adalah:
${menu.map((item, index) => `${index + 1}. ${item.name} - Rp.${item.price}`).join('\n')}.
Jawab pertanyaan mereka dengan ramah, dan jika mereka bertanya ongkir, beri tahu bahwa lokasi kita ada di Tembilahan, Kabupaten Indragiri Hilir, Riau.` },
    // Tambahkan percakapan sebelumnya agar AI bisa "mengingat"
    ...chatHistory.map(entry => ({
      role: 'user', content: entry.userMessage
    })),
    { role: 'user', content: userMessage }, // Pesan terbaru dari pengguna
  ];

  try {
    const params = {
      message: messages,
      apikey: API_KEY,
    };

    const { data } = await axios.post('https://api.betabotz.eu.org/api/search/openai-custom', params);

    if (data && data.result) {
      console.log('Respons dari AI:', data.result); // Log respons akhir
      saveChatToDatabase(chatId, userMessage, data.result); // Simpan percakapan ke database
      return data.result; // Pastikan mengembalikan respons yang benar
    } else {
      console.log('Respon API kosong atau tidak valid:', data); // Logging untuk debugging
      return 'Maaf, terjadi masalah saat memproses pesan Anda.';
    }
  } catch (error) {
    console.error('Error pada handleAIResponse:', error.message);
    return 'Maaf, terjadi kesalahan saat memproses pesan Anda.';
  }
}

// Fungsi untuk menyimpan percakapan ke dalam database
function saveChatToDatabase(chatId, userMessage, aiResponse) {
  const db = readDatabase();

  if (!db[chatId]) {
    db[chatId] = {
      name: '', // Nama pengguna belum tersedia, akan diambil setelah /start
      id: chatId,
      chatsAndResponseBotSaved: []
    };
  }

  // Menambahkan percakapan dan respons ke dalam chat history
  db[chatId].chatsAndResponseBotSaved.push({
    userMessage: userMessage,
    aiResponse: aiResponse,
    timestamp: new Date().toISOString(),
  });

  writeDatabase(db);
}

// Handle perintah /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Update nama pengguna di database setelah /start
  const db = readDatabase();
  if (!db[chatId]) {
    db[chatId] = {
      name: msg.from.first_name,
      id: chatId,
      chatsAndResponseBotSaved: []
    };
    writeDatabase(db);
  }

  const welcomeMessage = `
Selamat datang di RizzCake! 🎂
Kami siap melayani pemesanan kue. Berikut menu kami:
${menu.map((item, index) => `${index + 1}. ${item.name} - Rp.${item.price}`).join('\n')}

Ketik pesan langsung untuk memesan kue atau menanyakan informasi.
Contoh:
- "Saya ingin pesan Cookies Bake Choco ukuran 2x3."
- "Berapa ongkir ke Jakarta dengan JNE?"

Kami siap membantu Anda! 😊`;
  bot.sendMessage(chatId, welcomeMessage);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Hindari loop pada perintah /start
  if (text.startsWith('/start')) return;

  try {
    const response = await handleAIResponse(text, chatId);

    // Pastikan respons tidak kosong
    if (!response || response.trim() === '') {
      bot.sendMessage(chatId, 'Maaf, saya tidak dapat memproses pesan Anda saat ini.');
    } else {
      bot.sendMessage(chatId, response);
    }
  } catch (error) {
    console.error('Error pada pemrosesan pesan pengguna:', error);
    bot.sendMessage(chatId, 'Maaf, terjadi kesalahan saat memproses pesan Anda.');
  }
});
