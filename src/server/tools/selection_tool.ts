import { BlockLocation, Player, PlayerInventoryComponentContainer } from 'mojang-minecraft';
import { PlayerSession } from '../sessions.js';
import { callCommand } from '../commands/command_list.js';
import { Server } from '@library/Minecraft.js';
import { Tool } from './base_tool.js';
import { Tools } from './tool_manager.js';

class SelectionTool extends Tool {
    permission = 'worldedit.selection.pos';
    useOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {
        callCommand(player, player.isSneaking ? 'pos1' : 'pos2',
            [`${loc.x}`, `${loc.y}`, `${loc.z}`]
        );
    }
}
Tools.register(SelectionTool, 'selection_wand', 'wedit:_tool_wooden_axe');