# Qué es Rebodocs

Rebodocs es un procesador de textos para el navegador, compatible con archivos de Word (DOCX), con motor propio. El modelo del documento, el corte de líneas, la paginación, el cursor, la selección y la lectura y escritura de DOCX están escritos desde cero. No usa ProseMirror, `contenteditable` ni ninguna biblioteca de edición.

Se hizo para vivir dentro de otra aplicación: un CRM que llena plantillas de contratos y recibos y deja que la gente edite el resultado. Por eso viene en paquetes que tomas de uno en uno.

## Qué obtienes {#what-you-get}

- **Un procesador de textos.** Formato, estilos, listas, tabulaciones, tablas (con tablas dentro de celdas y texto girado), columnas, secciones con su propia página, imágenes, cuadros de texto, encabezados y pies de página, notas al pie, números de página, enlaces, comentarios, tabla de contenido, buscar y reemplazar.
- **Control de cambios**, como en Word: lo que se escribe y se borra queda marcado hasta que alguien lo acepta o lo rechaza.
- **Versiones** guardadas por tu aplicación, comparadas palabra por palabra y restauradas.
- **Compatibilidad con Word.** Lee y escribe DOCX, y corta líneas y páginas con las mismas reglas, así que un documento se ve igual en los dos.
- **Un archivo que sobrevive.** Lo que el editor no entiende se queda intacto en el DOCX.
- **Plantillas.** `{{cliente}}` en cualquier documento es una variable para llenar; al escribir `{{` aparecen las que llena tu aplicación.
- **Áreas para llenar.** Un documento se puede restringir a las áreas que se deben llenar, y el resto queda solo para leer, también en Word.
- **Comandos con "/"**: títulos, listas, tablas, imágenes, firmas, y comandos propios.
- **PDF y DOCX en un servidor**, con la misma maquetación, sin navegador.
- **Colaboración** en tiempo real, con tu backend guardando los archivos, y una versión de cada sesión de trabajo si la quieres.
- **Chino y otros idiomas.** Las líneas en chino se cortan entre caracteres, sin empezar con “。” ni “，”, y la interfaz habla español, inglés y chino.
- **Un editor listo para el teléfono**: ajuste al ancho, pellizco para hacer zoom, selección táctil.

## Los paquetes {#the-packages}

| Paquete | Tómalo cuando |
| --- | --- |
| `@rebodocs/react` | Tienes una aplicación de React o Next.js y quieres el editor en una de sus pantallas. |
| `@rebodocs/editor` | Quieres el editor en una página sin framework, o construir sobre sus piezas. |
| `@rebodocs/viewer` | Solo muestras documentos: páginas para leer, miniaturas, sin edición. |
| `@rebodocs/core` | Generas o transformas documentos en código: llenar una plantilla, hacer un PDF. |
| `@rebodocs/collab` | Varias personas deben trabajar en el mismo documento a la vez. |
| `@rebodocs/mcp` | Un asistente de IA debe leer y editar documentos: Claude Desktop y otros clientes MCP, o Claude en un chat de tu aplicación. |

[Paquetes](/es/docs/packages/) explica qué tiene cada uno y cómo dependen entre sí.

## Lo que no es {#what-it-is-not}

- **No es una copia de Word.** Rebodocs no es una copia de Microsoft Word ni pretende serlo. Es un procesador de textos propio, compatible con el formato DOCX: abre lo que Word guarda, Word abre lo que él guarda, y las páginas salen igual en los dos. No tiene todas las funciones de Word, y tiene algunas propias, como las variables de plantilla. Todo lo que agrega se guarda de forma que Word lo abre y lo muestra bien.

- **No es un servicio alojado.** No hay nada en lo que registrarse. Es código que tú corres.
- **No está terminado.** Está probado y publicado en npm, y todavía no hace todo. [Estado y hoja de ruta](/es/docs/status/) enumera, sin rodeos, lo que está comprobado y lo que falta.

## Licencia {#license}

MIT. Cualquiera puede usarlo para cualquier cosa, también comercialmente, sin garantía.
