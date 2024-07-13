import { MolangVariableMap, Player } from "@minecraft/server";
import { PlayerUtil } from "@modules/player_util";
import { RawText, Server, Vector, regionBounds } from "@notbeer-api";
import { generateLine } from "server/commands/region/line";
import { PlayerSession } from "server/sessions";
import { Tool } from "./base_tool";
import { Tools } from "./tool_manager";
import { print } from "server/util";
import { Jobs } from "@modules/jobs";
import { SphereShape } from "server/shapes/sphere";
import { CylinderShape } from "server/shapes/cylinder";
import { PyramidShape } from "server/shapes/pyramid";

abstract class GeneratorTool extends Tool {
    protected posStart = new Map<PlayerSession, [Vector, string]>(); // [location, dimension type]

    protected baseUse(player: Player, session: PlayerSession, loc?: Vector) {
        if (player.isSneaking) {
            Server.uiForms.show("$selectGenMode", player);
            return true;
        }

        if (session.globalPattern.empty()) throw "worldEdit.selectionFill.noPattern";
        if (!this.posStart.has(session)) {
            if (loc) this.posStart.set(session, [loc, player.dimension.id]);
            return true;
        }
        return false;
    }

    protected baseTick(player: Player, session: PlayerSession) {
        if (!this.posStart.has(session) || !session.drawOutlines || this.posStart.get(session)[1] !== player.dimension.id) {
            return true;
        }

        if (this.posStart.get(session)[1] !== player.dimension.id) {
            this.posStart.delete(session);
            return true;
        }
        return false;
    }

    protected traceForPos(player: Player) {
        return PlayerUtil.traceForBlock(player, 8);
    }

    protected getFirstPos(session: PlayerSession) {
        return this.posStart.get(session)[0];
    }

    protected clearFirstPos(session: PlayerSession) {
        return this.posStart.delete(session);
    }

    stopHold = function (self: GeneratorTool, _: Player, session: PlayerSession) {
        self.posStart.delete(session);
    };

    drop = function (self: GeneratorTool, _: Player, session: PlayerSession) {
        self.posStart.delete(session);
    };
}

class DrawLineTool extends GeneratorTool {
    permission = "worldedit.region.line";

    commonUse = function* (self: DrawLineTool, player: Player, session: PlayerSession, loc?: Vector) {
        if (self.baseUse(player, session, loc)) return;

        const pos1 = self.getFirstPos(session);
        const pos2 = self.traceForPos(player);
        const [start, end] = regionBounds([pos1, pos2]);
        self.clearFirstPos(session);

        const dim = player.dimension;
        const pattern = session.globalPattern;
        pattern.setContext(session, [start, end]);

        const history = session.getHistory();
        const record = history.record();
        let count: number;
        try {
            const points = (yield* generateLine(pos1, pos2)).map((p) => p.floor());
            yield history.addUndoStructure(record, start, end);
            count = 0;
            for (const point of points) {
                const block = dim.getBlock(point);
                if (session.globalMask.matchesBlock(block) && pattern.setBlock(block)) {
                    count++;
                }
                yield;
            }

            history.recordSelection(record, session);
            yield history.addRedoStructure(record, start, end);
            history.commit(record);
        } catch (e) {
            history.cancel(record);
            throw e;
        }

        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawLineTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;

        let lineStart = self.getFirstPos(session);
        const lineEnd = self.traceForPos(player);
        const length = lineEnd.sub(lineStart).length;
        if (length > 64) {
            lineStart = lineEnd.add(lineStart.sub(lineEnd).normalized().mul(64)).floor();
        }

        try {
            const molangVars = new MolangVariableMap();
            molangVars.setVector3("point", Vector.sub(lineEnd, lineStart));
            player.spawnParticle("wedit:line_selection", lineStart.add(0.5), molangVars);
        } catch {
            /* pass */
        }
    };

