class Fluid {
    constructor(dt, diffusion, viscosity) {
        this.dt = dt;
        this.diff = diffusion;
        this.visc = viscosity;
        
        // --- NEW CONFIGURATION PROPERTIES ---
        this.buoyancy = 0.0; // Upward force strength (0 = none)
        this.cooling = 0.99; // Density retention (1.0 = forever, 0.9 = fades fast)
        
        this.size = (N + 2) * (N + 2);

        // Arrays
        this.s = new Float32Array(this.size);
        this.density = new Float32Array(this.size);
        
        this.Vx = new Float32Array(this.size);
        this.Vy = new Float32Array(this.size);
        
        this.Vx0 = new Float32Array(this.size);
        this.Vy0 = new Float32Array(this.size);
    }

    // --- MAIN SIMULATION LOOP ---
    step() {
        let visc = this.visc;
        let diff = this.diff;
        let dt   = this.dt;
        let Vx   = this.Vx;
        let Vy   = this.Vy;
        let Vx0  = this.Vx0;
        let Vy0  = this.Vy0;
        let s    = this.s;
        let density = this.density;

        // 1. APPLY EXTERNAL FORCES (Buoyancy)
        if (this.buoyancy > 0) {
            this.applyBuoyancy();
        }

        // 2. VELOCITY SOLVER
        diffuse(1, Vx0, Vx, visc, dt);
        diffuse(2, Vy0, Vy, visc, dt);

        project(Vx0, Vy0, Vx, Vy);

        advect(1, Vx, Vx0, Vx0, Vy0, dt);
        advect(2, Vy, Vy0, Vx0, Vy0, dt);

        project(Vx, Vy, Vx0, Vy0);

        // 3. DENSITY SOLVER
        diffuse(0, s, density, diff, dt);
        advect(0, density, s, Vx, Vy, dt);
        
        // 4. APPLY COOLING (Decay)
        this.decay();
    }

    // --- HELPER METHODS ---

    addDensity(x, y, amount) {
        let index = IX(x, y);
        this.density[index] += amount;
    }

    addVelocity(x, y, amountX, amountY) {
        let index = IX(x, y);
        this.Vx[index] += amountX;
        this.Vy[index] += amountY;
    }

    // INTERNAL: Simulates heat rising
    applyBuoyancy() {
        // We iterate through the grid. If a cell has density (heat),
        // we exert an UPWARD force on the velocity.
        // "Up" is Negative Y in computer graphics.
        for (let i = 0; i < this.size; i++) {
            let d = this.density[i];
            if (d > 0) {
                // Force is proportional to density * buoyancyFactor
                this.Vy[i] -= d * this.buoyancy;
            }
        }
    }

    // INTERNAL: Simulates fading
    decay() {
        for (let i = 0; i < this.size; i++) {
            // 1. VELOCITY DAMPING (Air Resistance)
            // This is physically accurate. Air slows things down everywhere.
            // Without this, the wind accelerates to infinity.
            this.Vx[i] *= 0.98; 
            this.Vy[i] *= 0.98;

            // 2. DENSITY DECAY (Subtractive vs Multiplicative)
            let d = this.density[i];
            
            if (d > 0) {
                // If we are in Fire Mode (buoyancy is active), use Subtractive Decay
                // This eats the "tail" of the fire faster than the core.
                if (this.buoyancy > 0) {
                    d -= 1.5; // "Burn" 1.5 units of fuel per frame
                    if (d < 0) d = 0;
                } 
                
                // Also apply a tiny bit of multiplicative fade for smoothness
                d *= this.cooling; 
                
                this.density[i] = d;
            }
        }
    }
}

// --- STANDARD JOS STAM SOLVER FUNCTIONS (Unchanged) ---
// (These remain exactly the same as previous steps)

function IX(x, y) {
    x = constrain(x, 0, N + 1);
    y = constrain(y, 0, N + 1);
    return x + (N + 2) * y;
}

