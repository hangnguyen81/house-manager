module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // expo-router's babel plugin is included in babel-preset-expo on recent SDKs.
    // If your SDK needs it explicitly, add: plugins: ['expo-router/babel']
  };
};
