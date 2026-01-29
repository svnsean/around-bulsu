# 3D Assets for AR Navigation

This folder should contain 3D models for the AR navigation experience.

## Required Models

### 1. arrow_chevron.glb
- **Purpose:** Ground-anchored directional chevron (Google Live View style)
- **Specs:**
  - Format: GLB (binary GLTF)
  - Size: < 200KB recommended
  - Dimensions: ~1m wide chevron arrow pointing forward (+Z or -Z axis)
  - Color: Blue (#4285F4) or white with emissive glow
  - Origin: Center-bottom of the arrow
  - Orientation: Arrow pointing in -Z direction (forward in ViroReact)

### 2. destination_pin.glb
- **Purpose:** Floating destination marker
- **Specs:**
  - Format: GLB
  - Size: < 150KB
  - Style: Map pin or flag marker
  - Color: Red (#FF4444) or teal (#00E5FF)
  - Include subtle bounce animation if possible
  - Origin: Bottom tip of pin

### 3. path_dot.glb (Optional)
- **Purpose:** Waypoint markers along the route
- **Specs:**
  - Format: GLB
  - Size: < 50KB
  - Shape: Sphere or disc
  - Color: Cyan (#00E5FF) with glow
  - Very simple geometry

### 4. turn_arrow.glb
- **Purpose:** Turn indicator (rotated for left/right turns)
- **Specs:**
  - Format: GLB
  - Size: < 100KB
  - Shape: Curved arrow or 90-degree turn arrow
  - Color: Yellow/Gold (#FFD700)
  - Origin: Center

## Where to Get Models

1. **Sketchfab** (https://sketchfab.com) - Search for "arrow", "map pin", "navigation"
   - Filter by: Free, Downloadable, GLB format
   
2. **Google Poly Archive** (via GitHub mirrors) - Simple low-poly models

3. **Blender** (Create your own):
   - Install Blender (free)
   - Create simple arrow geometry
   - Export as GLB with "Apply Modifiers" checked
   
4. **Kenney Assets** (https://kenney.nl) - Free game assets, some 3D

## Model Optimization Tips

- Keep polygon count under 5,000 triangles per model
- Use single material per model when possible
- Bake lighting into vertex colors for better performance
- Compress textures to 512x512 or smaller
- Test on physical device (AR is GPU-intensive)

## Usage in Code

```javascript
import { Viro3DObject, ViroMaterials, ViroAnimations } from '@reactvision/react-viro';

// Models are loaded like this:
<Viro3DObject
  source={require('../assets/3d/arrow_chevron.glb')}
  type="GLB"
  position={[0, 0, -2]}
  scale={[0.5, 0.5, 0.5]}
  rotation={[0, 0, 0]}
/>
```
