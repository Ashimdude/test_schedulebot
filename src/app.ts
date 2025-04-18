import { freeStorage } from '@grammyjs/storage-free'
import { Bot, InlineKeyboard, session } from 'grammy'
import { handleAlarm, handleNote } from '#src/components/callbacks'
import type { Alarm, MyContext, SessionData } from '#src/types'

export const bot = new Bot<MyContext>(
	'7528162951:AAG06HA4Svvo7__5N2Qmf-HRLQJsREMFg-Q',
)
export const timeouts = new Map<number, NodeJS.Timeout>()

// Install session middleware
bot.use(
	session({
		initial: (): SessionData => ({
			alarms: [],
		}),
		storage: freeStorage<SessionData>(bot.token),
	}),
)

function calculateDelay(minutesSinceMidnight: number): number {
	const now = new Date()
	const currentMinutes = now.getHours() * 60 + now.getMinutes()
	const currentSeconds = now.getSeconds()
	let targetMinutes = minutesSinceMidnight

	if (
		targetMinutes < currentMinutes ||
		(targetMinutes === currentMinutes && currentSeconds > 0)
	) {
		targetMinutes += 24 * 60
	}

	const delayMinutes = targetMinutes - currentMinutes
	const delayMilliseconds = delayMinutes * 60 * 1000 - currentSeconds * 1000
	return delayMilliseconds
}

function scheduleAlarm(alarm: Alarm) {
	const time = alarm.timeInMinutes
	const delay = calculateDelay(time)
	const timeout = setTimeout(async () => {
		const message = alarm.hasNote
			? `Reminder: Note at ${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')} - ${alarm.content || 'No content'}`
			: `Reminder: Alarm at ${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, '0')}`
		try {
			await bot.api.sendMessage(alarm.userId, message)
			console.log(`Sent reminder for alarm ${alarm.id} to user ${alarm.userId}`)
		} catch (error) {
			console.error(`Failed to send reminder for alarm ${alarm.id}:`, error)
		}
		timeouts.delete(alarm.id)
	}, delay)
	timeouts.set(alarm.id, timeout)
}

bot.command('start', async (ctx) => {
	const userId = ctx.from?.id
	if (!userId) {
		return
	}

	await ctx.reply('schedulebot!', {
		reply_markup: new InlineKeyboard()
			.text('⏰Alarms', 'alarmClicked')
			.text('✍️Notes', 'notesClicked'),
	})
})

bot.callbackQuery('alarmClicked', (ctx) => handleAlarm(ctx))
bot.callbackQuery('notesClicked', (ctx) => handleNote(ctx))

bot.on('message:text', async (ctx) => {
	const userId = ctx.from?.id
	if (!userId) {
		return
	}

	const input = ctx.message.text.trim()
	const parts = input.split(' ')
	if (!parts[0]) {
		return
	}

	const timePart = parts[0]
	if (!timePart) {
		await ctx.reply('Invalid input! Use HH:MM (e.g., 18:30) or HH:MM text.')
		return
	}

	const [hours, minutes] = timePart.split(':')
	if (!hours || !minutes) {
		await ctx.reply('Invalid time format! Use HH:MM (e.g., 18:30).')
		return
	}

	const hourNum = Math.abs(Number.parseInt(hours, 10))
	const minuteNum = Math.abs(Number.parseInt(minutes, 10))

	if (
		Number.isNaN(hourNum) ||
		Number.isNaN(minuteNum) ||
		hourNum > 23 ||
		minuteNum > 59
	) {
		await ctx.reply('Not a valid time!')
		return
	}

	const timeInMinutes = hourNum * 60 + minuteNum
	const alarmId = Date.now() // Simple ID generation using timestamp
	const content = parts.length > 1 ? input.slice(parts[0].length).trim() : null
	const hasNote = parts.length > 1

	const newAlarm = {
		id: alarmId,
		userId,
		timeInMinutes,
		hasNote,
		content,
	}

	ctx.session.alarms.push(newAlarm)

	scheduleAlarm({
		id: alarmId,
		userId,
		timeInMinutes,
		hasNote,
		content,
	})

	await ctx.reply(
		`Set for ${hours}:${minutes}, done? If not, type another one in`,
		{
			reply_markup: new InlineKeyboard().text('Yeah', '5'),
		},
	)
})
bot.on('callback_query:data', async (ctx) => {
	const callbackData = ctx.callbackQuery.data
	const userId = ctx.from?.id
	if (!userId) {
		return
	}

	if (callbackData.startsWith('delete_')) {
		const alarmIdPart = callbackData.split('_')[1]
		if (!alarmIdPart) {
			await ctx.answerCallbackQuery()
			return
		}
		const alarmId = Number.parseInt(alarmIdPart)
		const alarmIndex = ctx.session.alarms.findIndex(
			(alarm) => alarm.id === alarmId,
		)

		if (alarmIndex === -1) {
			await ctx.answerCallbackQuery({ text: 'Alarm not found!' })
		} else {
			ctx.session.alarms.splice(alarmIndex, 1)
			const timeout = timeouts.get(alarmId)
			if (timeout) {
				clearTimeout(timeout)
				timeouts.delete(alarmId)
			}
			await ctx.deleteMessage()
			await ctx.answerCallbackQuery()
		}
	}

	if (callbackData === '4') {
		await ctx.reply(
			'Enter the time (example 18:30) or time and note (6:30 sample text):',
		)
		await ctx.answerCallbackQuery()
	}

	if (callbackData === '5') {
		await ctx.reply('schedulebot!', {
			reply_markup: new InlineKeyboard()
				.text('⏰Alarms', '1')
				.text('✍️Notes', '2'),
		})
		await ctx.answerCallbackQuery()
	}
})

bot.start().then(() => console.log('Bot is running!'))
