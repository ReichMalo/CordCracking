import { Vanilla21Textures } from './TextureProvider.js'

export class TextureFinder {
  constructor({ formation = [], provider = new Vanilla21Textures(), xMin = -10, xMax = 10, yMin = 0, yMax = 10, zMin = -10, zMax = 10 } = {}) {
    this.formation = formation
    this.provider = provider
    this.xMin = xMin
    this.xMax = xMax
    this.yMin = yMin
    this.yMax = yMax
    this.zMin = zMin
    this.zMax = zMax
  }

  find() {
    const topsAndBottoms = this.formation.filter((info) => !info.isSide)
    const sides = this.formation.filter((info) => info.isSide)
    const matches = []

    for (let x = this.xMin; x <= this.xMax; x += 1) {
      for (let z = this.zMin; z <= this.zMax; z += 1) {
        for (let y = this.yMin; y <= this.yMax; y += 1) {
          const topMatches = topsAndBottoms.every((info) => (
            info.rotation === this.provider.getTexture(x + info.x, y + info.y, z + info.z, 4)
          ))
          if (!topMatches) continue

          const sideMatches = sides.every((info) => (
            info.rotation === this.provider.getTexture(x + info.x, y + info.y, z + info.z, 2)
          ))
          if (sideMatches) matches.push({ x, y, z })
        }
      }
    }

    return matches
  }

  async findAsync({ chunkSize = 500, onProgress = () => {} } = {}) {
    const topsAndBottoms = this.formation.filter((info) => !info.isSide)
    const sides = this.formation.filter((info) => info.isSide)
    const matches = []
    const total = (this.xMax - this.xMin + 1) * (this.yMax - this.yMin + 1) * (this.zMax - this.zMin + 1)
    let checked = 0

    for (let x = this.xMin; x <= this.xMax; x += 1) {
      for (let z = this.zMin; z <= this.zMax; z += 1) {
        for (let y = this.yMin; y <= this.yMax; y += 1) {
          const topMatches = topsAndBottoms.every((info) => (
            info.rotation === this.provider.getTexture(x + info.x, y + info.y, z + info.z, 4)
          ))
          if (topMatches && sides.every((info) => (
            info.rotation === this.provider.getTexture(x + info.x, y + info.y, z + info.z, 2)
          ))) {
            matches.push({ x, y, z })
          }

          checked += 1
          if (checked % chunkSize === 0) {
            onProgress({ checked, total })
            await new Promise((resolve) => setTimeout(resolve, 0))
          }
        }
      }
    }

    onProgress({ checked: total, total })
    return matches
  }
}
