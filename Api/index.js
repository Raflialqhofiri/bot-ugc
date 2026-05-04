import { Telegraf, Markup } from 'telegraf';
import { kv } from '@vercel/kv';

const bot = new Telegraf(process.env.BOT_TOKEN);

// === KONFIGURASI REALPAYGAMES ===
const CONFIG = {
  RATE_TOPUP: 10,
  RATE_WD: 12,
  ADMIN_ID: 7797450189, // ID Telegram kamu sudah terpasang
  BOSS_HP_DEFAULT: 5000
};

const JOBS = {
  warrior: { name: 'Warrior', hp: 250, atk: 25, def: 20, icon: '⚔️' },
  archer: { name: 'Archer', hp: 150, atk: 45, def: 8, icon: '🏹' },
  cleric: { name: 'Cleric', hp: 200, atk: 18, def: 15, icon: '✨' },
  sorceress: { name: 'Sorceress', hp: 120, atk: 55, def: 5, icon: '🔮' }
};

const SHOP = [
  { id: 1, name: 'Dragon Sword', price: 1000, atk: 50, type: 'weapon' },
  { id: 2, name: 'Plate of Honor', price: 1500, def: 40, type: 'armor' },
  { id: 3, name: 'Mega Potion', price: 100, heal: 200, type: 'use' }
];

// === DATABASE LOGIC ===
async function getPlayer(userId) {
  let p = await kv.get(`player:${userId}`);
  if (!p) {
    p = {
      username: '', job: null, level: 1, exp: 0,
      hp: 100, maxHp: 100, gold: 500, saldo: 0,
      inventory: [], equip: { weapon: null, armor: null },
      baseAtk: 10, baseDef: 5
    };
    await kv.set(`player:${userId}`, p);
  }
  const bonusAtk = p.equip.weapon ? p.equip.weapon.atk : 0;
  const bonusDef = p.equip.armor ? p.equip.armor.def : 0;
  return { ...p, totalAtk: p.baseAtk + bonusAtk, totalDef: p.baseDef + bonusDef };
}

// === INTERFACE ===
function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🎮 Masuk Dungeon', `https://${process.env.VERCEL_URL}`)],
    [Markup.button.callback('🎒 Inventory', 'inv'), Markup.button.callback('🛒 Toko', 'shop')],
    [Markup.button.callback('💳 Top Up', 'topup'), Markup.button.callback('💸 Withdraw', 'wd')],
    [Markup.button.callback('🐲 Boss Raid', 'boss')]
  ]);
}

// === COMMANDS ===
bot.start(async (ctx) => {
  const p = await getPlayer(ctx.from.id);
  p.username = ctx.from.username || ctx.from.first_name;
  await kv.set(`player:${ctx.from.id}`, p);

  if (!p.job) {
    return ctx.reply(`🐉 *SELAMAT DATANG DI RPG: REALPAYGAMES* 🐉\n\nPilih Job kamu:`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(Object.keys(JOBS).map(k => [Markup.button.callback(`${JOBS[k].icon} ${JOBS[k].name}`, `setjob_${k}`)]))
    });
  }
  const msg = `🐉 *REAL PAY GAMES* 🐉\n\n👤 *${p.username}* | ${JOBS[p.job].name}\n🏅 Lv.${p.level} | ❤️ HP: ${p.hp}/${p.maxHp}\n⚔️ ATK: ${p.totalAtk} | 🛡️ DEF: ${p.totalDef}\n🪙 Gold: ${p.gold.toLocaleString()}`;
  ctx.reply(msg, { parse_mode: 'Markdown', ...mainMenuKeyboard() });
});

bot.action(/setjob_(.+)/, async (ctx) => {
  const jobId = ctx.match[1];
  const p = await getPlayer(ctx.from.id);
  if (p.job) return ctx.answerCbQuery("Sudah punya Job!");
  const data = JOBS[jobId];
  p.job = jobId; p.maxHp = data.hp; p.hp = data.hp; p.baseAtk = data.atk; p.baseDef = data.def;
  await kv.set(`player:${ctx.from.id}`, p);
  ctx.deleteMessage();
  ctx.reply(`✅ Job dipilih: ${data.name}`, mainMenuKeyboard());
});

bot.command('buy', async (ctx) => {
  const id = parseInt(ctx.message.text.split(' ')[1]);
  const item = SHOP.find(i => i.id === id);
  let p = await getPlayer(ctx.from.id);
  if (!item || p.gold < item.price) return ctx.reply("❌ Gagal beli.");
  p.gold -= item.price;
  if (item.type === 'use') p.hp = Math.min(p.maxHp, p.hp + item.heal);
  else p.inventory.push(item);
  await kv.set(`player:${ctx.from.id}`, p);
  ctx.reply(`✅ Berhasil beli ${item.name}`);
});

bot.on('web_app_data', async (ctx) => {
  const data = JSON.parse(ctx.webAppData.data);
  let p = await getPlayer(ctx.from.id);
  if (data.type === 'hunt') {
    const gold = 50 + (p.level * 10);
    p.gold += gold; p.exp += 30; p.hp -= Math.max(5, 40 - p.totalDef);
    if (p.exp >= p.level * 100) { p.level++; p.exp = 0; p.maxHp += 50; p.hp = p.maxHp; }
    if (p.hp <= 0) { p.hp = Math.floor(p.maxHp * 0.5); p.gold = Math.floor(p.gold * 0.9); }
    await kv.set(`player:${ctx.from.id}`, p);
    ctx.reply(`⚔️ Hunting Selesai! Gold: +${gold}`);
  }
});

const WEB_APP_HTML = `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0"><script src="https://telegram.org/js/telegram-web-app.js"></script><style>body { background: #1a1a1a; color: white; font-family: sans-serif; text-align: center; padding: 20px; }.btn { background: #f39c12; border: none; padding: 15px; color: white; border-radius: 10px; width: 100%; margin-top: 10px; }</style></head><body><h2>🎮 REAL PAY GAMES 🎮</h2><button class="btn" onclick="send('hunt')">🐺 HUNT MANTICORE</button><script>const tg = window.Telegram.WebApp; tg.ready(); function send(t){ tg.sendData(JSON.stringify({type:t})); tg.close(); }</script></body></html>`;

// === VERCEL ADAPTER ===
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      await bot.handleUpdate(req.body);
      return res.status(200).json({ ok: true });
    } else if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(WEB_APP_HTML);
    }
    return res.status(200).send('Bot RPG is Running...');
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
    }
