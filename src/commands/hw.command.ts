import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../db';
import { and, desc, eq, SQL } from 'drizzle-orm';
import { classroomsTable } from '../db/schema/classrooms.table';
import { homeworksTable } from '../db/schema/homeworks.table';
import { format } from 'date-fns';
import {
  hwSubmissionsTable,
  HwSubmissionStatus,
} from '../db/schema/hw-submissions.table';
import { CommandData } from './command-data';
import { requireRoles } from '../utils/require-roles';
import { getStatusEmoji } from '../utils/get-status-emoji';

export async function handleHWAutocomplete(
  interaction: AutocompleteInteraction
) {
  if (interaction.options.getSubcommand() === 'submit') {
    const focusedOption = interaction.options.getFocused(true);

    if (focusedOption.name === 'homework_id') {
      if (!interaction.channel) {
        await interaction.respond([]);
        return;
      }

      const channelId = interaction.channel.id;

      const classroom = await db.query.classrooms.findFirst({
        where: () => eq(classroomsTable.channelId, channelId),
      });

      if (!classroom) {
        await interaction.respond([]);
        return;
      }

      const homeworks = await db.query.homeworks.findMany({
        where: () => eq(homeworksTable.classroomId, classroom.id),
        orderBy: () => desc(homeworksTable.dueDate),
        limit: 25, // Discord autocomplete limit
      });

      const choices = homeworks
        .filter(
          (hw) =>
            hw.title
              .toLowerCase()
              .includes(focusedOption.value.toLowerCase()) ||
            hw.id.includes(focusedOption.value)
        )
        .map((hw) => ({
          name: `${hw.title} (Due: ${format(hw.dueDate, 'dd.MM.yyyy')})`,
          value: hw.id,
        }));

      await interaction.respond(choices);
    }
  }
}

