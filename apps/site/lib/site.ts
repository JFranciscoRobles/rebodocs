/** Where the code is. One place to change it. */
export const REPO = 'https://github.com/JFranciscoRobles/rebodocs';
export const SITE = 'https://rebodocs.com';
/** The package an application installs. */
export const NPM = 'https://www.npmjs.com/package/@rebodocs/react';
/** Every package, on npm. */
export const NPM_ORG = 'https://www.npmjs.com/org/rebodocs';

import type { Pastel } from './home';
import type { L } from './i18n';

export interface NavItem {
  title: L;
  /** The file in `content/docs`, without `.md`; `index` is `/docs/`. */
  slug: string;
}

/** The pages of the documentation, in the order they are read; each group has its colour in the sidebar. */
export const NAV: { title: L; color: Pastel; items: NavItem[] }[] = [
  {
    title: { en: 'Start', es: 'Empezar', zh: '开始' },
    color: 'blue',
    items: [
      { title: { en: 'What is Rebodocs', es: 'Qué es Rebodocs', zh: 'Rebodocs 是什么' }, slug: 'index' },
      { title: { en: 'Getting started', es: 'Primeros pasos', zh: '快速上手' }, slug: 'getting-started' },
      { title: { en: 'Demos to run', es: 'Demos para correr', zh: '可运行的演示' }, slug: 'demos' },
    ],
  },
  {
    title: { en: 'Put it in your app', es: 'Ponlo en tu aplicación', zh: '放进你的应用' },
    color: 'purple',
    items: [
      { title: { en: 'React component', es: 'Componente de React', zh: 'React 组件' }, slug: 'react' },
      { title: { en: 'Headless: your own UI', es: 'Headless: tu propia interfaz', zh: 'Headless：你自己的界面' }, slug: 'headless' },
      { title: { en: 'A complete interface', es: 'Una interfaz completa', zh: '一套完整的界面' }, slug: 'example' },
      { title: { en: 'Without a framework', es: 'Sin framework', zh: '不用框架' }, slug: 'vanilla' },
      { title: { en: 'Only to read: the viewer', es: 'Solo para leer: el visor', zh: '只读：查看器' }, slug: 'viewer' },
      { title: { en: 'Styling and Tailwind', es: 'Estilos y Tailwind', zh: '样式与 Tailwind' }, slug: 'styling' },
      { title: { en: 'Phones and touch', es: 'Teléfonos y pantallas táctiles', zh: '手机与触屏' }, slug: 'mobile' },
      { title: { en: 'Accessibility', es: 'Accesibilidad', zh: '无障碍' }, slug: 'accessibility' },
    ],
  },
  {
    title: { en: 'Documents', es: 'Documentos', zh: '文档' },
    color: 'yellow',
    items: [
      { title: { en: 'Templates and variables', es: 'Plantillas y variables', zh: '模板与变量' }, slug: 'templates' },
      { title: { en: 'On a server: DOCX and PDF', es: 'En un servidor: DOCX y PDF', zh: '在服务器上：DOCX 与 PDF' }, slug: 'server' },
      { title: { en: 'Documents in an S3 bucket', es: 'Documentos en un bucket S3', zh: 'S3 存储桶中的文档' }, slug: 'storage' },
      { title: { en: 'Letterheads', es: 'Membretes', zh: '信头' }, slug: 'letterhead' },
      { title: { en: 'Versions', es: 'Versiones', zh: '版本' }, slug: 'versions' },
      { title: { en: 'Tracked changes', es: 'Control de cambios', zh: '修订' }, slug: 'tracked-changes' },
      { title: { en: 'Fonts', es: 'Fuentes', zh: '字体' }, slug: 'fonts' },
      { title: { en: 'Languages', es: 'Idiomas', zh: '语言' }, slug: 'languages' },
    ],
  },
  {
    title: { en: 'Together', es: 'En equipo', zh: '协作' },
    color: 'pink',
    items: [
      { title: { en: 'Real-time collaboration', es: 'Colaboración en tiempo real', zh: '实时协作' }, slug: 'collaboration' },
      { title: { en: 'AI assistants (MCP)', es: 'Asistentes de IA (MCP)', zh: 'AI 助手（MCP）' }, slug: 'assistants' },
    ],
  },
  {
    title: { en: 'Reference', es: 'Referencia', zh: '参考' },
    color: 'green',
    items: [
      { title: { en: 'Packages', es: 'Paquetes', zh: '软件包' }, slug: 'packages' },
      { title: { en: 'Components and hooks', es: 'Componentes y hooks', zh: '组件与 Hooks' }, slug: 'components' },
      { title: { en: 'Editor API', es: 'API del Editor', zh: 'Editor API' }, slug: 'editor-api' },
      { title: { en: 'How it works', es: 'Cómo funciona', zh: '工作原理' }, slug: 'architecture' },
      { title: { en: 'Status and roadmap', es: 'Estado y hoja de ruta', zh: '现状与路线图' }, slug: 'status' },
    ],
  },
];

export const PAGES = NAV.flatMap((group) => group.items);
/** The group a page is in, for the line above its title. */
export const groupOf = (slug: string) => NAV.find((group) => group.items.some((item) => item.slug === slug));
export const hrefOf = (slug: string) => (slug === 'index' ? '/docs/' : `/docs/${slug}/`);
/** The same page as Markdown, for language models: made by scripts/llms.ts once the site is built. */
export const markdownOf = (slug: string) => `/docs/${slug}.md`;
