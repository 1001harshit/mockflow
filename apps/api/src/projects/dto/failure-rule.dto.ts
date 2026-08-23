import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { FAILURE_TYPES, FailureType } from '../../failure/failure.types';

/**
 * One failure-simulation rule (Phase 5). The cross-rule constraint — enabled
 * rules may not total more than 100% — is enforced by FailureService.normalize,
 * which class-validator can't express on a single field.
 */
export class FailureRuleDto {
  @IsIn(FAILURE_TYPES as unknown as string[])
  type!: FailureType;

  @IsNumber()
  @Min(0)
  @Max(100)
  percent!: number;

  /** `error` only. Defaults to 500. */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  /** `slow` / `timeout` — how long to stall, in milliseconds. */
  @IsOptional()
  @IsInt()
  @Min(0)
  delayMs?: number;

  /** Keep the rule on the endpoint but stop it firing. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Arbitrary JSON error body (kept as-is). */
  @IsOptional()
  body?: unknown;
}
