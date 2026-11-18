const { networkInterfaces } = require('node:os');
// qrcode-generator 2.0.4 from npm, vendored so LAN play works with Node alone.
const makeQr = require('./vendor/qrcode-generator');
const wifi = /wi[\s-]?fi|wireless|wlan/i;

function lanLinks(protocol, port) {
  const links = [];
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const { address, family, internal } of addresses) {
      if (family === 'IPv4' && !internal) links.push({ name, url: `${protocol}://${address}:${port}/` });
    }
  }
  return links.sort((a, b) => Number(wifi.test(b.name)) - Number(wifi.test(a.name)));
}

function joinPage(links) {
  const cards = links.map(({ name, url }, index) => {
    const qr = makeQr(0, 'M');
    qr.addData(url);
    qr.make();
    const image = qr.createSvgTag({
      cellSize: 8,
      scalable: true,
      title: { id: `qr-${index}`, text: `QR-код для ${url}` },
    });
    const label = name.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    return `<section><h2>${label}</h2>${image}<a href="${url}">${url}</a></section>`;
  }).join('');

  return `<!doctype html>
<html lang="uk">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CyberQuest · Підключення</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b1020; color: #f4f7ff; font: 17px/1.5 system-ui, sans-serif; }
  main { width: min(1040px, 100%); margin: auto; padding: 24px; }
  h1 { margin: 0; font-size: clamp(26px, 5vw, 40px); }
  p { color: #aab9df; }
  .links { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 255px), 1fr)); gap: 16px; }
  section { display: grid; justify-items: center; align-content: start; gap: 12px; padding: 16px;
    background: #121a33; border: 1px solid #334167; border-radius: 14px; text-align: center; }
  h2 { margin: 0; font-size: 19px; overflow-wrap: anywhere; }
  svg { display: block; width: min(100%, 272px); height: auto; shape-rendering: crispEdges; }
  a { color: #75e3f9; overflow-wrap: anywhere; }
</style>
<main>
  <h1>CyberQuest на телефоні</h1>
  <p>Під’єднайте телефон до тієї самої мережі, що й ПК. Відскануйте камерою QR-код для цієї мережі або введіть адресу в браузері.</p>
  <div class="links">${cards || '<p>Локальної IPv4-адреси не знайдено. Перевірте підключення ПК до мережі та оновіть сторінку.</p>'}</div>
  <p>Залиште вікно сервера відкритим, поки триває гра.</p>
</main>
</html>`;
}

module.exports = { lanLinks, joinPage };
