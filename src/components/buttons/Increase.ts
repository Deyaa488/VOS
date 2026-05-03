import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { Button } from '../../structures/Button';
import { getRoom } from '../../models/Room';

export default class IncreaseButton extends Button {
  constructor(client: any) {
    super(client, {
      id: 'voice-increase-limit',
      customId: 'voice-increase-limit',
    });
  }

  public async execute(interaction: ButtonInteraction): Promise<any> {
    if (!interaction.guild) return;
    
    const voice = interaction.guild?.members.cache.get(interaction.user.id)?.voice.channel;
    if (!voice) return interaction.reply({ content: '❌ لست في غرفة صوتية.', flags: MessageFlags.Ephemeral });
    
    const room = await getRoom(voice.id);
    if (!room) return interaction.reply({ content: '❌ هذه ليست غرفة خاصة بالبوت.', flags: MessageFlags.Ephemeral });
    
    if (room.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ لست مالك هذه الغرفة.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId('limit_room_modal')
      .setTitle('تحديد عدد الأشخاص 👥');

    const limitInput = new TextInputBuilder()
      .setCustomId('new_room_limit')
      .setLabel('أدخل العدد (0 للغرفة المفتوحة، أقصى حد 99)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('مثال: 5')
      .setRequired(true)
      .setMaxLength(2);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(limitInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
}
