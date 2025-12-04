



function getPointOnBezierCurve(points, offset, t) {
  const invT = (1 - t);
  return v2.add(v2.mult(points[offset + 0], invT * invT * invT),
                v2.mult(points[offset + 1], 3 * t * invT * invT),
                v2.mult(points[offset + 2], 3 * invT * t * t),
                v2.mult(points[offset + 3], t * t  *t));
}

function getPointsOnBezierCurve(points, offset, numPoints) {
  const cpoints = [];
  for (let i = 0; i < numPoints; ++i) {
    const t = i / (numPoints - 1);
    cpoints.push(getPointOnBezierCurve(points, offset, t));
  }
  return cpoints;
}

function flatness(points, offset) {
  const p1 = points[offset + 0];
  const p2 = points[offset + 1];
  const p3 = points[offset + 2];
  const p4 = points[offset + 3];
 
  let ux = 3 * p2[0] - 2 * p1[0] - p4[0]; ux *= ux;
  let uy = 3 * p2[1] - 2 * p1[1] - p4[1]; uy *= uy;
  let vx = 3 * p3[0] - 2 * p4[0] - p1[0]; vx *= vx;
  let vy = 3 * p3[1] - 2 * p4[1] - p1[1]; vy *= vy;
 
  if(ux < vx) {
    ux = vx;
  }
 
  if(uy < vy) {
    uy = vy;
  }
 
  return ux + uy;
}


function getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints) {
  const outPoints = newPoints || [];
  if (flatness(points, offset) < tolerance) {
 
    // just add the end points of this curve
    outPoints.push(points[offset + 0]);
    outPoints.push(points[offset + 3]);
 
  } else {
 
    // subdivide
    const t = .5;
    const p1 = points[offset + 0];
    const p2 = points[offset + 1];
    const p3 = points[offset + 2];
    const p4 = points[offset + 3];
 
    const q1 = v2.lerp(p1, p2, t);
    const q2 = v2.lerp(p2, p3, t);
    const q3 = v2.lerp(p3, p4, t);
 
    const r1 = v2.lerp(q1, q2, t);
    const r2 = v2.lerp(q2, q3, t);
 
    const red = v2.lerp(r1, r2, t);
 
    // do 1st half
    getPointsOnBezierCurveWithSplitting([p1, q1, r1, red], 0, tolerance, outPoints);
    // do 2nd half
    getPointsOnBezierCurveWithSplitting([red, r2, q3, p4], 0, tolerance, outPoints);
 
  }
  return outPoints;
}


function simplifyPoints(points, start, end, epsilon, newPoints) {
  const outPoints = newPoints || [];
 
  // find the most distance point from the endpoints
  const s = points[start];
  const e = points[end - 1];
  let maxDistSq = 0;
  let maxNdx = 1;
  for (let i = start + 1; i < end - 1; ++i) {
    const distSq = v2.distanceToSegmentSq(points[i], s, e);
    if (distSq > maxDistSq) {
      maxDistSq = distSq;
      maxNdx = i;
    }
  }
 
  // if that point is too far
  if (Math.sqrt(maxDistSq) > epsilon) {
 
    // split
    simplifyPoints(points, start, maxNdx + 1, epsilon, outPoints);
    simplifyPoints(points, maxNdx, end, epsilon, outPoints);
 
  } else {
 
    // add the 2 end points
    outPoints.push(s, e);
  }
 
  return outPoints;
}


// gets points across all segments
function getPointsOnBezierCurves(points, tolerance) {
  const newPoints = [];
  const numSegments = (points.length - 1) / 3;
  for (let i = 0; i < numSegments; ++i) {
    const offset = i * 3;
    getPointsOnBezierCurveWithSplitting(points, offset, tolerance, newPoints);
  }
  return newPoints;
}



// rotates around Y axis.
function lathePoints(points,
                     startAngle,   // angle to start at (ie 0)
                     endAngle,     // angle to end at (ie Math.PI * 2)
                     numDivisions, // how many quads to make around
                     capStart,     // true to cap the start
                     capEnd) {     // true to cap the end
  const positions = [];
  const texcoords = [];
  const indices = [];
 
  const vOffset = capStart ? 1 : 0;
  const pointsPerColumn = points.length + vOffset + (capEnd ? 1 : 0);
  const quadsDown = pointsPerColumn - 1;
 
  // generate points
  for (let division = 0; division <= numDivisions; ++division) {
    const u = division / numDivisions;
    const angle = lerp(startAngle, endAngle, u) % (Math.PI * 2);
    const mat = m4.yRotation(angle);
    if (capStart) {
      // add point on Y axis at start
      positions.push(0, points[0][1], 0);
      texcoords.push(u, 0);
    }
    points.forEach((p, ndx) => {
      const tp = m4.transformPoint(mat, [...p, 0]);
      positions.push(tp[0], tp[1], tp[2]);
      const v = (ndx + vOffset) / quadsDown;
      texcoords.push(u, v);
    });
    if (capEnd) {
      // add point on Y axis at end
      positions.push(0, points[points.length - 1][1], 0);
      texcoords.push(u, 1);
    }
  }
 
  // generate indices
  for (let division = 0; division < numDivisions; ++division) {
    const column1Offset = division * pointsPerColumn;
    const column2Offset = column1Offset + pointsPerColumn;
    for (let quad = 0; quad < quadsDown; ++quad) {
      indices.push(column1Offset + quad, column2Offset + quad, column1Offset + quad + 1);
      indices.push(column1Offset + quad + 1, column2Offset + quad, column2Offset + quad + 1);
    }
  }
 
  return {
    position: positions,
    texcoord: texcoords,
    indices: indices,
  };
}