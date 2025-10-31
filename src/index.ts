import {
  Client,
  Events,
  GatewayIntentBits,
  Interaction,
  MessageFlags,
  REST,
  Routes,
} from 'discord.js';
import 'dotenv/config';
import { events } from './server';
import { commands } from './commands';
import { handleHWAutocomplete } from './commands/hw.command';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.on(Events.ClientReady, (readyClient) => {
  events.addOnSendMessageListener(async (studentId, message) => {
    const user = await client.users.fetch(studentId);
    if (user) {
      user.send(message);
    }
  });
  console.log(`Logged in as ${readyClient.user.tag}!`);
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === 'hw') {
      handleHWAutocomplete(interaction);
    }
    return;
  }

  if (interaction.isCommand()) {
    const command = commands.get(interaction.commandName);
    if (!command) {
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      } else {
        await interaction.reply({
          content: 'There was an error while executing this command!',
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    return;
  }
});

const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);
(async () => {
  try {
    console.log(
      `Started refreshing ${commands.size} application (/) commands.`
    );
    // The put method is used to fully refresh all commands in the guild with the current set
    const data = (await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
      { body: commands.map((command) => command.data.toJSON()) }
    )) as object[];
    console.log(
      `Successfully reloaded ${data.length} application (/) commands.`
    );
  } catch (error) {
    // And of course, make sure you catch and log any errors!
    console.log('Error occurred while refreshing application commands.');
    console.error(error);
  }
})();

client.login(process.env.DISCORD_BOT_TOKEN!);
