// The contract the CRM fills with a property's data: a template, with the
// variables between double braces that the record answers (`templateValues`).
// Made with the same operations the editor uses; a CRM of its own would keep
// its templates as .docx files, made in Word, and open them with importDocx.

import { type Doc, type Run, type RunProps, createDoc, insertSignatures, setPageNumbering, setParagraphStyle } from '@rebodocs/core';

const run = (text: string, props: RunProps = {}): Run => ({ text, props });
const bold = (text: string) => run(text, { bold: true });

type Line = { runs: Run[]; style?: string; align?: 'justify' | 'right' | 'center' };

const clause = (title: string, ...runs: Run[]): Line => ({ runs: [bold(`${title}. `), ...runs], align: 'justify' });

const LINES: Line[] = [
  { runs: [run('Contrato de mediación inmobiliaria')], style: 'Title' },
  { runs: [run('{{ciudad}}, a {{fecha | fecha larga}}', { italic: true })], align: 'right' },
  { runs: [run('Partes')], style: 'Heading1' },
  {
    runs: [
      run('De una parte, '),
      bold('{{propietario | nombre propio}}'),
      run(', en adelante «el Propietario», con correo '),
      run('{{correo}}'),
      run('; y de otra, '),
      bold('la Agencia'),
      run(', representada por su asesor '),
      bold('{{asesor}}'),
      run('. Ambas partes se reconocen capacidad para obligarse en los términos de este contrato.'),
    ],
    align: 'justify',
  },
  { runs: [run('Cláusulas')], style: 'Heading1' },
  clause(
    'Primera. Objeto',
    run('El Propietario encarga a la Agencia la promoción y la venta de la '),
    bold('{{inmueble}}'),
    run(', con una superficie de {{superficie}}, por un precio de '),
    bold('{{precio | moneda}}'),
    run('.'),
  ),
  clause(
    'Segunda. Propuestas',
    run('Las propuestas de compra que presente la Agencia tendrán una vigencia de '),
    bold('48 horas'),
    run(' para que el Propietario las acepte, las negocie o las rechace por escrito.'),
  ),
  clause(
    'Tercera. Comisión',
    run('Al firmarse la escritura de compraventa, el Propietario pagará a la Agencia una comisión del '),
    bold('{{comision}}'),
    run(' sobre el precio final de la operación, más el impuesto al valor agregado.'),
  ),
  clause(
    'Cuarta. Exclusividad',
    run('Durante la vigencia de este contrato el Propietario no encargará la venta del inmueble a otra agencia, y avisará a la Agencia de cualquier comprador que se le presente directamente.'),
  ),
  clause(
    'Quinta. Vigencia',
    run('Este contrato estará vigente por '),
    bold('{{vigencia}}'),
    run(' a partir de su firma, y se renovará por periodos iguales salvo aviso por escrito de alguna de las partes con quince días de anticipación.'),
  ),
  clause(
    'Sexta. Obligaciones de la Agencia',
    run('Publicar el inmueble en sus medios, acompañar las visitas, informar al Propietario de cada propuesta que reciba y asesorarlo en los trámites hasta la firma de la escritura.'),
  ),
  { runs: [run('Firmas')], style: 'Heading1' },
  { runs: [run('')] },
];

export function templateDoc(): Doc {
  let doc = createDoc(LINES.map((line) => ({ props: line.align ? { align: line.align } : {}, runs: line.runs })));
  LINES.forEach((line, i) => {
    if (line.style) doc = setParagraphStyle(doc, i, i, line.style);
  });
  doc = insertSignatures(doc, { para: LINES.length - 1, offset: 0 }, ['El Propietario', 'La Agencia'], 'NOMBRE COMPLETO').doc;
  doc = { ...doc, header: { paragraphs: [{ props: { align: 'right' }, runs: [run('Inmobiliaria de ejemplo · Contrato de mediación', { fontSize: 9, color: '6B7568' })] }] } };
  return setPageNumbering(doc, { place: 'footer', align: 'center', format: 'pageOfTotal', words: { page: 'Página', of: 'de' } });
}