async function handleAddHomework(interaction: ChatInputCommandInteraction) {
  if (!interaction.channel) {
    await interaction.reply({
      content: 'This command can only be used in a text channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const isTeacher = requireRoles(interaction, ['Teacher']);
  if (!isTeacher) {
    await interaction.reply({
      content: 'You do not have permission to add homework.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelId = interaction.channel.id;

  const title = interaction.options.getString('title', true);
  const dueDateStr = interaction.options.getString('due_date', true);
  const githubLink = interaction.options.getString('github_link', true);

  const dueDate = new Date(dueDateStr.split('.').reverse().join('-'));

  const classroom = await db.query.classrooms.findFirst({
    where: () => eq(classroomsTable.channelId, channelId),
  });

  if (!classroom) {
    await interaction.reply(
      'No classroom found for this channel. Please create a classroom first.'
    );
    return;
  }

  const [newHomework] = await db
    .insert(homeworksTable)
    .values({
      title,
      dueDate,
      classroomId: classroom.id,
      githubLink,
    })
    .returning();

  await interaction.reply({
    content: `Added new homework: **${newHomework.title}** (Due: _${format(
      newHomework.dueDate,
      'dd.MM.yyyy'
    )}_)`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleListHomeworks(interaction: ChatInputCommandInteraction) {
  if (!interaction.channel) {
    await interaction.reply({
      content: 'This command can only be used in a text channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelId = interaction.channel.id;

  const classroom = await db.query.classrooms.findFirst({
    where: () => eq(classroomsTable.channelId, channelId),
  });

  if (!classroom) {
    await interaction.reply({
      content:
        'No classroom found for this channel. Please create a classroom first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const homeworks = await db.query.homeworks.findMany({
    where: () => eq(homeworksTable.classroomId, classroom.id),
    orderBy: () => desc(homeworksTable.dueDate),
  });

  if (homeworks.length === 0) {
    await interaction.reply({
      content: 'No homeworks found for this classroom.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const homeworkList = homeworks
    .map(
      (hw, i) =>
        `${i + 1}. **${hw.title}** — Due: _${format(
          hw.dueDate,
          'dd.MM.yyyy'
        )}_ — [GitHub Link](${hw.githubLink})`
    )
    .join('\n');

  await interaction.reply({
    content: `## Homeworks\n\n${homeworkList}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleSubmitHomework(
  interaction: ChatInputCommandInteraction,
  client: Client
) {
  if (!interaction.channel) {
    await interaction.reply({
      content: 'This command can only be used in a text channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channelId = interaction.channel.id;

  const githubPRLink = interaction.options.getString('github_pr_link', true);
  const homeworkId = interaction.options.getString('homework_id', true);

  const classroom = await db.query.classrooms.findFirst({
    where: () => eq(classroomsTable.channelId, channelId),
  });

  if (!classroom) {
    await interaction.reply({
      content:
        'No classroom found for this channel. Please create a classroom first.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Verify homework exists and belongs to this classroom
  const homework = await db.query.homeworks.findFirst({
    where: () => eq(homeworksTable.id, homeworkId),
  });

  if (!homework || homework.classroomId !== classroom.id) {
    await interaction.reply({
      content:
        'Invalid homework ID or homework does not belong to this classroom.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // Check if student already submitted this homework
  const existingSubmission = await db.query.hwSubmissions.findFirst({
    where: () =>
      and(
        eq(hwSubmissionsTable.studentId, interaction.user.id),
        eq(hwSubmissionsTable.homeworkId, homeworkId)
      ),
  });

  if (existingSubmission) {
    await interaction.reply({
      content: `You have already submitted this homework. Submission ID: ${existingSubmission.id}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const formattedPRLink = (() => {
    try {
      let url: URL;
      try {
        url = new URL(githubPRLink);
      } catch {
        // If no protocol provided, assume https
        url = new URL(`https://${githubPRLink}`);
      }
      return `${url.protocol}//${url.host}${url.pathname}`;
    } catch {
      // Fallback to original if parsing fails
      return githubPRLink;
    }
  })();

  const [newSubmission] = await db
    .insert(hwSubmissionsTable)
    .values({
      githubPRLink: formattedPRLink,
      classroomId: classroom.id,
      studentId: interaction.user.id,
      homeworkId: homeworkId,
    })
    .returning();

  const teacher = await client.users.fetch(classroom.ownerId);
  if (teacher) {
    teacher.send(
      `New homework submission for "${homework.title}" by ${interaction.user.tag}. PR Link: ${githubPRLink}`
    );
  }

  await interaction.reply({
    content: `Homework submitted successfully! Your submission ID is: ${newSubmission.id}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleListSubmissions(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'This command can only be used in a guild.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const isTeacher = requireRoles(interaction, ['Teacher']);
  if (!isTeacher) {
    await interaction.reply({
      content: 'You do not have permission to view submissions.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const statusFilter =
    (interaction.options.getString('status', true) as
      | HwSubmissionStatus
      | undefined) || 'all';

  const studentOption = interaction.options.getUser('student');

  const submissionsQuery = db.query.hwSubmissions;

  const filters: SQL[] = [];

  if (statusFilter !== 'all') {
    filters.push(eq(hwSubmissionsTable.status, statusFilter));
  }

  if (studentOption) {
    filters.push(eq(hwSubmissionsTable.studentId, studentOption.id));
  }

  const submissions = await submissionsQuery.findMany({
    where: () => and(...filters),
    orderBy: () => desc(hwSubmissionsTable.submittedAt),
    with: {
      homework: true,
    },
  });

  if (submissions.length === 0) {
    await interaction.reply({
      content: 'No submissions found matching the criteria.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const submissionList = submissions
    .map(
      (submission, i) =>
        `${i + 1}. Homework ID: **${submission.homework.title}** — Status: _${
          submission.status
        }_${getStatusEmoji(submission.status)} — Submitted At: _${format(
          submission.submittedAt,
          'dd.MM.yyyy HH:mm'
        )}_ — [PR Link](${submission.githubPRLink})`
    )
    .join('\n');

  await interaction.reply({
    content: `## Students Homework Submissions\n\n${submissionList}`,
    flags: MessageFlags.Ephemeral,
  });
}

async function handleMySubmissions(interaction: ChatInputCommandInteraction) {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'This command can only be used in a guild.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const statusFilter =
    (interaction.options.getString('status') as
      | HwSubmissionStatus
      | undefined) || 'all';

  const submissionsQuery = db.query.hwSubmissions;

  const filters: SQL[] = [
    eq(hwSubmissionsTable.studentId, interaction.user.id),
  ];

  if (statusFilter !== 'all') {
    filters.push(eq(hwSubmissionsTable.status, statusFilter));
  }

  const submissions = await submissionsQuery.findMany({
    where: () => and(...filters),
    orderBy: () => desc(hwSubmissionsTable.submittedAt),
    with: {
      homework: true,
    },
  });

  if (submissions.length === 0) {
    await interaction.reply({
      content: 'No submissions found matching the criteria.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const submissionList = submissions
    .map(
      (submission, i) =>
        `${i + 1}. Homework ID: **${submission.homework.title}** — Status: _${
          submission.status
        }_${getStatusEmoji(submission.status)} — Submitted At: _${format(
          submission.submittedAt,
          'dd.MM.yyyy HH:mm'
        )}_ — [PR Link](${submission.githubPRLink})`
    )
    .join('\n');

  await interaction.reply({
    content: `## Your Homework Submissions\n\n${submissionList}`,
    flags: MessageFlags.Ephemeral,
  });
}

export const hwCommand: CommandData = {
  data: new SlashCommandBuilder()
    .setName('hw')
    .setDescription('Homework related commands')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a new homework')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('Title of the homework')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('due_date')
            .setDescription('Due date of the homework in dd.mm.yyyy format')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('github_link')
            .setDescription('GitHub link')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('list').setDescription('List all homeworks')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('submit')
        .setDescription('Submit homework')
        .addStringOption((option) =>
          option
            .setName('github_pr_link')
            .setDescription('GitHub PR link for the homework submission')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('homework_id')
            .setDescription('ID of the homework to submit')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('submissions')
        .setDescription('List your homework submissions')
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Pending', value: HwSubmissionStatus.PENDING },
              { name: 'Approved', value: HwSubmissionStatus.APPROVED },
              { name: 'Rejected', value: HwSubmissionStatus.REJECTED }
            )
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName('student')
            .setDescription('Student to filter submissions')
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('my_submissions')
        .setDescription('List your homework submissions')
        .addStringOption((option) =>
          option
            .setName('status')
            .setDescription('Filter by status')
            .addChoices(
              { name: 'All', value: 'all' },
              { name: 'Pending', value: HwSubmissionStatus.PENDING },
              { name: 'Approved', value: HwSubmissionStatus.APPROVED },
              { name: 'Rejected', value: HwSubmissionStatus.REJECTED }
            )
        )
    ),
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    if (interaction.options.getSubcommand() === 'add') {
      await handleAddHomework(interaction);
    } else if (interaction.options.getSubcommand() === 'list') {
      await handleListHomeworks(interaction);
    } else if (interaction.options.getSubcommand() === 'submit') {
      await handleSubmitHomework(interaction, client);
    } else if (interaction.options.getSubcommand() === 'submissions') {
      await handleListSubmissions(interaction);
    } else if (interaction.options.getSubcommand() === 'my_submissions') {
      await handleMySubmissions(interaction);
    }
  },
};
