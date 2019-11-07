import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('tags')
export class TagEntity {
    @PrimaryColumn()
    public name!: string;

    @Column()
    public content!: string;

    @Column()
    public author!: string;
}
