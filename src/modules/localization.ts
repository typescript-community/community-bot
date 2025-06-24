import * as fs from 'fs';
import * as yaml from 'js-yaml';

export type Rename = Record<string, any>;

export class Localization {
	private cache: any = null;

	public constructor(public path: string) {
		this.cache = this.getLocalization();
	}

	private getLocalization(): any {
		const fileContents = fs.readFileSync(this.path, 'utf8');
		return yaml.load(fileContents);
	}

	private getMessage(
		localization: any,
		field: string,
		rename: Record<string, any> = {},
	): string {
		const keys: string[] = field.split('.');
		let message: any = localization;
		for (const key of keys) {
			if (message && typeof message === 'object' && key in message) {
				message = message[key];
			} else {
				return `No translation (${field})`;
			}
		}

		if (!message) return `No translation (${field})`;

		let localizedMessage: string = message;

		localizedMessage = localizedMessage.replace(/<</g, '«');
		localizedMessage = localizedMessage.replace(/>>/g, '»');
		localizedMessage = localizedMessage.replace(/--/g, '—');

		for (const [key, value] of Object.entries(rename)) {
			localizedMessage = localizedMessage.replace(
				new RegExp(`\\$\\(${key}\\)`, 'g'),
				value,
			);
		}

		return localizedMessage;
	}

	public getLocalizedText(field: string, rename: Rename = {}): string {
		return this.getMessage(this.cache, field, rename);
	}

	public getForceLocalizedText(field: string, rename: Rename = {}): string {
		return this.getMessage(this.getLocalization(), field, rename);
	}

	public getSafeMessage(field: string, rename: Rename = {}): string | null {
		const text = this.getMessage(this.cache, field, rename);
		if (text == `No translation (${field})`) return null;
		return text;
	}

	public getForceSafeMessage(
		field: string,
		rename: Rename = {},
	): string | null {
		const text = this.getForceLocalizedText(field, rename);
		if (text == `No translation (${field})`) return null;
		return text;
	}
}
