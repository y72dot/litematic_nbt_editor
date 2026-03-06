import { BlockDefinition, BlockModel, TextureAtlas } from 'deepslate';

// Helper class to store models since ModelStore is not exported
class ModelStore {
    private models = new Map<string, BlockModel>();

    getModel(name: string): BlockModel | undefined {
        return this.models.get(name);
    }

    addModel(name: string, model: BlockModel) {
        this.models.set(name, model);
    }
}

// Use Misode's CDN for assets
const ASSETS_BASE = 'https://raw.githubusercontent.com/misode/mcmeta/assets/assets/minecraft';

export class DeepslateContext {
  private static instance: DeepslateContext;
  public atlas: TextureAtlas;
  public models: ModelStore;
  public blockDefinitions: Map<string, BlockDefinition>;
  private loaded: boolean = false;

  private constructor() {
    // Initialize empty context
    this.atlas = new TextureAtlas(2048); // 2048x2048 should be enough
    this.models = new ModelStore();
    this.blockDefinitions = new Map();
  }

  public static getInstance(): DeepslateContext {
    if (!DeepslateContext.instance) {
      DeepslateContext.instance = new DeepslateContext();
    }
    return DeepslateContext.instance;
  }

  // Load resources for specific blocks
  public async loadBlock(blockId: string) {
    // Normalize block ID (remove minecraft: prefix)
    const name = blockId.replace('minecraft:', '');

    // 1. Fetch BlockState
    if (!this.blockDefinitions.has(name)) {
      try {
        const bsUrl = `${ASSETS_BASE}/blockstates/${name}.json`;
        const bsRes = await fetch(bsUrl);
        if (!bsRes.ok) throw new Error(`BlockState not found: ${name}`);
        const bsJson = await bsRes.json();
        
        const def = BlockDefinition.fromJson(name, bsJson);
        this.blockDefinitions.set(name, def);

        // 2. Load dependent models
        // We need to find all model paths referenced in the blockstate
        const modelPaths = new Set<string>();
        if (def.variants) {
            Object.values(def.variants).forEach(variant => {
               const models = Array.isArray(variant) ? variant : [variant];
               models.forEach(m => modelPaths.add(m.model));
            });
        }
        
        // Also handle multipart
        if (def.multipart) {
            def.multipart.forEach(part => {
               const models = Array.isArray(part.apply) ? part.apply : [part.apply];
               models.forEach(m => modelPaths.add(m.model));
            });
        }

        // 3. Fetch Models recursively
        for (const modelPath of modelPaths) {
           await this.loadModelRecursively(modelPath);
        }

      } catch (e) {
        console.warn(`Failed to load block ${name}:`, e);
      }
    }
  }

  private async loadModelRecursively(modelPath: string) {
    const name = modelPath.replace('minecraft:', '').replace('block/', ''); // Simplify path
    // Deepslate uses full paths like "block/stone", but assets are at "models/block/stone.json"
    
    // Check if already loaded
    if (this.models.getModel(name)) return;

    try {
        // Try to load from models/block/ or models/item/ (usually block)
        // Correct path construction:
        const url = `${ASSETS_BASE}/models/${modelPath.includes('/') ? modelPath : 'block/' + modelPath}.json`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Model not found: ${modelPath}`);
        const json = await res.json();
        
        const model = BlockModel.fromJson(name, json);
        this.models.addModel(name, model);

        // Load parent if exists
        if (model.parent) {
            await this.loadModelRecursively(model.parent);
        }

        // Load textures
        // We need to fetch textures and add to atlas
        for (const [key, texturePath] of Object.entries(model.textures || {})) {
            await this.loadTexture(texturePath);
        }

    } catch (e) {
        console.warn(`Failed to load model ${modelPath}:`, e);
    }
  }

  private async loadTexture(texturePath: string) {
      const name = texturePath.replace('minecraft:', '');
      // If it's a reference like #texture, ignore
      if (name.startsWith('#')) return;

      // Check if already in atlas? TextureAtlas doesn't expose a "has" method easily,
      // but we can track loaded textures ourselves if needed.
      // For now, let's just try to load.
      
      const url = `${ASSETS_BASE}/textures/${name}.png`;
      try {
          const img = new Image();
          img.crossOrigin = "Anonymous"; // Crucial for WebGL
          img.src = url;
          await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
          });
          
          this.atlas.add(img, name); // Register texture
      } catch (e) {
          console.warn(`Failed to load texture ${name}:`, e);
      }
  }

  public getGeometry(blockName: string, properties: Record<string, string>) {
      const def = this.blockDefinitions.get(blockName);
      if (!def) return null;
      
      // Get the model for this state
      const variant = def.getVariant(properties);
      // This returns a Variant object, which points to a model.
      // Deepslate's BlockDefinition.getVariant returns one variant.
      // We then need to get the actual geometry from ModelStore.
      
      // Wait, getVariant returns MultiPart or Variant.
      // Let's assume simple variant for now.
      
      // Actually, deepslate provides more direct ways to get meshes.
      // But we need to implement mesh generation logic using the models.
      // This part is complex.
      // Let's start by just ensuring resources are loaded.
      return null; 
  }
}
