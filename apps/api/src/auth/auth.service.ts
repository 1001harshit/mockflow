import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from '../common/hashing';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export type SafeUser = Omit<User, 'passwordHash'>;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: SafeUser;
}

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Registers a new user and bootstraps their first workspace, making them its
   * OWNER. Runs in a transaction so a half-created account can't exist.
   */
  async register(
    dto: RegisterDto,
  ): Promise<{ user: SafeUser; workspaceId: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    const fallbackName = dto.name?.trim() || dto.email.split('@')[0];
    const workspaceName =
      dto.workspaceName?.trim() || `${fallbackName}'s workspace`;
    const slug = await this.uniqueSlug(workspaceName);

    const { user, workspaceId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: dto.email, passwordHash, name: dto.name },
      });
      const workspace = await tx.workspace.create({
        data: { name: workspaceName, slug },
      });
      await tx.membership.create({
        data: { userId: user.id, workspaceId: workspace.id, role: Role.OWNER },
      });
      return { user, workspaceId: workspace.id };
    });

    return { user: this.sanitize(user), workspaceId };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { ...(await this.issueTokens(user)), user: this.sanitize(user) };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return { ...(await this.issueTokens(user)), user: this.sanitize(user) };
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessOptions: JwtSignOptions = {
      secret: this.accessSecret,
      expiresIn: this.accessTtl as JwtSignOptions['expiresIn'],
    };
    const refreshOptions: JwtSignOptions = {
      secret: this.refreshSecret,
      expiresIn: this.refreshTtl as JwtSignOptions['expiresIn'],
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, accessOptions),
      this.jwt.signAsync(payload, refreshOptions),
    ]);
    return { accessToken, refreshToken };
  }

  private get accessSecret(): string {
    return this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-access-secret';
  }
  private get refreshSecret(): string {
    return this.config.get<string>('JWT_REFRESH_SECRET') ?? 'dev-refresh-secret';
  }
  private get accessTtl(): string {
    return this.config.get<string>('JWT_ACCESS_TTL') ?? '15m';
  }
  private get refreshTtl(): string {
    return this.config.get<string>('JWT_REFRESH_TTL') ?? '7d';
  }

  sanitize(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  private slugify(input: string): string {
    return (
      input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'workspace'
    );
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = this.slugify(name);
    let slug = base;
    for (let i = 0; i < 5; i++) {
      const clash = await this.prisma.workspace.findUnique({ where: { slug } });
      if (!clash) return slug;
      slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
