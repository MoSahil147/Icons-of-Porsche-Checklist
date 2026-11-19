// The writing rules as a check: no em dash, en dash or emoji in tracked text files. Run: bun tools/check-text.js
const RULES = [
  [/—/g, 'em dash'],
  [/–/g, 'en dash'],
  [/(?![©®™])\p{Extended_Pictographic}/gu, 'emoji']
];
const TEXT = /\.(js|css|html|md|json|yml|svg|webmanifest)$/;

export function findProblems(text) {
  const found = [];
  text.split('\n').forEach((line, index) => {
    for (const [pattern, name] of RULES) for (const match of line.matchAll(pattern)) found.push({ line: index + 1, column: match.index + 1, name });
  });
  return found;
}

if (import.meta.main) {
  const files = Bun.spawnSync(['git', 'ls-files']).stdout.toString().split('\n').filter(file => TEXT.test(file) && file !== 'bun.lock');
  let count = 0;
  for (const file of files) {
    for (const { line, column, name } of findProblems(await Bun.file(file).text())) {
      console.log(`${file}:${line}:${column} ${name}`);
      count++;
    }
  }
  console.log(count ? `${count} problem(s) in ${files.length} files` : `${files.length} files clean`);
  process.exit(count ? 1 : 0);
}
