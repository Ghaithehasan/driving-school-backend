import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ShamcashVerificationResult {
  verified: boolean;
  transactionId: number;
  amount: number;
  currencyCode: string | null;
  senderName: string | null;
  receiverName: string | null;
  occurredAt: Date | null;
  rawPayload: Record<string, unknown>;
}

type ShamcashTransactionPayload = {
  transaction_id?: number | string;
  amount?: number | string;
  currency?: { code?: string };
  sender_name?: string | null;
  receiver_name?: string | null;
  occurred_at?: string | null;
};

@Injectable()
export class ShamcashService {
  constructor(private readonly configService: ConfigService) {}

  async verifyTransaction(
    transactionId: number,
  ): Promise<ShamcashVerificationResult> {
    const baseUrl = (
      this.configService.get<string>('SHAMCASH_API_BASE_URL') ??
      'https://api.shamcash-api.com/v1'
    ).replace(/\/$/, '');
    const token = this.configService.get<string>('SHAMCASH_API_TOKEN')?.trim();

    if (!token) {
      throw new BadGatewayException('ShamCash token is not configured');
    }

    const response = await fetch(`${baseUrl}/transactions`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const payload = await response.json();
    if (!response.ok || payload?.status !== 'success') {
      throw new BadGatewayException(
        `ShamCash error: ${payload?.code ?? response.status}`,
      );
    }

    const txns = this.extractTransactions(payload);
    const match = txns.find(
      (t) => Number(t.transaction_id) === Number(transactionId),
    );

    if (!match) {
      return {
        verified: false,
        transactionId,
        amount: 0,
        currencyCode: null,
        senderName: null,
        receiverName: null,
        occurredAt: null,
        rawPayload: payload,
      };
    }

    return {
      verified: true,
      transactionId: Number(match.transaction_id),
      amount: Number(match.amount),
      currencyCode: match.currency?.code ?? null,
      senderName: match.sender_name ?? null,
      receiverName: match.receiver_name ?? null,
      occurredAt: match.occurred_at ? new Date(match.occurred_at) : null,
      rawPayload: match,
    };
  }

  private extractTransactions(payload: any): ShamcashTransactionPayload[] {
    if (Array.isArray(payload?.data?.transactions)) {
      return payload.data.transactions;
    }

    if (Array.isArray(payload?.data?.data?.transactions)) {
      return payload.data.data.transactions;
    }

    return [];
  }
}
