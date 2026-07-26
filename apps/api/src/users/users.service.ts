import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Current user with their workspace memberships and roles. */
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            workspace: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash: _passwordHash, memberships, ...safe } = user;
    return {
      ...safe,
      memberships: memberships.map((m) => ({
        role: m.role,
        workspace: m.workspace,
      })),
    };
  }
}
