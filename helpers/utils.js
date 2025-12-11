



export function getHeightAt(x, y, seed) {
		// must match grass.vert:getHeight
		const wave =
			0.5 * Math.sin(x * 0.18) *
			Math.cos(y * 0.18);

		const nx = x * 0.12;
		const ny = y * 0.12;
		const n = hash2D(nx, ny, seed);
		const noise = (n - 0.5) * 0.25;

		const height = (wave + noise) * 3.0; // same factor as in your vertex shader
		return height;
	}

function hash2D(x, y, seed) {
	// same as GLSL hash(vec2) using dot + sin + fract
	const p1 = x * 127.1 + y * 311.7;
	const p2 = x * 269.5 + y * 183.3;
	const v  = p1 + p2 + seed;
	const s = Math.sin(v) * 43758.5453123;
	return s - Math.floor(s); // fract
}

export function applyGroundCollision(cameraPos, verticalVelocity, seed) {
	const ground = getHeightAt(cameraPos[0], cameraPos[1], seed);
	const eyeHeight = 2.0; // how high above ground the "head" should be
	const minZ = ground + eyeHeight;

	if (cameraPos[2] < minZ) {
		cameraPos[2] = minZ;
		verticalVelocity = 0; // reset 
	}
	return verticalVelocity;
}

export function applyWorldBoundsCollision(cameraPos, WORLD_RADIUS) {
	const x = cameraPos[0];
	const y = cameraPos[1];

	const distSq   = x * x + y * y;
	const maxDist  = WORLD_RADIUS  - 1.0;
	const maxDistSq = maxDist * maxDist;

	if (distSq > maxDistSq) {
		const dist = Math.sqrt(distSq);
		if (dist > 0.0001) {
			const scale = maxDist / dist;
			cameraPos[0] = x * scale;
			cameraPos[1] = y * scale;
		}
	}
}

export function pushOutFromCircle(cameraPos, cx, cy, radius) {
	const dx = cameraPos[0] - cx;
	const dy = cameraPos[1] - cy;

	let distSq = dx * dx + dy * dy;

	// Already outside or exactly on the edge → nothing to do
	if (distSq >= radius * radius) {
		return;
	}

	// If we are *exactly* at the center, pick a safe position on the edge
	if (distSq < 1e-8) {
		// Arbitrarily push to the right (you can pick any direction)
		cameraPos[0] = cx + radius;
		cameraPos[1] = cy;
		return;
	}

	const dist = Math.sqrt(distSq);
	const overlap = radius - dist;

	const nx = dx / dist;
	const ny = dy / dist;

	cameraPos[0] += nx * overlap;
	cameraPos[1] += ny * overlap;
}

export function applyTreeCollision(cameraPos, treePositions, seed) {
	for (const [xCoord, yCoord] of treePositions) {
		// --- Stem (trunk) collision ---
		const stemRadius = 1.5; // tweak as needed

		const ground = getHeightAt(xCoord, yCoord, seed);
		const stemCenterY = yCoord + 11;
		const stemCenterZ = ground + 15;     // SAME as your translation z

		if (cameraPos[2] < stemCenterZ) {
			pushOutFromCircle(cameraPos, xCoord, stemCenterY, stemRadius);
		}
	}
}