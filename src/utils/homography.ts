import { Matrix, SingularValueDecomposition, inverse } from 'ml-matrix';

export type Point2D = { x: number; y: number };

/**
 * 透過 4 組匹配點對計算單應性矩陣 (Homography Matrix)
 */
export function calculateHomography(srcPoints: Point2D[], dstPoints: Point2D[]): number[][] {
  if (srcPoints.length < 4 || dstPoints.length < 4) {
    throw new Error("ERR_INSUFFICIENT_CORRESPONDENCES");
  }

  // Isotropic Normalization
  const normalize = (pts: Point2D[]) => {
    let cx = 0, cy = 0;
    pts.forEach(p => { cx += p.x; cy += p.y; });
    cx /= pts.length;
    cy /= pts.length;
    let dist = 0;
    pts.forEach(p => { dist += Math.hypot(p.x - cx, p.y - cy); });
    dist /= pts.length;
    
    // Handle edge case where all points are at the same location
    if (dist === 0) {
      throw new Error("ERR_DEGENERATE_POINT_CONFIGURATION");
    }
    
    const scale = Math.SQRT2 / dist;
    
    const T = Matrix.eye(3);
    T.set(0, 0, scale);
    T.set(1, 1, scale);
    T.set(0, 2, -scale * cx);
    T.set(1, 2, -scale * cy);
    
    const normalizedPts = pts.map(p => ({
      x: (p.x - cx) * scale,
      y: (p.y - cy) * scale
    }));
    return { pts: normalizedPts, T };
  };

  const normSrc = normalize(srcPoints);
  const normDst = normalize(dstPoints);

  const n = srcPoints.length;
  const A = new Matrix(2 * n, 9);

  for (let i = 0; i < n; i++) {
    const { x, y } = normSrc.pts[i];
    const { x: u, y: v } = normDst.pts[i];
    
    A.setRow(2 * i, [x, y, 1, 0, 0, 0, -u * x, -u * y, -u]);
    A.setRow(2 * i + 1, [0, 0, 0, x, y, 1, -v * x, -v * y, -v]);
  }

  const svd = new SingularValueDecomposition(A);
  const V = svd.rightSingularVectors;
  const s = svd.diagonal;
  
  const sMax = s[0];
  const sMin = s[s.length - 1];
  
  if (sMin === 0 || sMax / sMin >= 1e5) {
     if (sMin === 0) {
        throw new Error("ERR_DEGENERATE_POINT_CONFIGURATION");
     }
     throw new Error("ERR_ILL_CONDITIONED_HOMOGRAPHY");
  }

  // 取 V 的最後一個 column (對應最小奇異值)
  const h = V.getColumn(8);
  
  let H = new Matrix(3, 3);
  H.setRow(0, [h[0], h[1], h[2]]);
  H.setRow(1, [h[3], h[4], h[5]]);
  H.setRow(2, [h[6], h[7], h[8]]);
  
  // 反歸一化: H_final = T_dst^-1 * H * T_src
  H = inverse(normDst.T).mmul(H).mmul(normSrc.T);

  // HomographyScaleNormalization
  const h33 = H.get(2, 2);
  if (h33 !== 0) {
     H = H.mul(1 / h33);
  }

  return H.to2DArray();
}
