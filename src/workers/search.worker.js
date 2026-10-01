import { TextureFinder } from '../rotation/TextureFinder.js'
import { VanillaTextures } from '../rotation/TextureProvider.js'

self.addEventListener('message', async ({ data }) => {
  if (data.type !== 'search') return

  const finder = new TextureFinder({
    ...data.bounds,
    formation: data.formation,
    provider: new VanillaTextures(),
  })
  const matches = await finder.findAsync({
    chunkSize: data.chunkSize,
    onProgress: ({ checked, total }) => {
      self.postMessage({ type: 'progress', checked, total })
    },
  })
  self.postMessage({ type: 'result', matches })
})
