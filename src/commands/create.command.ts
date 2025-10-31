import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { requireRoles } from '../utils/require-roles';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { classroomsTable } from '../db/schema/classrooms.table';
import { CommandData } from './command-data';

export const createCommand: CommandData = {
  data: new SlashCommandBuilder()
    .setName('create')
    .setDescription('Create a new classroom'),
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.channel?.type !== ChannelType.GuildText) {
      return;
    }

    if (!requireRoles(interaction, ['Teacher'])) {
      await interaction.reply({
        content: 'You need the Teacher role to create a classroom.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.inGuild() || !interaction.guild) {
      await interaction.reply({
        content: 'This command can only be used in a guild.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channelId = interaction.channel.id;

    const existingClassroom = await db.query.classrooms.findFirst({
      where: () => eq(classroomsTable.channelId, channelId),
    });

    if (existingClassroom) {
      await interaction.reply({
        content: `You already have a classroom in this channel with ID: ${existingClassroom.id}`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const classroomRoleName = `Classroom-${interaction.channel.name}`;
    const classroomRole = await interaction.guild.roles.create({
      name: classroomRoleName,
      reason: `Role for classroom ${interaction.channel.name}`,
    });

    const [newClassroom] = await db
      .insert(classroomsTable)
      .values({
        ownerId: interaction.user.id,
        name: interaction.channel.name,
        channelId: interaction.channel.id,
        roleId: classroomRole.id,
      })
      .returning();

    await interaction.reply({
      content: `Created new classroom: ${newClassroom.name}`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
