// Self-hosted API URLs may use HTTP on a local network. Android otherwise
// blocks cleartext requests in release builds, even when the URL is valid.
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function withCleartextApi(config) {
  return withAndroidManifest(config, (result) => {
    result.modResults.manifest.application[0].$["android:usesCleartextTraffic"] = "true";
    return result;
  });
};
