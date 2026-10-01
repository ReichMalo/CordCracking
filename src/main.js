import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { formationFromBlocks } from './rotation/RotationInfo.js'

const canvas = document.getElementById('gameCanvas')
const workerInput = document.getElementById('workerCount')
workerInput.value = Math.min(Math.max(navigator.hardwareConcurrency || 8, 8), 32)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x1a1a1a)

const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.enablePan = false
controls.maxPolarAngle = Math.PI / 2 - 0.05
controls.target.set(0, 0, 0)

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const blockMeshes = []
const blocks = new Map()
const blockGroup = new THREE.Group()
scene.add(blockGroup)

let gridWidth = 12
let gridDepth = 12
let maxHeight = 8
let selectedValue = 0
let floorMesh
let groundGrid
let axisLabels
let pressPosition

const valueColors = [0x5eead4, 0x60a5fa, 0xfbbf24, 0xfb7185]
const materials = valueColors.map((color) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.72,
  metalness: 0.05,
}))
const blockGeometry = new THREE.BoxGeometry(0.96, 0.96, 0.96)

scene.add(new THREE.HemisphereLight(0xdbeafe, 0x172033, 2.2))
const keyLight = new THREE.DirectionalLight(0xffffff, 2.8)
keyLight.position.set(6, 12, 8)
keyLight.castShadow = true
scene.add(keyLight)

function resizeRenderer() {
  const size = Math.min(window.innerWidth * 0.72, window.innerHeight * 0.72, 820)
  camera.aspect = 1
  camera.updateProjectionMatrix()
  renderer.setSize(Math.max(size, 320), Math.max(size, 320), false)
}

function gridKey(x, y, z) {
  return `${x},${y},${z}`
}

function createValueLabel(value) {
  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 128
  labelCanvas.height = 128
  const context = labelCanvas.getContext('2d')
  context.font = 'bold 92px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.lineWidth = 8
  context.strokeStyle = '#111827'
  context.strokeText(value, 64, 67)
  context.fillStyle = '#ffffff'
  context.fillText(value, 64, 67)

  const texture = new THREE.CanvasTexture(labelCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.72),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide }),
  )
  label.position.set(0, 0.49, 0)
  label.rotation.x = -Math.PI / 2
  return label
}

function createAxisLabel(text) {
  const labelCanvas = document.createElement('canvas')
  labelCanvas.width = 256
  labelCanvas.height = 128
  const context = labelCanvas.getContext('2d')
  context.fillStyle = '#5eead4'
  context.font = 'bold 96px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 128, 64)

  const texture = new THREE.CanvasTexture(labelCanvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }))
  sprite.scale.set(0.9, 0.45, 1)
  return sprite
}

function updateStatus(message) {
  document.getElementById('statusText').textContent = message
  document.getElementById('blockCount').textContent = `${blocks.size} bloc${blocks.size > 1 ? 's' : ''}`
}

function placedBlocks() {
  return blockMeshes.map((mesh) => ({
    ...mesh.userData.grid,
    value: mesh.userData.value,
    isSide: mesh.userData.isSide,
  }))
}

function createFormation() {
  const currentBlocks = placedBlocks()
  const output = document.getElementById('formationOutput')
  if (currentBlocks.length < 1) {
    output.textContent = '// Placez au moins un bloc pour créer une formation.'
    updateStatus('Il faut au moins un bloc pour créer une formation.')
    return []
  }

  const origin = currentBlocks[0]
  const formation = formationFromBlocks(currentBlocks, origin)
  output.textContent = [
    `// Origine : (${origin.x}, ${origin.y}, ${origin.z})`,
    ...formation.map((info) => info.toJavaScript()),
  ].join('\n')
  updateStatus(`${formation.length} contrainte${formation.length > 1 ? 's' : ''} générée${formation.length > 1 ? 's' : ''}.`)
  return formation
}

