function setup() {
    createCanvas(600, 600);
    noStroke();

    size = width / N;
    setupFluid(); // from fluid.js

    dye[IX(50, 50)] = 1;
}

function draw() {
    background(0);

    drawDye();
}

function drawDye() {
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {

            let d = dye[IX(x, y)];

            // Just grayscale for Day 1
            fill(d * 255);
            rect(x * size, y * size, size, size);
        }
    }
}
