import { ButtonInteraction, MessageFlags } from 'discord.js';
import { Button } from '../../structures/Button';
import { getRoom, updateRoom } from '../../models/Room';

export default class ClaimButton extends Button {
  constructor(client: any) {
    super(client, { id: 'voice-claim', customId: 'voice-claim' });
  }

  public async execute(interaction: ButtonInteraction): Promise<any> {
    if (!interaction.guild) return;
    const voice = interaction.guild?.members.cache.get(interaction.user.id)?.voice.channel;
    if (!voice) return;
    const room = await getRoom(voice.id);
    if (!room) return;
    
    if (room.ownerId === interaction.user.id) {
      return interaction.reply({ content: '❌ أنت بالفعل مالك هذه الغرفة.', flags: MessageFlags.Ephemeral });
    }
    
    // التحقق واش المالك القديم مزال فـ الروم
    const owner = voice.members.get(room.ownerId);
    if (owner) {
      return interaction.reply({ content: '❌ لا يمكنك الاستحواذ على الغرفة، المالك الأصلي لا يزال موجوداً.', flags: MessageFlags.Ephemeral });
    }

    await updateRoom(voice.id, { ownerId: interaction.user.id });
    return interaction.reply({ content: '👑 لقد أصبحت المالك الجديد لهذه الغرفة!', flags: MessageFlags.Ephemeral });
  }
}