function searchWithWorkers(formation, bounds, requestedWorkerCount, onProgress) {
  const xCount = bounds.xMax - bounds.xMin + 1
  const workerCount = Math.min(requestedWorkerCount, xCount)
  const totalSearch = xCount * (bounds.yMax - bounds.yMin + 1) * (bounds.zMax - bounds.zMin + 1)
  const progressByWorker = Array.from({ length: workerCount }, () => ({ checked: 0, total: 0 }))

  return new Promise((resolve, reject) => {
    const workers = []
    const results = Array.from({ length: workerCount }, () => [])
    let completed = 0

    for (let index = 0; index < workerCount; index += 1) {
      const start = bounds.xMin + Math.floor((index * xCount) / workerCount)
      const end = bounds.xMin + Math.floor(((index + 1) * xCount) / workerCount) - 1
      const worker = new Worker(new URL('./workers/search.worker.js', import.meta.url), { type: 'module' })
      workers.push(worker)
      worker.addEventListener('message', ({ data }) => {
        if (data.type === 'progress') {
          progressByWorker[index] = data
          const checked = progressByWorker.reduce((sum, progress) => sum + progress.checked, 0)
          onProgress({ checked, total: totalSearch })
        }
        if (data.type === 'result') {
          results[index] = data.matches
          completed += 1
          worker.terminate()
          if (completed === workerCount) resolve(results.flat())
        }
      })
      worker.addEventListener('error', (error) => {
        workers.forEach((activeWorker) => activeWorker.terminate())
        reject(error)
      })
      worker.postMessage({
        type: 'search',
        formation,
        bounds: { ...bounds, xMin: start, xMax: end },
        chunkSize: 500,
      })
    }
  })
}

async function searchFormation() {
  const formation = createFormation()
  if (!formation.length) return

  const bounds = ['xMin', 'xMax', 'yMin', 'yMax', 'zMin', 'zMax'].reduce((values, name) => {
    values[name] = Number(document.getElementById(name).value)
    return values
  }, {})
  if (Object.values(bounds).some((value) => !Number.isInteger(value))) {
    updateStatus('Les six bornes doivent être des nombres entiers.')
    return
  }
  if (bounds.xMin > bounds.xMax || bounds.yMin > bounds.yMax || bounds.zMin > bounds.zMax) {
    updateStatus('Chaque borne minimale doit être inférieure ou égale à sa borne maximale.')
    return
  }

  const requestedWorkerCount = Number(document.getElementById('workerCount').value)
  if (!Number.isInteger(requestedWorkerCount) || requestedWorkerCount < 1 || requestedWorkerCount > 32) {
    updateStatus('Le nombre de Workers doit être compris entre 1 et 32.')
    return
  }

  const searchButton = document.getElementById('searchFormation')
  const progress = document.getElementById('searchProgress')
  const progressLabel = document.getElementById('searchProgressLabel')
  searchButton.disabled = true
  progress.hidden = false
  progress.value = 0

  try {
    const matches = await searchWithWorkers(formation, bounds, requestedWorkerCount, ({ checked, total }) => {
      const percent = total ? Math.round((checked / total) * 100) : 100
      progress.value = percent
      progressLabel.textContent = `${percent}% (${checked.toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')})`
      updateStatus(`Recherche en cours... ${percent}%`)
    })
    const output = document.getElementById('formationOutput')
    output.textContent += `\n\n// Positions trouvees : ${matches.length}\n${matches.map(({ x, y, z }) => `X: ${x} Y: ${y} Z: ${z}`).join('\n')}`
    updateStatus(`${matches.length} position${matches.length > 1 ? 's' : ''} trouvée${matches.length > 1 ? 's' : ''}.`)
  } finally {
    searchButton.disabled = false
  }
}

function createBlock(x, y, z, value = selectedValue) {
  if (x < 0 || x >= gridWidth || z < 0 || z >= gridDepth || y < 0 || y >= maxHeight) return false
  const key = gridKey(x, y, z)
  if (blocks.has(key)) return false

  const mesh = new THREE.Mesh(blockGeometry, materials[value])
  mesh.position.set(x - gridWidth / 2 + 0.5, y + 0.5, z - gridDepth / 2 + 0.5)
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.grid = { x, y, z }
  mesh.userData.value = value
  mesh.userData.isSide = false
  mesh.add(createValueLabel(value))
  blockGroup.add(mesh)
  blockMeshes.push(mesh)
  blocks.set(key, mesh)
  return true
}

function removeBlock(mesh) {
  const { x, y, z } = mesh.userData.grid
  blocks.delete(gridKey(x, y, z))
  blockGroup.remove(mesh)
  const index = blockMeshes.indexOf(mesh)
  if (index >= 0) blockMeshes.splice(index, 1)
  mesh.children[0].material.map.dispose()
  mesh.children[0].material.dispose()
}

