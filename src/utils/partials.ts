import { client } from '../index';

export const memberPartial = (id: string) => {
    const member = client.guilds.get('508357248330760243')!.member(id);

    if (!member) {
        return 'Member left server';
    }

    return member.user.tag;
};
