import { fork } from 'child_process';
import {
	TwoSlashReturn,
	twoslasher as _twoslasher,
} from '@typescript/twoslash';

const childProcess = fork(require.resolve('./twoslasherWorker'));

const resolveMap = new Map<
	number,
	[(value: TwoSlashReturn) => void, (value: any) => void]
>();

childProcess.on('message', message => {
	if (!(message instanceof Array)) return;
	const [id, error, value] = message as [number, any, TwoSlashReturn | null];
	const [resolve, reject] = resolveMap.get(id) ?? [undefined, undefined];
	if (!resolve || !reject) throw new Error(`Missing id ${id}`);
	if (error || !value) reject(error);
	else resolve(value);
	resolveMap.delete(id);
});

let idN = 0;

export const twoslasher = (...args: Parameters<typeof _twoslasher>) =>
	new Promise<TwoSlashReturn>((resolve, reject) => {
		const id = idN++;
		resolveMap.set(id, [resolve, reject]);
		childProcess.send([id, ...args]);
	});
