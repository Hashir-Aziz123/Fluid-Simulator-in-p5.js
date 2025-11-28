/**
 * Fluid simulation using Jos Stam's stable fluids algorithm.
 * Simulates incompressible fluid flow with density, temperature, and velocity fields.
 */
class Fluid {
    constructor(timeStep, diffusionRate, viscosity) {
        this.timeStep = timeStep;
        this.diffusion = diffusionRate;
        this.viscosity = viscosity;
        
        // Physical properties controlled by UI
        this.buoyancy = 0.0;
        this.coolingRate = 0.99;
        
        this.gridSize = (GRID_SIZE + 2) * (GRID_SIZE + 2);
        
        // Density field (visual representation: smoke/dye/ink)
        this.previousDensity = new Float32Array(this.gridSize);
        this.density = new Float32Array(this.gridSize);
        
        // Temperature field (drives buoyancy forces)
        this.previousTemperature = new Float32Array(this.gridSize);
        this.temperature = new Float32Array(this.gridSize);
        
        // Velocity field (fluid motion)
        this.horizontalVelocity = new Float32Array(this.gridSize);
        this.verticalVelocity = new Float32Array(this.gridSize);
        this.previousHorizontalVelocity = new Float32Array(this.gridSize);
        this.previousVerticalVelocity = new Float32Array(this.gridSize);
    }
    
    /**
     * Advances the simulation by one time step.
     * Order of operations matters for stability.
     */
    step() {
        // 1. Solve temperature diffusion and advection
        this.diffuseField(0, this.previousTemperature, this.temperature, this.diffusion);
        this.advectField(0, this.temperature, this.previousTemperature, 
                        this.horizontalVelocity, this.verticalVelocity);
        
        // 2. Apply buoyancy forces (hot air rises)
        if (this.buoyancy > 0) {
            this.applyBuoyancyForce();
        }
        
        // 3. Solve velocity field (diffusion → projection → advection → projection)
        this.diffuseField(1, this.previousHorizontalVelocity, this.horizontalVelocity, this.viscosity);
        this.diffuseField(2, this.previousVerticalVelocity, this.verticalVelocity, this.viscosity);
        
        this.enforceIncompressibility(
            this.previousHorizontalVelocity, 
            this.previousVerticalVelocity,
            this.horizontalVelocity, 
            this.verticalVelocity
        );
        
        this.advectField(1, this.horizontalVelocity, this.previousHorizontalVelocity,
                        this.previousHorizontalVelocity, this.previousVerticalVelocity);
        this.advectField(2, this.verticalVelocity, this.previousVerticalVelocity,
                        this.previousHorizontalVelocity, this.previousVerticalVelocity);
        
        this.enforceIncompressibility(
            this.horizontalVelocity, 
            this.verticalVelocity,
            this.previousHorizontalVelocity, 
            this.previousVerticalVelocity
        );
        
        // 4. Solve density field
        this.diffuseField(0, this.previousDensity, this.density, this.diffusion);
        this.advectField(0, this.density, this.previousDensity,
                        this.horizontalVelocity, this.verticalVelocity);
        
        // 5. Apply natural decay
        this.applyDecay();
    }
    
    /**
     * Adds density (visual smoke/dye) at a specific grid location.
     */
    addDensity(x, y, amount) {
        const index = getGridIndex(x, y);
        this.density[index] += amount;
    }
    
    /**
     * Adds temperature (heat) at a specific grid location.
     */
    addTemperature(x, y, amount) {
        const index = getGridIndex(x, y);
        this.temperature[index] += amount;
    }
    
    /**
     * Adds velocity (motion) at a specific grid location.
     */
    addVelocity(x, y, horizontalAmount, verticalAmount) {
        const index = getGridIndex(x, y);
        this.horizontalVelocity[index] += horizontalAmount;
        this.verticalVelocity[index] += verticalAmount;
    }
    
