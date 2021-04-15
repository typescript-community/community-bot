import fetch from 'npm-registry-fetch';
import { promises as fs } from 'fs';
import tar from 'tar';
import path from 'path';
import os from 'os';
import { once } from 'events';

export type TypeScript = typeof import('typescript');

const moduleMemo = new Map<string, Promise<TypeScript>>();

// Refresh package data after 1 hour
const tsPackageDataTimeout = 1000 * 60 * 60;

let tsPackageData:
	| {
			'dist-tags': Record<string, string>;
			versions: Record<
				string,
				{
					dist: {
						tarball: string;
					};
				}
			>;
	  }
	| undefined;

export async function getTypeScriptModule(
	version: string | null,
): Promise<TypeScript | null> {
	version = await resolveVersion(version);

	if (!version) return null;

	const memoModule = moduleMemo.get(version);
	if (memoModule) return memoModule;

	const tsPromise = (async () => {
		const directory = await fs.mkdtemp(
			path.join(os.tmpdir(), `tsbot-typescript-${version}-`),
		);
		const tarballUrl = tsPackageData!.versions[version].dist.tarball;
		const tarballResponse = await fetch(tarballUrl);

		await once(
			tarballResponse.body.pipe(tar.extract({ cwd: directory })),
			'finish',
		);

		const ts: TypeScript = require(path.join(directory, 'package'));

		return ts;
	})();

	moduleMemo.set(version, tsPromise);

	return await tsPromise;
}

async function resolveVersion(version: string | null): Promise<string | null> {
	version ??= 'latest';
	version = version.toLowerCase();
	if (version === 'nightly') version = 'next';
	tsPackageData ??= await getPackageData();
	if (version in tsPackageData['dist-tags'])
		version = tsPackageData['dist-tags'][version];
	if (version in tsPackageData.versions) return version;
	return null;
}

async function getPackageData() {
	tsPackageData = (await fetch.json('/typescript')) as any;
	setTimeout(() => (tsPackageData = undefined), tsPackageDataTimeout);
	return tsPackageData!;
}
