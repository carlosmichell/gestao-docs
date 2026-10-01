import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { unzipSync } from 'fflate';
import { processTrct } from '../src/lib/process-trct.js';
import { processSeguro } from '../src/lib/process-seguro.js';
import { parseFgtsTxt, generateFgtsPdf } from '../src/lib/process-fgts.js';
import { generateZip, generateCombinedZip } from '../src/lib/zip-utils.js';

// Dados fictícios: verificam os formatos esperados sem documentos de funcionários.
test('TRCT agrupa as páginas até o próximo cabeçalho e preserva nomes acentuados', () => {
  const result = processTrct([
    'TERMO DE RESCISÃO DO CONTRATO DE TRABALHO 11 Nome JOÃO TESTE 12 Endereço',
    'Continuação do primeiro termo',
    'TERMO DE RESCISAO DO CONTRATO DE TRABALHO 11 Nome ANA EXEMPLO 12 Endereço',
  ]);
  assert.equal(result.totalPages, 3);
  assert.deepEqual(result.employees.map(({ name, pageIndices }) => ({ name, pageIndices })), [
    { name: 'JOÃO TESTE', pageIndices: [0, 1] },
    { name: 'ANA EXEMPLO', pageIndices: [2] },
  ]);
});

test('TRCT sem nome usa identificação alternativa; sem cabeçalho não inventa funcionário', () => {
  assert.equal(processTrct(['TERMO DE RESCISÃO DO CONTRATO DE TRABALHO']).employees[0].name, 'Funcionario_1');
  assert.deepEqual(processTrct(['Documento diferente']).employees, []);
});

test('seguro combina as duas metades e rejeita uma página sem par', () => {
  const result = processSeguro(['2 JOÃO TESTE NOME', '2 ANA EXEMPLO NOME', 'verso 1', 'verso 2']);
  assert.deepEqual(result.employees.map((employee) => employee.pageIndices), [[0, 2], [1, 3]]);
  assert.equal(result.employees[0].name, 'JOÃO TESTE');
  assert.throws(() => processSeguro(['frente', 'verso', 'sobrando']), /número par/);
});

test('FGTS junta blocos consecutivos do mesmo funcionário e remove o contador final', () => {
  const separator = '-'.repeat(73);
  const text = ['Cabeçalho', 'NOME DO TRABALHADOR\nJOÃO TESTE  000\nSALDO 10',
    'NOME DO TRABALHADOR\nJOÃO TESTE  000\nSALDO 20',
    'NOME DO TRABALHADOR\nANA EXEMPLO  000\nSALDO 30\n123'].join(separator);
  const employees = parseFgtsTxt(text);
  assert.equal(employees.length, 2);
  assert.equal(employees[0].name, 'JOÃO TESTE');
  assert.ok(employees[0].lines.includes('SALDO 20'));
  assert.equal(employees[1].lines.at(-1), 'SALDO 30');
});

test('FGTS gera um PDF válido com quebra de página para extratos longos', async () => {
  const bytes = generateFgtsPdf(Array.from({ length: 80 }, (_, index) => `Linha fictícia ${index + 1}`));
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
});

test('ZIP preserva os bytes e separa nomes repetidos em pastas distintas', () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const files = unzipSync(generateZip([
    { name: 'JOÃO TESTE', pdfBytes: bytes }, { name: 'JOÃO TESTE', pdfBytes: bytes },
  ], 'TRCT'));
  assert.deepEqual(Object.keys(files), ['JOÃO TESTE/TRCT.pdf', 'JOÃO TESTE (2)/TRCT.pdf']);
  assert.deepEqual(files['JOÃO TESTE/TRCT.pdf'], bytes);
});

test('ZIP combinado aceita funcionário com apenas um dos documentos', () => {
  const bytes = new Uint8Array([4, 5]);
  const files = unzipSync(generateCombinedZip([
    { name: 'ANA EXEMPLO', trctBytes: bytes, seguroBytes: bytes },
    { name: 'JOÃO TESTE', seguroBytes: bytes },
  ]));
  assert.deepEqual(Object.keys(files), ['ANA EXEMPLO/TRCT.pdf', 'ANA EXEMPLO/SEGURO.pdf', 'JOÃO TESTE/SEGURO.pdf']);
});
