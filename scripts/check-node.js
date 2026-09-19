const major = Number(process.versions.node.split('.')[0]);
if (major < 18) {
  console.error(`\n⚠️  Bu uygulama için Node.js 18 veya üstü gerekli (şu an ${process.version}).`);
  console.error('   Terminalde şunu çalıştırın:  nvm use 22\n');
  process.exit(1);
}
