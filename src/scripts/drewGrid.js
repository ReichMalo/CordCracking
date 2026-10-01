import * as THREE from 'three';

export function drewGrid(x, y, z, spacing, scene) {
    // Create a grid of lines in 3D space
    const gridMaterial = new THREE.LineBasicMaterial({ color: 0x888888 });
    const gridGeometry = new THREE.BufferGeometry();
    const vertices = [];

    for (let i = 0; i <= x; i++) {
        vertices.push(i * spacing, 0, 0);
        vertices.push(i * spacing, y * spacing, 0);
        for (let j = 0; j <= y; j++) {
            vertices.push(i * spacing, j * spacing, 0);
            vertices.push(i * spacing, j * spacing, z * spacing);
        }

        for (let k = 0; k <= z; k++) {
            vertices.push(i * spacing, 0, k * spacing);
            vertices.push(i * spacing, y * spacing, k * spacing);
        }
    }

    for (let j = 0; j <= y; j++) {
        vertices.push(0, j * spacing, 0);
        vertices.push(x * spacing, j * spacing, 0);

        for (let k = 0; k <= z; k++) {
            vertices.push(0, j * spacing, k * spacing);
            vertices.push(x * spacing, j * spacing, k * spacing);
        }
    }

    for (let k = 0; k <= z; k++) {
        vertices.push(0, 0, k * spacing);
        vertices.push(x * spacing, 0, k * spacing);
    }

    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
    scene.add(grid);
}