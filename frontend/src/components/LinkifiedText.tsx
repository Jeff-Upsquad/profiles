'use client';

import { Fragment } from 'react';
import { splitTextLinks } from '@/lib/textLinks';

/** React escapes the surrounding text; only validated HTTP(S) URLs become links. */
export default function LinkifiedText({ text }: { text: string }) {
  return <>{splitTextLinks(text).map((part, index) => part.href
    ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()} className="break-words underline underline-offset-2 hover:opacity-75">{part.text}</a>
    : <Fragment key={index}>{part.text}</Fragment>)}</>;
}
