import { ConflictException, Injectable } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../common/hashing';
import { RegisterDto } from './dto/register.dto';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers a new user and bootstraps their first workspace, making them its
   * OWNER. Runs in a transaction so a half-created account can't exist.
   */
  async register(dto: RegisterDto): Promise<{ user: SafeUser; workspaceId: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hashPassword(dto.password);
    const fallbackName = dto.name?.trim() || dto.email.split('@')[0];
    const workspaceName = dto.workspaceName?.trim() || `${fallbackName}'s workspace`;
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
