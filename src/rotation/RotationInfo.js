export class RotationInfo {
  constructor(x, y, z, rotation, isSide) {
    this.x = x
    this.y = y
    this.z = z
    this.isSide = isSide
    this.rotation = isSide ? rotation % 2 : rotation
  }

  toJavaScript() {
    return `formation.add(new RotationInfo(${this.x}, ${this.y}, ${this.z}, ${this.rotation}, ${this.isSide}));`
  }
}

export function formationFromBlocks(blocks, origin) {
  return blocks
    .map(({ x, y, z, value, isSide = false }) => new RotationInfo(
      x - origin.x,
      y - origin.y,
      z - origin.z,
      value,
      isSide,
    ))
}
