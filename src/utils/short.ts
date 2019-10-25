import fetch from 'node-fetch';

export const shortenLink = async (url: string) => {
    const res = await fetch(`https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${process.env.LINKS_KEY}`, {
        method: 'POST',
        body: JSON.stringify({
            dynamicLinkInfo: {
                domainUriPrefix: 'https://links.typescript.social',
                link: url,
            },
            suffix: {
                option: 'SHORT',
            },
        }),
    });

    const json = await res.json();

    return json.shortLink;
};