    /**
     * Applies upward force proportional to temperature (hot air rises).
     */
    applyBuoyancyForce() {
        for (let i = 0; i < this.gridSize; i++) {
            const heatAmount = this.temperature[i];
            
            if (heatAmount > 0) {
                // Negative Y is upward in screen coordinates
                this.verticalVelocity[i] -= heatAmount * this.buoyancy;
            }
        }
    }
    
    /**
     * Applies natural decay to all fields over time.
     * Velocity dampens, density fades, temperature cools.
     */
    applyDecay() {
        for (let i = 0; i < this.gridSize; i++) {
            // Velocity friction
            this.horizontalVelocity[i] *= 0.99;
            this.verticalVelocity[i] *= 0.99;
            
            // Density fade
            this.density[i] *= 0.995;
            
            // Temperature cooling
            if (this.buoyancy > 0) {
                this.temperature[i] *= this.coolingRate;
            } else {
                this.temperature[i] = 0;
            }
        }
    }
    
    /**
     * Diffuses a field (spreads values to neighbors).
     */
    diffuseField(boundaryType, target, source, diffusionRate) {
        const diffusionFactor = this.timeStep * diffusionRate * (GRID_SIZE - 2) * (GRID_SIZE - 2);
        this.solveLinearSystem(boundaryType, target, source, diffusionFactor, 1 + 6 * diffusionFactor);
    }
    
