import { MolangVariableMap, Player } from "@minecraft/server";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector, axis } from "@notbeer-api";

export class CylinderShape extends Shape {
    private radii: [number, number] = [0, 0];
    private height: number;
    private axes: [axis, axis, axis];

    protected customHollow = true;

    constructor(height: number, radiusX: number, radiusZ?: number, direction?: Vector) {
        super();
        this.height = height;
        this.radii[0] = radiusX;
        this.radii[1] = radiusZ ?? this.radii[0];

        if ((direction?.x ?? 0) !== 0) {
            this.axes = ["y", "x", "z"];
        } else if ((direction?.z ?? 0) !== 0) {
            this.axes = ["x", "z", "y"];
        } else {
            this.axes = ["x", "y", "z"];
        }
    }

    public getRegion(loc: Vector) {
        const center = new Vector(0, -this.height / 2, 0).ceil();
        const min = center.offset(-this.radii[0], 0, -this.radii[1]);
        const max = center.offset(this.radii[0], this.height - 1, this.radii[1]);
        return <[Vector, Vector]>[loc.offset(min[this.axes[0]], min[this.axes[1]], min[this.axes[2]]), loc.offset(max[this.axes[0]], max[this.axes[1]], max[this.axes[2]])];
    }

    public getYRange(x: number, z: number) {
        // TODO: Support cylinders facing the x and z axes.
        const [lX, lZ] = [x / (this.radii[0] + 0.5), z / (this.radii[1] + 0.5)];
        return lX * lX + lZ * lZ > 1.0 ? null : <[number, number]>[-this.height / 2, this.height - 1 - this.height / 2];
    }

    public draw(loc: Vector, player: Player, global?: boolean): void {
        const dimension = player.dimension;

        // TODO: Support oblique cylinders
        try {
            loc = loc.add(new Vector(0.5, (this.height % 2) * 0.5, 0.5));
            const spawnAt = Vector.add(player.getHeadLocation(), Vector.from(player.getViewDirection()).mul(20));
            spawnAt.y = Math.min(Math.max(spawnAt.y, dimension.heightRange.min), dimension.heightRange.max);
            const molangVars = new MolangVariableMap();
            molangVars.setFloat("radius", this.radii[0] + 0.5);
            molangVars.setVector3("offset", Vector.sub(loc, spawnAt));
            molangVars.setFloat("height", this.height);
            (global ? dimension : player).spawnParticle("wedit:wireframe_cylinder", spawnAt, molangVars);
        } catch {
            /* pass */
        }
    }

    protected prepGeneration(genVars: shapeGenVars, options?: shapeGenOptions) {
        genVars.isHollow = options?.hollow ?? false;
        genVars.radiiOff = this.radii.map((v) => v + 0.5);
        genVars.thickness = options?.hollowThickness ?? 1;
    }

    protected inShape(relLoc: Vector, genVars: shapeGenVars) {
        if (genVars.isHollow) {
            const thickness = genVars.thickness;
            const hLocal = [relLoc[this.axes[0]] / (genVars.radiiOff[0] - thickness), relLoc[this.axes[2]] / (genVars.radiiOff[1] - thickness)];
            if (hLocal[0] * hLocal[0] + hLocal[1] * hLocal[1] < 1.0) return false;
        }

        const local = [relLoc[this.axes[0]] / genVars.radiiOff[0], relLoc[this.axes[2]] / genVars.radiiOff[1]];
        if (local[0] * local[0] + local[1] * local[1] <= 1.0) return true;

        return false;
    }
}
