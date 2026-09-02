import { IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { PROVIDERS, Provider } from '../signing.service';

export class CreateWebhookDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(PROVIDERS as unknown as string[])
  provider!: Provider;

  /**
   * Where deliveries are POSTed. `require_tld` is off so localhost targets
   * work, which means the protocol has to be required explicitly — without it
   * a bare word like "not-a-url" validates as a TLD-less host.
   */
  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  targetUrl!: string;

  /** Omit to have one generated in the provider's own format. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  secret?: string;
}
