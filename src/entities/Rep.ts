import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('reps')
export class RepEntity {
    @PrimaryColumn()
    public id!: string; // the user id

    @Column({ default: 0 })
    public rep!: number;
}
