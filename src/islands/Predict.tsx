import { useId, useState } from 'react';
import type { Lang } from '../i18n/ui';

type Slider = { min: number; max: number; step: number; unit?: string };
type Props = {
  lang: Lang;
  /** Short prompt in the card header. */
  title: string;
  q: string;
  /** Multiple choice: option labels, `answer` = index of the right one. */
  options?: string[];
  /** Estimate on a slider: `answer` = the true value, `tol` = accepted absolute error. */
  slider?: Slider;
  answer: number;
  tol?: number;
  why: string;
};

const TXT = {
  vi: { tag: 'Đoán trước', pick: 'Chọn một đáp án trước khi đọc tiếp. Đoán sai cũng giúp nhớ lâu hơn.', guess: 'Ước lượng của bạn', show: 'Xem đáp án',
        slideHint: 'Kéo thanh trượt tới con số bạn tin là đúng, rồi mới bấm xem đáp án.', right: 'Chính xác.', close: 'Khá gần.', wrong: 'Chưa đúng.', ans: 'Đáp án' },
  en: { tag: 'Predict first', pick: 'Pick an answer before reading on. A wrong guess still helps you remember.', guess: 'Your estimate', show: 'Show answer',
        slideHint: 'Drag the slider to the value you believe, then reveal the answer.', right: 'Correct.', close: 'Close.', wrong: 'Not quite.', ans: 'Answer' },
};

/** "Guess before you read": a prediction prompt that reveals the answer and the reasoning after one try. */
export default function Predict({ lang, title, q, options, slider, answer, tol, why }: Props) {
  const T = TXT[lang];
  const id = useId();
  const [picked, setPicked] = useState<number | null>(null);
  const [guess, setGuess] = useState(slider ? (slider.min + slider.max) / 2 : 0);
  const [shown, setShown] = useState(false);
  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const dec = slider ? Math.max(0, -Math.floor(Math.log10(slider.step))) : 0;
  const fmt = (v: number) => `${v.toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec })}${slider?.unit ? ` ${slider.unit}` : ''}`;
  const done = options ? picked != null : shown;
  const verdict = options
    ? (picked === answer ? T.right : T.wrong)
    : Math.abs(guess - answer) <= (tol ?? 0) ? T.right : Math.abs(guess - answer) <= 3 * (tol ?? Math.abs(answer) * 0.1) ? T.close : T.wrong;

  return (
    <section className="predict" aria-labelledby={`${id}-t`}>
      <div className="fig-head"><span className="mono-label">{T.tag}</span><p className="fig-title" id={`${id}-t`}>{title}</p></div>
      <div className="predict-body">
        <p className="predict-q">{q}</p>
        {options ? (
          <div className="pred-opts" role="group" aria-label={q}>
            {options.map((o, i) => (
              <button key={i} type="button" disabled={picked != null} onClick={() => setPicked(i)}
                className={picked == null ? undefined : i === answer ? 'is-correct' : i === picked ? 'is-wrong' : undefined}>{o}</button>
            ))}
          </div>
        ) : slider && (
          <div className="pred-slider">
            <div className="row"><label htmlFor={`${id}-s`}>{T.guess}</label><output htmlFor={`${id}-s`}>{fmt(guess)}</output></div>
            <input id={`${id}-s`} type="range" min={slider.min} max={slider.max} step={slider.step} value={guess} disabled={shown}
              onChange={(e) => setGuess(Number(e.target.value))} />
            {!shown && <div><button type="button" className="btn primary" onClick={() => setShown(true)}>{T.show}</button></div>}
          </div>
        )}
        {!done && <p className="pred-hint">{options ? T.pick : T.slideHint}</p>}
        {done && (
          <div className="pred-ans" role="status">
            <b>{verdict}</b>{slider && <> {T.ans}: <b>{fmt(answer)}</b>.</>} {why}
          </div>
        )}
      </div>
    </section>
  );
}
