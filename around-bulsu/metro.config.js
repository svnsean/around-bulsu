const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Add 3D model file extensions for ViroReact
config.resolver.assetExts.push('glb', 'gltf', 'obj', 'mtl', 'vrx');

module.exports = withNativeWind(config, { input: "./global.css" });
