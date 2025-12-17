export function parseOBJ(text) {
	const objPositions = [[0, 0, 0]];
	const objTexCoords = [[0, 0]];
	const objNormals = [[0, 0, 0]];

	const positions = [];
	const texCoords = [];
	const normals = [];

	const keywordRE = /(\w*)(?: )*(.*)/;

	function resolveIndex(list, idx) {
		if (!idx) return 0;
		const i = idx >= 0 ? idx : list.length + idx;
		return i;
	}

	const keywords = {
		v(parts) {
			objPositions.push(parts.slice(0, 3).map(Number));
		},
		vt(parts) {
			objTexCoords.push(parts.slice(0, 2).map(Number));
		},
		vn(parts) {
			objNormals.push(parts.slice(0, 3).map(Number));
		},
		f(parts) {
			const verts = parts.map(part =>
				part.split('/').map(val => (val ? parseInt(val, 10) : undefined))
			);
			for (let i = 1; i < verts.length - 1; i++) {
				addVertex(verts[0]);
				addVertex(verts[i]);
				addVertex(verts[i + 1]);
			}
		},
	};

	function addVertex(vert) {
		const [piRaw, tiRaw, niRaw] = vert;
		const pi = resolveIndex(objPositions, piRaw);
		const ti = resolveIndex(objTexCoords, tiRaw);
		const ni = resolveIndex(objNormals, niRaw);

		const position = objPositions[pi];
		const texcoord = objTexCoords[ti] || [0, 0];
		const normal = objNormals[ni] || [0, 1, 0];

		positions.push(...position);
		texCoords.push(...texcoord);
		normals.push(...normal);
	}

	const lines = text.split('\n');
	for (let line of lines) {
		line = line.trim();
		if (!line || line.startsWith('#')) continue;

		const m = keywordRE.exec(line);
		if (!m) continue;

		const [, keyword] = m;
		const parts = line.split(/\s+/).slice(1);
		const handler = keywords[keyword];
		if (!handler) continue;
		handler(parts);
	}

	return {
		positions: new Float32Array(positions),
		texCoords: new Float32Array(texCoords),
		normals: new Float32Array(normals),
		vertexCount: positions.length / 3,
	};
}