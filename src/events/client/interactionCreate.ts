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

    // --- استقبال النوافذ (Modals) لتغيير الاسم والعدد ---
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
            await interaction.reply({ content: '❌ حدث خطأ، تأكد أن البوت لديه صلاحية.', flags: MessageFlags.Ephemeral });
          }
        }
        return;
      }

      if (interaction.customId === 'limit_room_modal') {
        const limitValue = interaction.fields.getTextInputValue('new_room_limit');
        const limitNumber = parseInt(limitValue, 10);
        const voiceChannel = interaction.guild?.members.cache.get(interaction.user.id)?.voice.channel;

        if (isNaN(limitNumber) || limitNumber < 0 || limitNumber > 99) {
          return interaction.reply({ content: '❌ المرجو إدخال رقم صحيح بين 0 و 99.', flags: MessageFlags.Ephemeral });
        }

        if (voiceChannel && voiceChannel instanceof VoiceChannel) {
          try {
            await voiceChannel.setUserLimit(limitNumber);
            await interaction.reply({
              content: limitNumber === 0 ? `✅ تم إزالة الحد الأقصى (غرفة مفتوحة).` : `✅ تم تحديد عدد الأشخاص في: **${limitNumber}**`,
              flags: MessageFlags.Ephemeral
            });
          } catch (error) {
            await interaction.reply({ content: '❌ حدث خطأ أثناء تغيير العدد.', flags: MessageFlags.Ephemeral });
          }
        }
        return;
      }
    }

    if (interaction.isButton()) {
      await this.handleButtonInteraction(interaction as ButtonInteraction, client);
      return;
    }

    if (interaction.isUserSelectMenu() || interaction.isStringSelectMenu() || interaction.isChannelSelectMenu()) {
      await this.handleSelectMenuInteraction(interaction, client);
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const botClient = client as BotClient;
    const command = commands.get(interaction.commandName);
    if (!command) return;

    if (botClient.commandBlacklist.has(interaction.commandName.toLowerCase())) {
      await interaction.reply({ embeds: [embeds.error('Error', 'هذا الأمر معطل.')], ephemeral: true });
      return;
    }

    if (command.guildOnly && !interaction.guild) {
      await interaction.reply({ embeds: [embeds.error('Error', 'هذا الأمر يستعمل في السيرفر فقط.')], ephemeral: true });
      return;
    }

    if (command.ownerOnly) {
      const isOwner = interaction.user.id === env.OWNER_ID || env.DEVELOPER_IDS.includes(interaction.user.id);
      if (!isOwner) {
        await interaction.reply({ embeds: [embeds.error('Error', 'هذا الأمر خاص بمالك البوت.')], ephemeral: true });
        return;
      }
    }

    const remainingCooldown = cooldownManager.checkCooldown(interaction.user.id, command.name, command.cooldown);
    if (remainingCooldown > 0) {
      await interaction.reply({ embeds: [embeds.warning('Cooldown', `انتظر ${cooldownManager.formatCooldown(remainingCooldown)}`)], ephemeral: true });
      return;
    }

    try {
      await command.execute(interaction as ChatInputCommandInteraction);
      webhookService.sendCommandLog(command.name, interaction.user.id, interaction.user.tag, interaction.guild?.id, interaction.guild?.name).catch(() => {});
    } catch (error) {
      errorHandler.handle(error, `Command: ${command.name}`);
      webhookService.sendErrorLog(error instanceof Error ? error : new Error(String(error)), `Command: ${command.name}`).catch(() => {});
      const errorEmbed = errorHandler.createErrorEmbed(error, 'Command Error');
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        else await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
      } catch (replyError) {
        logger.error('Failed to send error response', replyError instanceof Error ? replyError : undefined);
      }
    }
  }

  private async handleButtonInteraction(interaction: ButtonInteraction, _client: BotClient): Promise<void> {
    try {
      const customId = interaction.customId;
      if (customId.startsWith('botinfo_')) {
        const botinfoButton = buttons.get('botinfo');
        if (botinfoButton) await botinfoButton.execute(interaction);
        return;
      }
      const button = buttons.get(customId);
      if (button && typeof button.execute === 'function') {
        await button.execute(interaction);
      } else {
        if (!interaction.replied && !interaction.deferred) await interaction.deferUpdate().catch(() => {});
      }
    } catch (error) {
      if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '❌ حدث خطأ.', flags: MessageFlags.Ephemeral }).catch(() => {});
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
    } catch (error) {}
  }
}
