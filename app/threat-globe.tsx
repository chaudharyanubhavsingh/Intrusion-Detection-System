"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

export function ThreatGlobe() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000,
    )
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    containerRef.current.appendChild(renderer.domElement)

    // Load textures
    const textureLoader = new THREE.TextureLoader()
    const earthTexture = textureLoader.load("/16-k-earth-texture-pack-3d-model.jpg") // Earth texture
    const nightLightsTexture = textureLoader.load("/citylight.jpg") // Night lights texture

    // Increase globe size slightly
    const globeRadius = 6.5
    const geometry = new THREE.SphereGeometry(globeRadius, 64, 64)
    const material = new THREE.MeshStandardMaterial({
      map: earthTexture,
      emissiveMap: nightLightsTexture,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.2,
      roughness: 1,
      metalness: 0.5,
    })
    const globe = new THREE.Mesh(geometry, material)
    scene.add(globe)

    // Add ambient and directional lights
    const ambientLight = new THREE.AmbientLight(0x333333)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5)
    directionalLight.position.set(5, 3, 5)
    scene.add(directionalLight)

    // Atmosphere glow effect
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1)), 4.0);
          gl_FragColor = vec4(0.2, 0.5, 1.0, 0.1) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    })
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(globeRadius + 0.1, 64, 64), atmosphereMaterial)
    scene.add(atmosphere)

    // Red markers
    const markerOffset = 0.2 // Push markers slightly above the surface
    const redMaterial = new THREE.MeshBasicMaterial({ color: "red" })
    const redGeometry = new THREE.SphereGeometry(0.1, 16, 16) // Small red dots

    const markers = [
      { x: 1, y: 2, z: 4 },  // Example coordinates
      { x: -3, y: 1, z: -2 },
      { x: 2, y: -2, z: 3 },
    ]

    markers.forEach(({ x, y, z }) => {
      const direction = new THREE.Vector3(x, y, z).normalize()
      const newPosition = direction.multiplyScalar(globeRadius + markerOffset)

      const point = new THREE.Mesh(redGeometry, redMaterial)
      point.position.set(newPosition.x, newPosition.y, newPosition.z)
      scene.add(point)
    })

    // Add controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.rotateSpeed = 0.5
    controls.enableZoom = false

    // Position camera
    camera.position.z = 15

    // Animation loop
    function animate() {
      requestAnimationFrame(animate)
      globe.rotation.y += 0.001
      atmosphere.rotation.y += 0.001
      controls.update()
      renderer.render(scene, camera)
    }

    animate()

    // Handle resize
    function handleResize() {
      if (!containerRef.current) return
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight)
    }

    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      containerRef.current?.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} className="h-[400px] w-full" />
}
