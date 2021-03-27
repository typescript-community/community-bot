import { twoslasher } from '@typescript/twoslash';

process.on('message', message => {
	const [id, ...args] = message as [number, ...Parameters<typeof twoslasher>];
	try {
		const result = twoslasher(...args);
		process.send!([id, null, result]);
	} catch (e) {
		process.send!([id, e, null]);
	}
});
