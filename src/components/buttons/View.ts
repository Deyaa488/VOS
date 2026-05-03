import { ButtonInteraction, EmbedBuilder, MessageFlags, VoiceChannel } from 'discord.js';
import { Button } from '../../structures/Button';
import { getRoom } from '../../models/Room';

export default class ViewButton extends Button {
  constructor(client: any) {
    super(client, { id: 'voice-view', customId: 'voice-view' });
  }

  public async execute(interaction: ButtonInteraction): Promise<any> {
    if (!interaction.guild) return;
    const voice = interaction.guild?.members.cache.get(interaction.user.id)?.voice.channel;
    if (!voice) return;
    const room = await getRoom(voice.id);
    if (!room) return;
    
    if (voice instanceof VoiceChannel) {
      const embed = new EmbedBuilder()
        .setTitle(`ℹ️ معلومات الغرفة`)
        .setColor('#2b2d31')
        .addFields(
          { name: '👑 المالك', value: `<@${room.ownerId}>`, inline: true },
          { name: '🔒 مقفلة؟', value: room.locked ? 'نعم' : 'لا', inline: true },
          { name: '👻 مخفية؟', value: room.hidden ? 'نعم' : 'لا', inline: true },
          { name: '👥 المتصلين', value: `${voice.members.size}`, inline: true },
          { name: '🚧 الحد الأقصى', value: voice.userLimit === 0 ? 'غير محدود' : `${voice.userLimit}`, inline: true },
          { name: '📶 جودة الصوت (Bitrate)', value: `${voice.bitrate / 1000}kbps`, inline: true },
          // الإضافة ديالك هنا أ ضياء
          { name: '👨‍💻 المطور المسؤول', value: `<@1054490639305293915>`, inline: false }
        )
        // تقدر تزيد حتى هاد السطر يلا بغيتي تزيد الجمالية (اختياري)
        .setFooter({ text: 'VOS Bot • Created by Diaa', iconURL: interaction.user.displayAvatarURL() });

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }
}
