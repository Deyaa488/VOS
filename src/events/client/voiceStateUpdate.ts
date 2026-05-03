import { 
  VoiceState, 
  ChannelType, 
  VoiceChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { Event } from '../../structures/Event';
import { logger } from '../../utils/logger';
import { getVoiceCreatorByGuildId } from '../../models/VoiceCreator';
import { getRoom, createRoom, deleteRoom } from '../../models/Room';
import mongoose from 'mongoose';

export default class VoiceStateUpdateEvent extends Event<'voiceStateUpdate'> {
  private deletionTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super({
      name: 'voiceStateUpdate',
      once: false,
    });
  }

  async execute(oldState: VoiceState, newState: VoiceState) {
    try {
      if (!oldState.channel && newState.channel) await this.handleVoiceJoin(newState);
      if (oldState.channel && !newState.channel) await this.handleVoiceLeave(oldState);
      if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) await this.handleVoiceSwitch(oldState, newState);
    } catch (error) {
      logger.error('Error in voiceStateUpdate event:', error);
    }
  }

  private cancelRoomDeletion(channelId: string): void {
    const timeout = this.deletionTimeouts.get(channelId);
    if (timeout) {
      clearTimeout(timeout);
      this.deletionTimeouts.delete(channelId);
    }
  }

  private async handleVoiceJoin(state: VoiceState) {
    if (!state.guild || !state.channel || !state.member) return;
    const voiceCreator = await getVoiceCreatorByGuildId(state.guild.id);
    if (!voiceCreator) return;

    if (state.channel.id === voiceCreator.voiceChannelId) {
      await this.createPrivateRoom(state);
      return;
    }

    const room = await getRoom(state.channel.id);
    if (room) {
      this.cancelRoomDeletion(state.channel.id);
      if (room.locked) {
        if (state.member.id === room.ownerId) return;
        const permissions = state.channel.permissionsFor(state.member);
        const hasConnectPermission = permissions?.has('Connect') ?? false;
        if (!hasConnectPermission) {
          try {
            await state.member.voice.disconnect('الغرفة مقفلة');
          } catch (error) {
            logger.error(`Failed to disconnect user:`, error instanceof Error ? error : undefined);
          }
        }
      }
    }
  }

  private async handleVoiceLeave(state: VoiceState) {
    if (!state.guild || !state.channel) return;
    const channelId = state.channel.id;
    const guildId = state.guild.id;
    const client = state.guild.client;
    
    const room = await getRoom(channelId);
    if (!room) return;

    setTimeout(async () => {
      try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;
        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || channel.type !== ChannelType.GuildVoice) {
          await deleteRoom(channelId).catch(() => {});
          return;
        }

        const voiceChannel = channel as VoiceChannel;
        const currentRoom = await getRoom(channelId);
        if (!currentRoom) return;

        if (voiceChannel.members.size === 0) {
          this.cancelRoomDeletion(channelId);
          const timeout = setTimeout(async () => {
            try {
              this.deletionTimeouts.delete(channelId);
              const finalGuild = await client.guilds.fetch(guildId).catch(() => null);
              if (!finalGuild) return;
              const finalChannel = await finalGuild.channels.fetch(channelId).catch(() => null);
              if (!finalChannel || finalChannel.type !== ChannelType.GuildVoice) {
                await deleteRoom(channelId).catch(() => {});
                return;
              }
              const finalVoiceChannel = finalChannel as VoiceChannel;
              if (finalVoiceChannel.members.size === 0) {
                try {
                  await finalVoiceChannel.delete('Room is empty');
                  await deleteRoom(channelId);
                } catch (e) {}
              }
            } catch (error) {
              this.deletionTimeouts.delete(channelId);
            }
          }, 15000);
          this.deletionTimeouts.set(channelId, timeout);
        }
      } catch (error) {}
    }, 1000);
  }

  private async handleVoiceSwitch(oldState: VoiceState, newState: VoiceState) {
    await this.handleVoiceLeave(oldState);
    await this.handleVoiceJoin(newState);
  }

  private async createPrivateRoom(state: VoiceState) {
    if (!state.guild || !state.channel || !state.member) return;

    try {
      if (mongoose.connection.readyState !== 1) {
        await state.member.voice.disconnect('Database not connected').catch(() => {});
        return;
      }

      const voiceCreator = await getVoiceCreatorByGuildId(state.guild.id);
      if (!voiceCreator) return;

      let category = await state.guild.channels.fetch(voiceCreator.categoryId).catch(() => null);
      if (!category || category.type !== ChannelType.GuildCategory) {
        await state.member.voice.disconnect('Invalid category').catch(() => {});
        return;
      }

      const channelName = `${state.member.user.username}'s Room`.slice(0, 100);

      let newChannel;
      try {
        newChannel = await state.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: category.id,
          permissionOverwrites: [
            { id: state.guild.id, deny: ['Connect'] },
            { id: state.member.id, allow: ['Connect', 'ManageChannels', 'Speak'] },
          ],
        });
      } catch (createError) {
        await state.member.voice.disconnect('Failed to create channel').catch(() => {});
        return;
      }

      try {
        await state.member.voice.setChannel(newChannel.id);
      } catch (moveError) {
        await newChannel.delete().catch(() => {});
        await state.member.voice.disconnect().catch(() => {});
        return;
      }

      try {
        await createRoom(
          { channelId: newChannel.id, guildId: state.guild.id, ownerId: state.member.id, locked: false, hidden: false },
          { validateRelations: false, populate: false, useTransaction: false }
        );

        const controlEmbed = new EmbedBuilder()
          .setTitle('🎙️ لوحة التحكم في الغرفة')
          .setDescription(`مرحباً بك <@${state.member.id}> في غرفتك الخاصة!\nاستعمل الأزرار أسفله للتحكم في الغرفة:`)
          .setColor('#2b2d31');

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('voice-lock').setLabel('قفل').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice-unlock').setLabel('فتح').setEmoji('🔓').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice-hide').setLabel('إخفاء').setEmoji('👻').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice-unhide').setLabel('إظهار').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice-rename').setLabel('تغيير الإسم').setEmoji('📝').setStyle(ButtonStyle.Primary)
        );

        const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('voice-increase-limit').setLabel('تحديد العدد').setEmoji('👥').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice-view').setLabel('معلومات').setEmoji('ℹ️').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('voice-claim').setLabel('استحواذ').setEmoji('👑').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('voice-disconnect').setLabel('طرد').setEmoji('🚫').setStyle(ButtonStyle.Danger)
        );

        await newChannel.send({
          content: `<@${state.member.id}>`,
          embeds: [controlEmbed],
          components: [row1, row2],
        });

      } catch (dbError) {
        await newChannel.delete().catch(() => {});
        await state.member.voice.disconnect().catch(() => {});
      }
    } catch (error) {
      if (state.member) await state.member.voice.disconnect().catch(() => {});
    }
  }
}
