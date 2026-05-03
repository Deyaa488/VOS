import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import { Button } from '../../structures/Button';
import { getRoom } from '../../models/Room';

export default class RenameButton extends Button {
  constructor(client: any) {
    super(client, {
      id: 'voice-rename',
      customId: 'voice-rename',
    });
  }

  public async execute(interaction: ButtonInteraction): Promise<any> {
    if (!interaction.guild) return;
    
    const voice = interaction.guild?.members.cache.get(interaction.user.id)?.voice.channel;
    if (!voice) return interaction.reply({ content: 'You are not in a voice channel.', flags: MessageFlags.Ephemeral });
    
    const room = await getRoom(voice.id);
    if (!room) return interaction.reply({ content: 'This is not a valid VoiceMaster room.', flags: MessageFlags.Ephemeral });
    
    if (room.ownerId !== interaction.user.id) {
      return interaction.reply({ content: 'You are not the owner of this room.', flags: MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId('rename_room_modal')
      .setTitle('تغيير اسم الغرفة');

    const nameInput = new TextInputBuilder()
      .setCustomId('new_room_name')
      .setLabel('الاسم الجديد')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('اكتب الاسم هنا...')
      .setRequired(true)
      .setMaxLength(30);

    const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
  }
}
