// @vitest-environment jsdom
import {afterEach,describe,expect,it,vi} from 'vitest';
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {LearningScreen} from './LearningScreen';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('learning viewport',()=>{
  it.each([568,667,812,844])('allocates the space below the header at viewport height %i',async height=>{
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
    vi.spyOn(window,'scrollTo').mockImplementation(()=>{});
    vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
    const viewport=Object.assign(new EventTarget(),{height,offsetTop:0});
    vi.stubGlobal('visualViewport',viewport);
    vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue(new DOMRect(0,94,375,0));
    const host=document.createElement('div');
    document.body.append(host);
    const root=createRoot(host);
    await act(async()=>root.render(<LearningScreen toolbar="Прогрес" actions={<button>Перевірити</button>}><input aria-label="Відповідь"/></LearningScreen>));
    const screen=host.querySelector<HTMLElement>('.learning-screen')!;
    expect(screen.style.getPropertyValue('--study-height')).toBe(`${height-94}px`);
    const input=host.querySelector('input')!;
    input.focus();
    viewport.height=height-280;
    await act(async()=>{viewport.dispatchEvent(new Event('resize'));});
    expect(screen.style.getPropertyValue('--study-height')).toBe(`${height-374}px`);
    expect(document.activeElement).toBe(input);
    expect(host.querySelector('.learning-actions button')).not.toBeNull();
    await act(async()=>root.unmount());
    host.remove();
  });
});
