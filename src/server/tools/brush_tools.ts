import { Player } from "@minecraft/server";
import { Tool } from "./base_tool.js";
import { Tools } from "./tool_manager.js";
import { Brush } from "../brushes/base_brush.js";
import { PlayerSession } from "../sessions.js";
import { Mask } from "@modules/mask.js";
import { Pattern } from "@modules/pattern.js";
import { PlayerUtil } from "@modules/player_util.js";
import { Selection } from "@modules/selection.js";
import { Vector } from "@notbeer-api";

class BrushTool extends Tool {
  public brush: Brush;

  public range: number = null;
  public mask: Mask = null;
  public traceMask: Mask = null;

  permission = "worldedit.brush";

  private outlines = new Map<PlayerSession, {selection: Selection, lastHit: Vector}>();
  private prevTick = 0;
  private ticksToUpdate = 0;

  use = function* (self: BrushTool, player: Player, session: PlayerSession) {
    const hit = PlayerUtil.traceForBlock(player, self.range, self.traceMask);
    if (!hit) {
      throw "commands.wedit:jumpto.none";
    }
    yield* self.brush.apply(hit, session, self.mask);
  };

  tick = function* (self: BrushTool, player: Player, session: PlayerSession, tick: number): Generator<void> {
    this.ticksToUpdate -= tick - this.prevTick;
    this.prevTick = tick;
    if (this.ticksToUpdate > 0 || !session.drawOutlines) return;

    this.ticksToUpdate = 3;
    const hit = PlayerUtil.traceForBlock(player, self.range, self.traceMask);
    yield;
    if (hit) {
      if (!self.outlines.has(session)) {
        const selection = new Selection(player);
        self.outlines.set(session, {selection, lastHit: hit});
      }

      const { selection, lastHit } = self.outlines.get(session);
      self.brush.updateOutline(selection, hit);
      if (lastHit && !lastHit.equals(hit)) {
        selection.forceDraw();
      } else {
        selection.draw();
      }
      self.outlines.get(session).lastHit = hit;
      yield;
    }
  };

  constructor(brush: Brush, mask?: Mask) {
    super();
    this.brush = brush;
    this.mask = mask;
  }

  set size(value: number) {
    this.brush.resize(value);
  }

  set material(value: Pattern) {
    this.brush.paintWith(value);
  }

  delete() {
    super.delete();
    this.brush.delete();
  }
}
Tools.register(BrushTool, "brush");
