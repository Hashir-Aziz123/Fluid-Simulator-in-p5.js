/**
 * fluid.js - The Physics Engine
 * Core logic for Jos Stam's Stable Fluids.
 * Self-contained: No global dependencies.
 */
class Fluid {
    constructor(n, dt, diffusion, viscosity) {
        this.N = n; // The grid resolution (inner cells)
        this.dt = dt;
        this.diffusion = diffusion;
        this.viscosity = viscosity;

        // Total size including 1-cell padding on all sides
        this.size = (n + 2) * (n + 2);

        // Current Fields
        this.density = new Float32Array(this.size);
        this.temp = new Float32Array(this.size);
        this.vX = new Float32Array(this.size);
        this.vY = new Float32Array(this.size);

        // Previous Fields (Back-buffers)
        this.densityOld = new Float32Array(this.size);
        this.tempOld = new Float32Array(this.size);
        this.vXOld = new Float32Array(this.size);
        this.vYOld = new Float32Array(this.size);

        this.curl = new Float32Array(this.size);
    }

    /**
     * Map 2D coordinates to 1D array index
     */
    idx(x, y) {
        // Clamp to prevent out-of-bounds memory access
        const nx = Math.max(0, Math.min(x, this.N + 1));
        const ny = Math.max(0, Math.min(y, this.N + 1));
        return nx + (this.N + 2) * ny;
    }

    /**
     * Main simulation loop
     * @param {Object} p - Parameters: buoyancy, cooling, damping, fade, vorticity, iterations
     */
    step(p) {
        // 1. Velocity Field Solver
        // Apply External Forces
        if (p.buoyancy > 0) {
            for (let i = 0; i < this.size; i++) {
                this.vY[i] -= this.temp[i] * p.buoyancy; // Upward push (-Y)
            }
        }

        if (p.vorticity > 0) this.applyVorticityConfinement(p.vorticity);

        // Diffuse and Project
        this.diffuse(1, this.vXOld, this.vX, this.viscosity, p.iterations);
        this.diffuse(2, this.vYOld, this.vY, this.viscosity, p.iterations);
        this.project(this.vXOld, this.vYOld, this.vX, this.vY, p.iterations);

        // Advect and Project again for stability
        this.advect(1, this.vX, this.vXOld, this.vXOld, this.vYOld);
        this.advect(2, this.vY, this.vYOld, this.vXOld, this.vYOld);
        this.project(this.vX, this.vY, this.vXOld, this.vYOld, p.iterations);

        // 2. Scalar Fields Solver (Density and Temperature)
        this.diffuse(0, this.densityOld, this.density, this.diffusion, p.iterations);
        this.advect(0, this.density, this.densityOld, this.vX, this.vY);

        this.diffuse(0, this.tempOld, this.temp, this.diffusion, p.iterations);
        this.advect(0, this.temp, this.tempOld, this.vX, this.vY);

        // 3. Natural Decay & Cleanup
        for (let i = 0; i < this.size; i++) {
            this.vX[i] *= p.damping;
            this.vY[i] *= p.damping;
            this.density[i] *= p.fade;
            // Only cool down if fire mode is active, else zero out heat
            this.temp[i] = (p.buoyancy > 0) ? this.temp[i] * p.cooling : 0;
        }
    }

    // --- PHYSICS KERNELS ---

    diffuse(b, x, x0, diff, iter) {
        const a = this.dt * diff * this.N * this.N;
        this.solveLinearSystem(b, x, x0, a, 1 + 4 * a, iter);
    }

    advect(b, d, d0, vX, vY) {
        const dt0 = this.dt * this.N;
        for (let j = 1; j <= this.N; j++) {
            for (let i = 1; i <= this.N; i++) {
                let x = i - dt0 * vX[this.idx(i, j)];
                let y = j - dt0 * vY[this.idx(i, j)];

                // Clamp to grid boundaries
                if (x < 0.5) x = 0.5; if (x > this.N + 0.5) x = this.N + 0.5;
                if (y < 0.5) y = 0.5; if (y > this.N + 0.5) y = this.N + 0.5;

                const i0 = Math.floor(x); const i1 = i0 + 1;
                const j0 = Math.floor(y); const j1 = j0 + 1;

                const s1 = x - i0; const s0 = 1 - s1;
                const t1 = y - j0; const t0 = 1 - t1;

                d[this.idx(i, j)] = s0 * (t0 * d0[this.idx(i0, j0)] + t1 * d0[this.idx(i0, j1)]) +
                                    s1 * (t0 * d0[this.idx(i1, j0)] + t1 * d0[this.idx(i1, j1)]);
            }
        }
        this.setBoundary(b, d);
    }

