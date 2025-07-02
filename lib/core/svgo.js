const fs = require('fs');
const cheerio = require('cheerio');

/**
 * Chuyển các <foreignObject> trong SVG thành các thẻ <text>/<tspan> thuần SVG,
 * dàn đều, wrap động căn giữa và hiển thị '...' khi vượt quá khung.
 * @param {string} svgContent - Nội dung SVG đầu vào.
 * @param {object} [options]
 * @param {number} [options.defaultFontSize=14] - Kích thước chữ mặc định.
 * @param {number} [options.lineHeight=1.2] - Khoảng cách dòng (em).
 * @param {number} [options.charWidthRatio=0.6] - Tỉ lệ đo xấp xỉ chiều rộng ký tự so với fontSize.
 * @returns {string} - Nội dung SVG đã chuyển đổi.
 */
function convertForeignObject(svgContent, options = {}) {
  const defaultFontSize = options.defaultFontSize || 14;
  const lineHeight = options.lineHeight || 1.2;
  const charWidthRatio = options.charWidthRatio || 0.6;
  const $ = cheerio.load(svgContent, { xmlMode: true });

  $('foreignObject').each((i, fo) => {
    const $fo = $(fo);
    const x = parseFloat($fo.attr('x')) || 0;
    const y = parseFloat($fo.attr('y')) || 0;
    const width = parseFloat($fo.attr('width')) || 0;
    const height = parseFloat($fo.attr('height')) || 0;

    // Lấy font-size dùng cho text
    const fontSize = parseFloat($fo.attr('font-size')) || defaultFontSize;

    // Lấy nội dung raw và split thành từ
    const rawText = $fo.text().trim();
    const words = rawText.split(/\s+/);

    // Tính giới hạn ký tự mỗi dòng
    const charLimit = Math.floor(width / (fontSize * charWidthRatio));
    const lines = [];
    let current = '';
    words.forEach(word => {
      const test = current ? `${current} ${word}` : word;
      if (test.length <= charLimit) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    });
    if (current) lines.push(current);

    // Tính số dòng tối đa trong khung
    const maxLines = Math.floor(height / (fontSize * lineHeight));
    let displayLines = lines;
    if (lines.length > maxLines) {
      displayLines = lines.slice(0, maxLines);
      // Thay thế cuối cùng bằng '...'
      const last = displayLines[maxLines - 1];
      displayLines[maxLines - 1] = last.length > 3
        ? last.slice(0, last.length - 3) + '...'
        : '...';
    }

    // Tính vertical centering
    const textHeight = displayLines.length * fontSize * lineHeight;
    const startY = y + (height - textHeight) / 2 + fontSize;
    // Tính horizontal centering
    const centerX = x + width / 2;

    // Tạo các tspan với dy động
    const tspans = displayLines.map((line, idx) => {
      const dy = idx === 0 ? '0' : `${lineHeight}em`;
      return `<tspan x="${centerX}" dy="${dy}">${line}</tspan>`;
    }).join('');

    // Thẻ text chính
    const textEl = `<text x="${centerX}" y="${startY}" font-size="${fontSize}" text-anchor="middle">${tspans}</text>`;

    $fo.replaceWith(textEl);
  });

  return $.xml();
}

// CLI: chạy trực tiếp
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node convertForeignObject.js input.svg [output.svg]');
    process.exit(1);
  }
  const [inputFile, outputFile = inputFile.replace(/\.svg$/, '-converted.svg')] = args;
  const svgContent = fs.readFileSync(inputFile, 'utf8');
  const result = convertForeignObject(svgContent);
  fs.writeFileSync(outputFile, result, 'utf8');
  console.log(`Converted SVG written to ${outputFile}`);
}

module.exports = { convertForeignObject };
