module.exports = {
  globDirectory: 'build/',
  globPatterns: [
    '**/*.{json,ico,html,png,txt,css,js}'
  ],
  swDest: 'build/service-worker.js',
  swSrc: 'src/service-worker.js',
};
