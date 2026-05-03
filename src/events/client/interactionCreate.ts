import {
  Interaction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  UserSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  MessageFlags,
  VoiceChannel
} from 'discord.js';
import { Event } from '../../structures/Event';
import { logger } from '../../utils/logger';
import { errorHandler } from '../../utils/errorHandler';
import { embeds } from '../../utils/embeds';
import { commands } from '../../commands';
import { webhookService } from '../../services/webhookService';
import { cooldownManager } from '../../utils/cooldownManager';
import { buttons } from '../../components/buttons';
import { menus } from '../../components/menus';
import { BotClient } from '../../client';
import { env } from '../../config/env.config';

export default class InteractionCreateEvent extends Event<'interactionCreate'> {
  constructor() {
    super({
      name: 'interactionCreate',
      once: false,
    });
  }

  async execute(interaction: Interaction) {
    const client = interaction.client as BotClient;

    // --- الإضافة ديالنا: استقبال بيانات النافذة (Modal) لتغيير الاسم ---
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'rename_room_modal') {
        const newName = interaction.fields.getTextInputValue('new_room_name');
        const voiceChannel = interaction.guild?.members.cache.get(interaction.user.id)?.voice.channel;
        
        if (voiceChannel && voiceChannel instanceof VoiceChannel) {
          try {
            await voiceChannel.setName(newName);
            await interaction.reply({
              content: `✅ تم تغيير اسم الغرفة إلى: **${newName}**`,
              flags: MessageFlags.Ephemeral
            });
          } catch (error) {
            await interaction.reply({
              content: '❌ حدث خطأ، تأكد أن البوت لديه صلاحية تغيير الأسماء.',
              flags: MessageFlags.Ephemeral
            });
          }
        }
        return;
      }
    }
    // ----------------------------------------------------

    if (interaction.isButton()) {
      await this.handleButtonInteraction(interaction as ButtonInteraction, client);
      return;
    }

    if (
      interaction.isUserSelectMenu() ||
      interaction.isStringSelectMenu() ||
      interaction.isChannelSelectMenu()
    ) {
      await this.handleSelectMenuInteraction(interaction, client);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const botClient = client as BotClient;
    const command = commands.get(interaction.commandName);
    if (!command) return;

    if (botClient.commandBlacklist.has(interaction.commandName.toLowerCase())) {
      await interaction.reply({ embeds: [embeds.error('Error', 'This command has been disabled.')], ephemeral: true });
      return;
    }

    if (command.guildOnly && !interaction.guild) {
      await interaction.reply({ embeds: [embeds.error('Error', 'This command can only be used in a server.')], ephemeral: true });
      return;
    }

    if (command.ownerOnly) {
      const isOwner = interaction.user.id === env.OWNER_ID || env.DEVELOPER_IDS.includes(interaction.user.id);
      if (!isOwner) {
        await interaction.reply({ embeds: [embeds.error('Error', 'Owner only command.')], ephemeral: true });
        return;
      }
    }

    const remainingCooldown = cooldownManager.checkCooldown(interaction.user.id, command.name, command.cooldown);
    if (remainingCooldown > 0) {
      await interaction.reply({ embeds: [embeds.warning('Cooldown', `Wait ${cooldownManager.formatCooldown(remainingCooldown)}`)], ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
    } catch (error) {
      errorHandler.handle(error, `Command: ${command.name}`);
    }
  }

  private async handleButtonInteraction(interaction: ButtonInteraction, _client: BotClient): Promise<void> {
    try {
      const customId = interaction.customId;
      const button = buttons.get(customId);

      if (button && typeof button.execute === 'function') {
        await button.execute(interaction);
      } else {
        if (!interaction.replied && !interaction.deferred) await interaction.deferUpdate().catch(() => {});
      }
    } catch (error) {
      logger.error(`Error in handleButtonInteraction:`, error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Error processing request.', flags: MessageFlags.Ephemeral }).catch(() => {});
      }
    }
  }

  private async handleSelectMenuInteraction(interaction: StringSelectMenuInteraction | UserSelectMenuInteraction | ChannelSelectMenuInteraction, _client: BotClient): Promise<void> {
    try {
      const customId = interaction.customId;
      const menu = menus.get(customId);
      if (menu && typeof menu.execute === 'function') {
        await menu.execute(interaction);
      } else {
        if (!interaction.replied && !interaction.deferred) await interaction.deferUpdate().catch(() => {});
      }
    } catch (error) {
      logger.error(`Error in handleSelectMenuInteraction:`, error);
    }
  }
}