function rebuildWorkspace() {
  for (const mesh of [...blockMeshes]) removeBlock(mesh)
  if (floorMesh) scene.remove(floorMesh)
  if (groundGrid) scene.remove(groundGrid)
  if (axisLabels) {
    axisLabels.children.forEach((label) => {
      label.material.map.dispose()
      label.material.dispose()
    })
    scene.remove(axisLabels)
  }

  const floorSize = Math.max(gridWidth, gridDepth)
  floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(gridWidth, gridDepth),
    new THREE.MeshStandardMaterial({ color: 0x26313b, roughness: 0.95 }),
  )
  floorMesh.rotation.x = -Math.PI / 2
  floorMesh.receiveShadow = true
  floorMesh.userData.isFloor = true
  scene.add(floorMesh)

  groundGrid = new THREE.GridHelper(floorSize, floorSize, 0x64748b, 0x334155)
  groundGrid.position.y = 0.006
  groundGrid.material.transparent = true
  groundGrid.material.opacity = 0.72
  scene.add(groundGrid)

  axisLabels = new THREE.Group()
  const axisOffset = 0.75
  const labels = [
    { text: '+X', position: [gridWidth / 2 + axisOffset, 0.08, 0] },
    { text: '-X', position: [-gridWidth / 2 - axisOffset, 0.08, 0] },
    { text: '+Y', position: [0, 0.08, gridDepth / 2 + axisOffset] },
    { text: '-Y', position: [0, 0.08, -gridDepth / 2 - axisOffset] },
  ]
  labels.forEach(({ text, position }) => {
    const label = createAxisLabel(text)
    label.position.set(...position)
    axisLabels.add(label)
  })
  scene.add(axisLabels)

  controls.target.set(0, 0, 0)
  camera.position.set(Math.max(gridWidth, gridDepth) * 0.9, maxHeight * 0.8, Math.max(gridWidth, gridDepth) * 0.9)
  controls.update()
  updateStatus('Cliquez sur le sol ou une face de bloc pour construire.')
}

function pointerCoordinates(event) {
  const rectangle = canvas.getBoundingClientRect()
  pointer.x = ((event.clientX - rectangle.left) / rectangle.width) * 2 - 1
  pointer.y = -((event.clientY - rectangle.top) / rectangle.height) * 2 + 1
}

function placeFromPointer(event) {
  if (Math.hypot(event.clientX - pressPosition.x, event.clientY - pressPosition.y) > 6) return
  pointerCoordinates(event)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(blockMeshes, false)[0]
  let target

  if (hit) {
    const { x, y, z } = hit.object.userData.grid
    const normal = hit.face.normal
    target = { x: x + Math.round(normal.x), y: y + Math.round(normal.y), z: z + Math.round(normal.z) }
  } else {
    const floorHit = raycaster.intersectObject(floorMesh)[0]
    if (!floorHit) return
    target = {
      x: Math.floor(floorHit.point.x + gridWidth / 2),
      y: 0,
      z: Math.floor(floorHit.point.z + gridDepth / 2),
    }
  }

  if (createBlock(target.x, target.y, target.z)) {
    updateStatus(`Bloc posé avec la valeur ${selectedValue}.`)
  } else {
    updateStatus('Cette position est déjà occupée ou hors limites.')
  }
}

function removeFromPointer(event) {
  pointerCoordinates(event)
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(blockMeshes, false)[0]
  if (hit) {
    removeBlock(hit.object)
    updateStatus('Bloc retiré.')
  }
}

canvas.addEventListener('pointerdown', (event) => {
  pressPosition = { x: event.clientX, y: event.clientY }
})
canvas.addEventListener('pointerup', (event) => {
  if (event.button === 0 && pressPosition) placeFromPointer(event)
  pressPosition = null
})
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault()
  removeFromPointer(event)
})

document.querySelectorAll('[data-value]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedValue = Number(button.dataset.value)
    document.querySelectorAll('[data-value]').forEach((item) => item.classList.remove('is-selected'))
    button.classList.add('is-selected')
    updateStatus(`Valeur ${selectedValue} sélectionnée.`)
  })
})

document.getElementById('applySettings').addEventListener('click', () => {
  gridWidth = Math.max(4, Math.min(24, Number(document.getElementById('gridWidth').value) || 12))
  gridDepth = Math.max(4, Math.min(24, Number(document.getElementById('gridDepth').value) || 12))
  maxHeight = Math.max(1, Math.min(16, Number(document.getElementById('maxHeight').value) || 8))
  rebuildWorkspace()
})
document.getElementById('generateFormation').addEventListener('click', createFormation)
document.getElementById('searchFormation').addEventListener('click', searchFormation)

window.addEventListener('resize', resizeRenderer)
resizeRenderer()
rebuildWorkspace()

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

animate()
