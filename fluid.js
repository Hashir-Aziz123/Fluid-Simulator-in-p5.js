const N = 100; 
let size;

// Fluid state arrays
let velX, velY;
let dye;

function setupFluid() {
    velX = new Array(N * N).fill(0);
    velY = new Array(N * N).fill(0);
    dye  = new Array(N * N).fill(0);
}

function IX(x, y) {
    return x + y * N;
}
