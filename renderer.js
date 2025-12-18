/**
 * renderer.js - The Visual Artist
 * Handles p5.js pixel manipulation and visual overlays.
 */
class FluidRenderer {
    constructor(p5Context, n, scale) {
        this.p = p5Context;
        this.N = n;
        this.scale = scale;
        this.buffer = this.p.createImage(n, n);
    }

    render(fluid, params) {
        this.buffer.loadPixels();

        for (let y = 1; y <= this.N; y++) {
            for (let x = 1; x <= this.N; x++) {
                const i = fluid.idx(x, y);
                const d = fluid.density[i];
                const t = fluid.temp[i];
                
                // Maps the grid (x,y) to the 1D pixel array (RGBA)
                const pxIdx = 4 * ((x - 1) + (y - 1) * this.N);

                let r, g, b, a;

                if (params.buoyancy > 0.05) {
                    // Fire Mode
                    [r, g, b, a] = this.getFireColor(d, t);
                } else {
                    // Fluid Mode
                    [r, g, b] = params.fluidColor;
                    a = this.p.constrain(d * 3, 0, 255);
                }

                this.buffer.pixels[pxIdx] = r;
                this.buffer.pixels[pxIdx + 1] = g;
                this.buffer.pixels[pxIdx + 2] = b;
                this.buffer.pixels[pxIdx + 3] = a;
            }
        }

        this.buffer.updatePixels();

        // Apply blending and draw the buffer scaled up to canvas size
        this.p.push();
        if (params.blendMode === 'additive') this.p.blendMode(this.p.ADD);
        else if (params.blendMode === 'multiply') this.p.blendMode(this.p.MULTIPLY);
        
        this.p.image(this.buffer, 0, 0, this.N * this.scale, this.N * this.scale);
        this.p.pop();
    }

    getFireColor(density, temperature) {
        const d = Math.min(density / 300, 1.0);
        const t = Math.min(temperature / 300, 1.0);
        let r, g, b;

        if (t > 0.7) {
            r = 255; g = 255; b = (t - 0.7) / 0.3 * 200;
        } else if (t > 0.4) {
            r = 255; g = 200 + (t - 0.4) / 0.3 * 55; b = 0;
        } else if (t > 0.15) {
            r = 255; g = 50 + (t - 0.15) / 0.25 * 150; b = 0;
        } else {
            r = t * 333; g = t * 100; b = t * 50;
        }

        return [r, g, b, Math.min(d * 255, 255)];
    }

    drawVectors(fluid, params) {
    const step = params.velocityVectorDensity;
    this.p.stroke(255, 150); 
    this.p.strokeWeight(1);

    for (let y = 1; y <= this.N; y += step) {
        for (let x = 1; x <= this.N; x += step) {
            const i = fluid.idx(x, y);
            
            // NEW: Only draw the arrow if there is visible density in this cell
            // This prevents "ghost arrows" in empty space.
            if (fluid.density[i] < 50.0) continue; 

            const vx = fluid.vX[i] * params.velocityVectorScale * this.scale;
            const vy = fluid.vY[i] * params.velocityVectorScale * this.scale;

            if (vx*vx + vy*vy > 0.1) {
                const sx = (x - 1) * this.scale;
                const sy = (y - 1) * this.scale;
                
                this.p.line(sx, sy, sx + vx, sy + vy);
                
                // Keep the arrowheads tiny
                this.p.push();
                this.p.translate(sx + vx, sy + vy);
                this.p.rotate(Math.atan2(vy, vx));
                this.p.line(0, 0, -2, -2);
                this.p.line(0, 0, -2, 2);
                this.p.pop();
            }
        }
    }
}

}