    project(vX, vY, p, div, iter) {
        for (let j = 1; j <= this.N; j++) {
            for (let i = 1; i <= this.N; i++) {
                div[this.idx(i, j)] = -0.5 * (
                    vX[this.idx(i + 1, j)] - vX[this.idx(i - 1, j)] +
                    vY[this.idx(i, j + 1)] - vY[this.idx(i, j - 1)]
                ) / this.N;
                p[this.idx(i, j)] = 0;
            }
        }
        this.setBoundary(0, div);
        this.setBoundary(0, p);
        this.solveLinearSystem(0, p, div, 1, 4, iter);

        for (let j = 1; j <= this.N; j++) {
            for (let i = 1; i <= this.N; i++) {
                vX[this.idx(i, j)] -= 0.5 * this.N * (p[this.idx(i + 1, j)] - p[this.idx(i - 1, j)]);
                vY[this.idx(i, j)] -= 0.5 * this.N * (p[this.idx(i, j + 1)] - p[this.idx(i, j - 1)]);
            }
        }
        this.setBoundary(1, vX);
        this.setBoundary(2, vY);
    }

    solveLinearSystem(b, x, x0, a, c, iter) {
        const invC = 1.0 / c;
        for (let k = 0; k < iter; k++) {
            for (let j = 1; j <= this.N; j++) {
                for (let i = 1; i <= this.N; i++) {
                    x[this.idx(i, j)] = (x0[this.idx(i, j)] + a * (
                        x[this.idx(i + 1, j)] + x[this.idx(i - 1, j)] +
                        x[this.idx(i, j + 1)] + x[this.idx(i, j - 1)]
                    )) * invC;
                }
            }
            this.setBoundary(b, x);
        }
    }

    applyVorticityConfinement(strength) {
        // Calculate curl at each cell
        for (let j = 1; j <= this.N; j++) {
            for (let i = 1; i <= this.N; i++) {
                const dw_dy = (this.vX[this.idx(i, j + 1)] - this.vX[this.idx(i, j - 1)]) * 0.5;
                const du_dx = (this.vY[this.idx(i + 1, j)] - this.vY[this.idx(i - 1, j)]) * 0.5;
                this.curl[this.idx(i, j)] = du_dx - dw_dy;
            }
        }

        // Apply force based on gradient of absolute curl
        for (let j = 2; j < this.N; j++) {
            for (let i = 2; i < this.N; i++) {
                const dx = (Math.abs(this.curl[this.idx(i + 1, j)]) - Math.abs(this.curl[this.idx(i - 1, j)])) * 0.5;
                const dy = (Math.abs(this.curl[this.idx(i, j + 1)]) - Math.abs(this.curl[this.idx(i, j - 1)])) * 0.5;

                const length = Math.sqrt(dx * dx + dy * dy) + 1e-5;
                const nx = dx / length;
                const ny = dy / length;

                const c = this.curl[this.idx(i, j)];

                this.vX[this.idx(i, j)] += ny * c * strength * this.dt;
                this.vY[this.idx(i, j)] -= nx * c * strength * this.dt;
            }
        }
    }

    setBoundary(b, x) {
        for (let i = 1; i <= this.N; i++) {
            x[this.idx(0, i)] = b === 1 ? -x[this.idx(1, i)] : x[this.idx(1, i)];
            x[this.idx(this.N + 1, i)] = b === 1 ? -x[this.idx(this.N, i)] : x[this.idx(this.N, i)];
            x[this.idx(i, 0)] = b === 2 ? -x[this.idx(i, 1)] : x[this.idx(i, 1)];
            x[this.idx(i, this.N + 1)] = b === 2 ? -x[this.idx(i, this.N)] : x[this.idx(i, this.N)];
        }
        // Corners
        x[this.idx(0, 0)] = 0.5 * (x[this.idx(1, 0)] + x[this.idx(0, 1)]);
        x[this.idx(0, this.N + 1)] = 0.5 * (x[this.idx(1, this.N + 1)] + x[this.idx(0, this.N)]);
        x[this.idx(this.N + 1, 0)] = 0.5 * (x[this.idx(this.N, 0)] + x[this.idx(this.N + 1, 1)]);
        x[this.idx(this.N + 1, this.N + 1)] = 0.5 * (x[this.idx(this.N, this.N + 1)] + x[this.idx(this.N + 1, this.N)]);
    }

    // --- EXTERNAL API ---

    addDensity(x, y, amount) {
        this.density[this.idx(x, y)] += amount;
    }

    addTemperature(x, y, amount) {
        this.temp[this.idx(x, y)] += amount;
    }

    addVelocity(x, y, vx, vy) {
        const i = this.idx(x, y);
        this.vX[i] += vx;
        this.vY[i] += vy;
    }
}