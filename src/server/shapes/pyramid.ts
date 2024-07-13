import { MolangVariableMap, Player } from "@minecraft/server";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";

export class PyramidShape extends Shape {
    private size: number;

    protected customHollow = true;

    constructor(size: number) {
        super();
        this.size = size;
    }

    public getRegion(loc: Vector) {
        return <[Vector, Vector]>[loc.offset(-this.size + 1, 0, -this.size + 1), loc.offset(this.size - 1, this.size - 1, this.size - 1)];
    }

    public getYRange(): null {
        throw new Error("getYRange not implemented!");
    }

    public draw(loc: Vector, player: Player, global?: boolean): void {
        const dimension = player.dimension;
        try {
            loc = loc.add(0.5);
            const spawnAt = Vector.add(player.getHeadLocation(), Vector.from(player.getViewDirection()).mul(20));
            spawnAt.y = Math.min(Math.max(spawnAt.y, dimension.heightRange.min), dimension.heightRange.max);
            const molangVars = new MolangVariableMap();
            molangVars.setVector3("offset", Vector.sub(loc, spawnAt));
            molangVars.setFloat("size", this.size);
            (global ? dimension : player).spawnParticle("wedit:wireframe_pyramid", spawnAt, molangVars);
        } catch {
            /* pass */
        }
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.thickness = options?.hollowThickness ?? 1;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        const latSize = this.size - relLoc.y - 0.5;
        const local = [relLoc.x, relLoc.z];

        if (genVars.isHollow) {
            const hLatSize = latSize - genVars.thickness;
            if (local[0] > -hLatSize && local[0] < hLatSize && local[1] > -hLatSize && local[1] < hLatSize) {
                return false;
            }
        }

        if (local[0] > -latSize && local[0] < latSize && local[1] > -latSize && local[1] < latSize) {
            return true;
        }

        return false;
    }
}
