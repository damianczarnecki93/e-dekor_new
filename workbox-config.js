module.exports = {
  globDirectory: 'build/',
  globPatterns: [
    '**/*.{json,ico,html,png,txt,css,js}'
  ],
  swDest: 'build/service-worker.js',
  swSrc: 'src/custom-service-worker.js',
};