    useOn = this.commonUse;
    use = this.commonUse;
}
Tools.register(DrawLineTool, "draw_line", "wedit:draw_line");

class DrawSphereTool extends GeneratorTool {
    permission = "worldedit.generation.sphere";

    commonUse = function* (self: DrawSphereTool, player: Player, session: PlayerSession, loc?: Vector) {
        if (self.baseUse(player, session, loc)) return;

        const [shape, center] = self.getShape(player, session);
        const pattern = session.globalPattern;
        pattern.setContext(session, shape.getRegion(center));
        self.clearFirstPos(session);

        const count = yield* Jobs.run(session, 2, shape.generate(center, pattern, null, session));
        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawSphereTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;
        const [shape, loc] = self.getShape(player, session);
        shape.draw(loc, player);
    };

    getShape(player: Player, session: PlayerSession): [SphereShape, Vector] {
        const center = this.getFirstPos(session)!;
        const radius = Math.floor(this.traceForPos(player).sub(center).length);
        return [new SphereShape(radius), center];
    }

    useOn = this.commonUse;
    use = this.commonUse;
}
Tools.register(DrawSphereTool, "draw_sphere", "wedit:draw_sphere");

class DrawCylinderTool extends GeneratorTool {
    permission = "worldedit.generation.cyl";

    commonUse = function* (self: DrawCylinderTool, player: Player, session: PlayerSession, loc?: Vector) {
        if (self.baseUse(player, session, loc)) return;

        const [shape, center] = self.getShape(player, session);
        const pattern = session.globalPattern;
        pattern.setContext(session, shape.getRegion(center));
        self.clearFirstPos(session);

        const count = yield* Jobs.run(session, 2, shape.generate(center, pattern, null, session));

        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawCylinderTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;
        const [shape, loc] = self.getShape(player, session);
        shape.draw(loc, player);
    };

    getShape(player: Player, session: PlayerSession): [CylinderShape, Vector] {
        const center = this.getFirstPos(session).clone();
        const pos2 = this.traceForPos(player);
        const radius = Math.floor(pos2.sub(center).mul([1, 0, 1]).length);
        let height = pos2.y - center.y + 1;
        if (height < 1) {
            center.y += height;
            height = -height + 1;
        }
        return [new CylinderShape(height * 2, radius), center];
    }

    useOn = this.commonUse;
    use = this.commonUse;
}
Tools.register(DrawCylinderTool, "draw_cylinder", "wedit:draw_cylinder");

class DrawPyramidTool extends GeneratorTool {
    permission = "worldedit.generation.pyramid";

    commonUse = function* (self: DrawPyramidTool, player: Player, session: PlayerSession, loc?: Vector) {
        if (self.baseUse(player, session, loc)) return;

        const [shape, center] = self.getShape(player, session);
        const pattern = session.globalPattern;
        pattern.setContext(session, shape.getRegion(center));
        self.clearFirstPos(session);

        const count = yield* Jobs.run(session, 2, shape.generate(center, pattern, null, session));

        print(RawText.translate("commands.blocks.wedit:created").with(`${count}`), player, true);
    };

    tick = function (self: DrawPyramidTool, player: Player, session: PlayerSession) {
        if (self.baseTick(player, session)) return;

        const [shape, loc] = self.getShape(player, session);
        shape.draw(loc, player);
    };

    getShape(player: Player, session: PlayerSession): [PyramidShape, Vector] {
        const center = this.getFirstPos(session).clone();
        const pos2 = this.traceForPos(player);
        const size =
            Math.max(
                ...pos2
                    .sub(center)
                    .toArray()
                    .map((v, i) => (i !== 1 ? Math.abs(v) : v))
            ) + 1;
        return [new PyramidShape(size), center];
    }

    useOn = this.commonUse;
    use = this.commonUse;
}
Tools.register(DrawPyramidTool, "draw_pyramid", "wedit:draw_pyramid");
