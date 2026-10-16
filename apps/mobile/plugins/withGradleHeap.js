const { withGradleProperties } = require('expo/config-plugins');

// R8 (release minify) needs more than Gradle's default 2 GB heap on this app.
const ARGS = '-Xmx6g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8';

module.exports = function withGradleHeap(config) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'org.gradle.jvmargs'));
    cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: ARGS });
    return cfg;
  });
};
