import { Bot,  InlineKeyboard} from "grammy";
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
const bot = new Bot("7528162951:AAG06HA4Svvo7__5N2Qmf-HRLQJsREMFg-Q");
const timeouts = new Map<number, NodeJS.Timeout>();

function calculateDelay(minutesSinceMidnight: number): number {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes(); // Current minutes since midnight
  const currentSeconds = now.getSeconds(); // Current seconds for precision
  let targetMinutes = minutesSinceMidnight;

  // If the target time is earlier than now, schedule for tomorrow
  if (targetMinutes < currentMinutes || (targetMinutes === currentMinutes && currentSeconds > 0)) {
    targetMinutes += 24 * 60; // Add a day (1440 minutes) for tomorrow
  }

  const delayMinutes = targetMinutes - currentMinutes;
  const delayMilliseconds = delayMinutes * 60 * 1000 - currentSeconds * 1000; // Convert to ms, subtracting seconds
  return delayMilliseconds;
}

// Function to schedule an alarm reminder
async function scheduleAlarm(alarmId: number, userId: number, time: number, hasNote: boolean, content: string | null) {
  const delay = calculateDelay(time);
  const timeout = setTimeout(async () => {
    const message = hasNote
      ? `Reminder: Note at ${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')} - ${content || "No content"}`
      : `Reminder: Alarm at ${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`;
    try {
      await bot.api.sendMessage(userId, message);
      console.log(`Sent reminder for alarm ${alarmId} to user ${userId}`);
    } catch (error) {
      console.error(`Failed to send reminder for alarm ${alarmId}:`, error);
    }
    timeouts.delete(alarmId);
    try {
      const alarmExists = await prisma.alarms.findUnique({ where: { id: alarmId } });
      if (!alarmExists) {
        return;
      }
      await prisma.alarms.delete({
        where: { id: alarmId },
      });
    } catch (error) {
      console.log("Error deleting alarm:");
    }
  }, delay);
  timeouts.set(alarmId, timeout);
}

// Schedule existing alarms/notes when the bot starts
async function initializeAlarms() {
  const alarms = await prisma.alarms.findMany();
  for (const alarm of alarms) {
    await scheduleAlarm(alarm.id, alarm.authorId, alarm.time, alarm.hasNote, alarm.content);
  }
}

bot.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  let user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    user = await prisma.user.create({ data: { id: userId } });
  }

  await ctx.reply("schedulebot!", {
    reply_markup: new InlineKeyboard()
      .text("⏰Alarms", "1")
      .text("✍️Notes", "2"),
  });
});

bot.on("callback_query:data", async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  const userId = ctx.from?.id;
  if (!userId) return;
  if (callbackData === "1" || callbackData === "2") {

    const isNotes = callbackData === "2";
    const alarms = await prisma.alarms.findMany({
      where: {
        authorId: userId,
        hasNote: isNotes,
      },
    });
    console.log(alarms);


    for (const alarm of alarms) {
      let text = "";
      const hours = Math.floor(alarm.time / 60);
      const minutes = alarm.time % 60;
      let newtime = `${hours.toString()}:${minutes.toString()}`;
      if (minutes === 0){
        newtime = `${newtime}0`;
      }
      if (alarm.hasNote) {
        text = `Note: ${alarm.content || "No content"} (Time: ${newtime})`;
      } else {
        text = `Alarm: ${newtime}`;
      }
      await ctx.reply(text, {
        reply_markup: new InlineKeyboard().text("Delete", `delete_${alarm.id}`),
      });
    }

    const newButton = new InlineKeyboard()
      .text("New ✍️⏰", "4")
      .text("No", "5");
    await ctx.reply("Create a new one?", { reply_markup: newButton });
    ctx.answerCallbackQuery;
  }

  if (callbackData.startsWith("delete_")) {
    const alarmIdPart = callbackData.split("_")[1];
    if (!alarmIdPart) {
      ctx.answerCallbackQuery();
      return;
    }
    const alarmId = Number.parseInt(alarmIdPart);

    try {
      const alarmExists = await prisma.alarms.findUnique({ where: { id: alarmId } });
      if (!alarmExists) {
        await ctx.answerCallbackQuery({ text: "Alarm not found!" });
      }
      else{
        await prisma.alarms.delete({
          where: { id: alarmId },
        });
      }
      await ctx.deleteMessage();
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error("Error deleting alarm:");
      await ctx.answerCallbackQuery({ text: "Failed to delete alarm. Please try again." });
    }

  }
  if (callbackData === "4") {
    ctx.reply("Enter the time (example 18:30) or time and note (6:30 sample text):");
    ctx.answerCallbackQuery;
  }
  if (callbackData === "5"){
    await ctx.reply("schedulebot!", {
      reply_markup: new InlineKeyboard()
        .text("⏰Alarms", "1")
        .text("✍️Notes", "2"),
    });
    ctx.answerCallbackQuery;
  }
});
bot.on("message:text", async (ctx) => {
  const userId = ctx.from?.id;
  const input = ctx.message.text.trim();
  const parts = input.split(" ");
  console.log(parts);
  if (parts[0] === undefined){
    return;
  }

  const timePart = parts[0];
  if (!timePart) {
    await ctx.reply("Invalid input! Use HH:MM (e.g., 18:30) or HH:MM text.");
    return;
  }

  const [hours, minutes] = timePart.split(":");
  if (!hours || !minutes) {
    await ctx.reply("Invalid time format! Use HH:MM (e.g., 18:30).");
    return;
  }

  const hourNum = Math.abs(Number.parseInt(hours, 10));
  const minuteNum = Math.abs(Number.parseInt(minutes, 10));

  if (typeof hourNum !== 'number' || typeof minuteNum !== 'number' || hourNum > 23 || minuteNum > 59){
    ctx.reply('not a valid time!');
    return;
  }


  const timeInMinutes = hourNum * 60 + minuteNum;

  const newalarm = await prisma.alarms.create({
    data: {
      authorId: userId,
      time: timeInMinutes,
      content: input.slice(parts[0].length),
      hasNote: (parts.length > 1)
    }
  });
  await scheduleAlarm(newalarm.id, userId, timeInMinutes, newalarm.hasNote, newalarm.content);
  await ctx.reply(`Set for ${hours}:${minutes}, done? If not, type another one in`, {
    reply_markup: new InlineKeyboard().text("Yeah", "5"),
  });

}); 
initializeAlarms();
bot.start().then(() => console.log("Bot is running!"));