import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '../common/enums/index';
import { User } from '../users/user.entity';
import { Notification } from './notification.entity';

export interface CreateNotificationPayload {
  recipientUser: User;
  title: string;
  body: string;
  notificationType: NotificationType;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * يحفظ الإشعار في DB كـ PENDING ثم يعالجه في الخلفية (fire & forget).
   * عند تكوين Firebase سيُرسَل push حقيقي.
   */
  async sendAsync(payload: CreateNotificationPayload): Promise<void> {
    // حفظ فوري في DB
    const notification = await this.notificationRepo.save(
      this.notificationRepo.create({
        recipientUser: payload.recipientUser,
        title: payload.title,
        body: payload.body,
        notificationType: payload.notificationType,
        channel: NotificationChannel.IN_APP,
        status: NotificationStatus.PENDING,
        sentAt: null,
        readAt: null,
      }),
    );

    // معالجة في الخلفية بدون تأخير الـ request الحالي
    setImmediate(() => {
      this.dispatch(notification).catch((err) =>
        this.logger.error(`فشل إرسال الإشعار ${notification.id}`, err),
      );
    });
  }

  /**
   * إرسال متعدد لقائمة مستخدمين (للإلغاء الجماعي مثلاً).
   */
  async sendBulkAsync(
    recipients: User[],
    title: string,
    body: string,
    notificationType: NotificationType,
  ): Promise<void> {
    await Promise.all(
      recipients.map((user) =>
        this.sendAsync({ recipientUser: user, title, body, notificationType }),
      ),
    );
  }

  private async dispatch(notification: Notification): Promise<void> {
    try {
      // ──────────────────────────────────────────────────
      // TODO: عند إضافة Firebase:
      //   const token = await this.getDeviceToken(notification.recipientUser.id);
      //   if (token) await this.firebase.messaging().send({ token, notification: { title, body } });
      // ──────────────────────────────────────────────────

      // في الوقت الحالي: الإشعار in-app فقط → يُعدّ مُرسَلاً فور حفظه
      await this.notificationRepo.update(notification.id, {
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      });
    } catch (err) {
      await this.notificationRepo.update(notification.id, {
        status: NotificationStatus.FAILED,
      });
      throw err;
    }
  }
}
