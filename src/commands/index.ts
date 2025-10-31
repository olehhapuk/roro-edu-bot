import { Collection } from 'discord.js';
import { CommandData } from './command-data';
import { createCommand } from './create.command';
import { hwCommand } from './hw.command';
import { setupCommand } from './setup.command';

export const commands = new Collection<string, CommandData>();

commands.set('create', createCommand);
commands.set('hw', hwCommand);
commands.set('setup', setupCommand);
