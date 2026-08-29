import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class GenerateDataDto {
  /** How many items to generate when the response is a list. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  count?: number;

  /** Free-text steer, e.g. "electronics inventory for a resale marketplace". */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  hint?: string;

  /** Change the seed to get different local data for the same schema. */
  @IsOptional()
  @IsInt()
  seed?: number;

  /** Generate locally even when a model is configured. */
  @IsOptional()
  @IsBoolean()
  local?: boolean;

  /** Write the result to the endpoint's default response instead of only returning it. */
  @IsOptional()
  @IsBoolean()
  save?: boolean;
}
