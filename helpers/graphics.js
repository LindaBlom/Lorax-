function compileShader(gl, source, type) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		console.error('Shader compile error:', gl.getShaderInfoLog(shader));
		gl.deleteShader(shader);
		return null;
	}
	return shader;
}

export function createShaderProgram(gl, vertSrc, fragSrc, uniformNames = []) {
	const program = gl.createProgram();
	const vertShader = compileShader(gl, vertSrc, gl.VERTEX_SHADER);
	const fragShader = compileShader(gl, fragSrc, gl.FRAGMENT_SHADER);
	gl.attachShader(program, vertShader);
	gl.attachShader(program, fragShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		console.error('Program link error:', gl.getProgramInfoLog(program));
		return null;
	}
	const uniforms = {};
	uniformNames.forEach(name => {
		uniforms[name] = gl.getUniformLocation(program, name);
	});
	return {program, uniforms};
}

export function createBuffer(gl, data, location, size, stride = 0, offset = 0) {
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
	gl.enableVertexAttribArray(location);
	return buffer;
}

export function loadTexture(gl, src, params = {}) {
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, params.wrapS || gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, params.wrapT || gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, params.minFilter || gl.LINEAR_MIPMAP_LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, params.magFilter || gl.LINEAR);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 0, 255, 255]));
	const img = new Image();
	img.onload = () => {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
		if (params.minFilter !== gl.LINEAR) gl.generateMipmap(gl.TEXTURE_2D);
	};
	img.src = src;
	return texture;
}

export function drawFloorTiles(gl, uniforms, modelMatrix, tileSize, gridRadius, floorIndices, mat4) {
	for (let gy = -gridRadius; gy <= gridRadius; gy++) {
		for (let gx = -gridRadius; gx <= gridRadius; gx++) {
			const tileModel = mat4.clone(modelMatrix);
			mat4.translate(tileModel, tileModel, [gx * tileSize, gy * tileSize, 0.0]);
			gl.uniformMatrix4fv(uniforms.uModel, false, tileModel);

			gl.drawElements(gl.TRIANGLES, floorIndices.length, gl.UNSIGNED_SHORT, 0);
		}
	}
}

export function buildFloorGeometry(segments, size) {
	const halfSize = size * 0.5;
	const verts = [];
	const inds = [];

	// build (segments+1) x (segments+1) vertices
	for (let y = 0; y <= segments; y++) {
		const tY = y / segments;
		const py = -halfSize + tY * size;

		for (let x = 0; x <= segments; x++) {
			const tX = x / segments;
			const px = -halfSize + tX * size;

			verts.push(
				px, py, 0,          // position
				tX * 5.0, tY * 5.0  // texcoords
			);
		}
	}

	// build indices for two triangles per cell
	const stride = segments + 1;
	for (let y = 0; y < segments; y++) {
		for (let x = 0; x < segments; x++) {
			const i0 = y * stride + x;
			const i1 = i0 + 1;
			const i2 = i0 + stride;
			const i3 = i2 + 1;

			// triangle 1 & 2
			inds.push(i0, i1, i2, i1, i3, i2);
		}
	}

	return { verts, inds };
}

export function buildSunGeometry() {
	const vertices = new Float32Array([
		// x,  y,  z,   u, v
		-1, -1,  0,   0, 0,
		1, -1,  0,   1, 0,
		1,  1,  0,   1, 1,
		-1,  1,  0,   0, 1,
	]);

	const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

	return { vertices, indices };
}