    /**
     * Advects a field (moves values along velocity field).
     */
    advectField(boundaryType, target, source, velocityX, velocityY) {
        const timeScaleX = this.timeStep * (GRID_SIZE - 2);
        const timeScaleY = this.timeStep * (GRID_SIZE - 2);
        
        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const index = getGridIndex(x, y);
                
                // Trace particle backward in time
                let sourceX = x - timeScaleX * velocityX[index];
                let sourceY = y - timeScaleY * velocityY[index];
                
                // Clamp to valid grid range
                sourceX = constrain(sourceX, 0.5, GRID_SIZE + 0.5);
                sourceY = constrain(sourceY, 0.5, GRID_SIZE + 0.5);
                
                // Bilinear interpolation
                const x0 = Math.floor(sourceX);
                const x1 = x0 + 1;
                const y0 = Math.floor(sourceY);
                const y1 = y0 + 1;
                
                const weightX1 = sourceX - x0;
                const weightX0 = 1.0 - weightX1;
                const weightY1 = sourceY - y0;
                const weightY0 = 1.0 - weightY1;
                
                target[index] = 
                    weightX0 * (weightY0 * source[getGridIndex(x0, y0)] + 
                               weightY1 * source[getGridIndex(x0, y1)]) +
                    weightX1 * (weightY0 * source[getGridIndex(x1, y0)] + 
                               weightY1 * source[getGridIndex(x1, y1)]);
            }
        }
        
        this.setBoundaryConditions(boundaryType, target);
    }
    
    /**
     * Projects velocity field to be divergence-free (incompressible).
     * This is the heart of the stable fluids algorithm.
     */
    enforceIncompressibility(velocityX, velocityY, pressure, divergence) {
        // Compute divergence
        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const index = getGridIndex(x, y);
                
                divergence[index] = -0.5 * (
                    velocityX[getGridIndex(x + 1, y)] - velocityX[getGridIndex(x - 1, y)] +
                    velocityY[getGridIndex(x, y + 1)] - velocityY[getGridIndex(x, y - 1)]
                ) / GRID_SIZE;
                
                pressure[index] = 0;
            }
        }
        
        this.setBoundaryConditions(0, divergence);
        this.setBoundaryConditions(0, pressure);
        this.solveLinearSystem(0, pressure, divergence, 1, 6);
        
        // Subtract pressure gradient from velocity
        for (let y = 1; y < GRID_SIZE - 1; y++) {
            for (let x = 1; x < GRID_SIZE - 1; x++) {
                const index = getGridIndex(x, y);
                
                velocityX[index] -= 0.5 * (
                    pressure[getGridIndex(x + 1, y)] - pressure[getGridIndex(x - 1, y)]
                ) * GRID_SIZE;
                
                velocityY[index] -= 0.5 * (
                    pressure[getGridIndex(x, y + 1)] - pressure[getGridIndex(x, y - 1)]
                ) * GRID_SIZE;
            }
        }
        
        this.setBoundaryConditions(1, velocityX);
        this.setBoundaryConditions(2, velocityY);
    }
    
    /**
     * Solves linear system using Gauss-Seidel relaxation.
     */
    solveLinearSystem(boundaryType, target, source, factorA, factorC) {
        const inverseFactor = 1.0 / factorC;
        
        for (let iteration = 0; iteration < SOLVER_ITERATIONS; iteration++) {
            for (let y = 1; y < GRID_SIZE - 1; y++) {
                for (let x = 1; x < GRID_SIZE - 1; x++) {
                    const index = getGridIndex(x, y);
                    
                    target[index] = (
                        source[index] +
                        factorA * (
                            target[getGridIndex(x + 1, y)] +
                            target[getGridIndex(x - 1, y)] +
                            target[getGridIndex(x, y + 1)] +
                            target[getGridIndex(x, y - 1)]
                        )
                    ) * inverseFactor;
                }
            }
            
            this.setBoundaryConditions(boundaryType, target);
        }
    }
    
    /**
     * Sets boundary conditions for the field.
     * Type 1: horizontal velocity (negate at left/right walls)
     * Type 2: vertical velocity (negate at top/bottom walls)
     * Type 0: scalar field (copy from adjacent cell)
     */
    setBoundaryConditions(boundaryType, field) {
        // Top and bottom edges
        for (let x = 1; x < GRID_SIZE - 1; x++) {
            field[getGridIndex(x, 0)] = 
                boundaryType === 2 ? -field[getGridIndex(x, 1)] : field[getGridIndex(x, 1)];
            field[getGridIndex(x, GRID_SIZE - 1)] = 
                boundaryType === 2 ? -field[getGridIndex(x, GRID_SIZE - 2)] : field[getGridIndex(x, GRID_SIZE - 2)];
        }
        
        // Left and right edges
        for (let y = 1; y < GRID_SIZE - 1; y++) {
            field[getGridIndex(0, y)] = 
                boundaryType === 1 ? -field[getGridIndex(1, y)] : field[getGridIndex(1, y)];
            field[getGridIndex(GRID_SIZE - 1, y)] = 
                boundaryType === 1 ? -field[getGridIndex(GRID_SIZE - 2, y)] : field[getGridIndex(GRID_SIZE - 2, y)];
        }
        
        // Corners (average of adjacent cells)
        field[getGridIndex(0, 0)] = 0.5 * (
            field[getGridIndex(1, 0)] + field[getGridIndex(0, 1)]
        );
        field[getGridIndex(0, GRID_SIZE - 1)] = 0.5 * (
            field[getGridIndex(1, GRID_SIZE - 1)] + field[getGridIndex(0, GRID_SIZE - 2)]
        );
        field[getGridIndex(GRID_SIZE - 1, 0)] = 0.5 * (
            field[getGridIndex(GRID_SIZE - 2, 0)] + field[getGridIndex(GRID_SIZE - 1, 1)]
        );
        field[getGridIndex(GRID_SIZE - 1, GRID_SIZE - 1)] = 0.5 * (
            field[getGridIndex(GRID_SIZE - 2, GRID_SIZE - 1)] + field[getGridIndex(GRID_SIZE - 1, GRID_SIZE - 2)]
        );
    }
}

/**
 * Converts 2D grid coordinates to 1D array index.
 * Grid has padding of 1 cell on each side for boundary conditions.
 */
function getGridIndex(x, y) {
    x = constrain(x, 0, GRID_SIZE + 1);
    y = constrain(y, 0, GRID_SIZE + 1);
    return x + (GRID_SIZE + 2) * y;
}