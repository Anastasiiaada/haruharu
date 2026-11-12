import {describe,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Question} from './PracticeQuestion';
import type {Exercise} from '../models';

vi.mock('./Speech',()=>({SpeakButton:()=>null}));

const exercise:Exercise = {id:'manual',kind:'write',topic:'Слова',prompt:'Напиши корейською',answer:'사과',explanation:'',demo:false};

describe('exam answer fields',()=>{
  it('requests no correction or capitalization for every manually entered exam answer',()=>{
    for(const kind of ['write','dictation','gap','particle'] as const) {
      const html = renderToStaticMarkup(<Question exercise={{...exercise,kind}} exam onAnswer={()=>{}}/>);
      expect(html).toContain('autoComplete="off"');
      expect(html).toContain('autoCorrect="off"');
      expect(html).toContain('autoCapitalize="none"');
      expect(html).toContain('spellCheck="false"');
      expect(html).toContain('lang="ko"');
    }
  });

  it('leaves correction and capitalization preferences available in regular practice',()=>{
    const html = renderToStaticMarkup(<Question exercise={exercise} onAnswer={()=>{}}/>);
    expect(html).not.toContain('autoCorrect="off"');
    expect(html).not.toContain('autoCapitalize="none"');
    expect(html).not.toContain('spellCheck="false"');
  });
});
