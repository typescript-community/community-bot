import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('tags')
export class TagEntity {
    @PrimaryColumn()
    name: string;

    @Column()
    content: string;

    @Column()
    author: string;
}
