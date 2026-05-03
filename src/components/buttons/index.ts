import { Collection } from 'discord.js';
import { Button } from '../../structures/Button';
import { logger } from '../../utils/logger';
import BotinfoButton from './Botinfo';
import ActivityButton from './Activity';
import LockButton from './Lock';
import UnlockButton from './Unlock';
import HideButton from './Hide';
import UnhideButton from './Unhide';
import ViewButton from './View';
import DisconnectButton from './Disconnect';
import ClaimButton from './Claim';
import IncreaseButton from './Increase';
import DecreaseButton from './Decrease';
import RenameButton from './Rename'; // الزر الجديد ديالنا

export const buttons = new Collection<string, Button>();

export function loadButtons(client: any): void {
  const buttonClasses = [
    BotinfoButton,
    ActivityButton,
    LockButton,
    UnlockButton,
    HideButton,
    UnhideButton,
    ViewButton,
    DisconnectButton,
    ClaimButton,
    IncreaseButton,
    DecreaseButton,
    RenameButton, // ضفناه هنا باش البوت يقراه
  ];

  for (const ButtonClass of buttonClasses) {
    const button = new ButtonClass(client);
    buttons.set(button.customId, button);
    logger.info(`Loaded button: ${button.customId}`);
  }
}

export function getButtons(): Collection<string, Button> {
  return buttons;
}
