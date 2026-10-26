import { LocalLink } from '@/components/i18n';
import { LIGHT_THEME, highlight } from '@/lib/docs';
import { PASTEL_CLASS, VERSION } from '@/lib/home';
import { getT } from '@/lib/locale';
import { NPM_ORG } from '@/lib/site';
import { Callout, HandTip, SectionHead } from '../ui';
import { ALL_PACKAGES, APPS, PACKAGE_DOCS } from './data';
import { PackagePicker } from './PackagePicker';
import { PackageTabs } from './PackageTabs';

const mono = 'font-code text-[13px]';
const COLUMNS = 'grid grid-cols-[1.15fr_1.2fr_1.1fr_1.2fr]';

/**
 * "Packages": the five, which one to install, where each runs, and the
 * applications in the repository that use them. The code is coloured here,
 * when the site is built.
 */
export async function PackagesPage() {
  const t = getT();
  const examples = Object.fromEntries(
    await Promise.all(PACKAGE_DOCS.map(async (pkg) => [pkg.name, (await Promise.all(pkg.example.map(([lang, code]) => highlight(code, lang, LIGHT_THEME)))).join('')] as const)),
  );

  return (
    <>
      <h1 className="m-0 mt-3 font-display text-[clamp(36px,4vw,48px)] font-extrabold leading-[1.08] tracking-[-0.03em]">{t({ en: 'Packages', es: 'Paquetes', zh: '软件包' })}</h1>
      <p className="m-0 mt-3.5 max-w-[680px] text-lg leading-[1.6] text-muted">
        {t({ en: 'Six packages, each for one thing, all ', es: 'Seis paquetes, cada uno para una cosa, todos ', zh: '六个软件包，各司其职，全部' })}
        <a href={NPM_ORG} className="font-medium text-brand hover:text-brand-hover">
          {t({ en: 'on npm', es: 'en npm', zh: '发布在 npm 上' })}
        </a>
        {t({ en: ' at the same version, ', es: ' con la misma versión, ', zh: '，版本相同：' })}
        <code className="rounded-[5px] bg-hover px-1.5 py-0.5 font-code text-[15px] text-ink">{VERSION}</code>
        {t({ en: '. Most applications need one.', es: '. La mayoría de las aplicaciones necesita uno.', zh: '。大多数应用只需要其中一个。' })}
      </p>
      <div className="mt-4">
        <HandTip>{t({ en: 'tip: press ⌘K to jump to any package', es: 'tip: pulsa ⌘K para saltar a cualquier paquete', zh: '提示：按 ⌘K 跳到任意软件包' })}</HandTip>
      </div>

      <section aria-labelledby="pick" className="mt-16">
        <SectionHead
          id="pick"
          badge={t({ en: 'Start here', es: 'Empieza aquí', zh: '从这里开始' })}
          color="blue"
          title={t({ en: 'Which one do I install?', es: '¿Cuál instalo?', zh: '我该装哪一个？' })}
        >
          {t({
            en: 'Pick what you are making. The drawing shows what you install, what comes inside it, and who uses whom.',
            es: 'Elige lo que estás haciendo. El dibujo muestra qué instalas, qué viene dentro, y quién usa a quién.',
            zh: '选择你要做的东西。图中展示了你需要安装什么、里面内置了什么，以及谁依赖谁。',
          })}
        </SectionHead>
        <PackagePicker />
        <Callout title={t({ en: 'One engine, not two.', es: 'Un motor, no dos.', zh: '一个引擎，而不是两个。' })}>
          {t({
            en: (
              <>
                <code className={mono}>@rebodocs/react</code> is built as one file with the engine, the editor and the collaboration client inside. The others ask npm for{' '}
                <code className={mono}>@rebodocs/core</code> and share one copy of it, so a <code className={mono}>Doc</code> made with core is the one they take. An application that installs both{' '}
                <code className={mono}>@rebodocs/react</code> and <code className={mono}>@rebodocs/core</code> has the engine twice.
              </>
            ),
            es: (
              <>
                <code className={mono}>@rebodocs/react</code> se compila como un solo archivo con el motor, el editor y el cliente de colaboración dentro. Los demás le piden a npm{' '}
                <code className={mono}>@rebodocs/core</code> y comparten una sola copia, así que un <code className={mono}>Doc</code> hecho con core es el mismo que reciben. Una aplicación que instala{' '}
                <code className={mono}>@rebodocs/react</code> y también <code className={mono}>@rebodocs/core</code> tiene el motor dos veces.
              </>
            ),
            zh: (
              <>
                <code className={mono}>@rebodocs/react</code> 被打包成一个文件，内含引擎、编辑器和协作客户端。其他软件包则通过 npm 依赖 <code className={mono}>@rebodocs/core</code>{' '}
                并共享同一份副本，因此用 core 创建的 <code className={mono}>Doc</code> 可以直接交给它们。如果一个应用同时安装了 <code className={mono}>@rebodocs/react</code> 和{' '}
                <code className={mono}>@rebodocs/core</code>，引擎就会有两份。
              </>
            ),
          })}
        </Callout>
      </section>

      <section aria-labelledby="where" className="mt-24">
        <SectionHead
          id="where"
          badge={t({ en: 'At a glance', es: 'De un vistazo', zh: '一览' })}
          color="green"
          title={t({ en: 'Where each one runs', es: 'Dónde corre cada uno', zh: '各自的运行环境' })}
        >
          {t({
            en: 'The six side by side: where each runs, what it is built for, and what it brings with it.',
            es: 'Los seis lado a lado: dónde corre cada uno, para qué está compilado, y qué trae consigo.',
            zh: '六个软件包并排对比：各自在哪里运行、为什么环境构建、以及依赖什么。',
          })}
        </SectionHead>
        <ul className="m-0 mt-6 flex list-none flex-wrap items-center gap-2 p-0">
          <li className="mr-1 text-sm text-muted">{t({ en: 'All six:', es: 'Los seis:', zh: '六个都是：' })}</li>
          {ALL_PACKAGES.map((fact) => (
            <li key={fact.en} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-ink-soft">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d="M2.5 6.2l2.2 2.2L9.5 3.6" fill="none" stroke="#2E6B3C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t(fact)}
            </li>
          ))}
        </ul>
        <div className="mt-4 overflow-x-auto rounded-[14px] border border-border">
          <div role="table" aria-label={t({ en: 'Where each package runs', es: 'Dónde corre cada paquete', zh: '各软件包的运行环境' })} className="min-w-[760px]">
            <div role="row" className={`${COLUMNS} bg-surface text-xs font-semibold tracking-[0.04em] text-muted`}>
              <div role="columnheader" className="px-5 py-3">
                {t({ en: 'PACKAGE', es: 'PAQUETE', zh: '软件包' })}
              </div>
              <div role="columnheader" className="px-5 py-3">
                {t({ en: 'RUNS IN', es: 'CORRE EN', zh: '运行环境' })}
              </div>
              <div role="columnheader" className="px-5 py-3">
                {t({ en: 'BUILT FOR', es: 'COMPILADO PARA', zh: '构建目标' })}
              </div>
              <div role="columnheader" className="px-5 py-3">
                {t({ en: 'DEPENDS ON', es: 'DEPENDE DE', zh: '依赖' })}
              </div>
            </div>
            {PACKAGE_DOCS.map((pkg) => (
              <div key={pkg.name} role="row" className={`${COLUMNS} border-t border-border text-[15px] transition-colors hover:bg-[#fcfcfb]`}>
                <div role="cell" className="flex flex-wrap items-center gap-2 px-5 py-4">
                  <a href={`#package-${pkg.name.replace('@rebodocs/', '')}`} className="font-code font-medium text-ink hover:text-brand">
                    {pkg.name}
                  </a>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PASTEL_CLASS[pkg.color]}`}>{t(pkg.tag)}</span>
                </div>
                <div role="cell" className="px-5 py-4 leading-normal text-ink-soft">
                  {pkg.runsIn.map(t).join(' · ')}
                </div>
                <div role="cell" className="px-5 py-4 font-code text-[13px] leading-normal text-muted">
                  {t(pkg.target)}
                </div>
                <div role="cell" className="flex flex-wrap gap-1.5 px-5 py-4">
                  {pkg.dependsOn.map((dependency) => (
                    <code key={dependency.en} className="rounded-[5px] bg-hover px-1.75 py-0.5 font-code text-[12.5px] text-ink">
                      {t(dependency)}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Callout title={t({ en: 'Same version, all of them.', es: 'La misma versión, todos.', zh: '版本统一。' })}>
          {t({
            en: 'Every package is published at the same version, and they expect each other at it: update them together. Rebodocs is 0.x and pre-release, so a new version may change an API; what is done and what is coming is in ',
            es: 'Todos los paquetes se publican con la misma versión, y se esperan entre sí en ella: actualízalos juntos. Rebodocs está en 0.x, antes de su primera versión estable, así que una versión nueva puede cambiar una API; lo que está hecho y lo que viene está en ',
            zh: '所有软件包都以相同版本发布，并相互依赖于该版本：请一起升级。Rebodocs 目前处于 0.x 预发布阶段，新版本可能会修改 API；已完成和即将推出的内容请见',
          })}
          <LocalLink href="/docs/status/" className="font-medium text-brand hover:text-brand-hover">
            {t({ en: 'Status and roadmap', es: 'Estado y hoja de ruta', zh: '现状与路线图' })}
          </LocalLink>
          {t({ en: '.', es: '.', zh: '。' })}
        </Callout>
      </section>

      <section aria-labelledby="packages" className="mt-24">
        <SectionHead id="packages" badge={t({ en: '6 packages', es: '6 paquetes', zh: '6 个软件包' })} color="purple" title={t({ en: 'The packages', es: 'Los paquetes', zh: '软件包' })}>
          {t({
            en: 'One at a time: how to get it, what it has, and the least code that uses it.',
            es: 'Uno a la vez: cómo obtenerlo, qué tiene, y el código mínimo que lo usa.',
            zh: '逐个介绍：如何获取、包含什么，以及使用它的最少代码。',
          })}
        </SectionHead>
        <PackageTabs examples={examples} />
      </section>

      <section aria-labelledby="apps" className="mt-24">
        <SectionHead
          id="apps"
          badge={t({ en: `${APPS.length} applications`, es: `${APPS.length} aplicaciones`, zh: `${APPS.length} 个应用` })}
          color="orange"
          title={t({ en: 'The applications', es: 'Las aplicaciones', zh: '应用' })}
        >
          {t({
            en: 'Besides the packages, the repository has small applications that use them: each one a way of putting the editor in a product. See ',
            es: 'Además de los paquetes, el repositorio tiene aplicaciones pequeñas que los usan: cada una, una forma de poner el editor en un producto. Ve ',
            zh: '除了软件包，仓库中还有一些使用它们的小应用：每个都展示了一种把编辑器放进产品的方式。请见',
          })}
          <LocalLink href="/docs/demos/" className="font-medium text-brand hover:text-brand-hover">
            {t({ en: 'Demos to run', es: 'Demos para correr', zh: '可运行的演示' })}
          </LocalLink>
          {t({ en: '.', es: '.', zh: '。' })}
        </SectionHead>
        <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          {APPS.map((app) => (
            <div key={app.path} className="lift flex flex-col gap-2.5 rounded-2xl border border-border p-5.5">
              <code className="font-code text-[15px] font-medium text-ink">{app.path}</code>
              <p className="m-0 flex-1 text-[15px] leading-[1.6] text-ink-soft">{t(app.what)}</p>
              {app.run && <code className="self-start rounded-md border border-border bg-surface px-2 py-0.75 font-code text-[12.5px] text-muted">$ {app.run}</code>}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
