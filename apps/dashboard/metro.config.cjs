/** Keep the Expo workspace on its supported Metro configuration and monorepo resolver. */
const { getDefaultConfig } = require("expo/metro-config");
module.exports = getDefaultConfig(__dirname);
