import { useId, useState } from 'react';
import type { Lang } from '../i18n/ui';

type Bi = { vi: string; en: string };
export type QuizItem = { q: Bi; options: Bi[]; answer: number; why: Bi };

/** Deterministic option order per question (same on server and client), so answers are not always first. */
const order = (n: number, seed: number): number[] =>
  Array.from({ length: n }, (_, j) => j).sort((a, b) => ((a * 7 + seed * 3) % 11) - ((b * 7 + seed * 3) % 11) || a - b);

export default function Quiz({ lang, items }: { lang: Lang; items: QuizItem[] }) {
  const uid = useId();
  const [picked, setPicked] = useState<Record<number, number>>({});
  const done = Object.keys(picked).length;
  const score = items.reduce((s, it, i) => s + (picked[i] === it.answer ? 1 : 0), 0);
  const vi = lang === 'vi';

  return (
    <div className="quiz">
      <ol>
        {items.map((it, i) => (
          <li key={i}>
            <fieldset>
              <legend>{it.q[lang]}</legend>
              {order(it.options.length, i).map((j) => (
                <label key={j}>
                  <input type="radio" name={`${uid}-q${i}`} checked={picked[i] === j} aria-disabled={picked[i] != null}
                    onChange={() => setPicked((p) => (p[i] != null ? p : { ...p, [i]: j }))} />
                  <span>{it.options[j][lang]}</span>
                </label>
              ))}
              {picked[i] != null && (
                <p className={picked[i] === it.answer ? 'fb-ok' : 'fb-bad'} role="status">
                  <strong>{picked[i] === it.answer ? (vi ? 'Đúng. ' : 'Correct. ') : (vi ? `Chưa đúng — đáp án: ${it.options[it.answer][lang]}. ` : `Not quite — answer: ${it.options[it.answer][lang]}. `)}</strong>
                  <span style={{ color: 'var(--fg)' }}>{it.why[lang]}</span>
                </p>
              )}
            </fieldset>
          </li>
        ))}
      </ol>
      <p className="num" aria-live="polite">
        {vi ? `Kết quả: ${score}/${items.length} (đã trả lời ${done})` : `Score: ${score}/${items.length} (${done} answered)`}
        {done > 0 && <> · <button type="button" className="btn" onClick={() => setPicked({})}>{vi ? 'Làm lại' : 'Reset'}</button></>}
      </p>
    </div>
  );
}
