import type { Context } from 'grammy'

export type Alarm = {
	id: number
	userId: number
	timeInMinutes: number
	hasNote: boolean
	content: string | null
}

export type SessionData = {
	alarms: Alarm[]
}

export type MyContext = Context & { session: SessionData }
