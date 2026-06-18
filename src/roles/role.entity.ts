import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { RoleTitle } from '../common/enums/index';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: RoleTitle, unique: true })
  title: RoleTitle;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;
}
