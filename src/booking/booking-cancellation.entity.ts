import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CancellationParty } from '../common/enums/index';
import { User } from '../users/user.entity';
import { Booking } from './booking.entity';

@Entity('booking_cancellations')
export class BookingCancellation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: number;

  @Column({ name: 'cancellation_party', type: 'enum', enum: CancellationParty })
  cancellationParty!: CancellationParty;

  @Column({
    name: 'cancellation_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  cancellationReason!: string | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz' })
  cancelledAt!: Date;

  @OneToOne(() => Booking, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
