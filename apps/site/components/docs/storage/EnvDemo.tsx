'use client';

// The environment of apps/storage for the S3 picked, and the rule of origins
// for the address of the page: what .env.example and scripts/cors.ts say,
// with your values in them.

import { useState } from 'react';
import { useT } from '@/components/i18n';
import { PASTEL_CLASS } from '@/lib/home';
import type { L } from '@/lib/i18n';
import { CAPTION, CODE } from '../styles';
import { DemoBox } from '../ui';
import { PROVIDERS } from './data';

/** What each S3 asks for, in the language of the page. */
const ASK: Record<string, L> = {
  'Account id': { en: 'Account id', es: 'Account id', zh: '账户 ID' },
  'Region of the bucket': { en: 'Region of the bucket', es: 'Región del bucket', zh: '存储桶所在区域' },
  Region: { en: 'Region', es: 'Región', zh: '区域' },
};

export default function EnvDemo() {
  const [picked, setPicked] = useState(0);
  const [place, setPlace] = useState('');
  const [bucket, setBucket] = useState('rebodocs-demo');
  const [origin, setOrigin] = useState('http://localhost:5176');
  const provider = PROVIDERS[picked];
  const t = useT();

  const env = [
    provider.endpoint
      ? `S3_ENDPOINT=${provider.endpoint.replace('<place>', place || provider.placeholder)}`
      : t({
          en: '# S3_ENDPOINT left out: AWS finds the bucket by its region',
          es: '# Sin S3_ENDPOINT: AWS encuentra el bucket por su región',
          zh: '# 不设置 S3_ENDPOINT：AWS 会根据区域找到存储桶',
        }),
    `S3_REGION=${provider.region === '<place>' ? place || provider.placeholder : provider.region}`,
    `S3_BUCKET=${bucket || 'rebodocs-demo'}`,
    'S3_ACCESS_KEY_ID=…',
    'S3_SECRET_ACCESS_KEY=…',
    ...(provider.pathStyle ? ['S3_FORCE_PATH_STYLE=true'] : []),
  ].join('\n');
  const cors = JSON.stringify([{ AllowedOrigins: [origin.replace(/\/+$/, '')], AllowedMethods: ['GET', 'PUT'], AllowedHeaders: ['content-type'], MaxAgeSeconds: 3600 }], null, 2);
  const input = 'mt-1.5 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 font-code text-[13px] normal-case tracking-normal text-ink';

  return (
    <DemoBox
      title={t({ en: 'Your .env', es: 'Tu .env', zh: '你的 .env' })}
      aside={
        <>
          <div>
            <p className={CAPTION} id="env-s3">
              {t({ en: 'The S3', es: 'El S3', zh: 'S3 服务' })}
            </p>
            <div role="group" aria-labelledby="env-s3" className="mt-2.5 flex flex-wrap gap-2">
              {PROVIDERS.map((one, i) => (
                <button
                  key={one.name}
                  type="button"
                  aria-pressed={picked === i}
                  onClick={() => setPicked(i)}
                  className={`cursor-pointer rounded-full border px-3 py-1 text-sm font-semibold ${picked === i ? `border-transparent ${PASTEL_CLASS.blue}` : 'border-border bg-white text-ink-soft hover:bg-hover'}`}
                >
                  {one.name}
                </button>
              ))}
            </div>
          </div>
          {provider.ask && (
            <label className={CAPTION}>
              {t(ASK[provider.ask] ?? { en: provider.ask, es: provider.ask, zh: provider.ask })}
              <input value={place} placeholder={provider.placeholder} onChange={(e) => setPlace(e.target.value.trim())} className={input} />
            </label>
          )}
          <label className={CAPTION}>
            Bucket
            <input value={bucket} onChange={(e) => setBucket(e.target.value.trim())} className={input} />
          </label>
          <label className={CAPTION}>
            {t({ en: 'The page’s origin', es: 'El origen de la página', zh: '页面来源' })}
            <input value={origin} onChange={(e) => setOrigin(e.target.value.trim())} className={input} />
          </label>
          <p className="m-0 text-[13px] leading-normal text-muted">{t(provider.note)}</p>
        </>
      }
    >
      <p className={CAPTION}>apps/storage/.env</p>
      <div className={`mt-2 ${CODE}`}>
        <pre>{env}</pre>
      </div>
      <p className={`${CAPTION} mt-5`}>{t({ en: 'The bucket’s CORS policy', es: 'La política CORS del bucket', zh: '存储桶的 CORS 策略' })}</p>
      <div className={`mt-2 ${CODE}`}>
        <pre>{cors}</pre>
      </div>
    </DemoBox>
  );
}
