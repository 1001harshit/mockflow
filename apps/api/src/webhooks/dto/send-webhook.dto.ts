import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SendWebhookDto {
  /** Event name, e.g. "payment.captured" or "push". */
  @IsString()
  @MaxLength(120)
  event!: string;

  /** Payload to deliver. Omit to use the provider's sample for this event. */
  @IsOptional()
  payload?: unknown;

  /** How many times to try before giving up. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  maxAttempts?: number;
}
