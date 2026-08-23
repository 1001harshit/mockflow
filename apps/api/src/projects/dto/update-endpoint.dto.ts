import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { FailureRuleDto } from './failure-rule.dto';

export class UpdateEndpointDto {
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  /** Arbitrary JSON response body (kept as-is). */
  @IsOptional()
  body?: unknown;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  stateful?: boolean;

  /** Failure-simulation rules (Phase 5). Send `[]` to clear them. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FailureRuleDto)
  failureRules?: FailureRuleDto[];
}
