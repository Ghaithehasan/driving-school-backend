import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AccountStatus } from '../common/enums/index';
import { UserRole } from '../roles/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash!: string | null;

  @Column({ name: 'must_change_password', type: 'boolean', default: true })
  mustChangePassword!: boolean;

  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion!: number;

  @Column({ name: 'account_status', type: 'enum', enum: AccountStatus })
  accountStatus!: AccountStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => UserRole, (ur) => ur.user)
  userRoles!: UserRole[];
}
