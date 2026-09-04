// <loop-scene data-scene="slug" data-manifest="{...}"> mounts the renderer registered for that slug.
const renderers = new Map();
export function register(slug, mount) { renderers.set(slug, mount); }
export function defineLoopScene() {
  if (customElements.get('loop-scene')) return;
  customElements.define('loop-scene', class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.mounted) return;
      const mount = renderers.get(this.dataset.scene);
      if (!mount) { this.textContent = `No renderer registered for scene "${this.dataset.scene}".`; return; }
      this.dataset.mounted = '1';
      mount(this, JSON.parse(this.dataset.manifest));
    }
  });
}
