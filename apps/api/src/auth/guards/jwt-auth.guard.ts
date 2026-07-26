import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protects a route: requires a valid Bearer access token. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
