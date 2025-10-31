import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { CommandData } from './command-data';

export const setupCommand: CommandData = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup roles for the server'),
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (
      interaction.guild &&
      interaction.guild.ownerId !== interaction.user.id
    ) {
      await interaction.reply({
        content: 'Only the server owner can run the setup command.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!interaction.guild) {
      await interaction.reply({
        content: 'This command can only be run in a server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const teacherRole = interaction.guild.roles.cache.find(
      (role) => role.name === 'Teacher'
    );

    if (!teacherRole) {
      await interaction.guild?.roles.create({
        name: 'Teacher',
        colors: {
          primaryColor: 'Blue',
        },
        reason: 'Role for teachers in the classroom bot',
        mentionable: true,
      });
    }

    const studentRole = interaction.guild.roles.cache.find(
      (role) => role.name === 'Student'
    );

    if (!studentRole) {
      await interaction.guild?.roles.create({
        name: 'Student',
        colors: {
          primaryColor: 'Green',
        },
        reason: 'Role for students in the classroom bot',
        mentionable: true,
      });
    }

    await interaction.reply({
      content:
        'Setup complete! Created Teacher and Student roles. You can now use the bot commands.',
      flags: MessageFlags.Ephemeral,
    });
  },
};
