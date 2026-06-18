import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { SettingValueType } from '../common/enums/index';

@Entity('settings')
export class Setting {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  value: string;

  @Column({ name: 'value_type', type: 'enum', enum: SettingValueType })
  valueType: SettingValueType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
