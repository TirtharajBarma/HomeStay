const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withIosLocalNoPush(config) {
  if (process.env.EXPO_LOCAL_NO_PUSH !== '1') {
    return config;
  }
  return withEntitlementsPlist(config, (config) => {
    if (config.modResults['aps-environment']) {
      delete config.modResults['aps-environment'];
      console.log('[with-ios-local-no-push] Removed aps-environment for local developer build');
    }
    return config;
  });
};
