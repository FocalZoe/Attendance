/**
 * 空間幾何透視與座標轉換型別模型
 * 依循 .agents/domain/SpatialGeometry_Perspective/ 規範
 */

export interface Point2D {
  x: number
  y: number
}

export interface PerspectiveQuad {
  topLeft: Point2D
  topRight: Point2D
  bottomRight: Point2D
  bottomLeft: Point2D
}

export interface NormalizedBBox {
  xMin: number
  yMin: number
  width: number
  height: number
}

/**
 * 檢查點是否落在多邊形四邊形內部（用於座位幾何命中判定）
 */
export function isPointInQuad(point: Point2D, quad: PerspectiveQuad): boolean {
  const vertices = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft]
  let inside = false

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x
    const yi = vertices[i].y
    const xj = vertices[j].x
    const yj = vertices[j].y

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }

  return inside
}
