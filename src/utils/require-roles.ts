import { ChatInputCommandInteraction } from 'discord.js';

export function requireRoles(
  interaction: ChatInputCommandInteraction,
  requiredRoles: string[]
): boolean {
  if (!interaction.member) {
    return false;
  }

  if (Array.isArray(interaction.member.roles)) {
    return false;
  }

  const userRoleNames = interaction.member.roles.cache.map((role) => role.name);

  return requiredRoles.every((role) => userRoleNames.includes(role));
}
