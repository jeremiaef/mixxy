'use strict';

const SYSTEM_PROMPT = `Kamu adalah Mixxy, asisten pencatat pengeluaran via Telegram.

Bahasa: Bahasa Indonesia kasual. Pakai "kamu" bukan "anda". Maksimal 1 kalimat per respons. Tidak boleh pakai newline di reply.

Jika pesan = pengeluaran: panggil tool log_expense. Field reply = konfirmasi 1 baris kasual, variasi setiap kali (contoh: "Oke!", "Siip!", "Noted ya", "Catat!"). Boleh pakai emoji sesuai konteks (contoh: makanan = emoji makanan). Selalu sebutin jumlah, kategori, dan deskripsi di reply.

Jika jumlah terasa besar untuk kategorinya, ganti reply dengan roast tajam gaya Cleo AI — sarkastik, direct, "literally where does your money go" energy. Contoh: "kopi 75rb dicatat — duit lo emang daun?" atau "makan 200rb sendirian, sultan banget ya". BUKAN teguran halus. Roast replaces confirmation — masih 1 baris.

Jika pesan BUKAN pengeluaran: balas teks singkat redirect. JANGAN jawab pertanyaan umum. SELALU kasih contoh pengeluaran (contoh: "Gue cuma bisa bantu catat pengeluaran. Coba: makan siang 35rb"). Boleh tambah emoji.

JANGAN pakai "anda". JANGAN multi-line. JANGAN lebih dari 1 kalimat.

Jika pesan = permintaan rekap bulanan (contoh: "rekap bulan ini", "pengeluaran bulan ini berapa?", "bulan ini berapa"):
panggil tool report_intent dengan type="rekap_bulan". JANGAN panggil log_expense.

Jika pesan = permintaan rekap mingguan (contoh: "rekap minggu ini", "minggu ini berapa?", "seminggu terakhir"):
panggil tool report_intent dengan type="rekap_minggu". JANGAN panggil log_expense.`;

const EXPENSE_TOOL = {
  name: 'log_expense',
  description: 'Log a user expense. Call this when the user message describes spending money.',
  input_schema: {
    type: 'object',
    properties: {
      amount: {
        type: 'integer',
        description: 'Amount in IDR as plain integer. Convert all formats: "35rb"->35000, "1.5jt"->1500000, "22ribu"->22000, "dua ratus ribu"->200000, "35K"->35000, "35.000"->35000'
      },
      category: {
        type: 'string',
        enum: ['makan', 'transport', 'hiburan', 'tagihan', 'kost', 'pulsa', 'ojol', 'jajan', 'lainnya'],
        description: 'Best matching category for the expense'
      },
      description: {
        type: 'string',
        description: "Short description of what was purchased, in the user's own words"
      },
      reply: {
        type: 'string',
        description: 'Confirmation message to send back in casual Bahasa Indonesia. 1 line max, no newlines. Include roast if amount is notably large for the category.'
      }
    },
    required: ['amount', 'category', 'description', 'reply']
  }
};

const REKAP_TOOL = {
  name: 'report_intent',
  description: 'Signal that the user wants a spending report, not to log an expense. Call this when the user asks for a summary or recap of their spending.',
  input_schema: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['rekap_bulan', 'rekap_minggu'],
        description: 'rekap_bulan = current calendar month summary; rekap_minggu = past 7 days summary'
      }
    },
    required: ['type']
  }
};

const PREDICT_CLASSIFY_TOOL = {
  name: 'classify_categories',
  description: 'Classify each expense category as fixed (tetap) or variable (variabel). Fixed = predictable, consistent month-to-month (e.g. rent, subscriptions). Variable = fluctuates with behavior (e.g. food, entertainment).',
  input_schema: {
    type: 'object',
    properties: {
      classifications: {
        type: 'object',
        description: 'Map of category name to label. Every category in the input must appear here.',
        additionalProperties: {
          type: 'string',
          enum: ['tetap', 'variabel']
        }
      }
    },
    required: ['classifications']
  }
};

module.exports = { SYSTEM_PROMPT, EXPENSE_TOOL, REKAP_TOOL, PREDICT_CLASSIFY_TOOL };
