module.exports = {
  globDirectory: 'build/',
  globPatterns: [
    '**/*.{json,ico,html,js,css,png,jpg,svg}'
  ],
  swSrc: 'src/custom-service-worker.js',
  swDest: 'build/service-worker.js',
  // Opcjonalnie: ignoruj pliki map źródłowych
  globIgnores: [
    '**/service-worker.js',
    '**/*-es5.*.js',
    '**/*.map'
  ]
};
