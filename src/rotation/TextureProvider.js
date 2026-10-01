const LONG_MASK = (1n << 64n) - 1n
const RANDOM_MASK = (1n << 48n) - 1n
const MULTIPLIER = 0x5DEECE66Dn
const UINT32_LIMIT = 0x100000000

function signedLong(value) {
  const unsigned = value & LONG_MASK
  return unsigned >= (1n << 63n) ? unsigned - (1n << 64n) : unsigned
}

function unsignedShift(value, bits) {
  return (value & LONG_MASK) >> BigInt(bits)
}

function signedInt(value) {
  const unsigned = Number(value & 0xffffffffn)
  return unsigned >= 0x80000000 ? unsigned - UINT32_LIMIT : unsigned
}

function javaAbs(value) {
  return value === -0x80000000 ? value : Math.abs(value)
}

function coordinateRandomLong(x, y, z) {
  const xProduct = signedInt(BigInt(x) * 3129871n)
  let value = BigInt(xProduct) ^ BigInt(z) * 116129781n ^ BigInt(y)
  value = value * value * 42317861n + value * 11n
  return signedLong(value)
}

export function coordinateRandom(x, y, z) {
  return coordinateRandomLong(x, y, z) >> 16n
}

export function legacyCoordinateRandom(x, y, z) {
  return signedInt(coordinateRandomLong(x, y, z)) >> 16
}

export class TextureProvider {
  getTexture() {
    throw new Error('TextureProvider.getTexture must be implemented by a provider.')
  }
}

export class Vanilla12Textures extends TextureProvider {
  getTexture(x, y, z, mod) {
    return javaAbs(legacyCoordinateRandom(x, y, z)) % mod
  }
}

export class Vanilla21Textures extends TextureProvider {
  random(seed) {
    seed = (seed ^ MULTIPLIER) & RANDOM_MASK
    return signedInt((seed * 0xBB20B4600A69n + 0x40942DE6BAn) >> 16n)
  }

  getTexture(x, y, z, mod) {
    return javaAbs(this.random(coordinateRandom(x, y, z))) % mod
  }
}

export class VanillaTextures extends TextureProvider {
  getTexture(x, y, z, mod) {
    let seed = (coordinateRandom(x, y, z) ^ MULTIPLIER) & RANDOM_MASK
    seed = (seed * MULTIPLIER + 11n) & RANDOM_MASK
    const next = Number(seed >> 17n)
    return Math.floor((4 * next) / 2147483648) % mod
  }
}

function staffordMix13(value) {
  let result = ((value ^ unsignedShift(value, 30)) * 0xBF58476D1CE4E5B9n) & LONG_MASK
  result = ((result ^ unsignedShift(result, 27)) * 0x94D049BB133111EBn) & LONG_MASK
  return (result ^ unsignedShift(result, 31)) & LONG_MASK
}

function rotateLeft(value, distance) {
  return ((value << BigInt(distance)) | unsignedShift(value, 64 - distance)) & LONG_MASK
}

export class Sodium19Textures extends Vanilla21Textures {
  random(seed) {
    const first = staffordMix13(seed ^ 7640891576956012809n)
    const second = staffordMix13((seed ^ 7640891576956012809n) - 7046029254386353131n)
    return signedInt(rotateLeft((first + second) & LONG_MASK, 17) + first)
  }
}

export class SodiumTextures extends Sodium19Textures {
  random(seed) {
    let value = seed & LONG_MASK
    value ^= unsignedShift(value, 33)
    value = (value * 0xff51afd7ed558ccdn) & LONG_MASK
    value ^= unsignedShift(value, 33)
    value = (value * 0xc4ceb9fe1a85ec53n) & LONG_MASK
    value ^= unsignedShift(value, 33)

    const first = staffordMix13((value + 0x9E3779B97F4A7C15n) & LONG_MASK)
    const second = staffordMix13((value + 2n * 0x9E3779B97F4A7C15n) & LONG_MASK)
    return signedInt(first + second)
  }
}
