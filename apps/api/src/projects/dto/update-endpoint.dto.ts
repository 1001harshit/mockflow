import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
}
