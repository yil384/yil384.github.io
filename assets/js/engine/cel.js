// engine/cel.js — cel (toon) shading + ink outlines for three r186 WebGPU/TSL (WebGL2-safe).
//
// Exports
//   CelLightingModel        LightingModel: N-tone banded diffuse (AA'd with fwidth), stepped
//                           Blinn-Phong highlight, lit-side rim. All knobs are uniform()s.
//   CelNodeMaterial         MeshToonNodeMaterial subclass using CelLightingModel. Because it keeps
//                           `isMeshToonNodeMaterial`, `toonOutlinePass()` outlines it for free.
//                           new CelNodeMaterial({ color, map, ... }, { steps, shadowTint, rimWidth,
//                             rimStrength, shininess, specStrength })
//                           mat.cel -> { steps, shadowTint, rimWidth, rimStrength, shininess, specStrength } uniforms
//   makeHull(mesh, opts)    Inverted-hull ink outline drawn as a BackSide child of `mesh`.
//                             { thickness = 0.03, color = '#120a1e', mode = 'normal' | 'box' }
//                           'normal' offsets vertices along normals (smooth meshes);
//                           'box' draws a slightly bigger box around the geometry's bounding box —
//                           use it for hard-edged cubes / voxel InstancedMesh (shares instanceMatrix).
//   posterizeOutput(mat, n) Quantise the lit result of any material into n steps (outputNode).
//
// Notes
//   * Materials are meant to be shared: one CelNodeMaterial = one shader program.
//   * Key light should be a DirectionalLight (parallel L makes the bands read as painted).
//   * Hull materials write emissive = 0 explicitly so the MRT `emissive` slot used by post.js
//     never contains uninitialised data on WebGL2.
import * as THREE from 'three/webgpu';
import {
  float, vec3, vec4, uniform, normalView, positionViewDirection, diffuseColor, smoothstep, floor,
  max, pow, mix, saturate, fwidth, BRDF_Lambert, positionLocal, normalLocal, posterize, output,
} from 'three/tsl';

export class CelLightingModel extends THREE.LightingModel {
  constructor({ steps = 3, shadowTint = new THREE.Color('#5b4a8a'), rimWidth = 0.35, rimStrength = 0.6, shininess = 48, specStrength = 0.35 } = {}) {
    super();
    this.steps = uniform(steps);
    this.shadowTint = uniform(shadowTint instanceof THREE.Color ? shadowTint : new THREE.Color(shadowTint));
    this.rimWidth = uniform(rimWidth);
    this.rimStrength = uniform(rimStrength);
    this.shininess = uniform(shininess);
    this.specStrength = uniform(specStrength);
  }

  direct({ lightDirection, lightColor, reflectedLight }) {
    const NdotL = normalView.dot(lightDirection); // -1..1
    const t = NdotL.mul(0.5).add(0.5); // 0..1
    // Quantise with a hairline of AA (fwidth = screen-space derivative) so bands don't shimmer.
    const bands = this.steps.sub(1);
    const q = t.mul(bands);
    const edge = q.fract();
    const aa = fwidth(q).mul(0.5).add(1e-4);
    const tone = floor(q).add(smoothstep(float(0.5).sub(aa), float(0.5).add(aa), edge)).div(bands); // 0..1 stepped
    const shade = mix(this.shadowTint, vec3(1), tone); // tinted shadow, white light
    reflectedLight.directDiffuse.addAssign(lightColor.mul(shade).mul(BRDF_Lambert({ diffuseColor: diffuseColor.rgb })));
    // Blinn-Phong "dot" highlight, hard-stepped.
    const H = lightDirection.add(positionViewDirection).normalize();
    const spec = pow(max(normalView.dot(H), 0), this.shininess);
    const fw = fwidth(spec);
    const specStep = smoothstep(float(0.5).sub(fw), float(0.5).add(fw), spec);
    reflectedLight.directSpecular.addAssign(lightColor.mul(specStep).mul(this.specStrength));
    // Rim: only on the lit side, only at grazing angles (edges ascend: 1-rw < 1-rw+0.08).
    const fresnel = float(1).sub(saturate(normalView.dot(positionViewDirection)));
    const lo = float(1).sub(this.rimWidth);
    const rim = smoothstep(lo, lo.add(0.08), fresnel).mul(saturate(NdotL.add(0.2)));
    reflectedLight.directSpecular.addAssign(lightColor.mul(rim).mul(this.rimStrength));
  }

  indirect(builder) {
    const { ambientOcclusion, irradiance, reflectedLight } = builder.context; // irradiance = ambient + hemisphere
    reflectedLight.indirectDiffuse.addAssign(irradiance.mul(BRDF_Lambert({ diffuseColor })));
    reflectedLight.indirectDiffuse.mulAssign(ambientOcclusion);
  }
}

export class CelNodeMaterial extends THREE.MeshToonNodeMaterial {
  constructor(params = {}, cel = {}) {
    super(params);
    this._celModel = new CelLightingModel(cel);
    this.cel = this._celModel; // uniforms: .steps .shadowTint .rimWidth .rimStrength .shininess .specStrength
  }
  setupLightingModel() { return this._celModel; }
}

/** Inverted-hull outline. Returns the hull object (already added as a child of `mesh`). */
export function makeHull(mesh, { thickness = 0.03, color = '#120a1e', mode = 'normal' } = {}) {
  const hullMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, color });
  hullMat.emissiveNode = vec3(0); // keep the MRT emissive slot defined (no bloom on ink)
  hullMat.fog = mesh.material?.fog ?? true;
  let geometry = mesh.geometry;
  if (mode === 'box') {
    // Hard-edged cubes: offsetting split normals opens gaps at corners, so draw a bigger box instead.
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const size = new THREE.Vector3().subVectors(bb.max, bb.min);
    const center = new THREE.Vector3().addVectors(bb.max, bb.min).multiplyScalar(0.5);
    geometry = new THREE.BoxGeometry(size.x + 2 * thickness, size.y + 2 * thickness, size.z + 2 * thickness);
    geometry.translate(center.x, center.y, center.z);
  } else {
    hullMat.positionNode = positionLocal.add(normalLocal.normalize().mul(thickness)); // object-space offset
  }
  let hull;
  if (mesh.isInstancedMesh) {
    hull = new THREE.InstancedMesh(geometry, hullMat, mesh.count);
    hull.instanceMatrix = mesh.instanceMatrix; // share the buffer (no copy)
    hull.count = mesh.count;
  } else {
    hull = new THREE.Mesh(geometry, hullMat);
  }
  hull.frustumCulled = mesh.frustumCulled;
  hull.renderOrder = mesh.renderOrder - 1;
  hull.name = (mesh.name || 'mesh') + '_hull';
  mesh.add(hull); // inherits the transform (and animation) of the original
  return hull;
}

/** Quantise the final lit colour of `material` into `steps` levels (cheap retrofit cel look). */
export function posterizeOutput(material, steps = 4) {
  material.outputNode = vec4(posterize(output.rgb, steps), output.a);
  return material;
}
