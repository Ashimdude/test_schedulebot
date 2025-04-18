import type { CallbackQueryContext } from 'grammy'
import { InlineKeyboard } from 'grammy'
//import {timeouts } from '#src/app'
import type { MyContext } from '#src/types'

export async function handleAlarm(ctx: CallbackQueryContext<MyContext>) {
	const isNotes = false
	const userId = ctx.from?.id
	if (!userId) {
		return
	}
	const alarms = ctx.session.alarms.filter((alarm) => alarm.hasNote === isNotes)
	for (const alarm of alarms) {
		let text = ''
		const hours = Math.floor(alarm.timeInMinutes / 60)
		const minutes = alarm.timeInMinutes % 60
		let newtime = `${hours.toString()}:${minutes.toString()}`
		if (minutes === 0) {
			newtime = `${newtime}0`
		}
		if (alarm.hasNote) {
			text = `Note: ${alarm.content || 'No content'} (Time: ${newtime})`
		} else {
			text = `Alarm: ${newtime}`
		}
		await ctx.reply(text, {
			reply_markup: new InlineKeyboard().text('Delete', `delete_${alarm.id}`),
		})
	}

	const newButton = new InlineKeyboard().text('New ✍️⏰', '4').text('No', '5')
	await ctx.reply('Create a new one?', { reply_markup: newButton })
}
export async function handleNote(ctx: CallbackQueryContext<MyContext>) {
	const isNotes = true
	const userId = ctx.from?.id
	if (!userId) {
		return
	}
	const alarms = ctx.session.alarms.filter((alarm) => alarm.hasNote === isNotes)
	for (const alarm of alarms) {
		let text = ''
		const hours = Math.floor(alarm.timeInMinutes / 60)
		const minutes = alarm.timeInMinutes % 60
		let newtime = `${hours.toString()}:${minutes.toString()}`
		if (minutes === 0) {
			newtime = `${newtime}0`
		}
		if (alarm.hasNote) {
			text = `Note: ${alarm.content || 'No content'} (Time: ${newtime})`
		} else {
			text = `Alarm: ${newtime}`
		}
		await ctx.reply(text, {
			reply_markup: new InlineKeyboard().text('Delete', `delete_${alarm.id}`),
		})
	}

	const newButton = new InlineKeyboard().text('New ✍️⏰', '4').text('No', '5')
	await ctx.reply('Create a new one?', { reply_markup: newButton })
}
