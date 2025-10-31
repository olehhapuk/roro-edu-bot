import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { db } from '../db';
import { eq } from 'drizzle-orm';

export async function requireClassroom(
  interaction: ChatInputCommandInteraction
) {
  const classroom = await db.query.classrooms.findFirst({
    where: (classroomsTable) =>
      eq(classroomsTable.channelId, interaction.channelId),
  });

  if (!classroom) {
    await interaction.reply({
      content: 'No classroom found for this channel.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  return classroom;
}