function advect(b, d, d0, velocX, velocY, dt) {
    let i0, i1, j0, j1;
    let dtx = dt * (N - 2);
    let dty = dt * (N - 2);
    let s0, s1, t0, t1;
    let tmp1, tmp2, x, y;
    let Nfloat = N;
    let ifloat, jfloat;
    let i, j;

    for (j = 1, jfloat = 1; j < N - 1; j++, jfloat++) {
        for (i = 1, ifloat = 1; i < N - 1; i++, ifloat++) {
            tmp1 = dtx * velocX[IX(i, j)];
            tmp2 = dty * velocY[IX(i, j)];
            x = ifloat - tmp1;
            y = jfloat - tmp2;

            if (x < 0.5) x = 0.5;
            if (x > Nfloat + 0.5) x = Nfloat + 0.5;
            i0 = Math.floor(x);
            i1 = i0 + 1.0;
            if (y < 0.5) y = 0.5;
            if (y > Nfloat + 0.5) y = Nfloat + 0.5;
            j0 = Math.floor(y);
            j1 = j0 + 1.0;

            s1 = x - i0;
            s0 = 1.0 - s1;
            t1 = y - j0;
            t0 = 1.0 - t1;

            let i0i = parseInt(i0);
            let i1i = parseInt(i1);
            let j0i = parseInt(j0);
            let j1i = parseInt(j1);

            d[IX(i, j)] =
                s0 * (t0 * d0[IX(i0i, j0i)] + t1 * d0[IX(i0i, j1i)]) +
                s1 * (t0 * d0[IX(i1i, j0i)] + t1 * d0[IX(i1i, j1i)]);
        }
    }
    set_bnd(b, d);
}

function project(velocX, velocY, p, div) {
    for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
            div[IX(i, j)] = -0.5 * (
                velocX[IX(i + 1, j)] - velocX[IX(i - 1, j)] +
                velocY[IX(i, j + 1)] - velocY[IX(i, j - 1)]
            ) / N;
            p[IX(i, j)] = 0;
        }
    }
    set_bnd(0, div);
    set_bnd(0, p);
    lin_solve(0, p, div, 1, 6);

    for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
            velocX[IX(i, j)] -= 0.5 * (p[IX(i + 1, j)] - p[IX(i - 1, j)]) * N;
            velocY[IX(i, j)] -= 0.5 * (p[IX(i, j + 1)] - p[IX(i, j - 1)]) * N;
        }
    }
    set_bnd(1, velocX);
    set_bnd(2, velocY);
}

function diffuse(b, x, x0, diff, dt) {
    let a = dt * diff * (N - 2) * (N - 2);
    lin_solve(b, x, x0, a, 1 + 6 * a);
}

function lin_solve(b, x, x0, a, c) {
    let cRecip = 1.0 / c;
    for (let k = 0; k < iter; k++) {
        for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
                x[IX(i, j)] =
                    (x0[IX(i, j)] +
                        a *
                            (x[IX(i + 1, j)] +
                                x[IX(i - 1, j)] +
                                x[IX(i, j + 1)] +
                                x[IX(i, j - 1)])) *
                    cRecip;
            }
        }
        set_bnd(b, x);
    }
}

function set_bnd(b, x) {
    for (let i = 1; i < N - 1; i++) {
        x[IX(i, 0)] = b == 2 ? -x[IX(i, 1)] : x[IX(i, 1)];
        x[IX(i, N - 1)] = b == 2 ? -x[IX(i, N - 2)] : x[IX(i, N - 2)];
    }
    for (let j = 1; j < N - 1; j++) {
        x[IX(0, j)] = b == 1 ? -x[IX(1, j)] : x[IX(1, j)];
        x[IX(N - 1, j)] = b == 1 ? -x[IX(N - 2, j)] : x[IX(N - 2, j)];
    }
    x[IX(0, 0)] = 0.5 * (x[IX(1, 0)] + x[IX(0, 1)]);
    x[IX(0, N - 1)] = 0.5 * (x[IX(1, N - 1)] + x[IX(0, N - 2)]);
    x[IX(N - 1, 0)] = 0.5 * (x[IX(N - 2, 0)] + x[IX(N - 1, 1)]);
    x[IX(N - 1, N - 1)] = 0.5 * (x[IX(N - 2, N - 1)] + x[IX(N - 1, N - 2)]);
}
