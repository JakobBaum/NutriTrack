// Gefakte Kamera für E2E: ersetzt getUserMedia durch einen Canvas-Stream, der einen EAN-13-Barcode zeigt.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

/** Modulfolge (0/1) eines EAN-13-Codes (13 Ziffern, Prüfziffer wird nicht neu berechnet). */
export function ean13Modules(code) {
  const d = [...code].map(Number);
  const parity = PARITY[d[0]];
  let bits = '101';
  for (let i = 0; i < 6; i++) bits += (parity[i] === 'L' ? L : G)[d[i + 1]];
  bits += '01010';
  for (let i = 0; i < 6; i++) bits += R[d[i + 7]];
  return bits + '101';
}

/** Init-Script: getUserMedia liefert (nach `delayMs`) einen Stream mit dem Barcode `code`. */
export function fakeCameraInit({ code, delayMs = 0 }) {
  const bits = ean13Modules(code);
  return `(() => {
    const bits = ${JSON.stringify(bits)};
    window.__cam = { requested: 0, resolved: 0, stopped: 0, tracksLive: 0 };
    navigator.mediaDevices.getUserMedia = async () => {
      window.__cam.requested = performance.now();
      await new Promise((r) => setTimeout(r, ${delayMs}));
      const c = document.createElement('canvas');
      c.width = 1280; c.height = 720;
      const g = c.getContext('2d');
      const draw = () => {
        g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        const m = 5, w = bits.length * m, x0 = (c.width - w) / 2;
        g.fillStyle = '#000';
        for (let i = 0; i < bits.length; i++) if (bits[i] === '1') g.fillRect(x0 + i * m, 220, m, 280);
      };
      draw(); setInterval(draw, 100);
      const stream = c.captureStream(15);
      for (const t of stream.getTracks()) {
        const stop = t.stop.bind(t);
        t.stop = () => { window.__cam.stopped++; stop(); };
      }
      window.__cam.resolved = performance.now();
      window.__cam.stream = stream;
      return stream;
    };
  })();`;
}
