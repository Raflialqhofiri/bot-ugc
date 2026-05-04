import { Telegraf } from "telegraf";

const bot = new Telegraf(process.env.BOT_TOKEN);

// TEST COMMAND
bot.start((ctx) => {
  ctx.reply("Bot hidup 🚀");
});

// HANDLER VERCEL
export default async function handler(req, res) {
  try {
    if (req.method === "POST") {
      res.status(200).send("ok");
      await bot.handleUpdate(req.body);
      return;
    }

    return res.status(200).send("RUNNING");
  } catch (err) {
    console.error(err);
    return res.status(500).send("ERROR");
  }
}
