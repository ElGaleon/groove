// @ts-nocheck — scena Three.js (r128) dello scaffale, portata dal prototipo HTML
import * as THREE from 'three'
import gsap from 'gsap'

export type ShelfOptions = {
  onSelect: (i: number | null) => void
  onReady: (ready: boolean) => void
  onCursor: (pointer: boolean) => void
  onPills: (p: { x: number; flipY: number; openY: number }) => void
  onHover: (hover: { i: number; x: number; y: number } | null) => void
}

gsap.ticker.lagSmoothing(0)
const FOV = 26
const DX = 1.17,
  ROW_DY = 1.38,
  PLANK_W = 6.25,
  PLANK_D = 0.46
const rows = [0.62, 0.62 - ROW_DY]

function tex(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.encoding = THREE.sRGBEncoding
  t.anisotropy = 8
  return t
}

type ShelfSource = {
  count: number
  front: (i: number) => HTMLCanvasElement
  back: (i: number) => HTMLCanvasElement
}

export function createShelf(host: HTMLElement, opts: ShelfOptions, source: ShelfSource) {
  const mkCanvas = (z: number) => {
    const c = document.createElement('canvas')
    c.style.cssText = `position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:${z}`
    host.appendChild(c)
    return c
  }
  const cBg = mkCanvas(0),
    cFg = mkCanvas(2)
  cBg.style.transition = 'filter .7s cubic-bezier(.3,.7,.2,1), opacity .7s'

  const mkRenderer = (canvas: HTMLCanvasElement, shadows: boolean) => {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    r.setPixelRatio(Math.min(devicePixelRatio, 2))
    r.outputEncoding = THREE.sRGBEncoding
    r.setClearColor(0, 0)
    if (shadows) {
      r.shadowMap.enabled = true
      r.shadowMap.type = THREE.VSMShadowMap
    }
    return r
  }
  const rBg = mkRenderer(cBg, true),
    rFg = mkRenderer(cFg, false)
  const camera = new THREE.PerspectiveCamera(FOV, 1.6, 0.1, 100)
  const sceneBg = new THREE.Scene(),
    sceneFg = new THREE.Scene()

  function studioEnv(renderer) {
    const s = new THREE.Scene()
    s.background = new THREE.Color(0x0c0c10)
    const box = (w, h, x, y, z, i) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide }),
      )
      m.position.set(x, y, z)
      m.lookAt(0, 0, 0)
      s.add(m)
    }
    box(9, 6, -8, 8, 10, 7)
    box(2, 12, 11, 1, 7, 4)
    box(14, 3, 1, 10, -3, 3)
    const pm = new THREE.PMREMGenerator(renderer)
    const t = pm.fromScene(s, 0.02).texture
    pm.dispose()
    return t
  }
  sceneBg.environment = studioEnv(rBg)
  sceneFg.environment = studioEnv(rFg)

  sceneBg.add(new THREE.HemisphereLight(0xffffff, 0xa9a9b4, 0.42))
  const sun = new THREE.DirectionalLight(0xfff3e2, 0.85)
  sun.position.set(-5.5, 6, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 4, bottom: -4, near: 1, far: 25 })
  // A wide blur: shadows are soft pools, not cut-out shapes (the radius is in shadow-map texels)
  sun.shadow.radius = 30
  sun.shadow.blurSamples = 25
  sun.shadow.bias = -0.0006
  sceneBg.add(sun)
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.ShadowMaterial({ opacity: 0.36 }))
  wall.position.z = -0.28
  wall.receiveShadow = true
  sceneBg.add(wall)

  const plankMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.38,
    metalness: 0,
    envMapIntensity: 1.2,
  })
  rows.forEach((y) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(PLANK_W, 0.06, PLANK_D), plankMat)
    p.position.set(0, y - 0.03, -0.05)
    p.castShadow = true
    p.receiveShadow = true
    sceneBg.add(p)
  })

  const geo = new THREE.BoxGeometry(1, 1, 0.045)
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.85, metalness: 0 })
  const records = []
  const printMat = (map) =>
    new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.55,
      metalness: 0,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.3,
    })

  const contactTex = (() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    const g = c.getContext('2d')
    const gr = g.createRadialGradient(128, 64, 10, 128, 64, 120)
    gr.addColorStop(0, 'rgba(0,0,0,.8)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.save()
    g.scale(1, 0.5)
    g.translate(0, 64)
    g.fillStyle = gr
    g.fillRect(0, -64, 256, 256)
    g.restore()
    return new THREE.CanvasTexture(c)
  })()

  function makeRecord(i: number) {
    const front = printMat(tex(source.front(i)))
    const back = printMat(null)
    back.color.set(0x333333)
    const mesh = new THREE.Mesh(geo, [edgeMat, edgeMat, edgeMat, edgeMat, front, back])
    mesh.castShadow = true
    mesh.position.y = 0.5
    const g = new THREE.Group()
    g.add(mesh)
    const cs = new THREE.Mesh(
      new THREE.PlaneGeometry(1.25, 0.55),
      new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false }),
    )
    cs.rotation.x = -Math.PI / 2
    cs.position.set(0.03, 0.004, 0.02)
    g.add(cs)
    const row = i < 5 ? 0 : 1,
      col = i % 5
    g.userData = {
      i,
      mesh,
      front,
      back,
      baseX: (col - 2) * DX,
      baseY: rows[row],
      baseZ: 0.06,
      yaw: 0.13,
      lean: -0.07,
      h: 0,
      intro: 0,
    }
    g.position.set(g.userData.baseX, g.userData.baseY, g.userData.baseZ)
    mesh.userData.i = i
    sceneBg.add(g)
    records.push(g)
    return g
  }

  sceneFg.add(new THREE.HemisphereLight(0xffffff, 0xa9a9b4, 0.42))
  const sunFg = new THREE.DirectionalLight(0xfff3e2, 0.85)
  sunFg.position.set(-3.5, 5, 8)
  sceneFg.add(sunFg)

  let visH = 5,
    dist = 14
  function layout() {
    const w = host.clientWidth,
      h = host.clientHeight,
      a = w / h
    ;[rBg, rFg].forEach((r) => r.setSize(w, h, false))
    camera.aspect = a
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    dist = Math.max(5.2 / 2 / t, 7.9 / 2 / (t * a))
    visH = 2 * dist * t
    camera.position.set(0, 0, dist)
    camera.updateProjectionMatrix()
  }

  const mouse = new THREE.Vector2(0, 0),
    ray = new THREE.Raycaster()
  const pointer = { inside: false, x: 0, y: 0 }
  let hovered = null,
    sel = null,
    pending = null,
    introDone = false,
    alive = true,
    flipped = false
  const cam0 = new THREE.Vector3()
  const projectPx = (v) => {
    const p = v.clone().project(camera)
    return { x: ((p.x + 1) / 2) * host.clientWidth, y: ((1 - p.y) / 2) * host.clientHeight }
  }

  function blobTex() {
    if (blobTex.t) return blobTex.t
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64)
    gr.addColorStop(0, 'rgba(0,0,0,.5)')
    gr.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = gr
    g.fillRect(0, 0, 128, 128)
    return (blobTex.t = new THREE.CanvasTexture(c))
  }

  function setBlur(on: boolean) {
    cBg.style.filter = on ? 'blur(9px)' : ''
    cBg.style.opacity = on ? '.82' : '1'
  }

  function pick(i: number) {
    if (sel) {
      if (sel.leaving) {
        pending = i
        return
      }
      const same = sel.i === i
      unpick(() => !same && pick(i))
      return
    }
    const rec = records[i],
      u = rec.userData
    const startPos = new THREE.Vector3(),
      startQuat = new THREE.Quaternion()
    u.mesh.getWorldPosition(startPos)
    u.mesh.getWorldQuaternion(startQuat)
    if (!u.backReady) {
      u.back.map = tex(source.back(i))
      u.back.color.set(0xffffff)
      u.back.needsUpdate = true
      u.backReady = true
    }
    const group = new THREE.Group(),
      tilt = new THREE.Group(),
      flipper = new THREE.Group()
    const mesh = new THREE.Mesh(geo, u.mesh.material)
    group.add(tilt)
    tilt.add(flipper)
    flipper.add(mesh)
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0 }),
    )
    shadow.position.z = -0.3
    group.add(shadow)
    group.position.copy(startPos)
    group.quaternion.copy(startQuat)
    group.scale.setScalar(1)
    sceneFg.add(group)
    u.mesh.visible = false
    u.mesh.parent.visible = false

    const S1 = visH * 0.43,
      target = new THREE.Vector3(0, -visH * 0.015, 0.6)
    sel = { i, group, tilt, flipper, shadow, leaving: false, ready: false, S1 }
    flipped = false
    setBlur(true)
    opts.onSelect(i)
    opts.onReady(false)
    const p = { t: 0 },
      id = new THREE.Quaternion()
    sel.tl = gsap
      .timeline()
      .to(p, {
        t: 1,
        duration: 1.0,
        ease: 'expo.out',
        onUpdate() {
          group.position.lerpVectors(startPos, target, p.t)
          group.quaternion.slerpQuaternions(startQuat, id, p.t)
          group.scale.setScalar(1 + (S1 - 1) * p.t)
          shadow.material.opacity = p.t * 0.55
        },
      })
      .fromTo(flipper.rotation, { x: -0.25 }, { x: 0, duration: 1.0, ease: 'back.out(2)' }, 0)
      .add(() => {
        if (sel) {
          sel.ready = true
          opts.onReady(true)
        }
      }, 0.55)
  }

  function unpick(done?: () => void) {
    if (!sel || sel.leaving) return
    const s = sel
    s.leaving = true
    s.tl?.kill()
    setBlur(false)
    opts.onSelect(null)
    opts.onReady(false)
    const rec = records[s.i],
      u = rec.userData
    rec.visible = true
    u.mesh.visible = true
    rec.updateMatrixWorld(true)
    const endPos = new THREE.Vector3(),
      endQuat = new THREE.Quaternion()
    u.mesh.getWorldPosition(endPos)
    u.mesh.getWorldQuaternion(endQuat)
    rec.visible = false
    const sp = s.group.position.clone(),
      sq = s.group.quaternion.clone(),
      ss = s.group.scale.x,
      p = { t: 0 }
    gsap.to(s.flipper.rotation, { y: 0, x: 0, duration: 0.5, ease: 'power3.inOut' })
    flipped = false
    gsap.to(s.tilt.rotation, { x: 0, y: 0, duration: 0.4 })
    gsap.to(p, {
      t: 1,
      duration: 0.6,
      ease: 'power3.inOut',
      onUpdate() {
        s.group.position.lerpVectors(sp, endPos, p.t)
        s.group.quaternion.slerpQuaternions(sq, endQuat, p.t)
        s.group.scale.setScalar(ss + (1 - ss) * p.t)
        s.shadow.material.opacity = (1 - p.t) * 0.55
      },
      onComplete() {
        rec.visible = true
        sceneFg.remove(s.group)
        sel = null
        gsap.fromTo(u, { h: 1 }, { h: 0, duration: 0.5, ease: 'power2.out' })
        const n = pending
        pending = null
        if (done) done()
        else if (n != null) pick(n)
      },
    })
  }

  function flip() {
    if (!sel || !sel.ready) return
    flipped = !flipped
    gsap.to(sel.flipper.rotation, { y: flipped ? Math.PI : 0, duration: 0.9, ease: 'power3.inOut' })
    gsap.fromTo(sel.group.position, { z: 0.6 }, { z: 1.4, duration: 0.45, yoyo: true, repeat: 1, ease: 'power2.inOut' })
    return flipped
  }

  const onMove = (e: PointerEvent) => {
    const r = host.getBoundingClientRect()
    pointer.inside = e.pointerType !== 'touch'
    pointer.x = e.clientX - r.left
    pointer.y = e.clientY - r.top
    mouse.set((pointer.x / r.width) * 2 - 1, -(pointer.y / r.height) * 2 + 1)
  }
  const onLeave = () => {
    pointer.inside = false
    mouse.set(0, 0)
    hovered = null
  }
  const onClick = (e: MouseEvent) => {
    if (e.target.closest('button, a, nav')) return
    const r = host.getBoundingClientRect()
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(mouse, camera)
    if (sel) {
      if (sel.leaving) return
      const hit = ray.intersectObject(sel.group.children[0], true).length
      if (!hit) unpick()
      else flip()
      return
    }
    if (!introDone) return
    const hit = ray.intersectObjects(
      records.filter((r) => r.visible).map((r) => r.userData.mesh),
      false,
    )[0]
    if (hit) pick(hit.object.userData.i)
  }
  host.addEventListener('pointermove', onMove)
  host.addEventListener('pointerleave', onLeave)
  host.addEventListener('click', onClick)
  const ro = new ResizeObserver(layout)
  ro.observe(host)

  const clock = new THREE.Clock(),
    look = new THREE.Vector3()
  let lastCursor = false
  let lastHover = null
  function tick() {
    if (!alive) return
    const dt = Math.min(clock.getDelta(), 0.05),
      time = clock.elapsedTime
    cam0.set(mouse.x * 0.35, mouse.y * 0.18, 0)
    camera.position.x += (cam0.x - camera.position.x) * Math.min(1, dt * 3)
    camera.position.y += (cam0.y - camera.position.y) * Math.min(1, dt * 3)
    camera.lookAt(look.set(0, 0, 0))
    hovered = null
    if (pointer.inside && !sel && introDone) {
      ray.setFromCamera(mouse, camera)
      const hit = ray.intersectObjects(
        records.filter((r) => r.visible).map((r) => r.userData.mesh),
        false,
      )[0]
      if (hit) hovered = hit.object.userData.i
    }
    const hover = hovered === null ? null : { i: hovered, x: pointer.x, y: pointer.y }
    if (hover?.i !== lastHover?.i || hover?.x !== lastHover?.x || hover?.y !== lastHover?.y) {
      lastHover = hover
      opts.onHover(hover)
    }
    const ptr = hovered != null || (!!sel && !sel.leaving && sel.ready)
    if (ptr !== lastCursor) {
      lastCursor = ptr
      opts.onCursor(ptr)
    }
    records.forEach((g) => {
      const u = g.userData
      if (!(sel && sel.i === u.i)) u.h += ((hovered === u.i ? 1 : 0) - u.h) * Math.min(1, dt * 10)
      const k = u.intro,
        e = 1 - k
      g.position.set(u.baseX, u.baseY + u.h * 0.06 + e * 1.8, u.baseZ + u.h * 0.2 + e * 1.2)
      g.rotation.set(u.lean + e * -0.6 - u.h * 0.03, u.yaw * (1 - u.h * 0.75) + e * 0.5, 0)
      g.scale.setScalar(0.7 + 0.3 * k + u.h * 0.035)
    })
    if (sel && !sel.leaving) {
      sel.tilt.rotation.y += (mouse.x * 0.6 - sel.tilt.rotation.y) * Math.min(1, dt * 8)
      sel.tilt.rotation.x += (-mouse.y * 0.45 - sel.tilt.rotation.x) * Math.min(1, dt * 8)
      if (sel.ready) sel.group.position.y = -visH * 0.015 + Math.sin(time * 1.4) * 0.035
      const c = projectPx(new THREE.Vector3(0, -visH * 0.015, 0.6)),
        half = sel.S1 * 0.5 * (host.clientHeight / visH)
      opts.onPills({ x: c.x, flipY: c.y + half * 0.78, openY: c.y + half + 28 })
    }
    rBg.render(sceneBg, camera)
    rFg.render(sceneFg, camera)
    raf = requestAnimationFrame(tick)
  }
  let raf = 0

  layout()
  records.length = 0
  for (let i = 0; i < source.count; i++) makeRecord(i)
  tick()
  records.forEach((g, i) =>
    gsap.to(g.userData, {
      intro: 1,
      duration: 1.1,
      delay: 0.15 + (i % 5) * 0.08 + (i > 4 ? 0.25 : 0),
      ease: 'back.out(1.4)',
    }),
  )
  const t = setTimeout(() => (introDone = true), 1400)

  return {
    pick,
    unpick: () => unpick(),
    flip,
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      clearTimeout(t)
      ro.disconnect()
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      host.removeEventListener('click', onClick)
      gsap.killTweensOf(records.map((r) => r.userData))
      rBg.dispose()
      rFg.dispose()
      cBg.remove()
      cFg.remove()
    },
  }
}
