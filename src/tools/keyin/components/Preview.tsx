// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 MamaShip
//
// three.js 预览：拖动旋转、滚轮缩放。three 按需加载，不拖慢首屏。
import { useEffect, useRef, useState } from "react";

interface Props {
  positions: Float32Array | null;
}

type Three = typeof import("three");
type Controls =
  import("three/examples/jsm/controls/OrbitControls.js").OrbitControls;

export default function Preview({ positions }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  const api = useRef<{ show: (p: Float32Array) => void } | null>(null);
  // three 异步加载完之前到达的模型先记在这里
  const pending = useRef<Float32Array | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const [THREE, { OrbitControls }] = await Promise.all([
        import("three") as Promise<Three>,
        import("three/examples/jsm/controls/OrbitControls.js"),
      ]);
      const el = host.current;
      if (disposed || !el) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      } catch {
        // 没有 WebGL（老设备、关闭了硬件加速）：不预览，下载照常
        setNoWebgl(true);
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      el.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6e, 1.6));
      const sun = new THREE.DirectionalLight(0xffffff, 1.8);
      sun.position.set(-60, 120, 140);
      scene.add(sun);

      const camera = new THREE.PerspectiveCamera(32, 1, 1, 2000);
      // 从正前上方看，正好能看清斜面上的字
      camera.position.set(0, 85, 190);
      const controls: Controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.target.set(0, 6, 0);
      controls.minDistance = 60;
      controls.maxDistance = 600;

      const material = new THREE.MeshStandardMaterial({
        color: 0xec7a45,
        roughness: 0.55,
        metalness: 0.05,
      });
      // 模型是 z 朝上（打印坐标），three 是 y 朝上
      const group = new THREE.Group();
      group.rotation.x = -Math.PI / 2;
      scene.add(group);
      let mesh: import("three").Mesh | null = null;

      const show = (p: Float32Array) => {
        if (mesh) {
          group.remove(mesh);
          mesh.geometry.dispose();
        }
        const g = new THREE.BufferGeometry();
        // 复制一份：下面的 translate 会原地改顶点
        g.setAttribute("position", new THREE.BufferAttribute(p.slice(), 3));
        g.computeVertexNormals(); // 非索引几何 → 每面法线，棱角分明
        g.translate(-75, -15, 0); // 底座中心放到原点
        mesh = new THREE.Mesh(g, material);
        group.add(mesh);
      };
      api.current = { show };
      if (pending.current) show(pending.current);

      const resize = () => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const observer = new ResizeObserver(resize);
      observer.observe(el);
      resize();

      let frame = 0;
      const loop = () => {
        controls.update();
        renderer.render(scene, camera);
        frame = requestAnimationFrame(loop);
      };
      loop();

      cleanup = () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        controls.dispose();
        mesh?.geometry.dispose();
        material.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        api.current = null;
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    pending.current = positions;
    if (positions) api.current?.show(positions);
  }, [positions]);

  return (
    <div
      ref={host}
      className="keyin-preview"
      aria-label="模型预览，拖动旋转、滚轮缩放"
    >
      {noWebgl && positions && (
        <p className="keyin-overlay">
          这个浏览器不支持 3D 预览（WebGL），模型已生成，可以直接下载。
        </p>
      )}
    </div>
  );
}
