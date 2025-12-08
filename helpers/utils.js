



export function getHeightAt(x, y, seed) {
		// must match grass.vert:getHeight
		const wave =
			0.5 * Math.sin(x * 0.18) *
			Math.cos(y * 0.18);

		const nx = x * 0.12;
		const ny = y * 0.12;
		const n = hash2D(nx, ny, seed);
		const noise = (n - 0.5) * 0.25;

		const height = (wave + noise) * 2.0; // same factor as in your vertex shader
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