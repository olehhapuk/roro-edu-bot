import {
  BaseGuildTextChannel,
  ChatInputCommandInteraction,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../db';
import { lessonReportsTable } from '../db/schema/lesson-reports.table';
import { asc, eq } from 'drizzle-orm';
import { CommandData } from './command-data';
import { requireRoles } from '../utils/require-roles';

async function handleReportGenerate(interaction: ChatInputCommandInteraction) {
  const isTeacher = requireRoles(interaction, ['Teacher']);
  if (!isTeacher) {
    await interaction.reply({
      content: 'Only teacher can generate lesson reports.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const title = interaction.options.getString('title', true);
  const videoUrl = interaction.options.getString('video_url', true);
  const codeUrl = interaction.options.getString('code_url', true);

  const classroom = await db.query.classrooms.findFirst({
    where: (classroomsTable) =>
      eq(classroomsTable.channelId, interaction.channelId),
  });

  if (!classroom) {
    await interaction.reply({
      content: 'No classroom found for this channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const [newReport] = await db
    .insert(lessonReportsTable)
    .values({
      title,
      videoUrl,
      codeUrl,
      classroomId: classroom.id,
    })
    .returning();

  await interaction.reply({
    content: `Lesson report generated:\nTitle: ${title}\nVideo URL: ${videoUrl}\nCode URL: ${codeUrl}`,
    flags: MessageFlags.Ephemeral,
  });
  try {
    const targetChannel = await interaction.client.channels.fetch(
      classroom.channelId
    );
    if (
      targetChannel &&
      targetChannel.isTextBased() &&
      targetChannel instanceof BaseGuildTextChannel
    ) {
      // Narrow to TextBasedChannel to satisfy TypeScript that send exists
      await targetChannel.send({
        content: `New lesson report (#${newReport.id}) created for this classroom:\n**${title}**\nVideo: ${videoUrl}\nCode: ${codeUrl}`,
      });
    }
  } catch (err) {
    console.error('Failed to send lesson report notification:', err);
  }
}

async function handleReportList(interaction: ChatInputCommandInteraction) {
  const classroom = await db.query.classrooms.findFirst({
    where: (classroomsTable) =>
      eq(classroomsTable.channelId, interaction.channelId),
  });

  if (!classroom) {
    await interaction.reply({
      content: 'No classroom found for this channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reports = await db.query.lessonReports.findMany({
    where: (lessonReportsTable) =>
      eq(lessonReportsTable.classroomId, classroom.id),
    orderBy: (lessonReportsTable) => asc(lessonReportsTable.createdAt),
  });

  if (reports.length === 0) {
    await interaction.reply({
      content: 'No lesson reports found for this classroom.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const reportList = reports
    .map(
      (report, i) =>
        `${i + 1}. **${
          report.title
        }** — Created At: _${report.createdAt.toISOString()}_ — [Video](${
          report.videoUrl
        }) | [Code](${report.codeUrl})`
    )
    .join('\n');

  await interaction.reply({
    content: `Lesson reports for this classroom:\n${reportList}`,
    flags: MessageFlags.Ephemeral,
  });
}

export const reportsCommand: CommandData = {
  data: new SlashCommandBuilder()
    .setName('reports')
    .setDescription('Lesson reports')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('generate')
        .setDescription('Generate lesson reports for a classroom')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Title of the lesson')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('video_url')
            .setDescription('URL of the video')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('code_url')
            .setDescription('URL of the code repository')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('List all lesson reports for a classroom')
    ),
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: 'This command can only be used in a guild.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'generate') {
      await handleReportGenerate(interaction);
    } else if (subcommand === 'list') {
      await handleReportList(interaction);
    }
  },
};
