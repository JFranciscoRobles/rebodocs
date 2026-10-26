import { DocPage, docMetadata, docParams, slugOf } from '@/components/pages/DocPage';

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;
export const generateStaticParams = docParams;

export async function generateMetadata({ params }: Props) {
  return docMetadata(slugOf((await params).slug), 'en');
}

export default async function Doc({ params }: Props) {
  return <DocPage slug={slugOf((await params).slug)} locale="en" />;
}
