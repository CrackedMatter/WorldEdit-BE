import { MolangVariableMap, Player } from "@minecraft/server";
import { Shape, shapeGenOptions, shapeGenVars } from "./base_shape.js";
import { Vector } from "@notbeer-api";

export class SphereShape extends Shape {
    private radii: [number, number, number] = [0, 0, 0];
    private domeDirection?: Vector;

    protected customHollow = true;

    constructor(radiusX: number, radiusY?: number, radiusZ?: number, domeDirection?: Vector) {
        super();
        this.radii[0] = radiusX;
        this.radii[1] = radiusY ?? this.radii[0];
        this.radii[2] = radiusZ ?? this.radii[1];
        this.domeDirection = domeDirection;
    }

    public getRegion(loc: Vector) {
        if (this.domeDirection?.x === 1) {
            return <[Vector, Vector]>[loc.offset(0, -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.x === -1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(0, this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.y === 1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], 0, -this.radii[2]), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.y === -1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], 0, this.radii[2])];
        } else if (this.domeDirection?.z === 1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], 0), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        } else if (this.domeDirection?.z === -1) {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], this.radii[1], 0)];
        } else {
            return <[Vector, Vector]>[loc.offset(-this.radii[0], -this.radii[1], -this.radii[2]), loc.offset(this.radii[0], this.radii[1], this.radii[2])];
        }
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

            if (this.domeDirection) {
                // Dome
                molangVars.setVector3("direction", this.domeDirection);
                molangVars.setFloat("radius", this.radii[0] + 0.5);
                (global ? dimension : player).spawnParticle("wedit:wireframe_dome", spawnAt, molangVars);
            } else if (!(this.radii[0] === this.radii[1] && this.radii[1] === this.radii[2])) {
                // Ellipsoid
                molangVars.setVector3("radii", { x: this.radii[0] + 0.5, y: this.radii[1] + 0.5, z: this.radii[2] + 0.5 });
                (global ? dimension : player).spawnParticle("wedit:wireframe_ellipsoid", spawnAt, molangVars);
            } else {
                // Sphere
                molangVars.setFloat("radius", this.radii[0] + 0.5);
                (global ? dimension : player).spawnParticle("wedit:wireframe_sphere", spawnAt, molangVars);
            }
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
            const hLocal = [relLoc.x / (genVars.radiiOff[0] - thickness), relLoc.y / (genVars.radiiOff[1] - thickness), relLoc.z / (genVars.radiiOff[2] - thickness)];
            if (hLocal[0] * hLocal[0] + hLocal[1] * hLocal[1] + hLocal[2] * hLocal[2] < 1.0) {
                return false;
            }
        }

        const local = [relLoc.x / genVars.radiiOff[0], relLoc.y / genVars.radiiOff[1], relLoc.z / genVars.radiiOff[2]];
        if (local[0] * local[0] + local[1] * local[1] + local[2] * local[2] <= 1.0) {
            return true;
        }

        return false;
    }
}
